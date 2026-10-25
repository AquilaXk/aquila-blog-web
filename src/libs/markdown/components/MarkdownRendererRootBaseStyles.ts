import { css, type Theme } from "@emotion/react"

export const markdownRendererRootBaseStyles = (theme: Theme) => css`
  h1,
  h2,
  h3,
  h4 {
    scroll-margin-top: 6.8rem;
  }

  figure {
    margin: 1.25rem 0;
  }

  .aq-image-frame {
    width: 100%;
    margin: 30px 0;
    position: relative;
    min-width: 0;
    border: 1px solid ${ theme.colors.gray6};
    background: ${ theme.publicDesign.readableSurface};
  }

  .aq-image-frame[data-width-mode="custom"] {
    width: min(100%, var(--aq-image-width));
  }

  .aq-image-frame img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: min(76vh, 880px);
    object-fit: contain;
    border-radius: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  &:not([data-editable="true"]) .aq-image-frame:not([data-editable="true"]) img,
  .aq-markdown:not([data-editable="true"]) .aq-image-frame img {
    cursor: zoom-in;
  }

  .aq-image-frame[data-editable="true"] .aq-image-resize-handle {
    position: absolute;
    right: 0.85rem;
    bottom: 0.85rem;
    width: 2rem;
    height: 2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: var(--aq-surface-elevated);
    border: 1px solid var(--aq-border-strong);
    color: var(--aq-text);
    cursor: ew-resize;

    @media (max-width: 820px), (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
    }
  }

  .aq-image-frame[data-editable="true"] .aq-image-resize-handle span {
    display: inline-block;
    width: 0.95rem;
    height: 0.95rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(0deg);
    opacity: 0.92;
  }

  .aq-image-frame[data-editable="true"] .aq-image-resize-handle:hover {
    color: ${ theme.publicDesign.accent};
  }

  .aq-image-frame figcaption {
    margin-top: 0;
    padding: 12px 15px;
    border-top: 1px solid ${ theme.colors.gray6};
    color: ${ theme.colors.gray11};
    font-size: 12px;
    line-height: 1.5;
    text-align: left;
  }

  ul.contains-task-list,
  ol.contains-task-list {
    list-style: none;
    padding-left: 0.2rem;
  }

  li.task-list-item {
    list-style: none;
    display: flex;
    align-items: flex-start;
    gap: 0.52rem;
  }

  li.task-list-item input[type="checkbox"] {
    margin: 0.34rem 0 0;
    width: 0.95rem;
    height: 0.95rem;
    accent-color: ${theme.publicDesign.accent};
  }

  .aq-footnote-reference {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    font-size: 0.78em;
    line-height: 1;
    margin: 0 0.1em;
  }

  .aq-footnote-reference > a[data-footnote-ref] {
    color: ${theme.publicDesign.accent};
    text-decoration: none;
    font-weight: 650;
    padding: 0.08rem 0.24rem;
    border-radius: 3px;
    transition: background-color 0.15s ease;
  }

  .aq-footnote-reference > a[data-footnote-ref]:hover,
  .aq-footnote-reference > a[data-footnote-ref]:focus-visible {
    background: color-mix(in srgb, ${theme.publicDesign.accent} 12%, transparent);
  }

  .aq-footnote-popover {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translateX(-50%) translateY(4px);
    min-width: 160px;
    max-width: min(280px, calc(100vw - 32px));
    padding: 8px 11px;
    border: 1px solid ${theme.colors.gray6};
    background: ${theme.publicDesign.surfaceElevated};
    color: ${theme.colors.gray12};
    font-size: 12.5px;
    font-weight: 450;
    line-height: 1.5;
    white-space: normal;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
    z-index: 25;
  }

  .aq-footnote-reference:hover .aq-footnote-popover,
  .aq-footnote-reference:focus-within .aq-footnote-popover {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  .aq-footnotes {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid ${theme.colors.gray5};
    color: ${theme.colors.gray11};
    font-size: 0.92rem;
    line-height: 1.65;
  }

  .aq-footnotes > h2 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: ${theme.colors.gray12};
  }

  .aq-footnotes > ol {
    margin: 0;
    padding-left: 1.35rem;
  }

  .aq-footnotes > ol > li {
    margin-bottom: 0.5rem;
  }

  .aq-footnotes > ol > li > p {
    display: inline;
    margin: 0;
    font-size: inherit;
    line-height: inherit;
  }

  .aq-footnotes > ol > li > p + p {
    display: block;
    margin-top: 0.35rem;
  }

  .aq-footnotes a[data-footnote-backref] {
    margin-left: 0.35rem;
    color: ${theme.publicDesign.accent};
    text-decoration: none;
  }

  @media (pointer: coarse) {
    a[data-footnote-ref] {
      position: relative;
      min-width: 28px;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &::after {
        content: "";
        position: absolute;
        inset: -10px;
      }
    }

    a[data-footnote-backref] {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
`
