import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import {
  extractTableLinePrefix,
  getTableGridPrefixMeta,
  isInsideInlineCodeSpan,
  mutateMarkdownTableGridCells,
  setTableGridPrefixMeta,
} from "./markdownEditorTableCellModel"
import {
  collectLocalTableLineWindow,
  getTableGridLayoutMeta,
  isAqTableCommentCandidateLine,
  parseLeadingTableLayoutLine,
  reconcileOverwrittenTableCells,
  serializeMarkdownTableLayoutCommentIfNonDefault,
  setTableGridLayoutMeta,
  syncTableLayoutOnGridAction,
  type ExtendedMarkdownTableLayout,
  type LocalTableLineSlice,
} from "./markdownEditorTableMetadataModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorTableAlignment = "left" | "center" | "right"

export type MarkdownEditorTableEdit =
  | {
      kind:
        | "add-row" | "insert-row-above" | "move-row-up" | "move-row-down"
        | "duplicate-row" | "clear-row" | "delete-row" | "add-column"
        | "insert-column-left" | "move-column-left" | "move-column-right"
        | "duplicate-column" | "clear-column" | "delete-column"
        | "add-row-and-column"
    }
  | { kind: "move-row-to"; targetRow: number }
  | { kind: "move-column-to"; targetCol: number }
  | { kind: "set-alignment"; alignment: MarkdownEditorTableAlignment }

export type MarkdownEditorTableTabDirection = "next" | "previous" | "prev"
export type MarkdownEditorTableSnippet = { snippet: string; cursorOffset: number }

export type MarkdownTableGrid = {
  headers: string[]
  alignments: MarkdownEditorTableAlignment[]
  rows: string[][]
}

export type MarkdownTableGridAction =
  | MarkdownEditorTableEdit
  | { kind: "tab"; direction: "next" | "previous" }
  | { kind: "enter" }

type TableCell = {
  value: string; contextStart: number; contextEnd: number; sourceStart: number; sourceEnd: number
}
type TableRow = { cells: TableCell[]; start: number; end: number }
type ActiveTable = {
  header: TableRow; alignments: MarkdownEditorTableAlignment[]; body: TableRow[]
  rangeStart: number; rangeEnd: number; activeRow: number; activeColumn: number
  layout: ExtendedMarkdownTableLayout | null
}

const MIN_ROWS = 2
const MAX_CREATE_ROWS = 6
const MIN_CREATE_COLUMNS = 2
const MAX_CREATE_COLUMNS = 6
export const MAX_EDIT_ROWS = 200
export const MAX_EDIT_COLUMNS = 32

export type MarkdownEditorTableEditAvailability = {
  addRow: boolean; deleteRow: boolean; addColumn: boolean; deleteColumn: boolean
  alignLeft: boolean; alignCenter: boolean; alignRight: boolean
}

const isEscapedPipe = (value: string, index: number) => {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) backslashes += 1
  return backslashes % 2 === 1
}

export const isProtectedPipe = (value: string, index: number): boolean => {
  if (isEscapedPipe(value, index) || isInsideInlineCodeSpan(value, index)) return true
  if (!value.includes("[[") && !value.includes("{{")) return false
  const before = value.slice(0, index)
  const after = value.slice(index + 1)
  return (
    (/\{\{\s*color\s*:\s*[^|{}]+$/i.test(before) && /^[^{}|]*\}\}/.test(after)) ||
    (/\[\[[^|\[\]]+$/.test(before) && /^[^\[\]|]*\]\]/.test(after))
  )
}

const splitTableCells = (line: string, lineStart: number): TableCell[] | null => {
  if (!line.startsWith("|") || !line.endsWith("|")) return null
  const segments: Array<{ value: string; start: number }> = []
  let segmentStart = 0
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "|" && !isProtectedPipe(line, index)) {
      segments.push({ value: line.slice(segmentStart, index), start: segmentStart })
      segmentStart = index + 1
    }
  }
  if (segmentStart !== line.length || segments.length <= 1) return null
  return segments.slice(1).map(({ value, start }) => {
    const leading = value.length - value.trimStart().length
    const trimmed = value.trim()
    const contentStart = trimmed === "" ? Math.min(1, value.length) : leading
    return {
      value: trimmed,
      contextStart: lineStart + start,
      contextEnd: lineStart + start + value.length,
      sourceStart: lineStart + start + contentStart,
      sourceEnd: lineStart + start + contentStart + trimmed.length,
    }
  })
}

const parseDelimiterAlignment = (value: string): MarkdownEditorTableAlignment | null => {
  if (!/^:?-{3,}:?$/.test(value)) return null
  if (value.startsWith(":")) return value.endsWith(":") ? "center" : "left"
  return value.endsWith(":") ? "right" : "left"
}

const findCellAtOffset = (row: TableRow, offset: number) =>
  row.cells.findIndex((cell) => offset >= cell.contextStart && offset <= cell.contextEnd)

let lastActiveTableCache: {
  value: string; selectionStart: number; selectionEnd: number; table: ActiveTable | null
} | null = null

const collectTableBodyRows = (lines: LocalTableLineSlice[], startIndex: number, expectedColumnCount: number): TableRow[] => {
  const body: TableRow[] = []
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!
    const cells = splitTableCells(line.text, line.start)
    if (cells?.length !== expectedColumnCount) break
    body.push({ cells, start: line.start, end: line.end })
  }
  return body
}

const resolveTableHeaderLeadingLayout = (
  lines: LocalTableLineSlice[],
  headerIndex: number,
  headerStart: number
): { rangeStart: number; layout: ExtendedMarkdownTableLayout | null } | null => {
  if (headerIndex <= 0) {
    return { rangeStart: headerStart, layout: null }
  }
  const prevLine = lines[headerIndex - 1]!
  const parsedComment = parseLeadingTableLayoutLine(prevLine.text)
  if (parsedComment.kind === "malformed") {
    return null
  }
  if (parsedComment.kind === "valid") {
    return { rangeStart: prevLine.start, layout: parsedComment.layout }
  }
  return { rangeStart: headerStart, layout: null }
}

const parseActiveTableAtHeader = (
  lines: LocalTableLineSlice[],
  headerIndex: number,
  selectionStart: number
): ActiveTable | null => {
  const headerLine = lines[headerIndex]!
  const delimiterLine = lines[headerIndex + 1]!
  const headerCells = splitTableCells(headerLine.text, headerLine.start)
  const delimiterCells = splitTableCells(delimiterLine.text, delimiterLine.start)
  if (!headerCells || !delimiterCells || headerCells.length !== delimiterCells.length) return null

  const leading = resolveTableHeaderLeadingLayout(lines, headerIndex, headerLine.start)
  if (!leading) return null

  const alignments = delimiterCells.map((cell) => parseDelimiterAlignment(cell.value))
  if (alignments.includes(null)) return null

  const body = collectTableBodyRows(lines, headerIndex + 2, headerCells.length)
  if (body.length === 0 || headerCells.length > MAX_EDIT_COLUMNS || body.length + 1 > MAX_EDIT_ROWS) return null

  const header: TableRow = { cells: headerCells, start: headerLine.start, end: headerLine.end }
  const rows = [header, ...body]
  const activeRow = rows.findIndex((row) => findCellAtOffset(row, selectionStart) !== -1)
  if (activeRow === -1) return null
  const activeColumn = findCellAtOffset(rows[activeRow]!, selectionStart)
  if (activeColumn === -1) return null

  return {
    header,
    alignments: alignments as MarkdownEditorTableAlignment[],
    body,
    rangeStart: leading.rangeStart,
    rangeEnd: body.at(-1)!.end,
    activeRow,
    activeColumn,
    layout: leading.layout,
  }
}

const findActiveTableUncached = (value: string, selectionStart: number, selectionEnd: number): ActiveTable | null => {
  if (selectionStart !== selectionEnd || !value.includes("|")) return null
  const lineStart = selectionStart > 0 ? value.lastIndexOf("\n", selectionStart - 1) + 1 : 0
  const nextBreak = value.indexOf("\n", selectionStart)
  if (!value.slice(lineStart, nextBreak === -1 ? value.length : nextBreak).includes("|")) return null
  const lines = collectLocalTableLineWindow(value, selectionStart, MAX_EDIT_ROWS + 3)
  if (lines.length < 3 || isOffsetInsideFencedCodeBlock(value, selectionStart)) return null

  for (let headerIndex = 0; headerIndex + 2 < lines.length; headerIndex += 1) {
    const candidate = parseActiveTableAtHeader(lines, headerIndex, selectionStart)
    if (candidate) return candidate
  }
  return null
}

const findActiveTable = (value: string, selectionStart: number, selectionEnd: number): ActiveTable | null => {
  if (
    lastActiveTableCache?.value === value &&
    lastActiveTableCache.selectionStart === selectionStart &&
    lastActiveTableCache.selectionEnd === selectionEnd
  ) {
    return lastActiveTableCache.table
  }
  const table = findActiveTableUncached(value, selectionStart, selectionEnd)
  lastActiveTableCache = { value, selectionStart, selectionEnd, table }
  return table
}

const serializeRow = (cells: string[], prefix = "") => `${prefix}| ${cells.join(" | ")} |`

const escapeGridCell = (value: string) => {
  const flat = value.replace(/\r?\n/g, " ").trim()
  return flat.replace(/\|/g, (m, idx) => (isEscapedPipe(flat, idx) ? m : "\\|"))
}

const formatDelimiterAlignment = (alignment: MarkdownEditorTableAlignment): string => {
  if (alignment === "center") return ":---:"
  return alignment === "right" ? "---:" : "---"
}

const serializeGridLines = (grid: MarkdownTableGrid, escapePipes: boolean): string[] => {
  const { firstLinePrefix, linePrefix } = getTableGridPrefixMeta(grid)
  const commentLine = serializeMarkdownTableLayoutCommentIfNonDefault(
    getTableGridLayoutMeta(grid),
    firstLinePrefix || linePrefix
  )
  const delimiter = grid.alignments.map(formatDelimiterAlignment)
  const formatCell = escapePipes ? escapeGridCell : (cell: string) => cell
  return [
    ...(commentLine ? [commentLine] : []),
    serializeRow(grid.headers.map(formatCell), commentLine ? linePrefix : firstLinePrefix),
    serializeRow(delimiter, linePrefix),
    ...grid.rows.map((row) => serializeRow(grid.headers.map((_, col) => formatCell(row[col] ?? "")), linePrefix)),
  ]
}

const selectionOffset = (lines: string[], row: number, column: number) => {
  let offset = 0
  for (let index = 0; index < row; index += 1) offset += lines[index]!.length + 1
  const cells = splitTableCells(lines[row]!, 0)
  const cell = cells?.[column]
  if (!cell) throw new Error("Serialized table cell is missing")
  return offset + cell.sourceStart
}

const toActiveGrid = (table: ActiveTable): MarkdownTableGrid => {
  const grid: MarkdownTableGrid = {
    headers: table.header.cells.map((cell) => cell.value),
    alignments: [...table.alignments],
    rows: table.body.map((row) => row.cells.map((cell) => cell.value)),
  }
  if (table.layout) setTableGridLayoutMeta(grid, table.layout)
  return grid
}

const planForGrid = (
  rangeStart: number,
  rangeEnd: number,
  grid: MarkdownTableGrid,
  row: number,
  column: number
): PlannedTextMutation => {
  const lines = serializeGridLines(grid, false)
  const commentOffset = lines[0] && isAqTableCommentCandidateLine(lines[0]) ? 1 : 0
  const replacement = lines.join("\n")
  const cursorOffset = selectionOffset(lines, (row === 0 ? 0 : row + 1) + commentOffset, column)
  return {
    rangeStart,
    rangeEnd,
    replacement,
    selectionStart: rangeStart + cursorOffset,
    selectionEnd: rangeStart + cursorOffset,
  }
}

const mutateTableGrid = (
  grid: MarkdownTableGrid,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): { nextRow: number; nextCol: number } | null => {
  const colCountBefore = grid.headers.length
  const bodyRowCountBefore = grid.rows.length
  const outcome = mutateMarkdownTableGridCells(grid, activeRow, activeCol, action)
  if (!outcome) return null
  syncTableLayoutOnGridAction(grid, colCountBefore, bodyRowCountBefore, activeRow, activeCol, action)
  return outcome
}

export const createMarkdownEditorTable = (rows: number, columns: number): MarkdownEditorTableSnippet | null => {
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < MIN_ROWS || rows > MAX_CREATE_ROWS || columns < MIN_CREATE_COLUMNS || columns > MAX_CREATE_COLUMNS) {
    return null
  }
  const emptyRow = `|${Array.from({ length: columns }, () => "  ").join("|")}|`
  const delimiter = `|${Array.from({ length: columns }, () => " --- ").join("|")}|`
  const snippet = ["", emptyRow, delimiter, ...Array.from({ length: rows - 1 }, () => emptyRow), ""].join("\n")
  return { snippet, cursorOffset: snippet.indexOf(emptyRow) + 2 }
}

const planActiveTableAction = (
  value: string, selectionStart: number, selectionEnd: number, action: MarkdownTableGridAction
): PlannedTextMutation | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  const grid = toActiveGrid(table)
  const outcome = mutateTableGrid(grid, table.activeRow, table.activeColumn, action)
  return outcome ? planForGrid(table.rangeStart, table.rangeEnd, grid, outcome.nextRow, outcome.nextCol) : null
}

export const planMarkdownEditorTableEdit = (
  value: string, selectionStart: number, selectionEnd: number, edit: MarkdownEditorTableEdit
): PlannedTextMutation | null => planActiveTableAction(value, selectionStart, selectionEnd, edit)

export const getMarkdownEditorTableEditAvailability = (
  value: string, selectionStart: number, selectionEnd: number
): MarkdownEditorTableEditAvailability | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  return {
    addRow: table.body.length + 2 <= MAX_EDIT_ROWS,
    deleteRow: table.activeRow > 0 && table.body.length + 1 > MIN_ROWS,
    addColumn: table.header.cells.length < MAX_EDIT_COLUMNS,
    deleteColumn: table.header.cells.length > 1,
    alignLeft: true,
    alignCenter: true,
    alignRight: true,
  }
}

export const packTableEditAvailabilityMask = (avail: MarkdownEditorTableEditAvailability | null): number => {
  if (!avail) return -1
  let mask = 0
  if (avail.addRow) mask |= 1
  if (avail.deleteRow) mask |= 2
  if (avail.addColumn) mask |= 4
  if (avail.deleteColumn) mask |= 8
  if (avail.alignLeft) mask |= 16
  if (avail.alignCenter) mask |= 32
  if (avail.alignRight) mask |= 64
  return mask
}

export const unpackTableEditAvailabilityMask = (mask: number): MarkdownEditorTableEditAvailability | null =>
  mask < 0 ? null : {
    addRow: (mask & 1) !== 0, deleteRow: (mask & 2) !== 0, addColumn: (mask & 4) !== 0,
    deleteColumn: (mask & 8) !== 0, alignLeft: (mask & 16) !== 0, alignCenter: (mask & 32) !== 0, alignRight: (mask & 64) !== 0,
  }

export const isMarkdownEditorTableSelection = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  findActiveTable(value, selectionStart, selectionEnd) !== null

export const resolveTableCellSelectionOffset = (value: string, tableFrom: number, row = 0, col = 0): number | null => {
  if (!Number.isFinite(tableFrom) || tableFrom < 0 || tableFrom >= value.length) return null
  let scanFrom = tableFrom
  const initialLineEnd = value.indexOf("\n", scanFrom)
  const firstLine = value.slice(scanFrom, initialLineEnd === -1 ? value.length : initialLineEnd)
  if (!firstLine.includes("|")) {
    if (initialLineEnd === -1 || parseLeadingTableLayoutLine(firstLine).kind !== "valid") return null
    scanFrom = initialLineEnd + 1
  }
  const firstPipe = value.indexOf("|", scanFrom)
  const lineEnd = value.indexOf("\n", scanFrom)
  if (firstPipe === -1 || (lineEnd !== -1 && firstPipe > lineEnd)) return null
  const table = findActiveTable(value, firstPipe + 1, firstPipe + 1)
  if (!table) return null
  const targetRow = row <= 0 ? table.header : (table.body[Math.max(0, Math.min(row - 1, table.body.length - 1))] ?? table.header)
  const targetCell = targetRow.cells[Math.max(0, Math.min(col, targetRow.cells.length - 1))]
  return targetCell ? targetCell.sourceStart : firstPipe + 1
}

export const planMarkdownEditorTableTab = (
  value: string, selectionStart: number, selectionEnd: number, direction: MarkdownEditorTableTabDirection
): PlannedTextMutation | null =>
  planActiveTableAction(value, selectionStart, selectionEnd, { kind: "tab", direction: direction === "next" ? "next" : "previous" })

export const planMarkdownEditorTableCellNavigation = planMarkdownEditorTableTab

export const planMarkdownEditorTableEnter = (value: string, selectionStart: number, selectionEnd: number): PlannedTextMutation | null =>
  planActiveTableAction(value, selectionStart, selectionEnd, { kind: "enter" })

const parseGridLineCells = (line: string): string[] => {
  const trimmed = extractTableLinePrefix(line).content.trim()
  const lead = trimmed.startsWith("|") ? "" : "|"
  const hasTrailingPipe = trimmed.endsWith("|") && !isEscapedPipe(trimmed, trimmed.length - 1)
  const normalized = `${lead}${trimmed}${hasTrailingPipe ? "" : "|"}`
  return (splitTableCells(normalized, 0) ?? []).map((cell) => cell.value.replaceAll("\\|", "|"))
}

const parseGridAlignments = (columnCount: number, secondLine: string | undefined): {
  hasDelimiter: boolean
  alignments: MarkdownEditorTableAlignment[]
} => {
  const hasDelimiter = Boolean(secondLine && /^[\s|:-]+$/.test(secondLine) && secondLine.includes("-"))
  const rawCells = hasDelimiter && secondLine ? parseGridLineCells(secondLine) : []
  const alignments: MarkdownEditorTableAlignment[] = Array.from({ length: columnCount }, (_, col) => {
    const token = (rawCells[col] ?? "").trim()
    if (token.startsWith(":") && token.endsWith(":")) return "center"
    return token.endsWith(":") ? "right" : "left"
  })
  return { hasDelimiter, alignments }
}

export const parseMarkdownTableGrid = (markdown: string): MarkdownTableGrid | null => {
  const nonEmptyLines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (nonEmptyLines.length === 0) return null

  let layout: ExtendedMarkdownTableLayout | null = null
  let lines = nonEmptyLines
  let commentPrefix = ""
  const parsedComment = parseLeadingTableLayoutLine(nonEmptyLines[0]!)
  if (parsedComment.kind === "malformed") return null
  if (parsedComment.kind === "valid") {
    layout = parsedComment.layout
    commentPrefix = extractTableLinePrefix(nonEmptyLines[0]!).prefix
    lines = nonEmptyLines.slice(1)
  }
  if (lines.length === 0) return null

  const firstPrefix = commentPrefix || extractTableLinePrefix(lines[0]!).prefix
  const secondParsed = lines[1] ? extractTableLinePrefix(lines[1]) : undefined
  const linePrefix = secondParsed?.prefix || extractTableLinePrefix(lines[0]!).prefix || firstPrefix

  const headers = parseGridLineCells(lines[0]!)
  if (headers.length === 0) return null

  const { hasDelimiter, alignments } = parseGridAlignments(headers.length, secondParsed?.content)
  const rows: string[][] = []
  for (let index = hasDelimiter ? 2 : 1; index < lines.length; index += 1) {
    const parsed = parseGridLineCells(lines[index]!)
    rows.push(Array.from({ length: headers.length }, (_, col) => parsed[col] ?? ""))
  }

  const grid: MarkdownTableGrid = { headers, alignments, rows }
  setTableGridPrefixMeta(grid, { firstLinePrefix: firstPrefix, linePrefix })
  if (layout) setTableGridLayoutMeta(grid, layout)
  return grid
}

export const serializeMarkdownTableGrid = (grid: MarkdownTableGrid): string =>
  serializeGridLines(grid, true).join("\n")

export const applyMarkdownTableGridCellEdit = (
  markdown: string, row: number, col: number, nextValue: string
): string | null => {
  const grid = parseMarkdownTableGrid(markdown)
  if (!grid || col < 0 || col >= grid.headers.length || row < 0 || row > grid.rows.length) return null
  if (row === 0) grid.headers[col] = nextValue
  else grid.rows[row - 1]![col] = nextValue
  if (nextValue.trim().length > 0) {
    reconcileOverwrittenTableCells(grid, [{ row, col }])
  }
  return serializeMarkdownTableGrid(grid)
}

export const updateMarkdownTableCell = applyMarkdownTableGridCellEdit

export const applyMarkdownTableGridAction = (
  markdown: string, row: number, col: number, action: MarkdownTableGridAction
): { markdown: string; nextRow: number; nextCol: number } | null => {
  const grid = parseMarkdownTableGrid(markdown)
  if (!grid || grid.headers.length === 0) return null
  const clampedRow = Math.max(0, Math.min(row, grid.rows.length))
  const clampedCol = Math.max(0, Math.min(col, grid.headers.length - 1))
  const outcome = mutateTableGrid(grid, clampedRow, clampedCol, action)
  if (!outcome) return null
  return {
    markdown: serializeMarkdownTableGrid(grid),
    nextRow: outcome.nextRow,
    nextCol: outcome.nextCol,
  }
}

export {
  applyMarkdownTableGridPaste, applyTableCellInlineFormat,
  type MarkdownTablePasteOutcome, type TableCellInlineFormatKind, type TableCellInlineFormatOutcome,
} from "./markdownEditorTableCellModel"
