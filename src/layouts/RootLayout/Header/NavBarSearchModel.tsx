import type { NextRouter } from "next/router"

export const primaryLinks = [
  ["notes", "Notes", "/", "navNotes"],
  ["topics", "Topics", "/#topics", "navTopics"],
  ["about", "About", "/about", "navAbout"],
] as const

export const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" strokeLinecap="round" />
  </svg>
)

export const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  </svg>
)

export const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

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
