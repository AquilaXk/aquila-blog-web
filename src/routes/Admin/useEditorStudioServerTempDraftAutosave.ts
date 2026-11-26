import { useEffect, useRef, type MutableRefObject } from "react"
import type { EditorMode, PostVisibility } from "./editorStudioState"
import type { SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import { buildEditorStateFingerprint } from "./editorStudioMetaModel"

const SERVER_TEMP_DRAFT_AUTOSAVE_DEBOUNCE_MS = 2500

type UseEditorStudioServerTempDraftAutosaveParams = {
  isTempDraftMode: boolean
  editorMode: EditorMode
  postId: string
  loadingKey: string
  postTitle: string
  postContent: string
  postSummary: string
  postSummarySource: "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE"
  summaryIntent: SummaryIntent
  postThumbnailUrl: string
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailZoom: number
  postTags: string[]
  postCategory: string
  postVisibility: PostVisibility
  serverBaselineEditorFingerprintRef: MutableRefObject<string>
  onSaveServerTempDraft: (options?: { silent?: boolean }) => Promise<boolean>
}

export const useEditorStudioServerTempDraftAutosave = ({
  isTempDraftMode,
  editorMode,
  postId,
  loadingKey,
  postTitle,
  postContent,
  postSummary,
  postSummarySource,
  summaryIntent,
  postThumbnailUrl,
  postThumbnailFocusX,
  postThumbnailFocusY,
  postThumbnailZoom,
  postTags,
  postCategory,
  postVisibility,
  serverBaselineEditorFingerprintRef,
  onSaveServerTempDraft,
}: UseEditorStudioServerTempDraftAutosaveParams) => {
  const failedFingerprintRef = useRef("")
  const saveHandlerRef = useRef(onSaveServerTempDraft)
  saveHandlerRef.current = onSaveServerTempDraft

  useEffect(() => {
    failedFingerprintRef.current = ""
  }, [postId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const resetFailed = () => {
      failedFingerprintRef.current = ""
    }
    window.addEventListener("online", resetFailed)
    return () => window.removeEventListener("online", resetFailed)
  }, [])

  useEffect(() => {
    const normalizedPostId = postId.trim()
    const hasDraftContent = Boolean(postTitle.trim() || postContent.trim())
    if (!isTempDraftMode || editorMode !== "edit" || !normalizedPostId || !hasDraftContent || loadingKey) {
      return
    }

    const currentFingerprint = buildEditorStateFingerprint({
      title: postTitle,
      content: postContent,
      summary: postSummary,
      summarySource: postSummarySource,
      summaryIntent,
      thumbnailUrl: postThumbnailUrl,
      thumbnailFocusX: postThumbnailFocusX,
      thumbnailFocusY: postThumbnailFocusY,
      thumbnailZoom: postThumbnailZoom,
      tags: postTags,
      category: postCategory,
      visibility: postVisibility,
    })

    if (
      currentFingerprint === serverBaselineEditorFingerprintRef.current ||
      currentFingerprint === failedFingerprintRef.current
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveHandlerRef.current({ silent: true }).then((ok) => {
        if (!ok) {
          failedFingerprintRef.current = currentFingerprint
        } else if (failedFingerprintRef.current === currentFingerprint) {
          failedFingerprintRef.current = ""
        }
      })
    }, SERVER_TEMP_DRAFT_AUTOSAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    editorMode,
    isTempDraftMode,
    loadingKey,
    postCategory,
    postContent,
    postId,
    postSummary,
    postSummarySource,
    postTags,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailUrl,
    postThumbnailZoom,
    postTitle,
    postVisibility,
    serverBaselineEditorFingerprintRef,
    summaryIntent,
  ])
}
