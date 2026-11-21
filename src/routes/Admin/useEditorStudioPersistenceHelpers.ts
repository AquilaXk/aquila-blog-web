// 참조 구현: TryGhost/Ghost (MIT) — 에디터 영속성 헬퍼 및 핑거프린트 유틸
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { normalizeCategoryValue } from "src/libs/utils"
import { buildLocalDraftFingerprint } from "./editorStudioMetaModel"
import type { LocalDraftBaselineReadySignal } from "./useEditorStudioDraftLifecycleModel"
import type { CanonicalSummaryState, SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import type { PostVisibility } from "src/types"
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
  uploadWithConflictRetry: (requestUpload: () => Promise<Response>) => Promise<Response>
  normalizeSafeImageUrl: (raw: string) => string
  extractImageFileFromClipboard: (clipboardData: DataTransfer | null) => File | null
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
