/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/Header.tsx, components/MobileNav.tsx, components/SearchButton.tsx, MIT License)
 */
import styled from "@emotion/styled"
import { control } from "src/design-system/tokens"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/router"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { waitForFeedSearchInputFocus } from "src/routes/Feed/feedSearchFocus"
import { useLanguage } from "src/libs/language"
import {
  MobileMenuBackdrop,
  MobileMenuLayer,
  MobileMenuPanel,
} from "./NavBarMobileMenu.styles"
import {
  CloseGlyph,
  focusTopicsRailElement,
  GlobeIcon,
  isTypingTarget,
  MenuIcon,
  primaryLinks,
  reportFocusFeedSearchFailure,
  SearchIcon,
  waitForFeedSearchRoute,
  waitForFocusTrapRestore,
} from "./NavBarSearchModel"

const LazyQuickSearchPalette = dynamic(
  () => import("src/components/quick-search/QuickSearchPalette"),
  { ssr: false }
)

const MOBILE_NAV_MAX_WIDTH_PX = 639

const NavBar = () => {
  const router = useRouter()
  const { language, toggleLanguage, t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickSearchLoaded, setQuickSearchLoaded] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [quickSearchFocusSignal, setQuickSearchFocusSignal] = useState(0)
  const quickSearchOpenRef = useRef(false)
  quickSearchOpenRef.current = quickSearchOpen
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const quickSearchReturnFocusRef = useRef<HTMLElement | null>(null)
  const [activeHash, setActiveHash] = useState<string | null>(null)
  const focusFeedSearchInFlightRef = useRef<Promise<void> | null>(null)

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const closeQuickSearch = useCallback(() => {
    setQuickSearchOpen(false)
  }, [])

  const { handleKeyDown: handleMobileMenuKeyDown } = useModalFocusTrap({
    open: mobileMenuOpen,
    onClose: closeMobileMenu,
    containerRef: mobileMenuPanelRef,
    returnFocusRef: mobileMenuButtonRef,
    paused: quickSearchOpen,
    lockScroll: true,
  })

  useEffect(() => {
    const readLocationHash = () => window.location.hash.replace(/^#/, "").split("?")[0] || ""
    const syncHash = () => setActiveHash(readLocationHash())
    const routeHash = router.asPath.split("#")[1]?.split("?")[0] || ""
    setActiveHash(readLocationHash() || routeHash)
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [router.asPath])

  const isNavLinkActive = (id: string) =>
    (id === "notes" && router.pathname === "/" && activeHash !== "topics") ||
    (id === "topics" && router.pathname === "/" && activeHash === "topics") ||
    (id === "about" && router.pathname === "/about")

  useEffect(() => {
    if (!mobileMenuOpen) return
    const media = window.matchMedia(`(max-width: ${MOBILE_NAV_MAX_WIDTH_PX}px)`)
    const closeWhenDesktop = () => {
      if (!media.matches) setMobileMenuOpen(false)
    }
    closeWhenDesktop()
    media.addEventListener("change", closeWhenDesktop)
    return () => media.removeEventListener("change", closeWhenDesktop)
  }, [mobileMenuOpen])

  const focusFeedSearch = useCallback(
    (feedQuery?: string) => {
      if (focusFeedSearchInFlightRef.current) {
        return focusFeedSearchInFlightRef.current
      }

      const trimmedQuery = (feedQuery || "").trim()
      const run = (async () => {
        if (trimmedQuery) {
          await router.push({ pathname: "/", query: { q: trimmedQuery } })
        } else if (router.pathname !== "/") {
          await waitForFeedSearchRoute(router)
        }

        const focused = await waitForFeedSearchInputFocus()
        if (!focused) {
          throw new Error("Failed to focus feed search input")
        }
      })()

      const clearInFlightFocus = () => {
        if (focusFeedSearchInFlightRef.current === run) {
          focusFeedSearchInFlightRef.current = null
        }
      }
      focusFeedSearchInFlightRef.current = run
      void run.then(clearInFlightFocus, clearInFlightFocus)
      return run
    },
    [router]
  )

  const handleOpenInFeed = useCallback(
    (feedQuery?: string) => {
      const wasMenuOpen = mobileMenuOpen
      setMobileMenuOpen(false)
      void (async () => {
        if (wasMenuOpen) {
          await waitForFocusTrapRestore()
        }
        await focusFeedSearch(feedQuery)
      })().catch(reportFocusFeedSearchFailure)
    },
    [focusFeedSearch, mobileMenuOpen]
  )

  const openQuickSearch = useCallback(
    (triggerElement?: HTMLElement | null) => {
      const wasMenuOpen = mobileMenuOpen
      if (!quickSearchOpenRef.current) {
        quickSearchReturnFocusRef.current = wasMenuOpen
          ? mobileMenuButtonRef.current
          : triggerElement ??
            (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null)
      }
      setMobileMenuOpen(false)
      if (!wasMenuOpen) {
        setQuickSearchLoaded(true)
        setQuickSearchOpen(true)
        setQuickSearchFocusSignal((value) => value + 1)
        return
      }
      void waitForFocusTrapRestore().then(() => {
        setQuickSearchLoaded(true)
        setQuickSearchOpen(true)
        setQuickSearchFocusSignal((value) => value + 1)
      })
    },
    [mobileMenuOpen]
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      const isCmdOrCtrlK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (event.key.toLowerCase() === "k" || event.code === "KeyK")
      const isSlashShortcut =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === "/"
      if (!isCmdOrCtrlK && !isSlashShortcut) return

      event.preventDefault()
      openQuickSearch()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [openQuickSearch])

  const mobileMenu =
    typeof document !== "undefined" && mobileMenuOpen
      ? createPortal(
          <MobileMenuLayer data-ui="mobile-nav-menu">
            <MobileMenuBackdrop role="presentation" onClick={closeMobileMenu} />
            <MobileMenuPanel
              ref={mobileMenuPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("navMenu")}
              className="mobileMenuPanel"
              onKeyDown={handleMobileMenuKeyDown}
            >
              <button
                type="button"
                className="mobileNavClose"
                aria-label={t("toastDismiss")}
                onClick={closeMobileMenu}
              >
                <CloseGlyph />
              </button>
              <nav className="mobileNavList" aria-label={t("navMenu")}>
                {primaryLinks.map(([id, , to, labelKey]) => {
                  const label = t(labelKey)
                  const isActive = isNavLinkActive(id)
                  return (
                    <Link
                      key={to}
                      href={to}
                      data-nav-id={id}
                      aria-label={label}
                      aria-current={isActive ? "page" : undefined}
                      onClick={
                        id === "topics"
                          ? () => {
                              closeMobileMenu()
                              setActiveHash("topics")
                              window.requestAnimationFrame(() => focusTopicsRailElement())
                            }
                          : closeMobileMenu
                      }
                    >
                      {label}
                    </Link>
                  )
                })}
                <div className="mobileNavDivider" aria-hidden="true" />
                <button
                  type="button"
                  data-ui="mobile-nav-search"
                  aria-keyshortcuts="Meta+K Control+K"
                  onClick={() => openQuickSearch(mobileMenuButtonRef.current)}
                >
                  <SearchIcon />
                  <span>{t("navSearch")}</span>
                </button>
                <button
                  type="button"
                  className="mobileLangToggleBtn"
                  aria-label={t("langToggleMobileLabel")}
                  title={t("langToggleMobileLabel")}
                  onClick={() => {
                    toggleLanguage()
                    closeMobileMenu()
                  }}
                  data-language={language}
                >
                  <GlobeIcon />
                  <span>{t("langToggleMobileLabel")}</span>
                </button>
              </nav>
            </MobileMenuPanel>
          </MobileMenuLayer>,
          document.body
        )
      : null

  return (
    <StyledWrapper>
      <div className="desktopLinks">
        {primaryLinks.map(([id, , to, labelKey]) => {
          const label = t(labelKey)
          const isActive = isNavLinkActive(id)
          return (
            <Link
              key={id}
              href={to}
              data-nav-id={id}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              data-ui="nav-control"
              data-active={isActive ? "true" : "false"}
              onClick={id === "topics" ? () => { setActiveHash("topics"); focusTopicsRailElement() } : undefined}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <button
        ref={searchTriggerRef}
        type="button"
        className="searchButton"
        aria-label={router.pathname === "/" ? t("navSearch") : t("navSearchTriggerAria")}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => openQuickSearch(searchTriggerRef.current)}
      >
        <SearchIcon />
      </button>

      <button
        type="button"
        className="langToggleBtn"
        aria-label={t("langToggleLabel")}
        title={t("langToggleLabel")}
        onClick={toggleLanguage}
        data-language={language}
      >
        <span>{language === "ko" ? "EN" : "KO"}</span>
      </button>

      <button
        ref={mobileMenuButtonRef}
        type="button"
        className="mobileMenuButton"
        aria-label={t("navMenu")}
        aria-expanded={mobileMenuOpen}
        aria-haspopup="dialog"
        onClick={() => setMobileMenuOpen((value) => !value)}
      >
        <MenuIcon />
      </button>

      {mobileMenu}
      {quickSearchLoaded ? (
        <LazyQuickSearchPalette
          open={quickSearchOpen}
          onClose={closeQuickSearch}
          onOpenInFeed={handleOpenInFeed}
          returnFocusRef={quickSearchReturnFocusRef}
          focusSignal={quickSearchFocusSignal}
        />
      ) : null}
    </StyledWrapper>
  )
}

export default NavBar

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  line-height: 1.25rem;
  min-width: 0;

  @media (min-width: 640px) {
    gap: 1.5rem;
  }

  .desktopLinks {
    display: none;
    align-items: center;
    gap: 1rem;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    @media (min-width: 640px) {
      display: flex;
    }

    a {
      margin: 0.25rem;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 0.25rem;
      font-size: 1rem;
      font-weight: 500;
      color: var(--aq-text);
      text-decoration: none;
      white-space: nowrap;
      transition: color 0.15s ease;

      &:hover {
        color: var(--aq-accent-link, var(--aq-accent));
      }

      &[aria-current="page"],
      &[data-active="true"] {
        color: var(--aq-accent-link, var(--aq-accent));
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 0.35em;
        text-decoration-thickness: 2px;
      }

      &:focus-visible {
        outline: 2px solid var(--aq-focus-ring);
        outline-offset: 2px;
        border-radius: 0.25rem;
      }
    }
  }

  .searchButton {
    display: none;
    align-items: center;
    justify-content: center;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    padding: 0;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--aq-text);
    cursor: pointer;
    transition: color 0.15s ease;

    @media (min-width: 640px) {
      display: inline-flex;
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    &:hover {
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  .langToggleBtn {
    display: none;
    align-items: center;
    justify-content: center;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    padding: 0 0.35rem;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--aq-text);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.15s ease;

    @media (min-width: 640px) {
      display: inline-flex;
    }

    &:hover {
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }
  }

  .mobileMenuButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: ${control.lg}px;
    min-height: ${control.lg}px;
    padding: 0;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--aq-text);
    cursor: pointer;
    transition: color 0.15s ease;

    svg {
      width: 2rem;
      height: 2rem;
    }

    &:hover {
      color: var(--aq-accent-link, var(--aq-accent));
    }

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: 2px;
    }

    @media (min-width: 640px) {
      display: none;
    }
  }

  @media (pointer: coarse) {
    .desktopLinks a,
    .searchButton,
    .langToggleBtn,
    .mobileMenuButton {
      min-height: ${control.lg}px;
      min-width: ${control.lg}px;
    }
  }
`
