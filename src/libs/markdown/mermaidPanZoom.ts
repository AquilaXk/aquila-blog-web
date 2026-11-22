// 참조 구현: Mermaid Live Editor (`mermaid-js/mermaid-live-editor`, `src/lib/components/PanZoomToolbar.svelte`, MIT License, Copyright (c) 2021 Knut Sveidqvist), Quartz v4 (`jackyzha0/quartz`, `quartz/components/scripts/mermaid.inline.ts` `DiagramPanZoom` & `quartz/plugins/transformers/ofm.ts` `.expand-button`, MIT License, Copyright (c) 2021 Jacky Zhao), PhotoSwipe (`dimsemenov/PhotoSwipe`, 2-pointer pinch-to-zoom, MIT License, Copyright (c) 2014-2024 Dmitry Semenov), Lucide Icons (`lucide-icons/lucide`, `icons/{maximize-2,copy,check,minus,plus,x}.svg`, ISC License)

export const MIN_MERMAID_ZOOM = 0.4
export const MAX_MERMAID_ZOOM = 4

export const MERMAID_ICON_EXPAND =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>'

export const MERMAID_ICON_COPY =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

export const MERMAID_ICON_CHECK =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

export const MERMAID_ICON_ZOOM_OUT =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>'

export const MERMAID_ICON_ZOOM_IN =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'

export const MERMAID_ICON_CLOSE =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

export type MermaidPanZoomState = {
  scale: number
  panX: number
  panY: number
}

export const clampMermaidZoom = (value: number): number => {
  if (!Number.isFinite(value)) return 1
  return Math.max(MIN_MERMAID_ZOOM, Math.min(MAX_MERMAID_ZOOM, Math.round(value * 100) / 100))
}

export const computeFocalPanZoom = (
  current: MermaidPanZoomState,
  nextRawScale: number,
  focalOffsetX = 0,
  focalOffsetY = 0
): MermaidPanZoomState => {
  const nextScale = clampMermaidZoom(nextRawScale)
  if (nextScale === current.scale) return current
  const ratio = nextScale / current.scale
  return {
    scale: nextScale,
    panX: Math.round((focalOffsetX - (focalOffsetX - current.panX) * ratio) * 100) / 100,
    panY: Math.round((focalOffsetY - (focalOffsetY - current.panY) * ratio) * 100) / 100,
  }
}

const collectToolbarButtons = (toolbar: HTMLElement): HTMLButtonElement[] => {
  const children = toolbar.children
  if (!children) return []
  const buttons: HTMLButtonElement[] = []
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i] as HTMLButtonElement
    if (child?.tagName === "BUTTON" && !child.hasAttribute?.("disabled")) {
      buttons.push(child)
    }
  }
  return buttons
}

export const installToolbarRovingFocus = (
  toolbar: HTMLElement,
  initialActive?: HTMLButtonElement | null
): (() => void) => {
  toolbar.setAttribute?.("focusgroup", "toolbar wrap")
  if (typeof HTMLElement !== "undefined" && "focusGroup" in HTMLElement.prototype) {
    return () => {}
  }

  const syncActiveButton = (active: HTMLButtonElement | null) => {
    const buttons = collectToolbarButtons(toolbar)
    if (!buttons.length) return
    const target = active && buttons.includes(active) ? active : buttons[0]
    for (let i = 0; i < buttons.length; i += 1) {
      const btn = buttons[i]
      const tabValue = btn === target ? 0 : -1
      btn.tabIndex = tabValue
      btn.setAttribute?.("tabindex", String(tabValue))
    }
  }

  syncActiveButton(initialActive ?? null)

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return
    const buttons = collectToolbarButtons(toolbar)
    if (buttons.length <= 1) return

    const activeEl = (typeof document !== "undefined" ? document.activeElement : null) as HTMLButtonElement | null
    let currentIndex = activeEl ? buttons.indexOf(activeEl) : -1
    if (currentIndex < 0) {
      currentIndex = buttons.findIndex((btn) => btn.tabIndex === 0)
      if (currentIndex < 0) currentIndex = 0
    }

    let nextIndex = currentIndex
    if (key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length
    else if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
    else if (key === "Home") nextIndex = 0
    else if (key === "End") nextIndex = buttons.length - 1

    event.preventDefault?.()
    const nextBtn = buttons[nextIndex]
    syncActiveButton(nextBtn)
    nextBtn.focus?.()
  }

  toolbar.addEventListener?.("keydown", handleKeyDown as EventListener)
  return () => {
    toolbar.removeEventListener?.("keydown", handleKeyDown as EventListener)
  }
}

export const attachInteractiveDiagramPanZoom = ({
  stage,
  canvas,
  onTransformChange,
}: {
  stage: HTMLElement
  canvas: HTMLElement
  onTransformChange?: (state: MermaidPanZoomState) => void
}) => {
  let state: MermaidPanZoomState = { scale: 1, panX: 0, panY: 0 }
  const activePointers = new Map<number, { x: number; y: number }>()
  let lastPinchDistance = 0
  let lastPinchMidX = 0
  let lastPinchMidY = 0

  const applyTransform = (nextState: MermaidPanZoomState, animate = false) => {
    state = nextState
    canvas.style.transition = animate ? "transform 0.14s ease-out" : "none"
    canvas.style.transformOrigin = "center center"
    canvas.style.transform = `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.scale})`
    stage.style.cursor = activePointers.size > 0 ? "grabbing" : "grab"
    onTransformChange?.(state)
  }

  const resolveStageFocalOffset = (clientX: number, clientY: number): [number, number] => {
    const rect = stage.getBoundingClientRect?.()
    if (!rect || rect.width <= 0 || rect.height <= 0) return [0, 0]
    return [clientX - (rect.left + rect.width * 0.5), clientY - (rect.top + rect.height * 0.5)]
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (typeof event.button === "number" && event.button !== 0) return
    if (activePointers.size >= 2) return
    event.preventDefault?.()
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    stage.setPointerCapture?.(event.pointerId)
    stage.style.cursor = "grabbing"

    if (activePointers.size === 2) {
      const [p1, p2] = Array.from(activePointers.values())
      lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      lastPinchMidX = (p1.x + p2.x) * 0.5
      lastPinchMidY = (p1.y + p2.y) * 0.5
    }
  }

  const handlePointerMove = (event: PointerEvent) => {
    const prevPoint = activePointers.get(event.pointerId)
    if (!prevPoint) return

    if (activePointers.size === 1) {
      const dx = event.clientX - prevPoint.x
      const dy = event.clientY - prevPoint.y
      prevPoint.x = event.clientX
      prevPoint.y = event.clientY
      applyTransform({ scale: state.scale, panX: state.panX + dx, panY: state.panY + dy }, false)
      return
    }

    prevPoint.x = event.clientX
    prevPoint.y = event.clientY
    const [p1, p2] = Array.from(activePointers.values())
    const nextDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    const nextMidX = (p1.x + p2.x) * 0.5
    const nextMidY = (p1.y + p2.y) * 0.5
    if (lastPinchDistance > 0 && nextDist > 0) {
      const [focalX, focalY] = resolveStageFocalOffset(nextMidX, nextMidY)
      const zoomed = computeFocalPanZoom(
        state,
        state.scale * (nextDist / lastPinchDistance),
        focalX,
        focalY
      )
      applyTransform(
        {
          scale: zoomed.scale,
          panX: zoomed.panX + (nextMidX - lastPinchMidX),
          panY: zoomed.panY + (nextMidY - lastPinchMidY),
        },
        false
      )
    }
    lastPinchDistance = nextDist
    lastPinchMidX = nextMidX
    lastPinchMidY = nextMidY
  }

  const handlePointerEnd = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return
    activePointers.delete(event.pointerId)
    stage.releasePointerCapture?.(event.pointerId)
    lastPinchDistance = 0
    stage.style.cursor = activePointers.size > 0 ? "grabbing" : "grab"
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault?.()
    const stepFactor = event.ctrlKey ? 0.008 : 0.0022
    const nextScale = state.scale * Math.exp(-event.deltaY * stepFactor)
    const [focalX, focalY] = resolveStageFocalOffset(event.clientX ?? 0, event.clientY ?? 0)
    applyTransform(computeFocalPanZoom(state, nextScale, focalX, focalY), false)
  }

  const handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault?.()
    if (Math.abs(state.scale - 1) > 0.05 || state.panX !== 0 || state.panY !== 0) {
      applyTransform({ scale: 1, panX: 0, panY: 0 }, true)
      return
    }
    const [focalX, focalY] = resolveStageFocalOffset(event.clientX ?? 0, event.clientY ?? 0)
    applyTransform(computeFocalPanZoom(state, 2, focalX, focalY), true)
  }

  applyTransform(state, false)
  stage.addEventListener?.("pointerdown", handlePointerDown)
  stage.addEventListener?.("pointermove", handlePointerMove)
  stage.addEventListener?.("pointerup", handlePointerEnd)
  stage.addEventListener?.("pointercancel", handlePointerEnd)
  stage.addEventListener?.("wheel", handleWheel, { passive: false })
  stage.addEventListener?.("dblclick", handleDoubleClick)

  return {
    getState: () => state,
    zoomBy: (delta: number) => {
      applyTransform(computeFocalPanZoom(state, state.scale + delta, 0, 0), true)
    },
    reset: () => {
      applyTransform({ scale: 1, panX: 0, panY: 0 }, true)
    },
    destroy: () => {
      activePointers.clear()
      stage.removeEventListener?.("pointerdown", handlePointerDown)
      stage.removeEventListener?.("pointermove", handlePointerMove)
      stage.removeEventListener?.("pointerup", handlePointerEnd)
      stage.removeEventListener?.("pointercancel", handlePointerEnd)
      stage.removeEventListener?.("wheel", handleWheel)
      stage.removeEventListener?.("dblclick", handleDoubleClick)
    },
  }
}
