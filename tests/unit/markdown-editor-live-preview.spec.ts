import { expect, test } from "@playwright/test"
import { GFM, parser } from "@lezer/markdown"
import {
  buildMarkdownLivePreviewPlan,
  resolveMarkdownLiveSourceRanges,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"

const markdownParser = parser.configure(GFM)

test.describe("markdown editor live preview model", () => {
  test("renders inactive rules and validated color tokens without rewriting source", () => {
    const markdown = "Active\n\n---\n\n{{color:#34d399|**green**}}"
    const tree = markdownParser.parse(markdown)
    const plan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])
    expect(plan).toContainEqual({ kind: "horizontal-rule", from: 8, to: 11 })
    expect(plan).toContainEqual(expect.objectContaining({ kind: "inline-color", color: "#34d399" }))
    expect(plan).toContainEqual(expect.objectContaining({ kind: "strong" }))
    const tokenStart = markdown.indexOf("{{")
    expect(buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: tokenStart, to: tokenStart }]))
      .not.toContainEqual(expect.objectContaining({ kind: "inline-color" }))
    expect(tree.toString()).toContain("HorizontalRule")
  })

  test("leaves code literals and invalid color tokens intact", () => {
    const markdown = "Active\n\n`{{color:#34d399|literal}}`\n\n```\n{{color:#34d399|literal}}\n---\n```\n\n{{color:url(evil)|invalid}}"
    const plan = buildMarkdownLivePreviewPlan(markdown, markdownParser.parse(markdown).topNode, [{ from: 0, to: 0 }])
    expect(plan).not.toContainEqual(expect.objectContaining({ kind: "inline-color" }))
    expect(plan).not.toContainEqual(expect.objectContaining({ kind: "horizontal-rule" }))
  })

  test("renders color wrappers around supported links and inline code", () => {
    const markdown = "Active\n\n{{color:green|[label](https://example.com)}}\n\n{{color:green|`code`}}"
    const plan = buildMarkdownLivePreviewPlan(markdown, markdownParser.parse(markdown).topNode, [{ from: 0, to: 0 }])
    expect(plan.filter(({ kind }) => kind === "inline-color")).toHaveLength(2)
    expect(plan).toContainEqual(expect.objectContaining({ kind: "link" }))
    expect(plan).toContainEqual(expect.objectContaining({ kind: "inline-code" }))
  })
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

  test("keeps bare URL text visible while hiding link and image destinations", () => {
    const bareUrl = "https://bare.example.test"
    const explicitUrl = "https://target.example.test"
    const imageUrl = "https://image.example.test/post.png"
    const markdown = [
      "Active paragraph.",
      "",
      bareUrl,
      "",
      `[label](${explicitUrl})`,
      "",
      `![alt](${imageUrl})`,
    ].join("\n")
    const tree = markdownParser.parse(markdown)
    const plan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])

    expect(plan).not.toContainEqual({
      kind: "hide-mark",
      from: markdown.indexOf(bareUrl),
      to: markdown.indexOf(bareUrl) + bareUrl.length,
    })
    expect(plan).toContainEqual({
      kind: "hide-mark",
      from: markdown.indexOf(explicitUrl),
      to: markdown.indexOf(explicitUrl) + explicitUrl.length,
    })
    expect(plan).toContainEqual({
      kind: "hide-mark",
      from: markdown.indexOf(imageUrl),
      to: markdown.indexOf(imageUrl) + imageUrl.length,
    })
  })

  test("provides fine-grained token disclosure without unrendering entire paragraph", () => {
    const markdown = "Hello plain text with **bold** and *italic* here."
    const tree = markdownParser.parse(markdown)

    // Caret at plain text "Hello"
    const plainCaretPlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 2, to: 2 }])
    expect(plainCaretPlan).toContainEqual(expect.objectContaining({ kind: "strong" }))
    expect(plainCaretPlan).toContainEqual(expect.objectContaining({ kind: "emphasis" }))
    expect(plainCaretPlan).toContainEqual(expect.objectContaining({ kind: "hide-mark", from: markdown.indexOf("**bold**") }))
    expect(plainCaretPlan).toContainEqual(expect.objectContaining({ kind: "hide-mark", from: markdown.indexOf("*italic*") }))

    // Caret moved inside **bold**
    const boldOffset = markdown.indexOf("bold") + 1
    const boldCaretPlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: boldOffset, to: boldOffset }])
    // bold mark is disclosed (not hidden)
    expect(boldCaretPlan).not.toContainEqual(expect.objectContaining({ kind: "hide-mark", from: markdown.indexOf("**bold**") }))
    // italic mark remains hidden and formatted
    expect(boldCaretPlan).toContainEqual(expect.objectContaining({ kind: "emphasis" }))
    expect(boldCaretPlan).toContainEqual(expect.objectContaining({ kind: "hide-mark", from: markdown.indexOf("*italic*") }))
  })

  test("formats highlight tokens with delimiter hiding and discloses them when active", () => {
    const markdown = "Hello ==highlighted text== here with `==code==` untouched."
    const tree = markdownParser.parse(markdown)

    // Caret outside highlight token
    const inactivePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])
    const highlightStart = markdown.indexOf("==highlighted text==")
    const highlightEnd = highlightStart + "==highlighted text==".length
    expect(inactivePlan).toContainEqual({
      from: highlightStart + 2,
      to: highlightEnd - 2,
      kind: "highlight",
    })
    expect(inactivePlan).toContainEqual({
      from: highlightStart,
      to: highlightStart + 2,
      kind: "hide-mark",
    })
    expect(inactivePlan).toContainEqual({
      from: highlightEnd - 2,
      to: highlightEnd,
      kind: "hide-mark",
    })

    // Code literal is NOT highlighted or hidden
    const codeStart = markdown.indexOf("`==code==`")
    expect(inactivePlan).not.toContainEqual(expect.objectContaining({
      from: codeStart + 1,
      kind: "highlight",
    }))

    // Caret inside highlight token discloses delimiters for live editing
    const caretInside = highlightStart + 5
    const activePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: caretInside, to: caretInside }])
    expect(activePlan).toContainEqual({
      from: highlightStart + 2,
      to: highlightEnd - 2,
      kind: "highlight",
    })
    expect(activePlan).not.toContainEqual({
      from: highlightStart,
      to: highlightStart + 2,
      kind: "hide-mark",
    })
    expect(activePlan).not.toContainEqual({
      from: highlightEnd - 2,
      to: highlightEnd,
      kind: "hide-mark",
    })
  })

  test("formats wikilink pills with target and alias and discloses raw brackets when active", () => {
    const markdown = "See [[Overview]] and [[Architecture#Design|System Architecture]] or `[[Code]]`."
    const tree = markdownParser.parse(markdown)

    // Caret outside
    const inactivePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])
    const overviewStart = markdown.indexOf("[[Overview]]")
    const archStart = markdown.indexOf("[[Architecture#Design|System Architecture]]")

    expect(inactivePlan).toContainEqual({
      from: overviewStart,
      to: overviewStart + "[[Overview]]".length,
      kind: "wikilink",
      target: "Overview",
      alias: undefined,
    })
    expect(inactivePlan).toContainEqual({
      from: archStart,
      to: archStart + "[[Architecture#Design|System Architecture]]".length,
      kind: "wikilink",
      target: "Architecture#Design",
      alias: "System Architecture",
    })

    // Code literal is NOT treated as a wikilink
    const codeStart = markdown.indexOf("`[[Code]]`")
    expect(inactivePlan).not.toContainEqual(expect.objectContaining({
      from: codeStart + 1,
      kind: "wikilink",
    }))

    // Lezer Link/LinkMark inside wikilinks are suppressed
    expect(inactivePlan).not.toContainEqual(expect.objectContaining({
      kind: "link",
      from: overviewStart + 1,
    }))

    // Caret inside first wikilink discloses raw [[Overview]] for editing
    const caretInside = overviewStart + 3
    const activePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: caretInside, to: caretInside }])
    expect(activePlan).not.toContainEqual(expect.objectContaining({
      kind: "wikilink",
      target: "Overview",
    }))
    // Second wikilink remains a pill widget
    expect(activePlan).toContainEqual(expect.objectContaining({
      kind: "wikilink",
      target: "Architecture#Design",
      alias: "System Architecture",
    }))
  })

  test("formats highlight containing equal signs and math expressions", () => {
    const markdown = "Evaluate ==1 + 1 = 2== and ==status = active== or ==x >= 10==."
    const tree = markdownParser.parse(markdown)

    const plan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])
    const mathHighlightStart = markdown.indexOf("==1 + 1 = 2==")
    const mathHighlightEnd = mathHighlightStart + "==1 + 1 = 2==".length

    expect(plan).toContainEqual({
      from: mathHighlightStart + 2,
      to: mathHighlightEnd - 2,
      kind: "highlight",
    })
    expect(plan).toContainEqual({
      from: mathHighlightStart,
      to: mathHighlightStart + 2,
      kind: "hide-mark",
    })

    const statusStart = markdown.indexOf("==status = active==")
    const statusEnd = statusStart + "==status = active==".length
    expect(plan).toContainEqual({
      from: statusStart + 2,
      to: statusEnd - 2,
      kind: "highlight",
    })

    // Discloses when caret enters the highlight with equal sign
    const caretInside = mathHighlightStart + 4
    const activePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: caretInside, to: caretInside }])
    expect(activePlan).not.toContainEqual({
      from: mathHighlightStart,
      to: mathHighlightStart + 2,
      kind: "hide-mark",
    })
  })

  test("suppresses conflicting lezer markdown formatting inside wikilinks and normalizes empty alias", () => {
    const markdown = "Check [[My *Important* Note]] and [[report_v1_draft]] and [[EmptyAlias|]] here."
    const tree = markdownParser.parse(markdown)

    const inactivePlan = buildMarkdownLivePreviewPlan(markdown, tree.topNode, [{ from: 0, to: 0 }])

    const starredStart = markdown.indexOf("[[My *Important* Note]]")
    const starredEnd = starredStart + "[[My *Important* Note]]".length

    // The wikilink widget replaces the whole token
    expect(inactivePlan).toContainEqual({
      from: starredStart,
      to: starredEnd,
      kind: "wikilink",
      target: "My *Important* Note",
      alias: undefined,
    })

    // No conflicting emphasis or hide-mark decorations are emitted inside the wikilink range
    const innerDecos = inactivePlan.filter(
      (d) => d.from >= starredStart && d.to <= starredEnd && d.kind !== "wikilink"
    )
    expect(innerDecos).toHaveLength(0)

    // Empty alias is normalized to undefined
    const emptyAliasStart = markdown.indexOf("[[EmptyAlias|]]")
    expect(inactivePlan).toContainEqual(expect.objectContaining({
      from: emptyAliasStart,
      kind: "wikilink",
      target: "EmptyAlias",
      alias: undefined,
    }))
  })
})
