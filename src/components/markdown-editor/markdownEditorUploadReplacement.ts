import { EditorSelection, Transaction, type Annotation, type EditorState } from "@codemirror/state"
import { isolateHistory } from "@codemirror/commands"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export const buildUploadReplacementTransactions = (
  state: EditorState,
  plan: PlannedTextMutation,
  annotations: readonly Annotation<unknown>[] = [],
  scrollIntoView = true
): Transaction[] => {
  const deletion = state.update({
    annotations: [Transaction.addToHistory.of(false), ...annotations],
    changes: { from: plan.rangeStart, to: plan.rangeEnd, insert: "" },
    // A nonempty replacement's selection belongs to the final document, not this deletion.
    ...(!plan.replacement
      ? { selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd) }
      : {}),
  })
  if (!plan.replacement) return [deletion]

  const insertion = deletion.state.update({
    annotations: [isolateHistory.of("full"), ...annotations],
    changes: { from: plan.rangeStart, insert: plan.replacement },
    selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd),
    scrollIntoView,
  })
  return [deletion, insertion]
}
