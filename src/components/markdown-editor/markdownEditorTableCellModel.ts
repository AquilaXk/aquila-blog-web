import {
  countCodePointRun,
  isEscapedMarkdownAt,
  scanInlineCodeSpanEnd,
} from "../../libs/markdown/pandocMathScanner"
import type { MarkdownTableCellLayout } from "../../libs/markdown/tableMetadata"
import { getTableGridLayoutMeta } from "./markdownEditorTableMetadataModel"
import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  parseMarkdownTableGrid,
  serializeMarkdownTableGrid,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import {
  resolveDuplicateColInsertIndex,
  resolveDuplicateRowInsertTableIndex,
} from "./markdownEditorTableSpanModel"
import {
  applyPlannedTextMutationToValue,
  planReplaceSelection,
  planToggleWrapSelection,
} from "./markdownEditorTextMutation"

const MIN_TABLE_ROWS = 2

export type MarkdownTablePasteOutcome = {
  markdown: string
  nextRow: number
  nextCol: number
  pastedRows: number
  pastedCols: number
}

export type TableCellInlineFormatKind = "bold" | "italic" | "code" | "strikethrough" | "line-break"

export type TableCellInlineFormatOutcome = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type TableGridPrefixMeta = { firstLinePrefix: string; linePrefix: string }

const gridPrefixMeta = new WeakMap<MarkdownTableGrid, TableGridPrefixMeta>()

export const setTableGridPrefixMeta = (grid: MarkdownTableGrid, meta: TableGridPrefixMeta): void => {
  if (meta.firstLinePrefix || meta.linePrefix) {
    gridPrefixMeta.set(grid, meta)
  }
}

export const getTableGridPrefixMeta = (grid: MarkdownTableGrid): TableGridPrefixMeta =>
  gridPrefixMeta.get(grid) ?? { firstLinePrefix: "", linePrefix: "" }

export const extractTableLinePrefix = (line: string): { prefix: string; content: string } => {
  let index = 0
  while (index < line.length) {
    const code = line.codePointAt(index)
    if (code === 32 || code === 9 || code === 62) {
      index += 1
      continue
    }
    break
  }
  return { prefix: line.slice(0, index), content: line.slice(index) }
}

export const isInsideInlineCodeSpan = (value: string, index: number): boolean => {
  if (!value.includes("`")) return false
  let cursor = 0
  while (cursor < value.length && cursor <= index) {
    const run = countCodePointRun(value, cursor, 96)
    if (run === 0 || isEscapedMarkdownAt(value, cursor)) {
      cursor += Math.max(1, run)
      continue
    }
    const closeEnd = scanInlineCodeSpanEnd(value, cursor)
    if (closeEnd === -1) {
      cursor += run
      continue
    }
    if (index >= cursor + run && index < closeEnd - run) return true
    cursor = closeEnd
  }
  return false
}

const INLINE_FORMAT_DELIMITERS: Record<Exclude<TableCellInlineFormatKind, "line-break">, string> = {
  bold: "**",
  italic: "*",
  code: "`",
  strikethrough: "~~",
}

type ParsedCsvRow = { cells: string[]; valid: boolean; hasUnquotedCommaSpace: boolean }

const consumeQuotedStep = (
  source: string,
  index: number
): { char: string; nextIndex: number; stillQuoted: boolean } => {
  if (source[index] === '"' && source[index + 1] === '"') {
    return { char: '"', nextIndex: index + 1, stillQuoted: true }
  }
  if (source[index] === '"') {
    return { char: "", nextIndex: index, stillQuoted: false }
  }
  return { char: source[index]!, nextIndex: index, stillQuoted: true }
}

const parseCsvRow = (line: string): ParsedCsvRow => {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  let hasUnquotedCommaSpace = false
  let cursor = 0
  while (cursor < line.length) {
    const ch = line[cursor]!
    if (inQuotes) {
      const step = consumeQuotedStep(line, cursor)
      current += step.char
      inQuotes = step.stillQuoted
      cursor = step.nextIndex + 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      if (line[cursor + 1] === " ") hasUnquotedCommaSpace = true
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
    cursor += 1
  }
  cells.push(current)
  return { cells, valid: !inQuotes, hasUnquotedCommaSpace }
}

const consumeWhitespaceRun = (text: string, start: number): { end: number; hasNewline: boolean } => {
  let end = start
  let hasNewline = false
  while (end < text.length && /\s/.test(text[end]!)) {
    if (text[end] === "\n") hasNewline = true
    end += 1
  }
  return { end, hasNewline }
}

const normalizeTsvCell = (cell: string): string => {
  if (!cell.includes("\n")) return cell
  let out = ""
  let cursor = 0
  while (cursor < cell.length) {
    const ws = consumeWhitespaceRun(cell, cursor)
    if (ws.end > cursor) {
      out += ws.hasNewline ? " " : cell.slice(cursor, ws.end)
      cursor = ws.end
      continue
    }
    out += cell[cursor]!
    cursor += 1
  }
  return out
}

const parseTsvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false
  let cursor = 0
  while (cursor < text.length) {
    const ch = text[cursor]!
    if (inQuotes) {
      const step = consumeQuotedStep(text, cursor)
      currentCell += step.char
      inQuotes = step.stillQuoted
      cursor = step.nextIndex + 1
      continue
    }
    if (ch === '"' && currentCell.length === 0) {
      inQuotes = true
    } else if (ch === "\t") {
      currentRow.push(normalizeTsvCell(currentCell))
      currentCell = ""
    } else if (ch === "\n") {
      currentRow.push(normalizeTsvCell(currentCell))
      rows.push(currentRow)
      currentRow = []
      currentCell = ""
    } else {
      currentCell += ch
    }
    cursor += 1
  }
  currentRow.push(normalizeTsvCell(currentCell))
  rows.push(currentRow)
  return rows
}

const isProseSentenceLine = (line: string): boolean => {
  if (line.includes(", ")) return true
  const lastChar = line.trimEnd().at(-1)
  return lastChar === "." || lastChar === "!" || lastChar === "?"
}

const splitPastedTableRows = (trimmedText: string): string[][] => {
  if (trimmedText.includes("\t")) return parseTsvRows(trimmedText)
  const lines = trimmedText.split("\n")
  if (lines.length >= 2 && lines.every((line) => line.trim().length > 0 && line.includes(","))) {
    const parsedRows = lines.map(parseCsvRow)
    const expectedCols = parsedRows[0]?.cells.length ?? 0
    const isStructuredCsv =
      expectedCols >= 2 &&
      parsedRows.every((row) => row.valid && row.cells.length === expectedCols && !row.hasUnquotedCommaSpace)
    return isStructuredCsv ? parsedRows.map((row) => row.cells) : [[trimmedText]]
  }
  if (lines.some(isProseSentenceLine)) return [[trimmedText]]
  return lines.map((line) => [line])
}

const expandGridToFitPaste = (
  grid: MarkdownTableGrid,
  clampedStartRow: number,
  clampedStartCol: number,
  rowCount: number,
  maxCols: number
) => {
  while (grid.headers.length < clampedStartCol + maxCols && grid.headers.length < MAX_EDIT_COLUMNS) {
    grid.headers.push("")
    grid.alignments.push("left")
    for (const row of grid.rows) row.push("")
  }
  while (grid.rows.length < clampedStartRow + rowCount - 1 && grid.rows.length + 1 < MAX_EDIT_ROWS) {
    grid.rows.push(Array.from({ length: grid.headers.length }, () => ""))
  }
}

const writeMatrixRowIntoGrid = (
  grid: MarkdownTableGrid,
  sourceRow: string[],
  targetRow: number,
  clampedStartCol: number
): number => {
  let writtenCols = 0
  for (let c = 0; c < sourceRow.length; c += 1) {
    const targetCol = clampedStartCol + c
    if (targetCol >= grid.headers.length) break
    writtenCols = c + 1
    const cellVal = (sourceRow[c] ?? "").trim()
    if (targetRow === 0) grid.headers[targetCol] = cellVal
    else grid.rows[targetRow - 1]![targetCol] = cellVal
  }
  return writtenCols
}

const writeMatrixIntoGrid = (
  grid: MarkdownTableGrid,
  matrix: string[][],
  clampedStartRow: number,
  clampedStartCol: number
): { pastedRows: number; pastedCols: number; lastRow: number; lastCol: number } => {
  let pastedRows = 0
  let pastedCols = 0
  let lastRow = clampedStartRow
  let lastCol = clampedStartCol
  for (let r = 0; r < matrix.length; r += 1) {
    const targetRow = clampedStartRow + r
    if (targetRow > grid.rows.length) break
    pastedRows += 1
    lastRow = targetRow
    const writtenCols = writeMatrixRowIntoGrid(grid, matrix[r]!, targetRow, clampedStartCol)
    if (writtenCols > pastedCols) pastedCols = writtenCols
    const endCol = clampedStartCol + Math.max(0, writtenCols - 1)
    if (writtenCols > 0 && endCol > lastCol) lastCol = endCol
  }
  return { pastedRows, pastedCols, lastRow, lastCol }
}

export const applyMarkdownTableGridPaste = (
  markdown: string,
  startRow: number,
  startCol: number,
  rawText: string
): MarkdownTablePasteOutcome | null => {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!normalized.includes("\t") && !normalized.includes("\n")) return null
  const trimmedTrailing = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized
  const matrix = splitPastedTableRows(trimmedTrailing)
  const maxCols = Math.max(0, ...matrix.map((row) => row.length))
  if (matrix.length <= 1 && maxCols <= 1) return null
  const grid = parseMarkdownTableGrid(markdown)
  if (!grid || grid.headers.length === 0) return null
  const clampedStartRow = Math.max(0, Math.min(startRow, grid.rows.length))
  const clampedStartCol = Math.max(0, Math.min(startCol, grid.headers.length - 1))
  expandGridToFitPaste(grid, clampedStartRow, clampedStartCol, matrix.length, maxCols)
  const { pastedRows, pastedCols, lastRow, lastCol } = writeMatrixIntoGrid(
    grid,
    matrix,
    clampedStartRow,
    clampedStartCol
  )
  if (pastedRows === 0 || pastedCols === 0) return null
  return {
    markdown: serializeMarkdownTableGrid(grid),
    nextRow: lastRow,
    nextCol: lastCol,
    pastedRows,
    pastedCols,
  }
}

export const applyTableCellInlineFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  kind: TableCellInlineFormatKind
): TableCellInlineFormatOutcome => {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  if (kind === "line-break") {
    return applyPlannedTextMutationToValue(value, planReplaceSelection(start, end, "<br>"))
  }
  const delim = INLINE_FORMAT_DELIMITERS[kind]
  return applyPlannedTextMutationToValue(value, planToggleWrapSelection(value, start, end, delim, delim))
}

const mutateGridNavigation = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  action: Extract<MarkdownTableGridAction, { kind: "tab" | "enter" }>
): { nextRow: number; nextCol: number } | null => {
  const colCount = grid.headers.length
  if (action.kind === "tab") {
    const totalRows = grid.rows.length + 1
    const step = action.direction === "next" ? 1 : -1
    const target = activeRow * colCount + activeCol + step
    if (target >= 0 && target < totalRows * colCount) {
      return { nextRow: Math.floor(target / colCount), nextCol: target % colCount }
    }
    if (action.direction === "previous" || totalRows >= MAX_EDIT_ROWS) return null
    grid.rows.push(Array.from({ length: colCount }, () => ""))
    return { nextRow: grid.rows.length, nextCol: 0 }
  }
  if (activeRow < grid.rows.length) return { nextRow: activeRow + 1, nextCol: activeCol }
  if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
  grid.rows.push(Array.from({ length: colCount }, () => ""))
  return { nextRow: grid.rows.length, nextCol: activeCol }
}

const resolveMoveRowTarget = (action: MarkdownTableGridAction, activeRow: number): number => {
  if (action.kind === "move-row-to") return action.targetRow
  return action.kind === "move-row-up" ? activeRow - 1 : activeRow + 1
}

const resolveMoveColumnTarget = (action: MarkdownTableGridAction, activeCol: number): number => {
  if (action.kind === "move-column-to") return action.targetCol
  return action.kind === "move-column-left" ? activeCol - 1 : activeCol + 1
}

const mutateGridRowMove = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  targetRow: number
): { nextRow: number; nextCol: number } | null => {
  if (activeRow < 1 || activeRow > grid.rows.length || targetRow < 1 || targetRow > grid.rows.length || targetRow === activeRow) {
    return null
  }
  const [moved] = grid.rows.splice(activeRow - 1, 1)
  if (!moved) return null
  grid.rows.splice(targetRow - 1, 0, moved)
  return { nextRow: targetRow, nextCol: activeCol }
}

const mutateGridRowInsert = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  insertAbove: boolean
): { nextRow: number; nextCol: number } | null => {
  if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
  const insertAt = Math.max(0, insertAbove ? activeRow - 1 : activeRow)
  grid.rows.splice(insertAt, 0, Array.from({ length: grid.headers.length }, () => ""))
  return { nextRow: insertAt + 1, nextCol: activeCol }
}

const mutateGridRowDuplicate = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number
): { nextRow: number; nextCol: number } | null => {
  if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
  const sourceCells = activeRow === 0 ? grid.headers : (grid.rows[activeRow - 1] ?? grid.headers)
  const insertTableRow = resolveDuplicateRowInsertTableIndex(
    getTableGridLayoutMeta(grid),
    activeRow,
    grid.rows.length
  )
  const insertAt = Math.max(0, Math.min(grid.rows.length, insertTableRow - 1))
  grid.rows.splice(insertAt, 0, [...sourceCells])
  return { nextRow: insertAt + 1, nextCol: activeCol }
}

const carryDeletedRowMergedAnchorText = (grid: MarkdownTableGrid, deletedRow: number) => {
  const deletedBodyRow = grid.rows[deletedRow - 1]
  const survivingBodyRow = grid.rows[deletedRow]
  const rowCells = getTableGridLayoutMeta(grid)?.cells?.[deletedRow]
  if (!deletedBodyRow || !survivingBodyRow || !rowCells) return
  for (let c = 0; c < rowCells.length; c += 1) {
    const anchor = rowCells[c]
    const anchorText = deletedBodyRow[c] ?? ""
    if (anchor && !anchor.hidden && (anchor.rowspan ?? 1) > 1 && anchorText && !survivingBodyRow[c]) {
      survivingBodyRow[c] = anchorText
    }
  }
}

const mutateGridRowDelete = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number
): { nextRow: number; nextCol: number } | null => {
  if (activeRow === 0 || grid.rows.length + 1 <= MIN_TABLE_ROWS) return null
  carryDeletedRowMergedAnchorText(grid, activeRow)
  grid.rows.splice(activeRow - 1, 1)
  return { nextRow: Math.min(activeRow, grid.rows.length), nextCol: activeCol }
}

const mutateGridRowAction = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): { nextRow: number; nextCol: number } | null => {
  if (action.kind === "add-row" || action.kind === "insert-row-above") {
    return mutateGridRowInsert(grid, activeRow, activeCol, action.kind === "insert-row-above")
  }
  if (action.kind === "duplicate-row") return mutateGridRowDuplicate(grid, activeRow, activeCol)
  if (action.kind === "clear-row") {
    const target = activeRow === 0 ? grid.headers : grid.rows[activeRow - 1]
    if (!target) return null
    target.fill("")
    return { nextRow: activeRow, nextCol: activeCol }
  }
  if (action.kind === "delete-row") return mutateGridRowDelete(grid, activeRow, activeCol)
  return mutateGridRowMove(grid, activeRow, activeCol, resolveMoveRowTarget(action, activeRow))
}

const mutateGridColumnInsertOrDuplicate = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  isDuplicate: boolean,
  insertLeft: boolean
): { nextRow: number; nextCol: number } | null => {
  if (grid.headers.length >= MAX_EDIT_COLUMNS) return null
  const insertAt = isDuplicate
    ? resolveDuplicateColInsertIndex(getTableGridLayoutMeta(grid), activeCol, grid.headers.length)
    : insertLeft
      ? activeCol
      : activeCol + 1
  grid.headers.splice(insertAt, 0, isDuplicate ? (grid.headers[activeCol] ?? "") : "")
  grid.alignments.splice(insertAt, 0, isDuplicate ? (grid.alignments[activeCol] ?? "left") : "left")
  for (const row of grid.rows) row.splice(insertAt, 0, isDuplicate ? (row[activeCol] ?? "") : "")
  return { nextRow: activeRow, nextCol: insertAt }
}

const mutateGridColumnMove = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  targetCol: number
): { nextRow: number; nextCol: number } | null => {
  const colCount = grid.headers.length
  if (activeCol < 0 || activeCol >= colCount || targetCol < 0 || targetCol >= colCount || targetCol === activeCol) {
    return null
  }
  const move = <T>(items: T[]) => {
    const [item] = items.splice(activeCol, 1)
    if (item !== undefined) items.splice(targetCol, 0, item)
  }
  move(grid.headers)
  move(grid.alignments)
  for (const row of grid.rows) move(row)
  return { nextRow: activeRow, nextCol: targetCol }
}

const carryDeletedColMergedAnchorTextInRow = (
  cells: string[],
  layoutRow: ReadonlyArray<MarkdownTableCellLayout | null> | undefined,
  deletedCol: number
) => {
  const anchor = layoutRow?.[deletedCol]
  const anchorText = cells[deletedCol] ?? ""
  if (anchor && !anchor.hidden && (anchor.colspan ?? 1) > 1 && anchorText && !cells[deletedCol + 1]) {
    cells[deletedCol + 1] = anchorText
  }
}

const mutateGridColumnDelete = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number
): { nextRow: number; nextCol: number } | null => {
  if (grid.headers.length <= 1) return null
  if (activeCol + 1 < grid.headers.length) {
    const layoutCells = getTableGridLayoutMeta(grid)?.cells
    carryDeletedColMergedAnchorTextInRow(grid.headers, layoutCells?.[0], activeCol)
    for (let r = 0; r < grid.rows.length; r += 1) {
      carryDeletedColMergedAnchorTextInRow(grid.rows[r]!, layoutCells?.[r + 1], activeCol)
    }
  }
  grid.headers.splice(activeCol, 1)
  grid.alignments.splice(activeCol, 1)
  for (const row of grid.rows) row.splice(activeCol, 1)
  return { nextRow: activeRow, nextCol: Math.min(activeCol, grid.headers.length - 1) }
}

const mutateGridAddRowAndColumn = (grid: MarkdownTableGrid): { nextRow: number; nextCol: number } | null => {
  const colCount = grid.headers.length
  if (colCount >= MAX_EDIT_COLUMNS && grid.rows.length + 2 > MAX_EDIT_ROWS) return null
  if (colCount < MAX_EDIT_COLUMNS) {
    grid.headers.push("")
    grid.alignments.push("left")
    for (const row of grid.rows) row.push("")
  }
  if (grid.rows.length + 2 <= MAX_EDIT_ROWS) {
    grid.rows.push(Array.from({ length: grid.headers.length }, () => ""))
  }
  return { nextRow: grid.rows.length, nextCol: grid.headers.length - 1 }
}

const mutateGridColumnAction = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): { nextRow: number; nextCol: number } | null => {
  if (action.kind === "add-column" || action.kind === "insert-column-left" || action.kind === "duplicate-column") {
    return mutateGridColumnInsertOrDuplicate(
      grid,
      activeRow,
      activeCol,
      action.kind === "duplicate-column",
      action.kind === "insert-column-left"
    )
  }
  if (action.kind === "clear-column") {
    if (activeCol < 0 || activeCol >= grid.headers.length) return null
    grid.headers[activeCol] = ""
    for (const row of grid.rows) row[activeCol] = ""
    return { nextRow: activeRow, nextCol: activeCol }
  }
  if (action.kind === "delete-column") return mutateGridColumnDelete(grid, activeRow, activeCol)
  if (action.kind === "set-alignment") {
    grid.alignments[activeCol] = action.alignment
    return { nextRow: activeRow, nextCol: activeCol }
  }
  if (action.kind === "add-row-and-column") return mutateGridAddRowAndColumn(grid)
  return mutateGridColumnMove(grid, activeRow, activeCol, resolveMoveColumnTarget(action, activeCol))
}

const ROW_ACTION_KINDS = new Set<MarkdownTableGridAction["kind"]>([
  "add-row", "insert-row-above", "move-row-up", "move-row-down",
  "move-row-to", "duplicate-row", "clear-row", "delete-row",
])

export const mutateMarkdownTableGridCells = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): { nextRow: number; nextCol: number } | null => {
  if (grid.headers.length === 0) return null
  if (action.kind === "tab" || action.kind === "enter") {
    return mutateGridNavigation(grid, activeRow, activeCol, action)
  }
  if (ROW_ACTION_KINDS.has(action.kind)) {
    return mutateGridRowAction(grid, activeRow, activeCol, action)
  }
  return mutateGridColumnAction(grid, activeRow, activeCol, action)
}
