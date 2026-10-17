import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"
import { variables } from "src/styles"

export const CONTENT_MAX_WIDTH = "75rem"
export const SECTION_PADDING_Y = "clamp(4.5rem, 10vw, 10rem)"
export const SECTION_PADDING_X = "clamp(1.25rem, 5vw, 3rem)"
export const TRANSITION = "220ms cubic-bezier(0.165, 0.84, 0.44, 1)"
export const MOTION_EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"

const cursorBlink = keyframes`
  0%, 42% { opacity: 1; transform: scaleY(1); }
  50%, 92% { opacity: 0.18; transform: scaleY(0.92); }
  100% { opacity: 1; transform: scaleY(1); }
`

const gentleFloat = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -6px, 0); }
`

export const CompanySurface = styled.div`
  --aq-focus-ring: ${light.focus};
  background: ${light.surface};
  color: ${light.inkPrimary};
  word-break: keep-all;
  overflow-wrap: break-word;

  & [id] {
    scroll-margin-top: clamp(4.75rem, 8vw, 6.25rem);

    @media (max-width: ${layoutBreakpoint.navCompact}px) {
      scroll-margin-top: 7.5rem;
    }
  }

  & [data-reveal] {
    --reveal-delay: 0ms;
    opacity: 1;
    transform: translateY(20px);
    transition: transform 0.68s ${MOTION_EASE_OUT} var(--reveal-delay, 0ms);
    will-change: transform;
  }

  & [data-reveal].is-visible {
    opacity: 1;
    transform: none;
    will-change: auto;
  }

  & [data-reveal]:focus-within {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    will-change: auto !important;
  }

  @media (prefers-reduced-motion: reduce) {
    & [data-reveal] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      will-change: auto !important;
    }
  }

  @media (scripting: none) {
    & [data-reveal] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      will-change: auto !important;
    }
  }

  @media print {
    & [data-reveal] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      will-change: auto !important;
    }
  }
`

export const NoticeBanner = styled.div`
  --aq-focus-ring: ${light.onAccent};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${SECTION_PADDING_X};
  background: ${dark.fieldDeep};
  border-bottom: 1px solid ${dark.hairline};
  text-align: center;

  a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    color: ${light.onAccent};
    font-size: 0.9375rem;
    font-weight: ${fontWeight.medium};
    text-decoration: none;
    transition: background-color ${TRANSITION};

    .noticeBadge {
      display: inline-flex;
      align-items: center;
      padding: 0.14rem 0.55rem;
      border-radius: 9999px;
      background: ${dark.signature};
      color: ${dark.onSignature};
      font-family: ${editorialLabel.fontFamily};
      font-size: 0.72rem;
      font-weight: ${fontWeight.extraBold};
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .noticeArrow {
      display: inline-flex;
      align-items: center;
      color: ${dark.signature};
      transition: transform 250ms ${MOTION_EASE_OUT};
    }

    &:hover {
      background: ${dark.surfacePillHover};

      .noticeArrow {
        transform: translateX(3.5px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      .noticeArrow {
        transition: none;
      }
    }
  }
`

export const SurfaceHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndexes.header};
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  min-height: 72px;
  padding: 0.75rem ${SECTION_PADDING_X};
  background: ${light.surfaceGlass};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid ${light.borderHairline};
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, box-shadow ${TRANSITION};

  &.scrolled,
  &[data-scrolled="true"] {
    background: ${light.surfaceGlassElevated};
    border-bottom-color: ${light.border};
    box-shadow: ${light.headerShadowScrolled};
  }

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.35rem;
  }
`

export const BrandLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  justify-self: start;
  min-height: 44px;
  padding-right: 0.5rem;
  border-radius: 9999px;
  color: ${light.inkPrimary};
  text-decoration: none;
  font-size: 1.06rem;
  font-weight: ${fontWeight.extraBold};
  letter-spacing: -0.02em;
  transition: opacity ${TRANSITION};

  &:hover {
    opacity: 0.86;
  }

  > span:first-of-type {
    display: block;
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
  }
`

export const SurfaceNav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-row: 2;
    grid-column: 1 / -1;
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-left: -0.5rem;
    row-gap: 0.25rem;
  }
`

export const NavLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 0.95rem;
  border-radius: 9999px;
  color: ${light.inkSecondary};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  transition: color ${TRANSITION}, background-color ${TRANSITION};

  &:hover {
    color: ${light.inkPrimary};
    background: ${light.surfaceHoverTint};
  }
`

export const PillAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0 1.55rem;
  border-radius: 9999px;
  background: ${light.inkPrimary};
  color: ${light.onAccent};
  text-decoration: none;
  font-size: 1rem;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION}, transform ${TRANSITION}, box-shadow ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform 240ms ${MOTION_EASE_OUT};
  }

  &:hover {
    background: ${light.accentPressed};
    transform: translateY(-1px);
    box-shadow: ${light.cardShadowRest};

    svg {
      transform: translateX(3px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    svg {
      transition: none;
    }

    &:hover {
      transform: none;
    }
  }
`

export const SecondaryPillAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 48px;
  padding: 0 1.45rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surfacePillGlass};
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: ${light.inkPrimary};
  text-decoration: none;
  font-size: 1rem;
  font-weight: ${fontWeight.semibold};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION}, transform ${TRANSITION};

  &:hover {
    background: ${light.surfaceBrand};
    border-color: ${light.borderStrong};
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`

export const HeaderAction = styled(PillAction)`
  justify-self: end;
  min-height: 44px;
  padding: 0 1.25rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-row: 1;
    grid-column: 2;
  }
`

export const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: clamp(4.25rem, 9vw, 8.75rem) ${SECTION_PADDING_X} clamp(2rem, 4vw, 3.5rem);
  text-align: center;
`

export const HeroCopy = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.4rem;
  width: min(100%, 54rem);
  margin: 0 auto;
`

export const HeroEyebrowPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.9rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surfacePillGlass};
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: ${light.accentText};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: 0.08em;
  text-transform: uppercase;

  .pulseDot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: ${light.accent};
  }
`

export const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(2.25rem, 6.2vw, 4.5rem);
  line-height: 1.08;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};
  text-wrap: balance;
`

export const HeroAccent = styled.em`
  font-style: normal;
  color: ${light.accentText};
`

export const HeroCursorBlock = styled.span`
  display: inline-block;
  width: clamp(0.32rem, 0.7vw, 0.52rem);
  height: 0.84em;
  margin-left: 0.16em;
  vertical-align: -0.08em;
  border-radius: 2px;
  background: ${light.cursorGradient};
  animation: ${cursorBlink} 1.25s steps(1, end) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const HeroLead = styled.p`
  margin: 0;
  max-width: 35rem;
  font-size: clamp(1.0625rem, 1.5vw, 1.1875rem);
  line-height: 1.65;
  color: ${light.inkSecondary};
`

export const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
`

export const HeroShowcase = styled.figure`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: clamp(2.5rem, 5vw, 4rem) auto 0;
  padding: clamp(1.5rem, 3.5vw, 2.75rem) clamp(1rem, 3vw, 2.5rem);
  border-radius: 2.25rem;
  border: 1px solid ${light.borderHairline};
  background: ${light.surfaceGlass};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: ${light.cardShadowRest};
`

export const HeroFloatingPill = styled.div<{ $position: "left" | "right" }>`
  position: absolute;
  ${({ $position }) =>
    $position === "left"
      ? "left: clamp(1.5rem, 6vw, 5.5rem); top: 24%;"
      : "right: clamp(1.5rem, 6vw, 5.5rem); bottom: 24%;"}
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 1rem;
  border-radius: 9999px;
  border: 1px solid ${light.borderGlass};
  background: ${light.surfaceGlassElevated};
  box-shadow: ${light.cardShadowRest};
  color: ${light.inkPrimary};
  font-size: 0.875rem;
  font-weight: ${fontWeight.semibold};
  animation: ${gentleFloat} 5.2s ease-in-out infinite;
  animation-delay: ${({ $position }) => ($position === "left" ? "0s" : "1.8s")};

  .pillTag {
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    background: ${light.surfaceBrandStrong};
    color: ${light.onSignature};
    font-family: ${editorialLabel.fontFamily};
    font-size: 0.7rem;
    font-weight: ${fontWeight.extraBold};
    letter-spacing: 0.05em;
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const HeroPhoneFrame = styled.div`
  position: relative;
  width: min(100%, clamp(16rem, 28vw, 21rem));
  padding: 0.5rem;
  border: 1px solid ${dark.hairline};
  border-radius: 2rem;
  background: ${dark.field};
  box-shadow: ${variables.ui.card.shadowFloating};
  transition: transform 360ms ${MOTION_EASE_OUT};

  &:hover {
    transform: translateY(-4px);
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.6rem;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`

export const Section = styled.section<{ $tone?: "plain" | "scaffold" | "chrome" }>`
  position: relative;
  padding: ${SECTION_PADDING_Y} ${SECTION_PADDING_X};
  background: ${({ $tone }) => {
    if ($tone === "scaffold") return light.surfaceScaffold
    if ($tone === "chrome") return light.surfaceBrandChrome
    return light.surface
  }};
`

export const SectionInner = styled.div`
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
`

export const SectionLabel = styled.p`
  margin: 0 0 1rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.accentText};
`

export const SectionHeading = styled.h2`
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.75rem, 3.4vw, 2.65rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};
`

export const SectionAside = styled.p`
  margin: 0;
  max-width: 24rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${light.inkSecondary};
`

export {
  FooterBrand,
  FooterGroup,
  FooterInner,
  SurfaceFooter,
} from "src/routes/Company/CompanyNews.styles"
