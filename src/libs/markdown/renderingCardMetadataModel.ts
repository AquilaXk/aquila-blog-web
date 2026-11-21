/**
 * 참조 구현:
 * - silverbulletmd/silverbullet (MIT) — aq-bookmark/aq-embed/aq-file 메타데이터 주석 파서 및Fail-Closed 예산 상한
 */
import type { MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"
import type { CustomDirectiveKind } from "src/libs/markdown/sharedDirectiveContainerParser"

export const MAX_CARD_METADATA_COMMENT_CHARS = 4096
const MAX_CARD_METADATA_FIELD_CHARS = 512

export type PendingDirectiveMetadata = {
  kind: CustomDirectiveKind
  attrs: Record<string, unknown>
}

export type ResolvedCustomDirectivePayload = {
  url: string
  primaryTitle: string
  secondaryText: string
  extraAttrs: Record<string, unknown>
}

const isPlainJsonObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const readBoundedMetadataString = (
  payload: Record<string, unknown>,
  key: string
): string | undefined => {
  if (!Object.hasOwn(payload, key)) return undefined
  const raw = payload[key]
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_CARD_METADATA_FIELD_CHARS) return undefined
  return trimmed
}

const normalizeOptionalCardUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_CARD_METADATA_FIELD_CHARS) return undefined
  const normalized = normalizeSafeMarkdownUrl(trimmed)
  return normalized || undefined
}

const buildFileMetadataAttrs = (payload: Record<string, unknown>): Record<string, unknown> => {
  const mimeType = readBoundedMetadataString(payload, "mimeType")
  const rawSize = Object.hasOwn(payload, "sizeBytes") ? payload.sizeBytes : undefined
  const sizeBytes =
    typeof rawSize === "number" && Number.isFinite(rawSize) && rawSize >= 0
      ? Math.round(rawSize)
      : undefined
  const url = normalizeOptionalCardUrl(Object.hasOwn(payload, "url") ? payload.url : undefined)
  const name = readBoundedMetadataString(payload, "name") ?? readBoundedMetadataString(payload, "title")
  const description = readBoundedMetadataString(payload, "description")
  return {
    ...(url ? { url } : {}),
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
  }
}

const buildLinkCardMetadataAttrs = (
  kind: "bookmark" | "embed",
  payload: Record<string, unknown>
): Record<string, unknown> => {
  const url = normalizeOptionalCardUrl(Object.hasOwn(payload, "url") ? payload.url : undefined)
  const title = readBoundedMetadataString(payload, "title")
  const description = readBoundedMetadataString(payload, "description")
  const caption = readBoundedMetadataString(payload, "caption") ?? description
  const siteName = readBoundedMetadataString(payload, "siteName")
  const provider = readBoundedMetadataString(payload, "provider")
  const thumbnailUrl = normalizeOptionalCardUrl(
    Object.hasOwn(payload, "thumbnailUrl") ? payload.thumbnailUrl : undefined
  )
  const embedUrl = normalizeOptionalCardUrl(
    Object.hasOwn(payload, "embedUrl") ? payload.embedUrl : undefined
  )
  return {
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(kind === "bookmark" && description ? { description } : {}),
    ...(kind === "embed" && caption ? { caption } : {}),
    ...(siteName ? { siteName } : {}),
    ...(provider ? { provider } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(kind === "embed" && embedUrl ? { embedUrl } : {}),
  }
}

const resolveCardCommentKind = (rawPrefix: string): CustomDirectiveKind | null => {
  const prefix = rawPrefix.endsWith(":") ? rawPrefix.slice(0, -1) : rawPrefix
  if (prefix === "aq-bookmark") return "bookmark"
  if (prefix === "aq-embed") return "embed"
  if (prefix === "aq-file") return "file"
  return null
}

export const isAnyCardMetadataCommentLine = (trimmedLine: string): boolean => {
  if (!trimmedLine.startsWith("<!--") || !trimmedLine.endsWith("-->")) return false
  const inner = trimmedLine.slice(4, -3).trim()
  const spaceIdx = inner.search(/\s/)
  if (spaceIdx < 0) return false
  return resolveCardCommentKind(inner.slice(0, spaceIdx)) !== null
}

const extractCardMetadataCommentParts = (
  trimmedLine: string
): { kind: CustomDirectiveKind; jsonText: string } | null => {
  if (trimmedLine.length > MAX_CARD_METADATA_COMMENT_CHARS) return null
  if (!trimmedLine.startsWith("<!--") || !trimmedLine.endsWith("-->")) return null
  const inner = trimmedLine.slice(4, -3).trim()
  const spaceIdx = inner.search(/\s/)
  if (spaceIdx < 0) return null
  const kind = resolveCardCommentKind(inner.slice(0, spaceIdx))
  if (!kind) return null
  const jsonText = inner.slice(spaceIdx).trim()
  return jsonText.startsWith("{") && jsonText.endsWith("}") ? { kind, jsonText } : null
}

export const parseCardMetadataComment = (trimmedLine: string): PendingDirectiveMetadata | null => {
  const parts = extractCardMetadataCommentParts(trimmedLine)
  if (!parts) return null

  try {
    const parsed: unknown = JSON.parse(parts.jsonText)
    if (!isPlainJsonObject(parsed)) return null
    const attrs =
      parts.kind === "file"
        ? buildFileMetadataAttrs(parsed)
        : buildLinkCardMetadataAttrs(parts.kind, parsed)
    return { kind: parts.kind, attrs }
  } catch {
    return null
  }
}

export const resolveCustomDirectiveBlockPayload = (
  directive: CustomDirectiveKind,
  rawUrl: string,
  inlineTitle: string,
  bodyLines: readonly string[],
  pendingMetadata: Record<string, unknown> = {}
): ResolvedCustomDirectivePayload => {
  let mergedAttrs: Record<string, unknown> = { ...pendingMetadata }
  const visibleLines: string[] = []
  for (const rawLine of bodyLines) {
    const trimmed = rawLine.trim()
    if (trimmed && isAnyCardMetadataCommentLine(trimmed)) {
      const parsedComment = parseCardMetadataComment(trimmed)
      if (parsedComment && parsedComment.kind === directive) {
        mergedAttrs = { ...mergedAttrs, ...parsedComment.attrs }
      }
      continue
    }
    visibleLines.push(rawLine)
  }

  let resolvedUrl = normalizeSafeMarkdownUrl(rawUrl)
  if (!resolvedUrl && typeof mergedAttrs.url === "string") {
    resolvedUrl = normalizeSafeMarkdownUrl(mergedAttrs.url)
  }

  const nonEmptyVisible: string[] = []
  let skippedBodyUrlLine = false
  for (const line of visibleLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const safeLineUrl = normalizeSafeMarkdownUrl(trimmed)
    if (safeLineUrl && !resolvedUrl) {
      resolvedUrl = safeLineUrl
      skippedBodyUrlLine = true
      continue
    }
    if (!skippedBodyUrlLine && resolvedUrl && safeLineUrl === resolvedUrl) {
      skippedBodyUrlLine = true
      continue
    }
    nonEmptyVisible.push(trimmed)
  }

  const {
    url: _metaUrl,
    title: metaTitle,
    name: metaName,
    description: metaDesc,
    caption: metaCaption,
    ...restAttrs
  } = mergedAttrs

  const [firstLine = "", ...restLines] = nonEmptyVisible
  const bodyPrimary = inlineTitle || firstLine
  const metaPrimary =
    directive === "file"
      ? typeof metaName === "string"
        ? metaName
        : ""
      : typeof metaTitle === "string"
        ? metaTitle
        : ""
  const primaryTitle = bodyPrimary || metaPrimary || resolvedUrl

  const bodySecondary = inlineTitle ? nonEmptyVisible.join("\n").trim() : restLines.join("\n").trim()
  const metaSecondary =
    directive === "embed"
      ? typeof metaCaption === "string"
        ? metaCaption
        : ""
      : typeof metaDesc === "string"
        ? metaDesc
        : ""
  const secondaryText = bodySecondary || metaSecondary

  return {
    url: resolvedUrl,
    primaryTitle,
    secondaryText,
    extraAttrs: restAttrs,
  }
}

export const buildCustomDirectiveSegment = (
  directive: CustomDirectiveKind,
  url: string,
  inlineTitle: string,
  bodyLines: string[],
  directiveMetadata: Record<string, unknown>
): MarkdownSegment => {
  const resolved = resolveCustomDirectiveBlockPayload(
    directive,
    url,
    inlineTitle,
    bodyLines,
    directiveMetadata
  )
  const segmentTitle =
    resolved.primaryTitle === resolved.url &&
    !inlineTitle &&
    !bodyLines.some((line) => {
      const trimmed = line.trim()
      return trimmed && !isAnyCardMetadataCommentLine(trimmed) && normalizeSafeMarkdownUrl(trimmed) !== resolved.url
    })
      ? ""
      : resolved.primaryTitle
  if (directive === "bookmark") {
    return {
      type: "bookmark",
      url: resolved.url,
      title: segmentTitle,
      description: resolved.secondaryText,
      ...resolved.extraAttrs,
    }
  }
  if (directive === "embed") {
    return {
      type: "embed",
      url: resolved.url,
      title: segmentTitle,
      caption: resolved.secondaryText,
      ...resolved.extraAttrs,
    }
  }
  return {
    type: "file",
    url: resolved.url,
    name: segmentTitle,
    description: resolved.secondaryText,
    ...resolved.extraAttrs,
  }
}
