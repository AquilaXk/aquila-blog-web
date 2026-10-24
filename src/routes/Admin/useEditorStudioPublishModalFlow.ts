import { useCallback, type Dispatch, type SetStateAction } from "react"

type NoticeState = {
  tone: "idle" | "loading" | "success" | "error"
  text: string
}

type PublishActionType = "create" | "modify" | "temp"

type UseEditorStudioPublishModalFlowParams = {
  activateComposeSurface: () => void
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
}

export const useEditorStudioPublishModalFlow = ({
  activateComposeSurface,
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
}: UseEditorStudioPublishModalFlowParams) => {
  const openPublishModal = useCallback((actionType: PublishActionType) => {
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
    const success =
      publishActionType === "create"
        ? await handleWritePost()
        : publishActionType === "modify"
          ? await handleModifyPost()
          : await handlePublishTempDraft()

    if (success) {
      setIsPublishModalOpen(false)
    }
  }, [handleModifyPost, handlePublishTempDraft, handleWritePost, publishActionType, setIsPublishModalOpen])

  return {
    closePublishModal,
    handleConfirmPublish,
    openPublishModal,
  }
}
