/**
 * 참조 구현:
 * - fuma-nama/fumadocs (packages/ui/src/components/layout/toc.tsx, MIT License)
 * - jackyzha0/quartz (MIT License)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import PostHeader, {
  resolvePostHeaderViewModel,
  shouldRenderPostHeader,
} from "./PostHeader"
import { CONFIG } from "site.config"
import usePostQuery from "src/hooks/usePostQuery"
import { BodySection, StyledWrapper } from "./PostDetail.styles"
import type { RelatedPostsSectionProps } from "./PostDetailRelatedSection"
import {
  buildInitialTocFromMarkdown,
  collectTocFromArticle,
  createObserverRegistry,
  createRafScheduler,
  expandClosedAncestorDetails,
  isSameToc,
  measureHeadingOffsets,
  resolveActiveTocIdFromOffsets,
  revealHashedTargetInArticle,
  shouldSyncTocFromMutations,
  type HeadingOffset,
  type TocItem,
} from "./PostDetailTocModel"
import {
  RIGHT_RAIL_HYBRID_MIN_VIEWPORT_PX,
  applyHybridRail,
  clearInlineRailStyle,
  computeArticleReadingProgress,
  invalidateStickyBlockingAncestorCache,
  measureHybridRail,
  resolveRailTopOffset,
} from "./PostDetailRailModel"
import { PostLayoutSidebar, type MobileSummaryActionsProps } from "./PostDetailActionSections"
import type { PostDetailNavigationChromeProps } from "./PostDetailNavigationChrome"
import { usePostDetailEngagementActions } from "./usePostDetailEngagementActions"
import { usePostDetailRelatedPosts } from "./usePostDetailRelatedPosts"
import { usePostDetailTocEffects } from "./usePostDetailTocEffects"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
import { useLanguage } from "src/libs/language"
import { RecoverableSurfaceBoundary } from "src/components/error/ErrorBoundary"

const MarkdownLoadingSkeleton: React.FC = () => {
  const { t } = useLanguage()
  return (
    <div className="markdownLoadingSkeleton" aria-busy="true" aria-label={t("postLoadingAria")}>
      <span className="skeletonLine skeletonLineWide" />
      <span className="skeletonLine skeletonLineFull" />
      <span className="skeletonLine skeletonLineMid" />
    </div>
  )
}

const MarkdownRenderer = dynamic(() => import("src/libs/markdown/MarkdownRenderer"), {
  loading: () => <MarkdownLoadingSkeleton />,
})

const RelatedPostsSection = dynamic<RelatedPostsSectionProps>(
  () => import("./PostDetailRelatedSection").then((mod) => mod.RelatedPostsSection),
  { ssr: false }
)

const PostDetailMobileToc = dynamic(() => import("./PostDetailMobileToc"))

const MobileSummaryActions = dynamic<MobileSummaryActionsProps>(() =>
  import("./PostDetailActionSections").then((mod) => mod.MobileSummaryActions)
)

const PostDetailNavigationChrome = dynamic<PostDetailNavigationChromeProps>(
  () => import("./PostDetailNavigationChrome").then((mod) => mod.PostDetailNavigationChrome),
  { ssr: false }
)

export const RAIL_UI_DETAILED_TOC = 1
export const RAIL_UI_LEFT_ACTIVE = 1 << 1
export const RAIL_UI_RIGHT_ACTIVE = 1 << 2

const PostDetail: React.FC = () => {
  const { language, t } = useLanguage()
  const { post: data } = usePostQuery()
  const postId = data?.id ?? ""
  const articleRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const relatedPrefetchTriggerRef = useRef<HTMLDivElement | null>(null)
  const rightRailRef = useRef<HTMLElement | null>(null)
  const rightRailInnerRef = useRef<HTMLElement | null>(null)
  const rightTocListRef = useRef<HTMLOListElement | null>(null)
  const rightTocButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const readProgressRef = useRef<HTMLSpanElement | null>(null)
  const documentInsights = useMemo(
    () => createMarkdownDocumentInsights(data?.content ?? ""),
    [data?.content]
  )
  const initialToc = useMemo(
    () => buildInitialTocFromMarkdown(data?.content ?? "", documentInsights.headings),
    [data?.content, documentInsights.headings]
  )
  const [tocItems, setTocItems] = useState<TocItem[]>(initialToc)
  const [activeTocId, setActiveTocId] = useState<string>(() => initialToc[0]?.id ?? "")
  const [railUiMask, setRailUiMask] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const showDetailedToc = (railUiMask & RAIL_UI_DETAILED_TOC) !== 0
  const rightHybridRailActive = (railUiMask & RAIL_UI_RIGHT_ACTIVE) !== 0
  const visibleTocItemsRef = useRef<TocItem[]>([])
  const headingOffsetsRef = useRef<HeadingOffset[]>([])
  const hasMountedTocOffsetsRef = useRef(false)
  const railTopOffsetRef = useRef(85)
  const bodyRangeRef = useRef({ topDoc: 0, bottomDoc: 1 })
  const lastRevealedHashRef = useRef("")
  const showBackToTopRef = useRef(false)
  const showStickyTocRef = useRef(false)
  const rightHybridRailActiveRef = useRef(false)
  const tocScrollLockRef = useRef<{ id: string; until: number } | null>(null)
  const hybridRailMetricsRef = useRef({
    right: {
      enabled: false,
      left: 0,
      width: 0,
      railTopDoc: 0,
      articleBottomDoc: 0,
      innerHeight: 0,
      stickyBlocked: false,
    },
  })

  const {
    hitCount,
    likesCount,
    liked,
    likePending,
    handleToggleLike,
    handleSharePost,
    shareFeedback,
  } = usePostDetailEngagementActions({
    data,
    postId,
  })
  const hasDepth4Toc = useMemo(() => tocItems.some((item) => item.level === 4), [tocItems])
  const visibleTocItems = useMemo(
    () => (showDetailedToc ? tocItems : tocItems.filter((item) => item.level <= 3)),
    [showDetailedToc, tocItems]
  )
  const showStickyToc = visibleTocItems.length >= 2
  const headerDeckSummaryText =
    data?.summarySource === "LEADING_BLOCK" || data?.summarySource === "NONE"
      ? ""
      : data?.summary ?? ""
  const renderedContent = data?.content ?? ""
  const {
    adjacentPosts,
    relatedByAuthorPosts,
    relatedByTagPosts,
    shouldFetchRelated,
    showRelatedAuthorSkeleton,
    showRelatedTagSkeleton,
  } = usePostDetailRelatedPosts({
    data,
    prefetchTriggerRef: relatedPrefetchTriggerRef,
  })

  const tryRevealLocationHash = useCallback((force = false) => {
    if (typeof window === "undefined") return
    const rawHash = window.location.hash
    const articleNode = articleRef.current
    if (!rawHash || !articleNode || (!force && lastRevealedHashRef.current === rawHash)) return
    const resolved = revealHashedTargetInArticle(articleNode, rawHash)
    if (!resolved) return
    lastRevealedHashRef.current = rawHash
    if (resolved.expanded) {
      headingOffsetsRef.current = measureHeadingOffsets(visibleTocItemsRef.current, window.scrollY)
    }
    const targetTop =
      resolved.target.getBoundingClientRect().top + window.scrollY - (railTopOffsetRef.current + 24)
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" })
  }, [])

  usePostDetailTocEffects({
    articleRef,
    rightTocListRef,
    rightTocButtonRefs,
    visibleTocItemsRef,
    headingOffsetsRef,
    hasMountedTocOffsetsRef,
    visibleTocItems,
    activeTocId,
    showDetailedToc,
    showStickyToc,
  })

  useEffect(() => {
    const article = articleRef.current
    if (!article) {
      setTocItems(initialToc)
      setActiveTocId(initialToc[0]?.id ?? "")
      return
    }
    let rafId: number | null = null
    const syncToc = () => {
      const domCollected = collectTocFromArticle(article)
      const collected = domCollected.length > 0 ? domCollected : initialToc
      setTocItems((prev) => (isSameToc(prev, collected) ? prev : collected))
      setActiveTocId((prev) => (collected.some((item) => item.id === prev) ? prev : collected[0]?.id ?? ""))
      tryRevealLocationHash()
    }
    const scheduleSync = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        syncToc()
      })
    }
    lastRevealedHashRef.current = ""
    setRailUiMask((prev) => prev & ~RAIL_UI_DETAILED_TOC)
    syncToc()
    let observer: MutationObserver | null = null
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver((mutations) => {
        if (!shouldSyncTocFromMutations(mutations)) return
        scheduleSync()
      })
      observer.observe(article, { childList: true, subtree: true, characterData: true })
    }
    return () => {
      observer?.disconnect()
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [data?.id, renderedContent, initialToc, tryRevealLocationHash])

  useEffect(() => {
    showStickyTocRef.current = showStickyToc
  }, [showStickyToc])

  useEffect(() => {
    rightHybridRailActiveRef.current = rightHybridRailActive
  }, [rightHybridRailActive])

  useEffect(() => {
    if (typeof window === "undefined") return
    const article = articleRef.current
    if (!article) return
    const rightRailInnerNode = rightRailInnerRef.current

    const syncReadProgress = () => {
      const progressNode = readProgressRef.current
      if (!progressNode) return
      const { topDoc, bottomDoc } = bodyRangeRef.current
      const progress = computeArticleReadingProgress({
        scrollY: window.scrollY,
        articleTopDoc: topDoc,
        articleBottomDoc: bottomDoc,
        innerHeight: window.innerHeight,
        viewportReadingAnchor: Math.max(0, railTopOffsetRef.current - 20),
      })
      progressNode.style.transform = `scaleX(${progress})`
    }

    const syncHybridRails = ({ remeasure = false }: { remeasure?: boolean } = {}) => {
      const viewportWidth = window.innerWidth
      const rightEnabled = showStickyTocRef.current && viewportWidth >= RIGHT_RAIL_HYBRID_MIN_VIEWPORT_PX
      if (remeasure) {
        railTopOffsetRef.current = resolveRailTopOffset()
        const bodyNode = bodyRef.current
        const progressRect = (bodyNode ?? article).getBoundingClientRect()
        bodyRangeRef.current = {
          topDoc: window.scrollY + progressRect.top,
          bottomDoc: window.scrollY + progressRect.bottom,
        }
        const articleBottomDoc = window.scrollY + article.getBoundingClientRect().bottom
        hybridRailMetricsRef.current.right = measureHybridRail(
          rightRailRef.current,
          rightRailInnerRef.current,
          rightEnabled,
          articleBottomDoc
        )
        headingOffsetsRef.current = measureHeadingOffsets(
          visibleTocItemsRef.current,
          window.scrollY
        )
      }

      const rightNeedsHybridFallback = rightEnabled && hybridRailMetricsRef.current.right.stickyBlocked

      if (rightHybridRailActiveRef.current !== rightNeedsHybridFallback) {
        rightHybridRailActiveRef.current = rightNeedsHybridFallback
        setRailUiMask((prev) => {
          let next = prev & ~RAIL_UI_RIGHT_ACTIVE
          if (rightNeedsHybridFallback) next |= RAIL_UI_RIGHT_ACTIVE
          return next
        })
      }

      hybridRailMetricsRef.current.right.enabled = rightEnabled
      applyHybridRail(
        rightRailInnerRef.current,
        hybridRailMetricsRef.current.right,
        railTopOffsetRef.current
      )
    }

    const resolveActiveByScrollPosition = () => {
      const items = visibleTocItemsRef.current
      if (!items.length) return ""

      if (!headingOffsetsRef.current.length) {
        headingOffsetsRef.current = measureHeadingOffsets(items, window.scrollY)
      }

      const anchorTop = railTopOffsetRef.current + 24
      const activeBoundary = anchorTop + 4
      return resolveActiveTocIdFromOffsets(headingOffsetsRef.current, window.scrollY, activeBoundary)
    }

    const scrollScheduler = createRafScheduler(() => {
      syncReadProgress()
      const scrollY = window.scrollY
      const nextBackToTop = scrollY > 50
      if (showBackToTopRef.current !== nextBackToTop) {
        showBackToTopRef.current = nextBackToTop
        setShowBackToTop(nextBackToTop)
      }
      const lock = tocScrollLockRef.current
      if (lock && Date.now() < lock.until) {
        const resolved = resolveActiveByScrollPosition()
        if (resolved === lock.id) {
          tocScrollLockRef.current = null
        }
      } else {
        if (lock) tocScrollLockRef.current = null
        const nextActiveId = resolveActiveByScrollPosition()
        setActiveTocId((prev) => (prev === nextActiveId ? prev : nextActiveId))
      }
      if (rightHybridRailActiveRef.current) {
        syncHybridRails()
      }
    })
    const remeasureScheduler = createRafScheduler(() => {
      syncHybridRails({ remeasure: true })
      scrollScheduler.schedule()
    })
    const registry = createObserverRegistry()

    registry.addWindowEvent(
      "scroll",
      () => {
        scrollScheduler.schedule()
      },
      { passive: true }
    )
    registry.addWindowEvent(
      "resize",
      () => {
        invalidateStickyBlockingAncestorCache()
        remeasureScheduler.schedule()
      },
      { passive: true }
    )
    registry.addWindowEvent("orientationchange", () => {
      invalidateStickyBlockingAncestorCache()
      remeasureScheduler.schedule()
    })
    registry.addWindowEvent("hashchange", () => {
      showBackToTopRef.current = false
      setShowBackToTop(false)
      tryRevealLocationHash(true)
    })

    const resizeTargets = [article].filter(
      (target): target is HTMLElement => Boolean(target)
    )
    registry.addResizeObserver(resizeTargets, () => {
      remeasureScheduler.schedule()
    })
    const handleDetailsToggle = () => {
      remeasureScheduler.schedule()
    }
    article.addEventListener("toggle", handleDetailsToggle, true)
    registry.add(() => article.removeEventListener("toggle", handleDetailsToggle, true))

    const fontSet = document.fonts
    if (fontSet) {
      void fontSet.ready.then(() => {
        remeasureScheduler.schedule()
      }).catch(() => {})
    }

    syncHybridRails({ remeasure: true })
    syncReadProgress()
    scrollScheduler.schedule()

    return () => {
      registry.cleanup()
      scrollScheduler.cancel()
      remeasureScheduler.cancel()
      clearInlineRailStyle(rightRailInnerNode)
      if (rightHybridRailActiveRef.current) {
        rightHybridRailActiveRef.current = false
        setRailUiMask((prev) => prev & ~RAIL_UI_RIGHT_ACTIVE)
      }
    }
  }, [data?.id, tryRevealLocationHash, visibleTocItems])

  const handleBackToTop = useCallback(() => {
    if (typeof window === "undefined") return
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }, [])

  const handleTocNavigate = useCallback((id: string) => {
    const heading = document.getElementById(id)
    if (!heading) return
    if (expandClosedAncestorDetails(heading)) {
      headingOffsetsRef.current = measureHeadingOffsets(visibleTocItemsRef.current, window.scrollY)
    }
    const targetTop = heading.getBoundingClientRect().top + window.scrollY - (railTopOffsetRef.current + 24)
    tocScrollLockRef.current = { id, until: Date.now() + 700 }
    setActiveTocId(id)
    if (typeof window !== "undefined") {
      window.history?.replaceState?.(null, "", `#${id}`)
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
      window.scrollTo({ top: targetTop, behavior: reducedMotion ? "auto" : "smooth" })
    }
  }, [])

  const handleToggleDetailedToc = useCallback(() => {
    setRailUiMask((prev) => prev ^ RAIL_UI_DETAILED_TOC)
  }, [])

  if (!data) return null

  const isPostType = (data.type?.[0] ?? "Post") === "Post"
  const showPostHeader = shouldRenderPostHeader(data)
  const locale = language === "en" ? "en-US" : CONFIG.lang
  const headerVm = resolvePostHeaderViewModel(
    { data, likesCount, hitCount, shareFeedback },
    locale
  )
  const sidebarTags = Array.isArray(data.tags)
    ? data.tags.map((tag) => tag.trim()).filter(Boolean)
    : []

  return (
    <StyledWrapper data-sticky-rail-safe="true">
      <div className="detailReadProgress" aria-hidden="true">
        <span ref={readProgressRef} />
      </div>
      {showPostHeader && (
        <section className="detailHero">
          <PostHeader
            data={data}
            likesCount={likesCount}
            liked={liked}
            likePending={likePending}
            onToggleLike={handleToggleLike}
            hitCount={hitCount}
            hideShareActionOnDesktop
            hideActionButtonsOnMobile
            shareFeedback={shareFeedback}
            onSharePost={handleSharePost}
            deckSummary={headerDeckSummaryText}
            showEngagement={isPostType}
            showReadingTime
            readingMinutes={documentInsights.readingMinutes}
          />
        </section>
      )}
      <div
        className="detailLayout"
        data-right-hybrid={rightHybridRailActive}
        data-toc={showStickyToc ? "true" : "false"}
        data-sticky-rail-safe="true"
      >
        <PostLayoutSidebar
          authorName={headerVm.authorName}
          authorImageSrc={headerVm.authorImageSrc}
          viewText={headerVm.viewText}
          readingMinutes={documentInsights.readingMinutes}
          tags={sidebarTags}
          isPostType={isPostType}
          likesCount={likesCount}
          liked={liked}
          likePending={likePending}
          onToggleLike={handleToggleLike}
          shareFeedback={shareFeedback}
          onSharePost={handleSharePost}
          previousPost={adjacentPosts.previousPost}
          nextPost={adjacentPosts.nextPost}
          railRef={rightRailRef}
          innerRef={rightRailInnerRef}
          listRef={rightTocListRef}
          buttonRefsById={rightTocButtonRefs}
          active={rightHybridRailActive}
          showStickyToc={showStickyToc}
          visibleTocItems={visibleTocItems}
          activeTocId={activeTocId}
          hasDepth4Toc={hasDepth4Toc}
          showDetailedToc={showDetailedToc}
          onToggleDetailed={handleToggleDetailedToc}
          onNavigate={handleTocNavigate}
        />

        <article ref={articleRef}>
          {isPostType ? (
            <MobileSummaryActions
              likesCount={likesCount}
              liked={liked}
              likePending={likePending}
              onToggleLike={handleToggleLike}
              shareFeedback={shareFeedback}
              onSharePost={handleSharePost}
            />
          ) : null}
          {showStickyToc ? (
            <PostDetailMobileToc
              items={visibleTocItems}
              activeTocId={activeTocId}
              hasDepth4Toc={hasDepth4Toc}
              showDetailedToc={showDetailedToc}
              onToggleDetailed={handleToggleDetailedToc}
              onNavigate={handleTocNavigate}
            />
          ) : null}
          <BodySection ref={bodyRef}>
            <RecoverableSurfaceBoundary surface="markdown" resetKey={postId}>
              <MarkdownRenderer
                content={renderedContent}
                trustedContentHtml={data?.trustedContentHtml}
                forceScheme="light"
              />
            </RecoverableSurfaceBoundary>
          </BodySection>
          {isPostType && <div ref={relatedPrefetchTriggerRef} className="relatedPrefetchTrigger" aria-hidden="true" />}
          {isPostType && shouldFetchRelated ? (
            <RelatedPostsSection
              showRelatedTagSkeleton={showRelatedTagSkeleton}
              relatedByTagPosts={relatedByTagPosts}
              showRelatedAuthorSkeleton={showRelatedAuthorSkeleton}
              relatedByAuthorPosts={relatedByAuthorPosts}
            />
          ) : null}
          <PostDetailNavigationChrome
            previousPost={adjacentPosts.previousPost}
            nextPost={adjacentPosts.nextPost}
            showBackToTop={showBackToTop}
            onBackToTop={handleBackToTop}
            tags={sidebarTags}
          />
        </article>
      </div>
    </StyledWrapper>
  )
}

export default PostDetail
