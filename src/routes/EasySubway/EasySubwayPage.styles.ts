import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingLight as light } from "src/design-system/marketingPalette"

export {
  DetailCrop,
  FeatureBlock,
  FeatureBody,
  FeatureIndex,
  FeatureName,
  FeatureStage,
  RouteSpecCard,
  RouteSpecHeader,
  RouteSpecList,
  RouteSpecPanel,
  RouteSpecTag,
  RouteSpecTitle,
  TimelinePhoneFrame,
  TimelineShowcase,
} from "src/routes/EasySubway/EasySubwayFeatures.styles"

export {
  ContactActionGroup,
  ContactBand,
  CopyEmailButton,
  CopyIconWrapper,
  MetroBadgeCard,
  MetroBadgeGrid,
  MetroSectionLead,
  MetroSectionTitle,
  TechSpecCell,
  TechSpecGrid,
} from "src/routes/EasySubway/EasySubwayScope.styles"

const CONTENT_MAX_WIDTH = "75rem"
const SECTION_PADDING_Y = "clamp(4rem, 8.5vw, 7.5rem)"
const SECTION_PADDING_X = "clamp(1.25rem, 5vw, 3rem)"
const TRANSITION = "200ms cubic-bezier(0.165, 0.84, 0.44, 1)"
const MOTION_EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"

export const ProductSurface = styled.div`
  --aq-focus-ring: ${light.focus};
  background: ${light.surface};
  color: ${light.inkPrimary};
  word-break: keep-all;
  overflow-wrap: break-word;

  & [id] {
    scroll-margin-top: clamp(4.5rem, 8vw, 6rem);

    @media (max-width: ${layoutBreakpoint.navCompact}px) {
      scroll-margin-top: 7.75rem;
    }
  }

  & [data-reveal] {
    --reveal-delay: 0ms;
    transform: translateY(12px);
    transition: transform 0.56s ${MOTION_EASE_OUT} var(--reveal-delay, 0ms);
  }

  & [data-reveal].is-visible {
    transform: none;
  }

  & [data-reveal]:focus-within {
    transform: none !important;
    transition: none !important;
  }

  @media (prefers-reduced-motion: reduce), (scripting: none), print {
    & [data-reveal] {
      transform: none !important;
      transition: none !important;
    }
  }
`

export const SurfaceHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndexes.header};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 72px;
  padding: 0.75rem ${SECTION_PADDING_X};
  background: ${light.surfaceGlass};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid ${light.borderHairline};
  transition: background-color ${TRANSITION}, border-color ${TRANSITION};

  &.scrolled,
  &[data-scrolled="true"] {
    background: ${light.surfaceGlassElevated};
    border-bottom-color: ${light.border};
  }

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    flex-wrap: wrap;
    row-gap: 0.35rem;
  }
`

export const BrandLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  min-height: 44px;
  border-radius: ${radius.sm}px;
  color: ${light.inkPrimary};
  text-decoration: none;
  font-size: 1.06rem;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;

  small {
    font-size: 0.875rem;
    font-weight: ${fontWeight.regular};
    color: ${light.inkSecondary};

    @media (max-width: ${breakpoint.sm}px) {
      display: none;
    }
  }
`

export const HeaderLinks = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    flex: 1 0 100%;
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
  min-height: 44px;
  padding: 0 0.8rem;
  border-radius: ${radius.pill}px;
  color: ${light.inkSecondary};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  transition: color ${TRANSITION}, background-color ${TRANSITION};

  &:hover {
    color: ${light.inkPrimary};
    background: ${light.surfaceHoverTint};
  }

  @media (max-width: ${breakpoint.sm}px) {
    padding: 0 0.5rem;
  }
`

export const ButtonAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 46px;
  padding: 0 1.45rem;
  border-radius: ${radius.pill}px;
  background: ${light.inkPrimary};
  color: ${light.onAccent};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform 220ms ${MOTION_EASE_OUT};
  }

  &:hover {
    background: ${light.accentPressed};

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

  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
`

export const SecondaryPillAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 46px;
  padding: 0 1.35rem;
  border-radius: ${radius.pill}px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  color: ${light.inkPrimary};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION}, border-color ${TRANSITION};

  &:hover {
    background: ${light.surfaceScaffold};
    border-color: ${light.borderStrong};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export const PillAction = ButtonAction

export const HeaderAction = styled(ButtonAction)`
  min-height: 44px;
  padding: 0 1.15rem;
  border-radius: ${radius.pill}px;
`

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.95rem;
  border: 1px solid ${light.border};
  border-radius: ${radius.pill}px;
  background: ${light.surfaceScaffold};
  color: ${light.inkSecondary};
  font-size: 0.84375rem;
  font-weight: ${fontWeight.medium};

  &::before {
    content: "";
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: ${light.accent};
  }

  @media (forced-colors: active) {
    border-color: CanvasText;

    &::before {
      background: CanvasText;
    }
  }
`

export const StatusPill = StatusBadge

export const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: clamp(4.5rem, 9vw, 7rem) ${SECTION_PADDING_X} clamp(3.5rem, 7vw, 5.5rem);
  background: ${light.surface};
`

export const HeroCopy = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.35rem;
  width: min(100%, 48rem);
  margin: 0 auto;
  text-align: center;
`

export const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(2.35rem, 5.8vw, 4.25rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-wrap: balance;

  strong,
  span {
    display: block;
    font-weight: ${fontWeight.medium};
    color: ${light.inkSecondary};
  }
`

export const HeroLead = styled.p`
  position: relative;
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.0625rem, 1.45vw, 1.15rem);
  line-height: 1.68;
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

export const PhoneFrame = styled.figure<{ $width?: string }>`
  position: relative;
  margin: 0;
  width: min(94%, ${({ $width }) => $width || "20.5rem"});
  padding: 0.5rem;
  border: 1px solid ${light.border};
  border-radius: 2rem;
  background: ${light.surface};
  box-shadow: ${light.phoneShadow};

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.55rem;
  }

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const HeroPhoneWrap = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: clamp(2.5rem, 5vw, 3.75rem);
  margin-bottom: 0;
`

export const Section = styled.section<{ $tone?: "base" | "raised" }>`
  position: relative;
  overflow: hidden;
  scroll-margin-top: clamp(4.5rem, 8vw, 6rem);
  padding: ${SECTION_PADDING_Y} ${SECTION_PADDING_X};
  background: ${({ $tone }) => ($tone === "raised" ? light.surfaceScaffold : light.surface)};
  border-top: 1px solid ${light.borderHairline};

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    scroll-margin-top: 7.75rem;
  }
`

export const SectionInner = styled.div`
  position: relative;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
`

export const Eyebrow = styled.p`
  margin: 0 0 0.85rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.inkSecondary};
`

export const DisplayHeading = styled.h2`
  margin: 0;
  max-width: 36rem;
  font-size: clamp(1.75rem, 3.4vw, 2.65rem);
  line-height: 1.18;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-wrap: balance;
`

export const IntroLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
  align-items: end;
  gap: clamp(1.5rem, 4vw, 4rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
`

export const IntroAside = styled.p`
  margin: 0;
  max-width: 24rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${light.inkSecondary};
`

export const SurfaceFooter = styled.footer`
  padding: clamp(2.75rem, 5vw, 4rem) ${SECTION_PADDING_X};
  border-top: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
`

export const FooterInner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
`

export const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  strong {
    font-size: 1rem;
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  span {
    font-size: 0.96875rem;
    color: ${light.inkSecondary};
  }

  small {
    font-size: 0.84375rem;
    color: ${light.inkMuted};
  }
`

export const FooterLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;

  a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    border-radius: ${radius.sm}px;
    color: ${light.inkSecondary};
    text-decoration: none;
    font-size: 0.96875rem;
    font-weight: ${fontWeight.medium};
    transition: color ${TRANSITION};

    &:hover {
      color: ${light.inkPrimary};
    }
  }
`
