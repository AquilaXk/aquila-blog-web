import { getApiBaseUrl } from "src/apis/backend/client"

const POST_IMAGE_PATH_PREFIX = "/post/api/v1/images/"

type PostImageUrlPolicyOptions = {
  publicApiOrigin?: string
  allowRelative?: boolean
}

const toOrigin = (value: string): string => {
  try {
    const parsed = new URL(value)
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return ""
    return parsed.origin
  } catch {
    return ""
  }
}

const resolvePublicApiOrigin = () => {
  const configuredPublicUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()
  if (configuredPublicUrl) return toOrigin(configuredPublicUrl)
  if (typeof window === "undefined" && process.env.BACKEND_INTERNAL_URL) return ""
  try {
    return toOrigin(getApiBaseUrl())
  } catch {
    return ""
  }
}

const normalizeRelativePostImageUrl = (value: string) => {
  if (!value.startsWith(POST_IMAGE_PATH_PREFIX)) return ""

  try {
    const parsed = new URL(value, "https://post-image-policy.invalid")
    if (!parsed.pathname.startsWith(POST_IMAGE_PATH_PREFIX)) return ""
    return parsed.pathname.slice(POST_IMAGE_PATH_PREFIX.length)
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : ""
  } catch {
    return ""
  }
}

export const normalizePostImageUrl = (
  raw: string,
  options: PostImageUrlPolicyOptions = {},
): string => {
  const value = raw.trim()
  if (!value || value.startsWith("//")) return ""

  if (value.startsWith("/")) {
    return options.allowRelative ? normalizeRelativePostImageUrl(value) : ""
  }

  const publicApiOrigin = options.publicApiOrigin ? toOrigin(options.publicApiOrigin) : resolvePublicApiOrigin()
  if (!publicApiOrigin) return ""

  try {
    const parsed = new URL(value)
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return ""
    if (parsed.origin !== publicApiOrigin || !parsed.pathname.startsWith(POST_IMAGE_PATH_PREFIX)) return ""
    if (!parsed.pathname.slice(POST_IMAGE_PATH_PREFIX.length)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

export const normalizePublicPostImageUrl = (
  raw: string,
  options: Omit<PostImageUrlPolicyOptions, "allowRelative"> = {},
) =>
  normalizePostImageUrl(raw, { ...options, allowRelative: true })

export const isCanonicalPostImageUploadUrl = (
  raw: string,
  options: Omit<PostImageUrlPolicyOptions, "allowRelative"> = {},
) =>
  Boolean(normalizePostImageUrl(raw, options))

const normalizeReferenceLabel = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()
const CARD_METADATA_PATTERN = /^\s*<!--\s*aq-(bookmark|embed)\s+(\{[\s\S]*\})\s*-->\s*$/i
const CARD_DIRECTIVE_PATTERN = /^:::(bookmark|embed)(?:\s+\S+)?\s*$/i

const stripBlockquotePrefixes = (line: string) => {
  let value = line
  while (/^\s{0,3}>\s?/.test(value)) value = value.replace(/^\s{0,3}>\s?/, "")
  return value
}

const normalizeCardThumbnailSource = (raw: string) => {
  const value = raw.trim()
  if (!value || value.startsWith("//")) return ""
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : ""
  } catch {
    return ""
  }
}

const markdownWithoutCode = (content: string) => {
  const visibleLines: string[] = []
  let fence: { marker: "`" | "~"; length: number } | null = null

  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const containerLine = stripBlockquotePrefixes(line)
    const trimmedLine = containerLine.trim()
    const fenceMatch = trimmedLine.match(/^(`{3,}|~{3,})/)
    if (!fence && fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~"
      fence = { marker, length: fenceMatch[1].length }
      continue
    }
    if (fence) {
      const closingMatch = trimmedLine.match(/^(`+|~+)\s*$/)
      if (closingMatch && closingMatch[1][0] === fence.marker && closingMatch[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    if (!/^( {4}|\t)/.test(containerLine)) {
      visibleLines.push(line.replace(/(`+)[^`]*\1/g, ""))
    }
  }

  return visibleLines.join("\n")
}

const isEscapedMarkdownMarker = (content: string, index: number) => {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}

const markdownCardThumbnailSources = (content: string) => {
  const sources: string[] = []
  let pendingMetadata: { kind: string; thumbnailUrl: string } | null = null
  const lines = content.split("\n")

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const metadataMatch = line.match(CARD_METADATA_PATTERN)
    if (metadataMatch) {
      try {
        const payload = JSON.parse(metadataMatch[2]) as Record<string, unknown>
        const thumbnailUrl = typeof payload.thumbnailUrl === "string"
          ? normalizeCardThumbnailSource(payload.thumbnailUrl)
          : ""
        pendingMetadata = thumbnailUrl
          ? { kind: metadataMatch[1].toLowerCase(), thumbnailUrl }
          : null
      } catch {
        pendingMetadata = null
      }
      continue
    }

    const directiveMatch = line.trim().match(CARD_DIRECTIVE_PATTERN)
    const hasClosingMarker = lines.slice(index + 1).some((candidate) => candidate.trim() === ":::")
    if (pendingMetadata && directiveMatch?.[1].toLowerCase() === pendingMetadata.kind && hasClosingMarker) {
      sources.push(pendingMetadata.thumbnailUrl)
    }
    pendingMetadata = null
  }

  return sources
}

export const hasNonCanonicalPostImageSource = (content: string): boolean => {
  const visibleContent = markdownWithoutCode(content)
  const definitions = new Map<string, string>()
  for (const line of visibleContent.split("\n")) {
    const match = stripBlockquotePrefixes(line).match(/^\s{0,3}\[([^\]]+)]:\s*<?([^\s>]+)>?/)
    if (!match) continue
    const label = normalizeReferenceLabel(match[1])
    if (!definitions.has(label)) definitions.set(label, match[2])
  }
  const destinations = [...visibleContent.matchAll(/!\[[^\]]*]\(\s*<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g)]
    .filter((match) => !isEscapedMarkdownMarker(visibleContent, match.index ?? 0))
    .map((match) => match[1])
  destinations.push(...markdownCardThumbnailSources(visibleContent))

  for (const match of visibleContent.matchAll(/!\[([^\]]*)]\[([^\]]*)]/g)) {
    if (isEscapedMarkdownMarker(visibleContent, match.index ?? 0)) continue
    const destination = definitions.get(normalizeReferenceLabel(match[2] || match[1]))
    if (destination) destinations.push(destination)
  }
  for (const match of visibleContent.matchAll(/!\[([^\]]+)](?![\[(])/g)) {
    if (isEscapedMarkdownMarker(visibleContent, match.index ?? 0)) continue
    const destination = definitions.get(normalizeReferenceLabel(match[1]))
    if (destination) destinations.push(destination)
  }

  return destinations.some((destination) => !isCanonicalPostImageUploadUrl(destination))
}
