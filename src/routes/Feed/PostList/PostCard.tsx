import { CONFIG } from "site.config"
import { formatDate } from "src/libs/utils"
import type { TPost } from "src/types"
import styled from "@emotion/styled"
import { uiTokens } from "@shared/ui-tokens"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { memo, useCallback, type MouseEvent } from "react"
import Router from "next/router"
import { useLanguage } from "src/libs/language"
import ProfileImage from "src/components/ProfileImage"

type Props = {
  data: TPost
  layout?: "regular" | "pinned"
}

const PostCard: React.FC<Props> = ({ data, layout = "regular" }) => {
  const { language, t } = useLanguage()
  const postPath = toCanonicalPostPath(data.id)
  const isEn = language === "en"
  const currentLang = isEn ? "en-US" : (CONFIG.lang || "ko-KR")
  const createdAtText = formatDate(data.date?.start_date || data.createdTime, currentLang)

  const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null
  const authorName = postAuthor?.name?.trim() || (isEn ? "Anonymous" : "익명")
  const authorImageSrc = postAuthor?.profile_photo || ""

  const handleNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    void Router.push(postPath)
  }, [postPath])

  return (
    <StyledWrapper href={postPath} data-layout={layout} data-ui="feed-post-card" onClick={handleNavigate}>
      <article>
        <header><h2>{data.title}</h2></header>
        {data.summary && <p className="summary">{data.summary}</p>}
        <div className="meta">
          {createdAtText && <span>{t("metaDate")} {createdAtText}</span>}
          {createdAtText && authorName && <span aria-hidden="true">|</span>}
          {authorName && (
            <span className="author">
              <span>{t("metaAuthor")}</span>
              <span className="avatar">
                {authorImageSrc ? (
                  <ProfileImage
                    src={authorImageSrc}
                    alt={`${authorName} profile image`}
                    fillContainer
                    width={20}
                    height={20}
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
  color: var(--aq-text);
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 4px;
  }

  article { min-width: 0; }

  h2 {
    margin: 0;
    color: var(--aq-text);
    font-size: 1.5rem;
    line-height: 1.3;
    font-weight: 600;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
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
    gap: 0.35rem;
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
    width: 20px;
    height: 20px;
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
    border-radius: 999px 999px 2px 2px;
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
