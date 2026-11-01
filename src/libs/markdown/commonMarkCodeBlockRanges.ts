import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { resolveCalloutBlockquote, resolveCalloutLegacyEmoji } from "./calloutRegistry"
import {
  hasCommonMarkCodeIndent,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  type MathSpanRange,
} from "./pandocMathScanner"
import {
  ASIDE_TAG_CASE_INSENSITIVE_PATTERN,
  DIRECTIVE_CLOSE_LINE_PATTERN,
  extractAsideOpenTail,
  findDirectiveCloseLineIndex,
  findFirstBlankLineIndex,
  findPromotedCalloutTitleLineIndex,
  hasExcludedAsideCloseOrFenceBeforeBlank,
  isAsideCloseLineExcluded,
  isDedicatedFormulaFenceLine,
  isLineStartInCommentRanges,
  isPromotedCalloutTitleLine,
  isTopLevelFormulaStopLine,
  isValidAsideCloseCandidate,
  maskBlockquoteHeaderLine,
  maskLinesInRange,
  maskLineWithBreakAndHeading,
  maskUnclosedAsideBeforeBlank,
  neutralizeAsideOpenTagPreservingLength,
  parseCustomDirectiveHeader,
  registerCommonMarkBlockRangeProvider,
  stripClosingAsideTag,
  unindentLinePreservingLength,
} from "./renderingDirectiveModel"
import { parseStandaloneMarkdownImageLine } from "./renderingImageModel"

export type CommonMarkBlockRanges = {
  codeBlockRanges: MathSpanRange[]
  commentRanges: MathSpanRange[]
  listRanges: MathSpanRange[]
  asideRanges: MathSpanRange[]
  containerCloseRanges: MathSpanRange[]
}

type CommonMarkAstNode = {
  type: string
  value?: string
  children?: CommonMarkAstNode[]
  position?: {
    start?: { offset?: number }
    end?: { offset?: number }
  }
}

const CALLOUT_DIRECTIVE_OPEN_PATTERN = /^:::callout(?:[ \t\r]|$)/
const SUPPORTED_COLON_DIRECTIVE_PATTERN = /^:::(?:callout|toggle)(?:[ \t\r]|$)/
const LEADING_SPACE_OR_TAB_PATTERN = /^[ \t]/
const BLOCKQUOTE_CALLOUT_TOKEN_PATTERN = /^\[!([A-Za-z0-9_-]+)\]([+-])?/
const MAX_BLOCK_RANGE_CACHE_ENTRIES = 8
const EMPTY_BLOCK_RANGES: CommonMarkBlockRanges = {
  codeBlockRanges: [],
  commentRanges: [],
  listRanges: [],
  asideRanges: [],
  containerCloseRanges: [],
}

const commonMarkProcessor = unified().use(remarkParse).use(remarkGfm).freeze()
const blockRangeCache = new Map<string, CommonMarkBlockRanges>()

const computeLineStarts = (lines: readonly string[]): number[] => {
  let offset = 0
  return lines.map((line) => {
    const start = offset
    offset += line.length + 1
    return start
  })
}

const walkCommonMarkBlockRanges = (
  node: CommonMarkAstNode,
  rawCodeRanges: MathSpanRange[],
  rawCommentRanges: MathSpanRange[],
  rawListRanges: MathSpanRange[]
): void => {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  const hasValidRange = typeof start === "number" && typeof end === "number" && end > start

  if (node.type === "code") {
    if (hasValidRange) rawCodeRanges.push({ from: start, to: end })
    return
  }

  if (
    node.type === "html" &&
    hasValidRange &&
    typeof node.value === "string" &&
    node.value.trimStart().startsWith("<!--")
  ) {
    rawCommentRanges.push({ from: start, to: end })
    return
  }

  if (node.type === "list" && hasValidRange) {
    rawListRanges.push({ from: start, to: end })
  }

  if (!Array.isArray(node.children)) return
  for (const child of node.children) {
    walkCommonMarkBlockRanges(child, rawCodeRanges, rawCommentRanges, rawListRanges)
  }
}

const parseRawCommonMarkRanges = (
  source: string,
  asideRanges: MathSpanRange[] = [],
  containerCloseRanges: MathSpanRange[] = []
): CommonMarkBlockRanges => {
  const tree = commonMarkProcessor.parse(source) as CommonMarkAstNode
  const rawCodeRanges: MathSpanRange[] = []
  const rawCommentRanges: MathSpanRange[] = []
  const rawListRanges: MathSpanRange[] = []
  walkCommonMarkBlockRanges(tree, rawCodeRanges, rawCommentRanges, rawListRanges)
  return {
    codeBlockRanges: mergeSortedSpanRanges(rawCodeRanges),
    commentRanges: mergeSortedSpanRanges(rawCommentRanges),
    listRanges: mergeSortedSpanRanges(rawListRanges),
    asideRanges,
    containerCloseRanges: mergeSortedSpanRanges(containerCloseRanges),
  }
}

const isExcludedTopLevelLine = (
  line: string,
  lineStart: number,
  ranges: CommonMarkBlockRanges
): boolean => {
  const lineEnd = lineStart + Math.max(1, line.length)
  if (overlapsSortedRanges(ranges.codeBlockRanges, lineStart, lineEnd)) return true
  if (isLineStartInCommentRanges(ranges.commentRanges, line, lineStart)) return true
  if (hasCommonMarkCodeIndent(line)) return true
  return LEADING_SPACE_OR_TAB_PATTERN.test(line) && overlapsSortedRanges(ranges.listRanges, lineStart, lineEnd)
}

const isValidBlockquoteCalloutLine = (rawLine: string): boolean => {
  const line = rawLine.trim()
  if (!line) return false
  const tokenMatch = BLOCKQUOTE_CALLOUT_TOKEN_PATTERN.exec(line)
  if (tokenMatch) return Boolean(resolveCalloutBlockquote(tokenMatch[1] ?? ""))
  const unbracketed = line.replace(/^\[([^\s\]]+)\](?=\s|$)/, "$1")
  return Boolean(resolveCalloutLegacyEmoji(unbracketed))
}

const findDedicatedFormulaCloseIndex = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  codeBlockRanges: readonly MathSpanRange[]
): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (isTopLevelFormulaStopLine(line)) return -1
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(codeBlockRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return index
    }
  }
  return -1
}

const findBoundedFormulaCloseInContainer = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  codeRanges: readonly MathSpanRange[],
  isCloseLine: (candidate: string, lineIndex: number) => boolean
): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (isTopLevelFormulaStopLine(line) || isCloseLine(line, index)) return -1
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(codeRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return index
    }
  }
  return -1
}

const isContainerLineExcluded = (
  line: string,
  lineStart: number,
  ranges: CommonMarkBlockRanges,
  isAside: boolean,
  checkingCloseLine: boolean
): boolean => {
  if (isAside && checkingCloseLine) {
    return isAsideCloseLineExcluded(ranges.codeBlockRanges, ranges.commentRanges, line, lineStart)
  }
  const lineEnd = lineStart + Math.max(1, line.length)
  return (
    overlapsSortedRanges(ranges.codeBlockRanges, lineStart, lineEnd) ||
    isLineStartInCommentRanges(ranges.commentRanges, line, lineStart)
  )
}

const resolveContainerCloseWithBoundedFormulas = (
  lines: string[],
  startIndex: number,
  lineStarts: readonly number[],
  isCloseLine: (candidate: string, lineIndex: number) => boolean,
  isAside = false
): number => {
  let ranges = parseRawCommonMarkRanges(lines.join("\n"))
  for (let cursor = startIndex; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]!
    const lineStart = lineStarts[cursor]!
    if (!isContainerLineExcluded(line, lineStart, ranges, isAside, true) && isCloseLine(line, cursor)) {
      return cursor
    }
    if (isContainerLineExcluded(line, lineStart, ranges, isAside, false)) {
      continue
    }
    if (isDedicatedFormulaFenceLine(line)) {
      const formulaClose = findBoundedFormulaCloseInContainer(
        lines,
        cursor,
        lineStarts,
        ranges.codeBlockRanges,
        isCloseLine
      )
      if (formulaClose >= 0) {
        maskLinesInRange(lines, cursor, formulaClose)
        ranges = parseRawCommonMarkRanges(lines.join("\n"))
        cursor = formulaClose
      }
    }
  }
  return -1
}

const isClosingDirectiveLine = (line: string): boolean => DIRECTIVE_CLOSE_LINE_PATTERN.test(line)

const tryMaskAsideBlockAt = (
  lines: string[],
  index: number,
  lineStarts: readonly number[],
  currentRanges: CommonMarkBlockRanges,
  asideRanges: MathSpanRange[],
  containerCloseRanges: MathSpanRange[]
): { nextIndex: number; mutated: boolean } | null => {
  const line = lines[index]!
  const openingTail = extractAsideOpenTail(line)
  if (openingTail === null) return null
  if (stripClosingAsideTag(openingTail) !== null) {
    lines[index] = maskLineWithBreakAndHeading(line)
    return { nextIndex: index + 1, mutated: true }
  }
  const blankIndex = findFirstBlankLineIndex(lines, index + 1)
  const snapshot = lines.slice(index)
  lines[index] = maskLineWithBreakAndHeading(line)
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    lines[cursor] = unindentLinePreservingLength(lines[cursor]!)
  }
  const closeIndex = resolveContainerCloseWithBoundedFormulas(
    lines,
    index + 1,
    lineStarts,
    (candidate, cursor) =>
      isValidAsideCloseCandidate(
        candidate,
        cursor,
        index,
        blankIndex,
        snapshot,
        lineStarts,
        currentRanges.codeBlockRanges
      ),
    true
  )
  if (closeIndex < 0) {
    lines.splice(index, snapshot.length, ...snapshot)
    if (hasExcludedAsideCloseOrFenceBeforeBlank(snapshot.slice(1, blankIndex - index))) {
      maskUnclosedAsideBeforeBlank(lines, index, blankIndex)
    } else {
      lines[index] = neutralizeAsideOpenTagPreservingLength(line)
    }
    return { nextIndex: index + 1, mutated: true }
  }
  const closeStart = lineStarts[closeIndex]!
  const closeEnd = closeStart + Math.max(1, lines[closeIndex]!.length)
  asideRanges.push({ from: lineStarts[index]!, to: closeStart })
  containerCloseRanges.push({ from: closeStart, to: closeEnd })
  lines[closeIndex] = maskLineWithBreakAndHeading(lines[closeIndex]!)
  const afterCloseOffset = closeIndex - index + 1
  if (afterCloseOffset < snapshot.length) {
    lines.splice(
      closeIndex + 1,
      snapshot.length - afterCloseOffset,
      ...snapshot.slice(afterCloseOffset)
    )
  }
  return { nextIndex: closeIndex + 1, mutated: true }
}

const findBlockquoteHeaderAndPromotedIndex = (
  lines: readonly string[],
  startIndex: number
): { cursor: number; headerLineIndex: number; promotedLineIndex: number; firstContent: string } => {
  let cursor = startIndex
  let headerLineIndex = -1
  let promotedLineIndex = -1
  let firstContent = ""
  while (cursor < lines.length && lines[cursor]!.trimStart().startsWith(">")) {
    const afterQuote = lines[cursor]!.replace(/^\s*>\s?/, "")
    const stripped = afterQuote.trim()
    if (stripped) {
      if (headerLineIndex === -1) {
        headerLineIndex = hasCommonMarkCodeIndent(afterQuote) ? -2 : cursor
        firstContent = hasCommonMarkCodeIndent(afterQuote) ? "" : stripped
      } else if (promotedLineIndex === -1) {
        promotedLineIndex =
          !hasCommonMarkCodeIndent(afterQuote) && isPromotedCalloutTitleLine(stripped)
            ? cursor
            : -2
      }
    }
    cursor += 1
  }
  return { cursor, headerLineIndex, promotedLineIndex, firstContent }
}

const shouldMaskBlockquoteTailLine = (
  refreshed: CommonMarkBlockRanges,
  lastLine: string,
  lastLineStart: number
): boolean =>
  !overlapsSortedRanges(
    refreshed.codeBlockRanges,
    lastLineStart,
    lastLineStart + Math.max(1, lastLine.length)
  )

const tryMaskBlockquoteCalloutAt = (
  lines: string[],
  startIndex: number,
  lineStarts: readonly number[]
): { nextIndex: number; mutated: boolean } => {
  const { cursor, headerLineIndex, promotedLineIndex, firstContent } =
    findBlockquoteHeaderAndPromotedIndex(lines, startIndex)
  if (headerLineIndex < 0 || !isValidBlockquoteCalloutLine(firstContent)) {
    return { nextIndex: cursor, mutated: false }
  }
  const lastQuoteIndex = cursor - 1
  const hasFollowingNonBlankLine = cursor < lines.length && lines[cursor]!.trim().length > 0
  if (lastQuoteIndex === headerLineIndex && hasFollowingNonBlankLine) {
    lines[headerLineIndex] = maskLineWithBreakAndHeading(lines[headerLineIndex]!)
    return { nextIndex: cursor, mutated: true }
  }
  lines[headerLineIndex] = maskBlockquoteHeaderLine(lines[headerLineIndex]!)
  if (promotedLineIndex >= 0) {
    lines[promotedLineIndex] = maskBlockquoteHeaderLine(lines[promotedLineIndex]!)
  }
  if (hasFollowingNonBlankLine && lastQuoteIndex > headerLineIndex) {
    const refreshed = parseRawCommonMarkRanges(lines.join("\n"))
    const lastLine = lines[lastQuoteIndex]!
    if (shouldMaskBlockquoteTailLine(refreshed, lastLine, lineStarts[lastQuoteIndex]!)) {
      lines[lastQuoteIndex] = maskLineWithBreakAndHeading(lastLine)
    }
  }
  return { nextIndex: cursor, mutated: true }
}

const recordContainerCloseLine = (
  containerCloseRanges: MathSpanRange[],
  lineStarts: readonly number[],
  lines: readonly string[],
  closeIndex: number
): void => {
  const closeStart = lineStarts[closeIndex]!
  containerCloseRanges.push({
    from: closeStart,
    to: closeStart + Math.max(1, lines[closeIndex]!.length),
  })
}

const tryMaskColonDirectiveAt = (
  lines: string[],
  index: number,
  line: string,
  trimmed: string,
  lineStarts: readonly number[],
  ranges: CommonMarkBlockRanges,
  containerCloseRanges: MathSpanRange[]
): { nextIndex: number; mutated: boolean } | null => {
  if (!line.startsWith(":::")) return null
  if (parseCustomDirectiveHeader(trimmed) !== null) {
    const closeIndex = findDirectiveCloseLineIndex(
      lines,
      index + 1,
      lineStarts,
      ranges.codeBlockRanges,
      ranges.commentRanges
    )
    if (closeIndex >= 0) {
      recordContainerCloseLine(containerCloseRanges, lineStarts, lines, closeIndex)
      maskLinesInRange(lines, index, closeIndex)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }
  if (SUPPORTED_COLON_DIRECTIVE_PATTERN.test(line)) {
    const isCallout = CALLOUT_DIRECTIVE_OPEN_PATTERN.test(line)
    const candidatePromotedIndex = isCallout
      ? findPromotedCalloutTitleLineIndex(lines, index + 1, lines.length)
      : -1
    const snapshot = lines.slice(index)
    lines[index] = maskLineWithBreakAndHeading(line)
    if (candidatePromotedIndex >= 0) {
      lines[candidatePromotedIndex] = maskLineWithBreakAndHeading(lines[candidatePromotedIndex]!)
    }
    const closeIndex = resolveContainerCloseWithBoundedFormulas(
      lines,
      index + 1,
      lineStarts,
      isClosingDirectiveLine
    )
    if (closeIndex < 0) {
      lines.splice(index, snapshot.length, ...snapshot)
      return { nextIndex: index + 1, mutated: false }
    }
    recordContainerCloseLine(containerCloseRanges, lineStarts, lines, closeIndex)
    lines[closeIndex] = maskLineWithBreakAndHeading(lines[closeIndex]!)
    return { nextIndex: closeIndex + 1, mutated: true }
  }
  return null
}

const tryMaskCustomBlockStepAt = (
  lines: string[],
  index: number,
  lineStarts: readonly number[],
  currentRanges: CommonMarkBlockRanges,
  asideRanges: MathSpanRange[],
  containerCloseRanges: MathSpanRange[]
): { nextIndex: number; mutated: boolean } => {
  const line = lines[index]!
  const trimmed = line.trim()
  if (trimmed.startsWith("![") && parseStandaloneMarkdownImageLine(trimmed)) {
    lines[index] = maskLineWithBreakAndHeading(line)
    return { nextIndex: index + 1, mutated: true }
  }
  const colonStep = tryMaskColonDirectiveAt(
    lines,
    index,
    line,
    trimmed,
    lineStarts,
    currentRanges,
    containerCloseRanges
  )
  if (colonStep) return colonStep
  if (isDedicatedFormulaFenceLine(line)) {
    const closeIndex = findDedicatedFormulaCloseIndex(
      lines,
      index,
      lineStarts,
      currentRanges.codeBlockRanges
    )
    if (closeIndex >= 0) {
      maskLinesInRange(lines, index, closeIndex)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }
  if (trimmed.startsWith("<")) {
    const asideStep = tryMaskAsideBlockAt(
      lines,
      index,
      lineStarts,
      currentRanges,
      asideRanges,
      containerCloseRanges
    )
    if (asideStep) return asideStep
  }
  if (trimmed.startsWith(">")) {
    return tryMaskBlockquoteCalloutAt(lines, index, lineStarts)
  }
  return { nextIndex: index + 1, mutated: false }
}

const needsFreshRangesForLine = (line: string): boolean => {
  if (LEADING_SPACE_OR_TAB_PATTERN.test(line)) return true
  const trimmed = line.trimStart()
  return (
    trimmed.startsWith(":::") ||
    trimmed.startsWith("$$") ||
    trimmed.startsWith("<") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith("![")
  )
}

const maskCustomSegmentsForCommonMark = (
  content: string,
  initialRanges: CommonMarkBlockRanges
): CommonMarkBlockRanges => {
  const lines = content.split("\n")
  const lineStarts = computeLineStarts(lines)
  const asideRanges: MathSpanRange[] = []
  const containerCloseRanges: MathSpanRange[] = []
  let currentRanges = initialRanges
  let dirty = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    const lineStart = lineStarts[index]!
    if (dirty && needsFreshRangesForLine(line)) {
      currentRanges = parseRawCommonMarkRanges(lines.join("\n"), asideRanges, containerCloseRanges)
      dirty = false
    }
    if (isExcludedTopLevelLine(line, lineStart, currentRanges)) {
      index += 1
      continue
    }
    const step = tryMaskCustomBlockStepAt(
      lines,
      index,
      lineStarts,
      currentRanges,
      asideRanges,
      containerCloseRanges
    )
    if (step.mutated) dirty = true
    index = step.nextIndex
  }

  return dirty
    ? parseRawCommonMarkRanges(lines.join("\n"), asideRanges, containerCloseRanges)
    : {
        ...currentRanges,
        asideRanges,
        containerCloseRanges: mergeSortedSpanRanges(containerCloseRanges),
      }
}

const hasPotentialCustomSegments = (content: string): boolean =>
  content.includes(":::") ||
  content.includes("$$") ||
  ASIDE_TAG_CASE_INSENSITIVE_PATTERN.test(content) ||
  content.includes("![") ||
  content.includes(">")

export const parseCommonMarkBlockRanges = (content: string): CommonMarkBlockRanges => {
  if (!content) return EMPTY_BLOCK_RANGES
  const cached = blockRangeCache.get(content)
  if (cached) return cached

  const initialRanges = parseRawCommonMarkRanges(content)
  const resolved = hasPotentialCustomSegments(content)
    ? maskCustomSegmentsForCommonMark(content, initialRanges)
    : initialRanges

  if (blockRangeCache.size >= MAX_BLOCK_RANGE_CACHE_ENTRIES) {
    const oldestKey = blockRangeCache.keys().next().value
    if (oldestKey !== undefined) blockRangeCache.delete(oldestKey)
  }
  blockRangeCache.set(content, resolved)
  return resolved
}

export const collectCommonMarkCodeBlockRanges = (content: string): MathSpanRange[] =>
  parseCommonMarkBlockRanges(content).codeBlockRanges

registerCommonMarkBlockRangeProvider(parseCommonMarkBlockRanges)
