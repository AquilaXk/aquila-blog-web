import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export type TableVisualOptions = {
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
    headerColumn: false,
    fitPageWidth: false,
    columnWidths: Array.from({ length: columnCount }, () => 0),
  }
  tableVisualOptionsByOffset.set(tableFrom, created)
  return created
}

export const setBooleanDataAttribute = (el: HTMLElement, attr: string, enabled: boolean) => {
  if (enabled) {
    el.setAttribute(attr, "true")
  } else if (typeof el.removeAttribute === "function") {
    el.removeAttribute(attr)
  } else if (typeof el.toggleAttribute === "function") {
    el.toggleAttribute(attr, false)
  }
}

export const syncTableVisualWrapAttributes = (
  wrap: HTMLElement,
  visualOptions: TableVisualOptions
) => {
  setBooleanDataAttribute(wrap, "data-header-col", visualOptions.headerColumn)
  setBooleanDataAttribute(wrap, "data-full-width", visualOptions.fitPageWidth)
}

export const renderStaticTableElement = (grid: MarkdownTableGrid): HTMLTableElement => {
  const table = document.createElement("table")
  table.className = "cm-live-table"
  const thead = document.createElement("thead")
  const headRow = document.createElement("tr")
  for (let col = 0; col < grid.headers.length; col += 1) {
    const th = document.createElement("th")
    const align = grid.alignments[col] ?? "left"
    if (th.style) th.style.textAlign = align
    th.setAttribute("data-align", align)
    appendInlineMarkdownNodes(th, grid.headers[col] ?? "")
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)

  if (grid.rows.length > 0) {
    const tbody = document.createElement("tbody")
    for (let rowIdx = 0; rowIdx < grid.rows.length; rowIdx += 1) {
      const row = grid.rows[rowIdx]!
      const tr = document.createElement("tr")
      for (let col = 0; col < grid.headers.length; col += 1) {
        const td = document.createElement("td")
        const align = grid.alignments[col] ?? "left"
        if (td.style) td.style.textAlign = align
        td.setAttribute("data-align", align)
        appendInlineMarkdownNodes(td, row[col] ?? "")
        tr.appendChild(td)
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
    const width = columnWidths[col] ?? 0
    if (width > 0) {
      const rounded = Math.round(width)
      if (colEl.style) colEl.style.width = `${rounded}px`
      colEl.setAttribute("data-col-width", String(rounded))
    }
    colgroup.appendChild(colEl)
    cols.push(colEl)
  }
  return { colgroup, cols }
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

  resizer.addEventListener("mousedown", (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

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

    const handleMouseMove = (moveEvent: MouseEvent) => {
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

    const handleMouseUp = () => {
      if (rafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (hasMoved) applyWidth(latestClientX)
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
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

  const actionSpecs: Array<{
    label: string
    ariaLabel: string
    testId?: string
    ariaPressed?: boolean
    action?: MarkdownTableGridAction
    isDisabled?: (row: number, col: number) => boolean
    onSelect?: (button: HTMLButtonElement) => void
  }> = [
    { label: "위에 행 추가", ariaLabel: "표 위에 행 추가", action: { kind: "insert-row-above" }, isDisabled: () => !canAddRow() },
    { label: "아래에 행 추가", ariaLabel: "표 아래에 행 추가", action: { kind: "add-row" }, isDisabled: () => !canAddRow() },
    { label: "행 위로 이동", ariaLabel: "표 행 위로 이동", action: { kind: "move-row-up" }, isDisabled: (row) => row < 2 },
    { label: "행 아래로 이동", ariaLabel: "표 행 아래로 이동", action: { kind: "move-row-down" }, isDisabled: (row) => row < 1 || row >= grid.rows.length },
    { label: "행 복제", ariaLabel: "표 행 복제", action: { kind: "duplicate-row" }, isDisabled: () => !canAddRow() },
    { label: "행 삭제", ariaLabel: "표 행 삭제", action: { kind: "delete-row" }, isDisabled: (row) => row === 0 || grid.rows.length <= 1 },
    { label: "왼쪽에 열 추가", ariaLabel: "표 왼쪽에 열 추가", action: { kind: "insert-column-left" }, isDisabled: () => !canAddCol() },
    { label: "오른쪽에 열 추가", ariaLabel: "표 오른쪽에 열 추가", action: { kind: "add-column" }, isDisabled: () => !canAddCol() },
    { label: "열 왼쪽으로 이동", ariaLabel: "표 열 왼쪽으로 이동", action: { kind: "move-column-left" }, isDisabled: (_row, col) => col < 1 },
    { label: "열 오른쪽으로 이동", ariaLabel: "표 열 오른쪽으로 이동", action: { kind: "move-column-right" }, isDisabled: (_row, col) => col >= grid.headers.length - 1 },
    { label: "열 삭제", ariaLabel: "표 열 삭제", action: { kind: "delete-column" }, isDisabled: () => grid.headers.length <= 1 },
    { label: "왼쪽 정렬", ariaLabel: "표 열 왼쪽 정렬", action: { kind: "set-alignment", alignment: "left" } },
    { label: "가운데 정렬", ariaLabel: "표 열 가운데 정렬", action: { kind: "set-alignment", alignment: "center" } },
    { label: "오른쪽 정렬", ariaLabel: "표 열 오른쪽 정렬", action: { kind: "set-alignment", alignment: "right" } },
    {
      label: "제목 열",
      ariaLabel: "표 제목 열 강조 전환",
      testId: "cm-live-table-toggle-header-col",
      ariaPressed: visualOptions.headerColumn,
      onSelect: (btn) => {
        visualOptions.headerColumn = !visualOptions.headerColumn
        syncTableVisualWrapAttributes(wrap, visualOptions)
        btn.setAttribute("aria-pressed", String(visualOptions.headerColumn))
      },
    },
    {
      label: "너비 맞춤",
      ariaLabel: "표 페이지 너비 맞춤 전환",
      testId: "cm-live-table-toggle-full-width",
      ariaPressed: visualOptions.fitPageWidth,
      onSelect: (btn) => {
        visualOptions.fitPageWidth = !visualOptions.fitPageWidth
        syncTableVisualWrapAttributes(wrap, visualOptions)
        btn.setAttribute("aria-pressed", String(visualOptions.fitPageWidth))
      },
    },
    { label: "원본 편집", ariaLabel: "표 마크다운 원본 편집", onSelect: () => onEditSource() },
  ]

  for (const spec of actionSpecs) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "cm-live-table-toolbar-btn"
    btn.setAttribute("aria-label", spec.ariaLabel)
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
}): {
  gridRow: HTMLDivElement
  addRowBtn: HTMLButtonElement
  cellElements: HTMLElement[][]
} => {
  const { grid, visualOptions, canAddCol, canAddRow, onActivateCell, onAddColumn, onAddRow } = params
  const cellElements: HTMLElement[][] = []
  const gridRow = document.createElement("div")
  gridRow.className = "cm-live-table-grid-row"

  const table = document.createElement("table")
  table.className = "cm-live-table"
  const { colgroup, cols } = createTableColGroup(grid.headers.length, visualOptions.columnWidths)
  table.appendChild(colgroup)

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
        target?.closest?.(".cm-live-table-col-resizer")
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

  const thead = document.createElement("thead")
  const headTr = document.createElement("tr")
  const headCellEls: HTMLElement[] = []
  for (let col = 0; col < grid.headers.length; col += 1) {
    const th = document.createElement("th")
    bindInteractiveCell(th, 0, col, grid.headers[col] ?? "")
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
      rowCellEls.push(td)
      tr.appendChild(td)
    }
    cellElements.push(rowCellEls)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)

  const addColBtn = document.createElement("button")
  addColBtn.type = "button"
  addColBtn.className = "cm-live-table-add-col"
  addColBtn.setAttribute("aria-label", "표 오른쪽에 새 열 추가")
  addColBtn.setAttribute("data-testid", "cm-live-table-add-col")
  addColBtn.textContent = "+"
  addColBtn.disabled = !canAddCol()
  addColBtn.addEventListener("mousedown", (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  addColBtn.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    onAddColumn()
  })

  gridRow.appendChild(table)
  gridRow.appendChild(addColBtn)

  const addRowBtn = document.createElement("button")
  addRowBtn.type = "button"
  addRowBtn.className = "cm-live-table-add-row"
  addRowBtn.setAttribute("aria-label", "표 아래에 새 행 추가")
  addRowBtn.setAttribute("data-testid", "cm-live-table-add-row")
  addRowBtn.textContent = "+ 새 행"
  addRowBtn.disabled = !canAddRow()
  addRowBtn.addEventListener("mousedown", (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  addRowBtn.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    onAddRow()
  })

  return { gridRow, addRowBtn, cellElements }
}
