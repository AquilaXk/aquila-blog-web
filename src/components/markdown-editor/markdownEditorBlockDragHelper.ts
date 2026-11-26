import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import { isLivePreviewSurfaceMode, type MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import {
  planMoveBlockToOffset,
  resolveContainerAwareBlockRange,
} from "./markdownEditorLineCommandsModel"
import type { CoordsRect } from "./markdownEditorBlockChromeModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type BlockDragPreview = {
  targetOffset: number
  placeAfter: boolean
  indicatorTop: number
}

const DRAG_ACTIVATION_THRESHOLD_PX = 5

export const hasCrossedBlockDragThreshold = (
  startY: number,
  currentY: number,
  thresholdPx = DRAG_ACTIVATION_THRESHOLD_PX
): boolean => Math.abs(currentY - startY) >= thresholdPx

export const resolveBlockDropPreview = ({
  clientX,
  clientY,
  value,
  sourceOffset,
  resolvePosAtCoords,
  resolveCoords,
  container,
}: {
  clientX: number
  clientY: number
  value: string
  sourceOffset: number
  resolvePosAtCoords: (coords: { x: number; y: number }) => number | null
  resolveCoords: (pos: number) => CoordsRect | null
  container: HTMLElement | null
}): BlockDragPreview | null => {
  if (!container) return null
  const containerRect = container.getBoundingClientRect()
  const contentEl = typeof container.querySelector === "function" ? container.querySelector(".cm-content") : null
  const contentRect = contentEl?.getBoundingClientRect?.() ?? containerRect
  const probeX = Math.max(contentRect.left + 8, Math.min(clientX, contentRect.right - 8))
  const pos = resolvePosAtCoords({ x: probeX, y: clientY })
  if (pos === null) return null

  const source = resolveContainerAwareBlockRange(value, sourceOffset, sourceOffset)
  const target = resolveContainerAwareBlockRange(value, pos, pos)
  if (!source || !target) return null
  if (target.blockStart >= source.blockStart && target.blockEnd <= source.blockEnd) {
    return null
  }

  const startCoords = resolveCoords(target.blockStart)
  const endCoords = resolveCoords(target.blockEnd)
  if (!startCoords || !endCoords) return null

  const midY = (startCoords.top + endCoords.bottom) / 2
  const placeAfter = clientY > midY
  const edgeViewportY = placeAfter ? endCoords.bottom + 1 : startCoords.top - 1
  const indicatorTop = Math.round(edgeViewportY - containerRect.top)
  if (indicatorTop < 0 || indicatorTop > containerRect.height) return null

  return {
    targetOffset: pos,
    placeAfter,
    indicatorTop,
  }
}

export const buildBlockDragMovePlan = (
  value: string,
  sourceOffset: number,
  preview: BlockDragPreview | null
): PlannedTextMutation | null => {
  if (!preview) return null
  return planMoveBlockToOffset(value, sourceOffset, preview.targetOffset, preview.placeAfter)
}

export const useMarkdownEditorBlockDrag = ({
  containerRef,
  disabled,
  effectiveGutterLineStart,
  value,
  resolveCoords,
  resolvePosAtCoords,
  onCloseBlockMenu,
  onApplyPlan,
}: {
  containerRef: RefObject<HTMLElement | null>
  disabled: boolean
  effectiveGutterLineStart: number
  value: string
  resolveCoords: (pos: number) => CoordsRect | null
  resolvePosAtCoords?: (coords: { x: number; y: number }) => number | null
  onCloseBlockMenu: () => void
  onApplyPlan: (plan: PlannedTextMutation) => void
}) => {
  const [dragPreview, setDragPreview] = useState<BlockDragPreview | null>(null)
  const [isDraggingBlock, setIsDraggingBlock] = useState(false)
  const dragSessionRef = useRef<{
    pointerId: number
    startY: number
    sourceOffset: number
    active: boolean
    preview: BlockDragPreview | null
  } | null>(null)
  const suppressNextClickRef = useRef(false)

  const cancelBlockDrag = useCallback(() => {
    if (!dragSessionRef.current) return false
    dragSessionRef.current = null
    setIsDraggingBlock(false)
    setDragPreview(null)
    return true
  }, [])

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || disabled || !resolvePosAtCoords) return
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {}
      dragSessionRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        sourceOffset: effectiveGutterLineStart,
        active: false,
        preview: null,
      }
    },
    [disabled, effectiveGutterLineStart, resolvePosAtCoords]
  )

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      if (!session.active) {
        if (!hasCrossedBlockDragThreshold(session.startY, event.clientY)) return
        session.active = true
        onCloseBlockMenu()
        setIsDraggingBlock(true)
      }
      const preview = resolvePosAtCoords
        ? resolveBlockDropPreview({
            clientX: event.clientX,
            clientY: event.clientY,
            value,
            sourceOffset: session.sourceOffset,
            resolvePosAtCoords,
            resolveCoords,
            container: containerRef.current,
          })
        : null
      session.preview = preview
      setDragPreview(preview)
    },
    [containerRef, onCloseBlockMenu, resolveCoords, resolvePosAtCoords, value]
  )

  const onHandlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      dragSessionRef.current = null
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      } catch {}
      setIsDraggingBlock(false)
      setDragPreview(null)
      if (session.active) {
        suppressNextClickRef.current = true
        const movePlan = buildBlockDragMovePlan(value, session.sourceOffset, session.preview)
        if (movePlan) {
          onApplyPlan(movePlan)
        }
      }
    },
    [onApplyPlan, value]
  )

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClickRef.current) return false
    suppressNextClickRef.current = false
    return true
  }, [])

  return {
    dragPreview,
    isDraggingBlock,
    isDragActiveRef: dragSessionRef,
    cancelBlockDrag,
    consumeSuppressedClick,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandlePointerCancel: cancelBlockDrag,
  }
}

export const useBlockChromeViewportListeners = ({
  containerRef,
  disabled,
  mode,
  liveRefs,
  isDragActiveRef,
  setLayoutTick,
  setHoveredLineStart,
  setIsTypingDimmed,
}: {
  containerRef: RefObject<HTMLElement | null>
  disabled: boolean
  mode: MarkdownEditorSurfaceMode
  liveRefs: MutableRefObject<{
    value: string
    selection: { from: number; to: number }
    isBlockMenuOpen: boolean
    resolvePosAtCoords?: (coords: { x: number; y: number }) => number | null
  }>
  isDragActiveRef: MutableRefObject<{ active: boolean } | null>
  setLayoutTick: Dispatch<SetStateAction<number>>
  setHoveredLineStart: Dispatch<SetStateAction<number | null>>
  setIsTypingDimmed: Dispatch<SetStateAction<boolean>>
}) => {
  useEffect(() => {
    if (!isLivePreviewSurfaceMode(mode) || disabled) return
    const container = containerRef.current
    let layoutRafId: number | null = null
    let mouseMoveRafId: number | null = null
    let pendingPointer: { x: number; y: number } | null = null
    const bumpLayout = () => {
      if (layoutRafId !== null) return
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        layoutRafId = window.requestAnimationFrame(() => {
          layoutRafId = null
          setLayoutTick((prev) => prev + 1)
        })
      } else {
        setLayoutTick((prev) => prev + 1)
      }
    }
    const flushHoverLine = () => {
      mouseMoveRafId = null
      const coords = pendingPointer
      pendingPointer = null
      if (!coords) return
      const { isBlockMenuOpen: menuOpen, resolvePosAtCoords: resolvePos, selection: sel, value: doc } =
        liveRefs.current
      if (!resolvePos || menuOpen || sel.from !== sel.to) return
      const pos = resolvePos(coords)
      if (pos === null) return
      const lineStart = pos > 0 ? doc.lastIndexOf("\n", pos - 1) + 1 : 0
      setHoveredLineStart((prev) => (prev === lineStart ? prev : lineStart))
    }
    const handleMouseMove = (event: MouseEvent) => {
      setIsTypingDimmed(false)
      if (isDragActiveRef.current?.active) return
      const { isBlockMenuOpen: menuOpen, resolvePosAtCoords: resolvePos, selection: sel } = liveRefs.current
      if (!resolvePos || menuOpen || sel.from !== sel.to) return
      pendingPointer = { x: event.clientX, y: event.clientY }
      if (mouseMoveRafId !== null) return
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        mouseMoveRafId = window.requestAnimationFrame(flushHoverLine)
      } else {
        flushHoverLine()
      }
    }
    const handleMouseLeave = () => {
      pendingPointer = null
      if (mouseMoveRafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(mouseMoveRafId)
        mouseMoveRafId = null
      }
      setHoveredLineStart(null)
    }
    container?.addEventListener("scroll", bumpLayout, true)
    container?.addEventListener("mousemove", handleMouseMove)
    container?.addEventListener("mouseleave", handleMouseLeave)
    window.addEventListener("resize", bumpLayout)
    window.addEventListener("scroll", bumpLayout, true)
    return () => {
      if (layoutRafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(layoutRafId)
      }
      if (mouseMoveRafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(mouseMoveRafId)
      }
      container?.removeEventListener("scroll", bumpLayout, true)
      container?.removeEventListener("mousemove", handleMouseMove)
      container?.removeEventListener("mouseleave", handleMouseLeave)
      window.removeEventListener("resize", bumpLayout)
      window.removeEventListener("scroll", bumpLayout, true)
    }
  }, [containerRef, disabled, isDragActiveRef, liveRefs, mode, setHoveredLineStart, setIsTypingDimmed, setLayoutTick])
}
