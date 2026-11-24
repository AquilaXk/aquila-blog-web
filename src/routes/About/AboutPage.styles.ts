/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/AuthorLayout.tsx, components/Card.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { breakpoint, control } from "src/design-system/tokens"

export const StyledWrapper = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 0 4.5rem;
  color: var(--aq-text);

  .about-content {
    min-width: 0;
  }

  .authorHeader {
    padding: 1.5rem 0 2rem;
    border-bottom: 1px solid var(--aq-border);

    h1 {
      margin: 0;
      color: var(--aq-text);
      font-size: 1.875rem;
      line-height: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      text-wrap: balance;

      @media (min-width: ${breakpoint.sm}px) {
        font-size: 2.25rem;
        line-height: 2.5rem;
      }

      @media (min-width: ${breakpoint.md}px) {
        font-size: 3.75rem;
        line-height: 1.1;
      }
    }
  }

  .authorGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;

    @media (min-width: ${breakpoint.lg}px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      column-gap: 2rem;
    }
  }

  .authorProfileCol {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 0 1rem;
  }

  .authorAvatar {
    position: relative;
    width: 12rem;
    height: 12rem;
    border-radius: 9999px;
    overflow: hidden;
    background: var(--aq-surface-subtle);
    box-shadow: inset 0 0 0 1px var(--aq-border);

    img {
      object-fit: cover;
      object-position: center 35%;
    }
  }

  .authorName {
    margin: 0;
    padding: 1rem 0 0.5rem;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--aq-text);
  }

  .authorRole,
  .authorCompany {
    color: var(--aq-muted);
    font-size: 1rem;
    line-height: 1.5rem;
  }

  .authorSocialRow {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
    padding-top: 1.5rem;
  }

  .authorSocialLink {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    border: 1px solid transparent;
    border-radius: 9999px;
    color: var(--aq-muted);
    text-decoration: none;
    transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;

    &:hover {
      color: var(--aq-accent-link, var(--aq-accent));
      border-color: var(--aq-border);
      background: var(--aq-surface-subtle);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  .authorContentCol {
    padding: 2rem 0;
    min-width: 0;
    display: grid;
    gap: 2.5rem;
    align-content: start;
  }

  .authorProse {
    h2 {
      margin: 0 0 0.75rem;
      font-size: 1.5rem;
      line-height: 1.35;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--aq-text);
      word-break: keep-all;
      text-wrap: balance;
    }

    p {
      margin: 0;
      max-width: 65ch;
      color: var(--aq-text-secondary, var(--aq-muted));
      font-size: 1.0625rem;
      line-height: 1.75;
      white-space: pre-line;
      overflow-wrap: anywhere;
      word-break: keep-all;
      text-wrap: pretty;
    }
  }

  .sectionBlock {
    padding-top: 1.75rem;
    border-top: 1px solid var(--aq-border);

    > h2 {
      margin: 0 0 1.25rem;
      font-size: 1.375rem;
      line-height: 1.3;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--aq-text);
    }
  }

  .projectCardGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;

    @media (min-width: ${breakpoint.md}px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .projectCard {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1.5rem;
    border-radius: 0.375rem;
    border: 2px solid var(--aq-border);
    background: var(--aq-surface);
    transition: border-color 160ms ease, background-color 160ms ease;

    @media (hover: hover) {
      &:hover {
        border-color: var(--aq-border-strong, var(--aq-accent));
        background: var(--aq-surface-subtle);
      }
    }

    .projectCardBody {
      min-width: 0;
    }

    .projectCardRole {
      display: inline-block;
      margin-bottom: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--aq-muted);
    }

    h3 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--aq-text);

      a {
        color: inherit;
        text-decoration: none;

        &:hover {
          color: var(--aq-accent-link, var(--aq-accent));
        }
      }
    }

    p {
      margin: 0 0 0.875rem;
      color: var(--aq-muted);
      font-size: 0.9375rem;
      line-height: 1.625;
      overflow-wrap: anywhere;
      word-break: keep-all;
    }

    .projectCardMore {
      display: inline-flex;
      align-items: center;
      min-height: 36px;
      color: var(--aq-accent-link, var(--aq-accent));
      font-size: 0.9375rem;
      line-height: 1.5rem;
      font-weight: 500;
      text-decoration: none;

      &:hover {
        color: var(--aq-text);
      }

      @media (pointer: coarse) {
        min-height: ${control.lg}px;
        min-width: ${control.lg}px;
      }
    }
  }

  .proseList {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0;
  }

  .proseListItem {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--aq-border);
    font-size: 1rem;
    line-height: 1.65;
    color: var(--aq-text-secondary, var(--aq-text));

    &:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    &:first-child {
      padding-top: 0;
    }
  }

  .proseListMeta {
    color: var(--aq-muted);
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`
