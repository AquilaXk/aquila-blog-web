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

    let observer: IntersectionObserver | null = null
    if (isReducedMotion || typeof IntersectionObserver === "undefined") {
      revealElements.forEach((el) => {
        el.classList.add("is-visible")
        el.setAttribute("data-visible", "true")
      })
    } else {
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

      const activeObserver = new IntersectionObserver(
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
      observer = activeObserver

      revealElements.forEach((el) => activeObserver.observe(el))
    }

    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches

    if (isReducedMotion || !finePointer) {
      return () => {
        observer?.disconnect()
        window.removeEventListener("scroll", syncHeaderScroll)
      }
    }

    let activeSpotlight: HTMLElement | null = null
    let activeSpotlightRect: DOMRect | null = null
    let spotlightRectDirty = false

    let activeOrbStrip: HTMLElement | null = null
    let activeOrbRect: DOMRect | null = null
    let activeOrbs: HTMLElement[] = []
    let orbRectDirty = false

    const clearSpotlight = () => {
      if (activeSpotlight) {
        activeSpotlight.removeAttribute("data-spotlight-active")
      }
      activeSpotlight = null
      activeSpotlightRect = null
      spotlightRectDirty = false
    }

    const resetOrbs = () => {
      for (const orb of activeOrbs) {
        orb.style.setProperty("--orb-lift-px", "0px")
        orb.style.setProperty("--orb-scale", "1")
      }
      activeOrbStrip = null
      activeOrbRect = null
      activeOrbs = []
      orbRectDirty = false
    }

    const markRectsDirty = () => {
      spotlightRectDirty = true
      orbRectDirty = true
    }

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const spotlightEl = target?.closest<HTMLElement>("[data-spotlight]") ?? null

      if (spotlightEl !== activeSpotlight) {
        clearSpotlight()
        if (spotlightEl) {
          activeSpotlight = spotlightEl
          activeSpotlightRect = spotlightEl.getBoundingClientRect()
          spotlightRectDirty = false
        }
      } else if (activeSpotlight && spotlightRectDirty) {
        activeSpotlightRect = activeSpotlight.getBoundingClientRect()
        spotlightRectDirty = false
      }

      if (
        activeSpotlight &&
        activeSpotlightRect &&
        activeSpotlightRect.width > 0 &&
        activeSpotlightRect.height > 0
      ) {
        const localX = event.clientX - activeSpotlightRect.left
        const localY = event.clientY - activeSpotlightRect.top
        activeSpotlight.style.setProperty("--mouse-x", `${localX.toFixed(1)}px`)
        activeSpotlight.style.setProperty("--mouse-y", `${localY.toFixed(1)}px`)
        activeSpotlight.setAttribute("data-spotlight-active", "true")
      }

      const orbStrip = target?.closest<HTMLElement>("[data-orb-wave]") ?? null
      if (orbStrip !== activeOrbStrip) {
        resetOrbs()
        if (orbStrip) {
          activeOrbStrip = orbStrip
          activeOrbRect = orbStrip.getBoundingClientRect()
          activeOrbs = Array.from(orbStrip.querySelectorAll<HTMLElement>("[data-orb-index]"))
          orbRectDirty = false
        }
      } else if (activeOrbStrip && orbRectDirty) {
        activeOrbRect = activeOrbStrip.getBoundingClientRect()
        orbRectDirty = false
      }

      if (activeOrbStrip && activeOrbRect && activeOrbRect.width > 0 && activeOrbs.length > 0) {
        const pointerRatio = (event.clientX - activeOrbRect.left) / activeOrbRect.width
        const orbCount = activeOrbs.length
        for (let idx = 0; idx < orbCount; idx += 1) {
          const orb = activeOrbs[idx]!
          const itemRatio = (idx + 0.5) / orbCount
          const distNorm = Math.abs(pointerRatio - itemRatio) * orbCount
          const proximity = Math.exp(-(distNorm * distNorm) / (2 * 1.45 * 1.45))
          orb.style.setProperty("--orb-lift-px", `${(-proximity * 10).toFixed(1)}px`)
          orb.style.setProperty("--orb-scale", `${(1 + proximity * 0.14).toFixed(3)}`)
        }
      }
    }

    const onPointerLeave = () => {
      clearSpotlight()
      resetOrbs()
    }

    window.addEventListener("scroll", markRectsDirty, { passive: true })
    window.addEventListener("resize", markRectsDirty, { passive: true })
    container.addEventListener("pointermove", onPointerMove, { passive: true })
    container.addEventListener("pointerleave", onPointerLeave, { passive: true })

    return () => {
      observer?.disconnect()
      window.removeEventListener("scroll", syncHeaderScroll)
      window.removeEventListener("scroll", markRectsDirty)
      window.removeEventListener("resize", markRectsDirty)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [])

  return containerRef
}

export default useCompanySurfaceMotion
