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
    border: 1px solid ${theme.colors.gray5};
    border-radius: 6px;
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
    padding: 42px 20px 22px;
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
    border-radius: 0;
    border: 1px solid ${ (theme.scheme === "dark" ? "rgba(217, 119, 6, 0.46)" : "rgba(217, 119, 6, 0.42)")};
    background: ${ (theme.scheme === "dark" ? "rgba(120, 53, 15, 0.16)" : "rgba(254, 243, 199, 0.88)")};
    padding: 0.88rem 0.94rem;
  }

  .aq-mermaid-error-title {
    color: ${ (theme.scheme === "dark" ? "#fde68a" : "#92400e")};
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 0.36rem;
  }

  .aq-mermaid-error-description {
    margin: 0 0 0.38rem;
    color: ${ (theme.scheme === "dark" ? "rgba(254, 240, 138, 0.92)" : "#7c2d12")};
    font-size: 0.84rem;
    line-height: 1.52;
  }

  .aq-mermaid-error-guidance {
    margin: 0 0 0.52rem;
    color: ${ (theme.scheme === "dark" ? "rgba(254, 240, 138, 0.86)" : "#9a3412")};
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .aq-mermaid-error-guidance code {
    border-radius: 0;
    border: 1px solid ${ (theme.scheme === "dark" ? "rgba(251, 191, 36, 0.3)" : "rgba(217, 119, 6, 0.32)")};
    background: ${ (theme.scheme === "dark" ? "rgba(120, 53, 15, 0.24)" : "rgba(255, 251, 235, 0.92)")};
    padding: 0.08rem 0.34rem;
    font-size: 0.74rem;
    color: ${ (theme.scheme === "dark" ? "#fde68a" : "#92400e")};
  }

  .aq-mermaid-error-details {
    margin-top: 0.34rem;
  }

  .aq-mermaid-error-details > summary {
    color: ${ (theme.scheme === "dark" ? "rgba(253, 230, 138, 0.94)" : "#b45309")};
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }

  .aq-mermaid-error-details > summary::-webkit-details-marker {
    display: none;
  }

  .aq-mermaid-error-code {
    display: block;
    white-space: pre-wrap;
    color: ${ (theme.scheme === "dark" ? "#fef3c7" : "#7c2d12")};
    font-size: 0.78rem;
    line-height: 1.5;
    border-radius: 0;
    border: 1px solid ${ (theme.scheme === "dark" ? "rgba(251, 191, 36, 0.22)" : "rgba(217, 119, 6, 0.24)")};
    background: ${ (theme.scheme === "dark" ? "rgba(120, 53, 15, 0.18)" : "rgba(255, 251, 235, 0.82)")};
    margin-top: 0.34rem;
    padding: 0.48rem 0.58rem;
  }

  .aq-mermaid-expand-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    width: fit-content;
    margin: 0;
    height: 26px;
    min-height: 26px;
    border-radius: 4px;
    border: 1px solid ${theme.colors.gray6};
    background: color-mix(in srgb, ${theme.publicDesign.readableSurface} 94%, transparent);
    backdrop-filter: blur(4px);
    color: ${theme.colors.gray11};
    padding: 0 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.01em;
    white-space: nowrap;
    cursor: pointer;
  }

  .aq-mermaid-expand-btn::after {
    content: "";
    position: absolute;
    inset: -9px -6px;
  }

  .aq-mermaid[data-mermaid-expandable="true"] .aq-mermaid-expand-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  @media (max-width: 820px) {
    .aq-mermaid-stage {
      padding: 38px 10px 14px;
    }

    .aq-mermaid-expand-btn {
      top: 7px;
      right: 7px;
    }
  }
`
