/**
 * 참조 구현:
 * - TryGhost/Ghost apps/admin/src/editor/{editor-screen.tsx,post-editor.tsx,editor-header-actions.tsx,editor-status.tsx} (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/button.tsx (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import { boxShadowColor } from "src/design-system/tokens"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminFocusRing,
  adminStatusDangerBg,
  adminStatusDangerBorder,
  adminStatusDangerText,
  adminStatusSuccessBg,
  adminStatusSuccessBorder,
  adminStatusSuccessText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminSystemThemeVariables,
  adminTeal,
  adminTealBorder,
  adminTealBorderHover,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export const EditorStudioRoot = styled.div`
  ${({ theme }) => adminSystemThemeVariables(theme)}
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  height: 100vh;
  min-height: 100vh;
  height: 100dvh;
  min-height: 100dvh;
  padding: 0;
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
  overflow-x: clip;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  color: ${adminTextPrimary};

  @media (max-width: 820px) {
    grid-template-rows: auto minmax(0, 1fr);
  }
`

export const EditorStudioPageHeading = styled.h1`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`

export const EditorStudioLoadingState = styled.div`
  min-height: calc(100vh - 10rem);
  display: grid;
  place-content: center;
  gap: 0.4rem;
  text-align: center;

  strong {
    color: ${adminTextPrimary};
    font-size: 1.1rem;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.9rem;
  }
`

export const EditorStudioDedicatedTopBar = styled.header`
  width: 100%;
  height: 56px;
  min-height: 56px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 0 24px;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: ${adminSurface};

  @media (max-width: 820px) {
    height: auto;
    min-height: 46px;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 4px 8px;
    padding: 6px 12px;
    border-bottom: 1px solid ${adminBorder};

    > *:last-child {
      grid-column: 1 / -1;
      width: 100%;
    }
  }
`

export const EditorExitAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  min-height: 34px;
  width: max-content;
  padding: 0 10px 0 8px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 0.16s ease, color 0.16s ease;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }

  @media (hover: hover) {
    &:hover {
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }
`

export const EditorStudioTopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;

  button {
    height: 34px;
    min-height: 34px;
    padding: 0 12px;
  }

  @media (max-width: 820px) {
    grid-column: 1 / -1;
    width: 100%;
    justify-self: stretch;
    margin-left: 0;
    justify-content: flex-end;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-top: 2px;

    button {
      height: 36px;
      min-height: 36px;
      padding: 0 10px;
      font-size: 0.78rem;
      white-space: nowrap;
      flex-shrink: 0;
    }
  }

  @media (pointer: coarse) {
    button {
      height: auto;
      min-height: 44px;
    }
  }
`

export const EditorStudioSaveState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${adminTextMuted};
  font: 500 12px/1.2 var(--aq-font-sans);
  white-space: nowrap;

  &[data-tone="success"] {
    color: ${adminStatusSuccessText};
  }

  &[data-tone="loading"] {
    color: ${adminTextPrimary};
  }

  &[data-tone="error"] {
    color: ${adminStatusDangerText};
  }

  @media (max-width: 820px) {
    justify-self: end;
    font-size: 11px;
  }
`

const Button = styled.button`
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  padding: 0.48rem 0.88rem;
  min-height: 36px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 550;

  @media (pointer: coarse) {
    min-height: 44px;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition:
      border-color 0.16s ease,
      background-color 0.16s ease,
      color 0.16s ease,
      box-shadow 0.16s ease;
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

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`

export const PrimaryButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 14px;
  border-color: ${adminTealBorder};
  background: ${adminTeal};
  color: ${adminControlText};
  font-weight: 600;

  &:hover:not(:disabled) {
    border-color: ${adminTealBorderHover};
    background: ${adminTealHover};
    color: ${adminControlText};
  }
`

export const SecondaryButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  border-color: ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-weight: 550;

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
  }
`

export const EditorSidebarToggleButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${({ $active }) => ($active ? adminTextPrimary : adminTextSecondary)};
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }

  &[aria-pressed="true"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  @media (hover: hover) {
    &:hover {
      color: ${adminTextPrimary};
      background: ${adminSurfaceMuted};
    }

    &[aria-pressed="true"]:hover {
      border-color: ${adminBorderStrong};
      background: ${adminSurfaceMuted};
      color: ${adminTextPrimary};
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  @media (pointer: coarse) {
    height: auto;
    min-height: 44px;
  }

  @media (max-width: 820px) {
    &[data-mobile-hidden="true"] {
      display: none;
    }
  }
`

export const EditorStudioFrame = styled.div<{
  $showOutline?: boolean
  $showInspector?: boolean
}>`
  width: 100%;
  min-height: 0;
  margin: 0;
  display: grid;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  grid-template-columns: ${({ $showOutline = false, $showInspector = false }) => {
    if ($showOutline && $showInspector) return "268px minmax(0, 1fr) 340px"
    if ($showOutline && !$showInspector) return "268px minmax(0, 1fr)"
    if (!$showOutline && $showInspector) return "minmax(0, 1fr) 340px"
    return "minmax(0, 1fr)"
  }};
  gap: 0;
  align-items: stretch;
  overflow-x: clip;

  @media (max-width: 1100px) {
    grid-template-columns: ${({ $showOutline = false }) =>
      $showOutline ? "236px minmax(0, 1fr)" : "minmax(0, 1fr)"};
    grid-template-rows: minmax(0, 1fr) auto;
  }

  @media (max-width: 820px) {
    width: 100%;
    max-width: 100%;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    overflow-x: hidden;
    overflow-y: auto;
  }

  ${({ $showOutline = false, $showInspector = false }) =>
    $showOutline && $showInspector
      ? `
      @media (min-width: 1101px) and (max-width: 1440px) {
        [data-testid="markdown-editor-toolbar"] [data-mobile-hidden="true"] {
          display: none;
        }
      }
    `
      : ""}
`

export const EditorStudioWritingColumn = styled.section<{
  $zenMode?: boolean
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 0;
  overflow: hidden;
  max-width: 100%;
  margin: 0 auto;
  width: 100%;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  border-inline: 0;
`

export const EditorStudioDedicatedMetaSection = styled.section`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: auto;
  display: grid;
  gap: 0;
  border: 0;
  border-radius: 0;
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  padding: 36px 56px 0;

  @media (max-width: 820px) {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 16px 16px 6px;
  }
`

export {
  EditorMobileSheetScrim,
  EditorSectionEyebrow,
  EditorStudioPaperScrollSheet,
  EditorStudioToolbarDock,
  EditorVisibilityMonoPill,
  EditorInspectorTagInputRow,
  EditorTagRow,
  InlineMetaInput,
  SelectedTagChip,
} from "./EditorStudioEditorialStyles"

export const EditorInspectorFullWidthAction = styled(SecondaryButton)`
  width: 100%;
  margin-top: 8px;
  border-radius: 8px;
`

export const TitleInput = styled.textarea`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: auto;
  field-sizing: content;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0 0 4px;
  min-height: 50px;
  outline: none;
  background: transparent;
  box-shadow: none;
  color: ${({ theme }) => theme.colors.gray12};
  font-family: inherit;
  font-size: 42px;
  font-weight: 850;
  line-height: 1.16;
  letter-spacing: -0.035em;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &::placeholder {
    color: ${({ theme }) => theme.colors.gray9};
    opacity: 1;
  }

  &:focus {
    outline: none;
    box-shadow: none;
    border-bottom-color: transparent;
  }

  &:focus-visible {
    outline: none;
    box-shadow: none;
    border-bottom-color: ${adminTeal};
  }

  @media (max-width: 820px) {
    font-size: 26px;
    min-height: 34px;
    line-height: 1.28;
  }
`

export const MobilePropertiesToggle = styled.button<{ $visibleOnDesktop?: boolean }>`
  display: none;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid ${adminBorder};
  border-radius: 4px;
  padding: 4px 10px;
  margin-top: 8px;
  color: ${adminTextSecondary};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:focus-visible {
    outline: none;
    border-color: ${adminBorderStrong};
    box-shadow: ${({ theme }) => adminFocusRing(theme)};
  }

  @media (max-width: 820px) {
    display: inline-flex;
    min-height: 44px;
    min-width: 44px;
    margin-top: 6px;
  }
`

export const PublishNotice = styled.div`
  position: absolute;
  left: 50%;
  right: auto;
  top: 54px;
  bottom: auto;
  transform: translateX(-50%);
  z-index: 18;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
  margin: 0;
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.4;
  width: max-content;
  max-width: min(520px, calc(100% - 32px));
  box-sizing: border-box;
  box-shadow: 0 4px 16px ${boxShadowColor.cardHover};
  button { pointer-events: auto; }
  &[data-tone="idle"] { color: ${adminTextSecondary}; border: 1px solid ${adminBorder}; background: ${adminSurface}; }
  &[data-tone="loading"] { color: ${adminTextPrimary}; border: 1px solid ${adminBorderStrong}; background: ${adminSurfaceMuted}; }
  &[data-tone="success"] { color: ${adminStatusSuccessText}; border: 1px solid ${adminStatusSuccessBorder}; background: ${adminStatusSuccessBg}; }
  &[data-tone="error"] { color: ${adminStatusDangerText}; border: 1px solid ${adminStatusDangerBorder}; background: ${adminStatusDangerBg}; }
  @media (max-width: 820px) { max-width: calc(100% - 24px); top: 52px; }
`

export {
  EditorGuideBackdrop,
  EditorGuideBody,
  EditorGuideGrid,
  EditorGuidePanel,
  EditorGuideRepo,
  EditorHeaderMetaPill,
  EditorHeaderMetaRow,
  EditorHiddenFileInput,
  EditorInspector,
  EditorOutline,
  EditorOutlineItem,
  EditorPanelHeader,
  EditorStudioDedicatedCanvasSection,
  EditorStudioGuideModal,
  EditorStudioStatusBar,
  EditorStudioTopBarLead,
  LocalDraftRestoreCard,
} from "./EditorStudioDedicatedPanelParts"
