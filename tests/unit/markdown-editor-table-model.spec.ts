import { expect, test } from "@playwright/test"
import {
  createMarkdownEditorTable,
  isMarkdownEditorTableSelection,
  planMarkdownEditorTableEdit,
  planMarkdownEditorTableTab,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { applyPlannedTextMutationToValue } from "../../src/components/markdown-editor/markdownEditorTextMutation"

const table = ["| Name | Notes |", "| :--- | ---: |", "| **A** | a \\| b |"].join("\n")

test.describe("markdown editor table model", () => {
  test("creates only bounded 2..6 tables with the first header cell selected", () => {
    expect(createMarkdownEditorTable(2, 2)).toEqual({
      snippet: "\n|  |  |\n| --- | --- |\n|  |  |\n",
      cursorOffset: 3,
    })
    expect(createMarkdownEditorTable(6, 6)?.snippet.split("\n")).toHaveLength(9)
    expect(createMarkdownEditorTable(1, 2)).toBeNull()
    expect(createMarkdownEditorTable(2, 7)).toBeNull()
  })

  test("canonicalizes a selected basic table without unescaping inline Markdown", () => {
    const plan = planMarkdownEditorTableEdit(table, table.indexOf("**A**") + 2, table.indexOf("**A**") + 2, {
      kind: "set-alignment",
      alignment: "center",
    })

    expect(plan).not.toBeNull()
    expect(applyPlannedTextMutationToValue(table, plan!).value).toBe(
      "| Name | Notes |\n| :---: | ---: |\n| **A** | a \\| b |"
    )
  })

  test("adds and deletes the current row and column while preserving bounds", () => {
    const addRow = planMarkdownEditorTableEdit(table, table.indexOf("**A**"), table.indexOf("**A**"), {
      kind: "add-row",
    })
    const withRow = applyPlannedTextMutationToValue(table, addRow!).value
    expect(withRow).toBe("| Name | Notes |\n| --- | ---: |\n| **A** | a \\| b |\n|  |  |")

    const deleteColumn = planMarkdownEditorTableEdit(
      withRow,
      withRow.lastIndexOf("|  |") + 2,
      withRow.lastIndexOf("|  |") + 2,
      { kind: "delete-column" }
    )
    expect(applyPlannedTextMutationToValue(withRow, deleteColumn!).value).toBe(
      "| Name |\n| --- |\n| **A** |\n|  |"
    )

    const onlyColumn = "| one |\n| --- |\n| two |"
    expect(planMarkdownEditorTableEdit(onlyColumn, 3, 3, { kind: "delete-column" })).toBeNull()
    expect(planMarkdownEditorTableEdit(onlyColumn, 3, 3, { kind: "delete-row" })).toBeNull()
  })

  test("moves Tab between cells and appends one body row from the last cell", () => {
    const first = planMarkdownEditorTableTab(table, table.indexOf("Name") + 1, table.indexOf("Name") + 1, "next")
    expect(first?.selectionStart).toBe(table.indexOf("Notes"))

    const previous = planMarkdownEditorTableTab(table, table.indexOf("Notes") + 1, table.indexOf("Notes") + 1, "previous")
    expect(previous?.selectionStart).toBe(table.indexOf("Name"))

    const last = planMarkdownEditorTableTab(table, table.indexOf("b |"), table.indexOf("b |"), "next")
    expect(applyPlannedTextMutationToValue(table, last!).value).toBe(
      "| Name | Notes |\n| --- | ---: |\n| **A** | a \\| b |\n|  |  |"
    )
    expect(last?.selectionStart).toBe(last!.rangeStart + last!.replacement.lastIndexOf("\n") + 3)
  })

  test("uses escaped-pipe-aware cell boundaries for Tab and table context", () => {
    const escaped = "| one \\| two | three \\| four | five |\n| --- | --- | --- |\n|  |  |  |"
    const second = planMarkdownEditorTableTab(escaped, escaped.indexOf("one") + 1, escaped.indexOf("one") + 1, "next")
    const third = planMarkdownEditorTableTab(escaped, escaped.indexOf("three") + 1, escaped.indexOf("three") + 1, "next")

    expect(second?.selectionStart).toBe(escaped.indexOf("three"))
    expect(third?.selectionStart).toBe(escaped.indexOf("five"))
    expect(isMarkdownEditorTableSelection(escaped, escaped.indexOf("one") + 1, escaped.indexOf("one") + 1)).toBe(true)
    expect(isMarkdownEditorTableSelection(escaped, 0, 1)).toBe(false)
  })

  test("keeps empty cell padding active and rejects header row deletion", () => {
    const empty = "|  | second |\n| --- | --- |\n|  | value |"
    const emptyPadding = empty.indexOf("|  |") + 1

    expect(isMarkdownEditorTableSelection(empty, emptyPadding, emptyPadding)).toBe(true)
    expect(planMarkdownEditorTableTab(empty, emptyPadding, emptyPadding, "next")?.selectionStart).toBe(
      empty.indexOf("second")
    )
    expect(planMarkdownEditorTableEdit(empty, empty.indexOf("second"), empty.indexOf("second"), { kind: "delete-row" })).toBeNull()
  })

  test("fails closed for non-basic or unsafe table contexts", () => {
    const invalids = [
      "| one |\n| --- |\n| two | three |",
      "    | one |\n    | --- |\n    | two |",
      "- | one |\n  | --- |\n  | two |",
      "> | one |\n> | --- |\n> | two |",
      "```\n| one |\n| --- |\n| two |\n```",
      "<!-- aq-table malformed\n| one |\n| --- |\n| two |",
      "| one |\n| --- |\n| a |\n| b |\n| c |\n| d |\n| e |\n| f |",
    ]

    for (const value of invalids) {
      const caret = value.indexOf("one") + 1
      expect(planMarkdownEditorTableEdit(value, caret, caret, { kind: "add-column" })).toBeNull()
    }

    const delimiterCaret = table.indexOf(":---") + 1
    expect(planMarkdownEditorTableEdit(table, delimiterCaret, delimiterCaret, { kind: "add-column" })).toBeNull()
    expect(planMarkdownEditorTableTab(table, 0, 1, "next")).toBeNull()
  })
})
