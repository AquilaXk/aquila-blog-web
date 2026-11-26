import { createElement, type ReactElement } from "react"
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
  CANONICAL_URL_MAX_LENGTH,
  computeContentFingerprint,
  detectPublishPlaceholderIssue,
  normalizeSafeCanonicalUrl,
  POST_CONTENT_MAX_LENGTH,
} from "../../src/routes/Admin/editorStudioMetaModel"
import { scanMarkdownPrePublishWarnings } from "../../src/routes/Admin/editorStudioPublishWarnings"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import { EditorStudioThumbnailEditorPanel } from "../../src/routes/Admin/EditorStudioThumbnailPanels"
import { toVisibility } from "../../src/routes/Admin/editorStudioState"
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
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import type { TPost } from "../../src/types"

const lightTheme = createTheme({ scheme: "light" })

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
    expect(normalizeSafeCanonicalUrl("javascript:alert(1)")).toBe("")
    expect(normalizeSafeCanonicalUrl("https://user:pass@origin.example.com/p")).toBe("")
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
    expect(normalizeExternalCanonicalUrl("javascript:alert(1)")).toBe("")
    expect(normalizeExternalCanonicalUrl("https://secret:tok@external.example.org/p")).toBe("")

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

  test("executeServerTempDraftSave sanitizes partial invalid canonicalUrl during autosave", async () => {
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

    try {
      const ok = await executeServerTempDraftSave({
        silent: true,
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
        postCanonicalUrl: "https://",
        getCurrentPostContent: () => "Draft body",
        applyCanonicalWriteResponse: () => ({ summary: "Auto summary", summarySource: "EXTRACTED", intent: { kind: "auto" } }),
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
          summarySource: "EXTRACTED",
          summaryIntent: { kind: "auto" },
          visibility: "PUBLIC_LISTED",
        }),
        buildEditorStateFingerprint: () => "fp-1",
        dedupeStrings: (items) => items,
        serverBaselineEditorFingerprintRef: { current: "" },
        lastLocalDraftFingerprintRef: { current: "" },
        signalLocalDraftBaselineReady: () => {},
        setPostVersion: () => {},
        setLocalDraftSavedAt: () => {},
        setLoadingKey: () => {},
        setLastSaveError: () => {},
        setPublishStatus: () => {},
      })
      expect(ok).toBe(true)
      expect(capturedBodies).toHaveLength(1)
      expect(capturedBodies[0]?.canonicalUrl).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
