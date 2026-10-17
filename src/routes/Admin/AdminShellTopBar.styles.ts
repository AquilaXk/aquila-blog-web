import styled from "@emotion/styled"
import { control, layoutBreakpoint } from "src/design-system/tokens"
import {
  adminBorder,
  adminBorderStrong,
  adminControlText,
  adminSurfaceAccent,
  adminSurfaceRaised,
  adminTeal,
  adminTealBorder,
  adminTealHover,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const CompactNav = styled.nav`
  display: none;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    overflow-x: auto;
    padding-bottom: 0.12rem;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

export const CompactNavLink = styled.a`
  min-height: ${control.lg}px;
  min-width: ${control.lg}px;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  border: 1px solid transparent;
  color: ${adminTextSecondary};
  text-decoration: none;

  span {
    display: inline;
    font-size: 0.72rem;
    font-weight: 760;
    line-height: 1;
    white-space: nowrap;
  }

  &[data-active="true"] {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceAccent};
    color: ${adminTeal};
  }
`

export const TopBarTitle = styled.div`
  display: block;
  min-width: 0;
  margin-right: auto;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.94rem;
    font-weight: 820;
    line-height: 1.2;
  }
`

export const TopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
`

export const SecondaryTopAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 0.9rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurfaceRaised};
  color: ${adminTextPrimary};
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 780;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    min-height: ${control.lg}px;
  }
`

export const PrimaryTopAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 0.95rem;
  border: 1px solid ${adminTealBorder};
  border-radius: 6px;
  background: ${adminTeal};
  color: ${adminControlText};
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 820;

  &:hover {
    background: ${adminTealHover};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    min-height: ${control.lg}px;
  }
`

export const Canvas = styled.div`
  min-width: 0;
`
