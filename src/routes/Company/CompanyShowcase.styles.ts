import styled from "@emotion/styled"
import { marketingDark as dark, marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint, control } from "src/design-system/tokens"

export type ShowcaseStageTone = "warm" | "cool" | "dark"

export const ShowcaseStack = styled.div`
  display: grid;
  gap: 4.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    gap: 3rem;
  }
`

export const ShowcaseRow = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 3.5rem;
  align-items: center;

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.75rem;
  }
`

export const ShowcaseCopy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.875rem;

  .paneBadge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid ${light.borderBrand};
    background: ${light.surfaceBrand};
    color: ${light.onSignature};
    font-size: 0.8125rem;
    font-weight: 600;
  }

  h3 {
    margin: 0.125rem 0 0;
    color: ${light.inkPrimary};
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    line-height: 1.18;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .paneSummary {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: 1.0625rem;
    line-height: 1.45;
    font-weight: 600;
    word-break: keep-all;
  }

  .paneDescription {
    margin: 0;
    color: ${light.inkSecondary};
    font-size: 0.96875rem;
    line-height: 1.68;
    word-break: keep-all;
  }
`

export const ShowcaseSpecList = styled.ul`
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;

  li {
    padding: 0.25rem 0.6875rem;
    border-radius: 9999px;
    border: 1px solid ${light.border};
    background: ${light.surfaceScaffold};
    color: ${light.inkSecondary};
    font-size: 0.8125rem;
    font-weight: 500;
  }
`

export const ShowcaseActionPill = styled.a`
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.25rem;
  border-radius: 9999px;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};
  color: ${light.inkPrimary};
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;

  &:hover {
    border-color: ${light.borderStrong};
    background: ${light.surfaceScaffold};
    box-shadow: ${light.hoverRing};
  }
`

export const ShowcaseStage = styled.div<{ $tone: ShowcaseStageTone }>`
  position: relative;
  border-radius: 1.5rem;
  padding: 2.25rem;
  border: 1px solid ${({ $tone }) => ($tone === "dark" ? dark.borderStrong : light.border)};
  background: ${({ $tone }) =>
    $tone === "dark"
      ? light.stageDarkTech
      : $tone === "warm"
        ? light.stageAmbientWarm
        : light.stageAmbientCool};
  overflow: hidden;

  @media (max-width: ${breakpoint.md - 1}px) {
    border-radius: 1.25rem;
    padding: 1.25rem 1rem;
  }
`

export const DarkClosingCard = styled.div`
  border-radius: 1.75rem;
  padding: 4rem 3.5rem;
  background: ${light.closingDarkBg};
  border: 1px solid ${dark.borderStrong};
  color: ${dark.textPrimary};
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 400px);
  gap: 3rem;
  align-items: center;

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 2.75rem 2rem;
    gap: 2rem;
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    border-radius: 1.375rem;
    padding: 2.25rem 1.25rem;
  }

  .closingEyebrow {
    margin: 0 0 0.75rem;
    color: ${dark.textMuted};
    font-size: 0.875rem;
    font-weight: 600;
  }

  h2 {
    margin: 0;
    color: ${dark.textPrimary};
    font-size: clamp(1.875rem, 3.4vw, 2.5rem);
    line-height: 1.18;
    font-weight: 600;
    letter-spacing: -0.03em;
    word-break: keep-all;
  }

  .closingLead {
    margin: 0.875rem 0 0;
    color: ${dark.textSecondary};
    font-size: 1.03125rem;
    line-height: 1.65;
    word-break: keep-all;
  }
`

export const InversePrimaryPill = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.375rem;
  border-radius: 9999px;
  background: ${light.surface};
  color: ${light.inkPrimary};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 150ms ease;

  &:hover {
    background: ${light.surfaceBrand};
  }
`

export const InverseSecondaryPill = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.375rem;
  border-radius: 9999px;
  border: 1px solid ${light.darkCardBorder};
  background: transparent;
  color: ${dark.textPrimary};
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 150ms ease, border-color 150ms ease;

  &:hover {
    background: ${light.darkPillHover};
    border-color: ${dark.textMuted};
  }
`

export const DarkProofCard = styled.div`
  border-radius: 1.25rem;
  border: 1px solid ${light.darkCardBorder};
  background: ${light.darkCardSurface};
  padding: 1.5rem;

  .proofTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .proofIdentity {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;

    > span[aria-hidden="true"] {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }
  }

  .proofTitle {
    color: ${dark.textPrimary};
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .proofSubtitle {
    color: ${dark.textMuted};
    font-size: 0.75rem;
  }

  .proofBadge {
    padding: 0.125rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid ${light.darkCardBorder};
    color: ${dark.textSecondary};
    font-size: 0.75rem;
    font-weight: 600;
  }

  .proofDesc {
    margin: 1rem 0 0;
    color: ${dark.textSecondary};
    font-size: 0.875rem;
    line-height: 1.6;
    word-break: keep-all;
  }

  .proofStats {
    margin: 1.25rem 0 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-radius: 0.75rem;
    border: 1px solid ${light.darkCardBorder};
    background: ${dark.fieldDeep};
    overflow: hidden;

    > div {
      padding: 0.875rem 1rem;

      & + div {
        border-left: 1px solid ${light.darkCardBorder};
      }
    }

    dt {
      color: ${dark.textMuted};
      font-size: 0.75rem;
    }

    dd {
      margin: 0.25rem 0 0;
      color: ${dark.textPrimary};
      font-size: 0.9375rem;
      font-weight: 600;
    }
  }

  .proofFoot {
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: ${dark.textMuted};
  }
`

export const FooterWordmarkBanner = styled.div`
  max-width: 75rem;
  margin: 0 auto;
  padding: 0 2.5rem 2rem;
  user-select: none;

  svg {
    display: block;
    width: 100%;
    height: auto;
    color: ${light.surfaceSubtle};
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 1rem 1.25rem;
  }
`
