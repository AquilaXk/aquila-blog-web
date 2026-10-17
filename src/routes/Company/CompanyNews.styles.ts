import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { CONTENT_MAX_WIDTH, MOTION_EASE_OUT, TRANSITION } from "src/routes/Company/CompanyPage.styles"

export const NewsHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem 2.5rem;
`

export const NewsHeaderAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0 1.2rem;
  border-radius: ${radius.pill}px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-decoration: none;
  transition: color ${TRANSITION}, background-color ${TRANSITION}, border-color ${TRANSITION};

  svg {
    flex: 0 0 auto;
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

export const NewsGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  margin: clamp(2rem, 4vw, 3rem) 0 0;
  padding: 0;
  list-style: none;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const NewsCard = styled.a`
  ${focusVisibleRing};
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  height: 100%;
  padding: clamp(1.35rem, 2.2vw, 1.75rem);
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background: ${light.surface};
  text-decoration: none;
  transition: border-color ${TRANSITION};

  &:hover {
    border-color: ${light.borderStrong};
  }

  &:hover h3,
  &:hover strong {
    color: ${light.accentText};
  }

  &:hover [data-ui="company-news-media"] img {
    transform: scale(1.025);
  }

  &:hover [data-ui="company-news-action"] {
    color: ${light.accentPressed};
    gap: 0.5rem;

    svg {
      transform: translateX(3px);
    }
  }

  h3,
  strong {
    margin: 0;
    font-size: clamp(1.125rem, 1.8vw, 1.25rem);
    line-height: 1.45;
    letter-spacing: -0.015em;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkPrimary};
    transition: color ${TRANSITION};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    margin: 0;
    font-size: 0.96875rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  time {
    font-family: ${editorialLabel.fontFamily};
    font-size: 0.875rem;
    color: ${light.inkMuted};
    letter-spacing: 0.02em;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover [data-ui="company-news-media"] img {
      transform: none;
    }
  }
`

export const NewsMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`

export const NewsIndex = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  color: ${light.accentText};
`

export const NewsMedia = styled.div`
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: ${radius.md}px;
  border: 1px solid ${light.border};
  background: ${light.surfaceBrandChrome};

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 360ms ${MOTION_EASE_OUT};
  }
`

export const NewsAction = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.75rem;
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};
  color: ${light.accentText};
  transition: gap ${TRANSITION}, color ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform 220ms ${MOTION_EASE_OUT};
  }
`

export const ContactBand = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
  padding: clamp(2.25rem, 4.5vw, 3.25rem);
  border-radius: ${radius.lg}px;
  border: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
  color: ${light.inkPrimary};

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
    font-size: 1.03125rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

const PRINCIPLE_RULE = `1px solid ${light.borderBrand}`

export const PrincipleList = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 clamp(1.5rem, 4vw, 3.5rem);
  margin: clamp(2.25rem, 5vw, 3.5rem) 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: baseline;
    gap: 0.85rem;
    padding: 1.15rem 0;
    border-top: ${PRINCIPLE_RULE};
    font-size: clamp(1.03125rem, 1.6vw, 1.125rem);
    line-height: 1.6;
    font-weight: ${fontWeight.medium};
    color: ${light.inkPrimary};
  }

  li:nth-child(-n + 2) {
    border-top: none;
  }

  li:nth-last-child(-n + 2) {
    border-bottom: ${PRINCIPLE_RULE};
  }

  li > span:first-of-type {
    display: inline-flex;
    flex: 0 0 auto;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    color: ${light.accentText};
  }

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: minmax(0, 1fr);

    li:nth-child(2) {
      border-top: ${PRINCIPLE_RULE};
    }

    li:nth-last-child(2) {
      border-bottom: none;
    }
  }
`

