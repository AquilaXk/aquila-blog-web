export type MathSpanRange = {
  from: number
  to: number
}

export type ScannedPandocMathToken = {
  kind: "inline" | "display"
  from: number
  to: number
  math: string
}

export const DEFAULT_MAX_INLINE_MATH_LENGTH = 2048
export const DEFAULT_MAX_DISPLAY_MATH_LENGTH = 16384

const SINGLE_WHITESPACE_PATTERN = /^\s$/u

const ALLOWED_ASCII_PREFIX_CODES = new Set([
  40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124,
])

const isAsciiDigitCode = (code: number): boolean => code >= 48 && code <= 57

export const isUnicodeWhitespaceChar = (ch: string | undefined): boolean =>
  ch !== undefined && SINGLE_WHITESPACE_PATTERN.test(ch)

export const isEscapedMarkdownAt = (text: string, index: number): boolean => {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && text.codePointAt(cursor) === 92; cursor -= 1) {
    slashCount += 1
  }
  return (slashCount & 1) === 1
}

export const countCodePointRun = (
  text: string,
  start: number,
  targetCode: number,
  limit = text.length
): number => {
  const end = Math.min(text.length, limit)
  let cursor = start
  while (cursor < end && text.codePointAt(cursor) === targetCode) {
    cursor += 1
  }
  return cursor - start
}

export const findLineStartOffset = (text: string, index: number): number => {
  let pos = index
  while (pos > 0 && text.codePointAt(pos - 1) !== 10) {
    pos -= 1
  }
  return pos
}

export const findLineEndOffset = (text: string, from: number): number => {
  const nlIndex = text.indexOf("\n", from)
  return nlIndex < 0 ? text.length : nlIndex
}

export const stripLineQuoteAndIndent = (line: string): string => {
  let cursor = 0
  while (cursor < line.length) {
    const spaces = Math.min(3, countCodePointRun(line, cursor, 32))
    if (line.codePointAt(cursor + spaces) !== 62) break
    cursor += spaces + 1
    if (line.codePointAt(cursor) === 32) cursor += 1
  }
  const indent = Math.min(3, countCodePointRun(line, cursor, 32))
  return line.slice(cursor + indent)
}

export const parseOpeningCodeFence = (
  line: string
): { markerCode: number; length: number } | null => {
  const stripped = stripLineQuoteAndIndent(line)
  const firstCode = stripped.codePointAt(0) ?? 0
  if (firstCode !== 96 && firstCode !== 126) return null
  const runLen = countCodePointRun(stripped, 0, firstCode)
  if (runLen < 3) return null
  if (firstCode === 96 && stripped.slice(runLen).includes("`")) return null
  return { markerCode: firstCode, length: runLen }
}

const isClosingCodeFenceLine = (
  line: string,
  fence: { markerCode: number; length: number }
): boolean => {
  const stripped = stripLineQuoteAndIndent(line)
  const runLen = countCodePointRun(stripped, 0, fence.markerCode)
  return runLen >= fence.length && stripped.slice(runLen).trim().length === 0
}

export const matchFencedCodeBlockEnd = (text: string, lineStart: number): number => {
  const firstLineEnd = findLineEndOffset(text, lineStart)
  const fence = parseOpeningCodeFence(text.slice(lineStart, firstLineEnd))
  if (!fence) return -1

  let cursor = firstLineEnd < text.length ? firstLineEnd + 1 : text.length
  while (cursor < text.length) {
    const lineEnd = findLineEndOffset(text, cursor)
    if (isClosingCodeFenceLine(text.slice(cursor, lineEnd), fence)) {
      return lineEnd < text.length ? lineEnd + 1 : text.length
    }
    cursor = lineEnd < text.length ? lineEnd + 1 : text.length
  }
  return text.length
}

const isMarkdownBlockBoundaryLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed) return true
  return (
    trimmed.startsWith("#") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith(":::") ||
    trimmed.startsWith("|") ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("~~~")
  )
}

export const hasBlankLineBetween = (text: string, from: number, to: number): boolean => {
  let cursor = text.indexOf("\n", from)
  while (cursor >= 0 && cursor < to) {
    const nextLineStart = cursor + 1
    const nextBreak = text.indexOf("\n", nextLineStart)
    if (nextBreak >= 0 && nextBreak <= to && text.slice(nextLineStart, nextBreak).trim() === "") {
      return true
    }
    cursor = nextBreak
  }
  return false
}

export const hasParagraphOrBlockBreakBetween = (
  text: string,
  from: number,
  to: number
): boolean => {
  let cursor = text.indexOf("\n", from)
  while (cursor >= 0 && cursor < to) {
    const nextLineStart = cursor + 1
    const nextBreak = text.indexOf("\n", nextLineStart)
    const lineEnd = nextBreak < 0 ? text.length : nextBreak
    if (isMarkdownBlockBoundaryLine(text.slice(nextLineStart, lineEnd))) {
      return true
    }
    cursor = nextBreak
  }
  return false
}

export const scanInlineCodeSpanEnd = (
  text: string,
  openIndex: number,
  limit = text.length
): number => {
  const bound = Math.min(text.length, limit)
  const runLen = countCodePointRun(text, openIndex, 96, bound)
  if (runLen === 0) return -1
  let cursor = openIndex + runLen
  while (cursor < bound) {
    if (text.codePointAt(cursor) === 10) {
      const nextEnd = Math.min(bound, findLineEndOffset(text, cursor + 1))
      if (text.slice(cursor + 1, nextEnd).trim() === "") return -1
    }
    if (text.codePointAt(cursor) === 96) {
      const candidateLen = countCodePointRun(text, cursor, 96, bound)
      if (candidateLen === runLen) return cursor + candidateLen
      cursor += candidateLen
      continue
    }
    cursor += 1
  }
  return -1
}

const normalizeCommonMarkCodeSpanContent = (rawContent: string): string => {
  const collapsed = rawContent.replaceAll("\r\n", " ").replaceAll("\n", " ")
  if (
    collapsed.length >= 2 &&
    collapsed.startsWith(" ") &&
    collapsed.endsWith(" ") &&
    collapsed.trim().length > 0
  ) {
    return collapsed.slice(1, -1)
  }
  return collapsed
}

export const replaceCommonMarkInlineCodeSpans = (
  text: string,
  onSpan: (normalizedCode: string, from: number, to: number) => string
): string => {
  if (!text.includes("`")) return text
  let output = ""
  let copyFrom = 0
  let cursor = 0
  while (cursor < text.length) {
    if (text.codePointAt(cursor) !== 96 || isEscapedMarkdownAt(text, cursor)) {
      cursor += 1
      continue
    }
    const runLen = countCodePointRun(text, cursor, 96)
    const closeEnd = scanInlineCodeSpanEnd(text, cursor)
    if (closeEnd < 0) {
      cursor += runLen
      continue
    }
    const inner = normalizeCommonMarkCodeSpanContent(text.slice(cursor + runLen, closeEnd - runLen))
    output += text.slice(copyFrom, cursor) + onSpan(inner, cursor, closeEnd)
    copyFrom = closeEnd
    cursor = closeEnd
  }
  return copyFrom === 0 ? text : output + text.slice(copyFrom)
}

export const mergeSortedSpanRanges = (ranges: readonly MathSpanRange[]): MathSpanRange[] => {
  const sorted = ranges
    .filter((range) => range.to > range.from)
    .sort((a, b) => (a.from !== b.from ? a.from - b.from : a.to - b.to))
  if (sorted.length === 0) return []
  const merged: MathSpanRange[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!
    const prev = merged.at(-1)!
    if (current.from <= prev.to) {
      if (current.to > prev.to) prev.to = current.to
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

export const overlapsSortedRanges = (
  ranges: readonly MathSpanRange[],
  from: number,
  to: number
): boolean => {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = (low + high) >>> 1
    const range = ranges[mid]!
    if (range.to <= from) low = mid + 1
    else if (range.from >= to) high = mid - 1
    else return true
  }
  return false
}

const isDedicatedDoubleDollarLine = (line: string): boolean =>
  stripLineQuoteAndIndent(line).trim() === "$$"

const tryResolveDedicatedMathAtCloseLine = (
  text: string,
  openIndex: number,
  cursor: number,
  lineEnd: number,
  excludedRanges: readonly MathSpanRange[]
): ScannedPandocMathToken | null => {
  const closePos = text.indexOf("$$", cursor)
  if (closePos < 0 || closePos > lineEnd) return null
  const to = closePos + 2
  const math = text.slice(openIndex + 2, closePos)
  if (!math.trim() || overlapsSortedRanges(excludedRanges, openIndex, to)) return null
  return { kind: "display", from: openIndex, to, math }
}

const matchDedicatedDisplayMathToken = (
  text: string,
  openIndex: number,
  excludedRanges: readonly MathSpanRange[]
): ScannedPandocMathToken | null => {
  const openLineStart = findLineStartOffset(text, openIndex)
  const openLineEnd = findLineEndOffset(text, openIndex)
  if (!isDedicatedDoubleDollarLine(text.slice(openLineStart, openLineEnd))) return null

  let cursor = Math.min(text.length, openLineEnd + 1)
  const limit = Math.min(text.length, openIndex + 2 + DEFAULT_MAX_DISPLAY_MATH_LENGTH)
  while (cursor < limit) {
    const lineEnd = findLineEndOffset(text, cursor)
    const line = text.slice(cursor, lineEnd)
    if (parseOpeningCodeFence(line) !== null) return null
    if (isDedicatedDoubleDollarLine(line)) {
      return tryResolveDedicatedMathAtCloseLine(text, openIndex, cursor, lineEnd, excludedRanges)
    }
    cursor = Math.min(text.length, lineEnd + 1)
  }
  return null
}

const findClosingDoubleDollarOffset = (
  text: string,
  openIndex: number,
  singleLineOnly: boolean
): number => {
  const scanLimit = Math.min(text.length - 1, openIndex + 2 + DEFAULT_MAX_DISPLAY_MATH_LENGTH)
  for (let cursor = openIndex + 2; cursor < scanLimit; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (singleLineOnly && (code === 10 || code === 13)) return -1
    if (
      code === 36 &&
      text.codePointAt(cursor + 1) === 36 &&
      text.codePointAt(cursor + 2) !== 36 &&
      !isEscapedMarkdownAt(text, cursor)
    ) {
      return cursor
    }
  }
  return -1
}

const isValidDisplayMathOpenAt = (text: string, openIndex: number): boolean => {
  if (
    text.codePointAt(openIndex) !== 36 ||
    text.codePointAt(openIndex + 1) !== 36 ||
    text.codePointAt(openIndex + 2) === 36 ||
    isEscapedMarkdownAt(text, openIndex)
  ) {
    return false
  }
  return !(openIndex > 0 && text.codePointAt(openIndex - 1) === 36 && !isEscapedMarkdownAt(text, openIndex - 1))
}

export const scanPandocDisplayMathAt = (
  text: string,
  openIndex: number,
  options?: { excludedRanges?: readonly MathSpanRange[]; singleLineOnly?: boolean }
): ScannedPandocMathToken | null => {
  if (!isValidDisplayMathOpenAt(text, openIndex)) return null
  const excluded = options?.excludedRanges ?? []
  const singleLineOnly = options?.singleLineOnly === true
  if (!singleLineOnly) {
    const dedicated = matchDedicatedDisplayMathToken(text, openIndex, excluded)
    if (dedicated) return dedicated
  }
  const closePos = findClosingDoubleDollarOffset(text, openIndex, singleLineOnly)
  if (closePos < 0) return null
  if (!singleLineOnly && hasParagraphOrBlockBreakBetween(text, openIndex + 2, closePos)) {
    return null
  }
  const to = closePos + 2
  const math = text.slice(openIndex + 2, closePos)
  if (!math.trim() || overlapsSortedRanges(excluded, openIndex, to)) return null
  return { kind: "display", from: openIndex, to, math }
}

export const isAllowedPandocInlineMathPrefix = (text: string, openIndex: number): boolean => {
  if (openIndex === 0 || isUnicodeWhitespaceChar(text[openIndex - 1])) return true
  const prevCode = text.codePointAt(openIndex - 1) ?? 0
  if (prevCode === 92) return !isEscapedMarkdownAt(text, openIndex)
  return prevCode > 0x7f || ALLOWED_ASCII_PREFIX_CODES.has(prevCode)
}

const isAbortingInlineMathCode = (text: string, cursor: number, code: number): boolean => {
  if (code === 10 || code === 13) return true
  if (code === 96 && !isEscapedMarkdownAt(text, cursor)) return true
  return code === 93 && text.codePointAt(cursor + 1) === 40 && !isEscapedMarkdownAt(text, cursor)
}

const findClosingSingleDollarOffset = (
  text: string,
  openIndex: number,
  excluded: readonly MathSpanRange[],
  maxScanLength: number
): number => {
  const scanLimit = Math.min(text.length, openIndex + 1 + maxScanLength)
  for (let cursor = openIndex + 1; cursor < scanLimit; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (isAbortingInlineMathCode(text, cursor, code)) return -1
    if (overlapsSortedRanges(excluded, cursor, cursor + 1)) return -1
    if (code === 36 && !isEscapedMarkdownAt(text, cursor)) {
      return text.codePointAt(cursor + 1) === 36 ? -1 : cursor
    }
  }
  return -1
}

const isValidInlineMathOpenAt = (text: string, openIndex: number): boolean => {
  if (
    text.codePointAt(openIndex) !== 36 ||
    text.codePointAt(openIndex + 1) === 36 ||
    isEscapedMarkdownAt(text, openIndex)
  ) {
    return false
  }
  if (openIndex > 0 && text.codePointAt(openIndex - 1) === 36 && !isEscapedMarkdownAt(text, openIndex - 1)) {
    return false
  }
  return isAllowedPandocInlineMathPrefix(text, openIndex)
}

export const scanPandocInlineMathAt = (
  text: string,
  openIndex: number,
  options?: { excludedRanges?: readonly MathSpanRange[]; maxScanLength?: number }
): ScannedPandocMathToken | null => {
  if (!isValidInlineMathOpenAt(text, openIndex)) return null
  const firstInner = text[openIndex + 1]
  if (!firstInner || isUnicodeWhitespaceChar(firstInner)) return null

  const excluded = options?.excludedRanges ?? []
  const maxLen = options?.maxScanLength ?? DEFAULT_MAX_INLINE_MATH_LENGTH
  const closePos = findClosingSingleDollarOffset(text, openIndex, excluded, maxLen)
  if (closePos < openIndex + 2) return null

  const lastInner = text[closePos - 1]
  if (!lastInner || isUnicodeWhitespaceChar(lastInner)) return null

  const afterCloseCode = text.codePointAt(closePos + 1) ?? -1
  if (isAsciiDigitCode(afterCloseCode) || afterCloseCode === 36) return null
  if (overlapsSortedRanges(excluded, openIndex, closePos + 1)) return null

  return {
    kind: "inline",
    from: openIndex,
    to: closePos + 1,
    math: text.slice(openIndex + 1, closePos),
  }
}
