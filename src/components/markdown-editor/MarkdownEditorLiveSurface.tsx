import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEventHandler,
  type DragEventHandler,
  type KeyboardEventHandler,
} from "react"
import {
  defaultKeymap,
  history,
  historyKeymap,
  moveLineUp,
  moveLineDown,
  copyLineUp,
  copyLineDown,
} from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import {
  syntaxTree,
  LanguageDescription,
  LanguageSupport,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language"
import { autocompletion } from "@codemirror/autocomplete"
import {
  javascriptLanguage,
  typescriptLanguage,
  jsxLanguage,
  tsxLanguage,
} from "@codemirror/lang-javascript"
import { htmlLanguage } from "@codemirror/lang-html"
import { cssLanguage } from "@codemirror/lang-css"
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type Range,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  scrollPastEnd,
  keymap,
  type DecorationSet,
  type KeyBinding,
} from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"
import { buildUploadReplacementTransactions } from "./markdownEditorUploadReplacement"
import {
  buildMarkdownLivePreviewPlan,
  isTokenActive,
  type MarkdownLivePreviewDecoration,
  type MarkdownLiveSelection,
} from "./markdownEditorLivePreview"
import {
  MarkdownCalloutWidget,
  MarkdownImageWidget,
  MarkdownMarkerWidget,
  MarkdownMathWidget,
  MarkdownRuleWidget,
  MarkdownTableWidget,
  MarkdownTaskWidget,
} from "./markdownEditorWidgets"
import {
  codeLanguageCompletionSource,
  wikilinkCompletionSource,
} from "./markdownEditorCompletions"

type MarkdownEditorSnapshot = {
  documentValue: string
  selection: MarkdownLiveSelection
}

type MarkdownEditorLiveSurfaceProps = {
  value: string
  disabled: boolean
  mode?: "live" | "source"
  ariaDescription: string
  onChange: (
    value: string,
    editorFocused: boolean,
    options?: { clearUploadError?: boolean }
  ) => void
  onSelectionChange: (selection: MarkdownLiveSelection) => void
  onRequestFocusTitle?: () => void
  onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement>
  onPasteCapture?: ClipboardEventHandler<HTMLDivElement>
  onDragOver?: DragEventHandler<HTMLDivElement>
  onDropCapture?: DragEventHandler<HTMLDivElement>
}

type MarkdownEditorLiveMutationOptions = {
  focus?: boolean
  scrollIntoView?: boolean
  addToHistory?: boolean
  clearUploadError?: boolean
  replaceTransientContent?: boolean
}

export type MarkdownEditorLiveSurfaceHandle = {
  applyMutation: (
    plan: PlannedTextMutation,
    options?: MarkdownEditorLiveMutationOptions
  ) => boolean
  focus: (selection?: MarkdownLiveSelection) => void
  readSnapshot: () => MarkdownEditorSnapshot
  posAtCoords: (coords: { x: number; y: number }) => number | null
  setSelection: (selection: MarkdownLiveSelection) => void
}

const externalDocumentChange = Annotation.define<boolean>()
const preserveUploadError = Annotation.define<boolean>()
const setComposition = StateEffect.define<boolean>()
const setPointerSelecting = StateEffect.define<boolean>()
const setEditorMode = StateEffect.define<"live" | "source">()

const compositionField = StateField.define<boolean>({
  create: () => false,
  update: (composing, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setComposition)) return effect.value
    }
    return composing
  },
})

const pointerSelectingField = StateField.define<boolean>({
  create: () => false,
  update: (selecting, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setPointerSelecting)) return effect.value
    }
    return selecting
  },
})

const editorModeField = StateField.define<"live" | "source">({
  create: () => "live",
  update: (mode, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorMode)) return effect.value
    }
    return mode
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
}

const buildDecorations = (state: EditorState): DecorationSet => {
  if (state.field(editorModeField) === "source") {
    return Decoration.none
  }

  const markdownValue = state.doc.toString()
  const selections = state.selection.ranges.map(({ from, to }) => ({ from, to }))
  const isComposing = state.field(compositionField)
  const compSel = state.selection.main
  const compFrom = compSel.from
  const compTo = compSel.to

  // 1. Identify complex blocks (tables, callouts, images)
  type RangeSpec = { from: number; to: number }
  const tableReplacements: (RangeSpec & { markdown: string })[] = []
  const calloutReplacements: (RangeSpec & { type: string; title: string; content: string })[] = []
  const imageReplacements: (RangeSpec & { alt: string; src: string })[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Table") {
        if (!isTokenActive(node.from, node.to, selections)) {
          if (!(isComposing && compFrom <= node.to && compTo >= node.from)) {
            tableReplacements.push({
              from: node.from,
              to: node.to,
              markdown: markdownValue.slice(node.from, node.to),
            })
          }
        }
      } else if (node.name === "Blockquote") {
        const raw = markdownValue.slice(node.from, node.to)
        const calloutMatch = /^>\s*\[!([a-zA-Z0-9_-]+)\](?:\s*(.*))?(?:\n([\s\S]*))?$/.exec(
          raw.trim()
        )
        if (calloutMatch && !isTokenActive(node.from, node.to, selections)) {
          if (!(isComposing && compFrom <= node.to && compTo >= node.from)) {
            calloutReplacements.push({
              from: node.from,
              to: node.to,
              type: calloutMatch[1] ?? "note",
              title: calloutMatch[2] ?? "",
              content: calloutMatch[3] ?? "",
            })
          }
        }
      } else if (node.name === "Image") {
        if (!isTokenActive(node.from, node.to, selections)) {
          if (!(isComposing && compFrom <= node.to && compTo >= node.from)) {
            const raw = markdownValue.slice(node.from, node.to)
            const match = /^!\[(.*?)\]\((.*?)\)$/.exec(raw)
            if (match) {
              imageReplacements.push({
                from: node.from,
                to: node.to,
                alt: match[1] ?? "",
                src: match[2] ?? "",
              })
            }
          }
        }
      }
    },
  })

  // 2. Scan math formulas ($...$ and $$...$$) outside code blocks
  const mathReplacements: (RangeSpec & { math: string; displayMode: boolean })[] = []
  const mathRegex = /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)(.+?)(?<!\$)\$/g
  let mathMatch: RegExpExecArray | null
  while ((mathMatch = mathRegex.exec(markdownValue)) !== null) {
    const from = mathMatch.index
    const to = from + mathMatch[0].length
    if (isTokenActive(from, to, selections)) continue
    if (isComposing && compFrom <= to && compTo >= from) continue
    const isDisplay = Boolean(mathMatch[1])
    const formula = mathMatch[1] ?? mathMatch[2] ?? ""
    mathReplacements.push({ from, to, math: formula, displayMode: isDisplay })
  }

  const replacedRanges = [
    ...tableReplacements,
    ...calloutReplacements,
    ...imageReplacements,
    ...mathReplacements,
  ]

  const isOverlappedByWidget = (from: number, to: number) =>
    replacedRanges.some((r) => from < r.to && to > r.from)

  const plan = buildMarkdownLivePreviewPlan(
    markdownValue,
    syntaxTree(state).topNode,
    selections
  )
  const taskRanges = plan.filter(({ kind }) => kind === "task")
  const decorations: Range<Decoration>[] = []
  const styledHeadingLineStarts = new Set<number>()

  for (const spec of plan) {
    if (spec.from === spec.to) continue
    if (isOverlappedByWidget(spec.from, spec.to)) continue

    const isUnderComposition = isComposing && compFrom <= spec.to && compTo >= spec.from

    if (
      spec.kind === "hide-mark" &&
      taskRanges.some((task) => spec.from >= task.from && spec.to <= task.to)
    ) {
      continue
    }

    if (spec.kind === "hide-mark") {
      if (!isUnderComposition) {
        decorations.push(Decoration.replace({}).range(spec.from, spec.to))
      }
      continue
    }

    if (spec.kind === "horizontal-rule") {
      if (!isUnderComposition) {
        decorations.push(
          Decoration.replace({ widget: new MarkdownRuleWidget() }).range(spec.from, spec.to)
        )
      }
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
      if (!isUnderComposition) {
        const checked = /\[[xX]\]/.test(markdownValue.slice(spec.from, spec.to))
        decorations.push(
          Decoration.replace({
            widget: new MarkdownTaskWidget(checked, spec.from, spec.to),
          }).range(spec.from, spec.to)
        )
      }
      continue
    }

    if (spec.kind === "list-marker") {
      if (!isUnderComposition) {
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
      if (!isUnderComposition) {
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

    const className = markClassByKind[spec.kind]
    if (className) {
      decorations.push(Decoration.mark({ class: className }).range(spec.from, spec.to))
    }
  }

  // Add rich widgets
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
        widget: new MarkdownCalloutWidget(callout.type, callout.title, callout.content),
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

  return Decoration.set(decorations, true)
}

const decorationField = StateField.define<DecorationSet>({
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
          effect.is(setEditorMode)
      )
      ? buildDecorations(transaction.state)
      : decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const selectNextOccurrenceCommand = (view: EditorView): boolean => {
  const { state } = view
  const { selection, doc } = state
  const main = selection.main
  if (main.empty) {
    const word = state.wordAt(main.head)
    if (!word) return false
    view.dispatch({
      selection: EditorSelection.single(word.from, word.to),
      scrollIntoView: true,
    })
    return true
  }

  const selectedText = doc.sliceString(main.from, main.to)
  if (!selectedText) return false

  const docText = doc.toString()
  let nextIndex = docText.indexOf(selectedText, main.to)
  if (nextIndex === -1) {
    nextIndex = docText.indexOf(selectedText, 0)
  }
  if (nextIndex === -1 || (nextIndex === main.from && selection.ranges.length === 1)) {
    return false
  }

  const nextRange = EditorSelection.range(nextIndex, nextIndex + selectedText.length)
  if (selection.ranges.some((r) => r.from === nextRange.from && r.to === nextRange.to)) {
    return false
  }

  view.dispatch({
    selection: EditorSelection.create([...selection.ranges, nextRange]),
    scrollIntoView: true,
  })
  return true
}

const cycleTaskCommand = (view: EditorView): boolean => {
  const { state } = view
  const { selection, doc } = state
  const main = selection.main
  const line = doc.lineAt(main.head)
  const lineText = line.text

  const uncheckedMatch = /^(?<indent>\s*[-*+]\s+\[) (?<rest>\]\s*.*)$/.exec(lineText)
  if (uncheckedMatch?.groups) {
    const boxPos = line.from + uncheckedMatch.groups.indent.length - 1
    view.dispatch({
      changes: { from: boxPos, to: boxPos + 1, insert: "x" },
      userEvent: "input",
    })
    return true
  }

  const checkedMatch = /^(?<indent>\s*[-*+]\s+\[)[xX](?<rest>\]\s*.*)$/.exec(lineText)
  if (checkedMatch?.groups) {
    const boxPos = line.from + checkedMatch.groups.indent.length - 1
    view.dispatch({
      changes: { from: boxPos, to: boxPos + 1, insert: " " },
      userEvent: "input",
    })
    return true
  }

  const bulletMatch = /^(?<indent>\s*)(?:[-*+]|\d+\.)\s+(?<content>.*)$/.exec(lineText)
  if (bulletMatch?.groups) {
    const replacement = `${bulletMatch.groups.indent}- [ ] ${bulletMatch.groups.content}`
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: replacement },
      userEvent: "input",
    })
    return true
  }

  const plainMatch = /^(?<indent>\s*)(?<content>.*)$/.exec(lineText)
  const indent = plainMatch?.groups?.indent ?? ""
  const content = plainMatch?.groups?.content ?? ""
  const replacement = `${indent}- [ ] ${content}`
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: replacement },
    userEvent: "input",
  })
  return true
}

const handleFenceEnter: KeyBinding = {
  key: "Enter",
  run: (view) => {
    const { state } = view
    const { selection, doc } = state
    const { from, to } = selection.main
    if (from !== to) return false
    const line = doc.lineAt(from)
    const lineText = line.text
    const match = /^( {0,3})(`{3,}|~{3,})([a-zA-Z0-9_-]*)\s*$/.exec(lineText)
    if (!match) return false
    if (from < line.from + match[0].length) return false

    const restOfDoc = doc.sliceString(line.to)
    const closingPattern = new RegExp(`\n\\s*${match[2]}\\s*(\n|$)`)
    if (closingPattern.test(restOfDoc)) {
      return false
    }

    const indent = match[1] ?? ""
    const marker = match[2] ?? "```"
    const insertion = `\n${indent}\n${indent}${marker}`
    view.dispatch({
      changes: { from, to: from, insert: insertion },
      selection: EditorSelection.cursor(from + 1 + indent.length),
      scrollIntoView: true,
      userEvent: "input",
    })
    return true
  },
}

const codeLanguages = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "mjs", "cjs"],
    support: new LanguageSupport(javascriptLanguage),
  }),
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts"],
    support: new LanguageSupport(typescriptLanguage),
  }),
  LanguageDescription.of({
    name: "jsx",
    support: new LanguageSupport(jsxLanguage),
  }),
  LanguageDescription.of({
    name: "tsx",
    support: new LanguageSupport(tsxLanguage),
  }),
  LanguageDescription.of({
    name: "html",
    support: new LanguageSupport(htmlLanguage),
  }),
  LanguageDescription.of({
    name: "css",
    support: new LanguageSupport(cssLanguage),
  }),
  LanguageDescription.of({
    name: "json",
    support: new LanguageSupport(javascriptLanguage),
  }),
]

const liveSurfaceTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
  ".cm-content": {
    minHeight: "640px",
    maxWidth: "720px",
    margin: "0 auto",
    padding: "24px 32px 40px 32px",
  },
  ".cm-line": { padding: "0" },
  ".cm-live-heading-line-1": { marginTop: "1.5rem", marginBottom: "0.5rem" },
  ".cm-live-heading-line-2": { marginTop: "1.25rem", marginBottom: "0.4rem" },
  ".cm-live-heading-line-3": { marginTop: "1rem", marginBottom: "0.3rem" },
  ".cm-live-heading-line-4, .cm-live-heading-line-5, .cm-live-heading-line-6": {
    marginTop: "0.75rem",
    marginBottom: "0.25rem",
  },
  ".cm-live-task-checkbox": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    marginRight: "6px",
    borderRadius: "3px",
    border: "1.5px solid currentColor",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: "bold",
    verticalAlign: "middle",
    userSelect: "none",
  },
  ".cm-live-task-checkbox.is-checked": {
    backgroundColor: "currentColor",
    color: "#fff",
  },
  ".cm-live-image-wrap": {
    display: "block",
    margin: "8px 0",
  },
  ".cm-live-image": {
    maxWidth: "100%",
    borderRadius: "6px",
  },
  ".cm-live-callout": {
    borderLeft: "4px solid #3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: "4px",
    padding: "10px 14px",
    margin: "12px 0",
  },
  ".cm-live-callout-header": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "600",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-callout-fold": {
    fontSize: "10px",
    opacity: 0.7,
  },
  ".cm-live-callout.is-collapsed .cm-live-callout-body": {
    display: "none",
  },
  ".cm-live-callout-body": {
    marginTop: "6px",
    opacity: 0.9,
  },
  ".cm-live-table-wrap": {
    overflowX: "auto",
    margin: "12px 0",
  },
  ".cm-live-table": {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "0.9em",
  },
  ".cm-live-table th, .cm-live-table td": {
    border: "1px solid rgba(128, 128, 128, 0.3)",
    padding: "6px 12px",
    textAlign: "left",
  },
  ".cm-live-table th": {
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    fontWeight: "600",
  },
  "@media (max-width: 820px)": {
    ".cm-content": { padding: "18px 16px 32px 16px", maxWidth: "100%" },
  },
})

export const MarkdownEditorLiveSurface = forwardRef<
  MarkdownEditorLiveSurfaceHandle,
  MarkdownEditorLiveSurfaceProps
>(function MarkdownEditorLiveSurface(
  {
    value,
    disabled,
    mode = "live",
    ariaDescription,
    onChange,
    onSelectionChange,
    onRequestFocusTitle,
    onKeyDownCapture,
    onPasteCapture,
    onDragOver,
    onDropCapture,
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onRequestFocusTitleRef = useRef(onRequestFocusTitle)
  const editableCompartmentRef = useRef(new Compartment())
  const historyCompartmentRef = useRef(new Compartment())
  const initialStateRef = useRef({ value, disabled, ariaDescription })
  onChangeRef.current = onChange
  onSelectionChangeRef.current = onSelectionChange
  onRequestFocusTitleRef.current = onRequestFocusTitle

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const editableCompartment = editableCompartmentRef.current
    const historyCompartment = historyCompartmentRef.current
    const initialState = initialStateRef.current

    const customKeymaps: KeyBinding[] = [
      handleFenceEnter,
      { key: "Mod-Enter", run: cycleTaskCommand },
      { key: "Mod-d", run: selectNextOccurrenceCommand },
      { key: "Alt-ArrowUp", run: moveLineUp },
      { key: "Alt-ArrowDown", run: moveLineDown },
      { key: "Shift-Alt-ArrowUp", run: copyLineUp },
      { key: "Shift-Alt-ArrowDown", run: copyLineDown },
      {
        key: "ArrowUp",
        run: (view) => {
          if (view.state.selection.main.empty && view.state.selection.main.from === 0) {
            if (onRequestFocusTitleRef.current) {
              onRequestFocusTitleRef.current()
              return true
            }
          }
          return false
        },
      },
      {
        key: "Backspace",
        run: (view) => {
          if (view.state.selection.main.empty && view.state.selection.main.from === 0) {
            if (onRequestFocusTitleRef.current) {
              onRequestFocusTitleRef.current()
              return true
            }
          }
          return false
        },
      },
    ]

    const state = EditorState.create({
      doc: initialState.value,
      extensions: [
        markdown({
          extensions: GFM,
          codeLanguages,
        }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        autocompletion({
          override: [wikilinkCompletionSource, codeLanguageCompletionSource],
        }),
        scrollPastEnd(),
        historyCompartment.of(history()),
        keymap.of([...customKeymaps, ...historyKeymap, ...defaultKeymap]),
        EditorView.lineWrapping,
        compositionField,
        pointerSelectingField,
        editorModeField,
        decorationField,
        liveSurfaceTheme,
        EditorView.contentAttributes.of({
          "aria-label": "Markdown 본문",
          "aria-description": initialState.ariaDescription,
          title: initialState.ariaDescription,
          "data-testid": "markdown-editor-content",
          spellcheck: "false",
        }),
        editableCompartment.of([
          EditorState.readOnly.of(initialState.disabled),
          EditorView.editable.of(!initialState.disabled),
        ]),
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            if (
              event.button !== 0 ||
              event.shiftKey ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey
            ) {
              return false
            }
            view.dispatch({ effects: setPointerSelecting.of(true) })
            const finishPointerSelection = () => {
              if (!view.state.field(pointerSelectingField)) return
              view.dispatch({ effects: setPointerSelecting.of(false) })
            }
            view.dom.ownerDocument.addEventListener("mouseup", finishPointerSelection, {
              once: true,
            })
            return false
          },
          compositionstart: (_event, view) => {
            view.dispatch({ effects: setComposition.of(true) })
            return false
          },
          compositionend: (_event, view) => {
            view.dispatch({ effects: setComposition.of(false) })
            return false
          },
        }),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) =>
              transaction.annotation(externalDocumentChange)
            )
          ) {
            const shouldPreserveUploadError = update.transactions.some((transaction) =>
              transaction.annotation(preserveUploadError)
            )
            onChangeRef.current(
              update.state.doc.toString(),
              update.view.hasFocus,
              shouldPreserveUploadError ? { clearUploadError: false } : undefined
            )
          }
          if (update.selectionSet || update.docChanged) {
            const selection = update.state.selection.main
            onSelectionChangeRef.current({ from: selection.from, to: selection.to })
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: host })
    view.scrollDOM.tabIndex = 0
    viewRef.current = view
    const selection = view.state.selection.main
    onSelectionChangeRef.current({ from: selection.from, to: selection.to })

    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const next = [
      EditorState.readOnly.of(disabled),
      EditorView.editable.of(!disabled),
    ]
    view.dispatch({ effects: editableCompartmentRef.current.reconfigure(next) })
  }, [disabled])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setEditorMode.of(mode) })
  }, [mode])

  // CM6 Undo/Redo preservation: external doc sync without clearing history
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    const selection = view.state.selection.main
    const nextAnchor = Math.min(selection.anchor, value.length)
    const nextHead = Math.min(selection.head, value.length)
    const historyCompartment = historyCompartmentRef.current
    view.dispatch({
      annotations: [
        externalDocumentChange.of(true),
        Transaction.addToHistory.of(false),
      ],
      effects: historyCompartment.reconfigure([]),
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: EditorSelection.range(nextAnchor, nextHead),
    })
    view.dispatch({ effects: historyCompartment.reconfigure(history()) })
  }, [value])

  useImperativeHandle(
    ref,
    () => ({
      applyMutation: (plan, options) => {
        const view = viewRef.current
        if (!view) return false

        const preservedAnnotations =
          options?.clearUploadError === false ? [preserveUploadError.of(true)] : []
        if (options?.replaceTransientContent && plan.rangeStart < plan.rangeEnd) {
          view.dispatch(
            buildUploadReplacementTransactions(
              view.state,
              plan,
              preservedAnnotations,
              options.scrollIntoView !== false
            )
          )
          if (options.focus !== false && !disabled) view.focus()
          return true
        }

        view.dispatch({
          annotations: [
            ...(options?.addToHistory === false && !options.replaceTransientContent
              ? [Transaction.addToHistory.of(false)]
              : []),
            ...preservedAnnotations,
          ],
          changes: {
            from: plan.rangeStart,
            to: plan.rangeEnd,
            insert: plan.replacement,
          },
          selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd),
          scrollIntoView: options?.scrollIntoView !== false,
        })
        if (options?.focus !== false && !disabled) view.focus()
        return true
      },
      focus: (selection) => {
        const view = viewRef.current
        if (!view || disabled) return
        if (selection) {
          const from = Math.max(0, Math.min(selection.from, view.state.doc.length))
          const to = Math.max(0, Math.min(selection.to, view.state.doc.length))
          view.dispatch({ selection: EditorSelection.range(from, to), scrollIntoView: true })
        }
        view.focus()
      },
      readSnapshot: () => {
        const view = viewRef.current
        const selection = view?.state.selection.main
        return {
          documentValue: view?.state.doc.toString() ?? value,
          selection: selection ? { from: selection.from, to: selection.to } : { from: 0, to: 0 },
        }
      },
      posAtCoords: (coords) => {
        const view = viewRef.current
        if (!view) return null
        return view.posAtCoords(coords)
      },
      setSelection: (selection) => {
        const view = viewRef.current
        if (!view) return
        const from = Math.max(0, Math.min(selection.from, view.state.doc.length))
        const to = Math.max(0, Math.min(selection.to, view.state.doc.length))
        view.dispatch({ selection: EditorSelection.range(from, to) })
      },
    }),
    [disabled, value]
  )

  return (
    <div
      ref={hostRef}
      data-testid="markdown-editor-live-surface"
      onKeyDownCapture={onKeyDownCapture}
      onPasteCapture={onPasteCapture}
      onDragOver={onDragOver}
      onDropCapture={onDropCapture}
    />
  )
})
