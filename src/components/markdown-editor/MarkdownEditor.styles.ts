import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"

export const EditorRoot = styled.section`
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
  overflow: hidden;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
`

export const EditorToolbar = styled.div`
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 48px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 24px 6px 56px;
  border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
  border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.readableSurface};

  @media (max-width: 820px) {
    gap: 8px;
    padding: 6px 12px;
  }
`

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: visible;

  &[data-align="end"] {
    margin-left: auto;
  }
`

export const ToolbarQuoteGlyph = styled.span`
  font-size: 15px;
  line-height: 1;
`

export const ToolbarButton = styled.button<{ $active?: boolean }>`
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.gray8 : "transparent")};
  border-radius: 4px;
  height: 36px;
  min-height: 36px;
  min-width: 36px;
  flex: 0 0 auto;
  padding: 0 9px;
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.gray12 : theme.colors.gray10)};
  font-family: var(--aq-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;

  ${focusVisibleRing}

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.gray6};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    height: 44px;
    min-height: 44px;
    min-width: 44px;
  }
`

export const ToolbarSelect = styled.select`
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 4px;
  padding: 0 6px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray10};
  font-family: var(--aq-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue8};
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    height: 44px;
    min-height: 44px;
  }
`

export const ToolbarMenuRoot = styled.div`
  position: relative;
  flex: 0 0 auto;
`

export const ToolbarMenuTrigger = styled(ToolbarButton)`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &[aria-expanded="true"] {
    border-color: ${({ theme }) => theme.colors.gray7};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }
`

export const ToolbarMenuChevron = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.75;

  svg {
    width: 12px;
    height: 12px;
    display: block;
  }
`

export const ToolbarMenuPanel = styled.div<{
  $align: "start" | "end"
  $horizontalOffset: number
}>`
  position: absolute;
  z-index: ${zIndexes.dropdownMenu};
  top: calc(100% + 6px);
  ${({ $align }) => ($align === "end" ? "right: 0;" : "left: 0;")}
  transform: translateX(${({ $horizontalOffset }) => $horizontalOffset}px);
  display: grid;
  min-width: 172px;
  max-width: min(280px, calc(100vw - 24px));
  max-height: min(360px, calc(100vh - 96px));
  overflow-y: auto;
  padding: 5px;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 6px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
`

export const ToolbarMenuItem = styled.button`
  width: 100%;
  min-height: 34px;
  border: 0;
  border-radius: 4px;
  padding: 0 10px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray11};
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  ${focusVisibleRing}

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
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

export const FindReplaceRegion = styled.section`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
`

export const FindReplaceField = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 12px;
  font-weight: 700;
`

export const FindReplaceInput = styled.input`
  width: 132px;
  height: 30px;
  box-sizing: border-box;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 4px;
  padding: 0 8px;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue8};
    outline-offset: 1px;
  }
`

export const FindReplaceCheckbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 12px;
  font-weight: 700;
`

export const FindReplaceStatus = styled.output`
  color: ${({ theme }) => theme.colors.gray10};
  font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
`

export const FindReplaceActions = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;

  button {
    height: 30px;
    border: 1px solid ${({ theme }) => theme.colors.gray6};
    border-radius: 4px;
    padding: 0 8px;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray10};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.blue8};
    outline-offset: 1px;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

export const LiveEditorBody = styled.div<{ $isEmpty?: boolean }>`
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

  ${({ $isEmpty, theme }) =>
    $isEmpty &&
    `
    .cm-content .cm-line:first-of-type::before {
      content: "글 내용을 입력하거나 '/'를 눌러 서식을 빠르게 추가하세요...";
      color: ${theme.colors.gray9};
      position: absolute;
      pointer-events: none;
      user-select: none;
    }
  `}

  .cm-line.cm-live-empty-line::after {
    content: attr(data-placeholder);
    color: ${({ theme }) => theme.colors.gray9};
    pointer-events: none;
    user-select: none;
    opacity: 0.65;
  }

  @media (max-width: 820px) { font-size: 15px; }
  [data-testid="markdown-editor-live-surface"] { height: 100%; }

  .cm-editor {
    height: 100%;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
  }
  .cm-editor.cm-focused { outline: none; }
  .cm-scroller { overscroll-behavior: contain; }
  .cm-content {
    caret-color: ${({ theme }) => theme.colors.gray12};
    padding-left: 44px;

    @media (max-width: 720px) {
      padding-left: 16px;
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
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(56, 139, 253, 0.45)" : "rgba(9, 105, 218, 0.32)")};
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
    background: ${({ theme }) =>
      theme.scheme === "dark" ? "rgba(110, 118, 129, 0.25)" : "rgba(135, 131, 120, 0.15)"};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#ff7b72" : "#eb5757")};
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.87em;
    font-weight: 500;
  }

  .cm-live-link {
    color: ${({ theme }) => theme.publicDesign.accent};
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .cm-live-highlight {
    background-color: rgba(255, 208, 0, 0.35);
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
    border-radius: 9999px;
    background: ${({ theme }) =>
      theme.scheme === "dark" ? "rgba(168, 85, 247, 0.18)" : "rgba(124, 58, 237, 0.1)"};
    border: 1px solid
      ${({ theme }) =>
        theme.scheme === "dark" ? "rgba(168, 85, 247, 0.35)" : "rgba(124, 58, 237, 0.22)"};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#c084fc" : "#7c3aed")};
    font-size: 0.9em;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    user-select: none;
    vertical-align: baseline;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

    &:hover {
      background: ${({ theme }) =>
        theme.scheme === "dark" ? "rgba(168, 85, 247, 0.28)" : "rgba(124, 58, 237, 0.18)"};
      border-color: ${({ theme }) =>
        theme.scheme === "dark" ? "rgba(168, 85, 247, 0.5)" : "rgba(124, 58, 237, 0.35)"};
      color: ${({ theme }) => (theme.scheme === "dark" ? "#d8b4fe" : "#6d28d9")};
      text-decoration: none;
    }

    &:focus-visible {
      outline: 2px solid var(--aq-accent-link, #155eef);
      outline-offset: 1px;
    }
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
    background: ${({ theme }) => theme.publicDesign.accent};
  }

  .cm-live-list-marker {
    display: inline-block;
    min-width: 1.3em;
    color: ${({ theme }) => theme.publicDesign.accent};
    font-weight: 800;
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
    &.is-checked {
      background: ${({ theme }) => theme.publicDesign.accent};
      border-color: ${({ theme }) => theme.publicDesign.accent};
      color: #fff;
    }
  }
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
    background: ${({ theme }) =>
      theme.scheme === "dark" ? theme.publicDesign.surfaceElevated : "#f7f6f3"};
    border-left: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-right: 1px solid ${({ theme }) => theme.publicDesign.border};
    padding-left: 12px;
    padding-right: 12px;
  }
  .cm-line.cm-live-code-fence-open {
    border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    padding-top: 4px;
  }
  .cm-line.cm-live-code-body-line { padding-top: 1px; padding-bottom: 1px; }
  .cm-line.cm-live-code-fence-close {
    border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    padding-bottom: 4px;
  }

  .cm-live-code-fence-open[data-code-lang] {
    position: relative;
    &::after {
      content: attr(data-code-lang);
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid rgba(35, 131, 226, 0.25);
      background: ${({ theme }) =>
        theme.scheme === "dark" ? "rgba(35, 131, 226, 0.2)" : "#e9f3f7"};
      color: ${({ theme }) => (theme.scheme === "dark" ? "#60a5fa" : "#2383e2")};
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

  &[aria-disabled="true"] .cm-editor { cursor: not-allowed; opacity: 0.7; }
`
