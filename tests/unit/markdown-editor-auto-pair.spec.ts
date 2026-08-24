import { expect, test } from "@playwright/test"
import {
  planMarkdownEditorAutoPairBackspace,
  planMarkdownEditorAutoPairInsert,
} from "../../src/components/markdown-editor/markdownEditorAutoPairModel"

test.describe("markdown editor auto pair model", () => {
  test("inserts a bracket pair at a collapsed caret and skips its matching closer", () => {
    expect(planMarkdownEditorAutoPairInsert("note", 2, 2, "(")).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 2,
        rangeEnd: 2,
        replacement: "()",
        selectionStart: 3,
        selectionEnd: 3,
      },
    })
    expect(planMarkdownEditorAutoPairInsert("no()te", 3, 3, ")")).toEqual({
      kind: "select",
      selectionStart: 4,
      selectionEnd: 4,
    })
    expect(planMarkdownEditorAutoPairInsert("()", 1, 1, "(")).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 1,
        rangeEnd: 1,
        replacement: "()",
        selectionStart: 2,
        selectionEnd: 2,
      },
    })
  })

  test("wraps a single-line selection while preserving its inner selection", () => {
    expect(planMarkdownEditorAutoPairInsert("before text after", 7, 11, "[")).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 7,
        rangeEnd: 11,
        replacement: "[text]",
        selectionStart: 8,
        selectionEnd: 12,
      },
    })
  })

  test("inserts supported quote and bracket pairs", () => {
    for (const [key, replacement] of [["\"", "\"\""], ["'", "''"], ["{", "{}"]] as const) {
      expect(planMarkdownEditorAutoPairInsert("", 0, 0, key)).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 0,
        rangeEnd: 0,
        replacement,
        selectionStart: 1,
        selectionEnd: 1,
      },
      })
    }
  })

  test("inserts an inline-code pair away from a fence-leading prefix", () => {
    expect(planMarkdownEditorAutoPairInsert("x", 1, 1, "`")).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 1,
        rangeEnd: 1,
        replacement: "``",
        selectionStart: 2,
        selectionEnd: 2,
      },
    })
  })

  test("deletes only an exact empty pair around a collapsed caret", () => {
    expect(planMarkdownEditorAutoPairBackspace("a[]b", 2, 2)).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 1,
        rangeEnd: 3,
        replacement: "",
        selectionStart: 1,
        selectionEnd: 1,
      },
    })
    expect(planMarkdownEditorAutoPairBackspace("a[x]b", 2, 2)).toBeNull()
    expect(planMarkdownEditorAutoPairBackspace("a[]b", 1, 2)).toBeNull()
  })

  test("passes invalid, multiline, fenced, escaped, fence-leading, and apostrophe-word contexts through", () => {
    expect(planMarkdownEditorAutoPairInsert("text", -1, 0, "(")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("first\nsecond", 0, 12, "(")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("```ts\nconst item = ", 20, 20, "(")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("\\", 1, 1, "(")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("   ", 3, 3, "`")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("cant", 3, 3, "'")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("can", 3, 3, "'")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("can''", 3, 3, "'")).toEqual({
      kind: "select",
      selectionStart: 4,
      selectionEnd: 4,
    })
    expect(planMarkdownEditorAutoPairInsert(" `", 2, 2, "`")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("`", 1, 1, "`")).toBeNull()
    expect(planMarkdownEditorAutoPairInsert("text", 2, 2, "Escape")).toBeNull()
  })
})
