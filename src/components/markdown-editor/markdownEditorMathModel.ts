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
const SINGLE_WHITESPACE_PATTERN = /^\s$/u

const ALLOWED_ASCII_PREFIX_CODES = new Set([
  40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124,
])

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
    const prev = merged.at(-1)!
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
    for (const match of docText.matchAll(BARE_URL_PATTERN)) {
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

const isWhitespaceChar = (ch: string | undefined): boolean =>
  ch !== undefined && SINGLE_WHITESPACE_PATTERN.test(ch)

const isAsciiDigitCode = (code: number): boolean => code >= 48 && code <= 57

const isEscapedDollar = (text: string, index: number): boolean => {
  let backslashCount = 0
  for (let pos = index - 1; pos >= 0 && text.codePointAt(pos) === 92; pos -= 1) {
    backslashCount += 1
  }
  return (backslashCount & 1) === 1
}

const countRunOfDollar = (text: string, start: number): number => {
  let end = start
  while (end < text.length && text.codePointAt(end) === 36) {
    end += 1
  }
  return end - start
}

const findLineStart = (text: string, index: number): number => {
  let pos = index
  while (pos > 0 && text.codePointAt(pos - 1) !== 10) {
    pos -= 1
  }
  return pos
}

const findLineEnd = (text: string, from: number): number => {
  const nlIndex = text.indexOf("\n", from)
  return nlIndex < 0 ? text.length : nlIndex
}

const stripLineQuoteAndIndent = (line: string): string => {
  let cursor = 0
  while (cursor < line.length) {
    let spaces = 0
    while (spaces < 3 && line.codePointAt(cursor + spaces) === 32) {
      spaces += 1
    }
    if (line.codePointAt(cursor + spaces) === 62) {
      cursor += spaces + 1
      if (line.codePointAt(cursor) === 32) cursor += 1
      continue
    }
    break
  }
  let indent = 0
  while (indent < 3 && line.codePointAt(cursor + indent) === 32) {
    indent += 1
  }
  return line.slice(cursor + indent)
}

const isDedicatedDoubleDollarLine = (line: string): boolean =>
  stripLineQuoteAndIndent(line).trim() === "$$"

const isOpeningCodeFenceLine = (line: string): boolean => {
  const stripped = stripLineQuoteAndIndent(line)
  const firstCode = stripped.codePointAt(0) ?? 0
  if (firstCode !== 96 && firstCode !== 126) return false
  let runLen = 1
  while (stripped.codePointAt(runLen) === firstCode) {
    runLen += 1
  }
  if (runLen < 3) return false
  return !(firstCode === 96 && stripped.slice(runLen).includes("`"))
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

const hasParagraphOrBlockBreakBetween = (text: string, from: number, to: number): boolean => {
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

const matchDedicatedDisplayMath = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): MathReplacementSpec | null => {
  const openLineStart = findLineStart(docText, index)
  const openLineEnd = findLineEnd(docText, index)
  if (!isDedicatedDoubleDollarLine(docText.slice(openLineStart, openLineEnd))) {
    return null
  }

  let cursor = openLineEnd < docText.length ? openLineEnd + 1 : docText.length
  const limit = Math.min(docText.length, index + 2 + MAX_DISPLAY_MATH_LENGTH)
  while (cursor < limit) {
    const lineEnd = findLineEnd(docText, cursor)
    const line = docText.slice(cursor, lineEnd)
    if (isOpeningCodeFenceLine(line)) return null
    if (isDedicatedDoubleDollarLine(line)) {
      const closePos = docText.indexOf("$$", cursor)
      if (closePos < 0 || closePos > lineEnd) return null
      const to = closePos + 2
      const math = docText.slice(index + 2, closePos)
      if (math.trim().length === 0 || overlapsExcludedRange(excludedRanges, index, to)) {
        return null
      }
      return { from: index, to, math, displayMode: true }
    }
    cursor = lineEnd < docText.length ? lineEnd + 1 : docText.length
  }
  return null
}

const findNextClosingDoubleDollar = (docText: string, index: number): number => {
  const scanLimit = Math.min(docText.length - 1, index + 2 + MAX_DISPLAY_MATH_LENGTH)
  for (let cursor = index + 2; cursor < scanLimit; cursor += 1) {
    if (
      docText.codePointAt(cursor) === 36 &&
      docText.codePointAt(cursor + 1) === 36 &&
      docText.codePointAt(cursor + 2) !== 36 &&
      !isEscapedDollar(docText, cursor)
    ) {
      return cursor
    }
  }
  return -1
}

const matchParagraphDisplayMath = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): MathReplacementSpec | null => {
  const closePos = findNextClosingDoubleDollar(docText, index)
  if (closePos < 0) return null
  if (hasParagraphOrBlockBreakBetween(docText, index + 2, closePos)) return null
  const to = closePos + 2
  const math = docText.slice(index + 2, closePos)
  if (math.trim().length === 0 || overlapsExcludedRange(excludedRanges, index, to)) {
    return null
  }
  return { from: index, to, math, displayMode: true }
}

const tryMatchDisplayMath = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): MathReplacementSpec | null =>
  matchDedicatedDisplayMath(docText, index, excludedRanges) ??
  matchParagraphDisplayMath(docText, index, excludedRanges)

const isAllowedInlineMathPrefix = (text: string, index: number): boolean => {
  if (index === 0 || isWhitespaceChar(text[index - 1])) return true
  const prevCode = text.codePointAt(index - 1) ?? 0
  return prevCode > 0x7f || ALLOWED_ASCII_PREFIX_CODES.has(prevCode)
}

const scanInlineMathClose = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): number => {
  const scanLimit = Math.min(docText.length, index + 1 + MAX_INLINE_MATH_LENGTH)
  for (let cursor = index + 1; cursor < scanLimit; cursor += 1) {
    const code = docText.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) return -1
    if (overlapsExcludedRange(excludedRanges, cursor, cursor + 1)) return -1
    if (code === 96 && !isEscapedDollar(docText, cursor)) return -1
    if (code === 93 && docText.codePointAt(cursor + 1) === 40 && !isEscapedDollar(docText, cursor)) {
      return -1
    }
    if (code === 36 && !isEscapedDollar(docText, cursor)) {
      return docText.codePointAt(cursor + 1) === 36 ? -1 : cursor
    }
  }
  return -1
}

const tryMatchInlineMath = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): MathReplacementSpec | null => {
  if (!isAllowedInlineMathPrefix(docText, index)) return null
  const firstInner = docText[index + 1]
  if (!firstInner || isWhitespaceChar(firstInner)) return null

  const closeIndex = scanInlineMathClose(docText, index, excludedRanges)
  if (closeIndex < index + 2) return null

  const lastInner = docText[closeIndex - 1]
  if (!lastInner || isWhitespaceChar(lastInner) || docText.codePointAt(closeIndex - 1) === 92) {
    return null
  }
  const afterCloseCode = docText.codePointAt(closeIndex + 1) ?? -1
  if (isAsciiDigitCode(afterCloseCode) || afterCloseCode === 36) return null
  if (overlapsExcludedRange(excludedRanges, index, closeIndex + 1)) return null

  return {
    from: index,
    to: closeIndex + 1,
    math: docText.slice(index + 1, closeIndex),
    displayMode: false,
  }
}

const overlapsActiveLine = (
  from: number,
  to: number,
  activeLineFrom: number,
  activeLineTo: number
): boolean =>
  activeLineFrom >= 0 &&
  activeLineTo >= activeLineFrom &&
  from <= activeLineTo &&
  to >= activeLineFrom

const tryMatchMathAt = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  const runLength = countRunOfDollar(docText, index)
  if (runLength > 2) {
    return { spec: null, nextIndex: index + runLength }
  }
  if (runLength === 2) {
    const displaySpec = tryMatchDisplayMath(docText, index, excludedRanges)
    return { spec: displaySpec, nextIndex: displaySpec ? displaySpec.to : index + 2 }
  }
  const inlineSpec = tryMatchInlineMath(docText, index, excludedRanges)
  return { spec: inlineSpec, nextIndex: inlineSpec ? inlineSpec.to : index + 1 }
}

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
  let index = 0

  while (index < docText.length && specs.length < MAX_MATH_BLOCKS_PER_DOC) {
    if (
      docText.codePointAt(index) !== 36 ||
      isEscapedDollar(docText, index) ||
      overlapsExcludedRange(excludedRanges, index, index + 1)
    ) {
      index += 1
      continue
    }
    const { spec, nextIndex } = tryMatchMathAt(docText, index, excludedRanges)
    if (spec && !overlapsActiveLine(spec.from, spec.to, activeLineFrom, activeLineTo)) {
      specs.push(spec)
    }
    index = nextIndex
  }

  return specs
}
