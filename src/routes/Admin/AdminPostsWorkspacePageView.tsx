// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (MIT), medusajs/medusa packages/design-system/ui/src/components/command-bar/command-bar.tsx (MIT)
import type { RefObject } from "react"
import AppIcon from "./AdminAppIcon"
import type { AuthMember } from "src/hooks/useAuthSession"
import { useLanguage } from "src/libs/language"
import type { AdminProfile } from "src/types/adminProfile"
import AdminShell from "./AdminShell"
import { adminT } from "./adminI18n"
import { AdminPostsWorkspaceFeedbackLayer } from "./AdminPostsWorkspaceFeedbackLayer"
import { AdminPostsWorkspaceFilterToolbar } from "./AdminPostsWorkspaceFilterToolbar"
import { AdminPostsWorkspaceList } from "./AdminPostsWorkspaceList"
import {
  type AdminPostListItem,
  type AdminPostsFacetCounts,
  type ListSort,
  type ListState,
  type PostListScope,
  type PostStatusFilter,
  type WorkspaceConfirmState,
  type WorkspaceToastState,
} from "./AdminPostsWorkspaceModel"
import {
  BULK_ACTION_MAX_LIMIT,
  isBulkSelectionOverLimit,
  type BulkActionKind,
} from "./adminPostsWorkspaceBulkModel"
import {
  FloatingBulkBar,
  FloatingBulkButton,
  FloatingBulkClearButton,
  FloatingBulkCountBadge,
  FloatingBulkDivider,
  FloatingBulkWarning,
  HeroCountBadge,
  HeroSection,
  ListSection,
  Main,
  PostsHeroCopy,
  PrimaryCta,
  UnifiedTableCard,
  WorkspaceBody,
  WorkspaceMain,
} from "./AdminPostsWorkspacePageSections"
import { AdminWorkspaceHeroActions, AdminWorkspaceHeroLayout } from "./AdminSurfacePrimitives"

export type AdminPostsWorkspacePageViewProps = {
  confirmState: WorkspaceConfirmState
  handleConfirmAction: () => void | Promise<void>
  handleToastAction: () => void | Promise<void>
  initialProfileSnapshot?: AdminProfile | null
  isListLoading: boolean
  listError: string
  listKw: string
  listPage: string
  listPageSize: string
  listScope: PostListScope
  listStatus: PostStatusFilter
  listSectionRef: RefObject<HTMLElement | null>
  listSort: ListSort
  listState: ListState
  facetCounts?: AdminPostsFacetCounts | null
  loadList: () => void | Promise<void>
  pendingPostId?: number | null
  mutationPending: { rowId: number; kind: "delete" | "restore" | "hardDelete" } | null
  handleDeletePost: (row: AdminPostListItem) => void | Promise<void>
  onHardDeletePost: (row: AdminPostListItem) => void | Promise<void>
  onRestorePost: (row: AdminPostListItem) => void | Promise<void>
  onResetFilters: () => void
  openWriteRoute: (query?: Record<string, string>) => void | Promise<void>
  sessionMember: AuthMember
  setConfirmState: (value: WorkspaceConfirmState) => void
  setListKw: (value: string) => void
  setListPage: (value: string) => void
  setListPageSize: (value: string) => void
  setListStatus: (value: PostStatusFilter) => void
  setListSort: (value: ListSort) => void
  setToast: (value: WorkspaceToastState) => void
  shouldRenderMobileList: boolean
  toast: WorkspaceToastState
  selectedIds: ReadonlySet<number>
  isAllSelected: boolean
  isIndeterminate: boolean
  isBulkPending: boolean
  onToggleRowSelect: (rowId: number, shiftKey: boolean) => void
  onToggleSelectAll: () => void
  onClearSelection: () => void
  onBulkAction: (action: BulkActionKind) => void | Promise<void>
}

export const AdminPostsWorkspacePageView = (props: AdminPostsWorkspacePageViewProps) => {
  const { language } = useLanguage()
  const {
    confirmState,
    handleConfirmAction,
    handleToastAction,
    initialProfileSnapshot,
    isListLoading,
    listError,
    listKw,
    listPage,
    listPageSize,
    listScope,
    listStatus,
    listSectionRef,
    listSort,
    listState,
    facetCounts,
    loadList,
    pendingPostId,
    mutationPending,
    handleDeletePost,
    onHardDeletePost,
    onRestorePost,
    onResetFilters,
    openWriteRoute,
    sessionMember,
    setConfirmState,
    setListKw,
    setListPage,
    setListPageSize,
    setListStatus,
    setListSort,
    setToast,
    shouldRenderMobileList,
    toast,
    selectedIds,
    isAllSelected,
    isIndeterminate,
    isBulkPending,
    onToggleRowSelect,
    onToggleSelectAll,
    onClearSelection,
    onBulkAction,
  } = props

  const selectedCount = selectedIds.size
  const hasSelected = selectedCount > 0
  const isOverBulkLimit = isBulkSelectionOverLimit(selectedCount)
  const bulkDisabled = isBulkPending || isOverBulkLimit
  const totalCountBadgeValue = facetCounts?.all ?? listState.total

  const bulkActionSlot = hasSelected ? (
    <FloatingBulkBar
      role="region"
      aria-label={language === "en" ? "Bulk post actions" : "일괄 글 작업"}
      data-ui="posts-floating-bulk-bar"
    >
      <FloatingBulkCountBadge>
        {language === "en"
          ? `${selectedCount} ${adminT("bulkSelectedCount", language)}`
          : `${selectedCount}${adminT("bulkSelectedCount", language)}`}
      </FloatingBulkCountBadge>
      <FloatingBulkDivider aria-hidden="true" />
      <FloatingBulkClearButton type="button" onClick={onClearSelection}>
        {adminT("bulkClearSelection", language)}
      </FloatingBulkClearButton>
      <FloatingBulkDivider aria-hidden="true" />
      {listScope === "active" ? (
        <>
          <FloatingBulkButton
            type="button"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("PUBLISH_LISTED")}
          >
            {adminT("actionPublishListed", language)}
          </FloatingBulkButton>
          <FloatingBulkDivider aria-hidden="true" />
          <FloatingBulkButton
            type="button"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("PUBLISH_UNLISTED")}
          >
            {language === "en" ? "Make Unlisted" : "링크 공개 전환"}
          </FloatingBulkButton>
          <FloatingBulkDivider aria-hidden="true" />
          <FloatingBulkButton
            type="button"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("UNPUBLISH_PRIVATE")}
          >
            {adminT("actionUnpublishPrivate", language)}
          </FloatingBulkButton>
          <FloatingBulkDivider aria-hidden="true" />
          <FloatingBulkButton
            type="button"
            data-danger="true"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("DELETE")}
          >
            {adminT("actionDelete", language)}
          </FloatingBulkButton>
        </>
      ) : (
        <>
          <FloatingBulkButton
            type="button"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("RESTORE")}
          >
            {adminT("actionRestore", language)}
          </FloatingBulkButton>
          <FloatingBulkDivider aria-hidden="true" />
          <FloatingBulkButton
            type="button"
            data-danger="true"
            disabled={bulkDisabled}
            onClick={() => void onBulkAction("HARD_DELETE")}
          >
            {adminT("actionHardDelete", language)}
          </FloatingBulkButton>
        </>
      )}
      {isOverBulkLimit ? (
        <>
          <FloatingBulkDivider aria-hidden="true" />
          <FloatingBulkWarning role="alert">
            {language === "en"
              ? `Up to ${BULK_ACTION_MAX_LIMIT} posts can be processed at once (${selectedCount} selected).`
              : `한 번에 최대 ${BULK_ACTION_MAX_LIMIT}개까지만 일괄 처리할 수 있습니다 (현재 ${selectedCount}개 선택됨).`}
          </FloatingBulkWarning>
        </>
      ) : null}
    </FloatingBulkBar>
  ) : null

  return (
    <AdminShell currentSection="posts" member={sessionMember} profileSnapshot={initialProfileSnapshot}>
      <Main>
        <HeroSection>
          <AdminWorkspaceHeroLayout>
            <PostsHeroCopy>
              <h1>{adminT("navPosts", language)}</h1>
              <HeroCountBadge>{totalCountBadgeValue.toLocaleString()}</HeroCountBadge>
            </PostsHeroCopy>
            <AdminWorkspaceHeroActions>
              <PrimaryCta type="button" onClick={() => void openWriteRoute()}>
                <AppIcon name="plus" width={14} height={14} />
                <span>{adminT("navWrite", language)}</span>
              </PrimaryCta>
            </AdminWorkspaceHeroActions>
          </AdminWorkspaceHeroLayout>
        </HeroSection>

        <WorkspaceBody>
          <WorkspaceMain>
            <ListSection ref={listSectionRef}>
              <UnifiedTableCard data-unified-table-card="true">
                <AdminPostsWorkspaceFilterToolbar
                  listScope={listScope}
                  listStatus={listStatus}
                  listKw={listKw}
                  listSort={listSort}
                  facetCounts={facetCounts}
                  onStatusChange={setListStatus}
                  onKeywordChange={setListKw}
                  onSortChange={setListSort}
                  onResetFilters={onResetFilters}
                />

                <AdminPostsWorkspaceList
                  listScope={listScope}
                  listKw={listKw}
                  listPage={listPage}
                  listPageSize={listPageSize}
                  listState={listState}
                  isListLoading={isListLoading}
                  listError={listError}
                  shouldRenderMobileList={shouldRenderMobileList}
                  onLoadList={() => void loadList()}
                  onOpenWriteRoute={(query) => void openWriteRoute(query)}
                  onPageChange={(page) => setListPage(String(page))}
                  onPageSizeChange={setListPageSize}
                  listSort={listSort}
                  onSortChange={setListSort}
                  selectedIds={selectedIds}
                  onToggleRowSelect={onToggleRowSelect}
                  onToggleSelectAll={onToggleSelectAll}
                  isAllSelected={isAllSelected}
                  isIndeterminate={isIndeterminate}
                  bulkActionSlot={bulkActionSlot}
                  pendingPostId={pendingPostId}
                  mutationPending={mutationPending}
                  onDeletePost={(row) => void handleDeletePost(row)}
                  onHardDeletePost={(row) => void onHardDeletePost(row)}
                  onRestorePost={(row) => void onRestorePost(row)}
                  onResetSearch={() => setListKw("")}
                />
              </UnifiedTableCard>
            </ListSection>
          </WorkspaceMain>
        </WorkspaceBody>

        <AdminPostsWorkspaceFeedbackLayer
          toast={toast}
          confirmState={confirmState}
          onToastAction={() => void handleToastAction()}
          onToastDismiss={() => setToast(null)}
          onConfirmCancel={() => setConfirmState(null)}
          onConfirmAction={() => void handleConfirmAction()}
        />
      </Main>
    </AdminShell>
  )
}
