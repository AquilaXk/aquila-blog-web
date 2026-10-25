import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"
import { MOTION_EASE_OUT, TRANSITION } from "src/routes/Company/CompanyPage.styles"

export {
  ContactBand,
  NewsAction,
  NewsCard,
  NewsGrid,
  NewsHead,
  NewsHeaderAction,
  NewsIndex,
  NewsMedia,
  NewsMeta,
  PrincipleList,
} from "src/routes/Company/CompanyNews.styles"

export const CarouselHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
`

export const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(2.25rem, 3.5vw, 3rem) clamp(1.75rem, 3vw, 2.75rem);
  margin-top: clamp(2.5rem, 4.5vw, 3.5rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const FeatureCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.35rem 0 0;
  border-top: 1px solid ${light.border};
  background: transparent;

  h3 {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.4;
    letter-spacing: -0.015em;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 0.96875rem;
    line-height: 1.68;
    color: ${light.inkSecondary};
  }
`

export const FeatureMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
`

export const FeatureIndex = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  color: ${light.accentText};
`

export const FeatureTag = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.inkSecondary};

  &::before {
    content: "·";
    margin-right: 0.5rem;
    color: ${light.inkMuted};
  }
`

export const WorkHeading = styled.h2`
  margin: 0 0 clamp(2rem, 4vw, 3rem);
  max-width: 40rem;
  font-size: clamp(1.75rem, 3.4vw, 2.65rem);
  line-height: 1.18;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
`

export const ProductShowcaseGrid = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0;
`

export const ProductShowcaseCard = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: clamp(2rem, 4.5vw, 4rem);
  align-items: center;
  padding: clamp(2.25rem, 4.5vw, 3.5rem) 0;
  border-top: 1px solid ${light.border};
  background: transparent;

  &:last-of-type {
    border-bottom: 1px solid ${light.border};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ProductShowcaseMedia = styled.div<{ $layout?: "phone" | "desktop" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;

  picture {
    display: block;
    width: ${({ $layout }) => ($layout === "phone" ? "min(100%, 15.25rem)" : "100%")};
    padding: ${({ $layout }) => ($layout === "phone" ? "0.5rem" : "0")};
    border: ${({ $layout }) => ($layout === "phone" ? `1px solid ${dark.borderStrong}` : `1px solid ${light.border}`)};
    border-radius: ${({ $layout }) => ($layout === "phone" ? "1.85rem" : `${radius.md}px`)};
    background: ${({ $layout }) => ($layout === "phone" ? dark.fieldDeep : light.surface)};
    box-shadow: ${({ $layout }) => ($layout === "phone" ? light.phoneShadow : "none")};
    overflow: hidden;

    @media (forced-colors: active) {
      border-color: CanvasText;
    }
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: ${({ $layout }) => ($layout === "phone" ? "1.4rem" : "0")};
    box-shadow: none;
  }
`

export const ProductShowcaseContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  h3 {
    margin: 0;
    font-size: clamp(1.65rem, 2.8vw, 2.2rem);
    font-weight: ${fontWeight.medium};
    letter-spacing: -0.025em;
    line-height: 1.18;
    color: ${light.inkPrimary};
  }

  .summary {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: ${fontWeight.medium};
    line-height: 1.6;
    color: ${light.inkPrimary};
  }

  .description {
    margin: 0;
    max-width: 32rem;
    font-size: 0.96875rem;
    line-height: 1.68;
    color: ${light.inkSecondary};
  }
`

export const ProductBadge = styled.span`
  align-self: flex-start;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.accentText};
`

export const ProductAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.45rem;
  min-height: 44px;
  margin-top: 0.4rem;
  padding: 0 1.25rem;
  border-radius: ${radius.sm}px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-decoration: none;
  transition: color ${TRANSITION}, background-color ${TRANSITION}, border-color ${TRANSITION};

  svg {
    transition: transform 220ms ${MOTION_EASE_OUT};
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${light.surfaceBrandChrome};
      border-color: ${light.borderStrong};

      svg {
        transform: translateX(3px);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    svg {
      transition: none;
    }
  }
`

export const StoryLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: end;
  gap: clamp(1.75rem, 5vw, 4.5rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
`

export const StoryHeadline = styled.h2`
  margin: 0;
  font-size: clamp(1.75rem, 3.4vw, 2.65rem);
  line-height: 1.18;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
`

export const StatList = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin: clamp(2.5rem, 5vw, 4rem) 0 0;

  > div {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding-top: 1.25rem;
    border-top: 1px solid ${light.border};
  }

  dt {
    margin: 0;
    font-size: clamp(1.55rem, 2.6vw, 2.05rem);
    line-height: 1.15;
    letter-spacing: -0.025em;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkPrimary};
  }

  dd {
    margin: 0;
    font-size: 0.96875rem;
    line-height: 1.6;
    color: ${light.inkSecondary};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    gap: 1.35rem 1.15rem;

    dd {
      font-size: 0.90625rem;
    }
  }
`


