import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import {
  extractTableLinePrefix, getTableGridPrefixMeta, isInsideInlineCodeSpan, setTableGridPrefixMeta,
} from "./markdownEditorTableCellModel"
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
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1
  }
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

  if (segmentStart !== line.length) return null
  const inner = segments.slice(1)
  if (inner.length === 0) return null
  return inner.map(({ value, start }) => {
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

const collectBackwardLines = (value: string, cursorLineStart: number, maxLinesEachWay: number) => {
  const before: Array<{ text: string; start: number; end: number }> = []
  let scanStart = cursorLineStart
  for (let count = 0; count < maxLinesEachWay && scanStart > 0; count += 1) {
    const lineEnd = scanStart - 1
    const lineStart = lineEnd === 0 ? 0 : value.lastIndexOf("\n", lineEnd - 1) + 1
    const text = value.slice(lineStart, lineEnd)
    before.push({ text, start: lineStart, end: lineEnd })
    scanStart = lineStart
    if (!text.startsWith("|") && !isMetadataLine(text)) break
  }
  return before.reverse()
}

const collectForwardLines = (value: string, cursorLineEnd: number, maxLinesEachWay: number) => {
  const after: Array<{ text: string; start: number; end: number }> = []
  let scanEnd = cursorLineEnd
  for (let count = 0; count < maxLinesEachWay && scanEnd < value.length; count += 1) {
    const lineStart = scanEnd + 1
    const nextBreak = value.indexOf("\n", lineStart)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const text = value.slice(lineStart, lineEnd)
    after.push({ text, start: lineStart, end: lineEnd })
    scanEnd = lineEnd
    if (!text.startsWith("|")) break
  }
  return after
}

const collectLocalLineWindow = (value: string, offset: number, maxLinesEachWay: number) => {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const cursorLineStart = clamped === 0 ? 0 : value.lastIndexOf("\n", clamped - 1) + 1
  const cursorNextBreak = value.indexOf("\n", clamped)
  const cursorLineEnd = cursorNextBreak === -1 ? value.length : cursorNextBreak
  const cursorLineText = value.slice(cursorLineStart, cursorLineEnd)
  if (!cursorLineText.startsWith("|") || !cursorLineText.endsWith("|")) return []

  const before = collectBackwardLines(value, cursorLineStart, maxLinesEachWay)
  const after = collectForwardLines(value, cursorLineEnd, maxLinesEachWay)
  return [...before, { text: cursorLineText, start: cursorLineStart, end: cursorLineEnd }, ...after]
}

const isOffsetInsideFencedCode = (value: string, offset: number) =>
  isOffsetInsideFencedCodeBlock(value, offset)

const isMetadataLine = (line: string) => /^\s*<!--\s*aq-table(?:\s|$)/i.test(line)

const findCellAtOffset = (row: TableRow, offset: number) =>
  row.cells.findIndex((cell) => offset >= cell.contextStart && offset <= cell.contextEnd)

let lastActiveTableCache: {
  value: string
  selectionStart: number
  selectionEnd: number
  table: ActiveTable | null
} | null = null

type LocalLineSlice = { text: string; start: number; end: number }

const collectTableBodyRows = (
  lines: LocalLineSlice[],
  startIndex: number,
  expectedColumnCount: number
): TableRow[] => {
  const body: TableRow[] = []
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!
    const cells = splitTableCells(line.text, line.start)
    if (cells?.length !== expectedColumnCount) break
    body.push({ cells, start: line.start, end: line.end })
  }
  return body
}

const parseActiveTableAtHeader = (
  lines: LocalLineSlice[],
  headerIndex: number,
  selectionStart: number
): ActiveTable | null => {
  const headerLine = lines[headerIndex]!
  const delimiterLine = lines[headerIndex + 1]!
  const headerCells = splitTableCells(headerLine.text, headerLine.start)
  const delimiterCells = splitTableCells(delimiterLine.text, delimiterLine.start)
  if (!headerCells || !delimiterCells || headerCells.length !== delimiterCells.length) return null
  if (headerIndex > 0 && isMetadataLine(lines[headerIndex - 1]!.text)) return null

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
    rangeStart: header.start,
    rangeEnd: body.at(-1)!.end,
    activeRow,
    activeColumn,
  }
}

const findActiveTableUncached = (value: string, selectionStart: number, selectionEnd: number): ActiveTable | null => {
  if (selectionStart !== selectionEnd || !value.includes("|")) return null
  const lineStart = selectionStart > 0 ? value.lastIndexOf("\n", selectionStart - 1) + 1 : 0
  const nextBreak = value.indexOf("\n", selectionStart)
  if (!value.slice(lineStart, nextBreak === -1 ? value.length : nextBreak).includes("|")) return null
  const lines = collectLocalLineWindow(value, selectionStart, MAX_EDIT_ROWS + 3)
  if (lines.length < 3 || isOffsetInsideFencedCode(value, selectionStart)) return null

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

const serializeGridLines = (grid: MarkdownTableGrid, escapePipes: boolean): string[] => {
  const { firstLinePrefix, linePrefix } = getTableGridPrefixMeta(grid)
  const delimiter = grid.alignments.map((a) => (a === "center" ? ":---:" : a === "right" ? "---:" : "---"))
  const formatCell = escapePipes ? escapeGridCell : (cell: string) => cell
  return [
    serializeRow(grid.headers.map(formatCell), firstLinePrefix),
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

const toActiveGrid = (table: ActiveTable): MarkdownTableGrid => ({
  headers: table.header.cells.map((cell) => cell.value),
  alignments: [...table.alignments],
  rows: table.body.map((row) => row.cells.map((cell) => cell.value)),
})

const planForGrid = (
  rangeStart: number,
  rangeEnd: number,
  grid: MarkdownTableGrid,
  row: number,
  column: number
): PlannedTextMutation => {
  const lines = serializeGridLines(grid, false)
  const replacement = lines.join("\n")
  const cursorOffset = selectionOffset(lines, row === 0 ? 0 : row + 1, column)
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
  const colCount = grid.headers.length
  if (colCount === 0) return null

  switch (action.kind) {
    case "tab": {
      const totalRows = grid.rows.length + 1
      const cellIndex = activeRow * colCount + activeCol
      const target = action.direction === "next" ? cellIndex + 1 : cellIndex - 1
      if (target >= 0 && target < totalRows * colCount) {
        return { nextRow: Math.floor(target / colCount), nextCol: target % colCount }
      }
      if (action.direction === "previous" || totalRows >= MAX_EDIT_ROWS) return null
      grid.rows.push(Array.from({ length: colCount }, () => ""))
      return { nextRow: grid.rows.length, nextCol: 0 }
    }
    case "enter": {
      if (activeRow < grid.rows.length) {
        return { nextRow: activeRow + 1, nextCol: activeCol }
      }
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      grid.rows.push(Array.from({ length: colCount }, () => ""))
      return { nextRow: grid.rows.length, nextCol: activeCol }
    }
    case "add-row":
    case "insert-row-above": {
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      const insertAt = Math.max(0, action.kind === "add-row" ? activeRow : activeRow - 1)
      grid.rows.splice(insertAt, 0, Array.from({ length: colCount }, () => ""))
      return { nextRow: insertAt + 1, nextCol: activeCol }
    }
    case "move-row-up":
    case "move-row-down":
    case "move-row-to": {
      const targetRow =
        action.kind === "move-row-to"
          ? action.targetRow
          : action.kind === "move-row-up"
            ? activeRow - 1
            : activeRow + 1
      if (activeRow < 1 || activeRow > grid.rows.length || targetRow < 1 || targetRow > grid.rows.length || targetRow === activeRow) {
        return null
      }
      const [moved] = grid.rows.splice(activeRow - 1, 1)
      if (!moved) return null
      grid.rows.splice(targetRow - 1, 0, moved)
      return { nextRow: targetRow, nextCol: activeCol }
    }
    case "duplicate-row": {
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      const sourceCells = activeRow === 0 ? grid.headers : (grid.rows[activeRow - 1] ?? grid.headers)
      const insertAt = Math.max(0, activeRow)
      grid.rows.splice(insertAt, 0, [...sourceCells])
      return { nextRow: insertAt + 1, nextCol: activeCol }
    }
    case "clear-row": {
      const target = activeRow === 0 ? grid.headers : grid.rows[activeRow - 1]
      if (!target) return null
      target.fill("")
      return { nextRow: activeRow, nextCol: activeCol }
    }
    case "delete-row": {
      if (activeRow === 0 || grid.rows.length + 1 <= MIN_ROWS) return null
      grid.rows.splice(activeRow - 1, 1)
      return { nextRow: Math.min(activeRow, grid.rows.length), nextCol: activeCol }
    }
    case "add-column":
    case "insert-column-left":
    case "duplicate-column": {
      if (colCount >= MAX_EDIT_COLUMNS) return null
      const insertAt = action.kind === "insert-column-left" ? activeCol : activeCol + 1
      const isDup = action.kind === "duplicate-column"
      grid.headers.splice(insertAt, 0, isDup ? (grid.headers[activeCol] ?? "") : "")
      grid.alignments.splice(insertAt, 0, isDup ? (grid.alignments[activeCol] ?? "left") : "left")
      for (const row of grid.rows) row.splice(insertAt, 0, isDup ? (row[activeCol] ?? "") : "")
      return { nextRow: activeRow, nextCol: insertAt }
    }
    case "move-column-left":
    case "move-column-right":
    case "move-column-to": {
      const targetCol =
        action.kind === "move-column-to"
          ? action.targetCol
          : action.kind === "move-column-left"
            ? activeCol - 1
            : activeCol + 1
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
    case "clear-column": {
      if (activeCol < 0 || activeCol >= colCount) return null
      grid.headers[activeCol] = ""
      for (const row of grid.rows) row[activeCol] = ""
      return { nextRow: activeRow, nextCol: activeCol }
    }
    case "delete-column": {
      if (colCount <= 1) return null
      grid.headers.splice(activeCol, 1)
      grid.alignments.splice(activeCol, 1)
      for (const row of grid.rows) row.splice(activeCol, 1)
      return { nextRow: activeRow, nextCol: Math.min(activeCol, grid.headers.length - 1) }
    }
    case "set-alignment": {
      grid.alignments[activeCol] = action.alignment
      return { nextRow: activeRow, nextCol: activeCol }
    }
    case "add-row-and-column": {
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
  }
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
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownTableGridAction
): PlannedTextMutation | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  const grid = toActiveGrid(table)
  const outcome = mutateTableGrid(grid, table.activeRow, table.activeColumn, action)
  return outcome ? planForGrid(table.rangeStart, table.rangeEnd, grid, outcome.nextRow, outcome.nextCol) : null
}

export const planMarkdownEditorTableEdit = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  edit: MarkdownEditorTableEdit
): PlannedTextMutation | null => planActiveTableAction(value, selectionStart, selectionEnd, edit)

export const getMarkdownEditorTableEditAvailability = (
  value: string,
  selectionStart: number,
  selectionEnd: number
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

export const packTableEditAvailabilityMask = (avail: MarkdownEditorTableEditAvailability | null): number =>
  !avail ? -1 : (avail.addRow ? 1 : 0) | (avail.deleteRow ? 2 : 0) | (avail.addColumn ? 4 : 0) | (avail.deleteColumn ? 8 : 0) | (avail.alignLeft ? 16 : 0) | (avail.alignCenter ? 32 : 0) | (avail.alignRight ? 64 : 0)

export const unpackTableEditAvailabilityMask = (mask: number): MarkdownEditorTableEditAvailability | null =>
  mask < 0 ? null : {
    addRow: (mask & 1) !== 0, deleteRow: (mask & 2) !== 0, addColumn: (mask & 4) !== 0,
    deleteColumn: (mask & 8) !== 0, alignLeft: (mask & 16) !== 0, alignCenter: (mask & 32) !== 0, alignRight: (mask & 64) !== 0,
  }

export const isMarkdownEditorTableSelection = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  findActiveTable(value, selectionStart, selectionEnd) !== null

export const planMarkdownEditorTableTab = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: MarkdownEditorTableTabDirection
): PlannedTextMutation | null =>
  planActiveTableAction(value, selectionStart, selectionEnd, { kind: "tab", direction: direction === "next" ? "next" : "previous" })

export const planMarkdownEditorTableCellNavigation = planMarkdownEditorTableTab

export const planMarkdownEditorTableEnter = (value: string, selectionStart: number, selectionEnd: number): PlannedTextMutation | null =>
  planActiveTableAction(value, selectionStart, selectionEnd, { kind: "enter" })

const parseGridLineCells = (line: string): string[] => {
  const trimmed = extractTableLinePrefix(line).content.trim()
  const normalized = `${trimmed.startsWith("|") ? "" : "|"}${trimmed}${trimmed.endsWith("|") && !isEscapedPipe(trimmed, trimmed.length - 1) ? "" : "|"}`
  return (splitTableCells(normalized, 0) ?? []).map((cell) => cell.value.replaceAll("\\|", "|"))
}

export const parseMarkdownTableGrid = (markdown: string): MarkdownTableGrid | null => {
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return null

  const firstPrefix = extractTableLinePrefix(lines[0]!).prefix
  const secondParsed = lines[1] ? extractTableLinePrefix(lines[1]) : undefined
  const linePrefix = secondParsed?.prefix || firstPrefix

  const headers = parseGridLineCells(lines[0]!)
  if (headers.length === 0) return null

  const secondLine = secondParsed?.content
  const hasDelimiter = Boolean(secondLine && /^[\s|:-]+$/.test(secondLine) && secondLine.includes("-"))
  const rawDelimiterCells = hasDelimiter && secondLine ? parseGridLineCells(secondLine) : []
  const alignments: MarkdownEditorTableAlignment[] = headers.map((_, col) => {
    const token = (rawDelimiterCells[col] ?? "").trim()
    if (token.startsWith(":") && token.endsWith(":")) return "center"
    return token.endsWith(":") ? "right" : "left"
  })

  const bodyStartIndex = hasDelimiter ? 2 : 1
  const rows: string[][] = []
  for (let index = bodyStartIndex; index < lines.length; index += 1) {
    const parsed = parseGridLineCells(lines[index]!)
    rows.push(Array.from({ length: headers.length }, (_, col) => parsed[col] ?? ""))
  }

  const grid: MarkdownTableGrid = { headers, alignments, rows }
  setTableGridPrefixMeta(grid, { firstLinePrefix: firstPrefix, linePrefix })
  return grid
}

export const serializeMarkdownTableGrid = (grid: MarkdownTableGrid): string =>
  serializeGridLines(grid, true).join("\n")

export const applyMarkdownTableGridCellEdit = (
  markdown: string,
  row: number,
  col: number,
  nextValue: string
): string | null => {
  const grid = parseMarkdownTableGrid(markdown)
  if (!grid || col < 0 || col >= grid.headers.length || row < 0 || row > grid.rows.length) return null
  if (row === 0) grid.headers[col] = nextValue
  else grid.rows[row - 1]![col] = nextValue
  return serializeMarkdownTableGrid(grid)
}

export const updateMarkdownTableCell = applyMarkdownTableGridCellEdit

export const applyMarkdownTableGridAction = (
  markdown: string,
  row: number,
  col: number,
  action: MarkdownTableGridAction
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
