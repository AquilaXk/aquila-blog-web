import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingLight as light } from "src/design-system/marketingPalette"

const TRANSITION = "200ms cubic-bezier(0.165, 0.84, 0.44, 1)"

export const TechSpecGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0;
  padding: 0;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const TechSpecCell = styled.div`
  padding: 1.15rem 0 0;
  border-top: 1px solid ${light.border};
  background: transparent;

  dt {
    margin: 0 0 0.45rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${light.inkSecondary};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      font-size: clamp(1.25rem, 2vw, 1.5rem);
      line-height: 1.25;
      font-weight: ${fontWeight.semibold};
      color: ${light.inkPrimary};
      letter-spacing: -0.02em;
    }

    p {
      margin: 0.4rem 0 0;
      font-size: 0.90625rem;
      line-height: 1.6;
      color: ${light.inkSecondary};
    }
  }
`

export const MetroBadgeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.75rem;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const MetroSectionTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: clamp(1.25rem, 2.2vw, 1.5rem);
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  letter-spacing: -0.015em;
`

export const MetroSectionLead = styled.p`
  margin: 0;
  max-width: 36rem;
  font-size: 0.96875rem;
  line-height: 1.68;
  color: ${light.inkSecondary};
`

export const MetroBadgeCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid ${light.border};
  border-radius: ${radius.md}px;
  background: ${light.surfaceScaffold};

  img {
    display: block;
    width: 28px;
    height: 28px;
    object-fit: contain;
    flex-shrink: 0;
  }

  span {
    font-size: 0.875rem;
    font-weight: ${fontWeight.medium};
    color: ${light.inkPrimary};
    line-height: 1.25;
  }
`

export const ContactActionGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
`

export const CopyEmailButton = styled.button`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 46px;
  padding: 0 1.25rem;
  border: 1px solid ${light.border};
  border-radius: ${radius.pill}px;
  background: ${light.surface};
  color: ${light.inkPrimary};
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, color ${TRANSITION};

  &:hover {
    border-color: ${light.borderStrong};
    background: ${light.surfaceBrandChrome};
    color: ${light.inkPrimary};
  }

  &:active {
    background: ${light.surfaceScaffold};
  }

  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
`

export const CopyIconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  color: ${light.accentText};

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`

export const ContactBand = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, 75rem);
  margin: 0 auto;
  padding: clamp(2.25rem, 4.5vw, 3.25rem);
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background-color: ${light.surface};

  h2 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.5rem, 3vw, 2.15rem);
    line-height: 1.22;
    letter-spacing: -0.025em;
    font-weight: ${fontWeight.medium};
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    max-width: 30rem;
    font-size: 1.03125rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`
