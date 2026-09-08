import { useCallback, useMemo, useState } from "react"
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
import { EditorStudioDeleteConfirmDialog } from "./EditorStudioDeleteConfirmDialog"
import { EditorStudioDedicatedEditorLoadingState, EditorStudioDedicatedEditorSurface } from "./EditorStudioDedicatedEditorSurface"
import { deriveComposeViewModel, deriveEditorPersistenceState, derivePublishActionViewModel, getVisibilityLabel, toFlags, type PublishActionType } from "./editorStudioState"
import { isEditorUnsavedDirtyByFingerprint } from "./editorStudioUnsavedExitGuard"
import { useEditorStudioUnsavedExitGuard } from "./useEditorStudioUnsavedExitGuard"
import { buildEditorStateFingerprint, detectPublishPlaceholderIssue } from "./editorStudioMetaModel"
import { isLocalDraftRestoreSuggestionEligible } from "./useEditorStudioDraftLifecycleModel"
import { Main, HeroCard, HeroIntro, StudioStatusItem, StudioStatusStrip, WorkspaceGrid, WorkspaceMain } from "./EditorStudioWorkspaceControllerRoot.styles"
import { MARKDOWN_EDITOR_MERMAID_ENABLED, PUBLISH_VISIBILITY_OPTIONS, recordEditorCommitDurationForRuntimeGuard } from "./EditorStudioWorkspaceControllerRootModel"

type EditorStudioWorkspaceControllerRootViewProps = {
  props: Record<string, any>
}

export const EditorStudioWorkspaceControllerRootView = ({ props }: EditorStudioWorkspaceControllerRootViewProps) => {
  const {
    addTagsToPost,
    addTagToPost,
    applyFirstBodyImageToThumbnail,
    clearLocalDraft,
    closeDeleteConfirm,
    closePublishModal,
    commitPreviewThumbTransform,
    customCategoryCatalog,
    deferredContentDerived,
    deleteConfirmNotice,
    deleteConfirmState,
    deletePostsFromList,
    dismissedLocalDraft,
    dismissLocalDraftRestoreSuggestion,
    disabled,
    editorMode,
    finalizePreviewThumbPointer,
    handleMarkdownEditorChange,
    handleMarkdownEditorFileUpload,
    handleMarkdownEditorImageUpload,
    handleConfirmPublish,
    handleExitDedicatedEditor,
    handleFlushMarkdownReady,
    commitPostCategory,
    handlePostCategoryChange,
    handlePostSummaryChange,
    handlePreviewThumbPointerDown,
    handlePreviewThumbPointerMove,
    handleThumbnailImageFileChange,
    handleThumbnailPaste,
    handleThumbnailUrlModalChange,
    handleTitleChange,
    handleTitleFieldRef,
    handleTitleKeyDown,
    isCompactMobileLayout,
    isDedicatedEditorRoute,
    isDedicatedNewEditorRoute,
    isMobileMetaEditorOpen,
    isMobileThumbnailEditorOpen,
    isNewEditorBootstrapPending,
    isPreviewThumbDragging,
    isPreviewThumbnailError,
    isPublishModalOpen,
    isTempDraftMode,
    getCurrentPostContent,
    lastLocalDraftFingerprintRef,
    loadingKey,
    localDraftCandidate,
    localDraftSavedAt,
    localDraftSource,
    openPublishModal,
    openThumbnailFileInput,
    postCategory,
    postContent,
    postId,
    postSummary,
    postSummarySource,
    summaryIntent,
    postTags,
    postThumbnailFocusX,
    postThumbnailFocusY,
    postThumbnailUrl,
    postThumbnailZoom,
    postTitle,
    postVisibility,
    publishActionType,
    publishModalNotice,
    publishNotice,
    previewThumbFrameRef,
    previewThumbTransformRef,
    resetThumbnailToAutoMode,
    removeTagFromPost,
    restoreLocalDraft,
    restoredLocalDraft,
    result,
    safePreviewThumbnail,
    serverBaselineEditorFingerprintRef,
    sessionMember,
    setIsMobileMetaEditorOpen,
    setIsMobileThumbnailEditorOpen,
    setIsPreviewThumbnailError,
    setPostVisibility,
    setTagDraft,
    studioSurface,
    tagDraft,
    thumbnailImageFileInputRef,
    thumbnailImageFileName,
  } = props
  const [isMarkdownUploading, setIsMarkdownUploading] = useState(false)
  const handleMarkdownUploadingChange = useCallback((nextIsUploading: boolean) => {
    setIsMarkdownUploading(nextIsUploading)
  }, [])
  const currentFlags = toFlags(postVisibility)
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
  const currentVisibilityText = getVisibilityLabel(currentFlags.published, currentFlags.listed)
  const composeViewModel = useMemo(
    () =>
      deriveComposeViewModel({
        editorMode,
        isTempDraftMode,
        postId,
        postTitle,
        postSummary,
        postTags,
        currentVisibilityText,
      }),
    [currentVisibilityText, editorMode, isTempDraftMode, postId, postSummary, postTags, postTitle]
  )
  const {
    hasSelectedManagedPost,
    currentPostLabel,
    composePageTitle,
  } = composeViewModel
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
  const isLocalDraftRestoreSuggestionVisible = isLocalDraftRestoreSuggestionEligible({
    candidate: localDraftCandidate,
    currentSource: localDraftSource,
    editorFingerprint: editorStateFingerprint,
    serverBaselineFingerprint: serverBaselineEditorFingerprintRef.current,
    restored: restoredLocalDraft,
    dismissed: dismissedLocalDraft,
  })
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
      // Read baselines at navigation time so a just-finished save is respected.
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
  const isCompactManageSurface = isCompactMobileLayout && studioSurface === "manage"
  const shouldShowPublishModalNotice = publishModalNotice.tone !== "idle"
  const isCompactSplitPreview = false
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
        onFlushMarkdownReady={handleFlushMarkdownReady}
        onFocusRequestReady={handleMarkdownEditorFocusRequestReady}
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
        primaryActionLabel="발행 설정"
        onPrimaryAction={() => openPublishModal(editorPrimaryActionType)}
        isCompactSplitPreview={isCompactSplitPreview}
        postTags={postTags}
        tagDraft={tagDraft}
        onTagDraftChange={setTagDraft}
        onAddTags={addTagsToPost}
        onAddTag={addTagToPost}
        onRemoveTag={removeTagFromPost}
        titleInputRef={handleTitleFieldRef}
        onOutlineBodyHeadingActivate={requestMarkdownEditorFocus}
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

  return (
    <Main>
      <HeroCard data-compact-manage={isCompactManageSurface}>
        <HeroIntro data-compact-manage={isCompactManageSurface}>
          <h1>{composePageTitle}</h1>
          <p>제목과 본문에 집중하고, 발행 전 설정은 오른쪽에서 차분하게 마무리합니다.</p>
          <StudioStatusStrip aria-label="글 작업실 상태 요약">
            <StudioStatusItem>
              <span>현재 작업</span>
              <strong>{composePageTitle}</strong>
            </StudioStatusItem>
            {currentPostLabel ? (
              <StudioStatusItem>
                <span>원고</span>
                <strong>{currentPostLabel}</strong>
              </StudioStatusItem>
            ) : null}
            <StudioStatusItem data-optional="true">
              <span>공개 범위</span>
              <strong>{currentVisibilityText}</strong>
            </StudioStatusItem>
            {composeStatusText ? (
              <StudioStatusItem data-optional="true">
                <span>저장 상태</span>
                <strong>{composeStatusText}</strong>
              </StudioStatusItem>
            ) : null}
          </StudioStatusStrip>
        </HeroIntro>
      </HeroCard>

      <WorkspaceGrid>
        <WorkspaceMain>
        <EditorStudioDeleteConfirmDialog
          state={deleteConfirmState}
          noticeTone={deleteConfirmNotice.tone}
          noticeText={deleteConfirmNotice.text}
          isDeleteDisabled={loadingKey === "deletePost"}
          onClose={closeDeleteConfirm}
          onConfirm={async (state) => {
            const ok = await deletePostsFromList(state.ids)
            if (ok) closeDeleteConfirm()
          }}
        />

        {isPublishModalOpen ? (
          <EditorStudioPublishModal
            closeToggleLabel="접기"
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
            setupDescription="썸네일 위치와 글 요약을 조정합니다."
            shouldShowNotice={shouldShowPublishModalNotice}
            thumbnailEditorPanel={thumbnailEditorPanel}
            visibilityOptions={PUBLISH_VISIBILITY_OPTIONS}
            onClose={closePublishModal}
            onConfirmPublish={() => void handleConfirmPublish()}
            onPostVisibilityChange={setPostVisibility}
            onToggleMobileMetaEditor={() => setIsMobileMetaEditorOpen((current: boolean) => !current)}
            onToggleMobileThumbnailEditor={() => setIsMobileThumbnailEditorOpen((current: boolean) => !current)}
          />
        ) : null}

        </WorkspaceMain>

      </WorkspaceGrid>

      <EditorStudioResultLogPanel
        eyebrow="실행 로그"
        idleDescription="접어서 숨길 수 있습니다"
        idleTitle="최근 작업 응답 보기"
        loadingDescription={(currentLoadingKey) => `실행 중: ${currentLoadingKey}`}
        loadingKey={loadingKey}
        loadingTitle="작업 응답 확인 중"
        result={result}
        variant="standard"
      />
      {unsavedExitDialog}
    </Main>
  )
}
