import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"

export type MarkdownEditorPanelFixedPosition = {
  top: number
  left: number
}

type MarkdownEditorPanelPositionParams = {
  open: boolean
  align?: "start" | "end"
  rootRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
}

const COMPACT_TOOLBAR_BREAKPOINT = 720

export const useMarkdownEditorPanelPosition = ({
  open,
  align = "start",
  rootRef,
  panelRef,
}: MarkdownEditorPanelPositionParams) => {
  const [horizontalOffset, setHorizontalOffset] = useState(0)
  const [fixedPosition, setFixedPosition] = useState<MarkdownEditorPanelFixedPosition | null>(
    null
  )
  const horizontalOffsetRef = useRef(0)

  const resetHorizontalOffset = useCallback(() => {
    horizontalOffsetRef.current = 0
    setHorizontalOffset(0)
    setFixedPosition(null)
  }, [])

  const keepPanelInsideEditor = useCallback(() => {
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return
    const editor = root.closest<HTMLElement>("[data-testid='markdown-editor']")

    if (typeof window !== "undefined" && window.innerWidth <= COMPACT_TOOLBAR_BREAKPOINT) {
      const rootBounds = root.getBoundingClientRect()
      const panelWidth = panel.getBoundingClientRect().width
      const editorBounds = editor?.getBoundingClientRect()
      const minLeft = editorBounds ? editorBounds.left + 4 : 12
      const maxRight = editorBounds ? editorBounds.right - 4 : window.innerWidth - 12
      let left = align === "end" ? rootBounds.right - panelWidth : rootBounds.left
      if (left + panelWidth > maxRight) left = maxRight - panelWidth
      if (left < minLeft) left = minLeft
      horizontalOffsetRef.current = 0
      setHorizontalOffset(0)
      setFixedPosition({
        top: Math.round(rootBounds.bottom + 6),
        left: Math.round(left),
      })
      return
    }

    setFixedPosition(null)
    if (!editor) return
    const editorBounds = editor.getBoundingClientRect()
    const panelBounds = panel.getBoundingClientRect()
    const baseLeft = panelBounds.left - horizontalOffsetRef.current
    const baseRight = panelBounds.right - horizontalOffsetRef.current
    let nextOffset = 0

    if (baseLeft < editorBounds.left) nextOffset = editorBounds.left - baseLeft
    if (baseRight + nextOffset > editorBounds.right) {
      nextOffset += editorBounds.right - (baseRight + nextOffset)
    }

    horizontalOffsetRef.current = nextOffset
    setHorizontalOffset(nextOffset)
  }, [align, panelRef, rootRef])

  useLayoutEffect(() => {
    if (!open) return
    keepPanelInsideEditor()
    window.addEventListener("resize", keepPanelInsideEditor)
    window.addEventListener("scroll", keepPanelInsideEditor, true)
    return () => {
      window.removeEventListener("resize", keepPanelInsideEditor)
      window.removeEventListener("scroll", keepPanelInsideEditor, true)
    }
  }, [keepPanelInsideEditor, open])

  return { horizontalOffset, fixedPosition, resetHorizontalOffset }
}
