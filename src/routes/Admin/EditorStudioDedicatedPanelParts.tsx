/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/post-settings-sidebar.tsx (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/sheet.tsx (MIT License, Copyright (c) shadcn)
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
  adminShellSurface,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export {
  EditorGuideBackdrop,
  EditorGuideBody,
  EditorGuideGrid,
  EditorGuidePanel,
  EditorGuideRepo,
  EditorStudioGuideModal,
} from "./EditorStudioGuideModal"

export const EditorStudioStatusBar = styled.footer<{ $sidebarsOpen?: boolean }>`
  position: absolute;
  right: 20px;
  bottom: 16px;
  pointer-events: none;
  z-index: 16;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  padding: 4px 13px;
  border: 1px solid ${adminBorder};
  border-radius: 9999px;
  background: ${adminSurface};
  box-shadow: 0 2px 10px ${boxShadowColor.subtleHover};
  color: ${adminTextSecondary};
  font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-variant-numeric: tabular-nums;
  user-select: none;

  &[data-writing-focus="hidden"] {
    opacity: 0.48;
  }

  &:hover {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 0.22s ease, bottom 0.18s ease;
  }

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  @media (max-width: 1100px) {
    bottom: ${({ $sidebarsOpen }) => ($sidebarsOpen ? "68px" : "16px")};
    right: 16px;
  }

  @media (max-width: 820px) {
    display: none;
  }
`

export const EditorStudioDedicatedCanvasSection = styled.section`
  --compose-pane-readable-width: var(--article-readable-width, 46.5rem);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: auto;
  min-height: 0;
  display: grid;
  gap: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;
  box-shadow: none;

  @media (max-width: 820px) {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0;
  }
`

export const EditorPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin: 0 0 12px;
  border-bottom: 1px solid ${adminBorderSubtle};

  h3 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 13.5px;
    font-weight: 650;
    letter-spacing: -0.015em;
  }

  button {
    border: 0;
    background: transparent;
    color: ${adminTextMuted};
    cursor: pointer;
    padding: 5px;
    font-size: 14px;
    line-height: 1;
    border-radius: 6px;
    ${focusVisibleRing}
    @media (max-width: 768px), (pointer: coarse) {
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    &:hover {
      color: ${adminTextPrimary};
      background: ${adminSurfaceMuted};
    }
  }
`

export const EditorOutline = styled.aside`
  min-width: 0;
  margin: 0;
  padding: 18px 16px 24px;
  border: 0;
  border-right: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: ${adminShellSurface};
  box-shadow: none;
  overflow: auto;
  overscroll-behavior: contain;

  h3 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 13.5px;
    font-weight: 650;
    letter-spacing: -0.015em;
  }

  p {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.82rem;
    line-height: 1.6;
  }

  @media (max-width: 820px) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    z-index: ${zIndexes.mobileSheet};
    max-height: min(72dvh, 520px);
    border: 0;
    border-top: 1px solid ${adminBorderStrong};
    border-radius: 12px 12px 0 0;
    background: ${adminSurface};
    box-shadow: 0 -16px 40px ${boxShadowColor.bottomSheet};
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));

    &::before {
      content: "";
      display: block;
      width: 36px;
      height: 4px;
      margin: 0 auto 10px;
      border-radius: 999px;
      background: ${adminBorderStrong};
    }
  }
`

export const EditorOutlineItem = styled.button`
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  color: ${adminTextSecondary};
  font-size: 13px;
  line-height: 1.4;
  @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }

  &:hover {
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &[data-level="1"] strong { font-weight: 600; font-size: 13px; color: ${adminTextPrimary}; }
  &[data-level="2"] { padding-left: 18px; font-size: 12.5px; }
  &[data-level="3"] { padding-left: 28px; font-size: 12px; color: ${adminTextMuted}; }
  &[data-level="4"] { padding-left: 38px; font-size: 11.5px; color: ${adminTextMuted}; }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  &[data-active="true"] {
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
    font-weight: 600;
  }

  &[data-active="true"] strong {
    color: ${adminTextPrimary};
    font-weight: 650;
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 20px;
    padding: 0;
    border: 0;
    background: transparent;
    font: 600 10.5px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: ${adminTextMuted};
    flex-shrink: 0;
  }

  &[data-active="true"] span {
    color: ${adminTextPrimary};
  }

  strong {
    min-width: 0;
    font-weight: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const LocalDraftRestoreCard = styled.div`
  display: grid;
  gap: 8px;
  padding: 11px 14px;
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid ${adminBorderStrong};
  background: ${adminSurfaceRaised};
  box-shadow: 0 1px 3px ${boxShadowColor.cardSubtle};
  box-sizing: border-box;

  .card-header {
    font-size: 0.84rem;
    font-weight: 600;
    color: ${adminTextPrimary};
    line-height: 1.4;
  }

  select {
    width: 100%;
    min-height: 38px;
    padding: 6px 10px;
    font-size: 0.84rem;
    border-radius: 6px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextPrimary};
    box-sizing: border-box;
    ${focusVisibleRing}
    @media (max-width: 768px), (pointer: coarse) { min-height: 44px; font-size: 16px; }
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    button {
      font-size: 0.78rem;
      padding: 5px 10px;
      ${focusVisibleRing}
      @media (max-width: 768px), (pointer: coarse) { min-height: 44px; min-width: 44px; }
    }
  }
`

export const EditorInspector = styled.aside`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 0;
  padding: 20px;
  border: 0;
  border-left: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: ${adminSurface};
  box-shadow: none;
  overflow: auto;
  overscroll-behavior: contain;

  h3 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 13.5px;
    font-weight: 650;
    letter-spacing: -0.015em;
  }

  > label > span,
  > section > span {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  > label,
  > section {
    display: grid;
    gap: 8px;
    padding: 0 0 20px;
    margin: 0;
    border: 0;
    border-bottom: 1px solid ${adminBorderSubtle};
    border-radius: 0;
    background: transparent;
  }

  > *:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  small {
    justify-self: end;
    color: ${adminTextMuted};
    font-size: 0.75rem;
    line-height: 1.4;
  }

  select,
  textarea {
    width: 100%;
    border: 1px solid ${adminBorder};
    border-radius: 6px;
    background: ${adminSurface};
    color: ${adminTextPrimary};
    font-size: 0.85rem;
    padding: 8px 10px;
    box-sizing: border-box;

    &:focus-visible {
      outline: none;
      border-color: ${adminBorderStrong};
      box-shadow: ${({ theme }) => adminFocusRing(theme)};
    }
  }

  select {
    min-height: 38px;
    @media (max-width: 768px), (pointer: coarse) { min-height: 44px; }
  }

  textarea {
    min-height: 82px;
    resize: vertical;
    line-height: 1.58;
  }

  @media (pointer: coarse) {
    select,
    textarea {
      font-size: 1rem;
    }
  }

  p {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    margin: 10px 0 0;
    font-size: 0.82rem;
    color: ${adminTextSecondary};
  }

  @media (max-width: 1100px) {
    grid-column: 1 / -1;
    margin: 0;
    border-left: 0;
    border-top: 1px solid ${adminBorder};
    max-height: min(38vh, 360px);
  }

  @media (max-width: 820px) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
    z-index: ${zIndexes.mobileSheet};
    max-height: min(78dvh, 580px);
    border: 0;
    border-top: 1px solid ${adminBorderStrong};
    border-radius: 12px 12px 0 0;
    background: ${adminSurface};
    box-shadow: 0 -16px 40px ${boxShadowColor.bottomSheet};
    padding: 12px 16px calc(20px + env(safe-area-inset-bottom, 0px));

    &::before {
      content: "";
      display: block;
      width: 36px;
      height: 4px;
      margin: 0 auto 10px;
      border-radius: 999px;
      background: ${adminBorderStrong};
    }

    select,
    textarea {
      font-size: 16px;
    }
  }
`

export const EditorHeaderMetaRow = styled.div<{
  $collapsedOnMobile?: boolean
  $collapsedWhenInspectorOpen?: boolean
}>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
  margin-top: 12px;

  @media (min-width: 1101px) {
    input {
      ${({ $collapsedWhenInspectorOpen }) =>
        $collapsedWhenInspectorOpen ? "max-width: 160px;" : "display: inline-flex;"}
    }
  }

  @media (max-width: 820px) {
    ${({ $collapsedOnMobile }) => ($collapsedOnMobile ? "display: none;" : "display: flex;")}
  }
`

export const EditorHiddenFileInput = styled.input`
  display: none;
`

export const EditorStudioTopBarLead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  @media (max-width: 820px) {
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`

export const EditorHeaderMetaPill = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
`
