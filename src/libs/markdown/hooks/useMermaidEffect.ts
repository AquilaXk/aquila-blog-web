import { RefObject, useEffect } from "react"
import useScheme from "src/hooks/useScheme"
import { resolveMermaidPreset } from "src/libs/markdown/mermaidRuntimeConfig"
import { shouldScheduleFromMermaidMutations } from "src/libs/markdown/mermaidRuntimeMutations"
import { createMermaidRuntimeController } from "src/libs/markdown/mermaidRuntimeRender"

interface MermaidEffectOptions {
  observeMutations?: boolean
  forceScheme?: "dark" | "light"
  allowDesktopWideLane?: boolean
  lazyViewport?: boolean
}

export const shouldScheduleMermaidResize = (lastWidth: number, nextWidth: number) =>
  Math.abs(Math.floor(nextWidth) - Math.floor(lastWidth)) >= 2

const useMermaidEffect = (
  rootRef?: RefObject<HTMLElement | null>,
  contentKey?: string,
  enabled = true,
  options?: MermaidEffectOptions
) => {
  const [scheme] = useScheme()
  const shouldLogMermaidWarnings = process.env.NODE_ENV !== "production"
  const observeMutations = options?.observeMutations ?? true
  const allowDesktopWideLane = options?.allowDesktopWideLane ?? true
  const lazyViewport = options?.lazyViewport ?? false
  const effectiveScheme = options?.forceScheme ?? (scheme === "dark" ? "dark" : "light")

  useEffect(() => {
    if (!enabled) return
    const root = rootRef?.current
    if (!root) return

    let disposed = false
    let running = false
    let rerunRequested = false
    let pendingForceResetCache = false
    let mutationObserver: MutationObserver | null = null
    let scheduledRunFrame: number | null = null
    const retryTimers = new Set<number>()
    const preset = resolveMermaidPreset(effectiveScheme)

    const controller = createMermaidRuntimeController({
      root,
      preset,
      scheme: effectiveScheme,
      allowDesktopWideLane,
      lazyViewport,
      shouldLogMermaidWarnings,
      isDisposed: () => disposed,
      retryTimers,
    })

    const scheduleRun = (forceResetCache = false) => {
      if (disposed) return
      if (forceResetCache) pendingForceResetCache = true
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        rerunRequested = true
        return
      }
      if (running) {
        rerunRequested = true
        return
      }
      controller.resetLayoutCache(pendingForceResetCache)
      pendingForceResetCache = false
      rerunRequested = false
      if (scheduledRunFrame !== null) return
      scheduledRunFrame = window.requestAnimationFrame(() => {
        scheduledRunFrame = null
        void run()
      })
    }

    const run = async () => {
      if (disposed) return
      if (running) {
        rerunRequested = true
        return
      }

      running = true

      try {
        await controller.renderMermaidBlocks()
      } catch (error) {
        if (shouldLogMermaidWarnings) {
          console.warn(error)
        }
      } finally {
        running = false
        if (rerunRequested && !disposed) {
          const nextForceReset = pendingForceResetCache
          rerunRequested = false
          pendingForceResetCache = false
          scheduleRun(nextForceReset)
        }
      }
    }

    scheduleRun()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleRun()
      }
    }
    let lastObservedWidth = Math.floor(root.getBoundingClientRect().width)
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const nextWidth = Math.floor(root.getBoundingClientRect().width)
            if (!shouldScheduleMermaidResize(lastObservedWidth, nextWidth)) return
            lastObservedWidth = nextWidth
            scheduleRun(true)
          })
        : null
    resizeObserver?.observe(root)
    mutationObserver =
      observeMutations && typeof MutationObserver !== "undefined"
        ? new MutationObserver((mutations) => {
            if (!shouldScheduleFromMermaidMutations(mutations)) return
            scheduleRun()
          })
        : null
    mutationObserver?.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      disposed = true
      controller.dispose()
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      retryTimers.forEach((timerId) => window.clearTimeout(timerId))
      retryTimers.clear()
      if (scheduledRunFrame !== null) {
        window.cancelAnimationFrame(scheduledRunFrame)
        scheduledRunFrame = null
      }
    }
  }, [
    allowDesktopWideLane,
    contentKey,
    effectiveScheme,
    enabled,
    lazyViewport,
    observeMutations,
    rootRef,
    shouldLogMermaidWarnings,
  ])

  return
}

export default useMermaidEffect
