// 참조 구현: shadcn-ui/ui apps/v4/registry/new-york-v4/ui/command.tsx (MIT), TryGhost/Ghost apps/admin/src/global-search/global-search-modal.tsx (MIT), pacocoursey/cmdk (MIT)
import { useRouter } from "next/router"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import AppIcon from "./AdminAppIcon"
import { useLanguage } from "src/libs/language"
import {
  ClosePaletteButton,
  EmptyNotice,
  FooterCount,
  FooterHints,
  GroupBlock,
  GroupLabel,
  ItemIcon,
  ItemList,
  ItemMain,
  ItemRow,
  KeyChord,
  PaletteFooter,
  PaletteModal,
  PaletteScrim,
  SearchBox,
  SearchInput,
  SearchLeadIcon,
  ShortcutHint,
} from "./AdminCommandPalette.styles"
import {
  clampSelectedIndex,
  filterPaletteItems,
  getAdminPaletteItems,
  type AdminPaletteItem,
} from "./AdminCommandPaletteModel"

type Props = {
  isOpen: boolean
  onClose: () => void
}

const renderHighlightedLabel = (text: string, rawTerm: string) => {
  const term = rawTerm.trim().toLowerCase()
  if (!term) return text
  const lower = text.toLowerCase()
  const idx = lower.indexOf(term)
  if (idx < 0) return text
  return (
    <Fragment>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </Fragment>
  )
}

export const AdminCommandPalette = ({ isOpen, onClose }: Props) => {
  const router = useRouter()
  const { language, setLanguage } = useLanguage()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ko" ? "en" : "ko")
    onClose()
  }, [language, onClose, setLanguage])

  const allItems = useMemo(
    () => getAdminPaletteItems(language, toggleLanguage),
    [language, toggleLanguage]
  )

  const filteredItems = useMemo(
    () => filterPaletteItems(allItems, query),
    [allItems, query]
  )

  const orderedSections = useMemo(() => {
    const actionsRaw: AdminPaletteItem[] = []
    const navRaw: AdminPaletteItem[] = []
    for (let i = 0; i < filteredItems.length; i += 1) {
      if (filteredItems[i].group === "actions") actionsRaw.push(filteredItems[i])
      else navRaw.push(filteredItems[i])
    }

    const ordered: AdminPaletteItem[] = [...actionsRaw, ...navRaw]
    const actions: Array<{ item: AdminPaletteItem; flatIndex: number }> = []
    const navigation: Array<{ item: AdminPaletteItem; flatIndex: number }> = []
    for (let i = 0; i < ordered.length; i += 1) {
      const entry = { item: ordered[i], flatIndex: i }
      if (ordered[i].group === "actions") actions.push(entry)
      else navigation.push(entry)
    }

    return {
      ordered,
      actions,
      navigation,
    }
  }, [filteredItems])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const selectedItem = orderedSections.ordered[selectedIndex]
    if (!selectedItem || !listRef.current) return
    const row = listRef.current.querySelector<HTMLElement>(
      `#palette-item-${selectedItem.id}`
    )
    row?.scrollIntoView?.({ block: "nearest" })
  }, [orderedSections.ordered, selectedIndex])

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery("")
    setSelectedIndex(0)

    const timer = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => {
      cancelAnimationFrame(timer)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key === "Tab") {
        const modal = modalRef.current
        if (!modal) return
        const focusable = modal.querySelectorAll<HTMLElement>(
          'input, button:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDownCapture, true)
    return () => window.removeEventListener("keydown", handleKeyDownCapture, true)
  }, [isOpen, onClose])

  const handleSelectItem = useCallback(
    (item: AdminPaletteItem) => {
      onClose()
      if (item.action) {
        item.action()
      } else if (item.href) {
        void router.push(item.href)
      }
    },
    [onClose, router]
  )

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const count = orderedSections.ordered.length
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedIndex((idx) => clampSelectedIndex(idx, 1, count))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedIndex((idx) => clampSelectedIndex(idx, -1, count))
    } else if (event.key === "Home") {
      event.preventDefault()
      setSelectedIndex(0)
    } else if (event.key === "End") {
      event.preventDefault()
      setSelectedIndex(Math.max(0, count - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const selected = orderedSections.ordered[selectedIndex]
      if (selected) {
        handleSelectItem(selected)
      }
    }
  }

  if (!isOpen) return null

  const activeItem = orderedSections.ordered[selectedIndex]

  const renderGroup = (
    heading: string,
    entries: Array<{ item: AdminPaletteItem; flatIndex: number }>,
    showTopRule = false
  ) => {
    if (entries.length === 0) return null
    return (
      <GroupBlock role="group" aria-label={heading} $topRule={showTopRule}>
        <GroupLabel>{heading}</GroupLabel>
        {entries.map(({ item, flatIndex }) => {
          const isSelected = flatIndex === selectedIndex
          const shortcutTokens = item.shortcut ? item.shortcut.split(" ") : []
          return (
            <ItemRow
              key={item.id}
              id={`palette-item-${item.id}`}
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected ? "true" : "false"}
              onClick={() => handleSelectItem(item)}
              onMouseEnter={() => setSelectedIndex(flatIndex)}
            >
              <ItemIcon aria-hidden="true">
                <AppIcon name={item.icon ?? "spark"} width={16} height={16} />
              </ItemIcon>
              <ItemMain>
                <strong>{renderHighlightedLabel(item.label, query)}</strong>
                {item.subLabel ? <small>{item.subLabel}</small> : null}
              </ItemMain>
              {shortcutTokens.length > 0 ? (
                <KeyChord aria-hidden="true">{shortcutTokens.join(" ")}</KeyChord>
              ) : null}
            </ItemRow>
          )
        })}
      </GroupBlock>
    )
  }

  return (
    <PaletteScrim
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <PaletteModal
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={language === "en" ? "Command Palette" : "커맨드 팔레트"}
      >
        <SearchBox>
          <SearchLeadIcon aria-hidden="true">
            <AppIcon name="search" width={17} height={17} />
          </SearchLeadIcon>
          <SearchInput
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={
              activeItem ? `palette-item-${activeItem.id}` : undefined
            }
            placeholder={
              language === "en"
                ? "Search commands or workspaces..."
                : "명령어 입력 또는 이동할 페이지 검색..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <ClosePaletteButton
            type="button"
            aria-label={language === "en" ? "Close command palette" : "커맨드 팔레트 닫기"}
            onClick={onClose}
          >
            <ShortcutHint>Esc</ShortcutHint>
          </ClosePaletteButton>
        </SearchBox>

        <ItemList ref={listRef} id="admin-palette-list" role="listbox">
          {orderedSections.ordered.length === 0 ? (
            <EmptyNotice>
              {language === "en"
                ? "No matching commands found."
                : "일치하는 명령이나 페이지가 없습니다."}
            </EmptyNotice>
          ) : (
            <>
              {renderGroup(
                language === "en" ? "Quick Actions" : "빠른 작업",
                orderedSections.actions,
                false
              )}
              {renderGroup(
                language === "en" ? "Workspaces" : "페이지 이동",
                orderedSections.navigation,
                orderedSections.actions.length > 0
              )}
            </>
          )}
        </ItemList>

        <PaletteFooter>
          <FooterHints>
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> {language === "en" ? "Select" : "이동"}
            </span>
            <span>
              <kbd>↵</kbd> {language === "en" ? "Run" : "실행"}
            </span>
            <span>
              <kbd>G</kbd> + <kbd>P</kbd> {language === "en" ? "Jump" : "2-키 이동"}
            </span>
          </FooterHints>
          <FooterCount>
            {orderedSections.ordered.length}
            {language === "en" ? " commands" : "개 명령"}
          </FooterCount>
        </PaletteFooter>
      </PaletteModal>
    </PaletteScrim>
  )
}
