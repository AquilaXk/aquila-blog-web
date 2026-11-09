export const RIGHT_RAIL_HYBRID_MIN_VIEWPORT_PX = 821
export const LEFT_RAIL_HYBRID_MIN_VIEWPORT_PX = 821

const DETAIL_RAIL_GAP_FROM_HEADER_PX = 20
const STICKY_BLOCKING_OVERFLOW_VALUES = new Set(["auto", "scroll", "hidden", "clip"])

export type HybridRailMetrics = {
  enabled: boolean
  left: number
  width: number
  railTopDoc: number
  articleBottomDoc: number
  innerHeight: number
  stickyBlocked: boolean
}

const getHeaderHeightFromCssVar = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return 65
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 65
}

export const resolveRailTopOffset = () => getHeaderHeightFromCssVar() + DETAIL_RAIL_GAP_FROM_HEADER_PX

let stickyBlockingAncestorCache = new WeakMap<HTMLElement, boolean>()

export const invalidateStickyBlockingAncestorCache = () => {
  stickyBlockingAncestorCache = new WeakMap<HTMLElement, boolean>()
}

export const hasStickyBlockingAncestor = (node: HTMLElement | null) => {
  if (typeof window === "undefined" || !node) return false
  const cached = stickyBlockingAncestorCache.get(node)
  if (cached !== undefined) return cached

  let current = node.parentElement
  let blocked = false

  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current)
    if (
      STICKY_BLOCKING_OVERFLOW_VALUES.has(style.overflowY) ||
      STICKY_BLOCKING_OVERFLOW_VALUES.has(style.overflow)
    ) {
      blocked = true
      break
    }
    current = current.parentElement
  }

  stickyBlockingAncestorCache.set(node, blocked)
  return blocked
}

const assignInlineRailStyle = (
  inner: HTMLElement | null,
  position = "",
  top = "",
  left = "",
  width = "",
  transform = ""
) => {
  if (!inner) return
  inner.style.position = position
  inner.style.top = top
  inner.style.left = left
  inner.style.width = width
  inner.style.bottom = ""
  inner.style.transform = transform
}

export const clearInlineRailStyle = (inner: HTMLElement | null) => {
  assignInlineRailStyle(inner)
}

export const measureHybridRail = (
  rail: HTMLElement | null,
  inner: HTMLElement | null,
  enabled: boolean,
  articleBottomDoc: number
): HybridRailMetrics => {
  if (!rail || !inner || !enabled) {
    return {
      enabled,
      left: 0,
      width: 0,
      railTopDoc: 0,
      articleBottomDoc: 0,
      innerHeight: 0,
      stickyBlocked: false,
    }
  }

  const railRect = rail.getBoundingClientRect()
  return {
    enabled,
    left: Math.round(railRect.left),
    width: Math.round(railRect.width),
    railTopDoc: window.scrollY + railRect.top,
    articleBottomDoc,
    innerHeight: inner.offsetHeight,
    stickyBlocked: hasStickyBlockingAncestor(rail),
  }
}

export const applyHybridRail = (
  inner: HTMLElement | null,
  metrics: HybridRailMetrics,
  cachedTopOffset?: number
) => {
  if (!inner || !metrics.enabled || !metrics.stickyBlocked) {
    clearInlineRailStyle(inner)
    return
  }

  const topOffset =
    typeof cachedTopOffset === "number" && Number.isFinite(cachedTopOffset)
      ? cachedTopOffset
      : resolveRailTopOffset()
  const startFixedScrollY = metrics.railTopDoc - topOffset
  const endFixedScrollY = metrics.articleBottomDoc - topOffset - metrics.innerHeight

  if (metrics.width <= 0 || metrics.innerHeight <= 0 || endFixedScrollY <= startFixedScrollY) {
    clearInlineRailStyle(inner)
    return
  }

  if (window.scrollY < startFixedScrollY) {
    assignInlineRailStyle(inner, "absolute", "0px", "0px", "100%")
    return
  }

  if (window.scrollY > endFixedScrollY) {
    const bottomTop = Math.max(0, metrics.articleBottomDoc - metrics.railTopDoc - metrics.innerHeight)
    assignInlineRailStyle(inner, "absolute", `${bottomTop}px`, "0px", "100%")
    return
  }

  assignInlineRailStyle(
    inner,
    "fixed",
    `${topOffset}px`,
    `${metrics.left}px`,
    `${metrics.width}px`,
    "translateZ(0)"
  )
}
