export type PlannedTextMutation = {
  rangeStart: number
  rangeEnd: number
  replacement: string
  selectionStart: number
  selectionEnd: number
}

export const applyPlannedTextMutationToValue = (
  value: string,
  plan: PlannedTextMutation
): { value: string; selectionStart: number; selectionEnd: number } => ({
  value: `${value.slice(0, plan.rangeStart)}${plan.replacement}${value.slice(plan.rangeEnd)}`,
  selectionStart: plan.selectionStart,
  selectionEnd: plan.selectionEnd,
})

export const planReplaceSelection = (
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
  cursorOffset = replacement.length
): PlannedTextMutation => {
  const selectionStartAfter = selectionStart + cursorOffset
  return {
    rangeStart: selectionStart,
    rangeEnd: selectionEnd,
    replacement,
    selectionStart: selectionStartAfter,
    selectionEnd: selectionStartAfter,
  }
}

export const planWrapSelection = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after = ""
): PlannedTextMutation => {
  const selected = value.slice(selectionStart, selectionEnd)
  return {
    rangeStart: selectionStart,
    rangeEnd: selectionEnd,
    replacement: `${before}${selected}${after}`,
    selectionStart: selectionStart + before.length,
    selectionEnd: selectionStart + before.length + selected.length,
  }
}

const countAsterisksBefore = (text: string, index: number): number => {
  let count = 0
  for (let i = index - 1; i >= 0 && text[i] === "*"; i -= 1) count += 1
  return count
}

const countAsterisksAfter = (text: string, index: number): number => {
  let count = 0
  for (let i = index; i < text.length && text[i] === "*"; i += 1) count += 1
  return count
}

export const planToggleWrapSelection = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): PlannedTextMutation => {
  const selected = value.slice(selectionStart, selectionEnd)
  const isSingleAsterisk = before === "*" && after === "*"

  const hasSurroundingMatch =
    selectionStart >= before.length &&
    value.slice(selectionStart - before.length, selectionStart) === before &&
    value.slice(selectionEnd, selectionEnd + after.length) === after &&
    (!isSingleAsterisk ||
      (countAsterisksBefore(value, selectionStart) % 2 === 1 &&
        countAsterisksAfter(value, selectionEnd) % 2 === 1))

  if (hasSurroundingMatch) {
    return {
      rangeStart: selectionStart - before.length,
      rangeEnd: selectionEnd + after.length,
      replacement: selected,
      selectionStart: selectionStart - before.length,
      selectionEnd: selectionEnd - before.length,
    }
  }

  const hasEnclosedMatch =
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length &&
    (!isSingleAsterisk ||
      (countAsterisksAfter(selected, 0) % 2 === 1 &&
        countAsterisksBefore(selected, selected.length) % 2 === 1))

  if (hasEnclosedMatch) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return {
      rangeStart: selectionStart,
      rangeEnd: selectionEnd,
      replacement: inner,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    }
  }

  return planWrapSelection(value, selectionStart, selectionEnd, before, after)
}

export const planInsertMarkdownLink = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  const selected = value.slice(selectionStart, selectionEnd)
  const url = "https://"
  const replacement = `[${selected}](${url})`
  const urlStart = selectionStart + selected.length + 3
  return {
    rangeStart: selectionStart,
    rangeEnd: selectionEnd,
    replacement,
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  }
}

export const planHardBreak = (selectionStart: number, selectionEnd: number): PlannedTextMutation =>
  planReplaceSelection(selectionStart, selectionEnd, "  \n")

const lineBoundsAt = (value: string, offset: number) => {
  const lineStart = value.lastIndexOf("\n", offset - 1) + 1
  const nextBreak = value.indexOf("\n", offset)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  return { lineStart, lineEnd }
}

const selectionLineBounds = (value: string, selectionStart: number, selectionEnd: number) => {
  const start = lineBoundsAt(value, selectionStart).lineStart
  const end = lineBoundsAt(value, Math.max(selectionEnd, selectionStart)).lineEnd
  return { blockStart: start, blockEnd: end }
}

export const planIndentLines = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  indent = "  "
): PlannedTextMutation => {
  const { blockStart, blockEnd } = selectionLineBounds(value, selectionStart, selectionEnd)
  const nextLines: string[] = []
  let cursor = blockStart
  let insertedBeforeStart = 0
  let insertedBeforeEnd = 0

  while (cursor <= blockEnd) {
    const nextBreak = value.indexOf("\n", cursor)
    const lineEnd = nextBreak === -1 || nextBreak > blockEnd ? blockEnd : nextBreak
    const line = value.slice(cursor, lineEnd)
    if (cursor < selectionStart) insertedBeforeStart += indent.length
    if (cursor < selectionEnd) insertedBeforeEnd += indent.length
    nextLines.push(`${indent}${line}`)
    if (nextBreak === -1 || nextBreak >= blockEnd) break
    cursor = nextBreak + 1
  }

  return {
    rangeStart: blockStart,
    rangeEnd: blockEnd,
    replacement: nextLines.join("\n"),
    selectionStart: selectionStart + insertedBeforeStart,
    selectionEnd: selectionEnd + insertedBeforeEnd,
  }
}

const countLeadingOutdentChars = (
  value: string,
  lineStart: number,
  lineEnd: number,
  indentSize: number
): number => {
  if (lineStart >= lineEnd) return 0
  const firstCode = value.codePointAt(lineStart)
  if (firstCode === 9) return 1
  if (firstCode !== 32) return 0
  const maxSpaces = Math.min(2, indentSize)
  let removeCount = 0
  while (
    removeCount < maxSpaces &&
    lineStart + removeCount < lineEnd &&
    value.codePointAt(lineStart + removeCount) === 32
  ) {
    removeCount += 1
  }
  return removeCount
}

export const planOutdentLines = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  indentSize = 2
): PlannedTextMutation | null => {
  const { blockStart, blockEnd } = selectionLineBounds(value, selectionStart, selectionEnd)
  const nextLines: string[] = []
  let removedBeforeStart = 0
  let removedBeforeEnd = 0
  let removedTotal = 0
  let cursor = blockStart

  while (cursor <= blockEnd) {
    const nextBreak = value.indexOf("\n", cursor)
    const lineEnd = nextBreak === -1 || nextBreak > blockEnd ? blockEnd : nextBreak
    const removeCount = countLeadingOutdentChars(value, cursor, lineEnd, indentSize)
    if (removeCount > 0) {
      if (cursor < selectionStart) {
        removedBeforeStart += Math.min(removeCount, selectionStart - cursor)
      }
      if (cursor < selectionEnd) {
        removedBeforeEnd += Math.min(removeCount, selectionEnd - cursor)
      }
      removedTotal += removeCount
    }
    nextLines.push(value.slice(cursor + removeCount, lineEnd))
    if (nextBreak === -1 || nextBreak >= blockEnd) break
    cursor = nextBreak + 1
  }

  if (removedTotal === 0) return null

  return {
    rangeStart: blockStart,
    rangeEnd: blockEnd,
    replacement: nextLines.join("\n"),
    selectionStart: Math.max(blockStart, selectionStart - removedBeforeStart),
    selectionEnd: Math.max(blockStart, selectionEnd - removedBeforeEnd),
  }
}
