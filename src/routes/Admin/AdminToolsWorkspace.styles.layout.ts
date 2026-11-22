// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.tsx & QueueStats.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { control } from "src/design-system/tokens"
import {
  AdminActionCardButton,
  AdminRailCard,
  AdminStickyRail,
  AdminStatusPill,
  adminInteractiveFocusRing,
} from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminStatusDangerBg,
  adminStatusDangerBorder,
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
  adminTerminalBg,
  adminTerminalFg,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
  adminWarningBadgeText,
} from "src/routes/Admin/adminColorTokens"

export const InlineNotice = styled.p`
  margin: 0;
  padding: 0.68rem 0.85rem;
  border-radius: 8px;
  border: 0;
  background: ${adminSurfaceRaised};
  color: ${adminTextPrimary};
  font-size: 0.84rem;
  line-height: 1.55;

  &[data-tone="warning"] {
    background: ${adminStatusWarnBg};
    color: ${adminWarningBadgeText()};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }

  &[data-tone="success"] {
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }
`

export const SubtleMetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem 1.15rem;
  padding: 0.62rem 0;
  border-block: 1px solid ${adminBorderSubtle};

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`

export const SubtleMetaItem = styled.div`
  display: grid;
  gap: 0.16rem;
  padding: 0;
  border-radius: 0;
  border: 0;
  background: transparent;

  span {
    color: ${adminTextSecondary};
    font-size: 0.74rem;
    font-weight: 660;
  }

  strong {
    color: ${adminTextPrimary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
`

export const CompactList = styled.div`
  display: grid;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};
  border-radius: 0;
  background: transparent;
`

export const CompactListItem = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.68rem 0;
  border-bottom: 1px solid ${adminBorderSubtle};

  &:last-of-type {
    border-bottom: 0;
    padding-bottom: 0.15rem;
  }

  div {
    min-width: 0;
    display: grid;
    gap: 0.16rem;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.85rem;
  }

  span,
  small {
    color: ${adminTextSecondary};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    flex-direction: column;
  }
`

export const CompactCodeList = styled.div`
  display: grid;
  gap: 0.38rem;
  padding: 0.35rem 0 0.5rem;

  code {
    display: block;
    border-radius: 6px;
    border: 1px solid ${adminBorderSubtle};
    background: ${adminTerminalBg};
    color: ${adminTerminalFg};
    padding: 0.55rem 0.72rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.77rem;
    overflow-wrap: anywhere;
  }
`

export const ExecutionLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1.1rem;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`

export const ExecutionMain = styled.div`
  display: grid;
  gap: 0.85rem;
  min-width: 0;
`

export const ExecutionRail = styled(AdminStickyRail)`
  gap: 1rem;

  @media (min-width: 961px) {
    padding-left: 1.1rem;
    border-left: 1px solid ${adminBorderSubtle};
  }
`

export const ActionGroupCard = styled(AdminRailCard)`
  gap: 0.55rem;
  padding: 0;
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
`

export const CardSectionHeading = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.8rem;

  h3,
  strong {
    display: block;
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 0.88rem;
    font-weight: 740;
    letter-spacing: -0.015em;
  }
`

export const ActionToneBadge = styled(AdminStatusPill)`
  border-radius: 6px;
  border-color: ${adminBorderSubtle};
  background: ${adminSurfaceMuted};
  color: ${adminTextPrimary};

  &[data-tone="write"] {
    border-color: ${adminBorderSubtle};
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &[data-tone="danger"] {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }

  &[data-tone="read"] {
    border-color: ${adminBorderSubtle};
    color: ${adminTextSecondary};
  }
`

export const ActionList = styled.div`
  display: grid;
  gap: 0.5rem;
`

export const ActionRowButton = styled(AdminActionCardButton)``

export const ActionRowLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0.7rem 0.88rem;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceRaised};
  color: ${adminTextPrimary};
  font-size: 0.84rem;
  font-weight: 680;
  text-decoration: none;

  &:hover {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceMuted};
  }

  &:focus-visible {
    outline: none;
    border-color: ${adminTeal};
    box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};
  }
`

export const FieldStack = styled.div`
  display: grid;
  gap: 0.72rem;
`

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.78rem;

  .wide {
    grid-column: 1 / -1;
  }

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`

export const FieldBox = styled.div`
  display: grid;
  gap: 0.38rem;
`

export const FieldLabel = styled.label`
  color: ${adminTextPrimary};
  font-size: 0.8rem;
  font-weight: 680;
`

export const Input = styled.input`
  width: 100%;
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0.68rem 0.85rem;
  font-size: 0.88rem;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-height: 44px;
    font-size: 1rem;
  }
`

export const TextArea = styled.textarea`
  width: 100%;
  min-height: 96px;
  border-radius: 8px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  padding: 0.72rem 0.85rem;
  font-size: 0.88rem;
  line-height: 1.55;
  resize: vertical;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    font-size: 1rem;
  }
`

export const PrimaryButton = styled.button`
  min-height: 40px;
  padding: 0 0.95rem;
  border-radius: 8px;
  border: 1px solid ${adminTeal};
  background: ${adminTeal};
  color: ${adminControlText};
  font-size: 0.83rem;
  font-weight: 720;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${adminTealHover};
    border-color: ${adminTealHover};
  }

  &:disabled {
    opacity: 0.56;
    cursor: not-allowed;
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const DangerPanel = styled.div`
  display: grid;
  gap: 0.85rem;
  padding: 0.9rem 0 0.25rem;
  border-radius: 0;
  border: 0;
  border-top: 1px solid ${adminBorderSubtle};
  background: transparent;

  fieldset {
    border: 0;
    border-top: 1px solid ${adminBorderSubtle};
    border-radius: 0;
    background: transparent;
    margin: 0;
    padding: 0.85rem 0 0.2rem;
    min-width: 0;
  }

  legend {
    padding: 0 0.5rem 0 0;
    color: ${adminTextPrimary};
    font-size: 0.82rem;
    font-weight: 700;
  }
`

export const SandboxSection = styled.div`
  display: grid;
  gap: 0.65rem;
`

export const SandboxHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;

  h3 {
    margin: 0;
    font-size: 0.92rem;
  }
`

export const DangerActionRow = styled.div`
  display: grid;
  gap: 0.7rem;
  padding-top: 0.3rem;
  border-top: 1px solid ${adminStatusDangerBorder};
`

export const ConfirmDeleteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 44px;
  color: ${adminTextPrimary};
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.5;

  input {
    width: 16px;
    height: 16px;
    accent-color: ${adminTeal};
  }
`

export const DangerButton = styled.button`
  width: fit-content;
  min-height: 40px;
  padding: 0 0.95rem;
  border-radius: 8px;
  border: 1px solid ${adminStatusDangerBorder};
  background: ${adminSurface};
  color: ${adminStatusDangerText};
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${adminStatusDangerBg};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: ${control.lg}px;
  }
`

export const ToolsStatusDot = styled.span`
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: ${adminTextMuted};

  &[data-tone="good"] {
    background: ${adminStatusSuccessDot};
  }

  &[data-tone="warn"] {
    background: ${adminStatusWarnDot};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerDot};
  }

  &[data-tone="info"] {
    background: ${adminStatusInfoDot};
  }
`

export {
  EmptyResultState,
  HistoryButton,
  HistoryList,
  ResultBadgeRow,
  ResultFilterButton,
  ResultFilterRow,
  ResultHistoryCard,
  ResultMetaGrid,
  ResultPanel,
  ResultPrimaryCard,
  ResultsLayout,
  ResultSummary,
  ResultTop,
} from "./AdminToolsResultsPanel"
