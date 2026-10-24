import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorTableAlignment = "left" | "center" | "right"

export type MarkdownEditorTableEdit =
  | {
      kind:
        | "add-row"
        | "insert-row-above"
        | "move-row-up"
        | "move-row-down"
        | "duplicate-row"
        | "delete-row"
        | "add-column"
        | "insert-column-left"
        | "move-column-left"
        | "move-column-right"
        | "delete-column"
    }
  | { kind: "set-alignment"; alignment: MarkdownEditorTableAlignment }

export type MarkdownEditorTableTabDirection = "next" | "previous" | "prev"

export type MarkdownEditorTableSnippet = {
  snippet: string
  cursorOffset: number
}

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
  value: string
  contextStart: number
  contextEnd: number
  sourceStart: number
  sourceEnd: number
}

type TableRow = {
  cells: TableCell[]
  start: number
  end: number
}

type ActiveTable = {
  header: TableRow
  alignments: MarkdownEditorTableAlignment[]
  body: TableRow[]
  rangeStart: number
  rangeEnd: number
  activeRow: number
  activeColumn: number
}

const MIN_ROWS = 2
const MAX_CREATE_ROWS = 6
const MIN_CREATE_COLUMNS = 2
const MAX_CREATE_COLUMNS = 6
export const MAX_EDIT_ROWS = 200
export const MAX_EDIT_COLUMNS = 32

export type MarkdownEditorTableEditAvailability = {
  addRow: boolean
  deleteRow: boolean
  addColumn: boolean
  deleteColumn: boolean
  alignLeft: boolean
  alignCenter: boolean
  alignRight: boolean
}

const isEscapedPipe = (value: string, index: number) => {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

const splitTableCells = (line: string, lineStart: number): TableCell[] | null => {
  if (!line.startsWith("|") || !line.endsWith("|")) return null

  const segments: Array<{ value: string; start: number }> = []
  let segmentStart = 0
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "|" && !isEscapedPipe(line, index)) {
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

const collectLocalLineWindow = (
  value: string,
  offset: number,
  maxLinesEachWay: number
) => {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const cursorLineStart = clamped === 0 ? 0 : value.lastIndexOf("\n", clamped - 1) + 1
  const cursorNextBreak = value.indexOf("\n", clamped)
  const cursorLineEnd = cursorNextBreak === -1 ? value.length : cursorNextBreak
  const cursorLineText = value.slice(cursorLineStart, cursorLineEnd)

  if (!cursorLineText.startsWith("|") || !cursorLineText.endsWith("|")) {
    return []
  }

  const before: Array<{ text: string; start: number; end: number }> = []
  let scanStart = cursorLineStart
  for (let count = 0; count < maxLinesEachWay && scanStart > 0; count += 1) {
    const lineEnd = scanStart - 1
    const lineStart = lineEnd === 0 ? 0 : value.lastIndexOf("\n", lineEnd - 1) + 1
    const text = value.slice(lineStart, lineEnd)
    before.push({ text, start: lineStart, end: lineEnd })
    scanStart = lineStart
    if (!text.startsWith("|") && !isMetadataLine(text)) {
      break
    }
  }
  before.reverse()

  const after: Array<{ text: string; start: number; end: number }> = []
  let scanEnd = cursorLineEnd
  for (let count = 0; count < maxLinesEachWay && scanEnd < value.length; count += 1) {
    const lineStart = scanEnd + 1
    const nextBreak = value.indexOf("\n", lineStart)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const text = value.slice(lineStart, lineEnd)
    after.push({ text, start: lineStart, end: lineEnd })
    scanEnd = lineEnd
    if (!text.startsWith("|")) {
      break
    }
  }

  return [
    ...before,
    { text: cursorLineText, start: cursorLineStart, end: cursorLineEnd },
    ...after,
  ]
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
    if (!cells || cells.length !== expectedColumnCount) break
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
  if (alignments.some((alignment) => alignment === null)) return null

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

const serializeRow = (cells: string[]) => `| ${cells.join(" | ")} |`

const escapeGridCell = (value: string) =>
  value.replace(/\r?\n/g, " ").trim().replace(/(?<!\\)\|/g, "\\|")

const serializeGridLines = (grid: MarkdownTableGrid, escapePipes: boolean): string[] => {
  const delimiter = grid.alignments.map((alignment) => {
    if (alignment === "center") return ":---:"
    return alignment === "right" ? "---:" : "---"
  })
  const formatCell = escapePipes ? escapeGridCell : (cell: string) => cell
  return [
    serializeRow(grid.headers.map(formatCell)),
    serializeRow(delimiter),
    ...grid.rows.map((row) =>
      serializeRow(grid.headers.map((_, col) => formatCell(row[col] ?? "")))
    ),
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
    case "add-row": {
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      const insertAt = Math.max(0, activeRow)
      grid.rows.splice(insertAt, 0, Array.from({ length: colCount }, () => ""))
      return { nextRow: insertAt + 1, nextCol: activeCol }
    }
    case "insert-row-above": {
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      const insertAt = Math.max(0, activeRow - 1)
      grid.rows.splice(insertAt, 0, Array.from({ length: colCount }, () => ""))
      return { nextRow: insertAt + 1, nextCol: activeCol }
    }
    case "move-row-up": {
      if (activeRow < 2 || activeRow > grid.rows.length) return null
      const bodyIndex = activeRow - 1
      const previous = grid.rows[bodyIndex - 1]!
      grid.rows[bodyIndex - 1] = grid.rows[bodyIndex]!
      grid.rows[bodyIndex] = previous
      return { nextRow: activeRow - 1, nextCol: activeCol }
    }
    case "move-row-down": {
      if (activeRow < 1 || activeRow >= grid.rows.length) return null
      const bodyIndex = activeRow - 1
      const next = grid.rows[bodyIndex + 1]!
      grid.rows[bodyIndex + 1] = grid.rows[bodyIndex]!
      grid.rows[bodyIndex] = next
      return { nextRow: activeRow + 1, nextCol: activeCol }
    }
    case "duplicate-row": {
      if (grid.rows.length + 2 > MAX_EDIT_ROWS) return null
      const sourceCells = activeRow === 0 ? grid.headers : (grid.rows[activeRow - 1] ?? grid.headers)
      const insertAt = Math.max(0, activeRow)
      grid.rows.splice(insertAt, 0, [...sourceCells])
      return { nextRow: insertAt + 1, nextCol: activeCol }
    }
    case "delete-row": {
      if (activeRow === 0 || grid.rows.length + 1 <= MIN_ROWS) return null
      grid.rows.splice(activeRow - 1, 1)
      return { nextRow: Math.min(activeRow, grid.rows.length), nextCol: activeCol }
    }
    case "add-column":
    case "insert-column-left": {
      if (colCount >= MAX_EDIT_COLUMNS) return null
      const insertAt = action.kind === "add-column" ? activeCol + 1 : activeCol
      grid.headers.splice(insertAt, 0, "")
      grid.alignments.splice(insertAt, 0, "left")
      for (const row of grid.rows) row.splice(insertAt, 0, "")
      return { nextRow: activeRow, nextCol: insertAt }
    }
    case "move-column-left":
    case "move-column-right": {
      const targetCol = action.kind === "move-column-left" ? activeCol - 1 : activeCol + 1
      if (targetCol < 0 || targetCol >= colCount) return null
      const swap = <T>(items: T[]) => {
        const temp = items[targetCol]!
        items[targetCol] = items[activeCol]!
        items[activeCol] = temp
      }
      swap(grid.headers)
      swap(grid.alignments)
      for (const row of grid.rows) swap(row)
      return { nextRow: activeRow, nextCol: targetCol }
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
  }
}

export const createMarkdownEditorTable = (rows: number, columns: number): MarkdownEditorTableSnippet | null => {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < MIN_ROWS ||
    rows > MAX_CREATE_ROWS ||
    columns < MIN_CREATE_COLUMNS ||
    columns > MAX_CREATE_COLUMNS
  ) {
    return null
  }
  const emptyRow = `|${Array.from({ length: columns }, () => "  ").join("|")}|`
  const delimiter = `|${Array.from({ length: columns }, () => " --- ").join("|")}|`
  const snippet = ["", emptyRow, delimiter, ...Array.from({ length: rows - 1 }, () => emptyRow), ""].join("\n")
  return { snippet, cursorOffset: snippet.indexOf(emptyRow) + 2 }
}

export const planMarkdownEditorTableEdit = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  edit: MarkdownEditorTableEdit
): PlannedTextMutation | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  const grid = toActiveGrid(table)
  const outcome = mutateTableGrid(grid, table.activeRow, table.activeColumn, edit)
  if (!outcome) return null
  return planForGrid(table.rangeStart, table.rangeEnd, grid, outcome.nextRow, outcome.nextCol)
}

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

export const isMarkdownEditorTableSelection = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): boolean => findActiveTable(value, selectionStart, selectionEnd) !== null

export const planMarkdownEditorTableTab = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: MarkdownEditorTableTabDirection
): PlannedTextMutation | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  const grid = toActiveGrid(table)
  const normalizedDirection = direction === "next" ? "next" : "previous"
  const outcome = mutateTableGrid(grid, table.activeRow, table.activeColumn, {
    kind: "tab",
    direction: normalizedDirection,
  })
  if (!outcome) return null
  return planForGrid(table.rangeStart, table.rangeEnd, grid, outcome.nextRow, outcome.nextCol)
}

export const planMarkdownEditorTableCellNavigation = planMarkdownEditorTableTab

export const planMarkdownEditorTableEnter = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation | null => {
  const table = findActiveTable(value, selectionStart, selectionEnd)
  if (!table) return null
  const grid = toActiveGrid(table)
  const outcome = mutateTableGrid(grid, table.activeRow, table.activeColumn, { kind: "enter" })
  if (!outcome) return null
  return planForGrid(table.rangeStart, table.rangeEnd, grid, outcome.nextRow, outcome.nextCol)
}

const parseGridLineCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replaceAll("\\|", "|").trim())

export const parseMarkdownTableGrid = (markdown: string): MarkdownTableGrid | null => {
  const lines = markdown
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return null

  const headers = parseGridLineCells(lines[0]!)
  if (headers.length === 0) return null

  const secondLine = lines[1]
  const hasDelimiter = Boolean(secondLine && /^[\s|:-]+$/.test(secondLine) && secondLine.includes("-"))
  const rawDelimiterCells = hasDelimiter && secondLine ? parseGridLineCells(secondLine) : []
  const alignments: MarkdownEditorTableAlignment[] = headers.map((_, col) => {
    const token = (rawDelimiterCells[col] ?? "").trim()
    if (token.startsWith(":") && token.endsWith(":")) return "center"
    if (token.endsWith(":")) return "right"
    return "left"
  })

  const bodyStartIndex = hasDelimiter ? 2 : 1
  const rows: string[][] = []
  for (let index = bodyStartIndex; index < lines.length; index += 1) {
    const parsed = parseGridLineCells(lines[index]!)
    rows.push(Array.from({ length: headers.length }, (_, col) => parsed[col] ?? ""))
  }

  return { headers, alignments, rows }
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
  if (!grid || col < 0 || col >= grid.headers.length || row < 0 || row > grid.rows.length) {
    return null
  }
  if (row === 0) {
    grid.headers[col] = nextValue
  } else {
    grid.rows[row - 1]![col] = nextValue
  }
  return serializeMarkdownTableGrid(grid)
}

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
