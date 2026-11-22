/**
 * 참조 구현:
 * - mermaid-js/mermaid-live-editor (src/lib/components/PanZoomToolbar.svelte, MIT License)
 * - lucide-icons/lucide (icons/zoom-out.svg, icons/zoom-in.svg, icons/rotate-ccw.svg, icons/copy.svg, icons/check.svg, icons/x.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import { boxShadowColor, overlayScrim } from "src/design-system/tokens"
import { getClientStoredLanguage } from "src/libs/language"
import { sanitizeMermaidSvg } from "src/libs/markdown/sanitizeMermaidSvg"
import { attachInteractiveDiagramPanZoom, installToolbarRovingFocus } from "src/libs/markdown/mermaidPanZoom"
import { acquireBodyScrollLock } from "src/libs/utils/bodyScrollLock"

export const LUCIDE_ZOOM_OUT_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>'
export const LUCIDE_ZOOM_IN_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>'
export const LUCIDE_ROTATE_CCW_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'
export const LUCIDE_COPY_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
export const LUCIDE_CHECK_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
export const LUCIDE_CLOSE_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

const OVERLAY_TRANSLATIONS = {
  ko: {
    lightboxDialogAria: "이미지 확대 보기",
    lightboxZoomOut: "이미지 축소",
    lightboxZoomIn: "이미지 확대",
    lightboxZoomReset: "원본 배율로 복원",
    lightboxClose: "이미지 보기 닫기",
    mermaidOverlayAria: "Mermaid 다이어그램 크게 보기",
    mermaidToolbarAria: "다이어그램 보기 제어",
    mermaidExpandAria: "다이어그램 크게 보기",
    mermaidStageHint: "클릭하여 다이어그램 크게 보기",
    mermaidCopyCode: "코드 복사",
    mermaidCopyCodeAria: "Mermaid 원본 코드 복사",
    mermaidCopyDone: "복사됨",
    mermaidCopyFailed: "복사 실패",
    mermaidZoomOut: "축소",
    mermaidZoomOutAria: "다이어그램 축소",
    mermaidZoomIn: "확대",
    mermaidZoomInAria: "다이어그램 확대",
    mermaidReset: "초기화",
    mermaidResetAria: "배율과 위치 초기화",
    mermaidClose: "닫기",
    mermaidCloseAria: "Mermaid 크게 보기 닫기",
    mermaidTouchHint: "두 손가락으로 확대/축소 · 한 손가락으로 이동",
  },
  en: {
    lightboxDialogAria: "Expanded image preview",
    lightboxZoomOut: "Zoom out image",
    lightboxZoomIn: "Zoom in image",
    lightboxZoomReset: "Reset zoom",
    lightboxClose: "Close image preview",
    mermaidOverlayAria: "Expanded Mermaid diagram",
    mermaidToolbarAria: "Diagram viewer controls",
    mermaidExpandAria: "Expand diagram",
    mermaidStageHint: "Click to expand diagram",
    mermaidCopyCode: "Copy code",
    mermaidCopyCodeAria: "Copy Mermaid source code",
    mermaidCopyDone: "Copied",
    mermaidCopyFailed: "Failed",
    mermaidZoomOut: "Zoom out",
    mermaidZoomOutAria: "Zoom out diagram",
    mermaidZoomIn: "Zoom in",
    mermaidZoomInAria: "Zoom in diagram",
    mermaidReset: "Reset",
    mermaidResetAria: "Reset zoom and position",
    mermaidClose: "Close",
    mermaidCloseAria: "Close expanded Mermaid diagram",
    mermaidTouchHint: "Pinch to zoom · Drag to pan",
  },
} as const

export const resolveOverlayTranslations = () => {
  const isEnglish =
    (typeof document !== "undefined"
      ? (document.documentElement?.lang ?? "").toLowerCase().startsWith("en")
      : false) || getClientStoredLanguage() === "en"
  return isEnglish ? OVERLAY_TRANSLATIONS.en : OVERLAY_TRANSLATIONS.ko
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const createBaseOverlayButton = (ariaLabel: string, padding: string): HTMLButtonElement => {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("aria-label", ariaLabel)
  button.style.display = "inline-flex"
  button.style.alignItems = "center"
  button.style.justifyContent = "center"
  button.style.minWidth = "44px"
  button.style.minHeight = "44px"
  button.style.padding = padding
  button.style.borderRadius = "6px"
  button.style.border = "1px solid var(--aq-border)"
  button.style.background = "var(--aq-surface)"
  button.style.color = "var(--aq-text)"
  button.style.fontSize = "0.78rem"
  button.style.fontWeight = "600"
  button.style.fontVariantNumeric = "tabular-nums"
  button.style.cursor = "pointer"
  return button
}

export const createOverlayActionButton = (label: string, ariaLabel: string): HTMLButtonElement => {
  const button = createBaseOverlayButton(ariaLabel, "0 0.75rem")
  button.textContent = label
  return button
}

export const createOverlayIconControl = ({
  iconSvg,
  ariaLabel,
  titleLabel,
  textLabel = "",
}: {
  iconSvg: string
  ariaLabel: string
  titleLabel: string
  textLabel?: string
}) => {
  const button = createBaseOverlayButton(ariaLabel, textLabel ? "0 0.7rem" : "0")
  button.setAttribute("title", titleLabel)
  button.style.gap = "0.35rem"

  const iconSpan = document.createElement("span")
  iconSpan.setAttribute("aria-hidden", "true")
  iconSpan.style.display = "inline-flex"
  iconSpan.style.alignItems = "center"
  iconSpan.style.justifyContent = "center"
  iconSpan.style.width = "16px"
  iconSpan.style.height = "16px"
  iconSpan.style.pointerEvents = "none"
  iconSpan.innerHTML = iconSvg
  button.appendChild(iconSpan)

  const labelSpan = textLabel ? document.createElement("span") : null
  if (labelSpan) {
    labelSpan.textContent = textLabel
    button.appendChild(labelSpan)
  }

  const setVisual = (nextIconSvg: string, nextTextLabel = "") => {
    iconSpan.innerHTML = nextIconSvg
    if (labelSpan) {
      labelSpan.textContent = nextTextLabel
    }
  }

  return { button, setVisual }
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

const isViewBoxSeparator = (code: number | undefined) =>
  code !== undefined && (code <= 32 || code === 44)

export const parseSvgViewBoxNumbers = (
  viewBox: string
): [number, number, number, number] | null => {
  if (!viewBox) return null
  const len = viewBox.length
  const out: number[] = []
  let i = 0
  while (i < len) {
    while (i < len && isViewBoxSeparator(viewBox.codePointAt(i))) i += 1
    if (i >= len) break
    const start = i
    while (i < len && !isViewBoxSeparator(viewBox.codePointAt(i))) i += 1
    const num = Number(viewBox.slice(start, i))
    if (!Number.isFinite(num)) return null
    out.push(num)
    if (out.length > 4) return null
  }
  return out.length === 4 ? [out[0], out[1], out[2], out[3]] : null
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
    event.preventDefault?.()
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

  const stopDragging = () => {
    if (!dragging) return
    dragging = false
    if (activePointerId !== null) {
      stage.releasePointerCapture?.(activePointerId)
      activePointerId = null
    }
    stage.style.cursor = getZoomLevel() > 1 ? "grab" : ""
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
  const last = focusable.at(-1)!
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

export const shouldIgnoreStageClickForZoom = (event: MouseEvent): boolean => {
  const target = typeof Element !== "undefined" && event.target instanceof Element ? event.target : null
  if (target?.closest("a, button")) return true
  const selectionText =
    typeof window !== "undefined" ? (window.getSelection?.()?.toString().trim() ?? "") : ""
  return selectionText.length > 0
}

const configureMermaidStageSvg = (
  stageSvg: SVGSVGElement | null,
  baseWidth: number,
  baseHeight: number
) => {
  if (!stageSvg) return
  stageSvg.removeAttribute("width")
  stageSvg.removeAttribute("height")
  stageSvg.style.display = "block"
  stageSvg.style.margin = "0 auto"
  stageSvg.style.maxWidth = "min(88vw, 1200px)"
  stageSvg.style.maxHeight = "min(72dvh, 720px)"
  if (baseWidth > 0 && baseHeight > 0) {
    stageSvg.style.width = `${Math.round(baseWidth)}px`
    stageSvg.style.height = "auto"
  } else {
    stageSvg.style.width = "max-content"
    stageSvg.style.height = "auto"
  }
}

const appendCopySourceButtonIfPresent = (
  actionsBar: HTMLElement,
  sourceText: string,
  overlayT: ReturnType<typeof resolveOverlayTranslations>
): (() => void) => {
  const trimmed = sourceText.trim()
  if (!trimmed) return () => {}

  const { button: copySourceButton, setVisual } = createOverlayIconControl({
    iconSvg: LUCIDE_COPY_SVG,
    ariaLabel: overlayT.mermaidCopyCodeAria,
    titleLabel: overlayT.mermaidCopyCode,
    textLabel: overlayT.mermaidCopyCode,
  })
  copySourceButton.style.marginLeft = "0.25rem"

  let resetTimer: ReturnType<typeof setTimeout> | null = null
  const clearCopyTimer = () => {
    if (resetTimer !== null) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
  }

  const scheduleIdleRestore = () => {
    clearCopyTimer()
    resetTimer = setTimeout(() => {
      resetTimer = null
      setVisual(LUCIDE_COPY_SVG, overlayT.mermaidCopyCode)
    }, 1500)
  }

  copySourceButton.addEventListener("click", () => {
    const writePromise =
      typeof navigator !== "undefined" ? navigator.clipboard?.writeText(sourceText) : undefined
    if (!writePromise) {
      setVisual(LUCIDE_COPY_SVG, overlayT.mermaidCopyFailed)
      scheduleIdleRestore()
      return
    }
    void writePromise
      .then(() => {
        setVisual(LUCIDE_CHECK_SVG, overlayT.mermaidCopyDone)
        scheduleIdleRestore()
      })
      .catch(() => {
        setVisual(LUCIDE_COPY_SVG, overlayT.mermaidCopyFailed)
        scheduleIdleRestore()
      })
  })

  actionsBar.appendChild(copySourceButton)
  return clearCopyTimer
}

export const openMermaidOverlay = (
  svgMarkup: string,
  previousCleanup?: (() => void) | null,
  sourceText = ""
) => {
  if (typeof document === "undefined") return null

  previousCleanup?.()
  const previousFocusedElement = resolvePreviousActiveElement()
  const overlayT = resolveOverlayTranslations()

  const overlay = document.createElement("div")
  overlay.setAttribute("data-aq-mermaid-overlay", "true")
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", overlayT.mermaidOverlayAria)
  overlay.style.position = "fixed"
  overlay.style.inset = "0"
  overlay.style.zIndex = "180"
  overlay.style.background = overlayScrim.diagram
  overlay.style.display = "grid"
  overlay.style.alignItems = "center"
  overlay.style.justifyItems = "center"
  overlay.style.padding =
    "max(0.9rem, env(safe-area-inset-top, 0px)) max(0.9rem, env(safe-area-inset-right, 0px)) max(0.9rem, env(safe-area-inset-bottom, 0px)) max(0.9rem, env(safe-area-inset-left, 0px))"

  const panel = document.createElement("div")
  panel.style.width = "min(96vw, 1320px)"
  panel.style.maxHeight = "min(92dvh, 900px)"
  panel.style.display = "flex"
  panel.style.flexDirection = "column"
  panel.style.overflow = "hidden"
  panel.style.borderRadius = "8px"
  panel.style.border = "1px solid var(--aq-border)"
  panel.style.background = "var(--aq-surface)"
  panel.style.boxShadow = `0 16px 40px ${boxShadowColor.cardFloating}`
  panel.style.padding = "0"

  const actionsBar = document.createElement("div")
  actionsBar.className = "aq-mermaid-modal-actions"
  actionsBar.setAttribute("role", "toolbar")
  actionsBar.setAttribute("aria-label", overlayT.mermaidToolbarAria)
  actionsBar.style.display = "flex"
  actionsBar.style.alignItems = "center"
  actionsBar.style.justifyContent = "flex-end"
  actionsBar.style.flexWrap = "wrap"
  actionsBar.style.gap = "0.35rem"
  actionsBar.style.padding = "0.55rem 0.75rem"
  actionsBar.style.background = "var(--aq-surface-subtle)"
  actionsBar.style.borderBottom = "1px solid var(--aq-border)"

  const { button: zoomOutButton } = createOverlayIconControl({
    iconSvg: LUCIDE_ZOOM_OUT_SVG,
    ariaLabel: overlayT.mermaidZoomOutAria,
    titleLabel: overlayT.mermaidZoomOut,
  })
  const { button: zoomResetButton, setVisual: setZoomResetVisual } = createOverlayIconControl({
    iconSvg: LUCIDE_ROTATE_CCW_SVG,
    ariaLabel: overlayT.mermaidResetAria,
    titleLabel: overlayT.mermaidReset,
    textLabel: "100%",
  })
  zoomResetButton.style.minWidth = "72px"

  const { button: zoomInButton } = createOverlayIconControl({
    iconSvg: LUCIDE_ZOOM_IN_SVG,
    ariaLabel: overlayT.mermaidZoomInAria,
    titleLabel: overlayT.mermaidZoomIn,
  })
  const { button: closeButton } = createOverlayIconControl({
    iconSvg: LUCIDE_CLOSE_SVG,
    ariaLabel: overlayT.mermaidClose,
    titleLabel: overlayT.mermaidCloseAria,
    textLabel: overlayT.mermaidClose,
  })
  closeButton.style.marginLeft = "0.25rem"

  const stage = document.createElement("div")
  stage.style.position = "relative"
  stage.style.overflow = "hidden"
  stage.style.flex = "1 1 auto"
  stage.style.minHeight = "min(68dvh, 600px)"
  stage.style.padding = "1.5rem"
  stage.style.background = "var(--aq-surface)"
  stage.style.display = "flex"
  stage.style.alignItems = "center"
  stage.style.justifyContent = "center"
  stage.style.touchAction = "none"
  stage.style.userSelect = "none"

  const canvas = document.createElement("div")
  canvas.style.display = "inline-flex"
  canvas.style.alignItems = "center"
  canvas.style.justifyContent = "center"
  canvas.style.willChange = "transform"
  canvas.innerHTML = sanitizeMermaidSvg(svgMarkup)
  stage.appendChild(canvas)

  const hintBadge = document.createElement("span")
  hintBadge.setAttribute("aria-hidden", "true")
  hintBadge.textContent = overlayT.mermaidTouchHint
  hintBadge.style.position = "absolute"
  hintBadge.style.bottom = "0.75rem"
  hintBadge.style.left = "50%"
  hintBadge.style.transform = "translateX(-50%)"
  hintBadge.style.padding = "0.24rem 0.65rem"
  hintBadge.style.borderRadius = "6px"
  hintBadge.style.border = "1px solid var(--aq-border)"
  hintBadge.style.background = "var(--aq-surface-subtle)"
  hintBadge.style.color = "var(--aq-text-secondary)"
  hintBadge.style.fontSize = "0.72rem"
  hintBadge.style.pointerEvents = "none"
  hintBadge.style.whiteSpace = "nowrap"
  stage.appendChild(hintBadge)

  const stageSvg = typeof canvas.querySelector === "function" ? canvas.querySelector("svg") : null
  const viewBoxParts = parseSvgViewBoxNumbers(stageSvg?.getAttribute?.("viewBox") || "")
  const baseWidth = viewBoxParts && viewBoxParts[2] > 0 ? viewBoxParts[2] : 0
  const baseHeight = viewBoxParts && viewBoxParts[3] > 0 ? viewBoxParts[3] : 0
  configureMermaidStageSvg(stageSvg, baseWidth, baseHeight)

  const panZoom = attachInteractiveDiagramPanZoom({
    stage,
    canvas,
    onTransformChange: ({ scale }) => {
      setZoomResetVisual(LUCIDE_ROTATE_CCW_SVG, `${Math.round(scale * 100)}%`)
    },
  })

  const handleZoomOut = () => panZoom.zoomBy(-0.25)
  const handleZoomReset = () => panZoom.reset()
  const handleZoomIn = () => panZoom.zoomBy(0.25)

  zoomOutButton.addEventListener("click", handleZoomOut)
  zoomResetButton.addEventListener("click", handleZoomReset)
  zoomInButton.addEventListener("click", handleZoomIn)

  actionsBar.appendChild(zoomOutButton)
  actionsBar.appendChild(zoomResetButton)
  actionsBar.appendChild(zoomInButton)
  const clearCopyTimer = appendCopySourceButtonIfPresent(actionsBar, sourceText, overlayT)
  actionsBar.appendChild(closeButton)
  const detachToolbarFocus = installToolbarRovingFocus(actionsBar, closeButton)

  panel.appendChild(actionsBar)
  panel.appendChild(stage)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

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

  const handlePopState = () => {
    closeOverlay()
  }

  closeOverlay = () => {
    if (closed) return
    closed = true
    clearCopyTimer()
    detachToolbarFocus()
    panZoom.destroy()
    releaseBodyScrollLock()
    overlay.remove()
    document.removeEventListener("keydown", handleOverlayKeyDown)
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", handlePopState)
    }
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
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", handlePopState)
  }

  return closeOverlay
}
