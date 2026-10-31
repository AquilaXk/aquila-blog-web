import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, Fragment, StrictMode, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { normalizeMarkdownInlineChildren } from "../../src/libs/markdown/MarkdownRendererInline"
import { normalizeLegacyInlineHtmlMarkdown } from "../../src/libs/markdown/inlineHtmlNormalization"
import {
  hasAsciiControlCharacters,
  normalizeSafeMarkdownUrl,
  normalizeSafeRelativeMarkdownPath,
} from "../../src/libs/markdown/safeMarkdownUrl"
import {
  extractMarkdownTableLayouts,
  normalizeMarkdownTableLayout,
  parseMarkdownTableLayoutComment,
} from "../../src/libs/markdown/tableMetadata"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"
import {
  createMarkdownDocumentInsights,
  formatMarkdownHeadingLabel,
} from "../../src/libs/markdown/markdownDocumentInsights"
import {
  loadSharedMermaidRuntime,
  resetSharedMermaidRuntimeForTests,
  runSerializedMermaidTask,
} from "../../src/libs/markdown/mermaidRuntimeConfig"
import { createMermaidRuntimeController } from "../../src/libs/markdown/mermaidRuntimeRender"
import {
  collectTocFromArticle,
  expandClosedAncestorDetails,
} from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { buildPostDetailMetadata } from "../../src/routes/Detail/PostDetail/postDetailMetadataModel"
import MetaConfig, { type MetaConfigProps } from "../../src/components/MetaConfig"
import {
  FloatingActionRail,
  MobileSummaryActions,
} from "../../src/routes/Detail/PostDetail/PostDetailActionSections"
import { createTheme } from "../../src/styles/theme"
import type { TPost } from "../../src/types"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const REPO_ROOT = path.resolve(__dirname, "../..")
const lightTheme = createTheme({ scheme: "light" })

const renderMarkdownHtml = (
  content: string,
  options: {
    forceScheme?: "light" | "dark"
    strictMode?: boolean
  } = {}
): string => {
  const queryClient = new QueryClient()
  const renderer = createElement(MarkdownRenderer, {
    content,
    disableMermaid: true,
    forceScheme: options.forceScheme,
  })
  const tree = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ThemeProvider, {
      theme: lightTheme,
      children: options.strictMode ? createElement(StrictMode, null, renderer) : renderer,
    })
  )
  return renderToStaticMarkup(materializePlaywrightJsx(tree) as ReactElement)
}

const renderMetaHeadHtml = (props: MetaConfigProps): string => {
  const headElement = (MetaConfig as (input: MetaConfigProps) => ReactElement<{ children?: unknown }>)(
    props
  )
  return renderToStaticMarkup(
    materializePlaywrightJsx(createElement(Fragment, null, headElement.props.children as never)) as ReactElement
  )
}

test.describe("wave 6 public markdown parity, sanitization, and PostDetail stability", () => {
  test("1. renders <br>, ==highlight==, and [[wikilink|alias]] outside code and links", () => {
    const normalizedTableSource = normalizeLegacyInlineHtmlMarkdown(
      "| Header |\n| --- |\n| first<br>second<br/>third &lt;br /&gt; fourth |",
    )
    expect(normalizedTableSource).toContain("first<br />second<br />third <br /> fourth")

    const directChildren = normalizeMarkdownInlineChildren("first<br>second")
    expect(Array.isArray(directChildren)).toBe(true)
    const directBrHtml = renderToStaticMarkup(
      materializePlaywrightJsx(createElement("td", null, directChildren)) as ReactElement
    )
    expect(directBrHtml).toBe("<td>first<br/>second</td>")

    const markdown = [
      "## Section Target",
      "",
      "Paragraph with ==warm highlight==, [[#Section Target|Jump Section]], [[/about|About Page]], [[//evil.example/phish]], and [[Distributed Consensus]].",
      "",
      "Do not transform `==code== [[CodeLink]] <br>` or [==link== [[LinkTarget]]](https://example.com).",
      "",
      "| Col A | Col B |",
      "| --- | --- |",
      "| first<br>second | ==cell mark== and [[/posts/42\\|Post 42]] |",
    ].join("\n")

    const html = renderMarkdownHtml(markdown)

    expect(html).toContain('<mark class="aq-highlight">warm highlight</mark>')
    expect(html).toContain('<a class="aq-wikilink" href="#section-target">Jump Section</a>')
    expect(html).toContain('<a class="aq-wikilink" href="/about">About Page</a>')
    expect(html).toContain(
      `<a class="aq-wikilink" href="/?q=${encodeURIComponent("//evil.example/phish")}">//evil.example/phish</a>`
    )
    expect(html).toContain(
      `<a class="aq-wikilink" href="/?q=${encodeURIComponent("Distributed Consensus")}">Distributed Consensus</a>`
    )
    expect(html).toContain('<code class="aq-inline-code">==code== [[CodeLink]] &lt;br&gt;</code>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain(">==link== [[LinkTarget]]</a>")
    expect(html).toContain("<td>first<br/>second</td>")
    expect(html).toContain('<mark class="aq-highlight">cell mark</mark>')
    expect(html).toContain('<a class="aq-wikilink" href="/posts/42">Post 42</a>')
  })

  test("2. enforces safe table backgroundColor literals, headerRow/headerColumn flags, and StrictMode-pure cell indexing", () => {
    const safeLayout = normalizeMarkdownTableLayout({
      headerRow: false,
      headerColumn: true,
      cells: [
        [
          { backgroundColor: "#eef6ff" },
          { backgroundColor: "rgba(35, 131, 226, 0.08)" },
          { backgroundColor: "hsla(210, 60%, 50%, 0.2)" },
        ],
        [
          { backgroundColor: "var(--aq-surface-subtle)" },
          { backgroundColor: "transparent" },
          { backgroundColor: "aliceblue" },
        ],
      ],
    })
    expect(safeLayout?.headerRow).toBe(false)
    expect(safeLayout?.headerColumn).toBe(true)
    expect(safeLayout?.cells?.[0]?.[0]?.backgroundColor).toBe("#eef6ff")
    expect(safeLayout?.cells?.[0]?.[1]?.backgroundColor).toBe("rgba(35, 131, 226, 0.08)")
    expect(safeLayout?.cells?.[0]?.[2]?.backgroundColor).toBe("hsla(210, 60%, 50%, 0.2)")
    expect(safeLayout?.cells?.[1]?.[0]?.backgroundColor).toBe("var(--aq-surface-subtle)")
    expect(safeLayout?.cells?.[1]?.[1]?.backgroundColor).toBe("transparent")
    expect(safeLayout?.cells?.[1]?.[2]?.backgroundColor).toBe("aliceblue")

    for (const malicious of [
      "red; background-image: url(https://evil.example/x)",
      "url(https://evil.example/x)",
      "expression(alert(1))",
      "var(--bad;color)",
      "hsla(120, 50%, 50%); color: red",
      "rgb(999, 0, 0)",
      "<script>alert(1)</script>",
      "color:red",
    ]) {
      expect(
        parseMarkdownTableLayoutComment(
          `<!-- aq-table ${JSON.stringify({ cells: [[{ backgroundColor: malicious }]] })} -->`
        )
      ).toBeNull()
    }

    const tableMarkdown = [
      '<!-- aq-table {"headerRow":false,"headerColumn":true,"cells":[[{"backgroundColor":"#eef6ff"},{"align":"right"}],[{"backgroundColor":"rgba(16, 185, 129, 0.08)"},{"align":"center"}]]} -->',
      "| Key | Value |",
      "| --- | --- |",
      "| Latency | 12ms |",
    ].join("\n")

    expect(extractMarkdownTableLayouts(tableMarkdown).layouts[0]).toMatchObject({
      headerRow: false,
      headerColumn: true,
    })

    const singlePassHtml = renderMarkdownHtml(tableMarkdown, { strictMode: false })
    const strictModeHtml = renderMarkdownHtml(tableMarkdown, { strictMode: true })

    expect(strictModeHtml).toBe(singlePassHtml)
    expect(strictModeHtml).toContain('data-header-row="false"')
    expect(strictModeHtml).toContain('data-header-column="true"')
    expect(strictModeHtml).toContain('background-color:#eef6ff')
    expect(strictModeHtml).toContain('text-align:right')
    expect(strictModeHtml).toContain('background-color:rgba(16, 185, 129, 0.08)')
    expect(strictModeHtml).toContain('text-align:center')
  })

  test("3. supports inline :::bookmark titles, omits empty callout/toggle placeholders, and disables invalid bookmark links", () => {
    const segments = parseMarkdownSegments(
      [
        ":::bookmark https://example.com/docs Official Documentation",
        "Reference guide for operators",
        ":::",
        "",
        ":::bookmark https://example.com/inline-only Inline Title Only",
        ":::",
        "",
        ":::callout info Empty Info",
        ":::",
        "",
        "> [!tip] Quiet Tip",
        ">",
        "",
        ":::toggle Empty Toggle",
        ":::",
        "",
        ":::bookmark https://",
        "",
        ":::",
      ].join("\n")
    )

    expect(segments).toEqual([
      {
        type: "bookmark",
        url: "https://example.com/docs",
        title: "Official Documentation",
        description: "Reference guide for operators",
      },
      {
        type: "bookmark",
        url: "https://example.com/inline-only",
        title: "Inline Title Only",
        description: "",
      },
      {
        type: "callout",
        kind: "info",
        title: "Empty Info",
        emoji: expect.any(String),
        content: "",
      },
      {
        type: "callout",
        kind: "tip",
        title: "Quiet Tip",
        emoji: expect.any(String),
        content: "",
      },
      {
        type: "toggle",
        title: "Empty Toggle",
        content: "",
      },
      {
        type: "bookmark",
        url: "",
        title: "북마크",
        description: "",
      },
    ])

    const html = renderMarkdownHtml(
      [
        ":::callout info Empty Info",
        ":::",
        "",
        ":::toggle Empty Toggle",
        ":::",
        "",
        ":::bookmark https://",
        "",
        ":::",
      ].join("\n")
    )

    expect(html).not.toContain("내용을 입력하세요.")
    expect(html).toContain('class="aq-bookmark-card"')
    expect(html).toContain('data-disabled="true"')
    expect(html).not.toContain('href=""')
    expect(html).not.toContain('target="_blank"')
  })

  test("4. strips {{color:...}} and {color:...} inline tokens when extracting heading labels and slugs", () => {
    expect(formatMarkdownHeadingLabel("{{color:sky|Colored Heading}}")).toBe("Colored Heading")
    expect(formatMarkdownHeadingLabel("Prefix {color:#2563eb}Blue Span{/color} Suffix")).toBe(
      "Prefix Blue Span Suffix"
    )

    const insights = createMarkdownDocumentInsights(
      [
        "## {{color:sky|Architecture Overview}}",
        "### {color:emerald}Zero-Copy Pipeline{/color}",
        "#### `{{color:red|Preserved In Code}}`",
      ].join("\n")
    )

    expect(insights.headings.map((h) => ({ label: h.label, slug: h.slug }))).toEqual([
      { label: "Architecture Overview", slug: "architecture-overview" },
      { label: "Zero-Copy Pipeline", slug: "zero-copy-pipeline" },
      { label: "{{color:red|Preserved In Code}}", slug: "colorredpreserved-in-code" },
    ])
  })

  test("5. shares Mermaid singleton loader across theme switches and preserves unwrapped source for copy", async () => {
    resetSharedMermaidRuntimeForTests()

    const initCalls: Array<Record<string, unknown>> = []
    let loaderInvocations = 0
    const fakeMermaid = {
      initialize(config: Record<string, unknown>) {
        initCalls.push(config)
      },
      render: async (_id: string, code: string) => ({
        svg: `<svg viewBox="0 0 320 180"><text>${code.includes("<br/>") ? "wrapped" : "plain"}</text></svg>`,
      }),
      parseError: undefined as ((error: unknown) => void) | undefined,
    }
    const loader = async () => {
      loaderInvocations += 1
      return { default: fakeMermaid }
    }

    const warningsA: unknown[] = []
    const warningsB: unknown[] = []

    const first = await loadSharedMermaidRuntime("light", (err) => warningsA.push(err), loader)
    fakeMermaid.parseError?.("warn-a")
    const second = await loadSharedMermaidRuntime("light", (err) => warningsB.push(err), loader)
    fakeMermaid.parseError?.("warn-b")
    const third = await loadSharedMermaidRuntime("dark", undefined, loader)

    expect(loaderInvocations).toBe(1)
    expect(first.mermaidRuntime).toBe(second.mermaidRuntime)
    expect(first.preset.themeKey).toBe("github-light")
    expect(third.preset.themeKey).toBe("github-dark")
    expect(initCalls).toHaveLength(2)
    expect(warningsA).toEqual(["warn-a"])
    expect(warningsB).toEqual(["warn-b"])

    const rawUnwrappedSource =
      'flowchart LR\n  StartNode["This is a deliberately very long node label that triggers soft wrapping in mermaid"] --> EndNode["Done"]'

    const mermaidRenderSource = readFileSync(
      path.join(REPO_ROOT, "src/libs/markdown/mermaidRuntimeRender.ts"),
      "utf8"
    )
    expect(mermaidRenderSource.split(/\r?\n/).length).toBeLessThanOrEqual(600)
    expect(mermaidRenderSource).toContain("mermaidOriginalSource")
    expect(typeof createMermaidRuntimeController).toBe("function")
    expect(rawUnwrappedSource).not.toContain("<br/>")
  })

  test("6. keeps inline footnote ref touch hit-area out of paragraph line box and passes data-force-scheme", () => {
    const baseStyles = readFileSync(
      path.join(REPO_ROOT, "src/libs/markdown/components/MarkdownRendererRootBaseStyles.ts"),
      "utf8"
    )
    const coarseFootnoteBlock =
      /@media\s*\(max-width:\s*768px\),\s*\(pointer:\s*coarse\)\s*\{([\s\S]*?)\n {2}\}/.exec(
        baseStyles
      )?.[1] || ""
    const refRule = /a\[data-footnote-ref\]\s*\{([\s\S]*?)\n {4}\}/.exec(coarseFootnoteBlock)?.[1] || ""

    expect(refRule).toContain("display: inline-block;")
    expect(refRule).toContain("line-height: 1;")
    expect(refRule).not.toContain("min-height: 44px;")
    expect(refRule).toContain("width: 44px;")
    expect(refRule).toContain("height: 44px;")
    expect(refRule).toContain("transform: translate(-50%, -50%);")

    const forcedLightHtml = renderMarkdownHtml("Hello[^1]\n\n[^1]: Footnote body", {
      forceScheme: "light",
    })
    expect(forcedLightHtml).toContain('data-force-scheme="light"')
  })

  test("7. excludes footnote appendix heading from client TOC, expands closed ancestor <details>, and reserves dynamic skeleton", () => {
    const footnoteHeading = {
      id: "aq-footnote-heading",
      tagName: "H2",
      textContent: "각주",
      closest: (selector: string) => (selector.includes(".aq-footnotes") ? {} : null),
    } as unknown as HTMLElement

    const realHeading = {
      id: "",
      tagName: "H2",
      textContent: "실제 섹션",
      closest: () => null,
    } as unknown as HTMLElement

    const fakeArticle = {
      querySelectorAll: () => [realHeading, footnoteHeading],
    } as unknown as HTMLElement

    const collected = collectTocFromArticle(fakeArticle)
    expect(collected).toEqual([{ id: "실제-섹션", text: "실제 섹션", level: 2 }])

    const outerDetails = {
      tagName: "DETAILS",
      open: false,
      parentElement: null as unknown as Element | null,
      setAttribute(name: string) {
        if (name === "open") this.open = true
      },
    }
    const innerDetails = {
      tagName: "DETAILS",
      open: false,
      parentElement: outerDetails as unknown as Element,
      setAttribute(name: string) {
        if (name === "open") this.open = true
      },
    }
    const nestedHeading = {
      tagName: "H3",
      parentElement: innerDetails as unknown as Element,
    } as unknown as Element

    expect(expandClosedAncestorDetails(nestedHeading)).toBe(true)
    expect(innerDetails.open).toBe(true)
    expect(outerDetails.open).toBe(true)

    const postDetailSource = readFileSync(
      path.join(REPO_ROOT, "src/routes/Detail/PostDetail/index.tsx"),
      "utf8"
    )
    expect(postDetailSource).toContain("expandClosedAncestorDetails")
    expect(postDetailSource).toContain("markdownLoadingSkeleton")
    expect(postDetailSource).not.toMatch(/\bstyled\./)
  })

  test("8. normalizes OG type and image URLs, styles likes as static badge, and separates native share vs copy feedback", () => {
    const basePost: TPost = {
      id: "42",
      date: { start_date: "2026-10-30" },
      type: ["Post"],
      slug: "test-post",
      tags: ["Architecture"],
      category: ["Backend"],
      summary: "Summary text",
      author: [{ id: "1", name: "  Aquila Author  ", profile_photo: "" }],
      title: "Metadata Verification",
      status: ["Public"],
      createdTime: "2026-10-30T00:00:00.000Z",
      fullWidth: false,
      thumbnail: "/post/api/v1/images/cover.webp#focusX=40&focusY=60",
    }

    const postMeta = buildPostDetailMetadata(basePost)
    expect(postMeta.type).toBe("article")
    expect(postMeta.image).toMatch(/^https?:\/\/[^#]+\/post\/api\/v1\/images\/cover\.webp$/)
    expect(postMeta.image).not.toContain("#")
    expect((postMeta.jsonLd?.[0] as { author?: { name?: string } })?.author?.name).toBe(
      "Aquila Author"
    )

    const paperMeta = buildPostDetailMetadata({ ...basePost, type: ["Paper"] })
    expect(paperMeta.type).toBe("article")

    const pageMeta = buildPostDetailMetadata({ ...basePost, type: ["Page"] })
    expect(pageMeta.type).toBe("website")

    const metaHeadHtml = renderMetaHeadHtml(postMeta)
    expect(metaHeadHtml).toContain('<meta property="og:type" content="article"/>')
    expect(metaHeadHtml).toMatch(
      /<meta property="og:image" content="https?:\/\/[^"#]+\/post\/api\/v1\/images\/cover\.webp"\/>/
    )
    expect(metaHeadHtml).toMatch(
      /<meta name="twitter:image" content="https?:\/\/[^"#]+\/post\/api\/v1\/images\/cover\.webp"\/>/
    )

    const multiHostSurfaceHeadHtml = renderMetaHeadHtml({
      ...pageMeta,
      type: "Post",
      image: "/easysubway/og-image.png#focusX=50&focusY=50",
    })
    expect(multiHostSurfaceHeadHtml).toContain('<meta property="og:type" content="article"/>')
    expect(multiHostSurfaceHeadHtml).toContain(
      '<meta property="og:image" content="/easysubway/og-image.png"/>'
    )
    expect(multiHostSurfaceHeadHtml).toContain(
      '<meta name="twitter:image" content="/easysubway/og-image.png"/>'
    )

    const renderActions = (shareFeedback: "copied" | "shared" | "failed" | null) =>
      renderToStaticMarkup(
        materializePlaywrightJsx(
          createElement(ThemeProvider, {
            theme: lightTheme,
            children: createElement(
              Fragment,
              null,
              createElement(FloatingActionRail, {
                key: "floating-rail",
                railRef: { current: null },
                innerRef: { current: null },
                active: false,
                showFloatingLike: true,
                likesCount: 7,
                shareFeedback,
                onSharePost: () => {},
              }),
              createElement(MobileSummaryActions, {
                key: "mobile-actions",
                likesCount: 7,
                shareFeedback,
                onSharePost: () => {},
              })
            ),
          })
        ) as ReactElement
      )

    const copiedHtml = renderActions("copied")
    const sharedHtml = renderActions("shared")

    expect(copiedHtml).toContain("복사 완료")
    expect(copiedHtml).not.toContain("floatingActionButton floatingLikeButton")
    expect(sharedHtml).toContain("공유 완료")
    expect(sharedHtml).not.toContain("복사 완료")
  })

  test("9. rejects ASCII control protocol-relative bypasses, aligns ==x = 1== / recursive color / heading code slugs, and guards Pandoc math", () => {
    expect(hasAsciiControlCharacters("/\t/evil.example/phish")).toBe(true)
    expect(hasAsciiControlCharacters("/\x7f/evil.example/phish")).toBe(true)
    expect(normalizeSafeRelativeMarkdownPath("/\t/evil.example/phish")).toBe("")
    expect(normalizeSafeRelativeMarkdownPath("/\n/evil.example/phish")).toBe("")
    expect(normalizeSafeMarkdownUrl("/\t/evil.example/phish")).toBe("")
    expect(normalizeSafeRelativeMarkdownPath("/easysubway/og-image.png")).toBe(
      "/easysubway/og-image.png"
    )

    const tabPhishMetaHtml = renderMetaHeadHtml({
      title: "Tab Bypass Check",
      description: "Desc",
      type: "Post",
      url: "https://blog.aquilaxk.site/posts/tab-check",
      image: "/\t/evil.example/phish",
    })
    expect(tabPhishMetaHtml).not.toContain("evil.example")
    expect(tabPhishMetaHtml).not.toContain("/\t/")

    const parityHtml = renderMarkdownHtml(
      [
        "## API`v2`",
        "",
        "Highlight ==x = 1== and =={{color:blue|note}}== while keeping === and a == 1 || b == 2 literal.",
        "",
        "Wikilink tab bypass [[/\\t/evil.example/phish]]".replace("\\t", "\t"),
        "",
        "Prices are $10 and $25 today.",
        "",
        "Valid math $O(1)$, ($x^2$), and 한글 $a+b$이다.",
        "",
        "Wait $$ here",
        "",
        "And $$ there",
      ].join("\n")
    )

    expect(parityHtml).toContain('id="apiv2"')
    expect(parityHtml).toContain('<mark class="aq-highlight">x = 1</mark>')
    expect(parityHtml).toMatch(
      /<mark class="aq-highlight"><span[^>]*class="aq-inline-color"[^>]*>note<\/span><\/mark>/
    )
    expect(parityHtml).toContain("keeping === and a == 1 || b == 2 literal.")
    expect(parityHtml).toContain(
      `<a class="aq-wikilink" href="/?q=${encodeURIComponent("/\t/evil.example/phish")}">`
    )
    expect(parityHtml).toContain("Prices are $10 and $25 today.")
    expect(parityHtml).toContain('class="katex"')
    expect(parityHtml).not.toContain('class="katex-display"')
  })

  test("10. separates fitWidth from overflowMode wide, preserves unmeasured partial columnWidths, scopes data-header-col-cell, and serializes Mermaid parseError", async () => {
    const stripStyleTags = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "")

    const fitWidthHtml = stripStyleTags(
      renderMarkdownHtml(
        [
          '<!-- aq-table {"fitWidth":true} -->',
          "| Col A | Col B |",
          "| --- | --- |",
          "| 1 | 2 |",
        ].join("\n")
      )
    )
    expect(fitWidthHtml).toContain("width:100%")
    expect(fitWidthHtml).toContain("table-layout:fixed")
    expect(fitWidthHtml).not.toContain('data-overflow-mode="wide"')

    const wideOverflowHtml = stripStyleTags(
      renderMarkdownHtml(
        [
          '<!-- aq-table {"overflowMode":"wide"} -->',
          "| Col A | Col B |",
          "| --- | --- |",
          "| 1 | 2 |",
        ].join("\n")
      )
    )
    expect(wideOverflowHtml).toContain('data-overflow-mode="wide"')
    expect(wideOverflowHtml).not.toContain("table-layout:fixed")

    const partialWidthsHtml = stripStyleTags(
      renderMarkdownHtml(
        [
          '<!-- aq-table {"columnWidths":[null,200]} -->',
          "| Auto Col | Fixed Col |",
          "| --- | --- |",
          "| Long prose | 200 |",
        ].join("\n")
      )
    )
    expect(partialWidthsHtml).toContain('<col/><col style="width:200px;min-width:200px"/>')
    expect(partialWidthsHtml).not.toContain('<table style="width:200px')

    const plainTableHtml = stripStyleTags(
      renderMarkdownHtml(["| Col A | Col B |", "| --- | --- |", "| Left | Right |"].join("\n"))
    )
    expect(plainTableHtml).not.toContain("data-header-col-cell")

    const hiddenFirstColHtml = stripStyleTags(
      renderMarkdownHtml(
        [
          '<!-- aq-table {"headerColumn":true,"cells":[[null,null],[{"hidden":true},null]]} -->',
          "| Col A | Col B |",
          "| --- | --- |",
          "| Covered | Visible Second Col |",
        ].join("\n")
      )
    )
    expect(hiddenFirstColHtml).toContain("Visible Second Col")
    expect(hiddenFirstColHtml).not.toContain("data-header-col-cell")

    const visibleHeaderColHtml = stripStyleTags(
      renderMarkdownHtml(
        [
          '<!-- aq-table {"headerColumn":true} -->',
          "| Col A | Col B |",
          "| --- | --- |",
          "| Row Label | Cell Value |",
        ].join("\n")
      )
    )
    expect(visibleHeaderColHtml).toMatch(/<td[^>]*data-header-col-cell="true"[^>]*>Row Label<\/td>/)
    expect(visibleHeaderColHtml).not.toMatch(
      /<td[^>]*data-header-col-cell="true"[^>]*>Cell Value<\/td>/
    )

    resetSharedMermaidRuntimeForTests()
    const fakeMermaid = {
      initialize() {},
      render: async (id: string) => ({ svg: `<svg id="${id}"></svg>` }),
      parseError: undefined as ((error: unknown) => void) | undefined,
    }
    const loader = async () => ({ default: fakeMermaid })
    const warningsTask1: unknown[] = []
    const warningsTask2: unknown[] = []
    const task1GateControl = { release: () => {} }
    const task1Gate = new Promise<void>((resolve) => {
      task1GateControl.release = resolve
    })

    const run1 = runSerializedMermaidTask(
      "light",
      (err) => warningsTask1.push(err),
      async ({ mermaidRuntime, preset }) => {
        fakeMermaid.parseError?.("task-1-before-await")
        await task1Gate
        fakeMermaid.parseError?.("task-1-after-await")
        return `${preset.themeKey}:${typeof mermaidRuntime.render}`
      },
      loader
    )
    const run2 = runSerializedMermaidTask(
      "dark",
      (err) => warningsTask2.push(err),
      async ({ preset }) => {
        fakeMermaid.parseError?.("task-2-only")
        return preset.themeKey
      },
      loader
    )

    await Promise.resolve()
    await Promise.resolve()
    task1GateControl.release()
    const [res1, res2] = await Promise.all([run1, run2])
    expect(res1).toBe("github-light:function")
    expect(res2).toBe("github-dark")
    expect(warningsTask1).toEqual(["task-1-before-await", "task-1-after-await"])
    expect(warningsTask2).toEqual(["task-2-only"])
  })
})
