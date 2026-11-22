/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/Header.tsx, components/MobileNav.tsx, components/SearchButton.tsx, MIT License)
 * - lucide-icons/lucide (icons/{search,menu,x,globe}.svg, ISC License, Copyright (c) Lucide Contributors)
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
    width="20"
    height="20"
    strokeWidth={2}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </svg>
)

export const SearchIcon = SearchGlyph

export const MenuGlyph = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
)

export const MenuIcon = MenuGlyph

export const CloseGlyph = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
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
