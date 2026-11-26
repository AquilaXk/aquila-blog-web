/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - ValentinH/react-easy-crop src/Cropper.tsx (MIT License, Copyright (c) Valentin Hervieu)
 */
import type {
  ClipboardEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  RefObject,
} from "react"
import { useLanguage } from "src/libs/language"
import { isCanonicalPostImageUploadUrl } from "src/libs/markdown/postImageUrlPolicy"
import { handleCropKeyDown, type KeyboardMoveOffset } from "./cropKeyboardWheelHelper"
import {
  MetaPrimaryActionRow,
  MetaSecondaryActionRow,
  PreviewEditorSection,
  PreviewEditorSectionHeader,
  PreviewThumbFrame,
  ThumbnailButton,
  ThumbnailFieldHelp,
  ThumbnailFieldLabel,
  ThumbnailInput,
  ThumbnailPrimaryButton,
  ThumbnailSourceStatus,
  ThumbnailValidationError,
  ZoomControlMeta,
  ZoomControlRow,
  ZoomRangeInput,
  ZoomValue,
} from "./EditorStudioThumbnailPanels.styles"

type ThumbnailSourceTone = "manual" | "auto" | "empty" | "invalid"

type EditorStudioThumbnailEditorPanelProps = {
  finalizePreviewThumbPointer: PointerEventHandler<HTMLDivElement>
  handlePreviewThumbPointerDown: PointerEventHandler<HTMLDivElement>
  handlePreviewThumbPointerMove: PointerEventHandler<HTMLDivElement>
  isPreviewThumbDragging: boolean
  isPreviewThumbnailError: boolean
  postThumbnailZoom: number
  previewThumbFrameRef: RefObject<HTMLDivElement | null>
  safePreviewThumbnail: string
  setIsPreviewThumbnailError: (nextValue: boolean) => void
  onThumbnailZoomChange: (nextZoom: number) => void
  onResetThumbnailZoom: () => void
  onThumbnailMoveOffset?: (offset: KeyboardMoveOffset) => void
}

type EditorStudioThumbnailMetaPanelProps = {
  firstBodyImageUrl: string
  isThumbnailUploadDisabled: boolean
  isThumbnailUploading: boolean
  postThumbnailUrl: string
  thumbnailImageFileName: string
  thumbnailUploadRuleLabel: string
  onApplyFirstBodyImage: () => void
  onOpenThumbnailFileInput: () => void
  onResetThumbnailToAutoMode: () => void
  onThumbnailPaste: ClipboardEventHandler<HTMLElement>
  onThumbnailUrlChange: (nextValue: string) => void
}

const KEYBOARD_SYNTHETIC_POINTER_ID = -99

export const EditorStudioThumbnailEditorPanel = ({
  finalizePreviewThumbPointer,
  handlePreviewThumbPointerDown,
  handlePreviewThumbPointerMove,
  isPreviewThumbDragging,
  isPreviewThumbnailError,
  postThumbnailZoom,
  previewThumbFrameRef,
  safePreviewThumbnail,
  setIsPreviewThumbnailError,
  onThumbnailZoomChange,
  onResetThumbnailZoom,
  onThumbnailMoveOffset,
}: EditorStudioThumbnailEditorPanelProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const isCropReady = Boolean(safePreviewThumbnail) && !isPreviewThumbnailError

  const applyKeyboardPan = (offset: KeyboardMoveOffset) => {
    if (onThumbnailMoveOffset) {
      onThumbnailMoveOffset(offset)
      return
    }
    const frame = previewThumbFrameRef.current
    if (!frame) return
    const downEvent = {
      button: 0,
      pointerId: KEYBOARD_SYNTHETIC_POINTER_ID,
      clientX: 0,
      clientY: 0,
      currentTarget: frame,
      preventDefault: () => {},
    } as unknown as ReactPointerEvent<HTMLDivElement>
    const moveEvent = {
      button: 0,
      pointerId: KEYBOARD_SYNTHETIC_POINTER_ID,
      clientX: -offset.deltaX,
      clientY: -offset.deltaY,
      currentTarget: frame,
      preventDefault: () => {},
    } as unknown as ReactPointerEvent<HTMLDivElement>
    handlePreviewThumbPointerDown(downEvent)
    handlePreviewThumbPointerMove(moveEvent)
    finalizePreviewThumbPointer(moveEvent)
  }

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!isCropReady) return
    handleCropKeyDown(
      event,
      postThumbnailZoom,
      (nextZoom) => onThumbnailZoomChange(Math.min(2.5, Math.max(1, nextZoom))),
      applyKeyboardPan
    )
  }

  return (
    <PreviewEditorSection>
      <PreviewEditorSectionHeader>
        <strong>{isEn ? "Adjust thumbnail focus" : "썸네일 위치 조정"}</strong>
        <span>
          {isEn
            ? "Drag or press arrow keys to pan, +/- to zoom."
            : "드래그 또는 방향키(이동), +/-(배율)로 초점을 맞춥니다."}
        </span>
      </PreviewEditorSectionHeader>
      <PreviewThumbFrame
        ref={previewThumbFrameRef}
        tabIndex={isCropReady ? 0 : -1}
        aria-label={
          isEn
            ? "Thumbnail crop frame (arrow keys to pan, +, -, 0 to zoom)"
            : "썸네일 크롭 프레임 (방향키 이동, +, -, 0 배율 조정)"
        }
        data-draggable={isCropReady}
        data-dragging={isPreviewThumbDragging}
        onKeyDown={handleStageKeyDown}
        onPointerDown={handlePreviewThumbPointerDown}
        onPointerMove={handlePreviewThumbPointerMove}
        onPointerUp={finalizePreviewThumbPointer}
        onPointerCancel={finalizePreviewThumbPointer}
      >
        {isCropReady ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safePreviewThumbnail}
            alt={isEn ? "Post preview thumbnail" : "포스트 미리보기 썸네일"}
            style={{
              width: "var(--preview-thumb-width)",
              height: "var(--preview-thumb-height)",
              left: "var(--preview-thumb-left)",
              top: "var(--preview-thumb-top)",
              maxWidth: "none",
              transform: "translateZ(0)",
            }}
            onError={() => setIsPreviewThumbnailError(true)}
          />
        ) : (
          <div className="placeholder">
            <em>{isEn ? "Using auto OG card" : "자동 OG 카드 사용"}</em>
          </div>
        )}
      </PreviewThumbFrame>
      {isCropReady ? (
        <ZoomControlRow>
          <ThumbnailFieldLabel htmlFor="post-thumbnail-zoom-modal">
            {isEn ? "Thumbnail zoom" : "썸네일 배율"}
          </ThumbnailFieldLabel>
          <ZoomRangeInput
            id="post-thumbnail-zoom-modal"
            type="range"
            min={1}
            max={2.5}
            step={0.01}
            value={postThumbnailZoom}
            onChange={(event) => onThumbnailZoomChange(Number(event.target.value))}
          />
          <ZoomControlMeta>
            <ZoomValue>{postThumbnailZoom.toFixed(2)}x</ZoomValue>
            <ThumbnailButton type="button" onClick={onResetThumbnailZoom}>
              {isEn ? "Reset zoom" : "배율 초기화"}
            </ThumbnailButton>
          </ZoomControlMeta>
        </ZoomControlRow>
      ) : null}
    </PreviewEditorSection>
  )
}

export const EditorStudioThumbnailMetaPanel = ({
  firstBodyImageUrl,
  isThumbnailUploadDisabled,
  isThumbnailUploading,
  postThumbnailUrl,
  thumbnailImageFileName,
  thumbnailUploadRuleLabel,
  onApplyFirstBodyImage,
  onOpenThumbnailFileInput,
  onResetThumbnailToAutoMode,
  onThumbnailPaste,
  onThumbnailUrlChange,
}: EditorStudioThumbnailMetaPanelProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const trimmedThumbnailUrl = postThumbnailUrl.trim()
  const hasManualThumbnail = trimmedThumbnailUrl.length > 0
  const isManualThumbnailValid =
    !hasManualThumbnail || isCanonicalPostImageUploadUrl(trimmedThumbnailUrl)
  const hasFirstBodyImage = firstBodyImageUrl.trim().length > 0
  const sourceTone: ThumbnailSourceTone = !isManualThumbnailValid
    ? "invalid"
    : hasManualThumbnail
      ? "manual"
      : hasFirstBodyImage
        ? "auto"
        : "empty"
  const sourceLabel = !isManualThumbnailValid
    ? isEn
      ? "Unsupported cover URL"
      : "허용되지 않은 이미지 URL"
    : hasManualThumbnail
      ? isEn
        ? "Using custom uploaded cover URL"
        : "업로드된 대표 이미지 URL 사용 중"
      : hasFirstBodyImage
        ? isEn
          ? "Using first body image automatically"
          : "본문 첫 이미지를 공유 카드에 자동 사용 중"
        : isEn
          ? "Generating title-based OG image"
          : "제목 기반 OG 이미지를 자동 생성 중"

  return (
    <PreviewEditorSection onPaste={onThumbnailPaste}>
      <PreviewEditorSectionHeader>
        <strong>{isEn ? "Share Cover Image (Optional)" : "공유 대표 이미지 (선택)"}</strong>
        <ThumbnailSourceStatus data-tone={sourceTone}>{sourceLabel}</ThumbnailSourceStatus>
      </PreviewEditorSectionHeader>
      <ThumbnailFieldLabel htmlFor="post-thumbnail-url-modal">
        {isEn ? "Uploaded Cover Image URL" : "블로그 업로드 이미지 URL"}
      </ThumbnailFieldLabel>
      <ThumbnailInput
        id="post-thumbnail-url-modal"
        aria-invalid={!isManualThumbnailValid}
        placeholder={
          isEn
            ? "Canonical /post/api/v1/images/... URL (or leave empty for auto)"
            : "업로드된 /post/api/v1/images/... URL (비우면 자동 사용)"
        }
        value={postThumbnailUrl}
        onChange={(event) => onThumbnailUrlChange(event.target.value)}
      />
      {!isManualThumbnailValid ? (
        <ThumbnailValidationError role="alert">
          {isEn
            ? "Only images uploaded to this blog (/post/api/v1/images/...) can be saved as cover images."
            : "외부 URL은 차단됩니다. 파일 업로드나 본문 첫 이미지 적용으로 블로그 이미지 URL(/post/api/v1/images/...)을 지정해주세요."}
        </ThumbnailValidationError>
      ) : null}
      <MetaPrimaryActionRow>
        <ThumbnailPrimaryButton
          type="button"
          title={thumbnailUploadRuleLabel}
          disabled={isThumbnailUploadDisabled}
          onClick={onOpenThumbnailFileInput}
        >
          {isThumbnailUploading
            ? isEn
              ? "Uploading..."
              : "업로드 중..."
            : isEn
              ? "Upload cover image"
              : "썸네일 파일 업로드"}
        </ThumbnailPrimaryButton>
      </MetaPrimaryActionRow>
      <MetaSecondaryActionRow>
        <ThumbnailButton type="button" disabled={!hasFirstBodyImage} onClick={onApplyFirstBodyImage}>
          {isEn ? "Use first body image" : "본문 첫 이미지 사용"}
        </ThumbnailButton>
        <ThumbnailButton type="button" data-variant="text" onClick={onResetThumbnailToAutoMode}>
          {isEn ? "Reset to auto" : "자동 모드로 되돌리기"}
        </ThumbnailButton>
      </MetaSecondaryActionRow>
      {thumbnailImageFileName ? (
        <ThumbnailFieldHelp>
          {isEn ? `Selected file: ${thumbnailImageFileName}` : `선택 파일: ${thumbnailImageFileName}`}
        </ThumbnailFieldHelp>
      ) : null}
    </PreviewEditorSection>
  )
}
