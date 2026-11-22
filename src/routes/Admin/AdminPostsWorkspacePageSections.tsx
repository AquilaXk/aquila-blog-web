// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (MIT), medusajs/medusa packages/design-system/ui/src/components/command-bar/command-bar.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { skeletonShimmerCss } from "src/design-system/StatePresenters"
import type { SiteLanguage } from "src/libs/language"
import { adminT } from "./adminI18n"
import { LIST_SKELETON_ROW_COUNT } from "./AdminPostsWorkspaceModel"
import {
  adminAppBackground,
  adminBorder,
  adminBorderSubtle,
  adminCommandBarBg,
  adminCommandBarBorder,
  adminCommandBarFg,
  adminCommandBarMuted,
  adminControlText,
  adminFloatingShadow,
  adminMutedSurface,
  adminStatusDangerSolid,
  adminStatusWarnBg,
  adminStatusWarnText,
  adminSurfaceMuted,
  adminTeal,
  adminTealBorder,
  adminTealHover,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import {
  AdminSubtleCard,
  AdminWorkspaceHero,
  AdminWorkspaceHeroCopy,
} from "./AdminSurfacePrimitives"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const Main = styled.div`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 1.15rem 1.75rem 2.75rem;
  display: grid;
  align-content: start;
  gap: 0.9rem;
  background: ${adminAppBackground};
  scroll-padding-bottom: 5.5rem;

  @media (max-width: 768px) {
    gap: 0.7rem;
    padding: 0.85rem 1rem 2.25rem;
  }
`

export const HeroSection = styled(AdminWorkspaceHero)`
  padding: 0 0 0.25rem;
  border: 0;
  border-bottom: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;

  @media (max-width: 768px) {
    padding-bottom: 0.15rem;
  }
`

export const PostsHeroCopy = styled(AdminWorkspaceHeroCopy)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;

  h1 {
    margin: 0;
    max-width: 100%;
    color: ${adminTextPrimary};
    font-size: 1.38rem;
    line-height: 1.2;
    letter-spacing: -0.025em;
    font-weight: 700;
    overflow-wrap: break-word;

    @media (max-width: 768px) {
      font-size: 1.2rem;
    }
  }
`

export const HeroCountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.35rem;
  padding: 0 0.52rem;
  border: 1px solid ${adminBorderSubtle};
  border-radius: 6px;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};
  font-family: ${MONO_FONT};
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const WorkspaceBody = styled.div`
  display: grid;
  gap: 0.85rem;
  min-width: 0;
`

export const WorkspaceMain = styled.div`
  display: grid;
  gap: 0.85rem;
  min-width: 0;
`

export const PrimaryCta = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  border: 1px solid ${adminTealBorder};
  border-radius: 6px;
  background: ${adminTeal};
  color: ${adminControlText};
  min-height: 36px;
  padding: 0 0.88rem;
  font-size: 0.81rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    background: ${adminTealHover};
  }

  @media (max-width: 768px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
  }
`

export const ListSection = styled.section`
  display: grid;
  min-width: 0;
`

export const UnifiedTableCard = styled.div`
  display: grid;
  gap: 0;
  min-width: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
`

export const ListCard = styled(AdminSubtleCard)`
  display: grid;
  gap: 0.65rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
`

export const ListSurfaceFrame = styled.div`
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
`

export const ListEmptyState = styled.div`
  display: grid;
  justify-items: start;
  gap: 0.45rem;
  padding: 2rem 0.25rem;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorderSubtle};
  background: transparent;
  box-shadow: none;

  strong {
    color: ${adminTextPrimary};
    font-size: 0.94rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: ${adminTextSecondary};
    font-size: 0.84rem;
    line-height: 1.5;
  }
`

export const ListSkeleton = styled.div`
  .desktopRows {
    display: grid;
  }

  .headerRow,
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 120px 110px 136px 82px 148px;
  }

  .headerRow {
    min-height: 40px;
    align-items: center;
    padding: 0 0.75rem;
    border-bottom: 1px solid ${adminBorder};
    background: transparent;
  }

  .headerRow > span {
    color: ${adminTextMuted};
    font-size: 0.74rem;
    font-weight: 600;
  }

  .row {
    padding: 0 0.75rem;
    border-bottom: 1px solid ${adminBorderSubtle};
  }

  .row:last-of-type {
    border-bottom: none;
  }

  .cell {
    display: grid;
    align-content: center;
    gap: 0.3rem;
    min-height: 64px;
    padding: 0.72rem 0;
  }

  .line {
    display: block;
    height: 11px;
    border-radius: 4px;
    ${skeletonShimmerCss}
    background: ${({ theme }) => adminMutedSurface(theme)};
  }

  .line.short {
    width: 4.5rem;
  }

  .line.tiny {
    width: 1rem;
  }

  .line.medium {
    width: 8rem;
  }

  .line.wide {
    width: min(100%, 22rem);
  }

  .line.muted {
    opacity: 0.65;
  }

  .mobileCards {
    display: none;
  }

  @media (max-width: 1100px) {
    .desktopRows {
      display: none;
    }

    .mobileCards {
      display: grid;
      gap: 0;
      padding: 0;
    }

    .mobileCards article {
      display: grid;
      gap: 0.5rem;
      padding: 0.85rem 0.15rem;
      border-radius: 0;
      border: 0;
      border-bottom: 1px solid ${adminBorderSubtle};
      background: transparent;
    }

    .mobileCards .metaRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
  }
`

export const FloatingBulkBar = styled.div`
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: inline-flex;
  align-items: stretch;
  width: max-content;
  max-width: calc(100vw - 1.5rem);
  padding: 0;
  border-radius: 10px;
  border: 1px solid ${adminCommandBarBorder};
  background: ${adminCommandBarBg};
  color: ${adminCommandBarFg};
  box-shadow: ${adminFloatingShadow};
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 720px) {
    bottom: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
    width: calc(100vw - 1.25rem);
    max-width: calc(100vw - 1.25rem);
    overflow: hidden;
  }
`

export const FloatingBulkCountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.375rem;
  padding: 0 1rem;
  color: ${adminCommandBarMuted};
  font-family: ${MONO_FONT};
  font-size: 0.78rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

export const FloatingBulkClearButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.375rem;
  padding: 0 0.9rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${adminCommandBarMuted};
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminCommandBarFg};
    background: ${adminCommandBarBorder};
  }

  @media (pointer: coarse) {
    min-height: 44px;
    padding: 0 1rem;
  }
`

export const FloatingBulkDivider = styled.span`
  width: 1px;
  align-self: stretch;
  background: ${adminCommandBarBorder};
  flex: 0 0 1px;
`

export const FloatingBulkButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.375rem;
  padding: 0 1rem;
  border-radius: 0;
  border: 0;
  background: transparent;
  color: ${adminCommandBarFg};
  font-size: 0.79rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    background: ${adminCommandBarBorder};
  }

  &[data-danger="true"] {
    background: transparent;
    color: ${adminCommandBarFg};
  }

  &[data-danger="true"]:hover:not(:disabled) {
    background: ${adminStatusDangerSolid};
    color: ${adminControlText};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (pointer: coarse) {
    min-height: 44px;
    padding: 0 1.05rem;
  }
`

export const FloatingBulkWarning = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.375rem;
  padding: 0 0.9rem;
  border: 0;
  background: ${adminStatusWarnBg};
  color: ${adminStatusWarnText};
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
`

export const AdminPostsListLoadingSkeleton = ({ language }: { language: SiteLanguage }) => (
  <ListCard role="status" aria-busy="true" aria-label={adminT("tableLoadingAria", language)}>
    <ListSurfaceFrame>
      <ListSkeleton aria-hidden="true">
        <div className="desktopRows">
          <div className="headerRow">
            <span>{adminT("tableColTitle", language)}</span>
            <span className="topicCell">{adminT("tableColTopic", language)}</span>
            <span className="statusCell">{adminT("tableColStatus", language)}</span>
            <span className="dateCell">{adminT("tableColDate", language)}</span>
            <span className="viewsCell">{adminT("tableColViews", language)}</span>
            <span className="actionsCell">{adminT("tableColActions", language)}</span>
          </div>
          {Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => (
            <div className="row" key={`desktop-skeleton-${index}`}>
              <div className="cell titleCell">
                <span className="line wide" />
                <span className="line short muted" />
              </div>
              <div className="cell topicCell">
                <span className="line short" />
              </div>
              <div className="cell statusCell">
                <span className="line medium" />
              </div>
              <div className="cell dateCell">
                <span className="line medium" />
              </div>
              <div className="cell viewsCell">
                <span className="line short" />
              </div>
              <div className="cell actionsCell">
                <span className="line short" />
              </div>
            </div>
          ))}
        </div>
        <div className="mobileCards">
          {Array.from({ length: 3 }, (_, index) => (
            <article key={`mobile-skeleton-${index}`}>
              <div className="metaRow">
                <span className="line short" />
                <span className="line short" />
              </div>
              <span className="line wide" />
              <span className="line medium muted" />
              <span className="line short muted" />
            </article>
          ))}
        </div>
      </ListSkeleton>
    </ListSurfaceFrame>
  </ListCard>
)

export { adminSurfaceMuted }
