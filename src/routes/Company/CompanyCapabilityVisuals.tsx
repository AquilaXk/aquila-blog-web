import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint } from "src/design-system/tokens"
import { CheckGlyph, CompanyVectorIcon, type CompanyIconName } from "src/routes/Company/CompanyIcons"

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

const VisualWell = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  margin-bottom: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.75rem;
  color: ${light.inkSecondary};
`

const VisualChip = styled.span<{ $tone?: "brand" | "emerald" | "neutral" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  border: 1px solid
    ${({ $tone }) =>
      $tone === "brand" ? light.borderBrand : $tone === "emerald" ? light.border : light.gridBorder};
  background: ${({ $tone }) => ($tone === "brand" ? light.surfaceBrand : light.surface)};
  color: ${({ $tone }) =>
    $tone === "brand"
      ? light.onSignature
      : $tone === "emerald"
        ? light.emerald
        : light.inkPrimary};
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
`

const VisualConnector = styled.span`
  color: ${light.inkMuted};
  font-weight: 600;
`

export const renderCapabilityVisual = (id: string) => {
  switch (id) {
    case "accessibility":
      return (
        <VisualWell aria-hidden="true">
          <VisualChip>강남역 2호선</VisualChip>
          <VisualConnector>→</VisualConnector>
          <VisualChip $tone="brand">단차 0cm 직결</VisualChip>
          <VisualConnector>→</VisualConnector>
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>9-2 승차</span>
          </VisualChip>
        </VisualWell>
      )
    case "local-engine":
      return (
        <VisualWell aria-hidden="true">
          <VisualChip $tone="brand">HWP · HWPX</VisualChip>
          <VisualChip>DOCX</VisualChip>
          <VisualChip>XLSX</VisualChip>
          <VisualChip>PPTX</VisualChip>
          <VisualChip>PDF</VisualChip>
        </VisualWell>
      )
    case "sandbox-convert":
      return (
        <VisualWell aria-hidden="true">
          <VisualChip>308 Formats</VisualChip>
          <VisualConnector>→</VisualConnector>
          <VisualChip $tone="brand">Sandbox</VisualChip>
          <VisualConnector>→</VisualConnector>
          <VisualChip $tone="emerald">Auto-Delete</VisualChip>
        </VisualWell>
      )
    case "resilience":
      return (
        <VisualWell aria-hidden="true">
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>Magic Bytes</span>
          </VisualChip>
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>&lt;= 100 MP</span>
          </VisualChip>
          <VisualChip $tone="brand">Fail-Closed</VisualChip>
        </VisualWell>
      )
    case "operations":
      return (
        <VisualWell aria-hidden="true">
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>BLUE · 200 OK</span>
          </VisualChip>
          <VisualConnector>⇄</VisualConnector>
          <VisualChip>GREEN · Standby</VisualChip>
        </VisualWell>
      )
    default:
      return (
        <VisualWell aria-hidden="true">
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>axe A11y</span>
          </VisualChip>
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>Bundle</span>
          </VisualChip>
          <VisualChip $tone="emerald">
            <CheckGlyph size={12} />
            <span>OpenAPI 3.1</span>
          </VisualChip>
          <VisualChip $tone="brand">SSRF Guard</VisualChip>
        </VisualWell>
      )
  }
}
