import { useRef, type ReactNode } from "react"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import type { PostVisibility } from "./editorStudioState"
import {
  EditorStudioPublishCardSettings,
  EditorStudioPublishVisibilitySection,
  type EditorStudioPublishVisibilityOption,
} from "./EditorStudioPublishModalParts"
import {
  PublishButton,
  PublishDialog,
  PublishModalBackdrop,
  PublishModalBody,
  PublishModalFooter,
  PublishModalHeader,
  PublishModalNotice,
  PublishOverviewGrid,
  PublishPrimaryButton,
} from "./EditorStudioPublishModalStyles"

type NoticeTone = "idle" | "loading" | "success" | "error"

type PublishNoticeState = {
  tone: NoticeTone
  text: string
}

type EditorStudioPublishModalProps = {
  closeToggleLabel: string
  isCompactMobileLayout: boolean
  isMobileMetaEditorOpen: boolean
  isMobileThumbnailEditorOpen: boolean
  loadingKey: string
  modalNotice: PublishNoticeState
  postVisibility: PostVisibility
  previewMetaEditorPanel: ReactNode
  publishActionButtonDisabled: boolean
  publishActionButtonText: string
  publishActionTitle: string
  setupDescription?: string
  shouldShowNotice: boolean
  thumbnailEditorPanel: ReactNode
  variant?: "drawer"
  visibilityOptions: EditorStudioPublishVisibilityOption[]
  onClose: () => void
  onConfirmPublish: () => void
  onPostVisibilityChange: (nextVisibility: PostVisibility) => void
  onToggleMobileMetaEditor: () => void
  onToggleMobileThumbnailEditor: () => void
}

export const EditorStudioPublishModal = ({
  closeToggleLabel,
  isCompactMobileLayout,
  isMobileMetaEditorOpen,
  isMobileThumbnailEditorOpen,
  loadingKey,
  modalNotice,
  postVisibility,
  previewMetaEditorPanel,
  publishActionButtonDisabled,
  publishActionButtonText,
  publishActionTitle,
  setupDescription,
  shouldShowNotice,
  thumbnailEditorPanel,
  variant,
  visibilityOptions,
  onClose,
  onConfirmPublish,
  onPostVisibilityChange,
  onToggleMobileMetaEditor,
  onToggleMobileThumbnailEditor,
}: EditorStudioPublishModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const isCloseDisabled =
    loadingKey === "writePost" ||
    loadingKey === "modifyPost" ||
    loadingKey === "publishTempPost"
  const closeWhenIdle = () => {
    if (!isCloseDisabled) onClose()
  }

  const { handleKeyDown } = useModalFocusTrap({
    open: true,
    onClose: closeWhenIdle,
    containerRef: dialogRef,
  })

  return (
    <PublishModalBackdrop
      data-variant={variant}
      onClick={() => {
        if (!isCloseDisabled) onClose()
      }}
    >
      <PublishDialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={publishActionTitle}
        data-variant={variant}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <PublishModalHeader>
          <div>
            <h4>{publishActionTitle}</h4>
          </div>
        </PublishModalHeader>
        <PublishModalBody>
          {shouldShowNotice ? (
            <PublishModalNotice data-tone={modalNotice.tone}>{modalNotice.text}</PublishModalNotice>
          ) : null}
          <PublishOverviewGrid>
            <EditorStudioPublishVisibilitySection
              postVisibility={postVisibility}
              visibilityOptions={visibilityOptions}
              onPostVisibilityChange={onPostVisibilityChange}
            />
          </PublishOverviewGrid>

          <EditorStudioPublishCardSettings
            closeToggleLabel={closeToggleLabel}
            isCompactMobileLayout={isCompactMobileLayout}
            isMobileMetaEditorOpen={isMobileMetaEditorOpen}
            isMobileThumbnailEditorOpen={isMobileThumbnailEditorOpen}
            previewMetaEditorPanel={previewMetaEditorPanel}
            setupDescription={setupDescription}
            thumbnailEditorPanel={thumbnailEditorPanel}
            onToggleMobileMetaEditor={onToggleMobileMetaEditor}
            onToggleMobileThumbnailEditor={onToggleMobileThumbnailEditor}
          />
        </PublishModalBody>
        <PublishModalFooter>
          <PublishButton type="button" disabled={isCloseDisabled} onClick={onClose}>
            닫기
          </PublishButton>
          <PublishPrimaryButton type="button" disabled={publishActionButtonDisabled} onClick={onConfirmPublish}>
            {publishActionButtonText}
          </PublishPrimaryButton>
        </PublishModalFooter>
      </PublishDialog>
    </PublishModalBackdrop>
  )
}
