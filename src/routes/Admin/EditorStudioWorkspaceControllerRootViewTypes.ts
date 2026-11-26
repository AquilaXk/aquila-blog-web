// 참조 구현: TryGhost/Ghost (MIT) — 에디터 컨트롤러 루트 뷰 타입 및 서브헬퍼
import type {
  ChangeEventHandler,
  ClipboardEventHandler,
  KeyboardEventHandler,
  PointerEventHandler,
  RefObject,
} from "react"
import type { LocalDraftSource } from "./editorStudioMetaModel"
import type { LocalDraftFingerprintSnapshot } from "./useEditorStudioDraftLifecycleModel"
import type { SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"
import type { PostVisibility, PublishActionType } from "./editorStudioState"

export type EditorStudioDocumentSlice = {
  addTagsToPost: (tags: string[]) => void
  addTagToPost: (tag: string) => void
  commitPostCategory: () => void
  customCategoryCatalog: string[]
  customTagCatalog: string[]
  deferredContentDerived: { firstImage: string }
  disabled: (key: string) => boolean
  editorMode: "create" | "edit"
  getCurrentPostContent: () => string
  handleExitDedicatedEditor: () => void
  handleFlushMarkdownReady: (flushFn: (() => string) | null) => void
  handleFocusTitle: () => void
  handleMarkdownEditorChange: (next: string, meta?: { editorFocused: boolean }) => void
  handlePostCategoryChange: (value: string) => void
  handlePostSummaryChange: (value: string) => void
  handleReloadLatestServerPost: () => Promise<void>
  handleApplyRestoredRevision: (restoredPost?: unknown) => Promise<void>
  postVersion: number | null
  handleTitleChange: ChangeEventHandler<HTMLTextAreaElement>
  handleTitleFieldRef: (node: HTMLTextAreaElement | null) => void
  handleTitleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  isCompactMobileLayout: boolean
  isDedicatedEditorRoute: boolean
  isDedicatedNewEditorRoute: boolean
  isMobileMetaEditorOpen: boolean
  isNewEditorBootstrapPending: boolean
  isTempDraftMode: boolean
  lastSaveError: { errorType: string } | null
  loadingKey: string
  postCategory: string
  postContent: string
  postId: string
  postSummary: string
  postSummarySource: "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE"
  postTags: string[]
  postTitle: string
  postVisibility: PostVisibility
  removeTagFromPost: (tag: string) => void
  result: string
  serverBaselineEditorFingerprintRef: { current: string }
  sessionMember: unknown
  setIsMobileMetaEditorOpen: (updater: (current: boolean) => boolean) => void
  setPostVisibility: (nextVisibility: PostVisibility) => void
  setTagDraft: (value: string) => void
  summaryIntent: SummaryIntent
  tagDraft: string
}

export type EditorStudioDraftLifecycleSlice = {
  clearLocalDraft: () => void
  discardLocalDraftCandidate: () => void
  dismissedLocalDraft: LocalDraftFingerprintSnapshot[]
  dismissLocalDraftRestoreSuggestion: () => void
  lastLocalDraftFingerprintRef: { current: string }
  localDraftCandidate: LocalDraftFingerprintSnapshot | null
  localDraftCandidates: LocalDraftFingerprintSnapshot[]
  localDraftSavedAt: string
  localDraftSource: LocalDraftSource
  restoreLocalDraft: () => void
  restoredLocalDraft: LocalDraftFingerprintSnapshot[]
  saveLocalDraft: (options?: { silent?: boolean; force?: boolean }) => void
  selectLocalDraftCandidate: (key: string) => void
}

export type EditorStudioThumbnailSlice = {
  applyFirstBodyImageToThumbnail: () => void
  commitPreviewThumbTransform: (next: { focusX: number; focusY: number; zoom: number }) => void
  finalizePreviewThumbPointer: PointerEventHandler<HTMLDivElement>
  handlePreviewThumbPointerDown: PointerEventHandler<HTMLDivElement>
  handlePreviewThumbPointerMove: PointerEventHandler<HTMLDivElement>
  handleThumbnailImageFileChange: ChangeEventHandler<HTMLInputElement>
  handleThumbnailPaste: ClipboardEventHandler<HTMLElement>
  handleThumbnailUrlModalChange: (value: string) => void
  isMobileThumbnailEditorOpen: boolean
  isPreviewThumbDragging: boolean
  isPreviewThumbnailError: boolean
  openThumbnailFileInput: () => void
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailUrl: string
  postThumbnailZoom: number
  previewThumbFrameRef: RefObject<HTMLDivElement | null>
  previewThumbTransformRef: { current: { focusX: number; focusY: number; zoom: number } }
  resetThumbnailToAutoMode: () => void
  safePreviewThumbnail: string
  setIsMobileThumbnailEditorOpen: (updater: (current: boolean) => boolean) => void
  setIsPreviewThumbnailError: (value: boolean) => void
  thumbnailImageFileInputRef: RefObject<HTMLInputElement | null>
  thumbnailImageFileName: string
}

export type EditorStudioPublishModalSlice = {
  closePublishModal: () => void
  handleConfirmPublish: () => Promise<void>
  isPublishModalOpen: boolean
  openPublishModal: (type: PublishActionType) => void
  publishActionType: PublishActionType
  publishModalNotice: { tone: "idle" | "loading" | "success" | "error"; text: string }
  publishNotice: { tone: "idle" | "loading" | "success" | "error"; text: string }
}

export type EditorStudioUploadHandlersSlice = {
  handleMarkdownEditorFileUpload: (file: File) => Promise<{
    url?: string
    name?: string
    mimeType?: string
    sizeBytes?: number
    description?: string
  }>
  handleMarkdownEditorImageUpload: (file: File) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
}

export type EditorStudioWorkspaceControllerRootViewBag =
  & EditorStudioDocumentSlice
  & EditorStudioDraftLifecycleSlice
  & EditorStudioThumbnailSlice
  & EditorStudioPublishModalSlice
  & EditorStudioUploadHandlersSlice

export type EditorStudioWorkspaceControllerRootViewProps = {
  props: EditorStudioWorkspaceControllerRootViewBag
}

export const resolveEditorPrimaryActionType = (
  editorMode: "create" | "edit",
  isTempDraftMode: boolean
): PublishActionType => {
  if (editorMode === "create") return "create"
  return isTempDraftMode ? "temp" : "modify"
}

export const resolveSelectedLocalDraftKey = (
  eligibleCandidates: LocalDraftFingerprintSnapshot[],
  currentCandidate: LocalDraftFingerprintSnapshot | null
): string => {
  const key = currentCandidate?.key ?? ""
  if (!key) return ""
  return eligibleCandidates.some((candidate) => candidate.key === key) ? key : ""
}

export const shouldDisplayNewEditorBootstrapState = (
  isDedicatedNewEditorRoute: boolean,
  postId: string,
  isNewEditorBootstrapPending: boolean,
  loadingKey: string
): boolean =>
  isDedicatedNewEditorRoute &&
  !postId.trim() &&
  (isNewEditorBootstrapPending || loadingKey === "postTemp")
