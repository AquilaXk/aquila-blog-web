import { EditorSelection, Transaction } from "@codemirror/state"
import { WidgetType, EditorView } from "@codemirror/view"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  applyMarkdownTableGridPaste,
  applyTableCellInlineFormat,
  parseMarkdownTableGrid,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
  type TableCellInlineFormatKind,
} from "./markdownEditorTableModel"
import {
  applyTableColumnWidthsAction,
  createInteractiveTableSurface,
  createTableToolbarElement,
  getOrCreateTableVisualOptions,
  migrateTableVisualOptionsOffset,
  renderStaticTableElement,
  syncTableColGroupWidths,
  syncTableVisualWrapAttributes,
} from "./markdownEditorTableWidgetDom"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

type PendingTableCellActivation = { from: number; row: number; col: number; openEditor?: boolean; mode?: "cell" | "row" | "col" }
type ActiveCellEditorSession = { row: number; col: number; cellEl: HTMLElement; input: HTMLInputElement; initialValue: string; handled: boolean }
type TableDomController = { update: (nextMarkdown: string, nextFrom: number | undefined, nextTo: number | undefined) => boolean; destroy: () => void }

let pendingTableCellActivation: PendingTableCellActivation | null = null
const tableDomControllers = new WeakMap<HTMLElement, TableDomController>()

const syncTableFromDataset = (wrap: HTMLElement, from: number | undefined) => {
  if (!wrap.dataset) return
  if (from !== undefined) wrap.dataset.tableFrom = String(from)
  else delete wrap.dataset.tableFrom
}
const readGridCellText = (grid: MarkdownTableGrid, r: number, c: number): string => (r === 0 ? (grid.headers[c] ?? "") : (grid.rows[r - 1]?.[c] ?? ""))

const patchSingleTableCell = (
  cellEl: HTMLElement, prevAlign: string, nextAlign: string, prevText: string, nextText: string,
  restoreCellDisplay: (el: HTMLElement, text: string) => void
) => {
  if (prevAlign !== nextAlign) {
    if (cellEl.style) cellEl.style.textAlign = nextAlign
    if (cellEl.dataset) cellEl.dataset.align = nextAlign
  }
  const hasInput = typeof cellEl.querySelector === "function" && cellEl.querySelector(".cm-live-table-cell-input") !== null
  if (prevText !== nextText || hasInput) restoreCellDisplay(cellEl, nextText)
}

const patchTableCellsInPlace = (
  cellElements: HTMLElement[][], grid: MarkdownTableGrid, nextGrid: MarkdownTableGrid,
  restoreCellDisplay: (el: HTMLElement, text: string) => void
) => {
  for (let r = 0; r <= nextGrid.rows.length; r += 1) {
    for (let c = 0; c < nextGrid.headers.length; c += 1) {
      const cellEl = cellElements[r]?.[c]
      if (!cellEl) continue
      patchSingleTableCell(cellEl, grid.alignments[c] ?? "left", nextGrid.alignments[c] ?? "left", readGridCellText(grid, r, c), readGridCellText(nextGrid, r, c), restoreCellDisplay)
    }
  }
}

export class MarkdownTableWidget extends WidgetType {
  constructor(private readonly markdown: string, private readonly from?: number, private readonly to?: number) {
    super()
  }

  eq(other: MarkdownTableWidget) {
    return other instanceof MarkdownTableWidget && other.markdown === this.markdown && other.from === this.from && other.to === this.to
  }

  ignoreEvent() {
    return true
  }

  updateDOM(dom: HTMLElement, _view: EditorView) {
    const controller = tableDomControllers.get(dom)
    return controller ? controller.update(this.markdown, this.from, this.to) : false
  }

  destroy(dom: HTMLElement) {
    tableDomControllers.get(dom)?.destroy()
    tableDomControllers.delete(dom)
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
    wrap.tabIndex = -1
    wrap.setAttribute("tabindex", "-1")
    if (wrap.dataset) wrap.dataset.testid = "cm-live-table-widget"
    syncTableFromDataset(wrap, currentFrom)
    const focusTableWrap = () => {
      try { wrap.focus({ preventScroll: true }) } catch {}
    }

    let visualOptions = getOrCreateTableVisualOptions(currentFrom ?? 0, grid.headers.length)
    syncTableVisualWrapAttributes(wrap, visualOptions)

    let activeRow = 0
    let activeCol = 0
    let selectedMode: "cell" | "row" | "col" = "cell"
    let isTableActive = false
    let outsideListenerAttached = false
    let activeSession: ActiveCellEditorSession | null = null

    const handleLifecycleFlush = () => flushAndDispatchActiveCell()

    const detachOutsideListener = () => {
      if (!outsideListenerAttached) return
      outsideListenerAttached = false
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("mousedown", handleOutsideInteraction, true)
        document.removeEventListener("focusin", handleOutsideInteraction, true)
      }
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("pagehide", handleLifecycleFlush)
        window.removeEventListener("beforeunload", handleLifecycleFlush)
      }
    }

    const handleOutsideInteraction = (event: Event) => {
      if (!wrap.isConnected) { flushAndDispatchActiveCell(); return detachOutsideListener() }
      const target = event.target as HTMLElement | null
      if (target && (target === wrap || (typeof wrap.contains === "function" && wrap.contains(target)) || target.closest?.(".cm-live-table-wrap") === wrap)) return
      flushAndDispatchActiveCell()
      if (target?.closest?.("[data-table-popover]")) return
      isTableActive = false
      detachOutsideListener()
      syncActiveCellHighlight()
    }

    const markTableActive = () => {
      isTableActive = true
      if (!outsideListenerAttached) {
        outsideListenerAttached = true
        if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
          document.addEventListener("mousedown", handleOutsideInteraction, true)
          document.addEventListener("focusin", handleOutsideInteraction, true)
        }
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
          window.addEventListener("pagehide", handleLifecycleFlush)
          window.addEventListener("beforeunload", handleLifecycleFlush)
        }
      }
      if (typeof view.state.doc?.lineAt !== "function") return
      const range = resolveRange()
      const mainSel = view.state.selection.main
      if (!range || mainSel.from !== mainSel.to || view.state.doc.lineAt(mainSel.from).length === 0) return
      if (range.from > 0 && view.state.doc.lineAt(range.from - 1).length === 0) {
        view.dispatch({ selection: EditorSelection.cursor(range.from - 1) })
      } else if (range.to < view.state.doc.length && view.state.doc.lineAt(range.to + 1).length === 0) {
        view.dispatch({ selection: EditorSelection.cursor(range.to + 1) })
      }
    }

    const resolveRange = (): { from: number; to: number } | null => {
      let resolvedFrom = currentFrom
      try {
        const domPos = view.posAtDOM(wrap)
        if (typeof domPos === "number" && domPos >= 0) resolvedFrom = domPos
      } catch {}
      if (resolvedFrom === undefined) return null
      const docLen = view.state.doc.length
      const from = Math.max(0, Math.min(resolvedFrom, docLen))
      const span = currentFrom !== undefined && currentTo !== undefined ? Math.max(0, currentTo - currentFrom) : currentMarkdown.length
      return { from, to: Math.max(from, Math.min(from + span, docLen)) }
    }

    const getPreservedCellControls = (cellEl: HTMLElement): HTMLElement[] =>
      typeof cellEl.querySelector !== "function"
        ? []
        : [
            cellEl.querySelector<HTMLElement>(".cm-live-table-col-handle"),
            cellEl.querySelector<HTMLElement>(".cm-live-table-row-handle"),
            cellEl.querySelector<HTMLElement>(".cm-live-table-col-resizer"),
          ].filter((el): el is HTMLElement => el !== null)

    const restoreCellDisplay = (cellEl: HTMLElement, rawText: string) => {
      const controls = getPreservedCellControls(cellEl)
      cellEl.textContent = ""
      appendInlineMarkdownNodes(cellEl, rawText)
      for (const control of controls) cellEl.appendChild(control)
    }

    const flushActiveCellMarkdown = (): string => {
      if (!activeSession || activeSession.handled) return currentMarkdown
      const session = activeSession
      session.handled = true
      activeSession = null
      const nextValue = session.input.value
      restoreCellDisplay(session.cellEl, nextValue)
      if (nextValue === session.initialValue) return currentMarkdown
      return applyMarkdownTableGridCellEdit(currentMarkdown, session.row, session.col, nextValue) ?? currentMarkdown
    }

    const flushAndDispatchActiveCell = () => {
      if (!activeSession || activeSession.handled) return
      const committed = flushActiveCellMarkdown()
      if (committed !== currentMarkdown) dispatchTableMarkdown(committed)
    }

    const executeGridAction = (action: MarkdownTableGridAction, rowOverride = activeRow, colOverride = activeCol, openEditor?: boolean) => {
      if (!view.state.facet(EditorView.editable)) return
      markTableActive()
      const baseMarkdown = flushActiveCellMarkdown()
      const outcome = applyMarkdownTableGridAction(baseMarkdown, rowOverride, colOverride, action)
      if (!outcome) {
        if (baseMarkdown !== currentMarkdown) dispatchTableMarkdown(baseMarkdown, { row: rowOverride, col: colOverride, openEditor: false })
        return
      }
      applyTableColumnWidthsAction(visualOptions.columnWidths, grid.headers.length, colOverride, action)
      activeRow = outcome.nextRow
      activeCol = outcome.nextCol
      syncActiveCellHighlight()
      dispatchTableMarkdown(outcome.markdown, {
        row: outcome.nextRow, col: outcome.nextCol, openEditor: openEditor ?? (selectedMode === "cell" ? undefined : false),
      })
    }

    const selectColumn = (col: number) => {
      if (!view.state.facet(EditorView.editable)) return
      markTableActive()
      const committed = flushActiveCellMarkdown()
      activeCol = Math.max(0, Math.min(col, grid.headers.length - 1))
      selectedMode = "col"
      syncActiveCellHighlight()
      focusTableWrap()
      if (committed !== currentMarkdown) dispatchTableMarkdown(committed, { row: activeRow, col: activeCol, openEditor: false })
    }

    const selectRow = (row: number) => {
      if (!view.state.facet(EditorView.editable)) return
      markTableActive()
      const committed = flushActiveCellMarkdown()
      activeRow = Math.max(0, Math.min(row, grid.rows.length))
      selectedMode = "row"
      syncActiveCellHighlight()
      focusTableWrap()
      if (committed !== currentMarkdown) dispatchTableMarkdown(committed, { row: activeRow, col: activeCol, openEditor: false })
    }

    const { toolbar, toolbarButtons, canAddRow, canAddCol } = createTableToolbarElement({
      grid, wrap, visualOptions,
      executeGridAction: (action) => executeGridAction(action),
      onActivateToolbar: () => { markTableActive(); syncActiveCellHighlight() },
      onEditSource: () => {
        flushAndDispatchActiveCell()
        const range = resolveRange()
        if (!range) return
        view.focus()
        view.dispatch({ selection: EditorSelection.cursor(Math.min(range.to, range.from + 2)), scrollIntoView: true })
      },
      onDeleteTable: () => {
        const range = view.state.facet(EditorView.editable) ? resolveRange() : null
        if (!range) return
        view.dispatch({ changes: { from: range.from, to: range.to, insert: "" }, selection: EditorSelection.cursor(range.from), annotations: [Transaction.userEvent.of("delete")] })
      },
    })

    const buildSurface = () =>
      createInteractiveTableSurface({
        grid, visualOptions, canAddCol, canAddRow,
        onActivateCell: (row, col) => activateCellEditor(row, col),
        onAddColumn: () => executeGridAction({ kind: "add-column" }, activeRow, grid.headers.length - 1),
        onAddRow: () => executeGridAction({ kind: "add-row" }, grid.rows.length, 0),
        onAddRowAndColumn: () => executeGridAction({ kind: "add-row-and-column" }, grid.rows.length, grid.headers.length - 1),
        onSelectColumn: (col) => selectColumn(col),
        onSelectRow: (row) => selectRow(row),
        onMoveColumnTo: (fromCol, toCol) => { selectedMode = "col"; executeGridAction({ kind: "move-column-to", targetCol: toCol }, activeRow, fromCol, false) },
        onMoveRowTo: (fromRow, toRow) => { selectedMode = "row"; executeGridAction({ kind: "move-row-to", targetRow: toRow }, fromRow, activeCol, false) },
      })

    let { gridRow, addRowBtn, cellElements, colElements } = buildSurface()

    const syncActiveCellHighlight = () => {
      if (isTableActive) {
        wrap.dataset.activeMode = selectedMode; wrap.dataset.activeRow = String(activeRow); wrap.dataset.activeCol = String(activeCol)
      } else {
        delete wrap.dataset.activeMode; delete wrap.dataset.activeRow; delete wrap.dataset.activeCol
      }
      for (let r = 0; r < cellElements.length; r += 1) {
        const rowEls = cellElements[r]!
        for (let c = 0; c < rowEls.length; c += 1) {
          const el = rowEls[c]!
          if (isTableActive && r === activeRow && c === activeCol) el.classList.add("is-active-cell")
          else el.classList.remove("is-active-cell")
          if (isTableActive && selectedMode === "col" && c === activeCol) el.classList.add("is-selected-col")
          else el.classList.remove("is-selected-col")
          if (isTableActive && selectedMode === "row" && r === activeRow) el.classList.add("is-selected-row")
          else el.classList.remove("is-selected-row")
        }
      }
      const currentAlign = grid.alignments[activeCol] ?? "left"
      for (const entry of toolbarButtons) {
        if (entry.isDisabled) entry.button.disabled = entry.isDisabled(activeRow, activeCol)
        if (entry.align) entry.button.setAttribute("aria-pressed", String(entry.align === currentAlign))
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
        pendingTableCellActivation = { from: range.from, row: targetCell.row, col: targetCell.col, openEditor: targetCell.openEditor, mode: selectedMode }
      }
      const mainSel = view.state.selection.main
      const overlaps = mainSel.from >= range.from && mainSel.from <= range.to
      const canParkBefore = range.from > 0 && view.state.doc.lineAt?.(range.from - 1).length === 0
      const canParkAfter = range.to < view.state.doc.length && view.state.doc.lineAt?.(range.to + 1).length === 0
      let safeAnchor: number | undefined
      if (canParkBefore) safeAnchor = range.from - 1
      else if (canParkAfter) safeAnchor = range.from + nextMarkdown.length + 1
      else if (range.from > 0) safeAnchor = range.from - 1
      else if (range.to < view.state.doc.length) safeAnchor = range.from + nextMarkdown.length + 1

      view.dispatch({
        changes: { from: range.from, to: range.to, insert: nextMarkdown },
        ...(overlaps && safeAnchor !== undefined ? { selection: EditorSelection.cursor(safeAnchor) } : {}),
        annotations: [Transaction.userEvent.of("input")],
      })
      if (currentMarkdown !== nextMarkdown) update(nextMarkdown, range.from, range.from + nextMarkdown.length)
    }

    const activateCellEditor = (row: number, col: number) => {
      if (!view.state.facet(EditorView.editable)) return
      markTableActive()
      const clampedRow = Math.max(0, Math.min(row, grid.rows.length))
      const clampedCol = Math.max(0, Math.min(col, grid.headers.length - 1))
      activeRow = clampedRow
      activeCol = clampedCol
      selectedMode = "cell"
      syncActiveCellHighlight()

      if (activeSession && !activeSession.handled && activeSession.row === clampedRow && activeSession.col === clampedCol) {
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
      const initialValue = clampedRow === 0 ? (grid.headers[clampedCol] ?? "") : (grid.rows[clampedRow - 1]?.[clampedCol] ?? "")

      const controls = getPreservedCellControls(cellEl)
      cellEl.textContent = ""
      const input = document.createElement("input")
      input.type = "text"
      input.className = "cm-live-table-cell-input"
      input.setAttribute("data-testid", "cm-live-table-cell-input")
      input.setAttribute("aria-label", "표 셀 편집")
      input.value = initialValue
      cellEl.appendChild(input)
      for (const control of controls) cellEl.appendChild(control)

      const session: ActiveCellEditorSession = { row: clampedRow, col: clampedCol, cellEl, input, initialValue, handled: false }
      activeSession = session

      const stopBubble = (event: Event) => event.stopPropagation()
      for (const eventName of ["mousedown", "mouseup", "click", "dblclick", "input", "beforeinput", "compositionstart", "compositionend"]) {
        input.addEventListener(eventName, stopBubble)
      }

      input.addEventListener("paste", (event: ClipboardEvent) => {
        event.stopPropagation()
        const pastedText = event.clipboardData?.getData("text/plain") ?? ""
        if (!pastedText.includes("\t") && !pastedText.includes("\n") && !pastedText.includes("\r")) return
        const baseMarkdown =
          input.value !== initialValue
            ? (applyMarkdownTableGridCellEdit(currentMarkdown, clampedRow, clampedCol, input.value) ?? currentMarkdown)
            : currentMarkdown
        const outcome = applyMarkdownTableGridPaste(baseMarkdown, clampedRow, clampedCol, pastedText)
        if (!outcome) return
        event.preventDefault()
        session.handled = true
        if (activeSession === session) activeSession = null
        const nextGrid = parseMarkdownTableGrid(outcome.markdown)
        if (nextGrid) {
          while (visualOptions.columnWidths.length < nextGrid.headers.length) visualOptions.columnWidths.push(0)
        }
        activeRow = outcome.nextRow
        activeCol = outcome.nextCol
        dispatchTableMarkdown(outcome.markdown, { row: outcome.nextRow, col: outcome.nextCol, openEditor: false })
      })

      const commitAndCloseSession = (focusWrapAfter = false) => {
        if (session.handled) return
        const committed = flushActiveCellMarkdown()
        if (committed !== currentMarkdown) {
          dispatchTableMarkdown(
            committed,
            focusWrapAfter ? { row: clampedRow, col: clampedCol, openEditor: false } : undefined
          )
        }
        if (focusWrapAfter) focusTableWrap()
      }

      input.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation()
        if (event.isComposing || event.keyCode === 229) return

        const applyInlineShortcut = (kind: TableCellInlineFormatKind) => {
          event.preventDefault()
          const res = applyTableCellInlineFormat(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, kind)
          input.value = res.value
          try { input.setSelectionRange(res.selectionStart, res.selectionEnd) } catch {}
        }

        if (event.key === "Enter" && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) return applyInlineShortcut("line-break")
        if ((event.metaKey || event.ctrlKey) && !event.altKey) {
          const lowerKey = event.key.toLowerCase()
          if (!event.shiftKey && lowerKey === "b") return applyInlineShortcut("bold")
          if (!event.shiftKey && lowerKey === "i") return applyInlineShortcut("italic")
          if (!event.shiftKey && lowerKey === "e") return applyInlineShortcut("code")
          if (event.shiftKey && (lowerKey === "x" || lowerKey === "s")) return applyInlineShortcut("strikethrough")
        }
        if (event.key === "Tab") {
          event.preventDefault()
          return executeGridAction({ kind: "tab", direction: event.shiftKey ? "previous" : "next" }, clampedRow, clampedCol)
        }
        const hasNoModifiers = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey
        if (event.key === "Enter" && hasNoModifiers) {
          event.preventDefault()
          return executeGridAction({ kind: "enter" }, clampedRow, clampedCol)
        }
        if (event.key === "ArrowLeft" && hasNoModifiers && input.selectionStart === 0 && input.selectionEnd === 0 && (clampedRow > 0 || clampedCol > 0)) {
          event.preventDefault()
          return executeGridAction({ kind: "tab", direction: "previous" }, clampedRow, clampedCol)
        }
        if (event.key === "ArrowRight" && hasNoModifiers && input.selectionStart === input.value.length && input.selectionEnd === input.value.length && (clampedRow < grid.rows.length || clampedCol < grid.headers.length - 1)) {
          event.preventDefault()
          return executeGridAction({ kind: "tab", direction: "next" }, clampedRow, clampedCol)
        }
        if ((event.key === "ArrowUp" || event.key === "ArrowDown") && hasNoModifiers) {
          event.preventDefault()
          const targetRow = Math.max(0, Math.min(grid.rows.length, clampedRow + (event.key === "ArrowUp" ? -1 : 1)))
          return dispatchTableMarkdown(flushActiveCellMarkdown(), { row: targetRow, col: clampedCol })
        }
        if (event.key === "Escape") {
          event.preventDefault()
          commitAndCloseSession(true)
        }
      })

      input.addEventListener("blur", () => commitAndCloseSession())

      const focusInput = () => {
        if (session.handled) return
        try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); input.scrollLeft = 0 } catch {}
      }
      focusInput()
      if (typeof queueMicrotask === "function") queueMicrotask(focusInput)
    }

    const applyPendingCellActivation = () => {
      if (!pendingTableCellActivation || (currentFrom !== undefined && pendingTableCellActivation.from !== currentFrom)) return
      const target = pendingTableCellActivation
      pendingTableCellActivation = null
      markTableActive()
      if (target.openEditor === false) {
        activeRow = Math.max(0, Math.min(target.row, grid.rows.length))
        activeCol = Math.max(0, Math.min(target.col, grid.headers.length - 1))
        if (target.mode) selectedMode = target.mode
        syncActiveCellHighlight()
        focusTableWrap()
        if (typeof queueMicrotask === "function") queueMicrotask(focusTableWrap)
      } else {
        activateCellEditor(target.row, target.col)
      }
    }

    const update = (nextMarkdown: string, nextFrom: number | undefined, nextTo: number | undefined): boolean => {
      if (nextMarkdown === currentMarkdown) {
        visualOptions = migrateTableVisualOptionsOffset(currentFrom, nextFrom, grid.headers.length, visualOptions)
        currentFrom = nextFrom
        currentTo = nextTo
        syncTableFromDataset(wrap, currentFrom)
        applyPendingCellActivation()
        return true
      }

      const nextGrid = parseMarkdownTableGrid(nextMarkdown)
      if (!nextGrid) return false
      visualOptions = migrateTableVisualOptionsOffset(currentFrom, nextFrom, nextGrid.headers.length, visualOptions)

      if (activeSession && !activeSession.handled) {
        activeSession.handled = true
        activeSession = null
      }

      const sameShape = nextGrid.headers.length === grid.headers.length && nextGrid.rows.length === grid.rows.length
      if (sameShape) {
        patchTableCellsInPlace(cellElements, grid, nextGrid, restoreCellDisplay)
        syncTableColGroupWidths(colElements, visualOptions.columnWidths)
      }

      grid.headers.splice(0, grid.headers.length, ...nextGrid.headers)
      grid.alignments.splice(0, grid.alignments.length, ...nextGrid.alignments)
      grid.rows.splice(0, grid.rows.length, ...nextGrid.rows.map((row) => [...row]))

      if (!sameShape) {
        while (visualOptions.columnWidths.length < grid.headers.length) visualOptions.columnWidths.push(0)
        if (visualOptions.columnWidths.length > grid.headers.length) visualOptions.columnWidths.length = grid.headers.length
        ;({ gridRow, addRowBtn, cellElements, colElements } = buildSurface())
        wrap.textContent = ""
        for (const el of [toolbar, gridRow, addRowBtn]) wrap.appendChild(el)
      }

      activeRow = Math.max(0, Math.min(activeRow, grid.rows.length))
      activeCol = Math.max(0, Math.min(activeCol, grid.headers.length - 1))
      currentMarkdown = nextMarkdown
      currentFrom = nextFrom
      currentTo = nextTo
      syncTableFromDataset(wrap, currentFrom)
      syncActiveCellHighlight()
      applyPendingCellActivation()
      return true
    }

    wrap.addEventListener("keydown", (event: KeyboardEvent) => {
      if (!isTableActive || (activeSession && !activeSession.handled)) return
      const stop = () => { event.preventDefault(); event.stopPropagation() }
      if (event.key === "Escape") { stop(); isTableActive = false; detachOutsideListener(); return syncActiveCellHighlight() }
      if (event.key === "Enter" || event.key === "F2") { stop(); return activateCellEditor(activeRow, activeCol) }
      if (event.key === "Tab") { stop(); selectedMode = "cell"; return executeGridAction({ kind: "tab", direction: event.shiftKey ? "previous" : "next" }, activeRow, activeCol, false) }
      if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
        stop()
        if (event.key === "ArrowUp") activeRow = Math.max(0, activeRow - 1)
        else if (event.key === "ArrowDown") activeRow = Math.min(grid.rows.length, activeRow + 1)
        else if (event.key === "ArrowLeft") activeCol = Math.max(0, activeCol - 1)
        else activeCol = Math.min(grid.headers.length - 1, activeCol + 1)
        selectedMode = "cell"
        return syncActiveCellHighlight()
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        stop()
        if (selectedMode === "row") return executeGridAction({ kind: "clear-row" }, activeRow, activeCol, false)
        if (selectedMode === "col") return executeGridAction({ kind: "clear-column" }, activeRow, activeCol, false)
        const cleared = applyMarkdownTableGridCellEdit(currentMarkdown, activeRow, activeCol, "")
        if (cleared && cleared !== currentMarkdown) dispatchTableMarkdown(cleared, { row: activeRow, col: activeCol, openEditor: false })
        return
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === " ") event.preventDefault()
        event.stopPropagation()
        activateCellEditor(activeRow, activeCol)
      }
    })

    tableDomControllers.set(wrap, {
      update,
      destroy: () => { flushAndDispatchActiveCell(); detachOutsideListener() },
    })
    for (const el of [toolbar, gridRow, addRowBtn]) wrap.appendChild(el)
    syncActiveCellHighlight()
    applyPendingCellActivation()
    return wrap
  }
}
