/**
 * 참조 구현:
 * - ValentinH/react-easy-crop src/{Cropper.tsx,styles.css} (MIT License, Copyright (c) Valentin Hervieu)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/dialog.tsx (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEventHandler,
  type Ref,
} from "react"
import { ConfirmDialog } from "src/design-system/ConfirmDialog"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { PROFILE_IMAGE_EDIT_MAX_ZOOM, PROFILE_IMAGE_EDIT_MIN_ZOOM } from "src/libs/profileImageUpload"
import type { ProfileImageHistoryItem } from "src/routes/Admin/AdminProfilePersistenceModel"
import { adminBorderStrong, adminTerminalBg } from "src/routes/Admin/adminColorTokens"
import {
  GhostButton,
  ModalActions,
  ModalCard,
  ModalCloseButton,
  ModalConstraintList,
  ModalEditorFrame,
  ModalEmptyState,
  ModalFooter,
  ModalHeader,
  ModalHistoryAction,
  ModalHistoryGrid,
  ModalHistoryItem,
  ModalHistorySection,
  ModalNotice,
  ModalOverlay,
  ModalSliderWrap,
  PrimaryButton,
} from "src/routes/Admin/AdminProfileWorkspace.styles"
import AppIcon from "./AdminProfileIcon"
import { computeNextWheelZoom, handleCropKeyDown, type KeyboardMoveOffset } from "./cropKeyboardWheelHelper"

const ModalCropStage = styled.div`
  position: relative;
  width: 100%;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid ${adminBorderStrong};
  background: ${adminTerminalBg};
  overflow: hidden;
`

type ModalNoticeTone = "idle" | "loading" | "success" | "error"

export type AdminProfileImageEditorModalProps = {
  frameRef: Ref<HTMLDivElement>
  hasDraftFile: boolean
  isDragging: boolean
  isUploading: boolean
  notice: {
    tone: ModalNoticeTone
    text: string
  }
  onApply: () => void
  onClear: () => void
  onDeletePreviousProfileImage: (image: ProfileImageHistoryItem) => void
  onPointerCancel: PointerEventHandler<HTMLDivElement>
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
  onRequestClose: () => void
  onSelectPreviousProfileImage: (image: ProfileImageHistoryItem) => void
  onSelectFile: () => void
  onZoomChange: (zoom: number) => void
  onMoveOffset?: (offset: KeyboardMoveOffset) => void
  previousProfileImages: ProfileImageHistoryItem[]
  previewUrl: string
  zoom: number
}

export default function AdminProfileImageEditorModal({
  frameRef,
  hasDraftFile,
  isDragging,
  isUploading,
  notice,
  onApply,
  onClear,
  onDeletePreviousProfileImage,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRequestClose,
  onSelectPreviousProfileImage,
  onSelectFile,
  onZoomChange,
  onMoveOffset,
  previousProfileImages,
  previewUrl,
  zoom,
}: AdminProfileImageEditorModalProps) {
  const modalCardRef = useRef<HTMLElement | null>(null)
  const [cropStageNode, setCropStageNode] = useState<HTMLDivElement | null>(null)
  const [pendingDeleteImage, setPendingDeleteImage] = useState<ProfileImageHistoryItem | null>(null)
  const wheelStateRef = useRef({ hasDraftFile, isUploading, zoom, onZoomChange })
  wheelStateRef.current = { hasDraftFile, isUploading, zoom, onZoomChange }

  const assignFrameRef = useCallback(
    (node: HTMLDivElement | null) => {
      setCropStageNode(node)
      if (typeof frameRef === "function") {
        frameRef(node)
      } else if (frameRef && typeof frameRef === "object") {
        ;(frameRef as { current: HTMLDivElement | null }).current = node
      }
    },
    [frameRef]
  )

  useEffect(() => {
    if (!cropStageNode) return
    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      const { hasDraftFile: canEdit, isUploading: busy, zoom: currentZoom, onZoomChange: applyZoom } =
        wheelStateRef.current
      if (!canEdit || busy) return
      event.preventDefault()
      event.stopPropagation()
      const nextZoom = computeNextWheelZoom(currentZoom, event.deltaY)
      if (nextZoom !== currentZoom) {
        applyZoom(nextZoom)
      }
    }
    cropStageNode.addEventListener("wheel", handleNativeWheel, { passive: false })
    return () => cropStageNode.removeEventListener("wheel", handleNativeWheel)
  }, [cropStageNode])

  const closeWhenIdle = () => {
    if (isUploading || pendingDeleteImage !== null) return
    onRequestClose()
  }

  const { handleKeyDown: handleTrapKeyDown } = useModalFocusTrap({
    open: pendingDeleteImage === null,
    onClose: closeWhenIdle,
    containerRef: modalCardRef,
    lockScroll: true,
  })

  const handleFrameKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!hasDraftFile || isUploading) return
    handleCropKeyDown(event, zoom, onZoomChange, onMoveOffset)
  }

  return (
    <ModalOverlay
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeWhenIdle()
        }
      }}
    >
      <ModalCard
        ref={modalCardRef}
        role="dialog"
        aria-modal="true"
        aria-label="프로필 이미지 편집"
        onKeyDown={handleTrapKeyDown}
      >
        <ModalHeader>
          <div>
            <h2>프로필 이미지 편집</h2>
          </div>
          <ModalCloseButton
            type="button"
            aria-label="프로필 이미지 편집 닫기"
            disabled={isUploading}
            onClick={closeWhenIdle}
          >
            <AppIcon name="close" />
          </ModalCloseButton>
        </ModalHeader>

        <ModalConstraintList>
          <li>지원 형식: JPG/PNG/GIF/WebP</li>
          <li>업로드 기준: 자동 최적화 후 최대 2MB</li>
        </ModalConstraintList>

        <ModalActions>
          <GhostButton type="button" onClick={onSelectFile} disabled={isUploading}>
            파일 선택
          </GhostButton>
          <GhostButton type="button" onClick={onClear} disabled={isUploading}>
            편집값 초기화
          </GhostButton>
        </ModalActions>

        {previousProfileImages.length > 0 ? (
          <ModalHistorySection aria-label="이전 프로필 이미지">
            <ModalHistoryGrid>
              {previousProfileImages.map((image) => (
                <ModalHistoryItem key={image.id} data-current={image.isCurrent ? "true" : "false"}>
                  <button
                    type="button"
                    disabled={isUploading || image.isCurrent}
                    onClick={() => onSelectPreviousProfileImage(image)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt="이전 프로필 이미지" loading="lazy" decoding="async" />
                    <span>{image.isCurrent ? "현재" : "적용"}</span>
                  </button>
                  <ModalHistoryAction
                    type="button"
                    aria-label="프로필 이미지 삭제"
                    disabled={isUploading || image.isCurrent}
                    onClick={() => setPendingDeleteImage(image)}
                  >
                    <AppIcon name="trash" />
                  </ModalHistoryAction>
                </ModalHistoryItem>
              ))}
            </ModalHistoryGrid>
          </ModalHistorySection>
        ) : null}

        {previewUrl ? (
          <>
            <ModalCropStage>
              <ModalEditorFrame
                ref={assignFrameRef}
                tabIndex={0}
                aria-label="이미지 크롭 프레임 (마우스 휠 줌, 방향키 이동, +, -, 0 지원)"
                data-draggable={hasDraftFile ? "true" : "false"}
                data-dragging={isDragging ? "true" : "false"}
                onKeyDown={handleFrameKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="프로필 편집 미리보기"
                  loading="eager"
                  decoding="async"
                  style={{
                    objectFit: "cover",
                    width: "var(--profile-draft-width)",
                    height: "var(--profile-draft-height)",
                    left: "var(--profile-draft-left)",
                    top: "var(--profile-draft-top)",
                    maxWidth: "none",
                    transform: "translateZ(0)",
                  }}
                  draggable={false}
                />
                <div className="cropCutout" aria-hidden="true">
                  <div className="cropGrid" />
                </div>
              </ModalEditorFrame>
            </ModalCropStage>

            <ModalSliderWrap>
              <label htmlFor="profile-image-zoom">확대/축소</label>
              <input
                id="profile-image-zoom"
                type="range"
                min={PROFILE_IMAGE_EDIT_MIN_ZOOM}
                max={PROFILE_IMAGE_EDIT_MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => onZoomChange(Number(event.target.value))}
              />
              <span>{zoom.toFixed(2)}x</span>
            </ModalSliderWrap>
          </>
        ) : (
          <ModalEmptyState>먼저 프로필 이미지를 선택해주세요.</ModalEmptyState>
        )}

        {notice.text ? <ModalNotice data-tone={notice.tone}>{notice.text}</ModalNotice> : null}

        <ModalFooter>
          <GhostButton type="button" disabled={isUploading} onClick={closeWhenIdle}>
            취소
          </GhostButton>
          <PrimaryButton type="button" disabled={isUploading || !hasDraftFile} onClick={onApply}>
            {isUploading ? "저장 중..." : "편집 결과 저장"}
          </PrimaryButton>
        </ModalFooter>
      </ModalCard>

      <ConfirmDialog
        open={pendingDeleteImage !== null}
        titleId="profile-history-delete-title"
        descriptionId="profile-history-delete-desc"
        title="이전 프로필 이미지 삭제"
        description="선택한 이전 프로필 이미지를 삭제할까요? 삭제한 이미지는 복구할 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        confirmTone="danger"
        onCancel={() => setPendingDeleteImage(null)}
        onConfirm={() => {
          const target = pendingDeleteImage
          setPendingDeleteImage(null)
          if (target) {
            onDeletePreviousProfileImage(target)
          }
        }}
      />
    </ModalOverlay>
  )
}
