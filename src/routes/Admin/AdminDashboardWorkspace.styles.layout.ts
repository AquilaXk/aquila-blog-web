// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/QueueCard.module.css (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/section-cards.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { AdminPlainCard } from "src/routes/Admin/AdminSurfacePrimitives"
import {
  adminAppBackground,
  adminBorder,
  adminBorderSubtle,
  adminCardGradient,
  adminCardShadow,
  adminControlText,
  adminStatusDangerBg,
  adminStatusDangerDot,
  adminStatusDangerText,
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
  adminTealBorder,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const Main = styled.div`
  display: grid;
  gap: 1.15rem;
  align-items: start;
  min-width: 0;
  padding: 1.25rem 1.75rem 2.75rem;
  background: ${adminAppBackground};

  @media (max-width: 768px) {
    gap: 0.85rem;
    padding: 0.9rem 1rem 2rem;
  }
`

export const Shell = styled.div`
  display: grid;
  gap: 1.1rem;
  width: 100%;
  min-width: 0;
  margin: 0;
`

export const HeroPanel = styled.section`
  display: grid;
  min-width: 0;
  padding: 0 0 0.88rem;
  border-bottom: 1px solid ${adminBorder};

  @media (max-width: 768px) {
    padding-bottom: 0.7rem;
  }
`

export const HeroTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
  min-width: 0;
`

export const HeroCopy = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;

  h1,
  h2 {
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 1.35rem;
    line-height: 1.22;
    letter-spacing: -0.025em;
    font-weight: 700;
    overflow-wrap: break-word;
  }

  @media (max-width: 768px) {
    h1,
    h2 {
      font-size: 1.18rem;
    }
  }
`

export const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
`

export const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  min-height: 26px;
  padding: 0 0.55rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.72rem;
  font-weight: 550;
  white-space: nowrap;

  &[data-tone="good"] {
    border-color: ${adminBorder};
    background: ${adminSurface};
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

export const HeaderLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0 0.85rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextPrimary};
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    background: ${adminSurfaceRaised};
  }

  &[data-variant="primary"] {
    border-color: ${adminTealBorder};
    background: ${adminTeal};
    color: ${adminControlText};
    font-weight: 600;
  }

  &[data-variant="primary"]:hover {
    background: ${adminTealHover};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const ServiceRail = styled.section`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;

  &[data-count="3"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 1199px) {
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));

    &[data-count="3"] {
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    }
  }

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }
`

export const MetricCard = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 0.95rem 1.08rem;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  background-image: ${adminCardGradient};
  box-shadow: ${adminCardShadow};

  &[data-tone="warn"] strong {
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] strong {
    color: ${adminStatusDangerText};
  }

  @media (max-width: 640px) {
    padding: 0.72rem 0.82rem;

    &:last-of-type:nth-of-type(odd) {
      grid-column: 1 / -1;
    }
  }
`

export const MetricCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;

  .metricHead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
    min-width: 0;
  }

  .metricLabel {
    color: ${adminTextMuted};
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metricPill {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    height: 1.25rem;
    padding: 0 0.44rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: ${adminSurfaceMuted};
    color: ${adminTextSecondary};
    font-family: ${MONO_FONT};
    font-size: 0.63rem;
    font-weight: 600;
    white-space: nowrap;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 1.65rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    padding-top: 0.48rem;
    border-top: 0;
    color: ${adminTextSecondary};
    font-size: 0.74rem;
    font-weight: 500;
    line-height: 1.32;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    gap: 0.3rem;

    strong {
      font-size: 1.2rem;
    }

    small {
      padding-top: 0.34rem;
      font-size: 0.7rem;
    }
  }
`

export const StatusMenuList = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: ${adminSurface};
`

export const StatusMenuTab = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0 0.68rem;
  border: 0;
  background: transparent;
  color: ${adminTextMuted};
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
  }

  &[aria-selected="true"] {
    color: ${adminTextPrimary};

    &::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 2px;
      background: ${adminTeal};
    }
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const OpsGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 1fr);
  gap: 1rem;
  align-items: start;
  min-width: 0;

  > [data-size="wide"] {
    grid-column: 1 / -1;
  }

  @media (max-width: 1120px) {
    grid-template-columns: 1fr;
  }
`

export const PanelCard = styled(AdminPlainCard)`
  border-radius: 12px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  overflow: hidden;
`

export const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.1rem;
  padding: 0 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};

  h2,
  strong {
    display: block;
    margin: 0;
    color: ${adminTextPrimary};
    font-size: 0.93rem;
    font-weight: 700;
    letter-spacing: -0.015em;
  }

  span {
    color: ${adminTextMuted};
    font-size: 0.72rem;
    font-weight: 600;
  }

  .monoTag {
    font-family: ${MONO_FONT};
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    color: ${adminTextMuted};
  }
`

export const StatusRows = styled.div`
  display: grid;
`

export const StatusRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  min-height: 4rem;
  padding: 0.72rem 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  font-variant-numeric: tabular-nums;

  &:last-of-type {
    border-bottom: 0;
  }

  > span {
    display: flex;
    align-items: center;
    gap: 0.62rem;
    min-width: 0;
  }

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 0.86rem;
    font-weight: 600;
  }

  small {
    color: ${adminTextMuted};
    font-family: ${MONO_FONT};
    font-size: 0.73rem;
    font-weight: 500;
    line-height: 1.4;
  }
`

export const StatusDot = styled.i`
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 50%;
  flex: 0 0 auto;
  background: ${adminStatusSuccessDot};

  &[data-tone="warn"] {
    background: ${adminStatusWarnDot};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerDot};
  }

  &[data-tone="neutral"] {
    background: ${adminTextMuted};
  }
`

export const LaunchLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  background: ${adminSurfaceRaised};
  color: ${adminTextPrimary};
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const PanelBody = styled.div`
  background: ${adminSurface};
`
