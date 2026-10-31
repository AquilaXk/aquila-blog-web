import {
  DESKTOP_MERMAID_MIN_VIEWPORT_PX,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_VIEWPORT_ROOT_MARGIN,
  buildMermaidCacheKey,
  estimateMermaidComplexity,
  formatMermaidErrorReason,
  isMermaidSource,
  readMermaidCache,
  runSerializedMermaidTask,
  writeMermaidCache,
} from "src/libs/markdown/mermaidRuntimeConfig"
import {
  applyRenderedMermaidDom,
  collectMermaidBlocksInRoot,
  computeMermaidDisplayGeometry,
  hasMermaidBlockHint,
  isBlockAlreadyRendered,
  markMermaidBlockError,
  markMermaidBlockRendered,
  measureDesktopWideLaneBounds,
  resolveBlockSources,
} from "src/libs/markdown/mermaidRuntimeGeometry"
import { openMermaidOverlay } from "src/libs/markdown/mermaidRuntimeOverlay"
import {
  createMermaidRenderTimeoutError,
  isMermaidRenderTimeoutError,
  isMermaidSyntaxError,
  isNegativeRectWidthError,
  mountMermaidErrorStateDom,
  stripRiskyFlowchartDirectives,
} from "src/libs/markdown/mermaidRuntimeSanitize"
import type {
  DesktopWideLaneBounds,
  MermaidComplexityLevel,
  MermaidRuntimeInstance,
  MermaidRuntimePreset,
} from "src/libs/markdown/mermaidRuntimeTypes"

type MermaidRuntimeControllerOptions = {
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

type PreparedBlockRender = {
  originalSource: string
  desiredSource: string
  renderableSource: string
  complexityLevel: MermaidComplexityLevel
  visibleWidth: number
  blockRect: DOMRect
  desktopWideLaneBounds: DesktopWideLaneBounds | null
}

type ControllerInternalState = {
  options: MermaidRuntimeControllerOptions
  cachedDesktopWideLaneBounds: DesktopWideLaneBounds | null | undefined
  mermaidOverlayCleanup: (() => void) | null
  renderQueue: Promise<void>
  activeQueueCount: number
  renderingBlocks: Set<HTMLElement>
  observedBlocks: WeakSet<HTMLElement>
  premeasuredRects: WeakMap<HTMLElement, DOMRect>
  renderSequence: number
  loggedErrorSignatures: Set<string>
  intersectionObserver: IntersectionObserver | null
  enqueueRender: (block: HTMLElement) => void
}

const MAX_RETRY_COUNT = 6
const RETRY_BASE_DELAY_MS = 150

const renderMermaidWithTimeout = async (
  mermaidInstance: MermaidRuntimeInstance,
  renderId: string,
  sourceToRender: string
) => {
  let timeoutId: number | null = null
  try {
    const timed = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(createMermaidRenderTimeoutError()),
        MERMAID_RENDER_TIMEOUT_MS
      )
    })
    return await Promise.race([
      Promise.resolve(mermaidInstance.render(renderId, sourceToRender)),
      timed,
    ])
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
  }
}

const executeUncachedMermaidRender = async ({
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
    const rendered = await renderMermaidWithTimeout(customMermaid, renderId, sourceToRender)
    const parseWarning = options.readParseWarning?.()
    if (parseWarning) throw new Error(parseWarning)
    return rendered.svg
  }

  const resolvedScheme =
    options.scheme ?? (options.preset.themeKey.endsWith("-dark") ? "dark" : "light")
  let taskParseWarning: string | null = null
  const rendered = await runSerializedMermaidTask(
    resolvedScheme,
    (error) => {
      taskParseWarning = formatMermaidErrorReason(error)
    },
    async ({ mermaidRuntime }) => {
      taskParseWarning = null
      const result = await renderMermaidWithTimeout(mermaidRuntime, renderId, sourceToRender)
      if (taskParseWarning) throw new Error(taskParseWarning)
      return result
    },
    options.runtimeLoader
  )
  return rendered.svg
}

const resolveCachedWideLaneBounds = (
  state: ControllerInternalState,
  block: HTMLElement
): DesktopWideLaneBounds | null => {
  if (!state.options.allowDesktopWideLane) return null
  if (state.cachedDesktopWideLaneBounds !== undefined) return state.cachedDesktopWideLaneBounds
  state.cachedDesktopWideLaneBounds = measureDesktopWideLaneBounds(block)
  return state.cachedDesktopWideLaneBounds
}

const batchMeasureCandidateBlocks = (
  state: ControllerInternalState,
  targetBlocks: HTMLElement[]
) => {
  if (!targetBlocks.length) return
  resolveCachedWideLaneBounds(state, targetBlocks[0]!)
  for (const block of targetBlocks) {
    if (!block.isConnected || isBlockAlreadyRendered(block, state.options.preset.themeKey)) continue
    state.premeasuredRects.set(block, block.getBoundingClientRect())
  }
}

const scheduleBlockRetry = (state: ControllerInternalState, block: HTMLElement): boolean => {
  const retryCount = Number.parseInt(block.dataset.mermaidRetryCount || "0", 10)
  if (retryCount >= MAX_RETRY_COUNT) return false
  block.dataset.mermaidRetryCount = String(retryCount + 1)
  state.premeasuredRects.delete(block)
  const timerId = window.setTimeout(() => {
    state.options.retryTimers.delete(timerId)
    state.enqueueRender(block)
  }, RETRY_BASE_DELAY_MS * (retryCount + 1))
  state.options.retryTimers.add(timerId)
  return true
}

const logMermaidWarningOnce = (
  state: ControllerInternalState,
  signature: string,
  label: string,
  err: unknown
) => {
  if (state.loggedErrorSignatures.has(signature)) return
  state.loggedErrorSignatures.add(signature)
  if (state.options.shouldLogMermaidWarnings) console.warn(label, err)
}

const renderSourceIntoStageBlock = async ({
  state,
  block,
  index,
  customMermaid,
  sourceToRender,
  prepared,
}: {
  state: ControllerInternalState
  block: HTMLElement
  index: number
  customMermaid: MermaidRuntimeInstance | null
  sourceToRender: string
  prepared: PreparedBlockRender
}) => {
  const { options } = state
  if (options.isDisposed() || !block.isConnected) return
  const isMobileViewport = window.matchMedia("(max-width: 768px)").matches
  const isDesktopViewport = window.matchMedia(
    `(min-width: ${DESKTOP_MERMAID_MIN_VIEWPORT_PX}px)`
  ).matches
  const containerWidth = Math.max(280, prepared.visibleWidth)
  const reserveHeight = Math.max(120, Math.ceil(prepared.blockRect.height))

  const stage = document.createElement("div")
  stage.className = "aq-mermaid-stage mermaid"
  stage.style.minWidth = `${containerWidth}px`
  stage.style.width = `${containerWidth}px`
  stage.style.minHeight = `${reserveHeight}px`
  block.style.minHeight = `${reserveHeight}px`
  block.innerHTML = ""
  block.appendChild(stage)

  const cacheKey = buildMermaidCacheKey(
    sourceToRender,
    options.preset.themeKey,
    options.allowDesktopWideLane
  )
  const cached = readMermaidCache(cacheKey)
  let renderedSvg = cached?.svg || ""
  if (!renderedSvg) {
    const renderId = `aq-mermaid-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    renderedSvg = await executeUncachedMermaidRender({
      customMermaid,
      options,
      renderId,
      sourceToRender,
    })
    writeMermaidCache(cacheKey, { svg: renderedSvg, complexity: prepared.complexityLevel })
  }
  if (options.isDisposed() || !block.isConnected) return

  stage.innerHTML = renderedSvg
  const svgElement = stage.querySelector("svg")
  if (!svgElement) throw new Error("Mermaid SVG 생성 실패")

  const geometry = computeMermaidDisplayGeometry({
    svgElement,
    containerWidth,
    blockRect: prepared.blockRect,
    desktopWideLaneBounds: prepared.desktopWideLaneBounds,
    complexityLevel: prepared.complexityLevel,
    isMobileViewport,
    isDesktopViewport,
  })
  const copySource = prepared.originalSource || sourceToRender
  applyRenderedMermaidDom({
    block,
    stage,
    svgElement,
    geometry,
    onTriggerOverlay: () => {
      state.mermaidOverlayCleanup = openMermaidOverlay(
        renderedSvg,
        state.mermaidOverlayCleanup,
        copySource
      )
    },
  })
}

const isRetriableMermaidError = (error: unknown): boolean =>
  !isMermaidSyntaxError(error) && !isMermaidRenderTimeoutError(error)

const tryRenderFallbackMermaidSource = async ({
  state,
  block,
  index,
  customMermaid,
  prepared,
  fallbackSource,
}: {
  state: ControllerInternalState
  block: HTMLElement
  index: number
  customMermaid: MermaidRuntimeInstance | null
  prepared: PreparedBlockRender
  fallbackSource: string
}): Promise<boolean> => {
  try {
    await renderSourceIntoStageBlock({
      state,
      block,
      index,
      customMermaid,
      sourceToRender: fallbackSource,
      prepared,
    })
    markMermaidBlockRendered(block, state.options.preset, fallbackSource, prepared.visibleWidth)
    return true
  } catch (fallbackError) {
    logMermaidWarningOnce(
      state,
      `fallback:${fallbackSource}:${formatMermaidErrorReason(fallbackError)}`,
      "[mermaid] fallback render failed",
      fallbackError
    )
    return isRetriableMermaidError(fallbackError) && scheduleBlockRetry(state, block)
  }
}

const handleBlockRenderFailure = async ({
  state,
  block,
  index,
  customMermaid,
  error,
  prepared,
}: {
  state: ControllerInternalState
  block: HTMLElement
  index: number
  customMermaid: MermaidRuntimeInstance | null
  error: unknown
  prepared: PreparedBlockRender
}) => {
  if (isNegativeRectWidthError(error) && scheduleBlockRetry(state, block)) return

  const fallbackSource = stripRiskyFlowchartDirectives(prepared.desiredSource).trim()
  const canTryFallback =
    Boolean(fallbackSource) &&
    fallbackSource !== prepared.desiredSource &&
    fallbackSource !== prepared.renderableSource
  if (canTryFallback) {
    const handledByFallback = await tryRenderFallbackMermaidSource({
      state,
      block,
      index,
      customMermaid,
      prepared,
      fallbackSource,
    })
    if (handledByFallback) return
  }

  if (isRetriableMermaidError(error) && scheduleBlockRetry(state, block)) return

  markMermaidBlockError(
    block,
    state.options.preset,
    prepared.desiredSource,
    prepared.originalSource || prepared.desiredSource,
    error
  )
  logMermaidWarningOnce(
    state,
    `${prepared.desiredSource}:${formatMermaidErrorReason(error)}`,
    "[mermaid] render failed",
    error
  )
}

const handleZeroVisibleWidthBlock = (
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

const prepareBlockSourcesAndVisibility = (
  state: ControllerInternalState,
  block: HTMLElement
): PreparedBlockRender | null => {
  const { original, desired, renderable } = resolveBlockSources(block)
  if (!desired) return null
  if (!hasMermaidBlockHint(block) && !isMermaidSource(desired)) return null
  if (isBlockAlreadyRendered(block, state.options.preset.themeKey, desired)) return null

  const fallbackRaw = original || desired
  block.dataset.mermaidOriginalSource ??= fallbackRaw
  block.dataset.mermaidSource ??= fallbackRaw
  block.dataset.aqMermaid = "true"

  const premeasured = state.premeasuredRects.get(block)
  state.premeasuredRects.delete(block)
  const blockRect =
    premeasured && premeasured.width > 0 ? premeasured : block.getBoundingClientRect()
  const desktopWideLaneBounds = resolveCachedWideLaneBounds(state, block)
  const complexity = estimateMermaidComplexity(renderable)
  block.dataset.mermaidComplexity = complexity.level
  if (!block.dataset.mermaidRendered) {
    block.dataset.mermaidRendered = "pending"
    block.dataset.mermaidPreset = state.options.preset.mode
  }

  const visibleWidth = block.clientWidth || Math.floor(blockRect.width)
  if (visibleWidth <= 0) {
    handleZeroVisibleWidthBlock(state, block, fallbackRaw)
    return null
  }

  return {
    originalSource: original,
    desiredSource: desired,
    renderableSource: renderable,
    complexityLevel: complexity.level,
    visibleWidth,
    blockRect,
    desktopWideLaneBounds,
  }
}

const renderSingleMermaidBlock = async (state: ControllerInternalState, block: HTMLElement) => {
  if (state.options.isDisposed() || !block?.isConnected) return
  const customMermaid = state.options.getMermaid ? await state.options.getMermaid() : null
  if (state.options.isDisposed() || !block.isConnected) return

  const prepared = prepareBlockSourcesAndVisibility(state, block)
  if (!prepared) return

  const index = state.renderSequence
  state.renderSequence += 1

  try {
    await renderSourceIntoStageBlock({
      state,
      block,
      index,
      customMermaid,
      sourceToRender: prepared.renderableSource,
      prepared,
    })
    markMermaidBlockRendered(
      block,
      state.options.preset,
      prepared.desiredSource,
      prepared.visibleWidth
    )
  } catch (error) {
    await handleBlockRenderFailure({
      state,
      block,
      index,
      customMermaid,
      error,
      prepared,
    })
  }
}

const ensureLazyIntersectionObserver = (state: ControllerInternalState): IntersectionObserver => {
  if (state.intersectionObserver) return state.intersectionObserver
  state.intersectionObserver = new IntersectionObserver(
    (entries) => {
      const intersectingBlocks: HTMLElement[] = []
      for (const entry of entries) {
        if (!entry.isIntersecting && entry.intersectionRatio <= 0) continue
        const target = entry.target as HTMLElement
        state.intersectionObserver?.unobserve(target)
        state.observedBlocks.delete(target)
        intersectingBlocks.push(target)
      }
      if (intersectingBlocks.length > 0) {
        batchMeasureCandidateBlocks(state, intersectingBlocks)
        intersectingBlocks.forEach((target) => state.enqueueRender(target))
      }
    },
    { root: null, rootMargin: MERMAID_VIEWPORT_ROOT_MARGIN, threshold: 0.01 }
  )
  return state.intersectionObserver
}

const enqueueBlockIntoRenderQueue = (state: ControllerInternalState, block: HTMLElement) => {
  if (!block || state.renderingBlocks.has(block)) return
  state.renderingBlocks.add(block)
  state.activeQueueCount += 1
  state.renderQueue = state.renderQueue
    .then(() => renderSingleMermaidBlock(state, block))
    .catch((error) => {
      if (state.options.shouldLogMermaidWarnings) console.warn("[mermaid] queued render failed", error)
    })
    .finally(() => {
      state.renderingBlocks.delete(block)
      state.activeQueueCount = Math.max(0, state.activeQueueCount - 1)
    })
}

const resetControllerLayoutCache = (
  state: ControllerInternalState,
  isRendering: () => boolean,
  clearBlockCache: boolean
) => {
  if (!clearBlockCache && isRendering()) return
  state.cachedDesktopWideLaneBounds = undefined
  state.premeasuredRects = new WeakMap<HTMLElement, DOMRect>()
  if (!clearBlockCache) return
  state.options.root
    .querySelectorAll<HTMLElement>("[data-mermaid-rendered='true']")
    .forEach((block) => {
      delete block.dataset.mermaidRendered
    })
}

const runControllerMermaidBlocks = async (state: ControllerInternalState) => {
  const { options } = state
  const blocks = collectMermaidBlocksInRoot(options.root)
  if (!blocks.length) return
  const candidateBlocks = blocks.filter(
    (block) =>
      !isBlockAlreadyRendered(block, options.preset.themeKey) && !state.renderingBlocks.has(block)
  )
  if (!options.lazyViewport || typeof IntersectionObserver === "undefined") {
    batchMeasureCandidateBlocks(state, candidateBlocks)
    candidateBlocks.forEach(state.enqueueRender)
    await state.renderQueue
    return
  }
  const observer = ensureLazyIntersectionObserver(state)
  for (const block of candidateBlocks) {
    if (state.observedBlocks.has(block)) continue
    state.observedBlocks.add(block)
    observer.observe(block)
  }
}

export const createMermaidRuntimeController = (options: MermaidRuntimeControllerOptions) => {
  const state: ControllerInternalState = {
    options,
    cachedDesktopWideLaneBounds: undefined,
    mermaidOverlayCleanup: null,
    renderQueue: Promise.resolve(),
    activeQueueCount: 0,
    renderingBlocks: new Set<HTMLElement>(),
    observedBlocks: new WeakSet<HTMLElement>(),
    premeasuredRects: new WeakMap<HTMLElement, DOMRect>(),
    renderSequence: 0,
    loggedErrorSignatures: new Set<string>(),
    intersectionObserver: null,
    enqueueRender: () => {},
  }

  state.enqueueRender = (block: HTMLElement) => enqueueBlockIntoRenderQueue(state, block)
  const isRendering = () => state.activeQueueCount > 0 || state.renderingBlocks.size > 0

  return {
    isRendering,
    resetLayoutCache: (clearBlockCache = false) =>
      resetControllerLayoutCache(state, isRendering, clearBlockCache),
    renderMermaidBlocks: () => runControllerMermaidBlocks(state),
    dispose: () => {
      state.mermaidOverlayCleanup?.()
      state.mermaidOverlayCleanup = null
      state.intersectionObserver?.disconnect()
      state.intersectionObserver = null
      state.renderingBlocks.clear()
      state.activeQueueCount = 0
    },
  }
}
