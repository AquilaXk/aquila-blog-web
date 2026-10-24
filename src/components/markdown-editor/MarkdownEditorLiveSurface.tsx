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
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  foldService,
  syntaxHighlighting,
} from "@codemirror/language"
import { autocompletion, completionStatus } from "@codemirror/autocomplete"
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
} from "@codemirror/state"
import {
  EditorView,
  scrollPastEnd,
  keymap,
  type KeyBinding,
} from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"
import { buildUploadReplacementTransactions } from "./markdownEditorUploadReplacement"
import {
  computeMarkdownFoldRange,
  type MarkdownLiveSelection,
} from "./markdownEditorLivePreview"
export { computeMarkdownFoldRange } from "./markdownEditorLivePreview"
import {
  codeLanguageCompletionSource,
  wikilinkCompletionSource,
} from "./markdownEditorCompletions"
import {
  compositionField,
  computeMinimalDocChange,
  decorationField,
  disableMermaidField,
  editorModeField,
  getDocString,
  pointerSelectingField,
  setComposition,
  setDisableMermaid,
  setEditorMode,
  setPointerSelecting,
} from "./markdownEditorLiveSurfaceDecorations"
export {
  buildDecorations,
  compositionField,
  computeMinimalDocChange,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
  setComposition,
  setDisableMermaid,
} from "./markdownEditorLiveSurfaceDecorations"
import {
  codeLanguages,
  cycleTaskCommand,
  handleFenceEnter,
  liveSurfaceTheme,
  selectNextOccurrenceCommand,
} from "./markdownEditorLiveSurfaceCommands"
import { activeEmptyLineField } from "./markdownEditorNotionModel"
import { notionContainerBlockField } from "./markdownEditorNotionWidgets"

type MarkdownEditorSnapshot = {
  documentValue: string
  selection: MarkdownLiveSelection
}

type MarkdownEditorLiveSurfaceProps = {
  value: string
  disabled: boolean
  disableMermaid?: boolean
  mode?: "live" | "source" | "reading"
  ariaDescription: string
  onToggleViewMode?: () => void
  onChange: (
    value: string,
    editorFocused: boolean,
    options?: { clearUploadError?: boolean }
  ) => void
  onSelectionChange: (selection: MarkdownLiveSelection, docChanged?: boolean) => void
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
  coordsAtPos?: (pos: number) => { top: number; bottom: number; left: number; right: number } | null
  setSelection: (selection: MarkdownLiveSelection) => void
  isCompletionActive?: () => boolean
}

const externalDocumentChange = Annotation.define<boolean>()
const preserveUploadError = Annotation.define<boolean>()
export const LIVE_SURFACE_SCROLL_CLEARANCE = "40px"

export const MarkdownEditorLiveSurface = forwardRef<
  MarkdownEditorLiveSurfaceHandle,
  MarkdownEditorLiveSurfaceProps
>(function MarkdownEditorLiveSurface(
  {
    value,
    disabled,
    disableMermaid = false,
    mode = "live",
    ariaDescription,
    onToggleViewMode,
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
  const onToggleViewModeRef = useRef(onToggleViewMode)
  const editableCompartmentRef = useRef(new Compartment())
  const historyCompartmentRef = useRef(new Compartment())
  const initialStateRef = useRef({ value, disabled, disableMermaid, ariaDescription })
  onChangeRef.current = onChange
  onSelectionChangeRef.current = onSelectionChange
  onRequestFocusTitleRef.current = onRequestFocusTitle
  onToggleViewModeRef.current = onToggleViewMode

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const editableCompartment = editableCompartmentRef.current
    const historyCompartment = historyCompartmentRef.current
    const initialState = initialStateRef.current

    const customKeymaps: KeyBinding[] = [
      handleFenceEnter,
      {
        key: "Mod-e",
        run: () => {
          if (onToggleViewModeRef.current) {
            onToggleViewModeRef.current()
            return true
          }
          return false
        },
      },
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
        foldService.of(computeMarkdownFoldRange),
        foldGutter(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        autocompletion({
          override: [wikilinkCompletionSource, codeLanguageCompletionSource],
        }),
        scrollPastEnd(),
        historyCompartment.of(history()),
        keymap.of([...customKeymaps, ...foldKeymap, ...historyKeymap, ...defaultKeymap]),
        EditorView.lineWrapping,
        compositionField,
        pointerSelectingField,
        editorModeField,
        disableMermaidField.init(() => Boolean(initialState.disableMermaid)),
        decorationField,
        notionContainerBlockField,
        activeEmptyLineField,
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
              getDocString(update.state.doc),
              update.view.hasFocus,
              shouldPreserveUploadError ? { clearUploadError: false } : undefined
            )
          }
          if (update.selectionSet || update.docChanged) {
            const selection = update.state.selection.main
            onSelectionChangeRef.current({ from: selection.from, to: selection.to }, update.docChanged)
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: host })
    view.scrollDOM.tabIndex = 0
    viewRef.current = view
    const selection = view.state.selection.main
    onSelectionChangeRef.current({ from: selection.from, to: selection.to }, false)

    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const isReadOnly = disabled || mode === "reading"
    const next = [
      EditorState.readOnly.of(isReadOnly),
      EditorView.editable.of(!isReadOnly),
    ]
    view.dispatch({ effects: editableCompartmentRef.current.reconfigure(next) })
  }, [disabled, mode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setEditorMode.of(mode) })
  }, [mode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setDisableMermaid.of(Boolean(disableMermaid)) })
  }, [disableMermaid])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = getDocString(view.state.doc)
    if (currentDoc === value) return
    const selection = view.state.selection.main
    const nextAnchor = Math.min(selection.anchor, value.length)
    const nextHead = Math.min(selection.head, value.length)
    view.dispatch({
      annotations: [
        externalDocumentChange.of(true),
        Transaction.addToHistory.of(false),
      ],
      changes: computeMinimalDocChange(currentDoc, value),
      selection: EditorSelection.range(nextAnchor, nextHead),
    })
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
              : [Transaction.userEvent.of("input.type")]),
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
          documentValue: view ? getDocString(view.state.doc) : value,
          selection: selection ? { from: selection.from, to: selection.to } : { from: 0, to: 0 },
        }
      },
      posAtCoords: (coords) => {
        const view = viewRef.current
        if (!view) return null
        return view.posAtCoords(coords)
      },
      coordsAtPos: (pos) => {
        const view = viewRef.current
        if (!view) return null
        const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
        return view.coordsAtPos(clamped)
      },
      setSelection: (selection) => {
        const view = viewRef.current
        if (!view) return
        const from = Math.max(0, Math.min(selection.from, view.state.doc.length))
        const to = Math.max(0, Math.min(selection.to, view.state.doc.length))
        view.dispatch({ selection: EditorSelection.range(from, to) })
      },
      isCompletionActive: () => {
        const view = viewRef.current
        if (!view) return false
        return completionStatus(view.state) === "active"
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
