import styled from "@emotion/styled"
import { control, layoutBreakpoint, overlayScrim } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"

export const QuickSearchBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.dialog};
  display: grid;
  align-items: start;
  justify-items: center;
  padding: clamp(2.5rem, 9vh, 5.5rem) 1rem 1.5rem;
  background: ${overlayScrim.lightbox};

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    padding: max(0.75rem, env(safe-area-inset-top, 0px)) 0.75rem 0.75rem;
  }
`

export const QuickSearchDialog = styled.div`
  width: min(100%, 40rem);
  max-height: min(76dvh, 38rem);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--aq-border-strong, var(--aq-border));
  background: var(--aq-surface);
  color: var(--aq-text);

  .qsHeader {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.65rem 0.85rem;
    border-bottom: 1px solid var(--aq-border);
    background: var(--aq-surface);
  }

  .qsSearchIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--aq-muted);
    flex-shrink: 0;
  }

  .qsInput {
    flex: 1 1 0%;
    min-width: 0;
    min-height: 36px;
    border: 0;
    background: transparent;
    color: var(--aq-text);
    font-size: 0.96rem;
    font-weight: 500;
    outline: none;

    &::placeholder {
      color: var(--aq-muted);
    }
  }

  .qsCloseBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 0.65rem;
    border: 1px solid var(--aq-border);
    border-radius: 6px;
    background: var(--aq-surface-elevated, var(--aq-surface));
    color: var(--aq-muted);
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      color: var(--aq-text);
      border-color: var(--aq-border-strong, var(--aq-border));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  .qsBody {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.45rem;
  }

  .qsStatus {
    margin: 0;
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--aq-muted);
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .qsList {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.2rem;
  }

  .qsItemButton {
    width: 100%;
    min-height: ${control.lg}px;
    display: grid;
    gap: 0.28rem;
    padding: 0.62rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--aq-text);
    text-align: left;
    cursor: pointer;

    &:hover,
    &[data-selected="true"] {
      background: var(--aq-accent-muted);
      border-color: var(--aq-accent);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: -2px;
    }
  }

  .qsItemTitleRow {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.55rem;
    min-width: 0;
  }

  .qsItemTitle {
    min-width: 0;
    font-size: 0.94rem;
    font-weight: 680;
    line-height: 1.38;
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
    font-size: 0.82rem;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  mark {
    background: var(--aq-accent-muted);
    color: var(--aq-accent-link, var(--aq-accent));
    border-radius: 3px;
    padding: 0 0.14em;
    font-weight: 700;
  }

  .qsFooter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.55rem 0.85rem;
    border-top: 1px solid var(--aq-border);
    background: var(--aq-page-bg);
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
      padding: 0.12rem 0.36rem;
      margin-right: 0.25rem;
      border-radius: 4px;
      border: 1px solid var(--aq-border);
      background: var(--aq-surface);
      font-family: inherit;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--aq-text);
    }
  }

  .qsFeedLink {
    min-height: 36px;
    padding: 0 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-text);
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;

    @media (max-width: ${layoutBreakpoint.navCompact}px), (pointer: coarse) {
      min-height: 44px;
      min-width: 44px;
    }

    &:hover {
      border-color: var(--aq-accent);
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }
`
