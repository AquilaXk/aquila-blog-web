/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/AssetsPage.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/ViewToggle.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - TryGhost/Ghost apps/shade/src/components/layout/view-bar.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminAppBackground as appBackground,
  adminBorder as border,
  adminBorderStrong as borderStrong,
  adminBorderSubtle as borderSubtle,
  adminCardShadow,
  adminCheckerboardBackground,
  adminCloudSelectionAccent,
  adminFloatingShadow,
  adminGoldTintFocus,
  adminSurface as surface,
  adminSurfaceAccent as surfaceAccent,
  adminSurfaceMuted as surfaceMuted,
  adminSurfaceRaised as surfaceRaised,
  adminTeal as accentTeal,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"
import { zIndexes } from "src/styles/zIndexes"
import {
  GhostButton as BaseGhostButton,
  IconButton as BaseIconButton,
  PrimaryButton as BasePrimaryButton,
  SecondaryButton as BaseSecondaryButton,
  SortSelect as BaseSortSelect,
  ViewModeButton as BaseViewModeButton,
} from "./AdminCloudWorkspaceControls.styles"
import { ToastViewport as BaseToastViewport } from "./AdminCloudWorkspaceDetail.styles"

export * from "./AdminCloudWorkspaceControls.styles"
export * from "./AdminCloudWorkspaceDetail.styles"

export const PrimaryButton = BasePrimaryButton
export const SecondaryButton = BaseSecondaryButton
export const SortSelect = BaseSortSelect
export const ViewModeButton = BaseViewModeButton
export const IconButton = BaseIconButton
export const GhostButton = BaseGhostButton

export const ToastViewport = styled(BaseToastViewport)`
  box-shadow: ${adminFloatingShadow};
`

export const CloudMain = styled.div`
  display: grid;
  min-width: 0;
  color: ${textPrimary};
  background: ${appBackground};
`

export const CloudWorkspace = styled.section`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: calc(100vh - var(--app-header-height, 48px));
  &[data-detail-open="true"][data-detail-mode="inline"] {
    grid-template-columns: minmax(0, 1fr) minmax(21rem, 24rem);
  }
  &[data-detail-open="true"][data-detail-mode="drawer"] {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (max-width: 1279px) {
    &[data-detail-open="true"][data-detail-mode] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

export const CloudContent = styled.div`
  position: relative;
  display: grid;
  align-content: start;
  min-width: 0;
  padding: 1.35rem 1.75rem 3.5rem;
  background: ${surface};
  transition: background-color 140ms ease, box-shadow 140ms ease;
  &[data-drag-active="true"] {
    background: ${surfaceAccent};
    box-shadow: inset 0 0 0 2px ${accentTeal};
  }
  @media (max-width: 820px) {
    padding: 1rem 0.95rem 3rem;
  }
`

export const CloudDropOverlay = styled.div`
  position: absolute;
  inset: 0.75rem;
  z-index: ${zIndexes.header};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 2px dashed ${accentTeal};
  border-radius: 12px;
  background: color-mix(in srgb, ${surfaceAccent} 92%, transparent);
  color: ${textPrimary};
  pointer-events: none;
  text-align: center;

  strong {
    font-size: 0.95rem;
    font-weight: 700;
  }

  span {
    color: ${textMuted};
    font-size: 0.8rem;
    font-weight: 500;
  }
`

export const CloudTitleBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  > div:first-of-type {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.24rem;
    min-width: 0;
  }
  h1,
  h2 {
    margin: 0;
    color: ${textPrimary};
    font-size: 1.45rem;
    line-height: 1.2;
    font-weight: 780;
    letter-spacing: -0.025em;
  }
  @media (max-width: 640px) {
    align-items: flex-start;
    flex-wrap: wrap;
  }
`

export const CloudFacetStrip = styled.p`
  margin: 0;
  display: inline-flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  align-items: center;
  color: ${textSecondary};
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
`

export const CloudPaginationLabel = styled.span`
  font-size: 0.8rem;
  color: ${textSecondary};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

export const SearchInput = styled.input`
  width: 100%;
  min-height: 34px;
  height: 34px;
  border: 1px solid ${border};
  border-radius: 8px;
  padding: 0 2.2rem 0 2.1rem;
  background: ${surface};
  color: ${textPrimary};
  font-size: 0.81rem;
  font-weight: 500;
  transition: background-color 140ms ease, border-color 140ms ease;
  &::placeholder {
    color: ${textMuted};
  }
  &:hover {
    border-color: ${borderStrong};
  }
  &:focus-visible {
    outline: none;
    border-color: ${accentTeal};
    background: ${surface};
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    height: auto;
    font-size: 1rem;
  }
`

export const FileTable = styled.table`
  width: 100%;
  min-width: 0;
  border-collapse: separate;
  border-spacing: 0;
  display: grid;
  color: ${textPrimary};
  border: 1px solid ${borderSubtle};
  border-radius: 10px;
  overflow: hidden;
  background: ${surface};

  thead {
    display: block;
    border-bottom: 1px solid ${borderSubtle};
    background: ${surfaceRaised};
  }
  thead tr {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr) 6rem 10.5rem;
    gap: 0.75rem;
    align-items: center;
    min-height: 2.3rem;
    padding: 0 0.75rem;
  }
  tbody {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
  th,
  td {
    text-align: left;
    vertical-align: middle;
  }
  th {
    height: auto;
    padding: 0;
    color: ${textMuted};
    background: transparent;
    font-size: 0.73rem;
    font-weight: 650;
  }
  th:nth-of-type(1) {
    font-size: 0;
    color: transparent;
  }
  th:nth-of-type(3),
  th:nth-of-type(4) {
    text-align: right;
    justify-self: end;
  }
  td {
    height: auto;
    min-width: 0;
    padding: 0;
    color: ${textSecondary};
    font-size: 0.82rem;
    font-weight: 600;
  }
  tbody tr {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr) 6rem 10.5rem;
    gap: 0.75rem;
    align-items: center;
    min-width: 0;
    min-height: 3.35rem;
    border: 0;
    border-bottom: 1px solid ${borderSubtle};
    padding: 0.45rem 0.75rem;
    background: ${surface};
    transition: background 140ms ease;
    &:last-of-type {
      border-bottom: 0;
    }
  }
  tbody tr[data-loading-row="true"] {
    grid-template-columns: minmax(0, 1fr);
    min-height: 12rem;
  }
  tbody tr[data-loading-row="true"] td {
    grid-column: 1 / -1;
  }
  tbody tr:not([data-loading-row="true"]):hover,
  tbody tr:not([data-loading-row="true"]):focus-within {
    background: ${surfaceRaised};
  }
  tbody tr[data-selected="true"],
  tbody tr[data-selected="true"]:hover,
  tbody tr[data-selected="true"]:focus-within {
    background: ${surfaceMuted};
  }
  tbody tr td:first-of-type {
    align-self: stretch;
    border-left: 2px solid transparent;
    padding-left: 0.35rem;
  }
  tbody tr:not([data-loading-row="true"]) td:first-of-type {
    display: flex;
    align-items: center;
  }
  tbody tr[data-selected="true"] td:first-of-type {
    border-left-color: ${adminCloudSelectionAccent};
  }
  td:nth-of-type(1) {
    grid-column: 1;
    grid-row: 1;
  }
  td:nth-of-type(2) {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
  }
  td:nth-of-type(3),
  td:nth-of-type(4) {
    align-self: center;
    justify-self: end;
    color: ${textSecondary};
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td:nth-of-type(3) {
    grid-column: 3;
    grid-row: 1;
  }
  td:nth-of-type(4) {
    grid-column: 4;
    grid-row: 1;
  }
  @media (max-width: 720px) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    tbody tr {
      grid-template-columns: 2.75rem minmax(0, 1fr) auto;
      gap: 0.25rem 0.5rem;
    }
    tbody tr td:first-of-type {
      padding-left: 0;
      justify-content: center;
    }
    td:nth-of-type(2) {
      grid-column: 2 / 4;
      grid-row: 1;
    }
    td:nth-of-type(3) {
      grid-column: 2;
      grid-row: 2;
      justify-self: start;
    }
    td:nth-of-type(4) {
      grid-column: 3;
      grid-row: 2;
      justify-self: end;
    }
  }
`

export const FileThumbnailFrame = styled.span`
  width: 42px;
  height: 42px;
  min-width: 42px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  background: ${adminCheckerboardBackground};
  color: ${textSecondary};
  &[data-fallback="true"] {
    background: ${surfaceMuted};
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  img[data-fit="contain"] {
    object-fit: contain;
  }
  svg {
    width: 18px;
    height: 18px;
  }
`

export const SkeletonRow = styled.span`
  display: block;
  height: 0.75rem;
  border-radius: 4px;
  background: ${surfaceMuted};
  animation: admin-cloud-skeleton 1.2s ease-in-out infinite;
  &:nth-of-type(2) {
    width: 78%;
  }
  &:nth-of-type(3) {
    width: 58%;
  }
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.78;
  }
  @keyframes admin-cloud-skeleton {
    0%, 100% {
      opacity: 0.65;
    }
    50% {
      opacity: 1;
    }
  }
`

export const ViewToggleTrack = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.16rem;
  padding: 0.18rem;
  border-radius: 8px;
  border: none;
  background: ${surfaceMuted};
`

export const ViewToggleSegment = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 28px;
  padding: 0 0.48rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${textSecondary};
  cursor: pointer;
  ${focusVisibleRing}
  &:hover {
    color: ${textPrimary};
  }
  &[data-state="on"] {
    background: ${surface};
    color: ${textPrimary};
    box-shadow: ${adminCardShadow};
  }
  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const FoldersBand = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-bottom: 0.95rem;
`

export const FolderTileButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 32px;
  padding: 0.25rem 0.65rem;
  border: 1px solid ${border};
  border-radius: 6px;
  background: ${surface};
  color: ${textSecondary};
  font-size: 0.78rem;
  font-weight: 550;
  user-select: none;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
  ${focusVisibleRing}
  svg {
    width: 15px;
    height: 15px;
    color: ${textMuted};
    flex-shrink: 0;
  }
  &:hover {
    border-color: ${borderStrong};
    background: ${surfaceRaised};
    color: ${textPrimary};
  }
  &[data-active="true"] {
    border-color: ${borderStrong};
    background: ${surfaceMuted};
    color: ${textPrimary};
    font-weight: 600;
    box-shadow: none;
    svg {
      color: currentColor;
    }
  }
  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const AssetItemsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(212px, 100%), 1fr));
  gap: 1rem;
  width: 100%;
`

export const SkeletonAssetCard = styled.div`
  display: grid;
  gap: 0.65rem;
  padding-bottom: 0.75rem;
  border-radius: 10px;
  border: 1px solid ${borderSubtle};
  background: ${surface};
  overflow: hidden;
  .thumb {
    width: 100%;
    aspect-ratio: 16 / 10;
    background: ${surfaceMuted};
  }
  > div:last-of-type {
    padding: 0 0.75rem;
  }
`
