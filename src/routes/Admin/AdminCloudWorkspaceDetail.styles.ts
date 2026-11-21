/**
 * 참조 구현:
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetailsDrawer.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetails/AssetPreview.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { overlayScrim } from "src/design-system/tokens"
import {
  adminBorder as border,
  adminBorderSubtle as borderSubtle,
  adminGoldTintFocus,
  adminSurface as surface,
  adminSurfaceMuted as surfaceMuted,
  adminTeal as accentTeal,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"
import { zIndexes } from "src/styles/zIndexes"

export const DetailPanel = styled.aside`
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: 1px solid ${borderSubtle};
  background: ${surface};

  &[data-mode="inline"] {
    grid-column: 2;
  }

  &[data-mode="drawer"] {
    position: fixed;
    top: var(--app-header-height, 73px);
    right: 0;
    bottom: 0;
    z-index: ${zIndexes.dialog};
    width: min(26rem, calc(100vw - 1.25rem));
    overflow: hidden;
  }

  @media (max-width: 1279px) {
    position: fixed;
    top: var(--app-header-height, 73px);
    right: 0;
    bottom: 0;
    z-index: ${zIndexes.dialog};
    width: min(26rem, calc(100vw - 1.25rem));
    overflow: hidden;
  }
`

export const DetailScrim = styled.button`
  display: none;
  ${focusVisibleRing}

  &[data-mode="drawer"] {
    position: fixed;
    inset: var(--app-header-height, 73px) 0 0;
    z-index: ${zIndexes.dialog - 1};
    display: block;
    border: 0;
    padding: 0;
    background: ${overlayScrim.adminPreview};
  }

  @media (max-width: 1279px) {
    position: fixed;
    inset: var(--app-header-height, 73px) 0 0;
    z-index: ${zIndexes.dialog - 1};
    display: block;
    border: 0;
    padding: 0;
    background: ${overlayScrim.adminPreview};
  }
`

export const DetailHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.85rem 1.15rem;
  border-bottom: 1px solid ${borderSubtle};
  flex-shrink: 0;

  h2 {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${textPrimary};
    font-size: 0.94rem;
    font-weight: 750;
    letter-spacing: -0.01em;
  }
`

export const DrawerBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: 1rem 1.15rem 1.25rem;
`

export const DrawerFooter = styled.footer`
  flex-shrink: 0;
  padding: 0.75rem 1.15rem;
  border-top: 1px solid ${borderSubtle};
  background: ${surface};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
`

export const DrawerFooterActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
`

export const DrawerIconLink = styled.a`
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${textSecondary};
  text-decoration: none;
  cursor: pointer;
  ${focusVisibleRing}
  &:hover,
  &:focus-visible {
    background: ${surfaceMuted};
    color: ${textPrimary};
  }
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
`

export const DrawerSectionHeading = styled.h3`
  margin: 0 0 0.45rem;
  color: ${textPrimary};
  font-size: 0.8rem;
  font-weight: 700;
`

export const DetailPreviewBox = styled.div`
  display: grid;
  align-items: start;
  min-width: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  overflow: hidden;
`

export const DetailEditForm = styled.form`
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
`

export const DetailEditField = styled.label`
  display: grid;
  gap: 0.3rem;
  color: ${textSecondary};
  font-size: 0.76rem;
  font-weight: 700;
  > span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  > span svg {
    width: 0.85rem;
    height: 0.85rem;
    color: ${textMuted};
  }
`

export const DetailEditInput = styled.input`
  width: 100%;
  min-height: 36px;
  border: 1px solid ${border};
  border-radius: 6px;
  padding: 0 0.65rem;
  background: ${surface};
  color: ${textPrimary};
  font-size: 0.82rem;
  font-weight: 600;

  &:focus-visible {
    outline: none;
    border-color: ${accentTeal};
    box-shadow: 0 0 0 3px ${adminGoldTintFocus};
  }

  @media (pointer: coarse) {
    min-height: 44px;
    font-size: 1rem;
  }
`

export const DetailMetaGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.72rem 0.85rem;
  margin: 0;
  padding: 0.85rem 0.95rem;
  border: 0;
  border-radius: 8px;
  background: ${surfaceMuted};
`

export const DetailMetaItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  min-width: 0;

  dt {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0;
    color: ${textMuted};
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  dt span {
    width: 0.85rem;
    height: 0.85rem;
    display: inline-grid;
    place-items: center;
    color: ${textMuted};
  }

  dd {
    margin: 0;
    color: ${textPrimary};
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.38;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
`

export const DetailMetaList = DetailMetaGrid

export const PreviewStage = styled.div`
  position: relative;
  display: grid;
  gap: 0.65rem;
  width: 100%;
  align-content: start;
  min-width: 0;
`

export const PdfCanvas = styled.canvas`
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  display: block;
  border: 0;
  border-radius: 4px;
  background: ${surface};
  object-fit: contain;
`

export const PhotoFallback = styled.div`
  display: grid;
  place-items: center;
  padding: 1rem;
  color: ${textSecondary};
  font-size: 0.82rem;
  font-weight: 650;
  text-align: center;
`

export const ToastViewport = styled.div<{ "data-tone": "success" | "error" }>`
  position: fixed;
  top: calc(var(--app-header-height, 61px) + 1rem);
  right: max(1rem, env(safe-area-inset-right));
  z-index: ${zIndexes.dialogHoverCard};
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.25rem 0.7rem;
  align-items: center;
  width: min(24rem, calc(100vw - 2rem));
  padding: 0.78rem 0.9rem;
  border: 1px solid
    ${({ theme, "data-tone": tone }) =>
      tone === "error" ? theme.colors.statusDangerBorder : theme.colors.statusSuccessBorder};
  border-radius: 10px;
  background: ${surface};

  strong {
    color: ${textPrimary};
    font-size: 0.85rem;
    font-weight: 760;
  }

  span {
    grid-column: 1 / 2;
    min-width: 0;
    overflow: hidden;
    color: ${textSecondary};
    font-size: 0.76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    grid-column: 2;
    grid-row: 1 / span 2;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${textSecondary};
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    ${focusVisibleRing}

    @media (pointer: coarse) {
      min-height: 44px;
      min-width: 44px;
    }
  }
`

export const ConfirmBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.dialog};
  display: grid;
  place-items: center;
  padding: 1rem;
  background: ${overlayScrim.adminDetail};
`

export const ConfirmDialog = styled.div`
  display: grid;
  gap: 0.95rem;
  width: min(26rem, 100%);
  padding: 1.2rem;
  border: 1px solid ${border};
  border-radius: 12px;
  background: ${surface};

  > strong {
    color: ${textPrimary};
    font-size: 1rem;
    font-weight: 760;
  }

  p {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    color: ${textSecondary};
    font-size: 0.82rem;
    line-height: 1.55;
  }

  p span {
    color: ${textPrimary};
    font-weight: 720;
    overflow-wrap: anywhere;
  }

  > div {
    display: flex;
    justify-content: flex-end;
    gap: 0.45rem;
  }
`

export const PlayerBar = styled.div`
  display: grid;
  gap: 0.5rem;
`

export const QueuePanel = styled.section`
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: ${zIndexes.header - 1};
  display: grid;
  gap: 0.55rem;
  width: min(25rem, calc(100vw - 2rem));
  max-height: min(24rem, calc(100vh - var(--app-header-height, 73px) - 2rem));
  padding: 0.85rem;
  border: 1px solid ${border};
  border-radius: 12px;
  background: ${surface};

  @media (min-width: 1280px) {
    [data-detail-open="true"][data-detail-mode="inline"] & {
      right: calc(25rem + env(safe-area-inset-right));
    }
  }

  @media (max-width: 768px) {
    right: 0.72rem;
    bottom: 0.72rem;
    width: calc(100vw - 1.44rem);
    max-height: min(22rem, calc(100vh - var(--app-header-height, 73px) - 1.44rem));
    padding: 0.72rem;
  }
`

export const QueueHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  h2 {
    margin: 0;
    color: ${textPrimary};
    font-size: 0.92rem;
    font-weight: 760;
  }

  p {
    margin: 0.14rem 0 0;
    color: ${textSecondary};
    font-size: 0.74rem;
  }
`

export const QueueList = styled.ul`
  display: grid;
  gap: 0.32rem;
  max-height: 15rem;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const QueueItem = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(3.7rem, auto) auto;
  gap: 0.45rem 0.75rem;
  align-items: center;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 0;
  border-radius: 8px;
  background: ${surfaceMuted};

  strong {
    display: block;
    color: ${textPrimary};
    font-size: 0.8rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 0.14rem 0 0;
    color: ${textSecondary};
    font-size: 0.72rem;
  }

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr) auto;

    button {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`

export const EmptyTableState = styled.div`
  display: grid;
  place-items: center;
  gap: 0.7rem;
  min-height: 16rem;
  padding: 2rem 1.25rem;
  border: 1px dashed ${border};
  border-radius: 10px;
  background: transparent;
  color: ${textSecondary};
  text-align: center;

  strong {
    color: ${textPrimary};
    font-size: 0.95rem;
    font-weight: 700;
  }
`

export const LoadingTableStatus = styled.div`
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 12rem;
  color: ${textSecondary};
  font-size: 0.84rem;
  font-weight: 700;
`

export const SkeletonRows = styled.div`
  display: grid;
  gap: 0.5rem;
  width: min(100%, 44rem);
`

export const PreviewInlineStatusList = styled.div`
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  align-items: center;
  span {
    color: ${textSecondary};
    font-size: 0.72rem;
    font-weight: 700;
  }
`
