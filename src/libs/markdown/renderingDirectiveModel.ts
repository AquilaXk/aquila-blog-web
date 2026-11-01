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

export const DIRECTIVE_CLOSE_LINE_PATTERN = /^:::[ \t\r]*$/
export const SUPPORTED_DIRECTIVE_OPEN_PATTERN =
  /^:::(?:callout|toggle|bookmark|embed|file)(?:[ \t\r]|$)/
const SINGLE_SPACE_CHAR_PATTERN = /^\s$/

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

export const isDedicatedFormulaFenceLine = (line: string): boolean =>
  !hasCommonMarkCodeIndent(line) && line.trim() === "$$"

export const isTopLevelFormulaStopLine = (line: string): boolean =>
  parseOpeningCodeFence(line) !== null ||
  SUPPORTED_DIRECTIVE_OPEN_PATTERN.test(line) ||
  (!hasCommonMarkCodeIndent(line) && extractAsideOpenTail(line) !== null)

const isMatchingClosingFence = (
  trimmedLine: string,
  fence: { markerCode: number; length: number }
): boolean => {
  const firstCode = trimmedLine.codePointAt(0) ?? 0
  if (firstCode !== fence.markerCode) return false
  let runLen = 0
  while (runLen < trimmedLine.length && trimmedLine.codePointAt(runLen) === firstCode) {
    runLen += 1
  }
  return runLen >= fence.length && trimmedLine.slice(runLen).trim() === ""
}

const scanUnclosedContainerBefore = (
  text: string,
  openIndex: number,
  excludedRanges: readonly MathSpanRange[],
  kind: "directive" | "aside"
): boolean => {
  const prefixLines = text.slice(0, openIndex).split("\n")
  let inContainer = false
  let activeFence: { markerCode: number; length: number } | null = null
  let inComment = false
  let lineStart = 0

  for (const rawLine of prefixLines) {
    const lineEnd = lineStart + Math.max(1, rawLine.length)
    const candidate = inContainer && kind === "aside" ? rawLine.trimStart() : rawLine
    const trimmed = candidate.trim()
    if (activeFence) {
      if (!hasCommonMarkCodeIndent(candidate) && isMatchingClosingFence(trimmed, activeFence)) {
        activeFence = null
      }
      lineStart += rawLine.length + 1
      continue
    }
    if (inComment) {
      if (rawLine.includes("-->")) inComment = false
      lineStart += rawLine.length + 1
      continue
    }
    if (overlapsSortedRanges(excludedRanges, lineStart, lineEnd)) {
      lineStart += rawLine.length + 1
      continue
    }
    const openedFence = !hasCommonMarkCodeIndent(candidate) ? parseOpeningCodeFence(candidate) : null
    if (openedFence) {
      activeFence = openedFence
      lineStart += rawLine.length + 1
      continue
    }
    if (trimmed.startsWith("<!--")) {
      if (!trimmed.includes("-->")) inComment = true
      lineStart += rawLine.length + 1
      continue
    }
    if (kind === "directive") {
      if (!hasCommonMarkCodeIndent(rawLine)) {
        if (!inContainer && SUPPORTED_DIRECTIVE_OPEN_PATTERN.test(rawLine)) inContainer = true
        else if (inContainer && DIRECTIVE_CLOSE_LINE_PATTERN.test(rawLine)) inContainer = false
      }
    } else if (!inContainer && !hasCommonMarkCodeIndent(rawLine)) {
      const openTail = extractAsideOpenTail(rawLine)
      if (openTail !== null && stripClosingAsideTag(openTail) === null) inContainer = true
    } else if (inContainer && stripClosingAsideTag(rawLine) !== null) {
      inContainer = false
    }
    lineStart += rawLine.length + 1
  }
  return inContainer
}

export const resolveDedicatedMathOpen = (
  text: string,
  openIndex: number,
  openLine: string,
  excludedRanges: readonly MathSpanRange[]
): { quoteDepth: number; rest: string; allowAsideIndent: boolean } | null => {
  const direct = parseDedicatedLineQuoteDepth(openLine)
  if (direct) return { ...direct, allowAsideIndent: false }
  const trimmedStart = openLine.trimStart()
  if (!trimmedStart.startsWith("$$")) return null
  if (!scanUnclosedContainerBefore(text, openIndex, excludedRanges, "aside")) return null
  return { quoteDepth: 0, rest: trimmedStart, allowAsideIndent: true }
}

export const isDedicatedMathCloseLine = (
  line: string,
  openQuoteDepth: number,
  allowAsideIndent: boolean
): boolean => {
  if (allowAsideIndent) return line.trim() === "$$"
  const parsedClose = parseDedicatedLineQuoteDepth(line)
  return (
    parsedClose !== null &&
    parsedClose.quoteDepth === openQuoteDepth &&
    parsedClose.rest.startsWith("$$") &&
    parsedClose.rest.slice(2).trim() === ""
  )
}

export const isDedicatedFormulaBoundaryLine = (
  text: string,
  openIndex: number,
  strippedLine: string,
  openQuoteDepth: number,
  excludedRanges: readonly MathSpanRange[]
): boolean => {
  if (openQuoteDepth > 0) return false
  if (
    SUPPORTED_DIRECTIVE_OPEN_PATTERN.test(strippedLine) ||
    (!hasCommonMarkCodeIndent(strippedLine) && extractAsideOpenTail(strippedLine) !== null)
  ) {
    return true
  }
  if (DIRECTIVE_CLOSE_LINE_PATTERN.test(strippedLine)) {
    return scanUnclosedContainerBefore(text, openIndex, excludedRanges, "directive")
  }
  if (stripClosingAsideTag(strippedLine) !== null) {
    return scanUnclosedContainerBefore(text, openIndex, excludedRanges, "aside")
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
