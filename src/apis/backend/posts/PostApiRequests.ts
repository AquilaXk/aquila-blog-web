import { normalizeTagQuery } from "src/libs/query/normalize"
import type { TPost } from "src/types"
import { apiFetch } from "../client"
import type {
  ApiPostDto,
  ApiTagCountDto,
  CursorPageDto,
  ExplorePostsPage,
  ExplorePostsParams,
  PageDto,
  PostsBootstrapDto,
  PostsBootstrapResult,
} from "./PostApiDtos"
import { mapPostDto } from "./PostApiMappers"
import {
  buildBootstrapPath,
  buildExploreCursorPath,
  buildExplorePath,
  buildFeedCursorPath,
  buildFeedPath,
  buildRelatedByAuthorPath,
  buildSearchPath,
  getFreshServerSnapshot,
  isServerRuntime,
  PAGE_SIZE,
  POSTS_BOOTSTRAP_SSR_CACHE_MAX_ENTRIES,
  POSTS_BOOTSTRAP_SSR_CACHE_TTL_MS,
  POSTS_TAGS_API_PATH,
  recordRuntimeEndpoint,
  setServerSnapshot,
  toValidPage,
  toValidPageSize,
} from "./PostApiRequestModel"

export { getPostDetailById, getPostDetailBySlug } from "./PostApiDetailRequests"

let postsBootstrapSsrCache = new Map<string, { value: PostsBootstrapResult; cachedAt: number }>()
let pendingPostsBootstrapPromises = new Map<string, Promise<PostsBootstrapResult>>()

const toTagCountMap = (rows: readonly ApiTagCountDto[]): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const normalizedTag = normalizeTagQuery(row.tag)
    if (!normalizedTag) return acc
    acc[normalizedTag] = Number.isFinite(row.count) ? row.count : 0
    return acc
  }, {})

const toPostsPageResult = (
  response: PageDto<ApiPostDto>,
  fallbackPageNumber: number,
  fallbackPageSize: number,
  paginationMode?: "page"
): ExplorePostsPage => ({
  posts: response.content.map(mapPostDto),
  totalCount:
    typeof response.pageable?.totalElements === "number" && Number.isFinite(response.pageable.totalElements)
      ? response.pageable.totalElements
      : response.content.length,
  pageNumber:
    typeof response.pageable?.pageNumber === "number" && Number.isFinite(response.pageable.pageNumber)
      ? Math.max(1, Math.trunc(response.pageable.pageNumber))
      : fallbackPageNumber,
  pageSize:
    typeof response.pageable?.pageSize === "number" && Number.isFinite(response.pageable.pageSize)
      ? Math.max(1, Math.trunc(response.pageable.pageSize))
      : fallbackPageSize,
  paginationMode,
})

const toPostsCursorPageResult = (
  response: CursorPageDto<ApiPostDto>,
  pageSize: number
): ExplorePostsPage => {
  const mappedPosts = response.content.map(mapPostDto)
  return {
    posts: mappedPosts,
    totalCount: mappedPosts.length,
    pageNumber: 1,
    pageSize,
    hasNext: response.hasNext === true,
    nextCursor: typeof response.nextCursor === "string" ? response.nextCursor : null,
    paginationMode: "cursor",
  }
}

const fetchPostsPageResult = async ({
  endpoint,
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
  paginationMode,
}: {
  endpoint: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
  paginationMode?: "page"
}): Promise<ExplorePostsPage> => {
  const fallbackPageNumber = toValidPage(page)
  const fallbackPageSize = toValidPageSize(pageSize)
  recordRuntimeEndpoint(endpoint, "page")
  const response = await apiFetch<PageDto<ApiPostDto>>(endpoint, { signal })
  return toPostsPageResult(response, fallbackPageNumber, fallbackPageSize, paginationMode)
}

const fetchPostsCursorPageResult = async ({
  buildEndpoint,
  pageSize = PAGE_SIZE,
  cursor,
  signal,
}: {
  buildEndpoint: (params: { pageSize: number; cursor?: string }) => string
  pageSize?: number
  cursor?: string
  signal?: AbortSignal
}): Promise<ExplorePostsPage> => {
  const safePageSize = toValidPageSize(pageSize)
  const normalizedCursor = typeof cursor === "string" && cursor.trim() ? cursor.trim() : undefined
  const endpoint = buildEndpoint({ pageSize: safePageSize, cursor: normalizedCursor })
  recordRuntimeEndpoint(endpoint, "cursor")
  const response = await apiFetch<CursorPageDto<ApiPostDto>>(endpoint, { signal })
  return toPostsCursorPageResult(response, safePageSize)
}

export const resetPostsRequestCaches = () => {
  postsBootstrapSsrCache = new Map()
  pendingPostsBootstrapPromises = new Map()
}

export const getPostsBootstrap = async ({
  tag = "",
  order = "desc",
  pageSize = PAGE_SIZE,
  signal,
}: {
  tag?: string
  order?: "asc" | "desc"
  pageSize?: number
  signal?: AbortSignal
}): Promise<PostsBootstrapResult> => {
  const endpoint = buildBootstrapPath({ tag, order, pageSize })
  const snapshotCache = postsBootstrapSsrCache
  const pendingSnapshots = pendingPostsBootstrapPromises
  recordRuntimeEndpoint(endpoint, "cursor")
  const canUseServerSnapshot = isServerRuntime && !signal
  const cachedSnapshot =
    canUseServerSnapshot
      ? getFreshServerSnapshot(snapshotCache, endpoint, POSTS_BOOTSTRAP_SSR_CACHE_TTL_MS)
      : null
  if (cachedSnapshot) return cachedSnapshot

  if (canUseServerSnapshot) {
    const pendingSnapshot = pendingSnapshots.get(endpoint)
    if (pendingSnapshot) return pendingSnapshot
  }

  const loadBootstrap = async (): Promise<PostsBootstrapResult> => {
    const response = await apiFetch<PostsBootstrapDto>(endpoint, { signal })
    const feed = response.feed
    return {
      posts: feed.content.map(mapPostDto),
      hasNext: feed.hasNext === true,
      nextCursor: typeof feed.nextCursor === "string" ? feed.nextCursor : null,
      pageSize: Number.isFinite(feed.pageSize) ? Math.max(1, Math.trunc(feed.pageSize)) : toValidPageSize(pageSize),
      tagCounts: toTagCountMap(response.tags),
    }
  }

  if (!canUseServerSnapshot) {
    return loadBootstrap()
  }

  const snapshotPromise = (async () => {
    try {
      const nextSnapshot = await loadBootstrap()
      setServerSnapshot(
        snapshotCache,
        endpoint,
        nextSnapshot,
        POSTS_BOOTSTRAP_SSR_CACHE_MAX_ENTRIES
      )
      return nextSnapshot
    } finally {
      pendingSnapshots.delete(endpoint)
    }
  })()

  pendingSnapshots.set(endpoint, snapshotPromise)
  return snapshotPromise
}

export const getFeedPosts = async ({
  page = 1,
  pageSize = PAGE_SIZE,
  order = "desc",
}: {
  page?: number
  pageSize?: number
  order?: "asc" | "desc"
} = {}): Promise<TPost[]> => {
  const { posts } = await getFeedPostsPage({
    order,
    page,
    pageSize,
  })
  return posts
}

export const getExplorePosts = async ({
  kw = "",
  tag = "",
  order = "desc",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: ExplorePostsParams = {}): Promise<TPost[]> => {
  const { posts } = await getExplorePostsPage({
    kw,
    tag,
    order,
    page,
    pageSize,
    signal,
  })
  return posts
}

export const getExplorePostsPage = async ({
  kw = "",
  tag = "",
  order = "desc",
  sortMode = "latest",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: ExplorePostsParams = {}): Promise<ExplorePostsPage> =>
  fetchPostsPageResult({
    endpoint: buildExplorePath({ kw, tag, order, sortMode, page, pageSize }),
    page,
    pageSize,
    signal,
    paginationMode: "page",
  })

export const getFeedPostsPage = async ({
  order = "desc",
  sortMode = "latest",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: Pick<ExplorePostsParams, "order" | "sortMode" | "page" | "pageSize" | "signal"> = {}): Promise<ExplorePostsPage> =>
  fetchPostsPageResult({
    endpoint: buildFeedPath({ order, sortMode, page, pageSize }),
    page,
    pageSize,
    signal,
    paginationMode: "page",
  })

export const getFeedPostsCursorPage = async ({
  order = "desc",
  sortMode = "latest",
  pageSize = PAGE_SIZE,
  cursor,
  signal,
}: {
  order?: "asc" | "desc"
  sortMode?: ExplorePostsParams["sortMode"]
  pageSize?: number
  cursor?: string
  signal?: AbortSignal
}): Promise<ExplorePostsPage> =>
  fetchPostsCursorPageResult({
    buildEndpoint: ({ pageSize: safePageSize, cursor: normalizedCursor }) =>
      buildFeedCursorPath({ order, sortMode, pageSize: safePageSize, cursor: normalizedCursor }),
    pageSize,
    cursor,
    signal,
  })

export const getExplorePostsCursorPage = async ({
  tag = "",
  order = "desc",
  sortMode = "latest",
  pageSize = PAGE_SIZE,
  cursor,
  signal,
}: {
  tag?: string
  order?: "asc" | "desc"
  sortMode?: ExplorePostsParams["sortMode"]
  pageSize?: number
  cursor?: string
  signal?: AbortSignal
}): Promise<ExplorePostsPage> =>
  fetchPostsCursorPageResult({
    buildEndpoint: ({ pageSize: safePageSize, cursor: normalizedCursor }) =>
      buildExploreCursorPath({ tag, order, sortMode, pageSize: safePageSize, cursor: normalizedCursor }),
    pageSize,
    cursor,
    signal,
  })

export const getSearchPostsPage = async ({
  kw = "",
  order = "desc",
  sortMode = "latest",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: ExplorePostsParams = {}): Promise<ExplorePostsPage> =>
  fetchPostsPageResult({
    endpoint: buildSearchPath({ kw, order, sortMode, page, pageSize }),
    page,
    pageSize,
    signal,
  })

export const getTagCounts = async (): Promise<Record<string, number>> => {
  const rows = await apiFetch<ApiTagCountDto[]>(POSTS_TAGS_API_PATH)
  return toTagCountMap(rows)
}

export const getRelatedPostsByAuthor = async ({
  authorId,
  excludePostId,
  limit = 4,
  signal,
}: {
  authorId: string | number
  excludePostId?: string | number
  limit?: number
  signal?: AbortSignal
}): Promise<TPost[]> => {
  const authorIdNumber = Number(authorId)
  if (!Number.isInteger(authorIdNumber) || authorIdNumber <= 0) return []

  const excludePostIdNumber = Number(excludePostId)
  const safeExcludePostId =
    Number.isInteger(excludePostIdNumber) && excludePostIdNumber > 0 ? excludePostIdNumber : undefined
  const safeLimit = Number.isFinite(limit) ? Math.min(12, Math.max(1, Math.trunc(limit))) : 4

  const rows = await apiFetch<ApiPostDto[]>(
    (() => {
      const endpoint = buildRelatedByAuthorPath({
        authorId: authorIdNumber,
        excludePostId: safeExcludePostId,
        limit: safeLimit,
      })
      recordRuntimeEndpoint(endpoint, "page")
      return endpoint
    })(),
    { signal }
  )

  return rows
    .map(mapPostDto)
    .filter((post) => (safeExcludePostId ? Number(post.id) !== safeExcludePostId : true))
    .slice(0, safeLimit)
}
