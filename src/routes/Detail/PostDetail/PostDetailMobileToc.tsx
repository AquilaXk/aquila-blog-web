import { memo } from "react"
import type { TocItem } from "./PostDetailTocModel"

type PostDetailMobileTocProps = {
  items: TocItem[]
  activeTocId: string
  hasDepth4Toc?: boolean
  showDetailedToc?: boolean
  onToggleDetailed?: () => void
  onNavigate: (id: string) => void
}

const PostDetailMobileToc = ({
  items,
  activeTocId,
  hasDepth4Toc = false,
  showDetailedToc = false,
  onToggleDetailed,
  onNavigate,
}: PostDetailMobileTocProps) => {
  if (items.length === 0) return null

  return (
    <details className="mobileToc" aria-label="접이식 목차">
      <summary className="mobileTocSummary">목차</summary>
      <nav aria-label="목차">
        {hasDepth4Toc && onToggleDetailed ? (
          <div className="mobileTocHead">
            <button
              type="button"
              className="mobileTocDepthToggle"
              aria-pressed={Boolean(showDetailedToc)}
              onClick={onToggleDetailed}
            >
              {showDetailedToc ? "h4 접기" : "h4 보기"}
            </button>
          </div>
        ) : null}
        <ol className="mobileTocList">
          {items.map((item) => (
            <li key={item.id} data-level={item.level}>
              <button
                type="button"
                data-active={activeTocId === item.id}
                aria-current={activeTocId === item.id ? "location" : undefined}
                title={item.text}
                aria-label={item.text}
                onClick={(event) => {
                  const details = event.currentTarget.closest("details")
                  details?.querySelector<HTMLElement>("summary")?.focus()
                  details?.removeAttribute("open")
                  onNavigate(item.id)
                }}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  )
}

export default memo(PostDetailMobileToc)
