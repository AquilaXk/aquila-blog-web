import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { variables } from "src/styles"
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

/**
 * 3x2 1px 헤어라인 에디토리얼 역량 그리드.
 * 카드 박스·그림자·원형 아이콘 배지·파스텔 알약 태그를 배제하고 1px 구획선과 타이포 위계로만 구성한다.
 */
export const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: clamp(2rem, 4vw, 3rem);
  border: 1px solid ${light.border};
  background: ${light.border};

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
  padding: clamp(1.5rem, 2.5vw, 2.25rem);
  background: ${light.surface};

  h3 {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.4;
    letter-spacing: -0.015em;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 0.95rem;
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
  font-weight: ${fontWeight.semibold};
  color: ${light.inkPrimary};
`

export const ProductShowcaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ProductShowcaseCard = styled.article`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background: ${light.surface};
`

export const ProductShowcaseMedia = styled.div<{ $layout?: "phone" | "desktop" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(220px, 24vw, 280px);
  padding: 1.25rem;
  border-bottom: 1px solid ${light.border};
  background: ${light.surfaceBrandChrome};
  overflow: hidden;

  picture {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  img {
    display: block;
    max-height: 100%;
    max-width: 100%;
    width: ${({ $layout }) => ($layout === "phone" ? "auto" : "100%")};
    height: ${({ $layout }) => ($layout === "phone" ? "100%" : "auto")};
    object-fit: contain;
    border-radius: ${({ $layout }) => ($layout === "phone" ? `${radius.md}px` : `${radius.sm}px`)};
    box-shadow: ${variables.ui.card.shadowFloating};
  }
`

export const ProductShowcaseContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: clamp(1.5rem, 2.5vw, 2rem);
  gap: 0.75rem;

  h3 {
    margin: 0;
    font-size: clamp(1.35rem, 2.2vw, 1.6rem);
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  .summary {
    margin: 0;
    font-size: 1.02rem;
    font-weight: ${fontWeight.semibold};
    line-height: 1.55;
    color: ${light.inkPrimary};
  }

  .description {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.65;
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

export const ProductHighlightList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0.35rem 0 0.75rem;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.925rem;
    line-height: 1.5;
    color: ${light.inkPrimary};

    svg {
      flex: 0 0 auto;
      width: 1rem;
      height: 1rem;
      color: ${light.accentText};
      stroke-width: 2.1;
    }
  }
`

export const ProductAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.4rem;
  min-height: 44px;
  margin-top: auto;
  padding: 0 1rem;
  border-radius: ${radius.sm}px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.inkPrimary};
  text-decoration: none;
  transition: color ${TRANSITION}, background-color ${TRANSITION}, border-color ${TRANSITION};

  svg {
    transition: transform 220ms ${MOTION_EASE_OUT};
  }

  &:hover {
    background: ${light.surfaceScaffold};
    border-color: ${light.borderStrong};

    svg {
      transform: translateX(3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    svg {
      transition: none;
    }
  }
`

export const ReliabilityBlock = styled.div`
  margin-top: clamp(3rem, 6vw, 4.5rem);
  padding-top: clamp(2.5rem, 5vw, 3.5rem);
  border-top: 1px solid ${light.border};
`

export const ReliabilityHeader = styled.div`
  max-width: 38rem;
  margin-bottom: clamp(1.75rem, 3.5vw, 2.5rem);

  h3 {
    margin: 0.35rem 0 0.5rem;
    font-size: clamp(1.35rem, 2.4vw, 1.7rem);
    font-weight: ${fontWeight.semibold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

export const ReliabilityList = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${light.border};
  background: ${light.border};

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ReliabilityItem = styled.li`
  display: flex;
  flex-direction: column;
  padding: clamp(1.35rem, 2.2vw, 1.85rem);
  background: ${light.surface};

  .tag {
    align-self: flex-start;
    margin-bottom: 0.65rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${light.accentText};
  }

  h4 {
    margin: 0 0 0.45rem;
    font-size: 1.0625rem;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    font-size: 0.925rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

export const StoryLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: start;
  gap: clamp(1.75rem, 5vw, 4.5rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const StoryHeadline = styled.h2`
  margin: 0;
  font-size: clamp(1.9rem, 4vw, 2.9rem);
  line-height: 1.16;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.semibold};
  color: ${light.inkPrimary};

  strong {
    display: block;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkSecondary};
  }
`

export const StatList = styled.dl`
  margin: clamp(2.25rem, 5vw, 3.5rem) 0 0;
  max-width: 34rem;

  > div {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    align-items: baseline;
    gap: 0.35rem 1.5rem;
    padding: 1.15rem 0;
    border-top: 1px solid ${light.border};
  }

  > div:first-of-type {
    border-top: none;
  }

  > div:last-of-type {
    border-bottom: 1px solid ${light.border};
  }

  dt {
    margin: 0;
    font-size: clamp(1.3rem, 2.4vw, 1.7rem);
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
  }

  dd {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
    color: ${light.inkSecondary};
  }

  @media (max-width: ${breakpoint.sm}px) {
    > div {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

