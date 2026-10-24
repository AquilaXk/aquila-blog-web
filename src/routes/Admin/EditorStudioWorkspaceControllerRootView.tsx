import {
  useCallback,
  useMemo,
  useState,
  type ChangeEventHandler,
  type ClipboardEventHandler,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type RefObject,
} from "react"
import {
  clampThumbnailZoom,
  DEFAULT_THUMBNAIL_FOCUS_X,
  DEFAULT_THUMBNAIL_FOCUS_Y,
  DEFAULT_THUMBNAIL_ZOOM,
} from "src/libs/thumbnailFocus"
import { POST_IMAGE_UPLOAD_RULE_LABEL } from "src/libs/profileImageUpload"
import { WriterEditorHost } from "./WriterEditorHost"
import {
  handleMarkdownEditorFocusRequestReady,
  requestMarkdownEditorFocus,
} from "./useEditorStudioWorkspaceControllerRuntime"
import { EditorStudioThumbnailEditorPanel, EditorStudioThumbnailMetaPanel } from "./EditorStudioThumbnailPanels"
import { EditorStudioPublishModal } from "./EditorStudioPublishModal"
import { EditorStudioResultLogPanel } from "./EditorStudioResultLogPanel"
import { EditorStudioDedicatedEditorLoadingState, EditorStudioDedicatedEditorSurface } from "./EditorStudioDedicatedEditorSurface"
import { deriveEditorPersistenceState, derivePublishActionViewModel, type PostVisibility, type PublishActionType } from "./editorStudioState"
import { isEditorUnsavedDirtyByFingerprint } from "./editorStudioUnsavedExitGuard"
import { useEditorStudioUnsavedExitGuard } from "./useEditorStudioUnsavedExitGuard"
import { buildEditorStateFingerprint, detectPublishPlaceholderIssue, type LocalDraftSource } from "./editorStudioMetaModel"
import { isLocalDraftRestoreSuggestionEligible, type LocalDraftFingerprintSnapshot } from "./useEditorStudioDraftLifecycleModel"
import { MARKDOWN_EDITOR_MERMAID_ENABLED, PUBLISH_VISIBILITY_OPTIONS, recordEditorCommitDurationForRuntimeGuard, type SummaryIntent } from "./EditorStudioWorkspaceControllerRootModel"

type EditorStudioWorkspaceControllerRootViewBag = {
  addTagsToPost: (tags: string[]) => void
  addTagToPost: (tag: string) => void
  applyFirstBodyImageToThumbnail: () => void
  clearLocalDraft: () => void
  discardLocalDraftCandidate: () => void
  closePublishModal: () => void
  commitPreviewThumbTransform: (next: { focusX: number; focusY: number; zoom: number }) => void
  customCategoryCatalog: string[]
  deferredContentDerived: { firstImage: string }
  dismissedLocalDraft: LocalDraftFingerprintSnapshot[]
  dismissLocalDraftRestoreSuggestion: () => void
  disabled: (key: string) => boolean
  editorMode: "create" | "edit"
  finalizePreviewThumbPointer: PointerEventHandler<HTMLDivElement>
  handleMarkdownEditorChange: (next: string, meta?: { editorFocused: boolean }) => void
  handleMarkdownEditorFileUpload: (file: File) => Promise<{
    url?: string
    name?: string
    mimeType?: string
    sizeBytes?: number
    description?: string
  }>
  handleMarkdownEditorImageUpload: (file: File) => Promise<{ alt?: string; title?: string; url?: string; src?: string }>
  handleConfirmPublish: () => Promise<void>
  handleExitDedicatedEditor: () => void
  handleFlushMarkdownReady: (flushFn: (() => string) | null) => void
  commitPostCategory: () => void
  handlePostCategoryChange: (value: string) => void
  handlePostSummaryChange: (value: string) => void
  handlePreviewThumbPointerDown: PointerEventHandler<HTMLDivElement>
  handlePreviewThumbPointerMove: PointerEventHandler<HTMLDivElement>
  handleThumbnailImageFileChange: ChangeEventHandler<HTMLInputElement>
  handleThumbnailPaste: ClipboardEventHandler<HTMLElement>
  handleThumbnailUrlModalChange: (value: string) => void
  handleTitleChange: ChangeEventHandler<HTMLTextAreaElement>
  handleTitleFieldRef: (node: HTMLTextAreaElement | null) => void
  handleTitleKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  handleFocusTitle: () => void
  isCompactMobileLayout: boolean
  isDedicatedEditorRoute: boolean
  isDedicatedNewEditorRoute: boolean
  isMobileMetaEditorOpen: boolean
  isMobileThumbnailEditorOpen: boolean
  isNewEditorBootstrapPending: boolean
  isPreviewThumbDragging: boolean
  isPreviewThumbnailError: boolean
  isPublishModalOpen: boolean
  isTempDraftMode: boolean
  getCurrentPostContent: () => string
  lastLocalDraftFingerprintRef: { current: string }
  loadingKey: string
  localDraftCandidate: LocalDraftFingerprintSnapshot | null
  localDraftCandidates: LocalDraftFingerprintSnapshot[]
  localDraftSavedAt: string
  localDraftSource: LocalDraftSource
  openPublishModal: (type: PublishActionType) => void
  openThumbnailFileInput: () => void
  postCategory: string
  postContent: string
  postId: string
  postSummary: string
  postSummarySource: "MANUAL" | "LEADING_BLOCK" | "EXTRACTED" | "MIGRATED" | "NONE"
  summaryIntent: SummaryIntent
  postTags: string[]
  postThumbnailFocusX: number
  postThumbnailFocusY: number
  postThumbnailUrl: string
  postThumbnailZoom: number
  postTitle: string
  postVisibility: PostVisibility
  publishActionType: PublishActionType
  publishModalNotice: { tone: "idle" | "loading" | "success" | "error"; text: string }
  publishNotice: { tone: "idle" | "loading" | "success" | "error"; text: string }
  previewThumbFrameRef: RefObject<HTMLDivElement | null>
  previewThumbTransformRef: { current: { focusX: number; focusY: number; zoom: number } }
  resetThumbnailToAutoMode: () => void
  removeTagFromPost: (tag: string) => void
  restoreLocalDraft: () => void
  selectLocalDraftCandidate: (key: string) => void
  restoredLocalDraft: LocalDraftFingerprintSnapshot[]
  result: string
  safePreviewThumbnail: string
  serverBaselineEditorFingerprintRef: { current: string }
  sessionMember: unknown
  setIsMobileMetaEditorOpen: (updater: (current: boolean) => boolean) => void
  setIsMobileThumbnailEditorOpen: (updater: (current: boolean) => boolean) => void
  setIsPreviewThumbnailError: (value: boolean) => void
  setPostVisibility: (nextVisibility: PostVisibility) => void
  setTagDraft: (value: string) => void
  tagDraft: string
  thumbnailImageFileInputRef: RefObject<HTMLInputElement | null>
  thumbnailImageFileName: string
}

type EditorStudioWorkspaceControllerRootViewProps = {
  props: EditorStudioWorkspaceControllerRootViewBag
}

export const EditorStudioWorkspaceControllerRootView = ({ props }: EditorStudioWorkspaceControllerRootViewProps) => {
  const {
    addTagsToPost, addTagToPost, applyFirstBodyImageToThumbnail, clearLocalDraft, discardLocalDraftCandidate,
    closePublishModal, commitPreviewThumbTransform, customCategoryCatalog, deferredContentDerived,
    dismissedLocalDraft, dismissLocalDraftRestoreSuggestion,
    disabled, editorMode, finalizePreviewThumbPointer, handleMarkdownEditorChange, handleMarkdownEditorFileUpload,
    handleMarkdownEditorImageUpload, handleConfirmPublish, handleExitDedicatedEditor, handleFlushMarkdownReady,
    commitPostCategory, handlePostCategoryChange, handlePostSummaryChange, handlePreviewThumbPointerDown,
    handlePreviewThumbPointerMove, handleThumbnailImageFileChange, handleThumbnailPaste, handleThumbnailUrlModalChange,
    handleTitleChange, handleTitleFieldRef, handleTitleKeyDown, handleFocusTitle, isCompactMobileLayout,
    isDedicatedEditorRoute, isDedicatedNewEditorRoute, isMobileMetaEditorOpen, isMobileThumbnailEditorOpen,
    isNewEditorBootstrapPending, isPreviewThumbDragging, isPreviewThumbnailError, isPublishModalOpen, isTempDraftMode,
    getCurrentPostContent, lastLocalDraftFingerprintRef, loadingKey, localDraftCandidate, localDraftCandidates,
    localDraftSavedAt, localDraftSource, openPublishModal, openThumbnailFileInput, postCategory, postContent,
    postId, postSummary, postSummarySource, summaryIntent, postTags, postThumbnailFocusX, postThumbnailFocusY,
    postThumbnailUrl, postThumbnailZoom, postTitle, postVisibility, publishActionType, publishModalNotice,
    publishNotice, previewThumbFrameRef, previewThumbTransformRef, resetThumbnailToAutoMode, removeTagFromPost,
    restoreLocalDraft, selectLocalDraftCandidate, restoredLocalDraft, result, safePreviewThumbnail,
    serverBaselineEditorFingerprintRef, sessionMember, setIsMobileMetaEditorOpen, setIsMobileThumbnailEditorOpen,
    setIsPreviewThumbnailError, setPostVisibility, setTagDraft, tagDraft, thumbnailImageFileInputRef,
    thumbnailImageFileName,
  } = props
  const [isMarkdownUploading, setIsMarkdownUploading] = useState(false)
  const [editorSelection, setEditorSelection] = useState<{ from: number; to: number }>({ from: 0, to: 0 })
  const handleMarkdownUploadingChange = useCallback((nextIsUploading: boolean) => {
    setIsMarkdownUploading(nextIsUploading)
  }, [])
  const pristineCreateFingerprint = useMemo(
    () =>
      buildEditorStateFingerprint({
        title: "",
        content: "",
        summary: "",
        summarySource: "NONE",
        summaryIntent: { kind: "auto" },
        thumbnailUrl: "",
        thumbnailFocusX: DEFAULT_THUMBNAIL_FOCUS_X,
        thumbnailFocusY: DEFAULT_THUMBNAIL_FOCUS_Y,
        thumbnailZoom: DEFAULT_THUMBNAIL_ZOOM,
        tags: [],
        category: "",
        visibility: "PUBLIC_LISTED",
      }),
    []
  )
  const editorStateFingerprint = useMemo(
    () =>
      buildEditorStateFingerprint({
        title: postTitle,
        content: postContent,
        summary: postSummary,
        summarySource: postSummarySource,
        summaryIntent,
        thumbnailUrl: postThumbnailUrl,
        thumbnailFocusX: postThumbnailFocusX,
        thumbnailFocusY: postThumbnailFocusY,
        thumbnailZoom: postThumbnailZoom,
        tags: postTags,
        category: postCategory,
        visibility: postVisibility,
      }),
    [
      postCategory,
      postContent,
      postSummary,
      postSummarySource,
      summaryIntent,
      postTags,
      postThumbnailFocusX,
      postThumbnailFocusY,
      postThumbnailZoom,
      postThumbnailUrl,
      postTitle,
      postVisibility,
    ]
  )
  const hasSelectedManagedPost = editorMode === "edit" && postId.trim().length > 0
  const hasEditorDraftContent = Boolean(postTitle.trim() || postContent.trim())
  const hasEditorMinimumFields = Boolean(postTitle.trim() && postContent.trim())
  const publishPlaceholderIssue = hasEditorMinimumFields
    ? detectPublishPlaceholderIssue(postContent)
    : null
  const editorPersistenceState = deriveEditorPersistenceState({
    editorMode,
    hasSelectedManagedPost,
    hasEditorDraftContent,
    editorStateFingerprint,
    serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
    localDraftFingerprint: lastLocalDraftFingerprintRef.current,
    localDraftSavedAt,
    loadingKey,
    publishNoticeTone: publishNotice.tone,
  })
  const composeStatusText = editorPersistenceState.text
  const composeStatusTone = editorPersistenceState.tone
  const isEditorSaving =
    loadingKey === "writePost" || loadingKey === "modifyPost" || loadingKey === "publishTempPost"
  const isEditorUnsavedDirty = isEditorUnsavedDirtyByFingerprint({
    isSaving: isEditorSaving,
    editorMode,
    hasSelectedManagedPost,
    editorStateFingerprint,
    serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
    localDraftFingerprint: lastLocalDraftFingerprintRef.current,
    localDraftSavedAt,
    pristineCreateFingerprint,
  })
  const eligibleLocalDraftCandidates = localDraftCandidates.filter((candidate) => isLocalDraftRestoreSuggestionEligible({
    candidate,
    currentSource: localDraftSource,
    editorFingerprint: editorStateFingerprint,
    serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
    restored: restoredLocalDraft,
    dismissed: dismissedLocalDraft,
  }))
  const isLocalDraftRestoreSuggestionVisible = eligibleLocalDraftCandidates.length > 0
  const selectedLocalDraftCandidateKey = eligibleLocalDraftCandidates.some(
    (candidate) => candidate.key === localDraftCandidate?.key
  ) ? (localDraftCandidate?.key ?? "") : ""
  const getIsEditorUnsavedDirty = useCallback(() => {
    const liveContent =
      typeof getCurrentPostContent === "function" ? getCurrentPostContent() : postContent
    return isEditorUnsavedDirtyByFingerprint({
      isSaving: isEditorSaving,
      editorMode,
      hasSelectedManagedPost,
      editorStateFingerprint: buildEditorStateFingerprint({
        title: postTitle,
        content: liveContent,
        summary: postSummary,
        summarySource: postSummarySource,
        summaryIntent,
        thumbnailUrl: postThumbnailUrl,
        thumbnailFocusX: postThumbnailFocusX,
        thumbnailFocusY: postThumbnailFocusY,
        thumbnailZoom: postThumbnailZoom,
        tags: postTags,
        category: postCategory,
        visibility: postVisibility,
      }),
      serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
      localDraftFingerprint: lastLocalDraftFingerprintRef.current,
      localDraftSavedAt,
      pristineCreateFingerprint,
    })
  }, [
    editorMode,
    getCurrentPostContent,
    hasSelectedManagedPost,
    isEditorSaving,
    lastLocalDraftFingerprintRef,
    localDraftSavedAt,
    postCategory,
    postContent,
    postSummary,
    postSummarySource,
    summaryIntent,
    postTags,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailZoom,
    postThumbnailUrl,
    postTitle,
    postVisibility,
    pristineCreateFingerprint,
    serverBaselineEditorFingerprintRef,
  ])
  const { requestGuardedAction, dialog: unsavedExitDialog } = useEditorStudioUnsavedExitGuard({
    enabled: Boolean(sessionMember),
    isDirty: isEditorUnsavedDirty,
    getIsDirty: getIsEditorUnsavedDirty,
  })
  const handleGuardedExitDedicatedEditor = useCallback(() => {
    requestGuardedAction(() => {
      handleExitDedicatedEditor()
    })
  }, [handleExitDedicatedEditor, requestGuardedAction])
  const publishActionViewModel = derivePublishActionViewModel({
    publishActionType,
    editorMode,
    loadingKey,
    hasEditorMinimumFields,
    hasPlaceholderIssue: Boolean(publishPlaceholderIssue),
    isTempDraftMode,
    isMarkdownUploading,
  })
  const {
    publishActionTitle,
    publishActionButtonText,
    publishActionButtonDisabled,
    publishActionTriggerDisabled,
  } = publishActionViewModel
  const shouldShowPublishModalNotice = publishModalNotice.tone !== "idle"
  const shouldShowPublishNotice = publishNotice.tone !== "idle"
  const isThumbnailUploadDisabled = disabled("uploadThumbnail")
  const handleThumbnailZoomModalChange = useCallback(
    (nextZoom: number) => {
      commitPreviewThumbTransform({
        ...previewThumbTransformRef.current,
        zoom: clampThumbnailZoom(nextZoom),
      })
    },
    [commitPreviewThumbTransform, previewThumbTransformRef]
  )
  const resetThumbnailZoomInModal = useCallback(() => {
    commitPreviewThumbTransform({
      ...previewThumbTransformRef.current,
      zoom: DEFAULT_THUMBNAIL_ZOOM,
    })
  }, [commitPreviewThumbTransform, previewThumbTransformRef])
  const thumbnailEditorPanel = (
    <EditorStudioThumbnailEditorPanel
      finalizePreviewThumbPointer={finalizePreviewThumbPointer}
      handlePreviewThumbPointerDown={handlePreviewThumbPointerDown}
      handlePreviewThumbPointerMove={handlePreviewThumbPointerMove}
      isPreviewThumbDragging={isPreviewThumbDragging}
      isPreviewThumbnailError={isPreviewThumbnailError}
      postThumbnailZoom={postThumbnailZoom}
      previewThumbFrameRef={previewThumbFrameRef}
      safePreviewThumbnail={safePreviewThumbnail}
      setIsPreviewThumbnailError={setIsPreviewThumbnailError}
      onThumbnailZoomChange={handleThumbnailZoomModalChange}
      onResetThumbnailZoom={resetThumbnailZoomInModal}
    />
  )
  const previewMetaEditorPanel = (
    <EditorStudioThumbnailMetaPanel
      firstBodyImageUrl={deferredContentDerived.firstImage}
      isThumbnailUploadDisabled={isThumbnailUploadDisabled}
      isThumbnailUploading={loadingKey === "uploadThumbnail"}
      postThumbnailUrl={postThumbnailUrl}
      thumbnailImageFileName={thumbnailImageFileName}
      thumbnailUploadRuleLabel={POST_IMAGE_UPLOAD_RULE_LABEL}
      onApplyFirstBodyImage={applyFirstBodyImageToThumbnail}
      onOpenThumbnailFileInput={openThumbnailFileInput}
      onResetThumbnailToAutoMode={resetThumbnailToAutoMode}
      onThumbnailPaste={handleThumbnailPaste}
      onThumbnailUrlChange={handleThumbnailUrlModalChange}
    />
  )
  const editorPrimaryActionType: PublishActionType =
    editorMode === "create" ? "create" : isTempDraftMode ? "temp" : "modify"
  const isMarkdownEditorDisabled = loadingKey.length > 0
  const handleEditorCommitDuration = useCallback((actualDuration: number) => {
    recordEditorCommitDurationForRuntimeGuard(actualDuration)
  }, [])
  const handleDedicatedEditorRequestSave = useCallback(() => {
    if (publishActionTriggerDisabled) return
    openPublishModal(editorPrimaryActionType)
  }, [editorPrimaryActionType, openPublishModal, publishActionTriggerDisabled])

  const dedicatedEditorCanvas = useMemo(
    () => (
      <WriterEditorHost
        canvasId="editor-dedicated-canvas"
        markdown={postContent}
        onMarkdownChange={handleMarkdownEditorChange}
        onSelectionChange={setEditorSelection}
        onFlushMarkdownReady={handleFlushMarkdownReady}
        onFocusRequestReady={handleMarkdownEditorFocusRequestReady}
        onRequestFocusTitle={handleFocusTitle}
        onRequestSave={handleDedicatedEditorRequestSave}
        onUploadingChange={handleMarkdownUploadingChange}
        onImageUpload={handleMarkdownEditorImageUpload}
        onFileUpload={handleMarkdownEditorFileUpload}
        mermaidEnabled={MARKDOWN_EDITOR_MERMAID_ENABLED}
        disabled={isMarkdownEditorDisabled}
        onCommitDuration={handleEditorCommitDuration}
      />
    ),
    [
      handleDedicatedEditorRequestSave,
      handleFocusTitle,
      handleMarkdownEditorChange,
      handleMarkdownEditorFileUpload,
      handleMarkdownEditorImageUpload,
      handleFlushMarkdownReady,
      handleEditorCommitDuration,
      handleMarkdownUploadingChange,
      isMarkdownEditorDisabled,
      postContent,
    ]
  )
  const shouldShowEditorLoadingState =
    isDedicatedNewEditorRoute &&
    !postId.trim() &&
    (isNewEditorBootstrapPending || loadingKey === "postTemp")
  const shouldShowResultPanel = Boolean(loadingKey || result)
  const dedicatedEditorResultPanel = useMemo(
    () =>
      shouldShowResultPanel ? (
        <EditorStudioResultLogPanel
          idleDescription="원본 응답을 확인할 수 있습니다"
          idleTitle="최근 작업 응답"
          loadingDescription={(currentLoadingKey) => `실행 중: ${currentLoadingKey}`}
          loadingKey={loadingKey}
          loadingTitle="작업 응답 확인 중"
          result={result}
          variant="dedicated"
        />
      ) : null,
    [loadingKey, result, shouldShowResultPanel]
  )

  if (!sessionMember) {
    return null
  }

  if (shouldShowEditorLoadingState) {
    return (
      <>
        <EditorStudioDedicatedEditorLoadingState />
        {unsavedExitDialog}
      </>
    )
  }

  if (isDedicatedEditorRoute) {
    return (
      <>
      <EditorStudioDedicatedEditorSurface
        thumbnailImageFileInputRef={thumbnailImageFileInputRef}
        onThumbnailImageFileChange={handleThumbnailImageFileChange}
        onExit={handleGuardedExitDedicatedEditor}
        saveStateText={composeStatusText}
        saveStateTone={composeStatusTone}
        primaryActionDisabled={publishActionTriggerDisabled}
        primaryActionLabel="발행하기"
        onPrimaryAction={() => openPublishModal(editorPrimaryActionType)}
        postTags={postTags}
        tagDraft={tagDraft}
        onTagDraftChange={setTagDraft}
        onAddTags={addTagsToPost}
        onAddTag={addTagToPost}
        onRemoveTag={removeTagFromPost}
        titleInputRef={handleTitleFieldRef}
        onOutlineBodyHeadingActivate={requestMarkdownEditorFocus}
        activeCursorOffset={editorSelection.to}
        activeSelectionRange={editorSelection}
        postTitle={postTitle}
        onPostTitleChange={handleTitleChange}
        onPostTitleKeyDown={handleTitleKeyDown}
        postContent={postContent}
        postSummary={postSummary}
        onPostSummaryChange={handlePostSummaryChange}
        postCategory={postCategory}
        onPostCategoryChange={handlePostCategoryChange}
        onCommitPostCategory={commitPostCategory}
        categorySuggestions={customCategoryCatalog}
        postVisibility={postVisibility}
        onPostVisibilityChange={setPostVisibility}
        editorCanvas={dedicatedEditorCanvas}
        showPublishNotice={shouldShowPublishNotice}
        publishNoticeTone={publishNotice.tone}
        publishNoticeText={publishNotice.text}
        isLocalDraftRestoreSuggestionVisible={isLocalDraftRestoreSuggestionVisible}
        isLocalDraftRestoreSuggestionActionsDisabled={loadingKey.length > 0}
        onRestoreLocalDraft={restoreLocalDraft}
        localDraftCandidates={eligibleLocalDraftCandidates.map((candidate) => ({ key: candidate.key, label: candidate.label ?? candidate.key }))}
        selectedLocalDraftCandidateKey={selectedLocalDraftCandidateKey}
        onSelectLocalDraftCandidate={selectLocalDraftCandidate}
        onDiscardLocalDraftCandidate={discardLocalDraftCandidate}
        onDismissLocalDraftRestoreSuggestion={dismissLocalDraftRestoreSuggestion}
        onClearLocalDraft={clearLocalDraft}
        resultPanel={dedicatedEditorResultPanel}
        publishModal={
          isPublishModalOpen ? (
            <EditorStudioPublishModal
              closeToggleLabel="닫기"
              isCompactMobileLayout={isCompactMobileLayout}
              isMobileMetaEditorOpen={isMobileMetaEditorOpen}
              isMobileThumbnailEditorOpen={isMobileThumbnailEditorOpen}
              loadingKey={loadingKey}
              modalNotice={publishModalNotice}
              postVisibility={postVisibility}
              previewMetaEditorPanel={previewMetaEditorPanel}
              publishActionButtonDisabled={publishActionButtonDisabled}
              publishActionButtonText={publishActionButtonText}
              publishActionTitle={publishActionTitle}
              shouldShowNotice={shouldShowPublishModalNotice}
              thumbnailEditorPanel={thumbnailEditorPanel}
              variant="drawer"
              visibilityOptions={PUBLISH_VISIBILITY_OPTIONS}
              onClose={closePublishModal}
              onConfirmPublish={() => void handleConfirmPublish()}
              onPostVisibilityChange={setPostVisibility}
              onToggleMobileMetaEditor={() => setIsMobileMetaEditorOpen((current: boolean) => !current)}
              onToggleMobileThumbnailEditor={() => setIsMobileThumbnailEditorOpen((current: boolean) => !current)}
            />
          ) : null
        }
      />
      {unsavedExitDialog}
      </>
    )
  }

  return null
}
