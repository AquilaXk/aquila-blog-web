import type { NextRouter } from "next/router"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { replaceRoute } from "src/libs/router"
import type { PostVisibility } from "src/types"
import type { EditorMode } from "./editorStudioState"
import type { LocalDraftBaselineReadySignal } from "./editorStudioDraftAutosaveDecisionModel"
import {
  clearScheduledForcedEditorExitUrl,
  scheduleForcedEditorExitUrl,
} from "./editorStudioUnsavedExitGuard"
import type { CanonicalSummaryState, SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"

type StudioSetState<T> = Dispatch<SetStateAction<T>>
type PublishNotice = { tone: "idle" | "loading" | "success" | "error"; text: string }

export type CreatedEditorPostHandoffInput = {
  postId: string
  postVersion: number | null
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
  scheduledAt: string
  seriesName: string
  seriesOrder: number | null
  canonicalUrl: string
  serverBaselineFingerprint: string
  localDraftBaselineFingerprint: string
  publishNotice: PublishNotice
  resultText: string
}

export type CreatedEditorPostHandoff = CreatedEditorPostHandoffInput & {
  createdAt: number
}

const HANDOFF_TTL_MS = 15_000
const MAX_PENDING_HANDOFFS = 8
const pendingCreatedPostHandoffs = new Map<string, CreatedEditorPostHandoff>()

const normalizeRoutePath = (pathname: string): string => {
  if (!pathname) return ""
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}

export const saveCreatedEditorPostHandoff = (
  postId: string,
  input: CreatedEditorPostHandoffInput
): void => {
  const normalizedPostId = postId.trim()
  if (!normalizedPostId) return
  if (pendingCreatedPostHandoffs.size >= MAX_PENDING_HANDOFFS) {
    const oldestKey = pendingCreatedPostHandoffs.keys().next().value
    if (oldestKey) pendingCreatedPostHandoffs.delete(oldestKey)
  }
  pendingCreatedPostHandoffs.set(normalizedPostId, {
    ...input,
    postId: normalizedPostId,
    tags: [...input.tags],
    createdAt: Date.now(),
  })
}

export const consumeCreatedEditorPostHandoff = (postId: string): CreatedEditorPostHandoff | null => {
  const normalizedPostId = postId.trim()
  if (!normalizedPostId) return null
  const entry = pendingCreatedPostHandoffs.get(normalizedPostId)
  if (!entry) return null
  pendingCreatedPostHandoffs.delete(normalizedPostId)
  if (Date.now() - entry.createdAt > HANDOFF_TTL_MS) return null
  return entry
}

export const clearCreatedEditorPostHandoff = (postId?: string): void => {
  if (typeof postId === "string" && postId.trim()) {
    pendingCreatedPostHandoffs.delete(postId.trim())
    return
  }
  pendingCreatedPostHandoffs.clear()
}

export const resolveCreatedPostDestination = (
  createdPostId: string,
  router: Pick<NextRouter, "pathname" | "query">,
  editorNewRoutePath: string,
  toEditorPostRoute: (id: string | number) => string,
  normalizeEditorReturnRoute: (value: string) => string
): string | null => {
  const normalizedPostId = createdPostId.trim()
  if (!normalizedPostId) return null
  const currentPathname = normalizeRoutePath(router.pathname)
  const normalizedNewRoutePath = normalizeRoutePath(editorNewRoutePath)
  if (currentPathname !== normalizedNewRoutePath && currentPathname !== "/admin/editor") {
    return null
  }
  const baseRoute = toEditorPostRoute(normalizedPostId)
  const rawReturnTo = typeof router.query?.returnTo === "string" ? router.query.returnTo : ""
  const safeReturnTo = rawReturnTo ? normalizeEditorReturnRoute(rawReturnTo) : ""
  if (!safeReturnTo) return baseRoute
  const query = new URLSearchParams({ returnTo: safeReturnTo })
  return `${baseRoute}?${query.toString()}`
}

export const syncCreatedPostBrowserRoute = async ({
  router,
  createdPostId,
  handoffInput,
  editorNewRoutePath,
  toEditorPostRoute,
  normalizeEditorReturnRoute,
  autoLoadedPostIdRef,
}: {
  router: NextRouter
  createdPostId: string
  handoffInput: CreatedEditorPostHandoffInput
  editorNewRoutePath: string
  toEditorPostRoute: (id: string | number) => string
  normalizeEditorReturnRoute: (value: string) => string
  autoLoadedPostIdRef: MutableRefObject<string | null>
}): Promise<boolean> => {
  if (typeof router?.replace !== "function") return false
  const destination = resolveCreatedPostDestination(
    createdPostId,
    router,
    editorNewRoutePath,
    toEditorPostRoute,
    normalizeEditorReturnRoute
  )
  if (!destination) return false

  autoLoadedPostIdRef.current = createdPostId.trim()
  saveCreatedEditorPostHandoff(createdPostId, handoffInput)
  scheduleForcedEditorExitUrl(destination)
  try {
    await replaceRoute(router, destination)
    return true
  } catch {
    clearCreatedEditorPostHandoff(createdPostId)
    return false
  } finally {
    clearScheduledForcedEditorExitUrl()
  }
}

export const hydrateCreatedEditorPostHandoff = (
  handoff: CreatedEditorPostHandoff,
  deps: {
    beginLocalDraftPostLoad: () => void
    endLocalDraftPostLoad: () => void
    cancelPendingAutosave: () => void
    signalLocalDraftBaselineReady: (signal?: LocalDraftBaselineReadySignal) => void
    serverBaselineEditorFingerprintRef: MutableRefObject<string>
    lastLocalDraftFingerprintRef: MutableRefObject<string>
    lastWriteFingerprintRef: MutableRefObject<string>
    lastWriteIdempotencyKeyRef: MutableRefObject<string>
    postContentLiveRef: MutableRefObject<string>
    setPostId: StudioSetState<string>
    setPostVersion: StudioSetState<number | null>
    setEditorMode: StudioSetState<EditorMode>
    setIsTempDraftMode: StudioSetState<boolean>
    setPostTitle: StudioSetState<string>
    setPostContent: StudioSetState<string>
    setPostSummary: StudioSetState<string>
    setPostSummarySource: StudioSetState<CanonicalSummaryState["summarySource"]>
    setSummaryIntent: StudioSetState<SummaryIntent>
    setPostThumbnailUrl: StudioSetState<string>
    setPostThumbnailFocusX: StudioSetState<number>
    setPostThumbnailFocusY: StudioSetState<number>
    setPostThumbnailZoom: StudioSetState<number>
    setPreviewThumbnailSourceUrl: StudioSetState<string>
    setPostTags: StudioSetState<string[]>
    setPostCategory: StudioSetState<string>
    setPostVisibility: StudioSetState<PostVisibility>
    setPostScheduledAt: StudioSetState<string>
    setPostSeriesName: StudioSetState<string>
    setPostSeriesOrder: StudioSetState<number | null>
    setPostCanonicalUrl: StudioSetState<string>
    setLocalDraftSavedAt: StudioSetState<string>
    setPublishStatus: (notice: PublishNotice, target?: "page" | "modal") => void
    setResult: StudioSetState<string>
  }
): void => {
  deps.cancelPendingAutosave()
  deps.beginLocalDraftPostLoad()
  try {
    deps.postContentLiveRef.current = handoff.content
    deps.setPostId(handoff.postId)
    deps.setPostVersion(handoff.postVersion)
    deps.setEditorMode("edit")
    deps.setIsTempDraftMode(false)
    deps.setPostTitle(handoff.title)
    deps.setPostContent(handoff.content)
    deps.setPostSummary(handoff.summary)
    deps.setPostSummarySource(handoff.summarySource)
    deps.setSummaryIntent(handoff.summaryIntent)
    deps.setPostThumbnailUrl(handoff.thumbnailUrl)
    deps.setPostThumbnailFocusX(handoff.thumbnailFocusX)
    deps.setPostThumbnailFocusY(handoff.thumbnailFocusY)
    deps.setPostThumbnailZoom(handoff.thumbnailZoom)
    deps.setPreviewThumbnailSourceUrl(handoff.thumbnailUrl)
    deps.setPostTags(handoff.tags)
    deps.setPostCategory(handoff.category)
    deps.setPostVisibility(handoff.visibility)
    deps.setPostScheduledAt(handoff.scheduledAt)
    deps.setPostSeriesName(handoff.seriesName)
    deps.setPostSeriesOrder(handoff.seriesOrder)
    deps.setPostCanonicalUrl(handoff.canonicalUrl)
    deps.setLocalDraftSavedAt("")
    deps.serverBaselineEditorFingerprintRef.current = handoff.serverBaselineFingerprint
    deps.lastLocalDraftFingerprintRef.current = handoff.localDraftBaselineFingerprint
    deps.lastWriteFingerprintRef.current = ""
    deps.lastWriteIdempotencyKeyRef.current = ""
    deps.signalLocalDraftBaselineReady({ baselineFingerprint: handoff.localDraftBaselineFingerprint })
    deps.setPublishStatus(handoff.publishNotice, "page")
    deps.setResult(handoff.resultText)
  } finally {
    deps.endLocalDraftPostLoad()
  }
}
