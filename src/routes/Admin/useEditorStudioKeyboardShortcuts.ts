// 참조 구현: TryGhost/Ghost (MIT) — client/src/components/editor/shortcuts.ts
import { useEffect, useRef } from "react"
import { apiFetch } from "src/apis/backend/client"
import type { RsData } from "src/types"
import type { EditorMode } from "./editorStudioState"

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
  postCategory: string
  saveLocalDraft: (options?: { silent?: boolean }) => void
  setPostVersion: (version: number) => void
  setPublishStatus: (notice: PublishNotice, target?: "page" | "modal") => void
  loadingKey: string
  setLoadingKey: (key: string) => void
  isPublishModalOpen?: boolean
  onOpenPublishModal?: () => void
  onTogglePreviewMode?: () => void
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
  postCategory,
  saveLocalDraft,
  setPostVersion,
  setPublishStatus,
  loadingKey,
  setLoadingKey,
  isPublishModalOpen = false,
  onOpenPublishModal,
  onTogglePreviewMode,
}: UseEditorStudioKeyboardShortcutsParams) => {
  const stateRef = useRef({
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
    postCategory,
    saveLocalDraft,
    setPostVersion,
    setPublishStatus,
    loadingKey,
    setLoadingKey,
    isPublishModalOpen,
    onOpenPublishModal,
    onTogglePreviewMode,
  })

  useEffect(() => {
    stateRef.current = {
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
      postCategory,
      saveLocalDraft,
      setPostVersion,
      setPublishStatus,
      loadingKey,
      setLoadingKey,
      isPublishModalOpen,
      onOpenPublishModal,
      onTogglePreviewMode,
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

      // Mod+Enter 또는 Mod+Shift+P: 발행 설정 모달 열기
      if ((key === "enter" && !event.shiftKey) || (key === "p" && event.shiftKey)) {
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
        return
      }

      const currentContent = state.getCurrentPostContent()
      const composed = state.composeEditorContent(currentContent, state.postTags, {
        category: state.postCategory,
        thumbnail: state.effectiveThumbnailUrl,
      })

      if (state.isTempDraftMode && state.postId.trim()) {
        try {
          state.setLoadingKey("serverTempDraftSave")
          state.setPublishStatus({ tone: "loading", text: "서버 임시초안을 저장하는 중입니다..." }, "page")

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
              }),
            }
          )

          if (typeof response?.data?.version === "number") {
            state.setPostVersion(response.data.version)
          }
          state.saveLocalDraft({ silent: true })
          state.setPublishStatus({ tone: "success", text: "서버 임시초안이 안전하게 저장되었습니다." }, "page")
        } catch {
          state.saveLocalDraft({ silent: true })
          state.setPublishStatus(
            { tone: "error", text: "서버 임시저장에 실패하여 로컬 초안으로 안전하게 보관되었습니다." },
            "page"
          )
        } finally {
          state.setLoadingKey("")
        }
        return
      }

      state.saveLocalDraft({ silent: false })
      const noticeText =
        state.editorMode === "edit"
          ? "브라우저 로컬 초안에 안전하게 저장되었습니다."
          : "새 글 로컬 초안이 저장되었습니다."
      state.setPublishStatus({ tone: "success", text: noticeText }, "page")
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [])
}
