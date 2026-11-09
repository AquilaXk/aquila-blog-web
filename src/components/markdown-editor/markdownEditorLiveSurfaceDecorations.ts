import { syntaxTree } from "@codemirror/language"
import { EditorState, StateEffect, StateField, type Range, type StateEffectType } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import {
  getMarkdownLivePreviewBundle, isTokenActive, resolveMarkdownLivePreviewPlanFromEntries,
  type MarkdownEditorSurfaceMode, type MarkdownLivePreviewDecoration,
  type MarkdownLivePreviewPlanEntry, type MarkdownSyntaxNode,
} from "./markdownEditorLivePreview"
import {
  filterDisjointPreorderItems, filterItemsOutsideSortedRanges, isLivePlanSpecBlockedByReplacedRanges,
  isNodeShadowedByMath, resolveBlockNodeEndWithMath, type MathReplacementSpec,
} from "./markdownEditorMathModel"
export { collectMathReplacementSpecs } from "./markdownEditorMathModel"
import { parseStandaloneMarkdownImageLine } from "../../libs/markdown/renderingImageModel"
import { parseLeadingTableLayoutLine } from "./markdownEditorTableMetadataModel"
import {
  MarkdownCalloutWidget, MarkdownImageWidget, MarkdownMarkerWidget, MarkdownMathWidget,
  MarkdownMermaidWidget, MarkdownRuleWidget, MarkdownTableWidget, MarkdownTaskWidget, MarkdownWikilinkWidget,
  parseCalloutBlockquoteSpec, type CalloutReplacementSpec,
} from "./markdownEditorWidgets"
export { parseCalloutBlockquoteSpec } from "./markdownEditorWidgets"

export const setComposition = StateEffect.define<boolean>()
export const setPointerSelecting = StateEffect.define<boolean>()
export const setEditorMode = StateEffect.define<MarkdownEditorSurfaceMode>()
export const setDisableMermaid = StateEffect.define<boolean>()

const defineEffectStateField = <T>(initial: T, effectType: StateEffectType<T>) =>
  StateField.define<T>({
    create: () => initial,
    update: (value, transaction) => {
      for (const effect of transaction.effects) {
        if (effect.is(effectType)) return effect.value
      }
      return value
    },
  })

export const compositionField = defineEffectStateField(false, setComposition)
export const pointerSelectingField = defineEffectStateField(false, setPointerSelecting)
export const editorModeField = defineEffectStateField<MarkdownEditorSurfaceMode>("live", setEditorMode)
export const disableMermaidField = defineEffectStateField(false, setDisableMermaid)

const markClassByKind: Partial<Record<MarkdownLivePreviewDecoration["kind"], string>> = {
  strong: "cm-live-strong",
  emphasis: "cm-live-emphasis",
  strikethrough: "cm-live-strikethrough",
  "inline-code": "cm-live-inline-code",
  link: "cm-live-link",
  quote: "cm-live-quote",
  list: "cm-live-list",
  "fenced-code": "cm-live-fenced-code",
  highlight: "cm-live-highlight",
}

const HIDE_MARK_DECORATION = Decoration.replace({})
const TASK_SPACE_DECORATION = Decoration.mark({ class: "cm-live-task-space" })
const RULE_DECORATION = Decoration.replace({ widget: new MarkdownRuleWidget() })
const QUOTE_MARKER_DECORATION = Decoration.replace({ widget: new MarkdownMarkerWidget("", "cm-live-quote-marker") })
const BULLET_MARKER_DECORATION = Decoration.replace({ widget: new MarkdownMarkerWidget("•", "cm-live-list-marker") })
const CODE_FENCE_OPEN_DECORATION = Decoration.line({ class: "cm-live-code-line cm-live-code-fence-open" })
const CODE_BODY_LINE_DECORATION = Decoration.line({ class: "cm-live-code-line cm-live-code-body-line" })
const CODE_FENCE_CLOSE_DECORATION = Decoration.line({ class: "cm-live-code-line cm-live-code-fence-close" })
const HEADING_LINE_DECORATIONS = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-live-heading-line cm-live-heading-line-${level}` })
)
const HEADING_MARK_DECORATIONS = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.mark({ class: `cm-live-heading cm-live-heading-${level}` })
)
const MARK_DECORATION_BY_KIND: Partial<Record<MarkdownLivePreviewDecoration["kind"], Decoration>> =
  Object.fromEntries(
    Object.entries(markClassByKind).map(([kind, className]) => [kind, Decoration.mark({ class: className! })])
  )

type RangeSpec = { from: number; to: number }
type TableReplacementSpec = RangeSpec & { markdown: string }
type ImageReplacementSpec = RangeSpec & { alt: string; src: string; title?: string; widthPx?: number; align?: string }
type MermaidReplacementSpec = RangeSpec & { source: string }

let cachedDocStringEntry: { doc: EditorState["doc"]; text: string } | null = null
export const getDocString = (doc: EditorState["doc"]): string => {
  if (cachedDocStringEntry && cachedDocStringEntry.doc === doc) return cachedDocStringEntry.text
  const text = doc.toString()
  cachedDocStringEntry = { doc, text }
  return text
}

const isHighSurrogateUnit = (text: string, index: number): boolean => {
  const cp = text.codePointAt(index) ?? 0
  return cp > 0xffff || (cp >= 0xd800 && cp <= 0xdbff)
}

const isLowSurrogateUnit = (text: string, index: number): boolean => {
  const cp = text.codePointAt(index) ?? 0
  return cp >= 0xdc00 && cp <= 0xdfff
}

export const computeMinimalDocChange = (current: string, next: string) => {
  let from = 0
  const minLen = Math.min(current.length, next.length)
  while (from < minLen && current[from] === next[from]) from += 1
  if (from > 0 && (isHighSurrogateUnit(current, from - 1) || isHighSurrogateUnit(next, from - 1))) {
    from -= 1
  }
  let currentEnd = current.length
  let nextEnd = next.length
  while (currentEnd > from && nextEnd > from && current[currentEnd - 1] === next[nextEnd - 1]) {
    currentEnd -= 1
    nextEnd -= 1
  }
  if (
    (currentEnd < current.length && isLowSurrogateUnit(current, currentEnd)) ||
    (nextEnd < next.length && isLowSurrogateUnit(next, nextEnd))
  ) {
    currentEnd += 1
    nextEnd += 1
  }
  return { from, to: currentEnd, insert: next.slice(from, nextEnd) }
}

let cachedDocBlocksEntry: {
  doc: EditorState["doc"]; tree: ReturnType<typeof syntaxTree>; markdownValue: string
  previewEntries: readonly MarkdownLivePreviewPlanEntry[]; tables: TableReplacementSpec[]
  callouts: CalloutReplacementSpec[]; images: ImageReplacementSpec[]
  maths: MathReplacementSpec[]; mermaids: MermaidReplacementSpec[]; activeWatchRanges: RangeSpec[]
} | null = null

const resolveImageNodeEnd = (markdownValue: string, nodeTo: number): number => {
  const attrMatch = /^[ \t]*\{[^}\r\n]*\}/.exec(markdownValue.slice(nodeTo, nodeTo + 160))
  return attrMatch ? nodeTo + attrMatch[0].length : nodeTo
}

const parseImageReplacementSpec = (raw: string, from: number, to: number): ImageReplacementSpec | null => {
  if (!raw.includes("\n") && !raw.includes("\r")) {
    const parsed = parseStandaloneMarkdownImageLine(raw)
    if (parsed) {
      return { from, to, alt: parsed.alt, src: parsed.src, title: parsed.title, widthPx: parsed.widthPx, align: parsed.align }
    }
  }
  const match = /^!\[([^\][\r\n]*)\]\(([^()\r\n]*)\)$/.exec(raw)
  return match ? { from, to, alt: match[1] ?? "", src: match[2] ?? "" } : null
}

const parseMermaidReplacementSpec = (raw: string, from: number, to: number): MermaidReplacementSpec | null => {
  const firstBreak = raw.indexOf("\n")
  if (firstBreak === -1) return null
  const lastBreak = raw.lastIndexOf("\n")
  const firstLine = raw.slice(0, firstBreak).replace(/\r$/, "")
  const closeLine = raw.slice(lastBreak + 1).replace(/\r$/, "")
  const openMatch = /^( {0,3})(`{3,}|~{3,})\s*mermaid\b/i.exec(firstLine)
  if (!openMatch || !/^( {0,3})(`{3,}|~{3,})\s*$/.test(closeLine)) return null
  const bodyEnd = lastBreak > 0 && raw.codePointAt(lastBreak - 1) === 13 ? lastBreak - 1 : lastBreak
  const source = firstBreak >= lastBreak ? "" : raw.slice(firstBreak + 1, bodyEnd).replaceAll("\r\n", "\n")
  return { from, to, source }
}

const ACTIVE_WIDGET_KINDS = new Set<MarkdownLivePreviewDecoration["kind"]>([
  "task", "wikilink", "list-marker", "quote-mark", "fenced-code",
])

const resolveTaskPrefixRange = (markdownValue: string, from: number, to: number) => {
  const markerMatch = /^\[[ xX]\]/.exec(markdownValue.slice(from, to))
  const markerTo = from + (markerMatch ? markerMatch[0].length : Math.min(3, to - from))
  let prefixFrom = from
  while (prefixFrom > 0 && /[ \t]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  if (prefixFrom > 0 && /[-+*]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  return { from: prefixFrom, to: markerTo, markerTo }
}

const collectEntryWatchRanges = (
  markdownValue: string,
  entry: MarkdownLivePreviewPlanEntry,
  raw: RangeSpec[]
): void => {
  if (entry.hideWhenActiveRange) raw.push({ ...entry.hideWhenActiveRange })
  if (entry.secondaryHideWhenActiveRange) raw.push({ ...entry.secondaryHideWhenActiveRange })
  if (entry.kind === "task") {
    const taskPrefix = resolveTaskPrefixRange(markdownValue, entry.from, entry.to)
    raw.push({ from: taskPrefix.from, to: taskPrefix.to })
  } else if (ACTIVE_WIDGET_KINDS.has(entry.kind)) {
    raw.push({ from: entry.from, to: entry.to })
  }
}

const dedupeSortedRanges = (sorted: readonly RangeSpec[]): RangeSpec[] => {
  const deduped: RangeSpec[] = []
  for (const r of sorted) {
    const prev = deduped.at(-1)
    if (!prev || prev.from !== r.from || prev.to !== r.to) deduped.push(r)
  }
  return deduped
}

const buildActiveWatchRanges = (
  markdownValue: string,
  previewEntries: readonly MarkdownLivePreviewPlanEntry[],
  blockGroups: readonly (readonly RangeSpec[])[]
): RangeSpec[] => {
  const raw: RangeSpec[] = []
  for (const entry of previewEntries) collectEntryWatchRanges(markdownValue, entry, raw)
  for (const group of blockGroups) {
    for (const item of group) raw.push({ from: item.from, to: item.to })
  }
  raw.sort((a, b) => a.from - b.from || a.to - b.to)
  return dedupeSortedRanges(raw)
}

export const haveSameActiveWatchHits = (
  activeWatchRanges: readonly RangeSpec[],
  prevSelections: readonly RangeSpec[],
  nextSelections: readonly RangeSpec[]
): boolean => {
  for (let i = 0; i < activeWatchRanges.length; i += 1) {
    const range = activeWatchRanges[i]!
    if (isTokenActive(range.from, range.to, prevSelections) !== isTokenActive(range.from, range.to, nextSelections)) {
      return false
    }
  }
  return true
}

const pushIfPresent = <T>(list: T[], item: T | null) => {
  if (item) list.push(item)
}

const collectTableBlockSpec = (
  state: EditorState,
  markdownValue: string,
  nodeFrom: number,
  nodeTo: number
): TableReplacementSpec | null => {
  let tableFrom = nodeFrom
  const headerLine = state.doc.lineAt(nodeFrom)
  if (headerLine.number > 1) {
    const prevLine = state.doc.line(headerLine.number - 1)
    const parsedComment = parseLeadingTableLayoutLine(prevLine.text)
    if (parsedComment.kind === "malformed") return null
    if (parsedComment.kind === "valid") tableFrom = prevLine.from
  }
  return { from: tableFrom, to: nodeTo, markdown: markdownValue.slice(tableFrom, nodeTo) }
}

type DocBlockCollector = {
  state: EditorState; markdownValue: string; hasCalloutMarker: boolean; hasMermaidMarker: boolean
  maths: readonly MathReplacementSpec[]; tables: TableReplacementSpec[]
  callouts: CalloutReplacementSpec[]; images: ImageReplacementSpec[]; mermaids: MermaidReplacementSpec[]
}

const walkSyntaxTreeForDocBlocks = (node: MarkdownSyntaxNode, collector: DocBlockCollector): void => {
  if (node.name === "Table" || node.name === "Blockquote") {
    const end = resolveBlockNodeEndWithMath(collector.markdownValue, node.name, node.from, node.to, collector.maths)
    if (end !== null && !isNodeShadowedByMath(collector.maths, node.from, end)) {
      if (node.name === "Table") {
        pushIfPresent(collector.tables, collectTableBlockSpec(collector.state, collector.markdownValue, node.from, end))
      } else if (collector.hasCalloutMarker) {
        pushIfPresent(collector.callouts, parseCalloutBlockquoteSpec(collector.markdownValue.slice(node.from, end), node.from, end))
      }
    }
  } else if (!isNodeShadowedByMath(collector.maths, node.from, node.to)) {
    if (node.name === "Image") {
      const replaceTo = resolveImageNodeEnd(collector.markdownValue, node.to)
      pushIfPresent(collector.images, parseImageReplacementSpec(collector.markdownValue.slice(node.from, replaceTo), node.from, replaceTo))
    } else if (node.name === "FencedCode" && collector.hasMermaidMarker) {
      pushIfPresent(collector.mermaids, parseMermaidReplacementSpec(collector.markdownValue.slice(node.from, node.to), node.from, node.to))
    }
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    walkSyntaxTreeForDocBlocks(child, collector)
  }
}

const getCachedDocBlocks = (state: EditorState) => {
  const tree = syntaxTree(state)
  if (cachedDocBlocksEntry && cachedDocBlocksEntry.doc === state.doc && cachedDocBlocksEntry.tree === tree) {
    return cachedDocBlocksEntry
  }
  const markdownValue = getDocString(state.doc)
  const { entries: previewEntries, mathSpecs: maths, syntaxRoot } = getMarkdownLivePreviewBundle(markdownValue, tree.topNode)
  const collector: DocBlockCollector = {
    state, markdownValue, hasCalloutMarker: markdownValue.includes("[!"),
    hasMermaidMarker: /mermaid/i.test(markdownValue), maths,
    tables: [], callouts: [], images: [], mermaids: [],
  }
  walkSyntaxTreeForDocBlocks(syntaxRoot, collector)
  const { tables, callouts, images, mermaids } = collector
  const activeWatchRanges = buildActiveWatchRanges(markdownValue, previewEntries, [tables, callouts, images, maths, mermaids])
  cachedDocBlocksEntry = { doc: state.doc, tree, markdownValue, previewEntries, tables, callouts, images, maths, mermaids, activeWatchRanges }
  return cachedDocBlocksEntry
}

type PlanSpecDecorationContext = {
  state: EditorState; markdownValue: string; selections: { from: number; to: number }[]
  styledHeadingLineStarts: Set<number>; styledCodeFenceLineStarts: Set<number>
  decorations: Range<Decoration>[]
}

type ResolvedPreviewSpec = ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number]

const appendTaskWidgetSpec = (spec: ResolvedPreviewSpec, ctx: PlanSpecDecorationContext): void => {
  const taskPrefix = resolveTaskPrefixRange(ctx.markdownValue, spec.from, spec.to)
  if (isTokenActive(taskPrefix.from, taskPrefix.to, ctx.selections)) return
  const checked = /\[[xX]\]/.test(ctx.markdownValue.slice(spec.from, taskPrefix.markerTo))
  ctx.decorations.push(
    Decoration.replace({ widget: new MarkdownTaskWidget(checked, spec.from, taskPrefix.markerTo) }).range(spec.from, taskPrefix.markerTo)
  )
  if (ctx.markdownValue[taskPrefix.markerTo] === " " || ctx.markdownValue[taskPrefix.markerTo] === "\t") {
    ctx.decorations.push(TASK_SPACE_DECORATION.range(taskPrefix.markerTo, taskPrefix.markerTo + 1))
  }
}

const appendListMarkerWidgetSpec = (spec: ResolvedPreviewSpec, ctx: PlanSpecDecorationContext): void => {
  const taskGapMatch = /^([ \t]+)\[[ xX]\]/.exec(ctx.markdownValue.slice(spec.to, spec.to + 8))
  if (taskGapMatch) {
    if (!isTokenActive(spec.from, spec.to + taskGapMatch[0].length, ctx.selections)) {
      ctx.decorations.push(HIDE_MARK_DECORATION.range(spec.from, spec.to + taskGapMatch[1]!.length))
    }
    return
  }
  if (isTokenActive(spec.from, spec.to, ctx.selections)) return
  const source = ctx.markdownValue.slice(spec.from, spec.to)
  const deco = /^\d/.test(source)
    ? Decoration.replace({ widget: new MarkdownMarkerWidget(source, "cm-live-list-marker") })
    : BULLET_MARKER_DECORATION
  ctx.decorations.push(deco.range(spec.from, spec.to))
}

const appendActiveAwareWidgetSpec = (spec: ResolvedPreviewSpec, ctx: PlanSpecDecorationContext): boolean => {
  if (spec.kind === "task") {
    appendTaskWidgetSpec(spec, ctx)
    return true
  }
  if (spec.kind === "list-marker") {
    appendListMarkerWidgetSpec(spec, ctx)
    return true
  }
  if (spec.kind !== "wikilink" && spec.kind !== "quote-mark") return false
  if (isTokenActive(spec.from, spec.to, ctx.selections)) return true
  const deco =
    spec.kind === "wikilink"
      ? Decoration.replace({ widget: new MarkdownWikilinkWidget(spec.target ?? "", spec.alias, spec.from, spec.to) })
      : QUOTE_MARKER_DECORATION
  ctx.decorations.push(deco.range(spec.from, spec.to))
  return true
}

const addCodeLineDecorationOnce = (ctx: PlanSpecDecorationContext, lineFrom: number, decoration: Decoration) => {
  if (ctx.styledCodeFenceLineStarts.has(lineFrom)) return
  ctx.styledCodeFenceLineStarts.add(lineFrom)
  ctx.decorations.push(decoration.range(lineFrom))
}

const appendFencedCodeLineDecorations = (spec: ResolvedPreviewSpec, ctx: PlanSpecDecorationContext) => {
  const startLine = ctx.state.doc.lineAt(spec.from)
  const endLine = ctx.state.doc.lineAt(spec.to)
  const openDeco = spec.codeLanguage
    ? Decoration.line({
        class: "cm-live-code-line cm-live-code-fence-open",
        attributes: { "data-code-lang": spec.codeLanguage },
      })
    : CODE_FENCE_OPEN_DECORATION
  addCodeLineDecorationOnce(ctx, startLine.from, openDeco)
  for (let lineNo = startLine.number + 1; lineNo < endLine.number; lineNo += 1) {
    addCodeLineDecorationOnce(ctx, ctx.state.doc.line(lineNo).from, CODE_BODY_LINE_DECORATION)
  }
  if (endLine.number > startLine.number) {
    addCodeLineDecorationOnce(ctx, endLine.from, CODE_FENCE_CLOSE_DECORATION)
  }
}

const appendStructuralBlockSpec = (spec: ResolvedPreviewSpec, ctx: PlanSpecDecorationContext): boolean => {
  if (spec.kind === "heading") {
    const levelIdx = Math.max(0, Math.min(5, (spec.level ?? 1) - 1))
    const line = ctx.state.doc.lineAt(spec.from)
    if (!ctx.styledHeadingLineStarts.has(line.from)) {
      ctx.styledHeadingLineStarts.add(line.from)
      ctx.decorations.push(HEADING_LINE_DECORATIONS[levelIdx]!.range(line.from))
    }
    ctx.decorations.push(HEADING_MARK_DECORATIONS[levelIdx]!.range(spec.from, spec.to))
    return true
  }
  if (spec.kind === "fenced-code") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      appendFencedCodeLineDecorations(spec, ctx)
    }
    ctx.decorations.push(MARK_DECORATION_BY_KIND["fenced-code"]!.range(spec.from, spec.to))
    return true
  }
  return false
}

const appendSlicedContainerMark = (
  markDeco: Decoration,
  from: number,
  to: number,
  excludedRanges: readonly RangeSpec[],
  decorations: Range<Decoration>[]
): void => {
  let cursor = from
  for (const r of excludedRanges) {
    if (r.to <= cursor) continue
    if (r.from >= to) break
    if (r.from > cursor) decorations.push(markDeco.range(cursor, r.from))
    cursor = Math.max(cursor, r.to)
  }
  if (cursor < to) decorations.push(markDeco.range(cursor, to))
}

const appendSinglePlanSpecDecoration = (
  spec: ResolvedPreviewSpec,
  ctx: PlanSpecDecorationContext,
  blockOrMultiLineReplaced: readonly RangeSpec[]
): void => {
  if (spec.kind === "hide-mark") {
    ctx.decorations.push(HIDE_MARK_DECORATION.range(spec.from, spec.to))
    return
  }
  if (spec.kind === "horizontal-rule") {
    ctx.decorations.push(RULE_DECORATION.range(spec.from, spec.to))
    return
  }
  if (spec.kind === "inline-color") {
    ctx.decorations.push(
      Decoration.mark({ class: "cm-live-color", attributes: { style: `color: ${spec.color}` } }).range(spec.from, spec.to)
    )
    return
  }
  if (appendActiveAwareWidgetSpec(spec, ctx)) return
  if (appendStructuralBlockSpec(spec, ctx)) return
  const markDeco = MARK_DECORATION_BY_KIND[spec.kind]
  if (!markDeco) return
  if (spec.kind === "quote" || spec.kind === "list") {
    appendSlicedContainerMark(markDeco, spec.from, spec.to, blockOrMultiLineReplaced, ctx.decorations)
    return
  }
  ctx.decorations.push(markDeco.range(spec.from, spec.to))
}

const appendBlockWidgetDecorations = (
  decorations: Range<Decoration>[],
  groups: {
    tables: readonly TableReplacementSpec[]; callouts: readonly CalloutReplacementSpec[]
    images: readonly ImageReplacementSpec[]; maths: readonly MathReplacementSpec[]
    mermaids: readonly MermaidReplacementSpec[]
  }
) => {
  for (const t of groups.tables) {
    decorations.push(Decoration.replace({ widget: new MarkdownTableWidget(t.markdown, t.from, t.to) }).range(t.from, t.to))
  }
  for (const c of groups.callouts) {
    decorations.push(Decoration.replace({ widget: new MarkdownCalloutWidget(c.type, c.title, c.content, c.from, c.to, c.foldState) }).range(c.from, c.to))
  }
  for (const img of groups.images) {
    decorations.push(Decoration.replace({ widget: new MarkdownImageWidget(img.src, img.alt, img.widthPx, img.align, img.title) }).range(img.from, img.to))
  }
  for (const m of groups.maths) {
    decorations.push(Decoration.replace({ widget: new MarkdownMathWidget(m.math, m.displayMode) }).range(m.from, m.to))
  }
  for (const m of groups.mermaids) {
    decorations.push(Decoration.replace({ widget: new MarkdownMermaidWidget(m.source, m.from) }).range(m.from, m.to))
  }
}

const resolveCompositionRange = (state: EditorState, currentMode: MarkdownEditorSurfaceMode): RangeSpec | null => {
  if (currentMode === "reading" || !(state.field(compositionField, false) ?? false)) return null
  const compSel = state.selection.main
  const compLine = state.doc.lineAt(compSel.head)
  return { from: Math.min(compSel.from, compLine.from), to: Math.max(compSel.to, compLine.to) }
}

const overlapsComposition = (compRange: RangeSpec | null, from: number, to: number): boolean =>
  Boolean(compRange && compRange.from <= to && compRange.to >= from)

const filterEligibleBlockSpecs = <T extends RangeSpec>(
  items: readonly T[],
  selections: readonly RangeSpec[],
  compRange: RangeSpec | null
): T[] => items.filter((item) => !isTokenActive(item.from, item.to, selections) && !overlapsComposition(compRange, item.from, item.to))

const sortRanges = (ranges: RangeSpec[]): RangeSpec[] => {
  ranges.sort((a, b) => a.from - b.from || a.to - b.to)
  return ranges
}

const isPlanSpecSkipped = (
  markdownValue: string,
  spec: ResolvedPreviewSpec,
  replacedRanges: readonly RangeSpec[],
  compRange: RangeSpec | null
): boolean => {
  const checkTo = spec.kind === "task" ? Math.min(spec.to, spec.from + 3) : spec.to
  if (spec.from >= checkTo || overlapsComposition(compRange, spec.from, checkTo)) return true
  if (spec.kind === "quote" || spec.kind === "list") return false
  return isLivePlanSpecBlockedByReplacedRanges(markdownValue, spec.kind, spec.from, checkTo, replacedRanges)
}

export const buildDecorations = (state: EditorState): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source") return Decoration.none

  const { markdownValue, previewEntries, tables, callouts, images, maths, mermaids } = getCachedDocBlocks(state)
  const selections = currentMode === "reading" ? [] : state.selection.ranges.map(({ from, to }) => ({ from, to }))
  const compRange = resolveCompositionRange(state, currentMode)
  const disableMermaid = state.field(disableMermaidField, false) ?? false

  const filtered = {
    tables: filterEligibleBlockSpecs(tables, selections, compRange),
    callouts: filterDisjointPreorderItems(filterEligibleBlockSpecs(callouts, selections, compRange)),
    images: filterEligibleBlockSpecs(images, selections, compRange),
    maths: filterEligibleBlockSpecs(maths, selections, compRange),
    mermaids: disableMermaid ? [] : filterEligibleBlockSpecs(mermaids, selections, compRange),
  }
  filtered.tables = filterItemsOutsideSortedRanges(filtered.tables, filtered.callouts)
  filtered.mermaids = filterItemsOutsideSortedRanges(filtered.mermaids, filtered.callouts)
  const outerBlockRanges = sortRanges([...filtered.tables, ...filtered.callouts, ...filtered.mermaids])
  filtered.images = filterDisjointPreorderItems(filterItemsOutsideSortedRanges(filtered.images, outerBlockRanges))
  const nonMathRanges = sortRanges([...outerBlockRanges, ...filtered.images])
  filtered.maths = filterItemsOutsideSortedRanges(filtered.maths, nonMathRanges)
  const replacedRanges = sortRanges([...nonMathRanges, ...filtered.maths])
  const multiLineMaths = filtered.maths.filter((m) => markdownValue.slice(m.from, m.to).includes("\n"))
  const blockOrMultiLineReplaced = sortRanges([...nonMathRanges, ...multiLineMaths])

  const plan = resolveMarkdownLivePreviewPlanFromEntries(previewEntries, selections, false, currentMode)
  const decorations: Range<Decoration>[] = []
  const ctx: PlanSpecDecorationContext = {
    state, markdownValue, selections, decorations,
    styledHeadingLineStarts: new Set<number>(),
    styledCodeFenceLineStarts: new Set<number>(),
  }

  for (const spec of plan) {
    if (!isPlanSpecSkipped(markdownValue, spec, replacedRanges, compRange)) {
      appendSinglePlanSpecDecoration(spec, ctx, blockOrMultiLineReplaced)
    }
  }

  appendBlockWidgetDecorations(decorations, filtered)
  return Decoration.set(decorations, true)
}

const hasRelevantDecorationEffect = (effects: readonly StateEffect<unknown>[]): boolean =>
  effects.some(
    (effect) =>
      effect.is(setComposition) ||
      (effect.is(setPointerSelecting) && !effect.value) ||
      effect.is(setEditorMode) ||
      effect.is(setDisableMermaid)
  )

const canReuseSelectionDecorations = (startState: EditorState, nextState: EditorState): boolean => {
  if ((nextState.field(editorModeField, false) ?? "live") === "reading") return true
  const isComposing =
    (nextState.field(compositionField, false) ?? false) || (startState.field(compositionField, false) ?? false)
  if (isComposing) return false
  return haveSameActiveWatchHits(
    getCachedDocBlocks(nextState).activeWatchRanges,
    startState.selection.ranges,
    nextState.selection.ranges
  )
}

export const decorationField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, transaction) => {
    if ((transaction.state.field(pointerSelectingField, false) ?? false) && !transaction.docChanged) {
      return decorations.map(transaction.changes)
    }
    const hasRelevantEffect = hasRelevantDecorationEffect(transaction.effects)
    const treeChanged = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
    if (!transaction.docChanged && !treeChanged && !hasRelevantEffect) {
      if (!transaction.selection || canReuseSelectionDecorations(transaction.startState, transaction.state)) {
        return decorations
      }
    }
    return transaction.docChanged || transaction.selection || treeChanged || hasRelevantEffect
      ? buildDecorations(transaction.state)
      : decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})
