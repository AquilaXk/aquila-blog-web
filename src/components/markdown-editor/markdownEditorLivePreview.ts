import { GFM, parser } from "@lezer/markdown"
import { resolveInlineColorValue } from "../../libs/markdown/inlineColor"
import { findMarkdownHighlightSpans } from "../../libs/markdown/inlineHighlightModel"
import { findDoubleBraceColorSpans } from "../../libs/markdown/inlineTokenScanners"
import {
  INLINE_DELIMITER_SYNTAX_NODE_NAMES,
  augmentLivePreviewLiteralRangesWithMath,
  classifySyntaxNodeAgainstMath,
  collectSyntaxLiteralRanges,
  type MarkdownMathReplacementSpec,
} from "./markdownEditorMathModel"

export type MarkdownEditorSurfaceMode = "live" | "source" | "reading"

const fallbackMarkdownParser = parser.configure(GFM)

export const ENTRY_FLAG_IN_TASK = 1
export const ENTRY_FLAG_HAS_PRIMARY_HIDE = 2
export const ENTRY_FLAG_HAS_SECONDARY_HIDE = 4
export const ENTRY_KIND_MASK = 0x1f

const KIND_TO_CODE: Record<string, number> = {
  "hide-mark": 0, heading: 1, strong: 2, emphasis: 3, strikethrough: 4,
  "inline-code": 5, link: 6, task: 7, quote: 8, "quote-mark": 9,
  list: 10, "list-marker": 11, "fenced-code": 12, "horizontal-rule": 13,
  "inline-color": 14, highlight: 15, wikilink: 16,
}

export const packLivePreviewEntryMeta = (
  kind: MarkdownLivePreviewDecoration["kind"],
  flags = 0,
  level = 0
): number => ((KIND_TO_CODE[kind] ?? 0) & ENTRY_KIND_MASK) | ((flags & 0xff) << 5) | ((level & 0x7) << 13)

export const unpackLivePreviewEntryMeta = (packed: number) => ({
  kindCode: packed & ENTRY_KIND_MASK,
  flags: (packed >>> 5) & 0xff,
  level: (packed >>> 13) & 0x7,
})

export type MarkdownLiveSelection = { from: number; to: number }

type MarkdownSyntaxNode = {
  name: string
  from: number
  to: number
  firstChild: MarkdownSyntaxNode | null
  nextSibling: MarkdownSyntaxNode | null
}

export type MarkdownLiveSourceRange = MarkdownLiveSelection

export type MarkdownLivePreviewDecoration = {
  from: number
  to: number
  kind:
    | "hide-mark" | "heading" | "strong" | "emphasis" | "strikethrough"
    | "inline-code" | "link" | "task" | "quote" | "quote-mark"
    | "list" | "list-marker" | "fenced-code" | "horizontal-rule"
    | "inline-color" | "highlight" | "wikilink"
  level?: number
  color?: string
  target?: string
  alias?: string
  codeLanguage?: string
  flags?: number
}

export type MarkdownLivePreviewDecorationSpec = MarkdownLivePreviewDecoration

const WIKILINK_TOKEN_REGEX = /\[\[([^\]\r\n]+)\]\]/g

const clampOffset = (offset: number, length: number) => Math.max(0, Math.min(offset, length))

const normalizeSelection = (selection: MarkdownLiveSelection, length: number): MarkdownLiveSelection => {
  const from = clampOffset(Math.min(selection.from, selection.to), length)
  const to = clampOffset(Math.max(selection.from, selection.to), length)
  return { from, to }
}

const selectionIntersectsNode = (selection: MarkdownLiveSelection, node: MarkdownSyntaxNode) =>
  selection.from === selection.to
    ? selection.from >= node.from && selection.from < node.to
    : selection.from < node.to && selection.to > node.from

const resolveFallbackLineRange = (markdown: string, offset: number): MarkdownLiveSourceRange => {
  const from = markdown.lastIndexOf("\n", Math.max(0, offset - 1)) + 1
  const nextBreak = markdown.indexOf("\n", offset)
  return { from, to: nextBreak === -1 ? markdown.length : nextBreak }
}

const mergeRanges = (ranges: MarkdownLiveSourceRange[]) => {
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to)
  const merged: MarkdownLiveSourceRange[] = []
  for (const range of sorted) {
    const previous = merged.at(-1)
    if (previous && range.from <= previous.to) {
      previous.to = Math.max(previous.to, range.to)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

const hasPrecedingOverlap = (
  sortedRanges: ReadonlyArray<{ from: number; to: number }>,
  candidate: number,
  from: number
): boolean => {
  const candidateFrom = sortedRanges[candidate]!.from
  for (let i = candidate - 1; i >= 0; i -= 1) {
    if (sortedRanges[i]!.to > from) return true
    if (sortedRanges[i]!.to <= candidateFrom) break
  }
  return false
}

export const hasIntervalOverlap = (
  sortedRanges: ReadonlyArray<{ from: number; to: number }>,
  from: number,
  to: number
): boolean => {
  const len = sortedRanges.length
  if (len === 0 || from >= to) return false
  let low = 0
  let high = len - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (sortedRanges[mid]!.from < to) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (candidate === -1) return false
  return sortedRanges[candidate]!.to > from || hasPrecedingOverlap(sortedRanges, candidate, from)
}

export const hasEnclosingInterval = (
  sortedRanges: ReadonlyArray<{ from: number; to: number }>,
  from: number,
  to: number
): boolean => {
  let low = 0
  let high = sortedRanges.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (sortedRanges[mid].from <= from) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return candidate !== -1 && sortedRanges[candidate].to >= to
}

export const resolveMarkdownLiveSourceRanges = (
  markdown: string,
  documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[]
): MarkdownLiveSourceRange[] => {
  const sourceRanges: MarkdownLiveSourceRange[] = []

  for (const rawSelection of selections) {
    const selection = normalizeSelection(rawSelection, markdown.length)
    let matchedTopLevel = false
    for (let child = documentNode.firstChild; child; child = child.nextSibling) {
      if (selectionIntersectsNode(selection, child)) {
        sourceRanges.push({ from: child.from, to: child.to })
        matchedTopLevel = true
      }
    }
    if (!matchedTopLevel) {
      sourceRanges.push(resolveFallbackLineRange(markdown, selection.from))
    }
  }

  return mergeRanges(sourceRanges)
}

export const isTokenActive = (
  from: number,
  to: number,
  selections: readonly MarkdownLiveSelection[]
): boolean => {
  for (const sel of selections) {
    if (sel.from === sel.to) {
      if (sel.from >= from && sel.from <= to) return true
    } else if (sel.from < to && sel.to > from) {
      return true
    }
  }
  return false
}

const NODE_KIND_MAP: Partial<Record<string, MarkdownLivePreviewDecoration["kind"]>> = {
  StrongEmphasis: "strong", Emphasis: "emphasis", Strikethrough: "strikethrough",
  InlineCode: "inline-code", Link: "link", Task: "task", Blockquote: "quote",
  BulletList: "list", OrderedList: "list",
}

const decorationForNode = (node: MarkdownSyntaxNode): MarkdownLivePreviewDecoration | null => {
  if (node.name === "ListMark") return { from: node.from, to: node.to, kind: "list-marker" }
  if (node.name === "QuoteMark") return { from: node.from, to: node.to, kind: "quote-mark" }
  if (/^ATXHeading[1-6]$/.test(node.name)) {
    return { from: node.from, to: node.to, kind: "heading", level: Number(node.name.at(-1)) }
  }
  const kind = NODE_KIND_MAP[node.name]
  return kind ? { from: node.from, to: node.to, kind } : null
}

export type MarkdownLivePreviewPlanEntry = {
  from: number; to: number; kind: MarkdownLivePreviewDecoration["kind"]; flags?: number
  packedMeta: number; decoration: MarkdownLivePreviewDecoration
  hideWhenActiveRange?: MarkdownLiveSourceRange; secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
}

const createPlanEntry = (
  decoration: MarkdownLivePreviewDecoration,
  hideWhenActiveRange?: MarkdownLiveSourceRange,
  secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
): MarkdownLivePreviewPlanEntry => {
  const hideFlags =
    (hideWhenActiveRange ? ENTRY_FLAG_HAS_PRIMARY_HIDE : 0) |
    (secondaryHideWhenActiveRange ? ENTRY_FLAG_HAS_SECONDARY_HIDE : 0)
  const flags = (decoration.flags ?? 0) | hideFlags
  return {
    from: decoration.from, to: decoration.to, kind: decoration.kind, flags: decoration.flags,
    packedMeta: packLivePreviewEntryMeta(decoration.kind, flags, decoration.level ?? 0),
    decoration, hideWhenActiveRange, secondaryHideWhenActiveRange,
  }
}

export type MarkdownLivePreviewBundle = {
  entries: MarkdownLivePreviewPlanEntry[]
  mathSpecs: MarkdownMathReplacementSpec[]
}

const cachedPreviewEntriesByNode = new WeakMap<
  MarkdownSyntaxNode,
  { markdown: string; entries: MarkdownLivePreviewPlanEntry[]; mathSpecs: MarkdownMathReplacementSpec[] }
>()

const isWrappedSpanBlockedByLiterals = (
  span: { from: number; to: number; contentFrom: number; contentTo: number },
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[]
): boolean =>
  hasEnclosingInterval(blockLiteralRanges, span.from, span.to) ||
  hasIntervalOverlap(literalRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(literalRanges, span.contentTo, span.to) ||
  hasIntervalOverlap(wikilinkRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(wikilinkRanges, span.contentTo, span.to)

const collectWikilinkEntries = (
  markdown: string, literalRanges: readonly MarkdownLiveSourceRange[], entries: MarkdownLivePreviewPlanEntry[]
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges: MarkdownLiveSourceRange[] = []
  if (!markdown.includes("[[")) return wikilinkRanges
  for (const match of markdown.matchAll(WIKILINK_TOKEN_REGEX)) {
    const from = match.index
    const to = from + match[0].length
    if (hasIntervalOverlap(literalRanges, from, to)) continue
    const raw = match[1]
    const pipeIndex = raw.indexOf("|")
    const target = pipeIndex === -1 ? raw.trim() : raw.slice(0, pipeIndex).replace(/\\$/, "").trim()
    const alias = (pipeIndex === -1 ? undefined : raw.slice(pipeIndex + 1).trim()) || undefined
    if (!target) continue
    const activeRange = { from, to }
    wikilinkRanges.push(activeRange)
    entries.push(createPlanEntry({ from, to, kind: "wikilink", target, alias }, activeRange))
  }
  return wikilinkRanges
}

const collectInlineColorEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): void => {
  const spans = findDoubleBraceColorSpans(markdown, {
    trimTrailingContentWhitespace: false, allowEmptyContent: false, skipInlineCodeSpans: true, singleLine: true,
  })
  for (const span of spans) {
    if (isWrappedSpanBlockedByLiterals(span, blockLiteralRanges, literalRanges, wikilinkRanges)) continue
    const color = resolveInlineColorValue(span.colorToken)
    if (!color) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "inline-color", color }, activeRange),
      createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

const collectHighlightEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): void => {
  for (const span of findMarkdownHighlightSpans(markdown)) {
    if (isWrappedSpanBlockedByLiterals(span, blockLiteralRanges, literalRanges, wikilinkRanges)) continue
    if (!markdown.slice(span.contentFrom, span.contentTo).trim()) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "highlight" }),
      createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

const collectRegexPlanEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges = collectWikilinkEntries(markdown, literalRanges, entries)
  collectInlineColorEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries)
  collectHighlightEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries)
  return wikilinkRanges
}

const extractFencedCodeLanguage = (markdown: string, node: MarkdownSyntaxNode): string | undefined => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "CodeInfo") {
      return markdown.slice(child.from, child.to).trim().split(/\s+/)[0]?.trim() || undefined
    }
  }
  return undefined
}

const advanceTaskCursor = (
  taskRanges: readonly MarkdownLiveSourceRange[], startIndex: number, entryFrom: number
): number => {
  let idx = startIndex
  while (idx < taskRanges.length && taskRanges[idx]!.to < entryFrom) idx += 1
  return idx
}

const isEntryInsideTaskFrom = (
  entry: MarkdownLivePreviewPlanEntry, taskRanges: readonly MarkdownLiveSourceRange[], startIndex: number
): boolean => {
  for (let j = startIndex; j < taskRanges.length; j += 1) {
    const task = taskRanges[j]!
    if (task.from > entry.from) return false
    if (entry.from >= task.from && entry.to <= task.to) return true
  }
  return false
}

const tagEntriesInsideTasks = (
  entries: MarkdownLivePreviewPlanEntry[], taskRanges: readonly MarkdownLiveSourceRange[]
): void => {
  if (taskRanges.length === 0) return
  let taskIdx = 0
  for (const entry of entries) {
    if (entry.kind !== "hide-mark") continue
    taskIdx = advanceTaskCursor(taskRanges, taskIdx, entry.from)
    if (!isEntryInsideTaskFrom(entry, taskRanges, taskIdx)) continue
    const nextFlags = (entry.flags ?? 0) | ENTRY_FLAG_IN_TASK
    entry.flags = nextFlags
    entry.decoration.flags = nextFlags
    entry.packedMeta |= ENTRY_FLAG_IN_TASK << 5
  }
}

type LivePreviewAstWalkContext = {
  markdown: string; documentNode: MarkdownSyntaxNode
  wikilinkRanges: readonly MarkdownLiveSourceRange[]
  mathRanges: readonly MarkdownLiveSourceRange[]
  displayMathRanges: readonly MarkdownLiveSourceRange[]
  entries: MarkdownLivePreviewPlanEntry[]; taskRanges: MarkdownLiveSourceRange[]
}

const toNodeRange = (node: MarkdownSyntaxNode | null): MarkdownLiveSourceRange | undefined =>
  node ? { from: node.from, to: node.to } : undefined

const resolveHeaderMarkEnd = (markdown: string, initialTo: number): number => {
  let to = initialTo
  while (to < markdown.length && (markdown[to] === " " || markdown[to] === "\t")) to += 1
  return to
}

const createFencedCodeEntry = (markdown: string, node: MarkdownSyntaxNode): MarkdownLivePreviewPlanEntry => {
  const codeLanguage = extractFencedCodeLanguage(markdown, node)
  return createPlanEntry({
    from: node.from, to: node.to, kind: "fenced-code", ...(codeLanguage ? { codeLanguage } : {}),
  })
}

const appendLeafSyntaxEntry = (
  node: MarkdownSyntaxNode,
  parent: MarkdownSyntaxNode | null,
  activeHeading: MarkdownSyntaxNode | null,
  ctx: LivePreviewAstWalkContext
): boolean => {
  if (node.name === "HeaderMark") {
    const to = resolveHeaderMarkEnd(ctx.markdown, node.to)
    ctx.entries.push(createPlanEntry({ from: node.from, to, kind: "hide-mark" }, toNodeRange(parent)))
    return true
  }
  if (node.name === "URL") {
    if (parent?.name === "Link" || parent?.name === "Image") {
      ctx.entries.push(createPlanEntry({ from: node.from, to: node.to, kind: "hide-mark" }, toNodeRange(parent)))
    }
    return true
  }
  if (INLINE_DELIMITER_SYNTAX_NODE_NAMES.has(node.name)) {
    ctx.entries.push(
      createPlanEntry({ from: node.from, to: node.to, kind: "hide-mark" }, toNodeRange(parent), toNodeRange(activeHeading))
    )
    return true
  }
  if (node.name === "HorizontalRule") {
    const range = { from: node.from, to: node.to }
    ctx.entries.push(createPlanEntry({ ...range, kind: "horizontal-rule" }, range))
    return true
  }
  if (node.name === "FencedCode") {
    ctx.entries.push(createFencedCodeEntry(ctx.markdown, node))
    return true
  }
  return false
}

const visitChildNodes = (
  node: MarkdownSyntaxNode, activeHeading: MarkdownSyntaxNode | null,
  ctx: LivePreviewAstWalkContext, skipInlineDelimiters = false
): void => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (skipInlineDelimiters && INLINE_DELIMITER_SYNTAX_NODE_NAMES.has(child.name)) continue
    visitLivePreviewSyntaxNode(child, node, activeHeading, ctx)
  }
}

const visitLivePreviewSyntaxNode = (
  node: MarkdownSyntaxNode,
  parent: MarkdownSyntaxNode | null,
  currentHeading: MarkdownSyntaxNode | null,
  ctx: LivePreviewAstWalkContext
): void => {
  if (node === ctx.documentNode) {
    visitChildNodes(node, null, ctx)
    return
  }
  if (hasEnclosingInterval(ctx.wikilinkRanges, node.from, node.to)) return
  const mathDisposition = classifySyntaxNodeAgainstMath(node, ctx.mathRanges, ctx.displayMathRanges)
  if (mathDisposition === "skip") return

  const activeHeading = /^ATXHeading[1-6]$/.test(node.name) ? node : currentHeading
  if (appendLeafSyntaxEntry(node, parent, activeHeading, ctx)) return
  if (mathDisposition === "corrupted-inline") {
    visitChildNodes(node, activeHeading, ctx, true)
    return
  }
  if (node.name === "Task") ctx.taskRanges.push({ from: node.from, to: node.to })
  if (mathDisposition !== "suppress-container") {
    const decoration = decorationForNode(node)
    if (decoration) ctx.entries.push(createPlanEntry(decoration))
  }
  visitChildNodes(node, activeHeading, ctx)
}

export const getMarkdownLivePreviewBundle = (
  markdown: string,
  documentNode: MarkdownSyntaxNode = fallbackMarkdownParser.parse(markdown).topNode
): MarkdownLivePreviewBundle => {
  const cached = cachedPreviewEntriesByNode.get(documentNode)
  if (cached && cached.markdown === markdown) {
    return { entries: cached.entries, mathSpecs: cached.mathSpecs }
  }

  const entries: MarkdownLivePreviewPlanEntry[] = []
  const rawLiterals = collectSyntaxLiteralRanges(documentNode)
  const { literalRanges, blockLiteralRanges, mathRanges, displayMathRanges, mathSpecs } =
    augmentLivePreviewLiteralRangesWithMath(
      markdown,
      rawLiterals.literalRanges,
      rawLiterals.blockLiteralRanges,
      rawLiterals.interiorLiteralRanges
    )
  const wikilinkRanges = collectRegexPlanEntries(markdown, blockLiteralRanges, literalRanges, entries)
  const taskRanges: MarkdownLiveSourceRange[] = []
  visitLivePreviewSyntaxNode(documentNode, null, null, {
    markdown, documentNode, wikilinkRanges, mathRanges, displayMathRanges, entries, taskRanges,
  })

  entries.sort((a, b) => a.from - b.from || a.to - b.to)
  tagEntriesInsideTasks(entries, taskRanges)

  cachedPreviewEntriesByNode.set(documentNode, { markdown, entries, mathSpecs })
  return { entries, mathSpecs }
}

export const buildMarkdownLivePreviewEntries = (
  markdown: string,
  documentNode: MarkdownSyntaxNode = fallbackMarkdownParser.parse(markdown).topNode
): MarkdownLivePreviewPlanEntry[] => getMarkdownLivePreviewBundle(markdown, documentNode).entries

const PRIMARY_HIDE_BIT = ENTRY_FLAG_HAS_PRIMARY_HIDE << 5
const SECONDARY_HIDE_BIT = ENTRY_FLAG_HAS_SECONDARY_HIDE << 5

const isPlanEntryHiddenBySelection = (
  entry: MarkdownLivePreviewPlanEntry, selections: readonly MarkdownLiveSelection[]
): boolean => {
  const primary = entry.hideWhenActiveRange
  if ((entry.packedMeta & PRIMARY_HIDE_BIT) !== 0 && primary && isTokenActive(primary.from, primary.to, selections)) {
    return true
  }
  const secondary = entry.secondaryHideWhenActiveRange
  return (entry.packedMeta & SECONDARY_HIDE_BIT) !== 0 && Boolean(secondary && isTokenActive(secondary.from, secondary.to, selections))
}

export const resolveMarkdownLivePreviewPlanFromEntries = (
  entries: readonly MarkdownLivePreviewPlanEntry[],
  selections: readonly MarkdownLiveSelection[],
  composing = false,
  mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] => {
  if (mode === "source" || (composing && mode !== "reading")) return []
  const effectiveSelections = mode === "reading" ? [] : selections
  const hasSelections = effectiveSelections.length > 0
  const decorations: MarkdownLivePreviewDecoration[] = []
  for (const entry of entries) {
    if (hasSelections && isPlanEntryHiddenBySelection(entry, effectiveSelections)) continue
    decorations.push(entry.decoration)
  }
  return decorations
}

export const buildMarkdownLivePreviewPlan = (
  markdown: string, documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[], composing = false, mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] =>
  mode === "source" || (composing && mode !== "reading")
    ? []
    : resolveMarkdownLivePreviewPlanFromEntries(buildMarkdownLivePreviewEntries(markdown, documentNode), selections, composing, mode)

export const buildMarkdownLivePreviewDecorationSpecs = (
  markdown: string, selections: readonly MarkdownLiveSelection[],
  composing = false, mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] =>
  mode === "source" || (composing && mode !== "reading")
    ? []
    : resolveMarkdownLivePreviewPlanFromEntries(buildMarkdownLivePreviewEntries(markdown), selections, composing, mode)

export { computeMarkdownFoldRange } from "./markdownEditorFoldModel"
