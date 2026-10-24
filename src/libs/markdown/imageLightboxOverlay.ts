import { acquireBodyScrollLock } from "src/libs/utils/bodyScrollLock"
import {
  attachStageDragPan,
  createOverlayActionButton,
  handleZoomShortcutKey,
  trapOverlayTabFocus,
} from "./mermaidRuntimeOverlay"

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
  image.setAttribute("src", src)
  image.setAttribute("alt", alt)
  image.style.display = "block"
  image.style.maxWidth = "min(90vw, 1200px)"
  image.style.maxHeight = "min(76dvh, 760px)"
  image.style.width = "auto"
  image.style.height = "auto"
  image.style.objectFit = "contain"
  image.style.transition = "transform 0.14s ease"
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
  const altText = options.alt || options.caption || "이미지 확대 보기"
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
  overlay.style.background = "rgba(15, 23, 42, 0.48)"
  overlay.style.backdropFilter = "blur(4px)"
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

  const zoomOutButton = createOverlayActionButton("-", "축소")
  const zoomResetButton = createOverlayActionButton("100%", "배율 초기화")
  const zoomInButton = createOverlayActionButton("+", "확대")
  const closeButton = createOverlayActionButton("닫기", "닫기")
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
  const applyZoom = (nextZoom: number) => {
    zoomLevel = Math.max(0.5, Math.min(3, Math.round(nextZoom * 100) / 100))
    zoomResetButton.textContent = `${Math.round(zoomLevel * 100)}%`
    stage.style.cursor = zoomLevel > 1 ? "grab" : ""
    stageImg.style.transform = `scale(${zoomLevel})`
    stageImg.style.transformOrigin = "top left"
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
    if (activeImageLightboxCleanup === closeOverlay) {
      activeImageLightboxCleanup = null
    }
    detachDragPan()
    releaseBodyScrollLock()
    overlay.remove()
    document.removeEventListener("keydown", handleOverlayKeyDown)
    closeButton.removeEventListener("click", closeOverlay)
    overlay.removeEventListener("click", handleOverlayClick)
    if (returnFocusTarget?.isConnected) {
      returnFocusTarget.focus()
    }
  }

  activeImageLightboxCleanup = closeOverlay
  closeButton.focus()
  overlay.addEventListener("click", handleOverlayClick)
  closeButton.addEventListener("click", closeOverlay)
  document.addEventListener("keydown", handleOverlayKeyDown)

  return closeOverlay
}
