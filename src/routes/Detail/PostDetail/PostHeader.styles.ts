/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/PostLayout.tsx, components/PageTitle.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { breakpoint, control } from "src/design-system/tokens"

export const StyledWrapper = styled.header`
  width: 100%;
  margin: 0 auto;
  padding: 2rem 0 2rem;
  text-align: center;
  border-bottom: 1px solid var(--aq-border);

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

  .heroLabel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    margin-bottom: 0.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface-subtle);
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: 0.04em;
  }

  .heroLabelLink {
    color: var(--aq-accent-link, var(--aq-accent));
    text-decoration: none;

    &:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 3px;
    }
  }

  .headerDateList {
    margin: 0 0 0.625rem;
  }

  .headerDate {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--aq-muted);
  }

  .headerModified {
    font-size: 0.875rem;
  }

  .title {
    margin: 0;
    font-size: 1.875rem;
    line-height: 2.25rem;
    letter-spacing: -0.025em;
    font-weight: 800;
    color: var(--aq-text);
    overflow-wrap: break-word;
    word-break: keep-all;
    text-wrap: balance;

    @media (min-width: ${breakpoint.sm}px) {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }

    @media (min-width: ${breakpoint.md}px) {
      font-size: 3rem;
      line-height: 1.15;
    }
  }

  .deck {
    max-width: 42rem;
    margin: 0.95rem auto 0;
    color: var(--aq-text-secondary, var(--aq-muted));
    font-size: 1.0625rem;
    line-height: 1.65;
    overflow-wrap: break-word;
    word-break: keep-all;
    text-wrap: pretty;
  }

  .headerMobileMeta {
    margin-top: 1.25rem;

    @media (min-width: ${breakpoint.lg}px) {
      display: none;
    }
  }

  .metaRow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px 20px;
    flex-wrap: wrap;
  }

  .author {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .avatar {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 9999px;
    overflow: hidden;
    background: var(--aq-surface-elevated, var(--aq-surface));
    box-shadow: inset 0 0 0 1px var(--aq-border-strong);

    img {
      object-fit: cover;
      object-position: center 38%;
    }
  }

  .avatarFallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--aq-muted);

    svg {
      width: 18px;
      height: 18px;
      display: block;
    }
  }

  .authorText {
    text-align: left;

    strong {
      color: var(--aq-text);
      font-size: 0.875rem;
      font-weight: 600;
      overflow-wrap: break-word;
      word-break: keep-all;
    }
  }

  .metaUtilities {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stats {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    color: var(--aq-muted);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
    font-weight: 500;
  }

  .statChip {
    display: inline-flex;
    align-items: center;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .engagementRow {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .likeButton,
  .shareButton {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: ${control.md}px;
    padding: 0 0.875rem;
    border-radius: 9999px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-text-secondary);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;

    @media (hover: hover) {
      &:hover:not(:disabled) {
        border-color: var(--aq-border-strong);
        background: var(--aq-surface-subtle);
        color: var(--aq-text);
      }
    }

    &[data-active="true"] {
      border-color: var(--aq-accent);
      background: var(--aq-surface-subtle);
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:disabled {
      opacity: 0.72;
      cursor: default;
    }
  }

  .shareFeedbackPill {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--aq-muted);
  }

  @media (max-width: ${breakpoint.lg - 1}px), (pointer: coarse) {
    .likeButton,
    .shareButton {
      min-height: ${control.lg}px;
    }

    .actions[data-hide-mobile="true"] .likeButton,
    .actions[data-hide-mobile="true"] .shareButton {
      display: none;
    }
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    .headerMobileMeta .metaUtilities,
    .headerMobileMeta .stats {
      display: none;
    }
  }

  @media (min-width: ${breakpoint.lg}px) {
    .shareButton[data-hide-desktop="true"],
    .shareFeedbackPill[data-hide-desktop="true"] {
      display: none;
    }
  }
`
