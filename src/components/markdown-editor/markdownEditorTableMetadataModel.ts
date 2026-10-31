import {
  TABLE_MIN_COLUMN_WIDTH_PX,
  normalizeMarkdownTableLayout,
  parseMarkdownTableLayoutComment,
  serializeMarkdownTableLayoutComment,
  type MarkdownTableCellLayout,
  type MarkdownTableLayout,
} from "../../libs/markdown/tableMetadata"
import type {
  MarkdownTableGrid,
  MarkdownTableGridAction,
} from "./markdownEditorTableModel"

const AQ_TABLE_CANDIDATE_PATTERN = /^<!--\s*aq-table(?:\s|$|--)/i
const AQ_TABLE_STRICT_PATTERN = /^<!--\s*aq-table\s+(\{.*\})\s*-->$/

export type ParsedLeadingTableLayoutLine =
  | { kind: "none" }
  | { kind: "malformed" }
  | { kind: "valid"; layout: MarkdownTableLayout | null }

const stripLineQuotePrefix = (line: string): string => {
  const match = /^[ \t]*(?:>[ \t]*)*(.*)$/.exec(line)
  return (match ? match[1] ?? "" : line).trim()
}

export const parseLeadingTableLayoutLine = (line: string): ParsedLeadingTableLayoutLine => {
  const trimmed = stripLineQuotePrefix(line)
  if (!AQ_TABLE_CANDIDATE_PATTERN.test(trimmed)) return { kind: "none" }
  const match = AQ_TABLE_STRICT_PATTERN.exec(trimmed)
  if (!match) return { kind: "malformed" }
  try {
    const raw = JSON.parse(match[1] ?? "{}") as unknown
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { kind: "malformed" }
    }
    return { kind: "valid", layout: parseMarkdownTableLayoutComment(trimmed) }
  } catch {
    return { kind: "malformed" }
  }
}

export const isAqTableCommentCandidateLine = (line: string): boolean =>
  parseLeadingTableLayoutLine(line).kind !== "none"

export const hasLeadingAqTableComment = (markdown: string): boolean => {
  const firstNonEmpty = markdown.split(/\r?\n/).find((line) => line.trim().length > 0)
  return firstNonEmpty ? parseLeadingTableLayoutLine(firstNonEmpty).kind === "valid" : false
}

export const cloneTableLayout = (
  layout: MarkdownTableLayout | null | undefined
): MarkdownTableLayout | null => {
  if (!layout) return null
  return {
    ...(layout.headerRow !== undefined ? { headerRow: layout.headerRow } : {}),
    ...(layout.headerColumn !== undefined ? { headerColumn: layout.headerColumn } : {}),
    ...(layout.overflowMode !== undefined ? { overflowMode: layout.overflowMode } : {}),
    ...(layout.columnWidths ? { columnWidths: [...layout.columnWidths] } : {}),
    ...(layout.rowHeights ? { rowHeights: [...layout.rowHeights] } : {}),
    ...(layout.columnAlignments ? { columnAlignments: [...layout.columnAlignments] } : {}),
    ...(layout.cells
      ? {
          cells: layout.cells.map((row) =>
            row.map((cell) => (cell ? ({ ...cell } as MarkdownTableCellLayout) : null))
          ),
        }
      : {}),
  }
}

export const compactTableLayoutDefaults = (
  layout: MarkdownTableLayout | null | undefined
): MarkdownTableLayout | null => {
  if (!layout) return null
  return normalizeMarkdownTableLayout({
    ...(layout.headerRow === false ? { headerRow: false } : {}),
    ...(layout.headerColumn === true ? { headerColumn: true } : {}),
    ...(layout.overflowMode === "wide" ? { overflowMode: "wide" } : {}),
    ...(layout.columnWidths ? { columnWidths: layout.columnWidths } : {}),
    ...(layout.rowHeights ? { rowHeights: layout.rowHeights } : {}),
    ...(layout.columnAlignments ? { columnAlignments: layout.columnAlignments } : {}),
    ...(layout.cells ? { cells: layout.cells } : {}),
  })
}

export const serializeMarkdownTableLayoutCommentIfNonDefault = (
  layout: MarkdownTableLayout | null | undefined,
  linePrefix = ""
): string | null => {
  const compacted = compactTableLayoutDefaults(layout)
  if (!compacted) return null
  const comment = serializeMarkdownTableLayoutComment(compacted)
  return comment ? `${linePrefix}${comment}` : null
}

const gridLayoutMeta = new WeakMap<MarkdownTableGrid, MarkdownTableLayout>()

export const setTableGridLayoutMeta = (
  grid: MarkdownTableGrid,
  layout: MarkdownTableLayout | null | undefined
): void => {
  const compacted = compactTableLayoutDefaults(cloneTableLayout(layout))
  if (compacted) gridLayoutMeta.set(grid, compacted)
  else gridLayoutMeta.delete(grid)
}

export const getTableGridLayoutMeta = (grid: MarkdownTableGrid): MarkdownTableLayout | null =>
  cloneTableLayout(gridLayoutMeta.get(grid) ?? null)

const spliceSparseArray = <T>(
  items: Array<T | null> | undefined,
  index: number,
  deleteCount: number,
  insertValue?: T | null,
  hasInsert = false
) => {
  if (!items) return
  if (hasInsert) {
    while (items.length < index) items.push(null)
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
  if (!items || fromIndex === toIndex) return
  const maxIndex = Math.max(fromIndex, toIndex)
  while (items.length <= maxIndex) items.push(null)
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved ?? null)
}

export const syncTableLayoutOnGridAction = (
  grid: MarkdownTableGrid,
  colCountBefore: number,
  bodyRowCountBefore: number,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): void => {
  const layout = getTableGridLayoutMeta(grid)
  if (!layout) return

  if (action.kind === "add-row" || action.kind === "insert-row-above") {
    const insertTableRow = Math.max(0, action.kind === "add-row" ? activeRow : activeRow - 1) + 1
    spliceSparseArray(layout.rowHeights, insertTableRow, 0, null, true)
    if (layout.cells && insertTableRow <= layout.cells.length) {
      layout.cells.splice(insertTableRow, 0, [])
    }
  } else if (action.kind === "duplicate-row") {
    const insertTableRow = Math.max(0, activeRow) + 1
    spliceSparseArray(
      layout.rowHeights,
      insertTableRow,
      0,
      layout.rowHeights?.[activeRow] ?? null,
      true
    )
    if (layout.cells) {
      while (layout.cells.length < insertTableRow) layout.cells.push([])
      const clonedRow = (layout.cells[activeRow] ?? []).map((cell) => (cell ? { ...cell } : null))
      layout.cells.splice(insertTableRow, 0, clonedRow)
    }
  } else if (
    action.kind === "move-row-up" ||
    action.kind === "move-row-down" ||
    action.kind === "move-row-to"
  ) {
    const targetRow =
      action.kind === "move-row-to"
        ? action.targetRow
        : action.kind === "move-row-up"
          ? activeRow - 1
          : activeRow + 1
    if (activeRow >= 1 && targetRow >= 1 && activeRow <= bodyRowCountBefore && targetRow <= bodyRowCountBefore) {
      moveSparseItem(layout.rowHeights, activeRow, targetRow)
      if (layout.cells) {
        const maxRow = Math.max(activeRow, targetRow)
        while (layout.cells.length <= maxRow) layout.cells.push([])
        const [movedCells] = layout.cells.splice(activeRow, 1)
        layout.cells.splice(targetRow, 0, movedCells ?? [])
      }
    }
  } else if (action.kind === "delete-row") {
    if (activeRow >= 1) {
      spliceSparseArray(layout.rowHeights, activeRow, 1)
      if (layout.cells && activeRow < layout.cells.length) {
        layout.cells.splice(activeRow, 1)
      }
    }
  } else if (
    action.kind === "add-column" ||
    action.kind === "insert-column-left" ||
    action.kind === "duplicate-column"
  ) {
    const insertAt = action.kind === "insert-column-left" ? activeCol : activeCol + 1
    const isDup = action.kind === "duplicate-column"
    spliceSparseArray(
      layout.columnWidths,
      insertAt,
      0,
      isDup ? (layout.columnWidths?.[activeCol] ?? null) : null,
      true
    )
    spliceSparseArray(
      layout.columnAlignments,
      insertAt,
      0,
      isDup ? (layout.columnAlignments?.[activeCol] ?? null) : null,
      true
    )
    if (layout.cells) {
      for (const cellRow of layout.cells) {
        spliceSparseArray(
          cellRow,
          insertAt,
          0,
          isDup && cellRow[activeCol] ? { ...cellRow[activeCol]! } : null,
          true
        )
      }
    }
  } else if (
    action.kind === "move-column-left" ||
    action.kind === "move-column-right" ||
    action.kind === "move-column-to"
  ) {
    const targetCol =
      action.kind === "move-column-to"
        ? action.targetCol
        : action.kind === "move-column-left"
          ? activeCol - 1
          : activeCol + 1
    if (activeCol >= 0 && targetCol >= 0 && activeCol < colCountBefore && targetCol < colCountBefore) {
      moveSparseItem(layout.columnWidths, activeCol, targetCol)
      moveSparseItem(layout.columnAlignments, activeCol, targetCol)
      if (layout.cells) {
        for (const cellRow of layout.cells) moveSparseItem(cellRow, activeCol, targetCol)
      }
    }
  } else if (action.kind === "delete-column") {
    spliceSparseArray(layout.columnWidths, activeCol, 1)
    spliceSparseArray(layout.columnAlignments, activeCol, 1)
    if (layout.cells) {
      for (const cellRow of layout.cells) spliceSparseArray(cellRow, activeCol, 1)
    }
  }

  setTableGridLayoutMeta(grid, layout)
}

export type HydratedTableVisualState = {
  headerRow: boolean
  headerColumn: boolean
  fitPageWidth: boolean
  columnWidths: number[]
}

export const hydrateVisualOptionsIntoTarget = (
  target: HydratedTableVisualState,
  layout: MarkdownTableLayout | null | undefined,
  columnCount: number
): void => {
  target.headerRow = layout?.headerRow ?? true
  target.headerColumn = layout?.headerColumn ?? false
  target.fitPageWidth = layout?.overflowMode === "wide"
  target.columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const raw = layout?.columnWidths?.[index]
    return typeof raw === "number" && Number.isFinite(raw) && raw >= TABLE_MIN_COLUMN_WIDTH_PX
      ? Math.round(raw)
      : 0
  })
}

export const mergeVisualOptionsIntoTableLayout = (
  existing: MarkdownTableLayout | null | undefined,
  visualOptions: HydratedTableVisualState,
  columnCount: number
): MarkdownTableLayout | null => {
  const columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const width = visualOptions.columnWidths[index] ?? 0
    return width >= TABLE_MIN_COLUMN_WIDTH_PX ? Math.round(width) : null
  })
  return compactTableLayoutDefaults({
    ...(existing ?? {}),
    headerRow: visualOptions.headerRow,
    headerColumn: visualOptions.headerColumn,
    overflowMode: visualOptions.fitPageWidth ? "wide" : "normal",
    columnWidths,
  })
}

export type LocalTableLineSlice = {
  text: string
  start: number
  end: number
}

const collectBackwardTableLines = (
  value: string,
  cursorLineStart: number,
  maxLinesEachWay: number
): LocalTableLineSlice[] => {
  const before: LocalTableLineSlice[] = []
  let scanStart = cursorLineStart
  for (let count = 0; count < maxLinesEachWay && scanStart > 0; count += 1) {
    const lineEnd = scanStart - 1
    const lineStart = lineEnd === 0 ? 0 : value.lastIndexOf("\n", lineEnd - 1) + 1
    const text = value.slice(lineStart, lineEnd)
    before.push({ text, start: lineStart, end: lineEnd })
    scanStart = lineStart
    if (!text.startsWith("|") && !isAqTableCommentCandidateLine(text)) break
  }
  return before.reverse()
}

const collectForwardTableLines = (
  value: string,
  cursorLineEnd: number,
  maxLinesEachWay: number
): LocalTableLineSlice[] => {
  const after: LocalTableLineSlice[] = []
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

export const collectLocalTableLineWindow = (
  value: string,
  offset: number,
  maxLinesEachWay: number
): LocalTableLineSlice[] => {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const cursorLineStart = clamped === 0 ? 0 : value.lastIndexOf("\n", clamped - 1) + 1
  const cursorNextBreak = value.indexOf("\n", clamped)
  const cursorLineEnd = cursorNextBreak === -1 ? value.length : cursorNextBreak
  const cursorLineText = value.slice(cursorLineStart, cursorLineEnd)
  if (!cursorLineText.startsWith("|") || !cursorLineText.endsWith("|")) return []
  return [
    ...collectBackwardTableLines(value, cursorLineStart, maxLinesEachWay),
    { text: cursorLineText, start: cursorLineStart, end: cursorLineEnd },
    ...collectForwardTableLines(value, cursorLineEnd, maxLinesEachWay),
  ]
}
