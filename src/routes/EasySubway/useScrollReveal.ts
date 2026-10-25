import { useEffect, useRef } from "react"

export type ScrollRevealOptions = {
  selector?: string
  threshold?: number
  rootMargin?: string
  staggerMs?: number
  maxStaggerSteps?: number
}

export const calculateRevealDelay = (
  groupIndex: number,
  explicitDelay?: number | string,
  staggerMs = 60,
  maxStaggerSteps = 4
): number => {
  if (explicitDelay !== undefined) {
    const parsed =
      typeof explicitDelay === "string" ? parseInt(explicitDelay, 10) : explicitDelay
    if (!Number.isNaN(parsed)) return parsed
  }
  const step = Math.min(
    groupIndex >= 0 ? groupIndex % maxStaggerSteps : 0,
    maxStaggerSteps - 1
  )
  return step * staggerMs
}

export const useScrollReveal = <T extends HTMLElement = HTMLDivElement>({
  selector = "[data-reveal]",
  threshold = 0.12,
  rootMargin = "0px 0px -40px",
  staggerMs = 60,
  maxStaggerSteps = 4,
}: ScrollRevealOptions = {}) => {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const headerEl = container.querySelector<HTMLElement>("[data-header]")
    let lastScrolled: boolean | null = null
    const syncHeaderScroll = () => {
      if (!headerEl) return
      const scrolled = window.scrollY > 12
      if (scrolled === lastScrolled) return
      lastScrolled = scrolled
      headerEl.classList.toggle("scrolled", scrolled)
      if (scrolled) {
        headerEl.setAttribute("data-scrolled", "true")
      } else {
        headerEl.removeAttribute("data-scrolled")
      }
    }
    syncHeaderScroll()
    window.addEventListener("scroll", syncHeaderScroll, { passive: true })

    const elements = container.querySelectorAll<HTMLElement>(selector)
    if (!elements.length) {
      return () => {
        window.removeEventListener("scroll", syncHeaderScroll)
      }
    }

    const isReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (isReducedMotion || typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => {
        el.classList.add("is-visible")
        el.setAttribute("data-visible", "true")
      })
      return () => {
        window.removeEventListener("scroll", syncHeaderScroll)
      }
    }

    const groupIndices = new Map<string, number>()

    elements.forEach((element, globalIndex) => {
      const explicitDelay = element.dataset.revealDelay
      const groupName = element.dataset.revealGroup

      let indexInGroup = globalIndex
      if (groupName) {
        const currentIndex = groupIndices.get(groupName) ?? 0
        groupIndices.set(groupName, currentIndex + 1)
        indexInGroup = currentIndex
      }

      const delayMs = calculateRevealDelay(
        indexInGroup,
        explicitDelay,
        staggerMs,
        maxStaggerSteps
      )
      element.style.setProperty("--reveal-delay", `${delayMs}ms`)
      element.style.transitionDelay = `${delayMs}ms`
    })

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target as HTMLElement
          target.classList.add("is-visible")
          target.setAttribute("data-visible", "true")
          obs.unobserve(target)
        })
      },
      { threshold, rootMargin }
    )

    elements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", syncHeaderScroll)
    }
  }, [selector, threshold, rootMargin, staggerMs, maxStaggerSteps])

  return containerRef
}

export default useScrollReveal
