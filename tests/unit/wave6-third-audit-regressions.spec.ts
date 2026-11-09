import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { ErrorFallbackView } from "../../src/components/error/ErrorFallbackView"
import { appendInlineMarkdownNodes } from "../../src/components/markdown-editor/markdownEditorInlineDom"
import { parseCalloutBlockquoteSpec } from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import { planToggleWrapSelection } from "../../src/components/markdown-editor/markdownEditorTextMutation"
import { MarkdownCalloutWidget } from "../../src/components/markdown-editor/markdownEditorWidgets"
import { focusTopicsRailElement } from "../../src/layouts/RootLayout/Header/NavBarSearchModel"
import {
  LanguageProvider,
  setClientStoredLanguage,
} from "../../src/libs/language"
import PrettyCodeBlock from "../../src/libs/markdown/components/PrettyCodeBlock"
import {
  MarkdownFootnoteAppendix,
  MarkdownFootnoteReferenceLink,
} from "../../src/libs/markdown/MarkdownRendererFootnotes"
import { renderMarkdownSegment } from "../../src/libs/markdown/MarkdownRendererSegments"
import { buildCloudAssetMarkdownSnippet } from "../../src/routes/Admin/EditorStudioCloudAssetPicker"
import {
  MobileSummaryActions,
  resolveMobileShareAriaLabel,
  resolveMobileShareButtonLabel,
} from "../../src/routes/Detail/PostDetail/PostDetailActionSections"
import PostDetailMobileToc from "../../src/routes/Detail/PostDetail/PostDetailMobileToc"
import { PostHeaderEngagementSection } from "../../src/routes/Detail/PostDetail/PostHeader"
import { createTheme } from "../../src/styles/theme"
import { withWindowStorage } from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const readSrc = (relPath: string) =>
  readFileSync(path.resolve(__dirname, "../../src", relPath), "utf8")

test.describe("Third audit 10-item regressions", () => {
  test("1. symmetric bold/italic delimiters in planToggleWrapSelection and snake_case guard in appendInlineMarkdownNodes", () => {
    expect(planToggleWrapSelection("__bold__", 2, 6, "**", "**")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "bold",
      selectionStart: 0,
      selectionEnd: 4,
    })
    expect(planToggleWrapSelection("__bold__", 0, 8, "**", "**")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "bold",
      selectionStart: 0,
      selectionEnd: 4,
    })
    expect(planToggleWrapSelection("*italic*", 1, 7, "_", "_")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "italic",
      selectionStart: 0,
      selectionEnd: 6,
    })
    expect(planToggleWrapSelection("*italic*", 0, 8, "_", "_")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "italic",
      selectionStart: 0,
      selectionEnd: 6,
    })
    expect(planToggleWrapSelection("_italic_", 1, 7, "*", "*")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "italic",
      selectionStart: 0,
      selectionEnd: 6,
    })

    const origDoc = (globalThis as Record<string, unknown>).document
    try {
      const makeNode = (tag: string, text = ""): Record<string, unknown> => {
        const children: Array<Record<string, unknown>> = []
        return {
          tagName: tag,
          className: "",
          textContent: text,
          children,
          dataset: {},
          style: { setProperty: () => {} },
          setAttribute: () => {},
          appendChild(child: Record<string, unknown>) {
            children.push(child)
            return child
          },
        }
      }
      ;(globalThis as Record<string, unknown>).document = {
        createElement: (tag: string) => makeNode(tag.toUpperCase()),
        createTextNode: (text: string) => makeNode("#text", text),
      }

      const italicHost = makeNode("DIV")
      appendInlineMarkdownNodes(italicHost as unknown as HTMLElement, "앞 _기울임_ 뒤 __굵게__ 끝")
      const tags = (italicHost.children as Array<Record<string, unknown>>).map((c) => c.tagName)
      expect(tags).toContain("EM")
      expect(tags).toContain("STRONG")

      const snakeHost = makeNode("DIV")
      appendInlineMarkdownNodes(
        snakeHost as unknown as HTMLElement,
        "foo_bar_baz and foo__bar__baz stay plain"
      )
      const snakeTags = (snakeHost.children as Array<Record<string, unknown>>).map(
        (c) => c.tagName
      )
      expect(snakeTags).toEqual([])
      expect(snakeHost.textContent).toBe("foo_bar_baz and foo__bar__baz stay plain")
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }
  })

  test("2. table cell inline shortcut maps Mod+Shift+C to code and frees Mod+E for view mode toggle", () => {
    const tableDomSource = readSrc("components/markdown-editor/markdownEditorTableSessionDom.ts")
    expect(tableDomSource).not.toContain('!event.shiftKey && lowerKey === "e"')
    expect(tableDomSource).toContain('event.shiftKey && lowerKey === "c"')
  })

  test("3. cloud asset markdown snippet escapes URLs with spaces/parentheses and editor binds Mod+F / Mod+H", () => {
    const snippet = buildCloudAssetMarkdownSnippet(
      {
        id: 1,
        ownerMemberId: 1,
        originalFilename: "diagram (final).png",
        mediaKind: "PHOTO",
        contentType: "image/png",
        byteSize: 1024,
        folderPath: "/",
        createdAt: "2026-11-09T00:00:00Z",
        modifiedAt: "2026-11-09T00:00:00Z",
      },
      "https://cdn.example.com/uploads/diagram (final).png"
    )
    expect(snippet).toBe(
      "![diagram (final).png](https://cdn.example.com/uploads/diagram%20%28final%29.png)"
    )

    const keyboardSource = readSrc(
      "components/markdown-editor/useMarkdownEditorTextareaKeyboard.ts"
    )
    expect(keyboardSource).toContain("onOpenFindReplace")
  })

  test("4. callout live surface promotes first-line **bold** or # heading title and respects foldable indicator", () => {
    const promotedBold = parseCalloutBlockquoteSpec("> [!NOTE]\n> **승격 제목**\n> 본문 내용")
    expect(promotedBold).toEqual({
      from: 0,
      to: 0,
      type: "NOTE",
      title: "승격 제목",
      foldState: null,
      content: "본문 내용",
    })

    const promotedHeading = parseCalloutBlockquoteSpec("> [!TIP]-\n> ## 접힘 제목\n> 둘째 줄")
    expect(promotedHeading).toEqual({
      from: 0,
      to: 0,
      type: "TIP",
      title: "접힘 제목",
      foldState: "-",
      content: "둘째 줄",
    })

    const origDoc = (globalThis as Record<string, unknown>).document
    try {
      const makeEl = (tag: string): Record<string, unknown> => {
        const children: Array<Record<string, unknown>> = []
        return {
          tagName: tag.toUpperCase(),
          className: "",
          textContent: "",
          children,
          dataset: {},
          style: { display: "", setProperty: () => {} },
          setAttribute: () => {},
          addEventListener: () => {},
          appendChild(child: Record<string, unknown>) {
            children.push(child)
            return child
          },
        }
      }
      ;(globalThis as Record<string, unknown>).document = {
        createElement: (tag: string) => makeEl(tag),
        createTextNode: (text: string) => ({ tagName: "#text", textContent: text }),
      }

      const nonFoldWidget = new MarkdownCalloutWidget("NOTE", "제목", "본문", 0, 10, null)
      const nonFoldDom = nonFoldWidget.toDOM() as unknown as {
        children: Array<{ className: string; children: Array<{ className: string }> }>
      }
      const nonFoldHeaderChildren = nonFoldDom.children[0]?.children ?? []
      expect(nonFoldHeaderChildren.some((c) => c.className === "cm-live-callout-fold")).toBe(false)

      const foldWidget = new MarkdownCalloutWidget("NOTE", "제목", "본문", 0, 10, "+")
      const foldDom = foldWidget.toDOM() as unknown as {
        children: Array<{ className: string; children: Array<{ className: string }> }>
      }
      const foldHeaderChildren = foldDom.children[0]?.children ?? []
      expect(foldHeaderChildren.some((c) => c.className === "cm-live-callout-fold")).toBe(true)
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }
  })

  test("5. useFeedExplorerSessionRestore flushes synchronously on routeChangeStart and guards debounce lag", () => {
    const restoreSource = readSrc("routes/Feed/useFeedExplorerSessionRestore.ts")
    expect(restoreSource).toContain('router.events.on("routeChangeStart", flushPersist)')
    expect(restoreSource).toContain('router.events.off("routeChangeStart", flushPersist)')
    expect(restoreSource).toContain(
      'restoreState.tag !== (currentTag || "") || restoreState.q !== normalizedQuery'
    )
  })

  test("6. focusTopicsRailElement falls back to visible .mobileTags when desktop #topics is hidden", () => {
    const origDoc = (globalThis as Record<string, unknown>).document
    try {
      let mobileScrolled = false
      let mobileFocused = false
      const mobileChip = {
        offsetParent: {},
        focus: () => {
          mobileFocused = true
        },
      }
      const mobileRail = {
        offsetParent: {},
        scrollIntoView: () => {
          mobileScrolled = true
        },
        querySelectorAll: () => [mobileChip],
        querySelector: () => mobileChip,
        focus: () => {},
      }
      const hiddenDesktopTopics = {
        offsetParent: null,
        scrollIntoView: () => {},
        querySelector: () => null,
        focus: () => {},
      }
      ;(globalThis as Record<string, unknown>).document = {
        getElementById: (id: string) => (id === "topics" ? hiddenDesktopTopics : null),
        querySelector: (selector: string) =>
          selector.includes("mobileTags") || selector.includes("data-topics-mobile")
            ? mobileRail
            : null,
      }
      expect(focusTopicsRailElement()).toBe(true)
      expect(mobileScrolled).toBe(true)
      expect(mobileFocused).toBe(true)
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }
  })

  test("7. MarkdownRendererSegments blocks empty href on embed/file and MarkdownRendererImage preserves original aspect ratio", () => {
    const badEmbedHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        renderMarkdownSegment({
          segment: {
            type: "embed",
            provider: "link",
            url: "javascript:alert(1)",
            title: "Bad Embed",
          },
          index: 0,
          imageIndex: 0,
          editableImages: false,
          renderMarkdown: () => null,
        })
      ) as ReactElement
    )
    expect(badEmbedHtml).not.toContain('href=""')
    expect(badEmbedHtml).not.toContain("javascript:")

    const badFileHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        renderMarkdownSegment({
          segment: {
            type: "file",
            url: "",
            name: "Empty File",
          },
          index: 1,
          imageIndex: 0,
          editableImages: false,
          renderMarkdown: () => null,
        })
      ) as ReactElement
    )
    expect(badFileHtml).not.toContain("<a")
    expect(badFileHtml).not.toContain('href=""')

    const imageSource = readSrc("libs/markdown/MarkdownRendererImage.tsx")
    expect(imageSource).toContain("widthPx && heightPx ? `${widthPx} / ${heightPx}` : undefined")
    expect(imageSource).toContain("pointercancel")
  })

  test("8 & 9. AdminDashboard chart title/counts and AdminCloud Escape/upload cleanup contracts", () => {
    const dashboardViewSource = readSrc("routes/Admin/AdminDashboardWorkspaceView.tsx")
    expect(dashboardViewSource).toContain("운영 지표 요약")
    expect(dashboardViewSource).not.toContain("Public read latency")

    const cloudPageSource = readSrc("routes/Admin/AdminCloudWorkspacePage.tsx")
    const cloudActionsSource = readSrc("routes/Admin/useAdminCloudWorkspaceActions.ts")
    expect(cloudPageSource).toContain("setEditingFileId(null)")
    expect(cloudActionsSource).toContain("uploadControllersRef")
  })

  test("10. GlobalErrorBoundary stored EN language fallback, EN detail/markdown labels, related/author policy, and profile image cache invalidation", async () => {
    await withWindowStorage(() => {
      setClientStoredLanguage("en")
      const globalErrorHtml = renderToStaticMarkup(
        materializePlaywrightJsx(
          createElement(
            ThemeProvider,
            {
              theme: lightTheme,
              children: createElement(ErrorFallbackView, {
                variant: "global",
                requestId: "req-123",
                onRetry: () => {},
              }),
            }
          )
        ) as ReactElement
      )
      expect(globalErrorHtml).toContain("Something went wrong")
      expect(globalErrorHtml).toContain("Request ID: req-123")
      expect(globalErrorHtml).toContain("Back to home")
    })

    const enDetailHtml = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(
          ThemeProvider,
          {
            theme: lightTheme,
            children: createElement(LanguageProvider, {
              initialLanguage: "en",
              children: createElement(
                "div",
                null,
                createElement(PostDetailMobileToc, {
                  items: [{ id: "intro", text: "Intro", level: 2 }],
                  activeTocId: "intro",
                  onNavigate: () => {},
                }),
                createElement(MobileSummaryActions, {
                  likesCount: 3,
                  liked: false,
                  likePending: false,
                  onToggleLike: () => {},
                  shareFeedback: null,
                  onSharePost: () => {},
                }),
                createElement(PostHeaderEngagementSection, {
                  publishedAt: "Oct 1, 2026",
                  viewText: "10 VIEWS",
                  showReadingTime: true,
                  readingMinutes: 4,
                  modifiedAt: "",
                  resolvedLikesCount: 3,
                  liked: false,
                  likePending: false,
                  onToggleLike: () => {},
                  hideShareActionOnDesktop: false,
                  hideActionButtonsOnMobile: false,
                  onSharePost: () => {},
                  shareFeedback: "copied",
                  shareFeedbackMessage: "복사 완료",
                }),
                createElement(PrettyCodeBlock, {
                  language: "ts",
                  rawCode: Array.from({ length: 40 }, (_, i) => `const x${i} = ${i}`).join("\n"),
                  preElement: createElement("pre", null, "code"),
                }),
                createElement(
                  MarkdownFootnoteReferenceLink,
                  {
                    href: "#fn-1",
                    title: "marker:fnref-1",
                    marker: "marker",
                    footnotes: [
                      {
                        identifier: "1",
                        number: 1,
                        content: "Footnote body",
                        targetId: "fn-1",
                        referenceIds: ["fnref-1"],
                      },
                    ],
                  },
                  "1"
                ),
                createElement(MarkdownFootnoteAppendix, {
                  footnotes: [
                    {
                      identifier: "1",
                      number: 1,
                      content: "Footnote body",
                      targetId: "fn-1",
                      referenceIds: ["fnref-1"],
                    },
                  ],
                  renderMarkdown: (md) => md,
                })
              ),
            }),
          }
        )
      ) as ReactElement
    )

    expect(enDetailHtml).toContain('aria-label="Collapsible table of contents"')
    expect(enDetailHtml).toContain('aria-label="Quick actions and reactions"')
    expect(enDetailHtml).toContain("Link copied")
    expect(enDetailHtml).toContain("Expand full code (40 lines)")
    expect(enDetailHtml).toContain('aria-label="Footnote 1 reference 1"')
    expect(enDetailHtml).toContain(">Footnotes</h2>")
    expect(resolveMobileShareAriaLabel(null, true)).toBe("Share")
    expect(resolveMobileShareButtonLabel(null, true)).toBe("Share")

    const clientSource = readSrc("apis/backend/client.ts")
    expect(clientSource).toContain("related\\/author")

    const profileModelSource = readSrc("routes/Admin/AdminProfileWorkspacePageModel.ts")
    expect(profileModelSource).toContain("invalidatePublicPostReadCaches")
  })
})
