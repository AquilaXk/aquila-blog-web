import { expect, test } from "@playwright/test"
import { history, undo, undoDepth } from "@codemirror/commands"
import { Compartment, EditorState, Transaction } from "@codemirror/state"
import { readFileSync } from "fs"
import path from "path"
import { computeMinimalDocChange } from "../../src/components/markdown-editor/MarkdownEditorLiveSurface"
import { registeredBrowserStorageKeys } from "../../src/libs/privacy/browserStorageRegistry"

const sourcePath = (...parts: string[]) => path.resolve(__dirname, "../../src", ...parts)

test.describe("markdown editor live surface contract", () => {
  test("mounts one CodeMirror document authority with no separate mode or preview pane", () => {
    const editorSource = readFileSync(
      sourcePath("components", "markdown-editor", "MarkdownEditor.tsx"),
      "utf8"
    )
    const surfaceSource = readFileSync(
      sourcePath("components", "markdown-editor", "MarkdownEditorLiveSurface.tsx"),
      "utf8"
    )

    expect(editorSource).toContain("<MarkdownEditorLiveSurface")
    expect(editorSource).not.toContain("MarkdownEditorModeTabs")
    expect(editorSource).not.toContain("MarkdownRenderer")
    expect(editorSource).not.toContain("markdown-editor-preview-pane")
    expect(surfaceSource).toContain("new EditorView")
    expect(surfaceSource).toContain("externalDocumentChange")
    expect(surfaceSource).toContain("Transaction.addToHistory.of(false)")
    expect(surfaceSource).toContain("compositionstart")
    expect(surfaceSource).toContain("compositionend")
    expect(surfaceSource).not.toContain("textarea")
  })

  test("retires the editor mode storage contract instead of keeping a compatibility reader", () => {
    expect(registeredBrowserStorageKeys).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "aquila.markdown-editor.mode" }),
      ])
    )
  })

  test("preserves previous undo history when the controlled document is synced externally without recording the sync", () => {
    const historyCompartment = new Compartment()
    let state = EditorState.create({
      doc: "initial",
      extensions: [historyCompartment.of(history())],
    })
    state = state.update({ changes: { from: state.doc.length, insert: " edit" } }).state
    state = state.update({
      changes: computeMinimalDocChange(state.doc.toString(), "initial edit\nfooter"),
      annotations: Transaction.addToHistory.of(false),
    }).state

    expect(undoDepth(state)).toBeGreaterThan(0)
    let undoneText = ""
    expect(
      undo({
        state,
        dispatch: (tr) => {
          undoneText = tr.state.doc.toString()
        },
      })
    ).toBe(true)
    expect(undoneText).toBe("initial\nfooter")

    const surfaceSource = readFileSync(
      sourcePath("components", "markdown-editor", "MarkdownEditorLiveSurface.tsx"),
      "utf8"
    )
    expect(surfaceSource).toContain("Transaction.addToHistory.of(false)")
    expect(surfaceSource).toContain("computeMinimalDocChange")
    expect(surfaceSource).not.toContain("historyCompartment.reconfigure([])")
  })

  test("keeps the planned selection when a failed upload removes its placeholder", () => {
    const surfaceSource = readFileSync(
      sourcePath("components", "markdown-editor", "MarkdownEditorLiveSurface.tsx"),
      "utf8"
    )

    expect(surfaceSource).toContain(
      "selection: EditorSelection.range(plan.selectionStart, plan.selectionEnd)"
    )
    expect(surfaceSource).not.toContain("selection: EditorSelection.cursor(plan.rangeStart)")
  })

  test("keeps toolbar, find, focus, paste, drop, and upload paths on the live surface", () => {
    const editorSource = readFileSync(
      sourcePath("components", "markdown-editor", "MarkdownEditor.tsx"),
      "utf8"
    )

    expect(editorSource).toContain('aria-label="Markdown 작성 도구"')
    expect(editorSource).toContain("onFocusRequestReady")
    expect(editorSource).toContain("onKeyDownCapture={handleTextareaKeyDown}")
    expect(editorSource).toContain("onPasteCapture={handlePaste}")
    expect(editorSource).toContain("onDropCapture={handleDrop}")
    expect(editorSource).toContain("handleImageInput")
    expect(editorSource).toContain("handleFileInput")
    expect(editorSource).toContain("<MarkdownEditorFindReplace")
  })
})
