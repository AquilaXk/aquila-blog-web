import { useCallback, type Dispatch, type SetStateAction } from "react"

type NoticeState = {
  tone: "idle" | "loading" | "success" | "error"
  text: string
}

type PublishActionType = "create" | "modify" | "temp"

export const extractPendingTagDraftValues = (tagDraft: string): string[] =>
  tagDraft
    .split(/[,，]/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)

type UseEditorStudioPublishModalFlowParams = {
  activateComposeSurface: () => void
  addTagsToPost?: (values: string[]) => string[]
  commitPostCategory?: () => void
  handleModifyPost: () => Promise<boolean>
  handlePublishTempDraft: () => Promise<boolean>
  handleWritePost: () => Promise<boolean>
  isPreviewThumbnailError: boolean
  loadingKey: string
  publishActionType: PublishActionType
  publishModalHintByAction: (actionType: PublishActionType) => string
  safePreviewThumbnail: string
  setIsMobileMetaEditorOpen: Dispatch<SetStateAction<boolean>>
  setIsMobileThumbnailEditorOpen: Dispatch<SetStateAction<boolean>>
  setIsPublishModalOpen: Dispatch<SetStateAction<boolean>>
  setPublishActionType: Dispatch<SetStateAction<PublishActionType>>
  setPublishModalNotice: Dispatch<SetStateAction<NoticeState>>
  setTagDraft?: Dispatch<SetStateAction<string>>
  tagDraft?: string
}

export const useEditorStudioPublishModalFlow = ({
  activateComposeSurface,
  addTagsToPost,
  commitPostCategory,
  handleModifyPost,
  handlePublishTempDraft,
  handleWritePost,
  isPreviewThumbnailError,
  loadingKey,
  publishActionType,
  publishModalHintByAction,
  safePreviewThumbnail,
  setIsMobileMetaEditorOpen,
  setIsMobileThumbnailEditorOpen,
  setIsPublishModalOpen,
  setPublishActionType,
  setPublishModalNotice,
  setTagDraft,
  tagDraft = "",
}: UseEditorStudioPublishModalFlowParams) => {
  const flushPendingAuthoringMetadata = useCallback(() => {
    const pendingTags = extractPendingTagDraftValues(tagDraft)
    if (pendingTags.length > 0) {
      addTagsToPost?.(pendingTags)
      setTagDraft?.("")
    } else if (tagDraft.length > 0) {
      setTagDraft?.("")
    }
    commitPostCategory?.()
  }, [addTagsToPost, commitPostCategory, setTagDraft, tagDraft])

  const openPublishModal = useCallback((actionType: PublishActionType) => {
    flushPendingAuthoringMetadata()
    activateComposeSurface()
    setPublishActionType(actionType)
    setPublishModalNotice({
      tone: "idle",
      text: publishModalHintByAction(actionType),
    })
    const shouldOpenThumbnailEditorByDefault = Boolean(safePreviewThumbnail && !isPreviewThumbnailError)
    setIsMobileThumbnailEditorOpen(shouldOpenThumbnailEditorByDefault)
    setIsMobileMetaEditorOpen(!shouldOpenThumbnailEditorByDefault)
    setIsPublishModalOpen(true)
  }, [
    activateComposeSurface,
    flushPendingAuthoringMetadata,
    isPreviewThumbnailError,
    publishModalHintByAction,
    safePreviewThumbnail,
    setIsMobileMetaEditorOpen,
    setIsMobileThumbnailEditorOpen,
    setIsPublishModalOpen,
    setPublishActionType,
    setPublishModalNotice,
  ])

  const closePublishModal = useCallback(() => {
    if (
      loadingKey === "writePost" ||
      loadingKey === "modifyPost" ||
      loadingKey === "publishTempPost"
    ) return
    setPublishModalNotice({
      tone: "idle",
      text: publishModalHintByAction(publishActionType),
    })
    setIsPublishModalOpen(false)
  }, [
    loadingKey,
    publishActionType,
    publishModalHintByAction,
    setIsPublishModalOpen,
    setPublishModalNotice,
  ])

  const handleConfirmPublish = useCallback(async () => {
    flushPendingAuthoringMetadata()
    const success =
      publishActionType === "create"
        ? await handleWritePost()
        : publishActionType === "modify"
          ? await handleModifyPost()
          : await handlePublishTempDraft()

    if (success) {
      setIsPublishModalOpen(false)
    }
  }, [
    flushPendingAuthoringMetadata,
    handleModifyPost,
    handlePublishTempDraft,
    handleWritePost,
    publishActionType,
    setIsPublishModalOpen,
  ])

  return {
    closePublishModal,
    handleConfirmPublish,
    openPublishModal,
  }
}
