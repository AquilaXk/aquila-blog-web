/**
 * 참조 구현:
 * - shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/chart-area-interactive.tsx (MIT License, Copyright (c) shadcn)
 * - TryGhost/Ghost apps/shade/src/components/layout/list-page.tsx (MIT License, Copyright (c) Ghost Foundation)
 */
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderSubtle,
  adminCardShadow,
  adminStatusWarnBg,
  adminStatusWarnBorder,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
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
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
`

export const PanelHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 0.85rem;
  min-height: 3.3rem;
  padding: 0.78rem 1.15rem;
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
    font-size: 0.94rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.25;
  }

  p {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.76rem;
    font-weight: 500;
  }

  .countChip {
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
    font-family: ${MONO_FONT};
    font-size: 0.69rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`

export const SubSectionTitle = styled.div`
  display: flex;
  align-items: center;
  padding: 0.52rem 1.15rem;
  border-block: 1px solid ${adminBorderSubtle};
  background: ${adminSurfaceRaised};

  h3 {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
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

export const ChartCanvasWrap = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1 1 auto;
  gap: 0.65rem;
  padding: 1rem 1.15rem 0.9rem;

  svg {
    width: 100%;
    height: 250px;
    display: block;
    overflow: visible;

    @media (max-width: 768px) {
      height: auto;
      min-height: 185px;
    }
  }

  .chartFooter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-top: 0.45rem;
    border-top: 1px solid ${adminBorderSubtle};
    color: ${adminTextMuted};
    font-size: 0.74rem;
    font-variant-numeric: tabular-nums;

    strong {
      color: ${adminTextPrimary};
      font-family: ${MONO_FONT};
      font-weight: 600;
    }
  }
`
