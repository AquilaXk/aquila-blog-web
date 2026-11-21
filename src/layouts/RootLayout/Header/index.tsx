/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (components/Header.tsx, components/SectionContainer.tsx, MIT License)
 */
import NavBar from "./NavBar"
import Logo from "./Logo"
import styled from "@emotion/styled"
import { useEffect, useRef } from "react"

type Props = {
  fullWidth: boolean
  blogTitle?: string
}

const Header: React.FC<Props> = ({ fullWidth, blogTitle }) => {
  const wrapperRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const root = document.documentElement
    let lastHeight = 0

    const syncHeaderHeight = () => {
      const measured = Math.round(wrapper.getBoundingClientRect().height)
      if (measured <= 0) return
      if (measured === lastHeight) return
      lastHeight = measured
      root.style.setProperty("--app-header-height", `${measured}px`)
    }

    let rafId: number | null = null
    const scheduleSync = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        syncHeaderHeight()
      })
    }

    scheduleSync()

    const handleResize = () => scheduleSync()

    window.addEventListener("orientationchange", handleResize)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          const measured = Math.round(
            entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
          )
          if (measured > 0) {
            if (measured !== lastHeight) {
              lastHeight = measured
              root.style.setProperty("--app-header-height", `${measured}px`)
            }
            return
          }
        }
        scheduleSync()
      })
      observer.observe(wrapper)
    } else {
      window.addEventListener("resize", handleResize, { passive: true })
    }

    const fontSet = document.fonts
    const handleFontLoadingDone = () => scheduleSync()
    if (fontSet) {
      if (typeof fontSet.addEventListener === "function") {
        fontSet.addEventListener("loadingdone", handleFontLoadingDone)
      }
      void fontSet.ready.then(() => {
        scheduleSync()
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleResize)
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      if (fontSet && typeof fontSet.removeEventListener === "function") {
        fontSet.removeEventListener("loadingdone", handleFontLoadingDone)
      }
      observer?.disconnect()
    }
  }, [])

  return (
    <StyledWrapper ref={wrapperRef} data-ui="app-header">
      <div data-full-width={fullWidth} className="container">
        <Logo blogTitle={blogTitle} />
        <NavBar />
      </div>
    </StyledWrapper>
  )
}

export default Header

const StyledWrapper = styled.header`
  z-index: 50;
  position: sticky;
  top: 0;
  padding-top: env(safe-area-inset-top, 0px);
  background: var(--aq-page-bg);
  border-bottom: 1px solid var(--aq-border);

  .container {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 64rem;
    margin: 0 auto;
    padding: 1.25rem 1rem;
    gap: 1rem;

    @media (min-width: 640px) {
      padding: 1.5rem 1.5rem;
    }

    @media (min-width: 1280px) {
      padding: 2rem 0;
    }
  }
`
