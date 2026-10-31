import type { MarkdownTableCellLayout, MarkdownTableLayout } from "../../libs/markdown/tableMetadata"
import type { MarkdownTableGridAction } from "./markdownEditorTableModel"

const toOptionalSpan = (span: number): number | undefined => (span > 1 ? span : undefined)

const spliceSparseArray = <T>(
  items: Array<T | null> | undefined, index: number, deleteCount: number, insertValue?: T | null, hasInsert = false
) => {
  if (!items) return
  if (hasInsert) {
    while (items.length < index) items.push(null)
    items.splice(index, deleteCount, insertValue ?? null)
  } else if (index < items.length) {
    items.splice(index, deleteCount)
  }
}

const moveSparseItem = <T>(items: Array<T | null> | undefined, fromIndex: number, toIndex: number) => {
  if (!items || fromIndex === toIndex) return
  const maxIndex = Math.max(fromIndex, toIndex)
  while (items.length <= maxIndex) items.push(null)
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved ?? null)
}

const compactCellLayoutEntry = (cell: MarkdownTableCellLayout | null | undefined): MarkdownTableCellLayout | null => {
  if (!cell) return null
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
  covered: Uint8Array, totalCols: number, anchorRow: number, anchorCol: number, rowspan: number, colspan: number
) => {
  for (let r = anchorRow; r < anchorRow + rowspan; r += 1) {
    for (let c = anchorCol; c < anchorCol + colspan; c += 1) {
      if (r !== anchorRow || c !== anchorCol) covered[r * totalCols + c] = 1
    }
  }
}

const reconcileAnchorOrCoveredCell = (
  existing: MarkdownTableCellLayout | null | undefined, isCovered: boolean, maxRowSpan: number, maxColSpan: number
): { cell: MarkdownTableCellLayout | null; rowspan: number; colspan: number } => {
  if (isCovered) {
    const cell = compactCellLayoutEntry({ ...existing, rowspan: undefined, colspan: undefined, hidden: true })
    return { cell, rowspan: 1, colspan: 1 }
  }
  if (!existing) return { cell: null, rowspan: 1, colspan: 1 }
  const rowspan = Math.max(1, Math.min(existing.rowspan ?? 1, maxRowSpan))
  const colspan = Math.max(1, Math.min(existing.colspan ?? 1, maxColSpan))
  const cell = compactCellLayoutEntry({
    ...existing, rowspan: toOptionalSpan(rowspan), colspan: toOptionalSpan(colspan), hidden: undefined,
  })
  return { cell, rowspan, colspan }
}

export const reconcileCellSpans = (
  cells: Array<Array<MarkdownTableCellLayout | null>>, totalRows: number, totalCols: number
): Array<Array<MarkdownTableCellLayout | null>> => {
  if (totalRows <= 0 || totalCols <= 0) return []
  const covered = new Uint8Array(totalRows * totalCols)
  const reconciled: Array<Array<MarkdownTableCellLayout | null>> = []
  for (let r = 0; r < totalRows; r += 1) {
    const sourceRow = cells[r]
    const nextRow: Array<MarkdownTableCellLayout | null> = []
    for (let c = 0; c < totalCols; c += 1) {
      const isCovered = covered[r * totalCols + c] === 1
      const outcome = reconcileAnchorOrCoveredCell(sourceRow?.[c], isCovered, totalRows - r, totalCols - c)
      if (!isCovered && (outcome.rowspan > 1 || outcome.colspan > 1)) {
        markCoveredRectangle(covered, totalCols, r, c, outcome.rowspan, outcome.colspan)
      }
      nextRow.push(outcome.cell)
    }
    reconciled.push(nextRow)
  }
  return reconciled
}

const stripClonedRowCellSpan = (cell: MarkdownTableCellLayout | null | undefined): MarkdownTableCellLayout | null =>
  cell ? compactCellLayoutEntry({ ...cell, rowspan: undefined, hidden: undefined }) : null

const stripClonedColumnCellSpan = (cell: MarkdownTableCellLayout | null | undefined): MarkdownTableCellLayout | null =>
  cell ? compactCellLayoutEntry({ ...cell, colspan: undefined, hidden: undefined }) : null

const isVerticalSpanAnchor = (
  cell: MarkdownTableCellLayout | null | undefined
): cell is MarkdownTableCellLayout & { rowspan: number } =>
  Boolean(cell && !cell.hidden && cell.rowspan && cell.rowspan > 1)

const isHorizontalSpanAnchor = (
  cell: MarkdownTableCellLayout | null | undefined
): cell is MarkdownTableCellLayout & { colspan: number } =>
  Boolean(cell && !cell.hidden && cell.colspan && cell.colspan > 1)

const findRowMaxVerticalSpanEnd = (
  rowCells: ReadonlyArray<MarkdownTableCellLayout | null>, rowIndex: number, activeRow: number
): number => {
  let endRow = activeRow
  for (const cell of rowCells) {
    if (isVerticalSpanAnchor(cell) && rowIndex + cell.rowspan - 1 >= activeRow) {
      endRow = Math.max(endRow, rowIndex + cell.rowspan - 1)
    }
  }
  return endRow
}

export const resolveDuplicateRowInsertTableIndex = (
  layout: MarkdownTableLayout | null | undefined, activeRow: number, maxBodyRows?: number
): number => {
  let spanEndRow = Math.max(0, activeRow)
  const cells = layout?.cells
  if (cells) {
    const maxScanRow = Math.min(activeRow, cells.length - 1)
    for (let r = 0; r <= maxScanRow; r += 1) {
      const rowCells = cells[r]
      if (rowCells) spanEndRow = Math.max(spanEndRow, findRowMaxVerticalSpanEnd(rowCells, r, activeRow))
    }
  }
  if (maxBodyRows !== undefined) spanEndRow = Math.min(spanEndRow, maxBodyRows)
  return spanEndRow + 1
}

const findRowSpanEndColCoveringActive = (
  rowCells: ReadonlyArray<MarkdownTableCellLayout | null>, activeCol: number, maxCols?: number
): number => {
  let endCol = activeCol
  const maxScanCol = Math.min(activeCol, rowCells.length - 1)
  for (let c = 0; c <= maxScanCol; c += 1) {
    const cell = rowCells[c]
    if (!isHorizontalSpanAnchor(cell)) continue
    const rawEnd = c + cell.colspan - 1
    const clampedEnd = maxCols !== undefined && maxCols > 0 ? Math.min(rawEnd, maxCols - 1) : rawEnd
    if (clampedEnd >= activeCol) endCol = Math.max(endCol, clampedEnd)
  }
  return endCol
}

export const resolveDuplicateColInsertIndex = (
  layout: MarkdownTableLayout | null | undefined, activeCol: number, maxCols?: number
): number => {
  let spanEndCol = activeCol
  for (const rowCells of layout?.cells ?? []) {
    if (rowCells) spanEndCol = Math.max(spanEndCol, findRowSpanEndColCoveringActive(rowCells, activeCol, maxCols))
  }
  if (maxCols !== undefined && maxCols > 0) spanEndCol = Math.min(spanEndCol, maxCols - 1)
  return spanEndCol + 1
}

const clampBoundedSpan = (span: number, maxBound: number | undefined): number =>
  maxBound === undefined ? span : Math.max(1, Math.min(span, maxBound))

const expandRowSpanInCellIfCrossing = (
  row: Array<MarkdownTableCellLayout | null>, r: number, c: number,
  insertTableRow: number, maxBodyRows: number | undefined, coveredCols: Set<number>
) => {
  const cell = row[c]
  if (!isVerticalSpanAnchor(cell)) return
  const effective = clampBoundedSpan(cell.rowspan, maxBodyRows === undefined ? undefined : maxBodyRows + 1 - r)
  if (r + effective <= insertTableRow) {
    if (effective !== cell.rowspan) row[c] = compactCellLayoutEntry({ ...cell, rowspan: toOptionalSpan(effective) })
    return
  }
  row[c] = compactCellLayoutEntry({ ...cell, rowspan: effective + 1 })
  const spanWidth = Math.max(1, cell.colspan ?? 1)
  for (let col = c; col < c + spanWidth; col += 1) coveredCols.add(col)
}

const expandRowSpansCrossingInsertedRow = (
  cells: Array<Array<MarkdownTableCellLayout | null>>, insertTableRow: number, maxBodyRows?: number
): Set<number> => {
  const coveredCols = new Set<number>()
  const limit = Math.min(insertTableRow, cells.length)
  for (let r = 0; r < limit; r += 1) {
    const row = cells[r]
    if (!row) continue
    for (let c = 0; c < row.length; c += 1) {
      expandRowSpanInCellIfCrossing(row, r, c, insertTableRow, maxBodyRows, coveredCols)
    }
  }
  return coveredCols
}

const buildCoveredColumnsRow = (coveredCols: ReadonlySet<number>): Array<MarkdownTableCellLayout | null> => {
  if (coveredCols.size === 0) return []
  const maxCol = Math.max(...coveredCols)
  return Array.from({ length: maxCol + 1 }, (_, col) => (coveredCols.has(col) ? { hidden: true } : null))
}

const expandColSpanInCellIfCrossing = (
  row: Array<MarkdownTableCellLayout | null>, r: number, c: number,
  insertCol: number, maxCols: number | undefined, coveredRows: Set<number>
) => {
  const cell = row[c]
  if (!isHorizontalSpanAnchor(cell)) return
  const effective = clampBoundedSpan(cell.colspan, maxCols === undefined ? undefined : maxCols - c)
  if (c + effective <= insertCol) {
    if (effective !== cell.colspan) row[c] = compactCellLayoutEntry({ ...cell, colspan: toOptionalSpan(effective) })
    return
  }
  row[c] = compactCellLayoutEntry({ ...cell, colspan: effective + 1 })
  const spanHeight = Math.max(1, cell.rowspan ?? 1)
  for (let targetRow = r; targetRow < r + spanHeight; targetRow += 1) coveredRows.add(targetRow)
}

const expandColSpansCrossingInsertedCol = (
  cells: Array<Array<MarkdownTableCellLayout | null>>, insertCol: number, maxCols?: number
): Set<number> => {
  const coveredRows = new Set<number>()
  for (let r = 0; r < cells.length; r += 1) {
    const row = cells[r]
    if (!row) continue
    const limit = Math.min(insertCol, row.length)
    for (let c = 0; c < limit; c += 1) {
      expandColSpanInCellIfCrossing(row, r, c, insertCol, maxCols, coveredRows)
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
        row[c] = compactCellLayoutEntry({ ...cell, rowspan: nextSpan > 1 ? nextSpan : undefined })
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
    while (cells.length <= deletedRow + 1) cells.push([])
    const survivingRow = cells[deletedRow + 1]!
    while (survivingRow.length <= c) survivingRow.push(null)
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
        row[c] = compactCellLayoutEntry({ ...cell, colspan: nextSpan > 1 ? nextSpan : undefined })
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
  while (cellRow.length <= deletedCol + 1) cellRow.push(null)
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
  if (action.kind === "move-row-to") return action.targetRow
  return action.kind === "move-row-up" ? activeRow - 1 : activeRow + 1
}

export const resolveTargetMovedCol = (action: MarkdownTableGridAction, activeCol: number): number => {
  if (action.kind === "move-column-to") return action.targetCol
  return action.kind === "move-column-left" ? activeCol - 1 : activeCol + 1
}

const resolveRowInsertTableIndex = (
  layout: MarkdownTableLayout,
  activeRow: number,
  isDuplicate: boolean,
  insertAbove: boolean,
  maxBodyRows?: number
): number => {
  if (isDuplicate) return resolveDuplicateRowInsertTableIndex(layout, activeRow, maxBodyRows)
  const baseRow = insertAbove ? activeRow - 1 : activeRow
  return Math.max(0, baseRow) + 1
}

export const applyRowInsertOrDuplicateLayout = (
  layout: MarkdownTableLayout,
  activeRow: number,
  isDuplicate: boolean,
  insertAbove: boolean,
  maxBodyRows?: number
) => {
  const insertTableRow = resolveRowInsertTableIndex(layout, activeRow, isDuplicate, insertAbove, maxBodyRows)
  const heightValue = isDuplicate ? (layout.rowHeights?.[activeRow] ?? null) : null
  spliceSparseArray(layout.rowHeights, insertTableRow, 0, heightValue, true)
  if (!layout.cells) return
  const coveredCols = expandRowSpansCrossingInsertedRow(layout.cells, insertTableRow, maxBodyRows)
  if (isDuplicate) {
    while (layout.cells.length < insertTableRow) layout.cells.push([])
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
    while (layout.cells.length < insertTableRow) layout.cells.push([])
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
  if (!layout.cells) return
  clearRowSpansIntersectingRange(layout.cells, Math.min(activeRow, targetRow), Math.max(activeRow, targetRow))
  const maxRow = Math.max(activeRow, targetRow)
  while (layout.cells.length <= maxRow) layout.cells.push([])
  const [movedCells] = layout.cells.splice(activeRow, 1)
  layout.cells.splice(targetRow, 0, movedCells ?? [])
}

export const applyRowDeleteLayout = (layout: MarkdownTableLayout, activeRow: number) => {
  if (activeRow < 1) return
  spliceSparseArray(layout.rowHeights, activeRow, 1)
  if (!layout.cells) return
  shrinkRowSpansCrossingDeletedRow(layout.cells, activeRow)
  promoteDeletedRowAnchors(layout.cells, activeRow)
  if (activeRow < layout.cells.length) layout.cells.splice(activeRow, 1)
}

const resolveColInsertIndex = (
  layout: MarkdownTableLayout,
  activeCol: number,
  isDuplicate: boolean,
  insertLeft: boolean,
  maxCols?: number
): number => {
  if (isDuplicate) return resolveDuplicateColInsertIndex(layout, activeCol, maxCols)
  return insertLeft ? activeCol : activeCol + 1
}

const resolveInsertedColumnCell = (
  sourceCell: MarkdownTableCellLayout | null | undefined,
  isCovered: boolean,
  isDuplicate: boolean
): MarkdownTableCellLayout | null => {
  if (isCovered) return { hidden: true }
  return isDuplicate ? stripClonedColumnCellSpan(sourceCell) : null
}

export const applyColInsertOrDuplicateLayout = (
  layout: MarkdownTableLayout,
  activeCol: number,
  isDuplicate: boolean,
  insertLeft: boolean,
  maxCols?: number
) => {
  const insertAt = resolveColInsertIndex(layout, activeCol, isDuplicate, insertLeft, maxCols)
  spliceSparseArray(layout.columnWidths, insertAt, 0, isDuplicate ? (layout.columnWidths?.[activeCol] ?? null) : null, true)
  spliceSparseArray(layout.columnAlignments, insertAt, 0, isDuplicate ? (layout.columnAlignments?.[activeCol] ?? null) : null, true)
  if (!layout.cells) return
  const coveredRows = expandColSpansCrossingInsertedCol(layout.cells, insertAt, maxCols)
  for (let r = 0; r < layout.cells.length; r += 1) {
    const cellRow = layout.cells[r]!
    const insertedCell = resolveInsertedColumnCell(cellRow[activeCol], coveredRows.has(r), isDuplicate)
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
  if (!layout.cells) return
  clearColSpansIntersectingRange(layout.cells, Math.min(activeCol, targetCol), Math.max(activeCol, targetCol))
  for (const cellRow of layout.cells) moveSparseItem(cellRow, activeCol, targetCol)
}

export const applyColDeleteLayout = (layout: MarkdownTableLayout, activeCol: number) => {
  spliceSparseArray(layout.columnWidths, activeCol, 1)
  spliceSparseArray(layout.columnAlignments, activeCol, 1)
  if (!layout.cells) return
  shrinkColSpansCrossingDeletedCol(layout.cells, activeCol)
  for (const cellRow of layout.cells) {
    promoteDeletedColAnchorInRow(cellRow, activeCol)
    spliceSparseArray(cellRow, activeCol, 1)
  }
}

const isSpanAnchorCoveringTarget = (
  cell: MarkdownTableCellLayout | null | undefined,
  r: number,
  c: number,
  targetRow: number,
  targetCol: number
): cell is MarkdownTableCellLayout => {
  if (!cell || cell.hidden || (r === targetRow && c === targetCol)) return false
  const rowspan = Math.max(1, cell.rowspan ?? 1)
  const colspan = Math.max(1, cell.colspan ?? 1)
  if (rowspan <= 1 && colspan <= 1) return false
  return targetRow >= r && targetRow < r + rowspan && targetCol >= c && targetCol < c + colspan
}

const clearHiddenInRectangle = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) => {
  const maxRow = Math.min(endRow, cells.length - 1)
  for (let r = startRow; r <= maxRow; r += 1) {
    const row = cells[r]
    if (!row) continue
    const maxCol = Math.min(endCol, row.length - 1)
    for (let c = startCol; c <= maxCol; c += 1) {
      if (row[c]?.hidden) row[c] = compactCellLayoutEntry({ ...row[c], hidden: undefined })
    }
  }
}

const unmergeAnchorsCoveringCell = (
  cells: Array<Array<MarkdownTableCellLayout | null>>,
  targetRow: number,
  targetCol: number
): boolean => {
  let unmerged = false
  const maxRow = Math.min(targetRow, cells.length - 1)
  for (let r = 0; r <= maxRow; r += 1) {
    const row = cells[r]
    if (!row) continue
    const maxCol = Math.min(targetCol, row.length - 1)
    for (let c = 0; c <= maxCol; c += 1) {
      const cell = row[c]
      if (!isSpanAnchorCoveringTarget(cell, r, c, targetRow, targetCol)) continue
      const rowspan = Math.max(1, cell.rowspan ?? 1)
      const colspan = Math.max(1, cell.colspan ?? 1)
      row[c] = compactCellLayoutEntry({ ...cell, rowspan: undefined, colspan: undefined, hidden: undefined })
      clearHiddenInRectangle(cells, r, r + rowspan - 1, c, c + colspan - 1)
      unmerged = true
    }
  }
  return unmerged
}

const pruneEmptyTableCells = (layout: MarkdownTableLayout) => {
  if (!layout.cells) return
  for (const row of layout.cells) {
    while (row.length > 0 && row.at(-1) === null) row.pop()
  }
  while (layout.cells.length > 0 && (layout.cells.at(-1)?.length ?? 0) === 0) layout.cells.pop()
  if (layout.cells.length === 0) layout.cells = undefined
}

export const unmergeCoveredCellAt = (
  layout: MarkdownTableLayout,
  targetRow: number,
  targetCol: number
): boolean => {
  const cells = layout.cells
  if (!cells || targetRow < 0 || targetCol < 0) return false
  const wasHidden = cells[targetRow]?.[targetCol]?.hidden === true
  const unmergedAnchor = unmergeAnchorsCoveringCell(cells, targetRow, targetCol)
  if (!wasHidden && !unmergedAnchor) return false
  if (cells[targetRow]?.[targetCol]?.hidden) {
    cells[targetRow]![targetCol] = compactCellLayoutEntry({
      ...cells[targetRow]![targetCol],
      rowspan: undefined,
      colspan: undefined,
      hidden: undefined,
    })
  }
  pruneEmptyTableCells(layout)
  return true
}
