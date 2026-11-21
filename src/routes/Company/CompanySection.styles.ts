import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint } from "src/design-system/tokens"

export const CenteredHeader = styled.div`
  max-width: 38rem;
  margin: 0 auto;
  text-align: center;
`

export const SplitHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2.75rem;

  > p {
    max-width: 26rem;
    margin: 0;
    color: ${light.inkSecondary};
    font-size: 0.96875rem;
    line-height: 1.65;
    word-break: keep-all;
  }
`

export const StatsGrid = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.75rem;
  }
`

export const StatCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  dt {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .statEyebrow {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.4;
    color: ${light.inkMuted};
  }

  .statValue {
    font-size: clamp(1.875rem, 3.2vw, 2.625rem);
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(to right, ${light.inkPrimary}, ${light.indigoAccent});
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  dd {
    margin: 0;
    color: ${light.inkSecondary};
    font-size: 0.875rem;
    line-height: 1.55;
    word-break: keep-all;
  }
`

export const BentoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.125rem;
  width: 100%;

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm - 1}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const BentoCard = styled.article<{ $wide?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  overflow: hidden;
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.bentoShadow};
  grid-column: ${({ $wide }) => ($wide ? "span 2" : "span 1")};
  transition: border-color 180ms ease, background-color 180ms ease;

  &:hover {
    border-color: ${light.borderBrand};
    background: ${light.bentoHoverTint};
  }

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-column: span 1;
  }
`

export const BentoMetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.125rem;
`

export const BentoIconBox = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.625rem;
  height: 2.625rem;
  border-radius: 0.75rem;
  border: 1px solid ${light.borderBrand};
  background: ${light.surfaceBrand};
  color: ${light.onSignature};
`

export const BentoTag = styled.span`
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: ${light.inkMuted};
`

export const BentoBody = styled.div`
  display: grid;
  gap: 0.4375rem;

  h3 {
    margin: 0;
    color: ${light.inkPrimary};
    font-size: 1.15625rem;
    line-height: 1.35;
    font-weight: 600;
    letter-spacing: -0.015em;
    word-break: keep-all;
  }

  p {
    margin: 0;
    color: ${light.inkSecondary};
    font-size: 0.90625rem;
    line-height: 1.62;
    word-break: keep-all;
  }
`

export const ShowcaseHead = styled.div`
  margin-bottom: 3.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    margin-bottom: 2.25rem;
  }
`

export const AndroidFrameWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 0.25rem 0;

  .androidDeviceShell {
    position: relative;
    width: 100%;
    max-width: 244px;
  }

  .androidHardwareChrome {
    position: absolute;
    inset: -2px -4px -2px -2px;
    width: calc(100% + 6px);
    height: calc(100% + 4px);
    pointer-events: none;
    z-index: 2;
    display: block;
  }

  .androidScreenBezel {
    position: relative;
    z-index: 1;
    display: block;
    padding: 20px 8px 10px;
    border-radius: 28px;
    border: 2px solid ${light.deviceOuterFill};
    background-color: ${light.phoneBezel};
    box-shadow: ${light.phoneShadow};
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1080 / 2340;
    border-radius: 20px;
  }
`

export const BrowserFrame = styled.div`
  border-radius: 0.875rem;
  border: 1px solid ${light.border};
  background: ${light.surface};
  box-shadow: ${light.phoneShadow};
  overflow: hidden;

  .browserChrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.9375rem;
    border-bottom: 1px solid ${light.gridBorder};
    background: ${light.surfaceScaffold};
  }

  .chromeDots {
    display: flex;
    gap: 0.375rem;

    span {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 9999px;
      background: ${light.borderStrong};
      opacity: 0.45;
    }
  }

  .chromeHost {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.72rem;
    color: ${light.inkMuted};
  }

  img {
    display: block;
    width: 100%;
    height: auto;
  }
`

export const ComparisonGrid = styled.div`
  max-width: 52rem;
  margin: 2.75rem auto 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ComparisonCard = styled.div<{ $highlighted?: boolean }>`
  padding: 1.75rem;
  border-radius: 1.25rem;
  background: ${light.surface};
  border: 1px solid ${({ $highlighted }) => ($highlighted ? light.borderBrand : light.border)};
  box-shadow: ${({ $highlighted }) => ($highlighted ? light.bentoShadow : light.cardShadowSm)};

  .cardTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid ${light.gridBorder};
  }

  h3 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: ${light.inkPrimary};
  }

  .cardTag {
    padding: 0.1875rem 0.625rem;
    border-radius: 9999px;
    background: ${({ $highlighted }) => ($highlighted ? light.surfaceBrand : light.surfaceScaffold)};
    font-size: 0.75rem;
    font-weight: 600;
    color: ${({ $highlighted }) => ($highlighted ? light.onSignature : light.inkMuted)};
  }

  ul {
    list-style: none;
    margin: 1.125rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.8125rem;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    font-size: 0.90625rem;
    line-height: 1.55;
    color: ${light.inkSecondary};
  }

  .itemIcon {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${({ $highlighted }) => ($highlighted ? light.accent : light.indigoAccent)};
  }
`

export * from "src/routes/Company/CompanyShowcase.styles"
export * from "src/routes/Company/CompanyNews.styles"
