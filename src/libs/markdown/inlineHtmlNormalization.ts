import { collectCommonMarkCodeBlockRanges } from "./commonMarkCodeBlockRanges"
import {
  replaceEntityBrTags,
  replaceRawBrTags,
  skipAsciiSpaces,
  startsWithAsciiCaseInsensitive,
} from "./inlineTokenScanners"
import {
  countCodePointRun,
  findContainingSortedRangeEnd,
  isEscapedMarkdownAt,
  mergeSortedSpanRanges,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
  type MathSpanRange,
} from "./pandocMathScanner"

const findLongestBacktickRun = (value: string): number => {
  let longest = 0
  let current = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.codePointAt(index) === 96) {
      current += 1
      if (current > longest) longest = current
    } else {
      current = 0
    }
  }
  return longest
}

const wrapDecodedMarkdownMark = (decodedContent: string, marker: string) => {
  const normalized = decodedContent.trim()
  if (!normalized) return ""
  return `${marker}${normalized}${marker}`
}

const LEGACY_HTML_ENTITY_CODES: Record<string, number> = {
  amp: 38,
  apos: 39,
  gt: 62,
  lt: 60,
  nbsp: 32,
  quot: 34,
}

const HTML5_LEGACY_ENTITY_PATTERN =
  /&(#[xX][\da-fA-F]+|#\d+|amp|AMP|apos|gt|GT|lt|LT|nbsp|quot|QUOT);/g

const parseLegacyEntityCodePoint = (normalizedToken: string): number => {
  if (normalizedToken.startsWith("#x")) return Number.parseInt(normalizedToken.slice(2), 16)
  if (normalizedToken.startsWith("#")) return Number.parseInt(normalizedToken.slice(1), 10)
  return LEGACY_HTML_ENTITY_CODES[normalizedToken] ?? -1
}

const isValidHtmlEntityScalar = (codePoint: number): boolean =>
  Number.isInteger(codePoint) &&
  codePoint > 0 &&
  codePoint <= 0x10ffff &&
  (codePoint < 0xd800 || codePoint > 0xdfff)

const decodeLegacyHtmlEntities = (
  input: string,
  markupTokenReplacer?: (codePoint: number) => string
) =>
  String(input || "").replace(HTML5_LEGACY_ENTITY_PATTERN, (entity, token: string) => {
    const codePoint = parseLegacyEntityCodePoint(token.toLowerCase())
    if (!isValidHtmlEntityScalar(codePoint)) return entity
    if (markupTokenReplacer && (codePoint === 38 || codePoint === 60 || codePoint === 62)) {
      return markupTokenReplacer(codePoint)
    }
    return String.fromCodePoint(codePoint)
  })

const wrapWithMarkdownCodeMark = (content: string) => {
  const normalized = decodeLegacyHtmlEntities(content).trim()
  if (!normalized) return ""
  const longestRun = findLongestBacktickRun(normalized)
  const marker = "`".repeat(longestRun + 1)
  const paddedContent =
    normalized.startsWith("`") || normalized.endsWith("`") ? ` ${normalized} ` : normalized
  return `${marker}${paddedContent}${marker}`
}

const isAsciiSpaceCode = (code: number): boolean =>
  code === 32 || (code >= 9 && code <= 13)

const matchTagNameAt = (
  text: string,
  cursor: number,
  tagNames: readonly string[]
): string | null => {
  for (const name of tagNames) {
    if (startsWithAsciiCaseInsensitive(text, cursor, name)) {
      return name
    }
  }
  return null
}

type PairedTagSpec = {
  openDelim: string
  closeDelim: string
  tagNames: readonly string[]
  disallowAmpersandInAttrs: boolean
}

type PairedTagConfig = PairedTagSpec & {
  honorMarkdownEscapes: boolean
}

const toDelimiterSearchText = (text: string, openDelim: string): string => {
  if (openDelim !== "&lt;") return text
  if (!text.includes("&LT;") && !text.includes("&GT;")) return text
  return text.replaceAll("&LT;", "&lt;").replaceAll("&GT;", "&gt;")
}

const matchPairedOpenTagAt = (
  text: string,
  searchText: string,
  start: number,
  config: PairedTagConfig
): { openEnd: number; tagName: string } | null => {
  if (config.honorMarkdownEscapes && isEscapedMarkdownAt(text, start)) return null
  const afterOpen = skipAsciiSpaces(text, start + config.openDelim.length)
  const matchedName = matchTagNameAt(text, afterOpen, config.tagNames)
  if (!matchedName) return null
  const afterName = afterOpen + matchedName.length
  if (searchText.startsWith(config.closeDelim, afterName)) {
    return { openEnd: afterName + config.closeDelim.length, tagName: matchedName }
  }
  const skipped = skipAsciiSpaces(text, afterName)
  if (searchText.startsWith(config.closeDelim, skipped)) {
    return { openEnd: skipped + config.closeDelim.length, tagName: matchedName }
  }
  if (!isAsciiSpaceCode(text.codePointAt(afterName) ?? 0)) return null
  const closePos = searchText.indexOf(config.closeDelim, afterName + 1)
  if (closePos < 0) return null
  if (config.disallowAmpersandInAttrs && text.slice(afterName + 1, closePos).includes("&")) {
    return null
  }
  return { openEnd: closePos + config.closeDelim.length, tagName: matchedName }
}

const matchPairedCloseTagAt = (
  text: string,
  searchText: string,
  start: number,
  config: PairedTagConfig
): number => {
  if (config.honorMarkdownEscapes && isEscapedMarkdownAt(text, start)) return -1
  let cursor = skipAsciiSpaces(text, start + config.openDelim.length)
  if (text.codePointAt(cursor) !== 47) return -1
  cursor = skipAsciiSpaces(text, cursor + 1)
  const matchedName = matchTagNameAt(text, cursor, config.tagNames)
  if (!matchedName) return -1
  cursor = skipAsciiSpaces(text, cursor + matchedName.length)
  return searchText.startsWith(config.closeDelim, cursor) ? cursor + config.closeDelim.length : -1
}

const stepPairedTagDepth = (
  text: string,
  searchText: string,
  candidate: number,
  config: PairedTagConfig
): { delta: number; tagEnd: number } => {
  const closeEnd = matchPairedCloseTagAt(text, searchText, candidate, config)
  if (closeEnd > candidate) return { delta: -1, tagEnd: closeEnd }
  const nestedOpen = matchPairedOpenTagAt(text, searchText, candidate, config)
  return nestedOpen ? { delta: 1, tagEnd: nestedOpen.openEnd } : { delta: 0, tagEnd: -1 }
}

const findPairedCloseTag = (
  text: string,
  searchText: string,
  searchFrom: number,
  config: PairedTagConfig
): { closeStart: number; closeEnd: number } | null => {
  let depth = 1
  let candidate = searchText.indexOf(config.openDelim, searchFrom)
  while (candidate >= 0) {
    const step = stepPairedTagDepth(text, searchText, candidate, config)
    if (step.delta !== 0) {
      depth += step.delta
      if (depth === 0) return { closeStart: candidate, closeEnd: step.tagEnd }
      candidate = searchText.indexOf(config.openDelim, step.tagEnd)
      continue
    }
    candidate = searchText.indexOf(config.openDelim, candidate + config.openDelim.length)
  }
  return null
}

const IDENTITY_SLICE_DECODER = (slice: string): string => slice

const replacePairedInlineTags = (
  text: string,
  spec: PairedTagSpec,
  transformInner: (inner: string) => string,
  decodePlainSlice: (slice: string) => string = IDENTITY_SLICE_DECODER
): string => {
  const searchText = toDelimiterSearchText(text, spec.openDelim)
  let openIndex = searchText.indexOf(spec.openDelim)
  if (openIndex < 0) return decodePlainSlice(text)
  const outerConfig: PairedTagConfig = { ...spec, honorMarkdownEscapes: true }
  let output = ""
  let cursor = 0

  while (openIndex >= 0) {
    const openTag = matchPairedOpenTagAt(text, searchText, openIndex, outerConfig)
    if (!openTag) {
      openIndex = searchText.indexOf(spec.openDelim, openIndex + spec.openDelim.length)
      continue
    }
    const closeMatch = findPairedCloseTag(text, searchText, openTag.openEnd, {
      ...spec,
      tagNames: [openTag.tagName],
      honorMarkdownEscapes: openTag.tagName !== "code",
    })
    if (!closeMatch) {
      openIndex = searchText.indexOf(spec.openDelim, openTag.openEnd)
      continue
    }
    if (openIndex > cursor) output += decodePlainSlice(text.slice(cursor, openIndex))
    output += transformInner(text.slice(openTag.openEnd, closeMatch.closeStart))
    cursor = closeMatch.closeEnd
    openIndex = searchText.indexOf(spec.openDelim, cursor)
  }

  if (cursor === 0) return decodePlainSlice(text)
  return cursor < text.length ? output + decodePlainSlice(text.slice(cursor)) : output
}

const FORMATTING_TAG_SPECS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["strong", "b"], "**"],
  [["em", "i"], "*"],
  [["del", "s"], "~~"],
]

const replacePairedFormattingTags = (
  input: string,
  spec: PairedTagSpec,
  marker: string,
  storeSpan: (value: string) => string
): string => {
  const markupTokenReplacer =
    spec.openDelim === "<" ? (codePoint: number) => storeSpan(`&#${codePoint};`) : undefined
  const decodePlainSlice = (slice: string) =>
    decodeLegacyHtmlEntities(slice, markupTokenReplacer)
  const renderNested = (rawInner: string): string =>
    wrapDecodedMarkdownMark(
      replacePairedInlineTags(rawInner, spec, renderNested, decodePlainSlice),
      marker
    )
  return replacePairedInlineTags(input, spec, renderNested)
}

const createChunkCodeSpanPrefix = (chunk: string): string => {
  const decoded = chunk.includes("&") ? decodeLegacyHtmlEntities(chunk) : chunk
  const probe = `${chunk}\n${decoded}\n${decoded.replace(/(?:<[^>]*>|\s)+/g, "")}`
  let nonce = 0
  while (probe.includes(`AQCODE${nonce}_`)) {
    nonce += 1
  }
  return `\uE000AQCODE${nonce}_`
}

const restoreStoredCodeSpans = (
  text: string,
  prefix: string,
  codeSpans: readonly string[]
): string => {
  if (codeSpans.length === 0 || !text.includes(prefix)) return text
  let restored = text
  for (let idx = codeSpans.length - 1; idx >= 0; idx -= 1) {
    const span = codeSpans[idx] ?? ""
    restored = restored.replaceAll(`${prefix}${idx}\uE001`, () => span)
  }
  return restored
}

const normalizeTagGroup = (
  input: string,
  openDelim: string,
  closeDelim: string,
  disallowAmpersandInAttrs: boolean,
  storeSpan: (value: string) => string,
  restoreSpans: (value: string) => string
): string => {
  const base = { openDelim, closeDelim, disallowAmpersandInAttrs }
  let normalized = replacePairedInlineTags(
    input,
    { ...base, tagNames: ["code"] },
    (rawInner) => storeSpan(wrapWithMarkdownCodeMark(restoreSpans(rawInner)))
  )
  for (const [tagNames, marker] of FORMATTING_TAG_SPECS) {
    normalized = replacePairedFormattingTags(normalized, { ...base, tagNames }, marker, storeSpan)
  }
  return normalized
}

const hasEntityMarkupCandidate = (value: string): boolean =>
  value.includes("&lt;") || value.includes("&LT;") || value.includes("&#")

const INLINE_AUTOLINK_SCHEMES = ["http://", "https://", "mailto:"] as const

const scanAutolinkCloseAngle = (text: string, from: number): number => {
  for (let cursor = from; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 62) return cursor > from ? cursor + 1 : -1
    if (code <= 32 || code === 60) return -1
  }
  return -1
}

const matchInlineAutolinkEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 60 || isEscapedMarkdownAt(text, index)) return -1
  for (const scheme of INLINE_AUTOLINK_SCHEMES) {
    if (startsWithAsciiCaseInsensitive(text, index + 1, scheme)) {
      return scanAutolinkCloseAngle(text, index + 1 + scheme.length)
    }
  }
  return -1
}

const matchSingleLineMathEnd = (
  text: string,
  index: number
): { nextCursor: number; spanEnd: number } => {
  const run = countCodePointRun(text, index, 36)
  if (run === 2) {
    const display = scanPandocDisplayMathAt(text, index, { singleLineOnly: true })
    return display
      ? { nextCursor: display.to, spanEnd: display.to }
      : { nextCursor: index + 2, spanEnd: -1 }
  }
  if (run === 1) {
    const inline = scanPandocInlineMathAt(text, index)
    return inline
      ? { nextCursor: inline.to, spanEnd: inline.to }
      : { nextCursor: index + 1, spanEnd: -1 }
  }
  return { nextCursor: index + run, spanEnd: -1 }
}

const stepSkippedInlineConstructAt = (
  input: string,
  cursor: number
): { nextCursor: number; spanEnd: number } => {
  const code = input.codePointAt(cursor) ?? 0
  if (code === 96 && !isEscapedMarkdownAt(input, cursor)) {
    const closeEnd = scanInlineCodeSpanEnd(input, cursor)
    return closeEnd > cursor
      ? { nextCursor: closeEnd, spanEnd: closeEnd }
      : { nextCursor: cursor + countCodePointRun(input, cursor, 96), spanEnd: -1 }
  }
  if (code === 36 && !isEscapedMarkdownAt(input, cursor)) {
    return matchSingleLineMathEnd(input, cursor)
  }
  if (code === 60) {
    const autolinkEnd = matchInlineAutolinkEnd(input, cursor)
    if (autolinkEnd > cursor) return { nextCursor: autolinkEnd, spanEnd: autolinkEnd }
  }
  return { nextCursor: cursor + 1, spanEnd: -1 }
}

const shieldSkippedInlineConstructs = (
  input: string,
  storeSpan: (value: string) => string
): string => {
  if (!input.includes("`") && !input.includes("$") && !input.includes("<")) return input
  let output = ""
  let copyFrom = 0
  let cursor = 0
  while (cursor < input.length) {
    const { nextCursor, spanEnd } = stepSkippedInlineConstructAt(input, cursor)
    if (spanEnd > cursor) {
      output += input.slice(copyFrom, cursor) + storeSpan(input.slice(cursor, spanEnd))
      copyFrom = spanEnd
    }
    cursor = nextCursor
  }
  return copyFrom === 0 ? input : output + input.slice(copyFrom)
}

export const normalizeLegacyInlineHtmlSpans = (input: string) => {
  if (!input) return input
  const hasRawTag = input.includes("<")
  const hasEntityTag = hasEntityMarkupCandidate(input)
  if (!hasRawTag && !hasEntityTag) return input

  const prefix = createChunkCodeSpanPrefix(input)
  const storedSpans: string[] = []
  const storeSpan = (value: string): string => {
    if (!value) return ""
    const idx = storedSpans.length
    storedSpans.push(value)
    return `${prefix}${idx}\uE001`
  }
  const restoreSpans = (value: string): string =>
    restoreStoredCodeSpans(value, prefix, storedSpans)

  let normalized = shieldSkippedInlineConstructs(input, storeSpan)
  if (hasRawTag && normalized.includes("<")) {
    normalized = normalizeTagGroup(normalized, "<", ">", false, storeSpan, restoreSpans)
    normalized = replaceRawBrTags(normalized, "<br />")
  }
  if (hasEntityTag && (normalized.includes("&lt;") || normalized.includes("&LT;"))) {
    normalized = normalizeTagGroup(normalized, "&lt;", "&gt;", true, storeSpan, restoreSpans)
  }
  if (hasEntityTag && hasEntityMarkupCandidate(normalized)) {
    normalized = replaceEntityBrTags(normalized, "<br />")
  }
  return restoreSpans(normalized)
}

const stepMultiLineExcludedLiteralAt = (
  markdown: string,
  cursor: number,
  codeBlockRanges: readonly MathSpanRange[],
  literalRanges: MathSpanRange[]
): number => {
  const codeEnd = findContainingSortedRangeEnd(codeBlockRanges, cursor)
  if (codeEnd > cursor) return codeEnd
  const code = markdown.codePointAt(cursor) ?? 0
  if (code === 96 && !isEscapedMarkdownAt(markdown, cursor)) {
    const spanEnd = scanInlineCodeSpanEnd(markdown, cursor)
    if (spanEnd > cursor && markdown.slice(cursor, spanEnd).includes("\n")) {
      literalRanges.push({ from: cursor, to: spanEnd })
    }
    return spanEnd > cursor ? spanEnd : cursor + countCodePointRun(markdown, cursor, 96)
  }
  if (code !== 36) return cursor + 1
  const token = scanPandocDisplayMathAt(markdown, cursor, { excludedRanges: codeBlockRanges })
  if (!token) return cursor + countCodePointRun(markdown, cursor, 36)
  if (markdown.slice(token.from, token.to).includes("\n")) {
    literalRanges.push({ from: token.from, to: token.to })
  }
  return token.to
}

const collectMultiLineExcludedLiteralRanges = (
  markdown: string,
  codeBlockRanges: readonly MathSpanRange[]
): MathSpanRange[] => {
  if (!markdown.includes("$$") && !markdown.includes("`")) return []
  const literalRanges: MathSpanRange[] = []
  let cursor = 0
  while (cursor < markdown.length) {
    cursor = stepMultiLineExcludedLiteralAt(markdown, cursor, codeBlockRanges, literalRanges)
  }
  return literalRanges
}

const normalizeNonExcludedSegment = (segment: string): string => {
  if (!segment.includes("<") && !hasEntityMarkupCandidate(segment)) return segment
  return segment.split("\n").map(normalizeLegacyInlineHtmlSpans).join("\n")
}

export const normalizeLegacyInlineHtmlMarkdown = (markdown: string) => {
  if (!markdown) return markdown
  if (!markdown.includes("<") && !hasEntityMarkupCandidate(markdown)) return markdown

  const codeBlockRanges = collectCommonMarkCodeBlockRanges(markdown)
  const literalRanges = collectMultiLineExcludedLiteralRanges(markdown, codeBlockRanges)
  const excludedRanges =
    literalRanges.length > 0
      ? mergeSortedSpanRanges([...codeBlockRanges, ...literalRanges])
      : codeBlockRanges
  if (excludedRanges.length === 0) return normalizeNonExcludedSegment(markdown)

  let output = ""
  let cursor = 0
  for (const range of excludedRanges) {
    if (range.from > cursor) {
      output += normalizeNonExcludedSegment(markdown.slice(cursor, range.from))
    }
    output += markdown.slice(range.from, range.to)
    cursor = range.to
  }
  if (cursor < markdown.length) {
    output += normalizeNonExcludedSegment(markdown.slice(cursor))
  }
  return output
}
