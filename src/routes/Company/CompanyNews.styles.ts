import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint } from "src/design-system/tokens"

export const NewsHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 2rem;
`

export const NewsHeaderAction = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: ${light.violetText};
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const NewsGrid = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;

  @media (max-width: ${breakpoint.lg - 1}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm - 1}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const NewsCard = styled.a`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};
  color: inherit;
  text-decoration: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:hover {
    border-color: ${light.borderBrand};
    box-shadow: ${light.hoverRing};
  }

  h3 {
    margin: 0.625rem 0 0;
    color: ${light.inkPrimary};
    font-size: 1.0625rem;
    line-height: 1.4;
    font-weight: 600;
    word-break: keep-all;
  }

  p {
    margin: 0.5rem 0 0;
    color: ${light.inkSecondary};
    font-size: 0.875rem;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`

export const NewsMedia = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: 0.875rem;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid ${light.gridBorder};
  background: ${light.surfaceScaffold};

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const NewsMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: ${light.inkMuted};
`

export const NewsIndex = styled.span`
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-weight: 600;
  color: ${light.indigoAccent};
`

export const NewsAction = styled.div`
  margin-top: auto;
  padding-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: ${light.violetText};
  font-size: 0.8125rem;
  font-weight: 600;
`
