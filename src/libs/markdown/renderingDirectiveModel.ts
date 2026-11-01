import {
  hasCommonMarkCodeIndent,
  overlapsSortedRanges,
  type MathSpanRange,
} from "src/libs/markdown/pandocMathScanner"
import type { MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"

export type CustomDirectiveKind = "bookmark" | "embed" | "file"

export type PendingDirectiveMetadata = {
  kind: CustomDirectiveKind
  attrs: Record<string, unknown>
}

const DIRECTIVE_CLOSE_LINE_PATTERN = /^:::[ \t\r]*$/
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
  excludedRanges: readonly MathSpanRange[] = []
): number => {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!
    const lineStart = lineStarts[index]
    if (
      lineStart !== undefined &&
      excludedRanges.length > 0 &&
      overlapsSortedRanges(excludedRanges, lineStart, lineStart + Math.max(1, line.length))
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
  excludedRanges: readonly MathSpanRange[] = []
): { closedIndex: number; bodyLines: string[] } => {
  const closedIndex = findDirectiveCloseLineIndex(lines, startIndex, lineStarts, excludedRanges)
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
