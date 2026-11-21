import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import { expect, test } from "@playwright/test"
import { parseBlockContainerBlocks } from "../../src/components/markdown-editor/markdownEditorBlockContainerModel"
import {
  MarkdownBookmarkBlockWidget,
  MarkdownEmbedBlockWidget,
  MarkdownFileBlockWidget,
} from "../../src/components/markdown-editor/markdownEditorBlockWidgets"
import { MarkdownEditorFindReplace } from "../../src/components/markdown-editor/MarkdownEditorFindReplace"
import { MarkdownEditorReadingPreview } from "../../src/components/markdown-editor/MarkdownEditorReadingPreview"
import { MarkdownEditorToolbar } from "../../src/components/markdown-editor/MarkdownEditorToolbar"
import RootLayout from "../../src/layouts/RootLayout"
import { LanguageProvider } from "../../src/libs/language"
import * as postDetailPage from "../../src/libs/server/postDetailPage"
import { EditorStudioDedicatedEditorSurface } from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import { EditorStudioFeatureImageBar } from "../../src/routes/Admin/EditorStudioFeatureImageBar"
import { EditorStudioGuideModal } from "../../src/routes/Admin/EditorStudioGuideModal"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import { EditorStudioRevisionDiffPanel } from "../../src/routes/Admin/EditorStudioRevisionDiffPanel"
import { EditorStudioRevisionHistoryCard } from "../../src/routes/Admin/EditorStudioRevisionHistoryCard"
import {
  computePostRevisionDiff,
  MAX_DIFF_LINES,
  MAX_INPUT_CHARS,
} from "../../src/routes/Admin/postRevisionDiffModel"
import { adminT } from "../../src/routes/Admin/adminI18n"
import type { LocalDraftPayload } from "../../src/routes/Admin/editorStudioMetaModel"
import {
  clearAllLocalDrafts,
  listLocalDraftCandidates,
  persistCatalog,
  persistLocalDraft,
  readLocalDraft,
  readStoredCatalog,
  removeLocalDraft,
  removeLocalDraftCandidate,
  TAG_CATALOG_STORAGE_KEY,
} from "../../src/routes/Admin/editorStudioStorageModel"
import { createTheme } from "../../src/styles/theme"
import { withWindowStorage } from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import { withMockDom } from "./helpers/simpleMockDom"

const lightTheme = createTheme({ scheme: "light" })

const readSrc = (relPath: string) =>
  readFileSync(path.resolve(__dirname, "../../src", relPath), "utf8")

const renderStaticNode = (node: ReactElement) =>
  renderToStaticMarkup(materializePlaywrightJsx(node) as ReactElement)

const createMockRouter = (pathname: string) => ({
  pathname,
  route: pathname,
  query: {},
  asPath: pathname,
  basePath: "",
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  isFallback: false,
  events: { on: () => {}, off: () => {}, emit: () => {} },
  beforePopState: () => {},
  reload: () => {},
  back: () => {},
  forward: () => {},
  push: async () => true,
  replace: async () => true,
  prefetch: async () => {},
})

const makeDraftPayload = (postId: string | null): LocalDraftPayload => ({
  source: postId ? { kind: "post", postId } : { kind: "create" },
  title: `Draft ${postId ?? "create"}`,
  content: "Body text",
  summary: "Summary",
  summarySource: "MANUAL",
  summaryIntent: { kind: "manual", summary: "Summary" },
  thumbnailUrl: "",
  thumbnailFocusX: 50,
  thumbnailFocusY: 50,
  thumbnailZoom: 1,
  category: "Tech",
  tags: ["ts"],
  visibility: "PUBLIC_LISTED",
  savedAt: new Date().toISOString(),
})

test.describe("Web UX parity, accessibility, security & diff audit", () => {
  test("1a. toSerializableState replaces JSON double pass with single-pass undefined->null conversion and keeps private no-store", () => {
    const toSerializableState = (
      postDetailPage as Record<string, unknown>
    ).toSerializableState as ((value: unknown) => unknown) | undefined
    expect(typeof toSerializableState).toBe("function")

    const sharedMeta = { slug: "shared-post", published: true }
    const input = {
      title: "Post",
      missing: undefined,
      count: 42,
      badNum: Number.NaN,
      infNum: Number.POSITIVE_INFINITY,
      publishedAt: new Date("2026-11-20T00:00:00.000Z"),
      nested: {
        emptyProp: undefined,
        items: [1, undefined, "ok", { inside: undefined }],
        sharedA: sharedMeta,
        sharedB: sharedMeta,
      },
      fn: () => "ignored",
      withToJson: {
        toJSON: () => ({ serialized: true, omitted: undefined }),
      },
    }

    const expectedByJson = JSON.parse(
      JSON.stringify(input, (_key, currentValue) =>
        currentValue === undefined ? null : currentValue
      )
    )
    expect(toSerializableState!(input)).toEqual(expectedByJson)

    const circular: Record<string, unknown> = { name: "root" }
    circular.self = circular
    expect(() => toSerializableState!(circular)).not.toThrow()
    expect(toSerializableState!(circular)).toEqual({ name: "root", self: null })

    const source = readSrc("libs/server/postDetailPage.ts")
    expect(source).toContain('res.setHeader("Cache-Control", "private, no-store")')
    expect(source).not.toContain("JSON.parse(JSON.stringify(")
  })

  test("1b. editorStudioStorageModel fails safely when window.localStorage throws SecurityError while preserving QuotaExceededError", async () => {
    const prevWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
    const throwingWindow = {
      localStorage: undefined,
    }
    Object.defineProperty(throwingWindow, "localStorage", {
      configurable: true,
      enumerable: true,
      get() {
        throw new DOMException("Storage access denied", "SecurityError")
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: throwingWindow,
    })

    try {
      expect(() => readLocalDraft({ kind: "post", postId: "1" })).not.toThrow()
      expect(readLocalDraft({ kind: "post", postId: "1" })).toBeNull()
      expect(() => persistLocalDraft(makeDraftPayload("99"))).toThrow(/SecurityError|Storage access denied/i)
      expect(() => listLocalDraftCandidates({ kind: "create" })).toThrow(/SecurityError|Storage access denied/i)
      expect(() => removeLocalDraft({ kind: "post", postId: "1" })).toThrow(/SecurityError|Storage access denied/i)
      expect(() => removeLocalDraftCandidate({ kind: "create" }, "k")).toThrow(/SecurityError|Storage access denied/i)
      expect(() => readStoredCatalog(TAG_CATALOG_STORAGE_KEY)).not.toThrow()
      expect(readStoredCatalog(TAG_CATALOG_STORAGE_KEY)).toEqual([])
      expect(() => persistCatalog(TAG_CATALOG_STORAGE_KEY, ["ts"])).not.toThrow()
      expect(() => clearAllLocalDrafts()).not.toThrow()
    } finally {
      if (prevWindowDescriptor) {
        Object.defineProperty(globalThis, "window", prevWindowDescriptor)
      } else {
        delete (globalThis as Record<string, unknown>).window
      }
    }

    await withWindowStorage(async () => {
      for (let i = 1; i <= 20; i += 1) {
        persistLocalDraft(makeDraftPayload(String(i)))
      }
      expect(() => persistLocalDraft(makeDraftPayload("21"))).toThrow(
        /QuotaExceededError|full/i
      )
    })
  })

  test("2a. RootLayout renders single accessible skip-to-main-content link in ko/en and single main landmark", () => {
    const renderLayout = (pathname: string, language: "ko" | "en") => {
      const queryClient = new QueryClient()
      return renderStaticNode(
        createElement(RouterContext.Provider, {
          value: createMockRouter(pathname) as unknown as React.ContextType<typeof RouterContext>,
          children: createElement(QueryClientProvider, {
            client: queryClient,
            children: createElement(
              RootLayout,
              {
                initialLanguage: language,
                initialAdminProfile: null,
                initialAdminProfileShouldRefetch: false,
                children:
                  pathname === "/company"
                    ? createElement("main", null, "Company body")
                    : createElement("article", null, "Post body"),
              },
            ),
          }),
        })
      )
    }

    const koHtml = renderLayout("/", "ko")
    expect(koHtml).toContain('href="#main-content"')
    expect(koHtml).toContain("본문으로 건너뛰기")
    expect(koHtml.match(/id="main-content"/g)?.length ?? 0).toBe(1)
    expect(koHtml.match(/<main\b/g)?.length ?? 0).toBe(1)

    const enHtml = renderLayout("/", "en")
    expect(enHtml).toContain('href="#main-content"')
    expect(enHtml).toContain("Skip to main content")
    expect(enHtml.match(/id="main-content"/g)?.length ?? 0).toBe(1)

    const companyHtml = renderLayout("/company", "en")
    expect(companyHtml).toContain('href="#main-content"')
    expect(companyHtml.match(/id="main-content"/g)?.length ?? 0).toBe(1)
    expect(companyHtml.match(/<main\b/g)?.length ?? 0).toBe(1)
  })

  test("2b. readability width 744px/46.5rem parity, contrast, focus indicator, 44px touch targets & <600 line budget", () => {
    const globalSrc = readSrc("layouts/RootLayout/ThemeProvider/Global/index.tsx")
    const editorialStylesSrc = readSrc("routes/Admin/EditorStudioEditorialStyles.ts")
    const panelPartsSrc = readSrc("routes/Admin/EditorStudioDedicatedPanelParts.tsx")
    const readingPreviewSrc = readSrc("components/markdown-editor/MarkdownEditorReadingPreview.tsx")
    const editorStylesSrc = readSrc("components/markdown-editor/MarkdownEditor.styles.ts")
    const liveCommandsSrc = readSrc("components/markdown-editor/markdownEditorLiveSurfaceCommands.ts")
    const adminColorSrc = readSrc("routes/Admin/adminColorTokens.ts")
    const editorPartsSrc = readSrc("routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx")
    const editorSrc = readSrc("components/markdown-editor/MarkdownEditor.tsx")

    expect(globalSrc).toContain("--article-readable-width: 46.5rem;")
    expect(editorialStylesSrc).toContain("max-width: 744px;")
    expect(panelPartsSrc).toContain("46.5rem")
    expect(readingPreviewSrc).toContain("max-width: 744px;")

    expect(editorStylesSrc).toContain("max-width: 744px;")
    expect(editorStylesSrc).toContain("box-sizing: content-box;")
    expect(editorStylesSrc).toContain("max-width: 856px;")
    expect(editorStylesSrc).not.toContain("opacity: 0.65;")
    expect(editorStylesSrc).toContain("var(--aq-empty-doc-placeholder)")
    expect(liveCommandsSrc).toContain('maxWidth: "744px"')
    expect(liveCommandsSrc).toContain('boxSizing: "content-box"')

    expect(adminColorSrc).toContain("--admin-text-muted: #52525b;")
    expect(editorPartsSrc).toContain("&:focus-visible")
    expect(editorPartsSrc).not.toContain("font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 800;")
    expect(editorPartsSrc).toMatch(/MobilePropertiesToggle[\s\S]*min-height:\s*44px;/)
    expect(editorialStylesSrc).toMatch(/InlineMetaInput[\s\S]*min-height:\s*44px;/)

    const editorLineCount = editorSrc.split("\n").length
    expect(editorLineCount).toBeLessThanOrEqual(550)
  })

  test("2c. English editor UI mode emits zero Korean Hangul leakage", () => {
    const renderEn = (node: ReactElement) =>
      renderStaticNode(
        createElement(LanguageProvider, {
          initialLanguage: "en",
          children: createElement(ThemeProvider, {
            theme: lightTheme,
            children: node,
          }),
        })
      )

    const previewHtml = renderEn(
      createElement(MarkdownEditorReadingPreview, { value: "# Hello", disableMermaid: true })
    )
    expect(previewHtml).toContain("Loading preview")
    expect(previewHtml).not.toMatch(/[가-힣]/)

    const findReplaceHtml = renderEn(
      createElement(MarkdownEditorFindReplace, {
        query: "a",
        replacement: "b",
        caseSensitive: false,
        scopeLabel: "Document",
        currentMatch: 1,
        totalMatches: 2,
        onQueryChange: () => {},
        onReplacementChange: () => {},
        onCaseSensitiveChange: () => {},
        onPrevious: () => {},
        onNext: () => {},
        onReplaceCurrent: () => {},
        onReplaceAll: () => {},
        onClose: () => {},
      })
    )
    expect(findReplaceHtml).not.toMatch(/[가-힣]/)

    const toolbarHtml = renderEn(
      createElement(MarkdownEditorToolbar, {
        disabled: false,
        disableMermaid: true,
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
        onApplyLineCommand: () => {},
        onApplyBlockSnippet: () => {},
        onInsertTable: () => {},
        onApplyTableEdit: () => {},
        isTableEditDisabled: () => false,
        onOpenFindReplace: () => {},
        onImageFileSelect: () => {},
        onAttachmentFileSelect: () => {},
        onViewModeChange: () => {},
      })
    )
    expect(toolbarHtml).toContain('aria-label="Markdown authoring tools"')
    expect(toolbarHtml).not.toMatch(/[가-힣]/)

    const readinessHtml = renderEn(
      createElement(EditorStudioPublishReadinessCard, {
        hasTitle: true,
        wordCount: 120,
        hasBody: true,
        hasManualSummary: true,
        tagCount: 2,
        linkWarningCount: 0,
        totalLinkCount: 1,
      })
    )
    expect(readinessHtml).not.toMatch(/[가-힣]/)

    const featureImgHtml = renderEn(
      createElement(EditorStudioFeatureImageBar, {
        postThumbnailUrl: "",
        safePreviewThumbnail: "",
        onOpenThumbnailFileInput: () => {},
        onResetThumbnailToAutoMode: () => {},
      })
    )
    expect(featureImgHtml).not.toMatch(/[가-힣]/)

    const guideHtml = renderEn(
      createElement(EditorStudioGuideModal, {
        onClose: () => {},
      })
    )
    expect(guideHtml).not.toMatch(/[가-힣]/)

    const revisionHtmlEn = renderEn(
      createElement(EditorStudioRevisionHistoryCard, {
        postId: 12,
        initialOpen: true,
        initialRevisions: [
          {
            id: 501,
            postId: 12,
            title: "Initial Revision",
            summaryText: "summary",
            contentLength: 42,
            createdAt: "2026-11-20T09:00:00Z",
          },
        ],
        initialSnapshots: {
          501: {
            id: 501,
            postId: 12,
            title: "Initial Revision",
            content: "Old content line",
          },
        },
        currentTitle: "Updated Title",
        currentTags: ["ts"],
        currentContent: "New content line",
      })
    )
    expect(revisionHtmlEn).toContain("Compare diff")
    expect(revisionHtmlEn).not.toMatch(/[가-힣]/)

    const surfaceHtmlEn = renderEn(
      createElement(EditorStudioDedicatedEditorSurface, {
        defaultPanelUiMask: 2,
        thumbnailImageFileInputRef: { current: null },
        onThumbnailImageFileChange: () => {},
        onExit: () => {},
        saveStateText: "Saved",
        saveStateTone: "success",
        primaryActionDisabled: false,
        primaryActionLabel: "Publish",
        onPrimaryAction: () => {},
        postTags: ["react"],
        tagDraft: "",
        onTagDraftChange: () => {},
        onAddTags: () => {},
        onAddTag: () => {},
        onRemoveTag: () => {},
        titleInputRef: () => {},
        onOutlineBodyHeadingActivate: () => {},
        postTitle: "English Post",
        onPostTitleChange: () => {},
        onPostTitleKeyDown: () => {},
        postContent: "# Section 1\n\nBody copy",
        postSummary: "Summary text",
        onPostSummaryChange: () => {},
        postCategory: "Tech",
        onPostCategoryChange: () => {},
        onCommitPostCategory: () => {},
        categorySuggestions: ["Tech"],
        postVisibility: "PUBLIC_LISTED",
        onPostVisibilityChange: () => {},
        editorCanvas: createElement("div", null, "Canvas"),
        showPublishNotice: false,
        publishNoticeTone: "idle",
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
      })
    )
    expect(surfaceHtmlEn).toContain("Enter post title")
    expect(surfaceHtmlEn).not.toMatch(/[가-힣]/)

    expect(adminT("editorBodyPlaceholder", "en")).not.toMatch(/[가-힣]/)
    expect(adminT("editorTitlePlaceholder", "en")).not.toMatch(/[가-힣]/)
    expect(adminT("editorRevisionCompare", "en")).toBe("Compare diff")
  })

  test("3a. CM6 live block containers parse aq-bookmark/aq-embed/aq-file metadata comments (fail-closed) & <aside> callouts", () => {
    const doc = [
      ":::bookmark",
      '<!-- aq-bookmark: {"url":"https://docs.example.com/guide","title":"Guide Docs","description":"Official setup guide","siteName":"Example Docs"} -->',
      "https://docs.example.com/guide",
      ":::",
      "",
      ":::embed",
      '<!-- aq-embed: {"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"Architecture Talk","caption":"System deep dive","provider":"YouTube"} -->',
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ":::",
      "",
      ":::file",
      '<!-- aq-file: {"url":"/uploads/spec.pdf","name":"spec.pdf","description":"API spec PDF","mimeType":"application/pdf","sizeBytes":2097152} -->',
      "/uploads/spec.pdf",
      ":::",
      "",
      "<aside>",
      "💡 Aside Note",
      "Callout body line.",
      "</aside>",
    ].join("\n")

    const blocks = parseBlockContainerBlocks(doc)
    expect(blocks).toHaveLength(4)

    const bookmark = blocks[0]
    expect(bookmark.kind).toBe("bookmark")
    if (bookmark.kind === "bookmark") {
      expect(bookmark.url).toBe("https://docs.example.com/guide")
      expect(bookmark.title).toBe("Guide Docs")
      expect(bookmark.description).toBe("Official setup guide")
      expect(bookmark.siteName).toBe("Example Docs")
    }

    const embed = blocks[1]
    expect(embed.kind).toBe("embed")
    if (embed.kind === "embed") {
      expect(embed.provider).toBe("YouTube")
      expect(embed.caption).toBe("System deep dive")
    }

    const file = blocks[2]
    expect(file.kind).toBe("file")
    if (file.kind === "file") {
      expect(file.name).toBe("spec.pdf")
      expect(file.mimeType).toBe("application/pdf")
      expect(file.sizeBytes).toBe(2097152)
    }

    const asideCallout = blocks[3]
    expect(asideCallout.kind).toBe("callout")
    if (asideCallout.kind === "callout") {
      expect(asideCallout.title).toContain("Aside Note")
      expect(asideCallout.body).toContain("Callout body line.")
    }

    const oversizedJson = JSON.stringify({
      title: "x".repeat(5000),
      description: "should fail closed",
    })
    const maliciousDoc = [
      ":::bookmark",
      `<!-- aq-bookmark: ${oversizedJson} -->`,
      "<!-- aq-bookmark: {\"__proto__\":{\"polluted\":true}} -->",
      "https://safe.example.com",
      ":::",
    ].join("\n")
    const maliciousBlocks = parseBlockContainerBlocks(maliciousDoc)
    expect(maliciousBlocks).toHaveLength(1)
    if (maliciousBlocks[0]?.kind === "bookmark") {
      expect(maliciousBlocks[0].description).toBe("")
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    }

    withMockDom(() => {
      const bmDom = new MarkdownBookmarkBlockWidget(
        "https://docs.example.com/guide",
        "Guide Docs",
        "Official setup guide",
        0,
        10,
        "Example Docs"
      ).toDOM()
      expect(bmDom.textContent).toContain("Example Docs")
      expect(bmDom.textContent).toContain("Official setup guide")

      const embedDom = new MarkdownEmbedBlockWidget(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "Architecture Talk",
        "System deep dive",
        0,
        10,
        "YouTube"
      ).toDOM()
      expect(embedDom.textContent).toContain("YouTube")

      const fileDom = new MarkdownFileBlockWidget(
        "/uploads/spec.pdf",
        "spec.pdf",
        "API spec PDF",
        0,
        10,
        "application/pdf",
        2097152
      ).toDOM()
      expect(fileDom.textContent).toContain("application/pdf")
      expect(fileDom.textContent).toContain("2.0 MB")
    })
  })

  test("3b. postRevisionDiffModel computes bounded line diff with fail-closed limits and EditorStudioRevisionHistoryCard toggles diff view", () => {
    expect(MAX_DIFF_LINES).toBe(800)
    expect(MAX_INPUT_CHARS).toBe(200_000)

    const identical = computePostRevisionDiff({
      revisionTitle: "Same Title",
      revisionContent: '---\ntags: ["ts"]\n---\n\nline 1\nline 2',
      currentTitle: "Same Title",
      currentTags: ["ts"],
      currentContent: "line 1\nline 2",
    })
    expect(identical.truncated).toBe(false)
    expect(identical.hasChanges).toBe(false)
    expect(identical.addedLines).toBe(0)
    expect(identical.removedLines).toBe(0)

    const changed = computePostRevisionDiff({
      revisionTitle: "Old Title",
      revisionContent: '---\ntags: ["old", "ts"]\n---\n\nalpha\nbeta\ngamma',
      currentTitle: "New Title",
      currentTags: ["ts", "react"],
      currentContent: "alpha\nbeta-updated\ngamma\ndelta",
    })
    expect(changed.truncated).toBe(false)
    expect(changed.hasChanges).toBe(true)
    expect(changed.changedTitle).toBe(true)
    expect(changed.addedTags).toEqual(["react"])
    expect(changed.removedTags).toEqual(["old"])
    expect(changed.removedLines).toBe(1)
    expect(changed.addedLines).toBe(2)

    const tooManyLines = Array.from({ length: 805 }, (_, i) => `line-${i}`).join("\n")
    const overLineBudget = computePostRevisionDiff({
      revisionTitle: "A",
      revisionContent: tooManyLines,
      currentTitle: "A",
      currentTags: [],
      currentContent: "single line",
    })
    expect(overLineBudget.truncated).toBe(true)
    expect(overLineBudget.hasChanges).toBe(true)

    const overCharBudget = computePostRevisionDiff({
      revisionTitle: "A",
      revisionContent: "a".repeat(200_005),
      currentTitle: "A",
      currentTags: [],
      currentContent: "b",
    })
    expect(overCharBudget.truncated).toBe(true)

    const diffPanelHtml = renderStaticNode(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(EditorStudioRevisionDiffPanel, {
          language: "ko",
          revisionTitle: "Old Title",
          currentTitle: "New Title",
          isLoading: false,
          errorText: "",
          diff: changed,
        }),
      })
    )
    expect(diffPanelHtml).toContain("beta-updated")
    expect(diffPanelHtml).toContain("+2")
    expect(diffPanelHtml).toContain("-1")
    expect(diffPanelHtml).toContain('data-diff-kind="added"')
    expect(diffPanelHtml).toContain('data-diff-kind="removed"')

    const cardHtml = renderStaticNode(
      createElement(LanguageProvider, {
        initialLanguage: "ko",
        children: createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(EditorStudioRevisionHistoryCard, {
            postId: 12,
            initialOpen: true,
            initialRevisions: [
              {
                id: 501,
                postId: 12,
                title: "Snapshot 1",
                summaryText: "summary",
                contentLength: 42,
                createdAt: "2026-11-20T09:00:00Z",
              },
            ],
            initialSnapshots: {
              501: {
                id: 501,
                postId: 12,
                title: "Snapshot 1",
                content: "Snapshot line",
              },
            },
            currentTitle: "Current 1",
            currentTags: ["ts"],
            currentContent: "Current body",
          }),
        }),
      })
    )
    expect(cardHtml).toContain("현재 글과 비교")

    const failClosedHtml = renderStaticNode(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(EditorStudioRevisionDiffPanel, {
          language: "en",
          revisionTitle: "Snapshot 1",
          currentTitle: "Current 1",
          isLoading: false,
          errorText: adminT("editorRevisionLoadError", "en"),
          diff: null,
        }),
      })
    )
    expect(failClosedHtml).toContain("Failed to load revision snapshot content.")
    expect(failClosedHtml).toContain('role="alert"')
  })
})
