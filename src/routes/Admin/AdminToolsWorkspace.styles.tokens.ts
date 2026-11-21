// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx & QueueStats.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import {
  AdminInlineActionRow,
  AdminSectionHeading,
  AdminSectionTitleStack,
  AdminStatusPill,
  AdminTextActionButton,
} from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminStatusDangerBg,
  adminStatusDangerBorder,
  adminStatusDangerText,
  adminStatusSuccessBg,
  adminStatusSuccessText,
  adminStatusWarnBg,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextPrimary,
  adminTextSecondary,
  adminWarningBadgeText,
} from "src/routes/Admin/adminColorTokens"

export const Main = styled.div`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0.95rem 1.6rem 2.5rem;
  display: grid;
  gap: 0.78rem;

  @media (max-width: 768px) {
    padding: 0.65rem 0.85rem 2rem;
    gap: 0.68rem;
  }
`

export const SectionTitleBlock = styled(AdminSectionTitleStack)`
  h2,
  h3 {
    font-size: 1.02rem;
    font-weight: 760;
    letter-spacing: -0.015em;
  }
`

export const CalmMessage = styled.p`
  margin: 0;
  color: ${adminTextSecondary};
  font-size: 0.84rem;
  line-height: 1.55;
`

export const WorkspaceShell = styled.div`
  display: grid;
  gap: 0.9rem;
  align-items: start;
`

export const WorkspaceColumn = styled.div`
  display: grid;
  gap: 0.85rem;
`

export const WorkspaceSection = styled.section`
  display: grid;
  gap: 0.8rem;
  padding: 1.05rem 1.2rem;
  border-radius: 12px;
  background: ${adminSurface};
  border: 1px solid ${adminBorder};
  box-shadow: none;
  min-width: 0;

  &[data-emphasis="secondary"] {
    background: ${adminSurface};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerBg};
    border-color: ${adminStatusDangerBorder};
  }

  @media (max-width: 768px) {
    padding: 0.88rem 0.95rem;
  }
`

export const SectionHeading = styled(AdminSectionHeading)`
  align-items: center;
`

export const StatusBadge = styled(AdminStatusPill)`
  min-height: 26px;
  padding: 0 0.62rem;
  border-radius: 999px;
  border-color: transparent;
  background: ${adminStatusWarnBg};
  color: ${adminWarningBadgeText()};

  &[data-tone="success"] {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="danger"] {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

export const FreshnessBadge = styled(AdminStatusPill)`
  min-height: 24px;
  padding: 0 0.56rem;
  border-radius: 999px;
  border-color: transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.71rem;

  &[data-tone="fresh"] {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="aging"] {
    border-color: transparent;
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-tone="stale"] {
    border-color: transparent;
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
  }
`

export const SubSectionHeading = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.2rem;

  strong {
    font-size: 0.92rem;
    font-weight: 740;
    color: ${adminTextPrimary};
  }

  small {
    color: ${adminTextSecondary};
    font-size: 0.76rem;
    font-weight: 600;
  }
`

export const DetailsPanel = styled.details`
  border-radius: 0;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};
  background: transparent;

  &[open] {
    padding-bottom: 0.15rem;
  }
`

export const DetailsSummary = styled.summary`
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  min-height: 38px;
  padding: 0.58rem 0;
  cursor: pointer;
  box-sizing: border-box;
  border-radius: 6px;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-height: ${control.lg}px;
  }

  &::-webkit-details-marker {
    display: none;
  }

  span {
    font-size: 0.85rem;
    font-weight: 700;
    color: ${adminTextPrimary};
  }

  small {
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    font-weight: 650;
  }
`

export const DiagnosticsTabs = styled.div`
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 0.35rem;
  width: 100%;
  border-bottom: 1px solid ${adminBorder};
  scrollbar-width: thin;
`

export const DiagnosticsTabButton = styled.button`
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 0.72rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.83rem;
  font-weight: 660;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
  }

  &[aria-selected="true"],
  &[data-active="true"] {
    color: ${adminTextPrimary};

    &::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      border-block-end: 2px solid ${adminTeal};
    }
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const DiagnosticPanel = styled.div`
  display: grid;
  gap: 0.85rem;
`

export const DiagnosticHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.85rem;

  strong {
    display: block;
    font-size: 0.94rem;
    color: ${adminTextPrimary};
    letter-spacing: -0.01em;
  }

  span {
    display: block;
    margin-top: 0.16rem;
    color: ${adminTextSecondary};
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

export const ActionRow = styled(AdminInlineActionRow)`
  gap: 0.5rem;
`

export const QuietButton = styled(AdminTextActionButton)`
  border: 1px solid ${adminBorder};
  border-radius: 8px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0 0.72rem;
  min-height: 34px;
  font-size: 0.8rem;
  font-weight: 650;

  &:hover:not(:disabled) {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
  }

  &:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  gap: 0.65rem;
`

export const MetricCard = styled.div`
  display: grid;
  gap: 0.22rem;
  padding: 0.75rem 0.9rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  box-shadow: none;

  small {
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.71rem;
    font-weight: 680;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  strong {
    color: ${adminTextPrimary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.28rem;
    font-weight: 760;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
`
