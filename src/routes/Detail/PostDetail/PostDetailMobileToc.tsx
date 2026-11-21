/**
 * 참조 구현:
 * - withastro/starlight (packages/starlight/components/MobileTableOfContents.astro, MIT License)
 * - lucide-icons/lucide (icons/chevron-down.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import { memo, useMemo } from "react"
import { useLanguage } from "src/libs/language"
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
  const { t, language } = useLanguage()
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeTocId) ?? items[0] ?? null,
    [activeTocId, items]
  )
  if (items.length === 0) return null

  return (
    <details className="mobileToc" aria-label={language === "en" ? "Collapsible table of contents" : "접이식 목차"}>
      <summary className="mobileTocSummary">
        <span className="mobileTocSummaryLabel">{t("postTocLabel")}</span>
        {activeItem ? (
          <span className="mobileTocCurrentSection">{activeItem.text}</span>
        ) : null}
        <span className="mobileTocChevron" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <nav aria-label={t("postTocLabel")}>
        {hasDepth4Toc && onToggleDetailed ? (
          <div className="mobileTocHead">
            <button
              type="button"
              className="mobileTocDepthToggle"
              aria-pressed={Boolean(showDetailedToc)}
              onClick={onToggleDetailed}
            >
              {showDetailedToc ? t("postTocHideDetailed") : t("postTocShowDetailed")}
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
                  details?.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true })
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
