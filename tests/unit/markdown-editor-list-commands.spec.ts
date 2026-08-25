import { expect, test } from "@playwright/test"
import { planToggleListCommand } from "../../src/components/markdown-editor/markdownEditorListCommandsModel"

test.describe("markdown editor list commands model", () => {
  test("toggles the collapsed current logical line and rebases a caret inside a marker", () => {
    expect(planToggleListCommand("alpha", 2, 2, "unordered")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "- alpha",
      selectionStart: 4,
      selectionEnd: 4,
    })
    expect(planToggleListCommand("- alpha", 1, 1, "task")?.selectionStart).toBe(6)
  })

  test("uses end-exclusive selections without including the next line at BOL", () => {
    expect(planToggleListCommand("alpha\nbeta", 0, 6, "unordered")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "- alpha",
      selectionStart: 2,
      selectionEnd: 8,
    })
  })

  test("canonicalizes mixed nested markers to the requested task marker", () => {
    const value = ["plain", "  - child", "- [x] done"].join("\n")
    expect(planToggleListCommand(value, 0, value.length, "task")?.replacement).toBe(
      ["- [ ] plain", "  - [ ] child", "- [ ] done"].join("\n")
    )
  })

  test("starts ordered numbering at one per indent level within the selected range", () => {
    const value = ["alpha", "  beta", "gamma", "  delta"].join("\n")
    expect(planToggleListCommand(value, 0, value.length, "ordered")?.replacement).toBe(
      ["1. alpha", "  1. beta", "2. gamma", "  2. delta"].join("\n")
    )
  })

  test("removes all selected target markers, including checked tasks", () => {
    const value = ["- [x] done", "  - [ ] child"].join("\n")
    expect(planToggleListCommand(value, 0, value.length, "task")?.replacement).toBe("done\n  child")
  })

  test("fails closed for invalid offsets and selections intersecting fenced code", () => {
    expect(planToggleListCommand("alpha", -1, 0, "unordered")).toBeNull()
    const fenced = ["```md", "alpha", "```"].join("\n")
    expect(planToggleListCommand(fenced, 0, fenced.length, "unordered")).toBeNull()
    const quotedFenced = ["> ```js", "> const alpha = 1", "> ```"].join("\n")
    expect(planToggleListCommand(quotedFenced, 0, quotedFenced.length, "unordered")).toBeNull()
    const nestedQuotedFence = ["> > ````", "> > alpha", "> > ````"].join("\n")
    expect(planToggleListCommand(nestedQuotedFence, 0, nestedQuotedFence.length, "unordered")).toBeNull()
  })
})
