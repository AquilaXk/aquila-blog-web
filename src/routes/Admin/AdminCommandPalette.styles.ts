// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/ui/command.tsx (MIT), TryGhost/Ghost apps/admin/src/global-search/global-search-modal.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderSubtle,
  adminFloatingShadow,
  adminModalBackdropOverlay,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export const PaletteScrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 6vh 1rem 1.5rem;
  background: ${adminModalBackdropOverlay};
  backdrop-filter: blur(4px);
  overflow: hidden;
  overscroll-behavior: contain;
`

export const PaletteModal = styled.div`
  width: min(100%, 36.5rem);
  max-height: min(42rem, calc(100dvh - 2.5rem));
  border-radius: 12px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  box-shadow: ${adminFloatingShadow};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  animation: palette-pop 140ms cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes palette-pop {
    from {
      opacity: 0;
      transform: scale(0.98) translateY(-6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  padding: 0.68rem 0.95rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  gap: 0.62rem;
`

export const SearchLeadIcon = styled.span`
  display: grid;
  place-items: center;
  color: ${adminTextMuted};
  flex-shrink: 0;
`

export const SearchInput = styled.input`
  flex: 1;
  min-height: 2.2rem;
  font-size: 1rem;
  border: 0;
  outline: none;
  box-shadow: none;
  background: transparent;
  color: ${adminTextPrimary};

  &:focus,
  &:focus-visible {
    outline: none;
    box-shadow: none;
  }

  &::placeholder {
    color: ${adminTextMuted};
  }
`

export const ClosePaletteButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 5px;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }
`

export const ShortcutHint = styled.kbd`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.66rem;
  font-weight: 660;
  padding: 0.18rem 0.42rem;
  border-radius: 5px;
  background: ${adminSurfaceMuted};
  border: 0;
  color: ${adminTextMuted};
`

export const ItemList = styled.div`
  flex: 1;
  min-height: 0;
  max-height: min(35rem, 76dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: 0.65rem;
  padding: 0.4rem 0.55rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

export const GroupBlock = styled.div<{ $topRule: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding-top: ${({ $topRule }) => ($topRule ? "0.35rem" : "0")};
  border-top: ${({ $topRule }) =>
    $topRule ? `1px solid ${adminBorderSubtle}` : "none"};
`

export const GroupLabel = styled.div`
  padding: 0.3rem 0.55rem 0.2rem;
  color: ${adminTextMuted};
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.02em;
`

export const EmptyNotice = styled.div`
  padding: 2.2rem 1rem;
  text-align: center;
  color: ${adminTextMuted};
  font-size: 0.86rem;
`

export const ItemRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: background 90ms ease;
  ${focusVisibleRing}

  &[data-selected="true"] {
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const ItemIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  color: ${adminTextMuted};
  flex-shrink: 0;

  svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
`

export const ItemMain = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }

  mark {
    background: transparent;
    color: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  small {
    color: ${adminTextMuted};
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  @media (max-width: 520px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.12rem;

    strong,
    small {
      white-space: normal;
    }
  }
`

export const KeyChord = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  color: ${adminTextMuted};
  font-size: 0.75rem;
  letter-spacing: 0.1em;
`

export const PaletteFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.48rem 0.9rem;
  border-top: 1px solid ${adminBorderSubtle};
  background: ${adminSurfaceRaised};
  color: ${adminTextMuted};
  font-size: 0.72rem;

  kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.65rem;
    font-weight: 660;
    padding: 0.06rem 0.3rem;
    border-radius: 4px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextSecondary};
  }

  @media (max-width: 520px) {
    display: none;
  }
`

export const FooterHints = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.95rem;

  span {
    display: inline-flex;
    align-items: center;
    gap: 0.24rem;
  }
`

export const FooterCount = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.68rem;
  color: ${adminTextMuted};
`
