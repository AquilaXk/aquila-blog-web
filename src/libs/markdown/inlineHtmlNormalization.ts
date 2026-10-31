import {
  replaceEntityBrTags,
  replaceRawBrTags,
  skipAsciiSpaces,
  startsWithAsciiCaseInsensitive,
} from "./inlineTokenScanners"
import {
  countCodePointRun,
  isEscapedMarkdownAt,
  parseOpeningCodeFence,
  scanInlineCodeSpanEnd,
} from "./pandocMathScanner"

const isTableSeparatorCell = (rawCell: string): boolean => {
  const cell = rawCell.trim()
  if (!cell) return false
  const start = cell.startsWith(":") ? 1 : 0
  const end = cell.endsWith(":") ? cell.length - 1 : cell.length
  if (end - start < 3) return false
  for (let index = start; index < end; index += 1) {
    if (cell.codePointAt(index) !== 45) return false
  }
  return true
}

const isTableSeparatorLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false
  const start = trimmed.startsWith("|") ? 1 : 0
  const end = trimmed.endsWith("|") ? trimmed.length - 1 : trimmed.length
  const cells = trimmed.slice(start, end).split("|")
  return cells.length >= 2 && cells.every(isTableSeparatorCell)
}

const isLikelyTableRow = (line: string) => {
  const trimmed = line.trim()
  return trimmed.length >= 3 && trimmed.slice(1, -1).includes("|")
}

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

const wrapWithMarkdownCodeMark = (content: string) => {
  const normalized = decodeLegacyHtmlEntities(content).trim()
  if (!normalized) return ""
  const longestRun = findLongestBacktickRun(normalized)
  const marker = "`".repeat(longestRun + 1)
  const paddedContent =
    normalized.startsWith("`") || normalized.endsWith("`") ? ` ${normalized} ` : normalized
  return `${marker}${paddedContent}${marker}`
}

const LEGACY_HTML_ENTITY_CODES: Record<string, number> = {
  amp: 38,
  apos: 39,
  gt: 62,
  lt: 60,
  nbsp: 32,
  quot: 34,
}

const parseLegacyEntityCodePoint = (normalizedToken: string): number => {
  if (normalizedToken.startsWith("#x")) return Number.parseInt(normalizedToken.slice(2), 16)
  if (normalizedToken.startsWith("#")) return Number.parseInt(normalizedToken.slice(1), 10)
  return LEGACY_HTML_ENTITY_CODES[normalizedToken] ?? -1
}

const decodeLegacyHtmlEntities = (input: string, preserveMarkupEntities = false) =>
  String(input || "").replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, token: string) => {
      const codePoint = parseLegacyEntityCodePoint(token.toLowerCase())
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity
      if (preserveMarkupEntities && (codePoint === 38 || codePoint === 60 || codePoint === 62)) {
        return `&#${codePoint};`
      }
      return String.fromCodePoint(codePoint)
    }
  )

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

const matchPairedOpenTagAt = (
  text: string,
  lowerText: string,
  start: number,
  config: PairedTagConfig
): { openEnd: number; tagName: string } | null => {
  if (config.honorMarkdownEscapes && isEscapedMarkdownAt(text, start)) return null
  const afterOpen = skipAsciiSpaces(text, start + config.openDelim.length)
  const matchedName = matchTagNameAt(text, afterOpen, config.tagNames)
  if (!matchedName) return null
  const afterName = afterOpen + matchedName.length
  if (lowerText.startsWith(config.closeDelim, afterName)) {
    return { openEnd: afterName + config.closeDelim.length, tagName: matchedName }
  }
  const skipped = skipAsciiSpaces(text, afterName)
  if (lowerText.startsWith(config.closeDelim, skipped)) {
    return { openEnd: skipped + config.closeDelim.length, tagName: matchedName }
  }
  if (!isAsciiSpaceCode(text.codePointAt(afterName) ?? 0)) return null
  const closePos = lowerText.indexOf(config.closeDelim, afterName + 1)
  if (closePos < 0) return null
  if (config.disallowAmpersandInAttrs && text.slice(afterName + 1, closePos).includes("&")) {
    return null
  }
  return { openEnd: closePos + config.closeDelim.length, tagName: matchedName }
}

const matchPairedCloseTagAt = (
  text: string,
  lowerText: string,
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
  return lowerText.startsWith(config.closeDelim, cursor) ? cursor + config.closeDelim.length : -1
}

const stepPairedTagDepth = (
  text: string,
  lowerText: string,
  candidate: number,
  config: PairedTagConfig
): { delta: number; tagEnd: number } => {
  const closeEnd = matchPairedCloseTagAt(text, lowerText, candidate, config)
  if (closeEnd > candidate) return { delta: -1, tagEnd: closeEnd }
  const nestedOpen = matchPairedOpenTagAt(text, lowerText, candidate, config)
  return nestedOpen ? { delta: 1, tagEnd: nestedOpen.openEnd } : { delta: 0, tagEnd: -1 }
}

const findPairedCloseTag = (
  text: string,
  lowerText: string,
  searchFrom: number,
  config: PairedTagConfig
): { closeStart: number; closeEnd: number } | null => {
  let depth = 1
  let candidate = lowerText.indexOf(config.openDelim, searchFrom)
  while (candidate >= 0) {
    const step = stepPairedTagDepth(text, lowerText, candidate, config)
    if (step.delta !== 0) {
      depth += step.delta
      if (depth === 0) return { closeStart: candidate, closeEnd: step.tagEnd }
      candidate = lowerText.indexOf(config.openDelim, step.tagEnd)
      continue
    }
    candidate = lowerText.indexOf(config.openDelim, candidate + config.openDelim.length)
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
  const lowerText = text.toLowerCase()
  let openIndex = lowerText.indexOf(spec.openDelim)
  if (openIndex < 0) return decodePlainSlice(text)
  const outerConfig: PairedTagConfig = { ...spec, honorMarkdownEscapes: true }
  let output = ""
  let cursor = 0

  while (openIndex >= 0) {
    const openTag = matchPairedOpenTagAt(text, lowerText, openIndex, outerConfig)
    if (!openTag) {
      openIndex = lowerText.indexOf(spec.openDelim, openIndex + spec.openDelim.length)
      continue
    }
    const closeMatch = findPairedCloseTag(text, lowerText, openTag.openEnd, {
      ...spec,
      tagNames: [openTag.tagName],
      honorMarkdownEscapes: openTag.tagName !== "code",
    })
    if (!closeMatch) {
      openIndex = lowerText.indexOf(spec.openDelim, openTag.openEnd)
      continue
    }
    if (openIndex > cursor) output += decodePlainSlice(text.slice(cursor, openIndex))
    output += transformInner(text.slice(openTag.openEnd, closeMatch.closeStart))
    cursor = closeMatch.closeEnd
    openIndex = lowerText.indexOf(spec.openDelim, cursor)
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
  marker: string
): string => {
  const preserveMarkupEntities = spec.openDelim === "<"
  const decodePlainSlice = (slice: string) =>
    decodeLegacyHtmlEntities(slice, preserveMarkupEntities)
  const renderNested = (rawInner: string): string =>
    wrapDecodedMarkdownMark(
      replacePairedInlineTags(rawInner, spec, renderNested, decodePlainSlice),
      marker
    )
  return replacePairedInlineTags(input, spec, renderNested)
}

const createChunkCodeSpanPrefix = (chunk: string): string => {
  const probe = chunk.includes("&") ? `${chunk}\n${decodeLegacyHtmlEntities(chunk)}` : chunk
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
  if (codeSpans.length === 0) return text
  let restored = text
  for (let idx = codeSpans.length - 1; idx >= 0; idx -= 1) {
    restored = restored.replaceAll(`${prefix}${idx}\uE001`, codeSpans[idx] ?? "")
  }
  return restored
}

const normalizeTagGroup = (
  input: string,
  openDelim: string,
  closeDelim: string,
  disallowAmpersandInAttrs: boolean,
  storeCodeSpan: (codeMark: string) => string
): string => {
  const base = { openDelim, closeDelim, disallowAmpersandInAttrs }
  let normalized = replacePairedInlineTags(
    input,
    { ...base, tagNames: ["code"] },
    (rawInner) => storeCodeSpan(wrapWithMarkdownCodeMark(rawInner))
  )
  for (const [tagNames, marker] of FORMATTING_TAG_SPECS) {
    normalized = replacePairedFormattingTags(normalized, { ...base, tagNames }, marker)
  }
  return normalized
}

const normalizeInlineHtmlChunk = (
  chunk: string,
  hasRawTag: boolean,
  hasEntityTag: boolean
): string => {
  const prefix = createChunkCodeSpanPrefix(chunk)
  const codeSpans: string[] = []
  const storeCodeSpan = (codeMark: string): string => {
    if (!codeMark) return ""
    const idx = codeSpans.length
    codeSpans.push(codeMark)
    return `${prefix}${idx}\uE001`
  }

  let normalized = chunk
  if (hasRawTag && normalized.includes("<")) {
    normalized = normalizeTagGroup(normalized, "<", ">", false, storeCodeSpan)
    normalized = replaceRawBrTags(normalized, "<br />")
  }
  if (hasEntityTag && normalized.toLowerCase().includes("&lt;")) {
    normalized = normalizeTagGroup(normalized, "&lt;", "&gt;", true, storeCodeSpan)
    normalized = replaceEntityBrTags(normalized, "<br />")
  }
  return restoreStoredCodeSpans(normalized, prefix, codeSpans)
}

const matchUnescapedInlineCodeEndAt = (
  input: string,
  cursor: number
): { nextCursor: number; spanEnd: number } => {
  if (input.codePointAt(cursor) !== 96 || isEscapedMarkdownAt(input, cursor)) {
    return { nextCursor: cursor + 1, spanEnd: -1 }
  }
  const closeEnd = scanInlineCodeSpanEnd(input, cursor)
  return closeEnd > cursor
    ? { nextCursor: closeEnd, spanEnd: closeEnd }
    : { nextCursor: cursor + countCodePointRun(input, cursor, 96), spanEnd: -1 }
}

export const normalizeLegacyInlineHtmlSpans = (input: string) => {
  if (!input) return input
  const hasRawTag = input.includes("<")
  const hasEntityTag = input.toLowerCase().includes("&lt;")
  if (!hasRawTag && !hasEntityTag) return input
  if (!input.includes("`")) return normalizeInlineHtmlChunk(input, hasRawTag, hasEntityTag)

  let result = ""
  let copyFrom = 0
  let cursor = 0
  while (cursor < input.length) {
    const { nextCursor, spanEnd } = matchUnescapedInlineCodeEndAt(input, cursor)
    if (spanEnd < 0) {
      cursor = nextCursor
      continue
    }
    if (cursor > copyFrom) {
      result += normalizeInlineHtmlChunk(input.slice(copyFrom, cursor), hasRawTag, hasEntityTag)
    }
    result += input.slice(cursor, spanEnd)
    copyFrom = spanEnd
    cursor = spanEnd
  }
  if (copyFrom === 0) return normalizeInlineHtmlChunk(input, hasRawTag, hasEntityTag)
  return copyFrom < input.length
    ? result + normalizeInlineHtmlChunk(input.slice(copyFrom), hasRawTag, hasEntityTag)
    : result
}

type ActiveCodeFence = {
  markerCode: number
  length: number
  maxCloseIndent: number
  quoteDepth: number
}

type BlockScanState = {
  activeFence: ActiveCodeFence | null
  inIndentedCode: boolean
  inParagraph: boolean
  listContentIndent: number
  prevQuoteDepth: number
}

const LIST_MARKER_CONTENT_PATTERN = /^(?:[-+*]|\d{1,9}[.)])([ \t]+)/

const isAtxHeadingStart = (content: string): boolean => {
  const hashes = countCodePointRun(content, 0, 35)
  if (hashes < 1 || hashes > 6) return false
  const next = content.codePointAt(hashes)
  return next === undefined || next === 32 || next === 9 || next === 13
}

const advanceIndentColumn = (indent: number, code: number): number =>
  code === 9 ? indent + 4 - (indent % 4) : indent + 1

const stripBlockquoteMarkers = (line: string): { rest: string; quoteDepth: number } => {
  let cursor = 0
  let quoteDepth = 0
  while (cursor < line.length) {
    const spaces = Math.min(3, countCodePointRun(line, cursor, 32))
    if (line.codePointAt(cursor + spaces) !== 62) break
    quoteDepth += 1
    cursor += spaces + 1
    if (line.codePointAt(cursor) === 32) cursor += 1
  }
  return { rest: line.slice(cursor), quoteDepth }
}

const measureLeadingIndent = (
  line: string
): { indent: number; contentOffset: number; isBlank: boolean } => {
  let indent = 0
  let cursor = 0
  while (cursor < line.length) {
    const code = line.codePointAt(cursor) ?? 0
    if (code === 32 || code === 9) {
      indent = advanceIndentColumn(indent, code)
      cursor += 1
      continue
    }
    if (code === 13) {
      cursor += 1
      continue
    }
    return { indent, contentOffset: cursor, isBlank: false }
  }
  return { indent, contentOffset: cursor, isBlank: true }
}

const matchListMarkerContentIndent = (
  rest: string,
  indent: number,
  contentOffset: number
): number | null => {
  const match = LIST_MARKER_CONTENT_PATTERN.exec(rest.slice(contentOffset))
  if (!match) return null
  const spacesPart = match[1] ?? ""
  const markerWidth = match[0].length - spacesPart.length
  const baseCol = indent + markerWidth
  let col = baseCol
  for (let idx = 0; idx < spacesPart.length; idx += 1) {
    col = advanceIndentColumn(col, spacesPart.codePointAt(idx) ?? 32)
  }
  const restIsBlank = rest.slice(contentOffset + match[0].length).trim().length === 0
  return restIsBlank || col - baseCol > 4 ? baseCol + 1 : col
}

const isClosingFenceLine = (
  rest: string,
  indent: number,
  contentOffset: number,
  fence: ActiveCodeFence
): boolean => {
  if (indent > fence.maxCloseIndent) return false
  const content = rest.slice(contentOffset)
  const runLen = countCodePointRun(content, 0, fence.markerCode)
  return runLen >= fence.length && content.slice(runLen).trim().length === 0
}

const stepActiveFenceState = (
  rest: string,
  indent: number,
  contentOffset: number,
  quoteDepth: number,
  state: BlockScanState
): boolean => {
  if (!state.activeFence) return false
  if (quoteDepth < state.activeFence.quoteDepth) {
    state.activeFence = null
    state.inIndentedCode = false
    state.inParagraph = false
    state.listContentIndent = 0
    return false
  }
  if (isClosingFenceLine(rest, indent, contentOffset, state.activeFence)) {
    state.activeFence = null
    state.inParagraph = false
    state.inIndentedCode = false
  }
  return true
}

const syncQuoteDepthTransition = (
  quoteDepth: number,
  isBlank: boolean,
  state: BlockScanState
): void => {
  if (quoteDepth > state.prevQuoteDepth) {
    state.inIndentedCode = false
    state.inParagraph = false
    state.listContentIndent = 0
  } else if (quoteDepth < state.prevQuoteDepth && (isBlank || !state.inParagraph)) {
    state.inIndentedCode = false
    state.listContentIndent = 0
  }
  state.prevQuoteDepth = quoteDepth
}

const isIndentedCodeLine = (
  state: BlockScanState,
  indent: number,
  isBlank: boolean
): boolean => {
  const minCodeIndent = state.listContentIndent + 4
  if (state.inIndentedCode) return isBlank || indent >= minCodeIndent
  return !state.inParagraph && !isBlank && indent >= minCodeIndent
}

const tryOpenFenceOrUpdateBlockContext = (
  rest: string,
  indent: number,
  contentOffset: number,
  quoteDepth: number,
  state: BlockScanState
): { skipNormalization: boolean; nextInParagraph: boolean } => {
  const content = rest.slice(contentOffset)
  if (indent <= state.listContentIndent + 3) {
    const opened = parseOpeningCodeFence(content)
    if (opened) {
      state.activeFence = {
        ...opened,
        maxCloseIndent: state.listContentIndent + 3,
        quoteDepth,
      }
      state.inParagraph = false
      return { skipNormalization: true, nextInParagraph: false }
    }
    if (isAtxHeadingStart(content)) {
      return { skipNormalization: false, nextInParagraph: false }
    }
  }
  const nextListIndent = matchListMarkerContentIndent(rest, indent, contentOffset)
  if (nextListIndent !== null) state.listContentIndent = nextListIndent
  return { skipNormalization: false, nextInParagraph: true }
}

const stepMarkdownCodeBlockState = (line: string, state: BlockScanState): boolean => {
  const { rest, quoteDepth } = stripBlockquoteMarkers(line)
  const { indent, contentOffset, isBlank } = measureLeadingIndent(rest)
  if (stepActiveFenceState(rest, indent, contentOffset, quoteDepth, state)) return true
  syncQuoteDepthTransition(quoteDepth, isBlank, state)
  if (!isBlank && indent < state.listContentIndent) {
    state.listContentIndent = 0
  }
  if (isIndentedCodeLine(state, indent, isBlank)) {
    state.inIndentedCode = true
    state.inParagraph = false
    return true
  }
  state.inIndentedCode = false
  if (isBlank) {
    state.inParagraph = false
    return true
  }
  const blockStep = tryOpenFenceOrUpdateBlockContext(rest, indent, contentOffset, quoteDepth, state)
  state.inParagraph = blockStep.nextInParagraph
  return blockStep.skipNormalization
}

export const normalizeLegacyInlineHtmlMarkdown = (markdown: string) => {
  if (!markdown) return markdown
  const lowerMarkdown = markdown.toLowerCase()
  if (!markdown.includes("<") && !lowerMarkdown.includes("&lt;")) return markdown

  const state: BlockScanState = {
    activeFence: null,
    inIndentedCode: false,
    inParagraph: false,
    listContentIndent: 0,
    prevQuoteDepth: 0,
  }

  return markdown
    .split("\n")
    .map((line) => {
      if (stepMarkdownCodeBlockState(line, state)) return line
      if (!line.includes("<") && !line.toLowerCase().includes("&lt;")) return line
      return normalizeLegacyInlineHtmlSpans(line)
    })
    .join("\n")
}

export const normalizeInlineHtmlInMarkdownTables = (markdown: string) => {
  if (!markdown) return markdown
  if (!markdown.includes("<") && !markdown.toLowerCase().includes("&lt;")) return markdown

  return markdown
    .split("\n")
    .map((line) => {
      if (!line.includes("<") && !line.toLowerCase().includes("&lt;")) return line
      if (!isLikelyTableRow(line) || isTableSeparatorLine(line)) return line
      return normalizeLegacyInlineHtmlSpans(line)
    })
    .join("\n")
}
