import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { overlayScrim } from "src/design-system/tokens"
import {
  adminBorder as border,
  adminBorderStrong as borderStrong,
  adminBorderSubtle as borderSubtle,
  adminCardShadow,
  adminControlText as controlText,
  adminFloatingShadow,
  adminGoldTintFocus,
  adminSurface as surface,
  adminSurfaceAccent as surfaceAccent,
  adminSurfaceMuted as surfaceMuted,
  adminSurfaceRaised as surfaceRaised,
  adminTeal as accentTeal,
  adminTealHover as accentTealHover,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"
import { zIndexes } from "src/styles/zIndexes"

export const BreadcrumbRow = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid ${borderSubtle};
  border-radius: 10px;
  background: ${surfaceRaised};
`

export const BreadcrumbList = styled.ol`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
`

export const BreadcrumbItem = styled.li`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  max-width: 14rem;
`

export const BreadcrumbSeparator = styled.span`
  color: ${textMuted};
  font-size: 0.76rem;
  user-select: none;
`

export const BreadcrumbButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 28px;
  max-width: 100%;
  padding: 0.15rem 0.48rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${textSecondary};
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${focusVisibleRing}
  &:hover {
    background: ${surfaceMuted};
    color: ${textPrimary};
  }
  &[aria-current="page"] {
    background: ${surface};
    color: ${textPrimary};
    font-weight: 750;
    box-shadow: ${adminCardShadow};
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const SubfolderStrip = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
`

export const TruncatedFilename = styled.span`
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;

  .stem {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ext {
    flex-shrink: 0;
    white-space: nowrap;
  }
`

export const CardKebabButton = styled.button`
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${textMuted};
  cursor: pointer;
  ${focusVisibleRing}
  &:hover,
  &:focus-visible {
    background: ${surfaceMuted};
    color: ${textPrimary};
  }
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
`

export const SortableHeaderButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.32rem;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${textMuted};
  font-size: 0.73rem;
  font-weight: 650;
  cursor: pointer;
  ${focusVisibleRing}
  &:hover,
  &[data-active="true"] {
    color: ${textPrimary};
    background: ${surfaceMuted};
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const FloatingBulkBar = styled.div`
  position: fixed;
  left: 50%;
  bottom: max(1.25rem, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: ${zIndexes.hoverCard + 1};
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.6rem;
  max-width: calc(100vw - 1.5rem);
  padding: 0.55rem 0.85rem;
  border: 1px solid ${borderStrong};
  border-radius: 12px;
  background: ${surface};
  box-shadow: ${adminFloatingShadow};
  @media (min-width: 1280px) {
    left: calc((100vw - 22rem) / 2);
  }
`

export const FloatingBulkBadge = styled.span`
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: ${surfaceAccent};
  color: ${accentTeal};
  font-size: 0.78rem;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
`

export const ContextMenuSurface = styled.div`
  position: fixed;
  z-index: ${zIndexes.mobileSheet + 10};
  min-width: 11.5rem;
  max-width: min(16rem, calc(100vw - 16px));
  padding: 0.35rem;
  border: 1px solid ${borderStrong};
  border-radius: 10px;
  background: ${surface};
  box-shadow: ${adminFloatingShadow};
  display: grid;
  gap: 0.12rem;
`

export const ContextMenuButton = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 32px;
  padding: 0.35rem 0.6rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme, $danger }) => ($danger ? theme.colors.red11 : textPrimary)};
  font-size: 0.8rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  ${focusVisibleRing}
  &:hover,
  &:focus-visible {
    background: ${({ theme, $danger }) => ($danger ? theme.colors.red3 : surfaceMuted)};
  }
  kbd {
    font-size: 0.68rem;
    font-family: inherit;
    color: ${textMuted};
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const CloudModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.dialog + 20};
  display: grid;
  place-items: center;
  padding: 1rem;
  background: ${overlayScrim.adminDetail};
`

export const CloudModalCard = styled.div`
  width: min(32rem, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  display: grid;
  gap: 0.85rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid ${border};
  border-radius: 14px;
  background: ${surface};
  box-shadow: ${adminFloatingShadow};

  h2,
  h3 {
    margin: 0;
    color: ${textPrimary};
    font-size: 1rem;
    font-weight: 760;
  }
`

export const ModalInput = styled.input`
  width: 100%;
  min-height: 38px;
  padding: 0 0.7rem;
  border: 1px solid ${border};
  border-radius: 8px;
  background: ${surface};
  color: ${textPrimary};
  font-size: 0.85rem;
  box-sizing: border-box;
  &:focus-visible {
    outline: none;
    border-color: ${accentTeal};
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    font-size: 1rem;
  }
`

export const ModalSegmentedRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`

export const ModalPillButton = styled.button<{ "data-active"?: boolean }>`
  min-height: 32px;
  padding: 0.25rem 0.68rem;
  border: 1px solid ${({ "data-active": active }) => (active ? accentTeal : border)};
  border-radius: 7px;
  background: ${({ "data-active": active }) => (active ? accentTeal : surface)};
  color: ${({ "data-active": active }) => (active ? controlText : textSecondary)};
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
  ${focusVisibleRing}
  &:hover:not(:disabled) {
    background: ${({ "data-active": active }) => (active ? accentTealHover : surfaceRaised)};
    color: ${({ "data-active": active }) => (active ? controlText : textPrimary)};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const ShareTokenList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;
  max-height: 11rem;
  overflow-y: auto;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    border-radius: 8px;
    background: ${surfaceRaised};
    font-size: 0.76rem;
    color: ${textSecondary};
  }
`
