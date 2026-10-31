import {
  useCallback, useEffect, useMemo, useRef, useState,
  type Dispatch, type MutableRefObject, type SetStateAction,
} from "react"
import { localDraftSourcesEqual, type LocalDraftPayload, type LocalDraftSource } from "./editorStudioMetaModel"
import type { PostVisibility } from "./editorStudioState"
import type { CanonicalSummaryState, SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
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

type StudioSetState<T> = Dispatch<SetStateAction<T>>
type NoticeTone = "idle" | "loading" | "success" | "error"
type PublishNotice = { tone: NoticeTone; text: string }
type PublishTarget = "page" | "modal"
type EditorMode = "create" | "edit"

type UseEditorStudioLocalDraftLifecycleParams = {
  editorMode: EditorMode; postId: string; postVersion: number | null; loadingKey: string
  postTitle: string; postContent: string; getCurrentPostContent: () => string
  postSummary: string; postSummarySource: CanonicalSummaryState["summarySource"]; summaryIntent: SummaryIntent
  postThumbnailUrl: string; postThumbnailFocusX: number; postThumbnailFocusY: number; postThumbnailZoom: number
  postTags: string[]; postCategory: string; postVisibility: PostVisibility
  setEditorMode: StudioSetState<EditorMode>; setIsTempDraftMode: StudioSetState<boolean>
  setPostId: StudioSetState<string>; setPostVersion: StudioSetState<number | null>
  setPreviewThumbnailSourceUrl: StudioSetState<string>; setPostTitle: StudioSetState<string>
  setPostContent: StudioSetState<string>; setPostSummary: StudioSetState<string>
  setPostSummarySource: StudioSetState<CanonicalSummaryState["summarySource"]>
  setSummaryIntent: StudioSetState<SummaryIntent>; setPostThumbnailUrl: StudioSetState<string>
  setPostThumbnailFocusX: StudioSetState<number>; setPostThumbnailFocusY: StudioSetState<number>
  setPostThumbnailZoom: StudioSetState<number>; setPostTags: StudioSetState<string[]>
  setPostCategory: StudioSetState<string>; setPostVisibility: StudioSetState<PostVisibility>
  setLocalDraftSavedAt: StudioSetState<string>
  setPublishStatus: (notice: PublishNotice, target?: PublishTarget) => void
  dedupeStrings: (items: string[]) => string[]; normalizeCategoryValue: (value: string) => string
  buildLocalDraftFingerprint: (payload: Omit<LocalDraftPayload, "savedAt" | "source" | "postVersion">) => string
  persistLocalDraft: (payload: LocalDraftPayload) => void
  readLocalDraft: (source: LocalDraftSource) => LocalDraftPayload | null
  removeLocalDraft: (source: LocalDraftSource) => void
  lastLocalDraftFingerprintRef: MutableRefObject<string>
  lastWriteFingerprintRef: MutableRefObject<string>
  lastWriteIdempotencyKeyRef: MutableRefObject<string>
}

export const useEditorStudioLocalDraftLifecycle = ({
  buildLocalDraftFingerprint, dedupeStrings, editorMode, lastLocalDraftFingerprintRef,
  lastWriteFingerprintRef, lastWriteIdempotencyKeyRef, loadingKey, normalizeCategoryValue,
  persistLocalDraft, postCategory, postContent, getCurrentPostContent, postId, postSummary,
  postSummarySource, summaryIntent, postTags, postThumbnailFocusX, postThumbnailFocusY,
  postThumbnailUrl, postThumbnailZoom, postTitle, postVersion, postVisibility, readLocalDraft,
  removeLocalDraft, setEditorMode, setIsTempDraftMode, setLocalDraftSavedAt,
  setPostCategory, setPostContent, setPostId, setPostSummary,
  setPostSummarySource, setSummaryIntent, setPostTags, setPostThumbnailFocusX,
  setPostThumbnailFocusY, setPostThumbnailUrl, setPostThumbnailZoom, setPostTitle,
  setPostVersion, setPostVisibility, setPreviewThumbnailSourceUrl, setPublishStatus,
}: UseEditorStudioLocalDraftLifecycleParams) => {
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
    }),
    [
      dedupeStrings, normalizeCategoryValue, postCategory, postContent, postSummary,
      postSummarySource, summaryIntent, postTags, postThumbnailFocusX, postThumbnailFocusY,
      postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility,
    ]
  )

  const localDraftFingerprint = useMemo(
    () => buildLocalDraftFingerprint(localDraftCore),
    [buildLocalDraftFingerprint, localDraftCore]
  )

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
  }) => {
    if (loadingKeyRef.current.length > 0) return
    if (isPostLoadInFlightRef.current) return
    if (isPostIdTransitionGatedRef.current) return

    const source = draftSourceRef.current
    if (options?.expectedSource && !localDraftSourcesEqual(options.expectedSource, source)) {
      return
    }

    const { core: currentLocalDraftCore, payload } = buildLocalDraftPayloadForSource(
      localDraftCore,
      getCurrentPostContent(),
      source,
      postVersionRef.current
    )
    const currentLocalDraftFingerprint = buildLocalDraftFingerprint(currentLocalDraftCore)
    if (lastLocalDraftFingerprintRef.current === currentLocalDraftFingerprint) return

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
      setPublishStatus({
        tone: "error",
        text: "브라우저 임시저장에 실패했습니다. 현재 원고를 복사하거나 서버에 저장한 뒤 페이지를 닫아주세요.",
      }, "page")
      return
    }
    lastLocalDraftFingerprintRef.current = currentLocalDraftFingerprint
    cachedRestorableDraftRef.current = {
      source,
      candidates: localDraftCandidates,
      fingerprint: currentLocalDraftFingerprint,
    }
    setLocalDraftSavedAt(payload.savedAt)

    if (!options?.silent) {
      setPublishStatus({ tone: "success", text: `브라우저 임시저장 완료 (${describeLocalDraftSlot(payload)})` }, "page")
    }
  }, [
    buildLocalDraftFingerprint, getCurrentPostContent, lastLocalDraftFingerprintRef,
    localDraftCandidates, localDraftCore, persistLocalDraft, setLocalDraftSavedAt, setPublishStatus,
  ])

  const restoreLocalDraft = useCallback((candidateKey?: string) => {
    const selectedKey = candidateKey || localDraftCandidate?.key
    if (!selectedKey) return
    let draft: LocalDraftPayload | null
    try {
      draft = readLocalDraftCandidate(draftSource, selectedKey)
    } catch {
      setPublishStatus({ tone: "error", text: "브라우저 임시글을 읽지 못했습니다. 현재 원고와 선택한 초안은 유지됩니다." }, "page")
      return
    }
    if (!draft) {
      setPublishStatus(
        {
          tone: "error",
          text: "저장된 브라우저 임시글이 없습니다.",
        },
        "page"
      )
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

    setLocalDraftSavedAt(draft.savedAt || "")
    setPublishStatus(
      {
        tone: "success",
        text: `브라우저 임시글을 불러왔습니다 (${describeLocalDraftSlot(draft)}).`,
      },
      "page"
    )
  }, [
    buildLocalDraftFingerprint, dedupeStrings, draftSource, lastLocalDraftFingerprintRef,
    lastWriteFingerprintRef, lastWriteIdempotencyKeyRef, normalizeCategoryValue, postId,
    localDraftCandidate, setEditorMode, setIsTempDraftMode, setLocalDraftSavedAt,
    setPostCategory, setPostContent, setPostId, setPostSummary,
    setPostSummarySource, setSummaryIntent, setPostTags, setPostThumbnailFocusX,
    setPostThumbnailFocusY, setPostThumbnailUrl, setPostThumbnailZoom, setPostTitle,
    setPostVersion, setPostVisibility, setPreviewThumbnailSourceUrl, setPublishStatus,
  ])

  const clearLocalDraft = useCallback(() => {
    try {
      removeLocalDraft(draftSource)
    } catch {
      setPublishStatus({ tone: "error", text: "브라우저 임시저장을 삭제하지 못했습니다. 현재 원고는 유지됩니다." }, "page")
      return
    }
    ownSessionAutosaveRef.current = null
    lastLocalDraftFingerprintRef.current = localDraftFingerprint
    cachedRestorableDraftRef.current = { source: draftSource, candidates: localDraftCandidates, fingerprint: null }
    signalLocalDraftRemoved(draftSource)
    setLocalDraftSavedAt("")
    setPublishStatus({ tone: "success", text: "브라우저 임시저장을 삭제했습니다." }, "page")
  }, [
    draftSource, lastLocalDraftFingerprintRef, localDraftCandidates, localDraftFingerprint,
    removeLocalDraft, signalLocalDraftRemoved, setLocalDraftSavedAt, setPublishStatus,
  ])

  const refreshLocalDraftCandidatesForSource = useCallback((source: LocalDraftSource) => {
    const activeOwnKey = ownSessionAutosaveRef.current?.key ?? null
    const candidates = listLocalDraftCandidates(source).map(({ key, draft }) => ({
      key,
      label: describeLocalDraftSlot(draft),
      source: draft.source,
      fingerprint: computeStoredDraftFingerprint(draft, buildLocalDraftFingerprint, dedupeStrings, normalizeCategoryValue),
      isActiveSessionAutosave: activeOwnKey != null && key === activeOwnKey,
    }))
    setLocalDraftCandidates(candidates)
    return candidates
  }, [buildLocalDraftFingerprint, dedupeStrings, normalizeCategoryValue])

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
        text: "브라우저 임시저장에 실패해 서버 최신본을 불러오지 않았습니다. 현재 원고를 복사한 뒤 다시 시도해주세요.",
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
    buildLocalDraftFingerprint, getCurrentPostContent, lastLocalDraftFingerprintRef,
    localDraftCore, persistLocalDraft, postId, refreshLocalDraftCandidatesForSource,
    setLocalDraftSavedAt, setPublishStatus,
  ])

  useEffect(() => {
    const refresh = () => {
      let candidates: LocalDraftFingerprintSnapshot[]
      try {
        candidates = refreshLocalDraftCandidates()
      } catch {
        setPublishStatus({ tone: "error", text: "브라우저 임시글 목록을 읽지 못했습니다. 현재 선택과 원고는 유지됩니다." }, "page")
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
  }, [refreshLocalDraftCandidates, setPublishStatus])

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
      postThumbnailUrl.trim().length > 0 || postTags.length > 0 || postCategory.trim().length > 0

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
    const timerId = window.setTimeout(() => {
      saveLocalDraft({ silent: true, expectedSource })
    }, 1200)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [
    baselineReadyEpoch, buildLocalDraftFingerprint, dedupeStrings, draftSource,
    isPostIdTransitionGated, isPostLoadInFlight, lastLocalDraftFingerprintRef, loadingKey,
    localDraftCandidates, localDraftFingerprint, normalizeCategoryValue, postCategory,
    postContent, postLoadInFlightEpoch, postSummary, postSummarySource, summaryIntent,
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
      setPublishStatus({ tone: "error", text: "선택한 브라우저 임시글을 삭제하지 못했습니다. 초안과 원고는 유지됩니다." }, "page")
      return
    }
    setLocalDraftCandidate(null)
    try {
      refreshLocalDraftCandidates()
    } catch {
      setPublishStatus({ tone: "error", text: "브라우저 임시글 목록을 읽지 못했습니다. 현재 원고는 유지됩니다." }, "page")
    }
  }, [draftSource, localDraftCandidate, refreshLocalDraftCandidates, setPublishStatus])

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
    signalLocalDraftBaselineReady,
    beginLocalDraftPostLoad,
    endLocalDraftPostLoad,
  }
}
