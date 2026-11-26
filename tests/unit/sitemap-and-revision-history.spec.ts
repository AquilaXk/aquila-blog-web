import { registerServerApiFetchMetrics } from "../../src/libs/server/apiFetchMetrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import { getPublicSitemapPosts } from "../../src/apis/backend/posts"
import {
  buildSitemapFields,
  buildSitemapXml,
  collectSitemapPosts,
  SITEMAP_XML_CONTENT_TYPE,
} from "../../src/libs/sitemapPosts"
import {
  EditorStudioRevisionHistoryCard,
  formatRevisionTimestampLabel,
  normalizePostRevisionSummaries,
} from "../../src/routes/Admin/EditorStudioRevisionHistoryCard"
import { findWikilinkSpans } from "../../src/libs/markdown/inlineTokenScanners"
import { scanInlineMarkdownTokens } from "../../src/components/markdown-editor/markdownEditorInlineDom"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderNode = (node: unknown): string =>
  renderToStaticMarkup(
    createElement(ThemeProvider, {
      theme: lightTheme,
      children: materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage: "ko",
          children: node as React.ReactElement,
        })
      ) as React.ReactElement,
    })
  )

test.describe("Lightweight Sitemap Projection, Revision History Card & Wikilink Boundaries", () => {
  test("collectSitemapPosts uses lightweight /post/api/v1/posts/sitemap projection first and falls back on 404", async () => {
    registerServerApiFetchMetrics()
    const origFetch = globalThis.fetch
    const origBackendUrl = process.env.BACKEND_INTERNAL_URL
    try {
      process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:18080"
      const requestedUrls: string[] = []

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        requestedUrls.push(url)
        if (url.includes("/post/api/v1/posts/sitemap")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: 302,
                  createdAt: "2026-11-10T01:00:00.000Z",
                  modifiedAt: "2026-11-18T05:30:00.000Z",
                },
                {
                  id: 302,
                  createdAt: "2026-11-10T01:00:00.000Z",
                  modifiedAt: "2026-11-18T05:30:00.000Z",
                },
                {
                  id: -5,
                  createdAt: "2026-11-10T01:00:00.000Z",
                },
                {
                  id: 299,
                  createdAt: "2026-11-01T00:00:00.000Z",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        return new Response("{}", { status: 500 })
      }) as typeof fetch

      const directProjected = await getPublicSitemapPosts({ limit: 500 })
      expect(directProjected.map((item) => item.id)).toEqual(["302", "302", "299"])

      const collected = await collectSitemapPosts()
      expect(collected.map((item) => item.id)).toEqual(["302", "299"])
      expect(requestedUrls.some((url) => url.includes("/post/api/v1/posts/feed"))).toBe(false)

      const fields = buildSitemapFields(collected, "https://blog.example.com")
      expect(fields).toEqual([
        {
          loc: "https://blog.example.com",
          lastmod: "2026-11-18T05:30:00.000Z",
          priority: 1,
          changefreq: "daily",
        },
        {
          loc: "https://blog.example.com/posts/302",
          lastmod: "2026-11-18T05:30:00.000Z",
          priority: 0.7,
          changefreq: "daily",
        },
        {
          loc: "https://blog.example.com/posts/299",
          lastmod: "2026-11-01T00:00:00.000Z",
          priority: 0.7,
          changefreq: "daily",
        },
      ])

      requestedUrls.length = 0
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        requestedUrls.push(url)
        if (url.includes("/post/api/v1/posts/sitemap")) {
          return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })
        }
        if (url.includes("/post/api/v1/posts/feed")) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 401,
                  title: "Fallback Post",
                  summary: "",
                  summarySource: "NONE",
                  published: true,
                  listed: true,
                  createdAt: "2026-11-15T00:00:00.000Z",
                  modifiedAt: "2026-11-16T00:00:00.000Z",
                },
              ],
              pageable: { pageNumber: 1, pageSize: 30, totalElements: 1 },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        return new Response("{}", { status: 404 })
      }) as typeof fetch

      const fallbackCollected = await collectSitemapPosts()
      expect(fallbackCollected.map((item) => item.id)).toEqual(["401"])
      expect(requestedUrls.some((url) => url.includes("/post/api/v1/posts/sitemap"))).toBe(true)
      expect(requestedUrls.some((url) => url.includes("/post/api/v1/posts/feed"))).toBe(true)
    } finally {
      globalThis.fetch = origFetch
      if (origBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
      else process.env.BACKEND_INTERNAL_URL = origBackendUrl
    }
  })

  test("EditorStudioRevisionHistoryCard normalizes rows, hides on temp/new posts, and renders native details card", () => {
    const normalized = normalizePostRevisionSummaries([
      {
        id: 12,
        postId: 77,
        title: "  아키텍처 리팩토링 초안  ",
        summaryText: " 요약 ",
        contentLength: 2480,
        createdAt: "2026-11-18T08:00:00.000Z",
      },
      { id: 0, postId: 77, title: "invalid" },
      null,
    ])
    expect(normalized).toEqual([
      {
        id: 12,
        postId: 77,
        title: "아키텍처 리팩토링 초안",
        summaryText: "요약",
        contentLength: 2480,
        createdAt: "2026-11-18T08:00:00.000Z",
      },
    ])
    expect(formatRevisionTimestampLabel("")).toBe("시각 미상")
    expect(formatRevisionTimestampLabel("", "en")).toBe("Unknown time")
    expect(normalizePostRevisionSummaries([{ id: 13, postId: 77, title: "   " }])[0]?.title).toBe("제목 없음")
    expect(normalizePostRevisionSummaries([{ id: 13, postId: 77, title: "   " }], "en")[0]?.title).toBe("Untitled")

    const hiddenHtml = renderNode(createElement(EditorStudioRevisionHistoryCard, { postId: null }))
    expect(hiddenHtml).toBe("")

    const visibleHtml = renderNode(
      createElement(EditorStudioRevisionHistoryCard, {
        postId: 77,
        initialOpen: true,
        initialRevisions: normalized,
      })
    )
    expect(visibleHtml).toContain('data-testid="editor-revision-history-card"')
    expect(visibleHtml).toContain("<details")
    expect(visibleHtml).toContain("<summary")
    expect(visibleHtml).toContain("리비전 기록")
    expect(visibleHtml).toContain("1건")
    expect(visibleHtml).toContain("아키텍처 리팩토링 초안")
    expect(visibleHtml).toContain("2480자")
    expect(visibleHtml).toContain('aria-label="아키텍처 리팩토링 초안 리비전 복원"')
  })

  test("findWikilinkSpans & scanInlineMarkdownTokens enforce identical wikilink boundaries across renderer & live preview", () => {
    expect(findWikilinkSpans("[[[Target]]")).toEqual([])
    expect(findWikilinkSpans("[[Target#Section|표시 제목]]")).toEqual([
      {
        from: 0,
        to: 24,
        rawTarget: "Target#Section",
        rawAlias: "표시 제목",
      },
    ])
    expect(scanInlineMarkdownTokens("[[[Target]]")).toEqual([])
    expect(scanInlineMarkdownTokens("[[#]]")).toEqual([])
    expect(scanInlineMarkdownTokens("[[Target#Section|표시 제목]]")).toEqual([
      {
        kind: "wikilink",
        from: 0,
        end: 24,
        display: "표시 제목",
      },
    ])
  })

  test("buildSitemapXml emits Sitemaps 0.9 XML with single-pass escaping and control-char stripping", () => {
    expect(SITEMAP_XML_CONTENT_TYPE).toBe("application/xml; charset=utf-8")
    const xml = buildSitemapXml([
      {
        loc: "https://blog.example.com/posts/1?a=1&b=<tag>\u0000\u0008",
        lastmod: "2026-11-21T00:00:00.000Z",
        priority: 1,
        changefreq: "daily",
      },
      {
        loc: "https://blog.example.com/posts/2\"quoted'id",
        lastmod: "2026-11-20T12:00:00.000Z",
        priority: 0.7,
        changefreq: "daily",
      },
    ])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')).toBe(true)
    expect(xml).toContain(
      "<url><loc>https://blog.example.com/posts/1?a=1&amp;b=&lt;tag&gt;</loc><lastmod>2026-11-21T00:00:00.000Z</lastmod><changefreq>daily</changefreq><priority>1</priority></url>"
    )
    expect(xml).toContain(
      "<url><loc>https://blog.example.com/posts/2&quot;quoted&apos;id</loc><lastmod>2026-11-20T12:00:00.000Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>"
    )
    expect(xml).not.toContain("xmlns:news")
    expect(xml).not.toContain("xmlns:image")
    expect(xml).not.toContain("xmlns:video")
    expect(xml.endsWith("\n</urlset>")).toBe(true)
  })
})
