import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import { captureLocalDraftCleanup } from "./editorStudioStorageModel"
import { apiFetch } from "src/apis/backend/client"
import type { ApiPostWriteResult } from "src/apis/backend/posts/PostApiDtos"
import { normalizeCategoryValue } from "src/libs/utils"
import { resolveEditorFailureRecovery, type EditorFailureRecovery } from "./editorFailureRecoveryModel"
import { buildLocalDraftFingerprint } from "./editorStudioMetaModel"
import { isTempDraftCandidate } from "./editorTempDraft"
import {
  resolveCreateWritePostId,
  type LocalDraftBaselineReadySignal,
} from "./useEditorStudioDraftLifecycleModel"
import { resolveCanonicalCategoryFromCatalog } from "./useEditorStudioMetaCatalog"
import { extractPendingTagDraftValues } from "./useEditorStudioPublishModalFlow"
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

type PostWriteResult = ApiPostWriteResult & {
  tempDraft?: boolean | null
}

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
    category: payload.category.trim() ? normalizeCategoryValue(payload.category) : "",
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
  uploadWithConflictRetry: (requestUpload: () => Promise<Response>) => Promise<Response>
  normalizeSafeImageUrl: (raw: string) => string
  extractImageFileFromClipboard: (clipboardData: DataTransfer | null) => File | null
}

export const useEditorStudioPersistence = ({
  addTagsToPost, buildEditorStateFingerprint, composeEditorContent, customCategoryCatalog,
  dedupeStrings, defaultThumbnailFocusX, defaultThumbnailFocusY, defaultThumbnailZoom,
  detectPublishPlaceholderIssue, editorMode, effectiveThumbnailUrl, extractImageFileFromClipboard,
  generateIdempotencyKey, lastLocalDraftFingerprintRef, lastWriteFingerprintRef,
  lastWriteIdempotencyKeyRef, loadingKey, normalizeSafeImageUrl, postCategory,
  getCurrentPostContent, postId, postSummary, postSummarySource, summaryIntent, postTags,
  postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle,
  postVersion, postVisibility, pretty, refreshPublicPostReadViews,
  serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady, setEditorMode,
  setIsPreviewThumbnailError, setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
  setPostCategory, setPostId, setPostThumbnailFocusX, setPostThumbnailFocusY,
  setPostThumbnailUrl, setPostThumbnailZoom, setPostVersion, setPostSummary,
  setPostSummarySource, setSummaryIntent, setPreviewThumbnailSourceUrl, setPublishStatus,
  setResult, setTagDraft, setThumbnailImageFileName, tagDraft, toFlags, uploadWithConflictRetry,
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

  const [lastSaveError, setLastSaveError] = useState<EditorFailureRecovery["result"] | null>(null)
  const clearLastSaveError = useCallback(() => {
    setLastSaveError(null)
  }, [])

  const resolveAuthoringMetadataForWrite = useCallback(() => {
    const pendingTags = extractPendingTagDraftValues(tagDraft ?? "")
    if (pendingTags.length > 0) {
      addTagsToPost?.(pendingTags)
      setTagDraft?.("")
    } else if ((tagDraft ?? "").length > 0) {
      setTagDraft?.("")
    }
    const effectiveTags = dedupeStrings(pendingTags.length > 0 ? [...postTags, ...pendingTags] : postTags)
    const effectiveCategory = resolveCanonicalCategoryFromCatalog(postCategory, customCategoryCatalog ?? [])
    if (effectiveCategory !== postCategory) {
      setPostCategory?.(effectiveCategory)
    }
    return { tags: effectiveTags, category: effectiveCategory }
  }, [addTagsToPost, customCategoryCatalog, dedupeStrings, postCategory, postTags, setPostCategory, setTagDraft, tagDraft])

  const reportSaveFailure = useCallback(
    (error: unknown, action: "write" | "modify" | "publish-temp"): false => {
      const recovery = resolveEditorFailureRecovery(error, { action, isOnline: isBrowserOnline() })
      setLastSaveError(recovery.result)
      setPublishStatus({ tone: "error", text: recovery.statusText })
      if (recovery.result.errorType === "version-conflict") {
        setPublishStatus({ tone: "error", text: recovery.statusText }, "page")
      }
      setResult(pretty(recovery.result))
      return false
    },
    [pretty, setPublishStatus, setResult]
  )

  const buildSuccessfulWriteFingerprintPayload = useCallback(
    (
      content: string,
      canonicalSummary: CanonicalSummaryState,
      tags: string[],
      category: string
    ): EditorFingerprintPayload => ({
      title: postTitle,
      content,
      summary: canonicalSummary.summary,
      summarySource: canonicalSummary.summarySource,
      summaryIntent: canonicalSummary.intent,
      thumbnailUrl: postThumbnailUrl,
      thumbnailFocusX: postThumbnailFocusX,
      thumbnailFocusY: postThumbnailFocusY,
      thumbnailZoom: postThumbnailZoom,
      tags,
      category,
      visibility: postVisibility,
    }),
    [postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility]
  )

  const buildModifyPostRequestBody = useCallback(
    (content: string, tags: string[], category: string) => ({
      title: postTitle,
      content: composeEditorContent(content, tags, {
        category,
        thumbnail: effectiveThumbnailUrl,
      }),
      ...toModifySummaryWriteFields(summaryIntent),
      ...toFlags(postVisibility),
      version: postVersion,
    }),
    [composeEditorContent, effectiveThumbnailUrl, postTitle, postVersion, postVisibility, summaryIntent, toFlags]
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
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "create" })
      setLastSaveError(null)
      setLoadingKey("writePost")
      setPublishStatus({ tone: "loading", text: "글 작성 중입니다..." })
      const contentWithMetadata = composeEditorContent(currentPostContent, effectiveTags, {
        category: effectiveCategory,
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
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(
        currentPostContent,
        canonicalSummary,
        effectiveTags,
        effectiveCategory
      )

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
      return reportSaveFailure(error, "write")
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildSuccessfulWriteFingerprintPayload,
    composeEditorContent, dedupeStrings, editorMode, effectiveThumbnailUrl, generateIdempotencyKey,
    getCurrentPostContent, lastLocalDraftFingerprintRef, lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef, postId, summaryIntent, postTitle, postVisibility, pretty,
    refreshPublicPostReadViews, reportSaveFailure, reportValidationError, resolveAuthoringMetadataForWrite,
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
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLastSaveError(null)
      setLoadingKey("modifyPost")
      setPublishStatus({ tone: "loading", text: "글 수정 중입니다..." })

      const response = await apiFetch<RsData<PostWriteResult>>(`/post/api/v1/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(buildModifyPostRequestBody(currentPostContent, effectiveTags, effectiveCategory)),
      })

      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (!canonicalSummary) return false
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(
        currentPostContent,
        canonicalSummary,
        effectiveTags,
        effectiveCategory
      )
      const modifiedFlags = toFlags(postVisibility)

      setPostVersion(typeof response?.data?.version === "number" ? response.data.version : postVersion)
      setIsTempDraftMode(
        isTempDraftCandidate({
          title: response?.data?.title ?? postTitle,
          published: response?.data?.published ?? modifiedFlags.published,
          listed: response?.data?.listed ?? modifiedFlags.listed,
          tempDraft: typeof response?.data?.tempDraft === "boolean" ? response.data.tempDraft : false,
        })
      )
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
      return reportSaveFailure(error, "modify")
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildModifyPostRequestBody,
    buildSuccessfulWriteFingerprintPayload, dedupeStrings, editorMode, getCurrentPostContent,
    lastLocalDraftFingerprintRef, postId, postTitle, postVersion, postVisibility,
    pretty, refreshPublicPostReadViews, reportSaveFailure, reportValidationError,
    resolveAuthoringMetadataForWrite, serverBaselineEditorFingerprintRef,
    signalLocalDraftBaselineReady, setIsTempDraftMode, setLoadingKey,
    setLocalDraftSavedAt, setPostVersion, setPublishStatus, setResult, toFlags,
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
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLastSaveError(null)
      setLoadingKey("publishTempPost")
      setPublishStatus({ tone: "loading", text: "새 글을 작성하는 중입니다..." })

      const response = await apiFetch<RsData<PostWriteResult>>(`/post/api/v1/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(buildModifyPostRequestBody(currentPostContent, effectiveTags, effectiveCategory)),
      })
      const canonicalSummary = applyCanonicalWriteResponse(response)
      if (!canonicalSummary) return false
      const fingerprintPayload = buildSuccessfulWriteFingerprintPayload(
        currentPostContent,
        canonicalSummary,
        effectiveTags,
        effectiveCategory
      )
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
      return reportSaveFailure(error, "publish-temp")
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildModifyPostRequestBody,
    buildSuccessfulWriteFingerprintPayload, dedupeStrings, editorMode, getCurrentPostContent,
    lastLocalDraftFingerprintRef, postId, postVersion, pretty, refreshPublicPostReadViews,
    reportSaveFailure, reportValidationError, resolveAuthoringMetadataForWrite,
    serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady,
    setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
    setPostVersion, setPublishStatus, setResult, validateContentPreflight,
  ])

  return {
    lastSaveError,
    clearLastSaveError,
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
