/**
 * 참조 구현:
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/command.tsx, MIT License)
 * - pacocoursey/cmdk (MIT License)
 */
import styled from "@emotion/styled"
import { boxShadowColor, control, layoutBreakpoint, overlayScrim } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const QuickSearchBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.mobileSheet};
  display: grid;
  align-items: start;
  justify-items: center;
  padding: clamp(5rem, 16vh, 8.5rem) 1rem 1.5rem;
  background: ${overlayScrim.lightbox};

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    padding: max(0.75rem, env(safe-area-inset-top, 0px)) 0.75rem 0.75rem;
  }
`

export const QuickSearchDialog = styled.div`
  width: min(100%, 32rem);
  overflow: hidden;
  padding: 0;
  border-radius: 0.75rem;
  border: 1px solid var(--aq-border);
  background: var(--aq-surface);
  color: var(--aq-text);
  box-shadow: 0 16px 40px ${boxShadowColor.cardFloating};

  .srOnly {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .cmdRoot {
    display: flex;
    width: 100%;
    flex-direction: column;
    overflow: hidden;
    border-radius: 0.375rem;
    background: var(--aq-surface);
    color: var(--aq-text);
  }

  .qsHeader {
    display: flex;
    height: 3rem;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--aq-border);
    padding: 0 0.75rem;
  }

  .qsSearchIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--aq-text);
    opacity: 0.5;
    flex-shrink: 0;
    pointer-events: none;
  }

  .qsInput {
    display: flex;
    height: 3rem;
    width: 100%;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    padding: 0.75rem 0;
    color: var(--aq-text);
    font-size: 1rem;
    outline: none;
    appearance: none;
    -webkit-appearance: none;

    &::-webkit-search-decoration,
    &::-webkit-search-cancel-button {
      display: none;
      -webkit-appearance: none;
    }

    &::placeholder {
      color: var(--aq-muted);
    }
  }

  .qsCloseBtn {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    padding: 0 0.4rem;
    border: 0;
    border-radius: 0.25rem;
    background: var(--aq-surface-subtle);
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    line-height: 1;
    cursor: pointer;

    @media (pointer: coarse) {
      min-width: ${control.lg}px;
      min-height: ${control.lg}px;
      padding: 0 0.625rem;
    }

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  .qsBody {
    max-height: 320px;
    scroll-padding-block: 0.25rem;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem;
  }

  .qsStatus {
    margin: 0;
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--aq-muted);
    font-size: 0.875rem;
  }

  .qsGroup {
    overflow: hidden;
    padding: 0.25rem;
    color: var(--aq-text);
  }

  .qsGroupHeading {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--aq-muted);
  }

  .qsList {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 2px;
  }

  li[role="none"] {
    border: 0;
  }

  .qsItemButton {
    position: relative;
    width: 100%;
    min-height: ${control.lg}px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
    border: 0;
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    background: transparent;
    color: var(--aq-text);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    user-select: none;
    outline: none;

    &:hover,
    &.active,
    &[data-selected="true"] {
      background: var(--aq-surface-subtle);
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: -2px;
    }
  }

  .qsItemButton[aria-selected="true"] {
    background: var(--aq-surface-subtle);
    color: var(--aq-text);
  }

  .qsItemTitleRow {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 0;
  }

  .qsItemTitle {
    min-width: 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--aq-text);
    overflow-wrap: anywhere;
  }

  .qsItemDate {
    flex-shrink: 0;
    color: var(--aq-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .qsItemSummary {
    margin: 0;
    color: var(--aq-muted);
    font-size: 0.8125rem;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .qsItemTags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .qsItemTag {
    display: inline-flex;
    align-items: center;
    padding: 0.08rem 0.4rem;
    border-radius: 0.25rem;
    background: var(--aq-surface-subtle);
    color: var(--aq-muted);
    font-size: 0.72rem;
    font-weight: 500;
  }

  mark {
    background: var(--aq-accent-muted);
    color: var(--aq-accent-link, var(--aq-accent));
    border-radius: 0.2rem;
    padding: 0 0.12em;
    font-weight: 600;
  }

  .qsSeparator {
    height: 1px;
    background: var(--aq-border);
  }

  .qsFooter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 0.75rem;
    background: var(--aq-surface-subtle);
    color: var(--aq-muted);
    font-size: 0.75rem;
  }

  .qsHints {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;

    kbd {
      display: inline-flex;
      align-items: center;
      height: 18px;
      padding: 0 0.34rem;
      margin-right: 0.25rem;
      border-radius: 0.25rem;
      border: 0;
      background: var(--aq-surface);
      box-shadow: 0 0 0 1px var(--aq-border);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--aq-muted);
    }
  }

  .qsFeedLink {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 28px;
    padding: 0 0.25rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--aq-text-secondary, var(--aq-muted));
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s ease;

    @media (max-width: ${layoutBreakpoint.navCompact}px), (pointer: coarse) {
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
      padding: 0 0.4rem;
    }

    &:hover {
      color: var(--aq-accent-link, var(--aq-text));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }
`
