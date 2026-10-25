import { css, type Theme } from "@emotion/react"
import {
  TABLE_MIN_COLUMN_WIDTH_PX,
  TABLE_MIN_ROW_HEIGHT_PX,
} from "src/libs/markdown/tableMetadata"
import {
  getTableChromePalette,
} from "src/libs/markdown/tableChrome"

export const markdownRendererRootTableToggleStyles = (theme: Theme) => css`
  .aq-toggle {
    margin: 28px 0;
    border: 1px solid ${theme.colors.gray6};
    border-radius: 0;
    background: ${theme.publicDesign.readableSurface};
  }

  .aq-toggle > summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    list-style: none;
    padding: 15px 17px;
    color: ${theme.colors.gray12};
    font-weight: 780;
    line-height: 1.4;
  }

  .aq-toggle > summary:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .aq-toggle__title {
    display: block;
    min-width: 0;
  }

  .aq-toggle > summary::-webkit-details-marker {
    display: none;
  }

  .aq-toggle__caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    border: 1px solid ${theme.publicDesign.borderStrong};
    color: ${theme.colors.gray10};
    font: 700 13px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
  }

  .aq-toggle__caret::before {
    content: "+";
  }

  .aq-toggle[open] .aq-toggle__caret::before {
    content: "−";
  }

  .aq-toggle__body {
    padding: 0 17px 17px 47px;
    color: ${theme.colors.gray11};
  }

  .aq-toggle[open] > .aq-toggle__body:first-of-type {
    margin-top: 0;
  }

  .aq-toggle__body p,
  .aq-toggle__body li {
    line-height: 1.7;
  }

  .aq-toggle__body p:last-child {
    margin-bottom: 0;
  }

  .aq-table-shell {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 30px 0;
    overflow-x: hidden;
    contain: layout style;
  }

  .aq-table-shell[data-scroll-left="true"]::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 0;
    border-left: 2px solid ${theme.publicDesign.borderStrong};
    pointer-events: none;
    z-index: 2;
  }

  .aq-table-shell[data-scroll-hint="true"]::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 0;
    border-right: 2px solid ${theme.publicDesign.borderStrong};
    pointer-events: none;
    z-index: 2;
  }

  .aq-table-scroll {
    ${(() => {
      const tableChrome = getTableChromePalette(theme)
      return `
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid ${tableChrome.border};
    border-radius: 0;
    background: ${tableChrome.background};
    box-shadow: none;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: auto;
    touch-action: pan-x pan-y;
      `
    })()}
  }

  .aq-table-shell[data-table-width-mode="explicit-normal"],
  .aq-table-scroll[data-table-width-mode="explicit-normal"] {
    width: fit-content;
    max-width: 100%;
    min-width: 0;
  }

  table,
  .aq-table {
    width: 100%;
    min-width: 680px;
    max-width: none;
    border-collapse: collapse;
    border-spacing: 0;
    table-layout: auto;
    margin: 0;
    border: 0;
    background: transparent;
    font-size: 14px;
  }

  table[data-overflow-mode="wide"],
  .aq-table.aq-table-wide {
    width: max-content;
    min-width: 680px;
    max-width: none;
  }

  thead th,
  .aq-table thead th {
    ${(() => {
      const tableChrome = getTableChromePalette(theme)
      return `
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: left;
    background: ${tableChrome.headerBackground};
    color: ${theme.colors.gray10};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.4;
    text-transform: uppercase;
    padding-top: 13px;
    padding-bottom: 13px;
    border-bottom: 1px solid ${tableChrome.headerRule};
      `
    })()}
  }

  @media (min-width: 769px) {
    thead th,
    .aq-table thead th {
      line-height: 1.4;
      padding-top: 13px;
      padding-bottom: 13px;
    }
  }

  th,
  td,
  .aq-table th,
  .aq-table td {
    padding: 13px 15px;
    border-right: 1px solid ${ theme.colors.gray6};
    border-bottom: 1px solid ${ theme.colors.gray6};
    vertical-align: top;
    min-width: max(${TABLE_MIN_COLUMN_WIDTH_PX}px, 10ch);
    min-height: ${TABLE_MIN_ROW_HEIGHT_PX}px;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
    font-variant-numeric: tabular-nums;
  }

  th > *,
  td > *,
  .aq-table th > *,
  .aq-table td > * {
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
  }

  tr td:last-child,
  tr th:last-child,
  .aq-table tr td:last-child,
  .aq-table tr th:last-child {
    border-right: 0;
  }

  tbody tr:last-child td,
  .aq-table tbody tr:last-child td,
  .aq-table tbody tr:last-child th {
    border-bottom: 0;
  }

  @media (max-width: 1024px) {
    table[data-narrow-table="true"],
    .aq-table[data-narrow-table="true"] {
      min-width: 100%;
    }
  }

  @media (max-width: 820px) {
    .aq-toggle > summary {
      padding: 14px;
    }

    .aq-toggle__body {
      padding: 0 14px 14px 44px;
    }

    .aq-table-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table,
    .aq-table {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
      table-layout: fixed;
    }

    table[data-overflow-mode="wide"],
    .aq-table.aq-table-wide {
      width: max-content;
      min-width: 100%;
      max-width: none;
    }

    table th,
    table td,
    .aq-table th,
    .aq-table td {
      white-space: normal;
      overflow-wrap: break-word;
      word-break: normal;
      font-size: 0.95rem;
      line-height: 1.58;
      padding: 0.66rem 0.72rem;
      min-width: max(${TABLE_MIN_COLUMN_WIDTH_PX}px, 10ch);
    }
  }

`
