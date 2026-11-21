// 참조 구현: jackyzha0/quartz (MIT) & fuma-nama/fumadocs (MIT) — 관련·이전·다음 글 캐시 조회 및 지연 로딩
import { useEffect, useMemo, useState, type RefObject } from "react"
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query"
import {
  getAdjacentPosts,
  getExplorePostsPage,
  getRelatedPostsByAuthor,
  type ExplorePostsPage,
} from "src/apis/backend/posts"
import { queryKey } from "src/constants/queryKey"
import type { PostDetail as PostDetailType } from "src/types"
import { isEligibleForAdjacentLookup, resolveAdjacentPosts } from "./PostDetailNavigationModel"

const RELATED_QUERY_PREFETCH_ROOT_MARGIN = "900px 0px"
const RELATED_QUERY_IDLE_TIMEOUT_MS = 1200
const RELATED_POSTS_LIMIT = 4

type UsePostDetailRelatedPostsArgs = {
  data?: PostDetailType
  prefetchTriggerRef: RefObject<HTMLDivElement | null>
}

export const usePostDetailRelatedPosts = ({ data, prefetchTriggerRef }: UsePostDetailRelatedPostsArgs) => {
  const queryClient = useQueryClient()
  const [shouldFetchRelated, setShouldFetchRelated] = useState(false)
  const detailType = data?.type?.[0] ?? "Post"
  const eligibleForAdjacent = isEligibleForAdjacentLookup(detailType, data?.id)
  const relatedTag = useMemo(() => {
    const tags = data?.tags
    if (!tags) return ""
    for (const rawTag of tags) {
      const primaryTag = rawTag.trim()
      if (primaryTag && primaryTag.toLowerCase() !== "pinned") {
        return primaryTag
      }
    }
    return ""
  }, [data?.tags])
  const authorId = useMemo(
    () => (typeof data?.authorId === "number" ? String(data.authorId) : data?.author?.[0]?.id || ""),
    [data?.authorId, data?.author]
  )

  const relatedByTagQuery = useQuery({
    queryKey: queryKey.postsExplore({
      kw: "",
      tag: relatedTag || undefined,
      order: "desc",
      page: 1,
      pageSize: 10,
    }),
    queryFn: () =>
      getExplorePostsPage({
        kw: "",
        tag: relatedTag,
        order: "desc",
        page: 1,
        pageSize: 10,
      }),
    enabled: Boolean(shouldFetchRelated && relatedTag && data?.id),
    staleTime: 300_000,
    retry: 1,
  })

  const relatedByAuthorQuery = useQuery({
    queryKey: queryKey.postsRelatedByAuthor({
      authorId: authorId || "none",
      excludePostId: data?.id ? String(data.id) : undefined,
      limit: RELATED_POSTS_LIMIT,
    }),
    queryFn: () =>
      getRelatedPostsByAuthor({
        authorId,
        excludePostId: data?.id ? String(data.id) : undefined,
        limit: RELATED_POSTS_LIMIT,
      }),
    enabled: Boolean(shouldFetchRelated && authorId && data?.id),
    staleTime: 300_000,
    retry: 1,
  })

  const cachedFeedPosts = useMemo(() => {
    if (!eligibleForAdjacent) return []
    const cachedQueries = queryClient.getQueriesData<InfiniteData<ExplorePostsPage>>({
      queryKey: ["posts", "feed", "infinite"],
    })
    for (const [, infiniteData] of cachedQueries) {
      if (!infiniteData?.pages?.length) continue
      const flattened = infiniteData.pages.flatMap((page) => page.posts || [])
      const targetId = String(data?.id ?? "")
      if (flattened.some((post) => String(post.id) === targetId)) {
        return flattened
      }
    }
    return []
  }, [data?.id, eligibleForAdjacent, queryClient])

  const hasCurrentInCachedFeed = cachedFeedPosts.length > 0

  const adjacentPostsQuery = useQuery({
    queryKey: ["posts", "detail", "adjacent", String(data?.id ?? "")] as const,
    queryFn: ({ signal }) => getAdjacentPosts(data!.id, signal),
    enabled: Boolean(shouldFetchRelated && eligibleForAdjacent && !hasCurrentInCachedFeed && data?.id),
    staleTime: 300_000,
    retry: 1,
  })

  const adjacentPosts = useMemo(() => {
    if (!eligibleForAdjacent || !data?.id) {
      return { previousPost: null, nextPost: null }
    }
    const targetId = String(data.id)
    if (hasCurrentInCachedFeed) {
      return resolveAdjacentPosts(cachedFeedPosts, targetId)
    }
    if (adjacentPostsQuery.data) {
      return {
        previousPost: adjacentPostsQuery.data.previous,
        nextPost: adjacentPostsQuery.data.next,
      }
    }
    return { previousPost: null, nextPost: null }
  }, [
    adjacentPostsQuery.data,
    cachedFeedPosts,
    data?.id,
    eligibleForAdjacent,
    hasCurrentInCachedFeed,
  ])

  const relatedByTagPosts = useMemo(() => {
    const posts = relatedByTagQuery.data?.posts
    if (!posts || posts.length === 0) return []
    const currentPostId = String(data?.id || "")
    const filtered: typeof posts = []
    for (const post of posts) {
      if (String(post.id) !== currentPostId) {
        filtered.push(post)
        if (filtered.length >= RELATED_POSTS_LIMIT) break
      }
    }
    return filtered
  }, [data?.id, relatedByTagQuery.data?.posts])

  const relatedByAuthorPosts = useMemo(() => relatedByAuthorQuery.data || [], [relatedByAuthorQuery.data])
  const showRelatedTagSkeleton = Boolean(
    shouldFetchRelated && detailType === "Post" && relatedTag && relatedByTagQuery.isPending
  )
  const showRelatedAuthorSkeleton = Boolean(
    shouldFetchRelated && detailType === "Post" && authorId && relatedByAuthorQuery.isPending
  )

  useEffect(() => {
    setShouldFetchRelated(false)
  }, [data?.id, detailType])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!data?.id || detailType !== "Post" || shouldFetchRelated) return

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (id: number) => void
    }

    let disposed = false
    let observer: IntersectionObserver | null = null

    const activateRelatedFetch = () => {
      if (!disposed) setShouldFetchRelated(true)
    }

    const triggerNode = prefetchTriggerRef.current
    if (triggerNode && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer?.disconnect()
          activateRelatedFetch()
        },
        {
          root: null,
          rootMargin: RELATED_QUERY_PREFETCH_ROOT_MARGIN,
          threshold: 0.01,
        }
      )
      observer.observe(triggerNode)
    }

    let cancelIdle: () => void
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(activateRelatedFetch, {
        timeout: RELATED_QUERY_IDLE_TIMEOUT_MS,
      })
      cancelIdle = () => idleWindow.cancelIdleCallback?.(id)
    } else {
      const id = window.setTimeout(activateRelatedFetch, RELATED_QUERY_IDLE_TIMEOUT_MS)
      cancelIdle = () => window.clearTimeout(id)
    }

    return () => {
      disposed = true
      observer?.disconnect()
      cancelIdle()
    }
  }, [data?.id, detailType, prefetchTriggerRef, shouldFetchRelated])

  return {
    adjacentPosts,
    relatedByAuthorPosts,
    relatedByTagPosts,
    shouldFetchRelated,
    showRelatedAuthorSkeleton,
    showRelatedTagSkeleton,
  }
}
