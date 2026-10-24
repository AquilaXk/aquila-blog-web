import { expect, test } from "@playwright/test"
import {
  isBlockLinePrefixSnippet,
  planNotionBlockPrefixBackspace,
  planNotionSpaceInputRule,
  planToggleBlockLinePrefix,
} from "src/components/markdown-editor/markdownEditorNotionModel"
import {
  filterSlashCommandSpecs,
  resolveSlashCommandMutation,
  SLASH_COMMAND_SPECS,
} from "src/components/markdown-editor/useMarkdownEditorSlashMenu"

test.describe("Notion-parity Markdown editor model", () => {
  test("recognizes block line prefix snippets and toggles headings and blockquotes at line start", () => {
    expect(isBlockLinePrefixSnippet("# ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("## ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("#### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("> ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("==", "==")).toBe(false)

    expect(planToggleBlockLinePrefix("Hello", 5, 5, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "## Hello",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("Hello", 0, 5, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "## Hello",
      selectionStart: 3,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("# Hello", 7, 7, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 7,
      replacement: "## Hello",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "Hello",
      selectionStart: 5,
      selectionEnd: 5,
    })

    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "> ")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "> Hello",
      selectionStart: 7,
      selectionEnd: 7,
    })

    expect(planToggleBlockLinePrefix("> Hello", 7, 7, "> ")).toEqual({
      rangeStart: 0,
      rangeEnd: 7,
      replacement: "Hello",
      selectionStart: 5,
      selectionEnd: 5,
    })

    expect(planToggleBlockLinePrefix("```ts\nconst x = 1\n```", 6, 6, "## ")).toBeNull()
  })

  test("converts [] + Space into task item and >>> + Space into toggle details block", () => {
    expect(planNotionSpaceInputRule("[]", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "- [ ] ",
      selectionStart: 6,
      selectionEnd: 6,
    })

    expect(planNotionSpaceInputRule("  [x]", 5, 5)).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "  - [x] ",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planNotionSpaceInputRule(">>>", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "<details>\n<summary>토글 제목</summary>\n\n내용을 입력하세요.\n</details>",
      selectionStart: 19,
      selectionEnd: 24,
    })

    expect(planNotionSpaceInputRule("```ts\n[]\n```", 8, 8)).toBeNull()
  })

  test("strips heading, list, and quote prefixes on single Backspace right after prefix", () => {
    expect(planNotionBlockPrefixBackspace("## Heading", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("  - [ ] Task", 8, 8)).toEqual({
      rangeStart: 2,
      rangeEnd: 8,
      replacement: "",
      selectionStart: 2,
      selectionEnd: 2,
    })

    expect(planNotionBlockPrefixBackspace("- Bullet", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("1. Ordered", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("> Quote", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("## Heading", 4, 4)).toBeNull()
  })

  test("filters slash commands by Notion keyword aliases and includes bullet and ordered list blocks", () => {
    const ids = SLASH_COMMAND_SPECS.map((spec) => spec.id)
    expect(ids).toContain("bullet-list")
    expect(ids).toContain("ordered-list")
    expect(ids).toContain("task-list")

    expect(filterSlashCommandSpecs("h1").map((s) => s.id)).toContain("heading-1")
    expect(filterSlashCommandSpecs("todo").map((s) => s.id)).toContain("task-list")
    expect(filterSlashCommandSpecs("ul").map((s) => s.id)).toContain("bullet-list")
    expect(filterSlashCommandSpecs("ol").map((s) => s.id)).toContain("ordered-list")
    expect(filterSlashCommandSpecs("quote").map((s) => s.id)).toContain("quote")
    expect(filterSlashCommandSpecs("table").map((s) => s.id)).toContain("table")
    expect(filterSlashCommandSpecs("hr").map((s) => s.id)).toContain("divider")

    const bulletSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "bullet-list")!
    expect(resolveSlashCommandMutation(bulletSpec, 0, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "- ",
      selectionStart: 2,
      selectionEnd: 2,
    })
  })
})
