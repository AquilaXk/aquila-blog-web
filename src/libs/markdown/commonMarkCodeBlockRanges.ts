import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { getCallout, resolveCalloutBlockquote, resolveCalloutLegacyEmoji } from "./calloutRegistry"
import {
  hasCommonMarkCodeIndent,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  parseOpeningCodeFence,
  type MathSpanRange,
} from "./pandocMathScanner"
import {
  extractAsideOpenTail,
  findDirectiveCloseLineIndex,
  isDedicatedFormulaFenceLine,
  parseCustomDirectiveHeader,
  stripClosingAsideTag,
} from "./renderingDirectiveModel"
import { parseStandaloneMarkdownImageLine } from "./renderingImageModel"

export type CommonMarkBlockRanges = {
  codeBlockRanges: MathSpanRange[]
  commentRanges: MathSpanRange[]
  codeAndCommentRanges: MathSpanRange[]
  listRanges: MathSpanRange[]
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

const SUPPORTED_COLON_DIRECTIVE_PATTERN = /^:::(?:callout|toggle)(?:[ \t\r]|$)/
const LEADING_SPACE_OR_TAB_PATTERN = /^[ \t]/
const BLOCKQUOTE_CALLOUT_TOKEN_PATTERN = /^\[!([A-Za-z0-9_-]+)\]([+-])?/
const MAX_BLOCK_RANGE_CACHE_ENTRIES = 8
const EMPTY_BLOCK_RANGES: CommonMarkBlockRanges = {
  codeBlockRanges: [],
  commentRanges: [],
  codeAndCommentRanges: [],
  listRanges: [],
}

const commonMarkProcessor = unified().use(remarkParse).use(remarkGfm).freeze()
const blockRangeCache = new Map<string, CommonMarkBlockRanges>()

const isSupportedContainerDirectiveHeader = (line: string): boolean => {
  if (!line.startsWith(":::")) return false
  if (SUPPORTED_COLON_DIRECTIVE_PATTERN.test(line)) return true
  return parseCustomDirectiveHeader(line.trim()) !== null
}

const maskLineWithBreakAndHeading = (line: string): string => {
  const hasCr = line.endsWith("\r")
  const bodyLength = hasCr ? line.length - 1 : line.length
  let masked = ""
  if (bodyLength >= 2) {
    masked = `\n#${" ".repeat(bodyLength - 2)}`
  } else if (bodyLength === 1) {
    masked = "\n"
  }
  return hasCr ? `${masked}\r` : masked
}

const maskLinesInRange = (lines: string[], startIndex: number, endIndex: number): void => {
  for (let i = startIndex; i <= endIndex; i += 1) {
    lines[i] = maskLineWithBreakAndHeading(lines[i]!)
  }
}

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

const parseRawCommonMarkRanges = (source: string): CommonMarkBlockRanges => {
  const tree = commonMarkProcessor.parse(source) as CommonMarkAstNode
  const rawCodeRanges: MathSpanRange[] = []
  const rawCommentRanges: MathSpanRange[] = []
  const rawListRanges: MathSpanRange[] = []
  walkCommonMarkBlockRanges(tree, rawCodeRanges, rawCommentRanges, rawListRanges)
  const codeBlockRanges = mergeSortedSpanRanges(rawCodeRanges)
  const commentRanges = mergeSortedSpanRanges(rawCommentRanges)
  return {
    codeBlockRanges,
    commentRanges,
    codeAndCommentRanges: mergeSortedSpanRanges([...codeBlockRanges, ...commentRanges]),
    listRanges: mergeSortedSpanRanges(rawListRanges),
  }
}

const isValidBlockquoteCalloutLine = (rawLine: string): boolean => {
  const line = rawLine.trim()
  if (!line) return false
  const tokenMatch = BLOCKQUOTE_CALLOUT_TOKEN_PATTERN.exec(line)
  if (tokenMatch) {
    return Boolean(resolveCalloutBlockquote(tokenMatch[1] ?? ""))
  }
  const unbracketed = line.replace(/^\[([^\s\]]+)\](?=\s|$)/, "$1")
  return Boolean(resolveCalloutLegacyEmoji(unbracketed) ?? getCallout("info")) && Boolean(resolveCalloutLegacyEmoji(unbracketed))
}

const findDedicatedFormulaCloseIndex = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  excludedRanges: readonly MathSpanRange[]
): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (parseOpeningCodeFence(line) !== null) return -1
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(excludedRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return index
    }
  }
  return -1
}

const findAsideCloseIndex = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  excludedRanges: readonly MathSpanRange[]
): number => {
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    const currentLine = lines[cursor]!
    const lineStart = lineStarts[cursor]!
    if (overlapsSortedRanges(excludedRanges, lineStart, lineStart + Math.max(1, currentLine.length))) {
      continue
    }
    if (stripClosingAsideTag(currentLine) !== null) return cursor
  }
  return -1
}

const tryMaskAsideBlockAt = (
  lines: string[],
  index: number,
  lineStarts: readonly number[]
): { nextIndex: number; mutated: boolean } | null => {
  const line = lines[index]!
  const openingTail = extractAsideOpenTail(line)
  if (openingTail === null) return null
  if (stripClosingAsideTag(openingTail) !== null) {
    lines[index] = maskLineWithBreakAndHeading(line)
    return { nextIndex: index + 1, mutated: true }
  }
  lines[index] = maskLineWithBreakAndHeading(line)
  const asideRanges = parseRawCommonMarkRanges(lines.join("\n"))
  const closeIndex = findAsideCloseIndex(lines, index, lineStarts, asideRanges.codeAndCommentRanges)
  if (closeIndex < 0) {
    lines[index] = line
    return { nextIndex: index + 1, mutated: false }
  }
  lines[closeIndex] = maskLineWithBreakAndHeading(lines[closeIndex]!)
  return { nextIndex: closeIndex + 1, mutated: true }
}

const tryMaskBlockquoteCalloutAt = (
  lines: string[],
  startIndex: number
): { nextIndex: number; mutated: boolean } => {
  let cursor = startIndex
  let firstContent = ""
  while (cursor < lines.length && lines[cursor]!.trimStart().startsWith(">")) {
    if (!firstContent) {
      const stripped = lines[cursor]!.replace(/^\s*>\s?/, "").trim()
      if (stripped) firstContent = stripped
    }
    cursor += 1
  }
  if (firstContent && isValidBlockquoteCalloutLine(firstContent)) {
    lines[cursor - 1] = maskLineWithBreakAndHeading(lines[cursor - 1]!)
    return { nextIndex: cursor, mutated: true }
  }
  return { nextIndex: cursor, mutated: false }
}

const tryMaskCustomBlockStepAt = (
  lines: string[],
  index: number,
  lineStarts: readonly number[],
  excludedRanges: readonly MathSpanRange[]
): { nextIndex: number; mutated: boolean } => {
  const line = lines[index]!
  const trimmed = line.trim()
  if (trimmed.startsWith("![") && parseStandaloneMarkdownImageLine(trimmed)) {
    lines[index] = maskLineWithBreakAndHeading(line)
    return { nextIndex: index + 1, mutated: true }
  }
  if (isSupportedContainerDirectiveHeader(line)) {
    const closeIndex = findDirectiveCloseLineIndex(lines, index + 1, lineStarts, excludedRanges)
    if (closeIndex >= 0) {
      lines[index] = maskLineWithBreakAndHeading(line)
      lines[closeIndex] = maskLineWithBreakAndHeading(lines[closeIndex]!)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }
  if (isDedicatedFormulaFenceLine(line)) {
    const closeIndex = findDedicatedFormulaCloseIndex(lines, index, lineStarts, excludedRanges)
    if (closeIndex >= 0) {
      maskLinesInRange(lines, index, closeIndex)
      return { nextIndex: closeIndex + 1, mutated: true }
    }
    return { nextIndex: index + 1, mutated: false }
  }
  if (trimmed.startsWith(">")) {
    return tryMaskBlockquoteCalloutAt(lines, index)
  }
  if (trimmed.startsWith("<")) {
    return tryMaskAsideBlockAt(lines, index, lineStarts) ?? { nextIndex: index + 1, mutated: false }
  }
  return { nextIndex: index + 1, mutated: false }
}

const hasCandidateCustomSegmentMarker = (markdown: string): boolean =>
  markdown.includes(":::") ||
  markdown.includes("$$") ||
  markdown.includes("![") ||
  markdown.includes(">") ||
  markdown.toLowerCase().includes("<aside")

const maskCustomSegmentsForCommonMark = (
  markdown: string,
  initialRanges: CommonMarkBlockRanges
): { masked: string; mutated: boolean } => {
  if (!hasCandidateCustomSegmentMarker(markdown)) {
    return { masked: markdown, mutated: false }
  }
  const lines = markdown.split("\n")
  const lineStarts = computeLineStarts(lines)
  let currentRanges = initialRanges
  let mutated = false
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!
    const lineStart = lineStarts[index]!
    const lineEnd = lineStart + Math.max(1, line.length)
    const isSkipped =
      overlapsSortedRanges(currentRanges.codeAndCommentRanges, lineStart, lineEnd) ||
      hasCommonMarkCodeIndent(line) ||
      (LEADING_SPACE_OR_TAB_PATTERN.test(line) &&
        overlapsSortedRanges(currentRanges.listRanges, lineStart, lineEnd))
    if (isSkipped) {
      index += 1
      continue
    }
    const step = tryMaskCustomBlockStepAt(
      lines,
      index,
      lineStarts,
      currentRanges.codeAndCommentRanges
    )
    if (step.mutated) {
      mutated = true
      currentRanges = parseRawCommonMarkRanges(lines.join("\n"))
    }
    index = step.nextIndex
  }

  return { masked: mutated ? lines.join("\n") : markdown, mutated }
}

export const parseCommonMarkBlockRanges = (markdown: string): CommonMarkBlockRanges => {
  if (!markdown) return EMPTY_BLOCK_RANGES

  const cached = blockRangeCache.get(markdown)
  if (cached) {
    blockRangeCache.delete(markdown)
    blockRangeCache.set(markdown, cached)
    return cached
  }

  const initialRanges = parseRawCommonMarkRanges(markdown)
  const { masked, mutated } = maskCustomSegmentsForCommonMark(markdown, initialRanges)
  const resolved = mutated ? parseRawCommonMarkRanges(masked) : initialRanges

  if (blockRangeCache.size >= MAX_BLOCK_RANGE_CACHE_ENTRIES) {
    const oldestKey = blockRangeCache.keys().next().value
    if (oldestKey !== undefined) {
      blockRangeCache.delete(oldestKey)
    }
  }
  blockRangeCache.set(markdown, resolved)
  return resolved
}

export const collectCommonMarkCodeBlockRanges = (markdown: string): MathSpanRange[] => {
  if (
    !markdown ||
    (!markdown.includes("    ") &&
      !markdown.includes("\t") &&
      !markdown.includes("```") &&
      !markdown.includes("~~~"))
  ) {
    return []
  }
  return parseCommonMarkBlockRanges(markdown).codeBlockRanges
}
