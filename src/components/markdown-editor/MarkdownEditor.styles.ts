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
  border: 1px solid ${({ theme }) => theme.colors.gray6};
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
  padding: 6px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray6};
  background: ${({ theme }) => theme.publicDesign.readableSurface};

  @media (max-width: 820px) {
    gap: 8px;
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
`

export const ToolbarButton = styled.button`
  border: 1px solid transparent;
  border-radius: 4px;
  height: 36px;
  min-height: 36px;
  min-width: 36px;
  flex: 0 0 auto;
  padding: 0 9px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
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
  font-size: 9px;
  line-height: 1;
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
  font-size: 12px;
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
  border-bottom: 1px solid rgba(248, 81, 73, 0.35);
  background: rgba(248, 81, 73, 0.1);
  color: #ffb4ad;
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

export const LiveEditorBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${({ theme }) => theme.colors.gray12};
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.78;
  tab-size: 2;

  [data-testid="markdown-editor-live-surface"] {
    height: 100%;
  }

  .cm-editor {
    height: 100%;
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray12};
  }

  .cm-editor.cm-focused {
    outline: 2px solid ${({ theme }) => theme.colors.blue8};
    outline-offset: -2px;
  }

  .cm-scroller {
    overscroll-behavior: contain;
  }

  .cm-content {
    caret-color: ${({ theme }) => theme.colors.gray12};
  }

  .cm-content ::selection,
  .cm-selectionBackground,
  & .cm-focused .cm-selectionBackground {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(56, 139, 253, 0.45)" : "rgba(9, 105, 218, 0.32)")};
  }

  .cm-cursor {
    border-left-color: ${({ theme }) => theme.colors.gray12};
  }

  .cm-live-heading {
    color: ${({ theme }) => theme.colors.gray12};
    font-family: var(--aq-font-sans);
    font-weight: 600;
    letter-spacing: -0.035em;
  }

  .cm-live-heading-1 {
    font-size: 1.9em;
    line-height: 1.28;
  }

  .cm-live-heading-2 {
    font-size: 1.55em;
    line-height: 1.34;
  }

  .cm-live-heading-3,
  .cm-live-heading-4,
  .cm-live-heading-5,
  .cm-live-heading-6 {
    font-size: 1.24em;
    line-height: 1.42;
  }

  .cm-live-strong {
    color: ${({ theme }) => theme.colors.gray12};
    font-weight: 800;
  }

  .cm-live-emphasis {
    font-style: italic;
  }

  .cm-live-strikethrough {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }

  .cm-live-inline-code {
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    border-radius: 4px;
    padding: 0.08em 0.3em;
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray11};
  }

  .cm-live-link {
    color: ${({ theme }) => theme.publicDesign.accent};
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .cm-live-quote {
    color: ${({ theme }) => theme.colors.gray10};
  }

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
    border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
    color: ${({ theme }) => theme.colors.gray12};
    font: 800 0.75em/1 ui-monospace, monospace;
    vertical-align: -0.08em;
  }

  .cm-live-fenced-code {
    color: ${({ theme }) => theme.colors.gray11};
  }

  &[aria-disabled="true"] .cm-editor {
    cursor: not-allowed;
    opacity: 0.7;
  }
`
