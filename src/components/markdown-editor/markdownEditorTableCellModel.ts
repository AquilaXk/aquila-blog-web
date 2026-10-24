import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  parseMarkdownTableGrid,
  serializeMarkdownTableGrid,
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

const INLINE_FORMAT_DELIMITERS: Record<
  Exclude<TableCellInlineFormatKind, "line-break">,
  string
> = {
  bold: "**",
  italic: "*",
  code: "`",
  strikethrough: "~~",
}

const parseCsvRow = (line: string): string[] => {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
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
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

const splitPastedTableRows = (trimmedText: string): string[][] => {
  const lines = trimmedText.split("\n")
  if (trimmedText.includes("\t")) {
    return lines.map((line) => line.split("\t"))
  }
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
  if (nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.includes(","))) {
    return lines.map(parseCsvRow)
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
