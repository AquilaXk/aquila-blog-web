import { acquireBodyScrollLock } from "src/libs/utils/bodyScrollLock"

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const createOverlayActionButton = (label: string, ariaLabel: string): HTMLButtonElement => {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = label
  button.setAttribute("aria-label", ariaLabel)
  button.style.display = "inline-flex"
  button.style.alignItems = "center"
  button.style.justifyContent = "center"
  button.style.minHeight = "44px"
  button.style.padding = "0 0.8rem"
  button.style.borderRadius = "999px"
  button.style.border = "1px solid rgba(255, 255, 255, 0.2)"
  button.style.background = "rgba(15, 23, 42, 0.7)"
  button.style.color = "#f3f4f6"
  button.style.fontSize = "0.82rem"
  button.style.fontWeight = "700"
  button.style.cursor = "pointer"
  return button
}

export const handleZoomShortcutKey = (
  event: KeyboardEvent,
  handlers: {
    onZoomIn: () => void
    onZoomOut: () => void
    onZoomReset: () => void
  }
): boolean => {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.key === "+" || event.key === "=") {
    event.preventDefault()
    handlers.onZoomIn()
    return true
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault()
    handlers.onZoomOut()
    return true
  }
  if (event.key === "0") {
    event.preventDefault()
    handlers.onZoomReset()
    return true
  }
  return false
}

export const attachStageDragPan = (
  stage: HTMLElement,
  getZoomLevel: () => number
): (() => void) => {
  let dragging = false
  let activePointerId: number | null = null
  let startX = 0
  let startY = 0
  let startScrollLeft = 0
  let startScrollTop = 0

  const handlePointerDown = (event: PointerEvent) => {
    if (getZoomLevel() <= 1) return
    if (typeof event.button === "number" && event.button !== 0) return
    dragging = true
    activePointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    startScrollLeft = stage.scrollLeft
    startScrollTop = stage.scrollTop
    stage.style.cursor = "grabbing"
    stage.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging) return
    if (activePointerId !== null && event.pointerId !== activePointerId) return
    stage.scrollLeft = startScrollLeft - (event.clientX - startX)
    stage.scrollTop = startScrollTop - (event.clientY - startY)
  }

  const stopDragging = (event: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (activePointerId !== null) {
      stage.releasePointerCapture?.(activePointerId)
      activePointerId = null
    }
    stage.style.cursor = getZoomLevel() > 1 ? "grab" : ""
    void event
  }

  stage.addEventListener("pointerdown", handlePointerDown)
  stage.addEventListener("pointermove", handlePointerMove)
  stage.addEventListener("pointerup", stopDragging)
  stage.addEventListener("pointercancel", stopDragging)

  return () => {
    stage.removeEventListener("pointerdown", handlePointerDown)
    stage.removeEventListener("pointermove", handlePointerMove)
    stage.removeEventListener("pointerup", stopDragging)
    stage.removeEventListener("pointercancel", stopDragging)
  }
}

export const trapOverlayTabFocus = (event: KeyboardEvent, overlay: HTMLElement) => {
  if (event.key !== "Tab") return

  const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex !== -1 &&
      element.offsetParent !== null
  )
  if (!focusable.length) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey) {
    if (!active || active === first || !overlay.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (!active || active === last || !overlay.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

const resolvePreviousActiveElement = (): HTMLElement | null =>
  typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null

const configureMermaidStageSvg = (stageSvg: SVGSVGElement | null) => {
  if (!stageSvg) return
  stageSvg.removeAttribute("width")
  stageSvg.removeAttribute("height")
  stageSvg.style.maxWidth = "none"
  stageSvg.style.width = "max-content"
  stageSvg.style.height = "auto"
  stageSvg.style.display = "block"
  stageSvg.style.transition = "transform 0.14s ease"
}

const appendCopySourceButtonIfPresent = (actionsBar: HTMLElement, sourceText: string) => {
  const trimmed = sourceText.trim()
  if (!trimmed) return
  const copySourceButton = createOverlayActionButton("코드 복사", "Mermaid 원본 코드 복사")
  copySourceButton.addEventListener("click", () => {
    const writePromise =
      typeof navigator !== "undefined" ? navigator.clipboard?.writeText(sourceText) : undefined
    if (!writePromise) {
      copySourceButton.textContent = "복사 실패"
      return
    }
    void writePromise
      .then(() => {
        copySourceButton.textContent = "복사됨"
      })
      .catch(() => {
        copySourceButton.textContent = "복사 실패"
      })
  })
  actionsBar.appendChild(copySourceButton)
}

export const openMermaidOverlay = (
  svgMarkup: string,
  previousCleanup?: (() => void) | null,
  sourceText = ""
) => {
  if (typeof document === "undefined") return null

  previousCleanup?.()
  const previousFocusedElement = resolvePreviousActiveElement()

  const overlay = document.createElement("div")
  overlay.setAttribute("data-aq-mermaid-overlay", "true")
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", "Mermaid 확대 보기")
  overlay.style.position = "fixed"
  overlay.style.inset = "0"
  overlay.style.zIndex = "180"
  overlay.style.background = "rgba(2, 6, 23, 0.7)"
  overlay.style.display = "grid"
  overlay.style.alignItems = "center"
  overlay.style.justifyItems = "center"
  overlay.style.padding =
    "max(0.9rem, env(safe-area-inset-top, 0px)) max(0.9rem, env(safe-area-inset-right, 0px)) max(0.9rem, env(safe-area-inset-bottom, 0px)) max(0.9rem, env(safe-area-inset-left, 0px))"

  const panel = document.createElement("div")
  panel.style.width = "min(96vw, 1280px)"
  panel.style.maxHeight = "min(90dvh, 820px)"
  panel.style.overflow = "auto"
  panel.style.borderRadius = "14px"
  panel.style.border = "1px solid rgba(255, 255, 255, 0.14)"
  panel.style.background = "rgba(11, 16, 23, 0.98)"
  panel.style.padding = "0.75rem"

  const actionsBar = document.createElement("div")
  actionsBar.className = "aq-mermaid-modal-actions"
  actionsBar.style.display = "flex"
  actionsBar.style.alignItems = "center"
  actionsBar.style.justifyContent = "flex-end"
  actionsBar.style.gap = "0.45rem"
  actionsBar.style.marginBottom = "0.56rem"

  const zoomOutButton = createOverlayActionButton("-", "축소")
  const zoomResetButton = createOverlayActionButton("100%", "배율 초기화")
  const zoomInButton = createOverlayActionButton("+", "확대")
  const closeButton = createOverlayActionButton("닫기", "닫기")

  const stage = document.createElement("div")
  stage.style.overflow = "auto"
  stage.style.setProperty("-webkit-overflow-scrolling", "touch")
  stage.innerHTML = svgMarkup
  const stageSvg = stage.querySelector("svg")
  let zoomLevel = 1

  const applyZoom = (nextZoom: number) => {
    zoomLevel = Math.max(0.5, Math.min(2.5, Math.round(nextZoom * 100) / 100))
    zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`
    stage.style.cursor = zoomLevel > 1 ? "grab" : ""
    if (stageSvg) {
      stageSvg.style.transform = `scale(${zoomLevel})`
      stageSvg.style.transformOrigin = "top left"
    }
  }

  configureMermaidStageSvg(stageSvg)

  const handleZoomOut = () => applyZoom(zoomLevel - 0.25)
  const handleZoomReset = () => applyZoom(1)
  const handleZoomIn = () => applyZoom(zoomLevel + 0.25)

  zoomOutButton.addEventListener("click", handleZoomOut)
  zoomResetButton.addEventListener("click", handleZoomReset)
  zoomInButton.addEventListener("click", handleZoomIn)

  actionsBar.appendChild(zoomOutButton)
  actionsBar.appendChild(zoomResetButton)
  actionsBar.appendChild(zoomInButton)
  appendCopySourceButtonIfPresent(actionsBar, sourceText)
  actionsBar.appendChild(closeButton)

  panel.appendChild(actionsBar)
  panel.appendChild(stage)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const detachDragPan = attachStageDragPan(stage, () => zoomLevel)
  const releaseBodyScrollLock = acquireBodyScrollLock()
  let closed = false
  let closeOverlay: () => void

  const handleOverlayKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeOverlay()
      return
    }

    if (
      handleZoomShortcutKey(event, {
        onZoomIn: handleZoomIn,
        onZoomOut: handleZoomOut,
        onZoomReset: handleZoomReset,
      })
    ) {
      return
    }

    trapOverlayTabFocus(event, overlay)
  }

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === overlay) {
      closeOverlay()
    }
  }

  closeOverlay = () => {
    if (closed) return
    closed = true
    detachDragPan()
    releaseBodyScrollLock()
    overlay.remove()
    document.removeEventListener("keydown", handleOverlayKeyDown)
    closeButton.removeEventListener("click", closeOverlay)
    overlay.removeEventListener("click", handleOverlayClick)
    if (previousFocusedElement?.isConnected) {
      previousFocusedElement.focus()
    }
  }

  closeButton.focus()
  overlay.addEventListener("click", handleOverlayClick)
  closeButton.addEventListener("click", closeOverlay)
  document.addEventListener("keydown", handleOverlayKeyDown)

  return closeOverlay
}
