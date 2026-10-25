import { applyMermaidSoftWrapHints, extractNormalizedMermaidSource } from "src/libs/markdown/mermaid"
import {
  DESKTOP_MERMAID_MIN_VIEWPORT_PX,
  MERMAID_COMPLEX_SCALE_CAP,
  MERMAID_DESKTOP_SAFE_MARGIN_PX,
  MERMAID_DESKTOP_WIDE_MAX_PX,
  MERMAID_EXPAND_THRESHOLD_PX,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_VIEWPORT_ROOT_MARGIN,
  buildMermaidCacheKey,
  estimateMermaidComplexity,
  isMermaidSource,
  readMermaidCache,
  writeMermaidCache,
} from "src/libs/markdown/mermaidRuntimeConfig"
import { openMermaidOverlay, shouldIgnoreStageClickForZoom } from "src/libs/markdown/mermaidRuntimeOverlay"
import {
  createMermaidRenderTimeoutError,
  isMermaidRenderTimeoutError,
  isMermaidSyntaxError,
  isNegativeRectWidthError,
  renderMermaidErrorState,
  sanitizeRenderableMermaidSource,
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
  allowDesktopWideLane: boolean
  lazyViewport: boolean
  shouldLogMermaidWarnings: boolean
  getMermaid: () => Promise<MermaidRuntimeInstance>
  isDisposed: () => boolean
  retryTimers: Set<number>
  readParseWarning: () => string | null
  clearParseWarning: () => void
}

const blockSourceCache = new WeakMap<HTMLElement, { raw: string; desired: string; renderable: string }>()

export const createMermaidRuntimeController = ({
  root,
  preset,
  allowDesktopWideLane,
  lazyViewport,
  shouldLogMermaidWarnings,
  getMermaid,
  isDisposed,
  retryTimers,
  readParseWarning,
  clearParseWarning,
}: MermaidRuntimeControllerOptions) => {
  let intersectionObserver: IntersectionObserver | null = null
  let cachedDesktopWideLaneBounds: DesktopWideLaneBounds | null | undefined
  let mermaidOverlayCleanup: (() => void) | null = null
  let renderQueue: Promise<void> = Promise.resolve()
  let activeQueueCount = 0
  const renderingBlocks = new Set<HTMLElement>()
  const observedBlocks = new WeakSet<HTMLElement>()
  let premeasuredRects = new WeakMap<HTMLElement, DOMRect>()
  let renderSequence = 0
  const loggedErrorSignatures = new Set<string>()
  const maxRetryCount = 6
  const retryBaseDelayMs = 150

  const resolveBlockSources = (block: HTMLElement) => {
    const codeBlock =
      block.querySelector<HTMLElement>("code.language-mermaid, code[data-language='mermaid'], code") || null
    const raw = block.getAttribute("data-mermaid-source") || codeBlock?.textContent || block.textContent || ""
    const cached = blockSourceCache.get(block)
    if (cached && cached.raw === raw) return cached
    const desired = applyMermaidSoftWrapHints(extractNormalizedMermaidSource(raw))
    const next = { raw, desired, renderable: desired ? sanitizeRenderableMermaidSource(desired) : "" }
    blockSourceCache.set(block, next)
    return next
  }

  const resolveBlockDesiredSource = (block: HTMLElement) => resolveBlockSources(block).desired

  const isBlockAlreadyRendered = (block: HTMLElement, desiredSource?: string) => {
    if (
      (block.dataset.mermaidRendered !== "true" && block.dataset.mermaidRendered !== "error") ||
      block.dataset.mermaidTheme !== preset.themeKey
    ) {
      return false
    }
    const targetSource = desiredSource ?? resolveBlockDesiredSource(block)
    if (!targetSource) return true
    const renderedSource = block.dataset.mermaidRenderedSource
    return (
      renderedSource === targetSource ||
      renderedSource === stripRiskyFlowchartDirectives(targetSource).trim()
    )
  }

  const resolveDesktopWideLaneBounds = (block: HTMLElement) => {
    if (!allowDesktopWideLane) return null
    if (cachedDesktopWideLaneBounds !== undefined) return cachedDesktopWideLaneBounds

    const detailLayout = block.closest<HTMLElement>(".detailLayout")
    const rightRail = detailLayout?.querySelector<HTMLElement>(".rightRail")
    if (!detailLayout || !rightRail || rightRail.offsetParent === null) {
      cachedDesktopWideLaneBounds = null
      return cachedDesktopWideLaneBounds
    }

    const leftRail = detailLayout.querySelector<HTMLElement>(".leftRail")
    cachedDesktopWideLaneBounds = {
      leftBound:
        leftRail && leftRail.offsetParent !== null
          ? leftRail.getBoundingClientRect().right + MERMAID_DESKTOP_SAFE_MARGIN_PX
          : MERMAID_DESKTOP_SAFE_MARGIN_PX,
      rightBound: rightRail.getBoundingClientRect().left - MERMAID_DESKTOP_SAFE_MARGIN_PX,
    }
    return cachedDesktopWideLaneBounds
  }

  const batchMeasureBlocks = (targetBlocks: HTMLElement[]) => {
    if (!targetBlocks.length) return
    resolveDesktopWideLaneBounds(targetBlocks[0])
    targetBlocks.forEach((block) => {
      if (!block.isConnected || isBlockAlreadyRendered(block)) return
      premeasuredRects.set(block, block.getBoundingClientRect())
    })
  }

  const renderMermaidWithTimeout = async (
    mermaidInstance: MermaidRuntimeInstance,
    renderId: string,
    sourceToRender: string
  ) => {
    let timeoutId: number | null = null
    try {
      const timed = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(createMermaidRenderTimeoutError())
        }, MERMAID_RENDER_TIMEOUT_MS)
      })
      return await Promise.race([
        Promise.resolve(mermaidInstance.render(renderId, sourceToRender)),
        timed,
      ])
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }

  const renderSourceIntoBlock = async ({
    block,
    index,
    mermaid,
    sourceToRender,
    complexityLevel,
    visibleWidth,
    blockRect,
    desktopWideLaneBounds,
  }: {
    block: HTMLElement
    index: number
    mermaid: MermaidRuntimeInstance
    sourceToRender: string
    complexityLevel: MermaidComplexityLevel
    visibleWidth: number
    blockRect: DOMRect
    desktopWideLaneBounds: DesktopWideLaneBounds | null
  }) => {
    if (isDisposed() || !block.isConnected) return
    const isMobileViewport = window.matchMedia("(max-width: 768px)").matches
    const isDesktopViewport = window.matchMedia(
      `(min-width: ${DESKTOP_MERMAID_MIN_VIEWPORT_PX}px)`
    ).matches
    const containerWidth = Math.max(280, visibleWidth)
    const reserveHeight = Math.max(120, Math.ceil(blockRect.height))

    const stage = document.createElement("div")
    stage.className = "aq-mermaid-stage mermaid"
    stage.style.minWidth = `${containerWidth}px`
    stage.style.width = `${containerWidth}px`
    stage.style.minHeight = `${reserveHeight}px`
    block.style.minHeight = `${reserveHeight}px`
    block.innerHTML = ""
    block.appendChild(stage)

    const cacheKey = buildMermaidCacheKey(sourceToRender, preset.themeKey, allowDesktopWideLane)
    const cached = readMermaidCache(cacheKey)
    let renderedSvg = cached?.svg || ""

    if (!renderedSvg) {
      const renderId = `aq-mermaid-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      clearParseWarning()
      const rendered = await renderMermaidWithTimeout(mermaid, renderId, sourceToRender)
      const parseWarning = readParseWarning()
      if (parseWarning) {
        throw new Error(parseWarning)
      }
      renderedSvg = rendered.svg
      writeMermaidCache(cacheKey, {
        svg: renderedSvg,
        complexity: complexityLevel,
      })
    }
    if (isDisposed() || !block.isConnected) return

    stage.innerHTML = renderedSvg

    const svgElement = stage.querySelector("svg")
    if (!svgElement) throw new Error("Mermaid SVG 생성 실패")

    const viewBox = svgElement.getAttribute("viewBox") || ""
    const viewBoxValues = viewBox
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
    const viewBoxWidth = viewBoxValues.length === 4 ? viewBoxValues[2] : NaN
    const viewBoxHeight = viewBoxValues.length === 4 ? viewBoxValues[3] : NaN
    const attrWidth = Number(svgElement.getAttribute("width"))
    const attrHeight = Number(svgElement.getAttribute("height"))
    const fallbackWidth = Number.isFinite(attrWidth) && attrWidth > 0 ? attrWidth : containerWidth
    const fallbackHeight =
      Number.isFinite(attrHeight) && attrHeight > 0
        ? attrHeight
        : Math.max(120, Math.round(fallbackWidth * 0.6))
    const intrinsicWidth =
      Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : Math.max(1, fallbackWidth)
    const intrinsicHeight =
      Number.isFinite(viewBoxHeight) && viewBoxHeight > 0
        ? viewBoxHeight
        : Math.max(1, fallbackHeight)
    const exceedsArticleWidth = intrinsicWidth > containerWidth + MERMAID_EXPAND_THRESHOLD_PX
    let maxDisplayWidth = containerWidth
    let wideBleedLeft = 0
    let wideBleedRight = 0

    if (isDesktopViewport && desktopWideLaneBounds && exceedsArticleWidth) {
      const safeLaneWidth = Math.max(
        containerWidth,
        Math.round(desktopWideLaneBounds.rightBound - desktopWideLaneBounds.leftBound)
      )
      const desiredWideWidth = Math.max(
        containerWidth,
        Math.min(intrinsicWidth, MERMAID_DESKTOP_WIDE_MAX_PX, safeLaneWidth)
      )
      const desiredExtra = Math.max(0, desiredWideWidth - containerWidth)

      if (desiredExtra > 24) {
        const leftAllowance = Math.max(0, Math.round(blockRect.left - desktopWideLaneBounds.leftBound))
        const rightAllowance = Math.max(0, Math.round(desktopWideLaneBounds.rightBound - blockRect.right))
        let nextLeftBleed = Math.min(leftAllowance, Math.round(desiredExtra / 2))
        let nextRightBleed = desiredExtra - nextLeftBleed

        if (nextRightBleed > rightAllowance) {
          nextRightBleed = rightAllowance
          nextLeftBleed = Math.min(leftAllowance, desiredExtra - nextRightBleed)
        }

        if (nextLeftBleed > leftAllowance) {
          nextLeftBleed = leftAllowance
          nextRightBleed = Math.min(rightAllowance, desiredExtra - nextLeftBleed)
        }

        const actualWideWidth = containerWidth + nextLeftBleed + nextRightBleed
        if (actualWideWidth > containerWidth + 24) {
          maxDisplayWidth = actualWideWidth
          wideBleedLeft = nextLeftBleed
          wideBleedRight = nextRightBleed
        }
      }
    }
    if (complexityLevel === "high") {
      maxDisplayWidth = Math.min(maxDisplayWidth, Math.max(containerWidth, 860))
    }

    const maxReadableHeight = isMobileViewport
      ? Number.POSITIVE_INFINITY
      : Math.min(760, Math.floor(window.innerHeight * 0.74))
    const usesDesktopWideLane = complexityLevel !== "high" && maxDisplayWidth > containerWidth + 24
    const effectiveMaxDisplayWidth = Math.max(240, maxDisplayWidth - (isMobileViewport ? 20 : 40))

    let scale = 1
    if (intrinsicWidth > effectiveMaxDisplayWidth) {
      scale = Math.min(scale, effectiveMaxDisplayWidth / intrinsicWidth)
    }
    if (intrinsicHeight * scale > maxReadableHeight) {
      scale = Math.min(scale, maxReadableHeight / intrinsicHeight)
    }
    if (complexityLevel === "high" && !isMobileViewport) {
      scale = Math.min(scale, MERMAID_COMPLEX_SCALE_CAP)
    }

    const roundedWidth = Math.max(1, Math.round(intrinsicWidth * scale))
    const roundedHeight = Math.max(1, Math.round(intrinsicHeight * scale))
    const stageWidth = usesDesktopWideLane ? maxDisplayWidth : containerWidth
    const needsExpandAction = intrinsicWidth > 0
    stage.style.width = usesDesktopWideLane ? `${stageWidth}px` : "100%"
    stage.style.minHeight = `${roundedHeight}px`
    stage.style.display = "flex"
    stage.style.justifyContent = "center"
    stage.style.overflowX = usesDesktopWideLane ? "visible" : "auto"
    block.style.overflowX = usesDesktopWideLane ? "visible" : "auto"
    stage.style.setProperty("-webkit-overflow-scrolling", "touch")
    block.style.setProperty("-webkit-overflow-scrolling", "touch")
    block.dataset.mermaidWide = usesDesktopWideLane ? "true" : "false"
    block.dataset.mermaidExpandable = needsExpandAction ? "true" : "false"
    block.style.setProperty("--aq-mermaid-wide-width", `${stageWidth}px`)
    block.style.setProperty("--aq-mermaid-bleed-left", `${wideBleedLeft}px`)
    block.style.setProperty("--aq-mermaid-bleed-right", `${wideBleedRight}px`)

    svgElement.setAttribute("preserveAspectRatio", "xMidYMin meet")
    svgElement.style.width = `${roundedWidth}px`
    svgElement.style.height = `${roundedHeight}px`
    svgElement.style.maxWidth = "100%"
    svgElement.style.maxHeight = "none"
    svgElement.style.minHeight = "0"
    svgElement.style.objectFit = "contain"
    svgElement.style.margin = "0 auto"
    svgElement.removeAttribute("width")
    svgElement.removeAttribute("height")

    stage.title = "클릭하여 크게 보기"
    stage.addEventListener("click", (event) => {
      if (!shouldIgnoreStageClickForZoom(event)) {
        mermaidOverlayCleanup = openMermaidOverlay(renderedSvg, mermaidOverlayCleanup, sourceToRender)
      }
    })
    block.querySelectorAll(".aq-mermaid-expand-btn").forEach((button) => button.remove())
    if (needsExpandAction) {
      const expandButton = document.createElement("button")
      expandButton.type = "button"
      expandButton.className = "aq-mermaid-expand-btn"
      expandButton.textContent = "확대 보기"
      expandButton.addEventListener("click", () => {
        mermaidOverlayCleanup = openMermaidOverlay(renderedSvg, mermaidOverlayCleanup, sourceToRender)
      })
      block.appendChild(expandButton)
    }

    block.style.minHeight = ""
    stage.style.minHeight = ""
    stage.style.minWidth = "0"
  }

  let enqueueRender: (block: HTMLElement) => void = () => {}

  const scheduleRetry = (block: HTMLElement) => {
    const retryCount = Number.parseInt(block.dataset.mermaidRetryCount || "0", 10)
    if (retryCount >= maxRetryCount) return false
    block.dataset.mermaidRetryCount = String(retryCount + 1)
    premeasuredRects.delete(block)
    const timerId = window.setTimeout(() => {
      retryTimers.delete(timerId)
      enqueueRender(block)
    }, retryBaseDelayMs * (retryCount + 1))
    retryTimers.add(timerId)
    return true
  }

  const renderSingleBlock = async (block: HTMLElement) => {
    if (isDisposed() || !block?.isConnected) return
    const mermaid = await getMermaid()
    if (isDisposed() || !block.isConnected) return
    const codeBlock =
      block.querySelector<HTMLElement>("code.language-mermaid, code[data-language='mermaid'], code") || null
    const codeClassName = codeBlock?.className?.toLowerCase() || ""
    const codeDataLanguage = (codeBlock?.getAttribute("data-language") || "").toLowerCase()
    const blockClassName = block.className?.toLowerCase() || ""
    const blockDataLanguage = (block.getAttribute("data-language") || "").toLowerCase()
    const hasMermaidHint =
      blockClassName.includes("aq-mermaid") ||
      blockDataLanguage === "mermaid" ||
      codeClassName.includes("language-mermaid") ||
      codeDataLanguage === "mermaid"
    const { desired: desiredSource, renderable: renderableSource } = resolveBlockSources(block)
    if (!desiredSource) return
    const looksLikeMermaid = isMermaidSource(desiredSource)
    if (!hasMermaidHint && !looksLikeMermaid) return
    if (isBlockAlreadyRendered(block, desiredSource)) return

    const premeasured = premeasuredRects.get(block)
    premeasuredRects.delete(block)
    const blockRect = premeasured && premeasured.width > 0 ? premeasured : block.getBoundingClientRect()
    const desktopWideLaneBounds = resolveDesktopWideLaneBounds(block)

    const complexity = estimateMermaidComplexity(renderableSource)
    block.dataset.mermaidComplexity = complexity.level
    if (!block.dataset.mermaidRendered) {
      block.dataset.mermaidRendered = "pending"
      block.dataset.mermaidPreset = preset.mode
    }
    const visibleWidth = block.clientWidth || Math.floor(blockRect.width)
    if (visibleWidth <= 0) {
      if (scheduleRetry(block)) return
      block.dataset.mermaidRendered = "error"
      block.classList.add("aq-mermaid-error")
      block.innerHTML = renderMermaidErrorState({
        source: desiredSource,
        error: "다이어그램 영역 너비를 계산할 수 없습니다. 레이아웃이 안정되면 다시 렌더링됩니다.",
      })
      return
    }

    const index = renderSequence
    renderSequence += 1

    try {
      await renderSourceIntoBlock({
        block,
        index,
        mermaid,
        sourceToRender: renderableSource,
        complexityLevel: complexity.level,
        visibleWidth,
        blockRect,
        desktopWideLaneBounds,
      })

      block.dataset.mermaidRenderedSource = desiredSource
      block.dataset.mermaidTheme = preset.themeKey
      block.dataset.mermaidPreset = preset.mode
      block.dataset.mermaidRendered = "true"
      block.dataset.mermaidRetryCount = "0"
      block.classList.remove("aq-mermaid-error")
    } catch (error) {
      const isSyntaxError = isMermaidSyntaxError(error)
      const isTimeoutError = isMermaidRenderTimeoutError(error)
      if (isNegativeRectWidthError(error) && scheduleRetry(block)) {
        return
      }

      const fallbackSource = stripRiskyFlowchartDirectives(desiredSource).trim()
      if (fallbackSource && fallbackSource !== desiredSource && fallbackSource !== renderableSource) {
        try {
          await renderSourceIntoBlock({
            block,
            index,
            mermaid,
            sourceToRender: fallbackSource,
            complexityLevel: complexity.level,
            visibleWidth,
            blockRect,
            desktopWideLaneBounds,
          })
          block.dataset.mermaidRenderedSource = fallbackSource
          block.dataset.mermaidTheme = preset.themeKey
          block.dataset.mermaidPreset = preset.mode
          block.dataset.mermaidRendered = "true"
          block.dataset.mermaidRetryCount = "0"
          block.classList.remove("aq-mermaid-error")
          return
        } catch (fallbackError) {
          const signature = `fallback:${fallbackSource}:${String(fallbackError)}`
          if (!loggedErrorSignatures.has(signature)) {
            loggedErrorSignatures.add(signature)
            if (shouldLogMermaidWarnings) {
              console.warn("[mermaid] fallback render failed", fallbackError)
            }
          }
          if (!isMermaidSyntaxError(fallbackError) && !isMermaidRenderTimeoutError(fallbackError) && scheduleRetry(block)) return
        }
      }

      if (!isSyntaxError && !isTimeoutError && scheduleRetry(block)) return

      block.dataset.mermaidRenderedSource = desiredSource
      block.dataset.mermaidTheme = preset.themeKey
      block.dataset.mermaidPreset = preset.mode
      block.dataset.mermaidRendered = "error"
      block.classList.add("aq-mermaid-error")
      block.style.minHeight = ""
      block.innerHTML = renderMermaidErrorState({ source: desiredSource, error })
      const signature = `${desiredSource}:${String(error)}`
      if (!loggedErrorSignatures.has(signature)) {
        loggedErrorSignatures.add(signature)
        if (shouldLogMermaidWarnings) {
          console.warn("[mermaid] render failed", error)
        }
      }
    }
  }

  enqueueRender = (block: HTMLElement) => {
    if (!block || renderingBlocks.has(block)) return
    renderingBlocks.add(block)
    activeQueueCount += 1
    renderQueue = renderQueue
      .then(async () => {
        await renderSingleBlock(block)
      })
      .catch((error) => {
        if (shouldLogMermaidWarnings) {
          console.warn("[mermaid] queued render failed", error)
        }
      })
      .finally(() => {
        renderingBlocks.delete(block)
        activeQueueCount = Math.max(0, activeQueueCount - 1)
      })
  }

  const renderMermaidBlocks = async () => {
    const codeBlocks = Array.from(
      root.querySelectorAll<HTMLElement>(
        "pre > code.language-mermaid, pre.aq-mermaid > code.language-mermaid, pre > code[data-language='mermaid'], pre[data-language='mermaid'] > code"
      )
    )
    const preBlocks = Array.from(
      root.querySelectorAll<HTMLElement>(
        "pre.aq-mermaid, pre[data-aq-mermaid='true'], pre[data-language='mermaid']"
      )
    )
    const mergedBlocks = new Map<HTMLElement, HTMLElement>()
    codeBlocks.forEach((codeBlock) => {
      const block = codeBlock.closest<HTMLElement>("pre")
      if (block) mergedBlocks.set(block, block)
    })
    preBlocks.forEach((block) => {
      mergedBlocks.set(block, block)
    })

    const blocks = Array.from(mergedBlocks.values())
    if (!blocks.length) return

    const candidateBlocks = blocks.filter(
      (block) => !isBlockAlreadyRendered(block) && !renderingBlocks.has(block)
    )

    if (!lazyViewport || typeof IntersectionObserver === "undefined") {
      batchMeasureBlocks(candidateBlocks)
      candidateBlocks.forEach((block) => {
        enqueueRender(block)
      })
      await renderQueue
      return
    }

    if (!intersectionObserver) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const intersectingBlocks: HTMLElement[] = []
          entries.forEach((entry) => {
            if (!entry.isIntersecting && entry.intersectionRatio <= 0) return
            const target = entry.target as HTMLElement
            intersectionObserver?.unobserve(target)
            observedBlocks.delete(target)
            intersectingBlocks.push(target)
          })
          if (intersectingBlocks.length > 0) {
            batchMeasureBlocks(intersectingBlocks)
            intersectingBlocks.forEach((target) => enqueueRender(target))
          }
        },
        {
          root: null,
          rootMargin: MERMAID_VIEWPORT_ROOT_MARGIN,
          threshold: 0.01,
        }
      )
    }

    candidateBlocks.forEach((block) => {
      if (observedBlocks.has(block)) return
      observedBlocks.add(block)
      intersectionObserver?.observe(block)
    })
  }

  const isRendering = () => activeQueueCount > 0 || renderingBlocks.size > 0

  return {
    isRendering,
    resetLayoutCache: (force = false) => {
      if (!force && isRendering()) return
      cachedDesktopWideLaneBounds = undefined
      premeasuredRects = new WeakMap<HTMLElement, DOMRect>()
    },
    renderMermaidBlocks,
    dispose: () => {
      mermaidOverlayCleanup?.()
      mermaidOverlayCleanup = null
      intersectionObserver?.disconnect()
      intersectionObserver = null
      renderingBlocks.clear()
      activeQueueCount = 0
    },
  }
}
