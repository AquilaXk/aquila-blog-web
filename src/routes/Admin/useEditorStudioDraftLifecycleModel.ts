import {
  useCallback, useEffect, useMemo, useRef, useState,
  type Dispatch, type MutableRefObject, type SetStateAction,
} from "react"
import { localDraftSourcesEqual, type LocalDraftPayload, type LocalDraftSource } from "./editorStudioMetaModel"
import type { PostVisibility } from "./editorStudioState"
import type { CanonicalSummaryState, SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import {
  describeLocalDraftSlot, listLocalDraftCandidates, readLocalDraftCandidate,
  removeLocalDraftCandidate, resolveLocalDraftSource,
} from "./editorStudioStorageModel"
import {
  decideLocalDraftAutosave, isLocalDraftAutosaveGatedForPostIdTransition,
  removeLocalDraftCandidateForSource, resolveLocalDraftShouldAdoptBaseline,
  shouldReleasePostIdTransitionGate,
  type LocalDraftBaselineReadySignal, type LocalDraftFingerprintSnapshot,
} from "./editorStudioDraftAutosaveDecisionModel"
export {
  decideLocalDraftAutosave, isLocalDraftAutosaveGatedForPostIdTransition,
  isLocalDraftBaselineSettleLoadingKey, isLocalDraftRestoreSuggestionEligible,
  LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS, removeLocalDraftCandidateForSource,
  resolveCreateWritePostId, resolveLocalDraftShouldAdoptBaseline, shouldReleasePostIdTransitionGate,
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
  editorMode: EditorMode
  postId: string
  postVersion: number | null
  loadingKey: string
  postTitle: string
  postContent: string
  getCurrentPostContent: () => string
  postSummary: string
  postSummarySource: CanonicalSummaryState["summarySource"]
  summaryIntent: SummaryIntent
  postThumbnailUrl: string
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailZoom: number
  postTags: string[]
  postCategory: string
  postVisibility: PostVisibility
  setEditorMode: StudioSetState<EditorMode>
  setIsTempDraftMode: StudioSetState<boolean>
  setPostId: StudioSetState<string>
  setPostVersion: StudioSetState<number | null>
  setPreviewThumbnailSourceUrl: StudioSetState<string>
  setPostTitle: StudioSetState<string>
  setPostContent: StudioSetState<string>
  setPostSummary: StudioSetState<string>
  setPostSummarySource: StudioSetState<CanonicalSummaryState["summarySource"]>
  setSummaryIntent: StudioSetState<SummaryIntent>
  setPostThumbnailUrl: StudioSetState<string>
  setPostThumbnailFocusX: StudioSetState<number>
  setPostThumbnailFocusY: StudioSetState<number>
  setPostThumbnailZoom: StudioSetState<number>
  setPostTags: StudioSetState<string[]>
  setPostCategory: StudioSetState<string>
  setPostVisibility: StudioSetState<PostVisibility>
  setKnownTags: StudioSetState<string[]>
  setLocalDraftSavedAt: StudioSetState<string>
  setLocalDraftSlotLabel: StudioSetState<string>
  setPublishStatus: (notice: PublishNotice, target?: PublishTarget) => void
  dedupeStrings: (items: string[]) => string[]
  normalizeCategoryValue: (value: string) => string
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
  removeLocalDraft, setEditorMode, setIsTempDraftMode, setKnownTags, setLocalDraftSavedAt,
  setLocalDraftSlotLabel, setPostCategory, setPostContent, setPostId, setPostSummary,
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
      category: postCategory ? normalizeCategoryValue(postCategory) : "",
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

    const currentLocalDraftCore = {
      ...localDraftCore,
      content: getCurrentPostContent(),
    }
    const currentLocalDraftFingerprint = buildLocalDraftFingerprint(currentLocalDraftCore)

    if (lastLocalDraftFingerprintRef.current === currentLocalDraftFingerprint) {
      return
    }

    const resolvedPostVersion =
      source.kind === "post" && typeof postVersionRef.current === "number"
        ? postVersionRef.current
        : null

    const payload: LocalDraftPayload = {
      ...currentLocalDraftCore,
      savedAt: new Date().toISOString(),
      source,
      postVersion: resolvedPostVersion,
    }

    try {
      persistLocalDraft(payload)
    } catch {
      setLocalDraftSavedAt("")
      setLocalDraftSlotLabel("")
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
    setLocalDraftSlotLabel(describeLocalDraftSlot(payload))

    if (!options?.silent) {
      setPublishStatus(
        {
          tone: "success",
          text: `브라우저 임시저장 완료 (${describeLocalDraftSlot(payload)})`,
        },
        "page"
      )
    }
  }, [
    buildLocalDraftFingerprint, getCurrentPostContent, lastLocalDraftFingerprintRef,
    localDraftCandidates, localDraftCore, persistLocalDraft, setLocalDraftSavedAt,
    setLocalDraftSlotLabel, setPublishStatus,
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
      setEditorMode("edit")
      setPostId(draft.source.postId)
      if (typeof draft.postVersion === "number") {
        setPostVersion(draft.postVersion)
      } else if (postId !== draft.source.postId) {
        setPostVersion(null)
      }
      if (draft.source.postId !== postId) {
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
    lastLocalDraftFingerprintRef.current = buildLocalDraftFingerprint({
      title: draft.title,
      content: draft.content,
      summary: draft.summary,
      summarySource: draft.summarySource,
      summaryIntent: draft.summaryIntent,
      thumbnailUrl: draft.thumbnailUrl,
      thumbnailFocusX: draft.thumbnailFocusX,
      thumbnailFocusY: draft.thumbnailFocusY,
      thumbnailZoom: draft.thumbnailZoom,
      tags: dedupeStrings(draft.tags),
      category: draft.category ? normalizeCategoryValue(draft.category) : "",
      visibility: draft.visibility,
    })
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

    setKnownTags((prev) => dedupeStrings([...prev, ...draft.tags]).sort((a, b) => a.localeCompare(b)))
    setLocalDraftSavedAt(draft.savedAt || "")
    setLocalDraftSlotLabel(describeLocalDraftSlot(draft))
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
    localDraftCandidate, setEditorMode, setIsTempDraftMode, setKnownTags, setLocalDraftSavedAt,
    setLocalDraftSlotLabel, setPostCategory, setPostContent, setPostId, setPostSummary,
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
    lastLocalDraftFingerprintRef.current = localDraftFingerprint
    cachedRestorableDraftRef.current = {
      source: draftSource,
      candidates: localDraftCandidates,
      fingerprint: null,
    }
    signalLocalDraftRemoved(draftSource)
    setLocalDraftSavedAt("")
    setLocalDraftSlotLabel("")
    setPublishStatus(
      {
        tone: "success",
        text: "브라우저 임시저장을 삭제했습니다.",
      },
      "page"
    )
  }, [
    draftSource, lastLocalDraftFingerprintRef, localDraftCandidates, localDraftFingerprint,
    removeLocalDraft, signalLocalDraftRemoved, setLocalDraftSavedAt, setLocalDraftSlotLabel,
    setPublishStatus,
  ])

  const refreshLocalDraftCandidates = useCallback(() => {
    const candidates = listLocalDraftCandidates(draftSource).map(({ key, draft }) => ({
      key,
      label: describeLocalDraftSlot(draft),
      source: draft.source,
      fingerprint: buildLocalDraftFingerprint({ title: draft.title, content: draft.content, summary: draft.summary, summarySource: draft.summarySource, summaryIntent: draft.summaryIntent, thumbnailUrl: draft.thumbnailUrl, thumbnailFocusX: draft.thumbnailFocusX, thumbnailFocusY: draft.thumbnailFocusY, thumbnailZoom: draft.thumbnailZoom, tags: dedupeStrings(draft.tags), category: draft.category ? normalizeCategoryValue(draft.category) : "", visibility: draft.visibility }),
    }))
    setLocalDraftCandidates(candidates)
    return candidates
  }, [buildLocalDraftFingerprint, dedupeStrings, draftSource, normalizeCategoryValue])

  useEffect(() => {
    const refresh = () => {
      let candidates: LocalDraftFingerprintSnapshot[]
      try {
        candidates = refreshLocalDraftCandidates()
      } catch {
        setPublishStatus({ tone: "error", text: "브라우저 임시글 목록을 읽지 못했습니다. 현재 선택과 원고는 유지됩니다." }, "page")
        return
      }
      setLocalDraftCandidate((selected) => candidates.find((candidate) => candidate.key === selected?.key) || null)
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
    const baselineFingerprint = shouldAdoptBaseline
      ? pendingBaselineFingerprintRef.current
      : null
    if (shouldAdoptBaseline) {
      pendingSuccessfulBaselineSettleRef.current = false
      pendingBaselineFingerprintRef.current = null
    }

    const hasDraftContent =
      postTitle.trim().length > 0 ||
      postContent.trim().length > 0 ||
      postSummary.trim().length > 0 ||
      postThumbnailUrl.trim().length > 0 ||
      postTags.length > 0 ||
      postCategory.trim().length > 0

    let pendingRestorableDraftFingerprint: string | null = null
    const cached = cachedRestorableDraftRef.current
    if (
      cached &&
      localDraftSourcesEqual(cached.source, draftSource) &&
      cached.candidates === localDraftCandidates
    ) {
      pendingRestorableDraftFingerprint = cached.fingerprint
    } else {
      const pendingDraft = readLocalDraft(draftSource)
      pendingRestorableDraftFingerprint =
        pendingDraft?.savedAt
          ? buildLocalDraftFingerprint({
              title: pendingDraft.title,
              content: pendingDraft.content,
              summary: pendingDraft.summary,
              summarySource: pendingDraft.summarySource,
              summaryIntent: pendingDraft.summaryIntent,
              thumbnailUrl: pendingDraft.thumbnailUrl,
              thumbnailFocusX: pendingDraft.thumbnailFocusX,
              thumbnailFocusY: pendingDraft.thumbnailFocusY,
              thumbnailZoom: pendingDraft.thumbnailZoom,
              tags: dedupeStrings(pendingDraft.tags),
              category: pendingDraft.category
                ? normalizeCategoryValue(pendingDraft.category)
                : "",
              visibility: pendingDraft.visibility,
            })
          : null
      cachedRestorableDraftRef.current = {
        source: draftSource,
        candidates: localDraftCandidates,
        fingerprint: pendingRestorableDraftFingerprint,
      }
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
      pendingRestorableDraftFingerprint,
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
    restoreLocalDraft,
    clearLocalDraft,
    signalLocalDraftBaselineReady,
    beginLocalDraftPostLoad,
    endLocalDraftPostLoad,
  }
}
