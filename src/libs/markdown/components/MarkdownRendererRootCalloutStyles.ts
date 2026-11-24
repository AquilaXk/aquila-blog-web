/**
 * 참조 구현:
 * - fuma-nama/fumadocs (packages/base-ui/src/components/callout.tsx, MIT License)
 */
import { css, type Theme } from "@emotion/react"
import { boxShadowColor } from "src/design-system/tokens"
import { articleTypographyScale } from "src/libs/markdown/contentTypography"

export const markdownRendererRootCalloutStyles = (theme: Theme) => css`
  .aq-callout.aq-admonition {
    --ad-accent: ${theme.publicDesign.accent};
    --ad-body-bg: color-mix(in srgb, var(--ad-accent) 4%, ${theme.publicDesign.readableSurface});
    --ad-border: color-mix(in srgb, var(--ad-accent) 22%, ${theme.colors.gray6});
    --ad-text: ${theme.colors.gray12};
    position: relative;
    border: 1px solid var(--ad-border);
    border-radius: 0.75rem;
    overflow: hidden;
    padding: 0.9rem 1rem 0.9rem 0.55rem;
    margin: 1.35rem 0;
    background: var(--ad-body-bg);
    color: var(--ad-text);
    box-shadow: 0 1px 2px 0 ${boxShadowColor.cardSubtle};
    font-size: 0.875rem;
  }

  .aq-callout.aq-admonition:not(details) {
    display: flex;
    gap: 0.65rem;
    align-items: stretch;
  }

  details.aq-callout.aq-admonition {
    display: block;
    padding: 0.25rem 0;
  }

  .aq-callout.aq-admonition .aq-callout-rail {
    width: 2px;
    flex: 0 0 2px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--ad-accent) 72%, transparent);
    align-self: stretch;
  }

  .aq-callout.aq-admonition > * {
    position: relative;
    z-index: 2;
  }

  .aq-callout.aq-admonition .aq-callout-box-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1 1 0%;
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
      margin: 0.25rem 0 0;
      padding-left: 1.25rem;
    }

    li + li {
      margin-top: 4px;
    }
  }

  details.aq-callout.aq-admonition > .aq-callout-box-text {
    padding: 0 0.875rem 0.75rem 2.375rem;
  }

  .aq-callout.aq-admonition .aq-callout-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 20px;
    margin: 0;
    padding: 0;
    background: transparent;
    border-bottom: 0;
  }

  .aq-callout.aq-admonition .aq-callout-emoji {
    width: 20px;
    height: 20px;
    margin-top: 1px;
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

  .aq-callout.aq-admonition .aq-callout-emoji > svg {
    width: 20px;
    height: 20px;
    display: block;
    flex-shrink: 0;
  }

  .aq-callout.aq-admonition .aq-callout-title {
    color: ${theme.colors.gray12};
    font-size: ${articleTypographyScale.calloutTitleFontSize};
    font-weight: 600;
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

  .aq-callout.aq-admonition-danger {
    --ad-accent: ${theme.colors.red10};
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
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.5rem 0.875rem 0.5rem 0.25rem;
    cursor: pointer;
    list-style: none;
    user-select: none;
    margin-bottom: 0;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: -2px;
    border-radius: 0.5rem;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head .aq-callout-emoji {
    margin-top: 0;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"] > summary.aq-callout-head::-webkit-details-marker {
    display: none;
  }

  .aq-callout.aq-admonition .aq-callout-fold-chevron {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${theme.colors.gray10};
    transform: rotate(-90deg);
    transition: transform 0.16s ease;
    opacity: 0.8;
    flex-shrink: 0;
  }

  .aq-callout.aq-admonition[data-callout-foldable="true"][open] .aq-callout-fold-chevron {
    transform: rotate(0deg);
  }

  @media (max-width: 820px) {
    .aq-callout.aq-admonition {
      margin: 1.25rem 0;
    }

    .aq-callout.aq-admonition .aq-callout-title {
      font-size: ${articleTypographyScale.calloutTitleFontSizeMobile};
      line-height: ${articleTypographyScale.calloutTitleLineHeightMobile};
    }

    .aq-callout.aq-admonition .aq-markdown-text {
      font-size: ${articleTypographyScale.bodyFontSizeMobile};
      line-height: ${articleTypographyScale.bodyLineHeightMobile};
    }
  }
`
