import React, { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import PostHeader from "./PostHeader"
import usePostQuery from "src/hooks/usePostQuery"
import { BodySection, StyledWrapper } from "./PostDetail.styles"
import { RelatedPostsSection } from "./PostDetailRelatedSection"
import { collectTocFromArticle, createObserverRegistry, createRafScheduler, isSameToc, type TocItem } from "./PostDetailTocModel"
import { LEFT_RAIL_HYBRID_MIN_VIEWPORT_PX, RIGHT_RAIL_HYBRID_MIN_VIEWPORT_PX, applyHybridRail, clearInlineRailStyle, measureHybridRail, resolveRailTopOffset } from "./PostDetailRailModel"
import { FloatingActionRail, MobileSummaryActions, RightTocRail } from "./PostDetailActionSections"
import PostDetailMobileToc from "./PostDetailMobileToc"
import { usePostDetailEngagementActions } from "./usePostDetailEngagementActions"
import { usePostDetailRelatedPosts } from "./usePostDetailRelatedPosts"
import { RecoverableSurfaceBoundary } from "src/components/error/ErrorBoundary"

const MarkdownRenderer = dynamic(() => import("../components/MarkdownRenderer"))

const PostDetail: React.FC = () => {
  const { post: data } = usePostQuery()
  const postId = data?.id ?? ""
  const articleRef = useRef<HTMLElement | null>(null)
  const relatedPrefetchTriggerRef = useRef<HTMLDivElement | null>(null)
  const leftRailRef = useRef<HTMLElement | null>(null)
  const leftRailInnerRef = useRef<HTMLDivElement | null>(null)
  const rightRailRef = useRef<HTMLElement | null>(null)
  const rightRailInnerRef = useRef<HTMLElement | null>(null)
  const rightTocListRef = useRef<HTMLOListElement | null>(null)
  const readProgressRef = useRef<HTMLSpanElement | null>(null)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [activeTocId, setActiveTocId] = useState<string>("")
  const [showDetailedToc, setShowDetailedToc] = useState(false)
  const [leftHybridRailActive, setLeftHybridRailActive] = useState(false)
  const [rightHybridRailActive, setRightHybridRailActive] = useState(false)
  const visibleTocItemsRef = useRef<TocItem[]>([])
  const showFloatingLikeRef = useRef(false)
  const showStickyTocRef = useRef(false)
  const leftHybridRailActiveRef = useRef(false)
  const rightHybridRailActiveRef = useRef(false)
  const hybridRailMetricsRef = useRef({
    left: {
      enabled: false,
      left: 0,
      width: 0,
      railTopDoc: 0,
      articleBottomDoc: 0,
      innerHeight: 0,
      stickyBlocked: false,
    },
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

  const showFloatingLike = data?.type[0] === "Post"
  const {
    hitCount,
    handleSharePost,
    shareFeedback,
    shareProgressLabel,
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
    relatedByAuthorPosts,
    relatedByTagPosts,
    relatedTag,
    shouldFetchRelated,
    showRelatedAuthorSkeleton,
    showRelatedTagSkeleton,
  } = usePostDetailRelatedPosts({
    data,
    prefetchTriggerRef: relatedPrefetchTriggerRef,
  })

  useEffect(() => {
    visibleTocItemsRef.current = visibleTocItems
  }, [visibleTocItems])

  useEffect(() => {
    showFloatingLikeRef.current = showFloatingLike
  }, [showFloatingLike])

  useEffect(() => {
    showStickyTocRef.current = showStickyToc
  }, [showStickyToc])

  useEffect(() => {
    if (!activeTocId || !showStickyToc || typeof window === "undefined") return

    const frame = window.requestAnimationFrame(() => {
      const listNode = rightTocListRef.current
      if (!listNode) return

      const activeButton = listNode.querySelector<HTMLElement>('button[data-active="true"]')
      if (!activeButton) return

      const listRect = listNode.getBoundingClientRect()
      const activeRect = activeButton.getBoundingClientRect()
      const revealPadding = 12
      const overflowTop = listRect.top + revealPadding - activeRect.top

      if (overflowTop > 0) {
        listNode.scrollTop = Math.max(0, listNode.scrollTop - overflowTop)
        return
      }

      const overflowBottom = activeRect.bottom - (listRect.bottom - revealPadding)
      if (overflowBottom > 0) {
        listNode.scrollTop += overflowBottom
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeTocId, showDetailedToc, showStickyToc, visibleTocItems.length])

  useEffect(() => {
    if (typeof window === "undefined") return
    const progressNode = readProgressRef.current
    if (!progressNode) return

    let rafId: number | null = null
    const syncReadProgress = () => {
      rafId = null
      const documentElement = document.documentElement
      const scrollableHeight = Math.max(1, documentElement.scrollHeight - window.innerHeight)
      const progress = Math.max(0, Math.min(1, window.scrollY / scrollableHeight))
      progressNode.style.transform = `scaleX(${progress})`
    }
    const scheduleSync = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(syncReadProgress)
    }

    syncReadProgress()
    window.addEventListener("scroll", scheduleSync, { passive: true })
    window.addEventListener("resize", scheduleSync, { passive: true })

    return () => {
      window.removeEventListener("scroll", scheduleSync)
      window.removeEventListener("resize", scheduleSync)
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [data?.id])

  useEffect(() => {
    leftHybridRailActiveRef.current = leftHybridRailActive
  }, [leftHybridRailActive])

  useEffect(() => {
    rightHybridRailActiveRef.current = rightHybridRailActive
  }, [rightHybridRailActive])

  useEffect(() => {
    const article = articleRef.current
    if (!article) {
      setTocItems([])
      setActiveTocId("")
      return
    }

    let rafId: number | null = null

    const syncToc = () => {
      const collected = collectTocFromArticle(article)
      setTocItems((prev) => (isSameToc(prev, collected) ? prev : collected))
      setActiveTocId((prev) => (collected.some((item) => item.id === prev) ? prev : collected[0]?.id ?? ""))
    }

    const scheduleSync = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        syncToc()
      })
    }

    setShowDetailedToc(false)
    syncToc()

    let observer: MutationObserver | null = null
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        scheduleSync()
      })
      observer.observe(article, { childList: true, subtree: true, characterData: true })
    }

    return () => {
      observer?.disconnect()
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [data?.id, renderedContent])

  useEffect(() => {
    if (typeof window === "undefined") return
    const article = articleRef.current
    if (!article) return
    const leftRailInnerNode = leftRailInnerRef.current
    const rightRailInnerNode = rightRailInnerRef.current

    const syncHybridRails = ({ remeasure = false }: { remeasure?: boolean } = {}) => {
      const viewportWidth = window.innerWidth
      const leftEnabled = showFloatingLikeRef.current && viewportWidth >= LEFT_RAIL_HYBRID_MIN_VIEWPORT_PX
      const rightEnabled = showStickyTocRef.current && viewportWidth >= RIGHT_RAIL_HYBRID_MIN_VIEWPORT_PX
      if (remeasure) {
        const articleBottomDoc = window.scrollY + article.getBoundingClientRect().bottom
        hybridRailMetricsRef.current.left = measureHybridRail(
          leftRailRef.current,
          leftRailInnerRef.current,
          leftEnabled,
          articleBottomDoc
        )
        hybridRailMetricsRef.current.right = measureHybridRail(
          rightRailRef.current,
          rightRailInnerRef.current,
          rightEnabled,
          articleBottomDoc
        )
      }

      const leftNeedsHybridFallback = leftEnabled && hybridRailMetricsRef.current.left.stickyBlocked
      const rightNeedsHybridFallback = rightEnabled && hybridRailMetricsRef.current.right.stickyBlocked

      if (leftHybridRailActiveRef.current !== leftNeedsHybridFallback) {
        leftHybridRailActiveRef.current = leftNeedsHybridFallback
        setLeftHybridRailActive(leftNeedsHybridFallback)
      }
      if (rightHybridRailActiveRef.current !== rightNeedsHybridFallback) {
        rightHybridRailActiveRef.current = rightNeedsHybridFallback
        setRightHybridRailActive(rightNeedsHybridFallback)
      }

      hybridRailMetricsRef.current.left.enabled = leftEnabled
      hybridRailMetricsRef.current.right.enabled = rightEnabled
      applyHybridRail(leftRailInnerRef.current, hybridRailMetricsRef.current.left)
      applyHybridRail(rightRailInnerRef.current, hybridRailMetricsRef.current.right)
    }

    const resolveActiveByScrollPosition = () => {
      const items = visibleTocItemsRef.current
      if (!items.length) return ""

      const anchorTop = resolveRailTopOffset() + 12
      const activeBoundary = anchorTop + 4
      const candidates = items
        .map((item) => {
          const heading = document.getElementById(item.id)
          if (!heading) return null
          return {
            id: item.id,
            top: heading.getBoundingClientRect().top,
          }
        })
        .filter((candidate): candidate is { id: string; top: number } => Boolean(candidate))

      if (!candidates.length) return items[0]?.id || ""

      let activeId = candidates[0].id
      for (const candidate of candidates) {
        if (candidate.top > activeBoundary) break
        activeId = candidate.id
      }

      return activeId
    }

    const scheduler = createRafScheduler(() => {
      const nextActiveId = resolveActiveByScrollPosition()
      setActiveTocId((prev) => (prev === nextActiveId ? prev : nextActiveId))
    })
    const railScheduler = createRafScheduler(() => {
      if (!leftHybridRailActiveRef.current && !rightHybridRailActiveRef.current) return
      syncHybridRails()
    })
    const registry = createObserverRegistry()

    registry.addWindowEvent(
      "scroll",
      () => {
        scheduler.schedule()
        if (!leftHybridRailActiveRef.current && !rightHybridRailActiveRef.current) return
        railScheduler.schedule()
      },
      { passive: true }
    )
    registry.addWindowEvent("resize", () => {
      syncHybridRails({ remeasure: true })
      scheduler.schedule()
    }, { passive: true })
    registry.addWindowEvent("orientationchange", () => {
      syncHybridRails({ remeasure: true })
      scheduler.schedule()
    })

    const resizeTargets = [article].filter(
      (target): target is HTMLElement => Boolean(target)
    )
    registry.addResizeObserver(resizeTargets, () => {
      syncHybridRails({ remeasure: true })
      scheduler.schedule()
    })

    const fontSet = document.fonts
    if (fontSet) {
      void fontSet.ready.then(() => {
        syncHybridRails({ remeasure: true })
        scheduler.schedule()
      }).catch(() => {})
    }

    syncHybridRails({ remeasure: true })
    scheduler.schedule()
    railScheduler.schedule()

    return () => {
      registry.cleanup()
      scheduler.cancel()
      railScheduler.cancel()
      clearInlineRailStyle(leftRailInnerNode)
      clearInlineRailStyle(rightRailInnerNode)
      if (leftHybridRailActiveRef.current) {
        leftHybridRailActiveRef.current = false
        setLeftHybridRailActive(false)
      }
      if (rightHybridRailActiveRef.current) {
        rightHybridRailActiveRef.current = false
        setRightHybridRailActive(false)
      }
    }
  }, [data?.id, visibleTocItems])

  if (!data) return null

  const handleTocNavigate = (id: string) => {
    const heading = document.getElementById(id)
    if (!heading) return
    const targetTop = heading.getBoundingClientRect().top + window.scrollY - (resolveRailTopOffset() + 24)
    setActiveTocId(id)
    const hash = `#${encodeURIComponent(id)}`
    const nextUrl = `${window.location.pathname}${window.location.search}${hash}`
    window.history.replaceState(window.history.state, "", nextUrl)
    window.scrollTo({ top: targetTop, behavior: "smooth" })
  }

  return (
    <StyledWrapper data-sticky-rail-safe="true">
      <div className="detailReadProgress" aria-hidden="true">
        <span ref={readProgressRef} />
      </div>
      {data.type[0] === "Post" && (
        <section className="detailHero">
          <PostHeader
            data={data}
            likesCount={data.likesCount}
            hitCount={hitCount}
            hideShareActionOnDesktop={showFloatingLike}
            hideActionButtonsOnMobile
            shareFeedback={shareFeedback}
            onSharePost={handleSharePost}
            deckSummary={headerDeckSummaryText}
          />
        </section>
      )}
      <div
        className="detailLayout"
        data-left-hybrid={leftHybridRailActive}
        data-right-hybrid={rightHybridRailActive}
        data-toc={showStickyToc ? "true" : "false"}
        data-sticky-rail-safe="true"
      >
        <FloatingActionRail
          railRef={leftRailRef}
          innerRef={leftRailInnerRef}
          active={leftHybridRailActive}
          showFloatingLike={showFloatingLike}
          likesCount={data.likesCount ?? 0}
          shareFeedback={shareFeedback}
          onSharePost={handleSharePost}
        />

        <article ref={articleRef}>
          {data.type[0] === "Post" ? (
            <MobileSummaryActions
              likesCount={data.likesCount ?? 0}
              shareFeedback={shareFeedback}
              shareProgressLabel={shareProgressLabel}
              onSharePost={handleSharePost}
            />
          ) : null}
          {showStickyToc ? (
            <PostDetailMobileToc
              items={visibleTocItems}
              activeTocId={activeTocId}
              onNavigate={handleTocNavigate}
            />
          ) : null}
          <BodySection>
            <RecoverableSurfaceBoundary surface="markdown" resetKey={postId}>
              <MarkdownRenderer
                content={renderedContent}
                trustedContentHtml={data?.trustedContentHtml}
                forceScheme="light"
              />
            </RecoverableSurfaceBoundary>
          </BodySection>
          {data.type[0] === "Post" && <div ref={relatedPrefetchTriggerRef} className="relatedPrefetchTrigger" aria-hidden="true" />}
          {data.type[0] === "Post" && shouldFetchRelated ? (
            <RelatedPostsSection
              relatedTag={relatedTag}
              showRelatedTagSkeleton={showRelatedTagSkeleton}
              relatedByTagPosts={relatedByTagPosts}
              showRelatedAuthorSkeleton={showRelatedAuthorSkeleton}
              relatedByAuthorPosts={relatedByAuthorPosts}
            />
          ) : null}
        </article>

        <RightTocRail
          railRef={rightRailRef}
          innerRef={rightRailInnerRef}
          listRef={rightTocListRef}
          active={rightHybridRailActive}
          showStickyToc={showStickyToc}
          visibleTocItems={visibleTocItems}
          activeTocId={activeTocId}
          hasDepth4Toc={hasDepth4Toc}
          showDetailedToc={showDetailedToc}
          onToggleDetailed={() => setShowDetailedToc((value) => !value)}
          onNavigate={handleTocNavigate}
        />
      </div>
    </StyledWrapper>
  )
}

export default PostDetail
