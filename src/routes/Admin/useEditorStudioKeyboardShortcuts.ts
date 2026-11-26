// 참조 구현: TryGhost/Ghost (MIT) — client/src/components/editor/shortcuts.ts
import { useEffect, useRef } from "react"
import { apiFetch } from "src/apis/backend/client"
import { useLanguage } from "src/libs/language"
import { normalizeCategoryValue } from "src/libs/utils"
import type { RsData } from "src/types"
import { normalizeSafeCanonicalUrl } from "./editorStudioMetaModel"
import type { EditorMode } from "./editorStudioState"
import {
  formatInvalidCanonicalDraftSaveNotice,
  hasInvalidCanonicalUrlInput,
} from "./useEditorStudioPersistenceHelpers"
import { extractPendingTagDraftValues } from "./useEditorStudioPublishModalFlow"

type NoticeTone = "idle" | "loading" | "success" | "error"
type PublishNotice = { tone: NoticeTone; text: string }

type UseEditorStudioKeyboardShortcutsParams = {
  isTempDraftMode: boolean
  editorMode: EditorMode
  postId: string
  postVersion: number | null
  postTitle: string
  postSummary: string
  postSummarySource: string
  effectiveThumbnailUrl: string
  getCurrentPostContent: () => string
  composeEditorContent: (
    content: string,
    tags: string[],
    meta: { category: string; thumbnail: string }
  ) => string
  postTags: string[]
  tagDraft?: string
  postCategory: string
  addTagsToPost?: (tags: string[]) => string[]
  setTagDraft?: (value: string) => void
  saveLocalDraft: (options?: { silent?: boolean; force?: boolean }) => void
  onSaveServerTempDraft?: (options?: { silent?: boolean }) => Promise<boolean>
  setPostVersion: (version: number) => void
  setPublishStatus: (notice: PublishNotice, target?: "page" | "modal") => void
  loadingKey: string
  setLoadingKey: (key: string) => void
  isPublishModalOpen?: boolean
  onOpenPublishModal?: () => void
  onTogglePreviewMode?: () => void
  postScheduledAt?: string
  postSeriesName?: string
  postSeriesOrder?: number | null
  postCanonicalUrl?: string
}

export const buildTempDraftSaveSummaryPayload = (
  postSummary: string,
  postSummarySource: string
): { summary: string | null; summaryMode: "MANUAL" | "AUTO" } => {
  const trimmedSummary = postSummary.trim()
  const isManualSummary = postSummarySource === "MANUAL" && trimmedSummary.length > 0
  return {
    summary: isManualSummary ? trimmedSummary : null,
    summaryMode: isManualSummary ? "MANUAL" : "AUTO",
  }
}

export const useEditorStudioKeyboardShortcuts = ({
  isTempDraftMode,
  editorMode,
  postId,
  postVersion,
  postTitle,
  postSummary,
  postSummarySource,
  effectiveThumbnailUrl,
  getCurrentPostContent,
  composeEditorContent,
  postTags,
  tagDraft = "",
  postCategory,
  addTagsToPost,
  setTagDraft,
  saveLocalDraft,
  onSaveServerTempDraft,
  setPostVersion,
  setPublishStatus,
  loadingKey,
  setLoadingKey,
  isPublishModalOpen = false,
  onOpenPublishModal,
  onTogglePreviewMode,
  postScheduledAt = "",
  postSeriesName = "",
  postSeriesOrder = null,
  postCanonicalUrl = "",
}: UseEditorStudioKeyboardShortcutsParams) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const stateRef = useRef({
    isEn,
    isTempDraftMode,
    editorMode,
    postId,
    postVersion,
    postTitle,
    postSummary,
    postSummarySource,
    effectiveThumbnailUrl,
    getCurrentPostContent,
    composeEditorContent,
    postTags,
    tagDraft,
    postCategory,
    addTagsToPost,
    setTagDraft,
    saveLocalDraft,
    onSaveServerTempDraft,
    setPostVersion,
    setPublishStatus,
    loadingKey,
    setLoadingKey,
    isPublishModalOpen,
    onOpenPublishModal,
    onTogglePreviewMode,
    postScheduledAt,
    postSeriesName,
    postSeriesOrder,
    postCanonicalUrl,
  })

  useEffect(() => {
    stateRef.current = {
      isEn,
      isTempDraftMode,
      editorMode,
      postId,
      postVersion,
      postTitle,
      postSummary,
      postSummarySource,
      effectiveThumbnailUrl,
      getCurrentPostContent,
      composeEditorContent,
      postTags,
      tagDraft,
      postCategory,
      addTagsToPost,
      setTagDraft,
      saveLocalDraft,
      onSaveServerTempDraft,
      setPostVersion,
      setPublishStatus,
      loadingKey,
      setLoadingKey,
      isPublishModalOpen,
      onOpenPublishModal,
      onTogglePreviewMode,
      postScheduledAt,
      postSeriesName,
      postSeriesOrder,
      postCanonicalUrl,
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleKeyDown = async (event: KeyboardEvent) => {
      // 한국어 IME 조합 중 단축키 오발동 가드 (TryGhost/Koenig FormatToolbar.tsx 패턴)
      if (event.isComposing || event.keyCode === 229) {
        return
      }

      const isMod = event.metaKey || event.ctrlKey
      if (!isMod) return

      const key = event.key.toLowerCase()

      // Mod+Shift+P: 발행 설정 모달 열기 (Mod+Enter는 CM6 체크리스트 토글에 위임)
      if (key === "p" && event.shiftKey) {
        const state = stateRef.current
        if (state.onOpenPublishModal && !state.isPublishModalOpen) {
          event.preventDefault()
          event.stopPropagation()
          state.onOpenPublishModal()
          return
        }
      }

      // Mod+Shift+E: 미리보기/레이아웃 모드 토글
      if (key === "e" && event.shiftKey) {
        const state = stateRef.current
        if (state.onTogglePreviewMode) {
          event.preventDefault()
          event.stopPropagation()
          state.onTogglePreviewMode()
          return
        }
      }

      if (key !== "s" || event.shiftKey) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const state = stateRef.current
      if (state.loadingKey) {
        const isPublishInFlight =
          state.loadingKey === "writePost" ||
          state.loadingKey === "modifyPost" ||
          state.loadingKey === "publishTempPost"
        if (!isPublishInFlight) {
          const pendingTags = extractPendingTagDraftValues(state.tagDraft)
          if (pendingTags.length > 0) {
            state.addTagsToPost?.(pendingTags)
            state.setTagDraft?.("")
          }
        }
        state.saveLocalDraft({ silent: false, force: true })
        if (!isPublishInFlight) {
          state.setPublishStatus(
            {
              tone: "success",
              text: state.isEn
                ? "Another task is running; backed up safely as a browser draft."
                : "다른 작업이 진행 중이어서 브라우저 로컬 초안에 안전 저장했습니다.",
            },
            "page"
          )
        }
        return
      }

      if (state.isTempDraftMode && state.postId.trim()) {
        if (state.onSaveServerTempDraft) {
          await state.onSaveServerTempDraft({ silent: false })
          return
        }
        const pendingTags = extractPendingTagDraftValues(state.tagDraft)
        if (pendingTags.length > 0) {
          state.addTagsToPost?.(pendingTags)
          state.setTagDraft?.("")
        }
        if (hasInvalidCanonicalUrlInput(state.postCanonicalUrl)) {
          state.saveLocalDraft({ silent: false, force: true })
          state.setPublishStatus(
            { tone: "error", text: formatInvalidCanonicalDraftSaveNotice(state.isEn) },
            "page"
          )
          return
        }
        const effectiveTags =
          pendingTags.length > 0
            ? Array.from(new Set([...state.postTags, ...pendingTags]))
            : state.postTags
        const currentContent = state.getCurrentPostContent()
        const composed = state.composeEditorContent(currentContent, effectiveTags, {
          category: state.postCategory.trim() ? normalizeCategoryValue(state.postCategory) : "",
          thumbnail: state.effectiveThumbnailUrl,
        })
        try {
          state.setLoadingKey("serverTempDraftSave")
          state.setPublishStatus(
            {
              tone: "loading",
              text: state.isEn ? "Saving server draft..." : "서버 임시초안을 저장하는 중입니다...",
            },
            "page"
          )

          const summaryPayload = buildTempDraftSaveSummaryPayload(
            state.postSummary,
            state.postSummarySource
          )
          const response = await apiFetch<RsData<{ id: number; version: number }>>(
            `/post/api/v1/posts/temp/${encodeURIComponent(state.postId.trim())}`,
            {
              method: "PUT",
              body: JSON.stringify({
                title: state.postTitle,
                content: composed,
                version: typeof state.postVersion === "number" ? state.postVersion : 0,
                summary: summaryPayload.summary,
                summaryMode: summaryPayload.summaryMode,
                thumbnail: state.effectiveThumbnailUrl.trim() || null,
                scheduledAt: state.postScheduledAt.trim() || null,
                seriesName: state.postSeriesName.trim() || null,
                seriesOrder: state.postSeriesName.trim() && state.postSeriesOrder ? state.postSeriesOrder : null,
                canonicalUrl: normalizeSafeCanonicalUrl(state.postCanonicalUrl) || null,
              }),
            }
          )

          if (typeof response?.data?.version === "number") {
            state.setPostVersion(response.data.version)
          }
          state.saveLocalDraft({ silent: true, force: true })
          state.setPublishStatus(
            {
              tone: "success",
              text: state.isEn ? "Server draft saved safely." : "서버 임시초안이 안전하게 저장되었습니다.",
            },
            "page"
          )
        } catch {
          state.saveLocalDraft({ silent: true, force: true })
          state.setPublishStatus(
            {
              tone: "error",
              text: state.isEn
                ? "Server save failed; kept safely as a local draft."
                : "서버 임시저장에 실패하여 로컬 초안으로 안전하게 보관되었습니다.",
            },
            "page"
          )
        } finally {
          state.setLoadingKey("")
        }
        return
      }

      const pendingTags = extractPendingTagDraftValues(state.tagDraft)
      if (pendingTags.length > 0) {
        state.addTagsToPost?.(pendingTags)
        state.setTagDraft?.("")
      }
      state.saveLocalDraft({ silent: false })
      const noticeText =
        state.editorMode === "edit"
          ? state.isEn
            ? "Saved safely to browser local draft."
            : "브라우저 로컬 초안에 안전하게 저장되었습니다."
          : state.isEn
            ? "New post local draft saved."
            : "새 글 로컬 초안이 저장되었습니다."
      state.setPublishStatus({ tone: "success", text: noticeText }, "page")
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [])
}
