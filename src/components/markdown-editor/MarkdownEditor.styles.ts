/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/theme/common/{top-bar.css,style.css} (MIT License, Copyright (c) 2021 Mirone)
 * - TryGhost/Koenig packages/koenig-lexical/ (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"
import { EDITOR_SYNTAX_COLORS } from "./markdownEditorSyntaxThemeTokens"

export const EditorRoot = styled.section`
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
`

export const EditorToolbar = styled.div`
  box-sizing: border-box;
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  border-radius: 0;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: none;

  @media (max-width: 820px) {
    padding: 2px 8px;
  }
`

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  overflow: visible;

  &[data-align="end"] {
    margin-left: auto;
  }

  @media (max-width: 720px) {
    &:not([data-align="end"]) {
      flex: 1 1 auto;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }
  }
`

export const ToolbarButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  margin: 4px;
  padding: 4px;
  flex: 0 0 auto;
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.gray12 : theme.colors.gray10)};
  font-family: var(--aq-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.12s ease, color 0.12s ease;

  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:active:not(:disabled) {
    background: ${({ theme }) => theme.colors.gray4};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 820px), (pointer: coarse) {
    width: auto;
    min-width: 38px;
    height: 38px;
    min-height: 38px;
    margin: 2px;

    &[data-mobile-hidden="true"] {
      display: none;
    }
  }
`

export const ToolbarMenuRoot = styled.div`
  position: relative;
  flex: 0 0 auto;
`

export const ToolbarMenuTrigger = styled(ToolbarButton)`
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-width: auto;
  height: 32px;
  padding: 4px 4px 4px 10px;
  margin: 4px 2px;
  border-radius: 4px;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0.1px;
  color: ${({ theme }) => theme.colors.gray12};

  &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }
`

export const ToolbarMenuChevron = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.gray10};

  svg { width: 14px; height: 14px; display: block; }
`

type ToolbarMenuHorizontalAlign = "start" | "end"

const resolveToolbarMenuHorizontalPlacement = (
  $align: ToolbarMenuHorizontalAlign,
  $fixedPosition?: { top: number; left: number } | null
): string => {
  if ($fixedPosition) return `left: ${$fixedPosition.left}px; right: auto;`
  return $align === "end" ? "right: 0;" : "left: 0;"
}

export const ToolbarMenuPanel = styled.div<{
  $align: ToolbarMenuHorizontalAlign
  $horizontalOffset: number
  $fixedPosition?: { top: number; left: number } | null
}>`
  position: ${({ $fixedPosition }) => ($fixedPosition ? "fixed" : "absolute")};
  z-index: ${zIndexes.dropdownMenu};
  top: ${({ $fixedPosition }) => ($fixedPosition ? `${$fixedPosition.top}px` : "calc(100% + 4px)")};
  bottom: auto;
  ${({ $align, $fixedPosition }) => resolveToolbarMenuHorizontalPlacement($align, $fixedPosition)}
  transform: ${({ $fixedPosition, $horizontalOffset }) =>
    $fixedPosition ? "none" : `translateX(${$horizontalOffset}px)`};
  display: grid;
  min-width: 168px;
  max-width: min(280px, calc(100vw - 24px));
  max-height: min(360px, calc(100vh - 110px));
  overflow-y: auto;
  padding: 6px 4px 4px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  border-radius: 8px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow:
    0 12px 32px ${boxShadowColor.popover},
    0 2px 6px ${boxShadowColor.subtleHover};
`

export const ToolbarMenuItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 4px;
  padding: 8px 12px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  ${focusVisibleRing}

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:disabled { opacity: 0.42; cursor: not-allowed; }
  @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }
`

export const ToolbarHiddenInput = styled.input`
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
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
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
  font-family: var(--aq-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
  font-size: 16px;
  font-weight: 450;
  line-height: 1.75;
  letter-spacing: -0.012em;
  tab-size: 2;
  --aq-empty-doc-placeholder: ${({ $emptyPlaceholder }) =>
    JSON.stringify($emptyPlaceholder || "글 내용을 입력하거나 '/'를 눌러 서식을 빠르게 추가하세요...")};
  --aq-active-line-placeholder: ${({ $activeLinePlaceholder }) =>
    JSON.stringify($activeLinePlaceholder || "'/'를 눌러 블록을 삽입하거나 내용을 입력하세요...")};

  ${({ $isEmpty, theme }) =>
    $isEmpty &&
    `
    .cm-content .cm-line:first-of-type::before {
      content: var(--aq-empty-doc-placeholder);
      color: ${theme.colors.gray9};
      position: absolute;
      pointer-events: none;
      user-select: none;
    }
  `}

  .cm-editor.cm-focused:not(:has(.cm-live-table-wrap[data-active-mode])) .cm-line.cm-live-empty-line::after {
    content: var(--aq-active-line-placeholder);
    color: ${({ theme }) => theme.colors.gray9};
    pointer-events: none;
    user-select: none;
  }

  @media (max-width: 820px) { font-size: 16px; line-height: 1.7; }
  [data-testid="markdown-editor-live-surface"] { height: 100%; ${({ $isReading }) => ($isReading ? "display: none;" : "")} }

  .cm-editor {
    height: 100%;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
  }
  .cm-editor.cm-focused { outline: none; }
  .cm-scroller { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .cm-content {
    width: calc(100% - 112px);
    max-width: 744px;
    flex: 0 1 744px;
    margin-inline: auto;
    box-sizing: content-box;
    caret-color: ${({ theme }) => theme.colors.gray12};
    padding: 16px 40px 64px 72px;
    @media (max-width: 820px) {
      width: 100%;
      max-width: 100%;
      flex: 1 1 auto;
      box-sizing: border-box;
      padding: 14px 16px 32px;
    }
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
    font-weight: 700;
    letter-spacing: -0.03em;
    text-decoration: none !important;
  }
  .cm-live-heading-1 { font-size: 2em; line-height: 1.28; margin-top: 1.1em; margin-bottom: 0.4em; }
  .cm-live-heading-2 { font-size: 1.6em; line-height: 1.34; margin-top: 1em; margin-bottom: 0.35em; }
  .cm-live-heading-3,
  .cm-live-heading-4,
  .cm-live-heading-5,
  .cm-live-heading-6 { font-size: 1.3em; line-height: 1.4; margin-top: 0.9em; margin-bottom: 0.3em; }

  .cm-live-strong { color: ${({ theme }) => theme.colors.gray12}; font-weight: 750; }
  .cm-live-emphasis { font-style: italic; }
  .cm-live-strikethrough { text-decoration: line-through; text-decoration-thickness: 1px; }

  .cm-live-inline-code {
    border: none;
    border-radius: 4px;
    padding: 0.14em 0.4em;
    background: ${EDITOR_SYNTAX_COLORS.inlineCodeSurface};
    color: ${EDITOR_SYNTAX_COLORS.inlineCodeText};
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.87em;
    font-weight: 500;
  }

  .cm-live-link {
    color: ${({ theme }) => theme.colors.gray12};
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => theme.colors.gray8};
    text-underline-offset: 0.18em;
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

  .cm-live-color :is(.cm-live-strong, .cm-live-inline-code, .cm-live-link) {
    color: inherit;
  }

  .cm-live-horizontal-rule {
    display: inline-block;
    width: 100%;
    vertical-align: middle;
    border-top: 1px solid ${({ theme }) => theme.colors.gray7};
  }

  .cm-live-quote { color: ${({ theme }) => theme.colors.gray10}; }

  .cm-live-quote-marker {
    display: inline-block;
    width: 3px;
    height: 1.25em;
    margin-right: 0.7em;
    vertical-align: -0.2em;
    background: ${({ theme }) => theme.colors.gray8};
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
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }
  .cm-live-bookmark-card:hover { border-color: ${({ theme }) => theme.publicDesign.borderStrong}; }

  .cm-live-heading-line { position: relative; padding-top: 0.35em; padding-bottom: 0.15em; }
  .cm-live-heading-line-1 { padding-top: 0.65em; padding-bottom: 0.22em; }
  .cm-live-heading-line-2 { padding-top: 0.5em; padding-bottom: 0.18em; }
  .cm-live-list { border-left: 1px solid ${({ theme }) => theme.colors.gray5}; padding-left: 2px; }

  .cm-line.cm-live-code-line {
    background: ${EDITOR_SYNTAX_COLORS.codeBlockLineSurface};
    border-left: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-right: 1px solid ${({ theme }) => theme.publicDesign.border};
    padding-left: 16px;
    padding-right: 16px;
  }
  .cm-line.cm-live-code-fence-open {
    border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    padding-top: 8px;
  }
  .cm-line.cm-live-code-body-line { padding-top: 1px; padding-bottom: 1px; }
  .cm-line.cm-live-code-fence-close {
    border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    padding-bottom: 8px;
  }

  .cm-live-code-fence-open[data-code-lang] {
    position: relative;
    &::after {
      content: attr(data-code-lang);
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid ${EDITOR_SYNTAX_COLORS.codeLangBadgeBorder};
      background: ${EDITOR_SYNTAX_COLORS.codeLangBadgeSurface};
      color: ${EDITOR_SYNTAX_COLORS.codeLangBadgeText};
      font: 600 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-transform: lowercase;
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
    color: ${({ theme }) => theme.colors.gray11};
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

  .cm-sizer {
    width: 100%;
    max-width: 856px;
    margin-inline: auto;
    box-sizing: border-box;
  }

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
