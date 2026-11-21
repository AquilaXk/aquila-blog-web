// 참조 구현: TryGhost/Ghost apps/shade/src/components/ui/{kpi-card.tsx,table.tsx,badge.tsx} (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/ui/{card.tsx,badge.tsx} (MIT)
import { css } from "@emotion/react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminAccentText,
  adminAppBackground,
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminCardGradient,
  adminCardShadow,
  adminControlText,
  adminMutedSurface,
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
  adminTealBorder,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export * from "./AdminHubSurface.styles.chrome"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

const truncateSingleLineCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const outlineDotPillCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.34rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-family: ${MONO_FONT};
  font-weight: 600;
  white-space: nowrap;

  i {
    width: 0.38rem;
    height: 0.38rem;
    border-radius: 50%;
    background: ${adminTextMuted};
    flex: 0 0 auto;
  }
`

export const Main = styled.div`
  display: grid;
  gap: 1.5rem;
  align-items: start;
  min-width: 0;
  padding: 1.5rem 1.5rem 2.75rem;
  background: ${adminAppBackground};

  @media (max-width: 768px) {
    gap: 1rem;
    padding: 0.9rem 1rem 2rem;
  }
`

export const PrimaryActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 36px;
  padding: 0 0.86rem;
  border: 1px solid ${adminTealBorder};
  border-radius: 6px;
  background: ${adminTeal};
  color: ${adminControlText};
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    background: ${adminTealHover};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const SecondaryActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 36px;
  padding: 0 0.84rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextPrimary};
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    border-color: ${adminBorderStrong};
    background: ${adminSurfaceRaised};
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const MetricGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 1080px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`

export const MetricCard = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.45rem;
  min-width: 0;
  padding: 1rem 1.15rem;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  background-image: ${adminCardGradient};
  box-shadow: ${adminCardShadow};

  .cardDescription {
    color: ${adminTextMuted};
    font-size: 0.73rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  strong {
    color: ${adminTextPrimary};
    font-size: 1.85rem;
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    ${truncateSingleLineCss}
  }

  &[data-tone="danger"] strong {
    color: ${adminStatusDangerText};
  }

  .cardFooter {
    padding-top: 0;
    border-top: 0;
    color: ${adminTextSecondary};
    font-size: 0.76rem;
    font-weight: 500;
    line-height: 1.35;
    font-variant-numeric: tabular-nums;
    ${truncateSingleLineCss}
  }
`

export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid ${adminBorder};
  border-radius: 12px;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  overflow: hidden;

  &[data-span="full"] {
    grid-column: 1 / -1;
  }
`

export const StatusList = styled.div`
  display: grid;
`

export const ActivityList = styled.div`
  display: grid;
  border-top: 1px solid ${adminBorderSubtle};
`
export const ContentList = StatusList

export const StatusRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.5rem 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  font-variant-numeric: tabular-nums;

  &:last-of-type {
    border-bottom: 0;
  }

  span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: ${adminTextSecondary};
    font-size: 0.8rem;
    font-weight: 500;
    min-width: 0;
  }

  b {
    color: ${adminTextPrimary};
    font-size: 0.83rem;
    font-weight: 600;
    ${truncateSingleLineCss}
  }

  i {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 50%;
    flex: 0 0 auto;
    background: ${adminTextMuted};
  }

  strong {
    color: ${adminTextPrimary};
    font-family: ${MONO_FONT};
    font-size: 0.74rem;
    font-weight: 600;
    text-align: right;
    white-space: nowrap;
  }

  &[data-kind="service"] strong {
    padding: 0.16rem 0.52rem;
    border-radius: 999px;
    border: 1px solid transparent;
    background: ${({ theme }) => adminMutedSurface(theme)};
    color: ${adminTextSecondary};
  }

  &[data-tone="good"] i {
    background: ${adminStatusSuccessDot};
  }

  &[data-kind="service"][data-tone="good"] strong {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="warn"] i {
    background: ${adminStatusWarnDot};
  }

  &[data-kind="service"][data-tone="warn"] strong {
    border-color: transparent;
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] i {
    background: ${adminStatusDangerDot};
  }

  &[data-kind="service"][data-tone="danger"] strong {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

export const ContentRow = styled.a`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem 8.5rem 2rem;
  gap: 1rem;
  align-items: center;
  min-width: 0;
  padding: 0.65rem 1.15rem;
  border-bottom: 1px solid ${adminBorderSubtle};
  color: inherit;
  text-decoration: none;
  ${focusVisibleRing}

  &:last-of-type {
    border-bottom: 0;
  }

  &:hover {
    background: ${adminSurfaceRaised};
  }

  &:hover .rowTitle {
    color: ${adminAccentText};
  }

  .postMain {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .mediaThumb {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 0;
    background: ${adminSurfaceRaised};
    color: ${adminTextSecondary};
  }

  .postCopy {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
  }

  .rowTitle {
    color: ${adminTextPrimary};
    font-size: 0.89rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    ${truncateSingleLineCss}
  }

  .rowMeta {
    color: ${adminTextMuted};
    font-size: 0.75rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    ${truncateSingleLineCss}
  }

  .viewsFigure {
    text-align: right;
    font-family: ${MONO_FONT};
    font-size: 0.8rem;
    font-weight: 600;
    color: ${adminTextSecondary};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  small {
    ${outlineDotPillCss}
    height: 1.45rem;
    padding: 0 0.54rem;
    font-size: 0.67rem;
    letter-spacing: 0.03em;
    justify-self: start;
  }

  &[data-status="PUBLISHED"] small {
    border-color: transparent;
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-status="PUBLISHED"] small i {
    background: ${adminStatusSuccessDot};
  }

  &[data-status="DRAFT"] small {
    border-color: transparent;
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-status="DRAFT"] small i {
    background: ${adminStatusWarnDot};
  }

  &[data-status="UNLISTED"] small i {
    background: ${adminStatusInfoDot};
  }

  .rowArrow {
    display: inline-flex;
    justify-content: flex-end;
    color: ${adminTextMuted};
  }

  &:hover .rowArrow {
    color: ${adminTextPrimary};
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.6rem;

    .viewsFigure,
    .rowArrow {
      display: none;
    }
  }
`
