import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorLineCommand = "move-up" | "move-down" | "duplicate" | "delete"

export type SelectedBlockOffsets = {
  blockStart: number
  blockEnd: number
}

type LineSpan = {
  start: number
  end: number
  text: string
}

const FENCE_LINE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/
const DIRECTIVE_OPEN_RE =
  /^(:{3,})\s*(?:callout|summary|tip|info|note|warning|warn|caution|danger|important|abstract|tldr|toggle|bookmark|embed|video|youtube|file|attachment|pdf)\b/i
const DIRECTIVE_CLOSE_RE = /^(:{3,})\s*$/

const readLineAt = (value: string, offset: number): LineSpan => {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const start = clamped === 0 ? 0 : value.lastIndexOf("\n", clamped - 1) + 1
  const nextBreak = value.indexOf("\n", clamped)
  const end = nextBreak === -1 ? value.length : nextBreak
  return { start, end, text: value.slice(start, end) }
}

const splitLinesWithOffsets = (value: string): LineSpan[] => {
  const lines: LineSpan[] = []
  let pos = 0
  while (pos <= value.length) {
    const nextBreak = value.indexOf("\n", pos)
    const end = nextBreak === -1 ? value.length : nextBreak
    lines.push({ start: pos, end, text: value.slice(pos, end) })
    if (nextBreak === -1) break
    pos = nextBreak + 1
  }
  return lines
}

const isPipeTableRow = (trimmed: string): boolean =>
  trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length >= 2

const isTableSeparatorRow = (trimmed: string): boolean =>
  isPipeTableRow(trimmed) && /^\|(?:\s*:?-{2,}:?\s*\|)+\s*$/.test(trimmed)

const findLineIndexAtOffset = (lines: readonly LineSpan[], offset: number): number => {
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const span = lines[mid]!
    if (offset < span.start) {
      hi = mid - 1
    } else if (offset > span.end) {
      lo = mid + 1
    } else {
      return mid
    }
  }
  return Math.max(0, Math.min(lines.length - 1, lo))
}

const collectContainerBlocks = (lines: readonly LineSpan[]): Array<{ startLine: number; endLine: number }> => {
  const blocks: Array<{ startLine: number; endLine: number }> = []
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i]!.text.trim()
    const fenceMatch = FENCE_LINE_RE.exec(trimmed)
    if (fenceMatch && (fenceMatch[2]![0] === "~" || !fenceMatch[3]!.includes("`"))) {
      const markerChar = fenceMatch[2]![0]!
      const markerLen = fenceMatch[2]!.length
      const startLine = i
      let closed = false
      i += 1
      while (i < lines.length) {
        const closeMatch = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(lines[i]!.text.trim())
        if (closeMatch && closeMatch[2]![0] === markerChar && closeMatch[2]!.length >= markerLen) {
          closed = true
          break
        }
        i += 1
      }
      if (closed) {
        blocks.push({ startLine, endLine: i })
        i += 1
      } else {
        i = startLine + 1
      }
      continue
    }

    const directiveOpen = DIRECTIVE_OPEN_RE.exec(trimmed)
    if (directiveOpen) {
      const startLine = i
      let depth = 1
      const minLen = directiveOpen[1]!.length
      i += 1
      while (i < lines.length) {
        const innerTrimmed = lines[i]!.text.trim()
        const innerFence = FENCE_LINE_RE.exec(innerTrimmed)
        if (innerFence && (innerFence[2]![0] === "~" || !innerFence[3]!.includes("`"))) {
          const fc = innerFence[2]![0]!
          const fl = innerFence[2]!.length
          i += 1
          while (i < lines.length) {
            const cm = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(lines[i]!.text.trim())
            if (cm && cm[2]![0] === fc && cm[2]!.length >= fl) break
            i += 1
          }
          i += 1
          continue
        }
        const nestedOpen = DIRECTIVE_OPEN_RE.exec(innerTrimmed)
        if (nestedOpen) {
          depth += 1
        } else {
          const closeMatch = DIRECTIVE_CLOSE_RE.exec(innerTrimmed)
          if (closeMatch && closeMatch[1]!.length >= minLen) {
            depth -= 1
            if (depth <= 0) break
          }
        }
        i += 1
      }
      if (depth <= 0 && i < lines.length) {
        blocks.push({ startLine, endLine: i })
        i += 1
      } else {
        i = startLine + 1
      }
      continue
    }

    if (
      i + 1 < lines.length &&
      isPipeTableRow(trimmed) &&
      isTableSeparatorRow(lines[i + 1]!.text.trim())
    ) {
      const startLine = i
      i += 2
      while (i < lines.length && isPipeTableRow(lines[i]!.text.trim())) {
        i += 1
      }
      blocks.push({ startLine, endLine: i - 1 })
      continue
    }

    i += 1
  }
  return blocks
}

export const resolveContainerAwareBlockRange = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): SelectedBlockOffsets | null => {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    return null
  }

  const endProbe = selectionStart === selectionEnd ? selectionStart : selectionEnd - 1
  const hasPotentialContainer =
    value.includes("```") || value.includes("~~~") || value.includes(":::") || value.includes("|")
  if (!hasPotentialContainer) {
    const startSpan = readLineAt(value, selectionStart)
    const endSpan = readLineAt(value, endProbe)
    return { blockStart: startSpan.start, blockEnd: endSpan.end }
  }

  const lines = splitLinesWithOffsets(value)
  let startLineIdx = findLineIndexAtOffset(lines, selectionStart)
  let endLineIdx = findLineIndexAtOffset(lines, endProbe)
  const containers = collectContainerBlocks(lines)

  for (const container of containers) {
    if (startLineIdx <= container.endLine && endLineIdx >= container.startLine) {
      startLineIdx = Math.min(startLineIdx, container.startLine)
      endLineIdx = Math.max(endLineIdx, container.endLine)
    }
  }

  return {
    blockStart: lines[startLineIdx]!.start,
    blockEnd: lines[endLineIdx]!.end,
  }
}

const planMove = (
  value: string,
  blockStart: number,
  blockEnd: number,
  selectionStart: number,
  selectionEnd: number,
  direction: "up" | "down"
): PlannedTextMutation | null => {
  if (direction === "up" && blockStart === 0) return null
  if (direction === "down" && blockEnd === value.length) return null

  const adjProbe = direction === "up" ? blockStart - 1 : blockEnd + 1
  const adjacent = resolveContainerAwareBlockRange(value, adjProbe, adjProbe)
  if (!adjacent) return null
  const adjStart = adjacent.blockStart
  const adjEnd = adjacent.blockEnd

  const rangeStart = direction === "up" ? adjStart : blockStart
  const rangeEnd = direction === "up" ? blockEnd : adjEnd
  const before = value.slice(blockStart, blockEnd)
  const after = value.slice(adjStart, adjEnd)
  const replacement = direction === "up" ? `${before}\n${after}` : `${after}\n${before}`
  const movedBlockStart = rangeStart + (direction === "up" ? 0 : after.length + 1)
  const relativeSelectionStart = Math.min(selectionStart - blockStart, before.length)
  const relativeSelectionEnd = Math.min(selectionEnd - blockStart, before.length)

  return {
    rangeStart,
    rangeEnd,
    replacement,
    selectionStart: movedBlockStart + relativeSelectionStart,
    selectionEnd: movedBlockStart + relativeSelectionEnd,
  }
}

export const planMoveBlockToOffset = (
  value: string,
  sourceOffset: number,
  targetOffset: number,
  placeAfterTarget = false
): PlannedTextMutation | null => {
  const source = resolveContainerAwareBlockRange(value, sourceOffset, sourceOffset)
  const target = resolveContainerAwareBlockRange(value, targetOffset, targetOffset)
  if (!source || !target) return null
  if (target.blockStart >= source.blockStart && target.blockEnd <= source.blockEnd) {
    return null
  }

  const movingBlock = value.slice(source.blockStart, source.blockEnd)

  if (target.blockStart < source.blockStart) {
    const insertStart = placeAfterTarget ? target.blockEnd + 1 : target.blockStart
    if (insertStart >= source.blockStart) return null
    const between = value.slice(insertStart, source.blockStart - 1)
    const replacement = `${movingBlock}\n${between}`
    return {
      rangeStart: insertStart,
      rangeEnd: source.blockEnd,
      replacement,
      selectionStart: insertStart,
      selectionEnd: insertStart,
    }
  }

  const insertEnd = placeAfterTarget ? target.blockEnd : target.blockStart - 1
  if (insertEnd <= source.blockEnd) return null
  const between = value.slice(source.blockEnd + 1, insertEnd)
  const replacement = `${between}\n${movingBlock}`
  const nextSelectionStart = source.blockStart + between.length + 1
  return {
    rangeStart: source.blockStart,
    rangeEnd: insertEnd,
    replacement,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionStart,
  }
}

const planDuplicate = (
  value: string,
  blockStart: number,
  blockEnd: number,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  const block = value.slice(blockStart, blockEnd)
  const copiedBlockStart = blockEnd + 1
  const relativeSelectionStart = Math.min(selectionStart - blockStart, block.length)
  const relativeSelectionEnd = Math.min(selectionEnd - blockStart, block.length)

  return {
    rangeStart: blockStart,
    rangeEnd: blockEnd,
    replacement: `${block}\n${block}`,
    selectionStart: copiedBlockStart + relativeSelectionStart,
    selectionEnd: copiedBlockStart + relativeSelectionEnd,
  }
}

const planDelete = (value: string, blockStart: number, blockEnd: number): PlannedTextMutation => {
  const hasFollowingLine = blockEnd < value.length
  let rangeStart = blockStart
  if (!hasFollowingLine) {
    rangeStart = blockStart > 0 ? blockStart - 1 : 0
  }
  const rangeEnd = hasFollowingLine ? blockEnd + 1 : blockEnd
  return { rangeStart, rangeEnd, replacement: "", selectionStart: rangeStart, selectionEnd: rangeStart }
}

export const planMarkdownEditorLineCommand = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  command: MarkdownEditorLineCommand
): PlannedTextMutation | null => {
  const selection = resolveContainerAwareBlockRange(value, selectionStart, selectionEnd)
  if (!selection) return null

  const { blockStart, blockEnd } = selection
  if (command === "move-up") return planMove(value, blockStart, blockEnd, selectionStart, selectionEnd, "up")
  if (command === "move-down") return planMove(value, blockStart, blockEnd, selectionStart, selectionEnd, "down")
  if (command === "duplicate") return planDuplicate(value, blockStart, blockEnd, selectionStart, selectionEnd)
  return planDelete(value, blockStart, blockEnd)
}
