/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/ListLayoutWithTags.tsx, components/Tag.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { useRouter } from "next/router"
import React, { memo, startTransition, useCallback, useMemo, useState } from "react"
import { usePostsTotalCountQuery } from "src/hooks/usePostsTotalCountQuery"
import { useTagsQuery } from "src/hooks/useTagsQuery"
import { normalizeOptionalTagQuery } from "src/libs/query/normalize"
import { replaceShallowRoutePreservingScroll } from "src/libs/router"
import { useLanguage } from "src/libs/language"
import {
  FEED_TAG_RAIL_DESKTOP_MIN_PX,
  FEED_TAG_REPRESENTATIVE_CHIP_LIMIT,
  FEED_TAG_REPRESENTATIVE_DESKTOP_LIMIT,
  MOBILE_TOUCH_TARGET_MIN_PX,
} from "./feedUiTokens"

type TagEntry = [string, number]

export const TAG_EXPAND_DESKTOP = 1
export const TAG_EXPAND_CHIP = 1 << 1

const toRepresentativeTagEntries = (
  tagEntries: TagEntry[],
  currentTag: string | undefined,
  limit: number,
  expanded: boolean
) => {
  if (expanded || tagEntries.length <= limit) return tagEntries
  if (limit <= 0) return []

  const leadingEntries = tagEntries.slice(0, limit)
  if (!currentTag) return leadingEntries

  const currentEntry = tagEntries.find(([tag]) => tag === currentTag)
  if (!currentEntry) return leadingEntries
  if (leadingEntries.some(([tag]) => tag === currentTag)) return leadingEntries
  if (limit === 1) return [currentEntry]

  return [...leadingEntries.slice(0, limit - 1), currentEntry]
}

const TagList: React.FC = () => {
  const router = useRouter()
  const { t } = useLanguage()
  const currentTag = normalizeOptionalTagQuery(
    typeof router.query.tag === "string" ? router.query.tag : undefined
  )
  const [expandMask, setExpandMask] = useState(0)
  const desktopExpanded = (expandMask & TAG_EXPAND_DESKTOP) !== 0
  const chipExpanded = (expandMask & TAG_EXPAND_CHIP) !== 0
  const totalPostCount = usePostsTotalCountQuery()
  const { tagEntries } = useTagsQuery()
  const allCount = totalPostCount

  const navigateWithTag = useCallback((value?: string) => {
    const {
      category: _deprecatedCategory,
      q: rawQ,
      sort: rawSort,
      ...restQuery
    } = router.query
    const preservedQ = typeof rawQ === "string" && rawQ.trim().length > 0 ? rawQ.trim() : undefined
    const preservedSort =
      rawSort === "views" || rawSort === "likes" ? rawSort : undefined
    startTransition(() => {
      void replaceShallowRoutePreservingScroll(router, {
        pathname: "/",
        query: {
          ...restQuery,
          q: preservedQ,
          sort: preservedSort,
          tag: value,
        },
      })
    })
  }, [router])

  const handleClickAll = useCallback(() => {
    if (!currentTag) return
    navigateWithTag(undefined)
  }, [currentTag, navigateWithTag])

  const handleClickTag = useCallback((value: string) => {
    if (currentTag === value) {
      navigateWithTag(undefined)
      return
    }
    navigateWithTag(value)
  }, [currentTag, navigateWithTag])

  const handleClickTagButton = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const value = event.currentTarget.dataset.tag
      if (!value) return
      handleClickTag(value)
    },
    [handleClickTag]
  )

  const desktopTagEntries = useMemo(
    () =>
      toRepresentativeTagEntries(
        tagEntries,
        currentTag,
        FEED_TAG_REPRESENTATIVE_DESKTOP_LIMIT,
        desktopExpanded
      ),
    [currentTag, desktopExpanded, tagEntries]
  )
  const chipTagEntries = useMemo(
    () =>
      toRepresentativeTagEntries(
        tagEntries,
        currentTag,
        FEED_TAG_REPRESENTATIVE_CHIP_LIMIT,
        chipExpanded
      ),
    [chipExpanded, currentTag, tagEntries]
  )
  const hasExcessDesktopTags = tagEntries.length > FEED_TAG_REPRESENTATIVE_DESKTOP_LIMIT
  const hasExcessChipTags = tagEntries.length > FEED_TAG_REPRESENTATIVE_CHIP_LIMIT
  const hiddenDesktopTagCount = Math.max(tagEntries.length - FEED_TAG_REPRESENTATIVE_DESKTOP_LIMIT, 0)
  const hiddenChipTagCount = Math.max(tagEntries.length - FEED_TAG_REPRESENTATIVE_CHIP_LIMIT, 0)

  return (
    <StyledWrapper id="topics">
      <section className="desktopPanel" aria-label={t("tagListAria")}>
        <div className="panelInner">
          <button
            type="button"
            className="allPostsButton"
            data-active={!currentTag}
            aria-pressed={!currentTag}
            aria-label={t("tagViewAllAria")}
            onClick={handleClickAll}
          >
            <span>{t("tagAll")}</span>
            {typeof allCount === "number" ? <span className="allCount">({allCount})</span> : null}
          </button>
          <ul className="desktopList">
            {desktopTagEntries.map(([key, count]) => (
              <li key={key}>
                <button
                  type="button"
                  data-tag={key}
                  data-active={key === currentTag}
                  aria-pressed={key === currentTag}
                  onClick={handleClickTagButton}
                >
                  <span className="name">{key}</span>
                  <span className="count">({count})</span>
                </button>
              </li>
            ))}
          </ul>
          {hasExcessDesktopTags && (
            <button
              type="button"
              className="toggleButton"
              aria-expanded={desktopExpanded}
              onClick={() => setExpandMask((prev) => prev ^ TAG_EXPAND_DESKTOP)}
            >
              {desktopExpanded ? t("foldTags") : `${t("moreTags")} (+${hiddenDesktopTagCount})`}
            </button>
          )}
        </div>
      </section>

      <div
        className="chipRail mobileTags"
        data-topics-mobile="true"
        data-ui="feed-tag-chip-rail"
        role="group"
        aria-label={t("tagSelectAria")}
      >
        <button
          type="button"
          data-active={!currentTag}
          aria-pressed={!currentTag}
          aria-label={t("tagViewAllAria")}
          onClick={handleClickAll}
        >
          <span className="name">{t("tagAll")}</span>
          {typeof allCount === "number" && <span className="count">({allCount})</span>}
        </button>
        {chipTagEntries.map(([key, count]) => (
          <button
            type="button"
            key={key}
            data-tag={key}
            data-active={key === currentTag}
            aria-pressed={key === currentTag}
            onClick={handleClickTagButton}
          >
            <span className="name">{key}</span>
            <span className="count">({count})</span>
          </button>
        ))}
        {hasExcessChipTags && (
          <button
            type="button"
            className="chipToggle"
            aria-expanded={chipExpanded}
            onClick={() => setExpandMask((prev) => prev ^ TAG_EXPAND_CHIP)}
          >
            <span className="name">{chipExpanded ? t("foldTags") : t("moreTags")}</span>
            {!chipExpanded && <span className="count">(+{hiddenChipTagCount})</span>}
          </button>
        )}
      </div>
    </StyledWrapper>
  )
}

export default memo(TagList)

const StyledWrapper = styled.div`
  min-width: 0;
  scroll-margin-top: calc(var(--app-header-height, 65px) + 12px);
  border-radius: 0.25rem;
  transition: outline-color 180ms ease, background-color 180ms ease;

  &[data-topics-highlighted="true"] {
    outline: 2px solid var(--aq-focus-ring);
    outline-offset: 4px;
    background: var(--aq-surface-subtle);
  }

  .desktopPanel {
    display: none;
    width: 220px;
    min-width: 220px;
    max-width: 220px;
    align-self: flex-start;
    border: 0;
    border-right: 1px solid var(--aq-border);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    position: sticky;
    top: calc(var(--app-header-height, 65px) + 1.5rem);
    max-height: calc(100vh - var(--app-header-height, 65px) - 2.5rem);
    max-height: calc(100dvh - var(--app-header-height, 65px) - 2.5rem);
    overflow: hidden;
  }

  .panelInner {
    display: flex;
    flex-direction: column;
    padding: 0.25rem 1.25rem 0.5rem 0;
    max-height: inherit;
    min-height: 0;
  }

  .allPostsButton {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.65rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--aq-text);
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 140ms ease, background-color 140ms ease;

    &[data-active="true"] {
      color: var(--aq-accent-link, var(--aq-accent));
      background: var(--aq-accent-muted);
      box-shadow: inset 2.5px 0 0 var(--aq-accent);
      cursor: default;
    }

    @media (hover: hover) {
      &:hover:not([data-active="true"]) {
        color: var(--aq-accent-link, var(--aq-accent));
        background: var(--aq-surface-subtle);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 0.5rem;
    }

    .allCount {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: inherit;
      opacity: 0.82;
    }
  }

  .desktopList {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
  }

  .desktopList li {
    margin: 0.1875rem 0;
    min-width: 0;
  }

  .desktopList button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4375rem 0.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--aq-muted);
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition:
      color 140ms ease,
      background-color 140ms ease;

    @media (hover: hover) {
      &:hover {
        background: var(--aq-surface-subtle);
        color: var(--aq-accent-link, var(--aq-accent));
      }
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 1px;
    }

    &[data-active="true"] {
      background: var(--aq-surface-subtle);
      color: var(--aq-accent-link, var(--aq-accent));
      box-shadow: inset 2.5px 0 0 var(--aq-accent);
      font-weight: 700;
    }

    .name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .count {
      flex-shrink: 0;
      min-width: 2.2ch;
      text-align: right;
      font-size: 0.75rem;
      line-height: 1;
      color: var(--aq-subtle);
      font-variant-numeric: tabular-nums;
    }

    &[data-active="true"] .count {
      color: var(--aq-accent-link, var(--aq-accent));
    }
  }

  .toggleButton {
    margin-top: 0.5rem;
    min-height: 32px;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--aq-muted);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: left;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 140ms ease, background-color 140ms ease;

    @media (hover: hover) {
      &:hover {
        background: var(--aq-surface-subtle);
        color: var(--aq-accent-link, var(--aq-accent));
      }
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
      border-radius: 0.5rem;
    }
  }

  @media (pointer: coarse) {
    .allPostsButton,
    .desktopList button,
    .toggleButton {
      min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
    }
  }

  .chipRail {
    display: flex;
    width: 100%;
    max-width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 0.375rem 0.5rem;
  }

  .chipRail button {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    min-height: ${MOBILE_TOUCH_TARGET_MIN_PX}px;
    padding: 0.25rem 0.875rem;
    border-radius: 9999px;
    border: 1px solid var(--aq-border);
    background: var(--aq-surface);
    color: var(--aq-muted);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease;

    @media (hover: hover) {
      &:hover {
        border-color: var(--aq-border-strong);
        color: var(--aq-text);
      }
    }

    &[data-active="true"] {
      border-color: var(--aq-accent);
      background: var(--aq-surface-subtle);
      color: var(--aq-accent-link, var(--aq-accent));
      font-weight: 700;
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }

    .count {
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      opacity: 0.82;
    }
  }

  .chipRail .chipToggle {
    background: var(--aq-surface-subtle);
  }

  @media (min-width: ${FEED_TAG_RAIL_DESKTOP_MIN_PX}px) {
    .desktopPanel {
      display: flex;
      flex-direction: column;
    }

    .chipRail {
      display: none;
    }
  }
`
