import { expect, test } from "@playwright/test"
import {
  isOffsetInsideFencedCodeBlock,
  matchListMarkerLine,
  planFormatShortcutMutation,
  planHardBreak,
  planListEnterContinuation,
  planTableCellTabMutation,
  planTabIndentMutation,
  resolveMarkdownEditorCommandShortcut,
  resolveFormatShortcut,
  resolveMarkdownEditorLineCommand,
} from "../../src/components/markdown-editor/markdownEditorKeyboardModel"
import {
  planIndentLines,
  planOutdentLines,
  planToggleWrapSelection,
} from "../../src/components/markdown-editor/markdownEditorTextMutation"

test.describe("markdown editor keyboard model", () => {
  test("toggles bold wrap and unwrap around a selection", () => {
    const wrapped = planFormatShortcutMutation("hello", 0, 5, "bold")
    expect(wrapped).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "**hello**",
      selectionStart: 2,
      selectionEnd: 7,
    })

    const unwrapped = planToggleWrapSelection("**hello**", 2, 7, "**", "**")
    expect(unwrapped).toEqual({
      rangeStart: 0,
      rangeEnd: 9,
      replacement: "hello",
      selectionStart: 0,
      selectionEnd: 5,
    })
  })

  test("toggles italic, strikethrough, and inline code wrappers", () => {
    expect(planFormatShortcutMutation("code", 0, 4, "italic").replacement).toBe("_code_")
    expect(planFormatShortcutMutation("code", 0, 4, "strikethrough").replacement).toBe("~~code~~")
    expect(planFormatShortcutMutation("code", 0, 4, "inlineCode").replacement).toBe("`code`")
  })

  test("inserts a markdown link with the URL selected", () => {
    expect(planFormatShortcutMutation("docs", 0, 4, "link")).toEqual({
      rangeStart: 0,
      rangeEnd: 4,
      replacement: "[docs](https://)",
      selectionStart: 7,
      selectionEnd: 15,
    })
  })

  test("maps common format shortcut chords", () => {
    expect(resolveFormatShortcut({ key: "i", metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })).toBe(
      "italic"
    )
    expect(resolveFormatShortcut({ key: "k", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(
      "link"
    )
    expect(resolveFormatShortcut({ key: "e", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(
      "inlineCode"
    )
    expect(resolveFormatShortcut({ key: "x", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })).toBe(
      "strikethrough"
    )
  })

  test("routes Mod+B through the shared command descriptor while retaining other format shortcuts", () => {
    const bold = resolveMarkdownEditorCommandShortcut({
      key: "b",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    })
    expect(bold?.id).toBe("format.bold")
    expect(bold?.execute({
      disabled: false,
      selectionStart: 0,
      selectionEnd: 5,
      isTableSelection: false,
    })).toEqual({ kind: "format", shortcut: "bold" })
    expect(resolveFormatShortcut({ key: "i", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(
      "italic"
    )
  })

  test("maps only the supported line command shortcut chords", () => {
    expect(resolveMarkdownEditorLineCommand({ key: "ArrowUp", metaKey: false, ctrlKey: false, shiftKey: false, altKey: true })).toBe(
      "move-up"
    )
    expect(resolveMarkdownEditorLineCommand({ key: "ArrowDown", metaKey: false, ctrlKey: false, shiftKey: false, altKey: true })).toBe(
      "move-down"
    )
    expect(resolveMarkdownEditorLineCommand({ key: "ArrowDown", metaKey: false, ctrlKey: false, shiftKey: true, altKey: true })).toBe(
      "duplicate"
    )
    expect(resolveMarkdownEditorLineCommand({ key: "k", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })).toBe(
      "delete"
    )
    expect(resolveMarkdownEditorLineCommand({ key: "K", metaKey: false, ctrlKey: true, shiftKey: true, altKey: false })).toBe(
      "delete"
    )

    expect(resolveMarkdownEditorLineCommand({ key: "ArrowDown", metaKey: true, ctrlKey: false, shiftKey: false, altKey: true })).toBeNull()
    expect(resolveMarkdownEditorLineCommand({ key: "ArrowDown", metaKey: false, ctrlKey: true, shiftKey: false, altKey: true })).toBeNull()
    expect(resolveMarkdownEditorLineCommand({ key: "ArrowUp", metaKey: false, ctrlKey: false, shiftKey: true, altKey: true })).toBeNull()
    expect(resolveMarkdownEditorLineCommand({ key: "k", metaKey: true, ctrlKey: true, shiftKey: true, altKey: false })).toBeNull()
    expect(resolveMarkdownEditorLineCommand({ key: "k", metaKey: true, ctrlKey: false, shiftKey: true, altKey: true })).toBeNull()
    expect(resolveMarkdownEditorLineCommand({ key: "q", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBeNull()
  })

  test("Shift+Enter plans a hard break with two trailing spaces", () => {
    expect(planHardBreak(3, 3)).toEqual({
      rangeStart: 3,
      rangeEnd: 3,
      replacement: "  \n",
      selectionStart: 6,
      selectionEnd: 6,
    })
  })

  test("continues unordered, ordered, task, and quote markers on Enter", () => {
    expect(planListEnterContinuation("- item", 6, 6)?.replacement).toBe("\n- ")
    expect(planListEnterContinuation("1. item", 7, 7)?.replacement).toBe("\n2. ")
    expect(planListEnterContinuation("- [ ] task", 10, 10)?.replacement).toBe("\n- [ ] ")
    expect(planListEnterContinuation("> quote", 7, 7)?.replacement).toBe("\n> ")
  })

  test("exits an empty list item on Enter by removing the marker", () => {
    expect(planListEnterContinuation("- ", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })
    expect(matchListMarkerLine("1. ").kind).toBe("ordered")
  })

  test("does not continue list markers inside fenced code blocks", () => {
    const fenced = ["```ts", "- item", "```"].join("\n")
    const caretInCode = fenced.indexOf("- item") + "- item".length
    expect(isOffsetInsideFencedCodeBlock(fenced, caretInCode)).toBe(true)
    expect(planListEnterContinuation(fenced, caretInCode, caretInCode)).toBeNull()

    const afterFence = ["```ts", "- item", "```", "", "- outside"].join("\n")
    const caretOutside = afterFence.lastIndexOf("- outside") + "- outside".length
    expect(isOffsetInsideFencedCodeBlock(afterFence, caretOutside)).toBe(false)
    expect(planListEnterContinuation(afterFence, caretOutside, caretOutside)?.replacement).toBe("\n- ")
  })

  test("indents and outdents multi-line selections with Tab / Shift+Tab", () => {
    const value = "alpha\nbeta\ngamma"
    const indented = planTabIndentMutation(value, 0, value.length, false)
    expect(indented?.replacement).toBe("  alpha\n  beta\n  gamma")

    const outdented = planTabIndentMutation(indented!.replacement, 0, indented!.replacement.length, true)
    expect(outdented?.replacement).toBe(value)
  })

  test("table cell Tab plans cell navigation before generic indentation", () => {
    const table = ["| A | B |", "| --- | --- |", "| one | two |"].join("\n")
    const firstCell = table.indexOf("A")
    const lastCell = table.indexOf("two")

    expect(planTableCellTabMutation(table, firstCell, firstCell, true)).toEqual({
      handledTable: true,
      mutation: null,
    })
    expect(planTableCellTabMutation(table, lastCell, lastCell, false)).toMatchObject({
      handledTable: true,
      mutation: { replacement: expect.stringContaining("|  |  |") },
    })
    expect(planTableCellTabMutation("alpha", 0, 0, false)).toMatchObject({
      handledTable: false,
      mutation: { replacement: "  alpha" },
    })
  })

  test("adjusts selection by indent applied only before each selection edge", () => {
    const value = "alpha\nbeta\ngamma"
    // Select only the middle line ("beta"): offsets 6..10
    const indented = planIndentLines(value, 6, 10)
    expect(indented).toEqual({
      rangeStart: 6,
      rangeEnd: 10,
      replacement: "  beta",
      // lineStart === selectionStart → start stays; end moves by indent on that line
      selectionStart: 6,
      selectionEnd: 12,
    })

    // Partial multi-line: from mid "alpha" through mid "gamma"
    const partial = planIndentLines(value, 2, 13)
    expect(partial.replacement).toBe("  alpha\n  beta\n  gamma")
    expect(partial.selectionStart).toBe(4) // +2 on first line only
    expect(partial.selectionEnd).toBe(19) // +2 per line with lineStart < end

    const outdented = planOutdentLines(partial.replacement, partial.selectionStart, partial.selectionEnd)
    expect(outdented).toEqual({
      rangeStart: 0,
      rangeEnd: partial.replacement.length,
      replacement: value,
      selectionStart: 2,
      selectionEnd: 13,
    })
  })

})
