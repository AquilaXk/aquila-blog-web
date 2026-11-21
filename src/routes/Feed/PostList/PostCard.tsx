/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/ListLayoutWithTags.tsx, components/Tag.tsx, MIT License)
 */
import { CONFIG } from "site.config"
import { formatDate, splitCategoryDisplay } from "src/libs/utils"
import type { TPost } from "src/types"
import styled from "@emotion/styled"
import { uiTokens } from "@shared/ui-tokens"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import Link from "next/link"
import { memo, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react"
import Router from "next/router"
import { useLanguage } from "src/libs/language"
import { getNavigatorConnection } from "src/routes/Feed/FeedExplorerRestoreModel"
import { splitHighlightSegments } from "src/components/quick-search/quickSearchHighlight"
import type { FeedSortMode } from "src/routes/Feed/FeedSortMenuModel"

const prefetchedPaths = new Set<string>()

const renderHighlightedText = (text: string, query: string | undefined) => {
  if (!query || !query.trim()) return text
  const segments = splitHighlightSegments(text, query)
  if (segments.length === 1 && !segments[0].highlighted) return text
  return segments.map((segment, index) =>
    segment.highlighted ? <mark key={index}>{segment.text}</mark> : segment.text
  )
}

export const canPrefetchOnCurrentNetwork = () => {
  if (typeof navigator === "undefined") return true
  if (navigator.onLine === false) return false
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false
  const connection = getNavigatorConnection()
  if (!connection) return true
  if (connection.saveData) return false
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return false
  return true
}

type Props = {
  data: TPost
  layout?: "regular" | "pinned"
  searchQuery?: string
  sortMode?: FeedSortMode
}

const PostCard: React.FC<Props> = ({
  data,
  layout = "regular",
  searchQuery,
  sortMode = "latest",
}) => {
  const { language, t } = useLanguage()
  const postPath = toCanonicalPostPath(data.id)
  const isEn = language === "en"
  const currentLang = isEn ? "en-US" : (CONFIG.lang || "ko-KR")
  const rawDate = data.createdAt || data.date?.start_date || data.createdTime || ""
  const createdAtText = useMemo(() => formatDate(rawDate, currentLang), [rawDate, currentLang])
  const tags = useMemo(() => {
    if (!Array.isArray(data.tags)) return []
    const visibleTags: string[] = []
    const seen = new Set<string>()
    for (const rawTag of data.tags) {
      const trimmed = rawTag?.trim()
      if (!trimmed || trimmed.toLowerCase() === "pinned") continue
      const label = splitCategoryDisplay(trimmed).label.trim()
      if (!label || label.toLowerCase() === "pinned" || seen.has(label)) continue
      seen.add(label)
      visibleTags.push(label)
    }
    return visibleTags
  }, [data.tags])

  const prefetchTimerRef = useRef<number | null>(null)

  const clearPrefetchTimer = useCallback(() => {
    if (prefetchTimerRef.current !== null) {
      window.clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearPrefetchTimer()
  }, [clearPrefetchTimer])

  const schedulePrefetch = useCallback(() => {
    if (prefetchedPaths.has(postPath)) return
    if (!canPrefetchOnCurrentNetwork()) return
    clearPrefetchTimer()
    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchTimerRef.current = null
      if (prefetchedPaths.has(postPath)) return
      prefetchedPaths.add(postPath)
      if (typeof Router.prefetch === "function") {
        void Router.prefetch(postPath)
      }
    }, 65)
  }, [clearPrefetchTimer, postPath])

  const handleNavigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      event.preventDefault()
      clearPrefetchTimer()
      void Router.push(postPath)
    },
    [clearPrefetchTimer, postPath]
  )

  return (
    <StyledWrapper data-layout={layout} data-ui="feed-post-card">
      <article>
        <dl className="dateList">
          <dt className="srOnly">{t("metaDate")}</dt>
          <dd className="publishedDate meta">
            {createdAtText ? <time dateTime={rawDate}>{createdAtText}</time> : null}
            {sortMode === "views" && typeof data.hitCount === "number" ? (
              <span className="sortMetric">
                {createdAtText ? " · " : ""}
                {t("postViewsMeta")} {data.hitCount}
              </span>
            ) : null}
            {sortMode === "likes" && typeof data.likesCount === "number" ? (
              <span className="sortMetric">
                {createdAtText ? " · " : ""}
                {t("postLikesMeta")} {data.likesCount}
              </span>
            ) : null}
          </dd>
        </dl>
        <div className="contentBlock">
          <div className="headingGroup">
            <Link
              href={postPath}
              className="postTitleLink"
              onClick={handleNavigate}
              onMouseEnter={schedulePrefetch}
              onMouseLeave={clearPrefetchTimer}
              onTouchStart={schedulePrefetch}
              onTouchEnd={clearPrefetchTimer}
              onTouchCancel={clearPrefetchTimer}
              onFocus={schedulePrefetch}
              onBlur={clearPrefetchTimer}
            >
              <h2>{renderHighlightedText(data.title, searchQuery)}</h2>
            </Link>
            {tags.length > 0 ? (
              <div className="tagRow">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/?tag=${encodeURIComponent(tag)}`}
                    className="tagLink"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {data.summary ? (
            <p className="summary">{renderHighlightedText(data.summary, searchQuery)}</p>
          ) : null}
        </div>
      </article>
    </StyledWrapper>
  )
}

export default memo(PostCard)

const StyledWrapper = styled.div`
  position: relative;
  min-width: 0;
  color: var(--aq-text);

  a:not(.postTitleLink),
  button {
    position: relative;
    z-index: 1;
  }

  &[data-layout="pinned"] {
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--aq-border);
  }

  article {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    background: transparent;
    border: 0;
  }

  .srOnly {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .dateList {
    margin: 0;
  }

  .publishedDate {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.5rem;
    font-weight: 500;
    color: var(--aq-muted);
  }

  .sortMetric {
    font-variant-numeric: tabular-nums;
  }

  .contentBlock {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .headingGroup {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .postTitleLink {
    display: block;
    color: var(--aq-text);
    text-decoration: none;

    &::after {
      content: "";
      position: absolute;
      inset: 0;
    }

    &:hover h2 {
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 4px;
      border-radius: 4px;
    }
  }

  h2 {
    margin: 0;
    color: var(--aq-text);
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
    word-break: keep-all;
    transition: color 120ms ease;
  }

  .tagRow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    margin-top: 0.125rem;
  }

  .tagLink {
    display: inline-flex;
    align-items: center;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--aq-accent-link, var(--aq-accent));
    text-decoration: none;
    transition: color 120ms ease;

    &:hover {
      color: var(--aq-text);
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 2px;
    }

    @media (pointer: coarse) {
      min-height: 44px;
      padding: 0 0.25rem;
    }
  }

  .summary {
    margin: 0;
    color: var(--aq-muted);
    font-size: 1rem;
    line-height: 1.625;
    font-weight: 400;
    max-width: none;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: ${uiTokens.feed.card.summaryLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  mark {
    background: var(--aq-accent-muted);
    color: var(--aq-accent-link, var(--aq-accent));
    border-radius: 3px;
    padding: 0 0.14em;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    h2,
    .tagLink {
      transition: none;
    }
  }
`
