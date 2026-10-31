import {
  countCodePointRun,
  findLineEndOffset,
  findLineStartOffset,
  isEscapedMarkdownAt,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
  type MathSpanRange,
} from "../../libs/markdown/pandocMathScanner"

export type { MathSpanRange as MathLiteralRange } from "../../libs/markdown/pandocMathScanner"

export type MathReplacementSpec = {
  from: number
  to: number
  math: string
  displayMode: boolean
}

const MAX_MATH_BLOCKS_PER_DOC = 512

export const MATH_LITERAL_SYNTAX_NODE_NAMES = new Set([
  "InlineCode",
  "FencedCode",
  "CodeBlock",
  "HTMLBlock",
  "HTMLTag",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "URL",
  "Autolink",
])

export const MATH_INTERIOR_ABORT_SYNTAX_NODE_NAMES = new Set([
  "InlineCode",
  "FencedCode",
  "CodeBlock",
  "HTMLBlock",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "Autolink",
])

const BLOCK_LITERAL_SYNTAX_NODE_NAMES = new Set(["FencedCode", "CodeBlock", "HTMLBlock"])

export type CollectedSyntaxLiteralRanges = {
  literalRanges: MathSpanRange[]
  interiorLiteralRanges: MathSpanRange[]
  blockLiteralRanges: MathSpanRange[]
  codeBlockRanges: MathSpanRange[]
}

const walkSyntaxLiteralNodes = (
  node: MathSyntaxNodeLike,
  out: CollectedSyntaxLiteralRanges
): void => {
  if (BLOCK_LITERAL_SYNTAX_NODE_NAMES.has(node.name)) {
    const range = { from: node.from, to: node.to }
    if (node.name === "FencedCode" || node.name === "CodeBlock") {
      out.codeBlockRanges.push(range)
    }
    out.blockLiteralRanges.push(range)
    out.interiorLiteralRanges.push(range)
    out.literalRanges.push(range)
    return
  }
  if (MATH_LITERAL_SYNTAX_NODE_NAMES.has(node.name)) {
    const range = { from: node.from, to: node.to }
    if (MATH_INTERIOR_ABORT_SYNTAX_NODE_NAMES.has(node.name)) out.interiorLiteralRanges.push(range)
    out.literalRanges.push(range)
    return
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    walkSyntaxLiteralNodes(child, out)
  }
}

export const collectSyntaxLiteralRanges = (
  rootNode: MathSyntaxNodeLike
): CollectedSyntaxLiteralRanges => {
  const out: CollectedSyntaxLiteralRanges = {
    literalRanges: [],
    interiorLiteralRanges: [],
    blockLiteralRanges: [],
    codeBlockRanges: [],
  }
  walkSyntaxLiteralNodes(rootNode, out)
  return out
}

const BARE_URL_PATTERN = /\b(?:https?|ftp):\/\/[^\s<>()]+/gi

const appendInlineCodeExcludedRanges = (docText: string, combined: MathSpanRange[]): void => {
  let cursor = 0
  while (cursor < docText.length) {
    if (docText.codePointAt(cursor) !== 96 || isEscapedMarkdownAt(docText, cursor)) {
      cursor += 1
      continue
    }
    const closeEnd = scanInlineCodeSpanEnd(docText, cursor)
    if (closeEnd > cursor) {
      combined.push({ from: cursor, to: closeEnd })
      cursor = closeEnd
    } else {
      cursor += countCodePointRun(docText, cursor, 96)
    }
  }
}

const buildExcludedMathRanges = (
  docText: string,
  literalRanges: readonly MathSpanRange[] | undefined
): MathSpanRange[] => {
  const combined: MathSpanRange[] = literalRanges ? [...literalRanges] : []
  if (docText.includes("://")) {
    BARE_URL_PATTERN.lastIndex = 0
    for (const match of docText.matchAll(BARE_URL_PATTERN)) {
      combined.push({ from: match.index, to: match.index + match[0].length })
    }
  }
  if (literalRanges === undefined && docText.includes("`")) {
    appendInlineCodeExcludedRanges(docText, combined)
  }
  return mergeSortedSpanRanges(combined)
}

const overlapsActiveLine = (
  from: number,
  to: number,
  activeLineFrom: number,
  activeLineTo: number
): boolean =>
  activeLineFrom >= 0 &&
  activeLineTo >= activeLineFrom &&
  from <= activeLineTo &&
  to >= activeLineFrom

const isSkippedDollarAt = (
  docText: string,
  index: number,
  excludedRanges: readonly MathSpanRange[]
): boolean =>
  docText.codePointAt(index) !== 36 ||
  isEscapedMarkdownAt(docText, index) ||
  overlapsSortedRanges(excludedRanges, index, index + 1)

const tryMatchDisplayMathAt = (
  docText: string,
  index: number,
  delimiterExcluded: readonly MathSpanRange[],
  blockExcluded: readonly MathSpanRange[]
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  if (overlapsSortedRanges(delimiterExcluded, index, index + 2)) {
    return { spec: null, nextIndex: index + 2 }
  }
  const display = scanPandocDisplayMathAt(docText, index, { excludedRanges: blockExcluded })
  if (!display) {
    return { spec: null, nextIndex: index + 2 }
  }
  return {
    spec: { from: display.from, to: display.to, math: display.math, displayMode: true },
    nextIndex: display.to,
  }
}

const tryMatchMathAt = (
  docText: string,
  index: number,
  delimiterExcluded: readonly MathSpanRange[],
  interiorExcluded: readonly MathSpanRange[],
  blockExcluded: readonly MathSpanRange[]
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  const runLength = countCodePointRun(docText, index, 36)
  if (runLength > 2) {
    return { spec: null, nextIndex: index + runLength }
  }
  if (runLength === 2) {
    return tryMatchDisplayMathAt(docText, index, delimiterExcluded, blockExcluded)
  }
  const inline = scanPandocInlineMathAt(docText, index, { excludedRanges: interiorExcluded })
  const validInline =
    inline && !overlapsSortedRanges(delimiterExcluded, inline.to - 1, inline.to) ? inline : null
  return {
    spec: validInline
      ? { from: validInline.from, to: validInline.to, math: validInline.math, displayMode: false }
      : null,
    nextIndex: validInline ? validInline.to : index + 1,
  }
}

export const collectMathReplacementSpecs = (
  docText: string,
  activeLineFrom = -1,
  activeLineTo = -1,
  shouldRevealAll = false,
  literalRanges?: readonly MathSpanRange[],
  interiorLiteralRanges?: readonly MathSpanRange[],
  codeBlockRanges?: readonly MathSpanRange[]
): MathReplacementSpec[] => {
  if (shouldRevealAll || !docText.includes("$")) return []

  const delimiterExcluded = buildExcludedMathRanges(docText, literalRanges)
  const interiorExcluded =
    interiorLiteralRanges === undefined || interiorLiteralRanges === literalRanges
      ? delimiterExcluded
      : buildExcludedMathRanges(docText, interiorLiteralRanges)
  const blockExcluded =
    codeBlockRanges === undefined ? delimiterExcluded : mergeSortedSpanRanges(codeBlockRanges)
  const specs: MathReplacementSpec[] = []
  let index = 0

  while (index < docText.length && specs.length < MAX_MATH_BLOCKS_PER_DOC) {
    if (isSkippedDollarAt(docText, index, delimiterExcluded)) {
      index += 1
      continue
    }
    const { spec, nextIndex } = tryMatchMathAt(
      docText,
      index,
      delimiterExcluded,
      interiorExcluded,
      blockExcluded
    )
    if (spec && !overlapsActiveLine(spec.from, spec.to, activeLineFrom, activeLineTo)) {
      specs.push(spec)
    }
    index = nextIndex
  }

  return specs
}

export const collectMarkdownMathSpans = collectMathReplacementSpecs

export type LivePreviewMathAugmentation = {
  literalRanges: MathSpanRange[]
  blockLiteralRanges: MathSpanRange[]
  mathRanges: MathSpanRange[]
  displayMathRanges: MathSpanRange[]
  mathSpecs: MathReplacementSpec[]
}

export const augmentLivePreviewLiteralRangesWithMath = (
  markdown: string,
  literalRanges: readonly MathSpanRange[],
  blockLiteralRanges: readonly MathSpanRange[],
  interiorLiteralRanges: readonly MathSpanRange[] = literalRanges,
  codeBlockRanges?: readonly MathSpanRange[]
): LivePreviewMathAugmentation => {
  if (!markdown.includes("$")) {
    return {
      literalRanges: [...literalRanges],
      blockLiteralRanges: [...blockLiteralRanges],
      mathRanges: [],
      displayMathRanges: [],
      mathSpecs: [],
    }
  }
  const mathSpecs = collectMathReplacementSpecs(
    markdown,
    -1,
    -1,
    false,
    literalRanges,
    interiorLiteralRanges,
    codeBlockRanges
  )
  if (mathSpecs.length === 0) {
    return {
      literalRanges: [...literalRanges],
      blockLiteralRanges: [...blockLiteralRanges],
      mathRanges: [],
      displayMathRanges: [],
      mathSpecs,
    }
  }
  const mathRanges = mergeSortedSpanRanges(mathSpecs.map(({ from, to }) => ({ from, to })))
  const displayMathRanges = mergeSortedSpanRanges(
    mathSpecs.filter((spec) => spec.displayMode).map(({ from, to }) => ({ from, to }))
  )
  return {
    literalRanges: mergeSortedSpanRanges([...literalRanges, ...mathRanges]),
    blockLiteralRanges:
      displayMathRanges.length > 0
        ? mergeSortedSpanRanges([...blockLiteralRanges, ...displayMathRanges])
        : [...blockLiteralRanges],
    mathRanges,
    displayMathRanges,
    mathSpecs,
  }
}

export type MathSyntaxNodeLike = {
  name: string
  from: number
  to: number
  firstChild: MathSyntaxNodeLike | null
  nextSibling: MathSyntaxNodeLike | null
}

export type MathSyntaxNodeDisposition =
  | "allow"
  | "skip"
  | "corrupted-inline"
  | "suppress-container"

export const INLINE_DELIMITER_SYNTAX_NODE_NAMES = new Set([
  "EmphasisMark",
  "StrikethroughMark",
  "CodeMark",
  "LinkMark",
  "URL",
])

const INLINE_MATH_SENSITIVE_CONTAINERS = new Set([
  "Emphasis",
  "StrongEmphasis",
  "Strikethrough",
  "Link",
  "Image",
])

const DISPLAY_MATH_CONTAINER_BLOCKS = new Set(["Blockquote", "BulletList", "OrderedList"])

const MATH_LEAF_GUARDED_NODE_NAMES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "CodeMark",
  "LinkMark",
  "URL",
  "QuoteMark",
  "ListMark",
  "TaskMarker",
  "HorizontalRule",
  "FencedCode",
  "CodeBlock",
  "InlineCode",
])

const enclosesSortedRange = (
  ranges: readonly MathSpanRange[],
  from: number,
  to: number
): boolean => {
  let low = 0
  let high = ranges.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (ranges[mid]!.from <= from) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return candidate !== -1 && from < ranges[candidate]!.to && ranges[candidate]!.to >= to
}

const hasDirectDelimiterInMath = (
  node: MathSyntaxNodeLike,
  mathRanges: readonly MathSpanRange[]
): boolean => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (
      INLINE_DELIMITER_SYNTAX_NODE_NAMES.has(child.name) &&
      overlapsSortedRanges(mathRanges, child.from, child.to)
    ) {
      return true
    }
  }
  return false
}

const hasDirectHeaderMarkInMath = (
  node: MathSyntaxNodeLike,
  mathRanges: readonly MathSpanRange[]
): boolean => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "HeaderMark" && overlapsSortedRanges(mathRanges, child.from, child.to)) {
      return true
    }
  }
  return false
}

const isHeadingOrTaskBlockedByMath = (
  node: MathSyntaxNodeLike,
  mathRanges: readonly MathSpanRange[]
): boolean => {
  if (/^(?:ATXHeading[1-6]|SetextHeading[12])$/.test(node.name)) {
    return hasDirectHeaderMarkInMath(node, mathRanges)
  }
  if (node.name !== "Task") return false
  const markerTo =
    node.firstChild?.name === "TaskMarker" ? node.firstChild.to : Math.min(node.to, node.from + 3)
  return overlapsSortedRanges(mathRanges, node.from, markerTo)
}

export const isNodeShadowedByMath = (
  mathRanges: readonly MathSpanRange[],
  nodeFrom: number,
  nodeTo: number
): boolean => {
  if (mathRanges.length === 0 || nodeFrom >= nodeTo) return false
  let low = 0
  let high = mathRanges.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (mathRanges[mid]!.from <= nodeFrom) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  for (let i = Math.max(0, candidate); i < mathRanges.length; i += 1) {
    const m = mathRanges[i]!
    if (m.from >= nodeTo) break
    if (m.to <= nodeFrom) continue
    if (!(m.from >= nodeFrom && m.to <= nodeTo && m.to - m.from < nodeTo - nodeFrom)) {
      return true
    }
  }
  return false
}

export const classifySyntaxNodeAgainstMath = (
  node: MathSyntaxNodeLike,
  mathRanges: readonly MathSpanRange[]
): MathSyntaxNodeDisposition => {
  if (mathRanges.length === 0) return "allow"
  if (
    enclosesSortedRange(mathRanges, node.from, node.to) ||
    (MATH_LEAF_GUARDED_NODE_NAMES.has(node.name) &&
      overlapsSortedRanges(mathRanges, node.from, node.to)) ||
    isHeadingOrTaskBlockedByMath(node, mathRanges)
  ) {
    return "skip"
  }
  if (INLINE_MATH_SENSITIVE_CONTAINERS.has(node.name) && hasDirectDelimiterInMath(node, mathRanges)) {
    return "corrupted-inline"
  }
  if (
    DISPLAY_MATH_CONTAINER_BLOCKS.has(node.name) &&
    overlapsSortedRanges(mathRanges, node.from, Math.min(node.to, node.from + 1))
  ) {
    return "suppress-container"
  }
  return "allow"
}

const REPLACE_PLAN_SPEC_KINDS = new Set([
  "hide-mark",
  "horizontal-rule",
  "task",
  "list-marker",
  "wikilink",
  "quote-mark",
])

export const isLivePlanSpecBlockedByReplacedRanges = (
  markdown: string,
  specKind: string,
  specFrom: number,
  checkTo: number,
  replacedRanges: readonly MathSpanRange[]
): boolean => {
  if (replacedRanges.length === 0 || specFrom >= checkTo) return specFrom >= checkTo
  const isReplaceSpec = REPLACE_PLAN_SPEC_KINDS.has(specKind)
  for (const r of replacedRanges) {
    if (r.from >= checkTo) break
    if (r.to <= specFrom) continue
    if (
      isReplaceSpec ||
      !(r.from >= specFrom && r.to <= checkTo && r.to - r.from < checkTo - specFrom) ||
      markdown.slice(r.from, r.to).includes("\n")
    ) {
      return true
    }
  }
  return false
}

const isAbsorbedDedicatedDisplayOpen = (
  markdown: string,
  nodeFrom: number,
  mathFrom: number
): { truncatedTo: number } | null => {
  const openLineStart = findLineStartOffset(markdown, mathFrom)
  if (openLineStart <= nodeFrom) return null
  if (!/^[ \t]{0,3}$/.test(markdown.slice(openLineStart, mathFrom))) return null
  const openLineEnd = findLineEndOffset(markdown, mathFrom + 2)
  if (markdown.slice(mathFrom + 2, openLineEnd).trim() !== "") return null
  const truncatedTo =
    openLineStart >= 2 && markdown.codePointAt(openLineStart - 2) === 13
      ? openLineStart - 2
      : openLineStart - 1
  return { truncatedTo }
}

export const resolveBlockNodeEndWithMath = (
  markdown: string,
  nodeName: "Table" | "Blockquote",
  nodeFrom: number,
  nodeTo: number,
  maths: readonly MathReplacementSpec[]
): number | null => {
  let effectiveTo = nodeTo
  for (const m of maths) {
    if (m.to <= nodeFrom) continue
    if (m.from >= effectiveTo) break
    if (!markdown.slice(m.from, m.to).includes("\n")) continue
    const absorbed = isAbsorbedDedicatedDisplayOpen(markdown, nodeFrom, m.from)
    if (absorbed) {
      effectiveTo = absorbed.truncatedTo
      break
    }
    if (nodeName === "Table" && m.from >= nodeFrom) return null
  }
  if (effectiveTo <= nodeFrom) return null
  if (nodeName === "Table" && !markdown.slice(nodeFrom, effectiveTo).includes("\n")) return null
  return effectiveTo
}

export const filterDisjointPreorderItems = <T extends MathSpanRange>(items: readonly T[]): T[] => {
  const kept: T[] = []
  for (const item of items) {
    const prev = kept.at(-1)
    if (!prev || item.from >= prev.to) kept.push(item)
  }
  return kept
}

export const filterItemsOutsideSortedRanges = <T extends MathSpanRange>(
  items: readonly T[],
  excluded: readonly MathSpanRange[]
): T[] =>
  excluded.length === 0
    ? [...items]
    : items.filter((item) => !overlapsSortedRanges(excluded, item.from, item.to))

