/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/sections/modules-showcase.tsx, MIT License)
 * - magicuidesign/magicui (apps/www/registry/magicui/android.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint } from "src/design-system/tokens"

export const ModuleBandHead = styled.div`
  padding: 3.5rem 2.5rem 2.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;

  > div {
    max-width: 36rem;
  }

  > p {
    max-width: 24rem;
    margin: 0;
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 2.5rem 1rem 1.75rem;
  }
`

export const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid ${light.gridBorder};

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const FeaturePane = styled.article`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.75rem;
  padding: 2.5rem;

  & + & {
    border-left: 1px solid ${light.gridBorder};

    @media (max-width: ${breakpoint.lg - 1}px) {
      border-left: 0;
      border-top: 1px solid ${light.gridBorder};
    }
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 2rem 1rem;
  }
`

export const FeatureIndex = styled.span`
  display: inline-block;
  margin-bottom: 0.5rem;
  color: ${light.violetText};
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
`

export const FeatureName = styled.h3`
  margin: 0 0 0.625rem;
  color: ${light.inkPrimary};
  font-size: 1.375rem;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.02em;
  word-break: keep-all;
`

export const FeatureBody = styled.p`
  margin: 0;
  color: ${light.inkSecondary};
  font-size: 0.9375rem;
  line-height: 1.65;
  word-break: keep-all;
`

export const AndroidStage = styled.div`
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0;
`

export const DetailCrop = styled.figure`
  margin: 0;
  border-radius: 0.75rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surfaceScaffold};
  overflow: hidden;
  box-shadow: ${light.cardShadowSm};

  > div {
    overflow: hidden;
    max-height: 360px;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
  }

  figcaption {
    padding: 0.75rem 1rem;
    border-top: 1px solid ${light.gridBorder};
    background: ${light.surface};
    color: ${light.inkMuted};
    font-size: 0.8125rem;
    line-height: 1.5;
  }
`

export const FactsRow = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: ${light.gridBorder};
  border-top: 1px solid ${light.gridBorder};

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const FactCell = styled.div`
  background: ${light.surface};
  padding: 2rem 1.75rem;
  display: grid;
  align-content: start;
  gap: 0.5rem;
  min-width: 0;

  @media (max-width: ${breakpoint.sm - 1}px) {
    padding: 1.25rem 1rem;
  }

  dt.factTop {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: ${light.indigoAccent};
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0;

    svg {
      flex-shrink: 0;
    }
  }

  dd {
    margin: 0;
    display: grid;
    gap: 0.375rem;
    min-width: 0;
  }

  .factValue {
    display: block;
    color: ${light.inkPrimary};
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    word-break: keep-all;
  }

  .factDetail {
    display: block;
    color: ${light.inkSecondary};
    font-size: 0.875rem;
    line-height: 1.55;
    word-break: keep-all;
  }
`
