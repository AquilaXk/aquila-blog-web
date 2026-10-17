import { expect, test } from "@playwright/test"

import {
  planMarkdownEditorAutoPairInsert,
} from "../../src/components/markdown-editor/markdownEditorAutoPairModel"
import {
  buildMarkdownLivePreviewDecorationSpecs,
  buildMarkdownLivePreviewEntries,
  ENTRY_FLAG_IN_TASK,
  hasIntervalOverlap,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import {
  MarkdownCalloutWidget,
} from "../../src/components/markdown-editor/markdownEditorWidgets"
import { resolveCalloutBlockquote } from "../../src/libs/markdown/calloutRegistry"
import { renderFormulaToHtml } from "../../src/libs/markdown/formula"
import { createMarkdownDocumentInsights } from "../../src/libs/markdown/markdownDocumentInsights"
import { renderImmediateCodeToHtml } from "../../src/libs/markdown/prismRuntime"
import {
  extractCodeHighlightSpec,
  parseHighlightedLineNumbers,
} from "../../src/libs/markdown/renderingCodeModel"
import {
  hasUniformFenceMarker,
  parseMarkdownSegments,
} from "../../src/libs/markdown/renderingSegmentModel"
import { buildInitialTocFromMarkdown } from "../../src/routes/Detail/PostDetail/PostDetailTocModel"

test.describe("Wave 3 — Issue #261: Obsidian UX Parity & Bit-Level Optimizations", () => {
  test("AC-1: calloutRegistry resolves full Obsidian callout alias taxonomy", () => {
    expect(resolveCalloutBlockquote("abstract")?.kind).toBe("summary")
    expect(resolveCalloutBlockquote("tldr")?.kind).toBe("summary")
    expect(resolveCalloutBlockquote("important")?.kind).toBe("summary")

    expect(resolveCalloutBlockquote("question")?.kind).toBe("info")
    expect(resolveCalloutBlockquote("help")?.kind).toBe("info")
    expect(resolveCalloutBlockquote("faq")?.kind).toBe("info")
    expect(resolveCalloutBlockquote("todo")?.kind).toBe("info")

    expect(resolveCalloutBlockquote("success")?.kind).toBe("tip")
    expect(resolveCalloutBlockquote("check")?.kind).toBe("tip")
    expect(resolveCalloutBlockquote("done")?.kind).toBe("tip")

    expect(resolveCalloutBlockquote("failure")?.kind).toBe("warning")
    expect(resolveCalloutBlockquote("fail")?.kind).toBe("warning")
    expect(resolveCalloutBlockquote("missing")?.kind).toBe("warning")
    expect(resolveCalloutBlockquote("danger")?.kind).toBe("warning")
    expect(resolveCalloutBlockquote("error")?.kind).toBe("warning")
    expect(resolveCalloutBlockquote("bug")?.kind).toBe("warning")

    expect(resolveCalloutBlockquote("quote")?.kind).toBe("outline")
    expect(resolveCalloutBlockquote("cite")?.kind).toBe("outline")
  })

  test("AC-1: parseMarkdownSegments parses foldable callout modifiers (+ / -) without leaking into title", () => {
    const markdown = [
      ">[!note]+ Expanded Callout Title",
      "> First body line",
      "",
      ">[!warning]- Collapsed Warning Title",
      "> Hidden details",
      "",
      ">[!tip]-",
      "> Default title collapsed",
    ].join("\n")

    const segments = parseMarkdownSegments(markdown)
    expect(segments).toHaveLength(3)

    expect(segments[0]).toMatchObject({
      type: "callout",
      kind: "info",
      title: "Expanded Callout Title",
      content: "First body line",
      foldable: true,
      defaultCollapsed: false,
    })

    expect(segments[1]).toMatchObject({
      type: "callout",
      kind: "warning",
      title: "Collapsed Warning Title",
      content: "Hidden details",
      foldable: true,
      defaultCollapsed: true,
    })

    expect(segments[2]).toMatchObject({
      type: "callout",
      kind: "tip",
      title: "",
      content: "Default title collapsed",
      foldable: true,
      defaultCollapsed: true,
    })
  })

  test("AC-1: renderingCodeModel & prismRuntime parse {1,3-5} highlight ranges and mark highlighted lines", () => {
    const spec = extractCodeHighlightSpec('typescript title="demo.ts" {1,3-5}')
    expect(spec).toBe("1,3-5")

    const lineSet = parseHighlightedLineNumbers(spec)
    expect(Array.from(lineSet).sort((a, b) => a - b)).toEqual([1, 3, 4, 5])

    const rendered = renderImmediateCodeToHtml(
      ["const a = 1;", "const b = 2;", "const c = 3;", "const d = 4;"].join("\n"),
      "typescript",
      {
        showLineNumbers: true,
        highlightedLines: parseHighlightedLineNumbers("1,3-4"),
      }
    )

    const lineOpenTags = rendered.html.match(/<span class="line"[^>]*>/g) ?? []
    expect(lineOpenTags).toHaveLength(4)
    expect(lineOpenTags[0]).toContain('data-highlighted-line="true"')
    expect(lineOpenTags[1]).not.toContain('data-highlighted-line="true"')
    expect(lineOpenTags[2]).toContain('data-highlighted-line="true"')
    expect(lineOpenTags[3]).toContain('data-highlighted-line="true"')
  })

  test("AC-2: planMarkdownEditorAutoPairInsert wraps line-start selection with backtick, wraps multiline selections, and converts [text] + ( to [text]()", () => {
    // 1. Selecting first word on a line (selectionStart = 0) and pressing ` must wrap, not reject as fence context
    const lineStartBacktick = planMarkdownEditorAutoPairInsert(
      "hello world",
      0,
      5,
      "`"
    )
    expect(lineStartBacktick).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: 0,
        rangeEnd: 5,
        replacement: "`hello`",
        selectionStart: 1,
        selectionEnd: 6,
      },
    })

    // 2. Multi-line selection wraps with *, _, ~, $, ` but still returns null for (
    const multilineSource = "first line\nsecond line"
    for (const key of ["*", "_", "~", "$", "`"]) {
      const wrapped = planMarkdownEditorAutoPairInsert(
        multilineSource,
        0,
        multilineSource.length,
        key
      )
      expect(wrapped).toEqual({
        kind: "mutation",
        mutation: {
          rangeStart: 0,
          rangeEnd: multilineSource.length,
          replacement: `${key}${multilineSource}${key}`,
          selectionStart: 1,
          selectionEnd: multilineSource.length + 1,
        },
      })
    }
    expect(
      planMarkdownEditorAutoPairInsert(
        multilineSource,
        0,
        multilineSource.length,
        "("
      )
    ).toBeNull()

    // 3. Pressing ( when selection is immediately inside [selected] converts to [selected]()
    const bracketedSource = "Read [Obsidian Guide] now"
    const selStart = bracketedSource.indexOf("Obsidian Guide")
    const selEnd = selStart + "Obsidian Guide".length
    const linkPlan = planMarkdownEditorAutoPairInsert(
      bracketedSource,
      selStart,
      selEnd,
      "("
    )
    expect(linkPlan).toEqual({
      kind: "mutation",
      mutation: {
        rangeStart: selEnd,
        rangeEnd: selEnd + 1,
        replacement: "]()",
        selectionStart: selEnd + 2,
        selectionEnd: selEnd + 2,
      },
    })
    if (!linkPlan || linkPlan.kind !== "mutation") {
      throw new Error("Expected mutation plan")
    }
    const updatedText =
      bracketedSource.slice(0, linkPlan.mutation.rangeStart) +
      linkPlan.mutation.replacement +
      bracketedSource.slice(linkPlan.mutation.rangeEnd)
    expect(updatedText).toBe("Read [Obsidian Guide]() now")
  })

  test("AC-2: MarkdownCalloutWidget tracks foldState equality and FencedCode carries codeLanguage", () => {
    const widgetCollapsed = new MarkdownCalloutWidget(
      "warning",
      "Watch Out",
      "> Body",
      0,
      20,
      "-"
    )
    const widgetExpanded = new MarkdownCalloutWidget(
      "warning",
      "Watch Out",
      "> Body",
      0,
      20,
      "+"
    )
    const widgetCollapsedClone = new MarkdownCalloutWidget(
      "warning",
      "Watch Out",
      "> Body",
      0,
      20,
      "-"
    )
    expect(widgetCollapsed.eq(widgetExpanded)).toBe(false)
    expect(widgetCollapsed.eq(widgetCollapsedClone)).toBe(true)

    const markdown = "Paragraph\n\n```rust\nfn main() {}\n```\n"
    const specs = buildMarkdownLivePreviewDecorationSpecs(markdown, [
      { from: 0, to: 0 },
    ])
    const fencedSpec = specs.find((item) => item.kind === "fenced-code")
    expect(fencedSpec).toBeDefined()
    expect(fencedSpec?.codeLanguage).toBe("rust")
  })

  test("AC-3: Live Preview entries are pre-sorted, bit-flagged with ENTRY_FLAG_IN_TASK, and hasIntervalOverlap uses binary search", () => {
    const markdown = "- [x] **Task bold** item\n\nOutside *italic* text"
    const entries = buildMarkdownLivePreviewEntries(markdown)

    // Verify entries are sorted by from ASC, to ASC
    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1]
      const curr = entries[i]
      expect(
        prev.from < curr.from || (prev.from === curr.from && prev.to <= curr.to)
      ).toBe(true)
    }

    const hideMarks = entries.filter((entry) => entry.kind === "hide-mark")
    expect(hideMarks.length).toBeGreaterThanOrEqual(4)

    const taskHideMarks = hideMarks.filter((entry) => entry.to <= 24)
    const outsideHideMarks = hideMarks.filter((entry) => entry.from > 24)

    expect(taskHideMarks.length).toBeGreaterThanOrEqual(2)
    for (const mark of taskHideMarks) {
      expect((mark.flags ?? 0) & ENTRY_FLAG_IN_TASK).toBe(ENTRY_FLAG_IN_TASK)
    }
    for (const mark of outsideHideMarks) {
      expect((mark.flags ?? 0) & ENTRY_FLAG_IN_TASK).toBe(0)
    }

    const sortedRanges = [
      { from: 10, to: 20 },
      { from: 30, to: 45 },
      { from: 60, to: 80 },
    ]
    expect(hasIntervalOverlap(sortedRanges, 0, 10)).toBe(false)
    expect(hasIntervalOverlap(sortedRanges, 20, 30)).toBe(false)
    expect(hasIntervalOverlap(sortedRanges, 45, 60)).toBe(false)
    expect(hasIntervalOverlap(sortedRanges, 80, 95)).toBe(false)
    expect(hasIntervalOverlap(sortedRanges, 15, 25)).toBe(true)
    expect(hasIntervalOverlap(sortedRanges, 25, 35)).toBe(true)
    expect(hasIntervalOverlap(sortedRanges, 65, 70)).toBe(true)
    expect(hasIntervalOverlap(sortedRanges, 5, 90)).toBe(true)
  })

  test("AC-3: createMarkdownDocumentInsights single-pass scanner, hasUniformFenceMarker, TOC slug reuse, and formula LRU cache", async () => {
    const doc = [
      "# Main Heading 🚀",
      "",
      "Some text with [[WikiLink]] and `inline` code.",
      "",
      "```ts",
      "# Fake Heading Inside Code",
      "```",
      "",
      "~~~",
      "## Another Fake Heading",
      "~~~",
      "",
      "## Second Section ###",
    ].join("\n")

    const insights = createMarkdownDocumentInsights(doc)
    expect(insights.characterCount).toBeGreaterThan(20)
    expect(insights.wordCount).toBeGreaterThan(5)
    expect(insights.headings).toHaveLength(2)
    expect(insights.headings[0]).toMatchObject({
      level: 1,
      label: "Main Heading 🚀",
      slug: "main-heading",
      id: "main-heading",
    })
    expect(insights.headings[1]).toMatchObject({
      level: 2,
      label: "Second Section",
      slug: "second-section",
      id: "second-section",
    })

    const toc = buildInitialTocFromMarkdown(doc)
    expect(toc).toEqual([
      { id: "second-section", text: "Second Section", level: 2 },
    ])

    expect(hasUniformFenceMarker("```", "`")).toBe(true)
    expect(hasUniformFenceMarker("````", "`")).toBe(true)
    expect(hasUniformFenceMarker("~~", "~")).toBe(false)
    expect(hasUniformFenceMarker("``~", "`")).toBe(false)

    const formulaFirst = await renderFormulaToHtml("x^2 + y^2 = z^2", {
      displayMode: false,
    })
    const formulaSecond = await renderFormulaToHtml("x^2 + y^2 = z^2", {
      displayMode: false,
    })
    expect(formulaFirst).toBe(formulaSecond)
    expect(formulaFirst).toContain("katex")
  })
})
