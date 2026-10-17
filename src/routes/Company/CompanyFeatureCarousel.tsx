import { useEffect, useState } from "react"
import CompanyIcon from "src/routes/Company/CompanyIcon"
import { COMPANY_FEATURE_CARDS } from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanySection.styles"

const totalCards = COMPANY_FEATURE_CARDS.length

export const formatCapabilityStepLabel = (activeIndex: number, count = totalCards) =>
  `${String(activeIndex + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`

export const stepCapabilityIndex = (current: number, delta: number, count = totalCards) =>
  ((current + delta) % count + count) % count

type CompanyFeatureExplorerViewProps = {
  activeIndex: number
  isPaused: boolean
  onSelect: (index: number) => void
  onStep: (delta: number) => void
  onHoverChange: (hovered: boolean) => void
  onFocusChange: (focused: boolean) => void
}

export const CompanyFeatureExplorerView: React.FC<CompanyFeatureExplorerViewProps> = ({
  activeIndex,
  isPaused,
  onSelect,
  onStep,
  onHoverChange,
  onFocusChange,
}) => {
  const stepLabel = formatCapabilityStepLabel(activeIndex)

  return (
    <div
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocusCapture={() => onFocusChange(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onFocusChange(false)
        }
      }}
    >
      <S.ExplorerToolbar data-reveal data-reveal-group="capabilities-toolbar">
        <S.BouncerRail data-bouncer-list>
          {COMPANY_FEATURE_CARDS.map((card, index) => (
            <S.BouncerOrb
              key={card.id}
              type="button"
              $active={activeIndex === index}
              $index={index}
              data-bouncer
              aria-label={`${card.tag}: ${card.title}`}
              aria-pressed={activeIndex === index}
              onClick={() => onSelect(index)}
            >
              <CompanyIcon name={card.icon} />
            </S.BouncerOrb>
          ))}
        </S.BouncerRail>
        <S.ExplorerControls>
          <span className="stepCounter" aria-live={isPaused ? "polite" : "off"}>
            {stepLabel}
          </span>
          <S.ExplorerNavPill
            type="button"
            aria-label="이전 역량 카드"
            onClick={() => onStep(-1)}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </S.ExplorerNavPill>
          <S.ExplorerNavPill
            type="button"
            aria-label="다음 역량 카드"
            onClick={() => onStep(1)}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </S.ExplorerNavPill>
        </S.ExplorerControls>
      </S.ExplorerToolbar>

      <S.FeatureGrid role="region" aria-label="핵심 역량 카드">
        {COMPANY_FEATURE_CARDS.map((card, index) => {
          const isActive = activeIndex === index
          return (
            <S.FeatureCard
              key={card.id}
              $active={isActive}
              data-active={isActive ? "true" : "false"}
              data-reveal
              data-reveal-group="capabilities-cards"
              onMouseEnter={() => onSelect(index)}
              onClick={() => onSelect(index)}
            >
              <S.FeatureIconPanel $active={isActive}>
                <CompanyIcon name={card.icon} />
              </S.FeatureIconPanel>
              <S.FeatureTag>{card.tag}</S.FeatureTag>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </S.FeatureCard>
          )
        })}
      </S.FeatureGrid>
    </div>
  )
}

const CompanyFeatureCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const isPaused = isHovered || isFocused

  useEffect(() => {
    if (isPaused || typeof window === "undefined") return
    const isReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (isReducedMotion) return

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => stepCapabilityIndex(prev, 1))
    }, 4200)

    return () => {
      window.clearInterval(timer)
    }
  }, [isPaused])

  return (
    <CompanyFeatureExplorerView
      activeIndex={activeIndex}
      isPaused={isPaused}
      onSelect={setActiveIndex}
      onStep={(delta) => setActiveIndex((prev) => stepCapabilityIndex(prev, delta))}
      onHoverChange={setIsHovered}
      onFocusChange={setIsFocused}
    />
  )
}

export default CompanyFeatureCarousel

