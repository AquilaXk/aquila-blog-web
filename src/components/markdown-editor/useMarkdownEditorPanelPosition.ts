import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"

export type MarkdownEditorPanelFixedPosition = {
  top: number
  left: number
}

type PanelHorizontalAlign = "start" | "end"

type MarkdownEditorPanelPositionParams = {
  open: boolean
  align?: PanelHorizontalAlign
  rootRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
}

const COMPACT_TOOLBAR_BREAKPOINT = 720

const computeCompactFixedPosition = (
  root: HTMLElement,
  panel: HTMLElement,
  editor: HTMLElement | null,
  align: PanelHorizontalAlign
): MarkdownEditorPanelFixedPosition => {
  const rootBounds = root.getBoundingClientRect()
  const panelWidth = panel.getBoundingClientRect().width
  const editorBounds = editor?.getBoundingClientRect()
  const minLeft = editorBounds ? editorBounds.left + 4 : 12
  const maxRight = editorBounds ? editorBounds.right - 4 : window.innerWidth - 12
  const rawLeft = align === "end" ? rootBounds.right - panelWidth : rootBounds.left
  const clampedLeft = Math.max(minLeft, Math.min(rawLeft, maxRight - panelWidth))
  return {
    top: Math.round(rootBounds.bottom + 6),
    left: Math.round(clampedLeft),
  }
}

const computeDesktopHorizontalOffset = (
  panel: HTMLElement,
  editor: HTMLElement,
  previousOffset: number
): number => {
  const editorBounds = editor.getBoundingClientRect()
  const panelBounds = panel.getBoundingClientRect()
  const baseLeft = panelBounds.left - previousOffset
  const baseRight = panelBounds.right - previousOffset
  let nextOffset = baseLeft < editorBounds.left ? editorBounds.left - baseLeft : 0
  if (baseRight + nextOffset > editorBounds.right) {
    nextOffset += editorBounds.right - (baseRight + nextOffset)
  }
  return nextOffset
}

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
      horizontalOffsetRef.current = 0
      setHorizontalOffset(0)
      setFixedPosition(computeCompactFixedPosition(root, panel, editor, align))
      return
    }

    setFixedPosition(null)
    if (!editor) return
    const nextOffset = computeDesktopHorizontalOffset(panel, editor, horizontalOffsetRef.current)
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
