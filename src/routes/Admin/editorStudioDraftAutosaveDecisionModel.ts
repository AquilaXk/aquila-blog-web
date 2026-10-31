import {
  localDraftSourcesEqual,
  type LocalDraftFingerprintPayload,
  type LocalDraftPayload,
  type LocalDraftSource,
} from "./editorStudioMetaModel"

type EditorMode = "create" | "edit"

export const resolveRestoredPostVersion = (
  currentPostVersion: number | null,
  draftPostVersion: number | null | undefined
): number | null => {
  const hasCurrent = typeof currentPostVersion === "number" && Number.isFinite(currentPostVersion)
  const hasDraft = typeof draftPostVersion === "number" && Number.isFinite(draftPostVersion)
  if (hasCurrent && hasDraft) {
    return Math.max(currentPostVersion, draftPostVersion)
  }
  if (hasCurrent) {
    return currentPostVersion
  }
  if (hasDraft) {
    return draftPostVersion
  }
  return null
}

/** loadingKey values whose settle should adopt editor fingerprint as autosave baseline. */
export const LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS = new Set([
  "postOne",
  "postTemp",
  "writePost",
  "modifyPost",
  "publishTempPost",
])

export const isLocalDraftBaselineSettleLoadingKey = (loadingKey: string): boolean =>
  LOCAL_DRAFT_BASELINE_SETTLE_LOADING_KEYS.has(loadingKey)

/**
 * Adopt baseline when a success signal is pending and loading is idle.
 * Do not require a wasLoading→idle transition from a baseline loadingKey —
 * a non-baseline key (e.g. uploadThumbnail) can clear loading first while
 * postOne is still in flight, leaving no transition when the load finishes.
 */
export const resolveLocalDraftShouldAdoptBaseline = (input: {
  loadingKey: string
  pendingSuccessfulBaseline: boolean
}): boolean => input.loadingKey.length === 0 && input.pendingSuccessfulBaseline

export type LocalDraftFingerprintSnapshot = {
  label?: string
  key: string
  source: LocalDraftSource
  fingerprint: string
}

export const isLocalDraftRestoreSuggestionEligible = (input: {
  candidate: LocalDraftFingerprintSnapshot | null
  currentSource: LocalDraftSource
  editorFingerprint: string
  serverBaselineFingerprint: string
  restored: LocalDraftFingerprintSnapshot[]
  dismissed: LocalDraftFingerprintSnapshot[]
}): boolean => {
  const candidate = input.candidate
  if (candidate == null) return false

  return (
    localDraftSourcesEqual(candidate.source, input.currentSource) &&
    candidate.fingerprint !== input.editorFingerprint &&
    candidate.fingerprint !== input.serverBaselineFingerprint &&
    !input.restored.some(
      (snapshot) =>
        snapshot.key === candidate.key &&
        localDraftSourcesEqual(snapshot.source, candidate.source) &&
        snapshot.fingerprint === candidate.fingerprint
    ) &&
    !input.dismissed.some(
      (snapshot) =>
        snapshot.key === candidate.key &&
        localDraftSourcesEqual(snapshot.source, candidate.source) &&
        snapshot.fingerprint === candidate.fingerprint
    )
  )
}

export const removeLocalDraftCandidateForSource = (
  candidate: LocalDraftFingerprintSnapshot | null,
  source: LocalDraftSource
): LocalDraftFingerprintSnapshot | null =>
  candidate != null && localDraftSourcesEqual(candidate.source, source) ? null : candidate

export const clearLocalDraftSuppressionForSource = (
  snapshots: LocalDraftFingerprintSnapshot[],
  source: LocalDraftSource
): LocalDraftFingerprintSnapshot[] =>
  snapshots.filter((snapshot) => !localDraftSourcesEqual(snapshot.source, source))

export const computeStoredDraftFingerprint = (
  draft: Pick<
    LocalDraftPayload,
    | "title"
    | "content"
    | "summary"
    | "summarySource"
    | "summaryIntent"
    | "thumbnailUrl"
    | "thumbnailFocusX"
    | "thumbnailFocusY"
    | "thumbnailZoom"
    | "tags"
    | "category"
    | "visibility"
  >,
  buildLocalDraftFingerprint: (payload: LocalDraftFingerprintPayload) => string,
  dedupeStrings: (items: string[]) => string[],
  normalizeCategoryValue: (value: string) => string
): string =>
  buildLocalDraftFingerprint({
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
    category: draft.category.trim() ? normalizeCategoryValue(draft.category) : "",
    visibility: draft.visibility,
  })

export const buildLocalDraftPayloadForSource = (
  core: LocalDraftFingerprintPayload,
  content: string,
  source: LocalDraftSource,
  currentPostVersion: number | null
): { core: LocalDraftFingerprintPayload; payload: LocalDraftPayload } => {
  const nextCore: LocalDraftFingerprintPayload = { ...core, content }
  const resolvedPostVersion =
    source.kind === "post" && typeof currentPostVersion === "number" ? currentPostVersion : null
  return {
    core: nextCore,
    payload: {
      ...nextCore,
      savedAt: new Date().toISOString(),
      source,
      postVersion: resolvedPostVersion,
    },
  }
}

export type LocalDraftBaselineReadySignal = {
  /**
   * Write/publish request snapshot to arm as baseline. Omit on post-load settle so
   * the latest editor (server content) becomes the baseline.
   */
  baselineFingerprint?: string
}

/**
 * ID field edits switch editorMode to create while keeping the previous body and a
 * non-empty postId. Autosave stays gated only while awaiting the first load settle.
 * After a failed load settles, awaitingPostLoad is cleared so user edits autosave again.
 */
export const isLocalDraftAutosaveGatedForPostIdTransition = (
  editorMode: "create" | "edit",
  postId: string,
  awaitingPostLoad = true
): boolean =>
  awaitingPostLoad && editorMode === "create" && postId.trim().length > 0

/**
 * Failed post load must not release the create-slot gate immediately — stale edit body
 * would autosave into the create slot. Release only when edit context restores or the user edits.
 */
export const shouldReleasePostIdTransitionGate = (input: {
  editorMode: EditorMode
  postId: string
  editorFingerprint: string
  transitionBaselineFingerprint: string | null
  awaitingLoad: boolean
}): boolean => {
  if (!input.awaitingLoad) {
    return false
  }
  if (input.editorMode === "edit") {
    return true
  }
  if (input.postId.trim().length === 0) {
    return true
  }
  if (
    input.transitionBaselineFingerprint != null &&
    input.editorFingerprint !== input.transitionBaselineFingerprint
  ) {
    return true
  }
  return false
}

const CREATE_WRITE_MISSING_POST_ID_STATUS_TEXT =
  "글 작성 응답에 글 ID가 없습니다. 로컬 임시저장은 유지됩니다. 다시 시도해주세요."

export type CreateWritePostIdResolution =
  | { ok: true; postId: string }
  | { ok: false; statusText: string }

/** Create-mode write success must include a non-empty post id before draft cleanup. */
export const resolveCreateWritePostId = (
  writeResult: { id?: number | string } | null | undefined
): CreateWritePostIdResolution => {
  const rawId = writeResult?.id
  if (rawId == null || rawId === "") {
    return { ok: false, statusText: CREATE_WRITE_MISSING_POST_ID_STATUS_TEXT }
  }

  const postId = String(rawId).trim()
  if (!postId) {
    return { ok: false, statusText: CREATE_WRITE_MISSING_POST_ID_STATUS_TEXT }
  }

  return { ok: true, postId }
}

export type LocalDraftAutosaveDecisionInput = {
  loadingKey: string
  shouldAdoptBaseline: boolean
  baselineFingerprint?: string | null
  isPostLoadInFlight?: boolean
  isPostIdTransitionGated: boolean
  hasDraftContent: boolean
  editorFingerprint: string
  lastArmedFingerprint: string
  pendingRestorableDraftFingerprint: string | null
}

export type LocalDraftAutosaveDecision =
  | { action: "skip" }
  | { action: "adopt-baseline"; fingerprint: string }
  | { action: "adopt-baseline-and-schedule"; fingerprint: string }
  | { action: "schedule" }

export const decideLocalDraftAutosave = (
  input: LocalDraftAutosaveDecisionInput
): LocalDraftAutosaveDecision => {
  if (input.loadingKey.length > 0) {
    return { action: "skip" }
  }

  if (input.shouldAdoptBaseline) {
    const baseline = input.baselineFingerprint ?? input.editorFingerprint
    if (baseline !== input.editorFingerprint) {
      return { action: "adopt-baseline-and-schedule", fingerprint: baseline }
    }
    return { action: "adopt-baseline", fingerprint: baseline }
  }

  if (input.isPostLoadInFlight) {
    return { action: "skip" }
  }

  if (input.isPostIdTransitionGated) {
    return { action: "skip" }
  }

  if (!input.hasDraftContent) {
    return { action: "skip" }
  }

  if (input.lastArmedFingerprint === input.editorFingerprint) {
    return { action: "skip" }
  }

  if (
    input.pendingRestorableDraftFingerprint != null &&
    input.pendingRestorableDraftFingerprint !== input.editorFingerprint &&
    input.lastArmedFingerprint === input.pendingRestorableDraftFingerprint
  ) {
    return { action: "skip" }
  }

  return { action: "schedule" }
}
