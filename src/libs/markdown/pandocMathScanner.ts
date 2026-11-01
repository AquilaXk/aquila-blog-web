import { isDedicatedFormulaBoundaryLine, isDedicatedMathCloseLine, resolveDedicatedMathOpen } from "./renderingDirectiveModel"
export type MathSpanRange = { from: number; to: number }

export type ScannedPandocMathToken = {
  kind: "inline" | "display"
  from: number
  to: number
  math: string
}

export const DEFAULT_MAX_INLINE_MATH_LENGTH = 2048
export const DEFAULT_MAX_DISPLAY_MATH_LENGTH = 16384

const COMMONMARK_CODE_INDENT_PATTERN = /^(?: {4}|\t| {1,3}\t)/
const SINGLE_WHITESPACE_PATTERN = /^\s$/u
const THEMATIC_BREAK_LINE_PATTERN = /^(?:\*[ \t]*){3,}$|^(?:-[ \t]*){3,}$|^(?:_[ \t]*){3,}$/
const LIST_MARKER_LINE_PATTERN = /^(?:[-+*]|\d+[.)])[ \t]/
const HTML_OPEN_TAG_LINE_PATTERN = /^<[a-zA-Z!/]/
const AUTOLINK_SCHEMES = ["http://", "https://", "ftp://", "mailto:"] as const

export const hasCommonMarkCodeIndent = (line: string): boolean =>
  COMMONMARK_CODE_INDENT_PATTERN.test(line)

const ALLOWED_ASCII_PREFIX_CODES = new Set([
  40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124,
])

const isAsciiDigitCode = (code: number): boolean => code >= 48 && code <= 57

export const isAsciiAlphaNumericCode = (code: number): boolean =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)

export const extractAsciiAlphaNumeric = (text: string): string => {
  let out = ""
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0
    if (isAsciiAlphaNumericCode(code)) out += text[i]!
  }
  return out
}

export const extractAlphaNumericOutsideAngles = (text: string): string => {
  let out = ""
  let inAngle = false
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0
    if (code === 60) inAngle = true
    else if (code === 62 || code === 10 || code === 13 || code === 0xe000) inAngle = false
    else if (!inAngle && isAsciiAlphaNumericCode(code)) out += text[i]!
  }
  return out
}

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
  while (cursor < end && text.codePointAt(cursor) === targetCode) cursor += 1
  return cursor - start
}

export const findLineStartOffset = (text: string, index: number): number => {
  let pos = index
  while (pos > 0 && text.codePointAt(pos - 1) !== 10) pos -= 1
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

export const parseDedicatedLineQuoteDepth = (line: string): { quoteDepth: number; rest: string } | null => {
  if (hasCommonMarkCodeIndent(line)) return null
  let cursor = 0
  let quoteDepth = 0
  while (cursor < line.length) {
    const spaces = countCodePointRun(line, cursor, 32)
    if (spaces > 3 || line.codePointAt(cursor + spaces) !== 62) break
    quoteDepth += 1
    cursor += spaces + 1
    if (line.codePointAt(cursor) === 32) cursor += 1
  }
  const afterQuotes = line.slice(cursor)
  if (hasCommonMarkCodeIndent(afterQuotes)) return null
  const indent = Math.min(3, countCodePointRun(afterQuotes, 0, 32))
  return { quoteDepth, rest: afterQuotes.slice(indent) }
}

export const stripLeadingQuoteMarkers = (line: string, count: number): string | null => {
  if (count === 0) return line
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const spaces = countCodePointRun(line, cursor, 32)
    if (spaces > 3 || line.codePointAt(cursor + spaces) !== 62) return null
    cursor += spaces + 1
    if (line.codePointAt(cursor) === 32) cursor += 1
  }
  return line.slice(cursor)
}

export const parseOpeningCodeFence = (line: string): { markerCode: number; length: number } | null => {
  const stripped = stripLineQuoteAndIndent(line)
  const firstCode = stripped.codePointAt(0) ?? 0
  if (firstCode !== 96 && firstCode !== 126) return null
  const runLen = countCodePointRun(stripped, 0, firstCode)
  if (runLen < 3) return null
  if (firstCode === 96 && stripped.slice(runLen).includes("`")) return null
  return { markerCode: firstCode, length: runLen }
}

const isDedicatedMathFlowFenceLine = (line: string): boolean => {
  const parsed = parseDedicatedLineQuoteDepth(line)
  return parsed !== null && parsed.rest.startsWith("$$") && parsed.rest.slice(2).trim() === ""
}

const isMarkdownBlockBoundaryLine = (line: string): boolean => {
  if (hasCommonMarkCodeIndent(line) || isDedicatedMathFlowFenceLine(line)) return true
  const trimmed = line.trim()
  if (!trimmed) return true
  return (
    trimmed.startsWith("#") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith(":::") ||
    trimmed.startsWith("|") ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("~~~") ||
    HTML_OPEN_TAG_LINE_PATTERN.test(trimmed) ||
    THEMATIC_BREAK_LINE_PATTERN.test(trimmed) ||
    LIST_MARKER_LINE_PATTERN.test(trimmed)
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

export const hasParagraphOrBlockBreakBetween = (text: string, from: number, to: number): boolean => {
  let cursor = text.indexOf("\n", from)
  while (cursor >= 0 && cursor < to) {
    const nextLineStart = cursor + 1
    const nextBreak = text.indexOf("\n", nextLineStart)
    const lineEnd = nextBreak < 0 ? text.length : nextBreak
    if (isMarkdownBlockBoundaryLine(text.slice(nextLineStart, lineEnd))) return true
    cursor = nextBreak
  }
  return false
}

export const scanInlineCodeSpanEnd = (text: string, openIndex: number, limit = text.length): number => {
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

export const normalizeCommonMarkCodeSpanContent = (rawContent: string): string => {
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

const skipSpacesAndTabs = (text: string, start: number): number => {
  let cursor = start
  while (cursor < text.length && (text.codePointAt(cursor) === 32 || text.codePointAt(cursor) === 9)) {
    cursor += 1
  }
  return cursor
}

export const matchHtmlCommentEnd = (text: string, index: number): number => {
  if (!text.startsWith("<!--", index)) return -1
  const closeIdx = text.indexOf("-->", index + 4)
  return closeIdx < 0 ? text.length : closeIdx + 3
}

const scanAutolinkClosingAngle = (text: string, start: number): number => {
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 62) return cursor + 1
    if (code <= 32 || code === 60) return -1
  }
  return -1
}

export const matchAutolinkEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 60) return -1
  const probe = text.slice(index + 1, index + 12).toLowerCase()
  if (!AUTOLINK_SCHEMES.some((scheme) => probe.startsWith(scheme))) return -1
  return scanAutolinkClosingAngle(text, index + 2)
}

const isBareUrlStopCode = (code: number): boolean =>
  code <= 32 || code === 60 || code === 62 || code === 41

export const matchBareUrlEnd = (text: string, index: number): number => {
  const lowerSlice = text.slice(index, index + 8).toLowerCase()
  if (!lowerSlice.startsWith("http://") && !lowerSlice.startsWith("https://")) return -1
  if (index > 0 && isAsciiAlphaNumericCode(text.codePointAt(index - 1) ?? 0)) return -1
  let cursor = index + 7
  while (cursor < text.length && !isBareUrlStopCode(text.codePointAt(cursor) ?? 0)) cursor += 1
  return cursor
}

const resolveAngleDestinationClose = (text: string, angleClose: number): number => {
  const closeParen = text.indexOf(")", angleClose + 1)
  if (closeParen < 0 || hasBlankLineBetween(text, angleClose + 1, closeParen)) return -1
  return closeParen + 1
}

const scanAngleBracketDestination = (text: string, openAngle: number): number => {
  for (let cursor = openAngle + 1; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13 || code === 60) return -1
    if (code === 62 && !isEscapedMarkdownAt(text, cursor)) return resolveAngleDestinationClose(text, cursor)
  }
  return -1
}

const isBlankLineAfterNewline = (text: string, newlinePos: number): boolean =>
  text.slice(newlinePos + 1, findLineEndOffset(text, newlinePos + 1)).trim() === ""

const adjustParenDepthAt = (text: string, pos: number, depth: number): number => {
  if (isEscapedMarkdownAt(text, pos)) return depth
  const code = text.codePointAt(pos) ?? 0
  if (code === 40) return depth + 1
  return code === 41 ? depth - 1 : depth
}

const scanBalancedParenDestination = (text: string, start: number): number => {
  let depth = 1
  for (let pos = start; pos < text.length; pos += 1) {
    if (text.codePointAt(pos) === 10 && isBlankLineAfterNewline(text, pos)) return -1
    depth = adjustParenDepthAt(text, pos, depth)
    if (depth === 0) return pos + 1
  }
  return -1
}

export const matchLinkDestinationEnd = (text: string, index: number): number => {
  if (
    text.codePointAt(index) !== 93 ||
    text.codePointAt(index + 1) !== 40 ||
    isEscapedMarkdownAt(text, index)
  ) {
    return -1
  }
  const cursor = skipSpacesAndTabs(text, index + 2)
  return text.codePointAt(cursor) === 60
    ? scanAngleBracketDestination(text, cursor)
    : scanBalancedParenDestination(text, cursor)
}

export const mergeSortedSpanRanges = (ranges: readonly MathSpanRange[]): MathSpanRange[] => {
  const filtered = ranges.filter((range) => range.to > range.from)
  filtered.sort((a, b) => (a.from !== b.from ? a.from - b.from : a.to - b.to))
  const merged: MathSpanRange[] = []
  for (const current of filtered) {
    const prev = merged.at(-1)
    if (prev && current.from <= prev.to) {
      if (current.to > prev.to) prev.to = current.to
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

export const findContainingSortedRangeEnd = (ranges: readonly MathSpanRange[], offset: number): number => {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = (low + high) >>> 1
    const range = ranges[mid]!
    if (range.to <= offset) low = mid + 1
    else if (range.from > offset) high = mid - 1
    else return range.to
  }
  return -1
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

const tryResolveDedicatedMathAtCloseLine = (
  text: string,
  openIndex: number,
  cursor: number,
  lineEnd: number,
  interiorLines: readonly string[],
  openQuoteDepth: number,
  excludedRanges: readonly MathSpanRange[]
): ScannedPandocMathToken | null => {
  const closePos = text.indexOf("$$", cursor)
  if (closePos < 0 || closePos > lineEnd) return null
  const to = closePos + 2
  const math = openQuoteDepth > 0 ? interiorLines.join("\n") : text.slice(openIndex + 2, closePos)
  if (
    !math.trim() ||
    overlapsSortedRanges(excludedRanges, openIndex, openIndex + 2) ||
    overlapsSortedRanges(excludedRanges, closePos, to)
  ) {
    return null
  }
  return { kind: "display", from: openIndex, to, math }
}

const matchDedicatedDisplayMathToken = (
  text: string,
  openIndex: number,
  openQuoteDepth: number,
  excludedRanges: readonly MathSpanRange[],
  allowAsideIndent = false
): ScannedPandocMathToken | null => {
  const openLineEnd = findLineEndOffset(text, openIndex)
  let cursor = Math.min(text.length, openLineEnd + 1)
  const limit = Math.min(text.length, openIndex + 2 + DEFAULT_MAX_DISPLAY_MATH_LENGTH)
  const interiorLines: string[] = []
  while (cursor < limit) {
    const lineEnd = findLineEndOffset(text, cursor)
    const line = text.slice(cursor, lineEnd)
    const normalizedLine = allowAsideIndent ? line.trimStart() : line
    const stripped = stripLeadingQuoteMarkers(normalizedLine, openQuoteDepth)
    if (stripped === null || parseOpeningCodeFence(normalizedLine) !== null || isDedicatedFormulaBoundaryLine(text, openIndex, stripped, openQuoteDepth, excludedRanges)) return null
    if (isDedicatedMathCloseLine(line, openQuoteDepth, allowAsideIndent)) {
      return tryResolveDedicatedMathAtCloseLine(text, openIndex, cursor, lineEnd, interiorLines, openQuoteDepth, excludedRanges)
    }
    interiorLines.push(stripped)
    cursor = Math.min(text.length, lineEnd + 1)
  }
  return null
}

const stepDisplayMathInnerConstructAt = (text: string, cursor: number): number => {
  const code = text.codePointAt(cursor) ?? 0
  if (code === 96 && !isEscapedMarkdownAt(text, cursor)) return scanInlineCodeSpanEnd(text, cursor)
  if (code === 60) {
    const commentEnd = matchHtmlCommentEnd(text, cursor)
    return commentEnd > cursor ? commentEnd : matchAutolinkEnd(text, cursor)
  }
  if (code === 93) return matchLinkDestinationEnd(text, cursor)
  if (code === 104 || code === 72) return matchBareUrlEnd(text, cursor)
  return -1
}

const findClosingDoubleDollarOffset = (
  text: string,
  openIndex: number,
  singleLineOnly: boolean,
  excludedRanges: readonly MathSpanRange[]
): number => {
  const scanLimit = Math.min(text.length - 1, openIndex + 2 + DEFAULT_MAX_DISPLAY_MATH_LENGTH)
  for (let cursor = openIndex + 2; cursor < scanLimit; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (singleLineOnly && (code === 10 || code === 13)) return -1
    if (overlapsSortedRanges(excludedRanges, cursor, cursor + 1)) return -1
    const skippedEnd = stepDisplayMathInnerConstructAt(text, cursor)
    if (skippedEnd > cursor) {
      if (text.slice(cursor, skippedEnd).includes("$$")) return -1
      cursor = skippedEnd - 1
      continue
    }
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
  const openLineStart = findLineStartOffset(text, openIndex)
  const openLineEnd = findLineEndOffset(text, openIndex)
  const openLine = text.slice(openLineStart, openLineEnd)
  const parsedOpen = resolveDedicatedMathOpen(text, openIndex, openLine, excluded)
  const isAtStrippedLineStart =
    parsedOpen !== null && openIndex === openLineStart + (openLine.length - parsedOpen.rest.length)
  if (isAtStrippedLineStart && !text.slice(openIndex + 2, openLineEnd).includes("$")) {
    if (singleLineOnly || parsedOpen.rest.slice(2).trim() !== "") return null
    return matchDedicatedDisplayMathToken(text, openIndex, parsedOpen.quoteDepth, excluded, parsedOpen.allowAsideIndent)
  }
  const closePos = findClosingDoubleDollarOffset(text, openIndex, singleLineOnly, excluded)
  if (closePos < 0) return null
  if (!singleLineOnly && hasParagraphOrBlockBreakBetween(text, openIndex + 2, closePos)) return null
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

  return { kind: "inline", from: openIndex, to: closePos + 1, math: text.slice(openIndex + 1, closePos) }
}

export type InlineLiteralSkipOptions = {
  honorEscapes?: boolean
  codeScanLimit?: number
  singleLineDisplayMath?: boolean
}

const skipDollarLiteralConstructAt = (
  text: string,
  cursor: number,
  singleLineDisplayMath?: boolean
): number => {
  const run = countCodePointRun(text, cursor, 36)
  if (run === 2) {
    return scanPandocDisplayMathAt(text, cursor, { singleLineOnly: singleLineDisplayMath })?.to ?? cursor + 2
  }
  if (run === 1) return scanPandocInlineMathAt(text, cursor)?.to ?? cursor + 1
  return cursor + run
}

const skipBackslashEscapeAt = (text: string, cursor: number): number => {
  const next = text.codePointAt(cursor + 1)
  if (next === undefined) return Math.min(text.length, cursor + 1)
  return cursor + 1 + (next > 0xffff ? 2 : 1)
}

export const skipInlineLiteralConstructAt = (
  text: string,
  cursor: number,
  options?: InlineLiteralSkipOptions
): number => {
  if (options?.honorEscapes === false || isEscapedMarkdownAt(text, cursor)) return -1
  const code = text.codePointAt(cursor) ?? 0
  if (code === 92) return skipBackslashEscapeAt(text, cursor)
  if (code === 96) {
    const end = scanInlineCodeSpanEnd(text, cursor, options?.codeScanLimit)
    return end > cursor ? end : cursor + countCodePointRun(text, cursor, 96, options?.codeScanLimit)
  }
  if (code === 36) return skipDollarLiteralConstructAt(text, cursor, options?.singleLineDisplayMath)
  return -1
}
