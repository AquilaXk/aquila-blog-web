import { stripMarkdownHighlightDelimiters } from "./inlineHighlightModel"
import {
  findWikilinkSpans,
  replaceRawBrTags,
  stripDoubleBraceColorTokensOnce,
  stripSingleBraceColorTokensOnce,
} from "./inlineTokenScanners"
import {
  countCodePointRun,
  isEscapedMarkdownAt,
  normalizeCommonMarkCodeSpanContent,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
} from "./pandocMathScanner"

export type MarkdownSourceRange = {
  start: number
  end: number
}

export type MarkdownDocumentHeading = {
  level: 1 | 2 | 3 | 4
  label: string
  offset: number
  range: MarkdownSourceRange
  slug: string
  id: string
}

export type MarkdownDocumentInsights = {
  characterCount: number
  wordCount: number
  readingMinutes: number
  headings: MarkdownDocumentHeading[]
}

const FENCE_OPEN_PATTERN = /^\s{0,3}(`{3,}|~{3,})/

const isUnicodeWhitespace = (code: number): boolean =>
  code <= 0x7f
    ? code === 0x20 || (code >= 0x09 && code <= 0x0d)
    : code === 0xa0 ||
      code === 0x1680 ||
      (code >= 0x2000 && code <= 0x200a) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0x202f ||
      code === 0x205f ||
      code === 0x3000 ||
      code === 0xfeff

export const countCodePoints = (text: string): number => {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff && (text.codePointAt(index) ?? 0) > 0xffff) {
      index += 1
    }
    count += 1
  }
  return count
}

const advanceWhitespaceWordRun = (
  text: string,
  start: number,
  end: number,
  initialInWord: boolean
): { wordCount: number; characterCount: number; inWord: boolean } => {
  let wordCount = 0
  let characterCount = 0
  let inWord = initialInWord
  for (let pos = start; pos < end; pos += 1) {
    const unit = text.charCodeAt(pos)
    let isSpace = false
    if (unit < 128) {
      isSpace = (ASCII_INSIGHT_CLASS_LUT[unit]! & CHAR_CLASS_SPACE) !== 0
    } else {
      const cp = text.codePointAt(pos) ?? 0
      isSpace = isUnicodeWhitespace(cp)
      if (cp > 0xffff) pos += 1
    }
    if (isSpace) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      wordCount += 1
    }
    characterCount += 1
  }
  return { wordCount, characterCount, inWord }
}

export const countWords = (text: string): number => {
  const { start, end } = findTrimmedTextBounds(text)
  return start >= end ? 0 : advanceWhitespaceWordRun(text, start, end, false).wordCount
}

const CHAR_CLASS_SPACE = 1 << 0
const CHAR_CLASS_FENCE = 1 << 1
const CHAR_CLASS_HASH = 1 << 2
const CHAR_CLASS_DOLLAR = 1 << 3

// 128-byte ASCII classification lookup table for single-pass document insight scanning
const ASCII_INSIGHT_CLASS_LUT = (() => {
  const lut = new Uint8Array(128)
  lut[9] = CHAR_CLASS_SPACE
  lut[10] = CHAR_CLASS_SPACE
  lut[11] = CHAR_CLASS_SPACE
  lut[12] = CHAR_CLASS_SPACE
  lut[13] = CHAR_CLASS_SPACE
  lut[32] = CHAR_CLASS_SPACE
  lut[35] = CHAR_CLASS_HASH
  lut[36] = CHAR_CLASS_DOLLAR
  lut[96] = CHAR_CLASS_FENCE
  lut[126] = CHAR_CLASS_FENCE
  return lut
})()

const findTrimmedTextBounds = (text: string): { start: number; end: number } => {
  const len = text.length
  let start = 0
  while (start < len) {
    const unit = text.charCodeAt(start)
    if (unit < 128) {
      if ((ASCII_INSIGHT_CLASS_LUT[unit]! & CHAR_CLASS_SPACE) === 0) break
      start += 1
      continue
    }
    const cp = text.codePointAt(start) ?? 0
    if (!isUnicodeWhitespace(cp)) break
    start += cp > 0xffff ? 2 : 1
  }
  let end = len
  while (end > start) {
    const prevIndex = end - 1
    const unit = text.charCodeAt(prevIndex)
    if (unit < 128) {
      if ((ASCII_INSIGHT_CLASS_LUT[unit]! & CHAR_CLASS_SPACE) === 0) break
      end -= 1
      continue
    }
    const cpStart =
      unit >= 0xdc00 &&
      unit <= 0xdfff &&
      prevIndex > start &&
      text.charCodeAt(prevIndex - 1) >= 0xd800 &&
      text.charCodeAt(prevIndex - 1) <= 0xdbff
        ? prevIndex - 1
        : prevIndex
    const cp = text.codePointAt(cpStart) ?? 0
    if (!isUnicodeWhitespace(cp)) break
    end = cpStart
  }
  return { start, end }
}

const HEADING_INLINE_SYNTAX_CODES = new Set([
  0x21, 0x24, 0x2a, 0x3c, 0x3d, 0x5b, 0x5c, 0x5f, 0x60, 0x7b, 0x7e,
])

export const hasHeadingInlineSyntax = (text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    if (HEADING_INLINE_SYNTAX_CODES.has(text.codePointAt(index) ?? 0)) return true
  }
  return false
}

const collapseAsciiWhitespace = (text: string): string =>
  text.replace(/[ \t]+/g, " ").trim()

const stripInlineColorHeadingTokens = (value: string): string => {
  let current = value
  let previous = ""
  while (current !== previous) {
    previous = current
    current = stripSingleBraceColorTokensOnce(stripDoubleBraceColorTokensOnce(current))
  }
  return current
}

const stripWikilinkHeadingTokens = (value: string): string => {
  const spans = findWikilinkSpans(value)
  if (spans.length === 0) return value
  let output = ""
  let cursor = 0
  for (const span of spans) {
    if (span.from > cursor) output += value.slice(cursor, span.from)
    const fallback = span.rawTarget.startsWith("#") ? span.rawTarget.slice(1) : span.rawTarget
    output += (span.rawAlias || fallback).trim()
    cursor = span.to
  }
  if (cursor < value.length) output += value.slice(cursor)
  return output
}

const createHeadingCodeSpanSentinelPrefix = (text: string): string => {
  let candidate = "\uE000AQHCODE"
  let attempt = 0
  while (text.includes(candidate)) {
    attempt += 1
    candidate = `\uE000AQHCODE${attempt}X`
  }
  return candidate
}

const restoreHeadingCodeSpanSentinels = (
  text: string,
  prefix: string,
  protectedSpans: readonly string[]
): string => {
  if (protectedSpans.length === 0) return text
  let restored = text
  for (const [index, span] of protectedSpans.entries()) {
    restored = restored.replaceAll(`${prefix}${index}\uE001`, () => span)
  }
  return restored
}

const matchHeadingCodeSpanAt = (
  text: string,
  cursor: number
): { nextCursor: number; replacementValue: string | null } => {
  const runLen = countCodePointRun(text, cursor, 96)
  const closeEnd = scanInlineCodeSpanEnd(text, cursor)
  if (closeEnd < 0) return { nextCursor: cursor + runLen, replacementValue: null }
  return {
    nextCursor: closeEnd,
    replacementValue: normalizeCommonMarkCodeSpanContent(
      text.slice(cursor + runLen, closeEnd - runLen)
    ),
  }
}

const matchHeadingMathSpanAt = (
  text: string,
  cursor: number
): { nextCursor: number; replacementValue: string | null } => {
  const runLen = countCodePointRun(text, cursor, 36)
  if (runLen === 2) {
    const display = scanPandocDisplayMathAt(text, cursor, { singleLineOnly: true })
    return display
      ? { nextCursor: display.to, replacementValue: text.slice(display.from, display.to) }
      : { nextCursor: cursor + 2, replacementValue: null }
  }
  if (runLen === 1) {
    const inline = scanPandocInlineMathAt(text, cursor)
    return inline
      ? { nextCursor: inline.to, replacementValue: text.slice(inline.from, inline.to) }
      : { nextCursor: cursor + 1, replacementValue: null }
  }
  return { nextCursor: cursor + runLen, replacementValue: null }
}

const matchHeadingProtectedSpanAt = (
  text: string,
  cursor: number
): { nextCursor: number; replacementValue: string | null } => {
  const code = text.codePointAt(cursor) ?? 0
  if (code === 96 && !isEscapedMarkdownAt(text, cursor)) {
    return matchHeadingCodeSpanAt(text, cursor)
  }
  if (code === 36 && !isEscapedMarkdownAt(text, cursor)) {
    return matchHeadingMathSpanAt(text, cursor)
  }
  return { nextCursor: cursor + 1, replacementValue: null }
}

const protectHeadingCodeAndMathSpans = (
  text: string,
  sentinelPrefix: string,
  protectedSpans: string[]
): string => {
  if (!text.includes("`") && !text.includes("$")) return text
  let output = ""
  let copyFrom = 0
  let cursor = 0
  while (cursor < text.length) {
    const step = matchHeadingProtectedSpanAt(text, cursor)
    if (step.replacementValue !== null) {
      const token = `${sentinelPrefix}${protectedSpans.length}\uE001`
      protectedSpans.push(step.replacementValue)
      output += text.slice(copyFrom, cursor) + token
      copyFrom = step.nextCursor
    }
    cursor = step.nextCursor
  }
  return copyFrom === 0 ? text : output + text.slice(copyFrom)
}

export const formatMarkdownHeadingLabel = (text: string): string => {
  if (!hasHeadingInlineSyntax(text)) {
    return collapseAsciiWhitespace(text)
  }
  const protectedSpans: string[] = []
  const sentinelPrefix = createHeadingCodeSpanSentinelPrefix(text)
  const withPlaceholders = protectHeadingCodeAndMathSpans(text, sentinelPrefix, protectedSpans)
  const afterColor = stripInlineColorHeadingTokens(withPlaceholders)
  const afterBr = replaceRawBrTags(afterColor, " ")
  const afterWikilinks = stripWikilinkHeadingTokens(afterBr)
  const afterHighlights = stripMarkdownHighlightDelimiters(afterWikilinks)
  const stripped = afterHighlights
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])__([^_\s](?:[^_]*[^_\s])?)__(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*[^_\s])?)_(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/~~(.*?)~~/g, "$1")
  const formatted = restoreHeadingCodeSpanSentinels(stripped, sentinelPrefix, protectedSpans)
  return collapseAsciiWhitespace(formatted)
}

export const toMarkdownHeadingSlug = (value: string) => {
  const stripped = value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "")
  const dashed = stripped.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return dashed || "section"
}

export const slugifyMarkdownHeading = toMarkdownHeadingSlug

export const createMarkdownHeadingSlugAllocator = () => {
  const usedIds = new Set<string>()
  const nextSuffixes = new Map<string, number>()

  const allocate = (label: string, existingId?: string) => {
    const base = existingId?.trim() || toMarkdownHeadingSlug(label)
    if (!usedIds.has(base)) {
      usedIds.add(base)
      nextSuffixes.set(base, 2)
      return base
    }

    let suffix = nextSuffixes.get(base) ?? 2
    while (usedIds.has(`${base}-${suffix}`)) suffix += 1
    const allocatedId = `${base}-${suffix}`
    usedIds.add(allocatedId)
    nextSuffixes.set(base, suffix + 1)
    return allocatedId
  }

  return { allocate }
}

type ActiveFenceState = { marker: "`" | "~"; length: number } | null

const updateActiveFenceState = (line: string, activeFence: ActiveFenceState): ActiveFenceState => {
  const fenceMatch = FENCE_OPEN_PATTERN.exec(line)
  if (!fenceMatch) return activeFence
  const fence = fenceMatch[1]
  const marker = fence[0] as "`" | "~"
  if (!activeFence) {
    if (marker === "`" && line.slice(fenceMatch[0].length).includes("`")) {
      return null
    }
    return { marker, length: fence.length }
  }
  if (
    activeFence.marker === marker &&
    fence.length >= activeFence.length &&
    line.slice(fenceMatch[0].length).trim() === ""
  ) {
    return null
  }
  return activeFence
}

const hasAtxHeadingPrefixAt = (markdown: string, firstNonSpace: number, lineEnd: number): boolean => {
  let cursor = firstNonSpace
  while (cursor < lineEnd && cursor - firstNonSpace < 5 && markdown.codePointAt(cursor) === 0x23) {
    cursor += 1
  }
  const hashCount = cursor - firstNonSpace
  if (hashCount < 1 || hashCount > 4 || cursor >= lineEnd) return false
  const nextCode = markdown.codePointAt(cursor) ?? 0
  return nextCode === 0x20 || nextCode === 0x09
}

const stripOptionalAtxClosingHashes = (trimmedBody: string): string => {
  let hashStart = trimmedBody.length
  while (hashStart > 0 && trimmedBody.codePointAt(hashStart - 1) === 0x23) {
    hashStart -= 1
  }
  if (hashStart === trimmedBody.length) return trimmedBody
  if (hashStart === 0) return ""
  const beforeCode = trimmedBody.codePointAt(hashStart - 1) ?? 0
  if (beforeCode !== 0x20 && beforeCode !== 0x09) return trimmedBody
  return trimmedBody.slice(0, hashStart).trimEnd()
}

const parseAtxHeadingLine = (
  line: string
): { level: MarkdownDocumentHeading["level"]; rawContent: string } | null => {
  const firstNonSpace = findFirstNonSpaceWithinIndent(line, 0, line.length)
  if (!hasAtxHeadingPrefixAt(line, firstNonSpace, line.length)) return null
  let cursor = firstNonSpace
  while (cursor < line.length && line.codePointAt(cursor) === 0x23) {
    cursor += 1
  }
  const level = (cursor - firstNonSpace) as MarkdownDocumentHeading["level"]
  const rawContent = stripOptionalAtxClosingHashes(line.slice(cursor).trim())
  return rawContent ? { level, rawContent } : null
}

const appendMarkdownHeadingInsight = (
  line: string,
  offset: number,
  lineLength: number,
  slugAllocator: ReturnType<typeof createMarkdownHeadingSlugAllocator>,
  headings: MarkdownDocumentHeading[]
): void => {
  const parsed = parseAtxHeadingLine(line)
  if (!parsed) return
  const label = formatMarkdownHeadingLabel(parsed.rawContent)
  if (!label) return
  const slug = slugAllocator.allocate(label)
  const headingItem = {
    level: parsed.level,
    label,
    offset,
    range: { start: offset, end: offset + lineLength },
    slug,
  } as MarkdownDocumentHeading
  Object.defineProperty(headingItem, "id", {
    value: slug,
    enumerable: false,
  })
  headings.push(headingItem)
}

const findFirstNonSpaceWithinIndent = (markdown: string, lineStart: number, lineEnd: number): number => {
  let firstNonSpace = lineStart
  while (
    firstNonSpace < lineEnd &&
    firstNonSpace - lineStart < 3 &&
    markdown.codePointAt(firstNonSpace) === 32
  ) {
    firstNonSpace += 1
  }
  return firstNonSpace
}

const isDedicatedMathFenceLine = (
  markdown: string,
  firstNonSpace: number,
  lineEnd: number
): boolean =>
  markdown.codePointAt(firstNonSpace) === 36 &&
  markdown.codePointAt(firstNonSpace + 1) === 36 &&
  markdown.slice(firstNonSpace + 2, lineEnd).trim() === ""

const resolveLineContentEnd = (markdown: string, lineStart: number, nextBreak: number): number => {
  const rawLineEnd = nextBreak === -1 ? markdown.length : nextBreak
  if (rawLineEnd > lineStart && markdown.codePointAt(rawLineEnd - 1) === 13) {
    return rawLineEnd - 1
  }
  return rawLineEnd
}

export const createMarkdownDocumentInsights = (markdown: string): MarkdownDocumentInsights => {
  const { start: trimStart, end: trimEnd } = findTrimmedTextBounds(markdown)
  if (trimStart >= trimEnd) {
    return {
      characterCount: 0,
      wordCount: 0,
      readingMinutes: 0,
      headings: [],
    }
  }

  const headings: MarkdownDocumentHeading[] = []
  const slugAllocator = createMarkdownHeadingSlugAllocator()
  const len = markdown.length
  let lineStart = 0
  let offset = 0
  let activeFence: ActiveFenceState = null
  let mathFenceEnd = -1
  let characterCount = 0
  let wordCount = 0
  let inWord = false

  while (lineStart <= len) {
    const nextBreak = markdown.indexOf("\n", lineStart)
    const lineEnd = resolveLineContentEnd(markdown, lineStart, nextBreak)
    const lineLength = lineEnd - lineStart
    const firstNonSpace = findFirstNonSpaceWithinIndent(markdown, lineStart, lineEnd)
    if (firstNonSpace < lineEnd) {
      const firstUnit = markdown.charCodeAt(firstNonSpace)
      const firstClass = firstUnit < 128 ? ASCII_INSIGHT_CLASS_LUT[firstUnit]! : 0
      const inMathFence = lineStart < mathFenceEnd

      if (!inMathFence && (firstClass & CHAR_CLASS_FENCE) !== 0) {
        activeFence = updateActiveFenceState(markdown.slice(lineStart, lineEnd), activeFence)
      } else if (
        !activeFence &&
        !inMathFence &&
        (firstClass & CHAR_CLASS_DOLLAR) !== 0 &&
        isDedicatedMathFenceLine(markdown, firstNonSpace, lineEnd)
      ) {
        mathFenceEnd = scanPandocDisplayMathAt(markdown, firstNonSpace)?.to ?? -1
      } else if (
        !activeFence &&
        !inMathFence &&
        (firstClass & CHAR_CLASS_HASH) !== 0 &&
        hasAtxHeadingPrefixAt(markdown, firstNonSpace, lineEnd)
      ) {
        appendMarkdownHeadingInsight(
          markdown.slice(lineStart, lineEnd),
          offset,
          lineLength,
          slugAllocator,
          headings
        )
      }
    }

    const stepEnd = nextBreak === -1 ? len : nextBreak + 1
    const scanStart = lineStart > trimStart ? lineStart : trimStart
    const scanEnd = stepEnd < trimEnd ? stepEnd : trimEnd
    const runStats = advanceWhitespaceWordRun(markdown, scanStart, scanEnd, inWord)
    wordCount += runStats.wordCount
    characterCount += runStats.characterCount
    inWord = runStats.inWord

    offset += lineLength + 1
    if (nextBreak === -1) break
    lineStart = nextBreak + 1
  }

  return {
    characterCount,
    wordCount,
    readingMinutes: characterCount ? Math.max(1, Math.ceil(characterCount / 500)) : 0,
    headings,
  }
}
