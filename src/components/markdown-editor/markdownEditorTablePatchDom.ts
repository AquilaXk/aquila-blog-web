import { EditorSelection, Transaction } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import {
  parseMarkdownTableGrid,
  serializeMarkdownTableGrid,
  type MarkdownTableGrid,
} from "./markdownEditorTableModel"
import {
  getTableGridLayoutMeta,
  hasLeadingAqTableComment,
  hydrateVisualOptionsIntoTarget,
  mergeVisualOptionsIntoTableLayout,
  setTableGridLayoutMeta,
} from "./markdownEditorTableMetadataModel"
import { type TableSelectionMode } from "./markdownEditorTableSessionDom"
import {
  syncTableVisualWrapAttributes,
  type TableToolbarButtonEntry,
  type TableVisualOptions,
} from "./markdownEditorTableWidgetDom"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export type TableDocRange = { from: number; to: number }

export const applyVisualOptionsToTableMarkdown = (
  markdown: string,
  visualOptions: TableVisualOptions
): string => {
  const parsed = parseMarkdownTableGrid(markdown)
  if (!parsed) return markdown
  setTableGridLayoutMeta(
    parsed,
    mergeVisualOptionsIntoTableLayout(getTableGridLayoutMeta(parsed), visualOptions, parsed.headers.length)
  )
  return serializeMarkdownTableGrid(parsed)
}

export const syncTableFromDataset = (wrap: HTMLElement, from: number | undefined) => {
  if (!wrap.dataset) return
  if (from !== undefined) {
    wrap.dataset.tableFrom = String(from)
  } else {
    delete wrap.dataset.tableFrom
  }
}

export const appendTableWrapChildren = (
  wrap: HTMLElement,
  toolbar: HTMLElement,
  gridRow: HTMLElement,
  addRowBtn: HTMLElement,
  imeProxy: HTMLTextAreaElement | null
) => {
  wrap.textContent = ""
  wrap.appendChild(toolbar)
  wrap.appendChild(gridRow)
  wrap.appendChild(addRowBtn)
  if (imeProxy) {
    wrap.appendChild(imeProxy)
  }
}

export const syncTableActiveDataset = (
  wrap: HTMLElement,
  isTableActive: boolean,
  mode: TableSelectionMode,
  row: number,
  col: number
) => {
  if (!wrap.dataset) return
  if (isTableActive) {
    wrap.dataset.activeMode = mode
    wrap.dataset.activeRow = String(row)
    wrap.dataset.activeCol = String(col)
    return
  }
  delete wrap.dataset.activeMode
  delete wrap.dataset.activeRow
  delete wrap.dataset.activeCol
}

const readGridCellText = (grid: MarkdownTableGrid, r: number, c: number): string =>
  r === 0 ? (grid.headers[c] ?? "") : (grid.rows[r - 1]?.[c] ?? "")

export const getPreservedCellControls = (cellEl: HTMLElement): HTMLElement[] => {
  if (typeof cellEl.querySelector !== "function") return []
  return [".cm-live-table-col-handle", ".cm-live-table-row-handle", ".cm-live-table-col-resizer"]
    .map((sel) => cellEl.querySelector<HTMLElement>(sel))
    .filter((el): el is HTMLElement => el !== null)
}

export const restoreCellDisplay = (cellEl: HTMLElement, rawText: string) => {
  const controls = getPreservedCellControls(cellEl)
  cellEl.textContent = ""
  appendInlineMarkdownNodes(cellEl, rawText)
  for (const control of controls) {
    cellEl.appendChild(control)
  }
}

const patchSingleTableCell = (
  cellEl: HTMLElement,
  prevAlign: string,
  nextAlign: string,
  prevText: string,
  nextText: string
) => {
  if (prevAlign !== nextAlign) {
    if (cellEl.style) cellEl.style.textAlign = nextAlign
    if (cellEl.dataset) cellEl.dataset.align = nextAlign
  }
  const hasInput =
    typeof cellEl.querySelector === "function" && cellEl.querySelector(".cm-live-table-cell-input") !== null
  if (prevText !== nextText || hasInput) {
    restoreCellDisplay(cellEl, nextText)
  }
}

export const patchTableCellsInPlace = (
  cellElements: HTMLElement[][],
  grid: MarkdownTableGrid,
  nextGrid: MarkdownTableGrid
) => {
  for (let r = 0; r <= nextGrid.rows.length; r += 1) {
    for (let c = 0; c < nextGrid.headers.length; c += 1) {
      const cellEl = cellElements[r]?.[c]
      if (!cellEl) continue
      patchSingleTableCell(
        cellEl,
        grid.alignments[c] ?? "left",
        nextGrid.alignments[c] ?? "left",
        readGridCellText(grid, r, c),
        readGridCellText(nextGrid, r, c)
      )
    }
  }
}

export const replaceGridContentsInPlace = (target: MarkdownTableGrid, source: MarkdownTableGrid) => {
  target.headers.splice(0, target.headers.length, ...source.headers)
  target.alignments.splice(0, target.alignments.length, ...source.alignments)
  target.rows.splice(0, target.rows.length, ...source.rows.map((row) => [...row]))
}

export const syncColumnWidthsToGrid = (columnWidths: number[], headerCount: number) => {
  while (columnWidths.length < headerCount) {
    columnWidths.push(0)
  }
  if (columnWidths.length > headerCount) {
    columnWidths.length = headerCount
  }
}

const syncElementClassList = (
  el: HTMLElement,
  entries: ReadonlyArray<readonly [string, boolean]>
) => {
  for (const [className, active] of entries) {
    if (active) {
      el.classList.add(className)
    } else {
      el.classList.remove(className)
    }
  }
}

export const syncCellHighlightClasses = (
  cellElements: HTMLElement[][],
  isTableActive: boolean,
  selectedMode: TableSelectionMode,
  activeRow: number,
  activeCol: number
) => {
  for (let r = 0; r < cellElements.length; r += 1) {
    const rowEls = cellElements[r]!
    for (let c = 0; c < rowEls.length; c += 1) {
      syncElementClassList(rowEls[c]!, [
        ["is-active-cell", isTableActive && r === activeRow && c === activeCol],
        ["is-selected-col", isTableActive && selectedMode === "col" && c === activeCol],
        ["is-selected-row", isTableActive && selectedMode === "row" && r === activeRow],
      ])
    }
  }
}

export const syncToolbarButtonStates = (
  toolbarButtons: TableToolbarButtonEntry[],
  currentAlign: string,
  activeRow: number,
  activeCol: number
) => {
  for (const entry of toolbarButtons) {
    if (entry.isDisabled) {
      entry.button.disabled = entry.isDisabled(activeRow, activeCol)
    }
    if (entry.align) {
      entry.button.setAttribute("aria-pressed", String(entry.align === currentAlign))
    }
  }
}

export const resolveTableWidgetRange = (
  view: EditorView,
  wrap: HTMLElement,
  currentFrom: number | undefined,
  currentTo: number | undefined,
  markdownLength: number
): TableDocRange | null => {
  let resolvedFrom = currentFrom
  try {
    const domPos = view.posAtDOM(wrap)
    if (typeof domPos === "number" && domPos >= 0) resolvedFrom = domPos
  } catch {
    resolvedFrom = currentFrom
  }
  if (resolvedFrom === undefined) return null
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(resolvedFrom, docLen))
  const span = currentFrom !== undefined && currentTo !== undefined ? Math.max(0, currentTo - currentFrom) : markdownLength
  return { from, to: Math.max(from, Math.min(from + span, docLen)) }
}

export const dispatchEditSourceSelection = (view: EditorView, range: TableDocRange) => {
  view.focus()
  view.dispatch({
    selection: EditorSelection.cursor(Math.min(range.to, range.from + 2)),
    scrollIntoView: true,
  })
}

export const dispatchDeleteTableRange = (view: EditorView, range: TableDocRange) => {
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: "" },
    selection: EditorSelection.cursor(range.from),
    annotations: [Transaction.userEvent.of("delete")],
  })
}

export const dispatchTableMarkdownChange = (
  view: EditorView,
  range: TableDocRange,
  nextMarkdown: string
) => {
  const mainSel = view.state.selection.main
  const overlaps = mainSel.from >= range.from && mainSel.from <= range.to
  const safeAnchor = overlaps ? resolveSafeParkingAnchor(view, range, nextMarkdown.length) : undefined
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: nextMarkdown },
    ...(safeAnchor !== undefined ? { selection: EditorSelection.cursor(safeAnchor) } : {}),
    annotations: [Transaction.userEvent.of("input")],
  })
}

export const resolveSafeParkingAnchor = (
  view: EditorView,
  range: TableDocRange,
  nextLength: number
): number | undefined => {
  const doc = view.state.doc
  if (range.from > 0 && doc.lineAt?.(range.from - 1).length === 0) return range.from - 1
  if (range.to < doc.length && doc.lineAt?.(range.to + 1).length === 0) return range.from + nextLength + 1
  if (range.from > 0) return range.from - 1
  if (range.to < doc.length) return range.from + nextLength + 1
  return undefined
}

export const parkSelectionOutsideActiveTable = (view: EditorView, range: TableDocRange | null) => {
  if (typeof view.state.doc?.lineAt !== "function" || !range) return
  const mainSel = view.state.selection.main
  if (mainSel.from !== mainSel.to || view.state.doc.lineAt(mainSel.from).length === 0) return
  if (range.from > 0 && view.state.doc.lineAt(range.from - 1).length === 0) {
    view.dispatch({ selection: EditorSelection.cursor(range.from - 1) })
  } else if (range.to < view.state.doc.length && view.state.doc.lineAt(range.to + 1).length === 0) {
    view.dispatch({ selection: EditorSelection.cursor(range.to + 1) })
  }
}

export const isEventInsideTableWrap = (wrap: HTMLElement, target: HTMLElement | null): boolean => {
  if (!target) return false
  if (target === wrap) return true
  if (typeof wrap.contains === "function" && wrap.contains(target)) return true
  return target.closest?.(".cm-live-table-wrap") === wrap
}

export const syncHydratedOptionsOnMarkdownUpdate = (
  wrap: HTMLElement,
  visualOptions: TableVisualOptions,
  currentMarkdown: string,
  nextMarkdown: string,
  nextGrid: MarkdownTableGrid,
  syncOptionButtons: () => void
) => {
  if (hasLeadingAqTableComment(nextMarkdown)) {
    hydrateVisualOptionsIntoTarget(visualOptions, getTableGridLayoutMeta(nextGrid), nextGrid.headers.length)
  } else if (hasLeadingAqTableComment(currentMarkdown)) {
    hydrateVisualOptionsIntoTarget(visualOptions, null, nextGrid.headers.length)
  } else {
    return
  }
  syncTableVisualWrapAttributes(wrap, visualOptions)
  syncOptionButtons()
}

export const createOutsideTableListenerGuard = (
  onOutsideEvent: (event: Event) => void,
  onLifecycleFlush: () => void
) => {
  let attached = false
  return {
    attach() {
      if (attached) return
      attached = true
      if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
        document.addEventListener("mousedown", onOutsideEvent, true)
        document.addEventListener("focusin", onOutsideEvent, true)
      }
      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("pagehide", onLifecycleFlush)
        window.addEventListener("beforeunload", onLifecycleFlush)
      }
    },
    detach() {
      if (!attached) return
      attached = false
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("mousedown", onOutsideEvent, true)
        document.removeEventListener("focusin", onOutsideEvent, true)
      }
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("pagehide", onLifecycleFlush)
        window.removeEventListener("beforeunload", onLifecycleFlush)
      }
    },
  }
}
