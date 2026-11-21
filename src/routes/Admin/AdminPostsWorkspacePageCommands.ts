// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT) & payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT)
import { GetServerSideProps } from "next"
import { IncomingMessage } from "http"
import type { AuthMember } from "src/hooks/useAuthSession"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { AdminPageProps, buildAdminPagePropsFromMember, getAdminPageProps, readAdminProtectedBootstrap } from "src/libs/server/adminPage"
import { hasServerAuthCookie } from "src/libs/server/authSession"
import { serverApiFetchJson } from "src/libs/server/backend"
import { readServerSnapshot } from "src/libs/server/serverSnapshotCache"
import { appendSsrDebugTiming, timed } from "src/libs/server/serverTiming"
import {
  buildListEndpoint,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  EDITOR_NEW_ROUTE_PATH,
  parseAdminPostsFacetCounts,
  type AdminPostListItem,
  type AdminPostsFacetCounts,
  type ListState,
  type PageDto,
} from "./AdminPostsWorkspaceModel"
import { parsePostsWorkspaceQueryParams } from "./adminPostsWorkspaceUrlModel"

type AdminPostsWorkspaceInitialSnapshot = {
  recentPosts: AdminPostListItem[]
  recentFetchedAt: string | null
  listState: ListState | null
  facetCounts?: AdminPostsFacetCounts | null
}

type AdminPostsListSsrSnapshot = {
  listSource: PageDto<AdminPostListItem>
  fetchedAt: string
}

type AdminPostsBootstrapPayload = {
  member: AuthMember
  firstPage: PageDto<AdminPostListItem>
}

export type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export type AdminPostsWorkspacePageProps = AdminPageProps & {
  initialSnapshot: AdminPostsWorkspaceInitialSnapshot
}

export const EMPTY_INITIAL_SNAPSHOT: AdminPostsWorkspaceInitialSnapshot = {
  recentPosts: [],
  recentFetchedAt: null,
  listState: null,
  facetCounts: null,
}
const ADMIN_POSTS_SSR_LIST_CACHE_TTL_MS = 5_000
const ADMIN_POSTS_SSR_FACET_CACHE_KEY = "admin-posts:facet-counts"
export const POSTS_LIST_LOAD_ERROR_MESSAGE = "글 목록 서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."

const toEditorRoute = (query?: Record<string, string>) => {
  if (query?.postId) {
    return `/admin/editor/${encodeURIComponent(query.postId)}`
  }

  const search = query ? new URLSearchParams(query).toString() : ""
  return search ? `${EDITOR_NEW_ROUTE_PATH}?${search}` : EDITOR_NEW_ROUTE_PATH
}

const buildCanonicalPostUrl = (postId: string | number) => {
  const path = toCanonicalPostPath(postId)
  if (typeof window === "undefined") return path
  return new URL(path, window.location.origin).toString()
}

async function readJsonIfOk<T>(req: IncomingMessage, path: string): Promise<T | null> {
  try {
    const value = await serverApiFetchJson<T>(req, path)
    return value ?? null
  } catch {
    return null
  }
}

export const getAdminPostsWorkspacePageProps: GetServerSideProps<AdminPostsWorkspacePageProps> = async (context) => {
  const ssrStartedAt = performance.now()
  const queryParams = parsePostsWorkspaceQueryParams(context.query)
  const hasAuthCookie = hasServerAuthCookie(context.req)
  const isDefaultQuery =
    queryParams.status === "all" &&
    queryParams.page === DEFAULT_PAGE &&
    queryParams.pageSize === DEFAULT_PAGE_SIZE &&
    !queryParams.kw &&
    queryParams.sort === DEFAULT_SORT

  const facetCountsPromise = hasAuthCookie
    ? readServerSnapshot<AdminPostsFacetCounts>(
        ADMIN_POSTS_SSR_FACET_CACHE_KEY,
        ADMIN_POSTS_SSR_LIST_CACHE_TTL_MS,
        async () => {
          const raw = await readJsonIfOk<unknown>(context.req, "/post/api/v1/adm/posts/count")
          return parseAdminPostsFacetCounts(raw)
        }
      ).catch(() => null)
    : null

  const bootstrapResultPromise =
    hasAuthCookie && isDefaultQuery
      ? timed(() =>
          readAdminProtectedBootstrap<AdminPostsBootstrapPayload>(
            context.req,
            "/post/api/v1/adm/posts/bootstrap",
            "/admin/posts"
          )
        )
      : null

  const bootstrapResult = bootstrapResultPromise ? await bootstrapResultPromise : null
  if (bootstrapResult && !bootstrapResult.ok) {
    throw bootstrapResult.error
  }
  if (bootstrapResult?.ok && !bootstrapResult.value.ok && bootstrapResult.value.destination) {
    return {
      redirect: {
        destination: bootstrapResult.value.destination,
        permanent: false,
      },
    }
  }

  let baseProps: AdminPageProps
  let authDurationMs = 0
  let authDescription = "bootstrap"
  let listSourceResult: { durationMs: number; ok: true; value: { value: AdminPostsListSsrSnapshot | null; source: string } }

  if (bootstrapResult?.ok && bootstrapResult.value.ok) {
    baseProps = buildAdminPagePropsFromMember(bootstrapResult.value.value.member)
    listSourceResult = {
      durationMs: bootstrapResult.durationMs,
      ok: true,
      value: {
        value: {
          listSource: bootstrapResult.value.value.firstPage,
          fetchedAt: new Date().toISOString(),
        },
        source: "bootstrap",
      },
    }
  } else {
    const queryListCacheKey = `admin-posts:list:${queryParams.scope}:${queryParams.status}:${queryParams.sort}:page=${queryParams.page}:size=${queryParams.pageSize}:kw=${encodeURIComponent(queryParams.kw)}`
    const readQueryListSnapshot = () =>
      readServerSnapshot<AdminPostsListSsrSnapshot>(
        queryListCacheKey,
        ADMIN_POSTS_SSR_LIST_CACHE_TTL_MS,
        async () => {
          const listSource = await readJsonIfOk<PageDto<AdminPostListItem>>(
            context.req,
            buildListEndpoint(queryParams.scope, {
              page: queryParams.page,
              pageSize: queryParams.pageSize,
              kw: queryParams.kw,
              sort: queryParams.sort,
              status: queryParams.status,
            })
          )
          if (!listSource) return null
          return {
            listSource,
            fetchedAt: new Date().toISOString(),
          }
        }
      )

    const listSourceResultPromise = hasAuthCookie ? timed(readQueryListSnapshot) : null

    const baseResult = await timed(() => getAdminPageProps(context.req))
    if (!baseResult.ok) throw baseResult.error
    if ("redirect" in baseResult.value) return baseResult.value
    if (!("props" in baseResult.value)) return baseResult.value
    baseProps = await baseResult.value.props
    authDurationMs = baseResult.durationMs
    authDescription = "fallback"
    const fallbackListSourceResult = listSourceResultPromise
      ? await listSourceResultPromise
      : await timed(readQueryListSnapshot)
    if (!fallbackListSourceResult.ok) throw fallbackListSourceResult.error
    listSourceResult = fallbackListSourceResult
  }

  const facetCountsSnapshot = facetCountsPromise ? await facetCountsPromise : null
  const initialFacetCounts = facetCountsSnapshot?.value ?? null

  const listSnapshot = listSourceResult.ok ? listSourceResult.value.value : null
  const listSource = listSnapshot?.listSource ?? null
  const fetchedAt = listSnapshot?.fetchedAt ?? null
  const listState =
    listSource
      ? {
          rows: listSource.content || [],
          total: listSource.pageable?.totalElements ?? listSource.content?.length ?? 0,
          loadedAt: fetchedAt || new Date().toISOString(),
        }
      : null

  appendSsrDebugTiming(context.req, context.res, [
    {
      name: "admin-posts-auth",
      durationMs: authDurationMs,
      description: authDescription,
    },
    {
      name: "admin-posts-list",
      durationMs: listSourceResult.durationMs,
      description: listState ? (listSourceResult.ok ? listSourceResult.value.source : "ok") : "empty",
    },
    {
      name: "admin-posts-ssr-total",
      durationMs: performance.now() - ssrStartedAt,
      description: "ready",
    },
  ])

  return {
    props: {
      ...baseProps,
      initialSnapshot: {
        recentPosts: [],
        recentFetchedAt: fetchedAt,
        listState,
        facetCounts: initialFacetCounts,
      },
    },
  }
}

export const buildPostsWorkspacePageCommands = () => ({
  toEditorRoute,
  buildCanonicalPostUrl,
})
