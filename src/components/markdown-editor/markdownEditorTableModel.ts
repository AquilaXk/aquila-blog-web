import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorTableAlignment = "left" | "center" | "right"

export type MarkdownEditorTableEdit =
  | { kind: "add-row" | "delete-row" | "add-column" | "delete-column" }
  | { kind: "set-alignment"; alignment: MarkdownEditorTableAlignment }

export type MarkdownEditorTableTabDirection = "next" | "previous"

export type MarkdownEditorTableSnippet = {
  snippet: string
  cursorOffset: number
}

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
const MAX_ROWS = 6
const MIN_CREATE_COLUMNS = 2
const MAX_COLUMNS = 6

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

const lineBounds = (value: string) => {
  const lines: Array<{ text: string; start: number; end: number }> = []
  let start = 0
  for (let index = 0; index <= value.length; index += 1) {
    if (index === value.length || value[index] === "\n") {
      lines.push({ text: value.slice(start, index), start, end: index })
      start = index + 1
    }
  }
  return lines
}

const isOffsetInsideFencedCode = (value: string, offset: number) => {
  let marker = ""
  let length = 0
  for (const line of lineBounds(value.slice(0, Math.max(0, Math.min(offset, value.length))))) {
    const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line.text)
    if (!match) continue
    const fence = match[2] ?? ""
    const info = match[3] ?? ""
    if (marker === "") {
      marker = fence[0] ?? ""
      length = fence.length
    } else if (fence[0] === marker && fence.length >= length && info.trim() === "") {
      marker = ""
      length = 0
    }
  }
  return marker !== ""
}

const isMetadataLine = (line: string) => /^\s*<!--\s*aq-table(?:\s|$)/i.test(line)

const findCellAtOffset = (row: TableRow, offset: number) =>
  row.cells.findIndex((cell) => offset >= cell.contextStart && offset <= cell.contextEnd)

const findActiveTable = (value: string, selectionStart: number, selectionEnd: number): ActiveTable | null => {
  if (selectionStart !== selectionEnd || isOffsetInsideFencedCode(value, selectionStart)) return null
  const lines = lineBounds(value)

  for (let headerIndex = 0; headerIndex + 2 < lines.length; headerIndex += 1) {
    const headerLine = lines[headerIndex]!
    const delimiterLine = lines[headerIndex + 1]!
    const headerCells = splitTableCells(headerLine.text, headerLine.start)
    const delimiterCells = splitTableCells(delimiterLine.text, delimiterLine.start)
    if (!headerCells || !delimiterCells || headerCells.length !== delimiterCells.length) continue
    if (headerIndex > 0 && isMetadataLine(lines[headerIndex - 1]!.text)) continue

    const alignments = delimiterCells.map((cell) => parseDelimiterAlignment(cell.value))
    if (alignments.some((alignment) => alignment === null)) continue

    const body: TableRow[] = []
    for (let index = headerIndex + 2; index < lines.length; index += 1) {
      const line = lines[index]!
      const cells = splitTableCells(line.text, line.start)
      if (!cells || cells.length !== headerCells.length) break
      body.push({ cells, start: line.start, end: line.end })
    }
    if (body.length === 0 || headerCells.length > MAX_COLUMNS || body.length + 1 > MAX_ROWS) continue

    const header: TableRow = { cells: headerCells, start: headerLine.start, end: headerLine.end }
    const rows = [header, ...body]
    const activeRow = rows.findIndex((row) => findCellAtOffset(row, selectionStart) !== -1)
    if (activeRow === -1) continue
    const activeColumn = findCellAtOffset(rows[activeRow]!, selectionStart)
    if (activeColumn === -1) continue

    return {
      header,
      alignments: alignments as MarkdownEditorTableAlignment[],
      body,
      rangeStart: header.start,
      rangeEnd: body[body.length - 1]!.end,
      activeRow,
      activeColumn,
    }
  }
  return null
}

const serializeRow = (cells: string[]) => `| ${cells.join(" | ")} |`

const serializeTable = (table: ActiveTable) => {
  const delimiter = table.alignments.map((alignment) => {
    if (alignment === "center") return ":---:"
    return alignment === "right" ? "---:" : "---"
  })
  return [
    serializeRow(table.header.cells.map((cell) => cell.value)),
    serializeRow(delimiter),
    ...table.body.map((row) => serializeRow(row.cells.map((cell) => cell.value))),
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

const planForTable = (table: ActiveTable, row: number, column: number): PlannedTextMutation => {
  const lines = serializeTable(table)
  const replacement = lines.join("\n")
  const cursorOffset = selectionOffset(lines, row === 0 ? 0 : row + 1, column)
  return {
    rangeStart: table.rangeStart,
    rangeEnd: table.rangeEnd,
    replacement,
    selectionStart: table.rangeStart + cursorOffset,
    selectionEnd: table.rangeStart + cursorOffset,
  }
}

export const createMarkdownEditorTable = (rows: number, columns: number): MarkdownEditorTableSnippet | null => {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < MIN_ROWS ||
    rows > MAX_ROWS ||
    columns < MIN_CREATE_COLUMNS ||
    columns > MAX_COLUMNS
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

  if (edit.kind === "add-row") {
    if (table.body.length + 2 > MAX_ROWS) return null
    const insertAt = Math.max(0, table.activeRow)
    table.body.splice(insertAt, 0, {
      cells: table.header.cells.map(() => ({
        value: "",
        contextStart: 0,
        contextEnd: 0,
        sourceStart: 0,
        sourceEnd: 0,
      })),
      start: 0,
      end: 0,
    })
    return planForTable(table, insertAt + 1, table.activeColumn)
  }

  if (edit.kind === "delete-row") {
    if (table.activeRow === 0 || table.body.length + 1 <= MIN_ROWS) return null
    const deleteAt = table.activeRow - 1
    table.body.splice(deleteAt, 1)
    return planForTable(table, Math.min(table.activeRow, table.body.length), table.activeColumn)
  }

  if (edit.kind === "add-column") {
    if (table.header.cells.length >= MAX_COLUMNS) return null
    const insertAt = table.activeColumn + 1
    const emptyCell = () => ({
      value: "",
      contextStart: 0,
      contextEnd: 0,
      sourceStart: 0,
      sourceEnd: 0,
    })
    table.header.cells.splice(insertAt, 0, emptyCell())
    table.alignments.splice(insertAt, 0, "left")
    for (const row of table.body) row.cells.splice(insertAt, 0, emptyCell())
    return planForTable(table, table.activeRow, insertAt)
  }

  if (edit.kind === "delete-column") {
    if (table.header.cells.length <= 1) return null
    table.header.cells.splice(table.activeColumn, 1)
    table.alignments.splice(table.activeColumn, 1)
    for (const row of table.body) row.cells.splice(table.activeColumn, 1)
    return planForTable(table, table.activeRow, Math.min(table.activeColumn, table.header.cells.length - 1))
  }

  if (edit.kind !== "set-alignment") return null
  table.alignments[table.activeColumn] = edit.alignment
  return planForTable(table, table.activeRow, table.activeColumn)
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
  const totalRows = table.body.length + 1
  const cell = table.activeRow * table.header.cells.length + table.activeColumn
  const target = direction === "next" ? cell + 1 : cell - 1
  if (target >= 0 && target < totalRows * table.header.cells.length) {
    return planForTable(table, Math.floor(target / table.header.cells.length), target % table.header.cells.length)
  }
  if (direction === "previous" || totalRows >= MAX_ROWS) return null
  table.body.push({
    cells: table.header.cells.map(() => ({
      value: "",
      contextStart: 0,
      contextEnd: 0,
      sourceStart: 0,
      sourceEnd: 0,
    })),
    start: 0,
    end: 0,
  })
  return planForTable(table, table.body.length, 0)
}
