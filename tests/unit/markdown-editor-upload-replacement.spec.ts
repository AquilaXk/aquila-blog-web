import { expect, test } from "@playwright/test"
import { history, redo, undo } from "@codemirror/commands"
import { EditorState, Transaction } from "@codemirror/state"
import { planReplaceExactSubstring } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import { buildUploadReplacementTransactions } from "../../src/components/markdown-editor/markdownEditorUploadReplacement"

const placeholder = "[uploading: file]"
const replacement = "![image](/post/api/v1/images/posts/example.png)"

for (const [label, prefix, suffix, cursorAtStart] of [
  ["document end", "abc", "", false],
  ["document middle", "before", "after", false],
  ["cursor moved before upload", "abc", "", true],
] as const) {
  test(`replaces upload at ${label} and keeps history free of placeholders`, () => {
    const original = prefix + suffix
    let state = EditorState.create({ extensions: [history()] })
    state = state.update({ changes: { from: 0, insert: original } }).state
    state = state.update({
      changes: { from: prefix.length, insert: placeholder },
      selection: { anchor: cursorAtStart ? 0 : prefix.length + placeholder.length },
      annotations: Transaction.addToHistory.of(false),
    }).state
    const plan = planReplaceExactSubstring(
      state.doc.toString(), placeholder, replacement, state.selection.main.from, state.selection.main.to
    )!
    const transactions = buildUploadReplacementTransactions(state, plan)
    for (const transaction of transactions) {
      expect(transaction.startState).toBe(state)
      state = transaction.state
      expect(state.selection.main.to).toBeLessThanOrEqual(state.doc.length)
    }
    const finalDocument = prefix + replacement + suffix
    expect(state.doc.toString()).toBe(finalDocument)
    expect(state.selection.main.head).toBe(cursorAtStart ? 0 : prefix.length + replacement.length)

    const dispatch = (transaction: Transaction) => { state = transaction.state }
    expect(undo({ state, dispatch })).toBe(true)
    expect(state.doc.toString()).toBe(original)
    expect(redo({ state, dispatch })).toBe(true)
    expect(state.doc.toString()).toBe(finalDocument)
    expect(undo({ state, dispatch })).toBe(true)
    expect(undo({ state, dispatch })).toBe(true)
    expect(state.doc.toString()).toBe("")
  })
}

test("failed upload deletion retains the planned cursor and is not undoable", () => {
  const state = EditorState.create({
    doc: "abc" + placeholder,
    selection: { anchor: 3 + placeholder.length },
    extensions: [history()],
  })
  const plan = planReplaceExactSubstring(state.doc.toString(), placeholder, "", state.doc.length, state.doc.length)!
  const transactions = buildUploadReplacementTransactions(state, plan)
  expect(transactions).toHaveLength(1)
  expect(transactions[0].state.doc.toString()).toBe("abc")
  expect(transactions[0].state.selection.main.head).toBe(3)
  expect(undo({ state: transactions[0].state, dispatch: () => { throw new Error("unexpected history") } })).toBe(false)
})
