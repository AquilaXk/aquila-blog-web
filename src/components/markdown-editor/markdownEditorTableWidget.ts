import { EditorView, WidgetType } from "@codemirror/view"
import {
  applyMarkdownTableGridAction, applyMarkdownTableGridCellEdit, parseMarkdownTableGrid,
  type MarkdownTableGrid, type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import { getTableGridLayoutMeta, hasLeadingAqTableComment, hydrateVisualOptionsIntoTarget } from "./markdownEditorTableMetadataModel"
import {
  appendTableWrapChildren, applyVisualOptionsToTableMarkdown, createOutsideTableListenerGuard,
  dispatchDeleteTableRange, dispatchEditSourceSelection, dispatchTableMarkdownChange,
  getPreservedCellControls, isEventInsideTableWrap, parkSelectionOutsideActiveTable,
  patchTableCellsInPlace, replaceGridContentsInPlace, resolveTableWidgetRange, restoreCellDisplay,
  syncCellHighlightClasses, syncColumnWidthsToGrid, syncHydratedOptionsOnMarkdownUpdate,
  syncTableActiveDataset, syncTableFromDataset, syncToolbarButtonStates,
} from "./markdownEditorTablePatchDom"
import {
  attachImeProxyListeners, attachWrapSurfaceListeners, createTableImeProxyElement,
  focusElementPreventScroll, openTableCellEditorSession,
  type ActiveCellEditorSession, type ImeProxyController, type TableCellTarget, type TableSelectionMode, type TableSurfaceInteractionParams,
} from "./markdownEditorTableSessionDom"
import {
  applyTableColumnWidthsAction, createInteractiveTableSurface, createTableToolbarElement,
  getOrCreateTableVisualOptions, migrateTableVisualOptionsOffset, renderStaticTableElement,
  syncTableColGroupWidths, syncTableVisualWrapAttributes, type TableVisualOptions,
} from "./markdownEditorTableWidgetDom"

type PendingTableCellActivation = {
  from: number; row: number; col: number; openEditor?: boolean; mode?: TableSelectionMode
}

let pendingTableCellActivation: PendingTableCellActivation | null = null
const tableDomControllers = new WeakMap<HTMLElement, TableWidgetController>()

class TableWidgetController implements TableSurfaceInteractionParams {
  visualOptions: TableVisualOptions
  private currentMarkdown: string
  private currentFrom: number | undefined
  private currentTo: number | undefined
  private activeRow = 0
  private activeCol = 0
  private selectedMode: TableSelectionMode = "cell"
  private tableActive = false
  private activeSession: ActiveCellEditorSession | null = null
  private imeProxy: HTMLTextAreaElement | null = null
  private imeProxyController: ImeProxyController | null = null
  private readonly tb: ReturnType<typeof createTableToolbarElement>
  private surface: ReturnType<typeof createInteractiveTableSurface>
  private readonly outsideGuard = createOutsideTableListenerGuard(
    (event) => this.handleOutsideInteraction(event),
    () => this.flushAndDispatchActiveCell()
  )

  constructor(
    readonly wrap: HTMLElement,
    private readonly view: EditorView,
    readonly grid: MarkdownTableGrid,
    markdown: string,
    from: number | undefined,
    to: number | undefined
  ) {
    this.currentMarkdown = markdown
    this.currentFrom = from
    this.currentTo = to
    wrap.tabIndex = -1
    wrap.setAttribute("tabindex", "-1")
    if (wrap.dataset) wrap.dataset.testid = "cm-live-table-widget"
    syncTableFromDataset(wrap, from)

    this.visualOptions = getOrCreateTableVisualOptions(from ?? 0, grid.headers.length, view)
    if (hasLeadingAqTableComment(markdown)) {
      hydrateVisualOptionsIntoTarget(this.visualOptions, getTableGridLayoutMeta(grid), grid.headers.length)
    }
    syncTableVisualWrapAttributes(wrap, this.visualOptions)

    this.tb = this.initToolbar()
    this.surface = this.buildSurface()
    if (this.isEditable()) {
      this.imeProxy = createTableImeProxyElement()
      this.imeProxyController = attachImeProxyListeners(this.imeProxy, this)
    }
    appendTableWrapChildren(wrap, this.tb.toolbar, this.surface.gridRow, this.surface.addRowBtn, this.imeProxy)
    attachWrapSurfaceListeners(this)
    wrap.addEventListener("focus", (event: FocusEvent) => {
      if (event.target === this.wrap && this.tableActive && !this.hasOpenEditorSession() && this.isEditable()) {
        this.focusSelectedTableTarget()
      }
    })
    this.syncActiveCellHighlight()
    this.applyPendingCellActivation()
  }

  readonly getImeProxy = () => this.imeProxy
  readonly getActiveSession = () => this.activeSession
  readonly flushActiveSession = () => this.flushAndDispatchActiveCell()
  readonly isEditable = () => Boolean(this.view.state.facet(EditorView.editable))
  readonly isTableActive = () => this.tableActive
  readonly hasOpenEditorSession = () => Boolean(this.activeSession && !this.activeSession.handled)
  readonly getCurrentMarkdown = () => this.currentMarkdown
  readonly getSelectionState = () => ({ row: this.activeRow, col: this.activeCol, mode: this.selectedMode })

  readonly setSelectionState = (next: { row?: number; col?: number; mode?: TableSelectionMode }) => {
    if (next.row !== undefined) this.activeRow = next.row
    if (next.col !== undefined) this.activeCol = next.col
    if (next.mode !== undefined) this.selectedMode = next.mode
  }

  private ensureImeProxy(): HTMLTextAreaElement {
    if (!this.imeProxy) {
      this.imeProxy = createTableImeProxyElement()
      this.imeProxyController = attachImeProxyListeners(this.imeProxy, this)
      this.wrap.appendChild(this.imeProxy)
    }
    return this.imeProxy
  }

  readonly focusSelectedTableTarget = () => {
    if (this.isEditable() && this.tableActive && this.activeRow >= 0 && this.activeCol >= 0 && !this.hasOpenEditorSession()) {
      focusElementPreventScroll(this.ensureImeProxy())
      return
    }
    focusElementPreventScroll(this.wrap)
  }

  private resolveRange() {
    return resolveTableWidgetRange(this.view, this.wrap, this.currentFrom, this.currentTo, this.currentMarkdown.length)
  }

  private readonly flushActiveCellMarkdown = (): string => {
    this.imeProxyController?.cancelPendingProxyHandoff(true)
    if (!this.activeSession || this.activeSession.handled) return this.currentMarkdown
    const session = this.activeSession
    session.handled = true
    this.activeSession = null
    const nextValue = session.input.value
    restoreCellDisplay(session.cellEl, nextValue)
    if (nextValue === session.initialValue) return this.currentMarkdown
    return applyMarkdownTableGridCellEdit(this.currentMarkdown, session.row, session.col, nextValue) ?? this.currentMarkdown
  }

  private flushAndDispatchActiveCell() {
    if (!this.activeSession || this.activeSession.handled) return
    const committed = this.flushActiveCellMarkdown()
    if (committed !== this.currentMarkdown) this.dispatchTableMarkdown(committed)
  }

  readonly deactivateTable = () => {
    this.tableActive = false
    this.outsideGuard.detach()
    this.syncActiveCellHighlight()
  }

  private handleOutsideInteraction(event: Event) {
    if (!this.wrap.isConnected) {
      this.flushAndDispatchActiveCell()
      this.outsideGuard.detach()
      return
    }
    const target = event.target as HTMLElement | null
    if (isEventInsideTableWrap(this.wrap, target)) return
    this.flushAndDispatchActiveCell()
    if (target?.closest?.("[data-table-popover]")) return
    this.deactivateTable()
  }

  private markTableActive() {
    this.tableActive = true
    this.outsideGuard.attach()
    parkSelectionOutsideActiveTable(this.view, this.resolveRange())
  }

  readonly executeGridAction = (
    action: MarkdownTableGridAction,
    rowOverride = this.activeRow,
    colOverride = this.activeCol,
    openEditor?: boolean
  ) => {
    if (!this.isEditable()) return
    this.markTableActive()
    const baseMarkdown = this.flushActiveCellMarkdown()
    const outcome = applyMarkdownTableGridAction(baseMarkdown, rowOverride, colOverride, action)
    if (!outcome) {
      if (baseMarkdown !== this.currentMarkdown) {
        this.dispatchTableMarkdown(baseMarkdown, { row: rowOverride, col: colOverride, openEditor: false })
      }
      return
    }
    applyTableColumnWidthsAction(this.visualOptions.columnWidths, this.grid.headers.length, colOverride, action)
    this.activeRow = outcome.nextRow
    this.activeCol = outcome.nextCol
    this.syncActiveCellHighlight()
    const resolvedOpenEditor = openEditor ?? (this.selectedMode === "cell" ? undefined : false)
    this.dispatchTableMarkdown(outcome.markdown, {
      row: outcome.nextRow, col: outcome.nextCol, openEditor: resolvedOpenEditor,
    })
  }

  private selectAxis(mode: "row" | "col", index: number) {
    if (!this.isEditable()) return
    this.markTableActive()
    const committed = this.flushActiveCellMarkdown()
    if (mode === "col") this.activeCol = Math.max(0, Math.min(index, this.grid.headers.length - 1))
    else this.activeRow = Math.max(0, Math.min(index, this.grid.rows.length))
    this.selectedMode = mode
    this.syncActiveCellHighlight()
    this.focusSelectedTableTarget()
    if (committed !== this.currentMarkdown) {
      this.dispatchTableMarkdown(committed, { row: this.activeRow, col: this.activeCol, openEditor: false })
    }
  }

  private readonly persistVisualOptions = () => {
    if (!this.isEditable()) return
    this.markTableActive()
    this.dispatchTableMarkdown(applyVisualOptionsToTableMarkdown(this.flushActiveCellMarkdown(), this.visualOptions))
  }

  private initToolbar() {
    return createTableToolbarElement({
      grid: this.grid,
      wrap: this.wrap,
      visualOptions: this.visualOptions,
      isEditable: this.isEditable,
      executeGridAction: (action) => this.executeGridAction(action),
      onActivateToolbar: () => {
        if (!this.isEditable()) return
        this.markTableActive()
        this.syncActiveCellHighlight()
        if (!this.hasOpenEditorSession()) this.focusSelectedTableTarget()
      },
      onVisualOptionsChange: this.persistVisualOptions,
      onEditSource: () => {
        if (!this.isEditable()) return
        this.flushAndDispatchActiveCell()
        const range = this.resolveRange()
        if (range) dispatchEditSourceSelection(this.view, range)
      },
      onDeleteTable: () => {
        const range = this.isEditable() ? this.resolveRange() : null
        if (range) dispatchDeleteTableRange(this.view, range)
      },
    })
  }

  private buildSurface() {
    return createInteractiveTableSurface({
      grid: this.grid,
      visualOptions: this.visualOptions,
      canAddCol: this.tb.canAddCol,
      canAddRow: this.tb.canAddRow,
      isEditable: this.isEditable,
      onActivateCell: (row, col) => this.activateCellEditor(row, col),
      onAddColumn: () => this.executeGridAction({ kind: "add-column" }, this.activeRow, this.grid.headers.length - 1),
      onAddRow: () => this.executeGridAction({ kind: "add-row" }, this.grid.rows.length, 0),
      onAddRowAndColumn: () => this.executeGridAction({ kind: "add-row-and-column" }, this.grid.rows.length, this.grid.headers.length - 1),
      onSelectColumn: (col) => this.selectAxis("col", col),
      onSelectRow: (row) => this.selectAxis("row", row),
      onMoveColumnTo: (fromCol, toCol) => {
        this.selectedMode = "col"
        this.executeGridAction({ kind: "move-column-to", targetCol: toCol }, this.activeRow, fromCol, false)
      },
      onMoveRowTo: (fromRow, toRow) => {
        this.selectedMode = "row"
        this.executeGridAction({ kind: "move-row-to", targetRow: toRow }, fromRow, this.activeCol, false)
      },
      onVisualOptionsChange: this.persistVisualOptions,
    })
  }

  readonly syncActiveCellHighlight = () => {
    syncTableActiveDataset(this.wrap, this.tableActive, this.selectedMode, this.activeRow, this.activeCol)
    syncCellHighlightClasses(this.surface.cellElements, this.tableActive, this.selectedMode, this.activeRow, this.activeCol)
    syncToolbarButtonStates(this.tb.toolbarButtons, this.grid.alignments[this.activeCol] ?? "left", this.activeRow, this.activeCol)
  }

  private applyTargetCellWithoutMutation(targetCell: TableCellTarget) {
    if (targetCell.openEditor === false) {
      this.activeRow = Math.max(0, Math.min(targetCell.row, this.grid.rows.length))
      this.activeCol = Math.max(0, Math.min(targetCell.col, this.grid.headers.length - 1))
      this.syncActiveCellHighlight()
      this.focusSelectedTableTarget()
      return
    }
    this.activateCellEditor(targetCell.row, targetCell.col)
  }

  readonly dispatchTableMarkdown = (nextMarkdown: string, targetCell?: TableCellTarget) => {
    const range = this.resolveRange()
    if (!range) return
    if (nextMarkdown === this.currentMarkdown) {
      if (targetCell) this.applyTargetCellWithoutMutation(targetCell)
      return
    }
    if (targetCell) {
      pendingTableCellActivation = {
        from: range.from, row: targetCell.row, col: targetCell.col, openEditor: targetCell.openEditor, mode: this.selectedMode,
      }
    }
    dispatchTableMarkdownChange(this.view, range, nextMarkdown)
    if (this.currentMarkdown !== nextMarkdown) {
      this.update(nextMarkdown, range.from, range.from + nextMarkdown.length)
    }
  }

  readonly activateCellEditor = (row: number, col: number, initialText?: string, deferFocus = false) => {
    if (!this.isEditable()) return
    this.markTableActive()
    const r = Math.max(0, Math.min(row, this.grid.rows.length))
    const c = Math.max(0, Math.min(col, this.grid.headers.length - 1))
    this.activeRow = r
    this.activeCol = c
    this.selectedMode = "cell"
    this.syncActiveCellHighlight()
    if (this.focusMatchingOpenSession(r, c, deferFocus) || this.flushNonMatchingOpenSession(r, c)) return
    const cellEl = this.surface.cellElements[r]?.[c]
    if (!cellEl) return
    this.activeSession = openTableCellEditorSession({
      cellEl,
      preservedControls: getPreservedCellControls(cellEl),
      grid: this.grid,
      visualOptions: this.visualOptions,
      row: r,
      col: c,
      initialText,
      deferFocus,
      getCurrentMarkdown: this.getCurrentMarkdown,
      clearActiveSessionIfMatch: (s) => {
        if (this.activeSession === s) this.activeSession = null
      },
      setActiveCoordinates: (nr, nc) => {
        this.activeRow = nr
        this.activeCol = nc
      },
      flushActiveCellMarkdown: this.flushActiveCellMarkdown,
      dispatchTableMarkdown: this.dispatchTableMarkdown,
      executeGridAction: this.executeGridAction,
      focusSelectedTableTarget: this.focusSelectedTableTarget,
    })
  }

  private focusMatchingOpenSession(row: number, col: number, deferFocus = false): boolean {
    if (!this.activeSession || this.activeSession.handled || this.activeSession.row !== row || this.activeSession.col !== col) return false
    if (!deferFocus) {
      this.imeProxyController?.cancelPendingProxyHandoff(true)
      focusElementPreventScroll(this.activeSession.input)
    }
    return true
  }

  private flushNonMatchingOpenSession(nextRow: number, nextCol: number): boolean {
    if (!this.activeSession || this.activeSession.handled) return false
    const committed = this.flushActiveCellMarkdown()
    if (committed === this.currentMarkdown) return false
    this.dispatchTableMarkdown(committed, { row: nextRow, col: nextCol })
    return true
  }

  private applyPendingCellActivation() {
    if (!pendingTableCellActivation || (this.currentFrom !== undefined && pendingTableCellActivation.from !== this.currentFrom)) return
    const target = pendingTableCellActivation
    pendingTableCellActivation = null
    this.markTableActive()
    if (target.openEditor === false) {
      this.activeRow = Math.max(0, Math.min(target.row, this.grid.rows.length))
      this.activeCol = Math.max(0, Math.min(target.col, this.grid.headers.length - 1))
      if (target.mode) this.selectedMode = target.mode
      this.syncActiveCellHighlight()
      this.focusSelectedTableTarget()
      if (typeof queueMicrotask === "function") queueMicrotask(this.focusSelectedTableTarget)
      return
    }
    this.activateCellEditor(target.row, target.col)
  }

  update(nextMarkdown: string, nextFrom: number | undefined, nextTo: number | undefined): boolean {
    if (nextMarkdown === this.currentMarkdown) {
      this.visualOptions = migrateTableVisualOptionsOffset(this.currentFrom, nextFrom, this.grid.headers.length, this.visualOptions, this.view)
      this.currentFrom = nextFrom
      this.currentTo = nextTo
      syncTableFromDataset(this.wrap, this.currentFrom)
      this.applyPendingCellActivation()
      return true
    }
    const nextGrid = parseMarkdownTableGrid(nextMarkdown)
    if (!nextGrid) return false

    this.visualOptions = migrateTableVisualOptionsOffset(this.currentFrom, nextFrom, nextGrid.headers.length, this.visualOptions, this.view)
    syncHydratedOptionsOnMarkdownUpdate(this.wrap, this.visualOptions, this.currentMarkdown, nextMarkdown, nextGrid, this.tb.syncOptionButtons)
    this.imeProxyController?.cancelPendingProxyHandoff(false)
    if (this.activeSession && !this.activeSession.handled) {
      this.activeSession.handled = true
      this.activeSession = null
    }

    const sameShape = nextGrid.headers.length === this.grid.headers.length && nextGrid.rows.length === this.grid.rows.length
    if (sameShape) {
      patchTableCellsInPlace(this.surface.cellElements, this.grid, nextGrid)
      syncTableColGroupWidths(this.surface.colElements, this.visualOptions.columnWidths)
    }
    replaceGridContentsInPlace(this.grid, nextGrid)
    if (!sameShape) {
      syncColumnWidthsToGrid(this.visualOptions.columnWidths, this.grid.headers.length)
      this.surface = this.buildSurface()
      appendTableWrapChildren(
        this.wrap, this.tb.toolbar, this.surface.gridRow, this.surface.addRowBtn,
        this.isEditable() ? this.imeProxy : null
      )
    }

    this.activeRow = Math.max(0, Math.min(this.activeRow, this.grid.rows.length))
    this.activeCol = Math.max(0, Math.min(this.activeCol, this.grid.headers.length - 1))
    this.currentMarkdown = nextMarkdown
    this.currentFrom = nextFrom
    this.currentTo = nextTo
    syncTableFromDataset(this.wrap, this.currentFrom)
    this.syncActiveCellHighlight()
    this.applyPendingCellActivation()
    return true
  }

  destroy() {
    this.flushAndDispatchActiveCell()
    this.imeProxyController?.cancelPendingProxyHandoff(false)
    this.outsideGuard.detach()
  }
}

export class MarkdownTableWidget extends WidgetType {
  constructor(private readonly markdown: string, private readonly from?: number, private readonly to?: number) {
    super()
  }
  eq(other: MarkdownTableWidget) {
    return other instanceof MarkdownTableWidget && other.markdown === this.markdown && other.from === this.from && other.to === this.to
  }
  ignoreEvent() { return true }
  updateDOM(dom: HTMLElement, _view: EditorView) {
    return tableDomControllers.get(dom)?.update(this.markdown, this.from, this.to) ?? false
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
    tableDomControllers.set(wrap, new TableWidgetController(wrap, view, grid, this.markdown, this.from, this.to))
    return wrap
  }
}
