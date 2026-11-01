import {
  hasCommonMarkCodeIndent,
  overlapsSortedRanges,
  parseDedicatedLineQuoteDepth,
  parseOpeningCodeFence,
  type MathSpanRange,
} from "src/libs/markdown/pandocMathScanner"
import type { MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"

export type CustomDirectiveKind = "bookmark" | "embed" | "file"

export type PendingDirectiveMetadata = {
  kind: CustomDirectiveKind
  attrs: Record<string, unknown>
}

export type CommonMarkContainerRangeSnapshot = {
  asideRanges: MathSpanRange[]
  containerCloseRanges: MathSpanRange[]
}

let blockRangeProvider: ((content: string) => CommonMarkContainerRangeSnapshot) | null = null

export const registerCommonMarkBlockRangeProvider = (
  provider: (content: string) => CommonMarkContainerRangeSnapshot
): void => {
  blockRangeProvider = provider
}

export const DIRECTIVE_CLOSE_LINE_PATTERN = /^:::[ \t\r]*$/
export const SUPPORTED_DIRECTIVE_OPEN_PATTERN =
  /^:::(?:callout|toggle|bookmark|embed|file)(?:[ \t\r]|$)/
const SINGLE_SPACE_CHAR_PATTERN = /^\s$/
export const ASIDE_TAG_CASE_INSENSITIVE_PATTERN = /<aside/i

export const maskLineWithBreakAndHeading = (line: string): string => {
  const hasCr = line.endsWith("\r")
  const bodyLength = hasCr ? line.length - 1 : line.length
  let masked = ""
  if (bodyLength >= 2) {
    masked = `\n#${" ".repeat(bodyLength - 2)}`
  } else if (bodyLength === 1) {
    masked = "\n"
  }
  return hasCr ? `${masked}\r` : masked
}

export const maskBlockquoteHeaderLine = (line: string): string => {
  const hasCr = line.endsWith("\r")
  const bodyLength = hasCr ? line.length - 1 : line.length
  const gtIndex = line.indexOf(">")
  if (gtIndex < 0) return maskLineWithBreakAndHeading(line)
  const prefix = line.slice(0, gtIndex + 1)
  const rem = bodyLength - prefix.length
  let rest = ""
  if (rem >= 2) rest = `#${" ".repeat(rem - 1)}`
  else if (rem === 1) rest = "#"
  return hasCr ? `${prefix}${rest}\r` : `${prefix}${rest}`
}

export const unindentLinePreservingLength = (line: string): string => {
  const hasCr = line.endsWith("\r")
  const core = hasCr ? line.slice(0, -1) : line
  const trimmedStart = core.trimStart()
  const leadingLen = core.length - trimmedStart.length
  if (leadingLen === 0) return line
  const shifted = `${trimmedStart}${" ".repeat(leadingLen)}`
  return hasCr ? `${shifted}\r` : shifted
}

export const neutralizeAsideOpenTagPreservingLength = (line: string): string =>
  line.replace(/<(?=aside)/i, "a")

export const maskLinesInRange = (lines: string[], startIndex: number, endIndex: number): void => {
  for (let i = startIndex; i <= endIndex; i += 1) {
    lines[i] = maskLineWithBreakAndHeading(lines[i]!)
  }
}

export const findFirstBlankLineIndex = (lines: readonly string[], startIndex: number): number => {
  for (let cursor = startIndex; cursor < lines.length; cursor += 1) {
    if (lines[cursor]!.trim() === "") return cursor
  }
  return lines.length
}

export const hasExcludedAsideCloseOrFenceBeforeBlank = (sliceBeforeBlank: readonly string[]): boolean =>
  sliceBeforeBlank.some((row) => {
    const trimmed = row.trimStart()
    return (
      stripClosingAsideTag(row) !== null ||
      parseOpeningCodeFence(trimmed) !== null ||
      trimmed.startsWith("<!--") ||
      trimmed.trimEnd() === "$$"
    )
  })

export const extractAsideOpenTail = (line: string): string | null => {
  const trimmedStart = line.trimStart()
  if (!trimmedStart.toLowerCase().startsWith("<aside")) return null
  const nextChar = trimmedStart[6]
  if (nextChar === ">") return trimmedStart.slice(7)
  if (!nextChar || !SINGLE_SPACE_CHAR_PATTERN.test(nextChar)) return null
  const closeAngle = trimmedStart.indexOf(">", 7)
  return closeAngle < 0 ? null : trimmedStart.slice(closeAngle + 1)
}

export const stripClosingAsideTag = (value: string): string | null => {
  const trimmedEnd = value.trimEnd()
  if (!trimmedEnd.toLowerCase().endsWith("</aside>")) return null
  return trimmedEnd.slice(0, -"</aside>".length).trimEnd()
}

export const isValidAsideCloseCandidate = (
  candidate: string,
  lineIndex: number,
  index: number,
  blankIndex: number,
  snapshot: readonly string[],
  lineStarts: readonly number[],
  preAsideCodeRanges: readonly MathSpanRange[]
): boolean => {
  if (stripClosingAsideTag(candidate) === null) return false
  if (lineIndex < blankIndex) return true
  const rawOriginal = snapshot[lineIndex - index]!
  if (!hasCommonMarkCodeIndent(rawOriginal)) return true
  const beforeClose = stripClosingAsideTag(rawOriginal)
  const firstNonBlank = snapshot.slice(1, blankIndex - index).find((row) => row.trim().length > 0) ?? ""
  if ((!beforeClose || beforeClose.trim().length === 0) && hasCommonMarkCodeIndent(firstNonBlank)) {
    return true
  }
  const lineStart = lineStarts[lineIndex]!
  return !overlapsSortedRanges(preAsideCodeRanges, lineStart, lineStart + Math.max(1, rawOriginal.length))
}

export const isDedicatedFormulaFenceLine = (line: string): boolean =>
  !hasCommonMarkCodeIndent(line) && line.trim() === "$$"

export const isTopLevelFormulaStopLine = (line: string): boolean =>
  parseOpeningCodeFence(line) !== null ||
  SUPPORTED_DIRECTIVE_OPEN_PATTERN.test(line) ||
  (!hasCommonMarkCodeIndent(line) && extractAsideOpenTail(line) !== null)

export const resolveDedicatedMathOpen = (
  text: string,
  openIndex: number,
  openLine: string
): { quoteDepth: number; rest: string; allowAsideIndent: boolean } | null => {
  const inAside =
    blockRangeProvider !== null &&
    ASIDE_TAG_CASE_INSENSITIVE_PATTERN.test(text) &&
    overlapsSortedRanges(blockRangeProvider(text).asideRanges, openIndex, openIndex + 1)
  const parsed = parseDedicatedLineQuoteDepth(inAside ? openLine.trimStart() : openLine)
  return parsed ? { ...parsed, allowAsideIndent: inAside } : null
}

export const isDedicatedMathCloseLine = (
  line: string,
  openQuoteDepth: number,
  allowAsideIndent: boolean
): boolean => {
  const parsedClose = parseDedicatedLineQuoteDepth(allowAsideIndent ? line.trimStart() : line)
  return (
    parsedClose !== null &&
    parsedClose.quoteDepth === openQuoteDepth &&
    parsedClose.rest.startsWith("$$") &&
    parsedClose.rest.slice(2).trim() === ""
  )
}

export const isDedicatedFormulaBoundaryLine = (
  text: string,
  lineStart: number,
  lineEnd: number,
  strippedLine: string,
  openQuoteDepth: number
): boolean => {
  if (openQuoteDepth > 0) return false
  if (
    SUPPORTED_DIRECTIVE_OPEN_PATTERN.test(strippedLine) ||
    (!hasCommonMarkCodeIndent(strippedLine) && extractAsideOpenTail(strippedLine) !== null)
  ) {
    return true
  }
  if (
    DIRECTIVE_CLOSE_LINE_PATTERN.test(strippedLine) ||
    stripClosingAsideTag(strippedLine) !== null
  ) {
    if (blockRangeProvider === null) {
      return (
        DIRECTIVE_CLOSE_LINE_PATTERN.test(strippedLine) ||
        (!hasCommonMarkCodeIndent(strippedLine) && stripClosingAsideTag(strippedLine) !== null)
      )
    }
    const { containerCloseRanges } = blockRangeProvider(text)
    return overlapsSortedRanges(containerCloseRanges, lineStart, Math.max(lineStart + 1, lineEnd))
  }
  return false
}

export const isLineStartInCommentRanges = (
  commentRanges: readonly MathSpanRange[],
  line: string,
  lineStart: number
): boolean => {
  if (commentRanges.length === 0) return false
  const firstNonSpaceOffset = lineStart + (line.length - line.trimStart().length)
  return overlapsSortedRanges(commentRanges, firstNonSpaceOffset, firstNonSpaceOffset + 1)
}

export const isAsideCloseLineExcluded = (
  codeBlockRanges: readonly MathSpanRange[],
  commentRanges: readonly MathSpanRange[],
  line: string,
  lineStart: number
): boolean => {
  const lineEnd = lineStart + Math.max(1, line.length)
  if (overlapsSortedRanges(codeBlockRanges, lineStart, lineEnd)) return true
  if (commentRanges.length === 0) return false
  const closeTagOffset = lineStart + Math.max(0, line.trimEnd().length - "</aside>".length)
  return overlapsSortedRanges(commentRanges, closeTagOffset, closeTagOffset + 1)
}

export const extractPromotedHeadingTitle = (trimmedLine: string): string | null => {
  let hashCount = 0
  while (hashCount < trimmedLine.length && trimmedLine.codePointAt(hashCount) === 35) {
    hashCount += 1
  }
  if (hashCount < 1 || hashCount > 6) return null
  const afterHash = trimmedLine[hashCount]
  if (!afterHash || !SINGLE_SPACE_CHAR_PATTERN.test(afterHash)) return null
  const title = trimmedLine.slice(hashCount).trim()
  return title.length > 0 ? title : null
}

const stripOptionalListBulletPrefix = (trimmedLine: string): string => {
  const first = trimmedLine[0]
  if (first !== "-" && first !== "*" && first !== "+") return trimmedLine
  const second = trimmedLine[1]
  if (!second || !SINGLE_SPACE_CHAR_PATTERN.test(second)) return trimmedLine
  return trimmedLine.slice(2).trimStart()
}

export const extractPromotedBoldTitle = (trimmedLine: string): string | null => {
  const candidate = stripOptionalListBulletPrefix(trimmedLine)
  let marker = ""
  if (candidate.startsWith("**")) marker = "**"
  else if (candidate.startsWith("__")) marker = "__"
  if (!marker) return null

  const closeIndex = candidate.indexOf(marker, 3)
  if (closeIndex < 0 || candidate.slice(closeIndex + 2).trim().length > 0) return null
  const promotedTitle = candidate.slice(2, closeIndex).trim()
  return promotedTitle.length > 0 ? promotedTitle : null
}

export const isPromotedCalloutTitleLine = (trimmedLine: string): boolean =>
  (extractPromotedHeadingTitle(trimmedLine) ?? extractPromotedBoldTitle(trimmedLine)) !== null

type BlockquoteHeaderScanState = {
  headerLineIndex: number
  promotedLineIndex: number
  firstContent: string
}

const stepBlockquoteHeaderScan = (
  state: BlockquoteHeaderScanState,
  line: string,
  cursor: number
): void => {
  const afterQuote = line.replace(/^\s*>\s?/, "")
  const stripped = afterQuote.trim()
  if (!stripped) return
  const indented = hasCommonMarkCodeIndent(afterQuote)
  if (state.headerLineIndex === -1) {
    if (indented) {
      state.headerLineIndex = -2
      return
    }
    state.headerLineIndex = cursor
    state.firstContent = stripped
    return
  }
  if (state.promotedLineIndex === -1) {
    state.promotedLineIndex =
      !indented && isPromotedCalloutTitleLine(stripped) ? cursor : -2
  }
}

export const findBlockquoteHeaderAndPromotedIndex = (
  lines: readonly string[],
  startIndex: number
): { cursor: number; headerLineIndex: number; promotedLineIndex: number; firstContent: string } => {
  const state: BlockquoteHeaderScanState = {
    headerLineIndex: -1,
    promotedLineIndex: -1,
    firstContent: "",
  }
  let cursor = startIndex
  while (cursor < lines.length && lines[cursor]!.trimStart().startsWith(">")) {
    stepBlockquoteHeaderScan(state, lines[cursor]!, cursor)
    cursor += 1
  }
  return { cursor, ...state }
}

export const findPromotedCalloutTitleLineIndex = (
  lines: readonly string[],
  startIndex: number,
  endExclusive: number
): number => {
  for (let index = startIndex; index < endExclusive; index += 1) {
    const line = lines[index]!
    const trimmed = line.trim()
    if (!trimmed) continue
    if (hasCommonMarkCodeIndent(line)) return -1
    return isPromotedCalloutTitleLine(trimmed) ? index : -1
  }
  return -1
}

export const extractPromotedCalloutTitle = (
  bodyLines: string[]
): { title: string; bodyLines: string[] } => {
  const firstBodyLineIndex = bodyLines.findIndex((row) => row.trim().length > 0)
  if (firstBodyLineIndex < 0) {
    return { title: "", bodyLines }
  }

  const rawFirstLine = bodyLines[firstBodyLineIndex]!
  if (hasCommonMarkCodeIndent(rawFirstLine)) {
    return { title: "", bodyLines }
  }
  const trimmedLine = rawFirstLine.trim()
  const promoted =
    extractPromotedHeadingTitle(trimmedLine) ?? extractPromotedBoldTitle(trimmedLine)
  if (!promoted) {
    return { title: "", bodyLines }
  }

  return {
    title: promoted,
    bodyLines: bodyLines.filter((_, index) => index !== firstBodyLineIndex),
  }
}

export const parseCustomDirectiveHeader = (
  trimmedLine: string
): { directive: CustomDirectiveKind; rawUrl: string; inlineTitle: string } | null => {
  if (!trimmedLine.startsWith(":::")) return null
  const afterPrefix = trimmedLine.slice(3)
  const firstSpace = afterPrefix.search(/\s/)
  const rawKind = (firstSpace < 0 ? afterPrefix : afterPrefix.slice(0, firstSpace)).toLowerCase()
  if (rawKind !== "bookmark" && rawKind !== "embed" && rawKind !== "file") {
    return null
  }
  if (firstSpace < 0) {
    return { directive: rawKind, rawUrl: "", inlineTitle: "" }
  }
  const remainder = afterPrefix.slice(firstSpace).trim()
  if (!remainder) {
    return { directive: rawKind, rawUrl: "", inlineTitle: "" }
  }
  const urlSpace = remainder.search(/\s/)
  if (urlSpace < 0) {
    return { directive: rawKind, rawUrl: remainder, inlineTitle: "" }
  }
  return {
    directive: rawKind,
    rawUrl: remainder.slice(0, urlSpace),
    inlineTitle: remainder.slice(urlSpace).trim(),
  }
}

const normalizeOptionalCardUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined
  const normalized = normalizeSafeMarkdownUrl(value)
  return normalized || undefined
}

const buildFileMetadataAttrs = (payload: Record<string, unknown>): Record<string, unknown> => ({
  ...(typeof payload.mimeType === "string" && payload.mimeType.trim()
    ? { mimeType: payload.mimeType.trim() }
    : {}),
  ...(typeof payload.sizeBytes === "number" && Number.isFinite(payload.sizeBytes)
    ? { sizeBytes: Math.max(0, Math.round(payload.sizeBytes)) }
    : {}),
})

const buildLinkCardMetadataAttrs = (
  kind: "bookmark" | "embed",
  payload: Record<string, unknown>
): Record<string, unknown> => {
  const thumbnailUrl = normalizeOptionalCardUrl(payload.thumbnailUrl)
  const embedUrl = normalizeOptionalCardUrl(payload.embedUrl)
  return {
    ...(typeof payload.siteName === "string" && payload.siteName.trim()
      ? { siteName: payload.siteName.trim() }
      : {}),
    ...(typeof payload.provider === "string" && payload.provider.trim()
      ? { provider: payload.provider.trim() }
      : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(kind === "embed" && embedUrl ? { embedUrl } : {}),
  }
}

const extractCardMetadataCommentParts = (
  trimmedLine: string
): { kind: CustomDirectiveKind; jsonText: string } | null => {
  if (!trimmedLine.startsWith("<!--") || !trimmedLine.endsWith("-->")) return null
  const inner = trimmedLine.slice(4, -3).trim()
  const spaceIdx = inner.search(/\s/)
  if (spaceIdx < 0) return null
  const prefix = inner.slice(0, spaceIdx)
  let kind: CustomDirectiveKind | null = null
  if (prefix === "aq-bookmark") kind = "bookmark"
  else if (prefix === "aq-embed") kind = "embed"
  else if (prefix === "aq-file") kind = "file"
  if (!kind) return null
  const jsonText = inner.slice(spaceIdx).trim()
  return jsonText.startsWith("{") && jsonText.endsWith("}") ? { kind, jsonText } : null
}

export const parseCardMetadataComment = (trimmedLine: string): PendingDirectiveMetadata | null => {
  const parts = extractCardMetadataCommentParts(trimmedLine)
  if (!parts) return null

  try {
    const payload = JSON.parse(parts.jsonText) as Record<string, unknown>
    const attrs =
      parts.kind === "file"
        ? buildFileMetadataAttrs(payload)
        : buildLinkCardMetadataAttrs(parts.kind, payload)
    return { kind: parts.kind, attrs }
  } catch {
    return null
  }
}

export const findDirectiveCloseLineIndex = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[] = [],
  excludedRanges: readonly MathSpanRange[] = [],
  commentRanges: readonly MathSpanRange[] = []
): number => {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!
    const lineStart = lineStarts[index]
    if (
      lineStart !== undefined &&
      ((excludedRanges.length > 0 &&
        overlapsSortedRanges(excludedRanges, lineStart, lineStart + Math.max(1, line.length))) ||
        isLineStartInCommentRanges(commentRanges, line, lineStart))
    ) {
      continue
    }
    if (DIRECTIVE_CLOSE_LINE_PATTERN.test(line)) {
      return index
    }
  }
  return -1
}

export const collectTripleColonBody = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[] = [],
  excludedRanges: readonly MathSpanRange[] = [],
  commentRanges: readonly MathSpanRange[] = []
): { closedIndex: number; bodyLines: string[] } => {
  const closedIndex = findDirectiveCloseLineIndex(
    lines,
    startIndex,
    lineStarts,
    excludedRanges,
    commentRanges
  )
  if (closedIndex < 0) {
    return { closedIndex: -1, bodyLines: lines.slice(startIndex) }
  }
  return { closedIndex, bodyLines: lines.slice(startIndex, closedIndex) }
}

export const buildCustomDirectiveSegment = (
  directive: CustomDirectiveKind,
  url: string,
  inlineTitle: string,
  bodyLines: string[],
  directiveMetadata: Record<string, unknown>
): MarkdownSegment => {
  const [firstLine = "", ...restLines] = bodyLines
  const secondaryText = restLines.join("\n").trim()
  if (directive === "bookmark") {
    return {
      type: "bookmark",
      url,
      title: inlineTitle || firstLine.trim() || "북마크",
      description: inlineTitle ? bodyLines.join("\n").trim() : secondaryText,
      ...directiveMetadata,
    }
  }
  if (directive === "embed") {
    return {
      type: "embed",
      url,
      title: firstLine.trim() || "임베드",
      caption: secondaryText,
      ...directiveMetadata,
    }
  }
  return {
    type: "file",
    url,
    name: firstLine.trim() || "파일",
    description: secondaryText,
    ...directiveMetadata,
  }
}
