// 참조 구현: TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import { AdminWorkspaceHero } from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminCardShadow,
  adminControlText,
  adminFloatingShadow,
  adminStatusDangerBorder,
  adminStatusDangerText,
  adminStatusSuccessBg,
  adminStatusSuccessBorder,
  adminStatusSuccessDot,
  adminStatusSuccessText,
  adminStatusWarnDot,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTealBorder,
  adminTealBorderHover,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
  adminWarningBadgeBorder,
  adminWarningBadgeSurface,
  adminWarningBadgeText,
} from "src/routes/Admin/adminColorTokens"

export const Main = styled.div`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 1.15rem 1.75rem 3rem;
  display: grid;
  gap: 1.25rem;

  @media (max-width: 768px) {
    padding: 0.85rem 0.95rem calc(2rem + env(safe-area-inset-bottom, 0px));
    gap: 0.95rem;
  }
`

export const BaseButton = styled.button`
  min-height: 36px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0 0.88rem;
  font-size: 0.82rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: ${adminCardShadow};
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
  ${focusVisibleRing}

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.56;
    box-shadow: none;
  }
`

export const GhostButton = styled(BaseButton)`
  min-height: 32px;
  padding: 0 0.72rem;
  border: 1px solid ${adminBorder};
  border-radius: 8px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.8rem;

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
    min-width: 44px;
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }
`

export const PrimaryButton = styled(BaseButton)`
  border-color: ${adminTealBorder};
  background: ${adminTeal};
  color: ${adminControlText};

  &:hover:not(:disabled) {
    border-color: ${adminTealBorderHover};
    background: ${adminTealHover};
    color: ${adminControlText};
  }
`

export const PublishButton = PrimaryButton

export const MiniButton = styled(BaseButton)`
  min-height: 28px;
  padding: 0 0.56rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.76rem;
  box-shadow: none;

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
    min-width: 44px;
  }

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }
`

export const DangerButton = styled(MiniButton)`
  color: ${adminStatusDangerText};

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminStatusDangerText};
  }
`

export const PreviewAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 0.56rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.76rem;
  font-weight: 650;
  text-decoration: none;
  ${focusVisibleRing}

  &:hover {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
    min-width: 44px;
  }
`

export const WorkspaceHero = styled(AdminWorkspaceHero)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.85rem 1.25rem;
  padding: 0 0 1rem;
  border-bottom: 1px solid ${adminBorder};

  h1 {
    margin: 0;
    font-size: 1.45rem;
    line-height: 1.2;
    font-weight: 780;
    letter-spacing: -0.025em;
    color: ${adminTextPrimary};
  }

  @media (max-width: 768px) {
    padding-bottom: 0.85rem;

    h1 {
      font-size: 1.25rem;
    }
  }
`

export const SettingsHeaderTitleGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  min-width: 0;
`

export const SettingsHeaderActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
`

export const SyncStateBadge = styled.span<{ "data-tone"?: "synced" | "dirty" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 26px;
  padding: 0 0.62rem;
  border-radius: 999px;
  border: 1px solid transparent;
  background: ${({ "data-tone": tone }) =>
    tone === "dirty" ? adminWarningBadgeSurface() : adminStatusSuccessBg};
  color: ${({ "data-tone": tone }) =>
    tone === "dirty" ? adminWarningBadgeText() : adminStatusSuccessText};
  font-size: 0.74rem;
  font-weight: 680;
  white-space: nowrap;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ "data-tone": tone }) =>
      tone === "dirty" ? adminStatusWarnDot : adminStatusSuccessDot};
    flex-shrink: 0;
  }
`

export const SettingsSideRail = styled.aside`
  position: sticky;
  top: calc(var(--app-header-height, 64px) + 1rem);
  display: grid;
  gap: 1rem;
  min-width: 0;

  @media (max-width: 1060px) {
    position: static;
    top: auto;
    gap: 0.75rem;
  }
`

export const SaveBarMeta = styled.span<{ "data-dirty"?: string }>`
  font-size: 0.8rem;
  font-weight: 680;
  color: ${({ "data-dirty": dirty }) => (dirty === "true" ? adminStatusWarnText : adminTextSecondary)};
`

export const SectionStateBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 0.58rem;
  border-radius: 999px;
  border: 1px solid transparent;
  color: ${adminTextSecondary};
  background: ${adminSurfaceMuted};
  font-size: 0.72rem;
  font-weight: 680;

  &[data-tone="dirty"],
  &[data-tone="published"] {
    border-color: transparent;
    color: ${adminWarningBadgeText()};
    background: ${adminWarningBadgeSurface()};
  }

  &[data-tone="synced"] {
    border-color: transparent;
    color: ${adminStatusSuccessText};
    background: ${adminStatusSuccessBg};
  }
`

export const ToastStack = styled.div`
  position: fixed;
  right: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  z-index: 1200;
  display: grid;
  gap: 0.5rem;
  max-width: min(360px, calc(100vw - 2rem));
`

export const ToastCard = styled.div`
  border-radius: 10px;
  padding: 0.78rem 0.9rem;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.84rem;
  line-height: 1.5;
  box-shadow: ${adminFloatingShadow};

  &[data-tone="success"] {
    border-color: ${adminStatusSuccessBorder};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="error"] {
    border-color: ${adminStatusDangerBorder};
    color: ${adminStatusDangerText};
  }

  &[data-tone="loading"] {
    border-color: ${adminWarningBadgeBorder()};
    color: ${adminWarningBadgeText()};
  }
`

export const ModalNotice = styled(ToastCard)`
  box-shadow: none;
`

export const AvatarFallback = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-size: 1.35rem;
  font-weight: 760;
`

export const AboutSectionCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.72rem;

  > div:first-of-type {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }

  > div:first-of-type span {
    color: ${adminTextPrimary};
    font-size: 0.76rem;
    font-weight: 760;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    color: ${adminTextSecondary};
    font-size: 0.78rem;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

export const ItemList = styled.div`
  display: grid;
  gap: 0.5rem;
`

export const ItemRow = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;

  .bullet {
    color: ${adminTextMuted};
    font-weight: 700;
  }

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);

    .bullet {
      display: none;
    }
  }
`

export const InlineActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.38rem;

  .reorderButton {
    @media (pointer: coarse) {
      min-height: ${control.lg}px;
    }

    @media (min-width: 901px) and (pointer: fine) {
      display: none;
    }
  }
`

export const EmptyStateCard = styled.div`
  padding: 0.95rem 1rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  display: grid;
  gap: 0.25rem;

  strong {
    font-size: 0.86rem;
    color: ${adminTextPrimary};
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.8rem;
    line-height: 1.5;
  }
`
