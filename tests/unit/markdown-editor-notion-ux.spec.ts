import { expect, test } from "@playwright/test"
import {
  isBlockLinePrefixSnippet,
  planNotionBlockPrefixBackspace,
  planNotionSpaceInputRule,
  planStripBlockLinePrefix,
  planToggleBlockLinePrefix,
} from "src/components/markdown-editor/markdownEditorNotionModel"
import { parseNotionContainerBlocks } from "src/components/markdown-editor/markdownEditorNotionWidgets"
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

    const deepQuote = `${"> ".repeat(32)}plain`
    const startedAt = Date.now()
    expect(planToggleBlockLinePrefix(deepQuote, 0, deepQuote.length, "## ")?.replacement).toBe(
      `## ${"> ".repeat(31)}plain`
    )
    expect(Date.now() - startedAt).toBeLessThan(50)
  })

  test("strips heading, list, task, and quote prefixes back to plain paragraph via planStripBlockLinePrefix", () => {
    expect(planStripBlockLinePrefix("# Heading 1", 4, 4)).toEqual({
      rangeStart: 0,
      rangeEnd: 11,
      replacement: "Heading 1",
      selectionStart: 2,
      selectionEnd: 2,
    })

    expect(planStripBlockLinePrefix("## Heading 2", 0, 12)).toEqual({
      rangeStart: 0,
      rangeEnd: 12,
      replacement: "Heading 2",
      selectionStart: 0,
      selectionEnd: 9,
    })

    expect(planStripBlockLinePrefix("  - [ ] Task item", 10, 10)).toEqual({
      rangeStart: 0,
      rangeEnd: 17,
      replacement: "  Task item",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planStripBlockLinePrefix("- [x] Done item", 15, 15)).toEqual({
      rangeStart: 0,
      rangeEnd: 15,
      replacement: "Done item",
      selectionStart: 9,
      selectionEnd: 9,
    })

    expect(planStripBlockLinePrefix("- Bullet\n1. Ordered\n> Quote", 0, 27)).toEqual({
      rangeStart: 0,
      rangeEnd: 27,
      replacement: "Bullet\nOrdered\nQuote",
      selectionStart: 0,
      selectionEnd: 20,
    })

    expect(planStripBlockLinePrefix("Plain paragraph", 0, 5)).toBeNull()
    expect(planStripBlockLinePrefix("```ts\n# inside fence\n```", 7, 10)).toBeNull()
  })

  test("converts [], >>>, ---, and !!! + Space into task, toggle, divider, and callout blocks", () => {
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
      replacement: ":::toggle 토글 제목\n\n:::",
      selectionStart: 10,
      selectionEnd: 15,
    })

    expect(planNotionSpaceInputRule("---", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "---\n",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planNotionSpaceInputRule("***", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "---\n",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planNotionSpaceInputRule("!!!", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "> [!INFO]\n> ",
      selectionStart: 12,
      selectionEnd: 12,
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

  test("parses :::toggle and :::bookmark container blocks while ignoring fenced code blocks", () => {
    const doc = [
      ":::toggle 상세 설명",
      "숨겨진 첫째 줄",
      "숨겨진 둘째 줄",
      ":::",
      "",
      ":::bookmark https://example.com",
      "예시 사이트",
      "외부 링크 카드 설명",
      ":::",
      "",
      "```md",
      ":::toggle 코드 안의 토글",
      "무시되어야 함",
      ":::",
      "```",
    ].join("\n")

    const blocks = parseNotionContainerBlocks(doc)
    expect(blocks).toEqual([
      {
        kind: "toggle",
        from: 0,
        to: doc.indexOf("\n\n:::bookmark"),
        title: "상세 설명",
        body: "숨겨진 첫째 줄\n숨겨진 둘째 줄",
      },
      {
        kind: "bookmark",
        from: doc.indexOf(":::bookmark"),
        to: doc.indexOf("\n\n```md"),
        url: "https://example.com",
        title: "예시 사이트",
        description: "외부 링크 카드 설명",
      },
    ])
  })

  test("filters slash commands by Notion keyword aliases and includes list, image, and file commands", () => {
    const ids = SLASH_COMMAND_SPECS.map((spec) => spec.id)
    expect(ids).toContain("bullet-list")
    expect(ids).toContain("ordered-list")
    expect(ids).toContain("task-list")
    expect(ids).toContain("image")
    expect(ids).toContain("attachment")

    expect(filterSlashCommandSpecs("h1").map((s) => s.id)).toContain("heading-1")
    expect(filterSlashCommandSpecs("todo").map((s) => s.id)).toContain("task-list")
    expect(filterSlashCommandSpecs("ul").map((s) => s.id)).toContain("bullet-list")
    expect(filterSlashCommandSpecs("ol").map((s) => s.id)).toContain("ordered-list")
    expect(filterSlashCommandSpecs("quote").map((s) => s.id)).toContain("quote")
    expect(filterSlashCommandSpecs("table").map((s) => s.id)).toContain("table")
    expect(filterSlashCommandSpecs("hr").map((s) => s.id)).toContain("divider")
    expect(filterSlashCommandSpecs("image").map((s) => s.id)).toContain("image")
    expect(filterSlashCommandSpecs("이미지").map((s) => s.id)).toContain("image")
    expect(filterSlashCommandSpecs("file").map((s) => s.id)).toContain("attachment")
    expect(filterSlashCommandSpecs("파일").map((s) => s.id)).toContain("attachment")

    const bulletSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "bullet-list")!
    expect(resolveSlashCommandMutation(bulletSpec, 0, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "- ",
      selectionStart: 2,
      selectionEnd: 2,
    })

    const imageSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "image")!
    expect(resolveSlashCommandMutation(imageSpec, 0, 6)).toEqual({
      rangeStart: 0,
      rangeEnd: 6,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })
  })
})
