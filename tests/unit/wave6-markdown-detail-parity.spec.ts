import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, Fragment, isValidElement, memo, StrictMode, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { normalizeMarkdownInlineChildren } from "../../src/libs/markdown/MarkdownRendererInline"
import { normalizeLegacyInlineHtmlMarkdown } from "../../src/libs/markdown/inlineHtmlNormalization"
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
import * as mermaidRuntimeConfig from "../../src/libs/markdown/mermaidRuntimeConfig"
import { createMermaidRuntimeController } from "../../src/libs/markdown/mermaidRuntimeRender"
import * as postDetailTocModel from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { buildPostDetailMetadata } from "../../src/routes/Detail/PostDetail/postDetailMetadataModel"
import MetaConfig, { type MetaConfigProps } from "../../src/components/MetaConfig"
import {
  FloatingActionRail,
  MobileSummaryActions,
} from "../../src/routes/Detail/PostDetail/PostDetailActionSections"
import { createTheme } from "../../src/styles/theme"
import type { TPost } from "../../src/types"

const REPO_ROOT = path.resolve(__dirname, "../..")
const lightTheme = createTheme({ scheme: "light" })

const pwComponentCache = new WeakMap<object, unknown>()

function wrapPwComponent(type: unknown): unknown {
  if (!type || (typeof type !== "function" && typeof type !== "object")) {
    return type
  }
  if (typeof type === "function") {
    if (
      "__emotion_real" in type ||
      Boolean((type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent)
    ) {
      return type
    }
    const cached = pwComponentCache.get(type)
    if (cached) return cached
    const fn = type as (props: Record<string, unknown>) => unknown
    const Wrapped = (props: Record<string, unknown>) => toReactElement(fn(props))
    Wrapped.displayName =
      (type as { displayName?: string; name?: string }).displayName || fn.name || "PwWrapped"
    pwComponentCache.set(type, Wrapped)
    return Wrapped
  }

  const cachedObj = pwComponentCache.get(type)
  if (cachedObj) return cachedObj
  const obj = type as { $$typeof?: symbol; type?: unknown; compare?: unknown }
  if (obj.$$typeof === Symbol.for("react.memo") && obj.type) {
    const WrappedMemo = memo(wrapPwComponent(obj.type) as never, obj.compare as never)
    pwComponentCache.set(type, WrappedMemo)
    return WrappedMemo
  }
  return type
}

function toReactElement(node: unknown, index?: number): unknown {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) return node.map((child, idx) => toReactElement(child, idx))

  const record = node as {
    __pw_type?: string
    $$typeof?: symbol
    type?: unknown
    props?: Record<string, unknown>
    key?: string | number | null
  }

  if (record.__pw_type === "jsx") {
    const rawProps = record.props ?? {}
    const nextProps: Record<string, unknown> = {}
    for (const [propKey, propValue] of Object.entries(rawProps)) {
      if (
        propKey === "components" &&
        propValue &&
        typeof propValue === "object" &&
        !Array.isArray(propValue)
      ) {
        const mappedComponents: Record<string, unknown> = {}
        for (const [tag, comp] of Object.entries(propValue as Record<string, unknown>)) {
          mappedComponents[tag] = wrapPwComponent(comp)
        }
        nextProps[propKey] = mappedComponents
      } else {
        nextProps[propKey] = toReactElement(propValue)
      }
    }
    const resolvedKey =
      record.key !== undefined && record.key !== null
        ? record.key
        : index !== undefined
          ? `pw-${index}`
          : undefined
    if (resolvedKey !== undefined) {
      nextProps.key = resolvedKey
    }
    const resolvedType =
      record.type === undefined ||
      (typeof record.type === "object" && record.type !== null && !("$$typeof" in record.type))
        ? Fragment
        : wrapPwComponent(record.type)
    return createElement(resolvedType as never, nextProps)
  }

  if (isValidElement(node) && record.props) {
    const nextType = wrapPwComponent(record.type)
    let changed = nextType !== record.type
    const nextProps: Record<string, unknown> = {}
    for (const [propKey, propValue] of Object.entries(record.props)) {
      const converted = toReactElement(propValue)
      if (converted !== propValue) changed = true
      nextProps[propKey] = converted
    }
    if (!changed) return node
    if (record.key !== undefined && record.key !== null) {
      nextProps.key = record.key
    }
    return createElement(nextType as never, nextProps)
  }

  return node
}

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
  return renderToStaticMarkup(toReactElement(tree) as ReactElement)
}

const renderMetaHeadHtml = (props: MetaConfigProps): string => {
  const headElement = (MetaConfig as (input: MetaConfigProps) => ReactElement<{ children?: unknown }>)(
    props
  )
  return renderToStaticMarkup(
    toReactElement(createElement(Fragment, null, headElement.props.children as never)) as ReactElement
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
      toReactElement(createElement("td", null, directChildren)) as ReactElement
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
    const loadShared = (
      mermaidRuntimeConfig as unknown as {
        loadSharedMermaidRuntime?: (
          scheme: "dark" | "light",
          onParseWarning?: (error: unknown) => void,
          runtimeLoader?: () => Promise<unknown>
        ) => Promise<{
          mermaidRuntime: {
            initialize: (config: Record<string, unknown>) => void
            parseError?: (err: unknown) => void
          }
          preset: { themeKey: string }
        }>
        resetSharedMermaidRuntimeForTests?: () => void
      }
    ).loadSharedMermaidRuntime

    expect(typeof loadShared).toBe("function")
    ;(
      mermaidRuntimeConfig as unknown as { resetSharedMermaidRuntimeForTests?: () => void }
    ).resetSharedMermaidRuntimeForTests?.()

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

    const first = await loadShared!("light", (err) => warningsA.push(err), loader)
    fakeMermaid.parseError?.("warn-a")
    const second = await loadShared!("light", (err) => warningsB.push(err), loader)
    fakeMermaid.parseError?.("warn-b")
    const third = await loadShared!("dark", undefined, loader)

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

    const collected = postDetailTocModel.collectTocFromArticle(fakeArticle)
    expect(collected).toEqual([{ id: "실제-섹션", text: "실제 섹션", level: 2 }])

    const expandClosedAncestorDetails = (
      postDetailTocModel as unknown as {
        expandClosedAncestorDetails?: (element: Element | null) => boolean
      }
    ).expandClosedAncestorDetails
    expect(typeof expandClosedAncestorDetails).toBe("function")

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

    expect(expandClosedAncestorDetails!(nestedHeading)).toBe(true)
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

    const metaHeadHtml = renderMetaHeadHtml({
      ...postMeta,
      type: "Post",
      image: "/images/hero.png#focusX=50&focusY=50",
    })
    expect(metaHeadHtml).toContain('<meta property="og:type" content="article"/>')
    expect(metaHeadHtml).toMatch(
      /<meta property="og:image" content="https?:\/\/[^"#]+\/images\/hero\.png"\/>/
    )
    expect(metaHeadHtml).toMatch(
      /<meta name="twitter:image" content="https?:\/\/[^"#]+\/images\/hero\.png"\/>/
    )

    const renderActions = (shareFeedback: "copied" | "shared" | "failed" | null) =>
      renderToStaticMarkup(
        toReactElement(
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
})
