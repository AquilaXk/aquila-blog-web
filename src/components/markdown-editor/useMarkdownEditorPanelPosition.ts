import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"

type MarkdownEditorPanelPositionParams = {
  open: boolean
  rootRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
}

export const useMarkdownEditorPanelPosition = ({
  open,
  rootRef,
  panelRef,
}: MarkdownEditorPanelPositionParams) => {
  const [horizontalOffset, setHorizontalOffset] = useState(0)
  const horizontalOffsetRef = useRef(0)

  const resetHorizontalOffset = useCallback(() => {
    horizontalOffsetRef.current = 0
    setHorizontalOffset(0)
  }, [])

  const keepPanelInsideEditor = useCallback(() => {
    const editor = rootRef.current?.closest<HTMLElement>("[data-testid='markdown-editor']")
    const panel = panelRef.current
    if (!editor || !panel) return

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
  }, [panelRef, rootRef])

  useLayoutEffect(() => {
    if (!open) return
    keepPanelInsideEditor()
    window.addEventListener("resize", keepPanelInsideEditor)
    return () => window.removeEventListener("resize", keepPanelInsideEditor)
  }, [keepPanelInsideEditor, open])

  return { horizontalOffset, resetHorizontalOffset }
}
