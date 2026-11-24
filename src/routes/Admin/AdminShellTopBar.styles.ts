// 참조 구현: shadcn-ui/ui blocks/dashboard-01/components/site-header.tsx (MIT) & TryGhost/Ghost admin-layout.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control, layoutBreakpoint } from "src/design-system/tokens"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminSurface,
  adminSurfaceAccent,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTealBorder,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const TopBar = styled.header`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 5;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  height: 3rem;
  min-height: 3rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: ${adminSurface};

  .topBarCrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    margin-right: auto;
  }

  .headerDivider {
    width: 1px;
    height: 1rem;
    margin: 0 0.25rem;
    background: ${adminBorder};
    flex-shrink: 0;
  }

  .railExpandBtn,
  .mobileMenuBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: ${adminTextSecondary};
    cursor: pointer;
    flex-shrink: 0;
    ${focusVisibleRing}

    &:hover {
      background: ${adminSurfaceMuted};
      border-color: ${adminBorder};
      color: ${adminTextPrimary};
    }
  }

  .mobileMenuBtn {
    display: none;
    width: 36px;
    height: 36px;
    border-color: transparent;
    background: transparent;
    color: ${adminTextPrimary};

    &:hover {
      background: ${adminSurfaceMuted};
      border-color: ${adminBorder};
    }
  }

  .seqPending {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 0.46rem;
    border-radius: 5px;
    border: 1px solid ${adminBorderStrong};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 720;
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    top: 0;
    height: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "title actions" "nav nav";
    align-items: center;
    row-gap: 0.35rem;
    column-gap: 0.5rem;
    padding: 0.45rem 0.75rem 0.35rem;

    .topBarCrumb {
      grid-area: title;
      min-width: 0;
      overflow: hidden;
      margin-right: 0;
      padding-right: 0.25rem;
    }

    .railExpandBtn,
    .headerDivider {
      display: none;
    }

    .mobileMenuBtn {
      display: inline-flex;
    }
  }

  @media (pointer: coarse) {
    .mobileMenuBtn {
      width: ${control.lg}px;
      height: ${control.lg}px;
    }
  }
`

export const TopBarTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.42rem;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .shellHeaderTitle,
  strong {
    display: block;
    min-width: 0;
    width: 100%;
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 520px) {
    .shellHeaderTitle,
    strong {
      font-size: 0.94rem;
    }
  }
`

export const CompactNav = styled.nav`
  display: none;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-area: nav;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    padding-top: 0.25rem;
    padding-bottom: 0.08rem;
    border-top: 1px solid ${adminBorderSubtle};
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

export const CompactNavLink = styled.a`
  min-height: ${control.lg}px;
  min-width: ${control.lg}px;
  padding: 0.25rem 0.46rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.26rem;
  flex-shrink: 0;
  border: 1px solid transparent;
  color: ${adminTextSecondary};
  text-decoration: none;
  ${focusVisibleRing}

  span {
    display: inline;
    font-size: 0.72rem;
    font-weight: 550;
    line-height: 1;
    white-space: nowrap;
  }

  &[data-active="true"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};

    span {
      font-weight: 600;
    }
  }
`

export const TopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.42rem;
  flex-shrink: 0;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-area: actions;
    gap: 0.34rem;
  }

  @media (max-width: 520px) {
    gap: 0.26rem;
  }
`

export const PaletteTriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 30px;
  padding: 0 0.48rem 0 0.58rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 580;
  ${focusVisibleRing}

  .paletteLabel {
    color: ${adminTextMuted};
    font-size: 0.76rem;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 0.34rem;
    border-radius: 4px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 680;
  }

  &:hover {
    background: ${adminSurfaceMuted};
    border-color: ${adminBorderStrong};
    color: ${adminTextPrimary};
  }

  @media (max-width: 720px) {
    .paletteLabel,
    kbd {
      display: none;
    }
  }

  @media (pointer: coarse) {
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    justify-content: center;
    padding: 0 0.5rem;
  }
`

export const SecondaryTopAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  min-height: 30px;
  padding: 0 0.68rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 600;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurfaceMuted};
    border-color: ${adminBorderStrong};
    color: ${adminTextPrimary};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px), (pointer: coarse) {
    min-height: ${control.lg}px;
    padding: 0 0.65rem;
  }

  @media (max-width: 520px) {
    min-width: ${control.lg}px;
    padding: 0;

    span {
      display: none;
    }
  }
`

export const PrimaryTopAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  min-width: 52px;
  padding: 0 0.78rem;
  border: 1px solid ${adminTealBorder};
  border-radius: 6px;
  background: ${adminTeal};
  color: ${adminControlText};
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 680;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    background: ${adminTealHover};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }

  @media (max-width: 520px) {
    min-width: 48px;
    padding: 0 0.68rem;
    font-size: 0.76rem;
  }
`

export const ResponsiveLogoutAction = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  cursor: pointer;
  ${focusVisibleRing}

  @media (max-width: ${layoutBreakpoint.adminCompact}px), (pointer: coarse) {
    display: inline-flex;
    width: ${control.lg}px;
    height: ${control.lg}px;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
  }
`

export const Canvas = styled.div`
  min-width: 0;
  outline: none;
`
