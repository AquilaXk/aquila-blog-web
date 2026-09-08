import { CONFIG } from "site.config"
import { formatDate } from "src/libs/utils"
import type { TPost } from "src/types"
import styled from "@emotion/styled"
import { uiTokens } from "@shared/ui-tokens"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { memo, useCallback, type MouseEvent } from "react"
import Router from "next/router"

type Props = {
  data: TPost
  layout?: "regular" | "pinned"
}

const PostCard: React.FC<Props> = ({ data, layout = "regular" }) => {
  const postPath = toCanonicalPostPath(data.id)
  const createdAtText = formatDate(data.date?.start_date || data.createdTime, CONFIG.lang)
  const author = data.author?.map((entry) => entry.name).filter(Boolean).join(", ")
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
          <span>Date: {createdAtText}</span>
          {author && <><span aria-hidden="true">|</span><span>Author: {author}</span></>}
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
    gap: 0.35rem;
    margin-top: 10px;
    color: var(--aq-muted);
    font-size: ${uiTokens.feed.card.metaFontSizeRem}rem;
    line-height: 1.5;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover h2 { color: var(--aq-accent-link); }
  }

  @media (prefers-reduced-motion: reduce) {
    h2 { transition: none; }
  }
`
