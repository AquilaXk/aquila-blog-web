// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/blocks/dashboard-01/components/data-table.tsx (MIT), TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT)
import { useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
import AppIcon from "./AdminAppIcon"
import { useLanguage } from "src/libs/language"
import { focusVisibleRing } from "src/design-system/focusRing"
import {
  adminBorder,
  adminBorderStrong,
  adminControlText,
  adminMutedSurface,
  adminSurface,
  adminSurfaceMuted,
  adminSurfaceRaised,
  adminTeal,
  adminTextMuted,
  adminTextPrimary,
  adminTextSecondary,
} from "./adminColorTokens"
import { adminT } from "./adminI18n"
import {
  DEFAULT_SORT,
  type AdminPostsFacetCounts,
  type ListSort,
  type PostListScope,
  type PostStatusFilter,
} from "./AdminPostsWorkspaceModel"

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'

type AdminPostsWorkspaceFilterToolbarProps = {
  listScope: PostListScope
  listStatus: PostStatusFilter
  listKw: string
  listSort: ListSort
  facetCounts?: AdminPostsFacetCounts | null
  onStatusChange: (status: PostStatusFilter) => void
  onKeywordChange: (value: string) => void
  onSortChange: (sort: ListSort) => void
  onResetFilters: () => void
}

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable
}

export const AdminPostsWorkspaceFilterToolbar: React.FC<AdminPostsWorkspaceFilterToolbarProps> = ({
  listScope,
  listStatus,
  listKw,
  listSort,
  facetCounts,
  onStatusChange,
  onKeywordChange,
  onSortChange,
  onResetFilters,
}) => {
  const { language } = useLanguage()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const isComposingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localKw, setLocalKw] = useState(listKw)
  const hasActiveFilter = listStatus !== "all" || listKw.trim().length > 0 || listSort !== DEFAULT_SORT

  useEffect(() => {
    setLocalKw(listKw)
  }, [listKw])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = event.target.value
    setLocalKw(nextVal)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (!isComposingRef.current) {
        onKeywordChange(nextVal)
      }
    }, 280)
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false
    const val = (event.target as HTMLInputElement).value
    setLocalKw(val)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onKeywordChange(val)
    }, 100)
  }

  const getTabCount = (status: PostStatusFilter): number | undefined => {
    if (!facetCounts) return undefined
    switch (status) {
      case "all":
        return facetCounts.all
      case "published":
        return facetCounts.published
      case "draft":
        return facetCounts.draft
      case "unlisted":
        return facetCounts.unlisted
      case "private":
        return facetCounts.privateCount
      case "deleted":
        return facetCounts.deleted
      default:
        return undefined
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return
      if (isEditableEventTarget(event.target)) return
      const input = searchInputRef.current
      if (!input) return
      event.preventDefault()
      input.focus()
      input.select?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <ToolbarSurface>
      <FilterRail>
        <ScopeTabs role="group" aria-label={adminT("navPosts", language)}>
          {[
            ["all", adminT("filterAll", language)],
            ["draft", adminT("filterDraft", language)],
            ["published", adminT("filterPublished", language)],
            ["unlisted", language === "en" ? "Unlisted" : "링크 공개"],
            ["private", adminT("filterPrivate", language)],
            ["deleted", adminT("filterDeleted", language)],
          ].map(([value, label]) => {
            const count = getTabCount(value as PostStatusFilter)
            const isActive = listStatus === value
            return (
              <ScopeTabButton
                key={value}
                type="button"
                aria-pressed={isActive}
                data-active={isActive}
                onClick={() => onStatusChange(value as PostStatusFilter)}
              >
                <span>{label}</span>
                {typeof count === "number" ? (
                  <ScopeTabBadge className="countBadge" aria-hidden="true">
                    {count}
                  </ScopeTabBadge>
                ) : null}
              </ScopeTabButton>
            )
          })}
        </ScopeTabs>

        <ToolbarControls>
          <SearchField>
            <SearchLeadingIcon aria-hidden="true">
              <AppIcon name="search" width={14} height={14} />
            </SearchLeadingIcon>
            <input
              ref={searchInputRef}
              id="workspace-post-search"
              aria-label={adminT("postsSearchAria", language)}
              placeholder={adminT("postsSearchPlaceholder", language)}
              value={localKw}
              onChange={handleInputChange}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            />
            {localKw ? (
              <ClearSearchButton
                type="button"
                aria-label={adminT("postsClearSearchAria", language)}
                onClick={() => {
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
                  setLocalKw("")
                  onKeywordChange("")
                  searchInputRef.current?.focus()
                }}
              >
                <AppIcon name="close" width={14} height={14} />
              </ClearSearchButton>
            ) : (
              <SearchShortcutKbd aria-hidden="true">/</SearchShortcutKbd>
            )}
          </SearchField>

          <SortControls>
            <SortField>
              <select
                aria-label="글 정렬"
                value={listSort}
                disabled={listScope === "deleted"}
                onChange={(event) => onSortChange(event.target.value as ListSort)}
              >
                <option value={DEFAULT_SORT}>{adminT("sortRecentlyUpdated", language)}</option>
                <option value="CREATED_AT">{adminT("sortNewestFirst", language)}</option>
                <option value="CREATED_AT_ASC">{adminT("sortOldestFirst", language)}</option>
                <option value="HIT_COUNT">{adminT("sortMostViewed", language)}</option>
                <option value="LIKES_COUNT">{adminT("sortMostLiked", language)}</option>
              </select>
            </SortField>
            {hasActiveFilter ? (
              <FilterResetButton type="button" onClick={onResetFilters}>
                {adminT("filterReset", language)}
              </FilterResetButton>
            ) : null}
          </SortControls>
        </ToolbarControls>
      </FilterRail>
    </ToolbarSurface>
  )
}

const ToolbarSurface = styled.div`
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px solid ${adminBorder};
  background: transparent;
  border-radius: 0;

  @media (max-width: 980px) {
    padding: 0 0 0.65rem;
  }
`

const FilterRail = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;

  @media (max-width: 980px) {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }
`

const ScopeTabs = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0.12rem;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scroll-snap-type: inline proximity;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 980px) {
    border-bottom: 1px solid ${adminBorder};
  }
`

const ScopeTabButton = styled.button<{ "data-active"?: boolean }>`
  position: relative;
  flex: none;
  scroll-snap-align: start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  min-height: 44px;
  padding: 0 0.68rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${adminTextMuted};
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
  }

  &[aria-pressed="true"] {
    color: ${adminTextPrimary};

    &::after {
      content: "";
      position: absolute;
      inset: auto 0.35rem 0;
      border-block-end: 2px solid ${adminTeal};
    }
  }

  @media (pointer: coarse) {
    min-width: 44px;
    padding: 0 0.58rem;
  }
`

const ScopeTabBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.2rem;
  padding: 0 0.35rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: ${MONO_FONT};
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  background: ${adminSurfaceMuted};
  color: ${adminTextSecondary};

  [aria-pressed="true"] > & {
    background: ${adminSurfaceRaised};
    border-color: ${adminBorder};
    color: ${adminTextPrimary};
  }
`

const ToolbarControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  padding: 0.48rem 0;

  @media (max-width: 980px) {
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`

const SearchField = styled.div`
  position: relative;
  display: grid;
  min-width: 13.5rem;

  @media (max-width: 980px) {
    min-width: 0;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 34px;
    height: 34px;
    border-radius: 6px;
    border: 1px solid ${adminBorder};
    background: ${adminSurfaceRaised};
    color: ${adminTextPrimary};
    padding: 0 2rem 0 1.95rem;
    font-size: 0.81rem;
    ${focusVisibleRing}

    &::placeholder {
      color: ${adminTextMuted};
    }

    &:hover {
      border-color: ${adminBorderStrong};
    }

    &:focus {
      background: ${adminSurface};
    }

    @media (pointer: coarse) {
      min-height: 44px;
      height: auto;
      font-size: 1rem;
      padding: 0 2.4rem 0 2.05rem;
    }
  }
`

const SearchLeadingIcon = styled.span`
  position: absolute;
  inset-block: 0;
  left: 0.62rem;
  display: inline-flex;
  align-items: center;
  color: ${adminTextMuted};
  pointer-events: none;
`

const SearchShortcutKbd = styled.kbd`
  position: absolute;
  inset-block: 0;
  right: 0.42rem;
  margin-block: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.25rem;
  border-radius: 4px;
  border: 0;
  background: ${adminSurfaceMuted};
  color: ${adminTextMuted};
  font-family: ${MONO_FONT};
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
`

const ClearSearchButton = styled.button`
  position: absolute;
  inset-block: 0;
  right: 0.28rem;
  margin-block: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${adminTextMuted};
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    background: ${({ theme }) => adminMutedSurface(theme)};
  }

  @media (pointer: coarse) {
    right: 0;
    width: 44px;
    height: 44px;
  }
`

const SortControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.38rem;
  min-width: 0;
`

const SortField = styled.div`
  display: grid;
  min-width: 8.2rem;

  @media (max-width: 560px) {
    flex: 1 1 auto;
  }

  select {
    box-sizing: border-box;
    width: 100%;
    min-height: 34px;
    height: 34px;
    border-radius: 6px;
    border: 1px solid ${adminBorder};
    background: ${adminSurface};
    color: ${adminTextPrimary};
    padding: 0 0.65rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    ${focusVisibleRing}

    &:hover:not(:disabled) {
      border-color: ${adminBorderStrong};
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    @media (pointer: coarse) {
      min-height: 44px;
      height: auto;
      font-size: 1rem;
    }
  }
`

const FilterResetButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  height: 34px;
  padding: 0 0.68rem;
  border-radius: 6px;
  border: 1px solid ${adminBorder};
  background: ${adminSurface};
  color: ${adminTextSecondary};
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    color: ${adminTextPrimary};
    background: ${adminSurfaceRaised};
  }

  @media (pointer: coarse) {
    min-height: 44px;
    height: auto;
  }
`
