/**
 * 참조 구현:
 * - igordanchenko/yet-another-react-lightbox src/styles.scss · src/plugins/counter/counter.scss ·
 *   src/modules/Toolbar.tsx · src/modules/Navigation.tsx (MIT License, Copyright (c) 2022 Igor Danchenko)
 * - strapi/strapi packages/core/upload/admin/src/pages/Assets/components/AssetDetails/AssetPreview.tsx (MIT License, Copyright (c) 2015-present Strapi Solutions SAS)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminActionGroupLightSurface,
  adminBorder,
  adminCardShadow,
  adminCheckerboardBackground,
  adminCommandBarFg,
  adminCommandBarMuted,
  adminFloatingShadow,
  adminFramePillBg,
  adminFramePillHover,
  adminStatusWarnBg,
  adminStatusWarnBorder,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTerminalBg,
  adminTerminalBorder,
  adminTerminalFg,
  adminTerminalHeaderBg,
  adminTerminalMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"
import { zIndexes } from "src/styles/zIndexes"

export const YarlPortal = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${zIndexes.lightbox};
  overflow: hidden;
  overscroll-behavior: contain;
  background: ${adminTerminalBg};
  color: ${adminCommandBarFg};
  outline: none;
`

export const YarlCounter = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  margin: 8px;
  padding: 8px 12px;
  line-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  max-width: calc(100vw - 17rem);
  user-select: none;
  pointer-events: none;
  font-size: 0.88rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${adminCommandBarFg};

  .yarlCounterIndex {
    flex-shrink: 0;
    font-weight: 700;
  }

  .yarlCounterCaption {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${adminCommandBarMuted};
    font-size: 0.81rem;
  }

  @media (max-width: 640px) {
    max-width: calc(100vw - 13rem);
    .yarlCounterCaption {
      display: none;
    }
  }
`

export const YarlToolbar = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 2px;
`

const yarlIconControlCss = `
  appearance: none;
  margin: 0;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${adminCommandBarMuted};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, opacity 140ms ease;

  &:hover:not(:disabled) {
    color: ${adminCommandBarFg};
    background: ${adminFramePillBg};
  }

  &[data-active="true"] {
    color: ${adminCommandBarFg};
    background: ${adminFramePillHover};
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }
`

export const YarlToolbarButton = styled.button`
  ${yarlIconControlCss}
  ${focusVisibleRing}
`

export const YarlToolbarLink = styled.a`
  ${yarlIconControlCss}
  ${focusVisibleRing}
`

export const YarlNavigationButton = styled.button<{ $side: "prev" | "next" }>`
  ${yarlIconControlCss}
  ${focusVisibleRing}
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === "prev" ? "left: 0;" : "right: 0;")}
  transform: translateY(-50%);
  z-index: 5;
  padding: 24px 16px;
  color: ${adminCommandBarFg};

  @media (max-width: 640px) {
    padding: 14px 8px;
  }
`

export const YarlSlide = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px 64px 48px;

  @media (max-width: 768px) {
    padding: 56px 16px 32px;
  }
`

export const YarlImageStage = styled.div<{ $checkerboard: boolean }>`
  max-width: 100%;
  max-height: 100%;
  padding: ${({ $checkerboard }) => ($checkerboard ? "1rem" : "0")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: ${({ $checkerboard }) => ($checkerboard ? adminCheckerboardBackground : "transparent")};
`

export const YarlSlideImage = styled.img`
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - 112px);
  object-fit: contain;
  user-select: none;
  transform-origin: center center;
  transition: transform 120ms ease;
`

export const YarlVideoStage = styled.div`
  display: grid;
  gap: 0.75rem;
  justify-items: center;
  width: min(74rem, 100%);

  video {
    width: 100%;
    max-width: 100%;
    max-height: calc(100dvh - 148px);
    object-fit: contain;
    display: block;
    border-radius: 8px;
    background: ${adminTerminalBg};
    box-shadow: ${adminFloatingShadow};
  }
`

export const YarlBottomBar = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.4rem;
`

export const YarlDarkPill = styled.button`
  border: 0;
  border-radius: 6px;
  min-height: 30px;
  padding: 0 0.65rem;
  background: ${adminFramePillBg};
  color: ${adminCommandBarMuted};
  font-size: 0.76rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${adminFramePillHover};
    color: ${adminCommandBarFg};
  }

  &[data-active="true"] {
    background: ${adminCommandBarFg};
    color: ${adminTeal};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const YarlPageReadout = styled.span`
  padding: 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${adminCommandBarFg};
`

export const YarlPdfSheet = styled.div<{ $widthRem: number }>`
  width: min(${({ $widthRem }) => `${$widthRem}rem`}, 88vw);
  max-width: 100%;
  display: grid;
  gap: 0.75rem;
  justify-items: center;

  canvas {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 6px;
    background: ${adminSurface};
    box-shadow: ${adminFloatingShadow};
  }
`

export const YarlCodeShell = styled.div`
  width: min(68rem, 100%);
  height: 100%;
  max-height: calc(100dvh - 112px);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid ${adminTerminalBorder};
  background: ${adminTerminalHeaderBg};
  color: ${adminTerminalFg};
  box-shadow: ${adminFloatingShadow};
`

export const YarlTruncationBanner = styled.div`
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid ${adminStatusWarnBorder};
  background: ${adminStatusWarnBg};
  color: ${adminStatusWarnText};
  font-size: 0.76rem;
  font-weight: 650;
  flex-shrink: 0;
`

export const YarlCodeScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0.75rem 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.58;

  .codeLine {
    display: grid;
    grid-template-columns: 3.4rem minmax(0, 1fr);
    gap: 0.85rem;
    padding: 0 1rem 0 0.5rem;
  }

  .lineNo {
    text-align: right;
    user-select: none;
    color: ${adminTerminalMuted};
    font-variant-numeric: tabular-nums;
  }

  code {
    white-space: pre;
  }
`

export const YarlMediaCard = styled.div`
  width: min(30rem, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 1.75rem 1.5rem;
  border-radius: 10px;
  border: 1px solid ${adminTerminalBorder};
  background: ${adminTerminalHeaderBg};
  color: ${adminTerminalFg};
  box-shadow: ${adminFloatingShadow};
  text-align: center;

  strong {
    font-size: 0.94rem;
    font-weight: 750;
    overflow-wrap: anywhere;
  }

  span {
    font-size: 0.78rem;
    color: ${adminTerminalMuted};
  }

  audio {
    width: 100%;
  }
`

export const YarlFallbackDownloadLink = styled.a`
  min-height: 34px;
  padding: 0 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: ${adminCommandBarFg};
  color: ${adminTeal};
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const AssetPreviewContainer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 24rem;
  padding: 0;
  border: 1px solid ${adminBorder};
  border-radius: 8px;
  background: ${adminSurfaceRaised};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  &[data-svg="true"] {
    padding: 0.75rem;
    background: ${adminCheckerboardBackground};
  }
  &[data-surface="muted"] {
    background: ${adminSurfaceMuted};
  }
  &[data-flush="true"] {
    padding: 0;
    background: ${adminTerminalBg};
  }
`

export const AssetPreviewActionsOverlay = styled.div`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 3;
  display: flex;
  gap: 0.375rem;
`

export const AssetPreviewOverlayIconButton = styled.button`
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminActionGroupLightSurface};
  color: ${adminTextPrimary};
  box-shadow: ${adminCardShadow};
  cursor: pointer;
  ${focusVisibleRing}
  &:hover {
    background: ${adminSurface};
  }
  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
`

export const AssetPreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`

export const AssetPreviewVideo = styled.video`
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 4px;
`

export const AssetPreviewAudio = styled.audio`
  width: 100%;
  max-width: 22rem;
`

export const AssetPreviewIconFallback = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: ${adminTextSecondary};
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
`

export const AssetCodeSnippetFrame = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${adminTerminalBg};
  color: ${adminTerminalFg};
  display: flex;
  flex-direction: column;
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0.65rem 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .line {
    display: grid;
    grid-template-columns: 2.3rem minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0 0.65rem;
  }
  .ln {
    text-align: right;
    color: ${adminTerminalMuted};
    user-select: none;
  }
  code {
    white-space: pre;
  }
  .truncatedNote {
    margin-top: 0.4rem;
    padding: 0.35rem 0.65rem 0;
    border-top: 1px solid ${adminTerminalBorder};
    color: ${adminTerminalMuted};
    font-size: 0.68rem;
  }
  .status {
    margin: auto;
    padding: 1rem;
    text-align: center;
    font-size: 0.76rem;
    color: ${adminTerminalMuted};
  }
`
