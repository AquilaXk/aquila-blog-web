import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import SearchInput from "./SearchInput"
import PinnedPosts from "./PostList/PinnedPosts"
import PostList from "./PostList"
import TagList from "./TagList"
import useExplorePostsQuery from "src/hooks/useExplorePostsQuery"
import { useDebouncedValue } from "src/hooks/useDebouncedValue"
import { useRouter } from "next/router"
import { replaceShallowRoutePreservingScroll } from "src/libs/router"
import { FEED_EXPLORE_PAGE_SIZE } from "src/constants/feed"
import { normalizeKeywordQuery, normalizeOptionalTagQuery } from "src/libs/query/normalize"
import { useLanguage } from "src/libs/language"
import { ExplorerCard, FeedBody, FilterContextBar } from "./FeedExplorer.styles"
import { FEED_EXPLORER_ORDER, shouldRestoreFeedExplorerSession } from "./FeedExplorerRestoreModel"
import {
  FEED_SORT_OPTIONS,
  feedSortOptionId,
  resolveFeedSortListboxKeyDown,
  resolveFeedSortTriggerKeyDown,
  type FeedSortMode,
} from "./FeedSortMenuModel"
import { useFeedExplorerSessionRestore } from "./useFeedExplorerSessionRestore"

const LOAD_MORE_THROTTLE_MS = 800
const LOAD_MORE_OBSERVER_THROTTLE_MS = 180

type FeedExplorerProps = {
  initialBootstrapDegraded?: boolean
}

const resolveSortOptionLabel = (
  value: FeedSortMode,
  t: (key: "sortLatest" | "sortViews" | "sortLikes") => string
) => {
  if (value === "latest") return t("sortLatest")
  if (value === "views") return t("sortViews")
  return t("sortLikes")
}

const resolveFilterSummary = (normalizedQuery: string, currentTag: string | undefined) => {
  if (!normalizedQuery && !currentTag) return ""
  const parts: string[] = []
  if (normalizedQuery.length > 0) parts.push(`검색 "${normalizedQuery}"`)
  if (currentTag) parts.push(`태그 "${currentTag}"`)
  return parts.join(" · ")
}

const FeedExplorer: React.FC<FeedExplorerProps> = ({ initialBootstrapDegraded = false }) => {
  const { t } = useLanguage()
  const [q, setQ] = useState("")
  const [sortMode, setSortMode] = useState<FeedSortMode>("latest")
  const [sortOpen, setSortOpen] = useState(false)
  const [sortActiveIndex, setSortActiveIndex] = useState(0)
  const [isComposing, setIsComposing] = useState(false)
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const sortMenuRef = useRef<HTMLDivElement | null>(null)
  const sortTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sortListboxRef = useRef<HTMLDivElement | null>(null)

  const currentTag = normalizeOptionalTagQuery(
    typeof router.query.tag === "string" ? router.query.tag : undefined
  )
  const debouncedQ = useDebouncedValue(q, isComposing)
  const normalizedQuery = normalizeKeywordQuery(debouncedQ)
  const {
    pinnedPosts,
    regularPosts,
    loadedPagesCount,
    hasNextPage,
    isInitialLoading,
    isInitialLoadError,
    isRetainedDataError,
    hasInitialLoadSucceeded,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetchInitialPage,
  } = useExplorePostsQuery({
    kw: debouncedQ,
    tag: currentTag,
    pageSize: FEED_EXPLORE_PAGE_SIZE,
    order: FEED_EXPLORER_ORDER,
    sortMode,
    enabled: router.isReady,
  })
  const { hasRestoredScrollRef, restoreStateRef } = useFeedExplorerSessionRestore({
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
  })
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const lastLoadMoreAtRef = useRef(0)
  const lastObserverTriggerAtRef = useRef(0)
  const hasNextPageRef = useRef(hasNextPage)
  const isFetchingNextPageRef = useRef(isFetchingNextPage)
  const isFetchNextPageErrorRef = useRef(isFetchNextPageError)

  useEffect(() => {
    hasNextPageRef.current = hasNextPage
  }, [hasNextPage])

  useEffect(() => {
    isFetchingNextPageRef.current = isFetchingNextPage
  }, [isFetchingNextPage])

  useEffect(() => {
    isFetchNextPageErrorRef.current = isFetchNextPageError
  }, [isFetchNextPageError])

  const closeSortMenu = useCallback((restoreTriggerFocus: boolean) => {
    setSortOpen(false)
    if (!restoreTriggerFocus) return
    window.requestAnimationFrame(() => {
      sortTriggerRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    if (!sortOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (sortMenuRef.current?.contains(event.target as Node)) return
      closeSortMenu(true)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    const frameId = window.requestAnimationFrame(() => {
      sortListboxRef.current?.focus()
    })
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      window.cancelAnimationFrame(frameId)
    }
  }, [closeSortMenu, sortOpen])

  const handleLoadMore = useCallback(() => {
    if (isFetchNextPageErrorRef.current || !hasNextPageRef.current || isFetchingNextPageRef.current) return
    const now = Date.now()
    if (now - lastLoadMoreAtRef.current < LOAD_MORE_THROTTLE_MS) return
    lastLoadMoreAtRef.current = now
    void fetchNextPage()
  }, [fetchNextPage])
  const handleRetryLoadMore = useCallback(() => {
    if (!hasNextPageRef.current || isFetchingNextPageRef.current) return
    lastLoadMoreAtRef.current = 0
    void fetchNextPage()
  }, [fetchNextPage])
  const handleLoadMoreRef = useRef(handleLoadMore)

  useEffect(() => {
    handleLoadMoreRef.current = handleLoadMore
  }, [handleLoadMore])

  useEffect(() => {
    const target = loadMoreTriggerRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (isFetchNextPageErrorRef.current) return
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return
        const now = Date.now()
        if (now - lastObserverTriggerAtRef.current < LOAD_MORE_OBSERVER_THROTTLE_MS) return
        lastObserverTriggerAtRef.current = now
        handleLoadMoreRef.current()
      },
      {
        rootMargin: "220px 0px",
      }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  const hasFilter = Boolean(normalizedQuery || currentTag)
  const visiblePosts = resolveFeedVisiblePosts(pinnedPosts, regularPosts, isRetainedDataError)
  const resultCount = visiblePosts.pinnedPosts.length + visiblePosts.regularPosts.length
  const showBootstrapDegraded = initialBootstrapDegraded && !hasInitialLoadSucceeded
  const filterSummary = useMemo(
    () => resolveFilterSummary(normalizedQuery, currentTag),
    [currentTag, normalizedQuery]
  )

  const handleClearFilters = useCallback(() => {
    setQ("")
    if (!currentTag) return
    const { category: _deprecatedCategory, ...restQuery } = router.query
    startTransition(() => {
      void replaceShallowRoutePreservingScroll(router, {
        pathname: "/",
        query: {
          ...restQuery,
          tag: undefined,
        },
      })
    })
  }, [currentTag, router])
  const currentSortLabel = resolveSortOptionLabel(sortMode, t)

  const handleSortSelect = useCallback(
    (value: FeedSortMode) => {
      if (value !== sortMode) {
        // Drop restore intent so a deep latest scrollY is not reapplied after sort change,
        // and reset viewport so ranked/latest list swaps do not land on an empty region.
        if (!shouldRestoreFeedExplorerSession(value) || shouldRestoreFeedExplorerSession(sortMode)) {
          restoreStateRef.current = null
          hasRestoredScrollRef.current = true
        }
        window.scrollTo({ top: 0, behavior: "auto" })
      }
      setSortMode(value)
      closeSortMenu(true)
    },
    [closeSortMenu, hasRestoredScrollRef, restoreStateRef, sortMode]
  )

  const openSortMenu = useCallback((activeIndex: number) => {
    setSortActiveIndex(activeIndex)
    setSortOpen(true)
  }, [])

  const handleSortTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const result = resolveFeedSortTriggerKeyDown(event.key, FEED_SORT_OPTIONS, sortMode)
      if (result.type === "none") return
      event.preventDefault()
      if (result.type === "open") {
        openSortMenu(result.activeIndex)
      }
    },
    [openSortMenu, sortMode]
  )

  const handleSortListboxKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const result = resolveFeedSortListboxKeyDown(event.key, sortActiveIndex, FEED_SORT_OPTIONS)
      if (result.type === "none") return
      event.preventDefault()
      if (result.type === "close") {
        closeSortMenu(true)
        return
      }
      if (result.type === "move") {
        setSortActiveIndex(result.activeIndex)
        return
      }
      if (result.type === "select") {
        handleSortSelect(result.value)
      }
    },
    [closeSortMenu, handleSortSelect, sortActiveIndex]
  )

  const activeSortOptionId =
    sortActiveIndex >= 0 && sortActiveIndex < FEED_SORT_OPTIONS.length
      ? feedSortOptionId(FEED_SORT_OPTIONS[sortActiveIndex].value)
      : undefined

  return (
    <>
      <PinnedPosts posts={visiblePosts.pinnedPosts} />
      <FeedBody data-sticky-rail-safe="true">
        <aside className="tagColumn">
          <TagList />
        </aside>
        <section className="postColumn">
          <ExplorerCard>
            <div className="feedTitle">
              <h1 className="feedHeading">{t("recentPosts")}</h1>
            </div>
            <div className="searchSlot">
              <SearchInput
                inputRef={searchInputRef}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
              />
              <div className="sortDropdown" ref={sortMenuRef}>
                <button
                  type="button"
                  ref={sortTriggerRef}
                  className="sortTrigger"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  aria-controls="feed-sort-listbox"
                  aria-label={t("sortTriggerLabel")}
                  onClick={() => {
                    if (sortOpen) {
                      closeSortMenu(false)
                      return
                    }
                    const selectedIndex = Math.max(
                      0,
                      FEED_SORT_OPTIONS.findIndex((option) => option.value === sortMode)
                    )
                    openSortMenu(selectedIndex)
                  }}
                  onKeyDown={handleSortTriggerKeyDown}
                >
                  {currentSortLabel}
                  <span className="sortChevron" aria-hidden="true" />
                </button>
                {sortOpen && (
                  <div
                    id="feed-sort-listbox"
                    ref={sortListboxRef}
                    className="sortMenu"
                    role="listbox"
                    tabIndex={0}
                    aria-label={t("sortTriggerLabel")}
                    aria-activedescendant={activeSortOptionId}
                    onKeyDown={handleSortListboxKeyDown}
                  >
                    {FEED_SORT_OPTIONS.map((option, index) => (
                      <button
                        type="button"
                        key={option.value}
                        id={feedSortOptionId(option.value)}
                        className="sortOption"
                        role="option"
                        tabIndex={-1}
                        aria-selected={sortMode === option.value}
                        data-active={sortActiveIndex === index || sortMode === option.value}
                        onClick={() => handleSortSelect(option.value)}
                        onMouseEnter={() => setSortActiveIndex(index)}
                      >
                        {resolveSortOptionLabel(option.value, t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ExplorerCard>
          {hasFilter && (
            <FilterContextBar>
              <div className="contextMain">
                <strong className="contextCount">
                  {`${resultCount}${t("filterResultUnit")}`}
                </strong>
                <span className="filterSummary">{filterSummary}</span>
              </div>
              <div className="contextActions">
                <button type="button" className="resetButton" onClick={handleClearFilters}>
                  {t("filterReset")}
                </button>
              </div>
            </FilterContextBar>
          )}
          <PostList
            posts={visiblePosts.regularPosts}
            hasFilter={hasFilter}
            hasExternalResults={visiblePosts.pinnedPosts.length > 0}
            onClearFilters={handleClearFilters}
            isInitialLoading={isInitialLoading}
            isInitialLoadError={isInitialLoadError || isRetainedDataError || (showBootstrapDegraded && resultCount === 0)}
            isFetchingNextPage={isFetchingNextPage}
            isFetchNextPageError={isFetchNextPageError}
            hasNextPage={hasNextPage}
            onLoadMore={handleLoadMore}
            onRetryInitialLoad={refetchInitialPage}
            onRetryLoadMore={handleRetryLoadMore}
            loadMoreTriggerRef={loadMoreTriggerRef}
          />
        </section>
      </FeedBody>
    </>
  )
}

export default FeedExplorer
export const resolveFeedVisiblePosts = <T,>(pinnedPosts: T[], regularPosts: T[], isRetainedDataError: boolean) =>
  isRetainedDataError ? { pinnedPosts: [] as T[], regularPosts: [] as T[] } : { pinnedPosts, regularPosts }
