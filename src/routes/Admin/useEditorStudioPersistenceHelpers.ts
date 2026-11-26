// 참조 구현: TryGhost/Ghost (MIT) — 에디터 영속성 헬퍼 및 핑거프린트 유틸
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { apiFetch } from "src/apis/backend/client"
import { normalizeCategoryValue } from "src/libs/utils"
import { resolveEditorFailureRecovery, type EditorFailureRecovery } from "./editorFailureRecoveryModel"
import { buildLocalDraftFingerprint } from "./editorStudioMetaModel"
import { captureLocalDraftCleanup } from "./editorStudioStorageModel"
import type { LocalDraftBaselineReadySignal } from "./useEditorStudioDraftLifecycleModel"
import type { CanonicalSummaryState, SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import type { PostVisibility, RsData } from "src/types"
import type { ApiPostWriteResult } from "src/apis/backend/posts/PostApiDtos"

export type StudioSetState<T> = Dispatch<SetStateAction<T>>
export type NoticeTone = "idle" | "loading" | "success" | "error"
export type PublishNotice = { tone: NoticeTone; text: string }
export type PublishTarget = "page" | "modal"
export type EditorMode = "create" | "edit"

export type PostWriteResult = ApiPostWriteResult & {
  tempDraft?: boolean | null
}

export type EditorFingerprintPayload = {
  title: string
  content: string
  summary: string
  summarySource: CanonicalSummaryState["summarySource"]
  summaryIntent: SummaryIntent
  thumbnailUrl: string
  thumbnailFocusX: number
  thumbnailFocusY: number
  thumbnailZoom: number
  tags: string[]
  category: string
  visibility: PostVisibility
}

export type UseEditorStudioPersistenceParams = {
  editorMode: EditorMode
  postId: string
  postVersion: number | null
  postTitle: string
  postTags: string[]
  tagDraft?: string
  postCategory: string
  customCategoryCatalog?: ReadonlyArray<string>
  postSummary: string
  postSummarySource: CanonicalSummaryState["summarySource"]
  summaryIntent: SummaryIntent
  postThumbnailUrl: string
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailZoom: number
  postVisibility: PostVisibility
  effectiveThumbnailUrl: string
  loadingKey: string
  getCurrentPostContent: () => string
  lastWriteFingerprintRef: MutableRefObject<string>
  lastWriteIdempotencyKeyRef: MutableRefObject<string>
  lastLocalDraftFingerprintRef: MutableRefObject<string>
  serverBaselineEditorFingerprintRef: MutableRefObject<string>
  defaultThumbnailFocusX: number
  defaultThumbnailFocusY: number
  defaultThumbnailZoom: number
  addTagsToPost?: (values: string[]) => string[]
  commitPostCategory?: () => string
  setTagDraft?: StudioSetState<string>
  setPostCategory?: StudioSetState<string>
  setEditorMode: StudioSetState<EditorMode>
  setIsTempDraftMode: StudioSetState<boolean>
  setPostId: StudioSetState<string>
  setPostVersion: StudioSetState<number | null>
  setPostSummary: StudioSetState<string>
  setPostSummarySource: StudioSetState<CanonicalSummaryState["summarySource"]>
  setSummaryIntent: StudioSetState<SummaryIntent>
  setLocalDraftSavedAt: StudioSetState<string>
  setPublishStatus: (notice: PublishNotice, target?: PublishTarget) => void
  setLoadingKey: StudioSetState<string>
  setResult: StudioSetState<string>
  setPostThumbnailUrl: StudioSetState<string>
  setPostThumbnailFocusX: StudioSetState<number>
  setPostThumbnailFocusY: StudioSetState<number>
  setPostThumbnailZoom: StudioSetState<number>
  setPreviewThumbnailSourceUrl: StudioSetState<string>
  setIsPreviewThumbnailError: StudioSetState<boolean>
  setThumbnailImageFileName: StudioSetState<string>
  composeEditorContent: (
    content: string,
    tags: string[],
    meta: { category: string; thumbnail: string }
  ) => string
  toFlags: (visibility: PostVisibility) => { published: boolean; listed: boolean }
  buildEditorStateFingerprint: (payload: EditorFingerprintPayload) => string
  dedupeStrings: (items: string[]) => string[]
  detectPublishPlaceholderIssue: (content: string) => string
  refreshPublicPostReadViews: (affectedPostId?: string | number) => Promise<void>
  pretty: (value: unknown) => string
  generateIdempotencyKey: () => string
  signalLocalDraftBaselineReady: (signal?: LocalDraftBaselineReadySignal) => void
  cancelPendingAutosave?: () => void
  saveLocalDraft?: (options?: { silent?: boolean; force?: boolean }) => void
  uploadWithConflictRetry: (requestUpload: () => Promise<Response>) => Promise<Response>
  normalizeSafeImageUrl: (raw: string) => string
  extractImageFileFromClipboard: (clipboardData: DataTransfer | null) => File | null
}

export const buildTempDraftSaveSummaryFields = (
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

export const isBrowserOnline = () =>
  typeof navigator === "undefined" ? undefined : navigator.onLine

export const armLocalDraftFingerprintBaseline = (
  lastLocalDraftFingerprintRef: MutableRefObject<string>,
  payload: EditorFingerprintPayload,
  dedupeStrings: (items: string[]) => string[]
): string => {
  const fingerprint = buildLocalDraftFingerprint({
    title: payload.title,
    content: payload.content,
    summary: payload.summary,
    summarySource: payload.summarySource,
    summaryIntent: payload.summaryIntent,
    thumbnailUrl: payload.thumbnailUrl,
    thumbnailFocusX: payload.thumbnailFocusX,
    thumbnailFocusY: payload.thumbnailFocusY,
    thumbnailZoom: payload.thumbnailZoom,
    tags: dedupeStrings(payload.tags),
    category: payload.category.trim() ? normalizeCategoryValue(payload.category) : "",
    visibility: payload.visibility,
  })
  lastLocalDraftFingerprintRef.current = fingerprint
  return fingerprint
}

export type ServerTempDraftSaveExecutionInput = {
  silent: boolean
  isEn: boolean
  normalizedPostId: string
  postTitle: string
  currentPostContent: string
  composed: string
  postVersion: number | null
  effectiveTags: string[]
  effectiveCategory: string
  effectiveThumbnailUrl: string
  postSummary: string
  postSummarySource: string
  getCurrentPostContent: () => string
  applyCanonicalWriteResponse: (response: RsData<PostWriteResult>) => CanonicalSummaryState | null
  buildSuccessfulWriteFingerprintPayload: (
    content: string,
    canonicalSummary: CanonicalSummaryState,
    tags: string[],
    category: string
  ) => EditorFingerprintPayload
  buildEditorStateFingerprint: (payload: EditorFingerprintPayload) => string
  dedupeStrings: (items: string[]) => string[]
  serverBaselineEditorFingerprintRef: MutableRefObject<string>
  lastLocalDraftFingerprintRef: MutableRefObject<string>
  cancelPendingAutosave?: () => void
  signalLocalDraftBaselineReady: (signal?: LocalDraftBaselineReadySignal) => void
  saveLocalDraft?: (options?: { silent?: boolean; force?: boolean }) => void
  setPostVersion: StudioSetState<number | null>
  setLocalDraftSavedAt: StudioSetState<string>
  setLoadingKey: StudioSetState<string>
  setLastSaveError: (err: EditorFailureRecovery["result"] | null) => void
  setPublishStatus: (notice: PublishNotice, target?: PublishTarget) => void
}

export const executeServerTempDraftSave = async ({
  silent, isEn, normalizedPostId, postTitle, currentPostContent, composed, postVersion,
  effectiveTags, effectiveCategory, effectiveThumbnailUrl, postSummary, postSummarySource,
  getCurrentPostContent, applyCanonicalWriteResponse, buildSuccessfulWriteFingerprintPayload,
  buildEditorStateFingerprint, dedupeStrings, serverBaselineEditorFingerprintRef,
  lastLocalDraftFingerprintRef, cancelPendingAutosave, signalLocalDraftBaselineReady,
  saveLocalDraft, setPostVersion, setLocalDraftSavedAt, setLoadingKey, setLastSaveError,
  setPublishStatus,
}: ServerTempDraftSaveExecutionInput): Promise<boolean> => {
  const summaryPayload = buildTempDraftSaveSummaryFields(postSummary, postSummarySource)
  try {
    if (!silent) {
      setLastSaveError(null)
      setLoadingKey("serverTempDraftSave")
      setPublishStatus(
        { tone: "loading", text: isEn ? "Saving draft to server..." : "서버 임시초안을 저장하는 중입니다..." },
        "page"
      )
    }
    const response = await apiFetch<RsData<PostWriteResult>>(
      `/post/api/v1/posts/temp/${encodeURIComponent(normalizedPostId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: postTitle,
          content: composed,
          version: typeof postVersion === "number" ? postVersion : 0,
          summary: summaryPayload.summary,
          summaryMode: summaryPayload.summaryMode,
          thumbnail: effectiveThumbnailUrl.trim() || null,
        }),
      }
    )
    const nextVersion = typeof response?.data?.version === "number" ? response.data.version : postVersion
    setPostVersion(nextVersion)
    if (!silent || getCurrentPostContent() === currentPostContent) {
      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (canonicalSummary) {
        const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(
          currentPostContent, canonicalSummary, effectiveTags, effectiveCategory
        )
        serverBaselineEditorFingerprintRef.current = buildEditorStateFingerprint(fingerprintPayload)
        cancelPendingAutosave?.()
        const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: normalizedPostId })
        const removed = cleanupSubmittedDraft()
        signalLocalDraftBaselineReady({
          baselineFingerprint: armLocalDraftFingerprintBaseline(
            lastLocalDraftFingerprintRef, fingerprintPayload, dedupeStrings
          ),
        })
        if (removed) setLocalDraftSavedAt("")
      }
    }
    if (!silent) {
      setPublishStatus(
        { tone: "success", text: isEn ? "Server draft saved safely." : "서버 임시초안이 안전하게 저장되었습니다." },
        "page"
      )
    }
    return true
  } catch (error) {
    saveLocalDraft?.({ silent: true, force: true })
    if (!silent) {
      setPublishStatus(
        {
          tone: "error",
          text: isEn
            ? "Server save failed; kept safely as a local draft."
            : "서버 임시저장에 실패하여 로컬 초안으로 안전하게 보관되었습니다.",
        },
        "page"
      )
    } else {
      const recovery = resolveEditorFailureRecovery(error, { action: "modify", isOnline: isBrowserOnline() })
      if (recovery.result.errorType === "version-conflict") {
        setLastSaveError(recovery.result)
        setPublishStatus({ tone: "error", text: recovery.statusText }, "page")
      }
    }
    return false
  } finally {
    if (!silent) setLoadingKey("")
  }
}
