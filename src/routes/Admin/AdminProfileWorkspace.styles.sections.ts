/**
 * 참조 구현:
 * - ValentinH/react-easy-crop src/{Cropper.tsx,styles.css} (MIT License, Copyright (c) Valentin Hervieu)
 * - TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control, overlayScrim } from "src/design-system/tokens"
import {
  AdminInfoPanelCard,
  AdminRailCard,
  AdminStickyRail,
} from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminFloatingShadow,
  adminFramePillBorder,
  adminFramePillHover,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTeal,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import { BaseButton, PublishButton } from "./AdminProfileWorkspace.styles.tokens"

export const PreviewRail = styled(AdminStickyRail)`
  position: static;
  top: auto;
  min-width: 0;
`

export const PreviewCardShell = styled(AdminRailCard)`
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 0 0;
  border: 0;
  border-top: 1px solid ${adminBorder};
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  min-width: 0;
`

export const PreviewHeader = styled.div`
  display: grid;
  gap: 0.45rem;
  min-width: 0;

  > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.82rem;
    font-weight: 740;
    letter-spacing: -0.01em;
  }

  @media (max-width: 1060px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`

export const PreviewHeaderActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  min-width: 0;
`

export const PreviewToggleButton = styled.button`
  display: none;
  ${focusVisibleRing}

  @media (max-width: 1060px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 0.72rem;
    border-radius: 6px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextSecondary};
    font-size: 0.78rem;
    font-weight: 650;
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const PreviewBody = styled.div<{ "data-expanded"?: boolean }>`
  display: grid;
  min-width: 0;

  @media (max-width: 1060px) {
    display: ${({ ["data-expanded"]: expanded }) => (expanded ? "grid" : "none")};
  }
`

export const DockSecondaryButton = styled(BaseButton)`
  min-height: 36px;
  padding: 0 0.9rem;
  border-radius: 8px;
  background: ${adminSurface};
  color: ${adminTextPrimary};

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const DockPrimaryButton = styled(PublishButton)`
  min-height: 36px;
  padding: 0 0.95rem;
  border-radius: 8px;

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const PreviewViewport = styled(AdminInfoPanelCard)`
  min-height: 0;
  padding: 0.85rem 0.9rem;
  border-radius: 10px;
  border: 0;
  background: ${adminSurfaceRaised};
  min-width: 0;
`

export const PreviewProfileCard = styled.div`
  display: grid;
  gap: 0.55rem;
  min-width: 0;

  .identityRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.6rem;
    align-items: center;
  }

  .identityCopy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    overflow: hidden;
    border: 0;
    background: ${adminSurfaceMuted};

    & > span {
      width: 100% !important;
      height: 100% !important;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.86rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  span {
    color: ${adminTextSecondary};
    font-weight: 600;
    font-size: 0.74rem;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    line-height: 1.45;
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }
`

export const PreviewAboutCard = styled.div`
  display: grid;
  gap: 0.5rem;
  min-width: 0;

  header {
    display: grid;
    gap: 0.1rem;
  }

  header span {
    color: ${adminTextSecondary};
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  header strong,
  h4 {
    color: ${adminTextPrimary};
    font-size: 0.82rem;
    margin: 0;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.76rem;
    line-height: 1.48;
    overflow-wrap: anywhere;
  }

  .sections {
    display: grid;
    gap: 0.5rem;
  }

  section {
    display: grid;
    gap: 0.22rem;
    font-size: 0.76rem;
  }

  ul {
    margin: 0;
    padding-left: 1rem;
    color: ${adminTextSecondary};
    display: grid;
    gap: 0.14rem;
  }
`

export const PreviewHomeCard = styled.div`
  display: grid;
  gap: 0.35rem;
  min-width: 0;

  span {
    color: ${adminTextSecondary};
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  strong,
  h4 {
    margin: 0;
    font-size: 0.82rem;
    color: ${adminTextPrimary};
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.76rem;
    line-height: 1.48;
    overflow-wrap: anywhere;
  }
`

export const PreviewLinksCard = styled.div`
  display: grid;
  gap: 0.6rem;
  min-width: 0;

  section {
    display: grid;
    gap: 0.3rem;
  }

  strong {
    font-size: 0.78rem;
    color: ${adminTextPrimary};
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.3rem;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    font-size: 0.76rem;
    color: ${adminTextSecondary};
    min-width: 0;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.75rem;
    line-height: 1.45;
  }
`

export const ModalOverlay = styled.div`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: grid;
  place-items: center;
  overflow: hidden;
  overscroll-behavior: contain;
  background: ${overlayScrim.adminStrong};
  padding: 1rem;
`

export const ModalCard = styled.section`
  width: min(560px, 100%);
  max-height: min(92vh, 860px);
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 12px;
  border: 1px solid ${adminBorderStrong};
  background: ${adminSurface};
  box-shadow: ${adminFloatingShadow};
  padding: 1.2rem;
  display: grid;
  gap: 0.85rem;
`

export const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.82rem;
  align-items: flex-start;

  h2 {
    margin: 0;
    font-size: 1.08rem;
    color: ${adminTextPrimary};
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 0.84rem;
    color: ${adminTextSecondary};
    line-height: 1.55;
  }
`

export const ModalCloseButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: 1100px), (pointer: coarse) {
    width: ${control.lg}px;
    height: ${control.lg}px;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
  }
`

export const ModalConstraintList = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.28rem;
  color: ${adminTextSecondary};
  font-size: 0.82rem;
  line-height: 1.5;
`

export const ModalActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.48rem;
`

export const ModalHistorySection = styled.section`
  overflow-x: auto;
  padding-bottom: 0.12rem;
`

export const ModalHistoryGrid = styled.div`
  display: flex;
  gap: 0.62rem;
  min-width: max-content;
`

export const ModalHistoryItem = styled.div`
  display: grid;
  gap: 0.4rem;
  width: 76px;

  > button:first-child {
    width: 76px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: ${adminTextSecondary};
    display: grid;
    gap: 0.32rem;
    justify-items: center;
    padding: 0;
    cursor: pointer;
    ${focusVisibleRing}

    &:disabled {
      cursor: default;
    }
  }

  img {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid ${adminBorder};
    background: ${adminSurface};
  }

  span {
    font-size: 0.76rem;
    font-weight: 700;
  }

  &[data-current="true"] img {
    border-color: ${adminTeal};
  }
`

export const ModalHistoryAction = styled.button`
  width: 36px;
  height: 36px;
  justify-self: center;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: 1100px), (pointer: coarse) {
    width: ${control.lg}px;
    height: ${control.lg}px;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
  }

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
`

export const ModalEditorFrame = styled.div`
  --profile-draft-width: 100%;
  --profile-draft-height: 100%;
  --profile-draft-left: 0%;
  --profile-draft-top: 0%;

  position: relative;
  width: 100%;
  max-width: 280px;
  justify-self: center;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: 0;
  background: transparent;
  overflow: visible;
  user-select: none;
  ${focusVisibleRing}

  &[data-draggable="true"] { cursor: grab; touch-action: none; }
  &[data-dragging="true"] { cursor: grabbing; }

  img {
    position: absolute;
    display: block;
    pointer-events: none;
    user-select: none;
    touch-action: none;
    will-change: top, left, width, height;
  }

  .cropCutout {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    pointer-events: none;
    box-shadow: 0 0 0 9999px ${overlayScrim.adminStrong};
    border: 1.5px solid ${adminFramePillHover};
    overflow: hidden;
  }

  .cropGrid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(to right, transparent calc(33.333% - 0.5px), ${adminFramePillBorder} calc(33.333% - 0.5px), ${adminFramePillBorder} calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), ${adminFramePillBorder} calc(66.666% - 0.5px), ${adminFramePillBorder} calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)),
      linear-gradient(to bottom, transparent calc(33.333% - 0.5px), ${adminFramePillBorder} calc(33.333% - 0.5px), ${adminFramePillBorder} calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), ${adminFramePillBorder} calc(66.666% - 0.5px), ${adminFramePillBorder} calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px));
  }
`

export const ModalSliderWrap = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.72rem;
  padding: 0.58rem 0.82rem;
  border-radius: 8px;
  border: 1px solid ${adminBorderSubtle};
  background: ${adminSurfaceRaised};

  label { color: ${adminTextSecondary}; font-size: 0.8rem; font-weight: 600; }
  input {
    width: 100%;
    accent-color: ${adminTeal};
    cursor: pointer;
    @media (pointer: coarse) { min-height: 44px; }
  }
  span {
    color: ${adminTextPrimary};
    font: 600 0.78rem/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    min-width: 3.2rem;
    text-align: right;
  }
`

export const ModalEmptyState = styled.div`
  padding: 1rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  text-align: center;
`

export const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.48rem;
`
