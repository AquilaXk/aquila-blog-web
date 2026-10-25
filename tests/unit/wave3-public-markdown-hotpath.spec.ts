import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { extractMarkdownTableLayouts } from "../../src/libs/markdown/tableMetadata"
import {
  normalizeLegacyCollapsedBlockquoteStrongLines,
  normalizeMarkdownForRender,
} from "../../src/libs/markdown/renderingNormalizeModel"
import { normalizeLegacyInlineHtmlSpans } from "../../src/libs/markdown/inlineHtmlNormalization"
import { normalizeMarkdownInlineChildren } from "../../src/libs/markdown/MarkdownRendererInline"
import {
  countMermaidEdgeTokens,
  estimateMermaidComplexity,
} from "../../src/libs/markdown/mermaidRuntimeConfig"
import { extractSavedAt } from "../../src/routes/Feed/FeedExplorerRestoreModel"
import {
  computeCenterClearance,
  resolveParticleClearance,
} from "../../src/routes/Company/CompanyHeroParticles"

const ROOT_DIR = path.resolve(__dirname, "../..")
const readRepoFile = (relPath: string) => readFileSync(path.join(ROOT_DIR, relPath), "utf8")

test.describe("wave3 public pages, responsive layout, deslop, and markdown hot paths", () => {
  test("extractMarkdownTableLayouts skips cleanedLines rebuild when aq-table comment is absent", () => {
    const gfmTableMarkdown = [
      "# Benchmarks",
      "",
      "| Metric | Before | After |",
      "| :--- | ---: | ---: |",
      "| Latency | 12.4ms | 3.1ms |",
      "| Allocations | 42 | 0 |",
    ].join("\n")

    const withoutComment = extractMarkdownTableLayouts(gfmTableMarkdown)
    expect(withoutComment.cleanedMarkdown).toBe(gfmTableMarkdown)
    expect(withoutComment.layouts).toEqual([null])

    const withCommentMarkdown = [
      '<!-- aq-table {"overflowMode":"wide","columnWidths":[180,220,220]} -->',
      "| Metric | Before | After |",
      "| :--- | ---: | ---: |",
      "| Latency | 12.4ms | 3.1ms |",
    ].join("\n")

    const withComment = extractMarkdownTableLayouts(withCommentMarkdown)
    expect(withComment.cleanedMarkdown).toBe(
      ["| Metric | Before | After |", "| :--- | ---: | ---: |", "| Latency | 12.4ms | 3.1ms |"].join(
        "\n"
      )
    )
    expect(withComment.layouts).toEqual([
      {
        overflowMode: "wide",
        columnWidths: [180, 220, 220],
      },
    ])
  })

  test("normalizeLegacyCollapsedBlockquoteStrongLines fast-paths when blockquote marker is absent", () => {
    const nonBlockquoteQuadStar = "Paragraph with ****inline**** emphasis tokens but no blockquote."
    expect(normalizeLegacyCollapsedBlockquoteStrongLines(nonBlockquoteQuadStar)).toBe(
      nonBlockquoteQuadStar
    )

    const collapsedBlockquote = "> **First item****Second item**"
    expect(normalizeLegacyCollapsedBlockquoteStrongLines(collapsedBlockquote)).toBe(
      ["> **First item**", "> **Second item**"].join("\n")
    )
    expect(normalizeMarkdownForRender(collapsedBlockquote)).toBe(
      ["> **First item**", "> **Second item**"].join("\n")
    )
  })

  test("normalizeLegacyInlineHtmlSpans guards raw angle brackets and escaped entities independently", () => {
    const plainText = "Plain technical prose without HTML spans or entities."
    expect(normalizeLegacyInlineHtmlSpans(plainText)).toBe(plainText)

    const rawOnly = "Use <code>setTransform</code> and <strong>fast</strong> paths."
    expect(normalizeLegacyInlineHtmlSpans(rawOnly)).toBe(
      "Use `setTransform` and **fast** paths."
    )

    const entityOnly =
      "Escaped &lt;code&gt;WeakMap&lt;/code&gt; and &lt;em&gt;inline&lt;/em&gt; &lt;del&gt;old&lt;/del&gt;."
    expect(normalizeLegacyInlineHtmlSpans(entityOnly)).toBe(
      "Escaped `WeakMap` and *inline* ~~old~~."
    )
  })

  test("normalizeMarkdownInlineChildren fast-paths plain strings and transforms special syntax", () => {
    const plain = "Standard paragraph text with numbers 12345 and punctuation, period."
    expect(normalizeMarkdownInlineChildren(plain)).toBe(plain)

    const colored = normalizeMarkdownInlineChildren("Prefix {{color:blue|highlighted}} suffix")
    expect(Array.isArray(colored)).toBe(true)
  })

  test("countMermaidEdgeTokens and estimateMermaidComplexity count all 13 edge tokens with charCode precheck", () => {
    const diagram = [
      "flowchart LR",
      "  A[Start] <--> B(Bidirectional)",
      "  B -.-> C{Decision}",
      "  C ==> D((Heavy))",
      "  D --> E[Next]",
      "  E --x F[Cross]",
      "  F x-- G[ReverseCross]",
      "  G o-- H[CircleLeft]",
      "  H --o I[CircleRight]",
      "  I <-- J[LeftArrow]",
      "  J <-> K[ShortBi]",
      "  K => L[FatRight]",
      "  L <= M[FatLeft]",
      "  M == N[DoubleLine]",
    ].join("\n")

    expect(countMermaidEdgeTokens(diagram)).toBe(13)
    const summary = estimateMermaidComplexity(diagram)
    expect(summary.edgeCount).toBe(13)
    expect(summary.nodeCount).toBe(14)
    expect(summary.level).toBe("normal")
  })

  test("extractSavedAt extracts leading savedAt via regex fast path and falls back to JSON.parse", () => {
    expect(extractSavedAt(null)).toBe(0)
    expect(extractSavedAt("")).toBe(0)
    expect(
      extractSavedAt('{"savedAt":1729810000123,"pages":[{"posts":[],"totalCount":1}]}')
    ).toBe(1729810000123)
    expect(
      extractSavedAt('{"q":"react","tag":"perf","scrollY":240,"loadedPages":2,"savedAt":1729810099000}')
    ).toBe(1729810099000)
    expect(
      extractSavedAt('{"nested":{"id":1},"savedAt":1729810055000}')
    ).toBe(1729810055000)
    expect(extractSavedAt("{invalid json")).toBe(0)
  })

  test("resolveParticleClearance exposes precomputed center coordinates and computeCenterClearance culls center", () => {
    const desktopSpec = resolveParticleClearance(1280, 720)
    expect(desktopSpec.cx).toBe(640)
    expect(desktopSpec.cy).toBe(360)
    expect(computeCenterClearance(640, 360, 1280, 720, desktopSpec)).toBe(0)
    expect(computeCenterClearance(1280, 720, 1280, 720, desktopSpec)).toBe(1)

    const mobileSpec = resolveParticleClearance(390, 640)
    expect(mobileSpec.cx).toBe(195)
    expect(mobileSpec.cy).toBe(320)
    expect(computeCenterClearance(195, 320, 390, 640, mobileSpec)).toBe(0)
  })

  test("enforces PC/tablet/mobile responsive rules, 44px coarse pointer targets, and slop removal", () => {
    const postDetailStyles = readRepoFile("src/routes/Detail/PostDetail/PostDetail.styles.ts")
    expect(postDetailStyles).toContain(".detailLayout[data-toc=\"false\"]")
    expect(postDetailStyles).toContain("grid-template-columns: 64px minmax(0, 740px);")
    expect(postDetailStyles).toContain(".mobileTocBlock")

    const postHeaderTsx = readRepoFile("src/routes/Detail/PostDetail/PostHeader.tsx")
    const hideMobileMatches = postHeaderTsx.match(/data-hide-mobile=/g) ?? []
    expect(hideMobileMatches.length).toBe(1)

    const markdownTableTsx = readRepoFile("src/libs/markdown/MarkdownRendererTable.tsx")
    expect(markdownTableTsx).not.toContain('minWidth: "680px"')

    const tableToggleStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootTableToggleStyles.ts"
    )
    expect(tableToggleStyles).toContain('.aq-table[data-narrow-table="true"]')

    const searchInputTsx = readRepoFile("src/routes/Feed/SearchInput.tsx")
    expect(searchInputTsx).toContain("@media (max-width: 820px), (pointer: coarse)")

    const feedExplorerStyles = readRepoFile("src/routes/Feed/FeedExplorer.styles.ts")
    expect(feedExplorerStyles).toContain("@media (max-width: 820px), (pointer: coarse)")

    const postListTsx = readRepoFile("src/routes/Feed/PostList/index.tsx")
    expect(postListTsx).toContain("@media (max-width: 820px), (pointer: coarse)")

    const initialLoadErrorTsx = readRepoFile("src/routes/Feed/PostList/InitialLoadErrorState.tsx")
    expect(initialLoadErrorTsx).toContain("@media (max-width: 820px), (pointer: coarse)")

    const tagListTsx = readRepoFile("src/routes/Feed/TagList.tsx")
    expect(tagListTsx).toContain("@media (hover: hover)")
    expect(tagListTsx).not.toContain("font-weight: 760")

    const headerTsx = readRepoFile("src/layouts/RootLayout/Header/index.tsx")
    expect(headerTsx).not.toContain("backdrop-filter")

    const navBarTsx = readRepoFile("src/layouts/RootLayout/Header/NavBar.tsx")
    expect(navBarTsx).not.toContain("linear-gradient")
    expect(navBarTsx).toContain("@media (pointer: coarse)")

    const mermaidStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootMermaidStyles.ts"
    )
    expect(mermaidStyles).not.toContain("backdrop-filter")
    expect(mermaidStyles).toContain("@media (max-width: 820px), (pointer: coarse)")

    const baseStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootBaseStyles.ts"
    )
    expect(baseStyles).toContain("0 2px 8px rgba(15, 23, 42, 0.1)")
    expect(baseStyles).not.toContain("0 8px 24px rgba(15, 23, 42, 0.14)")

    const lightboxSource = readRepoFile("src/libs/markdown/imageLightboxOverlay.ts")
    expect(lightboxSource).not.toContain("backdropFilter")

    const companyPageStyles = readRepoFile("src/routes/Company/CompanyPage.styles.ts")
    expect(companyPageStyles).not.toContain("backdrop-filter")
    expect(companyPageStyles).not.toContain("radius.pill")

    const companySectionStyles = readRepoFile("src/routes/Company/CompanySection.styles.ts")
    expect(companySectionStyles).not.toContain("radius.pill")

    const companyNewsStyles = readRepoFile("src/routes/Company/CompanyNews.styles.ts")
    expect(companyNewsStyles).not.toContain("radius.pill")
    expect(companyNewsStyles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));")
    expect(companyNewsStyles).toContain("@media (max-width: 640px)")
  })
})
