import { act, createElement, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import {
  editorT,
} from "../../src/components/markdown-editor/markdownEditorI18n"
import { parseMarkdownLinkSelection } from "../../src/components/markdown-editor/MarkdownEditorBubbleLinkPopover"
import {
  planMarkdownEditorLineCommand,
  planMoveBlockToOffset,
  resolveContainerAwareBlockRange,
} from "../../src/components/markdown-editor/markdownEditorLineCommandsModel"
import {
  buildBlockDragMovePlan,
  hasCrossedBlockDragThreshold,
} from "../../src/components/markdown-editor/markdownEditorBlockDragHelper"
import {
  detectClientModShortcutLabel,
  modShortcutLabel,
} from "../../src/components/markdown-editor/markdownEditorToolbarModel"
import {
  buildEditorStateFingerprint,
  buildLocalDraftFingerprint,
  CANONICAL_URL_MAX_LENGTH,
  computeContentFingerprint,
  dedupeStrings,
  detectPublishPlaceholderIssue,
  normalizeSafeCanonicalUrl,
  POST_CONTENT_MAX_LENGTH,
} from "../../src/routes/Admin/editorStudioMetaModel"
import { normalizeCategoryValue } from "../../src/libs/utils"
import { scanMarkdownPrePublishWarnings } from "../../src/routes/Admin/editorStudioPublishWarnings"
import { EditorStudioInspectorPublishingFields } from "../../src/routes/Admin/EditorStudioInspectorPublishingFields"
import { EditorStudioPublishMetadataSection } from "../../src/routes/Admin/EditorStudioPublishMetadataSection"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import { EditorStudioThumbnailEditorPanel } from "../../src/routes/Admin/EditorStudioThumbnailPanels"
import { toVisibility } from "../../src/routes/Admin/editorStudioState"
import {
  getLocalDraftDocumentId,
  localDraftStorageKeyForDocument,
  persistLocalDraft,
  readLocalDraft,
  removeLocalDraft,
} from "../../src/routes/Admin/editorStudioStorageModel"
import { useEditorStudioLocalDraftLifecycle } from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { useEditorStudioKeyboardShortcuts } from "../../src/routes/Admin/useEditorStudioKeyboardShortcuts"
import {
  executeServerTempDraftSave,
  validateEditorContentPreflight,
} from "../../src/routes/Admin/useEditorStudioPersistenceHelpers"
import {
  fromLocalDateTimeInputValue,
  isScheduleTimestampValid,
  toLocalDateTimeInputValue,
} from "../../src/routes/Admin/useEditorStudioPublishingMetadata"
import { buildPostDetailMetadata, normalizeExternalCanonicalUrl } from "../../src/routes/Detail/PostDetail/postDetailMetadataModel"
import { PostDetailSeriesCard } from "../../src/routes/Detail/PostDetail/PostDetailSeriesCard"
import { createMinimalRootContainer, withWindowStorage } from "./helpers/editorStudioTestHarness"
import { materializePlaywrightJsx, wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"
import type { TPost } from "../../src/types"

const ClientLanguageProvider = wrapPlaywrightJsxComponent(LanguageProvider) as typeof LanguageProvider
const ClientThemeProvider = wrapPlaywrightJsxComponent(ThemeProvider) as typeof ThemeProvider
const ClientPublishMetadataSection = wrapPlaywrightJsxComponent(
  EditorStudioPublishMetadataSection
) as typeof EditorStudioPublishMetadataSection
const ClientInspectorPublishingFields = wrapPlaywrightJsxComponent(
  EditorStudioInspectorPublishingFields
) as typeof EditorStudioInspectorPublishingFields

const lightTheme = createTheme({ scheme: "light" })

const withClientDom = async (run: (ctx: { storage: Storage; rootContainer: Element }) => Promise<void>) =>
  withWindowStorage(async (storage) => {
    const createEl = (tag: string): Record<string, any> => {
      const attrs = new Map<string, string>()
      const childNodes: any[] = []
      const el: Record<string, any> = {
        nodeType: 1,
        tagName: tag.toUpperCase(),
        nodeName: tag.toUpperCase(),
        namespaceURI: "http://www.w3.org/1999/xhtml",
        parentElement: null,
        parentNode: null,
        childNodes,
        children: childNodes,
        get firstChild() {
          return childNodes[0] ?? null
        },
        style: { setProperty: () => undefined, removeProperty: () => undefined },
        textContent: "",
        value: "",
        setAttribute: (k: string, v: string) => attrs.set(k, String(v)),
        getAttribute: (k: string) => attrs.get(k) ?? null,
        hasAttribute: (k: string) => attrs.has(k),
        removeAttribute: (k: string) => attrs.delete(k),
        appendChild: (c: Record<string, any>) => {
          c.parentNode = el
          c.parentElement = el
          childNodes.push(c)
          return c
        },
        insertBefore: (n: Record<string, any>) => {
          n.parentNode = el
          n.parentElement = el
          childNodes.push(n)
          return n
        },
        removeChild: (c: Record<string, any>) => {
          const i = childNodes.indexOf(c)
          if (i >= 0) childNodes.splice(i, 1)
          return c
        },
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        querySelectorAll: () => [],
      }
      return el
    }
    const head = createEl("head")
    const body = createEl("body")
    const doc: Record<string, any> = {
      nodeType: 9,
      head,
      body,
      documentElement: { lang: "" },
      activeElement: null,
      createElement: (tag: string) => Object.assign(createEl(tag), { ownerDocument: doc }),
      createTextNode: (data: string) => ({ nodeType: 3, nodeValue: String(data), textContent: String(data), ownerDocument: doc }),
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    head.ownerDocument = doc
    body.ownerDocument = doc
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: doc })
    ;(globalThis.window as unknown as Record<string, unknown>).document = doc
    try {
      const rootContainer = Object.assign(createMinimalRootContainer(), { ownerDocument: doc }) as unknown as Element
      await run({ storage, rootContainer })
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
    }
  })

const renderThemed = (node: unknown, initialLanguage: "ko" | "en" = "ko"): string =>
  renderToStaticMarkup(
    createElement(ThemeProvider, {
      theme: lightTheme,
      children: materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage,
          children: node as ReactElement,
        })
      ) as ReactElement,
    })
  )

test.describe("Editor Phase 3 features & edge cases", () => {
  test("container-aware block resolution & movement keep code fences, directives, and pipe tables atomic", () => {
    const doc = [
      "First line",
      "```ts",
      "const a = 1",
      "const b = 2",
      "```",
      ":::callout info \"Note\"",
      "Inside callout",
      "```sh",
      "echo inner",
      "```",
      ":::",
      "| H1 | H2 |",
      "| --- | --- |",
      "| C1 | C2 |",
      "Last line",
    ].join("\n")

    const insideFence = doc.indexOf("const b = 2")
    const fenceRange = resolveContainerAwareBlockRange(doc, insideFence, insideFence)
    expect(fenceRange).not.toBeNull()
    expect(doc.slice(fenceRange!.blockStart, fenceRange!.blockEnd)).toBe("```ts\nconst a = 1\nconst b = 2\n```")

    const insideCallout = doc.indexOf("echo inner")
    const calloutRange = resolveContainerAwareBlockRange(doc, insideCallout, insideCallout)
    expect(calloutRange).not.toBeNull()
    expect(doc.slice(calloutRange!.blockStart, calloutRange!.blockEnd)).toContain(':::callout info "Note"')
    expect(doc.slice(calloutRange!.blockStart, calloutRange!.blockEnd)).toContain(":::")

    const insideTable = doc.indexOf("C1")
    const tableRange = resolveContainerAwareBlockRange(doc, insideTable, insideTable)
    expect(tableRange).not.toBeNull()
    expect(doc.slice(tableRange!.blockStart, tableRange!.blockEnd)).toBe("| H1 | H2 |\n| --- | --- |\n| C1 | C2 |")

    // Move entire table down past "Last line"
    const moveDown = planMarkdownEditorLineCommand(doc, insideTable, insideTable, "move-down")
    expect(moveDown).not.toBeNull()
    const movedDoc =
      doc.slice(0, moveDown!.rangeStart) + moveDown!.replacement + doc.slice(moveDown!.rangeEnd)
    expect(movedDoc.endsWith("| H1 | H2 |\n| --- | --- |\n| C1 | C2 |")).toBe(true)

    // Drag table before "First line"
    const dragPlan = buildBlockDragMovePlan(doc, insideTable, {
      targetOffset: 0,
      placeAfter: false,
      indicatorTop: 4,
    })
    expect(dragPlan).not.toBeNull()
    const draggedDoc =
      doc.slice(0, dragPlan!.rangeStart) + dragPlan!.replacement + doc.slice(dragPlan!.rangeEnd)
    expect(draggedDoc.startsWith("| H1 | H2 |\n| --- | --- |\n| C1 | C2 |\nFirst line")).toBe(true)

    // Self-drop and threshold guards
    expect(planMoveBlockToOffset(doc, insideTable, doc.indexOf("H2"), false)).toBeNull()
    expect(hasCrossedBlockDragThreshold(100, 103)).toBe(false)
    expect(hasCrossedBlockDragThreshold(100, 105)).toBe(true)
    expect(resolveContainerAwareBlockRange(doc, -1, 0)).toBeNull()
  })

  test("16-entry LRU fingerprint cache handles interleaved documents & tracks Phase 3 metadata", () => {
    const samples = Array.from({ length: 20 }, (_, i) => `Document body #${i} ${"x".repeat(i + 1)}`)
    const digests = samples.map((s) => computeContentFingerprint(s))
    // Re-hashing any item (evicted or retained) must always produce deterministic identical FNV-1a digest
    samples.forEach((s, i) => {
      expect(computeContentFingerprint(s)).toBe(digests[i])
    })

    const basePayload = {
      title: "Title",
      content: "Body",
      summary: "",
      summarySource: "NONE" as const,
      summaryIntent: { kind: "auto" as const },
      thumbnailUrl: "",
      thumbnailFocusX: 50,
      thumbnailFocusY: 50,
      thumbnailZoom: 1,
      tags: ["ts"],
      category: "dev",
      visibility: "PUBLIC_LISTED" as const,
      scheduledAt: "",
      seriesName: "",
      seriesOrder: null,
      canonicalUrl: "",
    }
    const fp1 = buildEditorStateFingerprint(basePayload)
    const fp2 = buildEditorStateFingerprint({ ...basePayload, seriesName: "Compiler", seriesOrder: 1 })
    const fp3 = buildEditorStateFingerprint({ ...basePayload, canonicalUrl: "https://origin.example.com/1" })
    expect(fp2).not.toBe(fp1)
    expect(fp3).not.toBe(fp1)
    expect(fp3).not.toBe(fp2)
  })

  test("content max length, canonical URL, series order, and schedule validators fail closed", () => {
    expect(POST_CONTENT_MAX_LENGTH).toBe(500_000)
    expect(normalizeSafeCanonicalUrl("https://origin.example.com/posts/1?ref=blog")).toBe(
      "https://origin.example.com/posts/1?ref=blog"
    )
    expect(normalizeSafeCanonicalUrl("https://example.com/@author/post")).toBe("https://example.com/@author/post")
    expect(normalizeSafeCanonicalUrl("https://example.com/post?ref=@author#@top")).toBe(
      "https://example.com/post?ref=@author#@top"
    )
    expect(normalizeSafeCanonicalUrl("javascript:alert(1)")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://user:pass@origin.example.com/p")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://@example.com/post")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://:@example.com/post")).toBe("")
    expect(normalizeSafeCanonicalUrl("https:example.com/post")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://evil.com\\@example.com/post")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://origin.example.com/\nline")).toBe("")
    expect(normalizeSafeCanonicalUrl(`https://origin.example.com/${"a".repeat(CANONICAL_URL_MAX_LENGTH)}`)).toBe("")

    const futureIso = new Date(Date.now() + 3_600_000).toISOString()
    const pastIso = new Date(Date.now() - 120_000).toISOString()
    expect(isScheduleTimestampValid(futureIso)).toBe(true)
    expect(isScheduleTimestampValid(pastIso)).toBe(false)
    expect(isScheduleTimestampValid("not-a-date")).toBe(false)
    const localInput = toLocalDateTimeInputValue(futureIso)
    expect(localInput).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(Date.parse(fromLocalDateTimeInputValue(localInput))).toBeGreaterThan(0)

    expect(toVisibility(false, true, futureIso)).toBe("PUBLIC_LISTED")
    expect(toVisibility(false, false, futureIso)).toBe("PUBLIC_UNLISTED")
    expect(toVisibility(false, true, null)).toBe("PRIVATE")

    const preflightCommon = {
      postTitle: "Valid title",
      currentPostContent: "Valid body",
      postThumbnailUrl: "",
      postCanonicalUrl: "",
      postSeriesOrder: null,
      postScheduledAt: "",
      postVisibility: "PUBLIC_LISTED" as const,
      language: "en" as const,
      normalizeSafeImageUrl: () => "",
      detectPublishPlaceholderIssue: () => "",
    }
    expect(validateEditorContentPreflight(preflightCommon)).toBeNull()
    expect(
      validateEditorContentPreflight({ ...preflightCommon, currentPostContent: "a".repeat(POST_CONTENT_MAX_LENGTH + 1) })
    ).toContain("500,000")
    expect(
      validateEditorContentPreflight({ ...preflightCommon, postCanonicalUrl: "javascript:alert(1)" })
    ).toContain("http://")
    expect(
      validateEditorContentPreflight({ ...preflightCommon, postCanonicalUrl: "https://@example.com/post" })
    ).toContain("http://")
    expect(
      validateEditorContentPreflight({ ...preflightCommon, postSeriesOrder: 0 })
    ).toContain("integer of 1")
    expect(
      validateEditorContentPreflight({ ...preflightCommon, postScheduledAt: futureIso, postVisibility: "PRIVATE" })
    ).toContain("Private")
    expect(
      validateEditorContentPreflight({ ...preflightCommon, postScheduledAt: pastIso })
    ).toContain("future")

    const tooLongWarnings = scanMarkdownPrePublishWarnings("a".repeat(POST_CONTENT_MAX_LENGTH + 1))
    expect(tooLongWarnings.some((w) => w.kind === "content-too-long")).toBe(true)
    const html = renderThemed(
      createElement(EditorStudioPublishReadinessCard, {
        hasTitle: true,
        wordCount: 1,
        hasBody: true,
        hasManualSummary: true,
        tagCount: 1,
        linkWarningCount: 0,
        totalLinkCount: 0,
        prePublishWarnings: tooLongWarnings,
      }),
      "en"
    )
    expect(html).toContain("exceeds limit of 500,000")
  })

  test("public metadata sets safe external canonicalUrl while preserving self url and PostDetailSeriesCard renders active chapter", () => {
    const basePost: TPost = {
      id: "1401",
      slug: "1401",
      title: "Part 2: Codegen",
      summary: "Summary",
      status: ["Public"],
      type: ["Post"],
      date: { start_date: "2026-11-26" },
      createdAt: "2026-11-26T00:00:00Z",
      canonicalUrl: "https://external.example.org/posts/codegen",
    }

    expect(normalizeExternalCanonicalUrl("https://external.example.org/p")).toBe("https://external.example.org/p")
    expect(normalizeExternalCanonicalUrl("https://external.example.org/@author/p")).toBe(
      "https://external.example.org/@author/p"
    )
    expect(normalizeExternalCanonicalUrl("javascript:alert(1)")).toBe("")
    expect(normalizeExternalCanonicalUrl("https://secret:tok@external.example.org/p")).toBe("")
    expect(normalizeExternalCanonicalUrl("https://@external.example.org/p")).toBe("")

    const meta = buildPostDetailMetadata(basePost)
    expect(meta.url).toContain("/posts/1401")
    expect(meta.canonicalUrl).toBe("https://external.example.org/posts/codegen")

    const unsafeMeta = buildPostDetailMetadata({ ...basePost, canonicalUrl: "javascript:alert(1)" })
    expect(unsafeMeta.canonicalUrl).toBe(unsafeMeta.url)

    const seriesHtml = renderThemed(
      createElement(PostDetailSeriesCard, {
        seriesName: "Compiler Design",
        currentPostId: "1401",
        items: [
          { id: "1400", title: "Lexer", seriesOrder: 1, createdAt: "2026-11-20T00:00:00Z" },
          { id: "1401", title: "Part 2: Codegen", seriesOrder: 2, createdAt: "2026-11-26T00:00:00Z" },
        ],
      }),
      "en"
    )
    expect(seriesHtml).toContain("Compiler Design")
    expect(seriesHtml).toContain("2 / 2")
    expect(seriesHtml).toContain('aria-current="page"')
    expect(seriesHtml).toContain('href="/posts/1400"')
  })

  test("modShortcutLabel stays SSR-deterministic across ko/en and detects client platform dynamically", () => {
    expect(modShortcutLabel).toBe("Ctrl+")
    expect(editorT("toolbarLinkTitle", "ko", "⌘")).toBe("링크 (⌘K)")
    expect(editorT("toolbarLinkTitle", "en", "Ctrl+")).toBe("Link (Ctrl+K)")
    expect(["⌘", "Ctrl+"]).toContain(detectClientModShortcutLabel())
  })

  test("planMoveBlockToOffset skips adjacent downward no-op without document corruption and supports directive aliases", () => {
    const applyPlan = (doc: string, plan: ReturnType<typeof planMoveBlockToOffset>) => {
      if (!plan) return doc
      return doc.slice(0, plan.rangeStart) + plan.replacement + doc.slice(plan.rangeEnd)
    }

    const threeLines = "Line A\nLine B\nLine C"
    expect(planMoveBlockToOffset(threeLines, 1, threeLines.indexOf("Line B") + 1, false)).toBeNull()

    const movedBeforeC = planMoveBlockToOffset(threeLines, 1, threeLines.indexOf("Line C") + 1, false)
    expect(movedBeforeC).not.toBeNull()
    expect(applyPlan(threeLines, movedBeforeC)).toBe("Line B\nLine A\nLine C")

    const movedAfterB = planMoveBlockToOffset(threeLines, 1, threeLines.indexOf("Line B") + 1, true)
    expect(movedAfterB).not.toBeNull()
    expect(applyPlan(threeLines, movedAfterB)).toBe("Line B\nLine A\nLine C")

    const directiveDoc = ":::file Report\nhttps://example.com/a.pdf\n:::\nTail"
    const fileRange = resolveContainerAwareBlockRange(directiveDoc, 10, 10)
    expect(fileRange).toEqual({
      blockStart: 0,
      blockEnd: directiveDoc.indexOf("\nTail"),
    })
    expect(scanMarkdownPrePublishWarnings(":::file Report\nunclosed")).toEqual([
      { kind: "unclosed-directive", line: 1 },
    ])
  })

  test("parseMarkdownLinkSelection supports balanced parentheses in URLs and labels while rejecting non-links", () => {
    expect(parseMarkdownLinkSelection("[Docs (v2)](https://example.com/a_(b))")).toEqual({
      label: "Docs (v2)",
      url: "https://example.com/a_(b)",
    })
    expect(parseMarkdownLinkSelection("![Image](https://example.com/a.png)")).toBeNull()
    expect(parseMarkdownLinkSelection("[a](https://a.test) [b](https://b.test)")).toBeNull()
  })

  test("English editor surfaces localize thumbnail controls and publish placeholder errors", () => {
    expect(detectPublishPlaceholderIssue(":::toggle 토글 제목\n\n:::", "en")).toContain("Default toggle title")
    expect(detectPublishPlaceholderIssue(":::toggle 토글 제목\n\n:::")).toContain("토글 제목")

    const thumbHtml = renderThemed(
      createElement(EditorStudioThumbnailEditorPanel, {
        finalizePreviewThumbPointer: () => {},
        handlePreviewThumbPointerDown: () => {},
        handlePreviewThumbPointerMove: () => {},
        isPreviewThumbDragging: false,
        isPreviewThumbnailError: false,
        postThumbnailZoom: 1,
        previewThumbFrameRef: { current: null },
        safePreviewThumbnail: "",
        setIsPreviewThumbnailError: () => {},
        onThumbnailZoomChange: () => {},
        onResetThumbnailZoom: () => {},
      }),
      "en"
    )
    expect(thumbHtml).toContain("Adjust thumbnail focus")
    expect(thumbHtml).toContain("Using auto OG card")
    expect(thumbHtml).not.toContain("썸네일 위치 조정")
  })

  test("executeServerTempDraftSave and Mod+S fail closed on invalid canonicalUrl to preserve server value and local draft", async () => {
    const capturedBodies: Array<Record<string, unknown>> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        capturedBodies.push(JSON.parse(init.body) as Record<string, unknown>)
      }
      return new Response(
        JSON.stringify({
          resultCode: "200-1",
          msg: "ok",
          data: { id: 99, version: 2, summary: "Auto summary", summarySource: "AUTO" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }) as typeof fetch

    await withClientDom(async ({ storage, rootContainer }) => {
      try {
        const draftStorageKey = localDraftStorageKeyForDocument(
          { kind: "post", postId: "99" },
          getLocalDraftDocumentId()
        )
        storage.setItem(
          draftStorageKey,
          JSON.stringify({ title: "Draft", content: "Draft body", canonicalUrl: "https://", savedAt: "t1" })
        )
        const serverBaselineRef = { current: "baseline-fp" }
        const localSavedAtUpdates: string[] = []
        const localSaveCalls: Array<{ silent?: boolean; force?: boolean } | undefined> = []
        const statusCalls: Array<{ notice: { tone: string; text: string }; target?: string }> = []

        const commonInput = {
          isEn: false,
          normalizedPostId: "99",
          postTitle: "Draft",
          currentPostContent: "Draft body",
          composed: "Draft body",
          postVersion: 1,
          effectiveTags: [],
          effectiveCategory: "",
          effectiveThumbnailUrl: "",
          postSummary: "",
          postSummarySource: "NONE",
          postScheduledAt: "",
          postSeriesName: "",
          postSeriesOrder: null,
          getCurrentPostContent: () => "Draft body",
          applyCanonicalWriteResponse: () => ({ summary: "Auto summary", summarySource: "EXTRACTED" as const, intent: { kind: "auto" as const } }),
          buildSuccessfulWriteFingerprintPayload: () => ({
            title: "Draft",
            content: "Draft body",
            tags: [],
            category: "",
            thumbnailUrl: "",
            thumbnailFocusX: 50,
            thumbnailFocusY: 50,
            thumbnailZoom: 1,
            summary: "Auto summary",
            summarySource: "EXTRACTED" as const,
            summaryIntent: { kind: "auto" as const },
            visibility: "PUBLIC_LISTED" as const,
          }),
          buildEditorStateFingerprint: () => "fp-1",
          dedupeStrings: (items: string[]) => items,
          serverBaselineEditorFingerprintRef: serverBaselineRef,
          lastLocalDraftFingerprintRef: { current: "" },
          signalLocalDraftBaselineReady: () => {},
          saveLocalDraft: (options?: { silent?: boolean; force?: boolean }) => {
            localSaveCalls.push(options)
          },
          setPostVersion: () => {},
          setLocalDraftSavedAt: (val: string | ((prev: string) => string)) => {
            localSavedAtUpdates.push(typeof val === "function" ? val("") : val)
          },
          setLoadingKey: () => {},
          setLastSaveError: () => {},
          setPublishStatus: (notice: { tone: string; text: string }, target?: string) => {
            statusCalls.push({ notice, target })
          },
        }

        // 1. Autosave (silent: true) skips PUT completely and preserves baseline + local draft
        const silentOk = await executeServerTempDraftSave({
          ...commonInput,
          silent: true,
          postCanonicalUrl: "https://",
        })
        expect(silentOk).toBe(false)
        expect(capturedBodies).toHaveLength(0)
        expect(serverBaselineRef.current).toBe("baseline-fp")
        expect(storage.getItem(draftStorageKey)).not.toBeNull()
        expect(localSavedAtUpdates).toEqual([])
        expect(localSaveCalls).toEqual([])

        // 2. Manual Mod+S (silent: false) saves locally, shows error guidance, and never overwrites server or deletes local draft
        const manualOk = await executeServerTempDraftSave({
          ...commonInput,
          silent: false,
          postCanonicalUrl: "javascript:alert(1)",
        })
        expect(manualOk).toBe(false)
        expect(capturedBodies).toHaveLength(0)
        expect(serverBaselineRef.current).toBe("baseline-fp")
        expect(storage.getItem(draftStorageKey)).not.toBeNull()
        expect(localSavedAtUpdates).toEqual([])
        expect(localSaveCalls).toEqual([{ silent: false, force: true }])
        expect(statusCalls.at(-1)?.notice.tone).toBe("error")
        expect(statusCalls.at(-1)?.notice.text).toContain("로컬 초안")
        expect(statusCalls.at(-1)?.notice.text).toContain("http://")
        expect(statusCalls.at(-1)?.target).toBe("page")

        // 2b. Empty userInfo canonicalUrl (https://@example.com/post) also fails closed without fetch
        const emptyUserInfoOk = await executeServerTempDraftSave({
          ...commonInput,
          silent: false,
          postCanonicalUrl: "https://@example.com/post",
        })
        expect(emptyUserInfoOk).toBe(false)
        expect(capturedBodies).toHaveLength(0)
        expect(statusCalls.at(-1)?.notice.tone).toBe("error")

        // 2c. When saveLocalDraft returns false (e.g., storage quota/gated), notice must not falsely claim local save succeeded
        const failedLocalSaveOk = await executeServerTempDraftSave({
          ...commonInput,
          silent: false,
          postCanonicalUrl: "https://",
          saveLocalDraft: () => false,
        })
        expect(failedLocalSaveOk).toBe(false)
        expect(capturedBodies).toHaveLength(0)
        expect(statusCalls.at(-1)?.notice.tone).toBe("error")
        expect(statusCalls.at(-1)?.notice.text).not.toContain("로컬 초안")
        expect(statusCalls.at(-1)?.notice.text).toContain("http://")

        // 3. Clearing canonicalUrl (empty string) intentionally sends null, updates baseline, and cleans up submitted local draft
        const clearOk = await executeServerTempDraftSave({
          ...commonInput,
          silent: true,
          postCanonicalUrl: "   ",
        })
        expect(clearOk).toBe(true)
        expect(capturedBodies).toHaveLength(1)
        expect(capturedBodies[0]?.canonicalUrl).toBeNull()
        expect(storage.getItem(draftStorageKey)).toBeNull()

        // 4. Fallback Mod+S handler (when onSaveServerTempDraft is absent) also fails closed without fetch
        const shortcutLocalSaveCalls: Array<{ silent?: boolean; force?: boolean } | undefined> = []
        const shortcutStatuses: Array<{ notice: { tone: string; text: string }; target?: string }> = []
        const root = createRoot(rootContainer)
        const ShortcutProbe = () => {
          useEditorStudioKeyboardShortcuts({
            isTempDraftMode: true,
            editorMode: "edit",
            postId: "99",
            postVersion: 1,
            postTitle: "Draft",
            postSummary: "",
            postSummarySource: "NONE",
            effectiveThumbnailUrl: "",
            getCurrentPostContent: () => "Draft body",
            composeEditorContent: (c) => c,
            postTags: [],
            postCategory: "",
            postCanonicalUrl: "https://",
            saveLocalDraft: (options) => {
              shortcutLocalSaveCalls.push(options)
            },
            setPostVersion: () => undefined,
            setPublishStatus: (notice, target) => {
              shortcutStatuses.push({ notice, target })
            },
            loadingKey: "",
            setLoadingKey: () => undefined,
          })
          return null
        }

        try {
          await act(async () => {
            root.render(
              createElement(ClientLanguageProvider, {
                initialLanguage: "en",
                children: createElement(ShortcutProbe),
              })
            )
          })
          await act(async () => {
            const event = new Event("keydown", { cancelable: true }) as KeyboardEvent & {
              key: string
              metaKey: boolean
              ctrlKey: boolean
              shiftKey: boolean
              isComposing: boolean
              keyCode: number
            }
            Object.defineProperties(event, {
              key: { value: "s" },
              metaKey: { value: true },
              ctrlKey: { value: false },
              shiftKey: { value: false },
              isComposing: { value: false },
              keyCode: { value: 83 },
            })
            window.dispatchEvent(event)
          })
          expect(capturedBodies).toHaveLength(1)
          expect(shortcutLocalSaveCalls).toEqual([{ silent: false, force: true }])
          expect(shortcutStatuses.at(-1)?.notice.tone).toBe("error")
          expect(shortcutStatuses.at(-1)?.notice.text).toContain("Saved locally.")
        } finally {
          await act(async () => {
            root.unmount()
          })
        }
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  test("PRIVATE visibility allows clearing and auto-clears lingering schedule across modal and inspector", async () => {
    const futureIso = new Date(Date.now() + 3_600_000).toISOString()

    // SSR renders immediate clear button when PRIVATE has a lingering schedule
    const modalHtml = renderThemed(
      createElement(EditorStudioPublishMetadataSection, {
        postVisibility: "PRIVATE",
        postScheduledAt: futureIso,
        postSeriesName: "",
        postSeriesOrder: null,
        postCanonicalUrl: "",
        seriesCatalog: [],
        onScheduledAtChange: () => {},
        onSeriesNameChange: () => {},
        onSeriesOrderChange: () => {},
        onCanonicalUrlChange: () => {},
      }),
      "ko"
    )
    expect(modalHtml).toContain('data-testid="publish-schedule-private-clear"')
    expect(modalHtml).toContain("예약 해제")

    const inspectorHtml = renderThemed(
      createElement(EditorStudioInspectorPublishingFields, {
        postVisibility: "PRIVATE",
        postScheduledAt: futureIso,
        postSeriesName: "",
        postSeriesOrder: null,
        postCanonicalUrl: "",
        seriesCatalog: [],
        onScheduledAtChange: () => {},
        onSeriesNameChange: () => {},
        onSeriesOrderChange: () => {},
        onCanonicalUrlChange: () => {},
      }),
      "ko"
    )
    expect(inspectorHtml).toContain("예약 해제")
    expect(inspectorHtml).not.toMatch(/<button[^>]*disabled[^>]*>예약 해제<\/button>/)

    // Client mount auto-clears schedule when PRIVATE visibility is active
    await withClientDom(async ({ rootContainer }) => {
      const root = createRoot(rootContainer)
      const clearedModal: string[] = []
      const clearedInspector: string[] = []
      try {
        await act(async () => {
          root.render(
            createElement(ClientThemeProvider, {
              theme: lightTheme,
              children: createElement(ClientLanguageProvider, {
                initialLanguage: "ko",
                children: createElement(
                  "div",
                  null,
                  createElement(ClientPublishMetadataSection, {
                    key: "modal",
                    postVisibility: "PRIVATE",
                    postScheduledAt: futureIso,
                    postSeriesName: "",
                    postSeriesOrder: null,
                    postCanonicalUrl: "",
                    seriesCatalog: [],
                    onScheduledAtChange: (val) => clearedModal.push(val),
                    onSeriesNameChange: () => {},
                    onSeriesOrderChange: () => {},
                    onCanonicalUrlChange: () => {},
                  }),
                  createElement(ClientInspectorPublishingFields, {
                    key: "inspector",
                    postVisibility: "PRIVATE",
                    postScheduledAt: futureIso,
                    postSeriesName: "",
                    postSeriesOrder: null,
                    postCanonicalUrl: "",
                    seriesCatalog: [],
                    onScheduledAtChange: (val) => clearedInspector.push(val),
                    onSeriesNameChange: () => {},
                    onSeriesOrderChange: () => {},
                    onCanonicalUrlChange: () => {},
                  })
                ),
              }),
            })
          )
        })
        expect(clearedModal).toEqual([""])
        expect(clearedInspector).toEqual([""])
      } finally {
        await act(async () => {
          root.unmount()
        })
      }
    })
  })

  test("local draft lifecycle saves metadata-only edits and clears lingering schedule on PRIVATE restore", async () => {
    const futureIso = new Date(Date.now() + 3_600_000).toISOString()
    await withClientDom(async ({ storage, rootContainer }) => {
      const root = createRoot(rootContainer)
      let scheduledAtState = ""
      let visibilityState: "PUBLIC_LISTED" | "PUBLIC_UNLISTED" | "PRIVATE" = "PUBLIC_LISTED"
      let canonicalUrlState = "https://"
      const noop = () => {}
      const getEmptyContent = () => ""
      const summaryIntentAuto = { kind: "auto" } as const
      const emptyTags: string[] = []
      const lastLocalDraftFingerprintRef = { current: "" }
      const lastWriteFingerprintRef = { current: "" }
      const lastWriteIdempotencyKeyRef = { current: "" }
      const setPostVisibility = (
        next:
          | "PUBLIC_LISTED"
          | "PUBLIC_UNLISTED"
          | "PRIVATE"
          | ((
              prev: "PUBLIC_LISTED" | "PUBLIC_UNLISTED" | "PRIVATE",
            ) => "PUBLIC_LISTED" | "PUBLIC_UNLISTED" | "PRIVATE"),
      ) => {
        visibilityState = typeof next === "function" ? next(visibilityState) : next
      }
      const setPostScheduledAt = (next: string | ((prev: string) => string)) => {
        scheduledAtState = typeof next === "function" ? next(scheduledAtState) : next
      }
      const setPostCanonicalUrl = (next: string | ((prev: string) => string)) => {
        canonicalUrlState = typeof next === "function" ? next(canonicalUrlState) : next
      }
      let api!: ReturnType<typeof useEditorStudioLocalDraftLifecycle>

      const Probe = () => {
        api = useEditorStudioLocalDraftLifecycle({
          editorMode: "edit",
          postId: "77",
          postVersion: 1,
          loadingKey: "",
          postTitle: "",
          postContent: "",
          getCurrentPostContent: getEmptyContent,
          postSummary: "",
          postSummarySource: "NONE",
          summaryIntent: summaryIntentAuto,
          postThumbnailUrl: "",
          postThumbnailFocusX: 50,
          postThumbnailFocusY: 50,
          postThumbnailZoom: 1,
          postTags: emptyTags,
          postCategory: "",
          postVisibility: visibilityState,
          postScheduledAt: scheduledAtState,
          postSeriesName: "",
          postSeriesOrder: null,
          postCanonicalUrl: canonicalUrlState,
          setEditorMode: noop,
          setIsTempDraftMode: noop,
          setPostId: noop,
          setPostVersion: noop,
          setPreviewThumbnailSourceUrl: noop,
          setPostTitle: noop,
          setPostContent: noop,
          setPostSummary: noop,
          setPostSummarySource: noop,
          setSummaryIntent: noop,
          setPostThumbnailUrl: noop,
          setPostThumbnailFocusX: noop,
          setPostThumbnailFocusY: noop,
          setPostThumbnailZoom: noop,
          setPostTags: noop,
          setPostCategory: noop,
          setPostVisibility,
          setPostScheduledAt,
          setPostSeriesName: noop,
          setPostSeriesOrder: noop,
          setPostCanonicalUrl,
          setLocalDraftSavedAt: noop,
          setPublishStatus: noop,
          dedupeStrings,
          normalizeCategoryValue,
          buildLocalDraftFingerprint,
          persistLocalDraft,
          readLocalDraft,
          removeLocalDraft,
          lastLocalDraftFingerprintRef,
          lastWriteFingerprintRef,
          lastWriteIdempotencyKeyRef,
        })
        return null
      }

      try {
        await act(async () => {
          root.render(
            createElement(ClientLanguageProvider, {
              initialLanguage: "ko",
              children: createElement(Probe),
            })
          )
        })

        // Metadata-only invalid canonicalUrl draft persists safely instead of silently returning false
        let saved = false
        await act(async () => {
          saved = api.saveLocalDraft({ silent: false, force: true })
        })
        expect(saved).toBe(true)
        const stored = readLocalDraft({ kind: "post", postId: "77" })
        expect(stored?.canonicalUrl).toBe("https://")

        // Restoring a local draft marked PRIVATE drops any lingering scheduledAt
        const key = localDraftStorageKeyForDocument({ kind: "post", postId: "77" }, getLocalDraftDocumentId())
        storage.setItem(
          key,
          JSON.stringify({
            title: "Private draft",
            content: "Private body",
            summary: "",
            summarySource: "NONE",
            summaryIntent: { kind: "auto" },
            thumbnailUrl: "",
            thumbnailFocusX: 50,
            thumbnailFocusY: 50,
            thumbnailZoom: 1,
            tags: [],
            category: "",
            visibility: "PRIVATE",
            scheduledAt: futureIso,
            seriesName: "",
            seriesOrder: null,
            canonicalUrl: "",
            savedAt: new Date().toISOString(),
            source: { kind: "post", postId: "77" },
            postVersion: 1,
          })
        )
        scheduledAtState = futureIso
        await act(async () => {
          api.restoreLocalDraft(key)
        })
        expect(visibilityState).toBe("PRIVATE")
        expect(scheduledAtState).toBe("")
      } finally {
        await act(async () => {
          root.unmount()
        })
      }
    })
  })
})
