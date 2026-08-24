import { useCallback, useRef } from "react"
import { isComposingEditorKeyboardEvent } from "./markdownEditorKeyboardModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

type TextareaSelection = { from: number; to: number }

type EditorSnapshot = {
  documentValue: string
  selection: TextareaSelection
}

type HistoryEntry = { before: EditorSnapshot; after: EditorSnapshot }

type OperationHistory = {
  documentValue: string
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
}

type UseMarkdownEditorOperationHistoryArgs = {
  readSnapshot: () => EditorSnapshot | null
  applyRawMutationPlan: (plan: PlannedTextMutation) => boolean
}

type UndoRedoEvent = {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
  nativeEvent: { isComposing?: boolean; keyCode?: number }
}

export const useMarkdownEditorOperationHistory = ({
  readSnapshot,
  applyRawMutationPlan,
}: UseMarkdownEditorOperationHistoryArgs) => {
  const historyRef = useRef<OperationHistory | null>(null)

  const invalidate = useCallback(() => {
    historyRef.current = null
  }, [])

  const applyRecordedMutation = useCallback(
    (plan: PlannedTextMutation) => {
      const before = readSnapshot()
      if (!before || !applyRawMutationPlan(plan)) return false

      const after = readSnapshot()
      if (!after) return false
      if (
        before.documentValue === after.documentValue &&
        before.selection.from === after.selection.from &&
        before.selection.to === after.selection.to
      ) {
        return true
      }
      const current = historyRef.current
      const base = current && current.documentValue === before.documentValue
        ? current
        : { documentValue: before.documentValue, undoStack: [], redoStack: [] }
      historyRef.current = {
        documentValue: after.documentValue,
        undoStack: [...base.undoStack, { before, after }],
        redoStack: [],
      }
      return true
    },
    [applyRawMutationPlan, readSnapshot]
  )

  const handleUndoRedo = useCallback(
    (event: UndoRedoEvent): "pass" | "consume" | "applied" => {
      if (
        isComposingEditorKeyboardEvent(event) ||
        !event.metaKey && !event.ctrlKey ||
        event.altKey ||
        event.key.toLowerCase() !== "z"
      ) {
        return "pass"
      }

      const history = historyRef.current
      if (!history) return "pass"
      const snapshot = readSnapshot()
      if (!snapshot || snapshot.documentValue !== history.documentValue) return "pass"

      const undo = !event.shiftKey
      const entry = undo ? history.undoStack.at(-1) : history.redoStack[0]
      if (!entry) return "consume"

      const target = undo ? entry.before : entry.after
      if (
        !applyRawMutationPlan({
          rangeStart: 0,
          rangeEnd: snapshot.documentValue.length,
          replacement: target.documentValue,
          selectionStart: target.selection.from,
          selectionEnd: target.selection.to,
        })
      ) {
        return "consume"
      }

      historyRef.current = {
        documentValue: target.documentValue,
        undoStack: undo ? history.undoStack.slice(0, -1) : [...history.undoStack, entry],
        redoStack: undo ? [entry, ...history.redoStack] : history.redoStack.slice(1),
      }
      return "applied"
    },
    [applyRawMutationPlan, readSnapshot]
  )

  return { applyRecordedMutation, invalidate, handleUndoRedo }
}
