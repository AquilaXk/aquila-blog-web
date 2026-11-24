/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/theme/common/{top-bar.css,style.css} (MIT License, Copyright (c) 2021 Mirone)
 * - TryGhost/Koenig packages/koenig-lexical/ (MIT License, Copyright (c) Ghost Foundation)
 * - marktext/marktext src/muya/lib/contentState/focus.ts (MIT License, Copyright (c) 2018-present Jocs / MarkText)
 * - fuma-nama/fumadocs & shikijs/shiki (MIT License)
 */
import styled from "@emotion/styled"
import { articleTypographyScale } from "src/libs/markdown/contentTypography"
import { EDITOR_SYNTAX_COLORS } from "./markdownEditorSyntaxThemeTokens"

export {
  EditorToolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarHiddenInput,
  ToolbarMenuChevron,
  ToolbarMenuItem,
  ToolbarMenuPanel,
  ToolbarMenuRoot,
  ToolbarMenuTrigger,
} from "./MarkdownEditorToolbar.styles"

export const EditorRoot = styled.section`
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
`

export const ToolbarError = styled.div`
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.red7};
  background: ${({ theme }) => theme.colors.red3};
  color: ${({ theme }) => theme.colors.red11};
  font-size: 0.86rem;
  font-weight: 600;
`

export const LiveEditorBody = styled.div<{
  $isEmpty?: boolean
  $isReading?: boolean
  $emptyPlaceholder?: string
  $activeLinePlaceholder?: string
}>`
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
  font-family: var(--aq-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
  font-size: ${articleTypographyScale.bodyFontSize};
  font-weight: 400;
  line-height: ${articleTypographyScale.bodyLineHeight};
  letter-spacing: 0;
  tab-size: 2;
  --aq-empty-doc-placeholder: ${({ $emptyPlaceholder }) =>
    JSON.stringify($emptyPlaceholder || "글 내용을 입력하거나 '/'를 눌러 서식을 빠르게 추가하세요...")};
  --aq-active-line-placeholder: ${({ $activeLinePlaceholder }) =>
    JSON.stringify($activeLinePlaceholder || "'/'를 눌러 블록을 삽입하거나 내용을 입력하세요...")};

  ${({ $isEmpty, theme }) =>
    $isEmpty &&
    `
    .cm-content .cm-line:first-of-type {
      position: relative;
    }

    .cm-content .cm-line:first-of-type::before {
      content: var(--aq-empty-doc-placeholder);
      color: ${theme.colors.gray9};
      position: absolute;
      left: 6px;
      right: 16px;
      max-width: calc(100% - 22px);
      white-space: normal;
      word-break: keep-all;
      overflow-wrap: break-word;
      pointer-events: none;
      user-select: none;
    }
  `}

  .cm-editor.cm-focused:not(:has(.cm-live-table-wrap[data-active-mode])) .cm-line.cm-live-empty-line::after {
    content: var(--aq-active-line-placeholder);
    color: ${({ theme }) => theme.colors.gray9};
    display: inline-block;
    max-width: calc(100% - 8px);
    white-space: normal;
    word-break: keep-all;
    overflow-wrap: break-word;
    vertical-align: baseline;
    pointer-events: none;
    user-select: none;
  }

  @media (max-width: 820px) { font-size: 16px; line-height: 1.7; }
  [data-testid="markdown-editor-live-surface"] {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    ${({ $isReading }) => ($isReading ? "display: none;" : "")}
  }

  .cm-editor {
    height: 100%;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
  }
  .cm-editor.cm-focused { outline: none; }
  .cm-scroller { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .cm-sizer {
    width: 100%;
    max-width: 856px;
    margin-inline: auto;
    box-sizing: border-box;
  }
  .cm-content {
    width: calc(100% - 112px);
    max-width: 744px;
    flex: 0 1 744px;
    margin-inline: auto;
    box-sizing: content-box;
    caret-color: ${({ theme }) => theme.colors.gray12};
    padding: 12px 56px 96px 56px;
    word-break: keep-all;
    overflow-wrap: break-word;
    @media (max-width: 820px) {
      width: 100%;
      max-width: 100%;
      flex: 1 1 auto;
      box-sizing: border-box;
      padding: 14px 16px 32px;
    }
  }

  &[data-view-mode="source"] .cm-content {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 14.5px;
    line-height: 1.7;
    letter-spacing: -0.005em;
  }

  [data-focus-mode="true"] & .cm-line:not(.cm-live-focus-active-line) {
    opacity: 0.36;
    transition: opacity 0.16s ease;
  }

  [data-focus-mode="true"] & .cm-line.cm-live-code-line:not(.cm-live-focus-active-line) {
    opacity: 1;
  }

  [data-focus-mode="true"] & .cm-line.cm-live-code-line:not(.cm-live-focus-active-line):not(:hover) .cm-live-fenced-code,
  [data-focus-mode="true"] & .cm-line.cm-live-code-line:not(.cm-live-focus-active-line):not(:hover)::after {
    opacity: 0.38;
    transition: opacity 0.16s ease;
  }

  [data-focus-mode="true"] & .cm-line.cm-live-focus-active-line,
  [data-focus-mode="true"] & .cm-line:hover {
    opacity: 1;
  }

  .cm-placeholder {
    color: ${({ theme }) => theme.colors.gray9};
    font-style: normal;
    user-select: none;
  }

  .cm-content ::selection,
  .cm-selectionBackground,
  & .cm-focused .cm-selectionBackground {
    background: ${EDITOR_SYNTAX_COLORS.selectionLight};
  }
  .cm-cursor { border-left-color: ${({ theme }) => theme.colors.gray12}; }

  .cm-live-heading,
  .cm-live-heading *:not(.cm-live-link):not(.cm-live-strikethrough) {
    color: ${({ theme }) => theme.colors.gray12};
    font-family: var(--aq-font-sans);
    font-weight: 650;
    letter-spacing: -0.015em;
    text-decoration: none !important;
  }
  .cm-live-heading-1 { font-size: ${articleTypographyScale.h1FontSize}; line-height: 1.25; margin-top: 1.15em; margin-bottom: 0.42em; }
  .cm-live-heading-2 { font-size: ${articleTypographyScale.h2FontSize}; line-height: 1.32; margin-top: 1.05em; margin-bottom: 0.36em; }
  .cm-live-heading-3 { font-size: ${articleTypographyScale.h3FontSize}; line-height: 1.38; margin-top: 0.92em; margin-bottom: 0.3em; }
  .cm-live-heading-4 { font-size: ${articleTypographyScale.h4FontSize}; line-height: 1.44; margin-top: 0.84em; margin-bottom: 0.25em; }
  .cm-live-heading-5,
  .cm-live-heading-6 {
    font-size: 1rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.gray11};
    margin-top: 0.78em;
    margin-bottom: 0.22em;
  }

  .cm-live-strong { color: ${({ theme }) => theme.colors.gray12}; font-weight: 700; }
  .cm-live-emphasis { font-style: italic; }
  .cm-live-strikethrough { text-decoration: line-through; text-decoration-thickness: 1px; }

  .cm-live-inline-code {
    border: none;
    border-radius: 0.42rem;
    padding: 0.14em 0.4em 0.16em;
    background: var(--aq-inline-code-bg, ${EDITOR_SYNTAX_COLORS.inlineCodeSurface});
    color: var(--aq-inline-code-fg, ${({ theme }) => theme.colors.gray12});
    box-shadow: inset 0 0 0 1px var(--aq-inline-code-border, ${({ theme }) => theme.publicDesign.border});
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: ${articleTypographyScale.codeFontSize};
    line-height: ${articleTypographyScale.codeLineHeight};
    font-weight: 500;
  }

  .cm-live-link {
    color: ${({ theme }) => theme.publicDesign.accent};
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, ${({ theme }) => theme.publicDesign.accent} 45%, transparent);
    text-underline-offset: 0.16em;
    text-decoration-thickness: 0.08em;
  }

  .cm-live-highlight {
    background-color: ${EDITOR_SYNTAX_COLORS.highlightSurface};
    border-radius: 4px;
    padding: 0 2px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .cm-live-wikilink {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 7px 1px 5px;
    margin: 0 2px;
    border-radius: 4px;
    background: ${EDITOR_SYNTAX_COLORS.wikilinkSurface};
    border: 1px solid ${EDITOR_SYNTAX_COLORS.wikilinkBorder};
    color: ${EDITOR_SYNTAX_COLORS.wikilinkText};
    font-size: 0.9em;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    user-select: none;
    vertical-align: baseline;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: ${EDITOR_SYNTAX_COLORS.wikilinkHoverSurface};
      border-color: ${EDITOR_SYNTAX_COLORS.wikilinkHoverBorder};
      color: ${EDITOR_SYNTAX_COLORS.wikilinkHoverText};
      text-decoration: none;
    }

    &:focus-visible { outline: 2px solid var(--aq-accent-link, ${EDITOR_SYNTAX_COLORS.accentBlueControl}); outline-offset: 1px; }
    @media (max-width: 768px), (pointer: coarse) { min-height: 44px; min-width: 44px; }
  }

  .cm-live-wikilink-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.8;
    svg { display: block; width: 11px; height: 11px; }
  }

  .cm-live-wikilink-text { display: inline-block; }

  .cm-live-color .cm-live-strong,
  .cm-live-color .cm-live-inline-code,
  .cm-live-color .cm-live-link {
    color: inherit;
  }

  .cm-live-horizontal-rule {
    display: inline-block;
    width: 100%;
    vertical-align: middle;
    border-top: 1px solid ${({ theme }) => theme.colors.gray6};
  }

  .cm-live-quote { color: ${({ theme }) => theme.colors.gray11}; }

  .cm-live-quote-marker {
    display: inline-block;
    width: 4px;
    height: 1.3em;
    margin-right: 0.85em;
    vertical-align: -0.22em;
    background: ${({ theme }) => theme.colors.gray7};
  }

  .cm-live-list-marker {
    display: inline-block;
    min-width: 1.3em;
    color: ${({ theme }) => theme.colors.gray11};
    font-weight: 700;
  }

  .cm-live-task-checkbox {
    box-sizing: border-box;
    display: inline-flex;
    width: 1em;
    height: 1em;
    align-items: center;
    justify-content: center;
    margin-right: 0.45em;
    border-radius: 3px;
    border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
    color: ${({ theme }) => theme.colors.gray12};
    font: 800 0.75em/1 ui-monospace, monospace;
    vertical-align: -0.08em;
    cursor: pointer;
    user-select: none;
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.gray12}; outline-offset: 1px; }
    @media (max-width: 768px), (pointer: coarse) { min-width: 24px; min-height: 24px; }
    &.is-checked {
      background: ${({ theme }) => theme.colors.gray12};
      border-color: ${({ theme }) => theme.colors.gray12};
      color: ${EDITOR_SYNTAX_COLORS.whiteText};
    }
  }
  .cm-live-task-space { display: inline-block; width: 0; text-decoration: none; }
  .cm-line.cm-live-task-checked-line { color: ${({ theme }) => theme.colors.gray9}; text-decoration: line-through; }
  .cm-live-toggle-block, .cm-live-bookmark-card {
    border-color: ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
  }
  .cm-live-bookmark-card:hover { border-color: ${({ theme }) => theme.publicDesign.borderStrong}; }

  .cm-live-heading-line { position: relative; padding-top: 0.35em; padding-bottom: 0.15em; }
  .cm-live-heading-line-1 { padding-top: 0.65em; padding-bottom: 0.22em; }
  .cm-live-heading-line-2 { padding-top: 0.5em; padding-bottom: 0.18em; }
  .cm-live-list { padding-left: 2px; }

  .cm-line.cm-live-code-line {
    background: ${EDITOR_SYNTAX_COLORS.codeBlockLineSurface};
    color: ${EDITOR_SYNTAX_COLORS.codeBlockLineText};
    border-left: 1px solid ${EDITOR_SYNTAX_COLORS.codeBlockLineBorder};
    border-right: 1px solid ${EDITOR_SYNTAX_COLORS.codeBlockLineBorder};
    padding-left: 18px;
    padding-right: 18px;
    caret-color: ${EDITOR_SYNTAX_COLORS.codeBlockCursor};
  }
  .cm-line.cm-live-code-line .cm-live-fenced-code {
    color: inherit;
  }
  .cm-line.cm-live-code-line .tok-keyword,
  .cm-line.cm-live-code-line .tok-atom,
  .cm-line.cm-live-code-line .tok-deleted {
    color: ${EDITOR_SYNTAX_COLORS.codeTokKeyword};
    font-weight: 600;
  }
  .cm-line.cm-live-code-line .tok-propertyName,
  .cm-line.cm-live-code-line .tok-operator {
    color: ${EDITOR_SYNTAX_COLORS.codeTokVariable};
  }
  .cm-line.cm-live-code-line .tok-typeName,
  .cm-line.cm-live-code-line .tok-className,
  .cm-line.cm-live-code-line .tok-macroName,
  .cm-line.cm-live-code-line .tok-variableName.tok-definition {
    color: ${EDITOR_SYNTAX_COLORS.codeTokFunction};
  }
  .cm-line.cm-live-code-line .tok-string,
  .cm-line.cm-live-code-line .tok-string2,
  .cm-line.cm-live-code-line .tok-inserted {
    color: ${EDITOR_SYNTAX_COLORS.codeTokString};
  }
  .cm-line.cm-live-code-line .tok-number,
  .cm-line.cm-live-code-line .tok-bool,
  .cm-line.cm-live-code-line .tok-literal {
    color: ${EDITOR_SYNTAX_COLORS.codeTokNumber};
  }
  .cm-line.cm-live-code-line .tok-comment,
  .cm-line.cm-live-code-line .tok-meta,
  .cm-line.cm-live-code-line .tok-punctuation,
  .cm-line.cm-live-code-line .tok-labelName {
    color: ${EDITOR_SYNTAX_COLORS.codeTokComment};
  }
  .cm-line.cm-live-code-fence-open {
    border-top: 1px solid ${EDITOR_SYNTAX_COLORS.codeBlockLineBorder};
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    padding-top: 8px;
    line-height: 1.45;
    color: ${EDITOR_SYNTAX_COLORS.codeBlockLineMuted};
  }
  .cm-line.cm-live-code-body-line { padding-top: 1px; padding-bottom: 1px; }
  .cm-line.cm-live-code-fence-close {
    border-bottom: 1px solid ${EDITOR_SYNTAX_COLORS.codeBlockLineBorder};
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    padding-top: 0;
    padding-bottom: 6px;
    line-height: 0.85;
    color: ${EDITOR_SYNTAX_COLORS.codeBlockLineMuted};
  }

  .cm-live-code-fence-open[data-code-lang] {
    position: relative;
    &::after {
      content: attr(data-code-lang);
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid ${EDITOR_SYNTAX_COLORS.codeLangBadgeBorder};
      background: ${EDITOR_SYNTAX_COLORS.codeLangBadgeSurface};
      color: ${EDITOR_SYNTAX_COLORS.codeLangBadgeText};
      font: 700 10px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
    }
  }

  .cm-gutters, .cm-editor .cm-gutters { background: transparent; border-right: 0 !important; border: 0; }
  .cm-foldGutter .cm-gutterElement {
    padding: 0 4px;
    color: ${({ theme }) => theme.colors.gray9};
    cursor: pointer;
    opacity: 0.45;
    transition: opacity 0.15s ease;
    &:hover { opacity: 1; color: ${({ theme }) => theme.colors.gray12}; }
  }

  .cm-live-fenced-code {
    color: ${EDITOR_SYNTAX_COLORS.codeBlockLineText};
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9em;
    line-height: 1.65;
  }

  .cm-live-image-wrap {
    display: inline-block; max-width: min(100%, var(--aq-image-width, 100%));
    &[data-align="center"], &[data-align="right"], &[data-align="left"], &[data-align="wide"], &[data-align="full"] { display: flex; width: 100%; max-width: 100%; }
    &[data-align="center"], &[data-align="wide"] { justify-content: center; }
    &[data-align="right"] { justify-content: flex-end; }
    &[data-align="left"] { justify-content: flex-start; }
    .cm-live-image { max-width: min(100%, var(--aq-image-width, 100%)); height: auto; }
    &[data-align="full"] .cm-live-image { width: 100%; max-width: 100%; }
  }

  &[aria-disabled="true"] .cm-editor { cursor: not-allowed; opacity: 0.7; }

  @media (max-width: 820px) {
    .cm-sizer {
      max-width: 100%;
    }

    .cm-content {
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      padding: 14px 16px 32px;
    }
  }
`

export const EditorInlineIconSpec = {
  width: "width: 32px",
  height: "height: 32px",
} as const
