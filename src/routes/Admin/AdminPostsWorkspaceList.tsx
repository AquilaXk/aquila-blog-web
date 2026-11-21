// 참조 구현: TryGhost/Ghost apps/shade/src/components/{layout/list-page.tsx,ui/table.tsx} (MIT), shadcn-ui/ui apps/v4/registry/new-york-v4/ui/{table.tsx,badge.tsx} (MIT)
import Link from "next/link"
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import AppIcon from "./AdminAppIcon"
import { useLanguage, type SiteLanguage } from "src/libs/language"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { adminT } from "./adminI18n"
import {
  ActionRow,
  CheckboxHitLabel,
  EnhancedPagination,
  GhostButton,
  GhostLink,
  HeaderSortButton,
  ListCard,
  ListEmptyState,
  ListSurfaceFrame,
  MobileCardList,
  PageNumberButton,
  PostsDesktopTable,
  PostThumbnailSlot,
  PrimaryInlineButton,
  RowActions,
  StatusDotIndicator,
  TableCheckboxCell,
  TableCheckboxHeader,
  TitleAnchor,
  TitleCell,
  TitleRowLayout,
  TitleText,
  TopicChip,
  VisibilityBadge,
  VisuallyHiddenCaption,
} from "./AdminPostsWorkspaceList.styles"
import { AdminPostsListLoadingSkeleton } from "./AdminPostsWorkspacePageSections"
import {
  buildRowTitle,
  buildWorkspacePostSubtitle,
  canOpenCanonicalPost,
  formatDateTime,
  formatWorkspaceViews,
  getWorkspaceTopicLabel,
  workspaceStatusLabel,
  workspaceStatusTone,
  type AdminPostListItem,
  type ListSort,
  type ListState,
  type PostListScope,
} from "./AdminPostsWorkspaceModel"
import { generatePaginationPages } from "./adminPostsWorkspacePaginationModel"
import {
  ADMIN_POSTS_ROW_ATTR,
  ADMIN_POSTS_ROW_PRIMARY_ATTR,
  handleAdminPostsListKeyDown,
} from "./AdminPostsWorkspaceListKeyboard"

type AdminPostsWorkspaceListProps = {
  listScope: PostListScope
  listKw: string
  listPage: string
  listPageSize: string
  listState: ListState
  isListLoading: boolean
  listError: string
  shouldRenderMobileList: boolean
  onLoadList: () => void
  onOpenWriteRoute: (query?: Record<string, string>) => void
  onPageChange: (page: number) => void
  pendingPostId?: number | null
  mutationPending: { rowId: number; kind: "delete" | "restore" | "hardDelete" } | null
  onDeletePost: (row: AdminPostListItem) => void
  onHardDeletePost: (row: AdminPostListItem) => void
  onRestorePost: (row: AdminPostListItem) => void
  onResetSearch: () => void
  selectedIds?: ReadonlySet<number>
  onToggleRowSelect?: (rowId: number, shiftKey: boolean) => void
  onToggleSelectAll?: () => void
  isAllSelected?: boolean
  isIndeterminate?: boolean
  bulkActionSlot?: React.ReactNode
  listSort?: ListSort
  onSortChange?: (sort: ListSort) => void
  onPageSizeChange?: (size: string) => void
}

const renderThumbnailContent = (thumbnailUrl?: string | null) => {
  const trimmed = thumbnailUrl?.trim()
  if (trimmed) {
    // eslint-disable-next-line @next/next/no-img-element -- runtime-image-payload 불변식에 따라 네이티브 lazy img를 사용한다.
    return <img src={trimmed} alt="" loading="lazy" decoding="async" />
  }
  return <AppIcon name="file" width={16} height={16} />
}

const PostTitleSummaryBlock = ({
  row,
  rowTitle,
  subtitle,
  isDeletedScope,
}: {
  row: AdminPostListItem
  rowTitle: string
  subtitle: string
  isDeletedScope: boolean
}) => (
  <>
    <PostThumbnailSlot aria-hidden="true">
      {renderThumbnailContent(row.thumbnailUrl)}
    </PostThumbnailSlot>
    <TitleCell>
      {isDeletedScope ? (
        <TitleText>{rowTitle}</TitleText>
      ) : (
        <TitleAnchor
          as={Link}
          href={`/admin/editor/${encodeURIComponent(String(row.id))}`}
          {...{ [ADMIN_POSTS_ROW_PRIMARY_ATTR]: "true" as const }}
        >
          {rowTitle}
        </TitleAnchor>
      )}
      {subtitle ? (
        <div className="metaRow">
          <span>{subtitle}</span>
        </div>
      ) : null}
    </TitleCell>
  </>
)

const PostRowActionControls = ({
  row,
  isDeletedScope,
  isRowPending,
  pendingKind,
  canOpenPublicPost,
  language,
  onDeletePost,
  onHardDeletePost,
  onRestorePost,
}: {
  row: AdminPostListItem
  isDeletedScope: boolean
  isRowPending: boolean
  pendingKind: "delete" | "restore" | "hardDelete" | null | undefined
  canOpenPublicPost: boolean
  language: SiteLanguage
  onDeletePost: (row: AdminPostListItem) => void
  onHardDeletePost: (row: AdminPostListItem) => void
  onRestorePost: (row: AdminPostListItem) => void
}) => {
  if (isDeletedScope) {
    return (
      <RowActions>
        <GhostButton type="button" disabled={isRowPending} onClick={() => onRestorePost(row)}>
          {pendingKind === "restore" ? "복구 중..." : "복구"}
        </GhostButton>
        <GhostButton
          type="button"
          data-danger="true"
          disabled={isRowPending}
          onClick={() => onHardDeletePost(row)}
        >
          {pendingKind === "hardDelete" ? "삭제 중..." : "영구삭제"}
        </GhostButton>
      </RowActions>
    )
  }

  return (
    <RowActions>
      {canOpenPublicPost ? (
        <GhostLink
          as={Link}
          href={toCanonicalPostPath(row.id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{language === "en" ? "View" : "글 보기"}</span>
          <AppIcon name="external-link" width={12} height={12} />
        </GhostLink>
      ) : null}
      <GhostButton
        type="button"
        data-danger="true"
        disabled={isRowPending}
        onClick={() => onDeletePost(row)}
      >
        {pendingKind === "delete" ? "삭제 중..." : "삭제"}
      </GhostButton>
    </RowActions>
  )
}

export const AdminPostsWorkspaceList: React.FC<AdminPostsWorkspaceListProps> = ({
  listScope,
  listKw,
  listPage,
  listPageSize,
  listState,
  isListLoading,
  listError,
  shouldRenderMobileList,
  onLoadList,
  onOpenWriteRoute,
  onPageChange,
  pendingPostId,
  mutationPending,
  onDeletePost,
  onHardDeletePost,
  onRestorePost,
  onResetSearch,
  selectedIds,
  onToggleRowSelect,
  onToggleSelectAll,
  isAllSelected = false,
  isIndeterminate = false,
  bulkActionSlot,
  listSort = "MODIFIED_AT",
  onSortChange,
  onPageSizeChange,
}) => {
  const { language } = useLanguage()
  const isDeletedScope = listScope === "deleted"
  const getStatusLabel = (row: AdminPostListItem) =>
    isDeletedScope ? adminT("filterDeleted", language) : workspaceStatusLabel(row, language)
  const getStatusTone = (row: AdminPostListItem) => {
    if (isDeletedScope) return "danger"
    const baseTone = workspaceStatusTone(row)
    return baseTone === "PUBLIC_UNLISTED" ? "warn" : baseTone
  }
  const activePendingPostId = pendingPostId ?? mutationPending?.rowId ?? null
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  const lastShiftKeyRef = useRef(false)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  if (isListLoading) {
    return <AdminPostsListLoadingSkeleton language={language} />
  }

  if (listError) {
    return (
      <ListEmptyState>
        <strong>{adminT("tableErrorTitle", language)}</strong>
        <p>{listError}</p>
        <ActionRow>
          <PrimaryInlineButton type="button" onClick={onLoadList}>
            {adminT("tableErrorAction", language)}
          </PrimaryInlineButton>
        </ActionRow>
      </ListEmptyState>
    )
  }

  if (listState.rows.length === 0) {
    const isSearchFiltered = Boolean(listKw.trim())
    return (
      <ListEmptyState>
        <strong>
          {isSearchFiltered
            ? adminT("tableSearchEmptyTitle", language)
            : listScope === "active"
            ? adminT("tableEmptyTitle", language)
            : adminT("filterDeleted", language)}
        </strong>
        <p>
          {isSearchFiltered
            ? adminT("tableSearchEmptyDesc", language)
            : adminT("tableEmptyDesc", language)}
        </p>
        <ActionRow>
          {isSearchFiltered ? (
            <GhostButton type="button" onClick={onResetSearch}>
              {adminT("tableSearchEmptyAction", language)}
            </GhostButton>
          ) : (
            <PrimaryInlineButton type="button" onClick={() => onOpenWriteRoute()}>
              {adminT("tableEmptyAction", language)}
            </PrimaryInlineButton>
          )}
        </ActionRow>
      </ListEmptyState>
    )
  }

  const currentPage = Math.max(1, Number.parseInt(listPage, 10) || 1)
  const pageSize = Math.max(1, Number.parseInt(listPageSize, 10) || 1)
  const totalPages = Math.max(currentPage, Math.ceil(listState.total / pageSize))
  const showPager = totalPages > 1

  const rowProps = { [ADMIN_POSTS_ROW_ATTR]: "true" as const }
  const onListKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    handleAdminPostsListKeyDown(event, event.currentTarget)
  }

  const dateAriaSort =
    listScope === "active"
      ? listSort === "MODIFIED_AT" || listSort === "CREATED_AT"
        ? "descending"
        : listSort === "CREATED_AT_ASC"
          ? "ascending"
          : undefined
      : undefined
  const viewsAriaSort = listScope === "active" && listSort === "HIT_COUNT" ? "descending" : undefined
  const dateHeaderLabel =
    listSort === "CREATED_AT" || listSort === "CREATED_AT_ASC"
      ? adminT("tableColCreatedDate", language)
      : adminT("tableColDate", language)

  return (
    <ListCard>
      <ListSurfaceFrame>
        {!shouldRenderMobileList ? (
          <PostsDesktopTable>
            <VisuallyHiddenCaption>{adminT("navPosts", language)}</VisuallyHiddenCaption>
            <thead>
              <tr>
                <TableCheckboxHeader scope="col">
                  <CheckboxHitLabel>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label={adminT("tableSelectAllAria", language)}
                      checked={isAllSelected}
                      onChange={onToggleSelectAll}
                    />
                  </CheckboxHitLabel>
                </TableCheckboxHeader>
                <th scope="col">{adminT("tableColTitle", language)}</th>
                <th className="topicCell" scope="col">{adminT("tableColTopic", language)}</th>
                <th className="statusCell" scope="col">{adminT("tableColStatus", language)}</th>
                <th className="dateCell" scope="col" aria-sort={dateAriaSort}>
                  {onSortChange && listScope === "active" ? (
                    <HeaderSortButton
                      type="button"
                      onClick={() =>
                        onSortChange(listSort === "CREATED_AT_ASC" ? "MODIFIED_AT" : "CREATED_AT_ASC")
                      }
                    >
                      <span>{dateHeaderLabel}</span>
                      <AppIcon
                        name="chevron-down"
                        className="sortChevron"
                        width={13}
                        height={13}
                      />
                    </HeaderSortButton>
                  ) : (
                    adminT("tableColDate", language)
                  )}
                </th>
                <th className="viewsCell" scope="col" aria-sort={viewsAriaSort}>
                  {onSortChange && listScope === "active" ? (
                    <HeaderSortButton type="button" onClick={() => onSortChange("HIT_COUNT")}>
                      <span>{adminT("tableColViews", language)}</span>
                      <AppIcon
                        name="chevron-down"
                        className="sortChevron"
                        width={13}
                        height={13}
                      />
                    </HeaderSortButton>
                  ) : (
                    adminT("tableColViews", language)
                  )}
                </th>
                <th className="actionsCell" scope="col">{adminT("tableColActions", language)}</th>
              </tr>
            </thead>
            <tbody onKeyDown={onListKeyDown}>
              {listState.rows.map((row) => {
                const isRowPending = activePendingPostId === row.id
                const pendingKind = isRowPending ? mutationPending?.kind : null
                const canOpenPublicPost = canOpenCanonicalPost(row)
                const isChecked = selectedIds?.has(row.id) ?? false
                const subtitle = buildWorkspacePostSubtitle(row, listScope, language)
                const rowTitle = buildRowTitle(row)
                const tone = getStatusTone(row)

                return (
                  <tr key={row.id} {...rowProps} data-selected={isChecked ? "true" : undefined}>
                    <TableCheckboxCell>
                      <CheckboxHitLabel
                        onPointerDown={(event) => {
                          lastShiftKeyRef.current = event.shiftKey
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`${rowTitle} ${adminT("tableColCheckbox", language)}`}
                          checked={isChecked}
                          onKeyDown={(event) => {
                            lastShiftKeyRef.current = event.shiftKey
                          }}
                          onChange={() => {
                            onToggleRowSelect?.(row.id, lastShiftKeyRef.current)
                            lastShiftKeyRef.current = false
                          }}
                        />
                      </CheckboxHitLabel>
                    </TableCheckboxCell>
                    <td>
                      <TitleRowLayout>
                        <PostTitleSummaryBlock
                          row={row}
                          rowTitle={rowTitle}
                          subtitle={subtitle}
                          isDeletedScope={isDeletedScope}
                        />
                      </TitleRowLayout>
                    </td>
                    <td className="topicCell">
                      <TopicChip>{getWorkspaceTopicLabel(row)}</TopicChip>
                    </td>
                    <td className="statusCell">
                      <VisibilityBadge data-tone={tone}>
                        <StatusDotIndicator data-tone={tone} aria-hidden="true" />
                        <span>{getStatusLabel(row)}</span>
                      </VisibilityBadge>
                    </td>
                    <td className="dateCell">
                      {formatDateTime(listScope === "active" ? row.modifiedAt : row.deletedAt)}
                    </td>
                    <td className="viewsCell">
                      <span>{formatWorkspaceViews(row)}</span>
                    </td>
                    <td className="actionsCell">
                      <PostRowActionControls
                        row={row}
                        isDeletedScope={isDeletedScope}
                        isRowPending={isRowPending}
                        pendingKind={pendingKind}
                        canOpenPublicPost={canOpenPublicPost}
                        language={language}
                        onDeletePost={onDeletePost}
                        onHardDeletePost={onHardDeletePost}
                        onRestorePost={onRestorePost}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </PostsDesktopTable>
        ) : null}

        {shouldRenderMobileList ? (
          <MobileCardList onKeyDown={onListKeyDown}>
            {listState.rows.map((row) => {
              const isRowPending = activePendingPostId === row.id
              const pendingKind = isRowPending ? mutationPending?.kind : null
              const canOpenPublicPost = canOpenCanonicalPost(row)
              const isChecked = selectedIds?.has(row.id) ?? false
              const subtitle = buildWorkspacePostSubtitle(row, listScope, language)
              const rowTitle = buildRowTitle(row)
              const tone = getStatusTone(row)

              return (
                <article key={`mobile-${row.id}`} {...rowProps} data-selected={isChecked ? "true" : undefined}>
                  <header>
                    {onToggleRowSelect ? (
                      <CheckboxHitLabel>
                        <input
                          type="checkbox"
                          aria-label={`${rowTitle} 선택`}
                          checked={isChecked}
                          onChange={() => onToggleRowSelect(row.id, false)}
                        />
                      </CheckboxHitLabel>
                    ) : <span />}
                    <VisibilityBadge data-tone={tone}>
                      <StatusDotIndicator data-tone={tone} aria-hidden="true" />
                      <span>{getStatusLabel(row)}</span>
                    </VisibilityBadge>
                  </header>
                  <div className="mobileTitleRow">
                    <PostTitleSummaryBlock
                      row={row}
                      rowTitle={rowTitle}
                      subtitle={subtitle}
                      isDeletedScope={isDeletedScope}
                    />
                  </div>
                  <span className="date">
                    {getWorkspaceTopicLabel(row)} · {formatDateTime(listScope === "active" ? row.modifiedAt : row.deletedAt)} ·{" "}
                    {listScope === "active" ? formatWorkspaceViews(row) : "-"} views
                  </span>
                  <PostRowActionControls
                    row={row}
                    isDeletedScope={isDeletedScope}
                    isRowPending={isRowPending}
                    pendingKind={pendingKind}
                    canOpenPublicPost={canOpenPublicPost}
                    language={language}
                    onDeletePost={onDeletePost}
                    onHardDeletePost={onHardDeletePost}
                    onRestorePost={onRestorePost}
                  />
                </article>
              )
            })}
          </MobileCardList>
        ) : null}

        <EnhancedPagination>
          {onPageSizeChange ? (
            <div className="pageSizeControl">
              <span>{language === "en" ? "Rows:" : "목록 수:"}</span>
              <select
                aria-label="페이지당 글 수"
                value={listPageSize}
                onChange={(e) => onPageSizeChange(e.target.value)}
              >
                <option value="10">10개씩</option>
                <option value="20">20개씩</option>
                <option value="30">30개씩</option>
              </select>
            </div>
          ) : <div />}
          {showPager ? (
            <div className="pageControls">
              <GhostButton
                type="button"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                {adminT("paginationPrev", language)}
              </GhostButton>
              {generatePaginationPages(currentPage, totalPages).map((p, idx) =>
                p === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="pageEllipsis" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <PageNumberButton
                    key={`page-${p}`}
                    type="button"
                    $active={p === currentPage}
                    aria-current={p === currentPage ? "page" : undefined}
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </PageNumberButton>
                )
              )}
              <GhostButton
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                {adminT("paginationNext", language)}
              </GhostButton>
            </div>
          ) : null}
        </EnhancedPagination>
      </ListSurfaceFrame>
      {bulkActionSlot}
    </ListCard>
  )
}
