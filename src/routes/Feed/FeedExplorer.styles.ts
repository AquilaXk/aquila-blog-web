/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/ListLayoutWithTags.tsx, layouts/ListLayout.tsx, MIT License)
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/dropdown-menu.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { boxShadowColor, breakpoint } from "src/design-system/tokens"
import { FEED_TAG_RAIL_CHIP_MAX_PX } from "./feedUiTokens"

const FEED_POST_COLUMN_MAX_WIDTH_REM = 100

export const ExplorerCard = styled.section`
  --feed-post-column-max-width: ${FEED_POST_COLUMN_MAX_WIDTH_REM}rem;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 1.75rem 0 1.4rem;
  min-width: 0;
  min-height: 0;
  height: auto;
  overflow: visible;
  margin: 0;
  border-bottom: 1px solid var(--aq-border);

  .feedTitle {
    min-width: 0;
    display: block;
  }

  .feedHeading,
  .feedTitle h1 {
    margin: 0;
    color: var(--aq-text);
    font-size: 1.875rem;
    line-height: 2.25rem;
    letter-spacing: -0.028em;
    font-weight: 800;
    text-wrap: balance;

    @media (min-width: ${breakpoint.sm}px) {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }
  }

  .searchSlot {
    min-width: 0;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .sortDropdown {
    position: relative;
    flex: 0 0 auto;
  }

  .sortTrigger {
    height: 38px;
    border: 1px solid var(--aq-border);
    border-radius: 8px;
    background: var(--aq-surface);
    display: inline-flex;
    color: var(--aq-muted);
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 88px;
    padding: 0 12px;
    font-size: 0.8125rem;
    line-height: 1;
    font-weight: 650;
    letter-spacing: 0;
    cursor: pointer;
    transition:
      border-color 180ms cubic-bezier(0.215, 0.61, 0.355, 1),
      color 180ms cubic-bezier(0.215, 0.61, 0.355, 1),
      background-color 180ms cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  .sortTrigger:hover,
  .sortTrigger[aria-expanded="true"] {
    border-color: var(--aq-border-strong);
    color: var(--aq-text);
    background: var(--aq-surface-subtle);
  }

  .sortTrigger:focus-visible {
    border-color: var(--aq-border-strong);
    color: var(--aq-text);
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
  }

  .sortChevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--aq-muted);
    transition: transform 180ms cubic-bezier(0.215, 0.61, 0.355, 1);
    pointer-events: none;
  }

  .sortTrigger[aria-expanded="true"] .sortChevron {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .sortTrigger,
    .sortChevron {
      transition: none;
    }
  }

  .sortMenu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    min-width: 140px;
    border: 1px solid var(--aq-border);
    border-radius: 8px;
    background: var(--aq-surface);
    box-shadow: 0 8px 24px ${boxShadowColor.cardHover};
    padding: 4px;
    display: grid;
    gap: 2px;
  }

  .sortOption {
    width: 100%;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--aq-text-secondary, var(--aq-muted));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
    padding: 0 8px;
    font-size: 0.8125rem;
    font-weight: 550;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .sortCheck {
    flex-shrink: 0;
    color: var(--aq-text);
  }

  .sortOption:hover,
  .sortOption[data-active="true"] {
    background: var(--aq-surface-subtle);
    color: var(--aq-text);
  }

  .sortOption:focus-visible {
    background: var(--aq-surface-subtle);
    color: var(--aq-text);
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: -2px;
  }

  .sortOption[aria-selected="true"],
  .sortOption[data-selected="true"] {
    color: var(--aq-text);
    font-weight: 650;
  }

  @media (max-width: 820px), (pointer: coarse) {
    .sortTrigger {
      height: 44px;
      min-height: 44px;
      min-width: 86px;
    }

    .sortOption {
      height: 44px;
      min-height: 44px;
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: start;
    gap: 20px;
    padding-bottom: 18px;

    .searchSlot {
      width: 100%;
    }

    .sortDropdown {
      flex: 0 0 auto;
    }

    .sortMenu {
      left: auto;
      right: 0;
    }
  }
`

export const FeedBody = styled.section`
  --feed-post-column-max-width: ${FEED_POST_COLUMN_MAX_WIDTH_REM}rem;
  display: flex;
  align-items: flex-start;
  gap: 3.5rem;
  min-width: 0;
  overflow: visible;
  padding: 2.25rem 0 4.5rem;

  .tagColumn {
    flex: 0 0 auto;
    min-width: 0;
    display: block;
  }

  .postColumn {
    flex: 1 1 0%;
    min-width: 0;
    width: 100%;
  }

  @media (min-width: ${breakpoint.xl}px) {
    gap: 5rem;
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    gap: 2.5rem;
  }

  @media (max-width: ${FEED_TAG_RAIL_CHIP_MAX_PX}px) {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem 0 3.5rem;

    .tagColumn {
      width: 100%;
    }
  }
`

export const FilterContextBar = styled.div`
  min-height: 1.8rem;
  margin: 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--aq-muted);

  .contextMain {
    flex: 1 1 0%;
    min-width: 0;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.38rem;
  }

  .contextActions {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    flex: 0 0 auto;
  }

  .contextCount {
    font-size: 0.88rem;
    color: var(--aq-text);
    font-weight: 700;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }

  .filterSummary {
    flex: 1 1 0%;
    min-width: 0;
    color: var(--aq-muted);
    font-size: 0.74rem;
    line-height: 1.35;
    font-weight: 600;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .resetButton {
    flex: 0 0 auto;
    min-height: 1.75rem;
    padding: 0 0.7rem;
    border-radius: 9999px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface-subtle);
    color: var(--aq-text-secondary, var(--aq-muted));
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;

    &:hover {
      background: var(--aq-surface-elevated);
      border-color: var(--aq-border-strong);
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  @media (max-width: 820px), (pointer: coarse) {
    .resetButton {
      min-height: 44px;
      padding: 0 0.8rem;
    }
  }

  @media (max-width: 768px) {
    margin-top: 0.5rem;
    margin-bottom: 0;

    .contextCount {
      font-size: 0.84rem;
    }

    .filterSummary {
      font-size: 0.71rem;
      max-width: 100%;
    }
  }
`
