import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { resolveCalloutBlockquote, resolveCalloutLegacyEmoji } from "./calloutRegistry"
import {
  findBoundedFormulaCloseInContainer,
  findDedicatedFormulaCloseIndex,
  isContainerLineExcluded,
  LINE_BIT_CONTAINER,
  LINE_BIT_MATH,
  markMaskRangeBits,
  scanMaskedLineBitmaskRanges,
} from "./commonMarkLineMaskScanner"
import {
  hasCommonMarkCodeIndent,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  type MathSpanRange,
} from "./pandocMathScanner"
import {
  ASIDE_TAG_CASE_INSENSITIVE_PATTERN,
  extractAsideOpenTail,
  findBlockquoteHeaderAndPromotedIndex,
  findDirectiveCloseLineIndex,
  findFirstBlankLineIndex,
  findPromotedCalloutTitleLineIndex,
  hasExcludedAsideCloseOrFenceBeforeBlank,
  isDedicatedFormulaFenceLine,
  isLineStartInCommentRanges,
  isValidAsideCloseCandidate,
  maskBlockquoteHeaderLine,
  maskLinesInRange,
  maskLineWithBreakAndHeading,
  neutralizeAsideOpenTagPreservingLength,
  registerCommonMarkBlockRangeProvider,
  stripClosingAsideTag,
  unindentLinePreservingLength,
} from "./renderingDirectiveModel"
import { parseStandaloneMarkdownImageLine } from "./renderingImageModel"
import {
  parseCustomDirectiveFromOpening,
  parseOpeningDirectiveLine,
  resolveClosingDirectiveFenceLength,
} from "./sharedDirectiveContainerParser"

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
  containerCloseRanges: MathSpanRange[] = [],
  extraCodeRanges: MathSpanRange[] = []
): CommonMarkBlockRanges => {
  const tree = commonMarkProcessor.parse(source) as CommonMarkAstNode
  const rawCodeRanges: MathSpanRange[] = [...extraCodeRanges]
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

type MaskPipelineState = {
  lines: string[]
  lineStarts: readonly number[]
  lineMasks: Uint8Array
  initialListRanges: readonly MathSpanRange[]
  asideRanges: MathSpanRange[]
  containerCloseRanges: MathSpanRange[]
  extraCodeRanges: MathSpanRange[]
}

const refreshPipelineRanges = (state: MaskPipelineState): CommonMarkBlockRanges =>
  scanMaskedLineBitmaskRanges(state)

const resolveContainerCloseWithBoundedFormulas = (
  state: MaskPipelineState,
  startIndex: number,
  isCloseLine: (candidate: string, lineIndex: number) => boolean,
  isAside = false,
  initialDirectiveFenceLength?: number
): number => {
  const { lines, lineStarts, lineMasks } = state
  let ranges = refreshPipelineRanges(state)
  let cursor = startIndex
  const fenceStack =
    initialDirectiveFenceLength !== undefined ? [Math.max(3, initialDirectiveFenceLength)] : null
  while (cursor < lines.length) {
    const line = lines[cursor]!
    const lineStart = lineStarts[cursor]!
    if (!isContainerLineExcluded(line, lineStart, ranges, isAside, true)) {
      if (fenceStack) {
        const closeLen = resolveClosingDirectiveFenceLength(line)
        if (closeLen >= 3) {
          while (fenceStack.length > 0 && closeLen >= fenceStack[fenceStack.length - 1]!) {
            fenceStack.pop()
            if (fenceStack.length === 0) return cursor
          }
          cursor += 1
          continue
        }
        const nestedOpen = parseOpeningDirectiveLine(line)
        const topFence = fenceStack[fenceStack.length - 1] ?? 3
        if (nestedOpen && nestedOpen.fenceLength < topFence) {
          fenceStack.push(nestedOpen.fenceLength)
        }
      } else if (isCloseLine(line, cursor)) {
        return cursor
      }
    }
    if (!isContainerLineExcluded(line, lineStart, ranges, isAside, false) && isDedicatedFormulaFenceLine(line)) {
      const topFence = fenceStack ? (fenceStack[fenceStack.length - 1] ?? 3) : 0
      const formulaBoundaryClose = fenceStack
        ? (candidate: string) => resolveClosingDirectiveFenceLength(candidate) >= topFence
        : isCloseLine
      const formulaClose = findBoundedFormulaCloseInContainer(
        lines,
        cursor,
        lineStarts,
        ranges.codeBlockRanges,
        formulaBoundaryClose
      )
      if (formulaClose >= 0) {
        maskLinesInRange(lines, cursor, formulaClose)
        markMaskRangeBits(lineMasks, cursor, formulaClose, LINE_BIT_MATH)
        ranges = refreshPipelineRanges(state)
        cursor = formulaClose + 1
        continue
      }
    }
    cursor += 1
  }
  return -1
}

const tryMaskAsideBlockAt = (
  state: MaskPipelineState,
  index: number,
  currentRanges: CommonMarkBlockRanges
): { nextIndex: number; mutated: boolean } | null => {
  const { lines, lineStarts, lineMasks, asideRanges, containerCloseRanges, extraCodeRanges } = state
  const line = lines[index]!
  const openingTail = extractAsideOpenTail(line)
  if (openingTail === null) return null
  if (stripClosingAsideTag(openingTail) !== null) {
    lines[index] = maskLineWithBreakAndHeading(line)
    lineMasks[index]! |= LINE_BIT_CONTAINER
    return { nextIndex: index + 1, mutated: true }
  }
  const blankIndex = findFirstBlankLineIndex(lines, index + 1)
  const snapshot = lines.slice(index)
  lines[index] = maskLineWithBreakAndHeading(line)
  lineMasks[index]! |= LINE_BIT_CONTAINER
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    lines[cursor] = unindentLinePreservingLength(lines[cursor]!)
  }
  const closeIndex = resolveContainerCloseWithBoundedFormulas(
    state,
    index + 1,
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
      const lastPreBlank = blankIndex - 1
      extraCodeRanges.push({
        from: lineStarts[index]!,
        to: lineStarts[lastPreBlank]! + Math.max(1, lines[lastPreBlank]!.length),
      })
      maskLinesInRange(lines, index, lastPreBlank)
      markMaskRangeBits(lineMasks, index, lastPreBlank, LINE_BIT_CONTAINER)
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
  lineMasks[closeIndex]! |= LINE_BIT_CONTAINER
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
  state: MaskPipelineState,
  startIndex: number
): { nextIndex: number; mutated: boolean } => {
  const { lines, lineStarts, lineMasks } = state
  const { cursor, headerLineIndex, promotedLineIndex, firstContent } =
    findBlockquoteHeaderAndPromotedIndex(lines, startIndex)
  if (headerLineIndex < 0 || !isValidBlockquoteCalloutLine(firstContent)) {
    return { nextIndex: cursor, mutated: false }
  }
  const lastQuoteIndex = cursor - 1
  const hasFollowingNonBlankLine = cursor < lines.length && lines[cursor]!.trim().length > 0
  if (lastQuoteIndex === headerLineIndex && hasFollowingNonBlankLine) {
    lines[headerLineIndex] = maskLineWithBreakAndHeading(lines[headerLineIndex]!)
    lineMasks[headerLineIndex]! |= LINE_BIT_CONTAINER
    return { nextIndex: cursor, mutated: true }
  }
  lines[headerLineIndex] = maskBlockquoteHeaderLine(lines[headerLineIndex]!)
  lineMasks[headerLineIndex]! |= LINE_BIT_CONTAINER
  if (promotedLineIndex >= 0) {
    lines[promotedLineIndex] = maskBlockquoteHeaderLine(lines[promotedLineIndex]!)
    lineMasks[promotedLineIndex]! |= LINE_BIT_CONTAINER
  }
  if (hasFollowingNonBlankLine && lastQuoteIndex > headerLineIndex) {
    const refreshed = refreshPipelineRanges(state)
    const lastLine = lines[lastQuoteIndex]!
    if (shouldMaskBlockquoteTailLine(refreshed, lastLine, lineStarts[lastQuoteIndex]!)) {
      lines[lastQuoteIndex] = maskLineWithBreakAndHeading(lastLine)
      lineMasks[lastQuoteIndex]! |= LINE_BIT_CONTAINER
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
  state: MaskPipelineState,
  index: number,
  line: string,
  ranges: CommonMarkBlockRanges
): { nextIndex: number; mutated: boolean } | null => {
  if (!line.startsWith(":::")) return null
  const open = parseOpeningDirectiveLine(line)
  if (!open) return null
  const { lines, lineStarts, lineMasks, containerCloseRanges } = state

  if (parseCustomDirectiveFromOpening(open) !== null) {
    const closeIndex = findDirectiveCloseLineIndex(
      lines,
      index + 1,
      lineStarts,
      ranges.codeBlockRanges,
      ranges.commentRanges,
      open.fenceLength
    )
    if (closeIndex >= 0) {
      recordContainerCloseLine(containerCloseRanges, lineStarts, lines, closeIndex)
      maskLinesInRange(lines, index, closeIndex)
      markMaskRangeBits(lineMasks, index, closeIndex, LINE_BIT_CONTAINER)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }

  if (open.kind === "callout" || open.kind === "toggle") {
    const candidatePromotedIndex =
      open.kind === "callout" && !open.quotedTitle
        ? findPromotedCalloutTitleLineIndex(lines, index + 1, lines.length)
        : -1
    const snapshot = lines.slice(index)
    lines[index] = maskLineWithBreakAndHeading(line)
    lineMasks[index]! |= LINE_BIT_CONTAINER
    if (candidatePromotedIndex >= 0) {
      lines[candidatePromotedIndex] = maskLineWithBreakAndHeading(lines[candidatePromotedIndex]!)
      lineMasks[candidatePromotedIndex]! |= LINE_BIT_CONTAINER
    }
    const closeIndex = resolveContainerCloseWithBoundedFormulas(
      state,
      index + 1,
      () => false,
      false,
      open.fenceLength
    )
    if (closeIndex < 0) {
      lines.splice(index, snapshot.length, ...snapshot)
      lineMasks.fill(0, index)
      return { nextIndex: index + 1, mutated: false }
    }
    recordContainerCloseLine(containerCloseRanges, lineStarts, lines, closeIndex)
    lines[closeIndex] = maskLineWithBreakAndHeading(lines[closeIndex]!)
    lineMasks[closeIndex]! |= LINE_BIT_CONTAINER
    return { nextIndex: index + 1, mutated: true }
  }

  return null
}

const tryMaskCustomBlockStepAt = (
  state: MaskPipelineState,
  index: number,
  currentRanges: CommonMarkBlockRanges
): { nextIndex: number; mutated: boolean } => {
  const { lines, lineStarts, lineMasks } = state
  const line = lines[index]!
  const trimmed = line.trim()
  if (trimmed.startsWith("![") && parseStandaloneMarkdownImageLine(trimmed)) {
    lines[index] = maskLineWithBreakAndHeading(line)
    lineMasks[index]! |= LINE_BIT_CONTAINER
    return { nextIndex: index + 1, mutated: true }
  }
  const colonStep = tryMaskColonDirectiveAt(state, index, line, currentRanges)
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
      markMaskRangeBits(lineMasks, index, closeIndex, LINE_BIT_MATH)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }
  if (trimmed.startsWith("<")) {
    const asideStep = tryMaskAsideBlockAt(state, index, currentRanges)
    if (asideStep) return asideStep
  }
  if (trimmed.startsWith(">")) {
    return tryMaskBlockquoteCalloutAt(state, index)
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
  const state: MaskPipelineState = {
    lines,
    lineStarts,
    lineMasks: new Uint8Array(lines.length),
    initialListRanges: initialRanges.listRanges,
    asideRanges: [],
    containerCloseRanges: [],
    extraCodeRanges: [],
  }
  let currentRanges = initialRanges
  let dirty = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    const lineStart = lineStarts[index]!
    if (dirty && needsFreshRangesForLine(line)) {
      currentRanges = refreshPipelineRanges(state)
      dirty = false
    }
    if (isExcludedTopLevelLine(line, lineStart, currentRanges)) {
      index += 1
      continue
    }
    const step = tryMaskCustomBlockStepAt(state, index, currentRanges)
    if (step.mutated) dirty = true
    index = step.nextIndex
  }

  return dirty
    ? refreshPipelineRanges(state)
    : {
        ...currentRanges,
        codeBlockRanges: mergeSortedSpanRanges([
          ...currentRanges.codeBlockRanges,
          ...state.extraCodeRanges,
        ]),
        asideRanges: state.asideRanges,
        containerCloseRanges: mergeSortedSpanRanges(state.containerCloseRanges),
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
