// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/components/post-list-row.tsx (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/ui/table.tsx (MIT)
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminAccentText,
  adminBorder,
  adminBorderSubtle,
  adminMutedSurface,
  adminStatusDangerBg,
  adminStatusDangerDot,
  adminStatusDangerText,
  adminStatusInfoDot,
  adminStatusSuccessDot,
  adminStatusWarnDot,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import {
  AdminInlineActionRow,
  AdminStatusPill,
  AdminTextActionButton,
} from "./AdminSurfacePrimitives"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

export const ActionRow = styled(AdminInlineActionRow)``

export const PrimaryInlineButton = styled(AdminTextActionButton)`
  color: ${adminTextPrimary};
  font-size: 0.84rem;
  font-weight: 600;

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: 44px;
    padding: 0.45rem 0.68rem;
    display: inline-flex;
    align-items: center;
  }
`

export const GhostButton = styled(AdminTextActionButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  min-height: 30px;
  padding: 0 0.56rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover:not(:disabled) {
    border-color: transparent;
    background: ${adminSurfaceMuted};
    color: ${adminTextPrimary};
  }

  &[data-danger="true"] {
    color: ${adminStatusDangerText};
  }

  &[data-danger="true"]:hover:not(:disabled) {
    border-color: transparent;
    background: ${adminStatusDangerBg};
    color: ${adminStatusDangerText};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
    padding: 0.42rem 0.65rem;
  }
`

export const GhostLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.26rem;
  min-height: 30px;
  padding: 0 0.56rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${adminTextSecondary};
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    border-color: transparent;
    background: ${adminSurfaceMuted};
    text-decoration: none;
  }

  @media (max-width: 1100px), (pointer: coarse) {
    min-height: 44px;
    min-width: 44px;
    padding: 0.42rem 0.65rem;
  }
`

export const TopicChip = styled.span`
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 1.45rem;
  padding: 0 0.52rem;
  border: 1px solid ${adminBorder};
  border-radius: 6px;
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.74rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const StatusDotIndicator = styled.i<{ "data-tone": string }>`
  width: 6px;
  height: 6px;
  border-radius: 2px;
  flex: 0 0 auto;
  background: ${adminStatusSuccessDot};

  &[data-tone="DRAFT"],
  &[data-tone="draft"] {
    background: ${adminStatusWarnDot};
  }

  &[data-tone="warn"],
  &[data-tone="PUBLIC_UNLISTED"] {
    background: ${adminStatusInfoDot};
  }

  &[data-tone="PRIVATE"] {
    background: ${adminTextMuted};
  }

  &[data-tone="danger"] {
    background: ${adminStatusDangerDot};
  }
`

export const VisibilityBadge = styled(AdminStatusPill)<{ "data-tone": string }>`
  min-height: 24px;
  max-width: 100%;
  padding: 0 0.5rem;
  gap: 0.36rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${adminTextSecondary};
  background: ${adminSurfaceRaised};
  border-color: ${adminBorder};

  &[data-tone="DRAFT"],
  &[data-tone="draft"],
  &[data-tone="warn"],
  &[data-tone="PUBLIC_UNLISTED"],
  &[data-tone="PRIVATE"],
  &[data-tone="danger"] {
    color: ${adminTextSecondary};
    background: ${adminSurfaceRaised};
    border-color: ${adminBorder};
  }

  &[data-tone="danger"] {
    color: ${adminStatusDangerText};
  }
`

export const PageFooter = styled(ActionRow)`
  justify-content: flex-end;
  padding: 0.72rem 1rem;
  border-top: 1px solid ${adminBorderSubtle};
  background: transparent;
  color: ${adminTextMuted};
  font-size: 0.82rem;
`

export const RowActions = styled(ActionRow)`
  width: 100%;
  justify-content: flex-end;
  gap: 0.25rem;
  flex-wrap: nowrap;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  @media (max-width: 1100px) {
    width: auto;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
`

export const PostsDesktopTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0.78rem 0.75rem;
    border-bottom: 1px solid ${adminBorderSubtle};
    vertical-align: middle;
  }

  thead th {
    padding-block: 0.58rem;
    background: transparent;
    border-bottom: 1px solid ${adminBorder};
    text-align: left;
    font-size: 0.73rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: ${adminTextMuted};
  }

  thead th:has(> button) {
    padding: 0;
  }

  thead th[aria-sort="descending"] {
    color: ${adminTextPrimary};
  }

  thead th[aria-sort="descending"] .sortChevron {
    opacity: 1;
    color: ${adminTextPrimary};
  }

  thead th[aria-sort="ascending"] {
    color: ${adminTextPrimary};
  }

  thead th[aria-sort="ascending"] .sortChevron {
    opacity: 1;
    color: ${adminTextPrimary};
    transform: rotate(180deg);
  }

  .topicCell {
    width: 124px;
  }

  .statusCell {
    width: 112px;
  }

  .dateCell {
    width: 140px;
    white-space: nowrap;
    color: ${adminTextSecondary};
    font-family: ${MONO_FONT};
    font-size: 0.77rem;
    font-variant-numeric: tabular-nums;
  }

  .viewsCell {
    width: 84px;
    white-space: nowrap;
    color: ${adminTextSecondary};
    font-family: ${MONO_FONT};
    font-size: 0.79rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .actionsCell {
    width: 152px;
    white-space: nowrap;
    text-align: right;
  }

  thead th.actionsCell {
    text-align: right;
  }

  tbody tr:last-of-type td {
    border-bottom: none;
  }

  tbody tr:hover td {
    background: ${adminSurfaceRaised};
  }

  tbody tr[data-selected="true"] td {
    background: ${adminSurfaceMuted};
  }

  tbody tr:focus-within td {
    background: ${adminSurfaceRaised};
  }

  @media (max-width: 1280px) {
    th,
    td {
      padding: 0.68rem 0.6rem;
    }
  }

  @media (max-width: 1100px) {
    display: none;
  }
`

export const TitleRowLayout = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
`

export const PostThumbnailSlot = styled.span`
  width: 72px;
  height: 46px;
  flex: 0 0 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurfaceRaised};
  color: ${adminTextMuted};
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 1100px) {
    width: 64px;
    height: 40px;
    flex: 0 0 64px;
  }
`

export const TitleCell = styled.div`
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  flex: 1 1 auto;

  .metaRow {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    flex-wrap: wrap;
    min-width: 0;
  }

  .metaRow > span {
    color: ${adminTextMuted};
    font-size: 0.76rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const TitleAnchor = styled.a`
  display: -webkit-box;
  color: ${adminTextPrimary};
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.36;
  text-decoration: none;
  overflow: hidden;
  word-break: keep-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  ${focusVisibleRing}

  &:hover {
    color: ${adminAccentText};
    text-decoration: none;
  }

  @media (pointer: coarse) {
    min-height: 44px;
    padding-block: 0.35rem;
  }
`

export const TitleText = styled.strong`
  display: -webkit-box;
  color: ${adminTextPrimary};
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.36;
  overflow: hidden;
  word-break: keep-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`

export const TitleButton = styled.button`
  display: -webkit-box;
  width: fit-content;
  max-width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  color: ${adminTextPrimary};
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.36;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  word-break: keep-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export {
  ListCard,
  ListEmptyState,
  ListSkeleton,
  ListSurfaceFrame,
} from "./AdminPostsWorkspacePageSections"

export {
  CheckboxHitLabel,
  EnhancedPagination,
  HeaderSortButton,
  MobileCardList,
  PageNumberButton,
  TableCheckboxCell,
  TableCheckboxHeader,
  VisuallyHiddenCaption,
} from "./AdminPostsWorkspaceBulkAndPage.styles"
