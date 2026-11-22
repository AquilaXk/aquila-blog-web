// 참조 구현: medusajs/medusa packages/design-system/ui/src/components/code-block/code-block.tsx (MIT), felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.module.css (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { AdminPlainCard } from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminCardShadow,
  adminStatusDangerText,
  adminStatusSuccessText,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceRaised,
  adminTerminalBg,
  adminTerminalBorder,
  adminTerminalDanger,
  adminTerminalFg,
  adminTerminalHeaderBg,
  adminTerminalMuted,
  adminTerminalOk,
  adminTerminalWarn,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const PrioritySection = styled(AdminPlainCard)`
  display: grid;
  gap: 0;
  padding: 0;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  overflow: hidden;

  @media (max-width: 1120px) {
    order: -1;
  }
`

export const PrioritySummary = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.5rem;
  min-height: 1.9rem;
  padding: 0.2rem 0.62rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  ${focusVisibleRing}

  &[href] {
    cursor: pointer;
  }

  &[href]:hover {
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
  }

  &:not([href])[data-tone="neutral"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceRaised};
  }

  &:not([href])[data-tone="good"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceRaised};
    color: ${adminStatusSuccessText};
  }

  &:not([href])[data-tone="warn"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceRaised};
    color: ${adminStatusWarnText};
  }

  &:not([href])[data-tone="danger"] {
    border-color: ${adminBorder};
    background: ${adminSurfaceRaised};
    color: ${adminStatusDangerText};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const TerminalCard = styled(AdminPlainCard)`
  border-radius: 10px;
  border: 1px solid ${adminTerminalBorder};
  background: ${adminTerminalBg};
  box-shadow: ${adminCardShadow};
  overflow: hidden;
`

export const TerminalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.85rem;
  padding: 0 1.15rem;
  border-bottom: 1px solid ${adminTerminalBorder};
  background: ${adminTerminalHeaderBg};

  .terminalTitleGroup {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    color: ${adminTerminalMuted};

    svg {
      flex-shrink: 0;
    }
  }

  h2 {
    margin: 0;
    color: ${adminTerminalFg};
    font-size: 0.9rem;
    font-weight: 650;
    letter-spacing: -0.015em;
  }
`

export const LogLines = styled.div`
  display: grid;
  padding: 0.6rem 1rem 0.85rem;
  background: ${adminTerminalBg};
  font-family: ${MONO_FONT};
  font-variant-numeric: tabular-nums;
`

export const LogLine = styled.div`
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: baseline;
  gap: 0.65rem;
  padding: 0.46rem 0;
  border-bottom: 1px solid ${adminTerminalBorder};
  color: ${adminTerminalFg};
  font-size: 0.78rem;
  line-height: 1.5;

  &:last-of-type {
    border-bottom: 0;
  }

  .logTimestamp {
    color: ${adminTerminalMuted};
    white-space: nowrap;
  }

  .logLevel {
    font-weight: 700;
    white-space: nowrap;
    color: ${adminTerminalOk};
  }

  &[data-tone="warn"] .logLevel {
    color: ${adminTerminalWarn};
  }

  &[data-tone="danger"] .logLevel {
    color: ${adminTerminalDanger};
  }

  &[data-tone="neutral"] .logLevel {
    color: ${adminTerminalMuted};
  }

  p {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3rem 0.65rem;
    margin: 0;
    min-width: 0;
    color: ${adminTerminalFg};
    font-weight: 600;
  }

  small {
    color: ${adminTerminalMuted};
    font-size: 0.75rem;
    font-weight: 400;
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.22rem 0.5rem;

    p {
      grid-column: 1 / -1;
    }
  }
`
