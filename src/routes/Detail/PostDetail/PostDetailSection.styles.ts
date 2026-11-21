/**
 * 참조 구현:
 * - fuma-nama/fumadocs (MIT License)
 */
import { css } from "@emotion/react"
import styled from "@emotion/styled"
import { breakpoint, control } from "src/design-system/tokens"

export const mobileTocStyles = css`
  .mobileToc,
  .mobileTocBlock {
    display: none;
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    .mobileToc {
      display: block;
      position: sticky;
      top: calc(var(--app-header-height, var(--app-header-mobile-height, 64px)) + 8px);
      z-index: 20;
      margin: 0 0 1.5rem;
      border: 1px solid var(--aq-border);
      border-radius: 0.5rem;
      background: var(--aq-surface);
    }

    .mobileTocSummary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      min-width: 0;
      min-height: ${control.lg}px;
      padding: 0 0.9rem;
      color: var(--aq-text);
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.2;
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }
    }

    .mobileTocChevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--aq-muted);
      transition: transform 180ms ease;
      pointer-events: none;
    }

    .mobileTocSummaryLabel {
      flex-shrink: 0;
      color: var(--aq-muted);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .mobileTocCurrentSection {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--aq-text);
      font-size: 0.84rem;
      font-weight: 600;
    }

    .mobileToc[open] .mobileTocChevron {
      transform: rotate(180deg);
    }

    .mobileTocHead {
      display: flex;
      justify-content: flex-end;
      padding: 0.45rem 0.7rem 0.25rem;
      border-top: 1px solid var(--aq-border);
    }

    .mobileTocDepthToggle {
      border: 1px solid var(--aq-border);
      border-radius: 0.375rem;
      background: var(--aq-surface);
      color: var(--aq-text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
      padding: 0 0.65rem;
      cursor: pointer;
    }

    .mobileTocList {
      margin: 0;
      padding: 0 0.5rem 0.5rem;
      list-style: none;
      border-top: 1px solid var(--aq-border);
      max-height: min(52dvh, 360px);
      overflow-y: auto;
    }

    .mobileTocList li {
      margin: 0;
      min-width: 0;
    }

    .mobileTocList li[data-level="3"] button {
      padding-left: 1.1rem;
    }

    .mobileTocList li[data-level="4"] button {
      padding-left: 1.7rem;
    }

    .mobileTocList button {
      width: 100%;
      display: flex;
      align-items: center;
      min-height: ${control.lg}px;
      box-sizing: border-box;
      padding: 0.5rem 0.4rem;
      border: 0;
      background: transparent;
      color: var(--aq-text-secondary);
      font-size: 0.875rem;
      line-height: 1.4;
      text-align: left;
      cursor: pointer;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: keep-all;
    }

    .mobileTocList button[data-active="true"] {
      color: var(--aq-accent-link, var(--aq-accent));
      font-weight: 700;
    }
  }
`

export const MobileSummaryBar = styled.div`
  display: none;

  @media (max-width: ${breakpoint.lg - 1}px) {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin-bottom: 28px;

    button {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 6px;
      border: 1px solid var(--aq-border);
      background: var(--aq-surface);
      color: var(--aq-text-secondary);
      box-shadow: none;
      cursor: pointer;

      &:disabled {
        cursor: default;
        opacity: 0.72;
      }
    }

    button[data-active="true"] {
      border-color: var(--aq-accent);
      background: var(--aq-surface);
      color: var(--aq-accent-link);
    }

    button span,
    button strong {
      display: none;
    }

    button[data-feedback="true"] {
      width: auto;
      padding: 0 12px;
      gap: 6px;

      span {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        font-size: 0.8125rem;
        font-weight: 650;
      }
    }
  }
`

export const RelatedSection = styled.section`
  margin-top: 64px;
  padding-top: 40px;
  border-top: 1px solid var(--aq-border);
  content-visibility: auto;
  contain-intrinsic-size: 1px 420px;

  h3 {
    margin: 0 0 22px;
    color: var(--aq-text);
    font-size: 22px;
    line-height: 1.25;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    min-width: 0;
  }

  li + li a {
    border-top: 1px solid var(--aq-border);
  }

  li a {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 20px;
    min-width: 0;
    padding: 18px 0;
    color: var(--aq-text);
    text-decoration: none;
    transition: color 0.18s cubic-bezier(0.215, 0.61, 0.355, 1);

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--aq-accent-link, var(--aq-accent));

        .relatedArrow {
          transform: translateX(4px);
        }
      }
    }
  }

  .relatedItemCopy {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  strong {
    color: currentColor;
    font-size: 16px;
    line-height: 1.4;
    font-weight: 780;
    letter-spacing: -0.02em;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .relatedMeta {
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 600;
  }

  .relatedArrow {
    display: inline-flex;
    align-items: center;
    color: currentColor;
    line-height: 1;
    transition: transform 0.22s cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    li a,
    .relatedArrow {
      transition: none;
    }

    li a:hover .relatedArrow {
      transform: none;
    }
  }
`

export const RelatedSkeletonItem = styled.li`
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 18px 0;

  & + & {
    border-top: 1px solid var(--aq-border);
  }

  .titleLine,
  .metaLine {
    display: block;
    border-radius: 4px;
    background: var(--aq-border);
    animation: related-skeleton-pulse 1.18s ease-in-out infinite;
  }

  .titleLine {
    width: min(70%, 17rem);
    height: 0.98rem;
  }

  .metaLine {
    width: 1.2rem;
    height: 1rem;
  }

  @keyframes related-skeleton-pulse {
    0% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.7;
    }
  }
`
