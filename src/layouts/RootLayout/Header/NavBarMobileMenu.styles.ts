import styled from "@emotion/styled"
import { control } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const MobileMenuLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.mobileNavOverlay};
  pointer-events: none;
`

export const MobileMenuBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.mobileNavOverlay};
  background: color-mix(
    in srgb,
    var(--aq-text) 20%,
    transparent
  );
  pointer-events: auto;
`

export const MobileMenuPanel = styled.div`
  position: fixed;
  top: calc(var(--app-header-height, 59px) + 8px);
  right: max(0.75rem, env(safe-area-inset-right, 0px));
  z-index: ${zIndexes.mobileNavOverlay};
  display: grid;
  width: min(240px, calc(100vw - 1.5rem));
  border: 1px solid var(--aq-border-strong);
  border-radius: 6px;
  background: var(--aq-surface);
  padding: 6px;
  pointer-events: auto;

  a,
  button {
    display: flex;
    width: 100%;
    min-height: ${control.lg}px;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 0;
    background: transparent;
    color: var(--aq-text);
    padding: 0 10px;
    text-align: left;
    text-decoration: none;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }

  button[data-ui="mobile-nav-search"] {
    justify-content: flex-start;
    gap: 8px;

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      color: var(--aq-muted);
    }
  }

  .mobileLangSwitchRow {
    display: flex;
    margin-top: 4px;
    padding: 6px 2px 2px;
    border-top: 1px solid var(--aq-border);

    .mobileLangToggleBtn {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      width: 100%;
      min-height: ${control.lg}px;
      padding: 0 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--aq-muted);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      transition: color 0.15s ease, background-color 0.15s ease;

      svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      &:hover {
        color: var(--aq-text);
        background: var(--aq-surface-elevated);
      }

      &:focus-visible {
        outline: 2px solid var(--aq-focus-ring);
        outline-offset: 1px;
      }
    }
  }
`
