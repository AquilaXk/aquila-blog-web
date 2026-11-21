/**
 * 참조 구현:
 * - igordanchenko/yet-another-react-lightbox (src/plugins/zoom, Toolbar, MIT License)
 * - lucide-icons/lucide (icons/zoom-out.svg, icons/zoom-in.svg, icons/rotate-ccw.svg, icons/x.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import { boxShadowColor, overlayScrim } from "src/design-system/tokens"
import { acquireBodyScrollLock } from "src/libs/utils/bodyScrollLock"
import {
  LUCIDE_CLOSE_SVG,
  LUCIDE_ROTATE_CCW_SVG,
  LUCIDE_ZOOM_IN_SVG,
  LUCIDE_ZOOM_OUT_SVG,
  createOverlayIconControl,
  handleZoomShortcutKey,
  resolveOverlayTranslations,
  trapOverlayTabFocus,
} from "./mermaidRuntimeOverlay"

const LIGHTBOX_SCROLL_CLOSE_DELTA_PX = 24
const DOUBLE_TAP_DELAY_MS = 300
const DOUBLE_TAP_MAX_DISTANCE_PX = 24

export type ImageLightboxOverlayOptions = {
  src: string
  alt?: string
  caption?: string
  trigger?: HTMLElement | null
}

let activeImageLightboxCleanup: (() => void) | null = null

const resolveReturnFocusTarget = (trigger?: HTMLElement | null): HTMLElement | null => {
  if (trigger) return trigger
  if (typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement) {
    return document.activeElement
  }
  return null
}

const createLightboxImageElement = (src: string, alt: string): HTMLImageElement => {
  const image = document.createElement("img")
  image.src = src
  image.alt = alt
  image.draggable = false
  image.setAttribute("src", src)
  image.setAttribute("alt", alt)
  image.style.display = "block"
  image.style.maxWidth = "min(90vw, 1200px)"
  image.style.maxHeight = "min(76dvh, 760px)"
  image.style.width = "auto"
  image.style.height = "auto"
  image.style.objectFit = "contain"
  image.style.userSelect = "none"
  image.style.transformOrigin = "center center"
  image.style.transform = "translate3d(0px, 0px, 0) scale(1)"
  image.style.transition = "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)"
  image.style.cursor = "zoom-out"
  return image
}

const appendCaptionIfPresent = (panel: HTMLElement, captionText: string) => {
  const trimmed = captionText.trim()
  if (!trimmed) return
  const captionEl = document.createElement("p")
  captionEl.className = "aq-image-lightbox-caption"
  captionEl.textContent = trimmed
  captionEl.style.margin = "0 auto"
  captionEl.style.padding = "0.45rem 0.9rem"
  captionEl.style.borderRadius = "6px"
  captionEl.style.background = overlayScrim.adminStrong
  captionEl.style.color = "var(--aq-on-accent)"
  captionEl.style.fontSize = "0.84rem"
  captionEl.style.lineHeight = "1.5"
  captionEl.style.textAlign = "center"
  captionEl.style.maxWidth = "min(92vw, 720px)"
  panel.appendChild(captionEl)
}

const styleDarkToolbarButton = (button: HTMLButtonElement, minWidth = "44px") => {
  button.style.minWidth = minWidth
  button.style.minHeight = "44px"
  button.style.borderRadius = "6px"
  button.style.border = "0"
  button.style.background = "transparent"
  button.style.color = "var(--aq-on-accent)"
}

export const openImageLightboxOverlay = (
  options: ImageLightboxOverlayOptions
): (() => void) | null => {
  if (typeof document === "undefined" || !options.src) return null

  activeImageLightboxCleanup?.()
  const returnFocusTarget = resolveReturnFocusTarget(options.trigger)
  const overlayT = resolveOverlayTranslations()
  const altText = options.alt || options.caption || overlayT.lightboxDialogAria
  const captionText = options.caption || options.alt || ""

  const overlay = document.createElement("div")
  overlay.className = "aq-image-lightbox-backdrop"
  overlay.dataset.aqImageLightbox = "true"
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", altText)
  overlay.style.position = "fixed"
  overlay.style.inset = "0"
  overlay.style.zIndex = "180"
  overlay.style.background = overlayScrim.adminStrong
  overlay.style.display = "grid"
  overlay.style.alignItems = "center"
  overlay.style.justifyItems = "center"
  overlay.style.padding =
    "max(0.9rem, env(safe-area-inset-top, 0px)) max(0.9rem, env(safe-area-inset-right, 0px)) max(0.9rem, env(safe-area-inset-bottom, 0px)) max(0.9rem, env(safe-area-inset-left, 0px))"

  const panel = document.createElement("div")
  panel.className = "aq-image-lightbox-panel"
  panel.style.position = "relative"
  panel.style.width = "100%"
  panel.style.height = "100%"
  panel.style.overflow = "hidden"
  panel.style.display = "grid"
  panel.style.gridTemplateRows = "minmax(0, 1fr) auto"
  panel.style.gap = "0.75rem"
  panel.style.background = "transparent"
  panel.style.border = "0"
  panel.style.padding = "0"

  const actionsBar = document.createElement("div")
  actionsBar.className = "aq-image-lightbox-actions"
  actionsBar.setAttribute("role", "toolbar")
  actionsBar.setAttribute("aria-label", overlayT.lightboxDialogAria)
  actionsBar.style.position = "absolute"
  actionsBar.style.top = "0"
  actionsBar.style.right = "0"
  actionsBar.style.zIndex = "2"
  actionsBar.style.display = "inline-flex"
  actionsBar.style.alignItems = "center"
  actionsBar.style.gap = "4px"
  actionsBar.style.padding = "4px"
  actionsBar.style.borderRadius = "8px"
  actionsBar.style.border = "1px solid color-mix(in srgb, var(--aq-on-accent) 16%, transparent)"
  actionsBar.style.background = overlayScrim.adminStrong
  actionsBar.style.boxShadow = `0 8px 24px ${boxShadowColor.modalStrong}`

  const { button: zoomOutButton } = createOverlayIconControl({
    iconSvg: LUCIDE_ZOOM_OUT_SVG,
    ariaLabel: overlayT.lightboxZoomOut,
    titleLabel: overlayT.lightboxZoomOut,
  })
  const { button: zoomResetButton, setVisual: setZoomResetVisual } = createOverlayIconControl({
    iconSvg: LUCIDE_ROTATE_CCW_SVG,
    ariaLabel: overlayT.lightboxZoomReset,
    titleLabel: overlayT.lightboxZoomReset,
    textLabel: "100%",
  })
  const { button: zoomInButton } = createOverlayIconControl({
    iconSvg: LUCIDE_ZOOM_IN_SVG,
    ariaLabel: overlayT.lightboxZoomIn,
    titleLabel: overlayT.lightboxZoomIn,
  })
  const { button: closeButton } = createOverlayIconControl({
    iconSvg: LUCIDE_CLOSE_SVG,
    ariaLabel: overlayT.lightboxClose,
    titleLabel: overlayT.lightboxClose,
  })
  styleDarkToolbarButton(zoomOutButton)
  styleDarkToolbarButton(zoomResetButton, "74px")
  styleDarkToolbarButton(zoomInButton)
  styleDarkToolbarButton(closeButton)

  const stage = document.createElement("div")
  stage.className = "aq-image-lightbox-stage"
  stage.style.overflow = "auto"
  stage.style.display = "grid"
  stage.style.justifyItems = "center"
  stage.style.alignItems = "center"
  stage.style.touchAction = "none"
  stage.style.setProperty("-webkit-overflow-scrolling", "touch")

  const stageImg = createLightboxImageElement(options.src, altText)
  stage.appendChild(stageImg)

  let zoomLevel = 1
  let panX = 0
  let panY = 0
  let dragging = false
  let movedDuringPointer = false
  let activePointerId: number | null = null
  let dragStartX = 0
  let dragStartY = 0
  let panStartX = 0
  let panStartY = 0

  // 2-포인터 핀치 줌 & 더블탭 제스처 상태
  const activePointers = new Map<number, { clientX: number; clientY: number }>()
  let initialPinchDistance = 0
  let initialPinchZoom = 1
  let lastTapTimestamp = 0
  let lastTapX = 0
  let lastTapY = 0
  let doubleTapTriggered = false

  const clampPanOffsets = (nextX: number, nextY: number, scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 }
    const stageRect = stage.getBoundingClientRect()
    const baseWidth = stageImg.offsetWidth || stageRect.width
    const baseHeight = stageImg.offsetHeight || stageRect.height
    const maxPanX = Math.max(0, (baseWidth * scale - stageRect.width) / 2 + 48)
    const maxPanY = Math.max(0, (baseHeight * scale - stageRect.height) / 2 + 48)
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
    }
  }

  const syncImageTransform = () => {
    stageImg.style.transformOrigin = "center center"
    stageImg.style.transform = `translate3d(${Math.round(panX)}px, ${Math.round(panY)}px, 0) scale(${zoomLevel})`
    stage.style.cursor = zoomLevel > 1 ? (dragging ? "grabbing" : "grab") : ""
    stageImg.style.cursor = zoomLevel > 1 ? (dragging ? "grabbing" : "grab") : "zoom-out"
  }

  const applyZoom = (nextZoom: number) => {
    zoomLevel = Math.max(0.5, Math.min(3, Math.round(nextZoom * 100) / 100))
    setZoomResetVisual(LUCIDE_ROTATE_CCW_SVG, `${Math.round(zoomLevel * 100)}%`)
    const clamped = clampPanOffsets(panX, panY, zoomLevel)
    panX = clamped.x
    panY = clamped.y
    syncImageTransform()
  }

  const handleZoomOut = () => applyZoom(zoomLevel - 0.25)
  const handleZoomReset = () => applyZoom(1)
  const handleZoomIn = () => applyZoom(zoomLevel + 0.25)

  zoomOutButton.addEventListener("click", handleZoomOut)
  zoomResetButton.addEventListener("click", handleZoomReset)
  zoomInButton.addEventListener("click", handleZoomIn)

  actionsBar.appendChild(zoomOutButton)
  actionsBar.appendChild(zoomResetButton)
  actionsBar.appendChild(zoomInButton)
  actionsBar.appendChild(closeButton)

  panel.appendChild(actionsBar)
  panel.appendChild(stage)
  appendCaptionIfPresent(panel, captionText)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const handlePointerDown = (event: PointerEvent) => {
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

    if (activePointers.size === 2) {
      // 2-포인터 핀치 줌 시작
      const pointers = Array.from(activePointers.values())
      const p1 = pointers[0]
      const p2 = pointers[1]
      initialPinchDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY)
      initialPinchZoom = zoomLevel
      dragging = false
      stageImg.style.transition = "none"
      return
    }

    if (zoomLevel <= 1) return
    if (typeof event.button === "number" && event.button !== 0) return
    event.preventDefault?.()
    dragging = true
    movedDuringPointer = false
    activePointerId = event.pointerId
    dragStartX = event.clientX
    dragStartY = event.clientY
    panStartX = panX
    panStartY = panY
    stageImg.style.transition = "none"
    syncImageTransform()
    stage.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

    if (activePointers.size === 2 && initialPinchDistance > 0) {
      const pointers = Array.from(activePointers.values())
      const p1 = pointers[0]
      const p2 = pointers[1]
      const currentDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY)
      if (Math.abs(currentDistance - initialPinchDistance) > 4) {
        movedDuringPointer = true
      }
      const scaleRatio = currentDistance / initialPinchDistance
      applyZoom(initialPinchZoom * scaleRatio)
      return
    }

    if (!dragging) return
    if (activePointerId !== null && event.pointerId !== activePointerId) return
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      movedDuringPointer = true
    }
    const clamped = clampPanOffsets(panStartX + deltaX, panStartY + deltaY, zoomLevel)
    panX = clamped.x
    panY = clamped.y
    syncImageTransform()
  }

  const handlePointerUpOrCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId)

    if (activePointers.size === 1) {
      // 핀치가 끝나고 1개 포인터가 남아있을 때 상태 초기화
      initialPinchDistance = 0
      const remainingPointer = Array.from(activePointers.entries())[0]
      activePointerId = remainingPointer[0]
      dragStartX = remainingPointer[1].clientX
      dragStartY = remainingPointer[1].clientY
      panStartX = panX
      panStartY = panY
      dragging = zoomLevel > 1
      return
    }

    if (activePointers.size === 0) {
      initialPinchDistance = 0
      if (dragging) {
        dragging = false
        if (activePointerId !== null) {
          stage.releasePointerCapture?.(activePointerId)
          activePointerId = null
        }
        stageImg.style.transition = "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)"
        syncImageTransform()
      }

      // 더블탭 판정 (마우스 좌클릭 또는 터치 릴리즈)
      if (!movedDuringPointer && (event.button === 0 || typeof event.button !== "number")) {
        const now = Date.now()
        const timeDiff = now - lastTapTimestamp
        const distDiff = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY)
        if (timeDiff < DOUBLE_TAP_DELAY_MS && distDiff < DOUBLE_TAP_MAX_DISTANCE_PX) {
          doubleTapTriggered = true
          lastTapTimestamp = 0
          if (zoomLevel < 1.2) {
            applyZoom(2)
          } else {
            applyZoom(1)
          }
        } else {
          lastTapTimestamp = now
          lastTapX = event.clientX
          lastTapY = event.clientY
        }
      }
    }
  }

  const handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault()
    doubleTapTriggered = true
    if (zoomLevel < 1.2) {
      applyZoom(2)
    } else {
      applyZoom(1)
    }
  }

  stage.addEventListener("pointerdown", handlePointerDown)
  stage.addEventListener("pointermove", handlePointerMove)
  stage.addEventListener("pointerup", handlePointerUpOrCancel)
  stage.addEventListener("pointercancel", handlePointerUpOrCancel)
  stage.addEventListener("dblclick", handleDoubleClick)

  const initialScrollY = typeof window !== "undefined" ? window.scrollY : 0
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
    if (
      event.target === overlay ||
      event.target === panel ||
      (event.target === stage && zoomLevel <= 1)
    ) {
      closeOverlay()
    }
  }

  const handleImageClick = () => {
    if (doubleTapTriggered) {
      doubleTapTriggered = false
      return
    }
    if (movedDuringPointer) {
      movedDuringPointer = false
      return
    }
    if (zoomLevel === 1) {
      closeOverlay()
    }
  }

  const handleWheel = (event: WheelEvent) => {
    if (zoomLevel === 1 && Math.abs(event.deltaY) > 0) {
      closeOverlay()
    }
  }

  const handleWindowScroll = () => {
    if (typeof window === "undefined") return
    if (Math.abs(window.scrollY - initialScrollY) > LIGHTBOX_SCROLL_CLOSE_DELTA_PX) {
      closeOverlay()
    }
  }

  const handlePopState = () => {
    closeOverlay()
  }

  closeOverlay = () => {
    if (closed) return
    closed = true
    if (activeImageLightboxCleanup === closeOverlay) {
      activeImageLightboxCleanup = null
    }
    stage.removeEventListener("pointerdown", handlePointerDown)
    stage.removeEventListener("pointermove", handlePointerMove)
    stage.removeEventListener("pointerup", handlePointerUpOrCancel)
    stage.removeEventListener("pointercancel", handlePointerUpOrCancel)
    stage.removeEventListener("dblclick", handleDoubleClick)
    releaseBodyScrollLock()
    overlay.remove()
    document.removeEventListener("keydown", handleOverlayKeyDown)
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("scroll", handleWindowScroll)
    }
    closeButton.removeEventListener("click", closeOverlay)
    overlay.removeEventListener("click", handleOverlayClick)
    stageImg.removeEventListener("click", handleImageClick)
    overlay.removeEventListener("wheel", handleWheel)
    if (returnFocusTarget?.isConnected) {
      returnFocusTarget.focus()
    }
  }

  activeImageLightboxCleanup = closeOverlay
  closeButton.focus()
  overlay.addEventListener("click", handleOverlayClick)
  stageImg.addEventListener("click", handleImageClick)
  overlay.addEventListener("wheel", handleWheel, { passive: true })
  closeButton.addEventListener("click", closeOverlay)
  document.addEventListener("keydown", handleOverlayKeyDown)
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", handlePopState)
    window.addEventListener("scroll", handleWindowScroll, { passive: true })
  }

  return closeOverlay
}
