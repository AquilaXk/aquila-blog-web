/**
 * 참조 구현:
 * - Milkdown/milkdown Crepe (packages/crepe/src/theme/common/table.css, packages/crepe/src/feature/table/, MIT License, Copyright (c) 2021 Mirone)
 */
import type { SiteLanguage } from "src/libs/language"
import { LIVE_TABLE_TOOLBAR_SVGS } from "./markdownEditorBlockSvgIcons"
import { getTableLabels } from "./markdownEditorWidgetLabels"
import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  type MarkdownEditorTableAlignment,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import {
  type TableVisualOptionKey,
  type TableVisualOptions,
  attachColumnResizeHandle,
  createTableColGroup,
  syncTableVisualWrapAttributes,
} from "./markdownEditorTableResizeDom"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export {
  type TableVisualOptionKey,
  type TableVisualOptions,
  applyTableColumnWidthsAction,
  attachColumnResizeHandle,
  createTableColGroup,
  getOrCreateTableVisualOptions,
  migrateTableVisualOptionsOffset,
  syncTableColGroupWidths,
  syncTableVisualWrapAttributes,
} from "./markdownEditorTableResizeDom"

export type TableToolbarButtonEntry = {
  button: HTMLButtonElement
  isDisabled?: (row: number, col: number) => boolean
  align?: MarkdownEditorTableAlignment
}

type TableCellTagName = "th" | "td"
type TableGripAxis = "col" | "row"
type TableDragState = { col: number | null; row: number | null }

const stopAndPrevent = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
}

const createAlignedTableCell = (tag: TableCellTagName, align: string, text: string) => {
  const cell = document.createElement(tag)
  if (cell.style) cell.style.textAlign = align
  if (cell.dataset) cell.dataset.align = align
  appendInlineMarkdownNodes(cell, text)
  return cell
}

export const renderStaticTableElement = (grid: MarkdownTableGrid): HTMLTableElement => {
  const table = document.createElement("table")
  table.className = "cm-live-table"
  const thead = document.createElement("thead")
  const headRow = document.createElement("tr")
  for (let col = 0; col < grid.headers.length; col += 1) {
    headRow.appendChild(createAlignedTableCell("th", grid.alignments[col] ?? "left", grid.headers[col] ?? ""))
  }
  thead.appendChild(headRow)
  table.appendChild(thead)
  if (grid.rows.length > 0) {
    const tbody = document.createElement("tbody")
    for (const row of grid.rows) {
      const tr = document.createElement("tr")
      for (let col = 0; col < grid.headers.length; col += 1) {
        tr.appendChild(createAlignedTableCell("td", grid.alignments[col] ?? "left", row[col] ?? ""))
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
  }
  return table
}

type TableToolbarActionSpec = {
  group: "options" | "align" | "row" | "col" | "source"
  groupStart?: boolean
  iconSvg: string
  shortLabel?: string
  danger?: boolean
  ariaLabel: string
  testId?: string
  optionKey?: TableVisualOptionKey
  ariaPressed?: boolean
  align?: MarkdownEditorTableAlignment
  action?: MarkdownTableGridAction
  isDisabled?: (row: number, col: number) => boolean
  onSelect?: (button: HTMLButtonElement) => void
}

const applyToolbarButtonDataset = (btn: HTMLButtonElement, spec: TableToolbarActionSpec) => {
  if (!btn.dataset) return
  btn.dataset.group = spec.group
  if (spec.groupStart) btn.dataset.groupStart = "true"
  if (spec.shortLabel) btn.dataset.hasLabel = "true"
  if (spec.danger) btn.dataset.danger = "true"
  if (spec.align) btn.dataset.align = spec.align
  if (spec.testId) btn.dataset.testid = spec.testId
}

const buildToolbarButtonElement = (
  spec: TableToolbarActionSpec,
  executeGridAction: (action: MarkdownTableGridAction) => void,
  onActivateToolbar?: () => void
): HTMLButtonElement => {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "cm-live-table-toolbar-btn"
  btn.setAttribute("aria-label", spec.ariaLabel)
  btn.setAttribute("title", spec.ariaLabel)
  applyToolbarButtonDataset(btn, spec)
  if (spec.ariaPressed !== undefined) btn.setAttribute("aria-pressed", String(spec.ariaPressed))
  btn.innerHTML = spec.shortLabel ? `${spec.iconSvg}<span>${spec.shortLabel}</span>` : spec.iconSvg
  btn.addEventListener("mousedown", stopAndPrevent)
  btn.addEventListener("click", (event) => {
    stopAndPrevent(event)
    onActivateToolbar?.()
    if (spec.onSelect) spec.onSelect(btn)
    else if (spec.action) executeGridAction(spec.action)
  })
  return btn
}

export const createTableToolbarElement = (params: {
  grid: MarkdownTableGrid
  wrap: HTMLElement
  visualOptions: TableVisualOptions
  executeGridAction: (action: MarkdownTableGridAction) => void
  onEditSource: () => void
  onDeleteTable?: () => void
  onActivateToolbar?: () => void
  onVisualOptionsChange?: () => void
  isEditable?: () => boolean
  language?: SiteLanguage
}): {
  toolbar: HTMLDivElement
  toolbarButtons: TableToolbarButtonEntry[]
  syncOptionButtons: () => void
  canAddRow: () => boolean
  canAddCol: () => boolean
} => {
  const {
    grid,
    wrap,
    visualOptions,
    executeGridAction,
    onEditSource,
    onDeleteTable,
    onActivateToolbar,
    onVisualOptionsChange,
    isEditable,
    language = "ko",
  } = params
  const labels = getTableLabels(language)
  const toolbar = document.createElement("div")
  toolbar.className = "cm-live-table-toolbar"
  toolbar.setAttribute("role", "toolbar")
  toolbar.setAttribute("aria-label", labels.toolbarAria)
  if (toolbar.dataset) toolbar.dataset.testid = "cm-live-table-toolbar"

  const toolbarButtons: TableToolbarButtonEntry[] = []
  const optionButtons: Array<{ button: HTMLButtonElement; key: TableVisualOptionKey }> = []
  const canAddRow = () => grid.rows.length + 2 <= MAX_EDIT_ROWS
  const canAddCol = () => grid.headers.length < MAX_EDIT_COLUMNS

  const toggleOptionSpec = (
    iconSvg: string,
    shortLabel: string,
    ariaLabel: string,
    testId: string,
    key: TableVisualOptionKey
  ): TableToolbarActionSpec => ({
    group: "options",
    iconSvg,
    shortLabel,
    ariaLabel,
    testId,
    optionKey: key,
    ariaPressed: visualOptions[key],
    onSelect: (btn: HTMLButtonElement) => {
      if (isEditable && !isEditable()) return
      visualOptions[key] = !visualOptions[key]
      syncTableVisualWrapAttributes(wrap, visualOptions)
      btn.setAttribute("aria-pressed", String(visualOptions[key]))
      onVisualOptionsChange?.()
    },
  })

  const actionSpecs: TableToolbarActionSpec[] = [
    toggleOptionSpec(LIVE_TABLE_TOOLBAR_SVGS.headerRow, labels.headerRowShort, labels.headerRowAria, "cm-live-table-toggle-header-row", "headerRow"),
    toggleOptionSpec(LIVE_TABLE_TOOLBAR_SVGS.headerCol, labels.headerColShort, labels.headerColAria, "cm-live-table-toggle-header-col", "headerColumn"),
    toggleOptionSpec(LIVE_TABLE_TOOLBAR_SVGS.fitWidth, labels.fitWidthShort, labels.fitWidthAria, "cm-live-table-toggle-full-width", "fitPageWidth"),
    { group: "align", groupStart: true, iconSvg: LIVE_TABLE_TOOLBAR_SVGS.alignLeft, ariaLabel: labels.alignLeftAria, align: "left", action: { kind: "set-alignment", alignment: "left" } },
    { group: "align", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.alignCenter, ariaLabel: labels.alignCenterAria, align: "center", action: { kind: "set-alignment", alignment: "center" } },
    { group: "align", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.alignRight, ariaLabel: labels.alignRightAria, align: "right", action: { kind: "set-alignment", alignment: "right" } },
    { group: "row", groupStart: true, iconSvg: LIVE_TABLE_TOOLBAR_SVGS.insertRowAbove, ariaLabel: labels.insertRowAboveAria, action: { kind: "insert-row-above" }, isDisabled: () => !canAddRow() },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.insertRowBelow, ariaLabel: labels.insertRowBelowAria, action: { kind: "add-row" }, isDisabled: () => !canAddRow() },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.moveUp, ariaLabel: labels.moveRowUpAria, action: { kind: "move-row-up" }, isDisabled: (row) => row < 2 },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.moveDown, ariaLabel: labels.moveRowDownAria, action: { kind: "move-row-down" }, isDisabled: (row) => row < 1 || row >= grid.rows.length },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.duplicate, ariaLabel: labels.duplicateRowAria, action: { kind: "duplicate-row" }, isDisabled: () => !canAddRow() },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.clear, ariaLabel: labels.clearRowAria, action: { kind: "clear-row" } },
    { group: "row", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.trash, danger: true, ariaLabel: labels.deleteRowAria, action: { kind: "delete-row" }, isDisabled: (row) => row === 0 || grid.rows.length <= 1 },
    { group: "col", groupStart: true, iconSvg: LIVE_TABLE_TOOLBAR_SVGS.insertColLeft, ariaLabel: labels.insertColLeftAria, action: { kind: "insert-column-left" }, isDisabled: () => !canAddCol() },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.insertColRight, ariaLabel: labels.insertColRightAria, action: { kind: "add-column" }, isDisabled: () => !canAddCol() },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.moveLeft, ariaLabel: labels.moveColLeftAria, action: { kind: "move-column-left" }, isDisabled: (_row, col) => col < 1 },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.moveRight, ariaLabel: labels.moveColRightAria, action: { kind: "move-column-right" }, isDisabled: (_row, col) => col >= grid.headers.length - 1 },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.duplicate, ariaLabel: labels.duplicateColAria, action: { kind: "duplicate-column" }, isDisabled: () => !canAddCol() },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.clear, ariaLabel: labels.clearColAria, action: { kind: "clear-column" } },
    { group: "col", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.trash, danger: true, ariaLabel: labels.deleteColAria, action: { kind: "delete-column" }, isDisabled: () => grid.headers.length <= 1 },
    { group: "source", groupStart: true, iconSvg: LIVE_TABLE_TOOLBAR_SVGS.code, ariaLabel: labels.editSourceAria, onSelect: () => onEditSource() },
    { group: "source", iconSvg: LIVE_TABLE_TOOLBAR_SVGS.trash, danger: true, ariaLabel: labels.deleteTableAria, testId: "cm-live-table-delete-table", onSelect: () => onDeleteTable?.() },
  ]

  for (const spec of actionSpecs) {
    const btn = buildToolbarButtonElement(spec, executeGridAction, onActivateToolbar)
    if (spec.optionKey) optionButtons.push({ button: btn, key: spec.optionKey })
    if (spec.isDisabled || spec.align) {
      toolbarButtons.push({ button: btn, isDisabled: spec.isDisabled, align: spec.align })
    }
    toolbar.appendChild(btn)
  }

  const syncOptionButtons = () => {
    for (const entry of optionButtons) {
      entry.button.setAttribute("aria-pressed", String(visualOptions[entry.key]))
    }
  }

  return { toolbar, toolbarButtons, syncOptionButtons, canAddRow, canAddCol }
}

const isInteractiveCellIgnoredTarget = (target: HTMLElement | null): boolean => {
  if (!target) return false
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true
  return Boolean(
    target.closest?.("a") ||
      target.closest?.(".cm-live-table-col-resizer") ||
      target.closest?.(".cm-live-table-col-handle") ||
      target.closest?.(".cm-live-table-row-handle")
  )
}

const bindInteractiveCellElement = (
  cellEl: HTMLElement,
  row: number,
  col: number,
  align: string,
  text: string,
  onActivateCell: (row: number, col: number) => void
) => {
  if (cellEl.style) cellEl.style.textAlign = align
  if (cellEl.dataset) {
    cellEl.dataset.align = align
    cellEl.dataset.cellRow = String(row)
    cellEl.dataset.cellCol = String(col)
  }
  appendInlineMarkdownNodes(cellEl, text)

  const handleActivate = (event: MouseEvent) => {
    if (event.button !== 0 || isInteractiveCellIgnoredTarget(event.target as HTMLElement | null)) return
    stopAndPrevent(event)
    onActivateCell(row, col)
  }
  cellEl.addEventListener("mousedown", handleActivate)
  cellEl.addEventListener("click", handleActivate)
}

const bindGripDragAndDrop = (params: {
  handle: HTMLButtonElement
  dropTarget: HTMLElement
  dropClass: string
  index: number
  axis: TableGripAxis
  dragState: TableDragState
  onMoveTo?: (fromIndex: number, toIndex: number) => void
}) => {
  const { handle, dropTarget, dropClass, index, axis, dragState, onMoveTo } = params
  handle.addEventListener("dragstart", (event: DragEvent) => {
    event.stopPropagation()
    dragState.col = axis === "col" ? index : null
    dragState.row = axis === "row" ? index : null
  })
  handle.addEventListener("dragend", () => {
    dragState[axis] = null
  })
  dropTarget.addEventListener("dragover", (event: DragEvent) => {
    if (dragState[axis] === null) return
    stopAndPrevent(event)
    dropTarget.classList.add(dropClass)
  })
  dropTarget.addEventListener("dragleave", () => dropTarget.classList.remove(dropClass))
  dropTarget.addEventListener("drop", (event: DragEvent) => {
    stopAndPrevent(event)
    dropTarget.classList.remove(dropClass)
    const fromIndex = dragState[axis]
    dragState[axis] = null
    if (fromIndex !== null && fromIndex !== index) onMoveTo?.(fromIndex, index)
  })
}

const applyGripHandleDataset = (handle: HTMLButtonElement, axis: TableGripAxis, index: number) => {
  if (!handle.dataset) return
  handle.dataset.testid = handle.className
  if (axis === "col") handle.dataset.colIndex = String(index)
  else handle.dataset.rowIndex = String(index)
}

const attachAxisGripHandle = (params: {
  hostEl: HTMLElement
  dropTarget: HTMLElement
  axis: TableGripAxis
  index: number
  draggable: boolean
  ariaLabel: string
  dragState: TableDragState
  onSelect?: (index: number) => void
  onMoveTo?: (fromIndex: number, toIndex: number) => void
}) => {
  const { hostEl, dropTarget, axis, index, draggable, ariaLabel, dragState, onSelect, onMoveTo } = params
  const handle = document.createElement("button")
  handle.type = "button"
  handle.className = axis === "col" ? "cm-live-table-col-handle" : "cm-live-table-row-handle"
  applyGripHandleDataset(handle, axis, index)
  handle.setAttribute("aria-label", ariaLabel)
  handle.setAttribute("draggable", draggable ? "true" : "false")
  handle.innerHTML =
    axis === "col" ? LIVE_TABLE_TOOLBAR_SVGS.gripHorizontal : LIVE_TABLE_TOOLBAR_SVGS.gripVertical
  handle.addEventListener("mousedown", (event: MouseEvent) => event.stopPropagation())
  handle.addEventListener("click", (event: MouseEvent) => {
    stopAndPrevent(event)
    onSelect?.(index)
  })
  if (draggable) {
    bindGripDragAndDrop({
      handle,
      dropTarget,
      dropClass: axis === "col" ? "is-drop-target-col" : "is-drop-target-row",
      index,
      axis,
      dragState,
      onMoveTo,
    })
  }
  hostEl.appendChild(handle)
}

const createAddBarButton = (
  className: string,
  ariaLabel: string,
  testId: string,
  contentHtml: string,
  disabled: boolean,
  onSelect: () => void
) => {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = className
  btn.setAttribute("aria-label", ariaLabel)
  btn.setAttribute("title", ariaLabel)
  if (btn.dataset) btn.dataset.testid = testId
  btn.innerHTML = contentHtml
  btn.disabled = disabled
  btn.addEventListener("mousedown", stopAndPrevent)
  btn.addEventListener("click", (event) => {
    stopAndPrevent(event)
    onSelect()
  })
  return btn
}

type InteractiveSurfaceParams = {
  grid: MarkdownTableGrid
  visualOptions: TableVisualOptions
  canAddCol: () => boolean
  canAddRow: () => boolean
  onActivateCell: (row: number, col: number) => void
  onAddColumn: () => void
  onAddRow: () => void
  onAddRowAndColumn?: () => void
  onSelectColumn?: (col: number) => void
  onSelectRow?: (row: number) => void
  onMoveColumnTo?: (fromCol: number, toCol: number) => void
  onMoveRowTo?: (fromRow: number, toRow: number) => void
  onVisualOptionsChange?: () => void
  isEditable?: () => boolean
  language?: SiteLanguage
}

const buildInteractiveTableHead = (
  params: InteractiveSurfaceParams,
  cols: readonly HTMLElement[],
  dragState: TableDragState,
  cellElements: HTMLElement[][]
): HTMLElement => {
  const {
    grid,
    visualOptions,
    onActivateCell,
    onSelectColumn,
    onSelectRow,
    onMoveColumnTo,
    onMoveRowTo,
    onVisualOptionsChange,
    isEditable,
    language = "ko",
  } = params
  const labels = getTableLabels(language)
  const thead = document.createElement("thead")
  const headTr = document.createElement("tr")
  const headCellEls: HTMLElement[] = []
  for (let col = 0; col < grid.headers.length; col += 1) {
    const th = document.createElement("th")
    bindInteractiveCellElement(th, 0, col, grid.alignments[col] ?? "left", grid.headers[col] ?? "", onActivateCell)
    attachAxisGripHandle({
      hostEl: th,
      dropTarget: th,
      axis: "col",
      index: col,
      draggable: true,
      ariaLabel: labels.selectColAria(col),
      dragState,
      onSelect: onSelectColumn,
      onMoveTo: onMoveColumnTo,
    })
    if (col === 0) {
      attachAxisGripHandle({
        hostEl: th,
        dropTarget: headTr,
        axis: "row",
        index: 0,
        draggable: false,
        ariaLabel: labels.selectHeaderRowAria,
        dragState,
        onSelect: onSelectRow,
        onMoveTo: onMoveRowTo,
      })
    }
    attachColumnResizeHandle(th, col, cols[col]!, visualOptions, onVisualOptionsChange, isEditable, language)
    headCellEls.push(th)
    headTr.appendChild(th)
  }
  cellElements.push(headCellEls)
  thead.appendChild(headTr)
  return thead
}

const buildInteractiveTableBody = (
  params: InteractiveSurfaceParams,
  dragState: TableDragState,
  cellElements: HTMLElement[][]
): HTMLElement => {
  const { grid, onActivateCell, onSelectRow, onMoveRowTo, language = "ko" } = params
  const labels = getTableLabels(language)
  const tbody = document.createElement("tbody")
  for (let rowIdx = 0; rowIdx < grid.rows.length; rowIdx += 1) {
    const row = grid.rows[rowIdx]!
    const tr = document.createElement("tr")
    const rowCellEls: HTMLElement[] = []
    for (let col = 0; col < grid.headers.length; col += 1) {
      const td = document.createElement("td")
      bindInteractiveCellElement(td, rowIdx + 1, col, grid.alignments[col] ?? "left", row[col] ?? "", onActivateCell)
      if (col === 0) {
        attachAxisGripHandle({
          hostEl: td,
          dropTarget: tr,
          axis: "row",
          index: rowIdx + 1,
          draggable: true,
          ariaLabel: labels.selectRowAria(rowIdx),
          dragState,
          onSelect: onSelectRow,
          onMoveTo: onMoveRowTo,
        })
      }
      rowCellEls.push(td)
      tr.appendChild(td)
    }
    cellElements.push(rowCellEls)
    tbody.appendChild(tr)
  }
  return tbody
}

export const createInteractiveTableSurface = (
  params: InteractiveSurfaceParams
): {
  gridRow: HTMLDivElement
  addRowBtn: HTMLElement
  cellElements: HTMLElement[][]
  colElements: HTMLElement[]
} => {
  const { grid, visualOptions, canAddCol, canAddRow, onAddColumn, onAddRow, onAddRowAndColumn, language = "ko" } = params
  const labels = getTableLabels(language)
  const cellElements: HTMLElement[][] = []
  const gridRow = document.createElement("div")
  gridRow.className = "cm-live-table-grid-row"

  const table = document.createElement("table")
  table.className = "cm-live-table"
  const { colgroup, cols } = createTableColGroup(grid.headers.length, visualOptions.columnWidths)
  table.appendChild(colgroup)

  const dragState: TableDragState = { col: null, row: null }
  table.appendChild(buildInteractiveTableHead(params, cols, dragState, cellElements))
  table.appendChild(buildInteractiveTableBody(params, dragState, cellElements))

  const addColBtn = createAddBarButton(
    "cm-live-table-add-col",
    labels.addColAria,
    "cm-live-table-add-col",
    LIVE_TABLE_TOOLBAR_SVGS.plus,
    !canAddCol(),
    onAddColumn
  )
  gridRow.appendChild(table)
  gridRow.appendChild(addColBtn)
  const footerRow = document.createElement("div")
  footerRow.className = "cm-live-table-footer-row"
  const addRowBtn = createAddBarButton(
    "cm-live-table-add-row",
    labels.addRowAria,
    "cm-live-table-add-row",
    `${LIVE_TABLE_TOOLBAR_SVGS.plus}<span>${labels.addRowButtonLabel}</span>`,
    !canAddRow(),
    onAddRow
  )
  const addCornerBtn = createAddBarButton(
    "cm-live-table-add-corner",
    labels.addCornerAria,
    "cm-live-table-add-corner",
    LIVE_TABLE_TOOLBAR_SVGS.plus,
    !canAddRow() && !canAddCol(),
    () => onAddRowAndColumn?.()
  )
  footerRow.appendChild(addRowBtn)
  footerRow.appendChild(addCornerBtn)
  return { gridRow, addRowBtn: footerRow, cellElements, colElements: cols }
}
