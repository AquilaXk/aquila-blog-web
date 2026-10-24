import { expect, test } from "@playwright/test"
import {
  buildInitialTocFromMarkdown,
  measureHeadingOffsets,
  resolveActiveTocIdFromOffsets,
  type HeadingOffset,
  type TocItem,
} from "../../src/routes/Detail/PostDetail/PostDetailTocModel"

test.describe("PostDetailTocModel decoupled layout reading", () => {
  const sampleItems: TocItem[] = [
    { id: "intro", text: "Introduction", level: 2 },
    { id: "details", text: "Details", level: 3 },
    { id: "summary", text: "Summary", level: 2 },
  ]

  test("buildInitialTocFromMarkdown extracts h2-h4 headings with deterministic slugs for SSR TOC", () => {
    const markdown = [
      "# Ignored H1",
      "## Overview",
      "### Deep Dive",
      "#### Implementation",
      "### Deep Dive",
    ].join("\n\n")

    expect(buildInitialTocFromMarkdown(markdown)).toEqual([
      { id: "overview", text: "Overview", level: 2 },
      { id: "deep-dive", text: "Deep Dive", level: 3 },
      { id: "implementation", text: "Implementation", level: 4 },
      { id: "deep-dive-2", text: "Deep Dive", level: 3 },
    ])
    expect(buildInitialTocFromMarkdown("   ")).toEqual([])
  })

  test("resolveActiveTocIdFromOffsets returns empty string for empty offsets", () => {
    expect(resolveActiveTocIdFromOffsets([], 100, 80)).toBe("")
  })

  test("resolveActiveTocIdFromOffsets selects heading before or at boundary threshold", () => {
    const offsets: HeadingOffset[] = [
      { id: "intro", topDoc: 100 },
      { id: "details", topDoc: 400 },
      { id: "summary", topDoc: 900 },
    ]

    // scrollY = 0, boundary = 80 => threshold = 80 (< 100) => first item active
    expect(resolveActiveTocIdFromOffsets(offsets, 0, 80)).toBe("intro")

    // scrollY = 200, boundary = 80 => threshold = 280 (>= 100, < 400) => intro
    expect(resolveActiveTocIdFromOffsets(offsets, 200, 80)).toBe("intro")

    // scrollY = 350, boundary = 80 => threshold = 430 (>= 400, < 900) => details
    expect(resolveActiveTocIdFromOffsets(offsets, 350, 80)).toBe("details")

    // scrollY = 850, boundary = 80 => threshold = 930 (>= 900) => summary
    expect(resolveActiveTocIdFromOffsets(offsets, 850, 80)).toBe("summary")
  })

  test("measureHeadingOffsets safely handles missing DOM elements in SSR", () => {
    const offsets = measureHeadingOffsets(sampleItems, 0)
    expect(offsets).toEqual([])
  })

  test("buildInitialTocFromMarkdown reuses pre-extracted headings and resolveActiveTocIdFromOffsets resolves large sorted offset lists via binary search", () => {
    const preExtracted = [
      { id: "title", level: 1 as const, label: "Title", slug: "title", offset: 0, range: { start: 0, end: 7 } },
      { id: "first", level: 2 as const, label: "First", slug: "first", offset: 8, range: { start: 8, end: 16 } },
      { id: "second", level: 3 as const, label: "Second", slug: "second", offset: 17, range: { start: 17, end: 27 } },
    ]
    expect(buildInitialTocFromMarkdown("# Title\n## First\n### Second", preExtracted)).toEqual([
      { id: "first", text: "First", level: 2 },
      { id: "second", text: "Second", level: 3 },
    ])

    const largeOffsets: HeadingOffset[] = Array.from({ length: 120 }, (_, index) => ({
      id: `section-${index}`,
      topDoc: (index + 1) * 100,
    }))
    expect(resolveActiveTocIdFromOffsets(largeOffsets, 0, 50)).toBe("section-0")
    expect(resolveActiveTocIdFromOffsets(largeOffsets, 5420, 80)).toBe("section-54")
    expect(resolveActiveTocIdFromOffsets(largeOffsets, 15000, 80)).toBe("section-119")
  })
})

