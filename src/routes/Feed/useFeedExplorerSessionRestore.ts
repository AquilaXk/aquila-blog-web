import { type InfiniteData, useQueryClient } from "@tanstack/react-query"
import type { NextRouter } from "next/router"
import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback, useEffect, useMemo, useRef } from "react"
import type { ExplorePostsPage } from "src/apis/backend/posts"
import { FEED_EXPLORE_PAGE_SIZE } from "src/constants/feed"
import { normalizeKeywordQuery, normalizeTagQuery } from "src/libs/query/normalize"
import {
  FEED_EXPLORER_ORDER,
  FEED_EXPLORER_SNAPSHOT_MAX_BYTES,
  getFeedExplorerRestoreKey,
  getFeedExplorerSnapshotKey,
  isCursorOnlyPublicFeedRestoreSnapshot,
  parseFeedExplorerRestoreSnapshot,
  parseFeedExplorerRestoreState,
  pruneFeedExplorerStateStorage,
  resolveRestorePageCap,
  resolveSnapshotPageCap,
  scheduleIdleRevalidate,
  shouldRestoreFeedExplorerSession,
  toFeedExplorerInfiniteQueryKey,
  toPersistFingerprint,
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
  sortMode: FeedSortMode
}

type UseFeedExplorerSessionRestoreResult = {
  hasRestoredScrollRef: MutableRefObject<boolean>
  restoreStateRef: MutableRefObject<FeedExplorerRestoreState | null>
}

const writeSnapshotPagesToSessionStorage = (
  snapshotKey: string,
  savedAt: number,
  queryData: InfiniteData<ExplorePostsPage> | undefined
) => {
  const pages = queryData?.pages ?? []
  if (pages.length === 0) {
    window.sessionStorage.removeItem(snapshotKey)
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
    window.sessionStorage.setItem(snapshotKey, snapshotJson)
  } else {
    window.sessionStorage.removeItem(snapshotKey)
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
  const hasRestoredScrollRef = useRef(false)
  const lastPersistFingerprintRef = useRef("")
  const cancelIdlePersistRef = useRef<(() => void) | null>(null)
  const restoreSnapshotRef = useRef({
    q: "",
    tag: "",
    loadedPagesCount: 1,
  })

  const restoreStorageKey = useMemo(
    () => getFeedExplorerRestoreKey(currentTag || "", FEED_EXPLORE_PAGE_SIZE, FEED_EXPLORER_ORDER),
    [currentTag]
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
    if (!router.isReady || hasInitializedRestoreRef.current) return
    if (typeof window === "undefined") return

    hasInitializedRestoreRef.current = true
    pruneFeedExplorerStateStorage(window.sessionStorage)

    const restored = parseFeedExplorerRestoreState(window.sessionStorage.getItem(restoreStorageKey))
    if (!restored || restored.tag !== (currentTag || "")) return

    restoreStateRef.current = restored
    restoreTargetPagesRef.current = Math.min(resolveRestorePageCap(), Math.max(1, restored.loadedPages))
    if (restored.q.length > 0) {
      setQ(restored.q)
    }

    const restoredSnapshot = parseFeedExplorerRestoreSnapshot(
      window.sessionStorage.getItem(restoreSnapshotStorageKey)
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
  }, [currentTag, q, restoreSnapshotStorageKey, restoreStorageKey, router.isReady, setQ])

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
      sortMode: "latest",
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
    if (!restored || restored.tag !== activeTag || restored.q !== normalizedQuery) return

    const restoreQueryKey = toFeedExplorerInfiniteQueryKey({
      kw: normalizedQuery,
      tag: activeTag,
      pageSize: FEED_EXPLORE_PAGE_SIZE,
      order: FEED_EXPLORER_ORDER,
      sortMode: "latest",
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
      FEED_EXPLORER_ORDER
    )
    const snapshotKey = getFeedExplorerSnapshotKey(restoreKey)
    const state: FeedExplorerRestoreState = {
      q: normalizedSnapshotQuery,
      tag: normalizedSnapshotTag,
      scrollY: Math.max(0, Math.trunc(window.scrollY || 0)),
      loadedPages: Math.max(1, snapshot.loadedPagesCount),
      savedAt: Date.now(),
    }
    const persistFingerprint = toPersistFingerprint(state)
    if (lastPersistFingerprintRef.current === persistFingerprint) {
      return
    }

    try {
      window.sessionStorage.setItem(restoreKey, JSON.stringify(state))
      lastPersistFingerprintRef.current = persistFingerprint

      const feedQueryKey = toFeedExplorerInfiniteQueryKey({
        kw: normalizedSnapshotQuery,
        tag: normalizedSnapshotTag,
        pageSize: FEED_EXPLORE_PAGE_SIZE,
        order: FEED_EXPLORER_ORDER,
        sortMode: "latest",
      })
      const queryData = queryClient.getQueryData<InfiniteData<ExplorePostsPage>>(feedQueryKey)
      writeSnapshotPagesToSessionStorage(snapshotKey, state.savedAt, queryData)
      pruneFeedExplorerStateStorage(window.sessionStorage)
    } catch {
      // ignore sessionStorage quota/permission errors
    }
  }, [queryClient, sortMode])

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return

    const flushPersist = () => {
      if (cancelIdlePersistRef.current) {
        cancelIdlePersistRef.current()
        cancelIdlePersistRef.current = null
      }
      persistFeedExplorerState()
    }
    const scheduleIdlePersist = () => {
      if (cancelIdlePersistRef.current) return
      cancelIdlePersistRef.current = scheduleIdleRevalidate(() => {
        cancelIdlePersistRef.current = null
        persistFeedExplorerState()
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersist()
      }
    }

    window.addEventListener("pagehide", flushPersist)
    window.addEventListener("beforeunload", flushPersist)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    router.events.on("routeChangeStart", scheduleIdlePersist)

    return () => {
      if (cancelIdlePersistRef.current) {
        cancelIdlePersistRef.current()
        cancelIdlePersistRef.current = null
      }
      window.removeEventListener("pagehide", flushPersist)
      window.removeEventListener("beforeunload", flushPersist)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      router.events.off("routeChangeStart", scheduleIdlePersist)
    }
  }, [persistFeedExplorerState, router.events])

  useEffect(() => {
    if (!shouldRestoreFeedExplorerSession(sortMode)) return

    const restoreState = restoreStateRef.current
    if (!restoreState || hasRestoredScrollRef.current) return

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
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isInitialLoading,
    loadedPagesCount,
    sortMode,
  ])

  return {
    hasRestoredScrollRef,
    restoreStateRef,
  }
}
