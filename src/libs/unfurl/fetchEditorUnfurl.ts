import { inferCardKindFromUrl, resolveEmbedPreviewUrl } from "./extractMeta"
import { normalizePublicExternalThumbnailUrl } from "../markdown/externalThumbnailUrlPolicy"
import { isCanonicalPostImageUploadUrl, normalizePublicPostImageUrl } from "../markdown/postImageUrlPolicy"
import { normalizeSafeMarkdownUrl } from "../markdown/safeMarkdownUrl"

export type EditorUnfurlData = {
  url: string
  title: string
  description: string
  siteName: string
  provider: string
  thumbnailUrl: string
  embedUrl?: string
}

const UNFURL_CACHE_LIMIT = 64
const unfurlCache = new Map<string, EditorUnfurlData>()
const inFlightUnfurls = new Map<string, Promise<EditorUnfurlData | null>>()

const sanitizeUnfurlData = (fallbackUrl: string, raw: Record<string, unknown>): EditorUnfurlData | null => {
  const url = normalizeSafeMarkdownUrl(typeof raw.url === "string" ? raw.url : fallbackUrl)
  if (!url) return null
  const rawThumbnail = typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl : ""
  const thumbnailUrl =
    normalizePublicPostImageUrl(rawThumbnail) || normalizePublicExternalThumbnailUrl(rawThumbnail)
  const rawEmbed = typeof raw.embedUrl === "string" ? raw.embedUrl : ""
  const embedUrl = (rawEmbed ? resolveEmbedPreviewUrl(rawEmbed) : "") || resolveEmbedPreviewUrl(url)
  return {
    url,
    title: typeof raw.title === "string" ? raw.title.trim().slice(0, 240) : "",
    description: typeof raw.description === "string" ? raw.description.trim().slice(0, 420) : "",
    siteName: typeof raw.siteName === "string" ? raw.siteName.trim().slice(0, 120) : "",
    provider: typeof raw.provider === "string" ? raw.provider.trim().slice(0, 120) : "",
    thumbnailUrl,
    ...(embedUrl ? { embedUrl } : {}),
  }
}

const recordCache = (url: string, data: EditorUnfurlData) => {
  if (unfurlCache.has(url)) unfurlCache.delete(url)
  unfurlCache.set(url, data)
  if (unfurlCache.size > UNFURL_CACHE_LIMIT) {
    const oldest = unfurlCache.keys().next().value
    if (oldest !== undefined) unfurlCache.delete(oldest)
  }
}

export const getCachedEditorUnfurl = (rawUrl: string): EditorUnfurlData | null => {
  const safe = normalizeSafeMarkdownUrl(rawUrl)
  return safe ? unfurlCache.get(safe) ?? null : null
}

export const clearEditorUnfurlCacheForTests = () => {
  unfurlCache.clear()
  inFlightUnfurls.clear()
}

export const fetchEditorUnfurl = async (
  rawUrl: string,
  options?: { signal?: AbortSignal }
): Promise<EditorUnfurlData | null> => {
  const safeUrl = normalizeSafeMarkdownUrl(rawUrl)
  if (!safeUrl || (!safeUrl.startsWith("http://") && !safeUrl.startsWith("https://"))) {
    return null
  }
  const cached = unfurlCache.get(safeUrl)
  if (cached) return cached

  const existing = inFlightUnfurls.get(safeUrl)
  if (existing) return existing

  const requestPromise = (async (): Promise<EditorUnfurlData | null> => {
    try {
      const response = await fetch(`/api/editor/unfurl?url=${encodeURIComponent(safeUrl)}`, {
        method: "GET",
        credentials: "same-origin",
        signal: options?.signal,
      })
      if (!response.ok) return null
      const json = (await response.json()) as { ok?: boolean; data?: Record<string, unknown> } | null
      if (!json?.ok || !json.data || typeof json.data !== "object") return null
      const parsed = sanitizeUnfurlData(safeUrl, json.data)
      if (parsed) recordCache(safeUrl, parsed)
      return parsed
    } catch {
      return null
    } finally {
      inFlightUnfurls.delete(safeUrl)
    }
  })()

  inFlightUnfurls.set(safeUrl, requestPromise)
  return requestPromise
}

export const formatUnfurlDirectiveBlock = (
  kind: "bookmark" | "embed",
  rawUrl: string,
  data?: EditorUnfurlData | null
): string => {
  const safeUrl = normalizeSafeMarkdownUrl(data?.url || rawUrl) || rawUrl.trim()
  if (!data) return `:::${kind} ${safeUrl}\n:::`

  const metadata: Record<string, string> = {}
  if (data.title) metadata.title = data.title
  if (kind === "bookmark" && data.description) metadata.description = data.description
  if (kind === "embed" && data.description) metadata.caption = data.description
  if (data.siteName) metadata.siteName = data.siteName
  if (data.provider) metadata.provider = data.provider
  if (kind === "embed" && data.embedUrl) metadata.embedUrl = data.embedUrl
  if (data.thumbnailUrl && isCanonicalPostImageUploadUrl(data.thumbnailUrl)) {
    metadata.thumbnailUrl = data.thumbnailUrl
  }

  const lines: string[] = []
  if (Object.keys(metadata).length > 0) {
    lines.push(`<!-- aq-${kind} ${JSON.stringify(metadata)} -->`)
  }
  lines.push(`:::${kind} ${safeUrl}`)
  if (data.title) lines.push(data.title)
  if (data.description && data.description !== data.title) lines.push(data.description)
  lines.push(":::")
  return lines.join("\n")
}

export const inferDirectiveKindForPastedUrl = (url: string): "bookmark" | "embed" =>
  inferCardKindFromUrl(url) === "embed" ? "embed" : "bookmark"
