// 참조 구현: TryGhost/Ghost apps/admin/src/layout/app-sidebar/app-sidebar.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/shell/shell.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { layoutBreakpoint } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"
import {
  adminAccentText,
  adminBorder,
  adminBorderSubtle,
  adminCardShadow,
  adminControlText,
  adminFloatingShadow,
  adminFrameBackground,
  adminModalBackdropOverlay,
  adminShellSurface,
  adminSurface,
  adminSurfaceAccent,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const ShellFrame = styled.div<{ $collapsed?: boolean }>`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  --admin-frame-top: 8px;
  --admin-frame-side: 8px;
  --admin-frame-radius: 10px;
  --app-header-height: 48px;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  padding: var(--admin-frame-top) var(--admin-frame-side) var(--admin-frame-side);
  background: ${adminFrameBackground};
  box-sizing: border-box;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    --admin-frame-top: 0px;
    --admin-frame-side: 0px;
    --admin-frame-radius: 0px;
    --app-header-height: 56px;
    padding: 0;
    background: ${adminSurface};
  }
`

export const StudioCardFrame = styled.div<{ $collapsed?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $collapsed }) =>
    $collapsed ? "4.25rem minmax(0, 1fr)" : "14.25rem minmax(0, 1fr)"};
  flex: 1;
  width: 100%;
  min-height: calc(100vh - 16px);
  border: 1px solid ${adminBorder};
  border-radius: var(--admin-frame-radius);
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  overflow: clip;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
`

export const Sidebar = styled.aside<{ $collapsed?: boolean }>`
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.75rem;
  min-width: 0;
  position: sticky;
  top: 8px;
  height: calc(100vh - 18px);
  padding: ${({ $collapsed }) => ($collapsed ? "0.75rem 0.45rem" : "0.85rem 0.72rem")};
  background: ${adminShellSurface};
  border-right: 1px solid ${adminBorderSubtle};
  box-sizing: border-box;

  .brandHeaderRow {
    display: flex;
    flex-direction: ${({ $collapsed }) => ($collapsed ? "column" : "row")};
    align-items: center;
    justify-content: ${({ $collapsed }) => ($collapsed ? "center" : "space-between")};
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 0.25rem")};
  }

  .brandCopy {
    display: ${({ $collapsed }) => ($collapsed ? "none" : "grid")};
    gap: 0.05rem;
    min-width: 0;

    strong {
      color: ${adminTextPrimary};
      font-size: 0.84rem;
      font-weight: 650;
      letter-spacing: -0.015em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: ${adminTextMuted};
      font-size: 0.6875rem;
      font-weight: 500;
      letter-spacing: 0.01em;
    }
  }

  .railToggleBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: ${adminTextMuted};
    cursor: pointer;
    flex-shrink: 0;
    ${focusVisibleRing}

    &:hover {
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }

    @media (pointer: coarse) {
      width: 44px;
      height: 44px;
    }
  }

  .navGroup {
    display: grid;
    gap: 0.14rem;
  }

  .groupLabel {
    display: ${({ $collapsed }) => ($collapsed ? "none" : "block")};
    padding: 0 0.55rem 0.2rem;
    color: ${adminTextMuted};
    font-size: 0.6875rem;
    font-weight: 550;
    letter-spacing: 0.01em;
  }

  .profileCopy {
    display: ${({ $collapsed }) => ($collapsed ? "none" : "grid")};
    gap: 0.04rem;
    min-width: 0;

    strong,
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: ${adminTextPrimary};
      font-size: 0.79rem;
      font-weight: 600;
    }

    span {
      color: ${adminTextMuted};
      font-size: 0.6875rem;
      font-weight: 500;
    }
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    display: none;

    &[data-mobile-open="true"] {
      display: grid;
      position: fixed;
      inset: 0 auto 0 0;
      top: 0;
      height: 100dvh;
      max-height: 100dvh;
      overflow-y: auto;
      z-index: ${zIndexes.mobileNavOverlay + 1};
      width: min(17.5rem, 84vw);
      padding: 1rem 0.85rem;
      background: ${adminSurface};
      border-right: 1px solid ${adminBorder};
      box-shadow: ${adminFloatingShadow};
      overscroll-behavior: contain;
    }
  }
`

export const BrandBlock = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
`

export const BrandMark = styled.div`
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 7px;
  background: ${adminTeal};
  color: ${adminControlText};
  box-shadow: ${adminCardShadow};
  padding: 0.22rem;
  box-sizing: border-box;

  .brandLogoMark {
    display: block;
    width: 100%;
    height: 100%;
    filter: brightness(0) invert(1);
  }
`

export const SidebarNavSection = styled.section`
  display: grid;
  align-content: start;
  gap: 0.95rem;
  min-width: 0;
  overflow-y: auto;
`

export const SidebarNav = styled.nav`
  display: grid;
  align-content: start;
  gap: 0.12rem;
`

export const NavLink = styled.a<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? "center" : "flex-start")};
  gap: 0.58rem;
  min-width: 0;
  min-height: 2.12rem;
  padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 0.58rem")};
  border-radius: 7px;
  border: 1px solid transparent;
  color: inherit;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
  ${focusVisibleRing}

  > span {
    width: 1rem;
    height: 1rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: ${adminTextMuted};
  }

  > strong {
    display: ${({ $collapsed }) => ($collapsed ? "none" : "block")};
    color: ${adminTextSecondary};
    font-size: 0.82rem;
    font-weight: 580;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &[data-active="true"] {
    background: ${adminSurface};
    border-color: ${adminBorder};
    box-shadow: ${adminCardShadow};
  }

  &[data-active="true"] > span {
    color: ${adminTextPrimary};
  }

  &[data-active="true"] > strong {
    color: ${adminTextPrimary};
    font-weight: 600;
  }

  &:hover:not([data-active="true"]) {
    background: ${adminSurfaceRaised};
  }

  &:hover:not([data-active="true"]) > strong,
  &:hover:not([data-active="true"]) > span {
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const SidebarProfile = styled.div<{ $collapsed?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $collapsed }) => ($collapsed ? "1fr" : "minmax(0, 1fr) auto")};
  justify-items: ${({ $collapsed }) => ($collapsed ? "center" : "stretch")};
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  width: 100%;
  padding: 0.45rem 0.48rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  box-shadow: none;
  box-sizing: border-box;
  transition: background-color 120ms ease;

  &:hover {
    background: ${adminSurfaceMuted};
  }
`

export const SidebarProfileIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 0.52rem;
  min-width: 0;
`

export const SidebarAvatar = styled.div`
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 7px;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border: 0;
  background: ${adminSurfaceAccent};
  color: ${adminAccentText};

  span {
    font-size: 0.7rem;
    font-weight: 760;
  }

  img {
    border-radius: inherit;
  }
`

export const SidebarLogoutAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${adminTextMuted};
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurface};
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }
`

export const ContentColumn = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: start;
  min-width: 0;
  background: ${adminSurface};
  overflow-x: clip;
`

export const MobileDrawerScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.mobileNavOverlay};
  background: ${adminModalBackdropOverlay};
  backdrop-filter: blur(2px);
  overflow: hidden;
  overscroll-behavior: contain;
`
