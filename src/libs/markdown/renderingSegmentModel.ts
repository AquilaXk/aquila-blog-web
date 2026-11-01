import type { CalloutKind, MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { getCallout, resolveCalloutBlockquote, resolveCalloutLegacyEmoji } from "src/libs/markdown/calloutRegistry"
import { parseCommonMarkBlockRanges } from "src/libs/markdown/commonMarkCodeBlockRanges"
import { parseStandaloneMarkdownImageLine } from "src/libs/markdown/renderingImageModel"
import {
  buildCustomDirectiveSegment,
  collectTripleColonBody,
  extractAsideOpenTail,
  extractPromotedCalloutTitle,
  isAsideCloseLineExcluded,
  isDedicatedFormulaFenceLine,
  isLineStartInCommentRanges,
  isTopLevelFormulaStopLine,
  parseCardMetadataComment,
  parseCustomDirectiveHeader,
  stripClosingAsideTag,
  type PendingDirectiveMetadata,
} from "src/libs/markdown/renderingDirectiveModel"
import {
  hasCommonMarkCodeIndent,
  overlapsSortedRanges,
  type MathSpanRange,
} from "src/libs/markdown/pandocMathScanner"
import { trimMarkdownPreservingCodeIndent } from "src/libs/markdown/renderingNormalizeModel"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"

type ParsedCalloutHeader = {
  kind: CalloutKind
  title: string
  emoji: string
  foldable?: boolean
  defaultCollapsed?: boolean
}

const CALLOUT_DIRECTIVE_OPEN_PATTERN = /^:::callout(?:[ \t\r]|$)/
const TOGGLE_DIRECTIVE_OPEN_PATTERN = /^:::toggle(?:[ \t\r]|$)/
const LEADING_SPACE_OR_TAB_PATTERN = /^[ \t]/

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
    content: trimMarkdownPreservingCodeIndent(promoted.bodyLines.join("\n")),
    ...(header.foldable
      ? {
          foldable: true,
          defaultCollapsed: Boolean(header.defaultCollapsed),
        }
      : {}),
  }
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

const scanAsideClosingLines = (
  lines: readonly string[],
  startIndex: number,
  bodyLines: string[],
  lineStarts: readonly number[],
  codeBlockRanges: readonly MathSpanRange[],
  commentRanges: readonly MathSpanRange[]
): { closedIndex: number; bodyLines: string[] } | null => {
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    const currentLine = lines[cursor]!
    const lineStart = lineStarts[cursor]!
    const inExcluded = isAsideCloseLineExcluded(
      codeBlockRanges,
      commentRanges,
      currentLine,
      lineStart
    )
    const closedLine = inExcluded ? null : stripClosingAsideTag(currentLine)
    if (closedLine !== null) {
      if (closedLine.length > 0) bodyLines.push(closedLine)
      return { closedIndex: cursor, bodyLines }
    }
    bodyLines.push(currentLine)
  }
  return null
}

const collectAsideBodyLines = (
  lines: readonly string[],
  startIndex: number,
  openingTail: string,
  lineStarts: readonly number[],
  codeBlockRanges: readonly MathSpanRange[],
  commentRanges: readonly MathSpanRange[]
): { closedIndex: number; bodyLines: string[] } | null => {
  const inlineClosed = stripClosingAsideTag(openingTail)
  if (inlineClosed !== null) {
    return { closedIndex: startIndex, bodyLines: inlineClosed.length > 0 ? [inlineClosed] : [] }
  }
  const bodyLines = openingTail.length > 0 ? [openingTail] : []
  return scanAsideClosingLines(
    lines,
    startIndex,
    bodyLines,
    lineStarts,
    codeBlockRanges,
    commentRanges
  )
}

const tryParseAsideBlock = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  codeBlockRanges: readonly MathSpanRange[],
  commentRanges: readonly MathSpanRange[]
): { nextIndex: number; segment: MarkdownSegment | null; fallbackLines: string[] } | null => {
  const line = lines[startIndex]!
  const openingTail = extractAsideOpenTail(line)
  if (openingTail === null) return null

  const collected = collectAsideBodyLines(
    lines,
    startIndex,
    openingTail,
    lineStarts,
    codeBlockRanges,
    commentRanges
  )
  if (!collected) {
    return { nextIndex: startIndex + 1, segment: null, fallbackLines: [line] }
  }

  const normalizedBodyLines = collected.bodyLines.map((row) => row.trim())
  const firstContentIndex = normalizedBodyLines.findIndex((row) => row.length > 0)
  const header =
    firstContentIndex >= 0 ? parseAsideCalloutHeader(normalizedBodyLines[firstContentIndex]!) : null
  const segment: MarkdownSegment = header
    ? buildCalloutSegment(header, normalizedBodyLines.slice(firstContentIndex + 1))
    : {
        type: "callout",
        kind: "info",
        title: "",
        emoji: infoCalloutMarker,
        content: normalizedBodyLines.join("\n").trim(),
      }
  return { nextIndex: collected.closedIndex + 1, segment, fallbackLines: [] }
}

const tryParseFormulaBlock = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  excludedRanges: readonly MathSpanRange[]
): { closedIndex: number; formula: string } => {
  const bodyLines: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (isTopLevelFormulaStopLine(line)) return { closedIndex: -1, formula: "" }
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(excludedRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return { closedIndex: index, formula: bodyLines.join("\n").trim() }
    }
    bodyLines.push(line)
  }
  return { closedIndex: -1, formula: "" }
}

const consumeBlockquoteCalloutOrLines = (
  lines: readonly string[],
  startIndex: number
): { nextIndex: number; calloutSegment: MarkdownSegment | null; rawBlock: string } => {
  const quoteLines: string[] = []
  let cursor = startIndex
  while (cursor < lines.length && lines[cursor]!.trimStart().startsWith(">")) {
    quoteLines.push(lines[cursor]!.replace(/^\s*>\s?/, ""))
    cursor += 1
  }
  const firstContentIndex = quoteLines.findIndex((row) => row.trim().length > 0)
  if (firstContentIndex >= 0 && !hasCommonMarkCodeIndent(quoteLines[firstContentIndex]!)) {
    const header = parseCalloutHeader(quoteLines[firstContentIndex]!.trim())
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

type SegmentLineStepResult = { nextIndex: number }

type SegmentConsumerContext = {
  lines: readonly string[]
  lineStarts: readonly number[]
  codeBlockRanges: readonly MathSpanRange[]
  commentRanges: readonly MathSpanRange[]
  pendingDirectiveMetadata: PendingDirectiveMetadata | null
  flushAndPush: (segment: MarkdownSegment) => void
  markdownBuffer: string[]
}

const tryConsumeImageLine = (
  trimmed: string,
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult | null => {
  const standaloneImage = parseStandaloneMarkdownImageLine(trimmed)
  if (!standaloneImage) return null
  ctx.flushAndPush({ type: "image", ...standaloneImage })
  return { nextIndex: index + 1 }
}

const tryConsumeCustomDirectiveAt = (
  line: string,
  trimmed: string,
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult | null => {
  if (!line.startsWith(":::")) return null
  const customDirective = parseCustomDirectiveHeader(trimmed)
  if (!customDirective) return null
  const { closedIndex, bodyLines } = collectTripleColonBody(
    ctx.lines,
    index + 1,
    ctx.lineStarts,
    ctx.codeBlockRanges,
    ctx.commentRanges
  )
  if (closedIndex >= 0) {
    const metadata =
      ctx.pendingDirectiveMetadata?.kind === customDirective.directive
        ? ctx.pendingDirectiveMetadata.attrs
        : {}
    ctx.flushAndPush(
      buildCustomDirectiveSegment(
        customDirective.directive,
        normalizeSafeMarkdownUrl(customDirective.rawUrl),
        customDirective.inlineTitle,
        bodyLines,
        metadata
      )
    )
    return { nextIndex: closedIndex + 1 }
  }
  ctx.markdownBuffer.push(line)
  return { nextIndex: index + 1 }
}

const tryConsumeColonBlockAt = (
  line: string,
  trimmed: string,
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult | null => {
  const customStep = tryConsumeCustomDirectiveAt(line, trimmed, index, ctx)
  if (customStep) return customStep
  if (CALLOUT_DIRECTIVE_OPEN_PATTERN.test(line)) {
    const rawHeader = line.slice(":::callout".length).trim()
    const { closedIndex, bodyLines } = collectTripleColonBody(
      ctx.lines,
      index + 1,
      ctx.lineStarts,
      ctx.codeBlockRanges, ctx.commentRanges
    )
    if (closedIndex >= 0) {
      ctx.flushAndPush(buildCalloutSegment(resolveDirectiveCalloutHeader(rawHeader), bodyLines))
      return { nextIndex: closedIndex + 1 }
    }
    ctx.markdownBuffer.push(line)
    return { nextIndex: index + 1 }
  }
  if (TOGGLE_DIRECTIVE_OPEN_PATTERN.test(line)) {
    const title = line.slice(":::toggle".length).trim() || "토글"
    const { closedIndex, bodyLines } = collectTripleColonBody(
      ctx.lines,
      index + 1,
      ctx.lineStarts,
      ctx.codeBlockRanges, ctx.commentRanges
    )
    if (closedIndex >= 0) {
      ctx.flushAndPush({
        type: "toggle",
        title,
        content: trimMarkdownPreservingCodeIndent(bodyLines.join("\n")),
      })
      return { nextIndex: closedIndex + 1 }
    }
    ctx.markdownBuffer.push(line)
    return { nextIndex: index + 1 }
  }
  return null
}

const tryConsumeFormulaBlockAt = (
  line: string,
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult => {
  const formulaResult = tryParseFormulaBlock(
    ctx.lines,
    index,
    ctx.lineStarts,
    ctx.codeBlockRanges
  )
  if (formulaResult.closedIndex >= 0) {
    ctx.flushAndPush({ type: "formula", formula: formulaResult.formula })
    return { nextIndex: formulaResult.closedIndex + 1 }
  }
  ctx.markdownBuffer.push(line)
  return { nextIndex: index + 1 }
}

const tryConsumeBlockquoteAt = (index: number, ctx: SegmentConsumerContext): SegmentLineStepResult => {
  const quoteStep = consumeBlockquoteCalloutOrLines(ctx.lines, index)
  if (quoteStep.calloutSegment) ctx.flushAndPush(quoteStep.calloutSegment)
  else ctx.markdownBuffer.push(quoteStep.rawBlock)
  return { nextIndex: quoteStep.nextIndex }
}

const tryConsumeAsideAt = (
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult | null => {
  const asideStep = tryParseAsideBlock(
    ctx.lines,
    index,
    ctx.lineStarts,
    ctx.codeBlockRanges,
    ctx.commentRanges
  )
  if (!asideStep) return null
  if (asideStep.segment) ctx.flushAndPush(asideStep.segment)
  else ctx.markdownBuffer.push(asideStep.fallbackLines.join("\n"))
  return { nextIndex: asideStep.nextIndex }
}

const tryConsumeStructuredBlockAt = (
  index: number,
  ctx: SegmentConsumerContext
): SegmentLineStepResult | null => {
  const line = ctx.lines[index]!
  const trimmed = line.trim()
  const firstCode = trimmed.codePointAt(0)
  if (firstCode === 33) return tryConsumeImageLine(trimmed, index, ctx)
  if (firstCode === 58) return tryConsumeColonBlockAt(line, trimmed, index, ctx)
  if (isDedicatedFormulaFenceLine(line)) return tryConsumeFormulaBlockAt(line, index, ctx)
  if (firstCode === 62) return tryConsumeBlockquoteAt(index, ctx)
  if (firstCode === 60) return tryConsumeAsideAt(index, ctx)
  return null
}

export const parseMarkdownSegments = (content: string): MarkdownSegment[] => {
  const lines = content.split("\n")
  const { codeBlockRanges, commentRanges, listRanges } =
    parseCommonMarkBlockRanges(content)
  let nextLineStart = 0
  const lineStarts = lines.map((entry) => {
    const start = nextLineStart
    nextLineStart += entry.length + 1
    return start
  })
  const segments: MarkdownSegment[] = []
  const markdownBuffer: string[] = []
  let pendingDirectiveMetadata: PendingDirectiveMetadata | null = null

  const flushMarkdown = () => {
    const text = trimMarkdownPreservingCodeIndent(markdownBuffer.join("\n"))
    if (text) segments.push({ type: "markdown", content: text })
    markdownBuffer.length = 0
  }

  const flushAndPush = (segment: MarkdownSegment) => {
    flushMarkdown()
    segments.push(segment)
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    const lineStart = lineStarts[index]!
    const lineEnd = lineStart + Math.max(1, line.length)
    if (
      overlapsSortedRanges(codeBlockRanges, lineStart, lineEnd) ||
      hasCommonMarkCodeIndent(line) ||
      (LEADING_SPACE_OR_TAB_PATTERN.test(line) &&
        overlapsSortedRanges(listRanges, lineStart, lineEnd))
    ) {
      pendingDirectiveMetadata = null
      markdownBuffer.push(line)
      index += 1
      continue
    }
    const trimmed = line.trim()
    const firstCode = trimmed.codePointAt(0)

    const metadataComment = firstCode === 60 ? parseCardMetadataComment(trimmed) : null
    if (metadataComment) {
      pendingDirectiveMetadata = metadataComment
      index += 1
      continue
    }
    if (isLineStartInCommentRanges(commentRanges, line, lineStart)) {
      pendingDirectiveMetadata = null
      markdownBuffer.push(line)
      index += 1
      continue
    }

    const structuredStep = tryConsumeStructuredBlockAt(index, {
      lines,
      lineStarts,
      codeBlockRanges,
      commentRanges,
      pendingDirectiveMetadata,
      flushAndPush,
      markdownBuffer,
    })
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
