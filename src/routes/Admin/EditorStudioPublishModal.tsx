/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/sheet.tsx (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import { useRef, type ReactNode } from "react"
import AppIcon from "./AdminAppIcon"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import type { PostVisibility } from "./editorStudioState"
import {
  adminBorder,
  adminSurfaceMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import {
  EditorStudioPublishCardSettings,
  EditorStudioPublishSerpPreview,
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
  hasManualThumbnail?: boolean
  isCompactMobileLayout: boolean
  isMobileMetaEditorOpen: boolean
  isMobileThumbnailEditorOpen: boolean
  loadingKey: string
  modalNotice: PublishNoticeState
  postVisibility: PostVisibility
  postTitle?: string
  postSummary?: string
  thumbnailUrl?: string
  postId?: string
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
  onReloadLatestServerPost?: (() => void) | null
  onPostVisibilityChange: (nextVisibility: PostVisibility) => void
  onToggleMobileMetaEditor: () => void
  onToggleMobileThumbnailEditor: () => void
}

export const EditorStudioPublishModal = ({
  closeToggleLabel,
  hasManualThumbnail = false,
  isCompactMobileLayout,
  isMobileMetaEditorOpen,
  isMobileThumbnailEditorOpen,
  loadingKey,
  modalNotice,
  postVisibility,
  postTitle = "",
  postSummary = "",
  thumbnailUrl = "",
  postId = "",
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
  onReloadLatestServerPost = null,
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
    lockScroll: true,
  })

  return (
    <ContainedBackdrop
      data-variant={variant}
      onClick={() => {
        if (!isCloseDisabled) onClose()
      }}
    >
      <ContainedDialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={publishActionTitle}
        data-testid="editor-publish-dialog"
        data-variant={variant}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <PublishModalHeader>
          <div>
            <h4>{publishActionTitle}</h4>
          </div>
          <PublishModalCloseButton
            type="button"
            aria-label="발행 설정 취소"
            disabled={isCloseDisabled}
            onClick={closeWhenIdle}
          >
            <AppIcon name="close" />
          </PublishModalCloseButton>
        </PublishModalHeader>
        <PublishModalBody>
          {shouldShowNotice ? (
            <PublishModalNotice data-tone={modalNotice.tone}>
              <span>{modalNotice.text}</span>
              {onReloadLatestServerPost ? (
                <PublishButton
                  type="button"
                  disabled={isCloseDisabled}
                  onClick={onReloadLatestServerPost}
                >
                  서버 최신본 다시 불러오기
                </PublishButton>
              ) : null}
            </PublishModalNotice>
          ) : null}
          <PublishOverviewGrid>
            <EditorStudioPublishVisibilitySection
              postVisibility={postVisibility}
              visibilityOptions={visibilityOptions}
              onPostVisibilityChange={onPostVisibilityChange}
            />
          </PublishOverviewGrid>

          <EditorStudioPublishSerpPreview
            title={postTitle}
            summary={postSummary}
            thumbnailUrl={thumbnailUrl}
            postId={postId || undefined}
          />

          <EditorStudioPublishCardSettings
            closeToggleLabel={closeToggleLabel}
            hasManualThumbnail={hasManualThumbnail}
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
          <PublishPrimaryButton
            type="button"
            data-testid="editor-publish-submit-button"
            disabled={publishActionButtonDisabled}
            onClick={onConfirmPublish}
          >
            {publishActionButtonText}
          </PublishPrimaryButton>
        </PublishModalFooter>
      </ContainedDialog>
    </ContainedBackdrop>
  )
}

const ContainedBackdrop = styled(PublishModalBackdrop)`
  overflow: hidden;
  overscroll-behavior: contain;
`

const ContainedDialog = styled(PublishDialog)`
  overflow: hidden;
  overscroll-behavior: contain;
`

const PublishModalCloseButton = styled.button`
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: ${adminTextSecondary};
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    border-color: ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 768px), (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
`
