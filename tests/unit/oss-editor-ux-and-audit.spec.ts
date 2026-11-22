import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { NextApiRequest, NextApiResponse } from "next"
import { ThemeProvider } from "@emotion/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import { EditorStudioDedicatedEditorSurface } from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import {
  EDITOR_SURFACE_FOCUS_MODE,
  EDITOR_SURFACE_INSPECTOR_OPEN,
  EDITOR_SURFACE_OUTLINE_OPEN,
  EDITOR_SURFACE_ZEN_BITS,
  toggleFocusModeBits,
  toggleResponsiveSidebarBits,
} from "../../src/routes/Admin/editorStudioDedicatedSurfaceModel"
import { EditorStudioFeatureImageBar } from "../../src/routes/Admin/EditorStudioFeatureImageBar"
import { EditorStudioPublishModal } from "../../src/routes/Admin/EditorStudioPublishModal"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import {
  CHROME_SHOWN,
  isWritingInput,
  nextWritingFocus,
} from "../../src/routes/Admin/editorStudioWritingFocus"
import {
  normalizeBubbleLinkInput,
  parseMarkdownLinkSelection,
  planBubbleLinkApply,
  planBubbleLinkRemove,
} from "../../src/components/markdown-editor/MarkdownEditorBubbleLinkPopover"
import { MarkdownEditorSlashMenu } from "../../src/components/markdown-editor/MarkdownEditorSlashMenu"
import { MarkdownEditorToolbar } from "../../src/components/markdown-editor/MarkdownEditorToolbar"
import {
  computeCompactFixedPosition,
  resolveEditorBoundsTarget,
} from "../../src/components/markdown-editor/useMarkdownEditorPanelPosition"
import { measureBlockChromeLayout } from "../../src/components/markdown-editor/markdownEditorBlockChromeModel"
import { EDITOR_SYNTAX_COLORS } from "../../src/components/markdown-editor/markdownEditorSyntaxThemeTokens"
import {
  invalidateServerSnapshotCache,
  readServerSnapshot,
} from "../../src/libs/server/serverSnapshotCache"
import { getServerSideProps as getAdminToolsServerSideProps } from "../../src/pages/admin/tools"
import { renderOgCardPngBuffer } from "../../src/libs/og/ogCardRenderer.server"
import { TrueTypeOutlineFont } from "../../src/libs/og/ttfOutlineRenderer"
import {
  decodeUnfurlResponseBuffer,
  UnfurlResponseTooLargeError,
} from "../../src/libs/unfurl/requestSafety"
import {
  ipv4ToNumber,
  isPublicExternalHostname,
} from "../../src/libs/network/publicHostSafety"
import revalidateHandler from "../../src/pages/api/revalidate"
import { buildRssFeedXml, collectRssFeedPosts } from "../../src/libs/rssFeed"
import { collectSitemapPosts } from "../../src/libs/sitemapPosts"
import { createMermaidRuntimeController } from "../../src/libs/markdown/mermaidRuntimeRender"
import { sanitizeMermaidSvg } from "../../src/libs/markdown/sanitizeMermaidSvg"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderNode = (node: unknown, initialLanguage: "ko" | "en" = "ko"): string => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: materializePlaywrightJsx(
          createElement(LanguageProvider, {
            initialLanguage,
            children: node as React.ReactElement,
          })
        ) as React.ReactElement,
      })
    )
  )
}

test.describe("OSS Editor UX & Deep Audit Fixes", () => {
  test("Part A: EditorStudioFeatureImageBar, ReadinessCard, TopBar aria-pressed, Outline summary & StatusBar", () => {
    const emptyBarHtml = renderNode(
      createElement(EditorStudioFeatureImageBar, {
        postThumbnailUrl: "",
        safePreviewThumbnail: "",
        onOpenThumbnailFileInput: () => {},
      })
    )
    expect(emptyBarHtml).toContain('data-testid="editor-feature-image-add"')
    expect(emptyBarHtml).toContain("+ 커버 이미지 추가")

    const activeBarHtml = renderNode(
      createElement(EditorStudioFeatureImageBar, {
        postThumbnailUrl: "/post/api/v1/images/posts/hero.webp",
        safePreviewThumbnail: "/post/api/v1/images/posts/hero.webp",
        onOpenThumbnailFileInput: () => {},
        onResetThumbnailToAutoMode: () => {},
      })
    )
    expect(activeBarHtml).toContain('data-testid="editor-feature-image-card"')
    expect(activeBarHtml).toContain("대표 이미지 지정됨")
    expect(activeBarHtml).toContain("<img")
    expect(activeBarHtml).toContain("이미지 변경")
    expect(activeBarHtml).toContain("자동 모드로 초기화")

    const unsafeBarHtml = renderNode(
      createElement(EditorStudioFeatureImageBar, {
        postThumbnailUrl: "javascript:alert(1)",
        safePreviewThumbnail: "https://untrusted.invalid/hero.webp",
        onOpenThumbnailFileInput: () => {},
      })
    )
    expect(unsafeBarHtml).not.toContain("<img")
    expect(unsafeBarHtml).toContain("이미지 없음")

    const readinessHtml = renderNode(
      createElement(EditorStudioPublishReadinessCard, {
        hasTitle: false,
        wordCount: 42,
        hasBody: true,
        hasManualSummary: false,
        tagCount: 2,
        linkWarningCount: 1,
        totalLinkCount: 3,
      })
    )
    expect(readinessHtml).toContain('data-testid="editor-publish-readiness"')
    expect(readinessHtml).toContain("제목 완료")
    expect(readinessHtml).toContain("42단어")
    expect(readinessHtml).toContain("요약 준비")
    expect(readinessHtml).toContain("태그 구성")
    expect(readinessHtml).toContain("주의 1건")

    const baseSurfaceProps = {
      thumbnailImageFileInputRef: { current: null },
      onThumbnailImageFileChange: () => {},
      onExit: () => {},
      saveStateText: "임시 저장됨",
      saveStateTone: "success",
      primaryActionDisabled: false,
      primaryActionLabel: "발행하기",
      onPrimaryAction: () => {},
      postTags: ["ts", "next"],
      tagDraft: "",
      onTagDraftChange: () => {},
      onAddTags: () => {},
      onAddTag: () => {},
      onRemoveTag: () => {},
      titleInputRef: () => {},
      onOutlineBodyHeadingActivate: () => {},
      activeCursorOffset: 10,
      activeSelectionRange: { from: 10, to: 10 },
      postTitle: "테스트 글",
      onPostTitleChange: () => {},
      onPostTitleKeyDown: () => {},
      postContent: "## 아키텍처 개요\n\n본문 텍스트 [빈 링크](https://) 입니다.",
      postSummary: "한 줄 요약",
      onPostSummaryChange: () => {},
      postCategory: "",
      onPostCategoryChange: () => {},
      onCommitPostCategory: () => {},
      categorySuggestions: [],
      postVisibility: "PUBLIC_LISTED" as const,
      onPostVisibilityChange: () => {},
      editorCanvas: createElement("div", { "data-testid": "stub-canvas" }),
      showPublishNotice: false,
      publishNoticeTone: "idle" as const,
      publishNoticeText: "",
      isLocalDraftRestoreSuggestionVisible: false,
      isLocalDraftRestoreSuggestionActionsDisabled: false,
      onRestoreLocalDraft: () => {},
      localDraftCandidates: [],
      selectedLocalDraftCandidateKey: "",
      onSelectLocalDraftCandidate: () => {},
      onDiscardLocalDraftCandidate: () => {},
      onDismissLocalDraftRestoreSuggestion: () => {},
      onClearLocalDraft: () => {},
      publishModal: null,
      postThumbnailUrl: "/post/api/v1/images/posts/thumb.webp",
      safePreviewThumbnail: "/post/api/v1/images/posts/thumb.webp",
      onOpenThumbnailFileInput: () => {},
      onResetThumbnailToAutoMode: () => {},
    }

    const defaultDistractionFreeHtml = renderNode(
      createElement(EditorStudioDedicatedEditorSurface, baseSurfaceProps)
    )
    expect(defaultDistractionFreeHtml).toContain('data-testid="editor-inline-excerpt"')
    expect(defaultDistractionFreeHtml).toContain('data-testid="editor-floating-mini-toc"')
    expect(defaultDistractionFreeHtml).not.toContain('data-testid="editor-outline-summary"')
    expect(defaultDistractionFreeHtml).not.toContain('data-testid="editor-publish-readiness"')

    const openDrawersHtml = renderNode(
      createElement(EditorStudioDedicatedEditorSurface, {
        ...baseSurfaceProps,
        defaultPanelUiMask: EDITOR_SURFACE_ZEN_BITS,
      })
    )
    expect(openDrawersHtml).toContain('aria-pressed="true"')
    expect(openDrawersHtml).toContain('data-testid="editor-outline-summary"')
    expect(openDrawersHtml).toContain("헤딩 2개")
    expect(openDrawersHtml).toContain("글 설정")
    expect(openDrawersHtml).not.toContain('data-testid="editor-publish-readiness"')

    const hiddenFocus = nextWritingFocus(CHROME_SHOWN, { type: "edit" })
    expect(hiddenFocus.hidden).toBe(true)
    const anchoredFocus = nextWritingFocus(hiddenFocus, {
      type: "pointer-move",
      point: { x: 100, y: 100 },
      movement: { x: 2, y: 2 },
    })
    expect(anchoredFocus.hidden).toBe(true)
    const revealedFocus = nextWritingFocus(anchoredFocus, {
      type: "pointer-move",
      point: { x: 112, y: 100 },
    })
    expect(revealedFocus.hidden).toBe(false)
    expect(isWritingInput("insertText")).toBe(true)
    expect(isWritingInput("formatBold")).toBe(false)
    expect(isWritingInput("historyUndo")).toBe(false)

    const guideSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedPanelParts.tsx"),
      "utf8"
    )
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/Admin/EditorStudioPublishModalShellStyles.tsx"),
      "utf8"
    )
    expect(guideSource).toContain("overscroll-behavior: contain;")
    expect(modalSource).toContain("overscroll-behavior: contain;")
  })

  test("Part B: Bubble link URL normalization/Fail-Closed validation, toolbar ARIA/focusgroup, slash chips, gutter alignment, callout & Mermaid safety", async () => {
    expect(normalizeBubbleLinkInput("docs.example.com/intro")).toEqual({
      ok: true,
      url: "https://docs.example.com/intro",
    })
    expect(normalizeBubbleLinkInput("/posts/architecture")).toEqual({
      ok: true,
      url: "/posts/architecture",
    })
    expect(normalizeBubbleLinkInput("#section-1")).toEqual({
      ok: true,
      url: "#section-1",
    })
    expect(normalizeBubbleLinkInput("mailto:owner@example.com")).toEqual({
      ok: true,
      url: "mailto:owner@example.com",
    })
    expect(normalizeBubbleLinkInput("https://example.com/wiki/Foo_(bar)")).toEqual({
      ok: true,
      url: "https://example.com/wiki/Foo_%28bar%29",
    })
    expect(normalizeBubbleLinkInput("javascript:alert(1)").ok).toBe(false)
    expect(normalizeBubbleLinkInput("data:text/html,<script>alert(1)</script>").ok).toBe(false)
    expect(normalizeBubbleLinkInput("vbscript:msgbox(1)").ok).toBe(false)
    expect(normalizeBubbleLinkInput("https://user:pass@evil.example").ok).toBe(false)
    expect(normalizeBubbleLinkInput("   ").ok).toBe(false)
    expect(normalizeBubbleLinkInput("https://example.com/\u0000bad").ok).toBe(false)

    expect(parseMarkdownLinkSelection("[아키텍처](https://example.com)")).toEqual({
      label: "아키텍처",
      url: "https://example.com",
    })

    const appliedPlain = planBubbleLinkApply("hello world", { from: 6, to: 11 }, "example.com/x")
    expect(appliedPlain.ok).toBe(true)
    if (appliedPlain.ok) {
      expect(appliedPlain.plan.replacement).toBe("[world](https://example.com/x)")
    }

    const appliedExisting = planBubbleLinkApply(
      "[문서](https://old.example.com)",
      { from: 0, to: 30 },
      "https://new.example.com"
    )
    expect(appliedExisting.ok).toBe(true)
    if (appliedExisting.ok) {
      expect(appliedExisting.plan.replacement).toBe("[문서](https://new.example.com/)")
    }

    const removed = planBubbleLinkRemove("[문서](https://new.example.com)", { from: 0, to: 30 })
    expect(removed?.replacement).toBe("문서")

    const toolbarHtml = renderNode(
      createElement(MarkdownEditorToolbar, {
        disabled: false,
        disableMermaid: false,
        viewMode: "live",
        tableRows: 3,
        tableColumns: 3,
        commandContext: {
          disabled: false,
          selectionStart: 0,
          selectionEnd: 0,
          isTableSelection: false,
        },
        toolbarCommands: [],
        imageInputRef: { current: null },
        fileInputRef: { current: null },
        hasUploadImage: true,
        hasUploadFile: true,
        onTableRowsChange: () => {},
        onTableColumnsChange: () => {},
        onRememberSelection: () => {},
        onApplyCommand: () => {},
        onApplySnippet: () => {},
        onApplyFormatShortcut: () => {},
        onApplyListCommand: () => {},
        onApplyBlockSnippet: () => {},
        onInsertTable: () => {},
        onApplyTableEdit: () => {},
        isTableEditDisabled: () => true,
        onOpenFindReplace: () => {},
        onImageFileSelect: () => {},
        onAttachmentFileSelect: () => {},
        onViewModeChange: () => {},
      })
    )
    expect(toolbarHtml).toContain('role="toolbar"')
    expect(toolbarHtml).toContain('role="group"')
    expect(toolbarHtml).toContain('role="separator"')
    expect(toolbarHtml).toContain('aria-orientation="vertical"')
    expect(toolbarHtml).toContain('aria-label="편집기 표시 모드"')
    expect(toolbarHtml).toContain('aria-pressed="true"')

    const slashHtml = renderNode(
      createElement(MarkdownEditorSlashMenu, {
        isOpen: true,
        position: { top: 40, left: 40 },
        items: [
          {
            id: "heading-1",
            label: "제목 1 (H1)",
            description: "가장 큰 섹션 제목",
            icon: "H1",
            group: "기본 블록",
            action: () => {},
          },
          {
            id: "callout-info",
            label: "콜아웃 정보",
            description: "안내",
            icon: "ℹ️",
            group: "콜아웃 · 확장",
            action: () => {},
          },
        ],
        onClose: () => {},
      })
    )
    expect(slashHtml).toContain("제목 1 (H1)")
    expect(slashHtml).toContain('aria-label="슬래시 명령 분류"')
    expect(slashHtml).toContain("전체")
    expect(slashHtml).toContain("확장")

    const chromeLayout = measureBlockChromeLayout({
      canShowBubble: false,
      canShowGutterPlus: true,
      isBlockMenuOpen: false,
      selection: { from: 0, to: 0 },
      activeLineStart: 0,
      resolveCoords: () => ({ top: 40, bottom: 62, left: 320, right: 330 }),
      container: {
        getBoundingClientRect: () => ({ top: 0, bottom: 500, left: 100, right: 1300, width: 1200, height: 500 }),
        querySelector: (sel: string) =>
          sel === ".cm-content"
            ? { getBoundingClientRect: () => ({ top: 0, bottom: 500, left: 280, right: 1120, width: 840, height: 500 }) }
            : null,
      } as unknown as HTMLElement,
    })
    expect(chromeLayout.gutterLeft).toBe(182)

    const liveCommandsSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/markdown-editor/markdownEditorLiveSurfaceCommands.ts"),
      "utf8"
    )
    expect(liveCommandsSource).toContain(".cm-live-callout-tone-example")

    expect(
      sanitizeMermaidSvg(
        '<svg viewBox="0 0 100 100"><g onload="alert(1)"><foreignObject><a href="javascript:alert(1)">ok</a><script>alert(1)</script></foreignObject></g></svg>'
      )
    ).toBe("")
    expect(
      sanitizeMermaidSvg('<svg/onload=alert(1)><text>bypass</text></svg>')
    ).toBe("")
    expect(
      sanitizeMermaidSvg('<svg viewBox="0 0 100 100"><text>safe</text></svg>')
    ).toContain("<text>safe</text>")

    let disconnectedQueryCalls = 0
    const disconnectedController = createMermaidRuntimeController({
      root: {
        isConnected: false,
        querySelectorAll: () => {
          disconnectedQueryCalls += 1
          return []
        },
      } as unknown as HTMLElement,
      preset: { mode: "github", themeKey: "light", config: {} },
      allowDesktopWideLane: false,
      lazyViewport: false,
      shouldLogMermaidWarnings: false,
      isDisposed: () => false,
      retryTimers: new Set<number>(),
    })
    await disconnectedController.renderMermaidBlocks()
    expect(disconnectedQueryCalls).toBe(0)
    disconnectedController.dispose()
  })

  test("Part C: Snapshot LRU cache, admin tools SSR auth ordering, OG singleflight + TTF LRU, Zlib limit, IPv4/host SSRF, Revalidate CSRF, and RSS/Sitemap loop & cache hardening", async () => {
    invalidateServerSnapshotCache()
    let loads = 0
    for (let i = 0; i < 128; i += 1) {
      await readServerSnapshot(`lru:${i}`, 60_000, async () => {
        loads += 1
        return { index: i }
      })
    }
    expect(loads).toBe(128)

    // Refresh key lru:0 so lru:1 becomes LRU
    const hit0 = await readServerSnapshot("lru:0", 60_000, async () => {
      loads += 1
      return { index: -1 }
    })
    expect(hit0.source).toBe("snapshot")
    expect(loads).toBe(128)

    // Write lru:128 -> evicts lru:1 while keeping lru:0
    await readServerSnapshot("lru:128", 60_000, async () => {
      loads += 1
      return { index: 128 }
    })
    expect(loads).toBe(129)

    const hit0After = await readServerSnapshot("lru:0", 60_000, async () => {
      loads += 1
      return { index: -1 }
    })
    expect(hit0After.source).toBe("snapshot")
    expect(loads).toBe(129)

    await readServerSnapshot("lru:1", 60_000, async () => {
      loads += 1
      return { index: 1 }
    })
    expect(loads).toBe(130)

    const origFetch = globalThis.fetch
    const origBackendUrl = process.env.BACKEND_INTERNAL_URL
    try {
      process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:18080"
      const requestedUrls: string[] = []
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        requestedUrls.push(url)
        return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
      }) as typeof fetch

      const result = await getAdminToolsServerSideProps({
        req: {
          url: "/admin/tools",
          headers: { cookie: "apiKey=forged-cookie" },
        },
        res: {
          getHeader: () => undefined,
          setHeader: () => {},
        },
      } as never)

      expect("redirect" in result).toBe(true)
      expect(requestedUrls.some((url) => url.includes("/system/api/v1/adm/health"))).toBe(false)
      expect(requestedUrls.some((url) => url.includes("/system/api/v1/adm/dashboard-snapshot"))).toBe(false)
    } finally {
      globalThis.fetch = origFetch
      if (origBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
      else process.env.BACKEND_INTERNAL_URL = origBackendUrl
    }

    const ogParams = { title: "Singleflight Concurrent OG", category: "Architecture", tags: ["cache", "og"] }
    const [bufA, bufB] = await Promise.all([
      renderOgCardPngBuffer(ogParams),
      renderOgCardPngBuffer(ogParams),
    ])
    expect(Buffer.compare(bufA, bufB)).toBe(0)

    const fontBytes = fs.readFileSync(path.resolve(__dirname, "../../public/fonts/IBMPlexSansKR-SemiBold.ttf"))
    const font = new TrueTypeOutlineFont(fontBytes)
    // Fill 4096 cache entries, promote codepoint 0x0041 ('A'), then trigger single eviction at 4097
    font.getGlyphForCodePoint(0x0041)
    for (let i = 0; i < 4095; i += 1) {
      font.getGlyphForCodePoint(0x100000 + i)
    }
    const hotGlyph = font.getGlyphForCodePoint(0x0041)
    font.getGlyphForCodePoint(0x10ffff)
    const cacheInternal = (font as unknown as { glyphCache: Map<number, unknown> }).glyphCache
    expect(cacheInternal.size).toBe(4096)
    expect(cacheInternal.has(0x0041)).toBe(true)
    expect(cacheInternal.get(0x0041)).toBe(hotGlyph)
    expect(cacheInternal.has(0x100000)).toBe(false)

    const zipBombPayload = zlib.gzipSync(Buffer.alloc(2 * 1024 * 1024 + 4096, 65))
    expect(() => decodeUnfurlResponseBuffer(zipBombPayload, "gzip")).toThrow(UnfurlResponseTooLargeError)

    expect(ipv4ToNumber("0.0.0.0")).toBe(0)
    expect(ipv4ToNumber("0177.0.0.1")).toBeNull()
    expect(ipv4ToNumber("127.00.0.1")).toBeNull()
    expect(isPublicExternalHostname("127.1")).toBe(false)
    expect(isPublicExternalHostname("0x7f.0.0.1")).toBe(false)
    expect(isPublicExternalHostname("0177.0.0.1")).toBe(false)
    expect(isPublicExternalHostname("0.0.0x7f")).toBe(false)
    expect(isPublicExternalHostname("bad..example.com")).toBe(false)
    expect(isPublicExternalHostname("docs.example.com")).toBe(true)

    const origRevalToken = process.env.TOKEN_FOR_REVALIDATE
    try {
      process.env.TOKEN_FOR_REVALIDATE = "secret-token-for-csrf-test"
      process.env.BACKEND_INTERNAL_URL = "http://127.0.0.1:18080"
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (String(input).includes("/member/api/v1/auth/session")) {
          return new Response(JSON.stringify({ id: 1, isAdmin: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }
        return new Response("{}", { status: 404 })
      }) as typeof fetch

      const callRevalidate = async (headers: Record<string, string>) => {
        let status = 200
        let payload: unknown = null
        const res = {
          revalidate: async () => {},
          setHeader: () => res,
          status(code: number) {
            status = code
            return res
          },
          json(body: unknown) {
            payload = body
            return res
          },
          send() {
            return res
          },
        } as unknown as NextApiResponse
        await revalidateHandler(
          {
            method: "POST",
            headers,
            query: {},
            body: { paths: ["/"] },
          } as unknown as NextApiRequest,
          res
        )
        return { status, payload }
      }

      const crossSiteRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
        "sec-fetch-site": "cross-site",
      })
      expect(crossSiteRes.status).toBe(403)

      const evilOriginRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
        origin: "https://evil.example",
      })
      expect(evilOriginRes.status).toBe(403)

      const nullOriginRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
        origin: "null",
      })
      expect(nullOriginRes.status).toBe(403)

      const missingOriginProofRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
      })
      expect(missingOriginProofRes.status).toBe(403)

      const spoofedForwardedHostRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
        "x-forwarded-host": "evil.example",
        origin: "https://evil.example",
      })
      expect(spoofedForwardedHostRes.status).toBe(403)

      const sameOriginRes = await callRevalidate({
        cookie: "apiKey=admin-sess",
        host: "blog.example.com",
        origin: "https://blog.example.com",
        "sec-fetch-site": "same-origin",
      })
      expect(sameOriginRes.status).toBe(200)
    } finally {
      globalThis.fetch = origFetch
      if (origRevalToken === undefined) delete process.env.TOKEN_FOR_REVALIDATE
      else process.env.TOKEN_FOR_REVALIDATE = origRevalToken
      if (origBackendUrl === undefined) delete process.env.BACKEND_INTERNAL_URL
      else process.env.BACKEND_INTERNAL_URL = origBackendUrl
    }

    const clampedRssPosts = await collectRssFeedPosts(
      async ({ page = 1 }) => ({
        posts: [
          {
            id: "clamped-1",
            slug: "clamped-1",
            title: "First\u0000Title\u000BWith\u001FControl\uFFFEEmoji🚀",
            summary: "Clean\u0008Summary\nLine2",
            published: true,
            listed: true,
            status: ["Public"],
            createdTime: "2026-01-01T00:00:00.000Z",
          },
        ],
        hasNext: true,
        totalCount: 999,
        pageNumber: page,
        pageSize: 1,
      }),
      { pageSize: 1, maxPages: 3 }
    )
    expect(clampedRssPosts).toHaveLength(1)
    const xml = buildRssFeedXml(clampedRssPosts, {
      siteUrl: "https://blog.example.com",
      title: "Feed\u0007Title",
      description: "Desc",
      lang: "ko-KR",
    })
    expect(xml).toContain("<title>FirstTitleWithControlEmoji🚀</title>")
    expect(xml).not.toContain("\u0000")
    expect(xml).not.toContain("\u000b")
    expect(xml).not.toContain("\ufffe")

    const clampedSitemapPosts = await collectSitemapPosts(
      async ({ page = 1 }) => ({
        posts: [
          {
            id: page === 1 ? "private-1" : "public-2",
            slug: page === 1 ? "private-1" : "public-2",
            title: "Item",
            published: page > 1,
            listed: page > 1,
            status: [page > 1 ? "Public" : "Private"],
            createdTime: "2026-01-01T00:00:00.000Z",
          },
        ],
        hasNext: true,
        totalCount: 999,
        pageNumber: page,
        pageSize: 1,
      }),
      { pageSize: 1, maxPages: 4 }
    )
    expect(clampedSitemapPosts.map((p) => p.id)).toEqual(["public-2"])

    const sitemapPageSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/pages/sitemap.xml.tsx"),
      "utf8"
    )
    expect(sitemapPageSource).toContain("public, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400")
  })

  test("Editor overhaul: focus mode bitmask, publish readiness drawer, bilingual 2-row slash menu, and dark code tokens", () => {
    const withSidebars = EDITOR_SURFACE_OUTLINE_OPEN | EDITOR_SURFACE_INSPECTOR_OPEN
    const focused = toggleFocusModeBits(withSidebars)
    expect((focused & EDITOR_SURFACE_FOCUS_MODE) !== 0).toBe(true)
    expect((focused & EDITOR_SURFACE_ZEN_BITS) === 0).toBe(true)
    const reopenedSidebar = toggleResponsiveSidebarBits(focused, EDITOR_SURFACE_OUTLINE_OPEN)
    expect((reopenedSidebar & EDITOR_SURFACE_OUTLINE_OPEN) !== 0).toBe(true)
    expect((reopenedSidebar & EDITOR_SURFACE_FOCUS_MODE) === 0).toBe(true)

    const publishDrawerHtml = renderNode(
      createElement(EditorStudioPublishModal, {
        closeToggleLabel: "닫기",
        isCompactMobileLayout: false,
        isMobileMetaEditorOpen: false,
        isMobileThumbnailEditorOpen: false,
        loadingKey: "",
        modalNotice: { tone: "idle", text: "" },
        postVisibility: "PUBLIC_LISTED",
        postTitle: "글쓰기 스튜디오 개편 노트",
        postSummary: "독자 화면과 일관된 744px 단일 편집 시트 정리",
        postId: "draft-1",
        readinessSummary: {
          hasTitle: true,
          wordCount: 240,
          hasBody: true,
          hasManualSummary: true,
          tagCount: 2,
          linkWarningCount: 0,
          totalLinkCount: 1,
        },
        previewMetaEditorPanel: null,
        publishActionButtonDisabled: false,
        publishActionButtonText: "발행",
        publishActionTitle: "발행 확인",
        shouldShowNotice: false,
        thumbnailEditorPanel: null,
        variant: "drawer",
        visibilityOptions: [{ value: "PUBLIC_LISTED", label: "공개", description: "모든 방문자에게 노출" }],
        onClose: () => {},
        onConfirmPublish: () => {},
        onPostVisibilityChange: () => {},
        onToggleMobileMetaEditor: () => {},
        onToggleMobileThumbnailEditor: () => {},
      })
    )
    expect(publishDrawerHtml).toContain('data-testid="editor-publish-readiness"')
    expect(publishDrawerHtml).toContain("https://www.aquilaxk.site/posts/draft-1")

    const slashEnHtml = renderNode(
      createElement(MarkdownEditorSlashMenu, {
        isOpen: true,
        position: { top: 40, left: 40 },
        items: [
          {
            id: "heading-1",
            label: "제목 1 (H1)",
            description: "가장 큰 섹션 제목",
            icon: "H1",
            group: "기본 블록",
            action: () => {},
          },
          {
            id: "code-block",
            label: "코드 블록 (Code)",
            description: "언어 구문 강조 코드 블록",
            icon: "code-block",
            group: "미디어 · 수식 · 표",
            action: () => {},
          },
        ],
        onClose: () => {},
      }),
      "en"
    )
    expect(slashEnHtml).toContain("Large top-level section title")
    expect(slashEnHtml).toContain("slash-syntax-badge")
    expect(slashEnHtml).not.toMatch(/[가-힣]/)

    expect(EDITOR_SYNTAX_COLORS.codeBlockLineSurface).toBe("#0f1728")

    const editorStylesSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditor.styles.ts"),
      "utf8"
    )
    expect(editorStylesSource).not.toMatch(/\s:is\(/)
    expect(editorStylesSource).toContain(".cm-line.cm-live-code-line .tok-keyword")
    expect(editorStylesSource).toContain(".cm-line.cm-live-code-line .tok-variableName.tok-definition")

    const makeRectElement = (
      rect: { left: number; right: number; top: number; bottom: number; width: number; height: number },
      hooks?: {
        closest?: (selector: string) => unknown
        querySelector?: (selector: string) => unknown
      }
    ) =>
      ({
        getBoundingClientRect: () => rect,
        closest: hooks?.closest ?? (() => null),
        querySelector: hooks?.querySelector ?? (() => null),
      }) as unknown as HTMLElement

    const editorEl = makeRectElement({
      left: 4.234375,
      right: 324.234375,
      top: 90,
      bottom: 840,
      width: 320,
      height: 750,
    })
    const toolbarEl = makeRectElement({ left: 0, right: 320, top: 48, bottom: 90, width: 320, height: 42 })
    const columnEl = makeRectElement(
      { left: 0, right: 328.46875, top: 0, bottom: 844, width: 328.46875, height: 844 },
      {
        querySelector: (selector) => (selector === "[data-testid='markdown-editor']" ? editorEl : null),
      }
    )
    const portaledRootEl = makeRectElement(
      { left: 0, right: 44, top: 52, bottom: 90, width: 44, height: 38 },
      {
        closest: (selector) => {
          if (selector === "[data-testid='editor-writing-column']") return columnEl
          if (selector === "[data-testid='markdown-editor-toolbar']") return toolbarEl
          return null
        },
      }
    )
    expect(resolveEditorBoundsTarget(portaledRootEl)).toBe(editorEl)

    const panelEl = makeRectElement({ left: 0, right: 204.6, top: 0, bottom: 180, width: 204.6, height: 180 })
    const prevWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = { innerWidth: 320, innerHeight: 844 }
    try {
      const startPos = computeCompactFixedPosition(portaledRootEl, panelEl, editorEl, "start")
      const endPos = computeCompactFixedPosition(portaledRootEl, panelEl, editorEl, "end")
      expect(startPos.left).toBeGreaterThanOrEqual(4.234375)
      expect(endPos.left + 204.6).toBeLessThanOrEqual(324.234375)
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window
      } else {
        ;(globalThis as { window?: unknown }).window = prevWindow
      }
    }
  })
})
