import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, test } from "@playwright/test"
import {
  MarkdownEmbedBlockWidget,
  MarkdownFileBlockWidget,
  parseBlockContainerBlocks,
} from "../../src/components/markdown-editor/markdownEditorBlockWidgets"
import { MarkdownEditorReadingPreview } from "../../src/components/markdown-editor/MarkdownEditorReadingPreview"
import { handleMarkdownEditorEscapeKeyDown } from "../../src/components/markdown-editor/useMarkdownEditorTextareaKeyboard"
import { ConfirmDialog } from "../../src/design-system/ConfirmDialog"
import { Toast } from "../../src/design-system/Toast"
import { isPublicBlogRoutePath } from "../../src/layouts/RootLayout"
import { LanguageProvider, translations } from "../../src/libs/language"
import { createMarkdownDocumentInsights } from "../../src/libs/markdown/markdownDocumentInsights"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { renderMarkdownSegment } from "../../src/libs/markdown/MarkdownRendererSegments"
import { openImageLightboxOverlay } from "../../src/libs/markdown/imageLightboxOverlay"
import { openMermaidOverlay } from "../../src/libs/markdown/mermaidRuntimeOverlay"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"
import { __resetBodyScrollLockForTests } from "../../src/libs/utils/bodyScrollLock"
import { resolveBlockedHistoryNavigationDelta, readHistoryStateIndex } from "../../src/routes/Admin/editorStudioUnsavedExitGuard"
import { measureHeadingOffsets, resolveActiveTocIdFromOffsets } from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { resolveFeedInitialMountCount } from "../../src/routes/Feed/FeedExplorerRestoreModel"
import SearchInput from "../../src/routes/Feed/SearchInput"
import { createTheme } from "../../src/styles/theme"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderStaticNode = (node: unknown): string => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: materializePlaywrightJsx(node) as React.ReactElement,
      })
    )
  )
}

const withDomEnv = <T>(
  run: (hooks: {
    getBodyOverflow: () => string
    dispatchPopState: () => void
    overlayCount: () => number
  }) => T
): T => {
  const origDocument = (globalThis as Record<string, unknown>).document
  const origWindow = (globalThis as Record<string, unknown>).window
  const appendedNodes: Array<{ remove: () => void; setAttribute: (k: string, v: string) => void; attrs: Record<string, string> }> = []
  const windowListeners = new Map<string, Set<() => void>>()
  const docListeners = new Map<string, Set<(e: unknown) => void>>()

  const makeEl = (tag: string): any => {
    const attrs: Record<string, string> = {}
    const classes = new Set<string>()
    const children: any[] = []
    const el: any = {
      tagName: tag.toUpperCase(),
      attrs,
      dataset: {} as Record<string, string>,
      style: {
        setProperty: () => {},
      } as Record<string, unknown>,
      get className() {
        return [...classes].join(" ")
      },
      set className(val: string) {
        classes.clear()
        for (const cls of val.split(/\s+/).filter(Boolean)) classes.add(cls)
      },
      classList: {
        add: (...names: string[]) => names.forEach((n) => classes.add(n)),
        contains: (name: string) => classes.has(name),
      },
      children,
      appendChild(child: any) {
        children.push(child)
        return child
      },
      append(...nodes: any[]) {
        children.push(...nodes)
      },
      setAttribute(k: string, v: string) {
        attrs[k] = v
      },
      getAttribute(k: string) {
        return attrs[k] ?? null
      },
      removeAttribute(k: string) {
        delete attrs[k]
      },
      addEventListener() {},
      removeEventListener() {},
      querySelector() {
        return null
      },
      closest() {
        return null
      },
      focus() {},
      remove() {
        const idx = appendedNodes.indexOf(el)
        if (idx >= 0) appendedNodes.splice(idx, 1)
      },
    }
    return el
  }

  const fakeBody = makeEl("body")
  fakeBody.appendChild = (node: any) => {
    appendedNodes.push(node)
    return node
  }
  const fakeDoc = {
    documentElement: { lang: "en" },
    body: fakeBody,
    activeElement: null,
    createElement: (tag: string) => makeEl(tag),
    createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
    addEventListener(type: string, fn: (e: unknown) => void) {
      if (!docListeners.has(type)) docListeners.set(type, new Set())
      docListeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      docListeners.get(type)?.delete(fn)
    },
  }
  const fakeWindow = {
    addEventListener(type: string, fn: () => void) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: () => void) {
      windowListeners.get(type)?.delete(fn)
    },
    dispatchEvent() {
      return true
    },
  }

  ;(globalThis as Record<string, unknown>).document = fakeDoc
  ;(globalThis as Record<string, unknown>).window = fakeWindow
  __resetBodyScrollLockForTests()

  try {
    return run({
      getBodyOverflow: () => String(fakeBody.style.overflow ?? ""),
      dispatchPopState: () => {
        for (const fn of [...(windowListeners.get("popstate") ?? [])]) fn()
      },
      overlayCount: () => appendedNodes.length,
    })
  } finally {
    __resetBodyScrollLockForTests()
    ;(globalThis as Record<string, unknown>).document = origDocument
    ;(globalThis as Record<string, unknown>).window = origWindow
  }
}

test.describe("Workstream 2 UX, parity, accessibility, and i18n", () => {
  test("shared directive parser aligns :::: nesting, aliases (video/youtube/attachment/pdf), and title=... between editor and renderer", () => {
    const doc = [
      '::::toggle title="바깥 토글"',
      ":::callout warning 안쪽 주의",
      "내부 내용",
      ":::",
      "::::",
      "",
      ':::youtube https://youtu.be/dQw4w9WgXcQ title="YouTube 데모"',
      "영상 설명",
      ":::",
      "",
      ':::pdf https://example.com/spec.pdf title="API 명세"',
      "PDF 첨부",
      ":::",
      "",
      ":::video https://user:pass@evil.example.com/a.mp4",
      "차단 대상",
      ":::",
    ].join("\n")

    const editorBlocks = parseBlockContainerBlocks(doc)
    expect(editorBlocks).toHaveLength(3)
    expect(editorBlocks[0]).toMatchObject({
      kind: "toggle",
      title: "바깥 토글",
    })
    expect((editorBlocks[0] as { body: string }).body).toContain(":::callout warning 안쪽 주의")
    expect(editorBlocks[1]).toEqual({
      kind: "embed",
      from: doc.indexOf(":::youtube"),
      to: doc.indexOf("\n:::", doc.indexOf(":::youtube")) + 4,
      url: "https://youtu.be/dQw4w9WgXcQ",
      title: "YouTube 데모",
      caption: "영상 설명",
    })
    expect(editorBlocks[2]).toEqual({
      kind: "file",
      from: doc.indexOf(":::pdf"),
      to: doc.indexOf("\n:::", doc.indexOf(":::pdf")) + 4,
      url: "https://example.com/spec.pdf",
      name: "API 명세",
      description: "PDF 첨부",
    })

    const renderedSegments = parseMarkdownSegments(doc)
    expect(renderedSegments).toEqual([
      expect.objectContaining({
        type: "toggle",
        title: "바깥 토글",
      }),
      expect.objectContaining({
        type: "embed",
        url: "https://youtu.be/dQw4w9WgXcQ",
        title: "YouTube 데모",
        caption: "영상 설명",
      }),
      expect.objectContaining({
        type: "file",
        url: "https://example.com/spec.pdf",
        name: "API 명세",
        description: "PDF 첨부",
      }),
      expect.objectContaining({
        type: "embed",
        url: "",
      }),
    ])

    withDomEnv(() => {
      const embedDom = new MarkdownEmbedBlockWidget(
        "https://youtu.be/dQw4w9WgXcQ",
        "YouTube 데모",
        "영상 설명",
        0,
        20
      ).toDOM()
      expect(embedDom.getAttribute("data-testid") ?? embedDom.dataset.testid).toBe("cm-live-embed-widget")

      const fileDom = new MarkdownFileBlockWidget(
        "https://example.com/spec.pdf",
        "API 명세",
        "PDF 첨부",
        0,
        20
      ).toDOM()
      expect(fileDom.getAttribute("data-testid") ?? fileDom.dataset.testid).toBe("cm-live-file-widget")
    })
  })

  test("external card thumbnails enforce public https URLs + no-referrer + noopener noreferrer", () => {
    const htmlSafe = renderStaticNode(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: renderMarkdownSegment({
          segment: {
            type: "bookmark",
            url: "https://example.com/article",
            title: "External Article",
            description: "Summary",
            thumbnailUrl: "https://cdn.example.com/thumb.webp",
          },
          index: 0,
          imageIndex: -1,
          editableImages: false,
          renderMarkdown: (md) => md,
          t: (key) => translations.en[key],
        }),
      })
    )
    expect(htmlSafe).toContain('src="https://cdn.example.com/thumb.webp"')
    expect(htmlSafe.toLowerCase()).toContain('referrerpolicy="no-referrer"')
    expect(htmlSafe).toContain('rel="noopener noreferrer"')

    const htmlInvalid = renderStaticNode(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: renderMarkdownSegment({
          segment: {
            type: "bookmark",
            url: "https://example.com/article",
            title: "Invalid Thumb",
            description: "Summary",
            thumbnailUrl: "https://cdn.example.invalid/thumb.webp",
          },
          index: 1,
          imageIndex: -1,
          editableImages: false,
          renderMarkdown: (md) => md,
          t: (key) => translations.en[key],
        }),
      })
    )
    expect(htmlInvalid).not.toContain("cdn.example.invalid")
  })

  test("MarkdownEditor reading preview mounts real MarkdownRenderer and renders wikilinks", () => {
    const html = renderStaticNode(
      createElement(MarkdownEditorReadingPreview, {
        value: "# Reading Title\n\nSee [[Architecture|아키텍처 문서]].",
        disableMermaid: true,
      })
    )
    expect(html).toContain('data-testid="markdown-editor-reading-surface"')
    expect(html).toContain("Reading Title")
    expect(html).toContain("aq-wikilink")
    expect(html).toContain("아키텍처 문서")

    const emptyHtml = renderStaticNode(
      createElement(LanguageProvider, {
        initialLanguage: "en",
        children: createElement(MarkdownRenderer, { content: "", disableMermaid: true }),
      })
    )
    expect(emptyHtml).toContain("No content available.")
  })

  test("TOC skips hidden headings in closed <details> / 0x0 rects, keeps monotonic offsets, and fixes CRLF heading offsets", () => {
    const origDocument = (globalThis as Record<string, unknown>).document
    const elements: Record<string, any> = {
      visible1: {
        closest: () => null,
        getBoundingClientRect: () => ({ top: 100, width: 200, height: 32 }),
      },
      hiddenInDetails: {
        closest: (sel: string) => (sel === "details:not([open])" ? {} : null),
        getBoundingClientRect: () => ({ top: 0, width: 0, height: 0 }),
      },
      visible2: {
        closest: () => null,
        getBoundingClientRect: () => ({ top: 60, width: 200, height: 28 }),
      },
    }
    ;(globalThis as Record<string, unknown>).document = {
      getElementById: (id: string) => elements[id] ?? null,
    }
    try {
      const offsets = measureHeadingOffsets(
        [
          { id: "visible1", text: "Visible 1", level: 2 },
          { id: "hiddenInDetails", text: "Hidden Inside Details", level: 2 },
          { id: "visible2", text: "Visible 2", level: 2 },
        ],
        50
      )
      expect(offsets).toEqual([
        { id: "visible1", topDoc: 150 },
        { id: "visible2", topDoc: 150 },
      ])
      expect(resolveActiveTocIdFromOffsets(offsets, 200, 0)).toBe("visible2")
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDocument
    }

    const crlfMarkdown = "# First\r\n\r\n## Second\r\n"
    const normalizedCrlf = crlfMarkdown.replace(/\r\n/g, "\n")
    const insights = createMarkdownDocumentInsights(crlfMarkdown)
    expect(insights.headings).toHaveLength(2)
    expect(insights.headings[1]?.offset).toBe(normalizedCrlf.indexOf("## Second"))
    expect(normalizedCrlf.slice(insights.headings[1]!.range.start, insights.headings[1]!.range.end)).toBe("## Second")
  })

  test("lightbox and mermaid overlays close cleanly and unlock body scroll on popstate", () => {
    withDomEnv(({ getBodyOverflow, dispatchPopState, overlayCount }) => {
      openImageLightboxOverlay({ src: "https://example.com/a.png", alt: "Diagram" })
      expect(overlayCount()).toBe(1)
      expect(getBodyOverflow()).toBe("hidden")

      dispatchPopState()
      expect(overlayCount()).toBe(0)
      expect(getBodyOverflow()).toBe("")

      openMermaidOverlay("<svg viewBox='0 0 100 60'></svg>", null, "graph TD; A-->B;")
      expect(overlayCount()).toBe(1)
      expect(getBodyOverflow()).toBe("hidden")

      dispatchPopState()
      expect(overlayCount()).toBe(0)
      expect(getBodyOverflow()).toBe("")
    })
  })

  test("SearchInput clear button, Toast, ConfirmDialog localize cleanly and RootLayout marks /feed as public blog route", () => {
    expect(isPublicBlogRoutePath("/feed")).toBe(true)
    expect(isPublicBlogRoutePath("/admin/posts")).toBe(false)
    expect(resolveFeedInitialMountCount(40, 1800, 8, 120)).toBeGreaterThanOrEqual(21)

    const enHtml = renderStaticNode(
      createElement(LanguageProvider, {
        initialLanguage: "en",
        children: createElement(
          "div",
          null,
          createElement(SearchInput, { value: "nextjs", onChange: () => {}, onClear: () => {} }),
          createElement(Toast, { open: true, message: "Saved", onOpenChange: () => {} }),
          createElement(ConfirmDialog, {
            open: true,
            titleId: "t1",
            descriptionId: "d1",
            title: "Confirm",
            description: "Sure?",
            confirmLabel: "Proceed",
            onConfirm: () => {},
            onCancel: () => {},
          })
        ),
      })
    )

    expect(enHtml).toContain('aria-label="Search posts by keyword"')
    expect(enHtml).toContain('aria-label="Clear search query"')
    expect(enHtml).toContain(">Dismiss<")
    expect(enHtml).toContain(">Cancel<")
  })

  test("unsaved exit guard resolves back vs forward history navigation direction accurately", () => {
    expect(readHistoryStateIndex({ idx: 4 })).toBe(4)
    expect(readHistoryStateIndex({ index: 2 })).toBe(2)
    expect(resolveBlockedHistoryNavigationDelta({ idx: 3 }, { idx: 2 })).toBe(-1)
    expect(resolveBlockedHistoryNavigationDelta({ idx: 3 }, { idx: 4 })).toBe(1)

    const keyMap = new Map([
      ["k-editor", 2],
      ["k-forward", 3],
      ["k-back", 1],
    ])
    expect(resolveBlockedHistoryNavigationDelta({ key: "k-editor" }, { key: "k-forward" }, keyMap)).toBe(1)
    expect(resolveBlockedHistoryNavigationDelta({ key: "k-editor" }, { key: "k-back" }, keyMap)).toBe(-1)
    expect(resolveBlockedHistoryNavigationDelta({ key: "k-editor" }, { key: "unknown" }, keyMap)).toBe(-1)
  })

  test("handleMarkdownEditorEscapeKeyDown closes open Find/Replace cleanly before native Tab escape", () => {
    let closedCount = 0
    let prevented = 0
    const allowTabRef = { current: false }

    expect(
      handleMarkdownEditorEscapeKeyDown(
        { key: "Escape", preventDefault: () => { prevented += 1 } },
        true,
        () => { closedCount += 1 },
        allowTabRef
      )
    ).toBe(true)
    expect(closedCount).toBe(1)
    expect(prevented).toBe(1)
    expect(allowTabRef.current).toBe(false)

    expect(
      handleMarkdownEditorEscapeKeyDown(
        { key: "Escape", preventDefault: () => { prevented += 1 } },
        false,
        () => { closedCount += 1 },
        allowTabRef
      )
    ).toBe(true)
    expect(closedCount).toBe(1)
    expect(prevented).toBe(1)
    expect(allowTabRef.current).toBe(true)
  })
})
