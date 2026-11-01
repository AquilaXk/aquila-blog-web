import {
  countCodePointRun,
  findLineEndOffset,
  findLineStartOffset,
  isEscapedMarkdownAt,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  parseDedicatedLineQuoteDepth,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
  type MathSpanRange,
} from "../../libs/markdown/pandocMathScanner"

export type MathReplacementSpec = {
  from: number
  to: number
  math: string
  displayMode: boolean
}

const MAX_MATH_BLOCKS_PER_DOC = 512

export const MATH_LITERAL_SYNTAX_NODE_NAMES = new Set([
  "InlineCode", "FencedCode", "CodeBlock", "HTMLBlock", "HTMLTag",
  "Comment", "CommentBlock", "ProcessingInstruction", "URL", "Autolink",
])

export const MATH_INTERIOR_ABORT_SYNTAX_NODE_NAMES = new Set([
  "InlineCode", "FencedCode", "CodeBlock", "HTMLBlock",
  "Comment", "CommentBlock", "ProcessingInstruction", "Autolink",
])

const BLOCK_LITERAL_SYNTAX_NODE_NAMES = new Set([
  "FencedCode", "CodeBlock", "HTMLBlock", "CommentBlock",
])

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
    if (node.name === "FencedCode" || node.name === "CodeBlock") out.codeBlockRanges.push(range)
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
  activeLineFrom >= 0 && activeLineTo >= activeLineFrom && from <= activeLineTo && to >= activeLineFrom

const isSkippedDollarAt = (
  docText: string,
  index: number,
  excludedRanges: readonly MathSpanRange[]
): boolean =>
  docText.codePointAt(index) !== 36 ||
  isEscapedMarkdownAt(docText, index) ||
  overlapsSortedRanges(excludedRanges, index, index + 1)

type MathScanExclusions = {
  delimiter: readonly MathSpanRange[]
  interior: readonly MathSpanRange[]
  blockLiteral: readonly MathSpanRange[]
  codeOnly: readonly MathSpanRange[]
}

const isDedicatedDisplayFenceLineAt = (docText: string, index: number): boolean => {
  const lineStart = findLineStartOffset(docText, index)
  const lineEnd = findLineEndOffset(docText, index)
  const line = docText.slice(lineStart, lineEnd)
  const parsed = parseDedicatedLineQuoteDepth(line)
  if (!parsed) return false
  const strippedStart = lineStart + (line.length - parsed.rest.length)
  return index === strippedStart && parsed.rest.startsWith("$$") && parsed.rest.slice(2).trim() === ""
}

const hasInnerDoubleDollarInRanges = (
  docText: string,
  innerFrom: number,
  innerTo: number,
  ranges: readonly MathSpanRange[]
): boolean => {
  for (const r of ranges) {
    if (r.to <= innerFrom) continue
    if (r.from >= innerTo) break
    const sliceStart = Math.max(innerFrom, r.from)
    const sliceEnd = Math.min(innerTo, r.to)
    if (sliceEnd - sliceStart >= 2 && docText.slice(sliceStart, sliceEnd).includes("$$")) return true
  }
  return false
}

const tryMatchDisplayMathAt = (
  docText: string,
  index: number,
  exclusions: MathScanExclusions
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  if (overlapsSortedRanges(exclusions.delimiter, index, index + 2)) {
    return { spec: null, nextIndex: index + 2 }
  }
  const isDedicatedOpen = isDedicatedDisplayFenceLineAt(docText, index)
  const display = scanPandocDisplayMathAt(docText, index, {
    excludedRanges: isDedicatedOpen ? exclusions.codeOnly : exclusions.blockLiteral,
  })
  if (!display) return { spec: null, nextIndex: index + 2 }
  if (
    !isDedicatedOpen &&
    (overlapsSortedRanges(exclusions.delimiter, display.to - 2, display.to) ||
      hasInnerDoubleDollarInRanges(docText, index + 2, display.to - 2, exclusions.interior))
  ) {
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
  exclusions: MathScanExclusions
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  const runLength = countCodePointRun(docText, index, 36)
  if (runLength > 2) return { spec: null, nextIndex: index + runLength }
  if (runLength === 2) return tryMatchDisplayMathAt(docText, index, exclusions)
  const inline = scanPandocInlineMathAt(docText, index, { excludedRanges: exclusions.interior })
  const validInline =
    inline && !overlapsSortedRanges(exclusions.delimiter, inline.to - 1, inline.to) ? inline : null
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
  codeBlockRanges?: readonly MathSpanRange[],
  blockLiteralRanges?: readonly MathSpanRange[]
): MathReplacementSpec[] => {
  if (shouldRevealAll || !docText.includes("$")) return []

  const delimiter = buildExcludedMathRanges(docText, literalRanges)
  const interior =
    interiorLiteralRanges === undefined || interiorLiteralRanges === literalRanges
      ? delimiter
      : buildExcludedMathRanges(docText, interiorLiteralRanges)
  const codeOnly = codeBlockRanges === undefined ? delimiter : mergeSortedSpanRanges(codeBlockRanges)
  const blockLiteral =
    blockLiteralRanges === undefined ? codeOnly : mergeSortedSpanRanges(blockLiteralRanges)
  const exclusions: MathScanExclusions = { delimiter, interior, blockLiteral, codeOnly }
  const specs: MathReplacementSpec[] = []
  let index = 0

  while (index < docText.length && specs.length < MAX_MATH_BLOCKS_PER_DOC) {
    if (isSkippedDollarAt(docText, index, delimiter)) {
      index += 1
      continue
    }
    const { spec, nextIndex } = tryMatchMathAt(docText, index, exclusions)
    if (spec && !overlapsActiveLine(spec.from, spec.to, activeLineFrom, activeLineTo)) {
      specs.push(spec)
    }
    index = nextIndex
  }

  return specs
}

const findFirstRangeEndingAfter = (ranges: readonly MathSpanRange[], from: number): number => {
  let low = 0
  let high = ranges.length - 1
  let startIdx = ranges.length
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (ranges[mid]!.to > from) {
      startIdx = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  return startIdx
}

export const findFirstPoisoningMathSpec = (
  mathSpecs: readonly MathReplacementSpec[],
  literalRanges: readonly MathSpanRange[]
): MathReplacementSpec | null => {
  if (mathSpecs.length === 0 || literalRanges.length === 0) return null
  for (const spec of mathSpecs) {
    for (
      let idx = findFirstRangeEndingAfter(literalRanges, spec.from);
      idx < literalRanges.length;
      idx += 1
    ) {
      const r = literalRanges[idx]!
      if (r.from >= spec.to) break
      if (r.from >= spec.from && r.to > spec.to) return spec
    }
  }
  return null
}

export const maskMathSpanPreservingOffsets = (markdown: string, spec: MathSpanRange): string => {
  let inner = ""
  for (let i = spec.from; i < spec.to; i += 1) {
    const ch = markdown[i]!
    inner += ch === "\n" || ch === "\r" ? ch : "x"
  }
  return markdown.slice(0, spec.from) + inner + markdown.slice(spec.to)
}

export type LivePreviewMathAugmentation = {
  literalRanges: MathSpanRange[]
  blockLiteralRanges: MathSpanRange[]
  mathRanges: MathSpanRange[]
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
    codeBlockRanges,
    blockLiteralRanges
  )
  if (mathSpecs.length === 0) {
    return {
      literalRanges: [...literalRanges],
      blockLiteralRanges: [...blockLiteralRanges],
      mathRanges: [],
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
  "EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "URL",
])

const INLINE_MATH_SENSITIVE_CONTAINERS = new Set([
  "Emphasis", "StrongEmphasis", "Strikethrough", "Link", "Image",
])

const DISPLAY_MATH_CONTAINER_BLOCKS = new Set(["Blockquote", "BulletList", "OrderedList"])

const MATH_LEAF_GUARDED_NODE_NAMES = new Set([
  "HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "LinkMark", "URL",
  "QuoteMark", "ListMark", "TaskMarker", "HorizontalRule", "FencedCode", "CodeBlock", "InlineCode",
])

const enclosesSortedRange = (ranges: readonly MathSpanRange[], from: number, to: number): boolean => {
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
    if (!(m.from >= nodeFrom && m.to <= nodeTo && m.to - m.from < nodeTo - nodeFrom)) return true
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
  "hide-mark", "horizontal-rule", "task", "list-marker", "wikilink", "quote-mark",
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
  const allowEqualBounds =
    !isReplaceSpec && (specKind === "highlight" || specKind === "inline-color")
  const specLen = checkTo - specFrom
  for (
    let idx = findFirstRangeEndingAfter(replacedRanges, specFrom);
    idx < replacedRanges.length;
    idx += 1
  ) {
    const r = replacedRanges[idx]!
    if (r.from >= checkTo) break
    const rLen = r.to - r.from
    const fitsInside =
      r.from >= specFrom && r.to <= checkTo && (allowEqualBounds ? rLen <= specLen : rLen < specLen)
    if (isReplaceSpec || !fitsInside || markdown.slice(r.from, r.to).includes("\n")) return true
  }
  return false
}

const isAbsorbedDedicatedDisplayOpen = (
  markdown: string,
  nodeName: "Table" | "Blockquote" | "BulletList" | "OrderedList",
  nodeFrom: number,
  mathFrom: number
): { truncatedTo: number } | null => {
  const openLineStart = findLineStartOffset(markdown, mathFrom)
  if (openLineStart <= nodeFrom) return null
  if (nodeName === "BulletList" || nodeName === "OrderedList") {
    if (mathFrom !== openLineStart) return null
  } else if (!/^ {0,3}$/.test(markdown.slice(openLineStart, mathFrom))) {
    return null
  }
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
  nodeName: "Table" | "Blockquote" | "BulletList" | "OrderedList",
  nodeFrom: number,
  nodeTo: number,
  maths: readonly MathReplacementSpec[]
): number | null => {
  let effectiveTo = nodeTo
  for (const m of maths) {
    if (m.to <= nodeFrom) continue
    if (m.from >= effectiveTo) break
    if (!markdown.slice(m.from, m.to).includes("\n")) continue
    const absorbed = isAbsorbedDedicatedDisplayOpen(markdown, nodeName, nodeFrom, m.from)
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
