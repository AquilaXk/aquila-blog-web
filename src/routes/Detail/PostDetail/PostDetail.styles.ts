/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/PostLayout.tsx, MIT License)
 * - fuma-nama/fumadocs (packages/ui/src/components/layout/toc.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { breakpoint, control } from "src/design-system/tokens"
import { mobileTocStyles } from "./PostDetailSection.styles"

export const StyledWrapper = styled.div`
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  margin: 0 auto;
  min-width: 0;
  padding: 0;
  color: var(--aq-text);
  position: relative;
  z-index: 0;
  isolation: isolate;

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

  .detailReadProgress {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 90;
    width: 100%;
    height: 2px;
    pointer-events: none;

    span {
      display: block;
      width: 100%;
      height: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      will-change: transform;
      background: var(--aq-accent-link);
    }
  }

  .detailHero {
    width: 100%;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
  }

  .detailLayout {
    display: grid;
    width: 100%;
    margin: 0 auto;
    grid-template-columns: 240px minmax(0, 1fr);
    column-gap: 2.5rem;
    align-items: start;
    padding: 2rem 0 4.5rem;
    min-width: 0;
    overflow: visible;
  }

  article {
    margin: 0;
    max-width: none;
    display: grid;
    gap: 0;
    min-width: 0;
    width: 100%;
    position: relative;
    z-index: 0;
  }

  article > * {
    min-width: 0;
  }

  .relatedPrefetchTrigger {
    width: 100%;
    height: 1px;
  }

  .postSidebar {
    min-width: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .sidebarAuthorList {
    margin: 0;
    padding: 0 0 1.5rem;
    border-bottom: 1px solid var(--aq-border);
  }

  .sidebarAuthorRow {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .sidebarAvatar {
    position: relative;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 9999px;
    overflow: hidden;
    background: var(--aq-surface-subtle);
    box-shadow: inset 0 0 0 1px var(--aq-border);

    img {
      object-fit: cover;
      object-position: center 38%;
    }
  }

  .sidebarAvatarFallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--aq-muted);
  }

  .sidebarAuthorInfo {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }

  .sidebarAuthorName {
    color: var(--aq-text);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25rem;
    overflow-wrap: anywhere;
  }

  .sidebarAuthorStats {
    color: var(--aq-muted);
    font-size: 0.75rem;
    line-height: 1.15rem;
    font-variant-numeric: tabular-nums;

    .stats,
    .statChip {
      display: inline;
    }
  }

  .sidebarDivided {
    display: flex;
    flex-direction: column;
  }

  .sidebarSection {
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--aq-border);
  }

  .sidebarHeading {
    margin: 0 0 0.375rem;
    color: var(--aq-muted);
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .sidebarTagList {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }

  .sidebarTagLink {
    color: var(--aq-accent-link, var(--aq-accent));
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-decoration: none;
    transition: color 120ms ease;

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 2px;
    }

    @media (pointer: coarse) {
      display: inline-flex;
      align-items: center;
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
    }
  }

  .sidebarActionsRow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .sidebarActionButton {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 36px;
    padding: 0 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-text-secondary);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;

    &:hover:not(:disabled) {
      border-color: var(--aq-accent-link, var(--aq-accent));
      color: var(--aq-accent-link, var(--aq-accent));
      background: var(--aq-surface-subtle);
    }

    &[data-active="true"] {
      border-color: var(--aq-accent);
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:disabled {
      opacity: 0.72;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }

    @media (pointer: coarse) {
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
    }
  }

  .sidebarAdjacentGroup {
    display: grid;
    gap: 1.25rem;
  }

  .sidebarAdjacentLink {
    display: block;
    color: var(--aq-accent-link, var(--aq-accent));
    font-size: 0.875rem;
    line-height: 1.375rem;
    font-weight: 500;
    text-decoration: none;
    overflow-wrap: break-word;
    word-break: keep-all;

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }

  .sidebarStickySlot {
    position: sticky;
    top: calc(var(--app-header-height, 65px) + 1.25rem);
    align-self: stretch;
    margin-top: 1.25rem;
    padding-top: 0;
  }

  .sidebarBackWrap {
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--aq-border);

    &:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }
  }

  .sidebarBackLink {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 36px;
    color: var(--aq-accent-link, var(--aq-accent));
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 2px;
    }

    @media (pointer: coarse) {
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
    }
  }

  .rightRail {
    min-width: 0;
    width: 100%;
    overflow: visible;
  }

  .rightRailInner {
    padding: 0;
    background: transparent;

    .rightRailHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .rightRailTitleGroup {
      min-width: 0;
    }

    .rightRailTitle {
      margin: 0;
      color: var(--aq-muted);
      font-size: 0.75rem;
      line-height: 1rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .tocDepthToggle {
      border: 0;
      border-radius: 0.375rem;
      background: var(--aq-surface-subtle);
      color: var(--aq-text-secondary);
      font-size: 0.7rem;
      font-weight: 600;
      line-height: 1;
      min-height: 28px;
      padding: 0 0.5rem;
      cursor: pointer;
      flex-shrink: 0;

      &:hover {
        color: var(--aq-text);
        background: var(--aq-surface-elevated);
      }

      &:focus-visible {
        outline: 2px solid var(--aq-focus-ring);
        outline-offset: 2px;
      }

      @media (pointer: coarse) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: ${control.lg}px;
        min-width: ${control.lg}px;
        padding: 0 0.75rem;
      }
    }

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: block;
      max-height: min(28rem, calc(100vh - 14rem));
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scroll-target-group: auto;
    }

    li {
      min-width: 0;
      margin: 0;
      border-left: 1px solid var(--aq-border);
      padding: 0 0 0 0.875rem;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    li[data-active="true"] {
      border-left-color: var(--aq-accent-link, var(--aq-accent));
      box-shadow: inset 2px 0 0 var(--aq-accent-link, var(--aq-accent));
    }

    li[data-level="3"] button {
      padding-left: 0.5rem;
      font-size: 0.78rem;
    }

    li[data-level="4"] button {
      padding-left: 0.9rem;
      font-size: 0.75rem;
    }

    button {
      width: 100%;
      display: flex;
      align-items: center;
      text-align: left;
      border: 0;
      border-radius: 0;
      min-height: ${control.lg}px;
      box-sizing: border-box;
      max-width: 100%;
      padding: 0.5rem 0;
      background: transparent;
      color: var(--aq-text-secondary);
      font-size: 0.8125rem;
      line-height: 1.4;
      cursor: pointer;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: keep-all;
      transition: color 0.15s ease;
    }

    button:hover {
      color: var(--aq-text);
    }

    button[data-active="true"] {
      color: var(--aq-accent-link, var(--aq-accent));
      font-weight: 700;
    }
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    .detailLayout {
      width: auto;
      display: block;
      padding: 1.5rem 0 3.5rem;
    }

    .postSidebar {
      display: none;
    }

    article {
      max-width: none;
    }
  }

  ${mobileTocStyles}
`

export const BodySection = styled.div`
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
  width: 100%;
  min-width: 0;

  .markdownLoadingSkeleton {
    margin-top: 1.65rem;
    min-height: clamp(18rem, 42vh, 28rem);
    display: grid;
    align-content: start;
    gap: 0.9rem;
  }

  .markdownLoadingSkeleton .skeletonLine {
    display: block;
    height: 1rem;
    border-radius: 4px;
    background: var(--aq-border);
  }

  .markdownLoadingSkeleton .skeletonLineWide {
    width: 82%;
  }

  .markdownLoadingSkeleton .skeletonLineFull {
    width: 96%;
  }

  .markdownLoadingSkeleton .skeletonLineMid {
    width: 68%;
  }
`
