import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEventHandler,
  type DragEventHandler,
  type KeyboardEventHandler,
} from "react"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import { syntaxTree } from "@codemirror/language"
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state"
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  type DecorationSet,
} from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  buildMarkdownLivePreviewPlan,
  type MarkdownLivePreviewDecoration,
  type MarkdownLiveSelection,
} from "./markdownEditorLivePreview"

type MarkdownEditorSnapshot = {
  documentValue: string
  selection: MarkdownLiveSelection
}

type MarkdownEditorLiveSurfaceProps = {
  value: string
  disabled: boolean
  ariaDescription: string
  onChange: (
    value: string,
    editorFocused: boolean,
    options?: { clearUploadError?: boolean }
  ) => void
  onSelectionChange: (selection: MarkdownLiveSelection) => void
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
}

const externalDocumentChange = Annotation.define<boolean>()
const preserveUploadError = Annotation.define<boolean>()
const setComposition = StateEffect.define<boolean>()
const setPointerSelecting = StateEffect.define<boolean>()

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

class MarkdownMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
    super()
  }

  toDOM() {
    const marker = document.createElement("span")
    marker.className = this.className
    marker.setAttribute("aria-hidden", "true")
    marker.textContent = this.label
    return marker
  }
}

class MarkdownTaskWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super()
  }

  toDOM() {
    const checkbox = document.createElement("span")
    checkbox.className = "cm-live-task-checkbox"
    checkbox.setAttribute("aria-hidden", "true")
    checkbox.textContent = this.checked ? "✓" : ""
    return checkbox
  }
}

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
  if (state.field(compositionField)) return Decoration.none

  const markdownValue = state.doc.toString()
  const selections = state.selection.ranges.map(({ from, to }) => ({ from, to }))
  const plan = buildMarkdownLivePreviewPlan(
    markdownValue,
    syntaxTree(state).topNode,
    selections
  )
  const taskRanges = plan.filter(({ kind }) => kind === "task")
  const decorations = plan.flatMap((spec) => {
    if (spec.from === spec.to) return []
    if (
      spec.kind === "hide-mark" &&
      taskRanges.some((task) => spec.from >= task.from && spec.to <= task.to)
    ) {
      return []
    }
    if (spec.kind === "hide-mark") {
      return [Decoration.replace({}).range(spec.from, spec.to)]
    }
    if (spec.kind === "task") {
      const checked = /\[[xX]\]/.test(markdownValue.slice(spec.from, spec.to))
      return [Decoration.replace({ widget: new MarkdownTaskWidget(checked) }).range(spec.from, spec.to)]
    }
    if (spec.kind === "list-marker") {
      const source = markdownValue.slice(spec.from, spec.to)
      const label = /^\d/.test(source) ? source : "•"
      return [
        Decoration.replace({
          widget: new MarkdownMarkerWidget(label, "cm-live-list-marker"),
        }).range(spec.from, spec.to),
      ]
    }
    if (spec.kind === "quote-mark") {
      return [
        Decoration.replace({
          widget: new MarkdownMarkerWidget("", "cm-live-quote-marker"),
        }).range(spec.from, spec.to),
      ]
    }
    if (spec.kind === "heading") {
      return [
        Decoration.mark({
          class: `cm-live-heading cm-live-heading-${spec.level ?? 1}`,
        }).range(spec.from, spec.to),
      ]
    }
    const className = markClassByKind[spec.kind]
    return className ? [Decoration.mark({ class: className }).range(spec.from, spec.to)] : []
  })

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
      transaction.effects.some(
        (effect) => effect.is(setComposition) || effect.is(setPointerSelecting)
      )
      ? buildDecorations(transaction.state)
      : decorations.map(transaction.changes)
  },
  provide: (field) => EditorView.decorations.from(field),
})

const liveSurfaceTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
  ".cm-content": { minHeight: "640px", padding: "30px 32px" },
  ".cm-line": { padding: "0" },
  "@media (max-width: 820px)": {
    ".cm-content": { padding: "22px 18px" },
  },
})

export const MarkdownEditorLiveSurface = forwardRef<
  MarkdownEditorLiveSurfaceHandle,
  MarkdownEditorLiveSurfaceProps
>(function MarkdownEditorLiveSurface(
  {
    value,
    disabled,
    ariaDescription,
    onChange,
    onSelectionChange,
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
  const editableCompartmentRef = useRef(new Compartment())
  const historyCompartmentRef = useRef(new Compartment())
  const initialStateRef = useRef({ value, disabled, ariaDescription })
  onChangeRef.current = onChange
  onSelectionChangeRef.current = onSelectionChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const editableCompartment = editableCompartmentRef.current
    const historyCompartment = historyCompartmentRef.current
    const initialState = initialStateRef.current
    const state = EditorState.create({
      doc: initialState.value,
      extensions: [
        markdown({ extensions: GFM }),
        historyCompartment.of(history()),
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorView.lineWrapping,
        compositionField,
        pointerSelectingField,
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
            view.dom.ownerDocument.addEventListener("mouseup", finishPointerSelection, { once: true })
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
            !update.transactions.some((transaction) => transaction.annotation(externalDocumentChange))
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

  useImperativeHandle(ref, () => ({
    applyMutation: (plan, options) => {
      const view = viewRef.current
      if (!view) return false

      const preservedAnnotations = options?.clearUploadError === false
        ? [preserveUploadError.of(true)]
        : []
      if (options?.replaceTransientContent && plan.rangeStart < plan.rangeEnd) {
        view.dispatch({
          annotations: [Transaction.addToHistory.of(false), ...preservedAnnotations],
          changes: { from: plan.rangeStart, to: plan.rangeEnd, insert: "" },
          selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd),
        })
        if (plan.replacement) {
          view.dispatch({
            annotations: preservedAnnotations,
            changes: { from: plan.rangeStart, insert: plan.replacement },
            selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd),
            scrollIntoView: options.scrollIntoView !== false,
          })
        }
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
  }), [disabled, value])

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
