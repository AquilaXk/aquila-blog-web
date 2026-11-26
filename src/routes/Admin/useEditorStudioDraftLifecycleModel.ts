import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { useLanguage } from "src/libs/language"
import { localDraftSourcesEqual, type LocalDraftPayload, type LocalDraftSource } from "./editorStudioMetaModel"
import {
  editorDraftLocalRestored,
  editorDraftLocalSaveDone,
  editorDraftNotice,
} from "./editorStudioDraftNoticeMessages"
import type {
  NoticeTone,
  PublishNotice,
  PublishTarget,
  UseEditorStudioLocalDraftLifecycleParams,
} from "./editorStudioDraftLifecycleTypes"
import {
  describeLocalDraftSlot, listLocalDraftCandidates, readLocalDraftCandidate,
  removeLocalDraftCandidate, resolveCurrentDocumentDraftStorageKey, resolveLocalDraftSource,
} from "./editorStudioStorageModel"
import {
  buildLocalDraftPayloadForSource, clearLocalDraftSuppressionForSource, computeStoredDraftFingerprint,
  decideLocalDraftAutosave, isLocalDraftAutosaveGatedForPostIdTransition, removeLocalDraftCandidateForSource,
  resolveEffectivePendingRestorableDraftFingerprint, resolveLocalDraftShouldAdoptBaseline,
  resolveRestoredPostVersion, selectPreferredLocalDraftCandidate, shouldReleasePostIdTransitionGate,
  type LocalDraftBaselineReadySignal, type LocalDraftFingerprintSnapshot,
} from "./editorStudioDraftAutosaveDecisionModel"
export {
  buildLocalDraftPayloadForSource, clearLocalDraftSuppressionForSource, computeStoredDraftFingerprint,
  decideLocalDraftAutosave, isLocalDraftAutosaveGatedForPostIdTransition, isLocalDraftBaselineSettleLoadingKey,
  isLocalDraftRestoreSuggestionEligible, LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS,
  removeLocalDraftCandidateForSource, resolveCreateWritePostId,
  resolveEffectivePendingRestorableDraftFingerprint, resolveLocalDraftShouldAdoptBaseline,
  resolveRestoredPostVersion, shouldReleasePostIdTransitionGate,
  type CreateWritePostIdResolution, type LocalDraftAutosaveDecision,
  type LocalDraftAutosaveDecisionInput, type LocalDraftBaselineReadySignal,
  type LocalDraftFingerprintSnapshot,
} from "./editorStudioDraftAutosaveDecisionModel"

export const unwrapTempDraftRecoveryResponse = <T extends { id?: string | number | null }>(
  response: unknown
): T | null => {
  if (!response || typeof response !== "object") return null
  const candidate = "data" in response
    ? (response as { data?: T | null }).data
    : (response as T)
  if (!candidate || typeof candidate !== "object") return null
  const rawId = candidate.id
  const hasValidId =
    (typeof rawId === "number" && rawId > 0) ||
    (typeof rawId === "string" && rawId.trim().length > 0)
  return hasValidId ? candidate : null
}

export const useEditorStudioLocalDraftLifecycle = ({
  buildLocalDraftFingerprint, dedupeStrings, editorMode, lastLocalDraftFingerprintRef,
  lastWriteFingerprintRef, lastWriteIdempotencyKeyRef, loadingKey, normalizeCategoryValue,
  persistLocalDraft, postCategory, postContent, getCurrentPostContent, postId, postSummary,
  postSummarySource, summaryIntent, postTags, postThumbnailFocusX, postThumbnailFocusY,
  postThumbnailUrl, postThumbnailZoom, postTitle, postVersion, postVisibility,
  postScheduledAt = "", postSeriesName = "", postSeriesOrder = null, postCanonicalUrl = "", readLocalDraft,
  removeLocalDraft, setEditorMode, setIsTempDraftMode, setLocalDraftSavedAt,
  setPostCategory, setPostContent, setPostId, setPostSummary,
  setPostSummarySource, setSummaryIntent, setPostTags, setPostThumbnailFocusX,
  setPostThumbnailFocusY, setPostThumbnailUrl, setPostThumbnailZoom, setPostTitle,
  setPostVersion, setPostVisibility, setPostScheduledAt, setPostSeriesName,
  setPostSeriesOrder, setPostCanonicalUrl, setPreviewThumbnailSourceUrl, setPublishStatus,
}: UseEditorStudioLocalDraftLifecycleParams) => {
  const { language } = useLanguage()
  const draftSource = useMemo(
    () => resolveLocalDraftSource(editorMode, postId),
    [editorMode, postId]
  )
  const draftSourceRef = useRef(draftSource)
  draftSourceRef.current = draftSource
  const loadingKeyRef = useRef(loadingKey)
  loadingKeyRef.current = loadingKey
  const postVersionRef = useRef(postVersion)
  postVersionRef.current = postVersion
  const pendingSuccessfulBaselineSettleRef = useRef(false)
  const pendingBaselineFingerprintRef = useRef<string | null>(null)
  const postLoadInFlightCountRef = useRef(0)
  const [baselineReadyEpoch, setBaselineReadyEpoch] = useState(0)
  const [postLoadInFlightEpoch, setPostLoadInFlightEpoch] = useState(0)
  const [postIdTransitionAwaitingLoad, setPostIdTransitionAwaitingLoad] = useState(false)
  const [localDraftCandidate, setLocalDraftCandidate] = useState<LocalDraftFingerprintSnapshot | null>(null)
  const [localDraftCandidates, setLocalDraftCandidates] = useState<LocalDraftFingerprintSnapshot[]>([])
  const [restoredLocalDraft, setRestoredLocalDraft] = useState<LocalDraftFingerprintSnapshot[]>([])
  const [dismissedLocalDraft, setDismissedLocalDraft] = useState<LocalDraftFingerprintSnapshot[]>([])
  const postIdTransitionEditorFingerprintRef = useRef<string | null>(null)
  const cachedRestorableDraftRef = useRef<{
    source: LocalDraftSource
    candidates: LocalDraftFingerprintSnapshot[]
    fingerprint: string | null
  } | null>(null)
  const ownSessionAutosaveRef = useRef<{ key: string | null; fingerprint: string } | null>(null)
  const prevEditorModeRef = useRef(editorMode)
  const prevPostIdRef = useRef(postId)
  const isPostIdTransitionGated = isLocalDraftAutosaveGatedForPostIdTransition(
    editorMode,
    postId,
    postIdTransitionAwaitingLoad
  )
  const isPostIdTransitionGatedRef = useRef(isPostIdTransitionGated)
  isPostIdTransitionGatedRef.current = isPostIdTransitionGated
  const isPostLoadInFlight = postLoadInFlightCountRef.current > 0
  const isPostLoadInFlightRef = useRef(isPostLoadInFlight)
  isPostLoadInFlightRef.current = isPostLoadInFlight

  const signalLocalDraftBaselineReady = useCallback((signal?: LocalDraftBaselineReadySignal) => {
    ownSessionAutosaveRef.current = null
    pendingSuccessfulBaselineSettleRef.current = true
    pendingBaselineFingerprintRef.current =
      typeof signal?.baselineFingerprint === "string" ? signal.baselineFingerprint : null
    setBaselineReadyEpoch((value) => value + 1)
  }, [])

  const signalLocalDraftRemoved = useCallback((source: LocalDraftSource) => {
    setLocalDraftCandidate((current) => removeLocalDraftCandidateForSource(current, source))
  }, [])

  const beginLocalDraftPostLoad = useCallback(() => {
    postLoadInFlightCountRef.current += 1
    setPostLoadInFlightEpoch((value) => value + 1)
  }, [])

  const endLocalDraftPostLoad = useCallback(() => {
    postLoadInFlightCountRef.current = Math.max(0, postLoadInFlightCountRef.current - 1)
    setPostLoadInFlightEpoch((value) => value + 1)
  }, [])

  const localDraftCore = useMemo(
    () => ({
      title: postTitle,
      content: postContent,
      summary: postSummary,
      summarySource: postSummarySource,
      summaryIntent,
      thumbnailUrl: postThumbnailUrl,
      thumbnailFocusX: postThumbnailFocusX,
      thumbnailFocusY: postThumbnailFocusY,
      thumbnailZoom: postThumbnailZoom,
      tags: dedupeStrings(postTags),
      category: postCategory.trim() ? normalizeCategoryValue(postCategory) : "",
      visibility: postVisibility,
      scheduledAt: postScheduledAt,
      seriesName: postSeriesName,
      seriesOrder: postSeriesOrder,
      canonicalUrl: postCanonicalUrl,
    }),
    [
      dedupeStrings, normalizeCategoryValue, postCanonicalUrl, postCategory, postContent, postScheduledAt,
      postSeriesName, postSeriesOrder, postSummary, postSummarySource, summaryIntent, postTags,
      postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility,
    ]
  )

  const localDraftFingerprint = useMemo(
    () => buildLocalDraftFingerprint(localDraftCore),
    [buildLocalDraftFingerprint, localDraftCore]
  )

  const pendingAutosaveTimerRef = useRef<number | null>(null)
  const autosaveEpochRef = useRef(0)

  const cancelPendingAutosave = useCallback(() => {
    if (pendingAutosaveTimerRef.current !== null) {
      window.clearTimeout(pendingAutosaveTimerRef.current)
      pendingAutosaveTimerRef.current = null
    }
    autosaveEpochRef.current += 1
  }, [])

  useEffect(() => {
    const normalizedPostId = postId.trim()
    const prevNormalizedPostId = prevPostIdRef.current.trim()
    const postIdChanged = normalizedPostId !== prevNormalizedPostId
    const enteredCreateWithPostId =
      editorMode === "create" &&
      normalizedPostId.length > 0 &&
      (prevEditorModeRef.current === "edit" || postIdChanged)

    if (enteredCreateWithPostId) {
      setPostIdTransitionAwaitingLoad(true)
      postIdTransitionEditorFingerprintRef.current = localDraftFingerprint
    }

    if (
      shouldReleasePostIdTransitionGate({
        editorMode,
        postId: normalizedPostId,
        editorFingerprint: localDraftFingerprint,
        transitionBaselineFingerprint: postIdTransitionEditorFingerprintRef.current,
        awaitingLoad: postIdTransitionAwaitingLoad,
      })
    ) {
      setPostIdTransitionAwaitingLoad(false)
      postIdTransitionEditorFingerprintRef.current = null
    }

    prevEditorModeRef.current = editorMode
    prevPostIdRef.current = postId
  }, [editorMode, localDraftFingerprint, postId, postIdTransitionAwaitingLoad])

  const saveLocalDraft = useCallback((options?: {
    silent?: boolean
    expectedSource?: LocalDraftSource
    force?: boolean
  }): boolean => {
    if (!options?.force && loadingKeyRef.current.length > 0) return false
    if (isPostLoadInFlightRef.current) return false
    if (isPostIdTransitionGatedRef.current) return false

    const source = draftSourceRef.current
    if (options?.expectedSource && !localDraftSourcesEqual(options.expectedSource, source)) {
      return false
    }

    const { core: currentLocalDraftCore, payload } = buildLocalDraftPayloadForSource(
      localDraftCore,
      getCurrentPostContent(),
      source,
      postVersionRef.current
    )
    const hasCurrentDraftContent =
      currentLocalDraftCore.title.trim().length > 0 ||
      currentLocalDraftCore.content.trim().length > 0 ||
      currentLocalDraftCore.summary.trim().length > 0 ||
      currentLocalDraftCore.thumbnailUrl.trim().length > 0 ||
      currentLocalDraftCore.tags.length > 0 ||
      currentLocalDraftCore.category.trim().length > 0 ||
      (currentLocalDraftCore.scheduledAt ?? "").trim().length > 0 ||
      (currentLocalDraftCore.seriesName ?? "").trim().length > 0 ||
      (currentLocalDraftCore.canonicalUrl ?? "").trim().length > 0
    if (!hasCurrentDraftContent) {
      return false
    }
    const currentLocalDraftFingerprint = buildLocalDraftFingerprint(currentLocalDraftCore)
    if (options?.silent && lastLocalDraftFingerprintRef.current === currentLocalDraftFingerprint) {
      return true
    }

    const previousOwnAutosave = ownSessionAutosaveRef.current
    ownSessionAutosaveRef.current = {
      key: resolveCurrentDocumentDraftStorageKey(source),
      fingerprint: currentLocalDraftFingerprint,
    }
    try {
      persistLocalDraft(payload)
    } catch {
      ownSessionAutosaveRef.current = previousOwnAutosave
      setLocalDraftSavedAt("")
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localSaveFailed") }, "page")
      return false
    }
    lastLocalDraftFingerprintRef.current = currentLocalDraftFingerprint
    cachedRestorableDraftRef.current = {
      source,
      candidates: localDraftCandidates,
      fingerprint: currentLocalDraftFingerprint,
    }
    setLocalDraftSavedAt(payload.savedAt)

    if (!options?.silent) {
      const slotLabel = describeLocalDraftSlot(payload, language)
      setPublishStatus({ tone: "success", text: editorDraftLocalSaveDone(language, slotLabel) }, "page")
    }
    return true
  }, [
    buildLocalDraftFingerprint, getCurrentPostContent, language, lastLocalDraftFingerprintRef,
    localDraftCandidates, localDraftCore, persistLocalDraft, setLocalDraftSavedAt, setPublishStatus,
  ])

  const restoreLocalDraft = useCallback((candidateKey?: string) => {
    const selectedKey = candidateKey || localDraftCandidate?.key
    if (!selectedKey) return
    let draft: LocalDraftPayload | null
    try {
      draft = readLocalDraftCandidate(draftSource, selectedKey)
    } catch {
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localReadFailed") }, "page")
      return
    }
    if (!draft) {
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localNotFound") }, "page")
      return
    }

    if (draft.source.kind === "post") {
      const isSamePost = draft.source.postId === postId.trim()
      const currentVersionForPost = isSamePost ? postVersionRef.current : null
      setEditorMode("edit")
      setPostId(draft.source.postId)
      setPostVersion(resolveRestoredPostVersion(currentVersionForPost, draft.postVersion))
      if (!isSamePost) {
        setIsTempDraftMode(false)
      }
    } else {
      setEditorMode("create")
      setPostId("")
      setPostVersion(null)
      setIsTempDraftMode(false)
    }
    lastWriteFingerprintRef.current = ""
    lastWriteIdempotencyKeyRef.current = ""
    lastLocalDraftFingerprintRef.current = computeStoredDraftFingerprint(
      draft,
      buildLocalDraftFingerprint,
      dedupeStrings,
      normalizeCategoryValue
    )
    const restoredDraft = { key: selectedKey, source: draft.source, fingerprint: lastLocalDraftFingerprintRef.current }
    setLocalDraftCandidate(restoredDraft)
    setRestoredLocalDraft((current) =>
      current.some(
        (snapshot) =>
          snapshot.key === restoredDraft.key &&
          localDraftSourcesEqual(snapshot.source, restoredDraft.source) &&
          snapshot.fingerprint === restoredDraft.fingerprint
      )
        ? current
        : [...current, restoredDraft]
    )

    setPostTitle(draft.title)
    setPostContent(draft.content)
    setPostSummary(draft.summary)
    setPostSummarySource(draft.summarySource)
    setSummaryIntent(draft.summaryIntent)
    setPostThumbnailUrl(draft.thumbnailUrl)
    setPostThumbnailFocusX(draft.thumbnailFocusX)
    setPostThumbnailFocusY(draft.thumbnailFocusY)
    setPostThumbnailZoom(draft.thumbnailZoom)
    setPreviewThumbnailSourceUrl("")
    setPostTags(draft.tags)
    setPostCategory(draft.category)
    setPostVisibility(draft.visibility)
    setPostScheduledAt?.(draft.visibility === "PRIVATE" ? "" : (draft.scheduledAt ?? ""))
    setPostSeriesName?.(draft.seriesName ?? "")
    setPostSeriesOrder?.(draft.seriesOrder ?? null)
    setPostCanonicalUrl?.(draft.canonicalUrl ?? "")

    setLocalDraftSavedAt(draft.savedAt || "")
    const slotLabel = describeLocalDraftSlot(draft, language)
    setPublishStatus({ tone: "success", text: editorDraftLocalRestored(language, slotLabel) }, "page")
  }, [
    buildLocalDraftFingerprint, dedupeStrings, draftSource, language, lastLocalDraftFingerprintRef,
    lastWriteFingerprintRef, lastWriteIdempotencyKeyRef, normalizeCategoryValue, postId,
    localDraftCandidate, setEditorMode, setIsTempDraftMode, setLocalDraftSavedAt,
    setPostCategory, setPostContent, setPostId, setPostSummary,
    setPostSummarySource, setSummaryIntent, setPostTags, setPostThumbnailFocusX,
    setPostThumbnailFocusY, setPostThumbnailUrl, setPostThumbnailZoom, setPostTitle,
    setPostVersion, setPostVisibility, setPostScheduledAt, setPostSeriesName,
    setPostSeriesOrder, setPostCanonicalUrl, setPreviewThumbnailSourceUrl, setPublishStatus,
  ])

  const clearLocalDraft = useCallback(() => {
    cancelPendingAutosave()
    try {
      removeLocalDraft(draftSource)
    } catch {
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localClearFailed") }, "page")
      return
    }
    ownSessionAutosaveRef.current = null
    lastLocalDraftFingerprintRef.current = localDraftFingerprint
    cachedRestorableDraftRef.current = { source: draftSource, candidates: localDraftCandidates, fingerprint: null }
    signalLocalDraftRemoved(draftSource)
    setLocalDraftSavedAt("")
    setPublishStatus({ tone: "success", text: editorDraftNotice(language, "localCleared") }, "page")
  }, [
    cancelPendingAutosave, draftSource, language, lastLocalDraftFingerprintRef, localDraftCandidates, localDraftFingerprint,
    removeLocalDraft, signalLocalDraftRemoved, setLocalDraftSavedAt, setPublishStatus,
  ])

  const refreshLocalDraftCandidatesForSource = useCallback((source: LocalDraftSource) => {
    const activeOwnKey = ownSessionAutosaveRef.current?.key ?? null
    const candidates = listLocalDraftCandidates(source).map(({ key, draft }) => ({
      key,
      label: describeLocalDraftSlot(draft, language),
      source: draft.source,
      fingerprint: computeStoredDraftFingerprint(draft, buildLocalDraftFingerprint, dedupeStrings, normalizeCategoryValue),
      isActiveSessionAutosave: activeOwnKey != null && key === activeOwnKey,
    }))
    setLocalDraftCandidates(candidates)
    return candidates
  }, [buildLocalDraftFingerprint, dedupeStrings, language, normalizeCategoryValue])

  const refreshLocalDraftCandidates = useCallback(
    () => refreshLocalDraftCandidatesForSource(draftSource),
    [draftSource, refreshLocalDraftCandidatesForSource]
  )

  const preserveLocalDraftForConflictReload = useCallback((targetPostId?: string): boolean => {
    const normalizedTargetPostId = (targetPostId ?? postId).trim()
    const source: LocalDraftSource = normalizedTargetPostId
      ? { kind: "post", postId: normalizedTargetPostId }
      : draftSourceRef.current
    const { core: currentLocalDraftCore, payload } = buildLocalDraftPayloadForSource(
      localDraftCore, getCurrentPostContent(), source, postVersionRef.current
    )
    const currentLocalDraftFingerprint = buildLocalDraftFingerprint(currentLocalDraftCore)
    ownSessionAutosaveRef.current = null

    try {
      persistLocalDraft(payload)
    } catch {
      const errorNotice: PublishNotice = {
        tone: "error",
        text: editorDraftNotice(language, "localConflictPreserveFailed"),
      }
      setPublishStatus(errorNotice)
      setPublishStatus(errorNotice, "page")
      return false
    }

    lastLocalDraftFingerprintRef.current = currentLocalDraftFingerprint
    setLocalDraftSavedAt(payload.savedAt)
    setRestoredLocalDraft((current) => clearLocalDraftSuppressionForSource(current, source))
    setDismissedLocalDraft((current) => clearLocalDraftSuppressionForSource(current, source))

    try {
      const candidates = refreshLocalDraftCandidatesForSource(source)
      const matched = candidates.find((candidate) => candidate.fingerprint === currentLocalDraftFingerprint) || candidates[0] || null
      setLocalDraftCandidate(matched)
      cachedRestorableDraftRef.current = { source, candidates, fingerprint: currentLocalDraftFingerprint }
    } catch {
      cachedRestorableDraftRef.current = null
    }
    return true
  }, [
    buildLocalDraftFingerprint, getCurrentPostContent, language, lastLocalDraftFingerprintRef,
    localDraftCore, persistLocalDraft, postId, refreshLocalDraftCandidatesForSource,
    setLocalDraftSavedAt, setPublishStatus,
  ])

  useEffect(() => {
    const refresh = () => {
      let candidates: LocalDraftFingerprintSnapshot[]
      try {
        candidates = refreshLocalDraftCandidates()
      } catch {
        setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localListReadFailed") }, "page")
        return
      }
      setLocalDraftCandidate((selected) => selectPreferredLocalDraftCandidate(candidates, selected?.key))
    }
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("aquila-local-drafts-changed", refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("aquila-local-drafts-changed", refresh)
    }
  }, [language, refreshLocalDraftCandidates, setPublishStatus])

  useEffect(() => {
    const shouldAdoptBaseline = resolveLocalDraftShouldAdoptBaseline({
      loadingKey,
      pendingSuccessfulBaseline: pendingSuccessfulBaselineSettleRef.current,
    })
    const baselineFingerprint = shouldAdoptBaseline ? pendingBaselineFingerprintRef.current : null
    if (shouldAdoptBaseline) {
      pendingSuccessfulBaselineSettleRef.current = false
      pendingBaselineFingerprintRef.current = null
    }

    const hasDraftContent =
      postTitle.trim().length > 0 || postContent.trim().length > 0 || postSummary.trim().length > 0 ||
      postThumbnailUrl.trim().length > 0 || postTags.length > 0 || postCategory.trim().length > 0 ||
      postScheduledAt.trim().length > 0 || postSeriesName.trim().length > 0 || postCanonicalUrl.trim().length > 0

    let pendingRestorableDraftFingerprint: string | null = null
    const cached = cachedRestorableDraftRef.current
    if (cached && localDraftSourcesEqual(cached.source, draftSource) && cached.candidates === localDraftCandidates) {
      pendingRestorableDraftFingerprint = cached.fingerprint
    } else {
      const pendingDraft = readLocalDraft(draftSource)
      pendingRestorableDraftFingerprint = pendingDraft?.savedAt
        ? computeStoredDraftFingerprint(pendingDraft, buildLocalDraftFingerprint, dedupeStrings, normalizeCategoryValue)
        : null
      cachedRestorableDraftRef.current = { source: draftSource, candidates: localDraftCandidates, fingerprint: pendingRestorableDraftFingerprint }
    }

    const decision = decideLocalDraftAutosave({
      loadingKey,
      shouldAdoptBaseline,
      baselineFingerprint,
      isPostLoadInFlight,
      isPostIdTransitionGated,
      hasDraftContent,
      editorFingerprint: localDraftFingerprint,
      lastArmedFingerprint: lastLocalDraftFingerprintRef.current,
      pendingRestorableDraftFingerprint: resolveEffectivePendingRestorableDraftFingerprint(
        pendingRestorableDraftFingerprint,
        ownSessionAutosaveRef.current?.fingerprint ?? null
      ),
    })

    if (decision.action === "skip") {
      return
    }

    if (
      decision.action === "adopt-baseline" ||
      decision.action === "adopt-baseline-and-schedule"
    ) {
      lastLocalDraftFingerprintRef.current = decision.fingerprint
      if (decision.action === "adopt-baseline") {
        return
      }
    }

    const expectedSource = draftSource
    const currentEpoch = autosaveEpochRef.current
    if (pendingAutosaveTimerRef.current !== null) {
      window.clearTimeout(pendingAutosaveTimerRef.current)
    }
    pendingAutosaveTimerRef.current = window.setTimeout(() => {
      pendingAutosaveTimerRef.current = null
      if (autosaveEpochRef.current === currentEpoch) {
        saveLocalDraft({ silent: true, expectedSource })
      }
    }, 1200)

    return () => {
      if (pendingAutosaveTimerRef.current !== null) {
        window.clearTimeout(pendingAutosaveTimerRef.current)
        pendingAutosaveTimerRef.current = null
      }
    }
  }, [
    baselineReadyEpoch, buildLocalDraftFingerprint, dedupeStrings, draftSource,
    isPostIdTransitionGated, isPostLoadInFlight, lastLocalDraftFingerprintRef, loadingKey,
    localDraftCandidates, localDraftFingerprint, normalizeCategoryValue, postCanonicalUrl, postCategory,
    postContent, postLoadInFlightEpoch, postScheduledAt, postSeriesName, postSummary, postSummarySource, summaryIntent,
    postTags, postThumbnailUrl, postTitle, readLocalDraft, saveLocalDraft,
  ])

  const selectLocalDraftCandidate = useCallback((key: string) => {
    setLocalDraftCandidate(localDraftCandidates.find((candidate) => candidate.key === key) || null)
  }, [localDraftCandidates])

  const discardLocalDraftCandidate = useCallback(() => {
    if (!localDraftCandidate) return
    try {
      removeLocalDraftCandidate(draftSource, localDraftCandidate.key)
    } catch {
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localCandidateDiscardFailed") }, "page")
      return
    }
    setLocalDraftCandidate(null)
    try {
      refreshLocalDraftCandidates()
    } catch {
      setPublishStatus({ tone: "error", text: editorDraftNotice(language, "localListReadFailedKeepPost") }, "page")
    }
  }, [draftSource, language, localDraftCandidate, refreshLocalDraftCandidates, setPublishStatus])

  const dismissLocalDraftRestoreSuggestion = useCallback(() => {
    setDismissedLocalDraft((current) => [
      ...current,
      ...localDraftCandidates.filter((candidate) => !current.some((entry) =>
        entry.key === candidate.key && entry.fingerprint === candidate.fingerprint)),
    ])
  }, [localDraftCandidates])

  return {
    localDraftFingerprint,
    localDraftSource: draftSource,
    localDraftCandidate,
    localDraftCandidates,
    restoredLocalDraft,
    dismissedLocalDraft,
    dismissLocalDraftRestoreSuggestion,
    selectLocalDraftCandidate,
    discardLocalDraftCandidate,
    signalLocalDraftRemoved,
    saveLocalDraft,
    preserveLocalDraftForConflictReload,
    restoreLocalDraft,
    clearLocalDraft,
    cancelPendingAutosave,
    signalLocalDraftBaselineReady,
    beginLocalDraftPostLoad,
    endLocalDraftPostLoad,
  }
}
