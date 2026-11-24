/**
 * 참조 구현:
 * - TryGhost/Ghost ghost/admin/app/components/editor/modals/publish-flow/ (MIT License, Copyright (c) Ghost Foundation)
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/ui/{button.tsx,sheet.tsx} (MIT License, Copyright (c) shadcn)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
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
  adminTeal,
  adminTealBorder,
  adminTealBorderHover,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

export {
  PublishDialog,
  PublishModalBackdrop,
  PublishModalBody,
  PublishModalFooter,
  PublishModalHeader,
} from "./EditorStudioPublishModalShellStyles"

export const PublishOverviewGrid = styled.div`
  display: grid;
  gap: 0.85rem;
`

export const VisibilityCard = styled.section`
  display: grid;
  gap: 0.65rem;
  align-content: start;
  background: transparent;
  padding: 0;

  > strong {
    color: ${adminTextPrimary};
    font-size: 0.88rem;
    font-weight: 650;
    letter-spacing: -0.01em;
    line-height: 1.35;
  }
`

export const SectionKicker = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  color: ${adminTextMuted};
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: -0.005em;
`

export const VisibilityOptionGrid = styled.div`
  display: grid;
  gap: 0.35rem;
`

export const VisibilityOptionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 46px;
  padding: 0.56rem 0.72rem;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
  ${focusVisibleRing}

  strong {
    color: ${adminTextPrimary};
    flex: 0 0 auto;
    font-size: 0.82rem;
    font-weight: 650;
    line-height: 1.3;
  }

  span {
    color: ${adminTextMuted};
    min-width: 0;
    font-size: 0.73rem;
    line-height: 1.35;
    text-align: right;
  }

  &[data-active="true"] {
    border-color: ${adminTealBorder};
    background: ${adminSurfaceMuted};
  }

  &:hover:not([data-active="true"]) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
  }
`

export const FieldHelp = styled.span`
  display: block;
  width: 100%;
  min-width: 0;
  color: ${adminTextMuted};
  font-size: 0.74rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;
`

export const PostPreviewSetup = styled.section`
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  padding: 0.95rem 0 0;
`

export const OptionalCoverDisclosure = styled.details`
  display: grid;
  gap: 0.75rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;

  &[open] > summary {
    padding-bottom: 0.62rem;
    border-bottom: 1px solid ${adminBorderSubtle};
  }
`

export const OptionalCoverSummary = styled.summary`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 44px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  border-radius: 6px;
  ${focusVisibleRing}

  &::-webkit-details-marker {
    display: none;
  }

  > div {
    display: grid;
    gap: 0.16rem;
    min-width: 0;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.86rem;
    font-weight: 650;
    line-height: 1.3;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.74rem;
    line-height: 1.45;
  }

  > em {
    flex: 0 0 auto;
    font-style: normal;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid ${adminBorder};
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
  }
`

export const PostPreviewHeader = styled.div`
  display: grid;
  gap: 0.18rem;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.9rem;
    font-weight: 650;
    line-height: 1.3;
  }

  span {
    color: ${adminTextSecondary};
    font-size: 0.76rem;
    line-height: 1.45;
  }
`

export const PreviewEditorGrid = styled.div`
  display: grid;
  gap: 0.85rem;
  overscroll-behavior: contain;

  @media (min-width: 840px) {
    grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
    align-items: start;
  }

  [data-variant="drawer"] & {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const CompactPublishEditorStack = styled.div`
  display: grid;
  gap: 0;
  max-height: min(78dvh, 580px);
  overscroll-behavior: contain;
`

export const CompactPublishEditorCard = styled.div`
  display: grid;
  gap: 0.62rem;
  max-height: min(72dvh, 520px);
  overscroll-behavior: contain;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  padding: 0.68rem 0;

  &:last-of-type {
    border-bottom: 0;
  }
`

export const CompactPublishEditorToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  width: 100%;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  ${focusVisibleRing}

  > div {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.85rem;
    font-weight: 650;
    line-height: 1.3;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.75rem;
    line-height: 1.45;
  }

  > span:last-of-type {
    flex: 0 0 auto;
    color: ${adminTextPrimary};
    font-weight: 600;
  }
`

export const PublishModalNotice = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin: 0;
  padding: 0.58rem 0.75rem;
  border-radius: 6px;
  font-size: 0.82rem;
  line-height: 1.4;
  width: 100%;
  box-sizing: border-box;

  &[data-tone="idle"] {
    color: ${adminTextSecondary};
    border: 1px solid ${adminBorder};
    background: ${adminSurfaceRaised};
  }

  &[data-tone="loading"] {
    color: ${adminTextPrimary};
    border: 1px solid ${adminBorderStrong};
    background: ${adminSurfaceMuted};
  }

  &[data-tone="success"] {
    color: ${adminStatusSuccessText};
    border: 1px solid ${adminStatusSuccessBorder};
    background: ${adminStatusSuccessBg};
  }

  &[data-tone="error"] {
    color: ${adminStatusDangerText};
    border: 1px solid ${adminStatusDangerBorder};
    background: ${adminStatusDangerBg};
  }

  @media (max-width: 720px) {
    width: 100%;
  }
`

export const PublishButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;

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

  @media (pointer: coarse) {
    height: 44px;
    min-height: 44px;
  }
`

export const PublishPrimaryButton = styled(PublishButton)`
  border-color: ${adminTealBorder};
  background: ${adminTeal};
  color: ${adminControlText};
  font-weight: 500;

  &:hover:not(:disabled) {
    border-color: ${adminTealBorderHover};
    background: ${adminTealHover};
    color: ${adminControlText};
  }
`
