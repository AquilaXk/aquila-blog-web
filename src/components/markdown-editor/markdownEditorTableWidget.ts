import { EditorSelection, Transaction } from "@codemirror/state"
import { WidgetType, EditorView } from "@codemirror/view"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  parseMarkdownTableGrid,
  type MarkdownTableGrid,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

type PendingTableCellActivation = {
  from: number
  row: number
  col: number
}

type ActiveCellEditorSession = {
  row: number
  col: number
  cellEl: HTMLElement
  input: HTMLInputElement
  initialValue: string
  handled: boolean
}

let pendingTableCellActivation: PendingTableCellActivation | null = null

const renderStaticTableElement = (grid: MarkdownTableGrid): HTMLTableElement => {
  const table = document.createElement("table")
  table.className = "cm-live-table"

  const thead = document.createElement("thead")
  const headRow = document.createElement("tr")
  for (let col = 0; col < grid.headers.length; col += 1) {
    const th = document.createElement("th")
    const align = grid.alignments[col] ?? "left"
    if (th.style) th.style.textAlign = align
    th.setAttribute("data-align", align)
    appendInlineMarkdownNodes(th, grid.headers[col] ?? "")
    headRow.appendChild(th)
  }
  thead.appendChild(headRow)
  table.appendChild(thead)

  if (grid.rows.length > 0) {
    const tbody = document.createElement("tbody")
    for (let rowIdx = 0; rowIdx < grid.rows.length; rowIdx += 1) {
      const row = grid.rows[rowIdx]!
      const tr = document.createElement("tr")
      for (let col = 0; col < grid.headers.length; col += 1) {
        const td = document.createElement("td")
        const align = grid.alignments[col] ?? "left"
        if (td.style) td.style.textAlign = align
        td.setAttribute("data-align", align)
        appendInlineMarkdownNodes(td, row[col] ?? "")
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
  }

  return table
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

  toDOM(view?: EditorView) {
    const wrap = document.createElement("div")
    wrap.className = "cm-live-table-wrap"
    const grid = parseMarkdownTableGrid(this.markdown)
    if (!grid) return wrap

    if (!view) {
      wrap.appendChild(renderStaticTableElement(grid))
      return wrap
    }

    wrap.setAttribute("data-testid", "cm-live-table-widget")
    if (this.from !== undefined) {
      wrap.setAttribute("data-table-from", String(this.from))
    }

    let activeRow = 0
    let activeCol = 0
    let activeSession: ActiveCellEditorSession | null = null
    const cellElements: HTMLElement[][] = []
    const toolbarButtons: Array<{
      button: HTMLButtonElement
      isDisabled: (row: number, col: number) => boolean
    }> = []

    const resolveRange = (): { from: number; to: number } | null => {
      let resolvedFrom = this.from
      try {
        const domPos = view.posAtDOM(wrap)
        if (typeof domPos === "number" && domPos >= 0) {
          resolvedFrom = domPos
        }
      } catch {}
      if (resolvedFrom === undefined) return null
      const docLen = view.state.doc.length
      const from = Math.max(0, Math.min(resolvedFrom, docLen))
      const span =
        this.from !== undefined && this.to !== undefined
          ? Math.max(0, this.to - this.from)
          : this.markdown.length
      const to = Math.max(from, Math.min(from + span, docLen))
      return { from, to }
    }

    const restoreCellDisplay = (cellEl: HTMLElement, rawText: string) => {
      cellEl.textContent = ""
      appendInlineMarkdownNodes(cellEl, rawText)
    }

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

    const flushActiveCellMarkdown = (): string => {
      if (!activeSession || activeSession.handled) return this.markdown
      const session = activeSession
      session.handled = true
      activeSession = null
      const nextValue = session.input.value
      restoreCellDisplay(session.cellEl, nextValue)
      if (nextValue === session.initialValue) return this.markdown
      return (
        applyMarkdownTableGridCellEdit(this.markdown, session.row, session.col, nextValue) ??
        this.markdown
      )
    }

    const dispatchTableMarkdown = (
      nextMarkdown: string,
      targetCell?: { row: number; col: number }
    ) => {
      const range = resolveRange()
      if (!range) return
      if (nextMarkdown === this.markdown) {
        if (targetCell) {
          activateCellEditor(targetCell.row, targetCell.col)
        }
        return
      }
      if (targetCell) {
        pendingTableCellActivation = {
          from: range.from,
          row: targetCell.row,
          col: targetCell.col,
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

    const executeGridAction = (
      action: MarkdownTableGridAction,
      rowOverride = activeRow,
      colOverride = activeCol
    ) => {
      if (!view.state.facet(EditorView.editable)) return
      const baseMarkdown = flushActiveCellMarkdown()
      const outcome = applyMarkdownTableGridAction(baseMarkdown, rowOverride, colOverride, action)
      if (!outcome) {
        if (baseMarkdown !== this.markdown) {
          dispatchTableMarkdown(baseMarkdown)
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
        if (committed !== this.markdown) {
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

      cellEl.textContent = ""
      const input = document.createElement("input")
      input.type = "text"
      input.className = "cm-live-table-cell-input"
      input.setAttribute("data-testid", "cm-live-table-cell-input")
      input.setAttribute("aria-label", "표 셀 편집")
      input.value = initialValue
      cellEl.appendChild(input)

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
            this.markdown,
            clampedRow,
            clampedCol,
            nextValue
          )
          if (updated && updated !== this.markdown) {
            dispatchTableMarkdown(updated)
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

    const toolbar = document.createElement("div")
    toolbar.className = "cm-live-table-toolbar"
    toolbar.setAttribute("role", "toolbar")
    toolbar.setAttribute("aria-label", "표 빠른 편집 도구")
    toolbar.setAttribute("data-testid", "cm-live-table-toolbar")

    const canAddRow = () => grid.rows.length + 2 <= MAX_EDIT_ROWS
    const canAddCol = () => grid.headers.length < MAX_EDIT_COLUMNS

    const actionSpecs: Array<{
      label: string
      ariaLabel: string
      action?: MarkdownTableGridAction
      isDisabled?: (row: number, col: number) => boolean
      onSelect?: () => void
    }> = [
      { label: "위에 행 추가", ariaLabel: "표 위에 행 추가", action: { kind: "insert-row-above" }, isDisabled: () => !canAddRow() },
      { label: "아래에 행 추가", ariaLabel: "표 아래에 행 추가", action: { kind: "add-row" }, isDisabled: () => !canAddRow() },
      { label: "행 위로 이동", ariaLabel: "표 행 위로 이동", action: { kind: "move-row-up" }, isDisabled: (row) => row < 2 },
      { label: "행 아래로 이동", ariaLabel: "표 행 아래로 이동", action: { kind: "move-row-down" }, isDisabled: (row) => row < 1 || row >= grid.rows.length },
      { label: "행 복제", ariaLabel: "표 행 복제", action: { kind: "duplicate-row" }, isDisabled: () => !canAddRow() },
      { label: "행 삭제", ariaLabel: "표 행 삭제", action: { kind: "delete-row" }, isDisabled: (row) => row === 0 || grid.rows.length <= 1 },
      { label: "왼쪽에 열 추가", ariaLabel: "표 왼쪽에 열 추가", action: { kind: "insert-column-left" }, isDisabled: () => !canAddCol() },
      { label: "오른쪽에 열 추가", ariaLabel: "표 오른쪽에 열 추가", action: { kind: "add-column" }, isDisabled: () => !canAddCol() },
      { label: "열 왼쪽으로 이동", ariaLabel: "표 열 왼쪽으로 이동", action: { kind: "move-column-left" }, isDisabled: (_row, col) => col < 1 },
      { label: "열 오른쪽으로 이동", ariaLabel: "표 열 오른쪽으로 이동", action: { kind: "move-column-right" }, isDisabled: (_row, col) => col >= grid.headers.length - 1 },
      { label: "열 삭제", ariaLabel: "표 열 삭제", action: { kind: "delete-column" }, isDisabled: () => grid.headers.length <= 1 },
      { label: "왼쪽 정렬", ariaLabel: "표 열 왼쪽 정렬", action: { kind: "set-alignment", alignment: "left" } },
      { label: "가운데 정렬", ariaLabel: "표 열 가운데 정렬", action: { kind: "set-alignment", alignment: "center" } },
      { label: "오른쪽 정렬", ariaLabel: "표 열 오른쪽 정렬", action: { kind: "set-alignment", alignment: "right" } },
      {
        label: "원본 편집",
        ariaLabel: "표 마크다운 원본 편집",
        onSelect: () => {
          const range = resolveRange()
          if (!range) return
          view.focus()
          view.dispatch({
            selection: EditorSelection.cursor(Math.min(range.to, range.from + 2)),
            scrollIntoView: true,
          })
        },
      },
    ]

    for (const spec of actionSpecs) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "cm-live-table-toolbar-btn"
      btn.setAttribute("aria-label", spec.ariaLabel)
      btn.textContent = spec.label
      btn.addEventListener("mousedown", (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      btn.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (spec.onSelect) spec.onSelect()
        else if (spec.action) executeGridAction(spec.action)
      })
      if (spec.isDisabled) toolbarButtons.push({ button: btn, isDisabled: spec.isDisabled })
      toolbar.appendChild(btn)
    }

    const gridRow = document.createElement("div")
    gridRow.className = "cm-live-table-grid-row"

    const table = document.createElement("table")
    table.className = "cm-live-table"

    const bindInteractiveCell = (cellEl: HTMLElement, row: number, col: number, text: string) => {
      const align = grid.alignments[col] ?? "left"
      if (cellEl.style) cellEl.style.textAlign = align
      cellEl.setAttribute("data-align", align)
      cellEl.setAttribute("data-cell-row", String(row))
      cellEl.setAttribute("data-cell-col", String(col))
      appendInlineMarkdownNodes(cellEl, text)

      const handleActivate = (event: MouseEvent) => {
        if (event.button !== 0) return
        const target = event.target as HTMLElement | null
        if (target?.closest("a") || target?.tagName === "INPUT") return
        event.preventDefault()
        event.stopPropagation()
        activateCellEditor(row, col)
      }
      cellEl.addEventListener("mousedown", handleActivate)
      cellEl.addEventListener("click", handleActivate)
    }

    const thead = document.createElement("thead")
    const headTr = document.createElement("tr")
    const headCellEls: HTMLElement[] = []
    for (let col = 0; col < grid.headers.length; col += 1) {
      const th = document.createElement("th")
      bindInteractiveCell(th, 0, col, grid.headers[col] ?? "")
      headCellEls.push(th)
      headTr.appendChild(th)
    }
    cellElements.push(headCellEls)
    thead.appendChild(headTr)
    table.appendChild(thead)

    const tbody = document.createElement("tbody")
    for (let rowIdx = 0; rowIdx < grid.rows.length; rowIdx += 1) {
      const row = grid.rows[rowIdx]!
      const tr = document.createElement("tr")
      const rowCellEls: HTMLElement[] = []
      for (let col = 0; col < grid.headers.length; col += 1) {
        const td = document.createElement("td")
        bindInteractiveCell(td, rowIdx + 1, col, row[col] ?? "")
        rowCellEls.push(td)
        tr.appendChild(td)
      }
      cellElements.push(rowCellEls)
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    const addColBtn = document.createElement("button")
    addColBtn.type = "button"
    addColBtn.className = "cm-live-table-add-col"
    addColBtn.setAttribute("aria-label", "표 오른쪽에 새 열 추가")
    addColBtn.setAttribute("data-testid", "cm-live-table-add-col")
    addColBtn.textContent = "+"
    addColBtn.disabled = !canAddCol()
    addColBtn.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    addColBtn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      executeGridAction({ kind: "add-column" }, activeRow, grid.headers.length - 1)
    })

    gridRow.appendChild(table)
    gridRow.appendChild(addColBtn)

    const addRowBtn = document.createElement("button")
    addRowBtn.type = "button"
    addRowBtn.className = "cm-live-table-add-row"
    addRowBtn.setAttribute("aria-label", "표 아래에 새 행 추가")
    addRowBtn.setAttribute("data-testid", "cm-live-table-add-row")
    addRowBtn.textContent = "+ 새 행"
    addRowBtn.disabled = !canAddRow()
    addRowBtn.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    addRowBtn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      executeGridAction({ kind: "add-row" }, grid.rows.length, 0)
    })

    wrap.appendChild(toolbar)
    wrap.appendChild(gridRow)
    wrap.appendChild(addRowBtn)

    syncActiveCellHighlight()

    if (
      pendingTableCellActivation &&
      (this.from === undefined || pendingTableCellActivation.from === this.from)
    ) {
      const target = pendingTableCellActivation
      pendingTableCellActivation = null
      activateCellEditor(target.row, target.col)
    }

    return wrap
  }
}
