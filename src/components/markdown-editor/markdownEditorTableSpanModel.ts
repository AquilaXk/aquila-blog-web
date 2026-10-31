import type {
  MarkdownTableCellLayout,
  MarkdownTableLayout,
} from "../../libs/markdown/tableMetadata"
import type { MarkdownTableGridAction } from "./markdownEditorTableModel"

const spliceSparseArray = <T>(
  items: Array<T | null> | undefined,
  index: number,
  deleteCount: number,
  insertValue?: T | null,
  hasInsert = false
) => {
  if (!items) {
    return
  }
  if (hasInsert) {
    while (items.length < index) {
      items.push(null)
    }
    items.splice(index, deleteCount, insertValue ?? null)
  } else if (index < items.length) {
    items.splice(index, deleteCount)
  }
}

const moveSparseItem = <T>(
  items: Array<T | null> | undefined,
  fromIndex: number,
  toIndex: number
) => {
  if (!items || fromIndex === toIndex) {
    return
  }
  const maxIndex = Math.max(fromIndex, toIndex)
  while (items.length <= maxIndex) {
    items.push(null)
  }
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved ?? null)
}

const compactCellLayoutEntry = (
  cell: MarkdownTableCellLayout | null | undefined
): MarkdownTableCellLayout | null => {
  if (!cell) {
    return null
  }
  const next: MarkdownTableCellLayout = {}
  if (cell.align) next.align = cell.align
  if (cell.backgroundColor) next.backgroundColor = cell.backgroundColor
  if (cell.header !== undefined) next.header = cell.header
  if (cell.colspan && cell.colspan > 1) next.colspan = cell.colspan
  if (cell.rowspan && cell.rowspan > 1) next.rowspan = cell.rowspan
  if (cell.hidden === true) next.hidden = true
  return Object.keys(next).length > 0 ? next : null
}

const markCoveredRectangle = (
  covered: Uint8Array,
  totalCols: number,
  anchorRow: number,
  anchorCol: number,
  rowspan: number,
  colspan: number
) => {
  for (let r = anchorRow; r < anchorRow + rowspan; r += 1) {
    for (let c = anchorCol; c < anchorCol + colspan; c += 1) {
      if (r !== anchorRow || c !== anchorCol) {
        covered[r * totalCols + c] = 1
      }
    }
  }
}

const reconcileAnchorOrCoveredCell = (
  existing: MarkdownTableCellLayout | null | undefined,
  isCovered: boolean,
  maxRowSpan: number,
  maxColSpan: number
): { cell: MarkdownTableCellLayout | null; rowspan: number; colspan: number } => {
  if (isCovered) {
    const next = compactCellLayoutEntry({
      ...existing,
      rowspan: undefined,
      colspan: undefined,
      hidden: true,
    })
    return { cell: next, rowspan: 1, colspan: 1 }
  }
  if (!existing) {
    return { cell: null, rowspan: 1, colspan: 1 }
  }
  const rowspan = Math.max(1, Math.min(existing.rowspan ?? 1, maxRowSpan))
  const colspan = Math.max(1, Math.min(existing.colspan ?? 1, maxColSpan))
  const next = compactCellLayoutEntry({
    ...existing,
    rowspan: rowspan > 1 ? rowspan : undefined,
    colspan: colspan > 1 ? colspan : undefined,
    hidden: undefined,
  })
  return { cell: next, rowspan, colspan }
}

export const reconcileCellSpans = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  totalRows: number,
  totalCols: number
): Array<Array<MarkdownTableCellLayout | null>> => {
  if (totalRows <= 0 || totalCols <= 0) {
    return []
  }
  const covered = new Uint8Array(totalRows * totalCols)
  const reconciled: Array<Array<MarkdownTableCellLayout | null>> = []
  for (let r = 0; r < totalRows; r += 1) {
    const sourceRow = cells[r]
    const nextRow: Array<MarkdownTableCellLayout | null> = []
    for (let c = 0; c < totalCols; c += 1) {
      const isCovered = covered[r * totalCols + c] === 1
      const outcome = reconcileAnchorOrCoveredCell(
        sourceRow?.[c],
        isCovered,
        totalRows - r,
        totalCols - c
      )
      if (!isCovered && (outcome.rowspan > 1 || outcome.colspan > 1)) {
        markCoveredRectangle(covered, totalCols, r, c, outcome.rowspan, outcome.colspan)
      }
      nextRow.push(outcome.cell)
    }
    reconciled.push(nextRow)
  }
  return reconciled
}

const stripClonedRowCellSpan = (
  cell: MarkdownTableCellLayout | null | undefined
): MarkdownTableCellLayout | null =>
  cell ? compactCellLayoutEntry({ ...cell, rowspan: undefined, hidden: undefined }) : null

const stripClonedColumnCellSpan = (
  cell: MarkdownTableCellLayout | null | undefined
): MarkdownTableCellLayout | null =>
  cell ? compactCellLayoutEntry({ ...cell, colspan: undefined, hidden: undefined }) : null

const isVerticalSpanAnchor = (
  cell: MarkdownTableCellLayout | null | undefined
): cell is MarkdownTableCellLayout & { rowspan: number } =>
  Boolean(cell && !cell.hidden && cell.rowspan && cell.rowspan > 1)

const isHorizontalSpanAnchor = (
  cell: MarkdownTableCellLayout | null | undefined
): cell is MarkdownTableCellLayout & { colspan: number } =>
  Boolean(cell && !cell.hidden && cell.colspan && cell.colspan > 1)

export const resolveDuplicateRowInsertTableIndex = (
  layout: MarkdownTableLayout | null | undefined,
  activeRow: number,
  maxBodyRows?: number
): number => {
  let spanEndRow = Math.max(0, activeRow)
  const cells = layout?.cells
  if (cells) {
    const maxScanRow = Math.min(activeRow, cells.length - 1)
    for (let r = 0; r <= maxScanRow; r += 1) {
      const rowCells = cells[r]
      if (!rowCells) continue
      for (const cell of rowCells) {
        if (isVerticalSpanAnchor(cell) && r + cell.rowspan - 1 >= activeRow) {
          spanEndRow = Math.max(spanEndRow, r + cell.rowspan - 1)
        }
      }
    }
  }
  if (maxBodyRows !== undefined) {
    spanEndRow = Math.min(spanEndRow, maxBodyRows)
  }
  return spanEndRow + 1
}

export const resolveDuplicateColInsertIndex = (
  layout: MarkdownTableLayout | null | undefined,
  activeCol: number,
  maxCols?: number
): number => {
  let spanEndCol = activeCol
  if (layout?.cells) {
    for (const rowCells of layout.cells) {
      if (!rowCells) continue
      const maxScanCol = Math.min(activeCol, rowCells.length - 1)
      for (let c = 0; c <= maxScanCol; c += 1) {
        const cell = rowCells[c]
        if (isHorizontalSpanAnchor(cell) && c + cell.colspan - 1 >= activeCol) {
          spanEndCol = Math.max(spanEndCol, c + cell.colspan - 1)
        }
      }
    }
  }
  if (maxCols !== undefined && maxCols > 0) {
    spanEndCol = Math.min(spanEndCol, maxCols - 1)
  }
  return spanEndCol + 1
}

const expandRowSpansCrossingInsertedRow = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  insertTableRow: number
): Set<number> => {
  const coveredCols = new Set<number>()
  const limit = Math.min(insertTableRow, cells.length)
  for (let r = 0; r < limit; r += 1) {
    const row = cells[r]
    if (!row) continue
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c]
      if (!isVerticalSpanAnchor(cell) || r + cell.rowspan <= insertTableRow) continue
      row[c] = compactCellLayoutEntry({ ...cell, rowspan: cell.rowspan + 1 })
      const spanWidth = Math.max(1, cell.colspan ?? 1)
      for (let col = c; col < c + spanWidth; col += 1) {
        coveredCols.add(col)
      }
    }
  }
  return coveredCols
}

const buildCoveredColumnsRow = (coveredCols: ReadonlySet<number>): Array<MarkdownTableCellLayout | null> => {
  if (coveredCols.size === 0) return []
  const maxCol = Math.max(...coveredCols)
  return Array.from({ length: maxCol + 1 }, (_, col) => (coveredCols.has(col) ? { hidden: true } : null))
}

const expandColSpansCrossingInsertedCol = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  insertCol: number
): Set<number> => {
  const coveredRows = new Set<number>()
  for (let r = 0; r < cells.length; r += 1) {
    const row = cells[r]
    if (!row) continue
    const limit = Math.min(insertCol, row.length)
    for (let c = 0; c < limit; c += 1) {
      const cell = row[c]
      if (!isHorizontalSpanAnchor(cell) || c + cell.colspan <= insertCol) continue
      row[c] = compactCellLayoutEntry({ ...cell, colspan: cell.colspan + 1 })
      const spanHeight = Math.max(1, cell.rowspan ?? 1)
      for (let targetRow = r; targetRow < r + spanHeight; targetRow += 1) {
        coveredRows.add(targetRow)
      }
    }
  }
  return coveredRows
}

const shrinkRowSpansCrossingDeletedRow = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  deletedRow: number
) => {
  const limit = Math.min(deletedRow, cells.length)
  for (let r = 0; r < limit; r += 1) {
    const row = cells[r]
    if (!row) continue
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c]
      if (isVerticalSpanAnchor(cell) && r + cell.rowspan > deletedRow) {
        const nextSpan = cell.rowspan - 1
        row[c] = compactCellLayoutEntry({
          ...cell,
          rowspan: nextSpan > 1 ? nextSpan : undefined,
        })
      }
    }
  }
}

const promoteDeletedRowAnchors = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  deletedRow: number
) => {
  const deletedCells = cells[deletedRow]
  if (!deletedCells) return
  for (let c = 0; c < deletedCells.length; c += 1) {
    const anchor = deletedCells[c]
    if (!isVerticalSpanAnchor(anchor)) continue
    const nextSpan = anchor.rowspan - 1
    const promoted = compactCellLayoutEntry({
      ...anchor,
      rowspan: nextSpan > 1 ? nextSpan : undefined,
      hidden: undefined,
    })
    if (!promoted && deletedRow + 1 >= cells.length) continue
    while (cells.length <= deletedRow + 1) {
      cells.push([])
    }
    const survivingRow = cells[deletedRow + 1]!
    while (survivingRow.length <= c) {
      survivingRow.push(null)
    }
    survivingRow[c] = promoted
  }
}

const shrinkColSpansCrossingDeletedCol = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  deletedCol: number
) => {
  for (const row of cells) {
    const limit = Math.min(deletedCol, row.length)
    for (let c = 0; c < limit; c += 1) {
      const cell = row[c]
      if (isHorizontalSpanAnchor(cell) && c + cell.colspan > deletedCol) {
        const nextSpan = cell.colspan - 1
        row[c] = compactCellLayoutEntry({
          ...cell,
          colspan: nextSpan > 1 ? nextSpan : undefined,
        })
      }
    }
  }
}

const promoteDeletedColAnchorInRow = (
  cellRow: Array<MarkdownTableCellLayout | null>,
  deletedCol: number
) => {
  const anchor = cellRow[deletedCol]
  if (!isHorizontalSpanAnchor(anchor)) return
  const nextSpan = anchor.colspan - 1
  const promoted = compactCellLayoutEntry({
    ...anchor,
    colspan: nextSpan > 1 ? nextSpan : undefined,
    hidden: undefined,
  })
  if (!promoted && deletedCol + 1 >= cellRow.length) return
  while (cellRow.length <= deletedCol + 1) {
    cellRow.push(null)
  }
  cellRow[deletedCol + 1] = promoted
}

const clearRowSpansIntersectingRange = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  minRow: number,
  maxRow: number
) => {
  for (let r = 0; r <= Math.min(maxRow, cells.length - 1); r += 1) {
    const row = cells[r]
    if (!row) continue
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c]
      if (cell?.rowspan && cell.rowspan > 1 && r + cell.rowspan - 1 >= minRow) {
        row[c] = compactCellLayoutEntry({ ...cell, rowspan: undefined })
      }
    }
  }
}

const clearColSpansIntersectingRange = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  minCol: number,
  maxCol: number
) => {
  for (const row of cells) {
    for (let c = 0; c <= Math.min(maxCol, row.length - 1); c += 1) {
      const cell = row[c]
      if (cell?.colspan && cell.colspan > 1 && c + cell.colspan - 1 >= minCol) {
        row[c] = compactCellLayoutEntry({ ...cell, colspan: undefined })
      }
    }
  }
}

export const resolveTargetMovedRow = (action: MarkdownTableGridAction, activeRow: number): number => {
  if (action.kind === "move-row-to") {
    return action.targetRow
  }
  return action.kind === "move-row-up" ? activeRow - 1 : activeRow + 1
}

export const resolveTargetMovedCol = (action: MarkdownTableGridAction, activeCol: number): number => {
  if (action.kind === "move-column-to") {
    return action.targetCol
  }
  return action.kind === "move-column-left" ? activeCol - 1 : activeCol + 1
}

export const applyRowInsertOrDuplicateLayout = (
  layout: MarkdownTableLayout,
  activeRow: number,
  isDuplicate: boolean,
  insertAbove: boolean
) => {
  const insertTableRow = isDuplicate
    ? resolveDuplicateRowInsertTableIndex(layout, activeRow)
    : Math.max(0, insertAbove ? activeRow - 1 : activeRow) + 1
  const heightValue = isDuplicate ? (layout.rowHeights?.[activeRow] ?? null) : null
  spliceSparseArray(layout.rowHeights, insertTableRow, 0, heightValue, true)
  if (!layout.cells) {
    return
  }
  const coveredCols = expandRowSpansCrossingInsertedRow(layout.cells, insertTableRow)
  if (isDuplicate) {
    while (layout.cells.length < insertTableRow) {
      layout.cells.push([])
    }
    const sourceRow = layout.cells[activeRow] ?? []
    const rowWidth = Math.max(sourceRow.length, coveredCols.size > 0 ? Math.max(...coveredCols) + 1 : 0)
    const clonedRow = Array.from({ length: rowWidth }, (_, col) =>
      coveredCols.has(col) ? { hidden: true } : stripClonedRowCellSpan(sourceRow[col])
    )
    layout.cells.splice(insertTableRow, 0, clonedRow)
    return
  }
  const insertedRow = buildCoveredColumnsRow(coveredCols)
  if (insertedRow.length > 0 || insertTableRow <= layout.cells.length) {
    while (layout.cells.length < insertTableRow) {
      layout.cells.push([])
    }
    layout.cells.splice(insertTableRow, 0, insertedRow)
  }
}

export const applyRowMoveLayout = (
  layout: MarkdownTableLayout,
  activeRow: number,
  targetRow: number,
  bodyRowCountBefore: number
) => {
  if (
    activeRow < 1 ||
    targetRow < 1 ||
    activeRow > bodyRowCountBefore ||
    targetRow > bodyRowCountBefore ||
    activeRow === targetRow
  ) {
    return
  }
  moveSparseItem(layout.rowHeights, activeRow, targetRow)
  if (!layout.cells) {
    return
  }
  clearRowSpansIntersectingRange(
    layout.cells,
    Math.min(activeRow, targetRow),
    Math.max(activeRow, targetRow)
  )
  const maxRow = Math.max(activeRow, targetRow)
  while (layout.cells.length <= maxRow) {
    layout.cells.push([])
  }
  const [movedCells] = layout.cells.splice(activeRow, 1)
  layout.cells.splice(targetRow, 0, movedCells ?? [])
}

export const applyRowDeleteLayout = (layout: MarkdownTableLayout, activeRow: number) => {
  if (activeRow < 1) {
    return
  }
  spliceSparseArray(layout.rowHeights, activeRow, 1)
  if (!layout.cells) {
    return
  }
  shrinkRowSpansCrossingDeletedRow(layout.cells, activeRow)
  promoteDeletedRowAnchors(layout.cells, activeRow)
  if (activeRow < layout.cells.length) {
    layout.cells.splice(activeRow, 1)
  }
}

export const applyColInsertOrDuplicateLayout = (
  layout: MarkdownTableLayout,
  activeCol: number,
  isDuplicate: boolean,
  insertLeft: boolean
) => {
  const insertAt = isDuplicate
    ? resolveDuplicateColInsertIndex(layout, activeCol)
    : insertLeft
      ? activeCol
      : activeCol + 1
  spliceSparseArray(
    layout.columnWidths,
    insertAt,
    0,
    isDuplicate ? (layout.columnWidths?.[activeCol] ?? null) : null,
    true
  )
  spliceSparseArray(
    layout.columnAlignments,
    insertAt,
    0,
    isDuplicate ? (layout.columnAlignments?.[activeCol] ?? null) : null,
    true
  )
  if (!layout.cells) {
    return
  }
  const coveredRows = expandColSpansCrossingInsertedCol(layout.cells, insertAt)
  for (let r = 0; r < layout.cells.length; r += 1) {
    const cellRow = layout.cells[r]!
    const insertedCell = coveredRows.has(r)
      ? { hidden: true }
      : isDuplicate
        ? stripClonedColumnCellSpan(cellRow[activeCol])
        : null
    spliceSparseArray(cellRow, insertAt, 0, insertedCell, true)
  }
}

export const applyColMoveLayout = (
  layout: MarkdownTableLayout,
  activeCol: number,
  targetCol: number,
  colCountBefore: number
) => {
  if (
    activeCol < 0 ||
    targetCol < 0 ||
    activeCol >= colCountBefore ||
    targetCol >= colCountBefore ||
    activeCol === targetCol
  ) {
    return
  }
  moveSparseItem(layout.columnWidths, activeCol, targetCol)
  moveSparseItem(layout.columnAlignments, activeCol, targetCol)
  if (!layout.cells) {
    return
  }
  clearColSpansIntersectingRange(
    layout.cells,
    Math.min(activeCol, targetCol),
    Math.max(activeCol, targetCol)
  )
  for (const cellRow of layout.cells) {
    moveSparseItem(cellRow, activeCol, targetCol)
  }
}

export const applyColDeleteLayout = (layout: MarkdownTableLayout, activeCol: number) => {
  spliceSparseArray(layout.columnWidths, activeCol, 1)
  spliceSparseArray(layout.columnAlignments, activeCol, 1)
  if (!layout.cells) {
    return
  }
  shrinkColSpansCrossingDeletedCol(layout.cells, activeCol)
  for (const cellRow of layout.cells) {
    promoteDeletedColAnchorInRow(cellRow, activeCol)
    spliceSparseArray(cellRow, activeCol, 1)
  }
}
