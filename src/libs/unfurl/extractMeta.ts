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

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  divide: "÷",
  plusmn: "±",
  laquo: "«",
  raquo: "»",
}

const hostMatches = (hostname: string, suffix: string) =>
  hostname === suffix || hostname.endsWith(`.${suffix}`)

const decodeSafeCodePoint = (rawCode: number, fallback: string): string => {
  if (
    !Number.isInteger(rawCode) ||
    rawCode <= 0 ||
    rawCode > 0x10ffff ||
    (rawCode >= 0xd800 && rawCode <= 0xdfff)
  ) {
    return fallback
  }
  return rawCode === 0x09 || rawCode === 0x0a || rawCode === 0x0d || rawCode >= 0x20
    ? String.fromCodePoint(rawCode)
    : " "
}

const HTML_ENTITY_PATTERN = /&(?:#x([0-9a-f]{1,6})|#([0-9]{1,7})|([a-z]{2,12}));/gi

const htmlDecode = (value: string) =>
  value
    .replace(
      HTML_ENTITY_PATTERN,
      (entity, hexCode?: string, decCode?: string, namedKey?: string) => {
        if (hexCode) {
          return decodeSafeCodePoint(Number.parseInt(hexCode, 16), entity)
        }
        if (decCode) {
          return decodeSafeCodePoint(Number.parseInt(decCode, 10), entity)
        }
        if (namedKey) {
          return HTML_ENTITY_MAP[namedKey.toLowerCase()] ?? entity
        }
        return entity
      }
    )
    .trim()

const MAX_HEAD_SCAN_CHARS = 512 * 1024

const firstMetaValue = (metaValues: ReadonlyMap<string, string>, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = metaValues.get(key)
    if (value) return value
  }
  return ""
}

const decodeMetaAttributeValue = (value: string) => htmlDecode(value.trim())

const isTagNameTerminator = (code: number): boolean =>
  code === 32 || code === 9 || code === 10 || code === 13 || code === 47 || code === 62

const sliceCleanHeadDocument = (html: string): string => {
  if (!html) return ""
  const bounded = html.length > MAX_HEAD_SCAN_CHARS ? html.slice(0, MAX_HEAD_SCAN_CHARS) : html
  const lower = bounded.toLowerCase()
  const parts: string[] = []
  let cursor = 0

  while (cursor < bounded.length) {
    const ltIndex = bounded.indexOf("<", cursor)
    if (ltIndex === -1) {
      parts.push(bounded.slice(cursor))
      break
    }
    if (ltIndex > cursor) {
      parts.push(bounded.slice(cursor, ltIndex))
    }

    if (bounded.startsWith("<!--", ltIndex)) {
      const commentEnd = bounded.indexOf("-->", ltIndex + 4)
      if (commentEnd === -1) break
      cursor = commentEnd + 3
      continue
    }

    const nextCode = bounded.charCodeAt(ltIndex + 1)
    if (
      ltIndex + 1 >= bounded.length ||
      !(
        (nextCode >= 65 && nextCode <= 90) ||
        (nextCode >= 97 && nextCode <= 122) ||
        nextCode === 47
      )
    ) {
      parts.push("<")
      cursor = ltIndex + 1
      continue
    }

    let nameEnd = ltIndex + 1
    while (nameEnd < bounded.length && !isTagNameTerminator(bounded.charCodeAt(nameEnd))) {
      nameEnd += 1
    }
    const rawTagName = lower.slice(ltIndex + 1, nameEnd)
    if (rawTagName === "/head") {
      break
    }
    if (rawTagName === "body") {
      break
    }

    let tagEnd = nameEnd
    let quote: string | null = null
    while (tagEnd < bounded.length) {
      const ch = bounded[tagEnd]!
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === ">") {
        break
      }
      tagEnd += 1
    }
    if (tagEnd >= bounded.length) {
      parts.push(bounded.slice(ltIndex))
      break
    }

    const selfClosing = bounded[tagEnd - 1] === "/"
    if (
      !selfClosing &&
      (rawTagName === "script" ||
        rawTagName === "style" ||
        rawTagName === "noscript" ||
        rawTagName === "template")
    ) {
      const closeNeedle = `</${rawTagName}`
      let closeIdx = lower.indexOf(closeNeedle, tagEnd + 1)
      while (closeIdx !== -1) {
        const afterClose = lower.charCodeAt(closeIdx + closeNeedle.length)
        if (
          closeIdx + closeNeedle.length >= bounded.length ||
          afterClose === 62 ||
          afterClose === 32 ||
          afterClose === 9 ||
          afterClose === 10 ||
          afterClose === 13
        ) {
          break
        }
        closeIdx = lower.indexOf(closeNeedle, closeIdx + closeNeedle.length)
      }
      if (closeIdx === -1) break
      const closeTagEnd = bounded.indexOf(">", closeIdx + closeNeedle.length)
      if (closeTagEnd === -1) break
      cursor = closeTagEnd + 1
      continue
    }

    parts.push(bounded.slice(ltIndex, tagEnd + 1))
    cursor = tagEnd + 1
  }

  return parts.join("")
}

const scanMetaTagAttributes = (headHtml: string): Map<string, string> => {
  const values = new Map<string, string>()
  const lower = headHtml.toLowerCase()
  let cursor = 0

  while (cursor < headHtml.length) {
    const tagStart = lower.indexOf("<meta", cursor)
    if (tagStart === -1) break
    const afterName = headHtml.charCodeAt(tagStart + 5)
    if (
      tagStart + 5 < headHtml.length &&
      afterName !== 32 &&
      afterName !== 9 &&
      afterName !== 10 &&
      afterName !== 13 &&
      afterName !== 47 &&
      afterName !== 62
    ) {
      cursor = tagStart + 5
      continue
    }

    let pos = tagStart + 5
    let quote: string | null = null
    while (pos < headHtml.length) {
      const ch = headHtml[pos]!
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === ">") {
        break
      }
      pos += 1
    }

    const attrsSource = headHtml.slice(tagStart + 5, pos)
    cursor = pos + 1

    const attrs = new Map<string, string>()
    let attrPos = 0
    while (attrPos < attrsSource.length) {
      while (attrPos < attrsSource.length && /\s|\//.test(attrsSource[attrPos]!)) attrPos += 1
      if (attrPos >= attrsSource.length) break
      const nameStart = attrPos
      while (attrPos < attrsSource.length && !/[\s=/>]/.test(attrsSource[attrPos]!)) attrPos += 1
      const name = attrsSource.slice(nameStart, attrPos).toLowerCase()
      while (attrPos < attrsSource.length && /\s/.test(attrsSource[attrPos]!)) attrPos += 1
      if (attrsSource[attrPos] !== "=") continue
      attrPos += 1
      while (attrPos < attrsSource.length && /\s/.test(attrsSource[attrPos]!)) attrPos += 1
      if (attrPos >= attrsSource.length) break

      let rawVal = ""
      const q = attrsSource[attrPos]!
      if (q === '"' || q === "'") {
        attrPos += 1
        const valStart = attrPos
        while (attrPos < attrsSource.length && attrsSource[attrPos] !== q) attrPos += 1
        rawVal = attrsSource.slice(valStart, attrPos)
        if (attrPos < attrsSource.length) attrPos += 1
      } else {
        const valStart = attrPos
        while (attrPos < attrsSource.length && !/[\s>]/.test(attrsSource[attrPos]!)) attrPos += 1
        rawVal = attrsSource.slice(valStart, attrPos)
      }
      if (name) attrs.set(name, rawVal)
    }

    const metaKey = (attrs.get("property") || attrs.get("name") || "").trim().toLowerCase()
    const metaContent = attrs.get("content")
    if (metaKey && typeof metaContent === "string" && metaContent.trim() && !values.has(metaKey)) {
      values.set(metaKey, decodeMetaAttributeValue(metaContent))
    }
  }

  return values
}

const extractTitleElement = (html: string): string => {
  const lower = html.toLowerCase()
  let cursor = 0
  while (cursor < html.length) {
    const openStart = lower.indexOf("<title", cursor)
    if (openStart === -1) return ""
    const afterName = html.charCodeAt(openStart + 6)
    if (openStart + 6 < html.length && !isTagNameTerminator(afterName)) {
      cursor = openStart + 6
      continue
    }
    let openEnd = openStart + 6
    let quote: string | null = null
    while (openEnd < html.length) {
      const ch = html[openEnd]!
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'") {
        quote = ch
      } else if (ch === ">") {
        break
      }
      openEnd += 1
    }
    if (openEnd >= html.length) return ""
    const closeStart = lower.indexOf("</title>", openEnd + 1)
    if (closeStart === -1) return ""
    const rawTitle = html.slice(openEnd + 1, closeStart).trim()
    return rawTitle ? htmlDecode(rawTitle) : ""
  }
  return ""
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
  const headHtml = sliceCleanHeadDocument(html)
  const metaValues = scanMetaTagAttributes(headHtml)
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
