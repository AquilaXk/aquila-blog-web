import { expect, test } from "@playwright/test"
import { GFM, parser } from "@lezer/markdown"
import {
  buildMarkdownLivePreviewPlan,
  resolveMarkdownLiveSourceRanges,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"

const markdownParser = parser.configure(GFM)

test.describe("markdown editor live preview model", () => {
  test("reveals the complete active block while keeping other blocks formatted", () => {
    const markdown = ["# Heading", "", "Paragraph with **bold** text."].join("\n")
    const tree = markdownParser.parse(markdown)
    const headingOffset = markdown.indexOf("Heading") + 2

    expect(resolveMarkdownLiveSourceRanges(markdown, tree.topNode, [
      { from: headingOffset, to: headingOffset },
    ])).toEqual([{ from: 0, to: "# Heading".length }])

    const plan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [
      { from: headingOffset, to: headingOffset },
    ])
    expect(plan).not.toContainEqual(expect.objectContaining({ from: 0, kind: "hide-mark" }))
    expect(plan).toContainEqual(expect.objectContaining({ kind: "strong", from: markdown.indexOf("**bold**") }))
    expect(plan).toContainEqual(expect.objectContaining({ kind: "hide-mark", from: markdown.indexOf("**bold**") }))
  })

  test("reveals every top-level block crossed by a selection", () => {
    const markdown = ["First paragraph.", "", "- one", "- two", "", "Last paragraph."].join("\n")
    const tree = markdownParser.parse(markdown)
    const selection = {
      from: markdown.indexOf("paragraph"),
      to: markdown.indexOf("two") + "two".length,
    }

    expect(resolveMarkdownLiveSourceRanges(markdown, tree.topNode, [selection])).toEqual([
      { from: 0, to: "First paragraph.".length },
      { from: markdown.indexOf("- one"), to: markdown.indexOf("- two") + "- two".length },
    ])
  })

  test("reveals the current source line when the caret is between parsed blocks", () => {
    const markdown = ["First", "", "Second"].join("\n")
    const tree = markdownParser.parse(markdown)
    const blankLineOffset = markdown.indexOf("\n\n") + 1

    expect(resolveMarkdownLiveSourceRanges(markdown, tree.topNode, [
      { from: blankLineOffset, to: blankLineOffset },
    ])).toEqual([{ from: blankLineOffset, to: blankLineOffset }])
  })

  test("keeps all Markdown source visible during IME composition", () => {
    const markdown = "# 제목\n\n**본문**"
    const tree = markdownParser.parse(markdown)

    expect(buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 2, to: 2 }], true)).toEqual([])
  })

  test("formats inactive headings, links, tasks, quotes, and fenced code without a second document", () => {
    const markdown = [
      "# Heading",
      "",
      "[link](https://example.com)",
      "",
      "- [ ] task",
      "",
      "> quote",
      "",
      "```ts",
      "const value = 1",
      "```",
    ].join("\n")
    const tree = markdownParser.parse(markdown)
    const inactiveCaret = markdown.indexOf("\n\n") + 1
    const plan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [
      { from: inactiveCaret, to: inactiveCaret },
    ])

    expect(plan).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "hide-mark", from: 0, to: 2 }),
      expect.objectContaining({ kind: "heading", level: 1 }),
      expect.objectContaining({ kind: "link" }),
      expect.objectContaining({ kind: "task" }),
      expect.objectContaining({ kind: "quote" }),
      expect.objectContaining({ kind: "fenced-code" }),
    ]))
  })
})
