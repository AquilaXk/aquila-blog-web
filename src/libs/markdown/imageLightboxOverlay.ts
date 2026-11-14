// 참조 구현: medium-zoom (https://github.com/francoischalifour/medium-zoom, MIT License, Copyright (c) 2017 François Chalifour)
import { overlayScrim } from "src/design-system/tokens"
import { getClientStoredLanguage, translations } from "src/libs/language"
import { acquireBodyScrollLock } from "src/libs/utils/bodyScrollLock"
import {
  createOverlayActionButton,
  handleZoomShortcutKey,
  trapOverlayTabFocus,
} from "./mermaidRuntimeOverlay"

const LIGHTBOX_SCROLL_CLOSE_DELTA_PX = 24

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
  captionEl.style.margin = "0"
  captionEl.style.padding = "0.55rem 0.9rem"
  captionEl.style.borderTop = "1px solid var(--aq-border)"
  captionEl.style.color = "var(--aq-text-secondary)"
  captionEl.style.fontSize = "0.84rem"
  captionEl.style.lineHeight = "1.5"
  captionEl.style.textAlign = "center"
  panel.appendChild(captionEl)
}

export const openImageLightboxOverlay = (
  options: ImageLightboxOverlayOptions
): (() => void) | null => {
  if (typeof document === "undefined" || !options.src) return null

  activeImageLightboxCleanup?.()
  const returnFocusTarget = resolveReturnFocusTarget(options.trigger)
  const isEnglish =
    (document.documentElement?.lang ?? "").toLowerCase().startsWith("en") ||
    getClientStoredLanguage() === "en"
  const overlayT = isEnglish ? translations.en : translations.ko
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
  overlay.style.background = overlayScrim.lightbox
  overlay.style.display = "grid"
  overlay.style.alignItems = "center"
  overlay.style.justifyItems = "center"
  overlay.style.padding =
    "max(0.9rem, env(safe-area-inset-top, 0px)) max(0.9rem, env(safe-area-inset-right, 0px)) max(0.9rem, env(safe-area-inset-bottom, 0px)) max(0.9rem, env(safe-area-inset-left, 0px))"

  const panel = document.createElement("div")
  panel.className = "aq-image-lightbox-panel"
  panel.style.width = "min(96vw, 1280px)"
  panel.style.maxHeight = "min(90dvh, 860px)"
  panel.style.overflow = "hidden"
  panel.style.display = "grid"
  panel.style.gridTemplateRows = "auto minmax(0, 1fr) auto"
  panel.style.borderRadius = "6px"
  panel.style.border = "1px solid var(--aq-border-strong)"
  panel.style.background = "var(--aq-surface)"
  panel.style.padding = "0"

  const actionsBar = document.createElement("div")
  actionsBar.className = "aq-image-lightbox-actions"
  actionsBar.style.display = "flex"
  actionsBar.style.alignItems = "center"
  actionsBar.style.justifyContent = "flex-end"
  actionsBar.style.gap = "0.4rem"
  actionsBar.style.padding = "0.65rem 0.9rem"
  actionsBar.style.borderBottom = "1px solid var(--aq-border)"
  actionsBar.style.background = "var(--aq-page-bg)"

  const zoomOutButton = createOverlayActionButton("-", overlayT.lightboxZoomOut)
  const zoomResetButton = createOverlayActionButton("100%", overlayT.lightboxZoomReset)
  const zoomInButton = createOverlayActionButton("+", overlayT.lightboxZoomIn)
  const closeButton = createOverlayActionButton(
    overlayT.mermaidClose,
    overlayT.lightboxClose
  )
  for (const btn of [zoomOutButton, zoomResetButton, zoomInButton, closeButton]) {
    btn.style.minWidth = "44px"
    btn.style.minHeight = "44px"
    btn.style.borderRadius = "6px"
  }

  const stage = document.createElement("div")
  stage.className = "aq-image-lightbox-stage"
  stage.style.overflow = "auto"
  stage.style.display = "grid"
  stage.style.justifyItems = "center"
  stage.style.alignItems = "center"
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
    zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`
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

  const stopDragging = () => {
    if (!dragging) return
    dragging = false
    if (activePointerId !== null) {
      stage.releasePointerCapture?.(activePointerId)
      activePointerId = null
    }
    stageImg.style.transition = "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)"
    syncImageTransform()
  }

  stage.addEventListener("pointerdown", handlePointerDown)
  stage.addEventListener("pointermove", handlePointerMove)
  stage.addEventListener("pointerup", stopDragging)
  stage.addEventListener("pointercancel", stopDragging)

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
    if (event.target === overlay || (event.target === stage && zoomLevel <= 1)) {
      closeOverlay()
    }
  }

  const handleImageClick = () => {
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
    stage.removeEventListener("pointerup", stopDragging)
    stage.removeEventListener("pointercancel", stopDragging)
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
