import { normalizeLegacyInlineHtmlMarkdown } from "src/libs/markdown/inlineHtmlNormalization"
import { normalizeEscapedMarkdownFences } from "src/libs/markdown/mermaid"

const FENCE_MARKER_PATTERN = /^(`{3,}|~{3,})/

export const normalizeLegacyCollapsedBlockquoteStrongLines = (markdown: string) => {
  if (!markdown.includes("****") || !markdown.includes(">")) return markdown

  return markdown
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^(\s*>\s?)(.+)$/)
      if (!match) return [line]

      const prefix = match[1]
      const content = match[2].trim()
      if (!content.includes("****") || !content.startsWith("**") || !content.endsWith("**")) {
        return [line]
      }

      const inner = content.slice(2, -2)
      const segments = inner.split("****").map((segment) => segment.trim())
      if (segments.length < 2 || segments.some((segment) => segment.length === 0 || segment.includes("**"))) {
        return [line]
      }

      return segments.map((segment) => `${prefix}**${segment}**`)
    })
    .join("\n")
}

const SPLIT_INLINE_COLOR_MARKERS = ["**", "__", "*", "_"] as const
const SPLIT_INLINE_COLOR_QUOTE_PAIRS = [
  ['"', '"'],
  ["“", "”"],
  ["‘", "’"],
  ["«", "»"],
  ["「", "」"],
  ["『", "』"],
  ["〈", "〉"],
  ["《", "》"],
] as const

const isSplitInlineColorSuffix = (value: string) => /[\p{L}\p{N}]/u.test(value)

const resolveSplitInlineColorQuotedContent = (rawContent: string) => {
  const leadingWhitespace = rawContent.match(/^\s*/)?.[0] ?? ""
  const contentWithoutLeading = rawContent.slice(leadingWhitespace.length)
  const trailingWhitespace = contentWithoutLeading.match(/\s*$/)?.[0] ?? ""
  const coreContent = contentWithoutLeading.slice(0, contentWithoutLeading.length - trailingWhitespace.length)

  if (!coreContent) return null

  for (const marker of SPLIT_INLINE_COLOR_MARKERS) {
    if (!coreContent.startsWith(marker)) continue

    for (const [openQuote, closeQuote] of SPLIT_INLINE_COLOR_QUOTE_PAIRS) {
      const quotedStart = marker.length + openQuote.length
      if (!coreContent.startsWith(openQuote, marker.length) || !coreContent.endsWith(closeQuote)) continue

      const inner = coreContent.slice(quotedStart, coreContent.length - closeQuote.length)
      if (!inner.trim()) continue

      return {
        marker,
        content: `${leadingWhitespace}${marker}${openQuote}${inner}${closeQuote}${marker}${trailingWhitespace}`,
      }
    }
  }

  return null
}

const normalizeSplitInlineColorQuotedEmphasis = (markdown: string) => {
  if (!markdown.includes("{{") || (!markdown.includes("*") && !markdown.includes("_"))) return markdown

  let normalized = ""
  let cursor = 0

  while (cursor < markdown.length) {
    const tokenStart = markdown.indexOf("{{", cursor)
    if (tokenStart < 0) {
      normalized += markdown.slice(cursor)
      break
    }

    const tokenEnd = markdown.indexOf("}}", tokenStart + 2)
    if (tokenEnd < 0) {
      normalized += markdown.slice(cursor)
      break
    }

    normalized += markdown.slice(cursor, tokenStart)

    const tokenBody = markdown.slice(tokenStart + 2, tokenEnd)
    const pipeIndex = tokenBody.indexOf("|")
    const tokenCloseEnd = tokenEnd + 2

    if (pipeIndex < 0 || !/^\s*color\s*:/i.test(tokenBody.slice(0, pipeIndex))) {
      normalized += markdown.slice(tokenStart, tokenCloseEnd)
      cursor = tokenCloseEnd
      continue
    }

    const tokenHeader = tokenBody.slice(0, pipeIndex + 1)
    const tokenContent = tokenBody.slice(pipeIndex + 1)
    const splitQuotedContent = resolveSplitInlineColorQuotedContent(tokenContent)
    const outsideMarkerStart = tokenCloseEnd

    if (
      splitQuotedContent &&
      markdown.startsWith(splitQuotedContent.marker, outsideMarkerStart) &&
      isSplitInlineColorSuffix(markdown[outsideMarkerStart + splitQuotedContent.marker.length] || "")
    ) {
      normalized += `{{${tokenHeader}${splitQuotedContent.content}}}`
      cursor = outsideMarkerStart + splitQuotedContent.marker.length
      continue
    }

    normalized += markdown.slice(tokenStart, tokenCloseEnd)
    cursor = tokenCloseEnd
  }

  return normalized
}

const HAS_SPACE_BEFORE_EMPHASIS_MARKER_PATTERN = /[ \t][*_]/
const MALFORMED_TRAILING_SPACE_STRONG_ASTERISK_PATTERN =
  /\*\*(\S(?:(?!\*\*)[^\n])*?\S|\S)([^\S\n]*)\*\*/g
const MALFORMED_TRAILING_SPACE_STRONG_UNDERSCORE_PATTERN =
  /__(\S(?:(?!__)[^\n])*?\S|\S)([^\S\n]*)__/g
const MALFORMED_TRAILING_SPACE_EMPHASIS_ASTERISK_PATTERN =
  /(^|[^*])\*([^*\s](?:[^*\n]*?[^*\s])?)([^\S\n]*)\*(?!\*)/g
const MALFORMED_TRAILING_SPACE_EMPHASIS_UNDERSCORE_PATTERN =
  /(^|[^_])_([^_\s](?:[^_\n]*?[^_\s])?)([^\S\n]*)_(?!_)/g
const INLINE_CODE_SPAN_SPLIT_PATTERN = /(`+[^`\n]*`+)/g

export const normalizeMalformedTrailingSpaceEmphasisSegment = (segment: string) => {
  if (!HAS_SPACE_BEFORE_EMPHASIS_MARKER_PATTERN.test(segment)) return segment

  let normalized = segment

  if (normalized.includes("**")) {
    normalized = normalized.replace(
      MALFORMED_TRAILING_SPACE_STRONG_ASTERISK_PATTERN,
      (match, inner: string, trailingSpace: string) => (trailingSpace ? `**${inner}**` : match)
    )
  }

  if (normalized.includes("__")) {
    normalized = normalized.replace(
      MALFORMED_TRAILING_SPACE_STRONG_UNDERSCORE_PATTERN,
      (match, inner: string, trailingSpace: string) => (trailingSpace ? `__${inner}__` : match)
    )
  }

  if (normalized.includes("*")) {
    normalized = normalized.replace(
      MALFORMED_TRAILING_SPACE_EMPHASIS_ASTERISK_PATTERN,
      (match, prefix: string, inner: string, trailingSpace: string) =>
        trailingSpace ? `${prefix}*${inner}*` : match
    )
  }

  if (normalized.includes("_")) {
    normalized = normalized.replace(
      MALFORMED_TRAILING_SPACE_EMPHASIS_UNDERSCORE_PATTERN,
      (match, prefix: string, inner: string, trailingSpace: string) =>
        trailingSpace ? `${prefix}_${inner}_` : match
    )
  }

  return normalized
}

export const normalizeMalformedTrailingSpaceEmphasisLine = (line: string) => {
  if (!line.includes("*") && !line.includes("_")) return line
  if (!line.includes("`")) {
    return normalizeMalformedTrailingSpaceEmphasisSegment(line)
  }
  return line
    .split(INLINE_CODE_SPAN_SPLIT_PATTERN)
    .map((segment, index) =>
      index % 2 === 1 ? segment : normalizeMalformedTrailingSpaceEmphasisSegment(segment)
    )
    .join("")
}

export const normalizeMalformedTrailingSpaceEmphasis = (markdown: string) => {
  if (
    (!markdown.includes("*") && !markdown.includes("_")) ||
    (!markdown.includes(" ") && !markdown.includes("\t"))
  ) {
    return markdown
  }

  let activeFenceMarker = ""

  return markdown
    .split("\n")
    .map((line) => {
      const trimmedStart = line.trimStart()
      const fenceMatch = trimmedStart.match(FENCE_MARKER_PATTERN)

      if (fenceMatch) {
        const marker = fenceMatch[1]
        if (!activeFenceMarker) {
          activeFenceMarker = marker
        } else if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
          activeFenceMarker = ""
        }
        return line
      }

      if (activeFenceMarker) return line
      return normalizeMalformedTrailingSpaceEmphasisLine(line)
    })
    .join("\n")
}

export const normalizeMarkdownForRender = (rawMarkdown: string) =>
  normalizeLegacyInlineHtmlMarkdown(
    normalizeLegacyCollapsedBlockquoteStrongLines(
      normalizeMalformedTrailingSpaceEmphasis(
        normalizeSplitInlineColorQuotedEmphasis(normalizeEscapedMarkdownFences(rawMarkdown.trim()))
      )
    )
  )
