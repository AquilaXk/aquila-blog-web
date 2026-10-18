import { syntaxTree } from "@codemirror/language"
import {
  EditorState,
  StateEffect,
  StateField,
  type Range,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  type DecorationSet,
} from "@codemirror/view"
import {
  buildMarkdownLivePreviewEntries,
  ENTRY_FLAG_IN_TASK,
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

export const compositionField = StateField.define<boolean>({
  create: () => false,
  update: (composing, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setComposition)) return effect.value
    }
    return composing
  },
})

export const pointerSelectingField = StateField.define<boolean>({
  create: () => false,
  update: (selecting, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setPointerSelecting)) return effect.value
    }
    return selecting
  },
})

export const editorModeField = StateField.define<"live" | "source" | "reading">({
  create: () => "live",
  update: (mode, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorMode)) return effect.value
    }
    return mode
  },
})

export const disableMermaidField = StateField.define<boolean>({
  create: () => false,
  update: (disabled, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setDisableMermaid)) return effect.value
    }
    return disabled
  },
})

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
  if (cachedDocStringEntry && cachedDocStringEntry.doc === doc) {
    return cachedDocStringEntry.text
  }
  const text = doc.toString()
  cachedDocStringEntry = { doc, text }
  return text
}

export const computeMinimalDocChange = (current: string, next: string) => {
  let from = 0
  const minLen = Math.min(current.length, next.length)
  while (from < minLen && current.charCodeAt(from) === next.charCodeAt(from)) {
    from += 1
  }
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
} | null = null

const parseCalloutBlockquoteSpec = (
  raw: string,
  from: number,
  to: number
): CalloutReplacementSpec | null => {
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

const parseImageReplacementSpec = (
  raw: string,
  from: number,
  to: number
): ImageReplacementSpec | null => {
  const match = /^!\[([^\][\r\n]*)\]\(([^()\r\n]*)\)$/.exec(raw)
  if (!match) return null
  return {
    from,
    to,
    alt: match[1] ?? "",
    src: match[2] ?? "",
  }
}

const parseMermaidReplacementSpec = (
  raw: string,
  from: number,
  to: number
): MermaidReplacementSpec | null => {
  const lines = raw.split(/\r?\n/)
  if (lines.length < 2) return null
  const openMatch = /^( {0,3})(`{3,}|~{3,})\s*mermaid\b/i.exec(lines[0] ?? "")
  const closeLine = lines.at(-1) ?? ""
  if (!openMatch || !/^( {0,3})(`{3,}|~{3,})\s*$/.test(closeLine)) return null
  return {
    from,
    to,
    source: lines.slice(1, -1).join("\n"),
  }
}

const collectMathReplacementSpecs = (markdownValue: string): MathReplacementSpec[] => {
  const maths: MathReplacementSpec[] = []
  if (!markdownValue.includes("$")) return maths
  const mathRegex = /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)(.+?)(?<!\$)\$/g
  let mathMatch: RegExpExecArray | null
  while ((mathMatch = mathRegex.exec(markdownValue)) !== null) {
    const from = mathMatch.index
    const to = from + mathMatch[0].length
    const isDisplay = Boolean(mathMatch[1])
    const formula = mathMatch[1] ?? mathMatch[2] ?? ""
    maths.push({ from, to, math: formula, displayMode: isDisplay })
  }
  return maths
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

  tree.iterate({
    enter(node) {
      if (node.name === "Table") {
        tables.push({
          from: node.from,
          to: node.to,
          markdown: markdownValue.slice(node.from, node.to),
        })
      } else if (node.name === "Blockquote") {
        const callout = parseCalloutBlockquoteSpec(
          markdownValue.slice(node.from, node.to),
          node.from,
          node.to
        )
        if (callout) callouts.push(callout)
      } else if (node.name === "Image") {
        const img = parseImageReplacementSpec(
          markdownValue.slice(node.from, node.to),
          node.from,
          node.to
        )
        if (img) images.push(img)
      } else if (node.name === "FencedCode") {
        const mermaid = parseMermaidReplacementSpec(
          markdownValue.slice(node.from, node.to),
          node.from,
          node.to
        )
        if (mermaid) mermaids.push(mermaid)
      }
    },
  })

  const maths = collectMathReplacementSpecs(markdownValue)

  cachedDocBlocksEntry = {
    doc: state.doc,
    tree,
    markdownValue,
    previewEntries,
    tables,
    callouts,
    images,
    maths,
    mermaids,
  }
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
  if (spec.kind === "task") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      const checked = /\[[xX]\]/.test(ctx.markdownValue.slice(spec.from, spec.to))
      ctx.decorations.push(
        Decoration.replace({
          widget: new MarkdownTaskWidget(checked, spec.from, spec.to),
        }).range(spec.from, spec.to)
      )
    }
    return true
  }

  if (spec.kind === "wikilink") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      ctx.decorations.push(
        Decoration.replace({
          widget: new MarkdownWikilinkWidget(spec.target ?? "", spec.alias, spec.from, spec.to),
        }).range(spec.from, spec.to)
      )
    }
    return true
  }

  if (spec.kind === "list-marker") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      const source = ctx.markdownValue.slice(spec.from, spec.to)
      const label = /^\d/.test(source) ? source : "•"
      ctx.decorations.push(
        Decoration.replace({
          widget: new MarkdownMarkerWidget(label, "cm-live-list-marker"),
        }).range(spec.from, spec.to)
      )
    }
    return true
  }

  if (spec.kind === "quote-mark") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      ctx.decorations.push(
        Decoration.replace({
          widget: new MarkdownMarkerWidget("", "cm-live-quote-marker"),
        }).range(spec.from, spec.to)
      )
    }
    return true
  }

  return false
}

const addLineDecorationOnce = (
  ctx: PlanSpecDecorationContext,
  lineFrom: number,
  className: string,
  attributes?: Record<string, string>
) => {
  if (ctx.styledCodeFenceLineStarts.has(lineFrom)) return
  ctx.styledCodeFenceLineStarts.add(lineFrom)
  ctx.decorations.push(
    Decoration.line({
      class: className,
      attributes,
    }).range(lineFrom)
  )
}

const appendFencedCodeLineDecorations = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
) => {
  const startLine = ctx.state.doc.lineAt(spec.from)
  const endLine = ctx.state.doc.lineAt(spec.to)
  addLineDecorationOnce(
    ctx,
    startLine.from,
    "cm-live-code-line cm-live-code-fence-open",
    spec.codeLanguage ? { "data-code-lang": spec.codeLanguage } : undefined
  )
  for (let lineNo = startLine.number + 1; lineNo < endLine.number; lineNo += 1) {
    const bodyLine = ctx.state.doc.line(lineNo)
    addLineDecorationOnce(ctx, bodyLine.from, "cm-live-code-line cm-live-code-body-line")
  }
  if (endLine.number > startLine.number) {
    addLineDecorationOnce(ctx, endLine.from, "cm-live-code-line cm-live-code-fence-close")
  }
}

const appendStructuralBlockSpec = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
): boolean => {
  if (spec.kind === "heading") {
    const line = ctx.state.doc.lineAt(spec.from)
    if (!ctx.styledHeadingLineStarts.has(line.from)) {
      ctx.styledHeadingLineStarts.add(line.from)
      ctx.decorations.push(
        Decoration.line({
          class: `cm-live-heading-line cm-live-heading-line-${spec.level ?? 1}`,
        }).range(line.from)
      )
    }
    ctx.decorations.push(
      Decoration.mark({
        class: `cm-live-heading cm-live-heading-${spec.level ?? 1}`,
      }).range(spec.from, spec.to)
    )
    return true
  }

  if (spec.kind === "fenced-code") {
    if (!isTokenActive(spec.from, spec.to, ctx.selections)) {
      appendFencedCodeLineDecorations(spec, ctx)
    }
    ctx.decorations.push(
      Decoration.mark({ class: "cm-live-fenced-code" }).range(spec.from, spec.to)
    )
    return true
  }

  return false
}

const appendSinglePlanSpecDecoration = (
  spec: ReturnType<typeof resolveMarkdownLivePreviewPlanFromEntries>[number],
  ctx: PlanSpecDecorationContext
): void => {
  if (spec.kind === "hide-mark") {
    if (spec.flags === undefined || (spec.flags & ENTRY_FLAG_IN_TASK) === 0) {
      ctx.decorations.push(Decoration.replace({}).range(spec.from, spec.to))
    }
    return
  }

  if (spec.kind === "horizontal-rule") {
    ctx.decorations.push(
      Decoration.replace({ widget: new MarkdownRuleWidget() }).range(spec.from, spec.to)
    )
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

  const className = markClassByKind[spec.kind]
  if (className) {
    ctx.decorations.push(Decoration.mark({ class: className }).range(spec.from, spec.to))
  }
}

export const buildDecorations = (state: EditorState): DecorationSet => {
  const currentMode = state.field(editorModeField, false) ?? "live"
  if (currentMode === "source") {
    return Decoration.none
  }

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
    if (spec.from === spec.to) continue
    if (hasIntervalOverlap(replacedRanges, spec.from, spec.to)) continue
    if (isComposing && compFrom <= spec.to && compTo >= spec.from) continue
    appendSinglePlanSpecDecoration(spec, ctx)
  }

  for (const table of tableReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownTableWidget(table.markdown) }).range(
        table.from,
        table.to
      )
    )
  }

  for (const callout of calloutReplacements) {
    decorations.push(
      Decoration.replace({
        widget: new MarkdownCalloutWidget(
          callout.type,
          callout.title,
          callout.content,
          callout.from,
          callout.to,
          callout.foldState
        ),
      }).range(callout.from, callout.to)
    )
  }

  for (const img of imageReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownImageWidget(img.src, img.alt) }).range(
        img.from,
        img.to
      )
    )
  }

  for (const math of mathReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownMathWidget(math.math, math.displayMode) }).range(
        math.from,
        math.to
      )
    )
  }

  for (const mermaid of mermaidReplacements) {
    decorations.push(
      Decoration.replace({ widget: new MarkdownMermaidWidget(mermaid.source, mermaid.from) }).range(
        mermaid.from,
        mermaid.to
      )
    )
  }

  return Decoration.set(decorations, true)
}

export const decorationField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (decorations, transaction) => {
    if (transaction.state.field(pointerSelectingField) && !transaction.docChanged) {
      return decorations.map(transaction.changes)
    }
    return transaction.docChanged ||
      transaction.selection ||
      syntaxTree(transaction.startState) !== syntaxTree(transaction.state) ||
      transaction.effects.some(
        (effect) =>
          effect.is(setComposition) ||
          effect.is(setPointerSelecting) ||
          effect.is(setEditorMode) ||
          effect.is(setDisableMermaid)
      )
      ? buildDecorations(transaction.state)
      : decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})
