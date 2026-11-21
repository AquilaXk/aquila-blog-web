// 참조 구현: TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import {
  adminBorder,
  adminBorderStrong,
  adminCardShadow,
  adminFloatingShadow,
  adminGold,
  adminGoldTintLine,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
  adminWarningBadgeSurface,
} from "src/routes/Admin/adminColorTokens"

export const SegmentedControl = styled.div`
  display: inline-flex;
  gap: 0.18rem;
  padding: 0.18rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceMuted};
`

export const SegmentButton = styled.button`
  min-height: 28px;
  padding: 0 0.62rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.76rem;
  font-weight: 660;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: 38px;
  }

  &[data-active="true"] {
    background: ${adminSurface};
    border-color: transparent;
    color: ${adminTextPrimary};
    box-shadow: ${adminCardShadow};
  }
`

export const LinkManagerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
  padding: 0.35rem 0 0.65rem;

  > div {
    display: grid;
    gap: 0.16rem;
  }

  strong {
    font-size: 0.88rem;
    color: ${adminTextPrimary};
  }

  span {
    color: ${adminTextSecondary};
    font-size: 0.78rem;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

export const LinkCardList = styled.div`
  display: grid;
  gap: 0;
  border-top: 1px solid ${adminBorder};
`

export const LinkRowCard = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(176px, 196px) minmax(0, 1fr);
  gap: 0.72rem 0.9rem;
  padding: 1rem 0;
  border: 0;
  border-bottom: 1px solid ${adminBorder};
  border-radius: 0;
  background: transparent;
  transition: background 0.16s ease, transform 0.16s ease;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0.25rem;
  }

  &[data-dragging="true"] {
    opacity: 0.78;
    transform: scale(0.995);
    border-radius: 8px;
    padding-inline: 0.65rem;
    background: ${adminSurfaceRaised};
  }

  &[data-drop-target="true"] {
    border-radius: 8px;
    padding-inline: 0.65rem;
    background: ${adminWarningBadgeSurface()};
  }

  &[data-drop-target="true"]::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 2px;
    background: ${adminGold};
    box-shadow: 0 0 0 1px ${adminGoldTintLine};
  }

  &[data-drop-target="true"][data-drop-position="before"]::before {
    top: -2px;
  }

  &[data-drop-target="true"][data-drop-position="after"]::before {
    bottom: -2px;
  }

  .linkActions {
    grid-column: 1 / -1;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.15rem;
    border-top: 0;
    gap: 0.45rem;
    min-width: 0;
  }

  .linkActionButtons {
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-left: auto;
  }

  .linkActionButtons > * {
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;

    .linkActionButtons {
      margin-left: 0;
      justify-content: flex-start;
    }
  }
`

export const DragHandleButton = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.34rem;
  min-height: 28px;
  padding: 0 0.62rem;
  border-radius: 6px;
  border: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-size: 0.75rem;
  font-weight: 650;
  cursor: grab;
  user-select: none;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
  }

  @media (max-width: 900px), (pointer: coarse) {
    display: none;
  }
`

export const IconPickerField = styled.div`
  position: relative;
  display: grid;
  gap: 0.38rem;
  align-content: start;
`

export const IconPickerButton = styled.button`
  min-height: 40px;
  padding: 0.48rem 0.72rem;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
  color: ${adminTextPrimary};
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    border-color: ${adminBorderStrong};
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
    min-width: 44px;
  }
`

export const IconPreview = styled.span<{ "data-compact"?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ ["data-compact"]: compact }) => (compact ? "1.85rem" : "2.1rem")};
  height: ${({ ["data-compact"]: compact }) => (compact ? "1.85rem" : "2.1rem")};
  border-radius: 50%;
  border: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};
  font-size: 0.95rem;
`

export const IconPickerCopy = styled.span`
  display: grid;
  gap: 0.06rem;
  text-align: left;
  min-width: 0;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.82rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.7rem;
  }
`

export const IconPickerPanel = styled.div`
  position: absolute;
  top: calc(100% + 0.36rem);
  left: 0;
  z-index: 10;
  width: min(100%, 280px);
  max-height: 280px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid ${adminBorderStrong};
  background: ${adminSurface};
  box-shadow: ${adminFloatingShadow};
  padding: 0.4rem;
  display: grid;
  gap: 0.25rem;
`

export const IconOptionButton = styled.button`
  width: 100%;
  min-height: ${control.lg}px;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.55rem;
  align-items: center;
  box-sizing: border-box;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurfaceRaised};
  }

  &[data-selected="true"] {
    border-color: ${adminTeal};
    background: ${adminSurfaceMuted};
  }
`

export const IconOptionText = styled.span`
  display: grid;
  gap: 0.08rem;
  text-align: left;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.82rem;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.7rem;
  }
`

export const LinkInputs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.68rem;
  min-width: 0;

  > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
    padding: 0;
    border-bottom: 0;
  }

  label {
    padding-top: 0;
    font-size: 0.78rem;
    color: ${adminTextSecondary};
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`
