import { useCallback, useRef, useState } from "react"
import { captureLocalDraftCleanup } from "./editorStudioStorageModel"
import { apiFetch } from "src/apis/backend/client"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import { resolveEditorFailureRecovery, type EditorFailureRecovery } from "./editorFailureRecoveryModel"
import { isTempDraftCandidate } from "./editorTempDraft"
import { resolveCreateWritePostId } from "./useEditorStudioDraftLifecycleModel"
import { resolveCanonicalCategoryFromCatalog } from "./useEditorStudioMetaCatalog"
import { extractPendingTagDraftValues } from "./useEditorStudioPublishModalFlow"
import {
  resolveSummaryWriteCompletion,
  toCreateSummaryWriteFields,
  toModifySummaryWriteFields,
  type CanonicalSummaryState,
} from "./EditorStudioWorkspaceControllerRootModel"
import {
  formatPostVisibilityLabel,
  useEditorStudioPersistenceUploads,
} from "./useEditorStudioPersistenceModel"
import { resolvePostSaveRefresh } from "./editorPostSaveRefresh"
import {
  armLocalDraftFingerprintBaseline, buildPublishingMetadataPayload, executeServerTempDraftSave,
  isBrowserOnline, resolveEffectivePublishingFlags, validateEditorContentPreflight,
  type EditorFingerprintPayload, type PostWriteResult, type UseEditorStudioPersistenceParams,
} from "./useEditorStudioPersistenceHelpers"

import type { RsData } from "src/types"

export const useEditorStudioPersistence = ({
  addTagsToPost, buildEditorStateFingerprint, commitPostCategory, composeEditorContent, customCategoryCatalog,
  dedupeStrings, defaultThumbnailFocusX, defaultThumbnailFocusY, defaultThumbnailZoom,
  detectPublishPlaceholderIssue, editorMode, effectiveThumbnailUrl, extractImageFileFromClipboard,
  generateIdempotencyKey, lastLocalDraftFingerprintRef, lastWriteFingerprintRef,
  lastWriteIdempotencyKeyRef, loadingKey, normalizeSafeImageUrl, onPostCreatedRouteSync, postCategory,
  getCurrentPostContent, postId, postSummary, postSummarySource, summaryIntent, postTags,
  postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle,
  postVersion, postVisibility, postScheduledAt = "", postSeriesName = "", postSeriesOrder = null,
  postCanonicalUrl = "", pretty, refreshPublicPostReadViews, saveLocalDraft,
  serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady, cancelPendingAutosave, setEditorMode,
  setIsPreviewThumbnailError, setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
  setPostCategory, setPostId, setPostThumbnailFocusX, setPostThumbnailFocusY,
  setPostThumbnailUrl, setPostThumbnailZoom, setPostVersion, setPostSummary,
  setPostSummarySource, setSummaryIntent, setPreviewThumbnailSourceUrl, setPublishStatus,
  setResult, setTagDraft, setThumbnailImageFileName, tagDraft, toFlags, uploadWithConflictRetry,
}: UseEditorStudioPersistenceParams) => {
  const { language } = useLanguage()
  const isEn = language === "en"
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
      const error = validateEditorContentPreflight({
        postTitle,
        currentPostContent,
        postThumbnailUrl,
        postCanonicalUrl,
        postSeriesOrder,
        postScheduledAt,
        postVisibility,
        language,
        normalizeSafeImageUrl,
        detectPublishPlaceholderIssue,
      })
      return error ? reportValidationError(error) : true
    },
    [
      detectPublishPlaceholderIssue, language, normalizeSafeImageUrl, postCanonicalUrl, postScheduledAt,
      postSeriesOrder, postThumbnailUrl, postTitle, postVisibility, reportValidationError,
    ]
  )

  const applyCanonicalWriteResponse = useCallback(
    (response: RsData<PostWriteResult>) => {
      const resolvedSummary = resolveSummaryWriteCompletion(
        { summary: postSummary, summarySource: postSummarySource, intent: summaryIntent },
        { summary: response.data?.summary, source: response.data?.summarySource },
        currentSummaryRef.current
      )
      if (!resolvedSummary.ok) {
        const message = adminT("editorValidationInvalidSummary", language)
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
      language, postSummary, postSummarySource, pretty, setPostSummary, setPostSummarySource,
      setPublishStatus, setResult, setSummaryIntent, summaryIntent,
    ]
  )

  const tempDraftSaveInFlightRef = useRef(false)
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
    const committedCategory = commitPostCategory
      ? commitPostCategory()
      : resolveCanonicalCategoryFromCatalog(postCategory, customCategoryCatalog ?? [])
    if (!commitPostCategory && committedCategory !== postCategory) {
      setPostCategory?.(committedCategory)
    }
    return { tags: effectiveTags, category: committedCategory }
  }, [addTagsToPost, commitPostCategory, customCategoryCatalog, dedupeStrings, postCategory, postTags, setPostCategory, setTagDraft, tagDraft])

  const reportSaveFailure = useCallback(
    (error: unknown, action: "write" | "modify" | "publish-temp"): false => {
      const recovery = resolveEditorFailureRecovery(error, { action, isOnline: isBrowserOnline(), language })
      setLastSaveError(recovery.result)
      setPublishStatus({ tone: "error", text: recovery.statusText })
      if (recovery.result.errorType === "version-conflict") {
        setPublishStatus({ tone: "error", text: recovery.statusText }, "page")
      }
      setResult(pretty(recovery.result))
      return false
    },
    [language, pretty, setPublishStatus, setResult]
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
      scheduledAt: postScheduledAt,
      seriesName: postSeriesName,
      seriesOrder: postSeriesOrder,
      canonicalUrl: postCanonicalUrl,
    }),
    [
      postCanonicalUrl, postScheduledAt, postSeriesName, postSeriesOrder, postThumbnailFocusX,
      postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility,
    ]
  )

  const buildModifyPostRequestBody = useCallback(
    (content: string, tags: string[], category: string) => {
      const metadataFields = buildPublishingMetadataPayload(
        postScheduledAt,
        postSeriesName,
        postSeriesOrder,
        postCanonicalUrl
      )
      return {
        title: postTitle,
        content: composeEditorContent(content, tags, {
          category,
          thumbnail: effectiveThumbnailUrl,
        }),
        ...toModifySummaryWriteFields(summaryIntent),
        ...resolveEffectivePublishingFlags(postVisibility, Boolean(metadataFields.scheduledAt), toFlags),
        ...metadataFields,
        version: postVersion,
      }
    },
    [
      composeEditorContent, effectiveThumbnailUrl, postCanonicalUrl, postScheduledAt,
      postSeriesName, postSeriesOrder, postTitle, postVersion, postVisibility, summaryIntent, toFlags,
    ]
  )

  const handleWritePost = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode === "edit" || postId.trim()) {
      return reportValidationError(adminT("editorValidationAlreadyEditMode", language))
    }
    if (!validateContentPreflight(currentPostContent)) return false

    try {
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "create" })
      setLastSaveError(null)
      setLoadingKey("writePost")
      setPublishStatus({ tone: "loading", text: adminT("editorSaveWriting", language) })
      const contentWithMetadata = composeEditorContent(currentPostContent, effectiveTags, {
        category: effectiveCategory,
        thumbnail: effectiveThumbnailUrl,
      })

      const metadataFields = buildPublishingMetadataPayload(
        postScheduledAt,
        postSeriesName,
        postSeriesOrder,
        postCanonicalUrl
      )
      const effectiveFlags = resolveEffectivePublishingFlags(
        postVisibility,
        Boolean(metadataFields.scheduledAt),
        toFlags
      )
      const summaryWriteFields = toCreateSummaryWriteFields(summaryIntent)
      const fingerprint = JSON.stringify({
        title: postTitle,
        content: contentWithMetadata,
        visibility: postVisibility,
        ...metadataFields,
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
          ...effectiveFlags,
          ...metadataFields,
        }),
      })

      setResult(pretty(response))

      const createWritePostId = resolveCreateWritePostId(response?.data, language)
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

      const visibilityText = formatPostVisibilityLabel(postVisibility, language)

      cancelPendingAutosave?.()
      const removedSubmittedDraft = cleanupSubmittedDraft()
      const localDraftBaselineFingerprint = armLocalDraftFingerprintBaseline(
        lastLocalDraftFingerprintRef, fingerprintPayload, dedupeStrings
      )
      signalLocalDraftBaselineReady({ baselineFingerprint: localDraftBaselineFingerprint })
      if (removedSubmittedDraft) {
        setLocalDraftSavedAt("")
      }

      const nextPublishNotice = await resolvePostSaveRefresh(
        () => refreshPublicPostReadViews(createWritePostId.postId),
        isEn
          ? `Created: ${response.msg} (Visibility: ${visibilityText})`
          : `작성 완료: ${response.msg} (공개 범위: ${visibilityText})`,
        language
      )
      setPublishStatus(nextPublishNotice, "page")
      setLoadingKey("")
      await onPostCreatedRouteSync?.(createWritePostId.postId, {
        ...fingerprintPayload,
        scheduledAt: fingerprintPayload.scheduledAt ?? "",
        seriesName: fingerprintPayload.seriesName ?? "",
        seriesOrder: fingerprintPayload.seriesOrder ?? null,
        canonicalUrl: fingerprintPayload.canonicalUrl ?? "",
        postId: createWritePostId.postId,
        postVersion: typeof response.data?.version === "number" ? response.data.version : null,
        serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
        localDraftBaselineFingerprint,
        publishNotice: nextPublishNotice,
        resultText: pretty(response),
      })
      return true
    } catch (error) {
      return reportSaveFailure(error, "write")
    } finally {
      setLoadingKey("")
    }
  }, [
    applyCanonicalWriteResponse, buildEditorStateFingerprint, buildSuccessfulWriteFingerprintPayload,
    composeEditorContent, dedupeStrings, editorMode, effectiveThumbnailUrl, generateIdempotencyKey,
    getCurrentPostContent, isEn, language, lastLocalDraftFingerprintRef, lastWriteFingerprintRef,
    lastWriteIdempotencyKeyRef, onPostCreatedRouteSync, postCanonicalUrl, postId, postScheduledAt,
    postSeriesName, postSeriesOrder, postTitle, postVisibility, pretty, refreshPublicPostReadViews,
    reportSaveFailure, reportValidationError, resolveAuthoringMetadataForWrite,
    serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady, cancelPendingAutosave,
    setEditorMode, setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt, setPostId,
    setPostVersion, setPublishStatus, setResult, summaryIntent, toFlags, validateContentPreflight,
  ])

  const handleModifyPost = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode !== "edit" || !postId.trim()) {
      return reportValidationError(adminT("editorValidationSelectPost", language))
    }
    if (!validateContentPreflight(currentPostContent)) return false
    if (postVersion == null) {
      return reportValidationError(adminT("editorValidationVersionMissing", language))
    }

    try {
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLastSaveError(null)
      setLoadingKey("modifyPost")
      setPublishStatus({ tone: "loading", text: adminT("editorSaveModifying", language) })

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
      const modifiedFlags = resolveEffectivePublishingFlags(
        postVisibility,
        Boolean(postScheduledAt.trim()),
        toFlags
      )

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
      cancelPendingAutosave?.()
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
        await resolvePostSaveRefresh(() => refreshPublicPostReadViews(postId), isEn ? `Updated: ${response.msg}` : `수정 완료: ${response.msg}`, language),
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
    isEn, language, lastLocalDraftFingerprintRef, postId, postScheduledAt, postTitle, postVersion,
    postVisibility, pretty, refreshPublicPostReadViews, reportSaveFailure, reportValidationError,
    resolveAuthoringMetadataForWrite, serverBaselineEditorFingerprintRef,
    signalLocalDraftBaselineReady, cancelPendingAutosave, setIsTempDraftMode, setLoadingKey,
    setLocalDraftSavedAt, setPostVersion, setPublishStatus, setResult, toFlags,
    validateContentPreflight,
  ])

  const handlePublishTempDraft = useCallback(async (): Promise<boolean> => {
    const currentPostContent = getCurrentPostContent()
    if (editorMode !== "edit" || !postId.trim()) {
      return reportValidationError(adminT("editorValidationNewPostMissing", language))
    }
    if (!validateContentPreflight(currentPostContent)) return false
    if (postVersion == null) {
      return reportValidationError(adminT("editorValidationNewPostVersionMissing", language))
    }

    try {
      const { tags: effectiveTags, category: effectiveCategory } = resolveAuthoringMetadataForWrite()
      const cleanupSubmittedDraft = captureLocalDraftCleanup({ kind: "post", postId: postId.trim() })
      setLastSaveError(null)
      setLoadingKey("publishTempPost")
      setPublishStatus({ tone: "loading", text: adminT("editorSaveTempPublishing", language) })

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
      cancelPendingAutosave?.()
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
        await resolvePostSaveRefresh(() => refreshPublicPostReadViews(postId), adminT("editorSaveTempDone", language), language),
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
    language, lastLocalDraftFingerprintRef, postId, postVersion, pretty, refreshPublicPostReadViews,
    reportSaveFailure, reportValidationError, resolveAuthoringMetadataForWrite,
    serverBaselineEditorFingerprintRef, signalLocalDraftBaselineReady, cancelPendingAutosave,
    setIsTempDraftMode, setLoadingKey, setLocalDraftSavedAt,
    setPostVersion, setPublishStatus, setResult, validateContentPreflight,
  ])

  const handleSaveServerTempDraft = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      const silent = options?.silent === true
      const normalizedPostId = postId.trim()
      if (editorMode !== "edit" || !normalizedPostId) return false
      if (loadingKey || tempDraftSaveInFlightRef.current) {
        if (!silent) {
          const isPublishInFlight =
            loadingKey === "writePost" || loadingKey === "modifyPost" || loadingKey === "publishTempPost"
          if (!isPublishInFlight) resolveAuthoringMetadataForWrite()
          saveLocalDraft?.({ silent: false, force: true })
          if (!isPublishInFlight) {
            setPublishStatus({
              tone: "success",
              text: isEn
                ? "Another save is in progress; backed up safely as a browser draft."
                : "다른 저장·업로드 작업 중이어서 브라우저 로컬 초안에 먼저 안전 저장했습니다.",
            }, "page")
          }
        }
        return false
      }

      const currentPostContent = getCurrentPostContent()
      const { tags: effectiveTags, category: effectiveCategory } = silent
        ? {
            tags: dedupeStrings(postTags),
            category: resolveCanonicalCategoryFromCatalog(postCategory, customCategoryCatalog ?? []),
          }
        : resolveAuthoringMetadataForWrite()
      const composed = composeEditorContent(currentPostContent, effectiveTags, {
        category: effectiveCategory,
        thumbnail: effectiveThumbnailUrl,
      })
      tempDraftSaveInFlightRef.current = true
      try {
        return await executeServerTempDraftSave({
          silent, isEn, normalizedPostId, postTitle, currentPostContent, composed, postVersion,
          effectiveTags, effectiveCategory, effectiveThumbnailUrl, postSummary, postSummarySource,
          postScheduledAt, postSeriesName, postSeriesOrder, postCanonicalUrl,
          getCurrentPostContent, applyCanonicalWriteResponse, buildSuccessfulWriteFingerprintPayload,
          buildEditorStateFingerprint, dedupeStrings, serverBaselineEditorFingerprintRef,
          lastLocalDraftFingerprintRef, cancelPendingAutosave, signalLocalDraftBaselineReady,
          saveLocalDraft, setPostVersion, setLocalDraftSavedAt, setLoadingKey, setLastSaveError,
          setPublishStatus,
        })
      } finally {
        tempDraftSaveInFlightRef.current = false
      }
    },
    [
      applyCanonicalWriteResponse, buildEditorStateFingerprint, buildSuccessfulWriteFingerprintPayload,
      cancelPendingAutosave, composeEditorContent, customCategoryCatalog, dedupeStrings, editorMode,
      effectiveThumbnailUrl, getCurrentPostContent, isEn, lastLocalDraftFingerprintRef, loadingKey,
      postCanonicalUrl, postCategory, postId, postScheduledAt, postSeriesName, postSeriesOrder,
      postSummary, postSummarySource, postTags, postTitle, postVersion,
      resolveAuthoringMetadataForWrite, saveLocalDraft, serverBaselineEditorFingerprintRef,
      setLoadingKey, setLocalDraftSavedAt, setPostVersion, setPublishStatus,
      signalLocalDraftBaselineReady,
    ]
  )

  return {
    lastSaveError,
    clearLastSaveError,
    handleSaveServerTempDraft,
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
