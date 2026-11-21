import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import {
  tokenizeHighlightTerms,
  splitHighlightSegments,
} from "../../src/components/quick-search/quickSearchHighlight"
import { extractUnfurlMetadata } from "../../src/libs/unfurl/extractMeta"
import {
  extractCodeLineAnnotations,
  renderImmediateCodeToHtml,
} from "../../src/libs/markdown/prismRuntime"
import {
  copyTextToClipboard,
  packCodeBlockUiState,
  resolveCodeGutterWidth,
  CODE_COLLAPSED_BIT,
  CODE_COPIED_BIT,
  CODE_WRAPPED_BIT,
} from "../../src/libs/markdown/components/PrettyCodeBlock"
import { selectUniqueRelatedPosts } from "../../src/routes/Detail/PostDetail/PostDetailRelatedSection"
import { resolvePostHeaderViewModel } from "../../src/routes/Detail/PostDetail/PostHeader"
import { filterTrustedPostImageHtml } from "../../src/libs/markdown/renderingHtmlModel"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import type { PostDetail, TPost } from "../../src/types"

const makePost = (id: string, title = `Post ${id}`): TPost => ({
  id,
  title,
  slug: `post-${id}`,
  summary: `Summary for ${id}`,
  tags: ["Next.js"],
})

test.describe("Stage 2 Stream A unit regressions", () => {
  test("quickSearchHighlight bounds token count/length and stays XSS-safe", () => {
    const excessiveQuery = Array.from({ length: 24 }, (_, idx) => `token${idx}`).join(" ")
    const tokens = tokenizeHighlightTerms(excessiveQuery)
    expect(tokens.length).toBeLessThanOrEqual(8)

    const repeatedTokens = tokenizeHighlightTerms("Next NEXT next.js")
    expect(repeatedTokens).toEqual(["next.js", "next"])

    const xssTitle = '<script>alert("xss")</script> Next.js Guide'
    const segments = splitHighlightSegments(xssTitle, "script next.js")
    expect(segments.filter((s) => s.highlighted).map((s) => s.text)).toEqual([
      "script",
      "script",
      "Next.js",
    ])
    expect(segments.map((s) => s.text).join("")).toBe(xssTitle)
  })

  test("extractUnfurlMetadata ignores body meta tags and bounds adversarial >512KB payloads", () => {
    const adversarialBodyFiller = "x".repeat(600_000)
    const html = [
      "<html><head>",
      '<title>Head Title</title>',
      '<meta property="og:description" content="Valid Head Description" />',
      "</head><body>",
      '<meta property="og:title" content="Injected Body Title" />',
      adversarialBodyFiller,
      '<meta property="og:image" content="https://evil.example/late.png" />',
      "</body></html>",
    ].join("")

    const parsed = extractUnfurlMetadata("https://example.com/post", html)
    expect(parsed.title).toBe("Head Title")
    expect(parsed.description).toBe("Valid Head Description")
    expect(parsed.thumbnailUrl).toBe("")

    const unbounded = `<html><head><title>Valid</title>${"a".repeat(600_000)}<meta property="og:title" content="Past Cap" /></head></html>`
    const capped = extractUnfurlMetadata("https://example.com/post", unbounded)
    expect(capped.title).toBe("Valid")
  })

  test("prismRuntime extracts [!code ++], [!code --], [!code highlight] cleanly and stays idempotent", () => {
    const source = [
      "const kept = 1",
      "const added = 2 // [!code ++]",
      "const removed = 3 // [!code --]",
      "const focus = 4 /* [!code highlight] */",
    ].join("\n")

    const annotations = extractCodeLineAnnotations(source)
    expect(annotations.hasAnnotations).toBe(true)
    expect(annotations.cleanSource).toBe(
      ["const kept = 1", "const added = 2", "const removed = 3", "const focus = 4"].join("\n")
    )
    expect(annotations.diffLines.get(2)).toBe("add")
    expect(annotations.diffLines.get(3)).toBe("remove")
    expect(annotations.highlightedLines.has(4)).toBe(true)

    const idempotent = extractCodeLineAnnotations(annotations.cleanSource)
    expect(idempotent.hasAnnotations).toBe(false)
    expect(idempotent.cleanSource).toBe(annotations.cleanSource)

    const rendered = renderImmediateCodeToHtml({ source, language: "ts" })
    expect(rendered.hasDiff).toBe(true)
    expect(rendered.cleanSource).toBe(annotations.cleanSource)
    expect(rendered.html).toContain('data-diff="add"')
    expect(rendered.html).toContain('data-diff="remove"')
    expect(rendered.html).toContain('data-highlighted-line="true"')
    expect(rendered.html).not.toContain("[!code")
  })

  test("PrettyCodeBlock helpers fail closed on missing clipboard and scale gutter dynamically", async () => {
    expect(resolveCodeGutterWidth(1)).toBe("calc(2ch + 0.9rem)")
    expect(resolveCodeGutterWidth(99)).toBe("calc(2ch + 0.9rem)")
    expect(resolveCodeGutterWidth(100)).toBe("calc(3ch + 0.9rem)")
    expect(resolveCodeGutterWidth(1200)).toBe("calc(4ch + 0.9rem)")

    const packed = packCodeBlockUiState(true, "copied", true)
    expect(packed & CODE_COLLAPSED_BIT).toBe(CODE_COLLAPSED_BIT)
    expect(packed & CODE_COPIED_BIT).toBe(CODE_COPIED_BIT)
    expect(packed & CODE_WRAPPED_BIT).toBe(CODE_WRAPPED_BIT)

    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    })
    try {
      const ok = await copyTextToClipboard("console.log(1)")
      expect(ok).toBe(false)
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalDescriptor)
      }
    }
  })

  test("selectUniqueRelatedPosts deduplicates in O(N) single pass and defaults to limit 4", () => {
    const tagPosts = [makePost("1"), makePost("2"), makePost("3")]
    const authorPosts = [makePost("2"), makePost("4"), makePost("5"), makePost("6"), { id: "", slug: "" } as TPost]

    const selected = selectUniqueRelatedPosts(tagPosts, authorPosts)
    expect(selected.map((post) => post.id)).toEqual(["1", "2", "3", "4"])
  })

  test("KO/EN i18n view model and markdown fallback omit hardcoded Korean leakage", () => {
    const post: PostDetail = {
      id: "99",
      title: "Sample",
      slug: "sample",
      content: "",
      hitCount: 1234,
      createdAt: "2026-01-01T00:00:00Z",
    }

    expect(resolvePostHeaderViewModel({ data: post }, "ko-KR").viewText).toBe("조회 1,234")
    expect(resolvePostHeaderViewModel({ data: post }, "en-US").viewText).toBe("1,234 VIEWS")

    const bookmarkSegment = parseMarkdownSegments(":::bookmark https://\n:::")
    expect(bookmarkSegment[0]).toMatchObject({ type: "bookmark", title: "" })

    const blockedHtml = filterTrustedPostImageHtml(
      '<img src="http://insecure.example/x.png" alt="" />',
      "Blocked image"
    )
    expect(blockedHtml).toContain("Blocked image")
    expect(blockedHtml).not.toContain("차단된 이미지")
  })

  test("MarkdownRenderer renders heading # copy-anchor button cleanly without polluting heading text", () => {
    const theme = createTheme({ scheme: "light" })
    const queryClient = new QueryClient()
    const tree = createElement(QueryClientProvider, {
      client: queryClient,
      children: createElement(ThemeProvider, {
        theme,
        children: createElement(LanguageProvider, {
          children: createElement(MarkdownRenderer, {
            content: "## Heading Anchor Target\n\nBody copy",
            disableMermaid: true,
            forceScheme: "light",
          }),
        }),
      }),
    })
    const markup = renderToStaticMarkup(materializePlaywrightJsx(tree) as ReactElement)

    expect(markup).toContain('class="aq-heading-anchor"')
    expect(markup).toContain("Heading Anchor Target")
  })
})
