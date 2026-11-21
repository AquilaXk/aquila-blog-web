/**
 * 참조 구현: TryGhost/Ghost (MIT License, Copyright (c) Ghost Foundation)
 * 원본 경로:
 * - apps/admin/src/editor/writing-focus.ts (lines 1-79: POINTER_TRAVEL_TO_REVEAL, nextWritingFocus, isWritingInput)
 * - apps/admin/src/editor/settings-open.ts (lines 1-54: settingsOpenAtStart, readSettingsOpen, writeSettingsOpen)
 * - apps/admin/src/editor/post-editor.tsx (lines 93-132: useAutosize with ResizeObserver & document.fonts)
 */
import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react"
import { EDITOR_SURFACE_ZEN_BITS } from "./editorStudioDedicatedSurfaceModel"

export type WritingFocus = "shown" | "hidden"

export const POINTER_TRAVEL_TO_REVEAL = 10

export type WritingFocusPoint = {
  x: number
  y: number
}

export type WritingFocusState = {
  hidden: boolean
  anchor: WritingFocusPoint | null
}

export type WritingFocusEvent =
  | { type: "edit" }
  | {
      type: "pointer-move"
      point: WritingFocusPoint
      movement?: WritingFocusPoint
    }
  | { type: "reveal" }

export const CHROME_SHOWN: WritingFocusState = { hidden: false, anchor: null }

export const nextWritingFocus = (
  state: WritingFocusState,
  event: WritingFocusEvent
): WritingFocusState => {
  switch (event.type) {
    case "edit":
      return state.hidden ? state : { hidden: true, anchor: null }
    case "pointer-move": {
      if (!state.hidden) return state
      if (!state.anchor) {
        const { movement } = event
        if (movement && Math.hypot(movement.x, movement.y) > POINTER_TRAVEL_TO_REVEAL) {
          return CHROME_SHOWN
        }
        return { ...state, anchor: event.point }
      }
      const travel = Math.hypot(event.point.x - state.anchor.x, event.point.y - state.anchor.y)
      return travel > POINTER_TRAVEL_TO_REVEAL ? CHROME_SHOWN : state
    }
    case "reveal":
      return state.hidden ? CHROME_SHOWN : state
  }
}

export const isWritingInput = (inputType: string): boolean =>
  !inputType.startsWith("format") && !inputType.startsWith("history")

export const EDITOR_SIDEBAR_STORAGE_KEY = "admin.editor.sidebarMask.v1"

export const readStoredDesktopSidebarMask = (): number => {
  if (typeof window === "undefined") return 0
  try {
    const raw = window.localStorage.getItem(EDITOR_SIDEBAR_STORAGE_KEY)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 0) return 0
    return parsed & EDITOR_SURFACE_ZEN_BITS
  } catch {
    return 0
  }
}

export const writeStoredDesktopSidebarMask = (mask: number): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(EDITOR_SIDEBAR_STORAGE_KEY, String(mask & EDITOR_SURFACE_ZEN_BITS))
  } catch {
    // Blocked storage degrades gracefully without affecting the live toggle
  }
}

export const useEditorWritingFocus = ({
  blocked,
  writingAreaRef,
}: {
  blocked: boolean
  writingAreaRef: RefObject<HTMLElement | null>
}): WritingFocus => {
  const [focusState, setFocusState] = useState<WritingFocusState>(CHROME_SHOWN)

  useEffect(() => {
    if (blocked && focusState.hidden) {
      setFocusState(CHROME_SHOWN)
    }
  }, [blocked, focusState.hidden])

  useEffect(() => {
    if (typeof window === "undefined") return
    const area = writingAreaRef.current
    if (!area) return

    const onBeforeInput = (event: Event) => {
      if (blocked) return
      const inputEvent = event as InputEvent
      if (!inputEvent.inputType || isWritingInput(inputEvent.inputType)) {
        setFocusState((prev) => nextWritingFocus(prev, { type: "edit" }))
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      setFocusState((prev) =>
        nextWritingFocus(prev, {
          type: "pointer-move",
          point: { x: event.clientX, y: event.clientY },
          movement: { x: event.movementX ?? 0, y: event.movementY ?? 0 },
        })
      )
    }

    const onReveal = () => {
      setFocusState((prev) => nextWritingFocus(prev, { type: "reveal" }))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocusState((prev) => nextWritingFocus(prev, { type: "reveal" }))
      }
    }

    area.addEventListener("beforeinput", onBeforeInput)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("wheel", onReveal, { passive: true })
    window.addEventListener("keydown", onKeyDown)
    return () => {
      area.removeEventListener("beforeinput", onBeforeInput)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("wheel", onReveal)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [blocked, writingAreaRef])

  return blocked || !focusState.hidden ? "shown" : "hidden"
}

export const useAutosizeTextarea = (
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string
): void => {
  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content")) {
      element.style.height = ""
      return
    }
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [ref])

  useLayoutEffect(() => {
    measure()
  }, [measure, value])

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    document.fonts?.addEventListener?.("loadingdone", schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.fonts?.removeEventListener?.("loadingdone", schedule)
    }
  }, [measure, ref])
}
