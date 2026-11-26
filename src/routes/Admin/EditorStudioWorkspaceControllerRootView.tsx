import {
  useCallback,
  useMemo,
  useState,
} from "react"
import { useLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import {
  clampThumbnailZoom,
  DEFAULT_THUMBNAIL_FOCUS_X,
  DEFAULT_THUMBNAIL_FOCUS_Y,
  DEFAULT_THUMBNAIL_ZOOM,
} from "src/libs/thumbnailFocus"
import { POST_IMAGE_UPLOAD_RULE_LABEL } from "src/libs/profileImageUpload"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
import { WriterEditorHost } from "./WriterEditorHost"
import {
  handleMarkdownEditorFocusRequestReady,
  handleToggleViewModeRequestReady,
  requestMarkdownEditorFocus,
  requestMarkdownEditorInsertSnippet,
} from "./useEditorStudioWorkspaceControllerRuntime"
import { EditorStudioThumbnailEditorPanel, EditorStudioThumbnailMetaPanel } from "./EditorStudioThumbnailPanels"
import { EditorStudioPublishModal } from "./EditorStudioPublishModal"
import { EditorStudioDedicatedEditorLoadingState, EditorStudioDedicatedEditorSurface } from "./EditorStudioDedicatedEditorSurface"
import {
  countMarkdownLinkWarnings,
  countMarkdownTotalLinks,
} from "./editorStudioDedicatedSurfaceModel"
import { deriveEditorPersistenceState, derivePublishActionViewModel } from "./editorStudioState"
import { isEditorUnsavedDirtyByFingerprint } from "./editorStudioUnsavedExitGuard"
import { useEditorStudioUnsavedExitGuard } from "./useEditorStudioUnsavedExitGuard"
import { buildEditorStateFingerprint, detectPublishPlaceholderIssue } from "./editorStudioMetaModel"
import { scanMarkdownPrePublishWarnings } from "./editorStudioPublishWarnings"
import { isLocalDraftRestoreSuggestionEligible } from "./useEditorStudioDraftLifecycleModel"
import {
  getPublishVisibilityOptions,
  MARKDOWN_EDITOR_MERMAID_ENABLED,
  recordEditorCommitDurationForRuntimeGuard,
} from "./EditorStudioWorkspaceControllerRootModel"
import {
  resolveEditorPrimaryActionType,
  resolveSelectedLocalDraftKey,
  shouldDisplayNewEditorBootstrapState,
  type EditorStudioWorkspaceControllerRootViewProps,
} from "./EditorStudioWorkspaceControllerRootViewTypes"

export type {
  EditorStudioDocumentSlice,
  EditorStudioDraftLifecycleSlice,
  EditorStudioThumbnailSlice,
  EditorStudioPublishModalSlice,
  EditorStudioUploadHandlersSlice,
  EditorStudioWorkspaceControllerRootViewBag,
  EditorStudioWorkspaceControllerRootViewProps,
} from "./EditorStudioWorkspaceControllerRootViewTypes"

export const EditorStudioWorkspaceControllerRootView = ({ props }: EditorStudioWorkspaceControllerRootViewProps) => {
  const { language } = useLanguage()
  const {
    addTagsToPost, addTagToPost, applyFirstBodyImageToThumbnail, clearLocalDraft, discardLocalDraftCandidate,
    closePublishModal, commitPreviewThumbTransform, customCategoryCatalog, customTagCatalog, deferredContentDerived,
    dismissedLocalDraft, dismissLocalDraftRestoreSuggestion,
    disabled, editorMode, finalizePreviewThumbPointer, handleMarkdownEditorChange, handleMarkdownEditorFileUpload,
    handleMarkdownEditorImageUpload, handleConfirmPublish, handleExitDedicatedEditor, handleFlushMarkdownReady,
    commitPostCategory, handlePostCategoryChange, handlePostSummaryChange, handlePreviewThumbPointerDown,
    handlePreviewThumbPointerMove, handleReloadLatestServerPost, handleApplyRestoredRevision, handleThumbnailImageFileChange, handleThumbnailPaste,
    handleThumbnailUrlModalChange, handleTitleChange, handleTitleFieldRef, handleTitleKeyDown, handleFocusPreviousFromBody, handleFocusTitle,
    isCompactMobileLayout, isDedicatedEditorRoute, isDedicatedNewEditorRoute, isMobileMetaEditorOpen,
    isMobileThumbnailEditorOpen, isNewEditorBootstrapPending, isPreviewThumbDragging, isPreviewThumbnailError,
    isPublishModalOpen, isTempDraftMode, getCurrentPostContent, lastLocalDraftFingerprintRef, lastSaveError,
    loadingKey, localDraftCandidate, localDraftCandidates, localDraftSavedAt, localDraftSource, openPublishModal,
    openThumbnailFileInput, postCategory, postContent, postId, postSummary, postSummarySource, summaryIntent,
    postTags, postThumbnailFocusX, postThumbnailFocusY, postThumbnailUrl, postThumbnailZoom, postTitle, postVersion,
    postVisibility, publishActionType, publishModalNotice, publishNotice, previewThumbFrameRef,
    previewThumbTransformRef, resetThumbnailToAutoMode, removeTagFromPost, restoreLocalDraft, saveLocalDraft,
    selectLocalDraftCandidate, restoredLocalDraft, safePreviewThumbnail, serverBaselineEditorFingerprintRef,
    sessionMember, setIsMobileMetaEditorOpen, setIsMobileThumbnailEditorOpen, setIsPreviewThumbnailError,
    setPostVisibility, setTagDraft, tagDraft, thumbnailImageFileInputRef, thumbnailImageFileName,
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
  const publishPlaceholderIssue = useMemo(
    () => (hasEditorMinimumFields ? detectPublishPlaceholderIssue(postContent) : null),
    [hasEditorMinimumFields, postContent]
  )
  const publishReadinessSummary = useMemo(() => {
    if (!isPublishModalOpen) return undefined
    const insights = createMarkdownDocumentInsights(postContent)
    return {
      hasTitle: postTitle.trim().length > 0,
      wordCount: insights.wordCount,
      hasBody: postContent.trim().length > 0,
      hasManualSummary: postSummarySource === "MANUAL" && postSummary.trim().length > 0,
      tagCount: postTags.length,
      linkWarningCount: countMarkdownLinkWarnings(postContent),
      totalLinkCount: countMarkdownTotalLinks(postContent),
      prePublishWarnings: scanMarkdownPrePublishWarnings(postContent),
    }
  }, [isPublishModalOpen, postContent, postSummary, postSummarySource, postTags.length, postTitle])
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
    language,
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
  const selectedLocalDraftCandidateKey = resolveSelectedLocalDraftKey(
    eligibleLocalDraftCandidates,
    localDraftCandidate
  )
  const getIsEditorUnsavedDirty = useCallback(() => {
    const liveContent = getCurrentPostContent()
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
    language,
  })
  const {
    publishActionTitle,
    publishActionButtonText,
    publishActionButtonDisabled,
    publishActionTriggerDisabled,
  } = publishActionViewModel
  const shouldShowPublishModalNotice =
    publishModalNotice.tone !== "idle" && publishModalNotice.text.trim().length > 0
  const shouldShowPublishNotice =
    publishNotice.tone !== "idle" && publishNotice.text.trim().length > 0
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
  const editorPrimaryActionType = resolveEditorPrimaryActionType(editorMode, isTempDraftMode)
  const isMarkdownEditorDisabled =
    isEditorSaving || loadingKey === "postOne" || loadingKey === "postTemp"
  const handleEditorCommitDuration = useCallback((actualDuration: number) => {
    recordEditorCommitDurationForRuntimeGuard(actualDuration)
  }, [])
  const handleDedicatedEditorRequestSave = useCallback(() => {
    saveLocalDraft({ silent: false })
  }, [saveLocalDraft])
  const handleRequestCloudAsset = useCallback(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return
    const inspectorToggle = document.querySelector<HTMLButtonElement>('[data-testid="editor-inspector-toggle"]')
    if (inspectorToggle && inspectorToggle.getAttribute("aria-pressed") !== "true") {
      inspectorToggle.click()
    }
    window.dispatchEvent(new CustomEvent("aquila-open-cloud-asset-picker"))
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("aquila-open-cloud-asset-picker"))
      document.querySelector<HTMLElement>('[data-testid="editor-cloud-asset-picker"]')?.scrollIntoView({ block: "nearest" })
    })
  }, [])

  const dedicatedEditorCanvas = useMemo(
    () => (
      <WriterEditorHost
        canvasId="editor-dedicated-canvas"
        markdown={postContent}
        onMarkdownChange={handleMarkdownEditorChange}
        onSelectionChange={setEditorSelection}
        onFlushMarkdownReady={handleFlushMarkdownReady}
        onFocusRequestReady={handleMarkdownEditorFocusRequestReady}
        onToggleViewModeRequestReady={handleToggleViewModeRequestReady}
        onRequestFocusTitle={handleFocusPreviousFromBody}
        onRequestSave={handleDedicatedEditorRequestSave}
        onUploadingChange={handleMarkdownUploadingChange}
        onImageUpload={handleMarkdownEditorImageUpload}
        onFileUpload={handleMarkdownEditorFileUpload}
        onRequestCloudAsset={handleRequestCloudAsset}
        mermaidEnabled={MARKDOWN_EDITOR_MERMAID_ENABLED}
        disabled={isMarkdownEditorDisabled}
        onCommitDuration={handleEditorCommitDuration}
      />
    ),
    [
      handleDedicatedEditorRequestSave,
      handleFocusPreviousFromBody,
      handleMarkdownEditorChange,
      handleMarkdownEditorFileUpload,
      handleMarkdownEditorImageUpload,
      handleRequestCloudAsset,
      handleFlushMarkdownReady,
      handleEditorCommitDuration,
      handleMarkdownUploadingChange,
      isMarkdownEditorDisabled,
      postContent,
    ]
  )
  const shouldShowEditorLoadingState = shouldDisplayNewEditorBootstrapState(
    isDedicatedNewEditorRoute,
    postId,
    isNewEditorBootstrapPending,
    loadingKey
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

  const handleInsertCloudMarkdownSnippet = (snippet: string) => {
    if (requestMarkdownEditorInsertSnippet(snippet, editorSelection)) return
    const current = getCurrentPostContent()
    const from = Math.max(0, Math.min(editorSelection.from, current.length))
    const to = Math.max(from, Math.min(editorSelection.to, current.length))
    const prefix = from > 0 && current[from - 1] !== "\n" ? "\n\n" : ""
    const suffix = to < current.length && current[to] !== "\n" ? "\n\n" : "\n"
    const inserted = `${prefix}${snippet}${suffix}`
    const nextCursor = from + inserted.length
    handleMarkdownEditorChange(`${current.slice(0, from)}${inserted}${current.slice(to)}`, { editorFocused: false })
    setEditorSelection({ from: nextCursor, to: nextCursor })
    requestMarkdownEditorFocus({ from: nextCursor, to: nextCursor })
  }
  const conflictReloadAction =
    lastSaveError?.errorType === "version-conflict" && hasSelectedManagedPost
      ? () => void handleReloadLatestServerPost()
      : null
  const parsedManagedPostId = Number(postId)
  const managedRevisionPostId =
    hasSelectedManagedPost &&
    !isTempDraftMode &&
    Number.isInteger(parsedManagedPostId) &&
    parsedManagedPostId > 0
      ? parsedManagedPostId
      : null

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
        primaryActionLabel={
          editorMode === "edit" && !isTempDraftMode
            ? adminT("editorActionPublishSettings", language)
            : adminT("editorActionPublish", language)
        }
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
        tagSuggestions={customTagCatalog}
        postVisibility={postVisibility}
        onPostVisibilityChange={setPostVisibility}
        editorCanvas={dedicatedEditorCanvas}
        showPublishNotice={shouldShowPublishNotice}
        publishNoticeTone={publishNotice.tone}
        publishNoticeText={publishNotice.text}
        onReloadLatestServerPost={conflictReloadAction}
        isLocalDraftRestoreSuggestionVisible={isLocalDraftRestoreSuggestionVisible}
        isLocalDraftRestoreSuggestionActionsDisabled={loadingKey.length > 0}
        onRestoreLocalDraft={restoreLocalDraft}
        localDraftCandidates={eligibleLocalDraftCandidates.map((candidate) => ({ key: candidate.key, label: candidate.label ?? candidate.key }))}
        selectedLocalDraftCandidateKey={selectedLocalDraftCandidateKey}
        onSelectLocalDraftCandidate={selectLocalDraftCandidate}
        onDiscardLocalDraftCandidate={discardLocalDraftCandidate}
        onDismissLocalDraftRestoreSuggestion={dismissLocalDraftRestoreSuggestion}
        onClearLocalDraft={clearLocalDraft}
        onUploadPostImage={handleMarkdownEditorImageUpload}
        onUploadPostAttachment={handleMarkdownEditorFileUpload}
        onInsertMarkdownSnippet={handleInsertCloudMarkdownSnippet}
        postThumbnailUrl={postThumbnailUrl}
        safePreviewThumbnail={safePreviewThumbnail}
        isThumbnailUploading={loadingKey === "uploadThumbnail"}
        isThumbnailUploadDisabled={isThumbnailUploadDisabled}
        onOpenThumbnailFileInput={openThumbnailFileInput}
        onResetThumbnailToAutoMode={resetThumbnailToAutoMode}
        managedPostId={managedRevisionPostId}
        postVersion={postVersion}
        isTempDraftMode={isTempDraftMode}
        onRevisionRestored={handleApplyRestoredRevision}
        publishModal={
          isPublishModalOpen ? (
            <EditorStudioPublishModal
              closeToggleLabel={adminT("editorCloseLabel", language)}
              hasManualThumbnail={postThumbnailUrl.trim().length > 0}
              isCompactMobileLayout={isCompactMobileLayout}
              isMobileMetaEditorOpen={isMobileMetaEditorOpen}
              isMobileThumbnailEditorOpen={isMobileThumbnailEditorOpen}
              loadingKey={loadingKey}
              modalNotice={publishModalNotice}
              postVisibility={postVisibility}
              postTitle={postTitle}
              postSummary={postSummary}
              thumbnailUrl={safePreviewThumbnail}
              postId={postId}
              readinessSummary={publishReadinessSummary}
              previewMetaEditorPanel={previewMetaEditorPanel}
              publishActionButtonDisabled={publishActionButtonDisabled}
              publishActionButtonText={publishActionButtonText}
              publishActionTitle={publishActionTitle}
              shouldShowNotice={shouldShowPublishModalNotice}
              thumbnailEditorPanel={thumbnailEditorPanel}
              variant="drawer"
              visibilityOptions={getPublishVisibilityOptions(language)}
              onClose={closePublishModal}
              onConfirmPublish={() => void handleConfirmPublish()}
              onReloadLatestServerPost={conflictReloadAction}
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
