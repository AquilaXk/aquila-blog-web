import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"

const CONTENT_MAX_WIDTH = "82rem"
const SECTION_PADDING_X = "clamp(1.25rem, 4vw, 3rem)"
const TRANSITION = "220ms cubic-bezier(0.165, 0.84, 0.44, 1)"
const MOTION_EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"

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
  gap: 0.45rem;
  min-height: 44px;
  padding: 0 1.1rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surfacePillGlass};
  font-size: 0.96875rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.accentText};
  text-decoration: none;
  transition: color ${TRANSITION}, background-color ${TRANSITION}, border-color ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform 240ms ${MOTION_EASE_OUT};
  }

  &:hover {
    color: ${light.accentPressed};
    background: ${light.surfaceBrand};
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
  border-radius: 1.5rem;
  background: ${light.surface};
  box-shadow: ${light.cardShadowRest};
  text-decoration: none;
  transition: border-color ${TRANSITION}, transform 320ms ${MOTION_EASE_OUT},
    box-shadow 320ms ${MOTION_EASE_OUT};

  &:hover {
    border-color: ${light.borderStrong};
    transform: translateY(-3px);
    box-shadow: ${light.cardShadowHover};
  }

  &:hover h3,
  &:hover strong {
    color: ${light.accentText};
  }

  &:hover [data-ui="company-news-media"] img {
    transform: scale(1.04);
  }

  &:hover [data-ui="company-news-action"] {
    color: ${light.accentPressed};
    gap: 0.55rem;

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
    font-weight: ${fontWeight.bold};
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
    font-size: 1rem;
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

    &:hover {
      transform: none;
    }

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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.22rem 0.6rem;
  border-radius: 9999px;
  background: ${light.surfaceBrand};
  color: ${light.accentText};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
`

export const NewsMedia = styled.div`
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: ${radius.lg}px;
  background: ${light.surfaceBrandChrome};

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 420ms ${MOTION_EASE_OUT};
  }
`

export const NewsAction = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.75rem;
  font-size: 1rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.accentText};
  transition: gap ${TRANSITION}, color ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform 240ms ${MOTION_EASE_OUT};
  }
`

export const ContactBand = styled.div`
  --aq-focus-ring: ${light.onSignature};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
  padding: clamp(2.25rem, 4.5vw, 3.5rem);
  border-radius: 2.25rem;
  border: 1px solid ${light.borderStrong};
  background: ${light.signature};
  color: ${light.onSignature};
  box-shadow: ${light.cardShadowHover};

  h2 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.5rem, 3vw, 2.2rem);
    line-height: 1.22;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.extraBold};
  }

  p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.65;
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
    align-items: center;
    gap: 0.85rem;
    padding: 1.1rem 0;
    border-top: ${PRINCIPLE_RULE};
    font-size: clamp(1.0625rem, 1.8vw, 1.15rem);
    line-height: 1.6;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkPrimary};
  }

  li:nth-child(-n + 2) {
    border-top: none;
  }

  li:nth-last-child(-n + 2) {
    border-bottom: ${PRINCIPLE_RULE};
  }

  li > span:first-of-type {
    display: flex;
    flex: 0 0 auto;
    color: ${light.accentText};
  }

  li > span:first-of-type svg {
    width: 1.375rem;
    height: 1.375rem;
    stroke-width: 2.1;
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

export const SurfaceFooter = styled.footer`
  padding: clamp(2.75rem, 6vw, 4.5rem) ${SECTION_PADDING_X};
  background: ${dark.field};
  color: ${dark.textPrimary};
`

export const FooterInner = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 0.6fr));
  gap: clamp(1.75rem, 4vw, 3.5rem);
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  @media (max-width: ${breakpoint.md}px) {
    grid-column: 1 / -1;
  }

  > div {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.02rem;
    font-weight: ${fontWeight.extraBold};
    letter-spacing: -0.02em;
  }

  > div > span:first-of-type {
    display: block;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
  }

  p {
    margin: 0;
    max-width: 22rem;
    font-size: 1rem;
    line-height: 1.7;
    color: ${dark.textSecondary};
  }

  small {
    font-size: 0.875rem;
    color: ${dark.textMuted};
  }
`

export const FooterGroup = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  h2 {
    margin: 0 0 0.35rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.textMuted};
  }

  a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    border-radius: ${radius.sm}px;
    color: ${dark.textPrimary};
    text-decoration: none;
    font-size: 1rem;
    font-weight: ${fontWeight.medium};
    transition: color ${TRANSITION};

    &:hover {
      color: ${dark.signature};
    }
  }
`

