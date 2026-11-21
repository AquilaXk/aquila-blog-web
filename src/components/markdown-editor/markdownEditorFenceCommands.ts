// 참조 구현: @codemirror/lang-markdown (MIT)
import { syntaxTree } from "@codemirror/language"
import { EditorSelection, Transaction, type EditorState } from "@codemirror/state"
import { EditorView, type KeyBinding } from "@codemirror/view"
import { compositionField } from "./markdownEditorLiveSurfaceDecorations"

const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/

const resolveEnclosingFencedCodeNode = (state: EditorState, pos: number) => {
  let node = syntaxTree(state).resolveInner(pos, 1) as ReturnType<
    ReturnType<typeof syntaxTree>["resolveInner"]
  > | null
  while (node) {
    if (node.name === "FencedCode") return node
    node = node.parent
  }
  return null
}

export const handleFenceEnter: KeyBinding = {
  key: "Enter",
  run: (view) => {
    if (view.composing || (view.state.field(compositionField, false) ?? false)) {
      return false
    }
    const { state } = view
    const { selection, doc } = state
    const { from, to } = selection.main
    if (from !== to) return false
    const line = doc.lineAt(from)
    if (from < line.to) return false

    const match = FENCE_OPEN_RE.exec(line.text)
    if (!match) return false

    const indent = match[1] ?? ""
    const marker = match[2] ?? "```"
    const info = match[3] ?? ""
    if (marker[0] === "`" && info.includes("`")) return false

    const fencedNode = resolveEnclosingFencedCodeNode(state, line.from + indent.length)
    if (fencedNode) {
      if (fencedNode.from < line.from) {
        return false
      }
      const closingMark = fencedNode.getChildren("CodeMark").some((mark) => mark.from > line.to)
      if (closingMark) {
        return false
      }
    }

    const insertion = `\n${indent}\n${indent}${marker}`
    view.dispatch({
      changes: { from, to: from, insert: insertion },
      selection: EditorSelection.cursor(from + 1 + indent.length),
      scrollIntoView: true,
      annotations: [Transaction.userEvent.of("input")],
    })
    return true
  },
}

export const handleFenceShiftEnter: KeyBinding = {
  key: "Shift-Enter",
  run: (view) => {
    if (view.composing || (view.state.field(compositionField, false) ?? false)) {
      return false
    }
    const { state } = view
    const { from, to } = state.selection.main
    let insideFence = false
    syntaxTree(state).iterate({
      from,
      to: from,
      enter: (node) => {
        if (node.name === "FencedCode") {
          const openLine = state.doc.lineAt(node.from)
          if (from > openLine.to && from <= node.to) {
            insideFence = true
          }
          return false
        }
      },
    })
    if (!insideFence) return false
    view.dispatch({
      changes: { from, to, insert: "\n" },
      selection: EditorSelection.cursor(from + 1),
      scrollIntoView: true,
      annotations: [Transaction.userEvent.of("input")],
    })
    return true
  },
}
