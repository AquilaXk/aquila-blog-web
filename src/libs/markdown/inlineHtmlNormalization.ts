import {
  replaceEntityBrTags,
  replaceRawBrTags,
  skipAsciiSpaces,
  startsWithAsciiCaseInsensitive,
} from "./inlineTokenScanners"

const FENCE_MARKER_PATTERN = /^(`{3,}|~{3,})/

const isTableSeparatorCell = (rawCell: string): boolean => {
  const cell = rawCell.trim()
  if (!cell) return false
  const start = cell.startsWith(":") ? 1 : 0
  const end = cell.endsWith(":") ? cell.length - 1 : cell.length
  if (end - start < 3) return false
  for (let index = start; index < end; index += 1) {
    if (cell.codePointAt(index) !== 45) return false
  }
  return true
}

const isTableSeparatorLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false
  const start = trimmed.startsWith("|") ? 1 : 0
  const end = trimmed.endsWith("|") ? trimmed.length - 1 : trimmed.length
  const cells = trimmed.slice(start, end).split("|")
  return cells.length >= 2 && cells.every(isTableSeparatorCell)
}

const isLikelyTableRow = (line: string) => {
  const trimmed = line.trim()
  return trimmed.length >= 3 && trimmed.slice(1, -1).includes("|")
}

const findLongestBacktickRun = (value: string): number => {
  let longest = 0
  let current = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.codePointAt(index) === 96) {
      current += 1
      if (current > longest) longest = current
    } else {
      current = 0
    }
  }
  return longest
}

const wrapDecodedMarkdownMark = (decodedContent: string, marker: string) => {
  const normalized = decodedContent.trim()
  if (!normalized) return ""
  return `${marker}${normalized}${marker}`
}

const wrapWithMarkdownCodeMark = (content: string) => {
  const normalized = decodeLegacyHtmlEntities(content).trim()
  if (!normalized) return ""
  const longestRun = findLongestBacktickRun(normalized)
  const marker = "`".repeat(longestRun + 1)
  const paddedContent =
    normalized.startsWith("`") || normalized.endsWith("`") ? ` ${normalized} ` : normalized
  return `${marker}${paddedContent}${marker}`
}

const LEGACY_HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

const decodeLegacyHtmlCodePoint = (codePoint: number, fallback: string) => {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return fallback
  return String.fromCodePoint(codePoint)
}

const decodeLegacyHtmlEntities = (input: string) =>
  String(input || "").replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, token: string) => {
      const normalizedToken = token.toLowerCase()
      if (normalizedToken.startsWith("#x")) {
        const codePoint = Number.parseInt(normalizedToken.slice(2), 16)
        return decodeLegacyHtmlCodePoint(codePoint, entity)
      }
      if (normalizedToken.startsWith("#")) {
        const codePoint = Number.parseInt(normalizedToken.slice(1), 10)
        return decodeLegacyHtmlCodePoint(codePoint, entity)
      }
      return LEGACY_HTML_ENTITY_MAP[normalizedToken] || entity
    }
  )

const isAsciiSpaceCode = (code: number): boolean =>
  code === 32 || (code >= 9 && code <= 13)

const matchTagNameAt = (
  text: string,
  cursor: number,
  tagNames: readonly string[]
): string | null => {
  for (const name of tagNames) {
    if (startsWithAsciiCaseInsensitive(text, cursor, name)) {
      return name
    }
  }
  return null
}

const matchPairedOpenTagAt = (
  text: string,
  lowerText: string,
  start: number,
  openDelim: string,
  closeDelim: string,
  tagNames: readonly string[],
  disallowAmpersandInAttrs: boolean
): { openEnd: number; tagName: string } | null => {
  const afterOpen = skipAsciiSpaces(text, start + openDelim.length)
  const matchedName = matchTagNameAt(text, afterOpen, tagNames)
  if (!matchedName) return null
  const afterName = afterOpen + matchedName.length
  if (lowerText.startsWith(closeDelim, afterName)) {
    return { openEnd: afterName + closeDelim.length, tagName: matchedName }
  }
  const skipped = skipAsciiSpaces(text, afterName)
  if (lowerText.startsWith(closeDelim, skipped)) {
    return { openEnd: skipped + closeDelim.length, tagName: matchedName }
  }
  if (!isAsciiSpaceCode(text.codePointAt(afterName) ?? 0)) return null
  const closePos = lowerText.indexOf(closeDelim, afterName + 1)
  if (closePos < 0) return null
  if (disallowAmpersandInAttrs && text.slice(afterName + 1, closePos).includes("&")) {
    return null
  }
  return { openEnd: closePos + closeDelim.length, tagName: matchedName }
}

const matchPairedCloseTagAt = (
  text: string,
  lowerText: string,
  start: number,
  openDelim: string,
  closeDelim: string,
  tagNames: readonly string[]
): number => {
  let cursor = skipAsciiSpaces(text, start + openDelim.length)
  if (text.codePointAt(cursor) !== 47) return -1
  cursor = skipAsciiSpaces(text, cursor + 1)
  const matchedName = matchTagNameAt(text, cursor, tagNames)
  if (!matchedName) return -1
  cursor = skipAsciiSpaces(text, cursor + matchedName.length)
  return lowerText.startsWith(closeDelim, cursor) ? cursor + closeDelim.length : -1
}

const stepPairedTagDepth = (
  text: string,
  lowerText: string,
  candidate: number,
  openDelim: string,
  closeDelim: string,
  singleTag: readonly string[],
  disallowAmpersandInAttrs: boolean
): { delta: number; tagEnd: number } => {
  const closeEnd = matchPairedCloseTagAt(
    text,
    lowerText,
    candidate,
    openDelim,
    closeDelim,
    singleTag
  )
  if (closeEnd > candidate) return { delta: -1, tagEnd: closeEnd }
  const nestedOpen = matchPairedOpenTagAt(
    text,
    lowerText,
    candidate,
    openDelim,
    closeDelim,
    singleTag,
    disallowAmpersandInAttrs
  )
  return nestedOpen ? { delta: 1, tagEnd: nestedOpen.openEnd } : { delta: 0, tagEnd: -1 }
}

const findPairedCloseTag = (
  text: string,
  lowerText: string,
  searchFrom: number,
  openDelim: string,
  closeDelim: string,
  tagNames: readonly string[],
  disallowAmpersandInAttrs: boolean
): { closeStart: number; closeEnd: number } | null => {
  let depth = 1
  let candidate = lowerText.indexOf(openDelim, searchFrom)
  while (candidate >= 0) {
    const step = stepPairedTagDepth(
      text,
      lowerText,
      candidate,
      openDelim,
      closeDelim,
      tagNames,
      disallowAmpersandInAttrs
    )
    if (step.delta !== 0) {
      depth += step.delta
      if (depth === 0) return { closeStart: candidate, closeEnd: step.tagEnd }
      candidate = lowerText.indexOf(openDelim, step.tagEnd)
      continue
    }
    candidate = lowerText.indexOf(openDelim, candidate + openDelim.length)
  }
  return null
}

const decodeTextSlice = (slice: string, shouldDecode: boolean): string =>
  shouldDecode ? decodeLegacyHtmlEntities(slice) : slice

const replacePairedInlineTags = (
  text: string,
  openDelim: string,
  closeDelim: string,
  tagNames: readonly string[],
  disallowAmpersandInAttrs: boolean,
  transformInner: (inner: string) => string,
  decodePlainSlices = false
): string => {
  const lowerText = text.toLowerCase()
  let openIndex = lowerText.indexOf(openDelim)
  if (openIndex < 0) return decodeTextSlice(text, decodePlainSlices)
  let output = ""
  let cursor = 0

  while (openIndex >= 0) {
    const openTag = matchPairedOpenTagAt(
      text,
      lowerText,
      openIndex,
      openDelim,
      closeDelim,
      tagNames,
      disallowAmpersandInAttrs
    )
    if (!openTag) {
      openIndex = lowerText.indexOf(openDelim, openIndex + openDelim.length)
      continue
    }
    const closeMatch = findPairedCloseTag(
      text,
      lowerText,
      openTag.openEnd,
      openDelim,
      closeDelim,
      [openTag.tagName],
      disallowAmpersandInAttrs
    )
    if (!closeMatch) break
    if (openIndex > cursor) {
      output += decodeTextSlice(text.slice(cursor, openIndex), decodePlainSlices)
    }
    output += transformInner(text.slice(openTag.openEnd, closeMatch.closeStart))
    cursor = closeMatch.closeEnd
    openIndex = lowerText.indexOf(openDelim, cursor)
  }

  if (cursor === 0) return decodeTextSlice(text, decodePlainSlices)
  if (cursor < text.length) {
    output += decodeTextSlice(text.slice(cursor), decodePlainSlices)
  }
  return output
}

const replacePairedFormattingTags = (
  input: string,
  openDelim: string,
  closeDelim: string,
  tagNames: readonly string[],
  disallowAmpersandInAttrs: boolean,
  marker: string
): string => {
  const renderNested = (rawInner: string): string => {
    const normalizedInner = replacePairedInlineTags(
      rawInner,
      openDelim,
      closeDelim,
      tagNames,
      disallowAmpersandInAttrs,
      renderNested,
      true
    )
    return wrapDecodedMarkdownMark(normalizedInner, marker)
  }
  return replacePairedInlineTags(
    input,
    openDelim,
    closeDelim,
    tagNames,
    disallowAmpersandInAttrs,
    renderNested
  )
}

const normalizeTagGroup = (
  input: string,
  openDelim: string,
  closeDelim: string,
  disallowAmpersandInAttrs: boolean
): string => {
  let normalized = replacePairedInlineTags(
    input,
    openDelim,
    closeDelim,
    ["code"],
    disallowAmpersandInAttrs,
    (rawInner) => wrapWithMarkdownCodeMark(rawInner)
  )
  normalized = replacePairedFormattingTags(
    normalized,
    openDelim,
    closeDelim,
    ["strong", "b"],
    disallowAmpersandInAttrs,
    "**"
  )
  normalized = replacePairedFormattingTags(
    normalized,
    openDelim,
    closeDelim,
    ["em", "i"],
    disallowAmpersandInAttrs,
    "*"
  )
  return replacePairedFormattingTags(
    normalized,
    openDelim,
    closeDelim,
    ["del", "s"],
    disallowAmpersandInAttrs,
    "~~"
  )
}

const normalizeInlineHtmlChunk = (
  chunk: string,
  hasRawTag: boolean,
  hasEntityTag: boolean
): string => {
  let normalized = chunk
  if (hasRawTag && normalized.includes("<")) {
    normalized = normalizeTagGroup(normalized, "<", ">", false)
    normalized = replaceRawBrTags(normalized, "<br />")
  }
  if (hasEntityTag && normalized.toLowerCase().includes("&lt;")) {
    normalized = normalizeTagGroup(normalized, "&lt;", "&gt;", true)
    normalized = replaceEntityBrTags(normalized, "<br />")
  }
  return normalized
}

export const normalizeLegacyInlineHtmlSpans = (input: string) => {
  if (!input) return input
  const hasRawTag = input.includes("<")
  const hasEntityTag = input.toLowerCase().includes("&lt;")
  if (!hasRawTag && !hasEntityTag) return input

  if (!input.includes("`")) {
    return normalizeInlineHtmlChunk(input, hasRawTag, hasEntityTag)
  }

  let result = ""
  let cursor = 0
  const codeSpanRegex = /(`+)([\s\S]*?)\1/g
  let match = codeSpanRegex.exec(input)
  while (match !== null) {
    const start = match.index
    if (start > cursor) {
      result += normalizeInlineHtmlChunk(input.slice(cursor, start), hasRawTag, hasEntityTag)
    }
    result += match[0]
    cursor = start + match[0].length
    match = codeSpanRegex.exec(input)
  }
  if (cursor < input.length) {
    result += normalizeInlineHtmlChunk(input.slice(cursor), hasRawTag, hasEntityTag)
  }
  return result
}

const stepFenceMarker = (line: string, activeFenceMarker: string): { nextMarker: string; isFenceLine: boolean } => {
  const fenceMatch = FENCE_MARKER_PATTERN.exec(line.trimStart())
  if (!fenceMatch) {
    return { nextMarker: activeFenceMarker, isFenceLine: false }
  }
  const marker = fenceMatch[1] ?? ""
  if (!activeFenceMarker) {
    return { nextMarker: marker, isFenceLine: true }
  }
  if (marker.startsWith(activeFenceMarker[0]!) && marker.length >= activeFenceMarker.length) {
    return { nextMarker: "", isFenceLine: true }
  }
  return { nextMarker: activeFenceMarker, isFenceLine: true }
}

export const normalizeLegacyInlineHtmlMarkdown = (markdown: string) => {
  if (!markdown) return markdown
  const lowerMarkdown = markdown.toLowerCase()
  if (!markdown.includes("<") && !lowerMarkdown.includes("&lt;")) return markdown

  let activeFenceMarker = ""

  return markdown
    .split("\n")
    .map((line) => {
      const hasPotentialHtml = line.includes("<") || line.toLowerCase().includes("&lt;")
      if (!activeFenceMarker && !hasPotentialHtml && !line.includes("`") && !line.includes("~")) {
        return line
      }
      const fenceStep = stepFenceMarker(line, activeFenceMarker)
      activeFenceMarker = fenceStep.nextMarker
      if (fenceStep.isFenceLine || activeFenceMarker) return line
      return normalizeLegacyInlineHtmlSpans(line)
    })
    .join("\n")
}

export const normalizeInlineHtmlInMarkdownTables = (markdown: string) => {
  if (!markdown) return markdown
  if (!markdown.includes("<") && !markdown.toLowerCase().includes("&lt;")) return markdown

  return markdown
    .split("\n")
    .map((line) => {
      if (!line.includes("<") && !line.toLowerCase().includes("&lt;")) return line
      if (!isLikelyTableRow(line) || isTableSeparatorLine(line)) return line
      return normalizeLegacyInlineHtmlSpans(line)
    })
    .join("\n")
}
