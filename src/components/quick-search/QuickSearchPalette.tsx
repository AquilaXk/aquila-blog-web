/**
 * Quick Search command palette modal adapted with attribution from:
 * - Quartz v4 (`jackyzha0/quartz`, MIT License) — `quartz/components/scripts/search.inline.ts`
 * - uFuzzy (`leeoniya/uFuzzy`, MIT License) — multi-token term highlight matching
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/router"
import { CONFIG } from "site.config"
import { getExplorePostsPage, getSearchPostsPage } from "src/apis/backend/posts"
import AppIcon from "src/components/icons/AppIcon"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { useLanguage } from "src/libs/language"
import { formatDate } from "src/libs/utils"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import type { TPost } from "src/types"
import {
  QuickSearchBackdrop,
  QuickSearchDialog,
} from "./QuickSearchPalette.styles"
import {
  splitHighlightSegments,
  tokenizeHighlightTerms,
} from "./quickSearchHighlight"

export type QuickSearchPaletteProps = {
  open: boolean
  onClose: () => void
  onOpenInFeed?: (query: string) => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

const QUICK_SEARCH_DEBOUNCE_MS = 160
const QUICK_SEARCH_PAGE_SIZE = 8
const QUICK_SEARCH_RECENT_SIZE = 5

const QUICK_SEARCH_LABELS = {
  ko: {
    aria: "빠른 글 검색",
    placeholder: "제목, 요약, 태그로 빠르게 검색",
    close: "닫기",
    emptyIdle: "검색어를 입력해 원하는 글을 찾아보세요.",
    emptyResults: "일치하는 글이 없습니다.",
    error: "검색 결과를 불러오지 못했습니다.",
    filterInFeed: "피드에서 자세히 보기",
    hintNavigate: "이동",
    hintOpen: "열기",
    hintClose: "닫기",
  },
  en: {
    aria: "Quick post search",
    placeholder: "Search posts by title, summary, or tag...",
    close: "Close",
    emptyIdle: "Type to search posts across the blog.",
    emptyResults: "No matching posts found.",
    error: "Failed to load search results.",
    filterInFeed: "Open in Feed",
    hintNavigate: "Navigate",
    hintOpen: "Open",
    hintClose: "Close",
  },
} as const

const renderHighlightedText = (
  text: string,
  tokens: readonly string[],
  keyPrefix: string
) => {
  if (!text || tokens.length === 0) return text
  const segments = splitHighlightSegments(text, tokens)
  if (segments.length === 1 && !segments[0].highlighted) return text

  return segments.map((segment, index) =>
    segment.highlighted ? (
      <mark key={`${keyPrefix}-m-${index}`}>{segment.text}</mark>
    ) : (
      <React.Fragment key={`${keyPrefix}-t-${index}`}>{segment.text}</React.Fragment>
    )
  )
}

const QuickSearchPalette: React.FC<QuickSearchPaletteProps> = ({
  open,
  onClose,
  onOpenInFeed,
  returnFocusRef,
}) => {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<TPost[]>([])
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const { handleKeyDown: handleTrapKeyDown } = useModalFocusTrap({
    open,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
    returnFocusRef,
    lockScroll: true,
  })

  const tokens = useMemo(() => tokenizeHighlightTerms(query), [query])
  const currentLang = language === "en" ? "en-US" : CONFIG.lang || "ko-KR"
  const copy = QUICK_SEARCH_LABELS[language]

  useEffect(() => {
    if (!open) return
    setSelectedIndex(0)
  }, [open, results.length])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setHasError(false)
      setLoading(false)
      return
    }

    const trimmed = query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(
      async () => {
        setLoading(true)
        setHasError(false)
        try {
          const page = trimmed
            ? await getSearchPostsPage({
                kw: trimmed,
                sortMode: "latest",
                page: 1,
                pageSize: QUICK_SEARCH_PAGE_SIZE,
                signal: controller.signal,
              })
            : await getExplorePostsPage({
                kw: "",
                sortMode: "latest",
                page: 1,
                pageSize: QUICK_SEARCH_RECENT_SIZE,
                signal: controller.signal,
              })
          if (controller.signal.aborted) return
          setResults(page.posts)
          setSelectedIndex(0)
        } catch (error) {
          if (controller.signal.aborted) return
          if ((error as { name?: string })?.name === "AbortError") return
          setHasError(true)
          setResults([])
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        }
      },
      trimmed ? QUICK_SEARCH_DEBOUNCE_MS : 0
    )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  const navigateToPost = useCallback(
    (post: TPost) => {
      const targetPath = toCanonicalPostPath(post.id)
      onClose()
      void router.push(targetPath)
    },
    [onClose, router]
  )

  const handlePaletteKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      handleTrapKeyDown(event)
      if (event.defaultPrevented) return

      if (event.key === "ArrowDown" && results.length > 0) {
        event.preventDefault()
        setSelectedIndex((prev) => {
          const next = (prev + 1) % results.length
          itemRefs.current[next]?.scrollIntoView?.({ block: "nearest" })
          return next
        })
        return
      }

      if (event.key === "ArrowUp" && results.length > 0) {
        event.preventDefault()
        setSelectedIndex((prev) => {
          const next = (prev - 1 + results.length) % results.length
          itemRefs.current[next]?.scrollIntoView?.({ block: "nearest" })
          return next
        })
        return
      }

      if (event.key === "Enter" && results.length > 0) {
        const activePost = results[selectedIndex] ?? results[0]
        if (activePost) {
          event.preventDefault()
          navigateToPost(activePost)
        }
      }
    },
    [handleTrapKeyDown, navigateToPost, results, selectedIndex]
  )

  if (!open || typeof document === "undefined") return null

  const trimmedQuery = query.trim()

  return createPortal(
    <QuickSearchBackdrop
      data-ui="quick-search-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <QuickSearchDialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.aria}
        data-ui="quick-search-dialog"
        onKeyDown={handlePaletteKeyDown}
      >
        <div className="qsHeader">
          <span className="qsSearchIcon" aria-hidden="true">
            <AppIcon name="search" />
          </span>
          <input
            ref={inputRef}
            className="qsInput"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
            aria-label={copy.aria}
          />
          <button
            type="button"
            className="qsCloseBtn"
            onClick={onClose}
            aria-label={copy.close}
          >
            Esc
          </button>
        </div>

        <div className="qsBody" role="region" aria-live="polite">
          {loading ? (
            <p className="qsStatus">{t("loadingTitle")}</p>
          ) : hasError ? (
            <p className="qsStatus">{copy.error}</p>
          ) : results.length === 0 ? (
            <p className="qsStatus">
              {trimmedQuery ? copy.emptyResults : copy.emptyIdle}
            </p>
          ) : (
            <ul className="qsList" role="listbox" aria-label={copy.aria}>
              {results.map((post, index) => {
                const rawDate = post.createdAt || post.date?.start_date || post.createdTime || ""
                const dateLabel = rawDate ? formatDate(rawDate, currentLang) : ""
                const selected = index === selectedIndex
                return (
                  <li key={post.id} role="option" aria-selected={selected}>
                    <button
                      ref={(node) => {
                        itemRefs.current[index] = node
                      }}
                      type="button"
                      className="qsItemButton"
                      data-selected={selected}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => navigateToPost(post)}
                    >
                      <span className="qsItemTitleRow">
                        <span className="qsItemTitle">
                          {renderHighlightedText(post.title, tokens, `qs-t-${post.id}`)}
                        </span>
                        {dateLabel ? <span className="qsItemDate">{dateLabel}</span> : null}
                      </span>
                      {post.summary ? (
                        <p className="qsItemSummary">
                          {renderHighlightedText(post.summary, tokens, `qs-s-${post.id}`)}
                        </p>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="qsFooter">
          <div className="qsHints" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              {copy.hintNavigate}
            </span>
            <span>
              <kbd>Enter</kbd>
              {copy.hintOpen}
            </span>
            <span>
              <kbd>Esc</kbd>
              {copy.hintClose}
            </span>
          </div>
          {onOpenInFeed ? (
            <button
              type="button"
              className="qsFeedLink"
              onClick={() => {
                const current = query.trim()
                onClose()
                onOpenInFeed(current)
              }}
            >
              {copy.filterInFeed}
            </button>
          ) : null}
        </div>
      </QuickSearchDialog>
    </QuickSearchBackdrop>,
    document.body
  )
}

export default QuickSearchPalette
