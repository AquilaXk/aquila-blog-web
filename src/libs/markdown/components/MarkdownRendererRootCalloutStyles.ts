import { css, type Theme } from "@emotion/react"
import { articleTypographyScale } from "src/libs/markdown/contentTypography"

export const markdownRendererRootCalloutStyles = (theme: Theme) => css`
  .aq-callout.aq-admonition {
    --ad-accent: ${theme.publicDesign.accent};
    --ad-body-bg: ${theme.publicDesign.readableSurface};
    --ad-border: ${theme.colors.gray6};
    --ad-text: ${theme.colors.gray12};
    position: relative;
    border: 1px solid var(--ad-border);
    border-left: 3px solid var(--ad-accent);
    border-radius: 0;
    overflow: visible;
    padding: 16px 20px;
    margin: 24px 0;
    background: var(--ad-body-bg);
    color: var(--ad-text);
  }

  .aq-callout.aq-admonition:not(details) {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    column-gap: 12px;
    row-gap: 0;
    align-items: start;
  }

  details.aq-callout.aq-admonition {
    display: block;
    padding: 0;
  }

  .aq-callout.aq-admonition > * {
    position: relative;
    z-index: 2;
  }

  .aq-callout.aq-admonition .aq-callout-box-text {
    min-width: 0;
    margin-left: 0;
    padding: 0;
    color: var(--ad-text);

    > :first-child {
      margin-top: 0;
    }

    > :last-child {
      margin-bottom: 0;
    }

    .aq-callout-head + * {
      margin-top: 0;
    }

    ul,
    ol {
      margin: 8px 0 0;
      padding-left: 1.25rem;
    }

    li + li {
      margin-top: 4px;
    }
  }

  details.aq-callout.aq-admonition > .aq-callout-box-text {
    padding: 0 20px 16px 50px;
    margin-top: -2px;
  }

  .aq-callout.aq-admonition .aq-callout-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
    margin: 0 0 6px;
    padding: 0;
    background: transparent;
    border-bottom: 0;
  }

  .aq-callout.aq-admonition .aq-callout-emoji {
    width: 18px;
    height: 22px;
    margin-top: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ad-accent);
    line-height: 1;
  }

  .aq-callout.aq-admonition[data-has-title="false"] > .aq-callout-emoji {
    height: 26px;
  }

  .aq-callout.aq-admonition .aq-callout-emoji > svg {
    width: 18px;
    height: 18px;
    display: block;
    flex-shrink: 0;
  }

  .aq-callout.aq-admonition .aq-callout-title {
    color: color-mix(in srgb, var(--ad-accent) 72%, ${theme.colors.gray12});
    font-size: ${articleTypographyScale.calloutTitleFontSize};
    font-weight: 700;
    line-height: ${articleTypographyScale.calloutTitleLineHeight};
    letter-spacing: -0.01em;
  }

  .aq-callout.aq-admonition .aq-page-icon-inline {
    display: none;
  }

  .aq-callout.aq-admonition .aq-markdown-text {
    color: ${theme.colors.gray11};
    font-size: ${articleTypographyScale.bodyFontSize};
    line-height: ${articleTypographyScale.bodyLineHeight};
  }

  .aq-callout.aq-admonition-tip {
    --ad-accent: ${theme.colors.green10};
  }

  .aq-callout.aq-admonition-info {
    --ad-accent: ${theme.publicDesign.accent};
  }

  .aq-callout.aq-admonition-warning {
    --ad-accent: ${theme.colors.orange10};
  }

  .aq-callout.aq-admonition-outline {
    --ad-accent: ${theme.colors.gray11};
    --ad-body-bg: ${theme.publicDesign.surfaceElevated};
  }

  .aq-callout.aq-admonition-example {
    --ad-accent: ${theme.colors.indigo10};
  }

  .aq-callout.aq-admonition-summary {
    --ad-accent: ${theme.colors.gray12};
    --ad-body-bg: ${theme.publicDesign.surfaceElevated};
    --ad-border: ${theme.colors.gray6};
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 12px 20px;
    cursor: pointer;
    list-style: none;
    user-select: none;
    margin-bottom: 0;
  }

  .aq-callout-fold > summary:focus-visible,
  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head .aq-callout-emoji {
    margin-top: 0;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head::-webkit-details-marker {
    display: none;
  }

  .aq-callout.aq-admonition .aq-callout-fold-chevron {
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-right: 1.75px solid ${theme.colors.gray10};
    border-bottom: 1.75px solid ${theme.colors.gray10};
    transform: rotate(-45deg);
    transition: transform 0.16s ease;
    opacity: 0.78;
    flex-shrink: 0;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"][open] .aq-callout-fold-chevron {
    transform: rotate(45deg);
  }

  @media (max-width: 820px) {
    .aq-callout.aq-admonition {
      padding: 14px 16px;
      margin: 20px 0;
    }

    details.aq-callout.aq-admonition {
      padding: 0;
    }

    .aq-callout.aq-admonition:not(details) {
      grid-template-columns: 18px minmax(0, 1fr);
      column-gap: 10px;
    }

    .aq-callout.aq-admonition .aq-callout-title {
      font-size: ${articleTypographyScale.calloutTitleFontSizeMobile};
      line-height: ${articleTypographyScale.calloutTitleLineHeightMobile};
    }

    .aq-callout.aq-admonition .aq-markdown-text {
      font-size: ${articleTypographyScale.bodyFontSizeMobile};
      line-height: ${articleTypographyScale.bodyLineHeightMobile};
    }

    .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head {
      gap: 10px;
      min-height: 44px;
      padding: 11px 16px;
    }

    details.aq-callout.aq-admonition > .aq-callout-box-text {
      padding: 0 16px 14px 44px;
      margin-top: -2px;
    }

    .aq-callout.aq-admonition .aq-callout-emoji {
      width: 18px;
      height: 22px;
      line-height: 1;
    }

    .aq-callout.aq-admonition[data-has-title="false"] > .aq-callout-emoji {
      height: 25px;
    }
  }
`
