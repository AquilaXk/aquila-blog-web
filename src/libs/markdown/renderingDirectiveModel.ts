import type { MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"

export type CustomDirectiveKind = "bookmark" | "embed" | "file"

export type PendingDirectiveMetadata = {
  kind: CustomDirectiveKind
  attrs: Record<string, unknown>
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

export const collectTripleColonBody = (
  lines: readonly string[],
  startIndex: number
): { closedIndex: number; bodyLines: string[] } => {
  const bodyLines: string[] = []
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim() === ":::") {
      return { closedIndex: index, bodyLines }
    }
    bodyLines.push(lines[index])
  }
  return { closedIndex: -1, bodyLines }
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
