/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/MobileNav.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { control, overlayScrim } from "src/design-system/tokens"
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
  background: ${overlayScrim.mobileNavBackdrop};
  pointer-events: auto;
`

export const MobileMenuPanel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  left: auto;
  z-index: ${zIndexes.mobileNavOverlay + 1};
  height: 100%;
  height: 100svh;
  width: min(20rem, 80dvw, calc(100dvw - 24px));
  background: var(--aq-surface);
  color: var(--aq-text);
  border-left: 1px solid var(--aq-border);
  pointer-events: auto;
  overflow: hidden;

  .mobileNavClose {
    position: fixed;
    top: 1.75rem;
    right: 1rem;
    z-index: ${zIndexes.mobileNavOverlay + 2};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4rem;
    height: 4rem;
    padding: 1rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--aq-text);
    cursor: pointer;
    transition: color 0.15s ease;

    &:hover {
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }

  .mobileNavList {
    margin-top: 2rem;
    display: flex;
    height: 100%;
    flex-direction: column;
    align-items: flex-start;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 2rem 3rem 3rem;
    text-align: left;
  }

  .mobileNavList a,
  .mobileNavList button {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    min-height: ${control.lg}px;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem 0.5rem 0;
    border: 0;
    background: transparent;
    color: var(--aq-text);
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease;

    @media (hover: hover) {
      &:hover {
        color: var(--aq-accent-link, var(--aq-accent));
      }
    }

    &[aria-current="page"] {
      color: var(--aq-accent-link, var(--aq-accent));
      text-decoration: underline;
      text-underline-offset: 0.3em;
      text-decoration-thickness: 2px;
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 0.375rem;
    }
  }

  .mobileNavDivider {
    width: 100%;
    max-width: 16rem;
    height: 1px;
    margin: 0.5rem 0 1.25rem;
    background: var(--aq-border);
  }

  .mobileNavList button[data-ui="mobile-nav-search"],
  .mobileNavList button.mobileLangToggleBtn {
    font-size: 1.125rem;
    line-height: 1.625rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--aq-text-secondary, var(--aq-text));

    svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
  }
`
