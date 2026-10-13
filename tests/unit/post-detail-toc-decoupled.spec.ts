import { expect, test } from "@playwright/test"
import {
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
    // In node environment without document.getElementById, returns empty array without throwing
    expect(offsets).toEqual([])
  })
})
