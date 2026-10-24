import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import { captureLocalDraftCleanup } from "./editorStudioStorageModel"
import { apiFetch } from "src/apis/backend/client"
import type { ApiPostWriteResult } from "src/apis/backend/posts/PostApiDtos"
import { normalizeCategoryValue } from "src/libs/utils"
import { resolveEditorFailureRecovery } from "./editorFailureRecoveryModel"
import { buildLocalDraftFingerprint } from "./editorStudioMetaModel"
import { isTempDraftTitlePlaceholder } from "./editorTempDraft"
import {
  resolveCreateWritePostId,
  type LocalDraftBaselineReadySignal,
} from "./useEditorStudioDraftLifecycleModel"
import {
  resolveSummaryWriteCompletion,
  toCreateSummaryWriteFields,
  toModifySummaryWriteFields,
  type CanonicalSummaryState,
  type SummaryIntent,
} from "./EditorStudioWorkspaceControllerRootModel"
import { useEditorStudioPersistenceUploads } from "./useEditorStudioPersistenceModel"
import { resolvePostSaveRefresh } from "./editorPostSaveRefresh"

import type { PostVisibility, RsData } from "src/types"

type StudioSetState<T> = Dispatch<SetStateAction<T>>
type NoticeTone = "idle" | "loading" | "success" | "error"
type PublishNotice = { tone: NoticeTone; text: string }
type PublishTarget = "page" | "modal"
type EditorMode = "create" | "edit"

type PostWriteResult = ApiPostWriteResult

type EditorFingerprintPayload = {
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

const isBrowserOnline = () => (typeof navigator === "undefined" ? undefined : navigator.onLine)

const armLocalDraftFingerprintBaseline = (
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
    category: payload.category ? normalizeCategoryValue(payload.category) : "",
    visibility: payload.visibility,
  })
  lastLocalDraftFingerprintRef.current = fingerprint
  return fingerprint
}

type UseEditorStudioPersistenceParams = {
  editorMode: EditorMode
  postId: string
  postVersion: number | null
  postTitle: string
  postTags: string[]
  postCategory: string
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
  uploadWithConflictRetry: (requestUpload: () => Promise<Response>) => Promise<Response>
  normalizeSafeImageUrl: (raw: string) => string
  extractImageFileFromClipboard: (clipboardData: DataTransfer | null) => File | null
}

export const useEditorStudioPersistence = ({
  buildEditorStateFingerprint, composeEditorContent, dedupeStrings, defaultThumbnailFocusX,
  defaultThumbnailFocusY, defaultThumbnailZoom, detectPublishPlaceholderIssue, editorMode,
  effectiveThumbnailUrl, extractImageFileFromClipboard, generateIdempotencyKey,
  lastLocalDraftFingerprintRef, lastWriteFingerprintRef, lastWriteIdempotencyKeyRef,
  loadingKey, normalizeSafeImageUrl, postCategory, getCurrentPostContent, postId,
  postSummary, postSummarySource, summaryIntent, postTags, postThumbnailFocusX,
  postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVersion,
  postVisibility, pretty, refreshPublicPostReadViews, serverBaselineEditorFingerprintRef,
  signalLocalDraftBaselineReady, setEditorMode, setIsPreviewThumbnailError,
  setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
  setPostId, setPostThumbnailFocusX, setPostThumbnailFocusY,
  setPostThumbnailUrl, setPostThumbnailZoom, setPostVersion, setPostSummary,
  setPostSummarySource, setSummaryIntent, setPreviewThumbnailSourceUrl, setPublishStatus,
  setResult, setThumbnailImageFileName, toFlags, uploadWithConflictRetry,
}: UseEditorStudioPersistenceParams) => {
  const {
    handleMarkdownEditorImageUpload,
    handleMarkdownEditorFileUpload,
    handleUploadThumbnailImage,
    handleThumbnailImageFileChange,
    handleThumbnailPaste,
  } = useEditorStudioPersistenceUploads({
    defaultThumbnailFocusX,
    defaultThumbnailFocusY,
    defaultThumbnailZoom,
    extractImageFileFromClipboard,
    loadingKey,
    normalizeSafeImageUrl,
    setIsPreviewThumbnailError,
    setLoadingKey,
    setPostThumbnailFocusX,
    setPostThumbnailFocusY,
    setPostThumbnailUrl,
    setPostThumbnailZoom,
    setPreviewThumbnailSourceUrl,
    setPublishStatus,
    setThumbnailImageFileName,
    uploadWithConflictRetry,
  })

  const currentSummaryRef = useRef<CanonicalSummaryState>({
    summary: postSummary,
    summarySource: postSummarySource,
    intent: summaryIntent,
  })
  currentSummaryRef.current = {
    summary: postSummary,
    summarySource: postSummarySource,
    intent: summaryIntent,
  }

  const reportValidationError = useCallback(
    (message: string): false => {
      setPublishStatus({ tone: "error", text: message })
      setResult(pretty({ error: message }))
      return false
    },
    [pretty, setPublishStatus, setResult]
  )

  const validateContentPreflight = useCallback(
    (currentPostContent: string): boolean => {
      if (!postTitle.trim()) return reportValidationError("제목을 입력해주세요.")
      if (!currentPostContent.trim()) return reportValidationError("본문을 입력해주세요.")
      const placeholderIssue = detectPublishPlaceholderIssue(currentPostContent)
      if (placeholderIssue) return reportValidationError(placeholderIssue)
      return true
    },
    [detectPublishPlaceholderIssue, postTitle, reportValidationError]
  )

  const applyCanonicalWriteResponse = useCallback(
    (response: RsData<PostWriteResult>) => {
      const resolvedSummary = resolveSummaryWriteCompletion(
        { summary: postSummary, summarySource: postSummarySource, intent: summaryIntent },
        { summary: response.data?.summary, source: response.data?.summarySource },
        currentSummaryRef.current
      )
      if (!resolvedSummary.ok) {
        const message = "저장된 canonical summary 응답이 올바르지 않습니다."
        setPublishStatus({ tone: "error", text: message })
        setResult(pretty({ error: message, response }))
        return null
      }

      const canonicalSummary = resolvedSummary.state
      setPostSummary(resolvedSummary.editorState.summary)
      setPostSummarySource(resolvedSummary.editorState.summarySource)
      setSummaryIntent(resolvedSummary.editorState.intent)
      return canonicalSummary
    },
    [
      postSummary, postSummarySource, pretty, setPostSummary, setPostSummarySource,
      setPublishStatus, setResult, setSummaryIntent, summaryIntent,
    ]
  )

  const buildSuccessfulWriteFingerprintPayload = useCallback(
    (content: string, canonicalSummary: CanonicalSummaryState): EditorFingerprintPayload => ({
      title: postTitle,
      content,
      summary: canonicalSummary.summary,
      summarySource: canonicalSummary.summarySource,
      summaryIntent: canonicalSummary.intent,
      thumbnailUrl: postThumbnailUrl,
      thumbnailFocusX: postThumbnailFocusX,
      thumbnailFocusY: postThumbnailFocusY,
      thumbnailZoom: postThumbnailZoom,
      tags: postTags,
      category: postCategory,
      visibility: postVisibility,
    }),
    [
      postCategory, postTags, postThumbnailFocusX, postThumbnailFocusY,
      postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility,
    ]
  )

  const buildModifyPostRequestBody = useCallback(
    (content: string) => ({
      title: postTitle,
      content: composeEditorContent(content, postTags, {
        category: postCategory,
        thumbnail: effectiveThumbnailUrl,
      }),
      ...toModifySummaryWriteFields(summaryIntent),
      ...toFlags(postVisibility),
      version: postVersion,
    }),
    [
      composeEditorContent, effectiveThumbnailUrl, postCategory, postTags,
      postTitle, postVersion, postVisibility, summaryIntent, toFlags,
    ]
  )

  const handleWritePost = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode === "edit" || postId.trim()) {
      return reportValidationError(
        "현재는 수정 모드입니다. 새 글을 만들려면 먼저 '새 글 모드 전환'을 눌러주세요."
      )
    }
    if (!validateContentPreflight(currentPostContent)) return false

    try {
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "create" })
      setLoadingKey("writePost")
      setPublishStatus({ tone: "loading", text: "글 작성 중입니다..." })
      const contentWithMetadata = composeEditorContent(currentPostContent, postTags, {
        category: postCategory,
        thumbnail: effectiveThumbnailUrl,
      })

      const summaryWriteFields = toCreateSummaryWriteFields(summaryIntent)
      const fingerprint = JSON.stringify({
        title: postTitle,
        content: contentWithMetadata,
        visibility: postVisibility,
        ...summaryWriteFields,
      })
      if (lastWriteFingerprintRef.current !== fingerprint || !lastWriteIdempotencyKeyRef.current) {
        lastWriteFingerprintRef.current = fingerprint
        lastWriteIdempotencyKeyRef.current = generateIdempotencyKey()
      }

      const response = await apiFetch<RsData<PostWriteResult>>("/post/api/v1/posts", {
        method: "POST",
        headers: {
          "Idempotency-Key": lastWriteIdempotencyKeyRef.current,
        },
        body: JSON.stringify({
          title: postTitle,
          content: contentWithMetadata,
          ...summaryWriteFields,
          ...toFlags(postVisibility),
        }),
      })

      setResult(pretty(response))

      const createWritePostId = resolveCreateWritePostId(response?.data)
      if (!createWritePostId.ok) {
        setPublishStatus({ tone: "error", text: createWritePostId.statusText })
        setResult(pretty({ error: createWritePostId.statusText, response }))
        return false
      }

      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (!canonicalSummary) return false
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(currentPostContent, canonicalSummary)

      setPostId(createWritePostId.postId)
      setPostVersion(typeof response.data?.version === "number" ? response.data.version : null)
      setEditorMode("edit")
      setIsTempDraftMode(false)
      serverBaselineEditorFingerprintRef.current = buildEditorStateFingerprint(fingerprintPayload)
      lastWriteFingerprintRef.current = ""
      lastWriteIdempotencyKeyRef.current = ""

      const visibilityText =
        postVisibility === "PUBLIC_LISTED"
          ? "전체 공개(목록 노출)"
          : postVisibility === "PUBLIC_UNLISTED"
            ? "링크 공개(목록 미노출)"
            : "비공개"

      const removedSubmittedDraft = cleanupSubmittedDraft()
      signalLocalDraftBaselineReady({
        baselineFingerprint: armLocalDraftFingerprintBaseline(
          lastLocalDraftFingerprintRef,
          fingerprintPayload,
          dedupeStrings
        ),
      })
      if (removedSubmittedDraft) {
        setLocalDraftSavedAt("")
      }

      setPublishStatus(
        await resolvePostSaveRefresh(
          () => refreshPublicPostReadViews(createWritePostId.postId),
          `작성 완료: ${response.msg} (공개 범위: ${visibilityText})`
        ),
        "page"
      )
      return true
    } catch (error) {
      const recovery = resolveEditorFailureRecovery(error, {
        action: "write",
        isOnline: isBrowserOnline(),
      })
      setResult(pretty(recovery.result))
      setPublishStatus({ tone: "error", text: recovery.statusText })
      return false
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildSuccessfulWriteFingerprintPayload,
    composeEditorContent, dedupeStrings, editorMode, effectiveThumbnailUrl, generateIdempotencyKey,
    getCurrentPostContent, lastLocalDraftFingerprintRef, lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef, postCategory, postId, summaryIntent, postTags, postTitle,
    postVisibility, pretty, refreshPublicPostReadViews, reportValidationError,
    serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady, setEditorMode,
    setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
    setPostId, setPostVersion, setPublishStatus, setResult, toFlags, validateContentPreflight,
  ])

  const handleModifyPost = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode !== "edit" || !postId.trim()) {
      return reportValidationError("수정할 글 ID를 먼저 선택해주세요.")
    }
    if (!validateContentPreflight(currentPostContent)) return false
    if (postVersion == null) {
      return reportValidationError("최신 글 버전을 불러오지 못했습니다. 글을 다시 열어주세요.")
    }

    try {
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLoadingKey("modifyPost")
      setPublishStatus({ tone: "loading", text: "글 수정 중입니다..." })

      const response = await apiFetch<RsData<PostWriteResult>>(`/post/api/v1/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(buildModifyPostRequestBody(currentPostContent)),
      })

      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (!canonicalSummary) return false
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(currentPostContent, canonicalSummary)

      setPostVersion(typeof response?.data?.version === "number" ? response.data.version : postVersion)
      setIsTempDraftMode(isTempDraftTitlePlaceholder(postTitle) && postVisibility === "PRIVATE")
      serverBaselineEditorFingerprintRef.current = buildEditorStateFingerprint(fingerprintPayload)
      const removedSubmittedDraft = cleanupSubmittedDraft()
      signalLocalDraftBaselineReady({
        baselineFingerprint: armLocalDraftFingerprintBaseline(
          lastLocalDraftFingerprintRef,
          fingerprintPayload,
          dedupeStrings
        ),
      })
      if (removedSubmittedDraft) {
        setLocalDraftSavedAt("")
      }
      setPublishStatus(
        await resolvePostSaveRefresh(
          () => refreshPublicPostReadViews(postId),
          `수정 완료: ${response.msg}`
        ),
        "page"
      )
      setResult(pretty(response))
      return true
    } catch (error) {
      const recovery = resolveEditorFailureRecovery(error, {
        action: "modify",
        isOnline: isBrowserOnline(),
      })
      setPublishStatus({ tone: "error", text: recovery.statusText })
      setResult(pretty(recovery.result))
      return false
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildModifyPostRequestBody,
    buildSuccessfulWriteFingerprintPayload, dedupeStrings, editorMode, getCurrentPostContent,
    lastLocalDraftFingerprintRef, postId, postTitle, postVersion, postVisibility,
    pretty, refreshPublicPostReadViews, reportValidationError, serverBaselineEditorFingerprintRef,
    signalLocalDraftBaselineReady, setIsTempDraftMode, setLoadingKey,
    setLocalDraftSavedAt, setPostVersion, setPublishStatus, setResult,
    validateContentPreflight,
  ])

  const handlePublishTempDraft = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode !== "edit" || !postId.trim()) {
      return reportValidationError("작성할 새 글을 먼저 불러와주세요.")
    }
    if (!validateContentPreflight(currentPostContent)) return false
    if (postVersion == null) {
      return reportValidationError("새 글 버전을 불러오지 못했습니다. 글을 다시 열어주세요.")
    }

    try {
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLoadingKey("publishTempPost")
      setPublishStatus({ tone: "loading", text: "새 글을 작성하는 중입니다..." })

      const response = await apiFetch<RsData<PostWriteResult>>(`/post/api/v1/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(buildModifyPostRequestBody(currentPostContent)),
      })
      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (!canonicalSummary) return false
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(currentPostContent, canonicalSummary)
      setPostVersion(typeof response?.data?.version === "number" ? response.data.version : postVersion)
      setIsTempDraftMode(false)
      serverBaselineEditorFingerprintRef.current = buildEditorStateFingerprint(fingerprintPayload)
      const removedSubmittedDraft = cleanupSubmittedDraft()
      signalLocalDraftBaselineReady({
        baselineFingerprint: armLocalDraftFingerprintBaseline(
          lastLocalDraftFingerprintRef,
          fingerprintPayload,
          dedupeStrings
        ),
      })
      if (removedSubmittedDraft) {
        setLocalDraftSavedAt("")
      }
      setPublishStatus(
        await resolvePostSaveRefresh(
          () => refreshPublicPostReadViews(postId),
          "새 글 작성이 완료되었습니다."
        ),
        "page"
      )
      setResult(pretty(response))
      return true
    } catch (error) {
      const recovery = resolveEditorFailureRecovery(error, {
        action: "publish-temp",
        isOnline: isBrowserOnline(),
      })
      setPublishStatus({ tone: "error", text: recovery.statusText })
      setResult(pretty(recovery.result))
      return false
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildModifyPostRequestBody,
    buildSuccessfulWriteFingerprintPayload, dedupeStrings, editorMode, getCurrentPostContent,
    lastLocalDraftFingerprintRef, postId, postVersion, pretty, refreshPublicPostReadViews,
    reportValidationError, serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady,
    setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
    setPostVersion, setPublishStatus, setResult, validateContentPreflight,
  ])

  return {
    handleMarkdownEditorImageUpload,
    handleMarkdownEditorFileUpload,
    handleUploadThumbnailImage,
    handleThumbnailImageFileChange,
    handleThumbnailPaste,
    handleWritePost,
    handleModifyPost,
    handlePublishTempDraft,
  }
}
