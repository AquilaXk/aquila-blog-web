import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  parseMarkdownTableGrid,
  serializeMarkdownTableGrid,
  type MarkdownTableGrid,
} from "./markdownEditorTableModel"
import {
  applyPlannedTextMutationToValue,
  planReplaceSelection,
  planToggleWrapSelection,
} from "./markdownEditorTextMutation"

export type MarkdownTablePasteOutcome = {
  markdown: string
  nextRow: number
  nextCol: number
  pastedRows: number
  pastedCols: number
}

export type TableCellInlineFormatKind =
  | "bold"
  | "italic"
  | "code"
  | "strikethrough"
  | "line-break"

export type TableCellInlineFormatOutcome = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type TableGridPrefixMeta = {
  firstLinePrefix: string
  linePrefix: string
}

const gridPrefixMeta = new WeakMap<MarkdownTableGrid, TableGridPrefixMeta>()

export const setTableGridPrefixMeta = (grid: MarkdownTableGrid, meta: TableGridPrefixMeta): void => {
  if (meta.firstLinePrefix || meta.linePrefix) {
    gridPrefixMeta.set(grid, meta)
  }
}

export const getTableGridPrefixMeta = (grid: MarkdownTableGrid): TableGridPrefixMeta =>
  gridPrefixMeta.get(grid) ?? { firstLinePrefix: "", linePrefix: "" }

export const extractTableLinePrefix = (line: string): { prefix: string; content: string } => {
  const match = /^([ \t]*(?:>[ \t]*)*)(.*)$/.exec(line)
  if (!match) return { prefix: "", content: line }
  return { prefix: match[1] ?? "", content: match[2] ?? "" }
}

export const isInsideInlineCodeSpan = (value: string, index: number): boolean => {
  if (!value.includes("`")) return false
  let inCode = false
  let fenceLen = 0
  let i = 0
  while (i < value.length) {
    if (value[i] === "\\" && !inCode) {
      i += 2
      continue
    }
    if (value[i] === "`") {
      let run = 1
      while (i + run < value.length && value[i + run] === "`") run += 1
      if (!inCode) {
        const closeIdx = value.indexOf("`".repeat(run), i + run)
        if (closeIdx !== -1) {
          if (index >= i + run && index < closeIdx) return true
          inCode = true
          fenceLen = run
        }
      } else if (run === fenceLen) {
        inCode = false
        fenceLen = 0
      }
      i += run
      continue
    }
    i += 1
  }
  return false
}

const INLINE_FORMAT_DELIMITERS: Record<
  Exclude<TableCellInlineFormatKind, "line-break">,
  string
> = {
  bold: "**",
  italic: "*",
  code: "`",
  strikethrough: "~~",
}

type ParsedCsvRow = {
  cells: string[]
  valid: boolean
  hasUnquotedCommaSpace: boolean
}

const parseCsvRow = (line: string): ParsedCsvRow => {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  let hasUnquotedCommaSpace = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      if (line[i + 1] === " ") hasUnquotedCommaSpace = true
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return { cells, valid: !inQuotes, hasUnquotedCommaSpace }
}

const parseTsvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        currentCell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        currentCell += ch
      }
    } else if (ch === '"' && currentCell.length === 0) {
      inQuotes = true
    } else if (ch === "\t") {
      currentRow.push(currentCell.replace(/\s*\n\s*/g, " "))
      currentCell = ""
    } else if (ch === "\n") {
      currentRow.push(currentCell.replace(/\s*\n\s*/g, " "))
      rows.push(currentRow)
      currentRow = []
      currentCell = ""
    } else {
      currentCell += ch
    }
  }
  currentRow.push(currentCell.replace(/\s*\n\s*/g, " "))
  rows.push(currentRow)
  return rows
}

const splitPastedTableRows = (trimmedText: string): string[][] => {
  if (trimmedText.includes("\t")) {
    return parseTsvRows(trimmedText)
  }
  const lines = trimmedText.split("\n")
  if (lines.length >= 2 && lines.every((line) => line.trim().length > 0 && line.includes(","))) {
    const parsedRows = lines.map(parseCsvRow)
    const expectedCols = parsedRows[0]?.cells.length ?? 0
    const isStructuredCsv =
      expectedCols >= 2 &&
      parsedRows.every(
        (row) => row.valid && row.cells.length === expectedCols && !row.hasUnquotedCommaSpace
      )
    if (isStructuredCsv) {
      return parsedRows.map((row) => row.cells)
    }
    return [[trimmedText]]
  }
  if (lines.some((line) => line.includes(", ") || /[.!?]\s*$/.test(line))) {
    return [[trimmedText]]
  }
  return lines.map((line) => [line])
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

  while (
    grid.headers.length < clampedStartCol + maxCols &&
    grid.headers.length < MAX_EDIT_COLUMNS
  ) {
    grid.headers.push("")
    grid.alignments.push("left")
    for (const row of grid.rows) row.push("")
  }

  while (
    grid.rows.length < clampedStartRow + matrix.length - 1 &&
    grid.rows.length + 1 < MAX_EDIT_ROWS
  ) {
    grid.rows.push(Array.from({ length: grid.headers.length }, () => ""))
  }

  let pastedRows = 0
  let pastedCols = 0
  let lastTargetRow = clampedStartRow
  let lastTargetCol = clampedStartCol

  for (let r = 0; r < matrix.length; r += 1) {
    const targetRow = clampedStartRow + r
    if (targetRow > grid.rows.length) break
    pastedRows += 1
    lastTargetRow = targetRow
    const sourceRow = matrix[r]!
    for (let c = 0; c < sourceRow.length; c += 1) {
      const targetCol = clampedStartCol + c
      if (targetCol >= grid.headers.length) break
      if (c + 1 > pastedCols) pastedCols = c + 1
      if (targetCol > lastTargetCol) lastTargetCol = targetCol
      const cellVal = (sourceRow[c] ?? "").trim()
      if (targetRow === 0) grid.headers[targetCol] = cellVal
      else grid.rows[targetRow - 1]![targetCol] = cellVal
    }
  }

  if (pastedRows === 0 || pastedCols === 0) return null

  return {
    markdown: serializeMarkdownTableGrid(grid),
    nextRow: lastTargetRow,
    nextCol: lastTargetCol,
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
  return applyPlannedTextMutationToValue(
    value,
    planToggleWrapSelection(value, start, end, delim, delim)
  )
}
