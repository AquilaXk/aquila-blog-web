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
  POSTS_WORKSPACE_MOBILE_LIST_QUERY,
  sanitizeNumberInput,
  type AdminPostListItem,
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

  const [listScope, setListScope] = useState<PostListScope>("active")
  const [listStatus, setListStatus] = useState<PostStatusFilter>("all")
  const [listKw, setListKw] = useState("")
  const [listPage, setListPage] = useState(DEFAULT_PAGE)
  const [listPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [listSort, setListSort] = useState<ListSort>(DEFAULT_SORT)
  const [listState, setListState] = useState<ListState>(() => initialSnapshot.listState || { rows: [], total: 0, loadedAt: "" })
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

  const refreshWorkspaceLists = useCallback(async () => {
    await loadList()
  }, [loadList])

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

  const showToast = useCallback((next: WorkspaceToastState) => {
    setToast(next)
  }, [])

  const performDeletePost = useCallback(
    async (row: Pick<AdminPostListItem, "id" | "title" | "published" | "listed" | "tempDraft">) => {
      try {
        setMutationPending({ rowId: row.id, kind: "delete" })
        setToast(null)
        await apiFetch(`/post/api/v1/posts/${row.id}`, { method: "DELETE" })
        await invalidatePublicPostReadCaches(queryClient, row.id)
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
  }, [])

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
  }, [confirmState, performDeletePost, performHardDeletePost])

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
      loadList={loadList}
      mutationPending={mutationPending}
      openWriteRoute={openWriteRoute}
      sessionMember={sessionMember}
      setConfirmState={setConfirmState}
      setListKw={setListKw}
      setListPage={setListPage}
      setListStatus={handleStatusFilterChange}
      setListSort={setListSort}
      setToast={setToast}
      onHardDeletePost={handleHardDeletePost}
      onRestorePost={handleRestorePost}
      shouldRenderMobileList={shouldRenderMobileList}
      toast={toast}
    />
  )
}

export default AdminPostWorkspacePage
