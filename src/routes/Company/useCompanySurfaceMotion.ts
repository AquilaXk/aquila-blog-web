import { useEffect, useRef } from "react"

const STAGGER_MS = 65
const MAX_STAGGER_STEPS = 4

export const useCompanySurfaceMotion = <T extends HTMLElement = HTMLDivElement>() => {
  const containerRef = useRef<T | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof window === "undefined") return

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

    const revealElements = container.querySelectorAll<HTMLElement>("[data-reveal]")
    const isReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (isReducedMotion || typeof IntersectionObserver === "undefined") {
      revealElements.forEach((el) => {
        el.classList.add("is-visible")
        el.setAttribute("data-visible", "true")
      })
      return () => {
        window.removeEventListener("scroll", syncHeaderScroll)
      }
    }

    const groupCounts = new Map<string, number>()
    revealElements.forEach((el, idx) => {
      const group = el.dataset.revealGroup
      let stepIndex = idx
      if (group) {
        const current = groupCounts.get(group) ?? 0
        groupCounts.set(group, current + 1)
        stepIndex = current
      }
      const explicitDelay = el.dataset.revealDelay
      const delayMs =
        explicitDelay !== undefined && !Number.isNaN(Number(explicitDelay))
          ? Number(explicitDelay)
          : Math.min(stepIndex % MAX_STAGGER_STEPS, MAX_STAGGER_STEPS - 1) * STAGGER_MS
      el.style.setProperty("--reveal-delay", `${delayMs}ms`)
      el.style.transitionDelay = `${delayMs}ms`
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
      { threshold: 0.1, rootMargin: "0px 0px -32px" }
    )

    revealElements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", syncHeaderScroll)
    }
  }, [])

  return containerRef
}

export default useCompanySurfaceMotion
