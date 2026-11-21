/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/layout/site-header.tsx, components/layout/site-footer.tsx, MIT License)
 * - mickasmt/next-saas-stripe-starter (components/sections/grid-section.tsx, components/sections/hero-starter.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint, control } from "src/design-system/tokens"

export const ProductSurface = styled.div`
  --es-surface-elevated: ${light.surface};
  position: relative;
  min-height: 100vh;
  background: ${light.surface};
  color: ${light.inkPrimary};
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;

  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 3px;
  }

  [data-reveal] {
    transform: translateY(8px);
    transition: transform 320ms ease;
  }

  [data-reveal].is-visible,
  [data-reveal]:focus-within {
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    [data-reveal] {
      transform: none;
      transition: none;
    }
  }
`

export const SurfaceHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  border-bottom: 1px solid ${light.gridBorder};
  background: var(--es-surface-elevated);
  transition: background-color 160ms ease;

  &.scrolled {
    background: ${light.surface};
    box-shadow: ${light.cardShadowSm};
  }
`

export const HeaderInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 64rem;
  min-height: 4rem;
  margin: 0 auto;
  padding: 0 1.25rem;
  gap: 0.75rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    flex-wrap: wrap;
    padding: 0.375rem 0.75rem;
    row-gap: 0.25rem;
    column-gap: 0.5rem;
  }
`

export const BrandLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: ${control.lg}px;
  color: ${light.inkPrimary};
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  white-space: nowrap;

  small {
    color: ${light.inkMuted};
    font-size: 0.75rem;
    font-weight: 500;

    @media (max-width: ${breakpoint.sm - 1}px) {
      display: none;
    }
  }
`

export const HeaderLinks = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;

  @media (max-width: ${breakpoint.md - 1}px) {
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.25rem;
  }
`

export const NavLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: ${control.lg}px;
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem;
  color: ${light.inkSecondary};
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: color 140ms ease, background-color 140ms ease;

  &:hover {
    background: ${light.surfaceScaffold};
    color: ${light.inkPrimary};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 0.5rem;
    font-size: 0.8125rem;
  }
`

export const HeaderAction = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: ${control.lg}px;
  padding: 0 0.875rem;
  border-radius: 9999px;
  background: ${light.inkPrimary};
  color: ${light.surface};
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: ${light.accentPressed};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 0.75rem;
  }
`

export const GridBand = styled.section<{ $muted?: boolean; $lines?: boolean }>`
  position: relative;
  width: 100%;
  scroll-margin-top: 4.5rem;
  border-bottom: 1px solid ${light.gridBorder};
  padding: 0 1rem;
  overflow-x: clip;
  background-color: ${({ $muted }) => ($muted ? light.surfaceScaffold : light.surface)};
  background-image: ${({ $lines }) => ($lines ? light.gridPaperBg : "none")};
  background-size: 40px 40px;

  @media (max-width: ${breakpoint.md - 1}px) {
    scroll-margin-top: 7.5rem;
  }
`

export const Section = GridBand

export const GridContainer = styled.div<{ $flush?: boolean }>`
  position: relative;
  max-width: 1080px;
  margin: 0 auto;
  border-left: 1px solid ${light.gridBorder};
  border-right: 1px solid ${light.gridBorder};
  padding: ${({ $flush }) => ($flush ? "0" : "4rem 2.5rem")};

  @media (max-width: ${breakpoint.md - 1}px) {
    border-left: 0;
    border-right: 0;
    padding: ${({ $flush }) => ($flush ? "0" : "3rem 0.25rem")};
  }
`

export const HeroShell = styled.div`
  position: relative;
  overflow: hidden;
  padding: 4.5rem 2.5rem 4rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 290px);
  gap: 3rem;
  align-items: center;

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 35%;
    width: 72%;
    height: 18rem;
    transform: translate(-50%, -50%);
    background: ${light.heroWashBg};
    filter: blur(80px);
    opacity: 0.55;
    pointer-events: none;
    z-index: 0;
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 3.5rem 1rem 3rem;
    text-align: center;
  }
`

export const HeroCopy = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (max-width: ${breakpoint.lg - 1}px) {
    align-items: center;
  }
`

export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.25rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};
  color: ${light.violetText};
  font-size: 0.8125rem;
  font-weight: 600;
`

export const HeroTitle = styled.h1`
  margin: 1.5rem 0 0;
  color: ${light.inkPrimary};
  font-size: clamp(2.25rem, 4.6vw, 3.125rem);
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.03em;
  word-break: keep-all;

  span {
    display: block;
  }
`

export const HeroLead = styled.p`
  margin: 1.25rem 0 0;
  max-width: 32rem;
  color: ${light.inkSecondary};
  font-size: 1.0625rem;
  line-height: 1.65;
  word-break: keep-all;
`

export const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;

  @media (max-width: ${breakpoint.lg - 1}px) {
    justify-content: center;
  }
`

export const ButtonAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.25rem;
  border-radius: 0.5rem;
  background: ${light.inkPrimary};
  color: ${light.surface};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: box-shadow 160ms ease, background-color 160ms ease;

  &:hover {
    background: ${light.accentPressed};
    box-shadow: ${light.hoverRing};
  }
`

export const SecondaryAction = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  color: ${light.inkPrimary};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;

  &:hover {
    border-color: ${light.borderStrong};
    box-shadow: ${light.hoverRing};
  }
`

export const HeroPhoneWrap = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
`

export const AndroidPhoneFigure = styled.figure<{ $compact?: boolean }>`
  margin: 0;
  position: relative;
  width: 100%;
  max-width: ${({ $compact }) => ($compact ? "228px" : "256px")};
  padding: 20px 10px 12px;
  border-radius: 30px;
  border: 2px solid ${light.deviceOuterFill};
  background-color: ${light.phoneBezel};
  box-shadow: ${light.cardShadowXl};

  .androidHardwareChrome {
    position: absolute;
    inset: -2px -4px -2px -2px;
    width: calc(100% + 6px);
    height: calc(100% + 4px);
    pointer-events: none;
    z-index: 2;
    display: block;
  }

  picture {
    position: relative;
    z-index: 1;
    display: block;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1080 / 2340;
    border-radius: 20px;
  }
`

export const Eyebrow = styled.p`
  margin: 0 0 0.75rem;
  color: ${light.violetText};
  font-size: 0.875rem;
  font-weight: 500;
`

export const DisplayHeading = styled.h2`
  margin: 0;
  color: ${light.inkPrimary};
  font-size: clamp(1.875rem, 3.4vw, 2.25rem);
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.025em;
  word-break: keep-all;
`

export const IntroAside = styled.p`
  margin: 0.875rem 0 0;
  color: ${light.inkSecondary};
  font-size: 1rem;
  line-height: 1.65;
  word-break: keep-all;
`

export const SurfaceFooter = styled.footer`
  width: 100%;
  background: ${light.surface};
  color: ${light.inkSecondary};
`

export const FooterInner = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 3.5rem 2.5rem;
  display: grid;
  grid-template-columns: 1.5fr repeat(2, minmax(0, 1fr));
  gap: 2.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 2.5rem 1rem;
  }
`

export const FooterBrand = styled.div`
  display: grid;
  align-content: start;
  gap: 0.5rem;

  strong {
    color: ${light.inkPrimary};
    font-size: 1rem;
    font-weight: 700;
  }

  span {
    color: ${light.inkMuted};
    font-size: 0.875rem;
  }
`

export const FooterLinks = styled.nav`
  display: grid;
  align-content: start;
  gap: 0.5rem;

  h2 {
    margin: 0 0 0.25rem;
    color: ${light.inkPrimary};
    font-size: 0.875rem;
    font-weight: 600;
  }

  a {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    color: ${light.inkMuted};
    font-size: 0.875rem;
    text-decoration: none;

    &:hover {
      color: ${light.inkPrimary};
    }

    @media (max-width: ${breakpoint.md - 1}px) {
      min-height: ${control.lg}px;
    }
  }
`

export const FooterMeta = styled.div`
  display: grid;
  align-content: start;
  gap: 0.5rem;

  h2 {
    margin: 0 0 0.25rem;
    color: ${light.inkPrimary};
    font-size: 0.875rem;
    font-weight: 600;
  }

  span {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    color: ${light.inkMuted};
    font-size: 0.875rem;
  }
`

export const FooterBottomBar = styled.div`
  border-top: 1px solid ${light.gridBorder};
  padding: 1.25rem 2.5rem;
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: ${light.inkMuted};

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 1.25rem 1rem;
  }
`
