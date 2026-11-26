import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useLanguage } from "src/libs/language"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import { getPostSeries, type PublicSeriesPostItem } from "src/apis/backend/posts/PostApiSeriesRequests"

export type PostDetailSeriesCardProps = {
  seriesName: string | null
  items: PublicSeriesPostItem[]
  currentPostId: string
}

export type PostDetailSeriesLookupCardProps = {
  seriesName: string
  postId: string
}

const SeriesCard = styled.section`
  margin-top: 2rem;
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--aq-border);
  border-radius: 0.75rem;
  background: var(--aq-surface-subtle);
  display: grid;
  gap: 0.75rem;
`

const SeriesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  .seriesKicker {
    display: block;
    color: var(--aq-muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0.15rem 0 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--aq-text);
  }

  .seriesCount {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--aq-text-secondary);
    font-variant-numeric: tabular-nums;
  }
`

const SeriesList = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.25rem;
`

const SeriesItemLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 36px;
  padding: 0.38rem 0.6rem;
  border-radius: 0.45rem;
  text-decoration: none;
  font-size: 0.88rem;
  line-height: 1.45;
  color: ${({ $active }) => ($active ? "var(--aq-accent-link, var(--aq-accent))" : "var(--aq-text-secondary)")};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  background: ${({ $active }) => ($active ? "var(--aq-surface)" : "transparent")};

  .orderBadge {
    flex-shrink: 0;
    min-width: 1.5rem;
    color: var(--aq-muted);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .itemTitle {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (hover: hover) {
    &:hover {
      background: var(--aq-surface);
      color: var(--aq-text);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--aq-accent);
    outline-offset: 2px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

export const PostDetailSeriesCard = ({
  seriesName,
  items,
  currentPostId,
}: PostDetailSeriesCardProps) => {
  const { language } = useLanguage()
  if (!seriesName || items.length === 0) return null
  const isEn = language === "en"
  const currentIdx = items.findIndex((item) => item.id === currentPostId)

  return (
    <SeriesCard aria-label={isEn ? `Series: ${seriesName}` : `연재 시리즈: ${seriesName}`} data-testid="post-series-card">
      <SeriesHeader>
        <div>
          <span className="seriesKicker">{isEn ? "SERIES" : "연재 시리즈"}</span>
          <h2>{seriesName}</h2>
        </div>
        <span className="seriesCount">
          {currentIdx >= 0 ? `${currentIdx + 1} / ${items.length}` : `${items.length}`}
        </span>
      </SeriesHeader>
      <SeriesList>
        {items.map((item, idx) => {
          const isActive = item.id === currentPostId
          const orderNum = item.seriesOrder ?? idx + 1
          return (
            <li key={item.id}>
              <SeriesItemLink
                href={toCanonicalPostPath(item.id)}
                $active={isActive}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="orderBadge">{String(orderNum).padStart(2, "0")}.</span>
                <span className="itemTitle">{item.title}</span>
              </SeriesItemLink>
            </li>
          )
        })}
      </SeriesList>
    </SeriesCard>
  )
}

export const PostDetailSeriesLookupCard = ({
  seriesName,
  postId,
}: PostDetailSeriesLookupCardProps) => {
  const seriesQuery = useQuery({
    queryKey: ["posts", "detail", "series", postId, seriesName] as const,
    queryFn: ({ signal }) => getPostSeries(postId, signal),
    enabled: Boolean(postId && seriesName),
    staleTime: 300_000,
    retry: 1,
  })
  const items = seriesQuery.data?.items ?? []
  const resolvedSeriesName = seriesQuery.data?.seriesName ?? seriesName
  if (!resolvedSeriesName || items.length === 0) return null
  return (
    <PostDetailSeriesCard
      seriesName={resolvedSeriesName}
      items={items}
      currentPostId={postId}
    />
  )
}
