import {
  formatMermaidErrorReason,
  renderMermaidInstanceWithTimeout,
  renderSerializedMermaidSvg,
} from "./mermaidRuntimeConfig"
import { mountMermaidErrorStateDom } from "src/libs/markdown/mermaidRuntimeSanitize"
import type {
  DesktopWideLaneBounds,
  MermaidComplexityLevel,
  MermaidRuntimeInstance,
  MermaidRuntimePreset,
} from "src/libs/markdown/mermaidRuntimeTypes"

export type MermaidRuntimeControllerOptions = {
  root: HTMLElement
  preset: MermaidRuntimePreset
  scheme?: "dark" | "light"
  runtimeLoader?: () => Promise<unknown>
  allowDesktopWideLane: boolean
  lazyViewport: boolean
  shouldLogMermaidWarnings: boolean
  getMermaid?: () => Promise<MermaidRuntimeInstance>
  isDisposed: () => boolean
  retryTimers: Set<number>
  readParseWarning?: () => string | null
  clearParseWarning?: () => void
}

export type PreparedBlockRender = {
  originalSource: string
  desiredSource: string
  renderableSource: string
  complexityLevel: MermaidComplexityLevel
  visibleWidth: number
  blockRect: DOMRect
  desktopWideLaneBounds: DesktopWideLaneBounds | null
}

export type ControllerInternalState = {
  options: MermaidRuntimeControllerOptions
  cachedDesktopWideLaneBounds: DesktopWideLaneBounds | null | undefined
  mermaidOverlayCleanup: (() => void) | null
  renderQueue: Promise<void>
  activeQueueCount: number
  renderingBlocks: Set<HTMLElement>
  blockRetryTimers: Map<HTMLElement, number>
  observedBlocks: WeakSet<HTMLElement>
  premeasuredRects: WeakMap<HTMLElement, DOMRect>
  renderSequence: number
  loggedErrorSignatures: Set<string>
  intersectionObserver: IntersectionObserver | null
  enqueueRender: (block: HTMLElement) => void
}

const MAX_RETRY_COUNT = 6
const RETRY_BASE_DELAY_MS = 150

export const executeUncachedMermaidRender = async ({
  customMermaid,
  options,
  renderId,
  sourceToRender,
}: {
  customMermaid: MermaidRuntimeInstance | null
  options: MermaidRuntimeControllerOptions
  renderId: string
  sourceToRender: string
}): Promise<string> => {
  if (customMermaid) {
    options.clearParseWarning?.()
    const rendered = await renderMermaidInstanceWithTimeout(customMermaid, renderId, sourceToRender)
    const parseWarning = options.readParseWarning?.()
    if (parseWarning) throw new Error(parseWarning)
    return rendered.svg
  }

  const scheme =
    options.scheme ?? (options.preset.themeKey.endsWith("-dark") ? "dark" : "light")
  const rendered = await renderSerializedMermaidSvg({
    scheme,
    renderId,
    source: sourceToRender,
    runtimeLoader: options.runtimeLoader,
  })
  return rendered.svg
}

export const clearBlockRetryTimer = (state: ControllerInternalState, block: HTMLElement) => {
  const existingTimerId = state.blockRetryTimers.get(block)
  if (existingTimerId === undefined) return
  window.clearTimeout(existingTimerId)
  state.options.retryTimers.delete(existingTimerId)
  state.blockRetryTimers.delete(block)
}

export const clearAllBlockRetryTimers = (state: ControllerInternalState) => {
  state.blockRetryTimers.forEach((timerId) => {
    window.clearTimeout(timerId)
    state.options.retryTimers.delete(timerId)
  })
  state.blockRetryTimers.clear()
}

export const scheduleBlockRetry = (
  state: ControllerInternalState,
  block: HTMLElement,
  options?: { isTimeoutRetry?: boolean }
): boolean => {
  clearBlockRetryTimer(state, block)
  if (options?.isTimeoutRetry) {
    const timeoutRetryCount = Number.parseInt(block.dataset.mermaidTimeoutRetryCount || "0", 10)
    if (timeoutRetryCount >= 1) return false
    block.dataset.mermaidTimeoutRetryCount = String(timeoutRetryCount + 1)
  }
  const retryCount = Number.parseInt(block.dataset.mermaidRetryCount || "0", 10)
  if (retryCount >= MAX_RETRY_COUNT) return false
  block.dataset.mermaidRetryCount = String(retryCount + 1)
  state.premeasuredRects.delete(block)
  const timerId = window.setTimeout(() => {
    state.options.retryTimers.delete(timerId)
    state.blockRetryTimers.delete(block)
    state.enqueueRender(block)
  }, RETRY_BASE_DELAY_MS * (retryCount + 1))
  state.options.retryTimers.add(timerId)
  state.blockRetryTimers.set(block, timerId)
  return true
}

export const logMermaidWarningOnce = (
  state: ControllerInternalState,
  signature: string,
  label: string,
  err: unknown
) => {
  if (state.loggedErrorSignatures.has(signature)) return
  state.loggedErrorSignatures.add(signature)
  if (state.options.shouldLogMermaidWarnings) console.warn(label, err)
}

export const handleZeroVisibleWidthBlock = (
  state: ControllerInternalState,
  block: HTMLElement,
  fallbackRaw: string
) => {
  if (scheduleBlockRetry(state, block)) return
  block.dataset.mermaidRendered = "error"
  block.classList.add("aq-mermaid-error")
  mountMermaidErrorStateDom(block, {
    source: fallbackRaw,
    error: "다이어그램 영역 너비를 계산할 수 없습니다. 레이아웃이 안정되면 다시 렌더링됩니다.",
  })
}

export const formatLoggedFailureSignature = (source: string, error: unknown): string =>
  `${source}:${formatMermaidErrorReason(error)}`
