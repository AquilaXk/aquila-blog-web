import { syntaxTree } from "@codemirror/language"
import { EditorState, StateEffect, StateField, type Range, type StateEffectType } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import {
  buildMarkdownLivePreviewEntries,
  hasIntervalOverlap,
  isTokenActive,
  resolveMarkdownLivePreviewPlanFromEntries,
  type MarkdownLivePreviewDecoration,
  type MarkdownLivePreviewPlanEntry,
} from "./markdownEditorLivePreview"
import {
  MarkdownCalloutWidget,
  MarkdownImageWidget,
  MarkdownMarkerWidget,
  MarkdownMathWidget,
  MarkdownMermaidWidget,
  MarkdownRuleWidget,
  MarkdownTableWidget,
  MarkdownTaskWidget,
  MarkdownWikilinkWidget,
} from "./markdownEditorWidgets"

export const setComposition = StateEffect.define<boolean>()
export const setPointerSelecting = StateEffect.define<boolean>()
export const setEditorMode = StateEffect.define<"live" | "source" | "reading">()
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
export const editorModeField = defineEffectStateField<"live" | "source" | "reading">("live", setEditorMode)
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
const QUOTE_MARKER_DECORATION = Decoration.replace({
  widget: new MarkdownMarkerWidget("", "cm-live-quote-marker"),
})
const BULLET_MARKER_DECORATION = Decoration.replace({
  widget: new MarkdownMarkerWidget("•", "cm-live-list-marker"),
})
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
    Object.entries(markClassByKind).map(([kind, className]) => [
      kind,
      Decoration.mark({ class: className! }),
    ])
  )

type RangeSpec = { from: number; to: number }
type TableReplacementSpec = RangeSpec & { markdown: string }
type CalloutReplacementSpec = RangeSpec & {
  type: string
  title: string
  content: string
  foldState: "+" | "-" | null
}
type ImageReplacementSpec = RangeSpec & { alt: string; src: string }
type MathReplacementSpec = RangeSpec & { math: string; displayMode: boolean }
type MermaidReplacementSpec = RangeSpec & { source: string }

let cachedDocStringEntry: { doc: EditorState["doc"]; text: string } | null = null
export const getDocString = (doc: EditorState["doc"]): string => {
  if (cachedDocStringEntry && cachedDocStringEntry.doc === doc) return cachedDocStringEntry.text
  const text = doc.toString()
  cachedDocStringEntry = { doc, text }
  return text
}

export const computeMinimalDocChange = (current: string, next: string) => {
  let from = 0
  const minLen = Math.min(current.length, next.length)
  while (from < minLen && current.charCodeAt(from) === next.charCodeAt(from)) from += 1
  if (
    from > 0 &&
    ((current.charCodeAt(from - 1) & 0xfc00) === 0xd800 ||
      (next.charCodeAt(from - 1) & 0xfc00) === 0xd800)
  ) {
    from -= 1
  }
  let currentEnd = current.length
  let nextEnd = next.length
  while (
    currentEnd > from &&
    nextEnd > from &&
    current.charCodeAt(currentEnd - 1) === next.charCodeAt(nextEnd - 1)
  ) {
    currentEnd -= 1
    nextEnd -= 1
  }
  if (
    (currentEnd < current.length && (current.charCodeAt(currentEnd) & 0xfc00) === 0xdc00) ||
    (nextEnd < next.length && (next.charCodeAt(nextEnd) & 0xfc00) === 0xdc00)
  ) {
    currentEnd += 1
    nextEnd += 1
  }
  return { from, to: currentEnd, insert: next.slice(from, nextEnd) }
}

let cachedDocBlocksEntry: {
  doc: EditorState["doc"]
  tree: ReturnType<typeof syntaxTree>
  markdownValue: string
  previewEntries: readonly MarkdownLivePreviewPlanEntry[]
  tables: TableReplacementSpec[]
  callouts: CalloutReplacementSpec[]
  images: ImageReplacementSpec[]
  maths: MathReplacementSpec[]
  mermaids: MermaidReplacementSpec[]
  activeWatchRanges: RangeSpec[]
} | null = null

const parseCalloutBlockquoteSpec = (raw: string, from: number, to: number): CalloutReplacementSpec | null => {
  const trimmed = raw.trim()
  const newlineIndex = trimmed.indexOf("\n")
  const firstLine = (newlineIndex >= 0 ? trimmed.slice(0, newlineIndex) : trimmed).replace(/\r$/, "")
  const calloutMatch = /^>[ \t]*\[!([a-zA-Z0-9_-]+)\]([+-])?/.exec(firstLine)
  if (!calloutMatch) return null
  const modifier = calloutMatch[2]
  return {
    from,
    to,
    type: calloutMatch[1] ?? "note",
    foldState: modifier === "+" || modifier === "-" ? modifier : null,
    title: firstLine.slice(calloutMatch[0].length).trim(),
    content: newlineIndex >= 0 ? trimmed.slice(newlineIndex + 1) : "",
  }
}

const parseImageReplacementSpec = (raw: string, from: number, to: number): ImageReplacementSpec | null => {
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

const collectMathReplacementSpecs = (markdownValue: string): MathReplacementSpec[] => {
  const maths: MathReplacementSpec[] = []
  if (!markdownValue.includes("$")) return maths
  const mathRegex = /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)(.+?)(?<!\$)\$/g
  let mathMatch: RegExpExecArray | null
  while ((mathMatch = mathRegex.exec(markdownValue)) !== null) {
    const from = mathMatch.index
    maths.push({
      from,
      to: from + mathMatch[0].length,
      math: mathMatch[1] ?? mathMatch[2] ?? "",
      displayMode: Boolean(mathMatch[1]),
    })
  }
  return maths
}

const ACTIVE_WIDGET_KINDS = new Set<MarkdownLivePreviewDecoration["kind"]>([
  "task",
  "wikilink",
  "list-marker",
  "quote-mark",
  "fenced-code",
])

const resolveTaskPrefixRange = (markdownValue: string, from: number, to: number) => {
  const markerMatch = /^\[[ xX]\]/.exec(markdownValue.slice(from, to))
  const markerTo = from + (markerMatch ? markerMatch[0].length : Math.min(3, to - from))
  let prefixFrom = from
  while (prefixFrom > 0 && /[ \t]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  if (prefixFrom > 0 && /[-+*]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  return { from: prefixFrom, to: markerTo, markerTo }
}

const buildActiveWatchRanges = (
  markdownValue: string,
  previewEntries: readonly MarkdownLivePreviewPlanEntry[],
  blockGroups: readonly (readonly RangeSpec[])[]
): RangeSpec[] => {
  const raw: RangeSpec[] = []
  for (const entry of previewEntries) {
    if (entry.hideWhenActiveRange) raw.push({ ...entry.hideWhenActiveRange })
    if (entry.secondaryHideWhenActiveRange) raw.push({ ...entry.secondaryHideWhenActiveRange })
    if (entry.kind === "task") {
      const taskPrefix = resolveTaskPrefixRange(markdownValue, entry.from, entry.to)
      raw.push({ from: taskPrefix.from, to: taskPrefix.to })
    } else if (ACTIVE_WIDGET_KINDS.has(entry.kind)) {
      raw.push({ from: entry.from, to: entry.to })
    }
  }
  for (const group of blockGroups) {
    for (const item of group) raw.push({ from: item.from, to: item.to })
  }
  raw.sort((a, b) => a.from - b.from || a.to - b.to)
  const deduped: RangeSpec[] = []
  for (const r of raw) {
    const prev = deduped.at(-1)
    if (!prev || prev.from !== r.from || prev.to !== r.to) deduped.push(r)
  }
  return deduped
}

export const haveSameActiveWatchHits = (
  activeWatchRanges: readonly RangeSpec[],
  prevSelections: readonly RangeSpec[],
  nextSelections: readonly RangeSpec[]
): boolean => {
  for (let i = 0; i < activeWatchRanges.length; i += 1) {
    const range = activeWatchRanges[i]!
    if (
      isTokenActive(range.from, range.to, prevSelections) !==
      isTokenActive(range.from, range.to, nextSelections)
    ) {
      return false
    }
  }
  return true
}

const getCachedDocBlocks = (state: EditorState) => {
  const tree = syntaxTree(state)
  if (
    cachedDocBlocksEntry &&
    cachedDocBlocksEntry.doc === state.doc &&
    cachedDocBlocksEntry.tree === tree
  ) {
    return cachedDocBlocksEntry
  }

  const markdownValue = getDocString(state.doc)
  const previewEntries = buildMarkdownLivePreviewEntries(markdownValue, tree.topNode)
  const tables: TableReplacementSpec[] = []
  const callouts: CalloutReplacementSpec[] = []
  const images: ImageReplacementSpec[] = []
  const mermaids: MermaidReplacementSpec[] = []
  const hasCalloutMarker = markdownValue.includes("[!")
  const hasMermaidMarker = /mermaid/i.test(markdownValue)

  tree.iterate({
    enter(node) {
      if (node.name === "Table") {
        tables.push({ from: node.from, to: node.to, markdown: markdownValue.slice(node.from, node.to) })
      } else if (node.name === "Blockquote" && hasCalloutMarker) {
        const callout = parseCalloutBlockquoteSpec(markdownValue.slice(node.from, node.to), node.from, node.to)
        if (callout) callouts.push(callout)
      } else if (node.name === "Image") {
        const img = parseImageReplacementSpec(markdownValue.slice(node.from, node.to), node.from, node.to)
        if (img) images.push(img)
      } else if (node.name === "FencedCode" && hasMermaidMarker) {
        const mermaid = parseMermaidReplacementSpec(markdownValue.slice(node.from, node.to), node.from, node.to)
        if (mermaid) mermaids.push(mermaid)
      }
    },
  })

  const maths = collectMathReplacementSpecs(markdownValue)
  const activeWatchRanges = buildActiveWatchRanges(markdownValue, previewEntries, [tables, callouts, images, maths, mermaids])

  cachedDocBlocksEntry = { doc: state.doc, tree, markdownValue, previewEntries, tables, callouts, images, maths, mermaids, activeWatchRanges }
  return cachedDocBlocksEntry
}

type PlanSpecDecorationContext = {
  state: EditorState
  markdownValue: string
  selections: { from: number; to: number }[]
  styledHeadingLineStarts: Set<number>
  styledCodeFenceLineStarts: Set<number>
  decorations: Range<Decoration>[]
}

const appendActiveAwareWidgetSpec = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
): boolean => {
  if (
    spec.kind !== "task" &&
    spec.kind !== "wikilink" &&
    spec.kind !== "list-marker" &&
    spec.kind !== "quote-mark"
  ) {
    return false
  }

  if (spec.kind === "task") {
    const taskPrefix = resolveTaskPrefixRange(ctx.markdownValue, spec.from, spec.to)
    if (isTokenActive(taskPrefix.from, taskPrefix.to, ctx.selections)) return true
    const checked = /\[[xX]\]/.test(ctx.markdownValue.slice(spec.from, taskPrefix.markerTo))
    ctx.decorations.push(
      Decoration.replace({
        widget: new MarkdownTaskWidget(checked, spec.from, taskPrefix.markerTo),
      }).range(spec.from, taskPrefix.markerTo)
    )
    if (ctx.markdownValue[taskPrefix.markerTo] === " " || ctx.markdownValue[taskPrefix.markerTo] === "\t") {
      ctx.decorations.push(TASK_SPACE_DECORATION.range(taskPrefix.markerTo, taskPrefix.markerTo + 1))
    }
    return true
  }

  if (spec.kind === "list-marker") {
    const taskGapMatch = /^([ \t]+)\[[ xX]\]/.exec(ctx.markdownValue.slice(spec.to, spec.to + 8))
    if (taskGapMatch) {
      if (!isTokenActive(spec.from, spec.to + taskGapMatch[0].length, ctx.selections)) {
        ctx.decorations.push(HIDE_MARK_DECORATION.range(spec.from, spec.to + taskGapMatch[1].length))
      }
      return true
    }
    if (isTokenActive(spec.from, spec.to, ctx.selections)) return true
    const source = ctx.markdownValue.slice(spec.from, spec.to)
    const label = /^\d/.test(source) ? source : "•"
    const deco =
      label === "•"
        ? BULLET_MARKER_DECORATION
        : Decoration.replace({ widget: new MarkdownMarkerWidget(label, "cm-live-list-marker") })
    ctx.decorations.push(deco.range(spec.from, spec.to))
    return true
  }

  if (isTokenActive(spec.from, spec.to, ctx.selections)) return true
  if (spec.kind === "wikilink") {
    ctx.decorations.push(
      Decoration.replace({
        widget: new MarkdownWikilinkWidget(spec.target ?? "", spec.alias, spec.from, spec.to),
      }).range(spec.from, spec.to)
    )
  } else {
    ctx.decorations.push(QUOTE_MARKER_DECORATION.range(spec.from, spec.to))
  }
  return true
}

const addCodeLineDecorationOnce = (
  ctx: PlanSpecDecorationContext,
  lineFrom: number,
  decoration: Decoration
) => {
  if (ctx.styledCodeFenceLineStarts.has(lineFrom)) return
  ctx.styledCodeFenceLineStarts.add(lineFrom)
  ctx.decorations.push(decoration.range(lineFrom))
}

const appendFencedCodeLineDecorations = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
) => {
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

const appendStructuralBlockSpec = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
): boolean => {
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

const appendSinglePlanSpecDecoration = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
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
      Decoration.mark({
        class: "cm-live-color",
        attributes: { style: `color: ${spec.color}` },
      }).range(spec.from, spec.to)
    )
    return
  }
  if (appendActiveAwareWidgetSpec(spec, ctx)) return
  if (appendStructuralBlockSpec(spec, ctx)) return
  const markDeco = MARK_DECORATION_BY_KIND[spec.kind]
  if (markDeco) ctx.decorations.push(markDeco.range(spec.from, spec.to))
}

export const buildDecorations = (state: EditorState): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source") return Decoration.none

  const { markdownValue, previewEntries, tables, callouts, images, maths, mermaids } =
    getCachedDocBlocks(state)
  const selections = state.selection.ranges.map(({ from, to }) => ({ from, to }))
  const isComposing = state.field(compositionField, false) ?? false
  const disableMermaid = state.field(disableMermaidField, false) ?? false
  const compSel = state.selection.main
  const compLine = isComposing ? state.doc.lineAt(compSel.head) : null
  const compFrom = compLine ? Math.min(compSel.from, compLine.from) : compSel.from
  const compTo = compLine ? Math.max(compSel.to, compLine.to) : compSel.to

  const isEligibleReplacement = (from: number, to: number) =>
    !isTokenActive(from, to, selections) && !(isComposing && compFrom <= to && compTo >= from)

  const tableReplacements = tables.filter((item) => isEligibleReplacement(item.from, item.to))
  const calloutReplacements = callouts.filter((item) => isEligibleReplacement(item.from, item.to))
  const imageReplacements = images.filter((item) => isEligibleReplacement(item.from, item.to))
  const mathReplacements = maths.filter((item) => isEligibleReplacement(item.from, item.to))
  const mermaidReplacements = disableMermaid
    ? []
    : mermaids.filter((item) => isEligibleReplacement(item.from, item.to))

  const replacedRanges = [
    ...tableReplacements,
    ...calloutReplacements,
    ...imageReplacements,
    ...mathReplacements,
    ...mermaidReplacements,
  ].sort((a, b) => (a.from !== b.from ? a.from - b.from : a.to - b.to))

  const plan = resolveMarkdownLivePreviewPlanFromEntries(previewEntries, selections)
  const decorations: Range<Decoration>[] = []
  const ctx: PlanSpecDecorationContext = {
    state,
    markdownValue,
    selections,
    styledHeadingLineStarts: new Set<number>(),
    styledCodeFenceLineStarts: new Set<number>(),
    decorations,
  }

  for (const spec of plan) {
    const checkTo = spec.kind === "task" ? Math.min(spec.to, spec.from + 3) : spec.to
    if (spec.from === checkTo || hasIntervalOverlap(replacedRanges, spec.from, checkTo)) continue
    if (isComposing && compFrom <= checkTo && compTo >= spec.from) continue
    appendSinglePlanSpecDecoration(spec, ctx)
  }

  for (const t of tableReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownTableWidget(t.markdown, t.from, t.to) }).range(t.from, t.to)
    )
  }
  for (const c of calloutReplacements) {
    decorations.push(
      Decoration.replace({
        widget: new MarkdownCalloutWidget(c.type, c.title, c.content, c.from, c.to, c.foldState),
      }).range(c.from, c.to)
    )
  }
  for (const img of imageReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownImageWidget(img.src, img.alt) }).range(img.from, img.to)
    )
  }
  for (const m of mathReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownMathWidget(m.math, m.displayMode) }).range(m.from, m.to)
    )
  }
  for (const m of mermaidReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownMermaidWidget(m.source, m.from) }).range(m.from, m.to)
    )
  }

  return Decoration.set(decorations, true)
}

export const decorationField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, transaction) => {
    if ((transaction.state.field(pointerSelectingField, false) ?? false) && !transaction.docChanged) {
      return decorations.map(transaction.changes)
    }
    const hasRelevantEffect = transaction.effects.some(
      (effect) =>
        effect.is(setComposition) ||
        (effect.is(setPointerSelecting) && !effect.value) ||
        effect.is(setEditorMode) ||
        effect.is(setDisableMermaid)
    )
    const treeChanged = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
    if (!transaction.docChanged && !treeChanged && !hasRelevantEffect) {
      if (!transaction.selection) return decorations
      const isComposing =
        (transaction.state.field(compositionField, false) ?? false) ||
        (transaction.startState.field(compositionField, false) ?? false)
      if (
        !isComposing &&
        haveSameActiveWatchHits(
          getCachedDocBlocks(transaction.state).activeWatchRanges,
          transaction.startState.selection.ranges,
          transaction.state.selection.ranges
        )
      ) {
        return decorations
      }
    }
    return transaction.docChanged ||
      transaction.selection ||
      treeChanged ||
      hasRelevantEffect
      ? buildDecorations(transaction.state)
      : decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})
