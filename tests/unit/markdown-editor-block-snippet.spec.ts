import { expect, test } from "@playwright/test"
import {
  BLOCK_SNIPPET_SAMPLE_MARKERS,
  blockMarkdownSnippets,
  calloutBlockSnippet,
  codeBlockSnippet,
  mermaidBlockSnippet,
  planInsertBlockSnippet,
  snippetContainsSampleMarker,
  tableBlockSnippet,
  toggleBlockSnippet,
} from "../../src/components/markdown-editor/markdownEditorBlockSnippets"
import {
  applyPlannedTextMutationToValue,
} from "../../src/components/markdown-editor/markdownEditorTextMutation"

const blockSpecs = [
  ["code", codeBlockSnippet],
  ["table", tableBlockSnippet],
  ["mermaid", mermaidBlockSnippet],
  ["callout", calloutBlockSnippet],
  ["toggle", toggleBlockSnippet],
] as const

test.describe("markdown editor block snippets", () => {
  for (const [name, spec] of blockSpecs) {
    test(`${name} snippet excludes legacy sample markers`, () => {
      expect(snippetContainsSampleMarker(spec.snippet)).toBe(false)
      for (const marker of BLOCK_SNIPPET_SAMPLE_MARKERS) expect(spec.snippet).not.toContain(marker)
    })
  }

  test("keeps minimal table, code, callout, and toggle structures", () => {
    expect(tableBlockSnippet.snippet).toBe("\n|  |  |\n| --- | --- |\n|  |  |\n")
    expect(codeBlockSnippet.snippet).toBe("\n```\n\n```\n")
    expect(calloutBlockSnippet.snippet).toBe("\n> [!TIP]\n> \n")
    expect(toggleBlockSnippet.snippet).toBe("\n:::toggle \n\n:::\n")
  })

  test("keeps the generic Mermaid structure and an editable cursor position", () => {
    expect(mermaidBlockSnippet.snippet).toContain("flowchart TD")
    expect(mermaidBlockSnippet.snippet).toContain("A --> B")
    expect(mermaidBlockSnippet.snippet).not.toContain("Admin write")
    expect(mermaidBlockSnippet.snippet).not.toContain("DB commit")

    const plan = planInsertBlockSnippet(0, 0, mermaidBlockSnippet)
    expect(plan.replacement.slice(plan.selectionStart - 4, plan.selectionStart)).toBe("    ")
    expect(plan.replacement[plan.selectionStart]).not.toBe("`")
  })

  test("exposes every block toolbar entry with a valid cursor offset", () => {
    expect(blockMarkdownSnippets.map((entry) => entry.label)).toEqual([
      "Code",
      "Table",
      "Mermaid",
      "Callout",
      "Toggle",
    ])
    expect(blockMarkdownSnippets.every((entry) => entry.snippet.length > 0)).toBe(true)
    expect(blockMarkdownSnippets.every((entry) => entry.cursorOffset >= 0)).toBe(true)
  })

  test("keeps value-path insertion and non-empty selection behavior", () => {
    const tablePlan = planInsertBlockSnippet(5, 5, tableBlockSnippet)
    const tableResult = applyPlannedTextMutationToValue("alphaomega", tablePlan)
    expect(tableResult.value).toBe(`alpha${tableBlockSnippet.snippet}omega`)

    const codePlan = planInsertBlockSnippet(5, 9, codeBlockSnippet)
    const codeResult = applyPlannedTextMutationToValue("alphaomega", codePlan)
    expect(codeResult.value).toBe(`alpha${codeBlockSnippet.snippet}omega`)
    expect(codeResult.selectionStart).toBe(5 + codeBlockSnippet.cursorOffset)
    expect(codeResult.selectionEnd).toBe(5 + codeBlockSnippet.cursorOffset)
  })
})
