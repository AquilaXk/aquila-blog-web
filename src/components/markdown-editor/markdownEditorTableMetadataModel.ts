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
import {
  applyColDeleteLayout,
  applyColInsertOrDuplicateLayout,
  applyColMoveLayout,
  applyRowDeleteLayout,
  applyRowInsertOrDuplicateLayout,
  applyRowMoveLayout,
  reconcileCellSpans,
  resolveTargetMovedCol,
  resolveTargetMovedRow,
  unmergeCoveredCellAt,
} from "./markdownEditorTableSpanModel"

export { reconcileCellSpans }

export type ExtendedMarkdownTableLayout = MarkdownTableLayout

export type ParsedLeadingTableLayoutLine =
  | { kind: "none" }
  | { kind: "malformed" }
  | { kind: "valid"; layout: ExtendedMarkdownTableLayout | null }

const stripLineQuotePrefix = (line: string): string => {
  let index = 0
  while (index < line.length) {
    const code = line.codePointAt(index)
    if (code === 32 || code === 9 || code === 62) {
      index += 1
      continue
    }
    break
  }
  return line.slice(index).trim()
}

const isAqTablePrefixBoundary = (rest: string): boolean => {
  if (rest.length === 0 || rest.startsWith("--")) {
    return true
  }
  const first = rest[0]
  return first !== undefined && /\s/.test(first)
}

const extractAqTableJsonPayload = (trimmed: string): string | null => {
  if (!trimmed.endsWith("-->")) {
    return null
  }
  const closeIdx = trimmed.indexOf("-->", 4)
  if (closeIdx !== trimmed.length - 3) {
    return null
  }
  const inner = trimmed.slice(4, closeIdx).trimStart()
  if (!inner.startsWith("aq-table")) {
    return null
  }
  const afterTag = inner.slice(8)
  if (afterTag.length === 0 || !/\s/.test(afterTag[0]!)) {
    return null
  }
  const payload = afterTag.trim()
  if (!payload.startsWith("{") || !payload.endsWith("}")) {
    return null
  }
  return payload
}

export const parseLeadingTableLayoutLine = (line: string): ParsedLeadingTableLayoutLine => {
  const trimmed = stripLineQuotePrefix(line)
  if (!trimmed.startsWith("<!--")) {
    return { kind: "none" }
  }
  const afterOpen = trimmed.slice(4).trimStart()
  if (!afterOpen.toLowerCase().startsWith("aq-table")) {
    return { kind: "none" }
  }
  if (!isAqTablePrefixBoundary(afterOpen.slice(8))) {
    return { kind: "none" }
  }
  const payload = extractAqTableJsonPayload(trimmed)
  if (!payload) {
    return { kind: "malformed" }
  }
  try {
    const raw = JSON.parse(payload) as unknown
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

const cloneTableCellsMatrix = (
  cells: Array<Array<MarkdownTableCellLayout | null>>
): Array<Array<MarkdownTableCellLayout | null>> =>
  cells.map((row) => row.map((cell) => (cell ? ({ ...cell } as MarkdownTableCellLayout) : null)))

export const cloneTableLayout = (
  layout: ExtendedMarkdownTableLayout | null | undefined
): ExtendedMarkdownTableLayout | null => {
  if (!layout) {
    return null
  }
  const cloned: ExtendedMarkdownTableLayout = {}
  if (layout.headerRow !== undefined) cloned.headerRow = layout.headerRow
  if (layout.headerColumn !== undefined) cloned.headerColumn = layout.headerColumn
  if (layout.overflowMode !== undefined) cloned.overflowMode = layout.overflowMode
  if (layout.fitWidth !== undefined) cloned.fitWidth = layout.fitWidth
  if (layout.columnWidths) cloned.columnWidths = [...layout.columnWidths]
  if (layout.rowHeights) cloned.rowHeights = [...layout.rowHeights]
  if (layout.columnAlignments) cloned.columnAlignments = [...layout.columnAlignments]
  if (layout.cells) cloned.cells = cloneTableCellsMatrix(layout.cells)
  return cloned
}

export const compactTableLayoutDefaults = (
  layout: ExtendedMarkdownTableLayout | null | undefined
): ExtendedMarkdownTableLayout | null => {
  if (!layout) {
    return null
  }
  return normalizeMarkdownTableLayout({
    headerRow: layout.headerRow === false ? false : undefined,
    headerColumn: layout.headerColumn === true ? true : undefined,
    fitWidth: layout.fitWidth === true ? true : undefined,
    overflowMode: layout.overflowMode === "wide" ? "wide" : undefined,
    columnWidths: layout.columnWidths,
    rowHeights: layout.rowHeights,
    columnAlignments: layout.columnAlignments,
    cells: layout.cells,
  })
}

export const serializeMarkdownTableLayoutCommentIfNonDefault = (
  layout: ExtendedMarkdownTableLayout | null | undefined,
  linePrefix = ""
): string | null => {
  const compacted = compactTableLayoutDefaults(layout)
  if (!compacted) {
    return null
  }
  const comment = serializeMarkdownTableLayoutComment(compacted)
  return comment ? `${linePrefix}${comment}` : null
}

const gridLayoutMeta = new WeakMap<MarkdownTableGrid, ExtendedMarkdownTableLayout>()

export const setTableGridLayoutMeta = (
  grid: MarkdownTableGrid,
  layout: ExtendedMarkdownTableLayout | null | undefined
): void => {
  const compacted = compactTableLayoutDefaults(cloneTableLayout(layout))
  if (compacted) {
    gridLayoutMeta.set(grid, compacted)
  } else {
    gridLayoutMeta.delete(grid)
  }
}

export const getTableGridLayoutMeta = (
  grid: MarkdownTableGrid
): ExtendedMarkdownTableLayout | null => cloneTableLayout(gridLayoutMeta.get(grid) ?? null)

const applyGridActionToTableLayout = (
  layout: ExtendedMarkdownTableLayout,
  colCountBefore: number,
  bodyRowCountBefore: number,
  activeRow: number,
  activeCol: number,
  action: MarkdownTableGridAction
): void => {
  switch (action.kind) {
    case "add-row":
    case "insert-row-above":
    case "duplicate-row":
      applyRowInsertOrDuplicateLayout(
        layout,
        activeRow,
        action.kind === "duplicate-row",
        action.kind === "insert-row-above",
        bodyRowCountBefore
      )
      return
    case "move-row-up":
    case "move-row-down":
    case "move-row-to":
      applyRowMoveLayout(
        layout,
        activeRow,
        resolveTargetMovedRow(action, activeRow),
        bodyRowCountBefore
      )
      return
    case "delete-row":
      applyRowDeleteLayout(layout, activeRow)
      return
    case "add-column":
    case "insert-column-left":
    case "duplicate-column":
      applyColInsertOrDuplicateLayout(
        layout,
        activeCol,
        action.kind === "duplicate-column",
        action.kind === "insert-column-left",
        colCountBefore
      )
      return
    case "move-column-left":
    case "move-column-right":
    case "move-column-to":
      applyColMoveLayout(
        layout,
        activeCol,
        resolveTargetMovedCol(action, activeCol),
        colCountBefore
      )
      return
    case "delete-column":
      applyColDeleteLayout(layout, activeCol)
      return
    default:
      return
  }
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
  if (!layout) {
    return
  }
  if (layout.cells) {
    layout.cells = reconcileCellSpans(layout.cells, bodyRowCountBefore + 1, colCountBefore)
  }
  applyGridActionToTableLayout(
    layout,
    colCountBefore,
    bodyRowCountBefore,
    activeRow,
    activeCol,
    action
  )
  if (layout.cells) {
    layout.cells = reconcileCellSpans(layout.cells, grid.rows.length + 1, grid.headers.length)
  }
  setTableGridLayoutMeta(grid, layout)
}

export const reconcileOverwrittenTableCells = (
  grid: MarkdownTableGrid,
  coords: ReadonlyArray<{ row: number; col: number }>
): void => {
  if (coords.length === 0) return
  const next = getTableGridLayoutMeta(grid)
  if (!next) return
  let changed = false
  for (const { row, col } of coords) {
    if (unmergeCoveredCellAt(next, row, col)) changed = true
  }
  if (!changed) return
  if (next.cells) {
    next.cells = reconcileCellSpans(next.cells, grid.rows.length + 1, grid.headers.length)
  }
  setTableGridLayoutMeta(grid, next)
}

export type HydratedTableVisualState = {
  headerRow: boolean
  headerColumn: boolean
  fitPageWidth: boolean
  columnWidths: number[]
}

export const hydrateVisualOptionsIntoTarget = (
  target: HydratedTableVisualState,
  layout: ExtendedMarkdownTableLayout | null | undefined,
  columnCount: number
): void => {
  target.headerRow = layout?.headerRow ?? true
  target.headerColumn = layout?.headerColumn ?? false
  target.fitPageWidth = Boolean(layout?.fitWidth)
  target.columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const raw = layout?.columnWidths?.[index]
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= TABLE_MIN_COLUMN_WIDTH_PX) {
      return Math.round(raw)
    }
    return 0
  })
}

export const mergeVisualOptionsIntoTableLayout = (
  existing: ExtendedMarkdownTableLayout | null | undefined,
  visualOptions: HydratedTableVisualState,
  columnCount: number
): ExtendedMarkdownTableLayout | null => {
  const columnWidths = Array.from({ length: columnCount }, (_, index) => {
    const width = visualOptions.columnWidths[index] ?? 0
    return width >= TABLE_MIN_COLUMN_WIDTH_PX ? Math.round(width) : null
  })
  const next: ExtendedMarkdownTableLayout = existing ? { ...existing } : {}
  next.headerRow = visualOptions.headerRow
  next.headerColumn = visualOptions.headerColumn
  next.fitWidth = visualOptions.fitPageWidth ? true : undefined
  next.columnWidths = columnWidths
  return compactTableLayoutDefaults(next)
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
    if (!text.startsWith("|") && !isAqTableCommentCandidateLine(text)) {
      break
    }
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
    if (!text.startsWith("|")) {
      break
    }
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
  if (!cursorLineText.startsWith("|") || !cursorLineText.endsWith("|")) {
    return []
  }
  return [
    ...collectBackwardTableLines(value, cursorLineStart, maxLinesEachWay),
    { text: cursorLineText, start: cursorLineStart, end: cursorLineEnd },
    ...collectForwardTableLines(value, cursorLineEnd, maxLinesEachWay),
  ]
}
