import type { CalloutKind, MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { getCallout, resolveCalloutBlockquote, resolveCalloutLegacyEmoji } from "src/libs/markdown/calloutRegistry"
import { parseStandaloneMarkdownImageLine } from "src/libs/markdown/renderingImageModel"
import {
  buildCustomDirectiveSegment,
  collectTripleColonBody,
  parseCardMetadataComment,
  parseCustomDirectiveHeader,
  type PendingDirectiveMetadata,
} from "src/libs/markdown/renderingDirectiveModel"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"

type ParsedCalloutHeader = {
  kind: CalloutKind
  title: string
  emoji: string
  foldable?: boolean
  defaultCollapsed?: boolean
}

const HEADING_TITLE_PATTERN = /^#{1,6}\s+(.+)$/
const PROMOTED_BOLD_PATTERN = /^(?:[-*+]\s+)?(?:\*\*(.+?)\*\*|__(.+?)__)(.*)$/
const FENCE_LINE_PATTERN = /^([`~]{3,})/
const ASIDE_OPEN_LINE_PATTERN = /^\s*<aside(?:\s[^>]*)?>(.*)$/i
const ASIDE_CLOSE_SUFFIX_PATTERN = /<\/aside>\s*$/i

const isAsciiCalloutToken = (token: string): boolean => {
  if (token.length === 0) return false
  for (let index = 0; index < token.length; index += 1) {
    const code = token.codePointAt(index) ?? -1
    const isUpper = code >= 65 && code <= 90
    const isLower = code >= 97 && code <= 122
    const isDigit = code >= 48 && code <= 57
    const isDashOrUnderscore = code === 45 || code === 95
    if (!isUpper && !isLower && !isDigit && !isDashOrUnderscore) {
      return false
    }
  }
  return true
}

export const hasUniformFenceMarker = (
  text: string,
  markerChar: string
): boolean => {
  if (text.length < 3 || markerChar.length === 0) return false
  const expectedCode = markerChar.codePointAt(0) ?? -1
  for (let index = 0; index < text.length; index += 1) {
    if ((text.codePointAt(index) ?? -2) !== expectedCode) {
      return false
    }
  }
  return true
}

const parseBlockquoteCalloutToken = (raw: string) => {
  const line = raw.trim()
  if (!line.startsWith("[!")) return null

  const match = /^\[!([^\]]+)\]([+-])?/.exec(line)
  if (!match) return null

  const token = match[1] || ""
  if (!isAsciiCalloutToken(token)) return null

  const foldModifier = match[2]
  const foldable = foldModifier === "+" || foldModifier === "-"
  const defaultCollapsed = foldModifier === "-"

  return {
    token,
    title: line.slice(match[0].length).trim(),
    foldable,
    defaultCollapsed,
  }
}

const parseCalloutHeader = (raw: string): ParsedCalloutHeader | null => {
  const line = raw.trim()
  if (!line) return null

  const blockquoteToken = parseBlockquoteCalloutToken(line)
  if (blockquoteToken) {
    const blockquoteCallout = resolveCalloutBlockquote(blockquoteToken.token)
    if (!blockquoteCallout) return null
    return {
      kind: blockquoteCallout.kind,
      title: blockquoteToken.title,
      emoji: blockquoteCallout.callout.marker,
      ...(blockquoteToken.foldable
        ? {
            foldable: true,
            defaultCollapsed: blockquoteToken.defaultCollapsed,
          }
        : {}),
    }
  }

  const unbracketed = line.replace(/^\[([^\s\]]+)\](?=\s|$)/, "$1")
  const legacyMatch = resolveCalloutLegacyEmoji(unbracketed)
  if (!legacyMatch) return null
  const inlineTitle = unbracketed.slice(legacyMatch.emoji.length).trim()
  return {
    kind: legacyMatch.kind,
    title: inlineTitle,
    emoji: legacyMatch.callout.marker,
  }
}

const infoCalloutMarker = getCallout("info").marker

const parseAsideCalloutHeader = (raw: string): ParsedCalloutHeader | null => {
  const header = parseCalloutHeader(raw)
  if (header) return header

  const blockquoteToken = parseBlockquoteCalloutToken(raw)
  if (!blockquoteToken) return null
  return {
    kind: "info",
    title: blockquoteToken.title,
    emoji: infoCalloutMarker,
    ...(blockquoteToken.foldable
      ? {
          foldable: true,
          defaultCollapsed: blockquoteToken.defaultCollapsed,
        }
      : {}),
  }
}

const extractPromotedCalloutTitle = (bodyLines: string[]) => {
  const firstBodyLineIndex = bodyLines.findIndex((row) => row.trim().length > 0)
  if (firstBodyLineIndex < 0) {
    return { title: "", bodyLines }
  }

  const trimmedLine = bodyLines[firstBodyLineIndex].trim()
  const headingMatch = HEADING_TITLE_PATTERN.exec(trimmedLine)
  if (headingMatch) {
    return {
      title: headingMatch[1]?.trim() || "",
      bodyLines: bodyLines.filter((_, index) => index !== firstBodyLineIndex),
    }
  }

  const boldMatch = PROMOTED_BOLD_PATTERN.exec(trimmedLine)
  const promotedTitle = (boldMatch?.[1] || boldMatch?.[2] || "").trim()
  const remainingLine = (boldMatch?.[3] || "").trim()
  if (!promotedTitle || remainingLine.length > 0) {
    return { title: "", bodyLines }
  }

  return {
    title: promotedTitle,
    bodyLines: bodyLines.filter((_, index) => index !== firstBodyLineIndex),
  }
}

const buildCalloutSegment = (
  header: ParsedCalloutHeader,
  bodyLines: string[]
): MarkdownSegment => {
  const promoted = extractPromotedCalloutTitle(bodyLines)
  const resolvedTitle = promoted.title || header.title

  return {
    type: "callout",
    kind: header.kind,
    title: resolvedTitle,
    emoji: header.emoji,
    content: promoted.bodyLines.join("\n").trim(),
    ...(header.foldable
      ? {
          foldable: true,
          defaultCollapsed: Boolean(header.defaultCollapsed),
        }
      : {}),
  }
}

const parseFenceMarker = (line: string): "`" | "~" | null => {
  const match = FENCE_LINE_PATTERN.exec(line.trim())
  if (!match) return null

  const fence = match[1]
  const marker = fence[0] as "`" | "~"
  return hasUniformFenceMarker(fence, marker) ? marker : null
}

const resolveDirectiveCalloutHeader = (rawHeader: string): ParsedCalloutHeader => {
  const parsed = parseCalloutHeader(rawHeader)
  if (parsed) return parsed
  const firstSpace = rawHeader.search(/\s/)
  const firstToken = firstSpace === -1 ? rawHeader : rawHeader.slice(0, firstSpace)
  const restTitle = firstSpace === -1 ? "" : rawHeader.slice(firstSpace).trim()
  const tokenCallout = firstToken ? resolveCalloutBlockquote(firstToken) : null
  if (tokenCallout) {
    return {
      kind: tokenCallout.kind,
      title: restTitle,
      emoji: tokenCallout.callout.marker,
    }
  }
  return {
    kind: "info",
    title: rawHeader,
    emoji: infoCalloutMarker,
  }
}

const tryParseAsideBlock = (
  lines: readonly string[],
  startIndex: number
): { nextIndex: number; segment: MarkdownSegment | null; fallbackLines: string[] } | null => {
  const line = lines[startIndex]
  const openingMatch = ASIDE_OPEN_LINE_PATTERN.exec(line)
  if (!openingMatch) return null

  const originalLines = [line]
  const bodyLines: string[] = []
  let closed = false
  let nextIndex = startIndex

  const appendContent = (value: string) => {
    if (value.length > 0) bodyLines.push(value)
  }

  const openingTail = openingMatch[1] ?? ""
  if (ASIDE_CLOSE_SUFFIX_PATTERN.test(openingTail)) {
    appendContent(openingTail.replace(ASIDE_CLOSE_SUFFIX_PATTERN, "").trimEnd())
    closed = true
  } else {
    appendContent(openingTail)
  }

  let cursor = startIndex + 1
  while (!closed && cursor < lines.length) {
    const currentLine = lines[cursor]
    originalLines.push(currentLine)
    if (ASIDE_CLOSE_SUFFIX_PATTERN.test(currentLine)) {
      appendContent(currentLine.replace(ASIDE_CLOSE_SUFFIX_PATTERN, "").trimEnd())
      closed = true
      nextIndex = cursor
      break
    }
    bodyLines.push(currentLine)
    cursor += 1
  }

  if (!closed) {
    return { nextIndex: startIndex + 1, segment: null, fallbackLines: originalLines }
  }

  const normalizedBodyLines = bodyLines.map((row) => row.trim())
  const firstContentIndex = normalizedBodyLines.findIndex((row) => row.length > 0)
  const header =
    firstContentIndex >= 0 ? parseAsideCalloutHeader(normalizedBodyLines[firstContentIndex]) : null
  const segment: MarkdownSegment = header
    ? buildCalloutSegment(header, normalizedBodyLines.slice(firstContentIndex + 1))
    : {
        type: "callout",
        kind: "info",
        title: "",
        emoji: infoCalloutMarker,
        content: normalizedBodyLines.join("\n").trim(),
      }
  return { nextIndex: nextIndex + 1, segment, fallbackLines: [] }
}

const tryParseFormulaBlock = (
  lines: readonly string[],
  startIndex: number
): { closedIndex: number; formula: string; bodyLines: string[] } => {
  const bodyLines: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "$$") {
      return { closedIndex: index, formula: bodyLines.join("\n").trim(), bodyLines }
    }
    bodyLines.push(lines[index])
  }
  return { closedIndex: -1, formula: "", bodyLines }
}

const consumeBlockquoteCalloutOrLines = (
  lines: readonly string[],
  startIndex: number
): { nextIndex: number; calloutSegment: MarkdownSegment | null; rawBlock: string } => {
  const quoteLines: string[] = []
  let cursor = startIndex
  while (cursor < lines.length && lines[cursor].trimStart().startsWith(">")) {
    quoteLines.push(lines[cursor].replace(/^\s*>\s?/, ""))
    cursor += 1
  }
  const firstContentIndex = quoteLines.findIndex((row) => row.trim().length > 0)
  if (firstContentIndex >= 0) {
    const header = parseCalloutHeader(quoteLines[firstContentIndex].trim())
    if (header) {
      return {
        nextIndex: cursor,
        calloutSegment: buildCalloutSegment(header, quoteLines.slice(firstContentIndex + 1)),
        rawBlock: "",
      }
    }
  }
  return {
    nextIndex: cursor,
    calloutSegment: null,
    rawBlock: lines.slice(startIndex, cursor).join("\n"),
  }
}

type SegmentLineStepResult = {
  nextIndex: number
  nextPendingMeta: PendingDirectiveMetadata | null
}

const tryConsumeStructuredBlockAt = (
  lines: readonly string[],
  index: number,
  pendingDirectiveMetadata: PendingDirectiveMetadata | null,
  flushAndPush: (segment: MarkdownSegment) => void,
  markdownBuffer: string[]
): SegmentLineStepResult | null => {
  const line = lines[index]
  const trimmed = line.trim()
  const firstCode = trimmed.codePointAt(0)

  if (firstCode === 33) {
    const standaloneImage = parseStandaloneMarkdownImageLine(trimmed)
    if (standaloneImage) {
      flushAndPush({ type: "image", ...standaloneImage })
      return { nextIndex: index + 1, nextPendingMeta: null }
    }
  }

  const customDirective = firstCode === 58 ? parseCustomDirectiveHeader(trimmed) : null
  if (customDirective) {
    const { closedIndex, bodyLines } = collectTripleColonBody(lines, index + 1)
    if (closedIndex >= 0) {
      const metadata =
        pendingDirectiveMetadata?.kind === customDirective.directive
          ? pendingDirectiveMetadata.attrs
          : {}
      flushAndPush(
        buildCustomDirectiveSegment(
          customDirective.directive,
          normalizeSafeMarkdownUrl(customDirective.rawUrl),
          customDirective.inlineTitle,
          bodyLines,
          metadata
        )
      )
      return { nextIndex: closedIndex + 1, nextPendingMeta: null }
    }
    markdownBuffer.push(line, ...bodyLines)
    return { nextIndex: index + 1, nextPendingMeta: null }
  }

  if (trimmed === "$$") {
    const formulaResult = tryParseFormulaBlock(lines, index)
    if (formulaResult.closedIndex >= 0) {
      flushAndPush({ type: "formula", formula: formulaResult.formula })
      return { nextIndex: formulaResult.closedIndex + 1, nextPendingMeta: null }
    }
    markdownBuffer.push(line, ...formulaResult.bodyLines)
    return { nextIndex: index + 1, nextPendingMeta: null }
  }

  if (line.startsWith(":::callout")) {
    const rawHeader = line.slice(":::callout".length).trim()
    const { closedIndex, bodyLines } = collectTripleColonBody(lines, index + 1)
    if (closedIndex >= 0) {
      flushAndPush(buildCalloutSegment(resolveDirectiveCalloutHeader(rawHeader), bodyLines))
      return { nextIndex: closedIndex + 1, nextPendingMeta: null }
    }
    markdownBuffer.push(line, ...bodyLines)
    return { nextIndex: index + 1, nextPendingMeta: null }
  }

  if (line.startsWith(":::toggle")) {
    const title = line.slice(":::toggle".length).trim() || "토글"
    const { closedIndex, bodyLines } = collectTripleColonBody(lines, index + 1)
    if (closedIndex >= 0) {
      flushAndPush({ type: "toggle", title, content: bodyLines.join("\n").trim() })
      return { nextIndex: closedIndex + 1, nextPendingMeta: null }
    }
    markdownBuffer.push(line, ...bodyLines)
    return { nextIndex: index + 1, nextPendingMeta: null }
  }

  if (firstCode === 62) {
    const quoteStep = consumeBlockquoteCalloutOrLines(lines, index)
    if (quoteStep.calloutSegment) {
      flushAndPush(quoteStep.calloutSegment)
    } else {
      markdownBuffer.push(quoteStep.rawBlock)
    }
    return { nextIndex: quoteStep.nextIndex, nextPendingMeta: null }
  }

  if (firstCode === 60) {
    const asideStep = tryParseAsideBlock(lines, index)
    if (asideStep) {
      if (asideStep.segment) {
        flushAndPush(asideStep.segment)
      } else {
        markdownBuffer.push(asideStep.fallbackLines.join("\n"))
      }
      return { nextIndex: asideStep.nextIndex, nextPendingMeta: null }
    }
  }

  return null
}

export const parseMarkdownSegments = (content: string): MarkdownSegment[] => {
  const lines = content.split("\n")
  const segments: MarkdownSegment[] = []
  let markdownBuffer: string[] = []
  let activeFenceMarker: "`" | "~" | null = null
  let pendingDirectiveMetadata: PendingDirectiveMetadata | null = null

  const flushMarkdown = () => {
    const text = markdownBuffer.join("\n").trim()
    if (text) segments.push({ type: "markdown", content: text })
    markdownBuffer = []
  }

  const flushAndPush = (segment: MarkdownSegment) => {
    flushMarkdown()
    segments.push(segment)
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    const firstCode = trimmed.codePointAt(0)
    const fenceMarker =
      firstCode === 96 || firstCode === 126 ? parseFenceMarker(trimmed) : null

    if (activeFenceMarker) {
      markdownBuffer.push(line)
      if (fenceMarker === activeFenceMarker) activeFenceMarker = null
      index += 1
      continue
    }

    if (fenceMarker) {
      markdownBuffer.push(line)
      activeFenceMarker = fenceMarker
      index += 1
      continue
    }

    const metadataComment = firstCode === 60 ? parseCardMetadataComment(trimmed) : null
    if (metadataComment) {
      pendingDirectiveMetadata = metadataComment
      index += 1
      continue
    }

    const structuredStep = tryConsumeStructuredBlockAt(
      lines,
      index,
      pendingDirectiveMetadata,
      flushAndPush,
      markdownBuffer
    )
    pendingDirectiveMetadata = null
    if (structuredStep) {
      index = structuredStep.nextIndex
      continue
    }

    markdownBuffer.push(line)
    index += 1
  }

  flushMarkdown()
  return segments
}
