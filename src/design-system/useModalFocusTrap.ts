import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react"

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const canRestoreFocus = (element: HTMLElement) => {
  if (!element.isConnected) return false
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false
  return element.matches(FOCUSABLE_SELECTOR)
}

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex !== -1 &&
      element.getAttribute("aria-hidden") !== "true" &&
      (element.offsetParent !== null || element.getClientRects().length > 0)
  )
}

const restoreFocus = (element: HTMLElement | null) => {
  if (!element || !canRestoreFocus(element)) return
  element.focus({ preventScroll: true })
}

type UseModalFocusTrapOptions = {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  paused?: boolean
}

export const useModalFocusTrap = ({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  paused = false,
}: UseModalFocusTrapOptions) => {
  const triggerRef = useRef<HTMLElement | null>(null)
  const pausedRef = useRef(paused)
  const trapActive = open && !paused

  pausedRef.current = paused

  useEffect(() => {
    if (!open) return

    const preferredReturn = returnFocusRef?.current
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    triggerRef.current =
      preferredReturn && preferredReturn.isConnected
        ? preferredReturn
        : active && active.isConnected
          ? active
          : preferredReturn ?? active

    const raf = window.requestAnimationFrame(() => {
      if (pausedRef.current) return
      const initialTarget =
        initialFocusRef?.current ?? getFocusableElements(containerRef.current)[0] ?? null
      initialTarget?.focus()
    })

    return () => {
      window.cancelAnimationFrame(raf)
      const trigger = triggerRef.current
      window.requestAnimationFrame(() => {
        if (pausedRef.current) return
        restoreFocus(trigger)
      })
    }
  }, [open, containerRef, initialFocusRef, returnFocusRef])

  useEffect(() => {
    if (!trapActive) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onClose()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [trapActive, onClose])

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!trapActive || event.key !== "Tab") return

      const container = containerRef.current
      if (!container) return

      const focusableElements = getFocusableElements(container)

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (activeElement === container || !activeElement || !container.contains(activeElement)) {
        event.preventDefault()
        if (event.shiftKey) {
          lastElement.focus()
        } else {
          firstElement.focus()
        }
        return
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    },
    [containerRef, trapActive]
  )

  return { handleKeyDown }
}
