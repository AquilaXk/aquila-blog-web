import { useEffect, useRef, useState, type KeyboardEventHandler, type ReactNode, type RefObject } from "react"
import { useModalFocusTrap } from "src/design-system/useModalFocusTrap"
import { EditorMobileSheetScrim } from "./EditorStudioEditorialStyles"
import { isMobileEditorViewport } from "./editorStudioDedicatedSurfaceModel"

const MOBILE_SHEET_MEDIA_QUERY = "(max-width: 820px)"

const readMobileSheetViewport = (): boolean => {
  if (typeof window === "undefined") return false
  if (typeof window.matchMedia === "function") {
    const media = window.matchMedia(MOBILE_SHEET_MEDIA_QUERY)
    if (typeof media?.matches === "boolean") {
      return media.matches || isMobileEditorViewport()
    }
  }
  return isMobileEditorViewport()
}

type EditorMobileSheetPanelProps = {
  role?: "dialog"
  "aria-modal"?: true
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}

type EditorMobileSheetContainerProps = {
  open: boolean
  onClose: () => void
  closeLabel: string
  children: (bindings: {
    panelRef: RefObject<HTMLElement | null>
    panelProps: EditorMobileSheetPanelProps
  }) => ReactNode
}

export function EditorMobileSheetContainer({
  open,
  onClose,
  closeLabel,
  children,
}: EditorMobileSheetContainerProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const [isMobileSheet, setIsMobileSheet] = useState<boolean>(readMobileSheetViewport)

  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsMobileSheet(readMobileSheetViewport())
    sync()
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia(MOBILE_SHEET_MEDIA_QUERY)
        : null
    media?.addEventListener?.("change", sync)
    window.addEventListener("resize", sync)
    return () => {
      media?.removeEventListener?.("change", sync)
      window.removeEventListener("resize", sync)
    }
  }, [])

  const { handleKeyDown } = useModalFocusTrap({
    open: open && isMobileSheet,
    onClose,
    containerRef: panelRef,
    lockScroll: true,
  })

  const panelProps: EditorMobileSheetPanelProps = isMobileSheet
    ? { role: "dialog", "aria-modal": true, onKeyDown: handleKeyDown }
    : {}

  return (
    <>
      <EditorMobileSheetScrim type="button" aria-label={closeLabel} onClick={onClose} />
      {children({ panelRef, panelProps })}
    </>
  )
}
