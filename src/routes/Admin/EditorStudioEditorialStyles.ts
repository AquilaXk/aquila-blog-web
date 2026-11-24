/**
 * 참조 구현:
 * - TryGhost/Ghost & TryGhost/Koenig apps/admin/src/editor/{post-editor.tsx,editor-screen.tsx,editor-status.tsx} (MIT License, Copyright (c) Ghost Foundation)
 * - fuma-nama/fumadocs (MIT License, Copyright (c) 2024 Fuma Nama)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminFocusRing,
  adminSurface,
  adminSurfaceMuted,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export const EditorialMetaInner = styled.div`
  width: 100%;
  max-width: 744px;
  margin-inline: auto;
  display: grid;
  gap: 0;
  min-width: 0;
`

export const EditorStudioToolbarDock = styled.div`
  position: relative;
  z-index: 12;
  flex: 0 0 auto;
  width: 100%;
  max-height: 92px;
  overflow: visible;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  border-bottom: 1px solid ${adminBorderSubtle};
  transition: max-height 0.18s ease, opacity 0.16s ease, border-color 0.16s ease;

  &:empty {
    display: none;
  }

  [data-focus-mode="true"] & {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    border-bottom-color: transparent;
  }

  [data-focus-mode="true"] &:hover,
  [data-focus-mode="true"] &:focus-within {
    max-height: 92px;
    opacity: 1;
    overflow: visible;
    border-bottom-color: ${adminBorderSubtle};
  }
`

export const EditorStudioPaperScrollSheet = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding-bottom: 34vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: ${({ theme }) => theme.publicDesign.readableSurface};

  @media (max-width: 820px) {
    padding-bottom: 18vh;
  }
`

export const EditorVisibilityMonoPill = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font: 650 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;

  @media (max-width: 820px) {
    display: none;
  }
`

export const EditorSectionEyebrow = styled.span`
  display: block;
  margin: 0 0 2px;
  color: ${adminTextMuted};
  font: 650 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

export const EditorMobileSheetScrim = styled.button`
  display: none;

  @media (max-width: 820px) {
    display: block;
    position: fixed;
    inset: 0;
    z-index: ${zIndexes.mobileSheet - 5};
    border: 0;
    padding: 0;
    margin: 0;
    background: color-mix(in srgb, ${adminTextPrimary} 36%, transparent);
    cursor: pointer;
  }
`

export const InlineExcerptInput = styled.textarea`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: auto;
  field-sizing: content;
  min-height: 28px;
  max-block-size: 6lh;
  margin-top: 12px;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  box-shadow: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: break-word;
  font-family: inherit;
  font-size: 19px;
  font-weight: 450;
  line-height: 1.5;
  letter-spacing: -0.015em;
  color: ${({ theme }) => theme.colors.gray11};

  &::placeholder {
    color: ${({ theme }) => theme.colors.gray9};
  }

  &:focus,
  &:focus-visible {
    outline: none;
    box-shadow: none;
    border-color: transparent;
  }

  @media (max-width: 820px) {
    font-size: 16px;
    margin-top: 8px;
  }
`

export const EditorEditorialDivider = styled.hr`
  width: 100%;
  margin: 20px 0 6px;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};

  @media (max-width: 820px) {
    margin: 12px 0 6px;
  }
`

export const EditorWritingChromeDim = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &[data-writing-focus="hidden"] {
    opacity: 0.52;
  }

  &:hover,
  &:focus-within {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 0.22s ease;
  }
`

export const EditorWritingChromeBlock = styled.div`
  &[data-writing-focus="hidden"] {
    opacity: 0.52;
  }

  &:hover,
  &:focus-within {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 0.22s ease;
  }
`

export const EditorFloatingMiniToc = styled.button`
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  ${focusVisibleRing}

  &[data-writing-focus="hidden"] {
    opacity: 0.48;
  }

  @media (hover: hover) {
    &:hover {
      opacity: 1;
      border-color: ${({ theme }) => theme.publicDesign.border};
      background: ${({ theme }) => theme.publicDesign.surfaceElevated};
      box-shadow: 0 6px 18px ${boxShadowColor.subtleHover};
    }
  }

  &:focus-visible {
    opacity: 1;
    border-color: ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }

  @media (prefers-reduced-motion: no-preference) {
    transition:
      opacity 0.22s ease,
      background-color 0.16s ease,
      border-color 0.16s ease,
      box-shadow 0.16s ease;
  }

  @media (max-width: 1180px) {
    display: none;
  }
`

export const EditorFloatingMiniTocTick = styled.span<{ $level: number; $active?: boolean }>`
  display: block;
  height: 2px;
  border-radius: 999px;
  width: ${({ $level, $active }) => {
    if ($active) return "20px"
    if ($level <= 1) return "15px"
    if ($level === 2) return "12px"
    return "8px"
  }};
  background: ${({ theme, $active }) =>
    $active ? adminTeal : theme.colors.gray7};
`

export const EditorToggleIconWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.85;

  svg {
    width: 14px;
    height: 14px;
    display: block;
  }
`

export const EditorSaveStatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  flex-shrink: 0;
`

export const EditorOutlineSummaryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px 10px;
  margin-bottom: 10px;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  color: ${adminTextMuted};
  font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
`

export const EditorOutlineTree = styled.div`
  position: relative;
  display: grid;
  gap: 2px;
  padding-left: 8px;
  min-width: 0;

  > button {
    min-width: 0;
    width: 100%;
  }

  &::before {
    content: "";
    position: absolute;
    left: 3px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: ${adminBorder};
    pointer-events: none;
  }

  > button[data-active="true"] {
    position: relative;

    &::before {
      content: "";
      position: absolute;
      left: -6px;
      top: 5px;
      bottom: 5px;
      width: 2px;
      border-radius: 1px;
      background: ${adminTeal};
    }
  }
`

export const EditorStatusLeftGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  @media (max-width: 1180px) {
    display: none;
  }
`

export const EditorStatusBreadcrumb = styled.span`
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.gray10};
  font: 550 11.5px/1.2 var(--aq-font-sans);

  @media (max-width: 1180px) {
    display: none;
  }
`

export const EditorStatusRightGroup = styled.div`
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  color: ${adminTextMuted};
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  @media (max-width: 820px) {
    display: none;
  }
`

export const EditorStatusWarningBadge = styled.span`
  padding: 1px 7px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.orange7};
  background: ${adminSurfaceMuted};
  color: ${({ theme }) => theme.colors.orange11};
`

export const EditorTagRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-height: 26px;
`

export const SelectedTagChip = styled.span`
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  min-height: 24px;
  border-radius: 4px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};
  overflow: hidden;

  .label {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 7px;
    color: inherit;
    font: 650 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    min-width: 22px;
    padding: 0 5px;
    border: 0;
    border-left: 1px solid ${adminBorder};
    background: transparent;
    color: ${adminTextMuted};
    cursor: pointer;
    flex: 0 0 auto;
    font-size: 0.94rem;
    line-height: 1;

    &:hover {
      color: ${adminTextPrimary};
      background: ${adminSurface};
    }

    &:focus-visible {
      color: ${adminTextPrimary};
      outline: 2px solid currentColor;
      outline-offset: -2px;
    }

    @media (max-width: 768px), (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
    }
  }
`

export const InlineMetaInput = styled.input`
  width: auto;
  max-width: 100%;
  box-sizing: border-box;
  flex: 0 1 148px;
  min-width: 116px;
  border: 0;
  border-bottom: 1px solid transparent;
  outline: none;
  min-height: 28px;
  padding: 0 0.12rem;
  border-radius: 0;
  background: transparent;
  color: ${adminTextPrimary};
  font-size: 0.84rem;
  font-weight: 500;

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    font-size: 16px;
  }

  &::placeholder {
    color: ${adminTextMuted};
  }

  &:hover {
    border-bottom-color: ${adminBorder};
  }

  &:focus-visible {
    outline: none;
    border-bottom-color: ${adminTeal};
  }
`

export const EditorInspectorTagInputRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;

  input {
    min-width: 0;
    flex: 1 1 auto;
    width: auto;
    min-height: 38px;
    box-sizing: border-box;
    border: 1px solid ${adminBorder};
    border-radius: 6px;
    background: ${adminSurface};
    color: ${adminTextPrimary};
    font-size: 0.85rem;
    padding: 0 10px;

    @media (max-width: 820px), (pointer: coarse) {
      min-height: 44px;
      font-size: 16px;
    }

    &:focus-visible {
      outline: none;
      border-color: ${adminBorderStrong};
      box-shadow: ${({ theme }) => adminFocusRing(theme)};
    }
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: auto;
    min-width: 38px;
    min-height: 38px;
    flex: 0 0 auto;
    border: 1px solid ${adminBorder};
    border-radius: 6px;
    padding: 0 11px;
    background: ${adminSurface};
    color: ${adminTextSecondary};
    cursor: pointer;
    white-space: nowrap;

    @media (max-width: 820px), (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
    }

    &:hover:not(:disabled) {
      border-color: ${adminBorderStrong};
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }

    &:focus-visible {
      outline: none;
      border-color: ${adminBorderStrong};
      box-shadow: ${({ theme }) => adminFocusRing(theme)};
    }
  }
`
