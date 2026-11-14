import {
  hasControlChars,
  isCanonicalPostImageUploadUrl,
} from "src/libs/markdown/postImageUrlPolicy"

const normalizeReferenceLabel = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()

const stripBlockquotePrefixes = (line: string) => {
  let value = line
  while (/^\s{0,3}>\s?/.test(value)) value = value.replace(/^\s{0,3}>\s?/, "")
  return value
}

const normalizeCardThumbnailSource = (raw: string) => {
  const value = raw.trim()
  if (!value || hasControlChars(value) || value.startsWith("//") || value.startsWith("/\\")) return ""
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : ""
  } catch {
    return ""
  }
}

type CodeFenceState = { marker: "`" | "~"; length: number }

const updateCodeFenceState = (
  fence: CodeFenceState | null,
  trimmedLine: string
): { nextFence: CodeFenceState | null; skipLine: boolean } => {
  if (!fence) {
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmedLine)
    if (!fenceMatch) return { nextFence: null, skipLine: false }
    return {
      nextFence: { marker: fenceMatch[1][0] as "`" | "~", length: fenceMatch[1].length },
      skipLine: true,
    }
  }
  const closingMatch = /^(`+|~+)\s*$/.exec(trimmedLine)
  const isClosing =
    closingMatch !== null &&
    closingMatch[1].startsWith(fence.marker) &&
    closingMatch[1].length >= fence.length
  return { nextFence: isClosing ? null : fence, skipLine: true }
}

const markdownWithoutCode = (content: string) => {
  if (
    !content.includes("`") &&
    !content.includes("~~~") &&
    !content.includes("    ") &&
    !content.includes("\t")
  ) {
    return content
  }
  const visibleLines: string[] = []
  let fence: CodeFenceState | null = null
  let cursor = 0

  while (cursor <= content.length) {
    const nextBreak = content.indexOf("\n", cursor)
    const rawLine = nextBreak === -1 ? content.slice(cursor) : content.slice(cursor, nextBreak)
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    const containerLine = stripBlockquotePrefixes(line)
    const fenceStep = updateCodeFenceState(fence, containerLine.trim())
    fence = fenceStep.nextFence
    if (!fenceStep.skipLine && !/^( {4}|\t)/.test(containerLine)) {
      visibleLines.push(line.includes("`") ? line.replace(/(`+)[^`]*\1/g, "") : line)
    }
    if (nextBreak === -1) break
    cursor = nextBreak + 1
  }

  return visibleLines.join("\n")
}

const isEscapedMarkdownMarker = (content: string, index: number) => {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}

const resolveCardCommentKind = (prefix: string): "bookmark" | "embed" | null => {
  if (prefix === "aq-bookmark") return "bookmark"
  if (prefix === "aq-embed") return "embed"
  return null
}

const extractCardMetadataParts = (
  rawLine: string
): { kind: "bookmark" | "embed"; jsonText: string } | null => {
  const trimmed = rawLine.trim()
  if (!trimmed.startsWith("<!--") || !trimmed.endsWith("-->")) return null
  const inner = trimmed.slice(4, -3).trim()
  const spaceIdx = inner.search(/\s/)
  if (spaceIdx < 0) return null
  const kind = resolveCardCommentKind(inner.slice(0, spaceIdx).toLowerCase())
  if (!kind) return null
  const jsonText = inner.slice(spaceIdx).trim()
  return jsonText.startsWith("{") && jsonText.endsWith("}") ? { kind, jsonText } : null
}

const parseCardDirectiveKind = (rawLine: string): "bookmark" | "embed" | null => {
  const trimmed = rawLine.trim()
  if (!trimmed.startsWith(":::")) return null
  const rest = trimmed.slice(3)
  const spaceIdx = rest.search(/\s/)
  const keyword = (spaceIdx < 0 ? rest : rest.slice(0, spaceIdx)).toLowerCase()
  if (keyword === "bookmark" || keyword === "embed") return keyword
  return null
}

const parseCardMetadataLine = (
  rawLine: string
): { match: boolean; metadata: { kind: "bookmark" | "embed"; thumbnailUrl: string } | null } => {
  const parts = extractCardMetadataParts(rawLine)
  if (!parts) return { match: false, metadata: null }
  try {
    const payload = JSON.parse(parts.jsonText) as Record<string, unknown>
    const thumbnailUrl =
      typeof payload.thumbnailUrl === "string"
        ? normalizeCardThumbnailSource(payload.thumbnailUrl)
        : ""
    return {
      match: true,
      metadata: thumbnailUrl ? { kind: parts.kind, thumbnailUrl } : null,
    }
  } catch {
    return { match: true, metadata: null }
  }
}

export const markdownCardThumbnailSources = (content: string): string[] => {
  if (!/aq-(?:bookmark|embed)/i.test(content)) return []
  const lines = content.split("\n")
  let lastClosingTripleColonIndex = -1
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === ":::") {
      lastClosingTripleColonIndex = index
      break
    }
  }
  if (lastClosingTripleColonIndex === -1) return []

  const sources: string[] = []
  let pendingMetadata: { kind: "bookmark" | "embed"; thumbnailUrl: string } | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const parsedMeta = parseCardMetadataLine(line)
    if (parsedMeta.match) {
      pendingMetadata = parsedMeta.metadata
      continue
    }

    if (pendingMetadata !== null) {
      const directiveKind = parseCardDirectiveKind(line)
      if (directiveKind === pendingMetadata.kind && lastClosingTripleColonIndex > index) {
        sources.push(pendingMetadata.thumbnailUrl)
      }
      pendingMetadata = null
    }
  }

  return sources
}

const collectImageReferenceDefinitions = (visibleContent: string): Map<string, string> => {
  const definitions = new Map<string, string>()
  if (!visibleContent.includes("]:")) return definitions
  for (const line of visibleContent.split("\n")) {
    const match = /^\s{0,3}\[([^\]]+)]:\s*<?([^\s>]+)>?/.exec(stripBlockquotePrefixes(line))
    if (!match) continue
    const label = normalizeReferenceLabel(match[1])
    if (!definitions.has(label)) definitions.set(label, match[2])
  }
  return definitions
}

const collectReferenceImageDestinations = (
  visibleContent: string,
  definitions: ReadonlyMap<string, string>
): string[] => {
  if (definitions.size === 0) return []
  const destinations: string[] = []
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
  return destinations
}

const INLINE_IMAGE_CALL_PATTERN = /!\[[^\]]*]\(([^)\n]+)\)/g

const extractInlineImageDestination = (rawInner: string): string => {
  const trimmed = rawInner.trim()
  if (!trimmed) return ""
  const spaceIdx = trimmed.search(/\s/)
  const token = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)
  if (token.startsWith("<") && token.endsWith(">")) {
    return token.slice(1, -1)
  }
  return token
}

export const hasNonCanonicalPostImageSource = (content: string): boolean => {
  if (!/!\[|aq-(?:bookmark|embed)/i.test(content)) return false
  const visibleContent = markdownWithoutCode(content)
  const definitions = collectImageReferenceDefinitions(visibleContent)
  const destinations: string[] = []
  for (const match of visibleContent.matchAll(INLINE_IMAGE_CALL_PATTERN)) {
    if (!isEscapedMarkdownMarker(visibleContent, match.index ?? 0)) {
      const dest = extractInlineImageDestination(match[1])
      if (dest) destinations.push(dest)
    }
  }
  destinations.push(
    ...markdownCardThumbnailSources(visibleContent),
    ...collectReferenceImageDestinations(visibleContent, definitions)
  )

  return destinations.some((destination) => !isCanonicalPostImageUploadUrl(destination))
}
