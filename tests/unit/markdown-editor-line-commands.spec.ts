import { expect, test } from "@playwright/test"
import { planMarkdownEditorLineCommand } from "../../src/components/markdown-editor/markdownEditorLineCommandsModel"
import { applyPlannedTextMutationToValue } from "../../src/components/markdown-editor/markdownEditorTextMutation"

const apply = (value: string, start: number, end: number, command: "move-up" | "move-down" | "duplicate" | "delete") => {
  const plan = planMarkdownEditorLineCommand(value, start, end, command)
  return plan && applyPlannedTextMutationToValue(value, plan)
}

test.describe("markdown editor line commands model", () => {
  test("moves the caret line by swapping only it with its adjacent logical line", () => {
    const value = "first\nsecond\nthird"
    const plan = planMarkdownEditorLineCommand(value, value.indexOf("second") + 2, value.indexOf("second") + 2, "move-up")

    expect(plan).toMatchObject({ rangeStart: 0, rangeEnd: "first\nsecond".length, replacement: "second\nfirst" })
    expect(applyPlannedTextMutationToValue(value, plan!).value).toBe("second\nfirst\nthird")
    expect(plan).toMatchObject({ selectionStart: 2, selectionEnd: 2 })
    expect(apply(value, 1, 1, "move-up")).toBeNull()
    expect(apply(value, value.length - 1, value.length - 1, "move-down")).toBeNull()
  })

  test("moves an end-exclusive multi-line selection as one block and retains its selection", () => {
    const value = "one\ntwo\nthree\nfour"
    const start = value.indexOf("two") + 1
    const end = value.indexOf("four")
    const plan = planMarkdownEditorLineCommand(value, start, end, "move-down")

    expect(applyPlannedTextMutationToValue(value, plan!).value).toBe("one\nfour\ntwo\nthree")
    expect(plan).toMatchObject({ selectionStart: "one\nfour\nt".length, selectionEnd: value.length })
  })

  test("duplicates the active line block immediately below and preserves its relative selection", () => {
    const value = "before\n- list\n| a | b |\n```\nafter"
    const start = value.indexOf("list")
    const end = value.indexOf("after")
    const plan = planMarkdownEditorLineCommand(value, start, end, "duplicate")

    expect(applyPlannedTextMutationToValue(value, plan!).value).toBe(
      "before\n- list\n| a | b |\n```\n- list\n| a | b |\n```\nafter"
    )
    expect(plan).toMatchObject({
      selectionStart: "before\n- list\n| a | b |\n```\n- ".length,
      selectionEnd: "before\n- list\n| a | b |\n```\n- list\n| a | b |\n```".length,
    })
  })

  test("deletes exactly one adjacent newline for first, middle, last, and only lines", () => {
    const cases = [
      ["first\nsecond\nthird", 1, "second\nthird", 0],
      ["first\nsecond\nthird", "first\nse".length, "first\nthird", "first\n".length],
      ["first\nsecond\nthird", "first\nsecond\nth".length, "first\nsecond", "first\nsecond".length],
      ["only", 1, "", 0],
    ] as const

    for (const [value, offset, expected, selection] of cases) {
      const plan = planMarkdownEditorLineCommand(value, offset, offset, "delete")
      expect(applyPlannedTextMutationToValue(value, plan!).value).toBe(expected)
      expect(plan).toMatchObject({ selectionStart: selection, selectionEnd: selection })
    }

    const trailingEmpty = planMarkdownEditorLineCommand("a\n", 2, 2, "delete")
    expect(applyPlannedTextMutationToValue("a\n", trailingEmpty!).value).toBe("a")
    expect(trailingEmpty).toMatchObject({ selectionStart: 1, selectionEnd: 1 })
  })

  test("preserves LF content and rejects invalid selection offsets", () => {
    expect(apply("a\n\nb", 2, 2, "move-up")?.value).toBe("\na\nb")
    expect(planMarkdownEditorLineCommand("line", -1, 0, "duplicate")).toBeNull()
    expect(planMarkdownEditorLineCommand("line", 1, 0, "duplicate")).toBeNull()
    expect(planMarkdownEditorLineCommand("line", 0.5, 1, "duplicate")).toBeNull()
  })
})
