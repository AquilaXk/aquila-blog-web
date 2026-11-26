/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - ValentinH/react-easy-crop src/Cropper.tsx (MIT License, Copyright (c) Valentin Hervieu)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminFocusRing,
  adminStatusDangerBg,
  adminStatusDangerBorder,
  adminStatusDangerText,
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

export const PreviewEditorSection = styled.div`
  display: grid;
  gap: 0.62rem;
  min-width: 0;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  padding: 0.75rem 0 0;
`

export const PreviewEditorSectionHeader = styled.div`
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

export const PreviewThumbFrame = styled.div`
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

export const ThumbnailFieldLabel = styled.label`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${adminTextSecondary};
`

export const ThumbnailInput = styled.input`
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

  &[aria-invalid="true"] {
    border-color: ${adminStatusDangerBorder};
  }

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
    font-size: 16px;
  }
`

export const ThumbnailButton = styled.button`
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

export const ThumbnailPrimaryButton = styled(ThumbnailButton)`
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

export const ZoomControlRow = styled.div`
  display: grid;
  gap: 0.42rem;
  align-items: start;
  justify-items: start;
  width: min(100%, 360px);

  @media (max-width: 780px) {
    width: 100%;
  }
`

export const ZoomRangeInput = styled.input`
  width: 100%;
  accent-color: ${adminTeal};
  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }
  @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }
`

export const ZoomValue = styled.span`
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

export const ZoomControlMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
`

export const ThumbnailSourceStatus = styled.span`
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

  &[data-tone="invalid"] {
    border-color: ${adminStatusDangerBorder};
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

export const ThumbnailValidationError = styled.p`
  margin: 0;
  color: ${adminStatusDangerText};
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
`

export const MetaPrimaryActionRow = styled.div`
  display: grid;

  > button {
    width: 100%;
    justify-content: center;
    text-align: center;
    white-space: normal;
    line-height: 1.32;
  }
`

export const MetaSecondaryActionRow = styled.div`
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

export const ThumbnailFieldHelp = styled.span`
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
