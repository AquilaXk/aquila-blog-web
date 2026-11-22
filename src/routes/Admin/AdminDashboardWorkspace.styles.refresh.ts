// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueStats/QueueStats.module.css (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/site-header.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminStatusDangerDot,
  adminStatusDangerText,
  adminStatusInfoDot,
  adminStatusSuccessDot,
  adminStatusWarnDot,
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

export const FreshnessLabel = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 0.45rem;
  color: ${adminTextMuted};
  font-family: ${MONO_FONT};
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  min-height: 36px;
  padding: 0 0.82rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
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
    opacity: 0.62;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const Chart = styled.div`
  display: grid;
  gap: 0.95rem;
  padding: 1.05rem 1.15rem 1.15rem;
  background: ${adminSurface};
`

export const QueuePulseHeader = styled.div`
  display: grid;
  gap: 0.62rem;
  padding-bottom: 0.35rem;
  border-bottom: 0;

  .pulse {
    display: flex;
    gap: 2px;
    width: 100%;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }

  .pulseBar {
    min-width: 6px;
    height: 100%;
    border-radius: 2px;
    background: ${adminStatusInfoDot};
    transition: width 0.25s ease-out;

    &[data-tone="good"] {
      background: ${adminStatusSuccessDot};
    }

    &[data-tone="warn"] {
      background: ${adminStatusWarnDot};
    }

    &[data-tone="danger"] {
      background: ${adminStatusDangerDot};
    }
  }

  .emptyPulseBar {
    width: 100%;
    height: 100%;
    border-radius: 2px;
    background: ${adminSurfaceMuted};
    border: 0;
  }

  .flagsFooter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    min-width: 0;
  }

  .flag {
    display: inline-flex;
    align-items: center;
    gap: 0.34rem;
    font-size: 0.71rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${adminTextMuted};
    white-space: nowrap;
  }

  .flag[data-alert="true"] {
    color: ${adminStatusDangerText};
  }

  .flagCount {
    font-family: ${MONO_FONT};
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    letter-spacing: 0;
    color: ${adminTextPrimary};
  }

  .flag[data-alert="true"] .flagCount {
    color: ${adminStatusDangerText};
  }

  .totalCount {
    margin-left: auto;
    font-family: ${MONO_FONT};
    font-variant-numeric: tabular-nums;
    font-size: 0.73rem;
    color: ${adminTextMuted};
    white-space: nowrap;
  }
`

export const ChartBars = styled.div`
  display: grid;
  gap: 0.56rem;
`

export const ChartBarColumn = styled.div`
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) 3.75rem;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
`

export const ChartBarLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: ${adminTextSecondary};
  line-height: 1.3;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`

export const ChartBarTrack = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: ${adminSurfaceMuted};
  overflow: hidden;
`

export const ChartBar = styled.i`
  display: block;
  height: 100%;
  border-radius: 3px;
  background: ${adminTeal};
  transition: width 0.25s ease-out;

  &[data-tone="good"] {
    background: ${adminStatusSuccessDot};
  }

  &[data-tone="warn"] {
    background: ${adminStatusWarnDot};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerDot};
  }

  &[data-zero="true"] {
    width: 0;
    background: ${adminBorderStrong};
    opacity: 0;
  }
`

export const ChartBarValue = styled.strong`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0;
  border-radius: 0;
  background: transparent;
  font-family: ${MONO_FONT};
  font-size: 0.75rem;
  font-weight: 600;
  color: ${adminTextPrimary};
  line-height: 1.25;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &[data-zero="true"] {
    background: transparent;
    color: ${adminTextMuted};
  }
`
