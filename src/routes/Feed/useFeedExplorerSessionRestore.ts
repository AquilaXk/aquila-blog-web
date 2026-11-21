import { type InfiniteData, useQueryClient } from "@tanstack/react-query"
import type { NextRouter } from "next/router"
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ExplorePostsPage } from "src/apis/backend/posts"
import { FEED_EXPLORE_PAGE_SIZE } from "src/constants/feed"
import { normalizeKeywordQuery, normalizeTagQuery } from "src/libs/query/normalize"
import {
  FEED_EXPLORER_ORDER,
  FEED_EXPLORER_SCROLL_BUCKET_PX,
  FEED_EXPLORER_SNAPSHOT_MAX_BYTES,
  getFeedExplorerCursorKey,
  getFeedExplorerRestoreKey,
  getFeedExplorerSnapshotKey,
  isCursorOnlyPublicFeedRestoreSnapshot,
  parseFeedExplorerCursorScrollY,
  parseFeedExplorerRestoreSnapshot,
  parseFeedExplorerRestoreState,
  pruneFeedExplorerStateStorage,
  resolveRestorePageCap,
  resolveSnapshotPageCap,
  scheduleIdleRevalidate,
  shouldRestoreFeedExplorerSession,
  toFeedExplorerInfiniteQueryKey,
  toRestoredPage,
  toRestoredPageParams,
  toSnapshotPage,
  toSnapshotPageParam,
  type FeedExplorerRestoreSnapshot,
  type FeedExplorerRestoreState,
  type FeedExplorerSnapshotPage,
  type FeedExplorerSnapshotPageParam,
} from "./FeedExplorerRestoreModel"
import type { FeedSortMode } from "./FeedSortMenuModel"

type UseFeedExplorerSessionRestoreOptions = {
  currentTag: string | undefined
  fetchNextPage: () => Promise<unknown>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isInitialLoading: boolean
  loadedPagesCount: number
  normalizedQuery: string
  q: string
  router: NextRouter
  setQ: Dispatch<SetStateAction<string>>
  setSortMode?: Dispatch<SetStateAction<FeedSortMode>>
  sortMode: FeedSortMode
}

type UseFeedExplorerSessionRestoreResult = {
  hasRestoredScrollRef: MutableRefObject<boolean>
  restoreScrollY: number
  restoreStateRef: MutableRefObject<FeedExplorerRestoreState | null>
}

const safeGetSessionItem = (key: string): string | null => {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSetSessionItem = (key: string, value: string): boolean => {
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const safeRemoveSessionItem = (key: string): void => {
  try {
    window.sessionStorage.removeItem(key)
  } catch {}
}

export const shouldApplyRestoredFeedSession = (
  restored: FeedExplorerRestoreState | null,
  routerQuery: Record<string, unknown>,
  currentTag: string
): boolean => {
  if (!restored || restored.tag !== currentTag) return false

  if ("q" in routerQuery && routerQuery.q !== undefined) {
    const rawRouteQ = typeof routerQuery.q === "string" ? routerQuery.q.trim() : ""
    const normalizedRouteQ = normalizeKeywordQuery(rawRouteQ)
    if (restored.q !== normalizedRouteQ) return false
  }

  const routeSort = routerQuery.sort
  if (routeSort === "latest" || routeSort === "views" || routeSort === "likes") {
    if ((restored.sortMode ?? "latest") !== routeSort) return false
  }

  return true
}

const writeSnapshotPagesToSessionStorage = (
  snapshotKey: string,
  savedAt: number,
  queryData: InfiniteData<ExplorePostsPage> | undefined
) => {
  const pages = queryData?.pages ?? []
  if (pages.length === 0) {
    safeRemoveSessionItem(snapshotKey)
    return
  }

  const snapshotPages = pages.slice(0, resolveSnapshotPageCap()).map(toSnapshotPage)
  const snapshotPageParams = (queryData?.pageParams ?? [])
    .slice(0, snapshotPages.length)
    .map(toSnapshotPageParam)
  const snapshotPayload: FeedExplorerRestoreSnapshot = {
    savedAt,
    pages: snapshotPages,
    ...(snapshotPageParams.length === snapshotPages.length ? { pageParams: snapshotPageParams } : {}),
  }
  const snapshotJson = JSON.stringify(snapshotPayload)
  if (snapshotJson.length <= FEED_EXPLORER_SNAPSHOT_MAX_BYTES) {
    safeSetSessionItem(snapshotKey, snapshotJson)
  } else {
    safeRemoveSessionItem(snapshotKey)
  }
}

export const useFeedExplorerSessionRestore = ({
  currentTag,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  loadedPagesCount,
  normalizedQuery,
  q,
  router,
  setQ,
  setSortMode,
  sortMode,
}: UseFeedExplorerSessionRestoreOptions): UseFeedExplorerSessionRestoreResult => {
  const queryClient = useQueryClient()
  const restoreStateRef = useRef<FeedExplorerRestoreState | null>(null)
  const restoreQueryPagesRef = useRef<FeedExplorerSnapshotPage[] | null>(null)
  const restoreQueryPageParamsRef = useRef<FeedExplorerSnapshotPageParam[] | null>(null)
  const hasHydratedQuerySnapshotRef = useRef(false)
  const hasAppliedRestoreSnapshotRef = useRef(false)
  const hasScheduledIdleRevalidateRef = useRef(false)
  const restoreTargetPagesRef = useRef(1)
  const hasInitializedRestoreRef = useRef(false)
  const [restoreScrollY, setRestoreScrollY] = useState(0)
  const hasRestoredScrollRef = useRef(false)
  const lastStructureFingerprintRef = useRef("")
  const lastScrollBucketRef = useRef(-1)
  const initializedAsPathRef = useRef<string | null>(null)
  const cancelIdlePersistRef = useRef<(() => void) | null>(null)
  const restoreSnapshotRef = useRef({
    q: "",
    tag: "",
    loadedPagesCount: 1,
  })

  const restoreStorageKey = useMemo(
    () => getFeedExplorerRestoreKey(currentTag || "", FEED_EXPLORE_PAGE_SIZE, FEED_EXPLORER_ORDER, sortMode),
    [currentTag, sortMode]
  )
  const restoreSnapshotStorageKey = useMemo(
    () => getFeedExplorerSnapshotKey(restoreStorageKey),
    [restoreStorageKey]
  )

  useEffect(() => {
    restoreSnapshotRef.current = {
      q,
      tag: currentTag || "",
      loadedPagesCount: Math.max(1, loadedPagesCount),
    }
  }, [currentTag, loadedPagesCount, q])

  useEffect(() => {
    if (!router.isReady) return
    if (initializedAsPathRef.current && initializedAsPathRef.current !== router.asPath) {
      restoreStateRef.current = null
      restoreQueryPagesRef.current = null
      restoreQueryPageParamsRef.current = null
      hasRestoredScrollRef.current = true
      setRestoreScrollY(0)
      initializedAsPathRef.current = router.asPath
    }
  }, [router.asPath, router.isReady])

  useEffect(() => {
    if (!router.isReady || hasInitializedRestoreRef.current) return
    if (typeof window === "undefined") return

    hasInitializedRestoreRef.current = true
    initializedAsPathRef.current = router.asPath
    try {
      pruneFeedExplorerStateStorage(window.sessionStorage)
    } catch {}

    let resolvedRestoreKey = restoreStorageKey
    let restored = parseFeedExplorerRestoreState(safeGetSessionItem(resolvedRestoreKey))
    const hasExplicitRouteSort =
      router.query.sort === "latest" || router.query.sort === "views" || router.query.sort === "likes"
    if (!hasExplicitRouteSort) {
      const sortCandidates: FeedSortMode[] = ["latest", "views", "likes"]
      for (const candidateSort of sortCandidates) {
        const candidateKey = getFeedExplorerRestoreKey(
          currentTag || "",
          FEED_EXPLORE_PAGE_SIZE,
          FEED_EXPLORER_ORDER,
          candidateSort
        )
        const candidateState = parseFeedExplorerRestoreState(safeGetSessionItem(candidateKey))
        if (
          candidateState &&
          candidateState.tag === (currentTag || "") &&
          (!restored || candidateState.savedAt > restored.savedAt)
        ) {
          restored = candidateState
          resolvedRestoreKey = candidateKey
        }
      }
    }
    if (!shouldApplyRestoredFeedSession(restored, router.query, currentTag || "")) return
    if (!restored) return

    const cursorEntry = parseFeedExplorerCursorScrollY(
      safeGetSessionItem(getFeedExplorerCursorKey(resolvedRestoreKey))
    )
    const effectiveScrollY =
      cursorEntry && cursorEntry.savedAt >= restored.savedAt ? cursorEntry.scrollY : restored.scrollY
    const effectiveRestored: FeedExplorerRestoreState = {
      ...restored,
      scrollY: effectiveScrollY,
    }

    restoreStateRef.current = effectiveRestored
    setRestoreScrollY(effectiveScrollY)
    restoreTargetPagesRef.current = Math.min(resolveRestorePageCap(), Math.max(1, restored.loadedPages))
    const hasExplicitRouteQ = "q" in router.query && router.query.q !== undefined
    if (restored.q.length > 0 && !hasExplicitRouteQ) {
      setQ(restored.q)
    }
    if (restored.sortMode && !hasExplicitRouteSort) {
      setSortMode?.(restored.sortMode)
    }

    const restoredSnapshot = parseFeedExplorerRestoreSnapshot(
      safeGetSessionItem(getFeedExplorerSnapshotKey(resolvedRestoreKey))
    )
    if (
      restoredSnapshot?.pages?.length &&
      (restored.q.length > 0 || isCursorOnlyPublicFeedRestoreSnapshot(restoredSnapshot))
    ) {
      const restoredPages = restoredSnapshot.pages.slice(0, resolveSnapshotPageCap())
      const restoredPageParams = toRestoredPageParams({
        ...restoredSnapshot,
        pages: restoredPages,
        pageParams: restoredSnapshot.pageParams?.slice(0, restoredPages.length),
      })
      restoreQueryPagesRef.current = restoredPages
      restoreQueryPageParamsRef.current = restoredPageParams
    }
  }, [
    currentTag,
    q,
    restoreSnapshotStorageKey,
    restoreStorageKey,
    router.asPath,
    router.isReady,
    router.query,
    setQ,
    setSortMode,
  ])

  useEffect(() => {
    if (hasHydratedQuerySnapshotRef.current) return

    const restored = restoreStateRef.current
    const restoredPages = restoreQueryPagesRef.current
    if (!restored || !restoredPages || restoredPages.length === 0) return

    const activeTag = currentTag || ""
    if (restored.tag !== activeTag || restored.q !== normalizedQuery) return
    if (!shouldRestoreFeedExplorerSession(sortMode)) return

    const restoreQueryKey = toFeedExplorerInfiniteQueryKey({
      kw: normalizedQuery,
      tag: activeTag,
      pageSize: FEED_EXPLORE_PAGE_SIZE,
      order: FEED_EXPLORER_ORDER,
      sortMode,
    })

    const existingPages = queryClient.getQueryData<InfiniteData<ExplorePostsPage>>(restoreQueryKey)?.pages
    if (existingPages && existingPages.length > 0) {
      hasHydratedQuerySnapshotRef.current = true
      return
    }

    queryClient.setQueryData<InfiniteData<ExplorePostsPage>>(restoreQueryKey, {
      pages: restoredPages.map(toRestoredPage),
      pageParams:
        restoreQueryPageParamsRef.current?.length === restoredPages.length
          ? restoreQueryPageParamsRef.current
          : toRestoredPageParams({ savedAt: restored.savedAt, pages: restoredPages }),
    })
    hasHydratedQuerySnapshotRef.current = true
    hasAppliedRestoreSnapshotRef.current = true
  }, [currentTag, normalizedQuery, queryClient, sortMode])

  useEffect(() => {
    if (
      hasScheduledIdleRevalidateRef.current ||
      !hasAppliedRestoreSnapshotRef.current ||
      !restoreQueryPagesRef.current?.length ||
      !shouldRestoreFeedExplorerSession(sortMode)
    ) {
      return
    }

    const restored = restoreStateRef.current
    const activeTag = currentTag || ""
    if (restored?.tag !== activeTag || restored.q !== normalizedQuery) return

    const restoreQueryKey = toFeedExplorerInfiniteQueryKey({
      kw: normalizedQuery,
      tag: activeTag,
      pageSize: FEED_EXPLORE_PAGE_SIZE,
      order: FEED_EXPLORER_ORDER,
      sortMode,
    })

    hasScheduledIdleRevalidateRef.current = true
    return scheduleIdleRevalidate(() => {
      void queryClient.invalidateQueries({
        queryKey: restoreQueryKey,
        exact: true,
        refetchType: "active",
      })
    })
  }, [currentTag, normalizedQuery, queryClient, sortMode])

  const persistFeedExplorerState = useCallback(() => {
    if (typeof window === "undefined" || !shouldRestoreFeedExplorerSession(sortMode)) return

    const snapshot = restoreSnapshotRef.current
    const normalizedSnapshotTag = normalizeTagQuery(snapshot.tag)
    const normalizedSnapshotQuery = normalizeKeywordQuery(snapshot.q)
    const restoreKey = getFeedExplorerRestoreKey(
      normalizedSnapshotTag,
      FEED_EXPLORE_PAGE_SIZE,
      FEED_EXPLORER_ORDER,
      sortMode
    )
    const snapshotKey = getFeedExplorerSnapshotKey(restoreKey)
    const cursorKey = getFeedExplorerCursorKey(restoreKey)
    const scrollY = Math.max(0, Math.trunc(window.scrollY || 0))
    const loadedPages = Math.max(1, snapshot.loadedPagesCount)
    const scrollBucket = Math.trunc(scrollY / FEED_EXPLORER_SCROLL_BUCKET_PX)
    const structureFingerprint = `${normalizedSnapshotQuery}\u0000${normalizedSnapshotTag}\u0000${loadedPages}\u0000${sortMode}`

    if (
      lastStructureFingerprintRef.current === structureFingerprint &&
      lastScrollBucketRef.current === scrollBucket
    ) {
      return
    }

    const savedAt = Date.now()
    if (lastStructureFingerprintRef.current === structureFingerprint) {
      safeSetSessionItem(cursorKey, JSON.stringify({ scrollY, savedAt }))
      lastScrollBucketRef.current = scrollBucket
      return
    }

    const state: FeedExplorerRestoreState = {
      q: normalizedSnapshotQuery,
      tag: normalizedSnapshotTag,
      scrollY,
      loadedPages,
      savedAt,
      sortMode,
    }
    safeSetSessionItem(restoreKey, JSON.stringify(state))
    safeSetSessionItem(cursorKey, JSON.stringify({ scrollY, savedAt }))
    lastStructureFingerprintRef.current = structureFingerprint
    lastScrollBucketRef.current = scrollBucket

    const feedQueryKey = toFeedExplorerInfiniteQueryKey({
      kw: normalizedSnapshotQuery,
      tag: normalizedSnapshotTag,
      pageSize: FEED_EXPLORE_PAGE_SIZE,
      order: FEED_EXPLORER_ORDER,
      sortMode,
    })
    const queryData = queryClient.getQueryData<InfiniteData<ExplorePostsPage>>(feedQueryKey)
    writeSnapshotPagesToSessionStorage(snapshotKey, savedAt, queryData)
    try {
      pruneFeedExplorerStateStorage(window.sessionStorage)
    } catch {}
  }, [queryClient, sortMode])

  const persistScrollCursorOnly = useCallback(() => {
    if (typeof window === "undefined" || !shouldRestoreFeedExplorerSession(sortMode)) return
    const snapshot = restoreSnapshotRef.current
    const normalizedSnapshotTag = normalizeTagQuery(snapshot.tag)
    const scrollY = Math.max(0, Math.trunc(window.scrollY || 0))
    const scrollBucket = Math.trunc(scrollY / FEED_EXPLORER_SCROLL_BUCKET_PX)
    if (lastScrollBucketRef.current === scrollBucket) return
    const restoreKey = getFeedExplorerRestoreKey(
      normalizedSnapshotTag,
      FEED_EXPLORE_PAGE_SIZE,
      FEED_EXPLORER_ORDER,
      sortMode
    )
    safeSetSessionItem(
      getFeedExplorerCursorKey(restoreKey),
      JSON.stringify({ scrollY, savedAt: Date.now() })
    )
    lastScrollBucketRef.current = scrollBucket
  }, [sortMode])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return

    let scrollTimerId: number | null = null
    const flushPersist = () => {
      if (scrollTimerId !== null) {
        window.clearTimeout(scrollTimerId)
        scrollTimerId = null
      }
      if (cancelIdlePersistRef.current) {
        cancelIdlePersistRef.current()
        cancelIdlePersistRef.current = null
      }
      persistFeedExplorerState()
    }

    const handleScroll = () => {
      if (scrollTimerId !== null) {
        window.clearTimeout(scrollTimerId)
      }
      scrollTimerId = window.setTimeout(() => {
        scrollTimerId = null
        persistScrollCursorOnly()
      }, 180)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersist()
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("pagehide", flushPersist)
    window.addEventListener("beforeunload", flushPersist)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    router.events.on("routeChangeStart", flushPersist)

    return () => {
      if (scrollTimerId !== null) {
        window.clearTimeout(scrollTimerId)
      }
      if (cancelIdlePersistRef.current) {
        cancelIdlePersistRef.current()
        cancelIdlePersistRef.current = null
      }
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("pagehide", flushPersist)
      window.removeEventListener("beforeunload", flushPersist)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      router.events.off("routeChangeStart", flushPersist)
    }
  }, [persistFeedExplorerState, persistScrollCursorOnly, router.events])

  useEffect(() => {
    if (!shouldRestoreFeedExplorerSession(sortMode)) return

    const restoreState = restoreStateRef.current
    if (!restoreState || hasRestoredScrollRef.current) return
    if (restoreState.tag !== (currentTag || "") || restoreState.q !== normalizedQuery) return

    const targetPages = restoreTargetPagesRef.current
    if (loadedPagesCount < targetPages && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
      return
    }

    if (isInitialLoading) return

    hasRestoredScrollRef.current = true
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: restoreState.scrollY,
        behavior: "auto",
      })
    })
  }, [
    currentTag,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isInitialLoading,
    loadedPagesCount,
    normalizedQuery,
    sortMode,
  ])

  return {
    hasRestoredScrollRef,
    restoreScrollY,
    restoreStateRef,
  }
}
