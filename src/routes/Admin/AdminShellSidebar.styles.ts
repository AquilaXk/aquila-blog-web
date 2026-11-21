// 참조 구현: TryGhost/Ghost apps/admin/src/layout/{admin-frame.tsx,admin-frame-top-bar.tsx,app-sidebar/app-sidebar.tsx} (MIT) & shadcn-ui/ui blocks/dashboard-01/{app-sidebar.tsx,nav-main.tsx,nav-user.tsx} (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { layoutBreakpoint } from "src/design-system/tokens"
import {
  adminAccentText,
  adminBorder,
  adminBorderSubtle,
  adminCardShadow,
  adminControlText,
  adminFloatingShadow,
  adminFrameBackground,
  adminFrameMuted,
  adminFramePillBg,
  adminFramePillBorder,
  adminFramePillHover,
  adminFrameText,
  adminModalBackdropOverlay,
  adminShellSurface,
  adminSurface,
  adminSurfaceAccent,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTeal,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const ShellFrame = styled.div<{ $collapsed?: boolean }>`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  --admin-frame-top: 44px;
  --admin-frame-side: 8px;
  --admin-frame-radius: 12px;
  --app-header-height: 44px;
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
    --app-header-height: 88px;
    padding: 0;
    background: ${adminSurface};
  }
`

export const FrameTopChrome = styled.div`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 35;
  height: 44px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0 1.15rem;
  background: ${adminFrameBackground};
  color: ${adminFrameText};
  box-sizing: border-box;

  .framePlaces {
    grid-column: 1;
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    min-width: 0;
  }

  .placeTab {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${adminFrameMuted};
    text-decoration: none;
    transition: color 140ms ease;
    ${focusVisibleRing}

    &:hover {
      color: ${adminFrameText};
    }

    &[data-active="true"] {
      color: ${adminFrameText};
      font-weight: 760;
    }
  }

  .placeDot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: ${adminFrameText};
  }

  .frameSearchPill {
    grid-column: 2;
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    height: 28px;
    width: min(380px, 38vw);
    padding: 0 0.72rem;
    border-radius: 999px;
    border: 1px solid ${adminFramePillBorder};
    background: ${adminFramePillBg};
    color: ${adminFrameMuted};
    cursor: pointer;
    font: inherit;
    transition: background-color 140ms ease, color 140ms ease;
    ${focusVisibleRing}

    &:hover {
      background: ${adminFramePillHover};
      color: ${adminFrameText};
    }

    .pillText {
      flex: 1;
      text-align: left;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    kbd {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: ${adminFrameMuted};
    }
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    display: none;
  }
`

export const StudioCardFrame = styled.div<{ $collapsed?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $collapsed }) =>
    $collapsed ? "4.25rem minmax(0, 1fr)" : "14.75rem minmax(0, 1fr)"};
  flex: 1;
  width: 100%;
  min-height: calc(100vh - 52px);
  border-radius: var(--admin-frame-radius);
  background: ${adminSurface};
  box-shadow: none;
  overflow: clip;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
`

export const Sidebar = styled.aside<{ $collapsed?: boolean }>`
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 0.95rem;
  min-width: 0;
  position: sticky;
  top: 44px;
  height: calc(100vh - 52px);
  padding: ${({ $collapsed }) => ($collapsed ? "0.85rem 0.5rem" : "0.95rem 0.82rem")};
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
      font-weight: 740;
      letter-spacing: -0.015em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: ${adminTextMuted};
      font-size: 0.66rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
  }

  .railToggleBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
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
  }

  .quickCreateRow {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 0.15rem")};
  }

  .quickCreateBtn {
    flex: 1;
    min-width: 0;
    min-height: 34px;
    padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 0.72rem")};
    display: inline-flex;
    align-items: center;
    justify-content: ${({ $collapsed }) => ($collapsed ? "center" : "flex-start")};
    gap: 0.5rem;
    border-radius: 7px;
    background: ${adminTeal};
    color: ${adminControlText};
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 680;
    box-shadow: ${adminCardShadow};
    transition: background-color 140ms ease;
    ${focusVisibleRing}

    &:hover {
      background: ${adminTealHover};
    }

    span {
      display: ${({ $collapsed }) => ($collapsed ? "none" : "inline")};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .navGroup {
    display: grid;
    gap: 0.14rem;
  }

  .groupLabel {
    display: ${({ $collapsed }) => ($collapsed ? "none" : "block")};
    padding: 0 0.55rem 0.22rem;
    color: ${adminTextMuted};
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
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
      font-weight: 700;
    }

    span {
      color: ${adminTextMuted};
      font-size: 0.68rem;
      font-weight: 540;
    }
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    display: none;

    &[data-mobile-open="true"] {
      display: grid;
      position: fixed;
      inset: 0 auto 0 0;
      top: 0;
      height: 100vh;
      z-index: 91;
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
    background: ${adminSurfaceMuted};
    border-color: transparent;
  }

  &[data-active="true"] > span {
    color: ${adminTextPrimary};
  }

  &[data-active="true"] > strong {
    color: ${adminTextPrimary};
    font-weight: 680;
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
  z-index: 90;
  background: ${adminModalBackdropOverlay};
  backdrop-filter: blur(2px);
  overflow: hidden;
  overscroll-behavior: contain;
`
