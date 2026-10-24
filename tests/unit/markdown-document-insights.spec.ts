import { expect, test } from "@playwright/test"
import {
  countCodePoints,
  countWords,
  createMarkdownDocumentInsights,
  createMarkdownHeadingSlugAllocator,
  formatMarkdownHeadingLabel,
  hasHeadingInlineSyntax,
} from "../../src/libs/markdown/markdownDocumentInsights"

test("collects H1-H4 source ranges, skips fenced source, and allocates Unicode slugs", () => {
  const markdown = [
    "# Title",
    "## 첫 번째",
    "본문",
    "```md",
    "### ignored",
    "```",
    "#### Details ###",
    "## 첫 번째",
  ].join("\n")

  const insights = createMarkdownDocumentInsights(markdown)

  expect(insights.headings).toEqual([
    { level: 1, label: "Title", offset: 0, range: { start: 0, end: 7 }, slug: "title" },
    { level: 2, label: "첫 번째", offset: 8, range: { start: 8, end: 15 }, slug: "첫-번째" },
    { level: 4, label: "Details", offset: 41, range: { start: 41, end: 57 }, slug: "details" },
    { level: 2, label: "첫 번째", offset: 58, range: { start: 58, end: 65 }, slug: "첫-번째-2" },
  ])
})

test("uses rendered-equivalent labels and keeps marker text inside an active fence", () => {
  const insights = createMarkdownDocumentInsights([
    "```md",
    "```not a closing fence",
    "## ignored",
    "```",
    "## [Link *text*](https://example.com) with `code`",
  ].join("\n"))

  expect(insights.headings).toEqual([
    {
      level: 2,
      label: "Link text with code",
      offset: 44,
      range: { start: 44, end: 93 },
      slug: "link-text-with-code",
    },
  ])
})

test("counts trimmed Markdown source by Unicode code point and whitespace tokens", () => {
  const insights = createMarkdownDocumentInsights(" \n**한 글**  \\n```ts\nconst x = 1\n```\n ")

  expect(insights.characterCount).toBe(Array.from("**한 글**  \\n```ts\nconst x = 1\n```").length)
  expect(insights.wordCount).toBe(8)
  expect(insights.readingMinutes).toBe(1)
})

test("returns zero reading time for an empty trimmed body", () => {
  expect(createMarkdownDocumentInsights(" \n\t ").readingMinutes).toBe(0)
})

test("shares deterministic duplicate allocation for rendered TOC ids", () => {
  const allocator = createMarkdownHeadingSlugAllocator()

  expect(allocator.allocate("같은 제목")).toBe("같은-제목")
  expect(allocator.allocate("같은 제목")).toBe("같은-제목-2")
  expect(allocator.allocate("Rendered text", "existing-id")).toBe("existing-id")
  expect(allocator.allocate("Rendered text", "existing-id")).toBe("existing-id-2")
})

test("advances past cross-base slug suffix collisions", () => {
  const allocator = createMarkdownHeadingSlugAllocator()

  expect(allocator.allocate("Foo")).toBe("foo")
  expect(allocator.allocate("Foo")).toBe("foo-2")
  expect(allocator.allocate("Foo-2")).toBe("foo-2-2")
  expect(allocator.allocate("Foo")).toBe("foo-3")
})

test("computes heading ranges in textarea-normalized coordinates for CRLF source", () => {
  const markdown = "body\r\n## second\r\n#### third"
  const normalizedTextareaValue = markdown.replace(/\r\n/g, "\n")

  const headings = createMarkdownDocumentInsights(markdown).headings

  expect(headings.map(({ range }) => normalizedTextareaValue.slice(range.start, range.end))).toEqual([
    "## second",
    "#### third",
  ])
  expect(headings.map(({ offset, range }) => ({ offset, range }))).toEqual([
    { offset: 5, range: { start: 5, end: 14 } },
    { offset: 15, range: { start: 15, end: 25 } },
  ])
})

test("fast-paths plain heading labels and strips inline syntax on formatted headings", () => {
  expect(hasHeadingInlineSyntax("Plain Heading Title")).toBe(false)
  expect(hasHeadingInlineSyntax("Heading with `code`")).toBe(true)
  expect(formatMarkdownHeadingLabel("  Plain   Heading \t Title  ")).toBe("Plain Heading Title")
  expect(
    formatMarkdownHeadingLabel("**Bold** _italic_ ~~strike~~ ![alt](img.png) [link](url) `literal_code`")
  ).toBe("Bold italic strike alt link literal_code")
})

test("counts surrogate pairs accurately in words and code points and skips non-H1..H4 hash lines", () => {
  const emojiText = "🚀🔥   💡✨   한글"
  expect(countCodePoints(emojiText)).toBe(Array.from(emojiText).length)
  expect(countWords(emojiText)).toBe(3)

  const insights = createMarkdownDocumentInsights(
    ["#hashtag without space", "##### H5 ignored", "###\tTab Heading 🚀"].join("\n")
  )
  expect(insights.headings).toHaveLength(1)
  expect(insights.headings[0]?.label).toBe("Tab Heading 🚀")
  expect(insights.headings[0]?.level).toBe(3)
})

