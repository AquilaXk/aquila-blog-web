import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import {
  TABLE_COL_COUNT_SHIFT,
  TABLE_SCROLL_HINT_BIT,
  TABLE_SCROLL_LEFT_BIT,
  packTableUiState,
  unpackTableUiState,
} from "../../src/libs/markdown/MarkdownRendererTable"
import {
  CODE_COLLAPSED_BIT,
  CODE_COPIED_BIT,
  CODE_COPY_FAILED_BIT,
  countRawCodeLines,
  packCodeBlockUiState,
} from "../../src/libs/markdown/components/PrettyCodeBlock"
import {
  hasNonCanonicalPostImageSource,
  markdownCardThumbnailSources,
} from "../../src/libs/markdown/postImageUrlPolicy"
import {
  normalizeMalformedTrailingSpaceEmphasis,
  normalizeMalformedTrailingSpaceEmphasisLine,
  normalizeMalformedTrailingSpaceEmphasisSegment,
} from "../../src/libs/markdown/renderingNormalizeModel"
import { selectUniqueRelatedPosts } from "../../src/routes/Detail/PostDetail/PostDetailRelatedSection"
import {
  buildInitialTocFromMarkdown,
  collectTocFromArticle,
  nodeCollectionTouchesHeading,
} from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { renderLineWrappedHtml } from "../../src/libs/markdown/prismRuntime"
import { isMermaidSource } from "../../src/libs/markdown/mermaidRuntimeConfig"
import { splitCategoryDisplay } from "../../src/libs/utils/category"
import {
  normalizeKeywordQuery,
  normalizeShallowRouteValue,
  normalizeUnicode,
} from "../../src/libs/query/normalize"
import type { TPost } from "../../src/types"

const ROOT_DIR = path.resolve(__dirname, "../..")
const readRepoFile = (relPath: string) => readFileSync(path.join(ROOT_DIR, relPath), "utf8")

const makePost = (id: string, title: string): TPost =>
  ({
    id,
    title,
    slug: id,
    createdTime: "2026-10-25T00:00:00.000Z",
    date: { start_date: "2026-10-25" },
    type: ["Post"],
    status: ["Public"],
  }) as unknown as TPost

test.describe("wave4 Track A public routes, responsive hardening, deslop, and hot paths", () => {
  test("packTableUiState and unpackTableUiState round-trip scroll flags and column counts", () => {
    const cases: Array<[boolean, boolean, number]> = [
      [false, false, 0],
      [true, false, 2],
      [false, true, 3],
      [true, true, 8],
      [false, false, -5],
    ]

    for (const [hasScrollLeft, showScrollHint, cols] of cases) {
      const mask = packTableUiState(hasScrollLeft, showScrollHint, cols)
      const unpacked = unpackTableUiState(mask)
      expect(unpacked.hasScrollLeft).toBe(hasScrollLeft)
      expect(unpacked.showScrollHint).toBe(showScrollHint)
      expect(unpacked.detectedColumnCount).toBe(cols > 0 ? cols : 0)
    }

    expect(packTableUiState(true, true, 5)).toBe(
      TABLE_SCROLL_LEFT_BIT | TABLE_SCROLL_HINT_BIT | (5 << TABLE_COL_COUNT_SHIFT)
    )
  })

  test("packCodeBlockUiState and countRawCodeLines encode code block UI bitmask and line counts", () => {
    expect(packCodeBlockUiState(false, "idle")).toBe(0)
    expect(packCodeBlockUiState(true, "idle")).toBe(CODE_COLLAPSED_BIT)
    expect(packCodeBlockUiState(true, "copied")).toBe(CODE_COLLAPSED_BIT | CODE_COPIED_BIT)
    expect(packCodeBlockUiState(false, "failed")).toBe(CODE_COPY_FAILED_BIT)

    const initialMask = packCodeBlockUiState(true, "copied")
    const toggledMask = initialMask ^ CODE_COLLAPSED_BIT
    expect(toggledMask & CODE_COLLAPSED_BIT).toBe(0)
    expect(toggledMask & CODE_COPIED_BIT).toBe(CODE_COPIED_BIT)

    expect(countRawCodeLines("")).toBe(0)
    expect(countRawCodeLines("const a = 1")).toBe(1)
    expect(countRawCodeLines("line1\nline2\nline3")).toBe(3)
  })

  test("markdownCardThumbnailSources extracts valid card thumbnails in O(N) single pass", () => {
    const validMultiCard = [
      '<!-- aq-bookmark {"thumbnailUrl":"https://cdn.example.com/a.png"} -->',
      ":::bookmark https://example.com/a",
      "Card A",
      ":::",
      "",
      '<!-- AQ-EMBED {"thumbnailUrl":"/assets/b.webp"} -->',
      ":::EMBED https://example.com/b",
      "Card B",
      ":::",
    ].join("\n")

    expect(markdownCardThumbnailSources(validMultiCard)).toEqual([
      "https://cdn.example.com/a.png",
      "/assets/b.webp",
    ])

    const mismatchedDirective = [
      '<!-- aq-bookmark {"thumbnailUrl":"https://cdn.example.com/mismatch.png"} -->',
      ":::embed https://example.com/mismatch",
      "Mismatched kind",
      ":::",
    ].join("\n")
    expect(markdownCardThumbnailSources(mismatchedDirective)).toEqual([])

    const missingClosingFence = [
      '<!-- aq-bookmark {"thumbnailUrl":"https://cdn.example.com/unclosed.png"} -->',
      ":::bookmark https://example.com/unclosed",
      "No closing triple colon anywhere after directive",
    ].join("\n")
    expect(markdownCardThumbnailSources(missingClosingFence)).toEqual([])

    expect(hasNonCanonicalPostImageSource(validMultiCard)).toBe(true)
  })

  test("normalizeMalformedTrailingSpaceEmphasis fixes trailing spaces inside emphasis while preserving normal spans and code", () => {
    const cleanBoldItalic = "Normal **bold** and *italic* and __strong__ and _em_ text."
    expect(normalizeMalformedTrailingSpaceEmphasisSegment(cleanBoldItalic)).toBe(cleanBoldItalic)
    expect(normalizeMalformedTrailingSpaceEmphasisLine(cleanBoldItalic)).toBe(cleanBoldItalic)
    expect(normalizeMalformedTrailingSpaceEmphasis(cleanBoldItalic)).toBe(cleanBoldItalic)

    const multiBoldSameLine =
      "WebSocket 보안은 **인증 시점(Handshake)**과 **메시지 라우팅 시점(STOMP Frame)**이 분리되어 있습니다."
    expect(normalizeMalformedTrailingSpaceEmphasis(multiBoldSameLine)).toBe(multiBoldSameLine)

    const malformed = "Fix **bold ** and *italic * and __under __ and _em _ now."
    expect(normalizeMalformedTrailingSpaceEmphasis(malformed)).toBe(
      "Fix **bold** and *italic* and __under__ and _em_ now."
    )

    const withInlineCode = "Keep `**code **` untouched but fix **prose ** here."
    expect(normalizeMalformedTrailingSpaceEmphasis(withInlineCode)).toBe(
      "Keep `**code **` untouched but fix **prose** here."
    )

    const withFencedCode = [
      "Outside **bad **",
      "```md",
      "Inside **bad **",
      "```",
    ].join("\n")
    expect(normalizeMalformedTrailingSpaceEmphasis(withFencedCode)).toBe(
      ["Outside **bad**", "```md", "Inside **bad **", "```"].join("\n")
    )
  })

  test("selectUniqueRelatedPosts deduplicates across tag and author lists with early exit", () => {
    const p1 = makePost("1", "Post 1")
    const p2 = makePost("2", "Post 2")
    const p3 = makePost("3", "Post 3")

    expect(selectUniqueRelatedPosts([p1, p2], [p2, p3], 2)).toEqual([p1, p2])
    expect(selectUniqueRelatedPosts([p1], [p1, p2, p3], 2)).toEqual([p1, p2])
    expect(selectUniqueRelatedPosts([], [p2, p3], 2)).toEqual([p2, p3])
    expect(selectUniqueRelatedPosts([p1, p2], [p3], 0)).toEqual([])
  })

  test("PostDetailTocModel builds initial TOC in a single loop and inspects ArrayLike NodeLists without Array.from", () => {
    const markdown = [
      "# Title H1",
      "## Section Two",
      "### Section Three",
      "#### Section Four",
    ].join("\n")

    const toc = buildInitialTocFromMarkdown(markdown)
    expect(toc).toEqual([
      { id: "section-two", text: "Section Two", level: 2 },
      { id: "section-three", text: "Section Three", level: 3 },
      { id: "section-four", text: "Section Four", level: 4 },
    ])

    const nonHeadingNode = {
      matches: () => false,
      closest: () => null,
      querySelector: () => null,
    } as unknown as Node
    const headingNode = {
      matches: (selector: string) => selector.includes("h2"),
      closest: () => null,
      querySelector: () => null,
    } as unknown as Node

    const arrayLikeWithoutHeading: ArrayLike<Node> = {
      length: 1,
      0: nonHeadingNode,
    }
    const arrayLikeWithHeading: ArrayLike<Node> = {
      length: 2,
      0: nonHeadingNode,
      1: headingNode,
    }

    expect(nodeCollectionTouchesHeading(arrayLikeWithoutHeading)).toBe(false)
    expect(nodeCollectionTouchesHeading(arrayLikeWithHeading)).toBe(true)

    const fakeHeadings = [
      { tagName: "H2", textContent: "Overview", id: "" },
      { tagName: "H3", textContent: "Details", id: "custom-details" },
      { tagName: "H5", textContent: "Ignored H5", id: "" },
    ]
    const fakeArticle = {
      querySelectorAll: () => fakeHeadings,
    } as unknown as HTMLElement

    expect(collectTocFromArticle(fakeArticle)).toEqual([
      { id: "overview", text: "Overview", level: 2 },
      { id: "custom-details", text: "Details", level: 3 },
    ])
  })

  test("renderLineWrappedHtml wraps lines in a single indexOf pass with highlight attributes", () => {
    expect(renderLineWrappedHtml("")).toBe('<span class="line" data-line="true"><br /></span>')
    expect(renderLineWrappedHtml("first\n\nthird", new Set([1, 3]))).toBe(
      [
        '<span class="line" data-line="true" data-highlighted-line="true">first</span>',
        '<span class="line" data-line="true"><br /></span>',
        '<span class="line" data-line="true" data-highlighted-line="true">third</span>',
      ].join("")
    )
  })

  test("isMermaidSource identifies mermaid headers from the first non-empty line without full-line array splits", () => {
    expect(isMermaidSource("")).toBe(false)
    expect(isMermaidSource("\n\n  flowchart LR\n  A --> B\n")).toBe(true)
    expect(isMermaidSource("```mermaid\nsequenceDiagram\nAlice->>Bob: Hi\n```")).toBe(true)
    expect(isMermaidSource("1 flowchart TD\n2 A --> B")).toBe(true)
    expect(isMermaidSource("const x = 42;\nconsole.log(x);")).toBe(false)
  })

  test("splitCategoryDisplay caches parsed category displays with bounded FIFO eviction", () => {
    const first = splitCategoryDisplay("rocket::Performance")
    const second = splitCategoryDisplay("rocket::Performance")
    expect(first).toBe(second)
    expect(first).toEqual({
      iconId: "rocket",
      label: "Performance",
      value: "rocket::Performance",
      isDefault: false,
    })

    let newestCached: ReturnType<typeof splitCategoryDisplay> | null = null
    for (let i = 0; i < 260; i += 1) {
      newestCached = splitCategoryDisplay(`folder::Category-${i}`)
    }
    expect(splitCategoryDisplay("folder::Category-259")).toBe(newestCached)
    const recomputed = splitCategoryDisplay("rocket::Performance")
    expect(recomputed).not.toBe(first)
    expect(recomputed).toEqual(first)
  })

  test("normalizeUnicode skips NFKC on pure ASCII and normalizes compatibility Unicode characters", () => {
    const ascii = "react-query hotpath 123"
    expect(normalizeUnicode(ascii)).toBe(ascii)
    expect(normalizeKeywordQuery("  react   query  ")).toBe("react query")
    expect(normalizeUnicode("Ｒｅａｃｔ")).toBe("React")
    expect(normalizeShallowRouteValue("kw", "  ＴypeＳcript   5  ")).toBe("TypeScript 5")
  })

  test("enforces Wave-4 Track A responsive 44px coarse pointer targets and AI slop removal", () => {
    const postHeaderStyles = readRepoFile("src/routes/Detail/PostDetail/PostHeader.styles.ts")
    expect(postHeaderStyles).toContain("@media (max-width: 820px), (pointer: coarse)")

    const tagListTsx = readRepoFile("src/routes/Feed/TagList.tsx")
    expect(tagListTsx).toContain("@media (pointer: coarse)")
    expect(tagListTsx).toContain(".desktopList button,\n    .toggleButton {\n      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;")

    const aboutStyles = readRepoFile("src/routes/About/AboutPage.styles.ts")
    expect(aboutStyles).toContain("@media (max-width: 1024px)")
    expect(aboutStyles).toContain("@media (max-width: 820px), (pointer: coarse)")

    const logoTsx = readRepoFile("src/layouts/RootLayout/Header/Logo.tsx")
    expect(logoTsx).toContain("@media (max-width: 1024px)")

    const navBarTsx = readRepoFile("src/layouts/RootLayout/Header/NavBar.tsx")
    expect(navBarTsx).toContain("width: clamp(156px, 18vw, 212px);")

    const baseStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootBaseStyles.ts"
    )
    expect(baseStyles).toContain("min-width: 44px;\n      min-height: 44px;")

    const tableToggleStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootTableToggleStyles.ts"
    )
    expect(tableToggleStyles).toContain("min-height: 44px;")
    expect(tableToggleStyles).not.toContain("linear-gradient")
    expect(tableToggleStyles).toContain("border-left: 2px solid ${theme.publicDesign.borderStrong};")
    expect(tableToggleStyles).toContain("border-right: 2px solid ${theme.publicDesign.borderStrong};")

    const codeStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts"
    )
    expect(codeStyles).not.toContain("linear-gradient")

    const easySubwayPageStyles = readRepoFile("src/routes/EasySubway/EasySubwayPage.styles.ts")
    expect(easySubwayPageStyles).not.toContain("backdrop-filter")
    expect(easySubwayPageStyles).not.toContain("radius.pill")
    expect(easySubwayPageStyles).toContain("background: var(--es-surface-elevated);")

    const easySubwayScopeStyles = readRepoFile("src/routes/EasySubway/EasySubwayScope.styles.ts")
    expect(easySubwayScopeStyles).not.toContain("radius.pill")
  })
})
