import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"

export const FeatureBlock = styled.div<{ $reverse?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(2.5rem, 6vw, 4.5rem) 0;
  border-top: 1px solid ${light.border};

  &:first-of-type {
    margin-top: clamp(2rem, 4vw, 3rem);
  }

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
  color: ${light.accentText};
`

export const FeatureName = styled.h3`
  margin: 0 0 1rem;
  font-size: clamp(1.45rem, 2.5vw, 1.9rem);
  line-height: 1.25;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-wrap: balance;
`

export const FeatureBody = styled.p`
  margin: 0;
  max-width: 30rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${light.inkSecondary};
`

export const FeatureStage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.75rem);
  padding: 0;

  @media (max-width: ${breakpoint.sm}px) {
    flex-direction: column;
    align-items: center;
  }
`

export const DetailCrop = styled.figure`
  margin: 0;
  width: min(100%, 24rem);

  > div {
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border: 1px solid ${light.border};
    border-radius: ${radius.md}px;
    background: ${light.surface};
    box-shadow: ${light.phoneShadow};
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 51%;
  }

  figcaption {
    margin-top: 0.75rem;
    font-size: 0.84375rem;
    color: ${light.inkSecondary};
    text-align: center;
  }
`

export const RouteSpecPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: clamp(2rem, 4vw, 3rem) 0 0;
  border-top: 1px solid ${light.border};
  background: transparent;
`

export const RouteSpecHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`

export const RouteSpecTitle = styled.h4`
  margin: 0;
  font-size: 1.2rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.inkPrimary};
  letter-spacing: -0.015em;
`

export const RouteSpecTag = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.accentText};
`

export const RouteSpecList = styled.dl`
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

export const RouteSpecCard = styled.div`
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
    color: ${light.accentText};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      margin-bottom: 0.4rem;
      font-size: 1.0625rem;
      font-weight: ${fontWeight.semibold};
      color: ${light.inkPrimary};
      letter-spacing: -0.015em;
    }

    p {
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.65;
      color: ${light.inkSecondary};
    }
  }
`

export const TimelineShowcase = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  width: 100%;

  @media (max-width: ${breakpoint.sm}px) {
    flex-direction: column;
    align-items: center;
  }
`

export const TimelinePhoneFrame = styled.figure`
  position: relative;
  flex: 0 0 auto;
  width: min(100%, 17.5rem);
  margin: 0 auto;
  padding: 0.5rem;
  border: 1px solid ${dark.borderStrong};
  border-radius: 1.85rem;
  background: ${dark.fieldDeep};
  box-shadow: ${light.phoneShadow};

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.4rem;
  }

  @media (max-width: ${breakpoint.sm}px) {
    width: min(74%, 15rem);
  }

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

