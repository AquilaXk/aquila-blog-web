import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { marketingDark as dark } from "src/design-system/marketingPalette"

export const FeatureBlock = styled.div<{ $reverse?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(2.5rem, 6vw, 4.5rem) 0;

  > div:last-of-type {
    order: ${({ $reverse }) => ($reverse ? -1 : 0)};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);

    > div:last-of-type {
      order: 0;
    }
  }
`

export const FeatureIndex = styled.span`
  display: inline-block;
  margin-bottom: 0.75rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.textMuted};
`

export const FeatureName = styled.h3`
  margin: 0 0 1rem;
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  line-height: 1.3;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.semibold};
  color: ${dark.textPrimary};
`

export const FeatureBody = styled.p`
  margin: 0;
  max-width: 30rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${dark.textSecondary};
`

export const FeatureStage = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.75rem);
  padding: clamp(1.25rem, 2.4vw, 1.85rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.fieldDeep};

  @media (max-width: ${breakpoint.sm}px) {
    flex-direction: column;
    align-items: center;
  }
`

export const DetailCrop = styled.figure`
  margin: 0;
  width: min(100%, 26rem);

  > div {
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border: 1px solid ${dark.borderStrong};
    border-radius: ${radius.lg}px;
    background: ${dark.fieldRaised};
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 51%;
  }

  figcaption {
    margin-top: 0.6rem;
    font-size: 0.875rem;
    color: ${dark.textMuted};
  }
`

export const RouteSpecPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: clamp(1.5rem, 3.5vw, 2.25rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.fieldDeep};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const RouteSpecHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid ${dark.hairline};
`

export const RouteSpecTitle = styled.h4`
  margin: 0;
  font-size: 1.1rem;
  font-weight: ${fontWeight.semibold};
  color: ${dark.textPrimary};
  letter-spacing: -0.01em;
`

export const RouteSpecTag = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.signature};
`

export const RouteSpecList = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.hairline};
  overflow: hidden;

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const RouteSpecCard = styled.div`
  padding: 1.25rem;
  background: ${dark.fieldRaised};

  @media (forced-colors: active) {
    border: 1px solid CanvasText;
  }

  dt {
    margin: 0 0 0.35rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.signature};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.9375rem;
      font-weight: ${fontWeight.semibold};
      color: ${dark.textPrimary};
    }

    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.55;
      color: ${dark.textSecondary};
    }
  }
`

export const TimelineShowcase = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(1.25rem, 2.5vw, 2rem);
  width: 100%;

  @media (max-width: ${breakpoint.sm}px) {
    flex-direction: column;
    align-items: stretch;
  }
`

export const TimelinePhoneFrame = styled.figure`
  position: relative;
  flex: 0 0 clamp(11rem, 24vw, 14.5rem);
  margin: 0;
  padding: 0.4rem;
  border: 1px solid ${dark.borderStrong};
  border-radius: 1.5rem;
  background: ${dark.fieldDeep};
  box-shadow: ${dark.phoneShadow};

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.15rem;
  }

  @media (max-width: ${breakpoint.sm}px) {
    flex: none;
    width: min(100%, 14rem);
    margin: 0 auto;
  }
`

export const TimelineCalloutCluster = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.hairline};
  overflow: hidden;
`

export const TimelineCalloutCard = styled.div`
  padding: 1.15rem 1.25rem;
  background: ${dark.fieldRaised};

  strong {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.9375rem;
    font-weight: ${fontWeight.semibold};
    color: ${dark.textPrimary};
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.55;
    color: ${dark.textSecondary};
  }
`

export const CalloutHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;

  img {
    display: block;
    width: 22px;
    height: 22px;
    object-fit: contain;
  }
`

export const CalloutTag = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.signature};
`

export const CalloutIconSvg = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: ${dark.signature};

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`

export const ComparisonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: clamp(2rem, 4vw, 3rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.hairline};
  overflow: hidden;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ComparisonCard = styled.div<{ $variant?: "standard" | "highlighted" }>`
  display: flex;
  flex-direction: column;
  padding: clamp(1.5rem, 3vw, 2.25rem);
  background: ${({ $variant }) => ($variant === "highlighted" ? dark.fieldRaised : dark.fieldDeep)};
`

export const ComparisonCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid ${dark.hairline};
`

export const ComparisonBadge = styled.span<{ $variant?: "standard" | "highlighted" }>`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 26px;
  padding: 0 0.65rem;
  border: 1px solid
    ${({ $variant }) => ($variant === "highlighted" ? dark.signature : dark.hairline)};
  border-radius: ${radius.xs}px;
  background: ${({ $variant }) => ($variant === "highlighted" ? dark.signature : dark.fieldDeep)};
  color: ${({ $variant }) => ($variant === "highlighted" ? dark.onSignature : dark.textMuted)};
  font-size: 0.75rem;
  font-weight: ${fontWeight.semibold};
`

export const ComparisonTitle = styled.h3`
  margin: 0;
  font-size: clamp(1.25rem, 2.2vw, 1.5rem);
  font-weight: ${fontWeight.semibold};
  color: ${dark.textPrimary};
  letter-spacing: -0.01em;
`

export const ComparisonList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;

    strong {
      display: block;
      font-size: 0.9375rem;
      font-weight: ${fontWeight.semibold};
      color: ${dark.textPrimary};
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.55;
      color: ${dark.textSecondary};
    }
  }
`

export const ComparisonCheckIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: ${radius.xs}px;
  background: ${dark.signature};
  color: ${dark.onSignature};
  font-size: 0.875rem;
  font-weight: ${fontWeight.bold};

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
`

export const ComparisonCrossIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.xs}px;
  background: ${dark.fieldDeep};
  color: ${dark.textMuted};
  font-size: 0.8125rem;
  font-weight: ${fontWeight.medium};

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
`
