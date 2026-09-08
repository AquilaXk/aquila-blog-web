import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import {
  ToolbarMenuItem,
  ToolbarMenuPanel,
  ToolbarMenuRoot,
  ToolbarMenuTrigger,
  ToolbarSelect,
} from "./MarkdownEditor.styles"
import type { MarkdownEditorToolbarMenuAction } from "./MarkdownEditorToolbarMenu"

type MarkdownEditorTablePopoverProps = {
  rows: number
  columns: number
  disabled?: boolean
  onRowsChange: (rows: number) => void
  onColumnsChange: (columns: number) => void
  onBeforeOpen?: () => void
  actions: readonly MarkdownEditorToolbarMenuAction[]
}

export const MarkdownEditorTablePopover = ({
  rows,
  columns,
  disabled = false,
  onRowsChange,
  onColumnsChange,
  onBeforeOpen,
  actions,
}: MarkdownEditorTablePopoverProps) => {
  const [open, setOpen] = useState(false)
  const [horizontalOffset, setHorizontalOffset] = useState(0)
  const horizontalOffsetRef = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const rowsSelectRef = useRef<HTMLSelectElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dialogId = useId()

  const closePopover = useCallback((restoreTriggerFocus: boolean) => {
    setOpen(false)
    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  const openPopover = useCallback(() => {
    if (disabled) return
    onBeforeOpen?.()
    horizontalOffsetRef.current = 0
    setHorizontalOffset(0)
    setOpen(true)
  }, [disabled, onBeforeOpen])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closePopover(false)
    }
    const frameId = window.requestAnimationFrame(() => rowsSelectRef.current?.focus())
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [closePopover, open])

  useEffect(() => {
    if (disabled && open) closePopover(false)
  }, [closePopover, disabled, open])

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
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    keepPanelInsideEditor()
    window.addEventListener("resize", keepPanelInsideEditor)
    return () => window.removeEventListener("resize", keepPanelInsideEditor)
  }, [keepPanelInsideEditor, open])

  return (
    <ToolbarMenuRoot ref={rootRef}>
      <ToolbarMenuTrigger
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            closePopover(false)
            return
          }
          openPopover()
        }}
        onKeyDown={(event) => {
          if (open && event.key === "Escape") {
            event.preventDefault()
            closePopover(true)
            return
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPopover()
          }
        }}
      >
        표
      </ToolbarMenuTrigger>
      {open ? (
        <ToolbarMenuPanel
          ref={panelRef}
          id={dialogId}
          role="dialog"
          aria-label="표"
          $align="start"
          $horizontalOffset={horizontalOffset}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            closePopover(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              closePopover(true)
            }
          }}
        >
          <ToolbarSelect
            ref={rowsSelectRef}
            aria-label="표 행"
            value={rows}
            disabled={disabled}
            onChange={(event) => onRowsChange(Number(event.currentTarget.value))}
          >
            {[2, 3, 4, 5, 6].map((rowCount) => (
              <option key={rowCount} value={rowCount}>{`${rowCount}행`}</option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect
            aria-label="표 열"
            value={columns}
            disabled={disabled}
            onChange={(event) => onColumnsChange(Number(event.currentTarget.value))}
          >
            {[2, 3, 4, 5, 6].map((columnCount) => (
              <option key={columnCount} value={columnCount}>{`${columnCount}열`}</option>
            ))}
          </ToolbarSelect>
          {actions.map((action) => (
            <ToolbarMenuItem
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return
                action.onSelect()
                closePopover(false)
              }}
            >
              {action.label}
            </ToolbarMenuItem>
          ))}
        </ToolbarMenuPanel>
      ) : null}
    </ToolbarMenuRoot>
  )
}
