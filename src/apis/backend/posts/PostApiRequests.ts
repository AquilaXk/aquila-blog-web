import { normalizeTagQuery } from "src/libs/query/normalize"
import type { TPost } from "src/types"
import { ApiError, apiFetch } from "../client"
import { resetPostDetailRequestCaches } from "./PostApiDetailRequests"
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
  isAbortError,
  isServerRuntime,
  PAGE_SIZE,
  POSTS_BOOTSTRAP_SSR_CACHE_MAX_ENTRIES,
  POSTS_BOOTSTRAP_SSR_CACHE_TTL_MS,
  POSTS_CACHE_TTL_MS,
  POSTS_TAGS_API_PATH,
  recordRuntimeEndpoint,
  setServerSnapshot,
  toValidPage,
  toValidPageSize,
} from "./PostApiRequestModel"

export { getPostDetailById, getPostDetailBySlug } from "./PostApiDetailRequests"

let postsCache: TPost[] | null = null
let postsCacheAt = 0
let pendingPostsPromise: Promise<TPost[]> | null = null
let postsBootstrapSsrCache = new Map<string, { value: PostsBootstrapResult; cachedAt: number }>()
let pendingPostsBootstrapPromises = new Map<string, Promise<PostsBootstrapResult>>()

type GetPostsOptions = {
  throwOnError?: boolean
}

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

export const resetPostsRequestCaches = () => {
  postsCache = null
  postsCacheAt = 0
  pendingPostsPromise = null
  postsBootstrapSsrCache = new Map()
  pendingPostsBootstrapPromises = new Map()
  resetPostDetailRequestCaches()
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
      tagCounts: response.tags.reduce<Record<string, number>>((acc, row) => {
        const normalizedTag = normalizeTagQuery(row.tag)
        if (!normalizedTag) return acc
        acc[normalizedTag] = Number.isFinite(row.count) ? row.count : 0
        return acc
      }, {}),
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
}: ExplorePostsParams = {}): Promise<ExplorePostsPage> => {
  const fallbackPageNumber = toValidPage(page)
  const fallbackPageSize = toValidPageSize(pageSize)
  const response = await apiFetch<PageDto<ApiPostDto>>(
    (() => {
      const endpoint = buildExplorePath({
        kw,
        tag,
        order,
        sortMode,
        page,
        pageSize,
      })
      recordRuntimeEndpoint(endpoint, "page")
      return endpoint
    })(),
    {
      signal,
    }
  )
  return toPostsPageResult(response, fallbackPageNumber, fallbackPageSize, "page")
}

export const getFeedPostsPage = async ({
  order = "desc",
  sortMode = "latest",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: Pick<ExplorePostsParams, "order" | "sortMode" | "page" | "pageSize" | "signal"> = {}): Promise<ExplorePostsPage> => {
  const fallbackPageNumber = toValidPage(page)
  const fallbackPageSize = toValidPageSize(pageSize)
  const response = await apiFetch<PageDto<ApiPostDto>>(
    (() => {
      const endpoint = buildFeedPath({
        order,
        sortMode,
        page,
        pageSize,
      })
      recordRuntimeEndpoint(endpoint, "page")
      return endpoint
    })(),
    {
      signal,
    }
  )

  return toPostsPageResult(response, fallbackPageNumber, fallbackPageSize, "page")
}

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
}): Promise<ExplorePostsPage> => {
  const safePageSize = toValidPageSize(pageSize)
  const normalizedCursor = typeof cursor === "string" && cursor.trim() ? cursor.trim() : undefined
  const response = await apiFetch<CursorPageDto<ApiPostDto>>(
    (() => {
      const endpoint = buildFeedCursorPath({
        order,
        sortMode,
        pageSize: safePageSize,
        cursor: normalizedCursor,
      })
      recordRuntimeEndpoint(endpoint, "cursor")
      return endpoint
    })(),
    {
      signal,
    }
  )

  return toPostsCursorPageResult(response, safePageSize)
}

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
}): Promise<ExplorePostsPage> => {
  const safePageSize = toValidPageSize(pageSize)
  const normalizedCursor = typeof cursor === "string" && cursor.trim() ? cursor.trim() : undefined
  const response = await apiFetch<CursorPageDto<ApiPostDto>>(
    (() => {
      const endpoint = buildExploreCursorPath({
        tag,
        order,
        sortMode,
        pageSize: safePageSize,
        cursor: normalizedCursor,
      })
      recordRuntimeEndpoint(endpoint, "cursor")
      return endpoint
    })(),
    {
      signal,
    }
  )

  return toPostsCursorPageResult(response, safePageSize)
}

export const getSearchPostsPage = async ({
  kw = "",
  order = "desc",
  sortMode = "latest",
  page = 1,
  pageSize = PAGE_SIZE,
  signal,
}: ExplorePostsParams = {}): Promise<ExplorePostsPage> => {
  const fallbackPageNumber = toValidPage(page)
  const fallbackPageSize = toValidPageSize(pageSize)
  const response = await apiFetch<PageDto<ApiPostDto>>(
    (() => {
      const endpoint = buildSearchPath({
        kw,
        order,
        sortMode,
        page,
        pageSize,
      })
      recordRuntimeEndpoint(endpoint, "page")
      return endpoint
    })(),
    {
      signal,
    }
  )
  return toPostsPageResult(response, fallbackPageNumber, fallbackPageSize)
}

export const getTagCounts = async (): Promise<Record<string, number>> => {
  const rows = await apiFetch<ApiTagCountDto[]>(POSTS_TAGS_API_PATH)
  return rows.reduce<Record<string, number>>((acc, row) => {
    const normalizedTag = normalizeTagQuery(row.tag)
    if (!normalizedTag) return acc
    acc[normalizedTag] = Number.isFinite(row.count) ? row.count : 0
    return acc
  }, {})
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

export const getPosts = async (
  { throwOnError = false }: GetPostsOptions = {}
): Promise<TPost[]> => {
  const now = Date.now()
  if (isServerRuntime && postsCache && now - postsCacheAt < POSTS_CACHE_TTL_MS) {
    return postsCache
  }

  if (pendingPostsPromise) {
    return pendingPostsPromise
  }

  try {
    pendingPostsPromise = (async () => {
      const feedItems = await getFeedPosts({ page: 1, pageSize: PAGE_SIZE })

      if (isServerRuntime) {
        postsCache = feedItems
        postsCacheAt = Date.now()
      }

      return feedItems
    })()

    return await pendingPostsPromise
  } catch (error) {
    if (!throwOnError && isServerRuntime && postsCache) {
      return postsCache
    }

    if (process.env.NODE_ENV !== "production") {
      // 로그 위변조(CWE-117) 방지를 위해 사용자/원격 입력(error.message/url/body)은 로그에 포함하지 않는다.
      if (error instanceof ApiError) {
        console.error("[getPosts] backend request failed: api-status")
      } else if (isAbortError(error)) {
        console.error("[getPosts] backend request failed: abort")
      } else if (error instanceof Error) {
        console.error("[getPosts] backend request failed: runtime")
      } else {
        console.error("[getPosts] backend request failed: unknown")
      }
    }
    if (throwOnError) throw error
    return []
  } finally {
    pendingPostsPromise = null
  }
}
