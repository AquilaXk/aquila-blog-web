import { keyframes } from "@emotion/react"
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

const bouncerWave = keyframes`
  0%, 100% { transform: translate3d(0, 2px, 0); }
  50% { transform: translate3d(0, -3px, 0); }
`

export const CarouselHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
`

export const ExplorerToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;
  margin-top: clamp(1.75rem, 3.5vw, 2.5rem);
  padding: 0.85rem 1.15rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderHairline};
  background: ${light.surfaceScaffold};

  @media (max-width: ${breakpoint.sm}px) {
    border-radius: 1.25rem;
  }
`

export const BouncerRail = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
`

export const BouncerOrb = styled.button<{ $active?: boolean; $index?: number }>`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid ${({ $active }) => ($active ? light.accent : light.border)};
  background: ${({ $active }) => ($active ? light.accent : light.surface)};
  color: ${({ $active }) => ($active ? light.onAccent : light.accentText)};
  box-shadow: ${({ $active }) => ($active ? light.cardShadowActive : light.cardShadowRest)};
  cursor: pointer;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, color ${TRANSITION},
    transform 240ms ${MOTION_EASE_OUT};

  svg {
    width: 1.25rem;
    height: 1.25rem;
    stroke-width: 1.85;
    animation: ${bouncerWave} 3.6s ease-in-out infinite;
    animation-delay: ${({ $index = 0 }) => `${$index * 0.26}s`};
  }

  &:hover {
    border-color: ${light.borderStrong};
    background: ${({ $active }) => ($active ? light.accentPressed : light.surfaceBrand)};
    transform: translateY(-2px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    svg {
      animation: none;
    }

    &:hover {
      transform: none;
    }
  }
`

export const ExplorerControls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;

  .stepCounter {
    padding: 0 0.5rem;
    color: ${light.accentText};
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: 0.06em;
  }
`

export const ExplorerNavPill = styled.button`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surface};
  color: ${light.inkPrimary};
  cursor: pointer;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, transform ${TRANSITION};

  &:hover {
    background: ${light.surfaceBrand};
    border-color: ${light.borderStrong};
    transform: scale(1.04);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`

export const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  margin-top: clamp(1.25rem, 2.5vw, 1.75rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const FeatureCard = styled.article<{ $active?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: clamp(1.35rem, 2.2vw, 1.75rem);
  border: 1px solid ${({ $active }) => ($active ? light.borderStrong : light.border)};
  border-radius: 1.5rem;
  background: ${({ $active }) => ($active ? light.surfaceBrandChrome : light.surface)};
  box-shadow: ${({ $active }) => ($active ? light.cardShadowActive : light.cardShadowRest)};
  cursor: pointer;
  transition: border-color ${TRANSITION}, background-color ${TRANSITION},
    transform 320ms ${MOTION_EASE_OUT}, box-shadow 320ms ${MOTION_EASE_OUT};

  &:hover {
    border-color: ${light.borderStrong};
    transform: translateY(-3px);
    box-shadow: ${light.cardShadowHover};
  }

  h3 {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.4;
    letter-spacing: -0.01em;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`

export const FeatureIconPanel = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.85rem;
  height: 2.85rem;
  border-radius: 50%;
  background: ${({ $active }) => ($active ? light.accent : light.surfaceBrand)};
  color: ${({ $active }) => ($active ? light.onAccent : light.accentText)};
  transition: background-color ${TRANSITION}, color ${TRANSITION}, transform 260ms ${MOTION_EASE_OUT};

  svg {
    width: 1.4rem;
    height: 1.4rem;
    stroke-width: 1.8;
  }
`

export const FeatureTag = styled.span`
  align-self: flex-start;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  background: ${light.surfaceBrandStrong};
  color: ${light.onSignature};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: 0.06em;
  text-transform: uppercase;
`

export const WorkHeading = styled.h2`
  margin: 0 auto clamp(2.5rem, 5vw, 4rem);
  max-width: 40rem;
  font-size: clamp(1.85rem, 3.8vw, 3rem);
  line-height: 1.18;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};
  text-align: center;
`

export const ProductShowcaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin: clamp(2.5rem, 5vw, 3.5rem) 0 0;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ProductShowcaseCard = styled.article`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${light.border};
  border-radius: 1.75rem;
  background: ${light.surface};
  box-shadow: ${light.cardShadowRest};
  transition: border-color ${TRANSITION}, transform 340ms ${MOTION_EASE_OUT},
    box-shadow 340ms ${MOTION_EASE_OUT};

  &:hover {
    border-color: ${light.borderStrong};
    transform: translateY(-4px);
    box-shadow: ${light.cardShadowHover};
  }

  &:hover img {
    transform: scale(1.035);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }

    &:hover img {
      transform: none;
    }
  }
`

export const ProductShowcaseMedia = styled.div<{ $layout?: "phone" | "desktop" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(220px, 24vw, 290px);
  padding: 1.25rem;
  background: ${light.surfaceBrand};
  overflow: hidden;

  img {
    display: block;
    max-height: 100%;
    max-width: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: ${({ $layout }) => ($layout === "phone" ? `${radius.md}px` : `${radius.sm}px`)};
    box-shadow: ${variables.ui.card.shadowFloating};
    transition: transform 420ms ${MOTION_EASE_OUT};
  }
`

export const ProductShowcaseContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: clamp(1.45rem, 2.5vw, 2rem);
  gap: 0.75rem;

  h3 {
    margin: 0;
    font-size: clamp(1.35rem, 2.2vw, 1.65rem);
    font-weight: ${fontWeight.extraBold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  .summary {
    margin: 0;
    font-size: 1.05rem;
    font-weight: ${fontWeight.semibold};
    line-height: 1.5;
    color: ${light.accentText};
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
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  background: ${light.surfaceBrandStrong};
  color: ${light.onSignature};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: 0.05em;
  text-transform: uppercase;
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
      stroke-width: 2.2;
    }
  }
`

export const ProductAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.45rem;
  min-height: 44px;
  margin-top: auto;
  padding: 0 1.15rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surfacePillGlass};
  font-size: 0.96875rem;
  font-weight: ${fontWeight.bold};
  color: ${light.accentText};
  text-decoration: none;
  transition: color ${TRANSITION}, background-color ${TRANSITION}, border-color ${TRANSITION};

  svg {
    transition: transform 240ms ${MOTION_EASE_OUT};
  }

  &:hover {
    color: ${light.onAccent};
    background: ${light.inkPrimary};
    border-color: ${light.inkPrimary};

    svg {
      transform: translateX(3.5px);
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
    font-size: clamp(1.35rem, 2.4vw, 1.75rem);
    font-weight: ${fontWeight.extraBold};
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
  gap: clamp(1.25rem, 2.5vw, 2rem);
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
`

export const ReliabilityItem = styled.li`
  display: flex;
  flex-direction: column;
  padding: 1.35rem 1.5rem;
  border: 1px solid ${light.border};
  border-radius: 1.35rem;
  background: ${light.surface};
  box-shadow: ${light.cardShadowRest};
  transition: border-color ${TRANSITION}, transform 280ms ${MOTION_EASE_OUT};

  &:hover {
    border-color: ${light.borderStrong};
    transform: translateY(-2px);
  }

  .tag {
    align-self: flex-start;
    margin-bottom: 0.65rem;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    background: ${light.surfaceBrand};
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    color: ${light.accentText};
  }

  h4 {
    margin: 0 0 0.45rem;
    font-size: 1.1rem;
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

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
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
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.16;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};

  strong {
    display: block;
    font-weight: inherit;
    color: ${light.accentText};
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
    font-size: clamp(1.3rem, 2.4vw, 1.75rem);
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.extraBold};
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
