import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { mergeSortedSpanRanges, type MathSpanRange } from "./pandocMathScanner"
import {
  findDirectiveCloseLineIndex,
  parseCustomDirectiveHeader,
  stepTopLevelCodeFence,
  type ActiveCodeFence,
} from "./renderingDirectiveModel"

export type CommonMarkBlockRanges = {
  codeBlockRanges: MathSpanRange[]
  listRanges: MathSpanRange[]
}

type CommonMarkAstNode = {
  type: string
  children?: CommonMarkAstNode[]
  position?: {
    start?: { offset?: number }
    end?: { offset?: number }
  }
}

const SUPPORTED_COLON_DIRECTIVE_PATTERN = /^:::(?:callout|toggle)(?:[ \t\r]|$)/
const BLOCK_CONTAINER_NODE_TYPES = new Set([
  "root",
  "blockquote",
  "list",
  "listItem",
  "footnoteDefinition",
])
const MAX_BLOCK_RANGE_CACHE_ENTRIES = 8
const EMPTY_BLOCK_RANGES: CommonMarkBlockRanges = {
  codeBlockRanges: [],
  listRanges: [],
}

const commonMarkProcessor = unified().use(remarkParse).use(remarkGfm).freeze()
const blockRangeCache = new Map<string, CommonMarkBlockRanges>()

const isSupportedContainerDirectiveHeader = (line: string): boolean => {
  if (!line.startsWith(":::")) return false
  if (SUPPORTED_COLON_DIRECTIVE_PATTERN.test(line)) return true
  return parseCustomDirectiveHeader(line.trim()) !== null
}

const maskDirectiveLinePreservingLength = (line: string): string => {
  const hasCr = line.endsWith("\r")
  const bodyLength = hasCr ? line.length - 1 : line.length
  const masked = `#${" ".repeat(Math.max(0, bodyLength - 1))}`
  return hasCr ? `${masked}\r` : masked
}

export const maskMatchedContainerDirectives = (markdown: string): string => {
  if (!markdown.includes(":::")) return markdown
  const lines = markdown.split("\n")
  let mutated = false
  let activeFence: ActiveCodeFence | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const fenceStep = stepTopLevelCodeFence(line, activeFence)
    activeFence = fenceStep.activeFence
    if (fenceStep.inFence || !isSupportedContainerDirectiveHeader(line)) continue
    const closeIndex = findDirectiveCloseLineIndex(lines, index + 1)
    if (closeIndex < 0) continue
    lines[index] = maskDirectiveLinePreservingLength(line)
    lines[closeIndex] = maskDirectiveLinePreservingLength(lines[closeIndex]!)
    mutated = true
    index = closeIndex
  }

  return mutated ? lines.join("\n") : markdown
}

const walkCommonMarkBlockRanges = (
  node: CommonMarkAstNode,
  rawCodeRanges: MathSpanRange[],
  rawListRanges: MathSpanRange[]
): void => {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  const hasValidRange = typeof start === "number" && typeof end === "number" && end > start

  if (node.type === "code") {
    if (hasValidRange) {
      rawCodeRanges.push({ from: start, to: end })
    }
    return
  }

  if (node.type === "list" && hasValidRange) {
    rawListRanges.push({ from: start, to: end })
  }

  if (!BLOCK_CONTAINER_NODE_TYPES.has(node.type) || !Array.isArray(node.children)) {
    return
  }

  for (const child of node.children) {
    walkCommonMarkBlockRanges(child, rawCodeRanges, rawListRanges)
  }
}

export const parseCommonMarkBlockRanges = (markdown: string): CommonMarkBlockRanges => {
  if (!markdown) return EMPTY_BLOCK_RANGES

  const cached = blockRangeCache.get(markdown)
  if (cached) {
    blockRangeCache.delete(markdown)
    blockRangeCache.set(markdown, cached)
    return cached
  }

  const masked = maskMatchedContainerDirectives(markdown)
  const tree = commonMarkProcessor.parse(masked) as CommonMarkAstNode
  const rawCodeRanges: MathSpanRange[] = []
  const rawListRanges: MathSpanRange[] = []
  walkCommonMarkBlockRanges(tree, rawCodeRanges, rawListRanges)

  const resolved: CommonMarkBlockRanges = {
    codeBlockRanges: mergeSortedSpanRanges(rawCodeRanges),
    listRanges: mergeSortedSpanRanges(rawListRanges),
  }

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
