/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/Header.tsx, components/MobileNav.tsx, components/SearchButton.tsx, MIT License)
 * - lucide-icons/lucide (icons/globe.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import type { NextRouter } from "next/router"

export const primaryLinks = [
  ["notes", "Notes", "/", "navNotes"],
  ["topics", "Topics", "/#topics", "navTopics"],
  ["about", "About", "/about", "navAbout"],
] as const

export const SearchGlyph = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
    />
  </svg>
)

export const SearchIcon = SearchGlyph

export const MenuGlyph = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    width="32"
    height="32"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fillRule="evenodd"
      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

export const MenuIcon = MenuGlyph

export const CloseGlyph = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    width="24"
    height="24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
)

export const LanguageGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
)

export const GlobeIcon = LanguageGlyph

export const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tagName = target.tagName
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
}

const FEED_SEARCH_ROUTE_TIMEOUT_MS = 8_000

export const reportFocusFeedSearchFailure = (error: unknown) => {
  console.error("[NavBar] failed to focus feed search input", error)
}

export const waitForFocusTrapRestore = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })

export const waitForFeedSearchRoute = (router: NextRouter) =>
  new Promise<void>((resolve, reject) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      router.events.off("routeChangeComplete", handleComplete)
      router.events.off("routeChangeError", handleError)
    }
    const settle = (action: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      action()
    }
    const handleComplete = (url: string) => {
      const pathname = new URL(url, window.location.origin).pathname
      if (pathname === "/") {
        settle(() => resolve())
        return
      }
      settle(() => reject(new Error(`unexpected route after search navigation: ${url}`)))
    }
    const handleError = (error: Error) => {
      settle(() => reject(error))
    }

    router.events.on("routeChangeComplete", handleComplete)
    router.events.on("routeChangeError", handleError)
    timeoutId = setTimeout(() => {
      settle(() => reject(new Error("timed out waiting for feed search route")))
    }, FEED_SEARCH_ROUTE_TIMEOUT_MS)
    void router.push("/").catch((error: unknown) => {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))))
    })
  })

let clearTopicsHighlightTimer: ReturnType<typeof setTimeout> | null = null

const MOBILE_TOPICS_SELECTOR =
  '[data-topics-mobile="true"], .mobileTags, [data-ui="feed-tag-chip-rail"]'

const isElementVisible = (el: HTMLElement | null): el is HTMLElement =>
  Boolean(el && el.offsetParent !== null)

export const focusTopicsRailElement = (): boolean => {
  if (typeof document === "undefined") return false
  const topicsRoot = document.getElementById("topics")
  const desktopPanel = topicsRoot?.querySelector?.<HTMLElement>(".desktopPanel") ?? null
  const isDesktopVisible =
    isElementVisible(topicsRoot) && (!desktopPanel || isElementVisible(desktopPanel))
  const mobileRail =
    topicsRoot?.querySelector?.<HTMLElement>(MOBILE_TOPICS_SELECTOR) ??
    document.querySelector?.<HTMLElement>(MOBILE_TOPICS_SELECTOR) ??
    null
  const target = isDesktopVisible ? topicsRoot : mobileRail ?? topicsRoot
  if (!target) return false

  target.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
  const highlightTarget = topicsRoot ?? target
  highlightTarget.setAttribute?.("data-topics-highlighted", "true")
  if (clearTopicsHighlightTimer) {
    clearTimeout(clearTopicsHighlightTimer)
  }
  clearTopicsHighlightTimer = setTimeout(() => {
    highlightTarget.removeAttribute?.("data-topics-highlighted")
    clearTopicsHighlightTimer = null
  }, 1400)

  const focusScope = isDesktopVisible ? desktopPanel ?? target : target
  const firstFocusable = focusScope.querySelector?.<HTMLElement>(
    "button, a, input, [tabindex]:not([tabindex='-1'])"
  )
  ;(firstFocusable ?? target).focus?.({ preventScroll: true })
  return true
}
