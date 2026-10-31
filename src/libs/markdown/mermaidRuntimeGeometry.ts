import { applyMermaidSoftWrapHints, extractNormalizedMermaidSource } from "src/libs/markdown/mermaid"
import {
  MERMAID_COMPLEX_SCALE_CAP,
  MERMAID_DESKTOP_SAFE_MARGIN_PX,
  MERMAID_DESKTOP_WIDE_MAX_PX,
  MERMAID_EXPAND_THRESHOLD_PX,
} from "src/libs/markdown/mermaidRuntimeConfig"
import {
  parseSvgViewBoxNumbers,
  shouldIgnoreStageClickForZoom,
} from "src/libs/markdown/mermaidRuntimeOverlay"
import {
  renderMermaidErrorState,
  sanitizeRenderableMermaidSource,
  stripRiskyFlowchartDirectives,
} from "src/libs/markdown/mermaidRuntimeSanitize"
import type {
  DesktopWideLaneBounds,
  MermaidComplexityLevel,
  MermaidRuntimePreset,
} from "src/libs/markdown/mermaidRuntimeTypes"

export type BlockSources = {
  raw: string
  original: string
  desired: string
  renderable: string
}

type WideLaneAllocation = {
  maxDisplayWidth: number
  wideBleedLeft: number
  wideBleedRight: number
}

export type MermaidDisplayGeometry = {
  roundedWidth: number
  roundedHeight: number
  stageWidth: number
  usesDesktopWideLane: boolean
  needsExpandAction: boolean
  wideBleedLeft: number
  wideBleedRight: number
}

const blockSourceCache = new WeakMap<HTMLElement, BlockSources>()

const queryMermaidCodeElement = (block: HTMLElement) =>
  block.querySelector<HTMLElement>(
    "code.language-mermaid, code[data-language='mermaid'], code"
  ) ?? null

const readRawBlockSource = (block: HTMLElement, codeBlock: HTMLElement | null): string => {
  const candidates = [
    block.dataset.mermaidSource,
    block.dataset.mermaidOriginalSource,
    block.dataset.mermaidRenderedSource,
    codeBlock?.textContent,
    block.textContent,
  ]
  for (const candidate of candidates) {
    if (candidate) return candidate
  }
  return ""
}

export const resolveBlockSources = (block: HTMLElement): BlockSources => {
  const raw = readRawBlockSource(block, queryMermaidCodeElement(block))
  const cached = blockSourceCache.get(block)
  if (cached?.raw === raw) return cached
  const original = extractNormalizedMermaidSource(raw)
  const desired = applyMermaidSoftWrapHints(original)
  const next: BlockSources = {
    raw,
    original,
    desired,
    renderable: desired ? sanitizeRenderableMermaidSource(desired) : "",
  }
  blockSourceCache.set(block, next)
  return next
}

export const isBlockAlreadyRendered = (
  block: HTMLElement,
  themeKey: string,
  desiredSource?: string
): boolean => {
  const state = block.dataset.mermaidRendered
  if (state !== "true" && state !== "error") return false
  if (block.dataset.mermaidTheme !== themeKey) return false
  const targetSource = desiredSource ?? resolveBlockSources(block).desired
  if (!targetSource) return true
  const renderedSource = block.dataset.mermaidRenderedSource
  return (
    renderedSource === targetSource ||
    renderedSource === stripRiskyFlowchartDirectives(targetSource).trim()
  )
}

export const hasMermaidBlockHint = (block: HTMLElement): boolean => {
  const codeBlock = queryMermaidCodeElement(block)
  const codeClassName = codeBlock?.className?.toLowerCase() || ""
  const codeDataLanguage = (codeBlock?.getAttribute("data-language") || "").toLowerCase()
  const blockClassName = block.className?.toLowerCase() || ""
  const blockDataLanguage = (block.getAttribute("data-language") || "").toLowerCase()
  return (
    blockClassName.includes("aq-mermaid") ||
    blockDataLanguage === "mermaid" ||
    codeClassName.includes("language-mermaid") ||
    codeDataLanguage === "mermaid"
  )
}

export const collectMermaidBlocksInRoot = (root: HTMLElement): HTMLElement[] => {
  const mergedBlocks = new Set<HTMLElement>()
  root
    .querySelectorAll<HTMLElement>(
      "pre > code.language-mermaid, pre.aq-mermaid > code.language-mermaid, pre > code[data-language='mermaid'], pre[data-language='mermaid'] > code"
    )
    .forEach((codeBlock) => {
      const block = codeBlock.closest<HTMLElement>("pre")
      if (block) mergedBlocks.add(block)
    })
  root
    .querySelectorAll<HTMLElement>(
      "pre.aq-mermaid, pre[data-aq-mermaid='true'], pre[data-language='mermaid']"
    )
    .forEach((block) => mergedBlocks.add(block))
  return Array.from(mergedBlocks)
}

export const markMermaidBlockRendered = (
  block: HTMLElement,
  preset: MermaidRuntimePreset,
  renderedSource: string,
  visibleWidth: number
) => {
  block.dataset.mermaidRenderedSource = renderedSource
  block.dataset.mermaidRenderedWidth = String(Math.round(visibleWidth))
  block.dataset.mermaidTheme = preset.themeKey
  block.dataset.mermaidPreset = preset.mode
  block.dataset.mermaidRendered = "true"
  block.dataset.mermaidRetryCount = "0"
  block.classList.remove("aq-mermaid-error")
}

export const markMermaidBlockError = (
  block: HTMLElement,
  preset: MermaidRuntimePreset,
  desiredSource: string,
  displaySource: string,
  error: unknown
) => {
  block.dataset.mermaidRenderedSource = desiredSource
  block.dataset.mermaidTheme = preset.themeKey
  block.dataset.mermaidPreset = preset.mode
  block.dataset.mermaidRendered = "error"
  block.classList.add("aq-mermaid-error")
  block.style.minHeight = ""
  block.innerHTML = renderMermaidErrorState({ source: displaySource, error })
}

export const measureDesktopWideLaneBounds = (block: HTMLElement): DesktopWideLaneBounds | null => {
  const detailLayout = block.closest<HTMLElement>(".detailLayout")
  const rightRail = detailLayout?.querySelector<HTMLElement>(".rightRail")
  if (!detailLayout || !rightRail || rightRail.offsetParent === null) {
    return null
  }
  const leftRail = detailLayout.querySelector<HTMLElement>(".leftRail")
  const hasVisibleLeftRail = Boolean(leftRail && leftRail.offsetParent !== null)
  const leftBound = hasVisibleLeftRail
    ? (leftRail as HTMLElement).getBoundingClientRect().right + MERMAID_DESKTOP_SAFE_MARGIN_PX
    : MERMAID_DESKTOP_SAFE_MARGIN_PX
  return {
    leftBound,
    rightBound: rightRail.getBoundingClientRect().left - MERMAID_DESKTOP_SAFE_MARGIN_PX,
  }
}

const readSvgIntrinsicDimensions = (
  svgElement: SVGSVGElement,
  containerWidth: number
): { intrinsicWidth: number; intrinsicHeight: number } => {
  const viewBoxValues = parseSvgViewBoxNumbers(svgElement.getAttribute("viewBox") || "")
  const viewBoxWidth = viewBoxValues ? viewBoxValues[2] : Number.NaN
  const viewBoxHeight = viewBoxValues ? viewBoxValues[3] : Number.NaN
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
  return { intrinsicWidth, intrinsicHeight }
}

const computeWideLaneAllocation = ({
  containerWidth,
  intrinsicWidth,
  blockRect,
  desktopWideLaneBounds,
  isDesktopViewport,
}: {
  containerWidth: number
  intrinsicWidth: number
  blockRect: DOMRect
  desktopWideLaneBounds: DesktopWideLaneBounds | null
  isDesktopViewport: boolean
}): WideLaneAllocation => {
  const exceedsArticleWidth = intrinsicWidth > containerWidth + MERMAID_EXPAND_THRESHOLD_PX
  if (!isDesktopViewport || !desktopWideLaneBounds || !exceedsArticleWidth) {
    return { maxDisplayWidth: containerWidth, wideBleedLeft: 0, wideBleedRight: 0 }
  }

  const safeLaneWidth = Math.max(
    containerWidth,
    Math.round(desktopWideLaneBounds.rightBound - desktopWideLaneBounds.leftBound)
  )
  const desiredWideWidth = Math.max(
    containerWidth,
    Math.min(intrinsicWidth, MERMAID_DESKTOP_WIDE_MAX_PX, safeLaneWidth)
  )
  const desiredExtra = Math.max(0, desiredWideWidth - containerWidth)
  if (desiredExtra <= 24) {
    return { maxDisplayWidth: containerWidth, wideBleedLeft: 0, wideBleedRight: 0 }
  }

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
  if (actualWideWidth <= containerWidth + 24) {
    return { maxDisplayWidth: containerWidth, wideBleedLeft: 0, wideBleedRight: 0 }
  }
  return {
    maxDisplayWidth: actualWideWidth,
    wideBleedLeft: nextLeftBleed,
    wideBleedRight: nextRightBleed,
  }
}

export const computeMermaidDisplayGeometry = ({
  svgElement,
  containerWidth,
  blockRect,
  desktopWideLaneBounds,
  complexityLevel,
  isMobileViewport,
  isDesktopViewport,
}: {
  svgElement: SVGSVGElement
  containerWidth: number
  blockRect: DOMRect
  desktopWideLaneBounds: DesktopWideLaneBounds | null
  complexityLevel: MermaidComplexityLevel
  isMobileViewport: boolean
  isDesktopViewport: boolean
}): MermaidDisplayGeometry => {
  const { intrinsicWidth, intrinsicHeight } = readSvgIntrinsicDimensions(svgElement, containerWidth)
  const allocation = computeWideLaneAllocation({
    containerWidth,
    intrinsicWidth,
    blockRect,
    desktopWideLaneBounds,
    isDesktopViewport,
  })
  const maxDisplayWidth =
    complexityLevel === "high"
      ? Math.min(allocation.maxDisplayWidth, Math.max(containerWidth, 860))
      : allocation.maxDisplayWidth
  const maxReadableHeight = isMobileViewport
    ? Number.POSITIVE_INFINITY
    : Math.min(760, Math.floor(window.innerHeight * 0.74))
  const usesDesktopWideLane = complexityLevel !== "high" && maxDisplayWidth > containerWidth + 24
  const horizontalInset = isMobileViewport ? 20 : 40
  const effectiveMaxDisplayWidth = Math.max(240, maxDisplayWidth - horizontalInset)

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

  return {
    roundedWidth: Math.max(1, Math.round(intrinsicWidth * scale)),
    roundedHeight: Math.max(1, Math.round(intrinsicHeight * scale)),
    stageWidth: usesDesktopWideLane ? maxDisplayWidth : containerWidth,
    usesDesktopWideLane,
    needsExpandAction: intrinsicWidth > 0,
    wideBleedLeft: allocation.wideBleedLeft,
    wideBleedRight: allocation.wideBleedRight,
  }
}

export const applyRenderedMermaidDom = ({
  block,
  stage,
  svgElement,
  geometry,
  onTriggerOverlay,
}: {
  block: HTMLElement
  stage: HTMLDivElement
  svgElement: SVGSVGElement
  geometry: MermaidDisplayGeometry
  onTriggerOverlay: () => void
}) => {
  const overflowValue = geometry.usesDesktopWideLane ? "visible" : "auto"
  stage.style.width = geometry.usesDesktopWideLane ? `${geometry.stageWidth}px` : "100%"
  stage.style.minHeight = `${geometry.roundedHeight}px`
  stage.style.display = "flex"
  stage.style.justifyContent = "center"
  stage.style.overflowX = overflowValue
  block.style.overflowX = overflowValue
  stage.style.setProperty("-webkit-overflow-scrolling", "touch")
  block.style.setProperty("-webkit-overflow-scrolling", "touch")
  block.dataset.mermaidWide = geometry.usesDesktopWideLane ? "true" : "false"
  block.dataset.mermaidExpandable = geometry.needsExpandAction ? "true" : "false"
  block.style.setProperty("--aq-mermaid-wide-width", `${geometry.stageWidth}px`)
  block.style.setProperty("--aq-mermaid-bleed-left", `${geometry.wideBleedLeft}px`)
  block.style.setProperty("--aq-mermaid-bleed-right", `${geometry.wideBleedRight}px`)

  svgElement.setAttribute("preserveAspectRatio", "xMidYMin meet")
  svgElement.style.width = `${geometry.roundedWidth}px`
  svgElement.style.height = `${geometry.roundedHeight}px`
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
      onTriggerOverlay()
    }
  })
  block.querySelectorAll(".aq-mermaid-expand-btn").forEach((button) => button.remove())
  if (geometry.needsExpandAction) {
    const expandButton = document.createElement("button")
    expandButton.type = "button"
    expandButton.className = "aq-mermaid-expand-btn"
    expandButton.textContent = "확대 보기"
    expandButton.addEventListener("click", onTriggerOverlay)
    block.appendChild(expandButton)
  }

  block.style.minHeight = ""
  stage.style.minHeight = ""
  stage.style.minWidth = "0"
}
