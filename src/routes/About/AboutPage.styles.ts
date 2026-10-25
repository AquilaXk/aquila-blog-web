import styled from "@emotion/styled"

export const StyledWrapper = styled.div`
  padding: 70px 0 100px;

  .about-content {
    display: block;
  }

  .page-head {
    display: block;
    padding-bottom: 34px;
    border-bottom: 2px solid var(--aq-text);
  }

  .mono-label {
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.6875rem;
    line-height: 1;
    font-weight: 780;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .page-head h1 {
    margin: 13px 0 0;
    max-width: 920px;
    color: var(--aq-text);
    font-size: clamp(2.15rem, 4.2vw, 3.1rem);
    line-height: 1.12;
    letter-spacing: -0.035em;
    font-weight: 600;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .profile-image {
    position: relative;
    width: 72px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    overflow: hidden;
  }

  .profile-image img {
    object-fit: cover;
  }

  .profile-inline {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
    margin-bottom: 0;
  }

  .profile-copy {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .profile-copy strong {
    color: var(--aq-text);
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 700;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .profile-copy span {
    margin: 0;
    color: var(--aq-muted);
    font-size: 0.875rem;
    line-height: 1.5;
    font-weight: 600;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .profile-copy p {
    margin: 8px 0 0;
    color: var(--aq-muted);
    font-size: 1rem;
    line-height: 1.75;
    word-break: keep-all;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .about-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 60px;
    padding-top: 48px;
  }

  .about-grid section {
    min-width: 0;
  }

  section[data-has-divider="true"] {
    padding-top: 24px;
    border-top: 1px solid var(--aq-border);
  }

  .about-grid h2 {
    margin: 0 0 16px;
    color: var(--aq-text);
    font-size: 1.65rem;
    line-height: 1.25;
    letter-spacing: -0.025em;
    font-weight: 650;
  }

  .stack-list {
    border-top: 1px solid var(--aq-text);
  }

  .stack-row {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    align-items: center;
    gap: 20px;
    padding: 14px 0;
    border-bottom: 1px solid var(--aq-border);
    transition: border-color 180ms cubic-bezier(0.215, 0.61, 0.355, 1);

    &:hover {
      border-bottom-color: var(--aq-border-strong, var(--aq-text));
    }
  }

  .stack-row strong {
    min-width: 0;
    color: var(--aq-subtle);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.6875rem;
    line-height: 1.5;
    font-weight: 700;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .stack-row span,
  .stack-row a {
    min-width: 0;
    color: var(--aq-muted);
    font-size: 0.9375rem;
    line-height: 1.55;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .stack-row a {
    text-decoration: none;
    transition: color 180ms cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  .stack-row a:hover {
    color: var(--aq-text);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .stack-row,
    .stack-row a {
      transition: none;
    }
  }

  @media (max-width: 1024px) {
    .about-grid {
      gap: 32px;
    }

    .stack-row {
      grid-template-columns: 112px minmax(0, 1fr);
    }
  }

  @media (max-width: 820px), (pointer: coarse) {
    .stack-row a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
  }

  @media (max-width: 820px) {
    padding: 44px 0 70px;

    .page-head h1 {
      font-size: clamp(1.85rem, 6vw, 2.35rem);
    }

    .about-grid {
      grid-template-columns: 1fr;
      gap: 34px;
    }

    .stack-row {
      grid-template-columns: minmax(76px, 104px) minmax(0, 1fr);
      gap: 12px;
    }

    .profile-inline {
      grid-template-columns: 64px minmax(0, 1fr);
    }

    .profile-image {
      width: 64px;
    }
  }
`
