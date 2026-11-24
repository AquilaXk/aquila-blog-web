// 참조 구현: felixmosh/bull-board packages/ui/src/components/QueueCard/{QueueCard.tsx,QueueCard.module.css,QueueStats/QueueStats.tsx,QueueStats/QueueStats.module.css} (MIT)
import styled from "@emotion/styled"
import Link from "next/link"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useLanguage } from "src/libs/language"
import {
  adminBorder,
  adminBorderStrong,
  adminCardShadow,
  adminStatusDangerDot,
  adminStatusDangerText,
  adminStatusInfoDot,
  adminStatusSuccessDot,
  adminStatusSuccessText,
  adminStatusWarnDot,
  adminStatusWarnText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
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
  grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
  gap: 0.85rem;
  min-width: 0;
`

const BullQueueCardEl = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.9rem 1rem;
  border: 1px solid ${adminBorder};
  border-radius: 10px;
  background: ${adminSurface};
  box-shadow: ${adminCardShadow};
  transition: border-color 140ms ease;

  &:hover {
    border-color: ${adminBorderStrong};
  }

  &[data-tone="danger"] .cardPrimaryValue {
    color: ${adminStatusDangerText};
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;

  h3 {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
    word-break: keep-all;
    overflow-wrap: break-word;
    min-width: 0;
  }
`

const ValueGroup = styled.div`
  display: grid;
  gap: 0.2rem;
  min-width: 0;

  .cardPrimaryValue {
    color: ${adminTextPrimary};
    font-size: clamp(1.0625rem, 1.35vw, 1.25rem);
    font-weight: 700;
    line-height: 1.24;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    word-break: keep-all;
    overflow-wrap: break-word;
  }

  small {
    color: ${adminTextMuted};
    font-size: 0.75rem;
    line-height: 1.4;
    word-break: keep-all;
    overflow-wrap: break-word;
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
  gap: 0.36rem;
  height: 1.4rem;
  padding: 0 0.5rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceRaised};
  color: ${adminTextSecondary};
  font-size: 0.6875rem;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 2px;
    background: ${adminTextMuted};
    flex: 0 0 auto;
  }

  &[data-tone="good"] {
    color: ${adminStatusSuccessText};

    &::before {
      background: ${adminStatusSuccessDot};
    }
  }

  &[data-tone="warn"] {
    color: ${adminStatusWarnText};

    &::before {
      background: ${adminStatusWarnDot};
    }
  }

  &[data-tone="danger"] {
    color: ${adminStatusDangerText};

    &::before {
      background: ${adminStatusDangerDot};
    }
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
  height: 6px;
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
}) => {
  const { language } = useLanguage()
  const totalPrefix = language === "en" ? "TOTAL" : "합계"
  return (
    <BullQueueGrid aria-label={ariaLabel} data-ui="bullboard-queue-grid">
      {cards.map((card) => {
        const segmentTotal = card.segments.reduce((acc, seg) => acc + Math.max(0, seg.value), 0)
        const nonZero = card.segments.filter((seg) => seg.value > 0)
        const displayedTotal = card.totalCount ?? segmentTotal
        return (
          <BullQueueCardEl key={card.key} data-tone={card.tone}>
            <CardHeader>
              <h3>{card.title}</h3>
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
            <ValueGroup>
              <strong className="cardPrimaryValue">{card.valueText}</strong>
              {card.subtitle ? <small>{card.subtitle}</small> : null}
            </ValueGroup>

            {card.segments.length > 0 ? (
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
                  <span className="total">
                    {totalPrefix} {displayedTotal.toLocaleString()}
                  </span>
                </StatsFooter>
              </StatsBox>
            ) : null}
          </BullQueueCardEl>
        )
      })}
    </BullQueueGrid>
  )
}
