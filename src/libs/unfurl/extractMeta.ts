/**
 * Metadata extraction adapted with attribution from:
 * - Ghost (`TryGhost/Ghost`, MIT License)
 *   `ghost/core/server/services/oembed/extract-metadata.ts`
 * Attribute-order-independent `<meta>` scanning and strict external URL safety checks.
 */
import { normalizePublicExternalThumbnailUrl } from "src/libs/markdown/externalThumbnailUrlPolicy"
import { formatFileSize } from "src/libs/utils"

export type UnfurlMetadata = {
  url: string
  title: string
  description: string
  siteName: string
  provider: string
  thumbnailUrl: string
  embedUrl?: string
}

const FILE_EXTENSION_PATTERN =
  /\.(?:pdf|doc|docx|xls|xlsx|ppt|pptx|zip|tar|gz|tgz|rar|7z|txt|csv|md|rtf|json|xml|yaml|yml|svg|psd|ai|sketch|fig|mp3|wav|ogg|mp4|mov|avi|mkv)$/i

const EMBED_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/
const EMBED_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const META_TAG_REGEX = /<meta\b([^>]*?)>/gi
const TITLE_TAG_REGEX = /<title[^>]*>([^<]*)<\/title>/i
const ATTR_PAIR_REGEX = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  "#39": "'",
  "#x27": "'",
  apos: "'",
}

const hostMatches = (hostname: string, suffix: string) =>
  hostname === suffix || hostname.endsWith(`.${suffix}`)

const htmlDecode = (value: string) =>
  value
    .replace(/&(amp|lt|gt|quot|#39|#x27|apos);/gi, (entity, key: string) => {
      return HTML_ENTITY_MAP[key.toLowerCase()] || entity
    })
    .trim()

const MAX_HEAD_SCAN_CHARS = 512 * 1024

const sliceHeadDocument = (html: string): string => {
  if (!html) return ""
  const upperLimit = Math.min(html.length, MAX_HEAD_SCAN_CHARS)
  const bounded = upperLimit < html.length ? html.slice(0, upperLimit) : html
  const lower = bounded.toLowerCase()
  const headCloseIndex = lower.indexOf("</head>")
  if (headCloseIndex >= 0) {
    return bounded.slice(0, headCloseIndex)
  }
  const bodyOpenIndex = lower.indexOf("<body")
  return bodyOpenIndex >= 0 ? bounded.slice(0, bodyOpenIndex) : bounded
}

const collectMetaTagValues = (headHtml: string): Map<string, string> => {
  const values = new Map<string, string>()
  META_TAG_REGEX.lastIndex = 0

  let metaMatch: RegExpExecArray | null
  while ((metaMatch = META_TAG_REGEX.exec(headHtml)) !== null) {
    const rawAttrs = metaMatch[1] || ""
    let propertyKey = ""
    let nameKey = ""
    let itempropKey = ""
    let contentValue = ""

    ATTR_PAIR_REGEX.lastIndex = 0
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = ATTR_PAIR_REGEX.exec(rawAttrs)) !== null) {
      const attrName = (attrMatch[1] || "").toLowerCase()
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ""
      if (attrName === "property") propertyKey = attrVal.trim().toLowerCase()
      else if (attrName === "name") nameKey = attrVal.trim().toLowerCase()
      else if (attrName === "itemprop") itempropKey = attrVal.trim().toLowerCase()
      else if (attrName === "content") contentValue = attrVal
    }

    const decodedContent = htmlDecode(contentValue)
    if (!decodedContent) continue

    const key = propertyKey || nameKey || itempropKey
    if (key && !values.has(key)) {
      values.set(key, decodedContent)
    }
  }

  return values
}

const firstMetaValue = (metaValues: ReadonlyMap<string, string>, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = metaValues.get(key)
    if (value) return value
  }
  return ""
}

const extractTitleElement = (html: string): string => {
  const match = TITLE_TAG_REGEX.exec(html)
  const rawTitle = match?.[1]?.trim() || ""
  return rawTitle ? htmlDecode(rawTitle) : ""
}

const humanizeHost = (hostname: string) =>
  hostname
    .replace(/^www\./i, "")
    .split(".")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(".")

export const inferLinkProvider = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase()

    if (host === "youtube.com" || host === "youtu.be") return "YouTube"
    if (host === "vimeo.com") return "Vimeo"
    if (hostMatches(host, "loom.com")) return "Loom"
    if (hostMatches(host, "figma.com")) return "Figma"
    if (hostMatches(host, "codepen.io")) return "CodePen"
    if (hostMatches(host, "codesandbox.io")) return "CodeSandbox"
    if (hostMatches(host, "github.com")) return "GitHub"
    if (hostMatches(host, "medium.com")) return "Medium"

    return humanizeHost(parsedUrl.hostname)
  } catch {
    return ""
  }
}

export const isLikelyFileUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname.trim()
    if (!pathname) return false
    return FILE_EXTENSION_PATTERN.test(pathname)
  } catch {
    return false
  }
}

const isValidEmbedVideoId = (id: string) => EMBED_VIDEO_ID_PATTERN.test(id)

export const resolveEmbedPreviewUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return ""
    const host = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase()

    if (host === "youtube.com" || host === "youtu.be") {
      const embedMatch = parsedUrl.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)$/)
      const shortMatch = parsedUrl.pathname.match(/^\/([A-Za-z0-9_-]+)\/?$/)
      const videoId =
        host === "youtu.be"
          ? shortMatch?.[1] || ""
          : embedMatch?.[1] || parsedUrl.searchParams.get("v") || ""
      return isValidEmbedVideoId(videoId) ? `https://www.youtube.com/embed/${videoId}` : ""
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const vimeoMatch =
        host === "player.vimeo.com"
          ? parsedUrl.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/?$/)
          : parsedUrl.pathname.match(/^\/([A-Za-z0-9_-]+)\/?$/)
      const videoId = vimeoMatch?.[1] || ""
      return isValidEmbedVideoId(videoId) ? `https://player.vimeo.com/video/${videoId}` : ""
    }

    if (hostMatches(host, "loom.com")) {
      const loomMatch = parsedUrl.pathname.match(/^\/(?:share|embed)\/([A-Za-z0-9_-]+)\/?$/)
      const loomId = loomMatch?.[1] || ""
      return isValidEmbedVideoId(loomId) ? `https://www.loom.com/embed/${loomId}` : ""
    }

    if (hostMatches(host, "figma.com")) {
      if (parsedUrl.pathname === "/embed") {
        const nestedRaw = parsedUrl.searchParams.get("url") || ""
        if (!nestedRaw) return ""
        const nestedUrl = new URL(nestedRaw)
        const nestedHost = nestedUrl.hostname.replace(/^www\./i, "").toLowerCase()
        if (
          (nestedUrl.protocol !== "https:" && nestedUrl.protocol !== "http:") ||
          !hostMatches(nestedHost, "figma.com")
        ) {
          return ""
        }
        return `https://www.figma.com/embed?embed_host=aquila-blog&url=${encodeURIComponent(nestedUrl.toString())}`
      }
      return `https://www.figma.com/embed?embed_host=aquila-blog&url=${encodeURIComponent(parsedUrl.toString())}`
    }

    if (hostMatches(host, "codepen.io")) {
      const parts = parsedUrl.pathname.split("/").filter(Boolean)
      if (
        parts.length >= 3 &&
        (parts[1] === "pen" || parts[1] === "embed") &&
        EMBED_SEGMENT_PATTERN.test(parts[0]) &&
        EMBED_SEGMENT_PATTERN.test(parts[2])
      ) {
        return `https://codepen.io/${parts[0]}/embed/${parts[2]}?default-tab=result`
      }
    }

    if (hostMatches(host, "codesandbox.io")) {
      const sandboxMatch = parsedUrl.pathname.match(/^\/(?:embed\/)?s\/([A-Za-z0-9_-]{3,64})\/?$/)
      if (sandboxMatch) {
        return `https://codesandbox.io/embed/s/${sandboxMatch[1]}?view=preview`
      }
    }
  } catch {
    return ""
  }

  return ""
}

export const inferCardKindFromUrl = (url: string): "bookmark" | "embed" | "file" => {
  if (isLikelyFileUrl(url)) return "file"
  if (resolveEmbedPreviewUrl(url)) return "embed"
  return "bookmark"
}

export const formatReadableFileSize = (sizeBytes?: number | null) => formatFileSize(sizeBytes)

export const extractUnfurlMetadata = (url: string, html: string): UnfurlMetadata => {
  const parsedUrl = new URL(url)
  const headHtml = sliceHeadDocument(html)
  const metaValues = collectMetaTagValues(headHtml)
  const siteName =
    firstMetaValue(metaValues, ["og:site_name", "application-name"]) || humanizeHost(parsedUrl.hostname)
  const provider = inferLinkProvider(url) || siteName
  const embedUrl = resolveEmbedPreviewUrl(url)
  const thumbnailCandidate = firstMetaValue(metaValues, [
    "og:image:secure_url",
    "og:image",
    "twitter:image:src",
    "twitter:image",
  ])
  const thumbnailUrl = thumbnailCandidate
    ? normalizePublicExternalThumbnailUrl(thumbnailCandidate, parsedUrl.toString())
    : ""

  return {
    url,
    title:
      firstMetaValue(metaValues, ["og:title", "twitter:title"]) ||
      extractTitleElement(headHtml) ||
      humanizeHost(parsedUrl.hostname),
    description: firstMetaValue(metaValues, ["og:description", "twitter:description", "description"]),
    siteName,
    provider,
    thumbnailUrl,
    ...(embedUrl ? { embedUrl } : {}),
  }
}
