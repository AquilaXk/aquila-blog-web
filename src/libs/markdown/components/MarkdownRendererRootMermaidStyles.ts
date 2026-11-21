import { css, type Theme } from "@emotion/react"

export const markdownRendererRootMermaidStyles = (theme: Theme) => css`
  .aq-mermaid {
    position: relative;
    margin: 30px 0;
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    white-space: normal;
    padding: 0;
    border: 1px solid ${theme.colors.gray6};
    border-radius: 0.75rem;
    background: ${theme.publicDesign.readableSurface};
    box-shadow: none;
    scrollbar-width: thin;
    contain: layout style;
  }

  .aq-mermaid[data-mermaid-wide="true"] {
    width: var(--aq-mermaid-wide-width, 100%);
    max-width: none;
    margin-left: calc(var(--aq-mermaid-bleed-left, 0px) * -1);
    margin-right: calc(var(--aq-mermaid-bleed-right, 0px) * -1);
    overflow: visible;
  }

  .aq-mermaid[data-mermaid-rendered="pending"] {
    min-height: 8rem;
  }

  .aq-mermaid[data-mermaid-rendered="pending"] > code {
    visibility: hidden;
  }

  .aq-mermaid-stage {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    justify-content: center;
    align-items: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 36px 20px 20px;
    cursor: zoom-in;
  }

  .aq-mermaid[data-mermaid-wide="true"] .aq-mermaid-stage {
    max-width: none;
    overflow: visible;
  }

  .aq-mermaid-stage > svg {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    background: transparent;
    overflow: visible;
  }

  .aq-mermaid-stage > svg .edgeLabel rect {
    opacity: 0.94;
  }

  .aq-mermaid-stage > svg foreignObject,
  .aq-mermaid-stage > svg .nodeLabel,
  .aq-mermaid-stage > svg .edgeLabel {
    overflow: visible;
  }

  .aq-mermaid-stage > svg .nodeLabel p,
  .aq-mermaid-stage > svg .edgeLabel p,
  .aq-mermaid-stage > svg .nodeLabel div,
  .aq-mermaid-stage > svg .edgeLabel div,
  .aq-mermaid-stage > svg .nodeLabel span,
  .aq-mermaid-stage > svg .edgeLabel span {
    margin: 0;
    line-height: 1.18;
    display: inline-block;
    box-sizing: border-box;
    padding-top: 0.08em;
    padding-bottom: 0.18em;
  }

  .aq-mermaid-error-state {
    margin: 28px;
    border: 0;
    border-left: 2px solid ${theme.colors.statusDangerBorder};
    border-radius: 0 6px 6px 0;
    background: var(--aq-surface-subtle);
    color: var(--aq-text);
    padding: 0.88rem 0.94rem;
  }

  .aq-mermaid-error-badge {
    border-radius: 4px;
    border: 1px solid var(--aq-border-strong);
    background: var(--aq-surface-elevated);
    color: var(--aq-text-secondary);
  }

  .aq-mermaid-error-title {
    color: var(--aq-text);
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 0.36rem;
  }

  .aq-mermaid-error-summary,
  .aq-mermaid-error-description {
    margin: 0 0 0.38rem;
    color: var(--aq-text-secondary);
    font-size: 0.84rem;
    line-height: 1.52;
  }

  .aq-mermaid-error-guidance {
    margin: 0 0 0.52rem;
    color: var(--aq-text-secondary);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .aq-mermaid-error-guidance code {
    border-radius: 4px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface-elevated);
    padding: 0.08rem 0.34rem;
    font-size: 0.74rem;
    color: var(--aq-text);
  }

  .aq-mermaid-error-details {
    margin-top: 0.34rem;
    color: var(--aq-text-secondary);
  }

  .aq-mermaid-error-details > summary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--aq-text-secondary);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }

  .aq-mermaid-error-details > summary:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .aq-mermaid-error-details > summary::-webkit-details-marker {
    display: none;
  }

  .aq-mermaid-error-code {
    display: block;
    white-space: pre-wrap;
    color: var(--aq-text);
    font-size: 0.78rem;
    line-height: 1.5;
    border: 0;
    border-top: 1px solid var(--aq-border);
    border-radius: 0;
    background: transparent;
    margin-top: 0.34rem;
    padding: 0.48rem 0.58rem;
  }

  .aq-mermaid-controls {
    position: absolute;
    top: 9px;
    right: 9px;
    z-index: 2;
    display: none;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: 6px;
    border: 1px solid ${theme.colors.gray6};
    background: color-mix(in srgb, ${theme.publicDesign.readableSurface} 96%, transparent);
    opacity: 0.88;
    transition: opacity 0.16s ease, border-color 0.16s ease;
  }

  .aq-mermaid[data-mermaid-expandable="true"] .aq-mermaid-controls {
    display: inline-flex;
  }

  .aq-mermaid:focus-within .aq-mermaid-controls {
    opacity: 1;
    border-color: var(--aq-border-strong);
  }

  .aq-mermaid-ctrl-sep {
    width: 1px;
    height: 14px;
    background: ${theme.colors.gray6};
    flex-shrink: 0;
  }

  .aq-mermaid-ctrl-btn,
  .aq-mermaid-expand-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${theme.colors.gray11};
    line-height: 1;
    cursor: pointer;
    transition: color 0.14s ease, background-color 0.14s ease;

    svg {
      width: 14px;
      height: 14px;
      display: block;
      pointer-events: none;
    }
  }

  .aq-mermaid-ctrl-btn[data-copied="true"] {
    color: var(--aq-accent-link);
    background: var(--aq-accent-muted);
  }

  .aq-mermaid-ctrl-btn:focus-visible,
  .aq-mermaid-expand-btn:focus-visible {
    color: ${theme.colors.gray12};
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 1px;
  }

  @media (hover: hover) {
    .aq-mermaid:hover .aq-mermaid-controls {
      opacity: 1;
      border-color: var(--aq-border-strong);
    }

    .aq-mermaid-ctrl-btn:hover,
    .aq-mermaid-expand-btn:hover {
      color: ${theme.colors.gray12};
      background: var(--aq-surface-subtle);
    }
  }

  @media (max-width: 820px) {
    .aq-mermaid[data-mermaid-wide="true"] {
      width: 100%;
      max-width: 100%;
      margin-left: 0;
      margin-right: 0;
      overflow-x: auto;
    }

    .aq-mermaid-stage {
      padding: 48px 10px 14px;
    }

    .aq-mermaid-controls {
      top: 8px;
      right: 8px;
    }
  }

  @media (max-width: 820px), (pointer: coarse) {
    .aq-mermaid-controls {
      opacity: 1;
      pointer-events: auto;
    }

    .aq-mermaid-ctrl-btn,
    .aq-mermaid-expand-btn {
      width: 44px;
      height: 44px;
      min-height: 44px;
      min-width: 44px;
      padding: 0;
    }
  }
`
