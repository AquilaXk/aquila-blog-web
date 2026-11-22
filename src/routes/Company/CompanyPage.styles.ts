/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/layout/site-header.tsx, grid-section.tsx, MIT License)
 * - launch-ui/launch-ui (components/sections/hero/default.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint, control } from "src/design-system/tokens"

export const CompanySurface = styled.div`
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
`

export const SurfaceHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  border-bottom: 1px solid transparent;
  background: ${light.surface};
  transition: border-color 160ms ease, box-shadow 160ms ease;

  &.scrolled {
    border-bottom-color: ${light.gridBorder};
    box-shadow: ${light.cardShadowSm};
  }
`

export const HeaderInner = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  max-width: 75rem;
  min-height: 4rem;
  margin: 0 auto;
  padding: 0 2rem;
  gap: 0.75rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 3.5rem;
    padding: 0.375rem 0.75rem;
    row-gap: 0.25rem;
    column-gap: 0.5rem;
  }
`

export const BrandLink = styled.a`
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  color: ${light.inkPrimary};
  font-size: 1.03125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  white-space: nowrap;

  > span[aria-hidden="true"],
  picture,
  img,
  svg {
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
`

export const SurfaceNav = styled.nav`
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: stretch;
    justify-content: space-between;
    width: 100%;
    padding-top: 0.125rem;
    border-top: 1px solid ${light.gridBorder};
  }
`

export const NavLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: ${control.sm}px;
  padding: 0.375rem 0.9375rem;
  border-radius: 9999px;
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
    min-height: ${control.lg}px;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
  }
`

export const HeaderAction = styled.a`
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.375rem;
  padding: 0 1rem;
  border-radius: 9999px;
  background: ${light.inkPrimary};
  color: ${light.surface};
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 140ms ease;

  &:hover {
    background: ${light.accentPressed};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    min-height: ${control.lg}px;
  }
`

export const GridBand = styled.section<{ $muted?: boolean; $lines?: boolean }>`
  position: relative;
  width: 100%;
  border-bottom: 1px solid ${light.gridBorder};
  padding: 0 1.5rem;
  overflow-x: clip;
  scroll-margin-top: 4.25rem;
  background-color: ${({ $muted }) => ($muted ? light.surfaceScaffold : light.surface)};

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 1rem;
    scroll-margin-top: 6.25rem;
  }
`

export const GridContainer = styled.div<{ $flush?: boolean }>`
  position: relative;
  max-width: 75rem;
  margin: 0 auto;
  padding: ${({ $flush }) => ($flush ? "0" : "5.25rem 0.5rem")};

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: ${({ $flush }) => ($flush ? "0" : "3.25rem 0")};
  }
`

export const HeroWash = styled.div`
  position: relative;
  overflow: hidden;
  padding: 6.5rem 1.5rem 6rem;

  &::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 40%;
    width: 74%;
    height: 20rem;
    transform: translate(-50%, -50%);
    background: ${light.heroWashBg};
    filter: blur(88px);
    opacity: 0.6;
    pointer-events: none;
    z-index: 0;
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 4.25rem 0.25rem 3.75rem;
  }
`

export const HeroCopy = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 44rem;
  min-width: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`

export const NoticePill = styled.a`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-inline-size: 100%;
  min-block-size: 2.25rem;
  padding: 0.25rem 0.875rem 0.25rem 0.375rem;
  border-radius: 9999px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};
  color: ${light.inkPrimary};
  font-size: 0.8125rem;
  line-height: 1.35;
  font-weight: 500;
  text-decoration: none;
  transition: box-shadow 150ms ease, border-color 150ms ease;

  .noticeBadge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5625rem;
    border-radius: 9999px;
    background: ${light.inkPrimary};
    color: ${light.surface};
    font-size: 0.72rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .noticeText {
    min-inline-size: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  > svg {
    flex-shrink: 0;
    color: ${light.inkMuted};
  }

  &:hover {
    border-color: ${light.borderBrand};
    box-shadow: ${light.hoverRing};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    gap: 0.375rem;
    padding: 0.25rem 0.625rem 0.25rem 0.3125rem;
    font-size: 0.75rem;
  }

  @media (pointer: coarse) {
    min-block-size: ${control.lg}px;
  }
`

export const HeroTitle = styled.h1`
  margin: 1.625rem 0 0;
  color: ${light.inkPrimary};
  font-size: clamp(2.375rem, 5.4vw, 3.625rem);
  line-height: 1.13;
  font-weight: 600;
  letter-spacing: -0.035em;
  word-break: keep-all;

  span {
    display: block;
  }
`

export const HeroLead = styled.p`
  margin: 1.375rem auto 0;
  max-width: 36rem;
  color: ${light.inkSecondary};
  font-size: 1.09375rem;
  line-height: 1.66;
  word-break: keep-all;
`

export const HeroActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2.25rem;
`

export const PrimaryCta = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.5rem;
  border-radius: 9999px;
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

export const SecondaryCta = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.5rem;
  border-radius: 9999px;
  border: 1px solid ${light.border};
  background: ${light.surfaceScaffold};
  color: ${light.inkPrimary};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;

  &:hover {
    border-color: ${light.borderStrong};
    background: ${light.surface};
    box-shadow: ${light.hoverRing};
  }
`

export const SectionEyebrow = styled.p`
  margin: 0 0 0.75rem;
  color: ${light.accentText};
  font-size: 0.875rem;
  font-weight: 600;
`

export const SectionHeading = styled.h2`
  margin: 0;
  color: ${light.inkPrimary};
  font-size: clamp(1.875rem, 3.6vw, 2.5rem);
  line-height: 1.18;
  font-weight: 600;
  letter-spacing: -0.03em;
  word-break: keep-all;
`

export const SectionLead = styled.p`
  margin: 0.875rem 0 0;
  color: ${light.inkSecondary};
  font-size: 1.03125rem;
  line-height: 1.65;
  word-break: keep-all;
`

export const SurfaceFooter = styled.footer`
  width: 100%;
  background: ${light.surface};
  color: ${light.inkSecondary};
`

export const FooterInner = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  padding: 3.75rem 2.5rem 2.25rem;
  display: grid;
  grid-template-columns: 1.5fr repeat(2, minmax(0, 1fr));
  gap: 2.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 2.5rem 1rem 1.75rem;
  }
`

export const FooterBrand = styled.div`
  display: grid;
  align-content: start;
  gap: 0.75rem;

  > div {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: ${light.inkPrimary};
    font-size: 1.03125rem;
    font-weight: 700;
  }

  p {
    margin: 0;
    max-width: 19rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${light.inkMuted};
  }
`

export const FooterGroup = styled.div`
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

export const FooterBottomBar = styled.div`
  border-top: 1px solid ${light.gridBorder};
  padding: 1.375rem 2.5rem;
  max-width: 75rem;
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
