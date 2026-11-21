import fs from "node:fs"
import path from "node:path"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import {
  buildPostOgImagePath,
  parseOgQueryParams,
  sanitizeOgTextParam,
} from "../../src/libs/og/ogUrl"
import { TrueTypeOutlineFont } from "../../src/libs/og/ttfOutlineRenderer"
import {
  buildOgCardSvg,
  renderOgCardPngBuffer,
} from "../../src/libs/og/ogCardRenderer.server"
import ogApiHandler from "../../src/pages/api/og"
import type { NextApiRequest, NextApiResponse } from "next"
import { buildPostDetailMetadata } from "../../src/routes/Detail/PostDetail/postDetailMetadataModel"
import PostHeader from "../../src/routes/Detail/PostDetail/PostHeader"
import PostHeaderThumbnail from "../../src/routes/Detail/PostDetail/PostHeaderThumbnail"
import { EditorStudioPublishModal } from "../../src/routes/Admin/EditorStudioPublishModal"
import { PUBLISH_VISIBILITY_OPTIONS } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
import type { PostDetail, TPost } from "../../src/types"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderThemedMarkup = (element: ReactElement): string =>
  renderToStaticMarkup(
    materializePlaywrightJsx(
      createElement(
        LanguageProvider,
        null,
        createElement(ThemeProvider, { theme: lightTheme, children: element })
      )
    ) as ReactElement
  )

test.describe("tech blog thumbnail policy and dynamic OG card engine", () => {
  test("sanitizes OG query parameters, strips control characters, and caps lengths", () => {
    expect(sanitizeOgTextParam("  기술\u0000블로그\r\n  성능\t최적화  ", 50)).toBe(
      "기술블로그 성능 최적화"
    )
    expect(sanitizeOgTextParam("가나다라마바사", 4)).toBe("가나다라")

    const parsed = parseOgQueryParams({
      title: ["  한글과 English <script> 제목  ", "ignored"],
      category: "folder::Backend Architecture",
      tags: ["#Kotlin, Spring Boot", "kotlin", "PostgreSQL", "IgnoredFourthTag"],
    })
    expect(parsed).toEqual({
      title: "한글과 English <script> 제목",
      category: "Backend Architecture",
      tags: ["Kotlin", "Spring Boot", "PostgreSQL"],
    })

    const ogPath = buildPostOgImagePath({
      title: "썸네일 의사결정",
      category: ["미분류"],
      tags: ["SEO", "NextJS"],
    })
    expect(ogPath).toBe(
      "/api/og?title=%EC%8D%B8%EB%84%A4%EC%9D%BC+%EC%9D%98%EC%82%AC%EA%B2%B0%EC%A0%95&tags=SEO%2CNextJS"
    )
  })

  test("renders Korean and ASCII TrueType glyph contours into pure vector SVG and 1200x630 PNG without <text>", async () => {
    const fontPath = path.resolve(__dirname, "../../public/fonts/IBMPlexSansKR-SemiBold.ttf")
    const font = new TrueTypeOutlineFont(fs.readFileSync(fontPath))

    const hangulPath = font.renderTextToSvgPathD("기술블로그 OG", 100, 200, 48)
    expect(hangulPath).toMatch(/^M\d/)
    expect(hangulPath).toContain("Z")

    const wrapped = font.wrapTextLines(
      "매우 긴 기술블로그 아키텍처 심층 분석 제목이 세 줄을 초과할 때 말줄임표로 안전하게 잘리는지 검증하는 테스트 문장입니다 ".repeat(
        2
      ),
      54,
      984,
      3
    )
    expect(wrapped.length).toBe(3)
    expect(wrapped[2]?.endsWith("…")).toBe(true)

    // Malicious XML payload must never inject raw tags because glyphs emit numeric SVG path coordinates only
    const svg = buildOgCardSvg(
      {
        title: '"><script>alert(1)</script> 한글 제목',
        category: "Security",
        tags: ["CSP", "XSS"],
      },
      { font, hasMascotBadge: false }
    )
    expect(svg).not.toContain("<text")
    expect(svg).not.toContain("<script")
    expect(svg).toContain('<svg width="1200" height="630"')

    const pngA = await renderOgCardPngBuffer({
      title: "단일 패스 쿼리 및 비트마스크 최적화",
      category: "Backend",
      tags: ["Kotlin", "PostgreSQL"],
    })
    expect(pngA.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
    expect(pngA.readUInt32BE(16)).toBe(1200)
    expect(pngA.readUInt32BE(20)).toBe(630)

    const pngCached = await renderOgCardPngBuffer({
      title: "단일 패스 쿼리 및 비트마스크 최적화",
      category: "Backend",
      tags: ["Kotlin", "PostgreSQL"],
    })
    expect(pngCached).toBe(pngA)

    expect(() => new TrueTypeOutlineFont(new Uint8Array([1, 2, 3, 4]))).toThrow()
  })

  test("buildPostDetailMetadata prioritizes manual thumbnail -> body image -> dynamic /api/og fallback", () => {
    const basePost: TPost & { content?: string } = {
      id: "777",
      slug: "tech-post-777",
      title: "코드 중심 트러블슈팅 기록",
      summary: "썸네일 없는 기술 글",
      summarySource: "MANUAL",
      createdAt: "2026-11-15T00:00:00.000Z",
      modifiedAt: "2026-11-15T01:00:00.000Z",
      published: true,
      listed: true,
      authorName: "Aquila",
      tags: ["JVM", "GC"],
      category: ["folder::Backend"],
    }

    const fallbackMeta = buildPostDetailMetadata(basePost)
    expect(fallbackMeta.image).toBe(
      "https://blog.aquilaxk.site/api/og?title=%EC%BD%94%EB%93%9C+%EC%A4%91%EC%8B%AC+%ED%8A%B8%EB%9F%AC%EB%B8%94%EC%8A%88%ED%8C%85+%EA%B8%B0%EB%A1%9D&category=Backend&tags=JVM%2CGC"
    )

    const unsafeThumbMeta = buildPostDetailMetadata({
      ...basePost,
      thumbnail: "javascript:alert(1)",
    })
    expect(unsafeThumbMeta.image).toBe(fallbackMeta.image)

    const bodyImageMeta = buildPostDetailMetadata({
      ...basePost,
      content: "본문 설명\n\n![GC 그래프](/post/api/v1/images/gc-chart.webp)",
    } as TPost)
    expect(bodyImageMeta.image).toBe("https://blog.aquilaxk.site/post/api/v1/images/gc-chart.webp")

    const manualThumbMeta = buildPostDetailMetadata({
      ...basePost,
      thumbnail: "/post/api/v1/images/custom-og.webp#focusX=30&focusY=70",
      content: "![GC 그래프](/post/api/v1/images/gc-chart.webp)",
    } as TPost)
    expect(manualThumbMeta.image).toBe("https://blog.aquilaxk.site/post/api/v1/images/custom-og.webp")
  })

  test("PostHeader hides top hero thumbnail by default while preserving opt-in showThumbnail", () => {
    const sampleDetail: PostDetail = {
      id: "88",
      slug: "sample-88",
      title: "상세 상단 중복 배너 제거 검증",
      summary: "요약",
      summarySource: "MANUAL",
      content: "본문",
      createdAt: "2026-11-15T00:00:00.000Z",
      published: true,
      listed: true,
      authorName: "Aquila",
      thumbnail: "/post/api/v1/images/posts/diagram.png",
    }

    const defaultHtml = renderThemedMarkup(createElement(PostHeader, { data: sampleDetail }))
    expect(defaultHtml).not.toContain('class="thumbnailTrigger"')
    expect(defaultHtml).not.toContain("thumbnail")

    const optInThumbnailHtml = renderThemedMarkup(
      createElement(PostHeaderThumbnail, {
        rawThumbnail: sampleDetail.thumbnail ?? "",
        alt: sampleDetail.title,
      })
    )
    expect(optInThumbnailHtml).toContain('class="thumbnailTrigger"')
    expect(optInThumbnailHtml).toContain('/post/api/v1/images/posts/diagram.png')
  })

  test("EditorStudioPublishModal collapses optional cover settings by default and auto-opens on manual override", () => {
    const baseProps = {
      closeToggleLabel: "닫기",
      isCompactMobileLayout: false,
      isMobileMetaEditorOpen: false,
      isMobileThumbnailEditorOpen: false,
      loadingKey: "",
      modalNotice: { tone: "idle" as const, text: "" },
      postVisibility: "PUBLIC_LISTED" as const,
      postTitle: "자동 OG 미리보기 테스트",
      postSummary: "요약문",
      thumbnailUrl: "",
      postId: "512",
      previewMetaEditorPanel: createElement("div", null, "meta-panel"),
      publishActionButtonDisabled: false,
      publishActionButtonText: "발행하기",
      publishActionTitle: "글 발행 확인",
      shouldShowNotice: false,
      thumbnailEditorPanel: createElement("div", null, "thumb-panel"),
      visibilityOptions: PUBLISH_VISIBILITY_OPTIONS,
      onClose: () => undefined,
      onConfirmPublish: () => undefined,
      onPostVisibilityChange: () => undefined,
      onToggleMobileMetaEditor: () => undefined,
      onToggleMobileThumbnailEditor: () => undefined,
    }

    const collapsedHtml = renderThemedMarkup(
      createElement(EditorStudioPublishModal, { ...baseProps, hasManualThumbnail: false })
    )
    expect(collapsedHtml).toContain("공유 대표 이미지 직접 지정 (선택)")
    expect(collapsedHtml).toContain("자동 적용")
    expect(collapsedHtml).not.toMatch(/<details[^>]*\bopen\b/)

    const expandedHtml = renderThemedMarkup(
      createElement(EditorStudioPublishModal, { ...baseProps, hasManualThumbnail: true })
    )
    expect(expandedHtml).toContain("수동 지정됨")
    expect(expandedHtml).toMatch(/<details[^>]*\bopen=""/)
  })

  test("/api/og handler enforces GET/HEAD allowlist and Fail-Closed query length budget", async () => {
    const createMockRes = () => {
      const headers = new Map<string, string>()
      let statusCode = 200
      let sentBody: unknown = null
      let ended = false
      const res = {
        setHeader(name: string, value: string) {
          headers.set(name.toLowerCase(), value)
          return res
        },
        status(code: number) {
          statusCode = code
          return res
        },
        json(payload: unknown) {
          sentBody = payload
          ended = true
          return res
        },
        send(payload: unknown) {
          sentBody = payload
          ended = true
          return res
        },
        end() {
          ended = true
          return res
        },
      }
      return {
        res: res as unknown as NextApiResponse,
        getStatus: () => statusCode,
        getHeader: (name: string) => headers.get(name.toLowerCase()),
        getBody: () => sentBody,
        isEnded: () => ended,
      }
    }

    const postMock = createMockRes()
    await ogApiHandler(
      { method: "POST", url: "/api/og?title=test", query: { title: "test" } } as unknown as NextApiRequest,
      postMock.res
    )
    expect(postMock.getStatus()).toBe(405)
    expect(postMock.getHeader("allow")).toBe("GET, HEAD")

    const oversizedMock = createMockRes()
    await ogApiHandler(
      {
        method: "GET",
        url: `/api/og?title=${"A".repeat(2100)}`,
        query: { title: "A".repeat(2100) },
      } as unknown as NextApiRequest,
      oversizedMock.res
    )
    expect(oversizedMock.getStatus()).toBe(400)
    expect(oversizedMock.getHeader("cache-control")).toBe("no-store")

    const headMock = createMockRes()
    await ogApiHandler(
      { method: "HEAD", url: "/api/og?title=AquilaLog", query: { title: "AquilaLog" } } as unknown as NextApiRequest,
      headMock.res
    )
    expect(headMock.getStatus()).toBe(200)
    expect(headMock.getHeader("content-type")).toBe("image/png")
    expect(headMock.getBody()).toBeNull()
    expect(headMock.isEnded()).toBe(true)

    const getMock = createMockRes()
    await ogApiHandler(
      { method: "GET", url: "/api/og?title=AquilaLog", query: { title: "AquilaLog" } } as unknown as NextApiRequest,
      getMock.res
    )
    expect(getMock.getStatus()).toBe(200)
    expect(getMock.getHeader("content-type")).toBe("image/png")
    expect(getMock.getHeader("x-content-type-options")).toBe("nosniff")
    expect(Buffer.isBuffer(getMock.getBody())).toBe(true)
  })
})
