// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (MIT), TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminBorderSubtle,
  adminControlText,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTealBorder,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const VisuallyHiddenCaption = styled.caption`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

export const HeaderSortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  width: 100%;
  min-height: 40px;
  padding: 0.58rem 0.85rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    background: ${adminSurfaceMuted};
  }

  .sortChevron {
    flex: 0 0 auto;
    opacity: 0.35;
    transition: transform 140ms ease, opacity 140ms ease;
  }

  &:hover .sortChevron {
    opacity: 0.75;
  }

  @media (max-width: 1280px) {
    padding: 0.56rem 0.6rem;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const CheckboxHitLabel = styled.label`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  border-radius: 6px;
  cursor: pointer;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: ${adminTeal};
  }

  &:has(input:focus-visible) {
    outline: 2px solid ${adminBorderStrong};
    outline-offset: 1px;
  }

  @media (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }
`

export const TableCheckboxCell = styled.td`
  width: 2.25rem;
  text-align: center;
  vertical-align: middle;
  padding: 0 0.35rem 0 0.2rem;

  input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: ${adminTeal};
  }
`

export const TableCheckboxHeader = styled.th`
  width: 2.25rem;
  text-align: center;
  vertical-align: middle;
  padding: 0 0.35rem 0 0.2rem;

  input[type="checkbox"] {
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: ${adminTeal};
  }
`

export const MobileCardList = styled.div`
  display: none;

  @media (max-width: 1100px) {
    display: grid;
    gap: 0;
    padding: 0;
  }

  article {
    display: grid;
    gap: 0.48rem;
    padding: 0.85rem 0.15rem;
    border-radius: 0;
    border: 0;
    border-bottom: 1px solid ${adminBorderSubtle};
    background: transparent;
    content-visibility: auto;
    contain-intrinsic-size: auto 148px;

    &:last-of-type {
      border-bottom: 0;
    }

    @supports not (content-visibility: auto) {
      contain: layout style paint;
    }
  }

  article[data-selected="true"] {
    background: ${adminSurfaceMuted};
    border-radius: 8px;
    padding-inline: 0.65rem;
    border-bottom-color: transparent;
  }

  article:focus-within {
    background: ${adminSurfaceRaised};
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .mobileTitleRow {
    display: flex;
    align-items: center;
    gap: 0.68rem;
    min-width: 0;
  }

  .author,
  .date {
    margin: 0;
    color: ${adminTextMuted};
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
  }
`

export const EnhancedPagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.15rem 0.2rem;
  border-top: 1px solid ${adminBorderSubtle};
  background: transparent;
  flex-wrap: wrap;

  .pageSizeControl {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: ${adminTextMuted};

    select {
      min-height: 30px;
      padding: 0 0.52rem;
      border: 1px solid ${adminBorder};
      border-radius: 6px;
      background: ${adminSurface};
      color: ${adminTextPrimary};
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      ${focusVisibleRing}

      &:hover {
        border-color: ${adminBorderStrong};
      }

      @media (pointer: coarse) {
        min-height: 44px;
        font-size: 1rem;
      }
    }
  }

  .pageControls {
    display: flex;
    align-items: center;
    gap: 0.28rem;
  }
`

export const PageNumberButton = styled.button<{ $active?: boolean }>`
  min-width: 30px;
  min-height: 30px;
  padding: 0 0.45rem;
  border-radius: 6px;
  font-family: ${MONO_FONT};
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  border: 1px solid ${({ $active }) => ($active ? adminTealBorder : adminBorder)};
  background: ${({ $active }) => ($active ? adminTeal : adminSurface)};
  color: ${({ $active }) => ($active ? adminControlText : adminTextSecondary)};
  transition: background-color 120ms ease;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${({ $active }) => ($active ? adminTeal : adminSurfaceMuted)};
    color: ${({ $active }) => ($active ? adminControlText : adminTextPrimary)};
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-width: 44px;
    min-height: 44px;
  }
`
