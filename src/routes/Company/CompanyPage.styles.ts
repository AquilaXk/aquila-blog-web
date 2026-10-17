import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"
import { variables } from "src/styles"

/**
 * 회사 표면의 chrome(공지 스트립 · 헤더 · 히어로 · footer)과 섹션 공통 프리미티브.
 * 섹션별 레이아웃은 `CompanySection.styles.ts`에 있다.
 *
 * 미니멀한 라이트 테마를 유지하며 불필요한 배경 장식(그리드 라인, 글로우 타원, 부유 알약 등)을 배제한다.
 * 그림자는 히어로 폰 목업과 프로덕트 쇼케이스 미디어에 한해 적용한다.
 */
export const CONTENT_MAX_WIDTH = "75rem"
export const SECTION_PADDING_Y = "clamp(4.5rem, 10vw, 10rem)"
export const SECTION_PADDING_X = "clamp(1.25rem, 5vw, 3rem)"
export const TRANSITION = "200ms cubic-bezier(0.165, 0.84, 0.44, 1)"
export const MOTION_EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)"

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

export const NoticeBanner = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;

  a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 36px;
    padding: 0.25rem 0.95rem;
    border-radius: ${radius.pill}px;
    border: 1px solid ${light.border};
    background: ${light.surfaceScaffold};
    color: ${light.inkSecondary};
    font-size: 0.84375rem;
    font-weight: ${fontWeight.medium};
    text-decoration: none;
    transition: color ${TRANSITION}, border-color ${TRANSITION}, background-color ${TRANSITION};

    svg {
      flex: 0 0 auto;
      color: ${light.accentText};
      transition: transform 220ms ${MOTION_EASE_OUT};
    }

    &:hover {
      color: ${light.inkPrimary};
      border-color: ${light.borderStrong};

      svg {
        transform: translateX(3px);
      }
    }

    @media (max-width: ${breakpoint.sm}px) {
      gap: 0.35rem;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      svg {
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
  transition: background-color ${TRANSITION}, border-color ${TRANSITION};

  &.scrolled,
  &[data-scrolled="true"] {
    background: ${light.surfaceGlassElevated};
    border-bottom-color: ${light.border};
  }

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 0;
    padding: 0.45rem ${SECTION_PADDING_X};
    row-gap: 0.2rem;
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
  border-radius: ${radius.sm}px;
  color: ${light.inkPrimary};
  text-decoration: none;
  font-size: 1.04rem;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;
  transition: opacity ${TRANSITION};

  &:hover {
    opacity: 0.82;
  }

  > span:first-of-type {
    display: block;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
  }
`

export const SurfaceNav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-row: 2;
    grid-column: 1 / -1;
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-left: -0.5rem;
    row-gap: 0.15rem;
  }
`

export const NavLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 0.85rem;
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
    padding: 0 0.65rem;
    font-size: 0.90625rem;
  }
`

export const PillAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 46px;
  padding: 0 1.4rem;
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

export const HeaderAction = styled(PillAction)`
  justify-self: end;
  min-height: 44px;
  padding: 0 1.15rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    grid-row: 1;
    grid-column: 2;
    padding: 0 0.95rem;
    font-size: 0.875rem;
  }
`

export const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: clamp(5.5rem, 11vw, 9.5rem) ${SECTION_PADDING_X} clamp(5.5rem, 11vw, 9.5rem);
  text-align: center;

  @media (max-width: ${breakpoint.sm}px) {
    padding: 3.5rem ${SECTION_PADDING_X} 3.75rem;
  }
`

export const HeroAccent = styled.div`
  display: none;
`

export const HeroCopy = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.35rem;
  width: min(100%, 52rem);
  margin: 0 auto;
`

export const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(2.45rem, 6.2vw, 4.5rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
  text-wrap: balance;

  span {
    display: block;
    color: ${light.inkSecondary};
    font-weight: ${fontWeight.medium};
  }

  @media (max-width: ${breakpoint.sm}px) {
    font-size: clamp(2rem, 8.2vw, 2.45rem);
    line-height: 1.14;
  }
`

export const HeroLead = styled.p`
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.0625rem, 1.45vw, 1.15rem);
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

  @media (max-width: ${breakpoint.sm}px) {
    width: 100%;

    a {
      flex: 1 1 11rem;
    }
  }
`

export const HeroShowcase = styled.figure`
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  margin: clamp(2.5rem, 5vw, 4rem) auto 0;
  padding: 0;
`

export const HeroPhoneFrame = styled.div`
  position: relative;
  width: min(100%, clamp(16rem, 28vw, 21rem));
  padding: 0.5rem;
  border: 1px solid ${dark.hairline};
  border-radius: 2rem;
  background: ${dark.field};
  box-shadow: ${variables.ui.card.shadowFloating};

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.6rem;
  }
`

export const Section = styled.section<{ $tone?: "plain" | "scaffold" | "chrome" }>`
  position: relative;
  padding: ${SECTION_PADDING_Y} ${SECTION_PADDING_X};
  border-top: 1px solid ${light.borderHairline};
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
  margin: 0 0 0.85rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${light.inkSecondary};
`

export const SectionHeading = styled.h2`
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.75rem, 3.4vw, 2.65rem);
  line-height: 1.18;
  letter-spacing: -0.025em;
  font-weight: ${fontWeight.medium};
  color: ${light.inkPrimary};
`

export const SectionAside = styled.p`
  margin: 0;
  max-width: 24rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${light.inkSecondary};
`

export const SurfaceFooter = styled.footer`
  padding: clamp(3rem, 6vw, 4.5rem) ${SECTION_PADDING_X};
  border-top: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
  color: ${light.inkPrimary};
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
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
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
    font-size: 0.96875rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }

  small {
    font-size: 0.84375rem;
    color: ${light.inkMuted};
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
    color: ${light.inkMuted};
  }

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

