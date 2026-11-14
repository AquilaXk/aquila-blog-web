import { syntaxTree } from "@codemirror/language"
import { EditorState, StateEffect, StateField, type Range, type StateEffectType } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import {
  buildActiveWatchRanges,
  resolveTaskPrefixRange,
  walkSyntaxTreeForDocBlocks,
  type DocBlockCollector,
  type ImageReplacementSpec,
  type MermaidReplacementSpec,
  type RangeSpec,
  type TableReplacementSpec,
} from "./markdownEditorLiveBlockCollector"
import {
  collectUniqueSortedIndicesForRegions,
  computeDirtyRegionsForTransaction,
  haveSameActiveWatchHitsIndexed,
  isRangeCoveredBySortedRegions,
  type DecorationRangeSpec,
} from "./markdownEditorLiveDecorationRegions"
import {
  getMarkdownLivePreviewBundle, isTokenActive, resolveMarkdownLivePreviewPlanFromEntries,
  type MarkdownEditorSurfaceMode, type MarkdownLivePreviewDecoration,
  type MarkdownLivePreviewPlanEntry,
} from "./markdownEditorLivePreview"
import {
  filterDisjointPreorderItems, filterItemsOutsideSortedRanges, hasNewlineBetween, isLivePlanSpecBlockedByReplacedRanges,
  type MathReplacementSpec,
} from "./markdownEditorMathModel"
export { collectMathReplacementSpecs } from "./markdownEditorMathModel"
import {
  MarkdownCalloutWidget, MarkdownImageWidget, MarkdownMarkerWidget, MarkdownMathWidget,
  MarkdownMermaidWidget, MarkdownRuleWidget, MarkdownTableWidget, MarkdownTaskWidget, MarkdownWikilinkWidget,
  type CalloutReplacementSpec,
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

const docStringCacheByDoc = new WeakMap<EditorState["doc"], string>()
export const getDocString = (doc: EditorState["doc"]): string => {
  let text = docStringCacheByDoc.get(doc)
  if (text === undefined) {
    text = doc.toString()
    docStringCacheByDoc.set(doc, text)
  }
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

type CachedDocBlocksEntry = {
  tree: ReturnType<typeof syntaxTree>
  markdownValue: string
  previewEntries: readonly MarkdownLivePreviewPlanEntry[]
  tables: TableReplacementSpec[]
  callouts: CalloutReplacementSpec[]
  images: ImageReplacementSpec[]
  maths: MathReplacementSpec[]
  mermaids: MermaidReplacementSpec[]
  blockGroups: readonly (readonly RangeSpec[])[]
  activeWatchRanges: RangeSpec[]
}

const docBlocksCacheByDoc = new WeakMap<EditorState["doc"], CachedDocBlocksEntry>()

export const haveSameActiveWatchHits = (
  activeWatchRanges: readonly RangeSpec[],
  prevSelections: readonly RangeSpec[],
  nextSelections: readonly RangeSpec[]
): boolean => haveSameActiveWatchHitsIndexed(activeWatchRanges, prevSelections, nextSelections)

const getCachedDocBlocksIfReady = (state: EditorState): CachedDocBlocksEntry | null => {
  const cached = docBlocksCacheByDoc.get(state.doc)
  return cached && cached.tree === syntaxTree(state) ? cached : null
}

const getCachedDocBlocks = (state: EditorState): CachedDocBlocksEntry => {
  const tree = syntaxTree(state)
  const existing = docBlocksCacheByDoc.get(state.doc)
  if (existing && existing.tree === tree) return existing
  const markdownValue = getDocString(state.doc)
  const { entries: previewEntries, mathSpecs: maths, syntaxRoot } = getMarkdownLivePreviewBundle(markdownValue, tree.topNode)
  const collector: DocBlockCollector = {
    state, markdownValue, hasCalloutMarker: markdownValue.includes("[!"),
    hasMermaidMarker: /mermaid/i.test(markdownValue), maths,
    tables: [], callouts: [], images: [], mermaids: [],
  }
  walkSyntaxTreeForDocBlocks(syntaxRoot, collector)
  const { tables, callouts, images, mermaids } = collector
  const blockGroups = [tables, callouts, images, maths, mermaids] as const
  const activeWatchRanges = buildActiveWatchRanges(markdownValue, previewEntries, blockGroups)
  const entry: CachedDocBlocksEntry = {
    tree, markdownValue, previewEntries, tables, callouts, images, maths, mermaids, blockGroups, activeWatchRanges,
  }
  docBlocksCacheByDoc.set(state.doc, entry)
  return entry
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

const pickItemsByRegions = <T extends DecorationRangeSpec>(
  items: readonly T[],
  targetRegions?: readonly DecorationRangeSpec[]
): readonly T[] => {
  if (!targetRegions) return items
  const indices = collectUniqueSortedIndicesForRegions(items, targetRegions)
  const picked: T[] = new Array(indices.length)
  for (let i = 0; i < indices.length; i += 1) picked[i] = items[indices[i]!]!
  return picked
}

const resolveDecorationsInScope = (
  state: EditorState,
  blocks: CachedDocBlocksEntry,
  currentMode: MarkdownEditorSurfaceMode,
  targetRegions?: readonly DecorationRangeSpec[]
): Range<Decoration>[] => {
  const { markdownValue, previewEntries, tables, callouts, images, maths, mermaids } = blocks
  const selections = currentMode === "reading" ? [] : state.selection.ranges.map(({ from, to }) => ({ from, to }))
  const compRange = resolveCompositionRange(state, currentMode)
  const disableMermaid = state.field(disableMermaidField, false) ?? false

  const filtered = {
    tables: filterEligibleBlockSpecs(pickItemsByRegions(tables, targetRegions), selections, compRange),
    callouts: filterDisjointPreorderItems(filterEligibleBlockSpecs(pickItemsByRegions(callouts, targetRegions), selections, compRange)),
    images: filterEligibleBlockSpecs(pickItemsByRegions(images, targetRegions), selections, compRange),
    maths: filterEligibleBlockSpecs(pickItemsByRegions(maths, targetRegions), selections, compRange),
    mermaids: disableMermaid ? [] : filterEligibleBlockSpecs(pickItemsByRegions(mermaids, targetRegions), selections, compRange),
  }
  filtered.tables = filterItemsOutsideSortedRanges(filtered.tables, filtered.callouts)
  filtered.mermaids = filterItemsOutsideSortedRanges(filtered.mermaids, filtered.callouts)
  const outerBlockRanges = sortRanges([...filtered.tables, ...filtered.callouts, ...filtered.mermaids])
  filtered.images = filterDisjointPreorderItems(filterItemsOutsideSortedRanges(filtered.images, outerBlockRanges))
  const nonMathRanges = sortRanges([...outerBlockRanges, ...filtered.images])
  filtered.maths = filterItemsOutsideSortedRanges(filtered.maths, nonMathRanges)
  const replacedRanges = sortRanges([...nonMathRanges, ...filtered.maths])
  const multiLineMaths = filtered.maths.filter((m) => hasNewlineBetween(markdownValue, m.from, m.to))
  const blockOrMultiLineReplaced = sortRanges([...nonMathRanges, ...multiLineMaths])

  const scopedEntries = pickItemsByRegions(previewEntries, targetRegions)
  const plan = resolveMarkdownLivePreviewPlanFromEntries(scopedEntries, selections, false, currentMode)
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
  return decorations
}

export const buildDecorations = (
  state: EditorState,
  visibleRanges?: readonly DecorationRangeSpec[]
): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source" || (visibleRanges && visibleRanges.length === 0)) return Decoration.none
  const blocks = getCachedDocBlocks(state)
  return Decoration.set(resolveDecorationsInScope(state, blocks, currentMode, visibleRanges), true)
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

const tryIncrementalDecorationUpdate = (
  decorations: DecorationSet,
  transaction: Parameters<Parameters<typeof StateField.define<DecorationSet>>[0]["update"]>[1],
  treeChanged: boolean
): DecorationSet | null => {
  if (!transaction.docChanged && treeChanged) return null
  const prevMode = transaction.startState.field(editorModeField, false) ?? "live"
  const nextMode = transaction.state.field(editorModeField, false) ?? "live"
  if (prevMode !== "live" || nextMode !== "live") return null
  if (
    (transaction.startState.field(compositionField, false) ?? false) ||
    (transaction.state.field(compositionField, false) ?? false) ||
    (transaction.startState.field(disableMermaidField, false) ?? false) !==
      (transaction.state.field(disableMermaidField, false) ?? false)
  ) {
    return null
  }
  const prevBlocks = transaction.docChanged ? getCachedDocBlocksIfReady(transaction.startState) : null
  if (transaction.docChanged && !prevBlocks) return null

  const nextBlocks = getCachedDocBlocks(transaction.state)
  const dirtyRegions = computeDirtyRegionsForTransaction(
    transaction.state,
    syntaxTree(transaction.startState),
    syntaxTree(transaction.state),
    transaction.changes,
    transaction.docChanged,
    transaction.startState.selection.ranges,
    transaction.state.selection.ranges,
    nextBlocks.blockGroups,
    prevBlocks ? prevBlocks.blockGroups : null
  )
  if (dirtyRegions === null) return null
  if (dirtyRegions.length === 0) {
    return transaction.docChanged ? decorations.map(transaction.changes) : decorations
  }
  const mapped = transaction.docChanged ? decorations.map(transaction.changes) : decorations
  const replacementDecos = resolveDecorationsInScope(transaction.state, nextBlocks, nextMode, dirtyRegions)
  return mapped.update({
    filterFrom: dirtyRegions[0]!.from,
    filterTo: dirtyRegions[dirtyRegions.length - 1]!.to,
    filter: (from, to) => !isRangeCoveredBySortedRegions(dirtyRegions, from, to),
    add: replacementDecos,
    sort: true,
  })
}

export const decorationField = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
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
    if (!transaction.docChanged && !transaction.selection && !treeChanged && !hasRelevantEffect) {
      return decorations.map(transaction.changes)
    }
    const incremental = !hasRelevantEffect
      ? tryIncrementalDecorationUpdate(decorations, transaction, treeChanged)
      : null
    return incremental ?? buildDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})
