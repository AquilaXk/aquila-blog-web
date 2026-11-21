import { RefObject, useEffect } from "react"
import useScheme from "src/hooks/useScheme"
import { shouldScheduleFromMermaidMutations } from "src/libs/markdown/mermaidRuntimeMutations"
import type { createMermaidRuntimeController } from "src/libs/markdown/mermaidRuntimeRender"

type MermaidRuntimeController = ReturnType<typeof createMermaidRuntimeController>

interface MermaidEffectOptions {
  observeMutations?: boolean
  forceScheme?: "dark" | "light"
  allowDesktopWideLane?: boolean
  lazyViewport?: boolean
}

export const shouldScheduleMermaidResize = (lastWidth: number, nextWidth: number) =>
  Math.abs(Math.floor(nextWidth) - Math.floor(lastWidth)) >= 2

const hasAnyPreBlock = (root: HTMLElement): boolean =>
  typeof root.querySelector === "function" ? root.querySelector("pre") !== null : true

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
    if (!observeMutations && !hasAnyPreBlock(root)) return

    let disposed = false
    let running = false
    let rerunRequested = false
    let pendingForceResetCache = false
    let mutationObserver: MutationObserver | null = null
    let scheduledRunFrame: number | null = null
    let controller: MermaidRuntimeController | null = null
    let controllerPromise: Promise<MermaidRuntimeController | null> | null = null
    const retryTimers = new Set<number>()

    const ensureController = (): Promise<MermaidRuntimeController | null> => {
      if (controller) return Promise.resolve(controller)
      if (controllerPromise) return controllerPromise
      controllerPromise = Promise.all([
        import("src/libs/markdown/mermaidRuntimeConfig"),
        import("src/libs/markdown/mermaidRuntimeRender"),
      ]).then(([{ resolveMermaidPreset }, { createMermaidRuntimeController }]) => {
        if (disposed) return null
        const preset = resolveMermaidPreset(effectiveScheme)
        controller = createMermaidRuntimeController({
          root,
          preset,
          scheme: effectiveScheme,
          allowDesktopWideLane,
          lazyViewport,
          shouldLogMermaidWarnings,
          isDisposed: () => disposed,
          retryTimers,
        })
        return controller
      })
      return controllerPromise
    }

    const scheduleRun = (forceResetCache = false) => {
      if (disposed) return
      if (!hasAnyPreBlock(root)) return
      if (forceResetCache) pendingForceResetCache = true
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        rerunRequested = true
        return
      }
      if (running) {
        rerunRequested = true
        return
      }
      if (controller) {
        controller.resetLayoutCache(pendingForceResetCache)
        pendingForceResetCache = false
      }
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
        const activeController = await ensureController()
        if (!activeController || disposed) return
        if (pendingForceResetCache) {
          activeController.resetLayoutCache(true)
          pendingForceResetCache = false
        }
        await activeController.renderMermaidBlocks()
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
        scheduleRun(true)
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
      controller?.dispose()
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
