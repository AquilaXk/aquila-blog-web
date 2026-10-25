import { CONFIG } from "site.config"
import { formatDate } from "src/libs/utils"
import type { TPost } from "src/types"
import styled from "@emotion/styled"
import { uiTokens } from "@shared/ui-tokens"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { memo, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react"
import Router from "next/router"
import { useLanguage } from "src/libs/language"
import ProfileImage from "src/components/ProfileImage"
import { getNavigatorConnection } from "src/routes/Feed/FeedExplorerRestoreModel"

const prefetchedPaths = new Set<string>()

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
}

const PostCard: React.FC<Props> = ({ data, layout = "regular" }) => {
  const { language, t } = useLanguage()
  const postPath = toCanonicalPostPath(data.id)
  const isEn = language === "en"
  const currentLang = isEn ? "en-US" : (CONFIG.lang || "ko-KR")
  const rawDate = data.createdAt || data.date?.start_date || data.createdTime || ""
  const createdAtText = useMemo(() => formatDate(rawDate, currentLang), [rawDate, currentLang])

  const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null
  const authorName = data.authorName?.trim() || postAuthor?.name?.trim() || (isEn ? "Anonymous" : "익명")
  const authorImageSrc = data.authorProfileImgUrl || postAuthor?.profile_photo || ""

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

  const handleNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    clearPrefetchTimer()
    void Router.push(postPath)
  }, [clearPrefetchTimer, postPath])

  return (
    <StyledWrapper
      href={postPath}
      data-layout={layout}
      data-ui="feed-post-card"
      onClick={handleNavigate}
      onMouseEnter={schedulePrefetch}
      onMouseLeave={clearPrefetchTimer}
      onTouchStart={schedulePrefetch}
      onTouchEnd={clearPrefetchTimer}
      onTouchCancel={clearPrefetchTimer}
      onFocus={schedulePrefetch}
      onBlur={clearPrefetchTimer}
    >
      <article>
        <header><h2>{data.title}</h2></header>
        {data.summary && <p className="summary">{data.summary}</p>}
        <div className="meta">
          {createdAtText && (
            <span>
              <span className="srOnly">{t("metaDate")} </span>
              {createdAtText}
            </span>
          )}
          {createdAtText && authorName && <span aria-hidden="true">·</span>}
          {authorName && (
            <span className="author">
              <span className="srOnly">{t("metaAuthor")} </span>
              <span className="avatar">
                {authorImageSrc ? (
                  <ProfileImage
                    src={authorImageSrc}
                    alt={`${authorName} profile image`}
                    fillContainer
                    width={16}
                    height={16}
                  />
                ) : (
                  <span className="avatarFallback" aria-hidden="true" />
                )}
              </span>
              <strong className="authorName">{authorName}</strong>
            </span>
          )}
        </div>
      </article>
    </StyledWrapper>
  )
}

export default memo(PostCard)

const StyledWrapper = styled.a`
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 760px;
  padding: 20px 0;
  border-bottom: 1px solid var(--aq-border);
  color: var(--aq-text);
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 4px;
  }

  article { min-width: 0; }

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

  h2 {
    margin: 0;
    color: var(--aq-text);
    font-size: 1.5rem;
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
    word-break: keep-all;
    text-wrap: balance;
    transition: color 120ms ease;
  }

  .summary {
    margin: 12px 0 0;
    color: var(--aq-muted);
    font-size: 1rem;
    line-height: 1.65;
    font-weight: 400;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: ${uiTokens.feed.card.summaryLines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin-top: 10px;
    color: var(--aq-muted);
    font-size: ${uiTokens.feed.card.metaFontSizeRem}rem;
    line-height: 1.5;
  }

  .author {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .avatar {
    position: relative;
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--aq-surface-elevated);
    box-shadow: inset 0 0 0 1px var(--aq-border);
    flex-shrink: 0;
    vertical-align: middle;

    img {
      object-fit: cover;
      object-position: center 38%;
    }
  }

  .avatarFallback {
    position: absolute;
    inset: 2.5px;
    display: block;
    color: var(--aq-muted);
  }

  .avatarFallback::before,
  .avatarFallback::after {
    content: "";
    position: absolute;
    left: 50%;
    background: currentColor;
    transform: translateX(-50%);
  }

  .avatarFallback::before {
    top: 0;
    width: 42%;
    aspect-ratio: 1;
    border-radius: 50%;
  }

  .avatarFallback::after {
    right: 0;
    bottom: 0;
    left: 0;
    height: 45%;
    border-radius: 50% 50% 2px 2px;
    transform: none;
  }

  .authorName {
    color: var(--aq-text);
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover h2 { color: var(--aq-accent-link); }
  }

  @media (prefers-reduced-motion: reduce) {
    h2 { transition: none; }
  }
`
