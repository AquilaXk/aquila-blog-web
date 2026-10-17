import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark } from "src/design-system/marketingPalette"

export {
  CalloutHeader,
  CalloutIconSvg,
  CalloutTag,
  ComparisonBadge,
  ComparisonCard,
  ComparisonCardHeader,
  ComparisonCheckIcon,
  ComparisonCrossIcon,
  ComparisonGrid,
  ComparisonList,
  ComparisonTitle,
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
  TimelineCalloutCard,
  TimelineCalloutCluster,
  TimelinePhoneFrame,
  TimelineShowcase,
} from "src/routes/EasySubway/EasySubwayFeatures.styles"

export {
  ChipCluster,
  ContactActionGroup,
  ContactBand,
  CopyEmailAddress,
  CopyEmailButton,
  CopyIconWrapper,
  FaqAnswerText,
  FaqCard,
  FaqList,
  FaqQuestionHeader,
  FaqQuestionNumber,
  FaqQuestionText,
  FaqSection,
  MetroBadgeCard,
  MetroBadgeGrid,
  MetroSectionLead,
  MetroSectionTitle,
  ScopeChip,
  ScopeLayout,
  TechSpecCell,
  TechSpecGrid,
} from "src/routes/EasySubway/EasySubwayScope.styles"

const CONTENT_MAX_WIDTH = "75rem"
const SECTION_PADDING_Y = "clamp(3.5rem, 8vw, 7rem)"
const SECTION_PADDING_X = "clamp(1.25rem, 5vw, 3rem)"
const TRANSITION = "200ms cubic-bezier(0.165, 0.84, 0.44, 1)"
const MOTION_EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"

export const ProductSurface = styled.div`
  background: ${dark.field};
  color: ${dark.textPrimary};
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
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s ${MOTION_EASE_OUT} var(--reveal-delay, 0ms),
      transform 0.6s ${MOTION_EASE_OUT} var(--reveal-delay, 0ms);
  }

  & [data-reveal].is-visible {
    opacity: 1;
    transform: none;
  }

  & [data-reveal]:focus-within {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }

  @media (prefers-reduced-motion: reduce), (scripting: none), print {
    & [data-reveal] {
      opacity: 1 !important;
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
  background: ${dark.surfaceGlass};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid ${dark.hairline};
  transition: background-color ${TRANSITION}, border-color ${TRANSITION};

  &.scrolled,
  &[data-scrolled="true"] {
    background: ${dark.surfaceGlassScrolled};
    border-bottom-color: ${dark.borderStrong};
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
  color: ${dark.textPrimary};
  text-decoration: none;
  font-size: 1.06rem;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;

  small {
    font-size: 0.875rem;
    font-weight: ${fontWeight.regular};
    color: ${dark.textMuted};

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
  padding: 0 0.75rem;
  border-radius: ${radius.pill}px;
  color: ${dark.textSecondary};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  transition: color ${TRANSITION}, background-color ${TRANSITION};

  &:hover {
    color: ${dark.textPrimary};
    background: ${dark.fieldRaised};
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
  min-height: 46px;
  padding: 0 1.45rem;
  border-radius: ${radius.pill}px;
  background: ${dark.accent};
  color: ${dark.onAccent};
  text-decoration: none;
  font-size: 0.96875rem;
  font-weight: ${fontWeight.medium};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION};

  &:hover {
    background: ${dark.accentPressed};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (forced-colors: active) {
    border: 1px solid ButtonText;
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
  padding: 0.3rem 0.9rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.pill}px;
  background: ${dark.fieldRaised};
  color: ${dark.textPrimary};
  font-size: 0.84375rem;
  font-weight: ${fontWeight.medium};

  &::before {
    content: "";
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: ${dark.signature};
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
  padding: clamp(3.5rem, 7vw, 5.5rem) ${SECTION_PADDING_X} clamp(3rem, 7vw, 5rem);
  background: ${dark.fieldDeep};
`

export const LineArtLayer = styled.div<{ $align?: "top" | "bottom" }>`
  position: absolute;
  right: 0;
  left: 0;
  ${({ $align }) => ($align === "bottom" ? "bottom: 0;" : "top: 0;")}
  height: clamp(14rem, 34vw, 26rem);
  pointer-events: none;
`

export const HeroCopy = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: min(100%, 46rem);
  margin: 0 auto;
  text-align: center;
`

export const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(2.25rem, 5.6vw, 4.1rem);
  line-height: 1.1;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${dark.textSecondary};

  strong {
    display: block;
    font-weight: ${fontWeight.medium};
    color: ${dark.textPrimary};
  }
`

export const HeroLead = styled.p`
  position: relative;
  margin: 0;
  max-width: 32rem;
  font-size: clamp(1.0625rem, 1.5vw, 1.125rem);
  line-height: 1.7;
  color: ${dark.textSecondary};
`

export const InlineHighlight = styled.strong`
  color: ${dark.textPrimary};
  font-weight: ${fontWeight.semibold};
`

export const PhoneFrame = styled.figure<{ $width?: string }>`
  position: relative;
  margin: 0;
  width: min(94%, ${({ $width }) => $width || "21rem"});
  padding: 0.5rem;
  border: 1px solid ${dark.borderStrong};
  border-radius: 1.85rem;
  background: ${dark.fieldDeep};
  box-shadow: ${dark.phoneShadow};

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.45rem;
  }

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const HeroPhoneWrap = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  margin-bottom: 0;
`

export const Section = styled.section<{ $tone?: "base" | "raised" }>`
  position: relative;
  overflow: hidden;
  scroll-margin-top: clamp(4.5rem, 8vw, 6rem);
  padding: ${SECTION_PADDING_Y} ${SECTION_PADDING_X};
  background: ${({ $tone }) => ($tone === "raised" ? dark.fieldRaised : dark.field)};
  border-top: 1px solid ${dark.hairline};

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
  color: ${dark.textMuted};
`

export const DisplayHeading = styled.h2`
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.75rem, 3.6vw, 2.65rem);
  line-height: 1.2;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${dark.textPrimary};

  strong {
    display: block;
    font-weight: ${fontWeight.medium};
    color: ${dark.textPrimary};
  }
`

export const IntroLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
  align-items: start;
  gap: clamp(1.5rem, 4vw, 4rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const IntroAside = styled.p`
  margin: 0;
  max-width: 24rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${dark.textSecondary};

  strong {
    font-weight: ${fontWeight.semibold};
    color: ${dark.textPrimary};
  }
`

export const MetaFactRow = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin: clamp(2.25rem, 4.5vw, 3.25rem) 0 0;

  > div {
    padding-top: 1.15rem;
    border-top: 1px solid ${dark.hairline};
  }

  dt {
    margin: 0 0 0.45rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.textMuted};
  }

  dd {
    margin: 0;
  }

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const MetaBadge = styled.span<{ $accent?: boolean }>`
  display: inline-block;
  color: ${({ $accent }) => ($accent ? dark.signature : dark.textPrimary)};
  font-size: clamp(1.0625rem, 1.6vw, 1.25rem);
  font-weight: ${fontWeight.semibold};
  letter-spacing: -0.015em;
  line-height: 1.35;
`

export const MetaPill = MetaBadge

export const SurfaceFooter = styled.footer`
  padding: clamp(2.5rem, 5vw, 4rem) ${SECTION_PADDING_X};
  border-top: 1px solid ${dark.hairline};
  background: ${dark.fieldDeep};
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
    color: ${dark.textPrimary};
  }

  span {
    font-size: 1rem;
    color: ${dark.textSecondary};
  }

  small {
    font-size: 0.875rem;
    color: ${dark.textMuted};
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
    color: ${dark.textSecondary};
    text-decoration: none;
    font-size: 1rem;
    font-weight: ${fontWeight.regular};
    transition: color ${TRANSITION};

    &:hover {
      color: ${dark.signature};
    }
  }
`

