/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/sections/pricing-comparison.tsx, closing-cta.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { breakpoint, control } from "src/design-system/tokens"

export const ComparisonHead = styled.div`
  padding: 3.5rem 2.5rem 2rem;
  text-align: center;

  > p {
    max-width: 34rem;
    margin: 0.75rem auto 0;
  }

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 2.5rem 1rem 1.5rem;
  }
`

export const ComparisonScroll = styled.div`
  width: 100%;
  max-inline-size: 100%;
  overflow-x: auto;
  container: route-comparison / inline-size;
  border-top: 1px solid ${light.gridBorder};

  &:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: -2px;
  }
`

export const ComparisonTable = styled.table`
  --label-2: "일반 길찾기";
  --label-3: "EasySubway 무장애";
  width: 100%;
  min-width: 640px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;

  col.featureCol {
    width: 48%;
  }

  col.planCol {
    width: 26%;
  }

  thead {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
  }

  thead th {
    padding: 1.25rem 1.5rem;
    text-align: center;
    vertical-align: middle;
    font-size: 0.9375rem;
    font-weight: 600;
    color: ${light.inkPrimary};
    border-bottom: 1px solid ${light.gridBorder};
    background: ${light.surface};

    &:first-of-type {
      text-align: left;
    }

    &.isHighlighted {
      background: ${light.violetTint};
      color: ${light.violetText};
    }
  }

  tbody tr.groupRow td {
    padding: 0.625rem 1.5rem;
    background: ${light.surfaceScaffold};
    border-bottom: 1px solid ${light.gridBorder};
    color: ${light.inkPrimary};
    font-size: 0.8125rem;
    font-weight: 600;
  }

  tbody tr:not(.groupRow) th[scope="row"] {
    position: sticky;
    left: 0;
    inset-inline-start: 0;
    z-index: 2;
    padding: 1rem 1.5rem;
    text-align: left;
    font-weight: 500;
    vertical-align: middle;
    background: ${light.surface};
    border-bottom: 1px solid ${light.gridBorder};

    @media (max-width: ${breakpoint.md - 1}px) {
      box-shadow: ${light.tableStickyShadow};
    }
  }

  tbody tr:not(.groupRow) td {
    padding: 1rem 1.5rem;
    text-align: center;
    vertical-align: middle;
    color: ${light.inkSecondary};
    border-bottom: 1px solid ${light.gridBorder};

    &.isHighlighted {
      background: ${light.violetTint};
      color: ${light.inkPrimary};
      font-weight: 600;
    }
  }

  .rowTitle {
    display: block;
    color: ${light.inkPrimary};
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .rowDesc {
    display: block;
    margin-top: 0.25rem;
    color: ${light.inkMuted};
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.5;
  }

  .checkBadge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    color: ${light.emerald};
    font-weight: 600;
  }

  .mutedDash {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${light.inkMuted};
  }

  @container route-comparison (width < 600px) {
    &,
    tbody,
    tr,
    th,
    td {
      display: block;
      width: auto;
    }

    min-width: 0;

    colgroup,
    thead {
      display: none;
    }

    tbody tr.groupRow {
      margin: 0;
    }

    tbody tr.groupRow td {
      padding: 0.625rem 1rem;
    }

    tbody tr:not(.groupRow) {
      margin: 0.75rem 1rem;
      border: 1px solid ${light.gridBorder};
      border-radius: 0.75rem;
      background: ${light.surface};
      overflow: hidden;
    }

    tbody tr:not(.groupRow) th[scope="row"] {
      position: static;
      padding: 0.875rem 1rem;
      box-shadow: none;
    }

    tbody tr:not(.groupRow) td {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.6875rem 1rem;
      text-align: right;
    }

    tbody tr:not(.groupRow) td:last-child {
      border-bottom: 0;
    }

    tbody tr:not(.groupRow) td:nth-child(2)::before {
      content: var(--label-2);
      flex-shrink: 0;
      white-space: nowrap;
      font-size: 0.8125rem;
      font-weight: 500;
      color: ${light.inkMuted};
      text-align: left;
    }

    tbody tr:not(.groupRow) td:nth-child(3)::before {
      content: var(--label-3);
      flex-shrink: 0;
      white-space: nowrap;
      font-size: 0.8125rem;
      font-weight: 600;
      color: ${light.violetText};
      text-align: left;
    }

    .checkBadge {
      justify-content: flex-end;
      text-align: right;
      word-break: keep-all;
    }
  }
`

export const DirectoryContainer = styled.div`
  padding: 0 2.5rem 3.5rem;

  @media (max-width: ${breakpoint.md - 1}px) {
    padding: 0 1rem 2.5rem;
  }
`

export const MetroDirectoryBlock = styled.div`
  margin-top: 3rem;
`

export const MetroSectionTitle = styled.h3`
  margin: 0;
  color: ${light.inkPrimary};
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
`

export const MetroSectionLead = styled.p`
  margin: 0.625rem 0 1.5rem;
  max-width: 40rem;
  color: ${light.inkSecondary};
  font-size: 0.9375rem;
  line-height: 1.6;
`

export const MetroBadgeGrid = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
`

export const MetroBadgeCard = styled.li`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  box-shadow: ${light.cardShadowSm};

  img {
    display: block;
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex-shrink: 0;
  }

  span {
    color: ${light.inkPrimary};
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
  }
`

export const ClosingGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  gap: 3.5rem;
  align-items: center;

  @media (max-width: ${breakpoint.md - 1}px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }
`

export const ContactActionGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.75rem;
`

export const CopyEmailButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: ${control.lg}px;
  padding: 0 1.125rem;
  border-radius: 0.5rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  color: ${light.inkPrimary};
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease;

  &:hover {
    border-color: ${light.borderStrong};
    box-shadow: ${light.hoverRing};
  }
`

export const CopyIconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

export const ProofCard = styled.div`
  border-radius: 1rem;
  border: 1px solid ${light.gridBorder};
  background: ${light.surface};
  padding: 1.5rem;
  box-shadow: ${light.cardShadowXl};

  .proofTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .proofTitle {
    color: ${light.inkPrimary};
    font-size: 1rem;
    font-weight: 600;
  }

  .proofSubtitle {
    color: ${light.inkMuted};
    font-size: 0.75rem;
  }

  .proofBadge {
    padding: 0.125rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid ${light.gridBorder};
    background: ${light.surfaceScaffold};
    color: ${light.violetText};
    font-size: 0.75rem;
    font-weight: 600;
  }

  .proofDesc {
    margin: 1rem 0 0;
    color: ${light.inkSecondary};
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .proofStats {
    margin: 1.25rem 0 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-radius: 0.75rem;
    border: 1px solid ${light.gridBorder};
    background: ${light.surfaceScaffold};
    overflow: hidden;

    > div {
      padding: 0.875rem 1rem;

      & + div {
        border-left: 1px solid ${light.gridBorder};
      }
    }

    dt {
      color: ${light.inkMuted};
      font-size: 0.75rem;
    }

    dd {
      margin: 0.25rem 0 0;
      color: ${light.inkPrimary};
      font-size: 1rem;
      font-weight: 600;
    }
  }
`
