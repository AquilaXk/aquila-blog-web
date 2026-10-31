export type MathLiteralRange = {
  from: number
  to: number
}

export type MathReplacementSpec = {
  from: number
  to: number
  math: string
  displayMode: boolean
}

const MAX_INLINE_MATH_LENGTH = 2048
const MAX_DISPLAY_MATH_LENGTH = 16384
const MAX_MATH_BLOCKS_PER_DOC = 512

export const MATH_LITERAL_SYNTAX_NODE_NAMES = new Set([
  "FencedCode",
  "CodeBlock",
  "InlineCode",
  "HTMLBlock",
  "HTMLTag",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "URL",
  "Autolink",
])

const BARE_URL_PATTERN = /\b(?:https?|ftp):\/\/[^\s<>()]+/gi

const mergeSortedRanges = (ranges: readonly MathLiteralRange[]): MathLiteralRange[] => {
  if (ranges.length === 0) return []
  const sorted = [...ranges]
    .filter((range) => range.to > range.from)
    .sort((a, b) => (a.from !== b.from ? a.from - b.from : a.to - b.to))
  if (sorted.length === 0) return []
  const merged: MathLiteralRange[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!
    const prev = merged[merged.length - 1]!
    if (current.from <= prev.to) {
      if (current.to > prev.to) prev.to = current.to
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

const buildExcludedMathRanges = (
  docText: string,
  literalRanges: readonly MathLiteralRange[]
): MathLiteralRange[] => {
  const combined: MathLiteralRange[] = [...literalRanges]
  if (docText.includes("://")) {
    BARE_URL_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = BARE_URL_PATTERN.exec(docText)) !== null) {
      combined.push({ from: match.index, to: match.index + match[0].length })
    }
  }
  return mergeSortedRanges(combined)
}

const overlapsExcludedRange = (
  ranges: readonly MathLiteralRange[],
  from: number,
  to: number
): boolean => {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = (low + high) >>> 1
    const range = ranges[mid]!
    if (range.to <= from) {
      low = mid + 1
    } else if (range.from >= to) {
      high = mid - 1
    } else {
      return true
    }
  }
  return false
}

const isEscapedDollar = (text: string, index: number): boolean => {
  let backslashCount = 0
  for (let pos = index - 1; pos >= 0 && text.charCodeAt(pos) === 92; pos -= 1) {
    backslashCount += 1
  }
  return (backslashCount & 1) === 1
}

const overlapsActiveLine = (
  from: number,
  to: number,
  activeLineFrom: number,
  activeLineTo: number
): boolean => activeLineFrom >= 0 && activeLineTo >= activeLineFrom && from <= activeLineTo && to >= activeLineFrom

export const collectMathReplacementSpecs = (
  docText: string,
  activeLineFrom = -1,
  activeLineTo = -1,
  shouldRevealAll = false,
  literalRanges: readonly MathLiteralRange[] = []
): MathReplacementSpec[] => {
  if (shouldRevealAll || !docText.includes("$")) return []

  const excludedRanges = buildExcludedMathRanges(docText, literalRanges)
  const specs: MathReplacementSpec[] = []
  const length = docText.length
  let index = 0

  while (index < length && specs.length < MAX_MATH_BLOCKS_PER_DOC) {
    if (docText.charCodeAt(index) !== 36 || isEscapedDollar(docText, index)) {
      index += 1
      continue
    }
    if (overlapsExcludedRange(excludedRanges, index, index + 1)) {
      index += 1
      continue
    }

    let runEnd = index + 1
    while (runEnd < length && docText.charCodeAt(runEnd) === 36) runEnd += 1
    const runLength = runEnd - index

    if (runLength > 2) {
      index = runEnd
      continue
    }

    if (runLength === 2) {
      const scanLimit = Math.min(length - 1, index + 2 + MAX_DISPLAY_MATH_LENGTH)
      let closeIndex = -1
      for (let cursor = index + 2; cursor < scanLimit; cursor += 1) {
        if (
          docText.charCodeAt(cursor) === 36 &&
          docText.charCodeAt(cursor + 1) === 36 &&
          docText.charCodeAt(cursor + 2) !== 36 &&
          !isEscapedDollar(docText, cursor)
        ) {
          closeIndex = cursor
          break
        }
      }
      if (closeIndex !== -1 && !overlapsExcludedRange(excludedRanges, index, closeIndex + 2)) {
        const inner = docText.slice(index + 2, closeIndex)
        if (inner.trim().length > 0) {
          if (!overlapsActiveLine(index, closeIndex + 2, activeLineFrom, activeLineTo)) {
            specs.push({
              from: index,
              to: closeIndex + 2,
              math: inner,
              displayMode: true,
            })
          }
          index = closeIndex + 2
          continue
        }
      }
      index += 2
      continue
    }

    const prevChar = index > 0 ? docText[index - 1]! : ""
    const firstInner = docText[index + 1] ?? ""
    if (!firstInner || /\s/.test(firstInner) || /[0-9A-Za-z$\\]/.test(prevChar)) {
      index += 1
      continue
    }

    const scanLimit = Math.min(length, index + 1 + MAX_INLINE_MATH_LENGTH)
    let closeIndex = -1
    for (let cursor = index + 1; cursor < scanLimit; cursor += 1) {
      const ch = docText.charCodeAt(cursor)
      if (ch === 10 || ch === 13) break
      if (overlapsExcludedRange(excludedRanges, cursor, cursor + 1)) break
      if (ch === 36 && !isEscapedDollar(docText, cursor)) {
        if (docText.charCodeAt(cursor + 1) === 36) break
        closeIndex = cursor
        break
      }
    }

    if (closeIndex > index + 1) {
      const lastInner = docText[closeIndex - 1]!
      const afterClose = docText[closeIndex + 1] ?? ""
      if (!/\s/.test(lastInner) && !/[0-9$]/.test(afterClose)) {
        if (!overlapsActiveLine(index, closeIndex + 1, activeLineFrom, activeLineTo)) {
          specs.push({
            from: index,
            to: closeIndex + 1,
            math: docText.slice(index + 1, closeIndex),
            displayMode: false,
          })
        }
        index = closeIndex + 1
        continue
      }
    } else if (closeIndex === index + 1) {
      index += 1
      continue
    }

    index += 1
  }

  return specs
}
