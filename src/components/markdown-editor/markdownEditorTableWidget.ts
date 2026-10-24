import { EditorSelection, Transaction } from "@codemirror/state"
import { WidgetType, EditorView } from "@codemirror/view"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  parseMarkdownTableGrid,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import {
  createInteractiveTableSurface,
  createTableToolbarElement,
  getOrCreateTableVisualOptions,
  renderStaticTableElement,
  syncTableVisualWrapAttributes,
} from "./markdownEditorTableWidgetDom"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

type PendingTableCellActivation = {
  from: number
  row: number
  col: number
  openEditor?: boolean
}

type ActiveCellEditorSession = {
  row: number
  col: number
  cellEl: HTMLElement
  input: HTMLInputElement
  initialValue: string
  handled: boolean
}

type TableDomController = {
  update: (
    nextMarkdown: string,
    nextFrom: number | undefined,
    nextTo: number | undefined
  ) => boolean
}

let pendingTableCellActivation: PendingTableCellActivation | null = null
const tableDomControllers = new WeakMap<HTMLElement, TableDomController>()

const syncTableFromDataset = (wrap: HTMLElement, from: number | undefined) => {
  if (from !== undefined) {
    if (wrap.dataset) wrap.dataset.tableFrom = String(from)
    return
  }
  if (wrap.dataset) delete wrap.dataset.tableFrom
}

const readGridCellText = (grid: MarkdownTableGrid, r: number, c: number): string =>
  r === 0 ? (grid.headers[c] ?? "") : (grid.rows[r - 1]?.[c] ?? "")

const patchSingleTableCell = (
  cellEl: HTMLElement,
  prevAlign: string,
  nextAlign: string,
  prevText: string,
  nextText: string,
  restoreCellDisplay: (el: HTMLElement, text: string) => void
) => {
  if (prevAlign !== nextAlign) {
    if (cellEl.style) cellEl.style.textAlign = nextAlign
    if (cellEl.dataset) cellEl.dataset.align = nextAlign
  }
  const hasInput =
    typeof cellEl.querySelector === "function" &&
    cellEl.querySelector(".cm-live-table-cell-input") !== null
  if (prevText !== nextText || hasInput) {
    restoreCellDisplay(cellEl, nextText)
  }
}

const patchTableCellsInPlace = (
  cellElements: HTMLElement[][],
  grid: MarkdownTableGrid,
  nextGrid: MarkdownTableGrid,
  restoreCellDisplay: (el: HTMLElement, text: string) => void
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
        readGridCellText(nextGrid, r, c),
        restoreCellDisplay
      )
    }
  }
}

export class MarkdownTableWidget extends WidgetType {
  constructor(
    private readonly markdown: string,
    private readonly from?: number,
    private readonly to?: number
  ) {
    super()
  }

  eq(other: MarkdownTableWidget) {
    return (
      other instanceof MarkdownTableWidget &&
      other.markdown === this.markdown &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement, _view: EditorView) {
    const controller = tableDomControllers.get(dom)
    if (!controller) return false
    return controller.update(this.markdown, this.from, this.to)
  }

  toDOM(view?: EditorView) {
    const wrap = document.createElement("div")
    wrap.className = "cm-live-table-wrap"
    const grid = parseMarkdownTableGrid(this.markdown)
    if (!grid) return wrap

    if (!view) {
      wrap.appendChild(renderStaticTableElement(grid))
      return wrap
    }

    let currentMarkdown = this.markdown
    let currentFrom = this.from
    let currentTo = this.to

    if (wrap.dataset) wrap.dataset.testid = "cm-live-table-widget"
    syncTableFromDataset(wrap, currentFrom)

    const visualOptions = getOrCreateTableVisualOptions(currentFrom ?? 0, grid.headers.length)
    syncTableVisualWrapAttributes(wrap, visualOptions)

    let activeRow = 0
    let activeCol = 0
    let activeSession: ActiveCellEditorSession | null = null

    const resolveRange = (): { from: number; to: number } | null => {
      let resolvedFrom = currentFrom
      try {
        const domPos = view.posAtDOM(wrap)
        if (typeof domPos === "number" && domPos >= 0) resolvedFrom = domPos
      } catch {}
      if (resolvedFrom === undefined) return null
      const docLen = view.state.doc.length
      const from = Math.max(0, Math.min(resolvedFrom, docLen))
      const span =
        currentFrom !== undefined && currentTo !== undefined
          ? Math.max(0, currentTo - currentFrom)
          : currentMarkdown.length
      const to = Math.max(from, Math.min(from + span, docLen))
      return { from, to }
    }

    const restoreCellDisplay = (cellEl: HTMLElement, rawText: string) => {
      const resizer =
        typeof cellEl.querySelector === "function"
          ? cellEl.querySelector(".cm-live-table-col-resizer")
          : null
      cellEl.textContent = ""
      appendInlineMarkdownNodes(cellEl, rawText)
      if (resizer) cellEl.appendChild(resizer)
    }

    const flushActiveCellMarkdown = (): string => {
      if (!activeSession || activeSession.handled) return currentMarkdown
      const session = activeSession
      session.handled = true
      activeSession = null
      const nextValue = session.input.value
      restoreCellDisplay(session.cellEl, nextValue)
      if (nextValue === session.initialValue) return currentMarkdown
      return (
        applyMarkdownTableGridCellEdit(currentMarkdown, session.row, session.col, nextValue) ??
        currentMarkdown
      )
    }

    const executeGridAction = (
      action: MarkdownTableGridAction,
      rowOverride = activeRow,
      colOverride = activeCol
    ) => {
      if (!view.state.facet(EditorView.editable)) return
      const baseMarkdown = flushActiveCellMarkdown()
      const outcome = applyMarkdownTableGridAction(baseMarkdown, rowOverride, colOverride, action)
      if (!outcome) {
        if (baseMarkdown !== currentMarkdown) {
          dispatchTableMarkdown(baseMarkdown, {
            row: rowOverride,
            col: colOverride,
            openEditor: false,
          })
        }
        return
      }
      activeRow = outcome.nextRow
      activeCol = outcome.nextCol
      syncActiveCellHighlight()
      dispatchTableMarkdown(outcome.markdown, {
        row: outcome.nextRow,
        col: outcome.nextCol,
      })
    }

    const { toolbar, toolbarButtons, canAddRow, canAddCol } = createTableToolbarElement({
      grid,
      wrap,
      visualOptions,
      executeGridAction: (action) => executeGridAction(action),
      onEditSource: () => {
        const range = resolveRange()
        if (!range) return
        view.focus()
        view.dispatch({
          selection: EditorSelection.cursor(Math.min(range.to, range.from + 2)),
          scrollIntoView: true,
        })
      },
    })

    const { gridRow, addRowBtn, cellElements } = createInteractiveTableSurface({
      grid,
      visualOptions,
      canAddCol,
      canAddRow,
      onActivateCell: (row, col) => activateCellEditor(row, col),
      onAddColumn: () => executeGridAction({ kind: "add-column" }, activeRow, grid.headers.length - 1),
      onAddRow: () => executeGridAction({ kind: "add-row" }, grid.rows.length, 0),
    })

    const syncActiveCellHighlight = () => {
      for (let r = 0; r < cellElements.length; r += 1) {
        const rowEls = cellElements[r]!
        for (let c = 0; c < rowEls.length; c += 1) {
          const el = rowEls[c]!
          if (r === activeRow && c === activeCol) {
            el.classList.add("is-active-cell")
          } else {
            el.classList.remove("is-active-cell")
          }
        }
      }
      for (const entry of toolbarButtons) {
        entry.button.disabled = entry.isDisabled(activeRow, activeCol)
      }
    }

    const dispatchTableMarkdown = (
      nextMarkdown: string,
      targetCell?: { row: number; col: number; openEditor?: boolean }
    ) => {
      const range = resolveRange()
      if (!range) return
      if (nextMarkdown === currentMarkdown) {
        if (targetCell) {
          if (targetCell.openEditor === false) {
            activeRow = Math.max(0, Math.min(targetCell.row, grid.rows.length))
            activeCol = Math.max(0, Math.min(targetCell.col, grid.headers.length - 1))
            syncActiveCellHighlight()
          } else {
            activateCellEditor(targetCell.row, targetCell.col)
          }
        }
        return
      }
      if (targetCell) {
        pendingTableCellActivation = {
          from: range.from,
          row: targetCell.row,
          col: targetCell.col,
          openEditor: targetCell.openEditor,
        }
      }
      const mainSel = view.state.selection.main
      const overlaps = mainSel.from >= range.from && mainSel.from <= range.to
      const safeAnchor =
        range.from > 0
          ? range.from - 1
          : range.to < view.state.doc.length
            ? range.from + nextMarkdown.length + 1
            : undefined

      view.dispatch({
        changes: { from: range.from, to: range.to, insert: nextMarkdown },
        ...(overlaps && safeAnchor !== undefined
          ? { selection: EditorSelection.cursor(safeAnchor) }
          : {}),
        annotations: [Transaction.userEvent.of("input")],
      })
    }

    const activateCellEditor = (row: number, col: number) => {
      if (!view.state.facet(EditorView.editable)) return
      const clampedRow = Math.max(0, Math.min(row, grid.rows.length))
      const clampedCol = Math.max(0, Math.min(col, grid.headers.length - 1))
      activeRow = clampedRow
      activeCol = clampedCol
      syncActiveCellHighlight()

      if (
        activeSession &&
        !activeSession.handled &&
        activeSession.row === clampedRow &&
        activeSession.col === clampedCol
      ) {
        activeSession.input.focus()
        return
      }

      if (activeSession && !activeSession.handled) {
        const committed = flushActiveCellMarkdown()
        if (committed !== currentMarkdown) {
          dispatchTableMarkdown(committed, { row: clampedRow, col: clampedCol })
          return
        }
      }

      const cellEl = cellElements[clampedRow]?.[clampedCol]
      if (!cellEl) return
      const initialValue =
        clampedRow === 0
          ? (grid.headers[clampedCol] ?? "")
          : (grid.rows[clampedRow - 1]?.[clampedCol] ?? "")

      const resizer =
        typeof cellEl.querySelector === "function"
          ? cellEl.querySelector(".cm-live-table-col-resizer")
          : null
      cellEl.textContent = ""
      const input = document.createElement("input")
      input.type = "text"
      input.className = "cm-live-table-cell-input"
      input.setAttribute("data-testid", "cm-live-table-cell-input")
      input.setAttribute("aria-label", "표 셀 편집")
      input.value = initialValue
      cellEl.appendChild(input)
      if (resizer) cellEl.appendChild(resizer)

      const session: ActiveCellEditorSession = {
        row: clampedRow,
        col: clampedCol,
        cellEl,
        input,
        initialValue,
        handled: false,
      }
      activeSession = session

      const stopBubble = (event: Event) => {
        event.stopPropagation()
      }
      for (const eventName of [
        "mousedown",
        "mouseup",
        "click",
        "dblclick",
        "input",
        "beforeinput",
        "paste",
        "compositionstart",
        "compositionend",
      ]) {
        input.addEventListener(eventName, stopBubble)
      }

      const commitAndCloseSession = () => {
        if (session.handled) return
        session.handled = true
        if (activeSession === session) activeSession = null
        const nextValue = input.value
        if (nextValue !== initialValue) {
          const updated = applyMarkdownTableGridCellEdit(
            currentMarkdown,
            clampedRow,
            clampedCol,
            nextValue
          )
          if (updated && updated !== currentMarkdown) {
            dispatchTableMarkdown(updated, {
              row: clampedRow,
              col: clampedCol,
              openEditor: false,
            })
            return
          }
        }
        restoreCellDisplay(cellEl, initialValue)
      }

      input.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation()
        if (event.isComposing || event.keyCode === 229) return

        if (event.key === "Tab") {
          event.preventDefault()
          executeGridAction(
            { kind: "tab", direction: event.shiftKey ? "previous" : "next" },
            clampedRow,
            clampedCol
          )
          return
        }

        const hasNoModifiers =
          !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey

        if (event.key === "Enter" && hasNoModifiers) {
          event.preventDefault()
          executeGridAction({ kind: "enter" }, clampedRow, clampedCol)
          return
        }

        if (
          event.key === "ArrowLeft" &&
          hasNoModifiers &&
          input.selectionStart === 0 &&
          input.selectionEnd === 0 &&
          (clampedRow > 0 || clampedCol > 0)
        ) {
          event.preventDefault()
          executeGridAction({ kind: "tab", direction: "previous" }, clampedRow, clampedCol)
          return
        }

        if (
          event.key === "ArrowRight" &&
          hasNoModifiers &&
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length &&
          (clampedRow < grid.rows.length || clampedCol < grid.headers.length - 1)
        ) {
          event.preventDefault()
          executeGridAction({ kind: "tab", direction: "next" }, clampedRow, clampedCol)
          return
        }

        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && hasNoModifiers) {
          event.preventDefault()
          const delta = event.key === "ArrowUp" ? -1 : 1
          const targetRow = Math.max(0, Math.min(grid.rows.length, clampedRow + delta))
          dispatchTableMarkdown(flushActiveCellMarkdown(), { row: targetRow, col: clampedCol })
          return
        }

        if (event.key === "Escape") {
          event.preventDefault()
          commitAndCloseSession()
        }
      })

      input.addEventListener("blur", () => {
        if (!input.isConnected) return
        commitAndCloseSession()
      })

      const focusInput = () => {
        if (session.handled) return
        try {
          input.focus()
          input.setSelectionRange(input.value.length, input.value.length)
        } catch {}
      }
      focusInput()
      if (typeof queueMicrotask === "function") {
        queueMicrotask(focusInput)
      }
    }

    const applyPendingCellActivation = () => {
      if (
        pendingTableCellActivation &&
        (currentFrom === undefined || pendingTableCellActivation.from === currentFrom)
      ) {
        const target = pendingTableCellActivation
        pendingTableCellActivation = null
        if (target.openEditor === false) {
          activeRow = Math.max(0, Math.min(target.row, grid.rows.length))
          activeCol = Math.max(0, Math.min(target.col, grid.headers.length - 1))
          syncActiveCellHighlight()
        } else {
          activateCellEditor(target.row, target.col)
        }
      }
    }

    const update = (
      nextMarkdown: string,
      nextFrom: number | undefined,
      nextTo: number | undefined
    ): boolean => {
      if (nextMarkdown === currentMarkdown) {
        currentFrom = nextFrom
        currentTo = nextTo
        syncTableFromDataset(wrap, currentFrom)
        applyPendingCellActivation()
        return true
      }

      const nextGrid = parseMarkdownTableGrid(nextMarkdown)
      if (
        nextGrid?.headers.length !== grid.headers.length ||
        nextGrid.rows.length !== grid.rows.length
      ) {
        return false
      }

      if (activeSession && !activeSession.handled) {
        activeSession.handled = true
        activeSession = null
      }

      patchTableCellsInPlace(cellElements, grid, nextGrid, restoreCellDisplay)

      grid.headers.splice(0, grid.headers.length, ...nextGrid.headers)
      grid.alignments.splice(0, grid.alignments.length, ...nextGrid.alignments)
      grid.rows.splice(
        0,
        grid.rows.length,
        ...nextGrid.rows.map((row) => [...row])
      )
      currentMarkdown = nextMarkdown
      currentFrom = nextFrom
      currentTo = nextTo
      syncTableFromDataset(wrap, currentFrom)
      syncActiveCellHighlight()
      applyPendingCellActivation()
      return true
    }

    tableDomControllers.set(wrap, { update })

    wrap.appendChild(toolbar)
    wrap.appendChild(gridRow)
    wrap.appendChild(addRowBtn)

    syncActiveCellHighlight()
    applyPendingCellActivation()

    return wrap
  }
}
