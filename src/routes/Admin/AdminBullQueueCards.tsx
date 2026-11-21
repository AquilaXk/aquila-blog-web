// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/{QueueCard.tsx,QueueCard.module.css,QueueStats/QueueStats.tsx,QueueStats/QueueStats.module.css} (MIT)
import styled from "@emotion/styled"
import Link from "next/link"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminCardShadow,
  adminFloatingShadow,
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
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "src/routes/Admin/adminColorTokens"

export type BullQueueTone = "good" | "warn" | "danger" | "info" | "primary" | "neutral"

export type BullQueueSegment = {
  key: string
  label: string
  value: number
  tone: BullQueueTone
}

export type BullQueueCardItem = {
  key: string
  title: string
  subtitle?: string
  valueText: string
  badgeText: string
  tone: "good" | "warn" | "danger" | "neutral"
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  segments: BullQueueSegment[]
  totalCount?: number
}

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

const resolveToneDotColor = (tone: BullQueueTone): string => {
  switch (tone) {
    case "good":
      return adminStatusSuccessDot
    case "warn":
      return adminStatusWarnDot
    case "danger":
      return adminStatusDangerDot
    case "info":
      return adminStatusInfoDot
    case "primary":
      return adminTeal
    default:
      return adminTextMuted
  }
}

export const BullQueueGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  min-width: 0;
`

const BullQueueCardEl = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  padding: 1rem 1.125rem;
  border: 1px solid ${adminBorder};
  border-radius: 10px;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;

  &:hover {
    border-color: ${adminBorderStrong};
    box-shadow: ${adminFloatingShadow};
    transform: translateY(-2px);
  }

  &[data-tone="warn"] .cardPrimaryValue {
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] .cardPrimaryValue {
    color: ${adminStatusDangerText};
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
`

const TitleGroup = styled.div`
  display: grid;
  gap: 0.25rem;
  min-width: 0;

  h3 {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cardPrimaryValue {
    color: ${adminTextPrimary};
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: ${adminTextMuted};
    font-family: ${MONO_FONT};
    font-size: 0.72rem;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const HeaderContext = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  flex-shrink: 0;
`

const QueueStatusPill = styled.span<{ "data-tone"?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 1.35rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-family: ${MONO_FONT};
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;

  &[data-tone="good"] {
    background: ${adminStatusSuccessBg};
    color: ${adminStatusSuccessText};
  }

  &[data-tone="warn"] {
    background: ${adminStatusWarnBg};
    color: ${adminStatusWarnText};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }
`

const ActionLinkText = styled.a`
  color: ${adminTextSecondary};
  font-size: 0.72rem;
  font-weight: 600;
  text-decoration: none;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`

const ActionButtonText = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

const StatsBox = styled.div`
  display: grid;
  gap: 0.5rem;
  margin-top: auto;
`

const PulseTrack = styled.div`
  display: flex;
  gap: 2px;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: ${adminSurfaceMuted};
`

const PulseSegment = styled.span<{ $tone: BullQueueTone }>`
  min-width: 6px;
  height: 100%;
  border-radius: 2px;
  background: ${({ $tone }) => resolveToneDotColor($tone)};
  transition: width 220ms ease-out;
`

const StatsFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.65rem;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;

  .flag {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    color: ${adminTextSecondary};
  }

  .flagDot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .flagCount {
    color: ${adminTextPrimary};
    font-family: ${MONO_FONT};
    font-weight: 600;
  }

  .total {
    margin-left: auto;
    color: ${adminTextMuted};
    font-family: ${MONO_FONT};
    font-size: 0.7rem;
    font-weight: 600;
  }
`

export const AdminBullQueueCards = ({
  ariaLabel,
  cards,
}: {
  ariaLabel: string
  cards: BullQueueCardItem[]
}) => (
  <BullQueueGrid aria-label={ariaLabel} data-ui="bullboard-queue-grid">
    {cards.map((card) => {
      const segmentTotal = card.segments.reduce((acc, seg) => acc + Math.max(0, seg.value), 0)
      const nonZero = card.segments.filter((seg) => seg.value > 0)
      const displayedTotal = card.totalCount ?? segmentTotal
      return (
        <BullQueueCardEl key={card.key} data-tone={card.tone}>
          <CardHeader>
            <TitleGroup>
              <h3>{card.title}</h3>
              <strong className="cardPrimaryValue">{card.valueText}</strong>
              {card.subtitle ? <small>{card.subtitle}</small> : null}
            </TitleGroup>
            <HeaderContext>
              <QueueStatusPill data-tone={card.tone}>{card.badgeText}</QueueStatusPill>
              {card.actionHref && card.actionLabel ? (
                <ActionLinkText as={Link} href={card.actionHref}>
                  {card.actionLabel}
                </ActionLinkText>
              ) : card.onAction && card.actionLabel ? (
                <ActionButtonText type="button" onClick={card.onAction}>
                  {card.actionLabel}
                </ActionButtonText>
              ) : null}
            </HeaderContext>
          </CardHeader>

          <StatsBox>
            <PulseTrack aria-hidden="true">
              {segmentTotal > 0
                ? nonZero.map((seg) => (
                    <PulseSegment
                      key={`${card.key}-pulse-${seg.key}`}
                      $tone={seg.tone}
                      style={{ width: `${(seg.value / segmentTotal) * 100}%` }}
                    />
                  ))
                : null}
            </PulseTrack>
            <StatsFooter>
              {card.segments.map((seg) => (
                <span key={`${card.key}-flag-${seg.key}`} className="flag">
                  <span
                    className="flagDot"
                    style={{ background: resolveToneDotColor(seg.tone) }}
                    aria-hidden="true"
                  />
                  <span>{seg.label}</span>
                  <span className="flagCount">{seg.value.toLocaleString()}</span>
                </span>
              ))}
              <span className="total">TOTAL {displayedTotal.toLocaleString()}</span>
            </StatsFooter>
          </StatsBox>
        </BullQueueCardEl>
      )
    })}
  </BullQueueGrid>
)
