import styled from "@emotion/styled";
import { control } from "src/design-system/tokens";
export const StyledWrapper = styled.header `
  width: min(100%, 880px);
  margin: 0 auto;
  padding: 0;

  .backLink {
    display: flex;
    width: max-content;
    align-items: center;
    gap: 0.44rem;
    margin-bottom: 2.125rem;
    color: var(--aq-muted);
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.2;
    text-decoration: none;
    transition: color 120ms ease;

    &:hover {
      color: var(--aq-text);
    }
  }

  .heroLabel {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    margin-bottom: 0.875rem;
    color: var(--aq-accent-link, var(--aq-accent));
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.6875rem;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .title {
    margin: 0.875rem 0 1.375rem;
    font-size: clamp(42px, 5.3vw, 70px);
    line-height: 1.08;
    letter-spacing: -0.065em;
    font-weight: 600;
    color: var(--aq-text);
    overflow-wrap: break-word;
    word-break: keep-all;
    text-wrap: balance;
  }

  .deck {
    max-width: 820px;
    margin: 0 0 2rem;
    color: var(--aq-muted);
    font-size: 1.125rem;
    line-height: 1.75;
    overflow-wrap: anywhere;
    word-break: keep-all;
    text-wrap: pretty;
  }

  .metaRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    margin-top: 0;
  }

  .author {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .avatar {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--aq-surface-elevated, var(--aq-surface));
    box-shadow: inset 0 0 0 1px var(--aq-border);

    img {
      object-fit: cover;
      object-position: center 38%;
    }
  }

  .avatarFallback {
    position: absolute;
    inset: 5px;
    display: block;
    color: var(--aq-muted);
  }

  .avatarFallback::before,
  .avatarFallback::after {
    content: "";
    position: absolute;
    left: 50%;
    background: currentColor;
    transform: translateX(-50%);
  }

  .avatarFallback::before {
    top: 0;
    width: 42%;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .avatarFallback::after {
    right: 0;
    bottom: 0;
    left: 0;
    height: 45%;
    border-radius: 999px 999px 2px 2px;
    transform: none;
  }

  .authorText {
    display: grid;
    gap: 0.18rem;
    min-width: 0;

    strong {
      color: var(--aq-text);
      font-size: 0.9375rem;
      font-weight: 800;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
  }

  .metaText {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.42rem;
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    min-width: 0;
    font-weight: 550;
  }

  .metaUtilities {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.52rem;
    min-width: 0;
    margin-left: auto;
  }

  .stats {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px 22px;
    min-width: 0;
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
    font-weight: 600;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.52rem;
  }

  .engagementRow {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.52rem;
    min-width: 0;
  }

  .shareFeedbackPill {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 0.78rem;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-muted);
    font-size: 0.82rem;
    font-weight: 650;
    line-height: 1;
  }

  .likeButton {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    min-height: 40px;
    padding: 0 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: transparent;
    color: var(--aq-text);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      background-color 0.18s ease,
      color 0.18s ease,
      transform 0.12s ease;

    svg {
      font-size: 1.05rem;
    }

    &:hover:not(:disabled) {
      border-color: var(--aq-border-strong, var(--aq-text));
      background: var(--aq-surface-elevated, transparent);
    }

    &:active:not(:disabled) {
      transform: scale(0.97);
    }

    &[data-active="true"] {
      border-color: var(--aq-accent-link, var(--aq-accent));
      background: transparent;
      color: var(--aq-text);

      svg {
        color: var(--aq-accent-link, var(--aq-accent));
      }
    }

    :disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }
  }

  .shareButton {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    min-height: 40px;
    padding: 0 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--aq-border);
    background: transparent;
    color: var(--aq-text);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      background-color 0.18s ease,
      color 0.18s ease,
      transform 0.12s ease;

    svg {
      font-size: 1rem;
    }

    &:hover:not(:disabled) {
      border-color: var(--aq-border-strong, var(--aq-text));
      background: var(--aq-surface-elevated, transparent);
    }

    &:active:not(:disabled) {
      transform: scale(0.97);
    }
  }

  .dot {
    width: 0.22rem;
    height: 0.22rem;
    border-radius: 50%;
    background: var(--aq-subtle);
  }

  .statChip {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    min-height: auto;
    padding: 0;
    border-radius: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1;
  }

  .thumbnail {
    overflow: hidden;
    position: relative;
    margin-top: 2rem;
    border-radius: 6px;
    width: 100%;
    border: 1px solid var(--aq-border);
    background-color: var(--aq-surface);
    padding-bottom: 52%;
  }

  @media (max-width: 820px) {
    .title {
      font-size: clamp(38px, 11vw, 43px);
      line-height: 1.08;
    }

    .deck {
      font-size: 1rem;
    }

    .metaRow {
      margin-top: 1.15rem;
      align-items: flex-start;
      flex-direction: column;
    }

    .metaUtilities {
      justify-content: flex-start;
      margin-left: 0;
    }

    .shareFeedbackPill,
    .likeButton,
    .shareButton {
      min-height: ${control.lg}px;
    }

    .actions[data-hide-mobile="true"] {
      display: none;
    }

    .likeButton[data-hide-mobile="true"],
    .shareButton[data-hide-mobile="true"],
    .shareFeedbackPill[data-hide-mobile="true"] {
      display: none;
    }
  }

  @media (min-width: 821px) {
    .likeButton[data-hide-desktop="true"],
    .shareButton[data-hide-desktop="true"],
    .shareFeedbackPill[data-hide-desktop="true"] {
      display: none;
    }
  }
`;
