import { expect, test } from "@playwright/test"
import {
  getMarkdownEditorCommand,
  markdownEditorCommands,
  projectMarkdownEditorToolbarCommands,
  resolveMarkdownEditorCommandShortcut,
  validateMarkdownEditorCommands,
} from "../../src/components/markdown-editor/markdownEditorCommandRegistryModel"

const writeContext = {
  disabled: false,
  selectionStart: 0,
  selectionEnd: 0,
  isTableSelection: false,
}

test.describe("markdown editor command registry", () => {
  test("defines exactly the three MVP descriptors", () => {
    expect(markdownEditorCommands.map((command) => command.id)).toEqual([
      "format.bold",
      "block.code",
      "table.add-row",
    ])
  })

  test("rejects duplicate ids and non-empty duplicate shortcuts", () => {
    const bold = getMarkdownEditorCommand("format.bold")!
    expect(() => validateMarkdownEditorCommands([bold, { ...bold }])).toThrow(/duplicate command id/i)
    expect(() =>
      validateMarkdownEditorCommands([
        bold,
        { ...getMarkdownEditorCommand("block.code")!, shortcut: bold.shortcut },
      ])
    ).toThrow(/duplicate command shortcut/i)
  })

  test("toolbar projection retains descriptor identity", () => {
    const bold = getMarkdownEditorCommand("format.bold")!
    expect(bold.toolbarLabel).toBe("B")
    expect(projectMarkdownEditorToolbarCommands()[0]).toBe(bold)
  })

  test("uses one enablement contract across representative contexts", () => {
    const bold = getMarkdownEditorCommand("format.bold")!
    const code = getMarkdownEditorCommand("block.code")!
    const addRow = getMarkdownEditorCommand("table.add-row")!

    expect(bold.isEnabled(writeContext)).toBe(true)
    expect(addRow.isEnabled({ ...writeContext, isTableSelection: false })).toBe(false)
    expect(addRow.isEnabled({ ...writeContext, isTableSelection: true })).toBe(true)
    expect(code.isEnabled({ ...writeContext, disabled: true })).toBe(false)
  })

  test("delegates execution as existing typed actions", () => {
    expect(getMarkdownEditorCommand("format.bold")!.execute(writeContext)).toEqual({ kind: "format", shortcut: "bold" })
    expect(getMarkdownEditorCommand("block.code")!.execute(writeContext)).toEqual({ kind: "block", block: "code" })
    expect(getMarkdownEditorCommand("table.add-row")!.execute({ ...writeContext, isTableSelection: true })).toEqual({
      kind: "table",
      edit: "add-row",
    })
    expect(getMarkdownEditorCommand("table.add-row")!.execute(writeContext)).toBeNull()
  })

  test("resolves Mod+B to the shared bold descriptor", () => {
    expect(
      resolveMarkdownEditorCommandShortcut({ key: "b", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })
    ).toBe(getMarkdownEditorCommand("format.bold"))
  })
})
