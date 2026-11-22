/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/feature/table/ (MIT License, Copyright (c) 2021 Mirone)
 * - ProseMirror/prosemirror-tables & Tiptap interactive grid table picker (MIT License)
 */
import styled from "@emotion/styled"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { focusVisibleRing } from "src/design-system/focusRing"
import { useLanguage } from "../../libs/language"
import { editorT } from "./markdownEditorI18n"
import { EditorIconChevronDown, EditorIconTable } from "./MarkdownEditorIcons"
import {
  ToolbarMenuChevron,
  ToolbarMenuItem,
  ToolbarMenuPanel,
  ToolbarMenuRoot,
  ToolbarMenuTrigger,
} from "./MarkdownEditor.styles"
import type { MarkdownEditorToolbarMenuAction } from "./MarkdownEditorToolbarMenu"
import { useMarkdownEditorPanelPosition } from "./useMarkdownEditorPanelPosition"

const MATRIX_SIZE = 6
const TABLE_SELECT_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8] as const

const TableMatrixSection = styled.div`
  display: grid;
  gap: 6px;
  padding: 6px 8px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray4};
`

const TableDimensionPickerRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding-top: 2px;
`

const TableDimensionTimes = styled.span`
  color: ${({ theme }) => theme.colors.gray10};
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  user-select: none;
`

const TableDimensionSelect = styled.select`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 36px;
  min-height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.gray6};
  border-radius: 6px;
  padding: 0 6px;
  background: ${({ theme }) => theme.colors.gray2};
  color: ${({ theme }) => theme.colors.gray12};
  font-family: var(--aq-font-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  ${focusVisibleRing}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 768px), (pointer: coarse) {
    height: 44px;
    min-height: 44px;
    font-size: 16px;
  }
`

const TableMatrixHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray11};
  font-variant-numeric: tabular-nums;
`

const TableMatrixGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 20px);
  gap: 3px;
  justify-content: center;

  @media (pointer: coarse) {
    grid-template-columns: repeat(6, 36px);
    gap: 4px;
  }
`

const TableMatrixCell = styled.button<{ $active: boolean }>`
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 3px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.gray12 : theme.colors.gray6)};
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : theme.publicDesign.readableSurface)};
  cursor: pointer;
  transition: background-color 0.08s ease, border-color 0.08s ease;
  ${focusVisibleRing}

  @media (pointer: coarse) {
    width: 36px;
    height: 36px;
  }
`

type MarkdownEditorTablePopoverProps = {
  rows: number
  columns: number
  disabled?: boolean
  onRowsChange: (rows: number) => void
  onColumnsChange: (columns: number) => void
  onInsertSize?: (rows: number, columns: number) => void
  onBeforeOpen?: () => void
  actions: readonly MarkdownEditorToolbarMenuAction[]
}

const moveTablePopoverMenuFocus = (panel: HTMLElement, key: string): boolean => {
  const items = Array.from(
    panel.querySelectorAll<HTMLButtonElement>('[data-table-action="true"]:not(:disabled)')
  )
  if (items.length === 0) return false
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  if (key === "ArrowDown") {
    items[currentIndex < 0 ? 0 : (currentIndex + 1) % items.length]?.focus()
    return true
  }
  if (key === "ArrowUp") {
    items[currentIndex <= 0 ? items.length - 1 : currentIndex - 1]?.focus()
    return true
  }
  if (key === "Home") {
    items[0]?.focus()
    return true
  }
  if (key === "End") {
    items.at(-1)?.focus()
    return true
  }
  return false
}

export const MarkdownEditorTablePopover = ({
  rows,
  columns,
  disabled = false,
  onRowsChange,
  onColumnsChange,
  onInsertSize,
  onBeforeOpen,
  actions,
}: MarkdownEditorTablePopoverProps) => {
  const [open, setOpen] = useState(false)
  const [hoverSize, setHoverSize] = useState<{ r: number; c: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const rowsSelectRef = useRef<HTMLSelectElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dialogId = useId()
  const { horizontalOffset, fixedPosition, resetHorizontalOffset } = useMarkdownEditorPanelPosition({
    open,
    rootRef,
    panelRef,
  })

  const closePopover = useCallback((restoreTriggerFocus: boolean) => {
    setOpen(false)
    setHoverSize(null)
    if (restoreTriggerFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  const openPopover = useCallback(() => {
    if (disabled) return
    onBeforeOpen?.()
    resetHorizontalOffset()
    setHoverSize(null)
    setOpen(true)
  }, [disabled, onBeforeOpen, resetHorizontalOffset])

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

  const { language } = useLanguage()
  const triggerLabel = editorT("tableTriggerLabel", language)
  const activeR = hoverSize?.r ?? rows
  const activeC = hoverSize?.c ?? columns

  return (
    <ToolbarMenuRoot ref={rootRef} data-table-popover="true" data-testid="markdown-editor-table-popover">
      <ToolbarMenuTrigger
        ref={triggerRef}
        type="button"
        title={triggerLabel}
        aria-label={triggerLabel}
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
        <EditorIconTable size={15} />
        <span>{triggerLabel}</span>
        <ToolbarMenuChevron aria-hidden="true">
          <EditorIconChevronDown size={12} strokeWidth={2.1} />
        </ToolbarMenuChevron>
      </ToolbarMenuTrigger>
      {open ? (
        <ToolbarMenuPanel
          ref={panelRef}
          id={dialogId}
          role="dialog"
          aria-label={triggerLabel}
          $align="start"
          $horizontalOffset={horizontalOffset}
          $fixedPosition={fixedPosition}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            closePopover(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              closePopover(true)
              return
            }
            if (
              !(event.target instanceof HTMLSelectElement) &&
              !(event.target instanceof HTMLElement && event.target.dataset.matrixCell === "true") &&
              moveTablePopoverMenuFocus(event.currentTarget, event.key)
            ) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
        >
          <TableMatrixSection onMouseLeave={() => setHoverSize(null)}>
            <TableMatrixHeader>
              <span>{editorT("tableSelectSize", language)}</span>
              <span>{`${activeR} × ${activeC}`}</span>
            </TableMatrixHeader>
            <TableMatrixGrid role="grid" aria-label={editorT("tableGridAria", language)}>
              {Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }, (_, idx) => {
                const r = Math.floor(idx / MATRIX_SIZE) + 1
                const c = (idx % MATRIX_SIZE) + 1
                const isActive = r <= activeR && c <= activeC
                return (
                  <TableMatrixCell
                    key={`${r}x${c}`}
                    type="button"
                    data-matrix-cell="true"
                    $active={isActive}
                    aria-label={`${r}${editorT("tableRowUnit", language)} ${c}${editorT("tableColUnit", language)} ${editorT("tableSelectSuffix", language)}`}
                    onMouseEnter={() => {
                      setHoverSize({ r, c })
                    }}
                    onFocus={() => {
                      setHoverSize({ r, c })
                    }}
                    onClick={() => {
                      onRowsChange(r)
                      onColumnsChange(c)
                      if (onInsertSize) {
                        onInsertSize(r, c)
                      } else {
                        actions[0]?.onSelect()
                      }
                      closePopover(false)
                    }}
                  />
                )
              })}
            </TableMatrixGrid>
            <TableDimensionPickerRow>
              <TableDimensionSelect
                ref={rowsSelectRef}
                aria-label={editorT("tableRowsAria", language)}
                value={rows}
                disabled={disabled}
                onChange={(event) => onRowsChange(Number(event.currentTarget.value))}
              >
                {TABLE_SELECT_COUNTS.map((rowCount) => (
                  <option key={rowCount} value={rowCount}>{`${rowCount}${editorT("tableRowUnit", language)}`}</option>
                ))}
              </TableDimensionSelect>
              <TableDimensionTimes aria-hidden="true">×</TableDimensionTimes>
              <TableDimensionSelect
                aria-label={editorT("tableColsAria", language)}
                value={columns}
                disabled={disabled}
                onChange={(event) => onColumnsChange(Number(event.currentTarget.value))}
              >
                {TABLE_SELECT_COUNTS.map((columnCount) => (
                  <option key={columnCount} value={columnCount}>{`${columnCount}${editorT("tableColUnit", language)}`}</option>
                ))}
              </TableDimensionSelect>
            </TableDimensionPickerRow>
          </TableMatrixSection>
          {actions.map((action) => (
            <ToolbarMenuItem
              key={action.id}
              type="button"
              data-table-action="true"
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
