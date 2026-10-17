import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark } from "src/design-system/marketingPalette"

const TRANSITION = "200ms cubic-bezier(0.165, 0.84, 0.44, 1)"

export const ScopeLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: start;
  gap: clamp(2rem, 5vw, 4rem);
  margin-top: clamp(2rem, 4vw, 3rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ChipCluster = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;
`

export const ScopeChip = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.75rem;
  border: 1px solid ${({ $accent }) => ($accent ? dark.signature : dark.hairline)};
  border-radius: ${radius.xs}px;
  background: ${({ $accent }) => ($accent ? dark.fieldRaised : dark.fieldDeep)};
  color: ${({ $accent }) => ($accent ? dark.textPrimary : dark.textSecondary)};
  font-size: 0.875rem;
  font-weight: ${fontWeight.medium};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const TechSpecGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.hairline};
  overflow: hidden;

  @media (forced-colors: active) {
    border-color: CanvasText;
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const TechSpecCell = styled.div`
  padding: 1.5rem;
  background: ${dark.fieldDeep};

  @media (forced-colors: active) {
    border: 1px solid CanvasText;
  }

  dt {
    margin: 0 0 0.5rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.textMuted};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      font-size: 1.25rem;
      line-height: 1.3;
      font-weight: ${fontWeight.semibold};
      color: ${dark.textPrimary};
      letter-spacing: -0.01em;
    }

    p {
      margin: 0.35rem 0 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: ${dark.textSecondary};
    }
  }
`

export const MetroBadgeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
  gap: 1px;
  margin-top: 1.75rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.hairline};
  overflow: hidden;
`

export const MetroSectionTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: ${fontWeight.semibold};
  color: ${dark.textPrimary};
  letter-spacing: -0.01em;
`

export const MetroSectionLead = styled.p`
  margin: 0;
  max-width: 32rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: ${dark.textSecondary};
`

export const MetroBadgeCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem 0.5rem;
  background: ${dark.fieldDeep};
  text-align: center;

  img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }

  span {
    font-size: 0.75rem;
    font-weight: ${fontWeight.medium};
    color: ${dark.textSecondary};
  }
`

export const FaqSection = styled.div`
  width: 100%;
`

export const FaqList = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: clamp(2rem, 4vw, 3rem) 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.hairline};
  overflow: hidden;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const FaqCard = styled.li`
  padding: clamp(1.5rem, 2.8vw, 2rem);
  background: ${dark.fieldDeep};
`

export const FaqQuestionHeader = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  margin: 0 0 0.75rem;
`

export const FaqQuestionNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${editorialLabel.fontFamily};
  font-size: 0.875rem;
  font-weight: ${fontWeight.bold};
  color: ${dark.signature};
  flex-shrink: 0;
`

export const FaqQuestionText = styled.h3`
  margin: 0;
  font-size: 1.0625rem;
  font-weight: ${fontWeight.semibold};
  color: ${dark.textPrimary};
  line-height: 1.4;
  letter-spacing: -0.01em;
`

export const FaqAnswerText = styled.p`
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: ${dark.textSecondary};
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
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 1.25rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.fieldDeep};
  color: ${dark.textPrimary};
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, color ${TRANSITION};

  &:hover {
    border-color: ${dark.signature};
    background: ${dark.fieldRaised};
    color: ${dark.textPrimary};
  }

  &:active {
    background: ${dark.fieldDeep};
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
  color: ${dark.signature};

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`

export const CopyEmailAddress = styled.span`
  font-size: 0.875rem;
  color: ${dark.textMuted};
  border-left: 1px solid ${dark.hairline};
  padding-left: 0.5rem;
  margin-left: 0.25rem;

  @media (max-width: ${breakpoint.sm}px) {
    display: none;
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
  padding: clamp(2rem, 4.5vw, 3.25rem);
  border: 1px solid ${dark.borderStrong};
  border-radius: ${radius.lg}px;
  background-color: ${dark.fieldRaised};

  h2 {
    margin: 0 0 0.6rem;
    font-size: clamp(1.4rem, 2.8vw, 2rem);
    line-height: 1.25;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.semibold};
    color: ${dark.textPrimary};
  }

  p {
    margin: 0;
    max-width: 30rem;
    font-size: 1.0625rem;
    line-height: 1.7;
    color: ${dark.textSecondary};
  }
`

