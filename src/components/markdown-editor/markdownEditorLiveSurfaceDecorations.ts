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
  return {
    from,
    to: currentEnd,
    insert: next.slice(from, nextEnd),
  }
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
        const raw = markdownValue.slice(node.from, node.to)
        const calloutMatch =
          /^>[ \t]*\[!([a-zA-Z0-9_-]+)\]([+-])?(?:[ \t]*([^\r\n]*))?(?:\r?\n([\s\S]*))?$/.exec(
            raw.trim()
          )
        if (calloutMatch) {
          const modifier = calloutMatch[2]
          callouts.push({
            from: node.from,
            to: node.to,
            type: calloutMatch[1] ?? "note",
            foldState: modifier === "+" || modifier === "-" ? modifier : null,
            title: (calloutMatch[3] ?? "").trim(),
            content: calloutMatch[4] ?? "",
          })
        }
      } else if (node.name === "Image") {
        const raw = markdownValue.slice(node.from, node.to)
        const match = /^!\[(.*?)\]\((.*?)\)$/.exec(raw)
        if (match) {
          images.push({
            from: node.from,
            to: node.to,
            alt: match[1] ?? "",
            src: match[2] ?? "",
          })
        }
      } else if (node.name === "FencedCode") {
        const raw = markdownValue.slice(node.from, node.to)
        const lines = raw.split(/\r?\n/)
        const openMatch = /^( {0,3})(`{3,}|~{3,})\s*mermaid\b/i.exec(lines[0] ?? "")
        const closeLine = lines[lines.length - 1] ?? ""
        if (
          openMatch &&
          lines.length >= 2 &&
          /^( {0,3})(`{3,}|~{3,})\s*$/.test(closeLine)
        ) {
          mermaids.push({
            from: node.from,
            to: node.to,
            source: lines.slice(1, -1).join("\n"),
          })
        }
      }
    },
  })

  const maths: MathReplacementSpec[] = []
  if (markdownValue.includes("$")) {
    const mathRegex = /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)(.+?)(?<!\$)\$/g
    let mathMatch: RegExpExecArray | null
    while ((mathMatch = mathRegex.exec(markdownValue)) !== null) {
      const from = mathMatch.index
      const to = from + mathMatch[0].length
      const isDisplay = Boolean(mathMatch[1])
      const formula = mathMatch[1] ?? mathMatch[2] ?? ""
      maths.push({ from, to, math: formula, displayMode: isDisplay })
    }
  }

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
  const styledHeadingLineStarts = new Set<number>()
  const styledCodeFenceLineStarts = new Set<number>()

  for (const spec of plan) {
    if (spec.from === spec.to) continue
    if (hasIntervalOverlap(replacedRanges, spec.from, spec.to)) continue

    const isUnderComposition = isComposing && compFrom <= spec.to && compTo >= spec.from
    if (isUnderComposition) continue

    if (
      spec.kind === "hide-mark" &&
      spec.flags !== undefined &&
      (spec.flags & ENTRY_FLAG_IN_TASK) !== 0
    ) {
      continue
    }

    if (spec.kind === "hide-mark") {
      decorations.push(Decoration.replace({}).range(spec.from, spec.to))
      continue
    }

    if (spec.kind === "horizontal-rule") {
      decorations.push(
        Decoration.replace({ widget: new MarkdownRuleWidget() }).range(spec.from, spec.to)
      )
      continue
    }

    if (spec.kind === "inline-color") {
      decorations.push(
        Decoration.mark({
          class: "cm-live-color",
          attributes: { style: `color: ${spec.color}` },
        }).range(spec.from, spec.to)
      )
      continue
    }

    if (spec.kind === "task") {
      if (!isTokenActive(spec.from, spec.to, selections)) {
        const checked = /\[[xX]\]/.test(markdownValue.slice(spec.from, spec.to))
        decorations.push(
          Decoration.replace({
            widget: new MarkdownTaskWidget(checked, spec.from, spec.to),
          }).range(spec.from, spec.to)
        )
      }
      continue
    }

    if (spec.kind === "wikilink") {
      if (!isTokenActive(spec.from, spec.to, selections)) {
        decorations.push(
          Decoration.replace({
            widget: new MarkdownWikilinkWidget(spec.target ?? "", spec.alias, spec.from, spec.to),
          }).range(spec.from, spec.to)
        )
      }
      continue
    }

    if (spec.kind === "list-marker") {
      if (!isTokenActive(spec.from, spec.to, selections)) {
        const source = markdownValue.slice(spec.from, spec.to)
        const label = /^\d/.test(source) ? source : "•"
        decorations.push(
          Decoration.replace({
            widget: new MarkdownMarkerWidget(label, "cm-live-list-marker"),
          }).range(spec.from, spec.to)
        )
      }
      continue
    }

    if (spec.kind === "quote-mark") {
      if (!isTokenActive(spec.from, spec.to, selections)) {
        decorations.push(
          Decoration.replace({
            widget: new MarkdownMarkerWidget("", "cm-live-quote-marker"),
          }).range(spec.from, spec.to)
        )
      }
      continue
    }

    if (spec.kind === "heading") {
      const line = state.doc.lineAt(spec.from)
      if (!styledHeadingLineStarts.has(line.from)) {
        styledHeadingLineStarts.add(line.from)
        decorations.push(
          Decoration.line({
            class: `cm-live-heading-line cm-live-heading-line-${spec.level ?? 1}`,
          }).range(line.from)
        )
      }
      decorations.push(
        Decoration.mark({
          class: `cm-live-heading cm-live-heading-${spec.level ?? 1}`,
        }).range(spec.from, spec.to)
      )
      continue
    }

    if (spec.kind === "fenced-code") {
      if (!isTokenActive(spec.from, spec.to, selections)) {
        const fenceLine = state.doc.lineAt(spec.from)
        if (!styledCodeFenceLineStarts.has(fenceLine.from)) {
          styledCodeFenceLineStarts.add(fenceLine.from)
          decorations.push(
            Decoration.line({
              class: "cm-live-code-fence-open",
              attributes: spec.codeLanguage
                ? { "data-code-lang": spec.codeLanguage }
                : undefined,
            }).range(fenceLine.from)
          )
        }
      }
      decorations.push(
        Decoration.mark({ class: "cm-live-fenced-code" }).range(spec.from, spec.to)
      )
      continue
    }

    const className = markClassByKind[spec.kind]
    if (className) {
      decorations.push(Decoration.mark({ class: className }).range(spec.from, spec.to))
    }
  }

  for (const table of tableReplacements) {
    decorations.push(
      Decoration.replace({
        widget: new MarkdownTableWidget(table.markdown),
      }).range(table.from, table.to)
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
      Decoration.replace({
        widget: new MarkdownImageWidget(img.src, img.alt),
      }).range(img.from, img.to)
    )
  }

  for (const math of mathReplacements) {
    decorations.push(
      Decoration.replace({
        widget: new MarkdownMathWidget(math.math, math.displayMode),
      }).range(math.from, math.to)
    )
  }

  for (const mermaid of mermaidReplacements) {
    decorations.push(
      Decoration.replace({
        widget: new MarkdownMermaidWidget(mermaid.source, mermaid.from),
      }).range(mermaid.from, mermaid.to)
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
