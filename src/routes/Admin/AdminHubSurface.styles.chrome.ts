/**
 * 참조 구현:
 * - TryGhost/Ghost apps/shade/src/components/layout/list-page.tsx & apps/shade/src/components/ui/data-list.tsx (MIT License, Copyright (c) Ghost Foundation)
 * - tremorlabs/tremor packages/tremor-react/src/components/vis-elements/BarList/BarList.tsx (Apache-2.0 License, Copyright (c) Tremor Labs)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminCardShadow,
  adminStatusWarnBg,
  adminStatusWarnBorder,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const HeroHeader = styled.section`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem 1.25rem;
  min-width: 0;
  padding-bottom: 0.95rem;
  border-bottom: 1px solid ${adminBorder};
`

export const HeroCopy = styled.div`
  display: grid;
  gap: 0.25rem;
  min-width: 0;

  p {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.45;
  }
`

export const HeroHeading = styled.h2`
  margin: 0;
  color: ${adminTextPrimary};
  font-size: 1.25rem;
  line-height: 1.25;
  letter-spacing: -0.02em;
  font-weight: 650;
  overflow-wrap: break-word;

  @media (max-width: 768px) {
    font-size: 1.15rem;
  }
`

export const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.48rem;
`

export const HubRefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 36px;
  padding: 0 0.82rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${adminSurfaceRaised};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const HubRefreshNotice = styled.div`
  display: flex;
  align-items: center;
  padding: 0.58rem 0.88rem;
  border-radius: 8px;
  border: 1px solid ${adminStatusWarnBorder};
  background: ${adminStatusWarnBg};
  color: ${adminStatusWarnText};
  font-size: 0.81rem;
  font-weight: 600;
  line-height: 1.4;
`

export const AnalyticsBand = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(19rem, 1fr);
  gap: 1.25rem;
  align-items: start;
  min-width: 0;

  @media (max-width: 1040px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const AnalyticsSideStack = styled.div`
  display: grid;
  gap: 1.25rem;
  min-width: 0;
`

export const PanelHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 0.85rem;
  min-height: 3.15rem;
  padding: 0.72rem 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};

  .titleBlock {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
  }

  .titleInline {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  h2 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 0.92rem;
    font-weight: 650;
    letter-spacing: -0.015em;
    line-height: 1.25;
  }

  p {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.75rem;
    font-weight: 500;
  }

  .countChip {
    display: inline-flex;
    align-items: center;
    height: 1.3rem;
    padding: 0 0.45rem;
    border-radius: 6px;
    border: 1px solid ${adminBorderSubtle};
    background: ${adminSurfaceRaised};
    color: ${adminTextSecondary};
    font-family: ${MONO_FONT};
    font-size: 0.7rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`

export const PanelHeaderLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 32px;
  padding: 0 0.65rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.76rem;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const SubSectionTitle = styled.div`
  display: flex;
  align-items: center;
  padding: 0.5rem 1.15rem;
  border-block: 1px solid ${adminBorderSubtle};
  background: ${adminSurfaceRaised};

  h3 {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: -0.005em;
  }
`

export const ContentTableHead = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem 8.5rem 2rem;
  gap: 1rem;
  align-items: center;
  padding: 0.52rem 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: transparent;
  color: ${adminTextMuted};
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;

  .numCol {
    text-align: right;
  }

  @media (max-width: 720px) {
    display: none;
  }
`

export const EmptyPanel = styled.div`
  min-height: 8.5rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  color: ${adminTextMuted};
  font-size: 0.86rem;
  font-weight: 500;
`

export const SegmentedToggle = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 0.16rem;
  border: 1px solid ${adminBorderSubtle};
  border-radius: 8px;
  background: ${adminSurfaceMuted};

  button {
    border: 0;
    border-radius: 6px;
    min-height: 28px;
    padding: 0 0.62rem;
    background: transparent;
    color: ${adminTextMuted};
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
    ${focusVisibleRing}

    &[aria-pressed="true"],
    &[aria-selected="true"] {
      background: ${adminSurface};
      color: ${adminTextPrimary};
      box-shadow: ${adminCardShadow};
    }

    @media (pointer: coarse) {
      min-height: 40px;
      padding: 0 0.72rem;
    }
  }
`

export const ShareBarList = styled.div`
  display: grid;
  gap: 0.55rem;
  padding: 0.9rem 1.15rem 1.05rem;
`

export const ShareBarItem = styled.a`
  display: grid;
  gap: 0.35rem;
  padding: 0.42rem 0.55rem;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
  transition: background-color 140ms ease;
  ${focusVisibleRing}

  .shareBarHead {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 0.75rem;
  }

  &:hover {
    background: ${adminSurfaceRaised};
  }

  &:hover .shareBarTitle {
    color: ${adminTextPrimary};
  }

  @media (pointer: coarse) {
    min-height: 44px;
    align-content: center;
  }
`

export const ShareBarTrack = styled.span`
  display: block;
  width: 100%;
  height: 5px;
  border-radius: 9999px;
  background: ${adminSurfaceMuted};
  overflow: hidden;
`

export const ShareBarFill = styled.span<{ $widthPct: number }>`
  display: block;
  width: ${({ $widthPct }) => `${Math.max(0, Math.min(100, $widthPct))}%`};
  height: 100%;
  border-radius: 9999px;
  background: ${adminTeal};
  opacity: 0.84;
  transition: width 180ms ease;
`

export const ShareBarCopy = styled.span`
  min-width: 0;
  color: ${adminTextPrimary};
  font-size: 0.8rem;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ShareBarValue = styled.span`
  color: ${adminTextSecondary};
  font-family: ${MONO_FONT};
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`
