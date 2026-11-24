import { css, type Theme } from "@emotion/react"
import { articleTypographyScale } from "src/libs/markdown/contentTypography"

export const markdownRendererRootCodeStyles = (theme: Theme) => css`
  .aq-code {
    border-radius: 0.75rem;
    padding: 1.02rem 1.1rem;
    overflow-x: auto;
    background: #0f1728;
    border: 1px solid #27334a;
    box-shadow: none;
  }

  .aq-code-block {
    --aq-code-gutter-width: 1.34rem;
    --aq-code-gutter-gap: 0.54rem;
    margin: 28px 0;
    max-width: 100%;
    min-width: 0;
    border-radius: 0.75rem;
    overflow: hidden;
    border: 1px solid #27334a;
    box-shadow: none;
    contain: layout style;
  }

  .aq-code-block .aq-code {
    border-radius: 0;
    border: 0;
  }

  .aq-code-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 11px 14px;
    background: #0f1728;
    border-bottom: 1px solid #27334a;
    color: #7895c9;
    font: 600 11px / 1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Courier New", monospace;
  }

  .aq-code-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .aq-code-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .aq-code-lang {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.45rem;
    border: 1px solid #27334a;
    border-radius: 4px;
    background: #131d32;
    color: #a9c5ff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .aq-code-block[data-scrollable="false"] .aq-code-wrap:not([aria-pressed="true"]) {
    display: none;
  }

  .aq-code-wrap,
  .aq-code-copy {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: #8da6d6;
    font: inherit;
    cursor: pointer;
    transition: color 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
  }

  .aq-code-wrap:focus-visible,
  .aq-code-copy:focus-visible {
    color: #dbe7ff;
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  @media (hover: hover) {
    .aq-code-wrap:hover,
    .aq-code-copy:hover {
      color: #dbe7ff;
      border-color: #334463;
      background: rgba(148, 163, 184, 0.14);
    }
  }

  .aq-code-wrap[aria-pressed="true"] {
    color: #dbe7ff;
    border-color: #60a5fa;
    background: rgba(59, 130, 246, 0.22);
  }

  .aq-code-icon {
    width: 15px;
    height: 15px;
    display: block;
    pointer-events: none;
  }

  .aq-code-copy-icons {
    position: relative;
    width: 15px;
    height: 15px;
    display: inline-block;
    pointer-events: none;
  }

  .aq-code-copy-icon,
  .aq-code-copy-success-icon {
    position: absolute;
    inset: 0;
    width: 15px;
    height: 15px;
    transition: transform 0.16s ease, opacity 0.16s ease;
  }

  .aq-code-copy-success-icon {
    opacity: 0;
    transform: scale(0.33);
    color: #4ade80;
  }

  .aq-sr-only {
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

  .aq-code-copy.is-copied {
    color: #86efac;
    border-color: rgba(74, 222, 128, 0.36);
    background: rgba(34, 197, 94, 0.14);
  }

  .aq-code-copy.is-copied .aq-code-copy-icon {
    opacity: 0;
    transform: scale(0.33);
  }

  .aq-code-copy.is-copied .aq-code-copy-success-icon {
    opacity: 1;
    transform: scale(1);
  }

  .aq-code-copy.is-failed {
    color: var(--aq-danger-text, #b42318);
    border-color: var(--aq-danger-border, #fecdca);
  }

  .aq-code-body {
    position: relative;
  }

  .aq-code-block[data-collapsed="true"] .aq-code-body {
    max-height: 460px;
    overflow: hidden;
  }

  .aq-code-collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    padding: 9px 14px;
    border: 0;
    border-top: 1px solid #27334a;
    background: #131d32;
    color: #93b4eb;
    font: 600 12px / 1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Courier New", monospace;
    cursor: pointer;
    transition: background-color 0.16s ease, color 0.16s ease;
  }

  .aq-code-collapse-toggle:hover {
    background: #192642;
    color: #c3daff;
  }

  .aq-code-shell {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: block;
    overflow-x: auto;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x;
    background: #0f1728;
  }

  .aq-code-block[data-wrap="true"] .aq-code-shell {
    overflow-x: hidden;
    touch-action: pan-y;
  }

  .aq-code-block .aq-code {
    width: max-content;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    padding: 22px;
    min-width: 100%;
    background: #0f1728;
    color: #dbe7ff;
  }

  .aq-code pre,
  .aq-code code,
  .aq-pretty-pre code,
  .aq-pretty-pre code > [data-line],
  figure[data-rehype-pretty-code-figure] pre code,
  figure[data-rehype-pretty-code-figure] [data-line] {
    white-space: pre;
    overflow-wrap: normal;
    word-break: normal;
  }

  .aq-code code,
  pre code {
    display: block;
    font-size: ${articleTypographyScale.codeFontSize};
    line-height: ${articleTypographyScale.codeLineHeight};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New",
      monospace;
  }

  .aq-pretty-pre code {
    display: block;
    min-width: max-content;
    counter-reset: aq-line;
  }

  .aq-pretty-pre code [data-line] {
    display: block;
    position: relative;
    padding-left: calc(var(--aq-code-gutter-width) + var(--aq-code-gutter-gap));
  }

  .aq-pretty-pre code [data-line]::before {
    counter-increment: aq-line;
    content: counter(aq-line);
    position: absolute;
    left: 0;
    top: 0;
    width: var(--aq-code-gutter-width);
    text-align: right;
    color: #8b95a7;
    user-select: none;
  }

  .aq-code-block[data-wrap="true"] .aq-code,
  .aq-code-block[data-wrap="true"] .aq-pretty-pre code,
  .aq-code-block[data-wrap="true"] .aq-pretty-pre code > [data-line] {
    width: 100%;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: normal;
  }

  .aq-pretty-pre code[data-has-diff="true"] [data-line] {
    padding-left: calc(var(--aq-code-gutter-width) + var(--aq-code-gutter-gap) + 0.72rem);
  }

  .aq-pretty-pre code [data-line][data-diff="add"],
  figure[data-rehype-pretty-code-figure] [data-line][data-diff="add"] {
    background: rgba(34, 197, 94, 0.16);
    border-left: 2px solid #22c55e;
  }

  .aq-pretty-pre code [data-line][data-diff="remove"],
  figure[data-rehype-pretty-code-figure] [data-line][data-diff="remove"] {
    background: rgba(239, 68, 68, 0.16);
    border-left: 2px solid #ef4444;
  }

  .aq-pretty-pre code [data-line][data-diff]::after {
    position: absolute;
    left: calc(var(--aq-code-gutter-width) + 0.28rem);
    top: 0;
    font-weight: 700;
    user-select: none;
    pointer-events: none;
  }

  .aq-pretty-pre code [data-line][data-diff="add"]::after {
    content: "+";
    color: #4ade80;
  }

  .aq-pretty-pre code [data-line][data-diff="remove"]::after {
    content: "-";
    color: #f87171;
  }

  .aq-pretty-pre code > [data-highlighted-line] {
    background: rgba(96, 165, 250, 0.11);
    border-radius: 0;
  }

  .aq-pretty-pre code [data-highlighted-chars] {
    background: rgba(250, 204, 21, 0.2);
    border-radius: 0;
    padding: 0.04em 0.2em;
  }

  .aq-pretty-pre code mark.aq-code-word-mark,
  .aq-code mark.aq-code-word-mark,
  mark.aq-code-word-mark {
    background: rgba(250, 204, 21, 0.28);
    color: inherit;
    border-radius: 2px;
    padding: 0.05em 0.22em;
    margin: 0 -0.05em;
  }

  figure[data-rehype-pretty-code-figure] code,
  figure[data-rehype-pretty-code-figure] code span {
    color: var(--shiki-light);
    background-color: transparent !important;
  }

  figure[data-rehype-pretty-code-figure] {
    margin: 1rem 0;
    max-width: 100%;
    min-width: 0;
    border-radius: 0;
    overflow: hidden;
    border: 1px solid ${theme.colors.gray6};
    background: rgba(248, 250, 252, 0.92);
  }

  figure[data-rehype-pretty-code-figure] pre {
    margin: 0;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 1rem 1.05rem;
    background: transparent;
  }

  figure[data-rehype-pretty-code-figure] pre code {
    display: block;
    min-width: max-content;
  }

  figure[data-rehype-pretty-code-figure] [data-line] {
    display: block;
    border-left: 2px solid transparent;
    padding: 0 0.36rem;
  }

  figure[data-rehype-pretty-code-figure] [data-highlighted-line] {
    border-left-color: #3b82f6;
    background: rgba(59, 130, 246, 0.12);
  }

  figure[data-rehype-pretty-code-figure] [data-highlighted-chars] {
    background: rgba(250, 204, 21, 0.24);
    border-radius: 4px;
    padding: 0.06em 0.22em;
  }


  pre code .token.comment,
  pre code .token.prolog,
  pre code .token.doctype,
  pre code .token.cdata {
    color: #808b99;
    font-style: italic;
  }

  pre code .token.punctuation {
    color: #a9b7c6;
  }

  pre code .token.property,
  pre code .token.tag,
  pre code .token.constant,
  pre code .token.symbol,
  pre code .token.deleted {
    color: #cc7832;
  }

  pre code .token.boolean,
  pre code .token.number {
    color: #6897bb;
  }

  pre code .token.selector,
  pre code .token.attr-name,
  pre code .token.string,
  pre code .token.char,
  pre code .token.builtin,
  pre code .token.inserted {
    color: #6aab73;
  }

  pre code .token.operator,
  pre code .token.entity,
  pre code .token.url,
  pre code .token.variable {
    color: #9876aa;
  }

  pre code .token.atrule,
  pre code .token.attr-value,
  pre code .token.keyword,
  pre code .token.annotation,
  pre code .token.decorator {
    color: #cc7832;
    font-weight: 600;
  }

  pre code .token.function,
  pre code .token.class-name {
    color: #ffc66d;
  }

  pre code .token.regex,
  pre code .token.important {
    color: #bbb529;
  }

  @media (max-width: 820px) {
    .aq-code code,
    pre code {
      font-size: ${articleTypographyScale.codeFontSizeMobile};
      line-height: ${articleTypographyScale.codeLineHeightMobile};
    }

    .aq-code-block {
      --aq-code-gutter-gap: 0.46rem;
    }

    .aq-code-block .aq-code {
      padding: 14px 16px;
    }

    .aq-code-toolbar {
      padding: 6px 12px;
    }

    .aq-code-wrap,
    .aq-code-copy {
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (pointer: coarse) {
    .aq-code-wrap,
    .aq-code-copy {
      min-width: 44px;
      min-height: 44px;
    }
  }

`
