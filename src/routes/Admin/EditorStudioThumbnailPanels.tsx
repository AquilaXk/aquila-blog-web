/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - ValentinH/react-easy-crop src/Cropper.tsx (MIT License, Copyright (c) Valentin Hervieu)
 */
import styled from "@emotion/styled"
import type {
  ClipboardEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
  RefObject,
} from "react"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminFocusRing,
  adminSurface,
  adminSurfaceMuted,
  adminTeal,
  adminTealBorder,
  adminTealBorderHover,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import { handleCropKeyDown, type KeyboardMoveOffset } from "./cropKeyboardWheelHelper"

type ThumbnailSourceTone = "manual" | "auto" | "empty"

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
        <strong>썸네일 위치 조정</strong>
        <span>드래그 또는 방향키(이동), +/-(배율)로 초점을 맞춥니다.</span>
      </PreviewEditorSectionHeader>
      <PreviewThumbFrame
        ref={previewThumbFrameRef}
        tabIndex={isCropReady ? 0 : -1}
        aria-label="썸네일 크롭 프레임 (방향키 이동, +, -, 0 배율 조정)"
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
            alt="포스트 미리보기 썸네일"
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
            <em>자동 OG 카드 사용</em>
          </div>
        )}
      </PreviewThumbFrame>
      {isCropReady ? (
        <ZoomControlRow>
          <ThumbnailFieldLabel htmlFor="post-thumbnail-zoom-modal">썸네일 배율</ThumbnailFieldLabel>
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
              배율 초기화
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
  const hasManualThumbnail = postThumbnailUrl.trim().length > 0
  const hasFirstBodyImage = firstBodyImageUrl.trim().length > 0
  const sourceTone: ThumbnailSourceTone = hasManualThumbnail ? "manual" : hasFirstBodyImage ? "auto" : "empty"
  const sourceLabel = hasManualThumbnail
    ? "수동 공유 이미지 URL 사용 중"
    : hasFirstBodyImage
      ? "본문 첫 이미지를 공유 카드에 자동 사용 중"
      : "제목 기반 OG 이미지를 자동 생성 중"

  return (
    <PreviewEditorSection onPaste={onThumbnailPaste}>
      <PreviewEditorSectionHeader>
        <strong>공유 대표 이미지 (선택)</strong>
        <ThumbnailSourceStatus data-tone={sourceTone}>{sourceLabel}</ThumbnailSourceStatus>
      </PreviewEditorSectionHeader>
      <ThumbnailFieldLabel htmlFor="post-thumbnail-url-modal">공유 이미지 URL</ThumbnailFieldLabel>
      <ThumbnailInput
        id="post-thumbnail-url-modal"
        placeholder="https://... (비우면 본문 첫 이미지·제목 OG 카드 자동 사용)"
        value={postThumbnailUrl}
        onChange={(event) => onThumbnailUrlChange(event.target.value)}
      />
      <MetaPrimaryActionRow>
        <ThumbnailPrimaryButton
          type="button"
          title={thumbnailUploadRuleLabel}
          disabled={isThumbnailUploadDisabled}
          onClick={onOpenThumbnailFileInput}
        >
          {isThumbnailUploading ? "업로드 중..." : "썸네일 파일 업로드"}
        </ThumbnailPrimaryButton>
      </MetaPrimaryActionRow>
      <MetaSecondaryActionRow>
        <ThumbnailButton type="button" disabled={!hasFirstBodyImage} onClick={onApplyFirstBodyImage}>
          본문 첫 이미지 사용
        </ThumbnailButton>
        <ThumbnailButton type="button" data-variant="text" onClick={onResetThumbnailToAutoMode}>
          자동 모드로 되돌리기
        </ThumbnailButton>
      </MetaSecondaryActionRow>
      {thumbnailImageFileName ? <ThumbnailFieldHelp>선택 파일: {thumbnailImageFileName}</ThumbnailFieldHelp> : null}
    </PreviewEditorSection>
  )
}

const PreviewEditorSection = styled.div`
  display: grid;
  gap: 0.62rem;
  min-width: 0;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  padding: 0.75rem 0 0;
`

const PreviewEditorSectionHeader = styled.div`
  display: grid;
  gap: 0.14rem;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.85rem;
    font-weight: 650;
    line-height: 1.3;
  }

  span {
    color: ${adminTextSecondary};
    font-size: 0.74rem;
    line-height: 1.45;
  }
`

const PreviewThumbFrame = styled.div`
  --preview-thumb-width: 100%;
  --preview-thumb-height: 100%;
  --preview-thumb-left: 0%;
  --preview-thumb-top: 0%;

  position: relative;
  width: min(100%, 360px);
  justify-self: start;
  aspect-ratio: 1.94 / 1;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  overflow: hidden;
  user-select: none;
  isolation: isolate;
  ${focusVisibleRing}

  &[data-draggable="true"] {
    cursor: grab;
    touch-action: none;
  }

  &[data-dragging="true"] {
    cursor: grabbing;
  }

  @media (max-width: 780px) {
    width: 100%;
  }

  img {
    position: absolute;
    display: block;
    pointer-events: none;
    user-select: none;
    touch-action: none;
    -webkit-user-drag: none;
    will-change: top, left, width, height;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.24rem;
    padding: 0.7rem;

    em {
      font-style: normal;
      color: ${adminTextMuted};
      font-weight: 650;
      font-size: 0.82rem;
    }

    span {
      color: ${adminTextSecondary};
      font-size: 0.74rem;
      line-height: 1.4;
    }
  }
`

const ThumbnailFieldLabel = styled.label`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${adminTextSecondary};
`

const ThumbnailInput = styled.input`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  padding: 0 0.75rem;
  min-height: 38px;
  min-width: 0;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.84rem;

  &:focus-visible {
    outline: none;
    border-color: ${adminBorderStrong};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
    font-size: 16px;
  }
`

const ThumbnailButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  padding: 0 0.85rem;
  min-height: 36px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
  }

  &[data-variant="text"] {
    min-height: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: ${adminTextSecondary};
    @media (max-width: 768px), (pointer: coarse) { min-height: 44px; min-width: 44px; }
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &[data-variant="text"]:hover:not(:disabled) {
    border-color: transparent;
    background: transparent;
    color: ${adminTextPrimary};
  }

  &:focus-visible {
    outline: none;
    border-color: ${adminBorderStrong};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

const ThumbnailPrimaryButton = styled(ThumbnailButton)`
  border-radius: 6px;
  padding: 0 0.92rem;
  min-height: 38px;
  border-color: ${adminTealBorder};
  background: ${adminTeal};
  color: ${adminControlText};
  font-weight: 500;

  &:hover:not(:disabled) {
    border-color: ${adminTealBorderHover};
    background: ${adminTealHover};
    color: ${adminControlText};
  }
`

const ZoomControlRow = styled.div`
  display: grid;
  gap: 0.42rem;
  align-items: start;
  justify-items: start;
  width: min(100%, 360px);

  @media (max-width: 780px) {
    width: 100%;
  }
`

const ZoomRangeInput = styled.input`
  width: 100%;
  accent-color: ${adminTeal};
  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }
  @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }
`

const ZoomValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border-radius: 5px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  padding: 0 0.52rem;
  color: ${adminTextSecondary};
  font-size: 0.76rem;
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const ZoomControlMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
`

const ThumbnailSourceStatus = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 22px;
  border-radius: 5px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  padding: 0 0.5rem;
  color: ${adminTextMuted};
  font-size: 0.71rem;
  font-weight: 600;
  line-height: 1;

  &[data-tone="manual"],
  &[data-tone="auto"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
  }
`

const MetaPrimaryActionRow = styled.div`
  display: grid;

  > button {
    width: 100%;
    justify-content: center;
    text-align: center;
    white-space: normal;
    line-height: 1.32;
  }
`

const MetaSecondaryActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;

  > button:first-of-type {
    flex: 1 1 11rem;
  }

  > button[data-variant="text"] {
    flex: 0 0 auto;
    text-align: left;
  }
`

const ThumbnailFieldHelp = styled.span`
  display: block;
  width: 100%;
  min-width: 0;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 0.74rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;

  @media (max-width: 720px) {
    display: none;
  }
`
