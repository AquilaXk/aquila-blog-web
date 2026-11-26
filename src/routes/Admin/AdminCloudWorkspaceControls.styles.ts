/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetsGrid.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - TryGhost/Ghost apps/shade/src/components/layout/view-bar.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminActionGroupLightSurface,
  adminBorder as border,
  adminBorderStrong as borderStrong,
  adminBorderSubtle as borderSubtle,
  adminCardShadow,
  adminCloudSelectionAccent,
  adminControlText as controlText,
  adminDisabledBg,
  adminDisabledBorder,
  adminDisabledFg,
  adminGoldTintFocus,
  adminSurface as surface,
  adminSurfaceAccent as surfaceAccent,
  adminSurfaceMuted as surfaceMuted,
  adminSurfaceRaised as surfaceRaised,
  adminTeal as accentTeal,
  adminTealHover as accentTealHover,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"

export const CloudHeaderActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
  min-width: 0;
`

export const UploadIconBadge = styled.span`
  width: 20px;
  height: 20px;
  min-width: 20px;
  border: 0;
  background: transparent;
  color: ${textSecondary};
  display: inline-grid;
  place-items: center;
`

export const SelectAllLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  padding: 0 0.35rem 0 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${textSecondary};
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  font-variant-numeric: tabular-nums;
  &:hover {
    color: ${textPrimary};
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const CloudSearchField = styled.label`
  position: relative;
  display: flex;
  align-items: center;
  width: auto;
  max-width: 24rem;
  flex: 1 1 15rem;
  min-width: 10.5rem;
  @media (max-width: 960px) {
    flex: 1 1 100%;
    max-width: none;
    width: 100%;
  }
  svg {
    position: absolute;
    left: 0.72rem;
    width: 0.92rem;
    height: 0.92rem;
    color: ${textMuted};
    pointer-events: none;
  }
`

export const SearchTrailing = styled.span`
  position: absolute;
  right: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
`

export const SearchDetail = styled.span`
  color: ${textMuted};
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
`

export const SearchClearButton = styled.button`
  border: 0;
  border-radius: 5px;
  padding: 0.16rem 0.42rem;
  background: ${surface};
  color: ${textSecondary};
  font-size: 0.71rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: ${adminCardShadow};
  ${focusVisibleRing}
  &:hover,
  &:focus-visible {
    color: ${textPrimary};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
`

export const SortSelect = styled.select`
  min-height: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 0.52rem;
  background: ${surfaceMuted};
  color: ${textPrimary};
  font-size: 0.79rem;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
  &:hover {
    background: ${surfaceRaised};
    border-color: ${border};
  }
  @media (pointer: coarse) {
    height: auto;
    min-height: 44px;
    min-width: 44px;
    font-size: 1rem;
  }
  &:focus-visible {
    outline: none;
    background: ${surface};
    border-color: ${accentTeal};
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
`

export const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 0.65rem;
  min-width: 0;
  margin-bottom: 0.85rem;
  padding: 0.35rem 0 0.65rem;
  border: none;
  border-bottom: 1px solid ${borderSubtle};
  border-radius: 0;
  background: transparent;
  @media (min-width: 1120px) {
    &:not([data-pagination="true"]) {
      flex-wrap: nowrap;
    }
  }
  &[data-pagination="true"] {
    margin-top: 1rem;
    margin-bottom: 0;
    padding: 0.75rem 0 0;
    border-bottom: none;
    border-top: 1px solid ${borderSubtle};
  }
`

export const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex-wrap: wrap;
  &[data-slot="view-bar-nav"] {
    flex: 1 1 0%;
    min-width: 0;
    @media (min-width: 1120px) {
      flex-wrap: nowrap;
    }
  }
  &[data-align="end"] {
    justify-content: flex-end;
    margin-left: auto;
    flex-shrink: 0;
  }
  @media (max-width: 960px) {
    &[data-slot="view-bar-nav"] {
      flex: 1 1 100%;
      width: 100%;
    }
    &[data-align="end"] {
      flex: 1 1 100%;
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
    }
  }
`

export const UploadInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`

export const PrimaryButton = styled.button`
  border: 1px solid ${accentTeal};
  border-radius: 8px;
  height: 36px;
  min-height: 36px;
  max-height: 38px;
  padding: 0 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  background: ${accentTeal};
  color: ${controlText};
  font-size: 0.81rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
  &:hover:not(:disabled) {
    background: ${accentTealHover};
    border-color: ${accentTealHover};
  }
  @media (pointer: coarse) {
    height: auto;
    min-height: 44px;
    max-height: none;
    min-width: 44px;
  }
  &:disabled {
    cursor: not-allowed;
    border-color: ${adminDisabledBorder};
    background: ${adminDisabledBg};
    color: ${adminDisabledFg};
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
`

export const SecondaryButton = styled.button`
  border: 1px solid ${border};
  border-radius: 8px;
  min-height: 34px;
  padding: 0 0.64rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  background: ${surface};
  color: ${textPrimary};
  font-size: 0.79rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}
  &:hover:not(:disabled) {
    border-color: ${borderStrong};
    background: ${surfaceMuted};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
  &:disabled {
    cursor: not-allowed;
    background: transparent;
    border-color: ${borderSubtle};
    color: ${textMuted};
    opacity: 0.6;
  }
`

export const IconButton = styled.button`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${textSecondary};
  cursor: pointer;
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
  &:hover,
  &:focus-visible {
    background: ${surfaceMuted};
    color: ${textPrimary};
  }
  &[data-active="true"] {
    color: ${textPrimary};
    background: ${surfaceAccent};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
`

export const ViewModeButton = styled.button`
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 0.56rem;
  background: ${surfaceMuted};
  color: ${textSecondary};
  font-size: 0.79rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
  &:hover {
    color: ${textPrimary};
    background: ${surfaceRaised};
    border-color: ${border};
  }
  &[data-active="true"] {
    color: ${controlText};
    border-color: transparent;
    background: ${accentTeal};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
`

export const FilterGroup = styled.div`
  display: inline-flex;
  gap: 0.16rem;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 0.18rem;
  border-radius: 8px;
  border: none;
  background: ${surfaceMuted};
  @media (min-width: 640px) {
    flex-wrap: nowrap;
  }
`

export const GhostButton = styled.button`
  border: 0;
  border-radius: 6px;
  min-height: 28px;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  background: transparent;
  color: ${textSecondary};
  font-size: 0.77rem;
  font-weight: 650;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
  &:hover,
  &:focus-visible {
    color: ${textPrimary};
  }
  &[data-active="true"] {
    background: ${surface};
    color: ${textPrimary};
    box-shadow: ${adminCardShadow};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

export const Notice = styled.p`
  margin: 0;
  max-width: min(22rem, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${textSecondary};
  font-size: 0.77rem;
  font-weight: 600;
`

export const FileTableScroll = styled.div`
  min-width: 0;
  overflow-x: visible;
`

export const SelectBoxCell = styled.td`
  width: 2.75rem;
`

export const RowCheckbox = styled.input`
  width: 1rem;
  height: 1rem;
  margin: 0;
  cursor: pointer;
  accent-color: ${accentTeal};
  ${focusVisibleRing}
  @media (pointer: coarse) {
    min-width: 22px;
    min-height: 22px;
  }
`

export const FileTypeIcon = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 18px;
  border: 0;
  border-radius: 4px;
  padding: 0.1rem 0.42rem;
  background: ${surfaceMuted};
  color: ${textPrimary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  white-space: nowrap;
`

export const FileIdentity = styled.div`
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  min-width: 0;
`

export const FileNameStack = styled.div`
  display: grid;
  gap: 0.18rem;
  min-width: 0;
`

export const FileMetaLine = styled.span`
  display: flex;
  align-items: center;
  gap: 0.38rem;
  min-width: 0;
  color: ${textSecondary};
  font-size: 0.74rem;
  font-weight: 600;
  > span:not([data-folder-badge]) {
    flex-shrink: 0;
    white-space: nowrap;
  }
  > span[data-folder-badge="true"] {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const FileNameButton = styled.button`
  border: 0;
  border-radius: 4px;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  background: transparent;
  color: ${textPrimary};
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 700;
  text-align: left;
  ${focusVisibleRing}
  strong {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const EmptyState = styled.div`
  display: grid;
  place-items: center;
  gap: 0.45rem;
  min-height: 10rem;
  padding: 1.4rem;
  text-align: center;
  color: ${textSecondary};
  strong {
    color: ${textPrimary};
    font-size: 0.92rem;
  }
  p {
    margin: 0;
    color: ${textSecondary};
    font-size: 0.8rem;
    line-height: 1.5;
  }
`

export const AssetGridCardCheckboxOverlay = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid ${border};
  border-radius: 5px;
  background: ${surface};
  box-shadow: ${adminCardShadow};
  opacity: 0;
  transition: opacity 140ms ease;
  &[data-checked="true"] {
    opacity: 1;
  }
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    opacity: 1;
  }
`
