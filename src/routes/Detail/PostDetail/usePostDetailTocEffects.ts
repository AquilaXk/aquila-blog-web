// 참조 구현: fuma-nama/fumadocs (MIT) — 아티클 TOC 활성 항목 자동 스크롤 및 오프셋 동기화
import type React from "react"
import { useEffect } from "react"
import { measureHeadingOffsets, type HeadingOffset, type TocItem } from "./PostDetailTocModel"

interface UsePostDetailTocEffectsOptions {
  articleRef: React.RefObject<HTMLElement | null>
  rightTocListRef: React.RefObject<HTMLOListElement | null>
  rightTocButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>
  visibleTocItemsRef: React.MutableRefObject<TocItem[]>
  headingOffsetsRef: React.MutableRefObject<HeadingOffset[]>
  hasMountedTocOffsetsRef: React.MutableRefObject<boolean>
  visibleTocItems: TocItem[]
  activeTocId: string
  showDetailedToc: boolean
  showStickyToc: boolean
}

export const usePostDetailTocEffects = ({
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
}: UsePostDetailTocEffectsOptions) => {
  useEffect(() => {
    visibleTocItemsRef.current = visibleTocItems
    if (!hasMountedTocOffsetsRef.current) {
      hasMountedTocOffsetsRef.current = true
      if (articleRef.current) return
    }
    headingOffsetsRef.current = measureHeadingOffsets(
      visibleTocItems,
      typeof window !== "undefined" ? window.scrollY : 0
    )
  }, [articleRef, hasMountedTocOffsetsRef, headingOffsetsRef, visibleTocItems, visibleTocItemsRef])

  useEffect(() => {
    const article = articleRef.current
    if (!article || typeof window === "undefined" || typeof ResizeObserver === "undefined") return

    let rafId: number | null = null
    const observer = new ResizeObserver(() => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        headingOffsetsRef.current = measureHeadingOffsets(visibleTocItemsRef.current, window.scrollY)
      })
    })

    observer.observe(article)
    return () => {
      observer.disconnect()
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [articleRef, headingOffsetsRef, visibleTocItemsRef])

  useEffect(() => {
    if (!activeTocId || !showStickyToc || typeof window === "undefined") return

    const frame = window.requestAnimationFrame(() => {
      const listNode = rightTocListRef.current
      if (!listNode) return

      const activeButton = rightTocButtonRefs.current.get(activeTocId)
      if (!activeButton) return

      const revealPadding = 12
      const buttonTop =
        activeButton.offsetParent === listNode
          ? activeButton.offsetTop
          : activeButton.offsetTop - listNode.offsetTop
      const buttonBottom = buttonTop + activeButton.offsetHeight
      const viewTop = listNode.scrollTop
      const viewBottom = viewTop + listNode.clientHeight

      if (buttonTop - revealPadding < viewTop) {
        listNode.scrollTop = Math.max(0, buttonTop - revealPadding)
        return
      }

      if (buttonBottom + revealPadding > viewBottom) {
        listNode.scrollTop = buttonBottom + revealPadding - listNode.clientHeight
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeTocId, rightTocButtonRefs, rightTocListRef, showDetailedToc, showStickyToc, visibleTocItems.length])
}
