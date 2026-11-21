// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT) & payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT)
import { useQueryClient } from "@tanstack/react-query"
import { NextPage } from "next"
import { useRouter } from "next/router"
import { useCallback, useEffect, useRef, useState } from "react"
import { invalidatePublicPostReadCaches } from "src/apis/backend/posts"
import { apiFetch } from "src/apis/backend/client"
import useAuthSession from "src/hooks/useAuthSession"
import { pushRoute } from "src/libs/router"
import {
  buildListEndpoint,
  buildRowTitle,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  parseAdminPostsFacetCounts,
  POSTS_WORKSPACE_MOBILE_LIST_QUERY,
  sanitizeNumberInput,
  type AdminPostListItem,
  type AdminPostsFacetCounts,
  type ListSort,
  type ListState,
  type PageDto,
  type PostListScope,
  type PostStatusFilter,
  type PostWriteResult,
  type WorkspaceConfirmState,
  type WorkspaceToastState,
} from "./AdminPostsWorkspaceModel"
import {
  EMPTY_INITIAL_SNAPSHOT,
  POSTS_LIST_LOAD_ERROR_MESSAGE,
  buildPostsWorkspacePageCommands,
  type AdminPostsWorkspacePageProps,
} from "./AdminPostsWorkspacePageCommands"
import { AdminPostsWorkspacePageView } from "./AdminPostsWorkspacePageView"
import { revalidateSavedPost } from "./editorPostSaveRefresh"
import {
  BULK_ACTION_LIMIT_EXCEEDED_MESSAGE,
  isBulkSelectionOverLimit,
  type BulkActionKind,
} from "./adminPostsWorkspaceBulkModel"
import { useAdminPostsWorkspaceBulkActions } from "./useAdminPostsWorkspaceBulkActions"
import { parsePostsWorkspaceQueryParams, serializePostsWorkspaceQueryParams } from "./adminPostsWorkspaceUrlModel"

export { getAdminPostsWorkspacePageProps } from "./AdminPostsWorkspacePageCommands"

const postsWorkspaceCommands = buildPostsWorkspacePageCommands()

export const AdminPostWorkspacePage: NextPage<AdminPostsWorkspacePageProps> = ({
  initialMember,
  initialProfileSnapshot = null,
  initialSnapshot = EMPTY_INITIAL_SNAPSHOT,
}) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { me, authStatus } = useAuthSession()
  const sessionMember = authStatus === "loading" || authStatus === "unavailable" ? initialMember : me || initialMember
  const hasInitialListState = initialSnapshot.listState !== null
  const hasInitialFacetCounts = initialSnapshot.facetCounts != null

  const [listScope, setListScope] = useState<PostListScope>("active")
  const [listStatus, setListStatus] = useState<PostStatusFilter>("all")
  const [listKw, setListKw] = useState("")
  const [listPage, setListPage] = useState(DEFAULT_PAGE)
  const [listPageSize, setListPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [listSort, setListSort] = useState<ListSort>(DEFAULT_SORT)
  const [listState, setListState] = useState<ListState>(() => initialSnapshot.listState || { rows: [], total: 0, loadedAt: "" })
  const [facetCounts, setFacetCounts] = useState<AdminPostsFacetCounts | null>(() => initialSnapshot.facetCounts ?? null)
  const [isListLoading, setIsListLoading] = useState(!hasInitialListState)
  const [listError, setListError] = useState("")
  const [confirmState, setConfirmState] = useState<WorkspaceConfirmState>(null)
  const [toast, setToast] = useState<WorkspaceToastState>(null)
  const [mutationPending, setMutationPending] = useState<{ rowId: number; kind: "delete" | "restore" | "hardDelete" } | null>(null)
  const [shouldRenderMobileList, setShouldRenderMobileList] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(POSTS_WORKSPACE_MOBILE_LIST_QUERY).matches
      : false
  )

  const listSectionRef = useRef<HTMLElement | null>(null)
  const listRequestIdRef = useRef(0)
  const skipInitialListFetchRef = useRef(hasInitialListState)
  const skipInitialCountsFetchRef = useRef(hasInitialFacetCounts)
  const isInitialListMountRef = useRef(true)

  const loadList = useCallback(async () => {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    setIsListLoading(true)
    setListError("")

    try {
      const safePageSize = sanitizeNumberInput(listPageSize, DEFAULT_PAGE_SIZE)
      const data = await apiFetch<PageDto<AdminPostListItem>>(
        buildListEndpoint(listScope, {
          page: sanitizeNumberInput(listPage, DEFAULT_PAGE),
          pageSize: safePageSize,
          kw: listKw.trim(),
          sort: listSort,
          status: listStatus,
        })
      )

      if (listRequestIdRef.current !== requestId) return

      setListState({
        rows: data.content || [],
        total: data.pageable?.totalElements ?? data.content?.length ?? 0,
        loadedAt: new Date().toISOString(),
      })
    } catch {
      if (listRequestIdRef.current !== requestId) return
      setListError(POSTS_LIST_LOAD_ERROR_MESSAGE)
      setListState({ rows: [], total: 0, loadedAt: "" })
    } finally {
      if (listRequestIdRef.current === requestId) {
        setIsListLoading(false)
      }
    }
  }, [listKw, listPage, listPageSize, listScope, listSort, listStatus])

  const loadCounts = useCallback(async () => {
    try {
      const data = await apiFetch<unknown>("/post/api/v1/adm/posts/count")
      const parsed = parseAdminPostsFacetCounts(data)
      if (parsed) setFacetCounts(parsed)
    } catch {
      // safe fallback
    }
  }, [])

  useEffect(() => {
    if (skipInitialCountsFetchRef.current) {
      skipInitialCountsFetchRef.current = false
      return
    }
    void loadCounts()
  }, [loadCounts])

  const refreshWorkspaceLists = useCallback(async () => {
    await Promise.all([loadList(), loadCounts()])
  }, [loadCounts, loadList])

  const showToast = useCallback((next: WorkspaceToastState) => {
    setToast(next)
  }, [])

  const bulkActions = useAdminPostsWorkspaceBulkActions({
    rows: listState.rows,
    refreshWorkspaceLists,
    showToast,
    setConfirmState,
    resetDependencies: [listPage, listPageSize, listScope, listStatus, listKw, listSort],
  })

  const handleBulkActionRequest = useCallback(
    async (action: BulkActionKind) => {
      const selectedCount = bulkActions.selectedIds.size
      if (selectedCount === 0) return
      if (isBulkSelectionOverLimit(selectedCount)) {
        showToast({
          tone: "error",
          text: `${BULK_ACTION_LIMIT_EXCEEDED_MESSAGE} (현재 ${selectedCount}개 선택됨)`,
        })
        return
      }
      if (action === "DELETE") {
        setConfirmState({
          kind: "bulkDelete",
          rowId: 0,
          rowTitle: `선택한 글 ${selectedCount}개`,
          headline: "선택한 글을 삭제할까요?",
          description: "삭제한 글은 삭제됨 탭에서 다시 복구할 수 있습니다.",
          confirmLabel: "일괄 삭제",
          tone: "danger",
        })
        return
      }
      await bulkActions.handleBulkAction(action)
    },
    [bulkActions, showToast]
  )

  // URL 쿼리와 양방향 동기화
  const syncUrlQuery = useCallback(
    (next: { status?: PostStatusFilter; page?: string; pageSize?: string; kw?: string; sort?: ListSort }) => {
      if (!router.isReady) return
      const nextStatus = next.status ?? listStatus
      const query = serializePostsWorkspaceQueryParams({
        status: nextStatus,
        page: next.page ?? listPage,
        pageSize: next.pageSize ?? listPageSize,
        kw: next.kw ?? listKw,
        sort: next.sort ?? listSort,
        scope: nextStatus === "deleted" ? "deleted" : "active",
      })
      void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
    },
    [listKw, listPage, listPageSize, listSort, listStatus, router]
  )

  useEffect(() => {
    if (!router.isReady) return
    const parsed = parsePostsWorkspaceQueryParams(router.query)
    setListScope((prev) => (prev !== parsed.scope ? parsed.scope : prev))
    setListStatus((prev) => (prev !== parsed.status ? parsed.status : prev))
    setListPage((prev) => (prev !== parsed.page ? parsed.page : prev))
    setListPageSize((prev) => (prev !== parsed.pageSize ? parsed.pageSize : prev))
    setListKw((prev) => (prev !== parsed.kw ? parsed.kw : prev))
    setListSort((prev) => (prev !== parsed.sort ? parsed.sort : prev))
  }, [router.isReady, router.query])

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia(POSTS_WORKSPACE_MOBILE_LIST_QUERY)

    const sync = () => {
      setShouldRenderMobileList(mediaQuery.matches)
    }

    sync()

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync)
      return () => {
        mediaQuery.removeEventListener("change", sync)
      }
    }

    mediaQuery.addListener(sync)
    return () => {
      mediaQuery.removeListener(sync)
    }
  }, [])

  useEffect(() => {
    const isInitialMount = isInitialListMountRef.current
    isInitialListMountRef.current = false
    if (skipInitialListFetchRef.current) {
      skipInitialListFetchRef.current = false
      return
    }
    if (isInitialMount) {
      void loadList()
      return
    }
    const timer = window.setTimeout(() => {
      void loadList()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [loadList])

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.surface !== "manage") return
    const timer = window.setTimeout(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [router.isReady, router.query.surface])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => {
      setToast((current) => (current === toast ? null : current))
    }, toast.action ? 7000 : 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openWriteRoute = useCallback(
    async (query?: Record<string, string>) => {
      await pushRoute(router, postsWorkspaceCommands.toEditorRoute(query))
    },
    [router]
  )

  const performDeletePost = useCallback(
    async (row: Pick<AdminPostListItem, "id" | "title" | "published" | "listed" | "tempDraft">) => {
      try {
        setMutationPending({ rowId: row.id, kind: "delete" })
        setToast(null)
        await apiFetch(`/post/api/v1/posts/${row.id}`, { method: "DELETE" })
        await invalidatePublicPostReadCaches(queryClient, row.id)
        await revalidateSavedPost(row.id).catch(() => undefined)
        await refreshWorkspaceLists()
        showToast({
          tone: "success",
          text: `#${row.id} ${buildRowTitle(row)} 글을 삭제했습니다.`,
          actionLabel: "되돌리기",
          action: {
            kind: "restore",
            rowId: row.id,
            rowTitle: buildRowTitle(row),
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        showToast({ tone: "error", text: `삭제 실패: ${message}` })
      } finally {
        setMutationPending(null)
      }
    },
    [queryClient, refreshWorkspaceLists, showToast]
  )

  const performRestorePost = useCallback(
    async (row: Pick<AdminPostListItem, "id" | "title" | "published" | "listed" | "tempDraft">) => {
      try {
        setMutationPending({ rowId: row.id, kind: "restore" })
        setToast(null)
        await apiFetch<PostWriteResult>(`/post/api/v1/adm/posts/${row.id}/restore`, { method: "POST" })
        await invalidatePublicPostReadCaches(queryClient, row.id)
        await revalidateSavedPost(row.id).catch(() => undefined)
        await refreshWorkspaceLists()
        showToast({
          tone: "success",
          text: `#${row.id} ${buildRowTitle(row)} 글을 복구했습니다.`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        showToast({ tone: "error", text: `복구 실패: ${message}` })
      } finally {
        setMutationPending(null)
      }
    },
    [queryClient, refreshWorkspaceLists, showToast]
  )

  const performHardDeletePost = useCallback(
    async (row: Pick<AdminPostListItem, "id" | "title" | "published" | "listed" | "tempDraft">) => {
      try {
        setMutationPending({ rowId: row.id, kind: "hardDelete" })
        setToast(null)
        await apiFetch(`/post/api/v1/adm/posts/${row.id}/hard`, { method: "DELETE" })
        await invalidatePublicPostReadCaches(queryClient, row.id)
        await revalidateSavedPost(row.id).catch(() => undefined)
        await refreshWorkspaceLists()
        showToast({
          tone: "success",
          text: `#${row.id} ${buildRowTitle(row)} 글을 영구삭제했습니다.`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        showToast({ tone: "error", text: `영구삭제 실패: ${message}` })
      } finally {
        setMutationPending(null)
      }
    },
    [queryClient, refreshWorkspaceLists, showToast]
  )

  const handleDeletePost = useCallback(
    async (row: AdminPostListItem) => {
      setConfirmState({
        kind: "delete",
        rowId: row.id,
        rowTitle: buildRowTitle(row),
        headline: "글을 삭제할까요?",
        description: "삭제한 글은 삭제 글 탭에서 바로 복구할 수 있습니다.",
        confirmLabel: "삭제하기",
        tone: "danger",
      })
    },
    []
  )

  const handleRestorePost = useCallback(
    async (row: AdminPostListItem) => {
      await performRestorePost(row)
    },
    [performRestorePost]
  )

  const handleHardDeletePost = useCallback(
    async (row: AdminPostListItem) => {
      setConfirmState({
        kind: "hardDelete",
        rowId: row.id,
        rowTitle: buildRowTitle(row),
        headline: "글을 영구삭제할까요?",
        description: "영구삭제 후에는 복구할 수 없습니다.",
        confirmLabel: "영구삭제",
        tone: "danger",
      })
    },
    []
  )

  const handleStatusFilterChange = useCallback((nextStatus: PostStatusFilter) => {
    setListStatus(nextStatus)
    setListPage(DEFAULT_PAGE)
    setListScope(nextStatus === "deleted" ? "deleted" : "active")
    syncUrlQuery({ status: nextStatus, page: DEFAULT_PAGE })
  }, [syncUrlQuery])

  const handleSortChange = useCallback((nextSort: ListSort) => {
    setListSort(nextSort)
    setListPage(DEFAULT_PAGE)
    syncUrlQuery({ sort: nextSort, page: DEFAULT_PAGE })
  }, [syncUrlQuery])

  const handlePageChange = useCallback((nextPage: string) => {
    setListPage(nextPage)
    syncUrlQuery({ page: nextPage })
  }, [syncUrlQuery])

  const handlePageSizeChange = useCallback((nextSize: string) => {
    setListPageSize(nextSize)
    setListPage(DEFAULT_PAGE)
    syncUrlQuery({ pageSize: nextSize, page: DEFAULT_PAGE })
  }, [syncUrlQuery])

  const handleKeywordChange = useCallback((nextKw: string) => {
    setListKw(nextKw)
    setListPage(DEFAULT_PAGE)
    syncUrlQuery({ kw: nextKw, page: DEFAULT_PAGE })
  }, [syncUrlQuery])

  useEffect(() => {
    if (listState.rows.length === 0 && listState.total > 0 && (Number.parseInt(listPage, 10) || 1) > 1) {
      setListPage(String(Math.max(1, Math.ceil(listState.total / (Number.parseInt(listPageSize, 10) || 10)))))
    }
  }, [listPage, listPageSize, listState.rows.length, listState.total])

  const handleToastAction = useCallback(async () => {
    if (!toast?.action) return
    if (toast.action.kind === "restore") {
      await performRestorePost({
        id: toast.action.rowId,
        title: toast.action.rowTitle,
        published: false,
        listed: false,
        tempDraft: false,
      })
    }
  }, [performRestorePost, toast])

  const handleConfirmAction = useCallback(async () => {
    if (!confirmState) return
    if (confirmState.kind === "bulkDelete") {
      setConfirmState(null)
      await bulkActions.handleBulkAction("DELETE")
      return
    }
    if (confirmState.kind === "bulkHardDelete") {
      setConfirmState(null)
      await bulkActions.handleConfirmBulkHardDelete()
      return
    }
    const row = {
      id: confirmState.rowId,
      title: confirmState.rowTitle,
      published: false,
      listed: false,
      tempDraft: false,
    }
    setConfirmState(null)
    if (confirmState.kind === "delete") {
      await performDeletePost(row)
      return
    }
    await performHardDeletePost(row)
  }, [bulkActions, confirmState, performDeletePost, performHardDeletePost])

  const handleResetFilters = useCallback(() => {
    setListScope("active")
    setListStatus("all")
    setListKw("")
    setListSort(DEFAULT_SORT)
    setListPage(DEFAULT_PAGE)
    syncUrlQuery({ status: "all", kw: "", sort: DEFAULT_SORT, page: DEFAULT_PAGE })
  }, [syncUrlQuery])

  if (!sessionMember) return null

  return (
    <AdminPostsWorkspacePageView
      confirmState={confirmState}
      handleConfirmAction={handleConfirmAction}
      handleDeletePost={handleDeletePost}
      handleToastAction={handleToastAction}
      initialProfileSnapshot={initialProfileSnapshot}
      isListLoading={isListLoading}
      listError={listError}
      listKw={listKw}
      listPage={listPage}
      listPageSize={listPageSize}
      listScope={listScope}
      listStatus={listStatus}
      listSectionRef={listSectionRef}
      listSort={listSort}
      listState={listState}
      facetCounts={facetCounts}
      loadList={loadList}
      pendingPostId={mutationPending?.rowId ?? null}
      mutationPending={mutationPending}
      onResetFilters={handleResetFilters}
      openWriteRoute={openWriteRoute}
      sessionMember={sessionMember}
      setConfirmState={setConfirmState}
      setListKw={handleKeywordChange}
      setListPage={handlePageChange}
      setListPageSize={handlePageSizeChange}
      setListStatus={handleStatusFilterChange}
      setListSort={handleSortChange}
      setToast={setToast}
      onHardDeletePost={handleHardDeletePost}
      onRestorePost={handleRestorePost}
      shouldRenderMobileList={shouldRenderMobileList}
      toast={toast}
      selectedIds={bulkActions.selectedIds}
      isAllSelected={bulkActions.isAllSelected}
      isIndeterminate={bulkActions.isIndeterminate}
      isBulkPending={bulkActions.isBulkPending}
      onToggleRowSelect={bulkActions.handleToggleRowSelect}
      onToggleSelectAll={bulkActions.handleToggleSelectAll}
      onClearSelection={bulkActions.handleClearSelection}
      onBulkAction={handleBulkActionRequest}
    />
  )
}

export default AdminPostWorkspacePage
