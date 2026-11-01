import createCache from "@emotion/cache"
import { CacheProvider, ThemeProvider } from "@emotion/react"
import createEmotionServer from "@emotion/server/create-instance"
import { expect, test } from "@playwright/test"
import { act, createElement, type ComponentType } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { ConfirmDialog } from "../../src/design-system/ConfirmDialog"
import {
  EditorStudioDedicatedEditorSurface,
  resolveViewportPanelUiMask,
} from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import { EditorStudioGuideModal } from "../../src/routes/Admin/EditorStudioDedicatedPanelParts"
import {
  EDITOR_SURFACE_GUIDE_OPEN,
  EDITOR_SURFACE_INSPECTOR_OPEN,
  EDITOR_SURFACE_OUTLINE_OPEN,
  EDITOR_SURFACE_ZEN_BITS,
} from "../../src/routes/Admin/editorStudioDedicatedSurfaceModel"
import { EditorStudioPublishModal } from "../../src/routes/Admin/EditorStudioPublishModal"
import { PUBLISH_VISIBILITY_OPTIONS } from "../../src/routes/Admin/EditorStudioWorkspaceControllerRootModel"
import { revalidateSavedPost } from "../../src/routes/Admin/editorPostSaveRefresh"
import { isServerTempDraftPost, isTempDraftCandidate } from "../../src/routes/Admin/editorTempDraft"
import {
  decideLocalDraftAutosave,
  isLocalDraftRestoreSuggestionEligible,
  resolveEffectivePendingRestorableDraftFingerprint,
  resolveRestoredPostVersion,
} from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { createTheme } from "../../src/styles/theme"
import { zIndexes } from "../../src/styles/zIndexes"
import {
  createMinimalRootContainer,
  createStatefulEditorHarness,
  withWindowStorage,
} from "./helpers/editorStudioTestHarness"
import { wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderWithEmotionCss = <P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  props: P
) => {
  const cache = createCache({ key: "css" })
  const { extractCriticalToChunks } = createEmotionServer(cache)
  const Wrapped = wrapPlaywrightJsxComponent(Component) as ComponentType<P>
  const node = createElement(Wrapped, props)
  const html = renderToString(
    createElement(
      CacheProvider,
      { value: cache, children: createElement(ThemeProvider, { theme: lightTheme, children: node }) }
    )
  )
  const chunks = extractCriticalToChunks(html)
  const css = chunks.styles.map((style) => style.css).join("\n")
  return { html, css }
}

test.describe("Wave 6 Unit 3: EditorStudio lifecycle, revalidation & responsive stacking", () => {
  test("resolveRestoredPostVersion keeps monotonic max version and never regresses to stale draft version", () => {
    expect(resolveRestoredPostVersion(7, 3)).toBe(7)
    expect(resolveRestoredPostVersion(3, 9)).toBe(9)
    expect(resolveRestoredPostVersion(7, null)).toBe(7)
    expect(resolveRestoredPostVersion(null, 4)).toBe(4)
    expect(resolveRestoredPostVersion(null, null)).toBeNull()
  })

  test("isTempDraftCandidate gives explicit boolean tempDraft precedence so private post titled 임시글 keeps its title", async () => {
    expect(
      isTempDraftCandidate({ tempDraft: false, title: "임시글", published: false, listed: false })
    ).toBe(false)
    expect(
      isServerTempDraftPost({ tempDraft: false, title: "임시글", published: false, listed: false })
    ).toBe(false)
    expect(
      isTempDraftCandidate({ tempDraft: true, title: "일반 제목", published: false, listed: false })
    ).toBe(true)
    expect(
      isTempDraftCandidate({ tempDraft: undefined, title: "임시글", published: false, listed: false })
    ).toBe(true)

    await withWindowStorage(async () => {
      const harness = createStatefulEditorHarness()
      harness.state.postId = "88"
      const container = createMinimalRootContainer()
      const root = createRoot(container as unknown as Element)
      const originalFetch = globalThis.fetch

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.endsWith("/post/api/v1/adm/posts/88")) {
          return new Response(
            JSON.stringify({
              id: 88,
              version: 2,
              title: "임시글",
              content: "정상 비공개 포스트 본문",
              summary: "",
              summarySource: "NONE",
              published: false,
              listed: false,
              tempDraft: false,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url.endsWith("/post/api/v1/posts/88") && init?.method === "PUT") {
          return new Response(
            JSON.stringify({
              resultCode: "200-1",
              msg: "ok",
              data: {
                id: 88,
                version: 3,
                title: "임시글",
                summary: "",
                summarySource: "NONE",
                published: false,
                listed: false,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        }
        if (url === "/api/revalidate") {
          return new Response(JSON.stringify({ revalidated: true }), { status: 200 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }) as typeof fetch

      try {
        await act(async () => {
          root.render(createElement(harness.Probe))
        })
        await act(async () => {
          await harness.lifecycle.loadPostForEditor("88")
          root.render(createElement(harness.Probe))
        })

        expect(harness.state.postTitle).toBe("임시글")
        expect(harness.state.isTempDraftMode).toBe(false)

        await act(async () => {
          await harness.persistence.handleModifyPost()
          root.render(createElement(harness.Probe))
        })

        expect(harness.state.isTempDraftMode).toBe(false)
        expect(harness.state.postVersion).toBe(3)
      } finally {
        await act(async () => {
          root.unmount()
        })
        globalThis.fetch = originalFetch
      }
    })
  })

  test("revalidateSavedPost sends both home feed and canonical post path", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")),
      })
      return new Response(JSON.stringify({ revalidated: true }), { status: 200 })
    }) as typeof fetch

    try {
      await revalidateSavedPost(" 771 ")
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(calls).toEqual([
      {
        url: "/api/revalidate",
        body: { paths: ["/", "/posts/771"] },
      },
    ])
  })

  test("responsive z-index hierarchy, tablet inspector default, 100dvh drawer + safe-area footer, conflict CTA, and card meta copy match contract", () => {
    expect(zIndexes.mobileSheet).toBe(160)
    expect(zIndexes.editorGuide).toBe(190)
    expect(zIndexes.publishModal).toBe(210)
    expect(zIndexes.confirmDialog).toBe(2300)
    expect(zIndexes.mobileSheet).toBeLessThan(zIndexes.editorGuide)
    expect(zIndexes.editorGuide).toBeLessThan(zIndexes.publishModal)
    expect(zIndexes.publishModal).toBeLessThan(zIndexes.confirmDialog)
    expect(zIndexes.confirmDialog).toBeGreaterThan(2200)
    expect((EDITOR_SURFACE_ZEN_BITS | EDITOR_SURFACE_GUIDE_OPEN) & ~EDITOR_SURFACE_GUIDE_OPEN).toBe(
      EDITOR_SURFACE_ZEN_BITS
    )

    const mobileMask = resolveViewportPanelUiMask(EDITOR_SURFACE_ZEN_BITS, {
      isMobileViewport: true,
      isTabletViewport: false,
    })
    expect(mobileMask & EDITOR_SURFACE_OUTLINE_OPEN).toBe(0)
    expect(mobileMask & EDITOR_SURFACE_INSPECTOR_OPEN).toBe(0)

    const tabletMask = resolveViewportPanelUiMask(EDITOR_SURFACE_ZEN_BITS, {
      isMobileViewport: false,
      isTabletViewport: true,
    })
    expect(tabletMask & EDITOR_SURFACE_OUTLINE_OPEN).toBe(EDITOR_SURFACE_OUTLINE_OPEN)
    expect(tabletMask & EDITOR_SURFACE_INSPECTOR_OPEN).toBe(0)

    const desktopMask = resolveViewportPanelUiMask(0, {
      isMobileViewport: false,
      isTabletViewport: false,
    })
    expect(desktopMask & EDITOR_SURFACE_ZEN_BITS).toBe(EDITOR_SURFACE_ZEN_BITS)

    const guideRendered = renderWithEmotionCss(EditorStudioGuideModal, {
      onClose: () => undefined,
    })
    expect(guideRendered.css).toContain("z-index:190;")
    expect(guideRendered.css).toContain("height:100dvh;")
    expect(guideRendered.css).toContain("calc(50px + env(safe-area-inset-bottom, 0px))")

    const modalRendered = renderWithEmotionCss(EditorStudioPublishModal, {
      closeToggleLabel: "닫기",
      isCompactMobileLayout: true,
      isMobileMetaEditorOpen: false,
      isMobileThumbnailEditorOpen: false,
      loadingKey: "",
      modalNotice: { tone: "error", text: "버전 충돌 발생" },
      postVisibility: "PUBLIC_LISTED",
      previewMetaEditorPanel: createElement("div", null, "meta"),
      publishActionButtonDisabled: false,
      publishActionButtonText: "수정사항 반영",
      publishActionTitle: "글 수정 확인",
      shouldShowNotice: true,
      thumbnailEditorPanel: createElement("div", null, "thumb"),
      variant: "drawer",
      visibilityOptions: PUBLISH_VISIBILITY_OPTIONS,
      onClose: () => undefined,
      onConfirmPublish: () => undefined,
      onReloadLatestServerPost: () => undefined,
      onPostVisibilityChange: () => undefined,
      onToggleMobileMetaEditor: () => undefined,
      onToggleMobileThumbnailEditor: () => undefined,
    })
    expect(modalRendered.html).toContain("썸네일 URL과 업로드 방식을 설정합니다.")
    expect(modalRendered.html).not.toContain("썸네일 URL과 요약만")
    expect(modalRendered.html).toContain("서버 최신본 다시 불러오기")
    expect(modalRendered.css).toContain("z-index:210;")
    expect(modalRendered.css).toContain("max-height:100dvh;height:100dvh;")
    expect(modalRendered.css).toContain("padding:0.78rem 0 max(0.78rem, env(safe-area-inset-bottom, 0px));")

    const confirmRendered = renderWithEmotionCss(ConfirmDialog, {
      open: true,
      titleId: "confirm-t",
      descriptionId: "confirm-d",
      title: "나가시겠습니까?",
      description: "저장되지 않은 변경사항이 있습니다.",
      confirmLabel: "나가기",
      onConfirm: () => undefined,
      onCancel: () => undefined,
    })
    expect(confirmRendered.css).toContain("z-index:2300;")

    const surfaceRendered = renderWithEmotionCss(EditorStudioDedicatedEditorSurface, {
      thumbnailImageFileInputRef: () => undefined,
      onThumbnailImageFileChange: () => undefined,
      onExit: () => undefined,
      saveStateText: "수정됨",
      saveStateTone: "dirty",
      primaryActionDisabled: false,
      primaryActionLabel: "발행하기",
      onPrimaryAction: () => undefined,
      postTags: ["kotlin"],
      tagDraft: "",
      onTagDraftChange: () => undefined,
      onAddTags: () => undefined,
      onAddTag: () => undefined,
      onRemoveTag: () => undefined,
      titleInputRef: () => undefined,
      onOutlineBodyHeadingActivate: () => undefined,
      postTitle: "테스트 제목",
      onPostTitleChange: () => undefined,
      onPostTitleKeyDown: () => undefined,
      postContent: "## 섹션 제목\n본문",
      postSummary: "",
      onPostSummaryChange: () => undefined,
      postCategory: "Spring ",
      onPostCategoryChange: () => undefined,
      onCommitPostCategory: () => undefined,
      categorySuggestions: ["folder::Spring Boot", "rocket::Backend"],
      tagSuggestions: ["kotlin", "spring"],
      postVisibility: "PUBLIC_LISTED",
      onPostVisibilityChange: () => undefined,
      editorCanvas: createElement("div", null, "canvas"),
      showPublishNotice: true,
      publishNoticeTone: "error",
      publishNoticeText: "버전 충돌이 발생했습니다.",
      onReloadLatestServerPost: () => undefined,
      isLocalDraftRestoreSuggestionVisible: false,
      isLocalDraftRestoreSuggestionActionsDisabled: false,
      onRestoreLocalDraft: () => undefined,
      localDraftCandidates: [],
      selectedLocalDraftCandidateKey: "",
      onSelectLocalDraftCandidate: () => undefined,
      onDiscardLocalDraftCandidate: () => undefined,
      onDismissLocalDraftRestoreSuggestion: () => undefined,
      onClearLocalDraft: () => undefined,
      publishModal: null,
    })
    expect(surfaceRendered.html).toContain("서버 최신본 다시 불러오기")
    expect(surfaceRendered.html).toContain('value="Spring "')
    expect(surfaceRendered.html).toContain('<option value="Spring Boot"></option>')
    expect(surfaceRendered.html).toContain('<option value="Backend"></option>')
    expect(surfaceRendered.html).not.toContain("folder::Spring Boot")
    expect(surfaceRendered.html).not.toContain("rocket::Backend")
    expect(surfaceRendered.css).toContain("z-index:160;")
  })

  test("consecutive session autosaves reschedule when own checkpoint updates and suppress self-restore thrashing", () => {
    const firstCheckpoint = '{"title":"draft","summary":"수동 요약"}'
    const clearedSummaryCheckpoint = '{"title":"draft","summary":""}'

    expect(
      resolveEffectivePendingRestorableDraftFingerprint(firstCheckpoint, firstCheckpoint)
    ).toBeNull()
    expect(
      resolveEffectivePendingRestorableDraftFingerprint(firstCheckpoint, null)
    ).toBe(firstCheckpoint)

    expect(
      decideLocalDraftAutosave({
        loadingKey: "",
        shouldAdoptBaseline: false,
        isPostIdTransitionGated: false,
        hasDraftContent: true,
        editorFingerprint: clearedSummaryCheckpoint,
        lastArmedFingerprint: firstCheckpoint,
        pendingRestorableDraftFingerprint: resolveEffectivePendingRestorableDraftFingerprint(
          firstCheckpoint,
          firstCheckpoint
        ),
      })
    ).toEqual({ action: "schedule" })

    expect(
      isLocalDraftRestoreSuggestionEligible({
        candidate: {
          key: "admin.editor.localDraft.create.self.v3",
          source: { kind: "create" },
          fingerprint: firstCheckpoint,
          isActiveSessionAutosave: true,
        },
        currentSource: { kind: "create" },
        editorFingerprint: clearedSummaryCheckpoint,
        serverBaselineFingerprint: "",
        restored: [],
        dismissed: [],
      })
    ).toBe(false)
  })
})
