/**
 * 참조 구현:
 * - magicuidesign/magicui (apps/www/registry/magicui/dock.tsx, bento-grid.tsx — MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint } from "src/design-system/tokens"
import { renderMagicBentoStage } from "src/routes/Company/CompanyBentoVisuals"
import { CompanyVectorIcon, type CompanyIconName } from "src/routes/Company/CompanyIcons"

const WAVE_ORBS: readonly { icon: CompanyIconName; offsetPx: number }[] = [
  { icon: "train-front", offsetPx: 18 },
  { icon: "accessibility", offsetPx: 6 },
  { icon: "file-text", offsetPx: -8 },
  { icon: "table-2", offsetPx: -18 },
  { icon: "presentation", offsetPx: -22 },
  { icon: "cpu", offsetPx: -16 },
  { icon: "sandbox-convert", offsetPx: -4 },
  { icon: "file-check-2", offsetPx: 10 },
  { icon: "resilience", offsetPx: 20 },
  { icon: "layers", offsetPx: 18 },
  { icon: "git-branch", offsetPx: 6 },
  { icon: "terminal", offsetPx: -8 },
]

const OrbWaveStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.75rem 0.25rem 2.75rem;
  overflow: hidden;

  @media (max-width: ${breakpoint.lg - 1}px) {
    justify-content: center;
    flex-wrap: wrap;
    padding: 1rem 0 2rem;
    gap: 0.625rem;
  }
`

const OrbBubble = styled.span<{ $offset: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.orbShadow};
  color: ${light.inkPrimary};
  transform: translate3d(0, calc(${({ $offset }) => $offset}px + var(--orb-lift-px, 0px)), 0)
    scale(var(--orb-scale, 1));

  @media (prefers-reduced-motion: no-preference) {
    transition:
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  &:hover {
    border-color: ${light.borderBrand};
    box-shadow: ${light.cardShadowXl};
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    width: 2.75rem;
    height: 2.75rem;
    transform: none;
  }
`

export const CompanyCapabilityOrbWave: React.FC = () => (
  <OrbWaveStrip aria-hidden="true" data-orb-wave="true">
    {WAVE_ORBS.map((orb, idx) => (
      <OrbBubble key={orb.icon} $offset={orb.offsetPx} data-orb-index={idx}>
        <CompanyVectorIcon name={orb.icon} size={21} strokeWidth={1.75} />
      </OrbBubble>
    ))}
  </OrbWaveStrip>
)

export const renderCapabilityVisual = (id: string) => renderMagicBentoStage(id)
