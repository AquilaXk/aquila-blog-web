// 참조 구현: TryGhost/Ghost apps/shade/src/components/{ui/kpi-card.tsx,patterns/setting-group.tsx} (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/ui/{card.tsx,badge.tsx} (MIT), felixmosh/bull-board (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import { AdminStatusPill } from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminStatusDangerBg,
  adminStatusDangerDot,
  adminStatusDangerText,
  adminStatusInfoDot,
  adminStatusSuccessBg,
  adminStatusSuccessDot,
  adminStatusSuccessText,
  adminStatusWarnBg,
  adminStatusWarnDot,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTealHover,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export * from "./AdminToolsWorkspace.styles.tokens"
export * from "./AdminToolsWorkspace.styles.layout"

export const ToolsHeroPanel = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 0 0 0.72rem;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorder};
  background: transparent;
  box-shadow: none;

  @media (max-width: 768px) {
    padding-bottom: 0.58rem;
    gap: 0.5rem;
  }
`

export const ToolsHeroTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  width: 100%;
`

export const ToolsHeroCopy = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-width: 0;

  h1,
  h2 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: clamp(1.18rem, 1.7vw, 1.38rem);
    font-weight: 780;
    line-height: 1.2;
    letter-spacing: -0.025em;
  }
`

export const ToolsHeroActions = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
`

export const ToolsHeaderButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 0.84rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not([aria-disabled="true"]) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
  }

  &[data-variant="primary"] {
    border-color: ${adminTeal};
    background: ${adminTeal};
    color: ${adminControlText};

    &:hover:not([aria-disabled="true"]) {
      border-color: ${adminTealHover};
      background: ${adminTealHover};
    }
  }

  &[aria-disabled="true"] {
    opacity: 0.56;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const ToolsServiceRail = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  padding: 0 0 0.55rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  min-width: 0;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem 0.85rem;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
`

export const ToolsKpiCard = styled.article`
  display: grid;
  align-content: space-between;
  gap: 0.18rem;
  padding: 0.2rem 0.9rem;
  border: 0;
  border-right: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  min-width: 0;

  &:first-of-type {
    padding-left: 0;
  }

  &:last-of-type {
    border-right: 0;
    padding-right: 0;
  }

  @media (max-width: 1100px) {
    padding: 0.2rem 0;
    border-right: 0;
  }
`

export const ToolsKpiTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  min-width: 0;

  > span:first-of-type {
    color: ${adminTextSecondary};
    font-size: 0.74rem;
    font-weight: 650;
  }
`

export const ToolsKpiBadge = styled.span<{ "data-tone"?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.44rem;
  border-radius: 999px;
  border: 1px solid transparent;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;

  &[data-tone="good"] {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="warn"] {
    border-color: transparent;
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

export const ToolsKpiValue = styled.strong`
  display: block;
  color: ${adminTextPrimary};
  font-size: 1.2rem;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  line-height: 1.15;
  overflow-wrap: anywhere;
`

export const ToolsKpiFooter = styled.div`
  padding-top: 0;
  border-top: 0;
  color: ${adminTextSecondary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
`

export const ToolsStatusChip = styled(AdminStatusPill)`
  display: inline-flex;
  align-items: center;
  gap: 0.34rem;
  min-height: 24px;
  padding: 0 0.56rem;
  border-radius: 999px;
  border-color: transparent;
  background: ${adminSurfaceMuted};
  font-size: 0.71rem;
  font-weight: 700;

  &[data-tone="good"] {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="warn"] {
    border-color: transparent;
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

export const BullPulseStrip = styled.div`
  display: flex;
  gap: 2px;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
`

export const BullPulseEmpty = styled.span`
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: ${adminSurfaceMuted};
`

export const BullPulseSegment = styled.span<{ "data-metric"?: string; "data-tone"?: string }>`
  min-width: 8px;
  height: 100%;
  border-radius: 2px;
  transition: width 240ms ease;
  background: ${({ "data-metric": metric, "data-tone": tone }) => {
    if (tone === "danger" || metric === "failed" || metric === "stale" || metric === "blocked") {
      return adminStatusDangerDot
    }
    if (tone === "warn" || metric === "purge") {
      return adminStatusWarnDot
    }
    if (metric === "ready") {
      return adminStatusInfoDot
    }
    if (metric === "processing") {
      return adminTeal
    }
    return adminStatusSuccessDot
  }};
`
