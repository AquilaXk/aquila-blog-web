import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export type TableVisualOptions = {
  headerRow: boolean
  headerColumn: boolean
  fitPageWidth: boolean
  columnWidths: number[]
}

export type TableToolbarButtonEntry = {
  button: HTMLButtonElement
  isDisabled: (row: number, col: number) => boolean
}

const MAX_TABLE_VISUAL_OPTIONS = 128
const tableVisualOptionsByOffset = new Map<number, TableVisualOptions>()

export const getOrCreateTableVisualOptions = (
  tableFrom: number,
  columnCount: number
): TableVisualOptions => {
  const existing = tableVisualOptionsByOffset.get(tableFrom)
  if (existing) {
    tableVisualOptionsByOffset.delete(tableFrom)
    while (existing.columnWidths.length < columnCount) existing.columnWidths.push(0)
    if (existing.columnWidths.length > columnCount) existing.columnWidths.length = columnCount
    tableVisualOptionsByOffset.set(tableFrom, existing)
    return existing
  }
  if (tableVisualOptionsByOffset.size >= MAX_TABLE_VISUAL_OPTIONS) {
    const oldestKey = tableVisualOptionsByOffset.keys().next().value
    if (oldestKey !== undefined) tableVisualOptionsByOffset.delete(oldestKey)
  }
  const created: TableVisualOptions = {
    headerRow: true,
    headerColumn: false,
    fitPageWidth: false,
    columnWidths: Array.from({ length: columnCount }, () => 0),
  }
  tableVisualOptionsByOffset.set(tableFrom, created)
  return created
}

export const setBooleanDataAttribute = (el: HTMLElement, attr: string, enabled: boolean) => {
  if (enabled) el.setAttribute(attr, "true")
  else if (typeof el.removeAttribute === "function") el.removeAttribute(attr)
  else if (typeof el.toggleAttribute === "function") el.toggleAttribute(attr, false)
}

export const syncTableVisualWrapAttributes = (wrap: HTMLElement, visualOptions: TableVisualOptions) => {
  setBooleanDataAttribute(wrap, "data-header-row", visualOptions.headerRow)
  setBooleanDataAttribute(wrap, "data-header-col", visualOptions.headerColumn)
  setBooleanDataAttribute(wrap, "data-full-width", visualOptions.fitPageWidth)
}

const createAlignedTableCell = (tag: "th" | "td", align: string, text: string) => {
  const cell = document.createElement(tag)
  if (cell.style) cell.style.textAlign = align
  cell.setAttribute("data-align", align)
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

export const createTableColGroup = (
  columnCount: number,
  columnWidths: readonly number[]
): { colgroup: HTMLElement; cols: HTMLElement[] } => {
  const colgroup = document.createElement("colgroup")
  const cols: HTMLElement[] = []
  for (let col = 0; col < columnCount; col += 1) {
    const colEl = document.createElement("col")
    colgroup.appendChild(colEl)
    cols.push(colEl)
  }
  syncTableColGroupWidths(cols, columnWidths)
  return { colgroup, cols }
}

export const syncTableColGroupWidths = (
  cols: readonly HTMLElement[],
  columnWidths: readonly number[]
) => {
  for (let col = 0; col < cols.length; col += 1) {
    const colEl = cols[col]
    if (!colEl) continue
    const width = columnWidths[col] ?? 0
    if (width > 0) {
      const rounded = Math.round(width)
      if (colEl.style) colEl.style.width = `${rounded}px`
      colEl.setAttribute("data-col-width", String(rounded))
    } else {
      if (colEl.style) colEl.style.width = ""
      if (typeof colEl.removeAttribute === "function") colEl.removeAttribute("data-col-width")
    }
  }
}

export const applyTableColumnWidthsAction = (
  columnWidths: number[],
  columnCount: number,
  colIndex: number,
  action: MarkdownTableGridAction
) => {
  while (columnWidths.length < columnCount) columnWidths.push(0)
  if (columnWidths.length > columnCount) columnWidths.length = columnCount
  const clampedCol = Math.max(0, Math.min(colIndex, columnCount - 1))
  if (action.kind === "move-column-left" && clampedCol > 0) {
    const prev = columnWidths[clampedCol - 1] ?? 0
    columnWidths[clampedCol - 1] = columnWidths[clampedCol] ?? 0
    columnWidths[clampedCol] = prev
  } else if (action.kind === "move-column-right" && clampedCol < columnCount - 1) {
    const next = columnWidths[clampedCol + 1] ?? 0
    columnWidths[clampedCol + 1] = columnWidths[clampedCol] ?? 0
    columnWidths[clampedCol] = next
  } else if (action.kind === "move-column-to") {
    const targetCol = Math.max(0, Math.min(action.targetCol, columnCount - 1))
    if (targetCol !== clampedCol) {
      const [moved] = columnWidths.splice(clampedCol, 1)
      columnWidths.splice(targetCol, 0, moved ?? 0)
    }
  } else if (action.kind === "insert-column-left") {
    columnWidths.splice(clampedCol, 0, 0)
  } else if (action.kind === "add-column") {
    columnWidths.splice(clampedCol + 1, 0, 0)
  } else if (action.kind === "duplicate-column") {
    columnWidths.splice(clampedCol + 1, 0, columnWidths[clampedCol] ?? 0)
  } else if (action.kind === "delete-column" && columnCount > 1) {
    columnWidths.splice(clampedCol, 1)
  }
}

export const attachColumnResizeHandle = (
  th: HTMLElement,
  colIndex: number,
  colEl: HTMLElement,
  visualOptions: TableVisualOptions
): HTMLElement => {
  const resizer = document.createElement("span")
  resizer.className = "cm-live-table-col-resizer"
  resizer.setAttribute("data-testid", "cm-live-table-col-resizer")
  resizer.setAttribute("data-col-index", String(colIndex))
  resizer.setAttribute("role", "separator")
  resizer.setAttribute("aria-orientation", "vertical")
  resizer.setAttribute("aria-label", `${colIndex + 1}열 너비 조절`)

  resizer.addEventListener("click", (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  })

  resizer.addEventListener("dblclick", (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    visualOptions.columnWidths[colIndex] = 0
    if (colEl.style) colEl.style.width = ""
    if (typeof colEl.removeAttribute === "function") colEl.removeAttribute("data-col-width")
  })

  let isResizing = false

  const startResize = (
    event: MouseEvent | PointerEvent,
    moveEventName: "mousemove" | "pointermove",
    upEventNames: readonly ("mouseup" | "pointerup" | "pointercancel")[]
  ) => {
    if (typeof event.button === "number" && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (isResizing) return
    isResizing = true

    const startX = event.clientX
    const configuredWidth = visualOptions.columnWidths[colIndex] ?? 0
    const measuredWidth =
      typeof th.getBoundingClientRect === "function" ? th.getBoundingClientRect().width : 0
    const startWidth =
      configuredWidth > 0 ? configuredWidth : measuredWidth > 0 ? measuredWidth : 120

    let latestClientX = startX
    let hasMoved = false
    let rafId: number | null = null

    const applyWidth = (clientX: number) => {
      const nextWidth = Math.round(Math.max(72, Math.min(640, startWidth + (clientX - startX))))
      visualOptions.columnWidths[colIndex] = nextWidth
      if (colEl.style) colEl.style.width = `${nextWidth}px`
      colEl.setAttribute("data-col-width", String(nextWidth))
    }

    const handleMove = (moveEvent: MouseEvent | PointerEvent) => {
      hasMoved = true
      latestClientX = moveEvent.clientX
      if (rafId === null) {
        applyWidth(latestClientX)
        if (typeof requestAnimationFrame === "function") {
          rafId = requestAnimationFrame(() => {
            rafId = null
            applyWidth(latestClientX)
          })
        }
      }
    }

    const handleUp = () => {
      isResizing = false
      if (rafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (hasMoved) applyWidth(latestClientX)
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener(moveEventName, handleMove)
        for (const upName of upEventNames) {
          window.removeEventListener(upName, handleUp)
        }
      }
    }

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener(moveEventName, handleMove)
      for (const upName of upEventNames) {
        window.addEventListener(upName, handleUp)
      }
    }
  }

  resizer.addEventListener("pointerdown", (event: PointerEvent) => {
    startResize(event, "pointermove", ["pointerup", "pointercancel"])
  })

  resizer.addEventListener("mousedown", (event: MouseEvent) => {
    startResize(event, "mousemove", ["mouseup"])
  })

  th.appendChild(resizer)
  return resizer
}

export const createTableToolbarElement = (params: {
  grid: MarkdownTableGrid
  wrap: HTMLElement
  visualOptions: TableVisualOptions
  executeGridAction: (action: MarkdownTableGridAction) => void
  onEditSource: () => void
}): {
  toolbar: HTMLDivElement
  toolbarButtons: TableToolbarButtonEntry[]
  canAddRow: () => boolean
  canAddCol: () => boolean
} => {
  const { grid, wrap, visualOptions, executeGridAction, onEditSource } = params
  const toolbar = document.createElement("div")
  toolbar.className = "cm-live-table-toolbar"
  toolbar.setAttribute("role", "toolbar")
  toolbar.setAttribute("aria-label", "표 빠른 편집 도구")
  toolbar.setAttribute("data-testid", "cm-live-table-toolbar")

  const toolbarButtons: TableToolbarButtonEntry[] = []
  const canAddRow = () => grid.rows.length + 2 <= MAX_EDIT_ROWS
  const canAddCol = () => grid.headers.length < MAX_EDIT_COLUMNS

  const toggleOptionSpec = (
    label: string,
    ariaLabel: string,
    testId: string,
    key: "headerRow" | "headerColumn" | "fitPageWidth"
  ) => ({
    group: "options" as const,
    label,
    ariaLabel,
    testId,
    ariaPressed: visualOptions[key],
    onSelect: (btn: HTMLButtonElement) => {
      visualOptions[key] = !visualOptions[key]
      syncTableVisualWrapAttributes(wrap, visualOptions)
      btn.setAttribute("aria-pressed", String(visualOptions[key]))
    },
  })

  const actionSpecs: Array<{
    group: "options" | "align" | "row" | "col" | "source"
    groupStart?: boolean
    label: string
    ariaLabel: string
    testId?: string
    ariaPressed?: boolean
    action?: MarkdownTableGridAction
    isDisabled?: (row: number, col: number) => boolean
    onSelect?: (button: HTMLButtonElement) => void
  }> = [
    toggleOptionSpec("▤ 제목행", "표 제목 행 강조 전환", "cm-live-table-toggle-header-row", "headerRow"),
    toggleOptionSpec("▤ 제목열", "표 제목 열 강조 전환", "cm-live-table-toggle-header-col", "headerColumn"),
    toggleOptionSpec("↔ 너비맞춤", "표 페이지 너비 맞춤 전환", "cm-live-table-toggle-full-width", "fitPageWidth"),
    { group: "align", groupStart: true, label: "≡좌", ariaLabel: "표 열 왼쪽 정렬", action: { kind: "set-alignment", alignment: "left" } },
    { group: "align", label: "≡중", ariaLabel: "표 열 가운데 정렬", action: { kind: "set-alignment", alignment: "center" } },
    { group: "align", label: "≡우", ariaLabel: "표 열 오른쪽 정렬", action: { kind: "set-alignment", alignment: "right" } },
    { group: "row", groupStart: true, label: "+행↑", ariaLabel: "표 위에 행 추가", action: { kind: "insert-row-above" }, isDisabled: () => !canAddRow() },
    { group: "row", label: "+행↓", ariaLabel: "표 아래에 행 추가", action: { kind: "add-row" }, isDisabled: () => !canAddRow() },
    { group: "row", label: "행↑", ariaLabel: "표 행 위로 이동", action: { kind: "move-row-up" }, isDisabled: (row) => row < 2 },
    { group: "row", label: "행↓", ariaLabel: "표 행 아래로 이동", action: { kind: "move-row-down" }, isDisabled: (row) => row < 1 || row >= grid.rows.length },
    { group: "row", label: "⧉행", ariaLabel: "표 행 복제", action: { kind: "duplicate-row" }, isDisabled: () => !canAddRow() },
    { group: "row", label: "⌫행", ariaLabel: "표 행 내용 비우기", action: { kind: "clear-row" } },
    { group: "row", label: "✕행", ariaLabel: "표 행 삭제", action: { kind: "delete-row" }, isDisabled: (row) => row === 0 || grid.rows.length <= 1 },
    { group: "col", groupStart: true, label: "+열←", ariaLabel: "표 왼쪽에 열 추가", action: { kind: "insert-column-left" }, isDisabled: () => !canAddCol() },
    { group: "col", label: "+열→", ariaLabel: "표 오른쪽에 열 추가", action: { kind: "add-column" }, isDisabled: () => !canAddCol() },
    { group: "col", label: "열←", ariaLabel: "표 열 왼쪽으로 이동", action: { kind: "move-column-left" }, isDisabled: (_row, col) => col < 1 },
    { group: "col", label: "열→", ariaLabel: "표 열 오른쪽으로 이동", action: { kind: "move-column-right" }, isDisabled: (_row, col) => col >= grid.headers.length - 1 },
    { group: "col", label: "⧉열", ariaLabel: "표 열 복제", action: { kind: "duplicate-column" }, isDisabled: () => !canAddCol() },
    { group: "col", label: "⌫열", ariaLabel: "표 열 내용 비우기", action: { kind: "clear-column" } },
    { group: "col", label: "✕열", ariaLabel: "표 열 삭제", action: { kind: "delete-column" }, isDisabled: () => grid.headers.length <= 1 },
    { group: "source", groupStart: true, label: "</> 원본", ariaLabel: "표 마크다운 원본 편집", onSelect: () => onEditSource() },
  ]

  for (const spec of actionSpecs) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "cm-live-table-toolbar-btn"
    btn.setAttribute("aria-label", spec.ariaLabel)
    btn.setAttribute("title", spec.ariaLabel)
    btn.setAttribute("data-group", spec.group)
    if (spec.groupStart) btn.setAttribute("data-group-start", "true")
    if (spec.testId) btn.setAttribute("data-testid", spec.testId)
    if (spec.ariaPressed !== undefined) btn.setAttribute("aria-pressed", String(spec.ariaPressed))
    btn.textContent = spec.label
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    btn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (spec.onSelect) spec.onSelect(btn)
      else if (spec.action) executeGridAction(spec.action)
    })
    if (spec.isDisabled) toolbarButtons.push({ button: btn, isDisabled: spec.isDisabled })
    toolbar.appendChild(btn)
  }

  return { toolbar, toolbarButtons, canAddRow, canAddCol }
}

export const createInteractiveTableSurface = (params: {
  grid: MarkdownTableGrid
  visualOptions: TableVisualOptions
  canAddCol: () => boolean
  canAddRow: () => boolean
  onActivateCell: (row: number, col: number) => void
  onAddColumn: () => void
  onAddRow: () => void
  onSelectColumn?: (col: number) => void
  onSelectRow?: (row: number) => void
  onMoveColumnTo?: (fromCol: number, toCol: number) => void
  onMoveRowTo?: (fromRow: number, toRow: number) => void
}): {
  gridRow: HTMLDivElement
  addRowBtn: HTMLButtonElement
  cellElements: HTMLElement[][]
  colElements: HTMLElement[]
} => {
  const {
    grid,
    visualOptions,
    canAddCol,
    canAddRow,
    onActivateCell,
    onAddColumn,
    onAddRow,
    onSelectColumn,
    onSelectRow,
    onMoveColumnTo,
    onMoveRowTo,
  } = params
  const cellElements: HTMLElement[][] = []
  const gridRow = document.createElement("div")
  gridRow.className = "cm-live-table-grid-row"

  const table = document.createElement("table")
  table.className = "cm-live-table"
  const { colgroup, cols } = createTableColGroup(grid.headers.length, visualOptions.columnWidths)
  table.appendChild(colgroup)

  let draggedCol: number | null = null
  let draggedRow: number | null = null

  const bindInteractiveCell = (cellEl: HTMLElement, row: number, col: number, text: string) => {
    const align = grid.alignments[col] ?? "left"
    if (cellEl.style) cellEl.style.textAlign = align
    cellEl.setAttribute("data-align", align)
    cellEl.setAttribute("data-cell-row", String(row))
    cellEl.setAttribute("data-cell-col", String(col))
    appendInlineMarkdownNodes(cellEl, text)

    const handleActivate = (event: MouseEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest?.("a") ||
        target?.tagName === "INPUT" ||
        target?.closest?.(".cm-live-table-col-resizer") ||
        target?.closest?.(".cm-live-table-col-handle") ||
        target?.closest?.(".cm-live-table-row-handle")
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onActivateCell(row, col)
    }
    cellEl.addEventListener("mousedown", handleActivate)
    cellEl.addEventListener("click", handleActivate)
  }

  const attachColumnGripHandle = (th: HTMLElement, col: number) => {
    const colHandle = document.createElement("button")
    colHandle.type = "button"
    colHandle.className = "cm-live-table-col-handle"
    colHandle.setAttribute("data-testid", "cm-live-table-col-handle")
    colHandle.setAttribute("data-col-index", String(col))
    colHandle.setAttribute("aria-label", `${col + 1}열 선택 및 이동`)
    colHandle.setAttribute("draggable", "true")
    colHandle.textContent = "⋯"
    colHandle.addEventListener("mousedown", (event: MouseEvent) => event.stopPropagation())
    colHandle.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onSelectColumn?.(col)
    })
    colHandle.addEventListener("dragstart", (event: DragEvent) => {
      event.stopPropagation()
      draggedCol = col
      draggedRow = null
    })
    colHandle.addEventListener("dragend", () => {
      draggedCol = null
    })
    th.addEventListener("dragover", (event: DragEvent) => {
      if (draggedCol === null) return
      event.preventDefault()
      event.stopPropagation()
      th.classList.add("is-drop-target-col")
    })
    th.addEventListener("dragleave", () => th.classList.remove("is-drop-target-col"))
    th.addEventListener("drop", (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      th.classList.remove("is-drop-target-col")
      const fromCol = draggedCol
      draggedCol = null
      if (fromCol !== null && fromCol !== col) onMoveColumnTo?.(fromCol, col)
    })
    th.appendChild(colHandle)
  }

  const attachRowGripHandle = (cellEl: HTMLElement, tr: HTMLElement, row: number) => {
    const rowHandle = document.createElement("button")
    rowHandle.type = "button"
    rowHandle.className = "cm-live-table-row-handle"
    rowHandle.setAttribute("data-testid", "cm-live-table-row-handle")
    rowHandle.setAttribute("data-row-index", String(row))
    rowHandle.setAttribute("aria-label", row === 0 ? "제목 행 선택" : `${row}행 선택 및 이동`)
    rowHandle.setAttribute("draggable", row > 0 ? "true" : "false")
    rowHandle.textContent = "⋮⋮"
    rowHandle.addEventListener("mousedown", (event: MouseEvent) => event.stopPropagation())
    rowHandle.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onSelectRow?.(row)
    })
    if (row > 0) {
      rowHandle.addEventListener("dragstart", (event: DragEvent) => {
        event.stopPropagation()
        draggedRow = row
        draggedCol = null
      })
      rowHandle.addEventListener("dragend", () => {
        draggedRow = null
      })
      tr.addEventListener("dragover", (event: DragEvent) => {
        if (draggedRow === null) return
        event.preventDefault()
        event.stopPropagation()
        tr.classList.add("is-drop-target-row")
      })
      tr.addEventListener("dragleave", () => tr.classList.remove("is-drop-target-row"))
      tr.addEventListener("drop", (event: DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        tr.classList.remove("is-drop-target-row")
        const fromRow = draggedRow
        draggedRow = null
        if (fromRow !== null && fromRow !== row) onMoveRowTo?.(fromRow, row)
      })
    }
    cellEl.appendChild(rowHandle)
  }

  const thead = document.createElement("thead")
  const headTr = document.createElement("tr")
  const headCellEls: HTMLElement[] = []
  for (let col = 0; col < grid.headers.length; col += 1) {
    const th = document.createElement("th")
    bindInteractiveCell(th, 0, col, grid.headers[col] ?? "")
    attachColumnGripHandle(th, col)
    if (col === 0) attachRowGripHandle(th, headTr, 0)
    attachColumnResizeHandle(th, col, cols[col]!, visualOptions)
    headCellEls.push(th)
    headTr.appendChild(th)
  }
  cellElements.push(headCellEls)
  thead.appendChild(headTr)
  table.appendChild(thead)

  const tbody = document.createElement("tbody")
  for (let rowIdx = 0; rowIdx < grid.rows.length; rowIdx += 1) {
    const row = grid.rows[rowIdx]!
    const tr = document.createElement("tr")
    const rowCellEls: HTMLElement[] = []
    for (let col = 0; col < grid.headers.length; col += 1) {
      const td = document.createElement("td")
      bindInteractiveCell(td, rowIdx + 1, col, row[col] ?? "")
      if (col === 0) attachRowGripHandle(td, tr, rowIdx + 1)
      rowCellEls.push(td)
      tr.appendChild(td)
    }
    cellElements.push(rowCellEls)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)

  const createAddBarButton = (
    className: string,
    ariaLabel: string,
    testId: string,
    label: string,
    disabled: boolean,
    onSelect: () => void
  ) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = className
    btn.setAttribute("aria-label", ariaLabel)
    btn.setAttribute("data-testid", testId)
    btn.textContent = label
    btn.disabled = disabled
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    btn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      onSelect()
    })
    return btn
  }

  const addColBtn = createAddBarButton("cm-live-table-add-col", "표 오른쪽에 새 열 추가", "cm-live-table-add-col", "+", !canAddCol(), onAddColumn)
  gridRow.appendChild(table)
  gridRow.appendChild(addColBtn)
  const addRowBtn = createAddBarButton("cm-live-table-add-row", "표 아래에 새 행 추가", "cm-live-table-add-row", "+ 새 행", !canAddRow(), onAddRow)
  return { gridRow, addRowBtn, cellElements, colElements: cols }
}
