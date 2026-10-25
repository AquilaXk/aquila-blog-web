import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder as border,
  adminBorderStrong as borderStrong,
  adminGold as accentGold,
  adminSurface as surface,
  adminSurfaceMuted as surfaceMuted,
  adminSurfaceRaised as surfaceRaised,
  adminTextMuted as textMuted,
  adminTextPrimary as textPrimary,
  adminTextSecondary as textSecondary,
} from "src/routes/Admin/adminColorTokens"
import { zIndexes } from "src/styles/zIndexes"

export const DetailPanel = styled.aside`
  display: grid;
  align-content: start;
  gap: 1rem;
  min-width: 0;
  padding: 1.35rem 1.25rem;
  border-left: 1px solid ${border};
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
    width: min(24rem, calc(100vw - 2rem));
    overflow: auto;
    box-shadow: none;
  }

  @media (max-width: 1280px) {
    position: fixed;
    top: var(--app-header-height, 73px);
    right: 0;
    bottom: 0;
    z-index: ${zIndexes.dialog};
    width: min(24rem, calc(100vw - 2rem));
    overflow: auto;
    box-shadow: none;
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
    background: rgba(0, 0, 0, 0.32);
  }

  @media (max-width: 1280px) {
    position: fixed;
    inset: var(--app-header-height, 73px) 0 0;
    z-index: ${zIndexes.dialog - 1};
    display: block;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.32);
  }
`

export const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0;
    color: ${textPrimary};
    font-size: 1.08rem;
    font-weight: 860;
  }
`

export const DetailPreviewBox = styled.div`
  display: grid;
  align-items: start;
  min-height: 12.5rem;
  background: transparent;
  overflow: auto;
`

export const DetailActionLink = styled.a`
  border: 0;
  border-radius: 2px;
  min-height: 2rem;
  padding: 0 0.62rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: ${textMuted};
  font-size: 0.81rem;
  font-weight: 820;
  text-decoration: none;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover,
  &:focus-visible {
    background: ${surfaceMuted};
    color: ${textPrimary};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const DetailEditForm = styled.form`
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 0;
  border: 0;
  border-top: 1px solid ${border};
  border-bottom: 1px solid ${border};
  border-radius: 0;
  background: transparent;
`

export const DetailEditField = styled.label`
  display: grid;
  gap: 0.25rem;
  color: ${textSecondary};
  font-size: 0.76rem;
  font-weight: 800;
`

export const DetailEditInput = styled.input`
  width: 100%;
  min-height: 2.1rem;
  border: 1px solid ${border};
  border-radius: 2px;
  padding: 0 0.6rem;
  background: ${surface};
  color: ${textPrimary};
  font-size: 0.82rem;
  font-weight: 760;

  &:focus-visible {
    outline: none;
    border-color: ${borderStrong};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
  }
`

export const DetailSummary = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.25rem;
  align-items: center;
  min-width: 0;
  padding: 0.75rem 0;
  border-bottom: 1px solid ${border};

  strong {
    display: block;
    color: ${textPrimary};
    font-size: 0.94rem;
    font-weight: 860;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0.22rem 0 0;
    color: ${textMuted};
    font-size: 0.78rem;
    font-weight: 760;
  }
`

export const DetailMetaList = styled.dl`
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0 0.8rem;
  margin: 0;

  dt {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid ${border};
    color: ${textMuted};
    font-size: 0.8rem;
    font-weight: 800;
  }

  dt span {
    width: 1.05rem;
    height: 1.05rem;
    display: inline-grid;
    place-items: center;
    color: ${accentGold};
    text-align: center;
  }

  dd {
    margin: 0;
    padding: 0.5rem 0;
    border-bottom: 1px solid ${border};
    color: ${textPrimary};
    font-size: 0.82rem;
    font-weight: 780;
    overflow-wrap: anywhere;
  }
`

export const PreviewHeader = styled.div`
  display: grid;
  gap: 0.35rem;

  h3 {
    margin: 0;
    color: ${textPrimary};
    font-size: 0.96rem;
    font-weight: 850;
  }

  p {
    margin: 0;
    color: ${textMuted};
    font-size: 0.78rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
`

export const PreviewStage = styled.div`
  display: grid;
  gap: 0.75rem;
  width: 100%;
  min-height: 12rem;
  align-content: start;
  min-width: 0;
`

export const PdfCanvas = styled.canvas`
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: min(52vh, 34rem);
  display: block;
  border: 0;
  border-radius: 2px;
  background: ${surfaceMuted};
  object-fit: contain;
`

export const PhotoFrame = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 12rem;
  overflow: hidden;
  border-radius: 2px;
  background: ${surfaceMuted};

  img {
    width: 100%;
    max-height: 18rem;
    object-fit: contain;
    background: transparent;
  }
`

export const PhotoFallback = styled.div`
  display: grid;
  place-items: center;
  min-height: 12rem;
  padding: 1rem;
  color: ${textSecondary};
  font-size: 0.82rem;
  font-weight: 780;
  text-align: center;
`

export const ToastViewport = styled.div<{ "data-tone": "success" | "error" }>`
  position: fixed;
  top: calc(var(--app-header-height, 61px) + 1rem);
  right: max(1rem, env(safe-area-inset-right));
  bottom: auto;
  z-index: ${zIndexes.dialogHoverCard};
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.28rem 0.7rem;
  align-items: center;
  width: min(24rem, calc(100vw - 2rem));
  padding: 0.78rem 0.9rem;
  border: 1px solid
    ${({ theme, "data-tone": tone }) =>
      tone === "error" ? theme.colors.statusDangerBorder : theme.colors.statusSuccessBorder};
  border-radius: 8px;
  background: ${surfaceRaised};
  box-shadow: none;

  strong {
    color: ${textPrimary};
    font-size: 0.86rem;
    font-weight: 850;
  }

  span {
    grid-column: 1 / 2;
    min-width: 0;
    overflow: hidden;
    color: ${textMuted};
    font-size: 0.76rem;
    font-weight: 720;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    grid-column: 2;
    grid-row: 1 / span 2;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${textSecondary};
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
    ${focusVisibleRing}

    @media (max-width: 768px), (pointer: coarse) {
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
  background: rgba(0, 0, 0, 0.36);
`

export const ConfirmDialog = styled.div`
  display: grid;
  gap: 0.95rem;
  width: min(26rem, 100%);
  padding: 1.15rem;
  border: 1px solid ${borderStrong};
  border-radius: 8px;
  background: ${surfaceRaised};
  box-shadow: none;

  > strong {
    color: ${textPrimary};
    font-size: 1rem;
    font-weight: 880;
  }

  p {
    display: grid;
    gap: 0.42rem;
    margin: 0;
    color: ${textMuted};
    font-size: 0.82rem;
    line-height: 1.55;
    font-weight: 720;
  }

  p span {
    color: ${textPrimary};
    font-weight: 850;
    overflow-wrap: anywhere;
  }

  > div {
    display: flex;
    justify-content: flex-end;
    gap: 0.45rem;
  }
`

export const VideoFrame = styled.div`
  display: grid;
  gap: 0.7rem;
  width: 100%;

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    background: ${surfaceMuted};
  }
`

export const PlayerBar = styled.div`
  display: grid;
  gap: 0.55rem;
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
  padding: 0.78rem;
  border: 1px solid ${borderStrong};
  border-radius: 8px;
  background: ${surfaceRaised};
  box-shadow: none;

  @media (max-width: 768px) {
    right: 0.72rem;
    bottom: 0.72rem;
    width: calc(100vw - 1.44rem);
    max-height: min(22rem, calc(100vh - var(--app-header-height, 73px) - 1.44rem));
    padding: 0.68rem;
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
    font-size: 0.95rem;
    font-weight: 880;
  }

  p {
    margin: 0.16rem 0 0;
    color: ${textMuted};
    font-size: 0.74rem;
    font-weight: 700;
  }
`

export const QueueList = styled.ul`
  display: grid;
  gap: 0.25rem;
  max-height: 15rem;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const QueueItem = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(3.7rem, auto) auto;
  gap: 0.5rem 0.75rem;
  align-items: center;
  min-width: 0;
  padding: 0.54rem 0.58rem;
  border: 0;
  border-radius: 6px;
  background: ${surface};

  strong {
    display: block;
    color: ${textPrimary};
    font-size: 0.8rem;
    font-weight: 820;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 0.16rem 0 0;
    color: ${textMuted};
    font-size: 0.72rem;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr) auto;

    button {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`
