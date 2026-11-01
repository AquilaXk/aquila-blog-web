import {
  applyMarkdownTableGridCellEdit, applyMarkdownTableGridPaste, applyTableCellInlineFormat,
  parseMarkdownTableGrid, type MarkdownTableGrid, type MarkdownTableGridAction, type TableCellInlineFormatKind,
} from "./markdownEditorTableModel"
import { type TableVisualOptions } from "./markdownEditorTableWidgetDom"

export type TableSelectionMode = "cell" | "row" | "col"
export type TableCellTarget = { row: number; col: number; openEditor?: boolean }

export type ActiveCellEditorSession = {
  row: number; col: number; cellEl: HTMLElement; input: HTMLInputElement
  initialValue: string; handled: boolean; handleKeydown: (event: KeyboardEvent) => void
}

export type ImeProxyController = {
  cancelPendingProxyHandoff: (syncToBoundSession?: boolean) => void
}

export type TableSessionCallbacks = {
  grid: MarkdownTableGrid
  visualOptions: TableVisualOptions
  getCurrentMarkdown: () => string
  dispatchTableMarkdown: (nextMarkdown: string, targetCell?: TableCellTarget) => void
  executeGridAction: (action: MarkdownTableGridAction, rowOverride?: number, colOverride?: number, openEditor?: boolean) => void
  focusSelectedTableTarget: () => void
}

export const isImeComposingKeyEvent = (event: KeyboardEvent): boolean =>
  Boolean(event.isComposing) || event.key === "Process" || Reflect.get(event, "keyCode") === 229

export const focusElementPreventScroll = (el: HTMLElement | null | undefined) => {
  if (!el || typeof el.focus !== "function") return
  try {
    el.focus({ preventScroll: true })
  } catch {
    try { el.focus() } catch { return }
  }
}

export const createTableImeProxyElement = (): HTMLTextAreaElement => {
  const proxy = document.createElement("textarea")
  proxy.className = "cm-live-table-ime-proxy"
  proxy.tabIndex = -1
  proxy.setAttribute("tabindex", "-1")
  if (proxy.dataset) proxy.dataset.testid = "cm-live-table-ime-proxy"
  proxy.setAttribute("aria-label", "표 셀 입력 대리자")
  proxy.setAttribute("autocapitalize", "off")
  proxy.setAttribute("autocomplete", "off")
  proxy.setAttribute("spellcheck", "false")
  if (proxy.style) {
    Object.assign(proxy.style, {
      position: "absolute", width: "1px", height: "1px", opacity: "0",
      pointerEvents: "none", padding: "0", border: "0", overflow: "hidden",
    })
  }
  return proxy
}

const readCellText = (grid: MarkdownTableGrid, row: number, col: number): string =>
  row === 0 ? (grid.headers[col] ?? "") : (grid.rows[row - 1]?.[col] ?? "")

const resolveInlineShortcutKind = (event: KeyboardEvent): TableCellInlineFormatKind | null => {
  if (event.key === "Enter" && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    return "line-break"
  }
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) return null
  const lowerKey = event.key.toLowerCase()
  if (!event.shiftKey && lowerKey === "b") return "bold"
  if (!event.shiftKey && lowerKey === "i") return "italic"
  if (!event.shiftKey && lowerKey === "e") return "code"
  if (event.shiftKey && (lowerKey === "x" || lowerKey === "s")) return "strikethrough"
  return null
}

const applyInlineShortcutOnInput = (input: HTMLInputElement, kind: TableCellInlineFormatKind) => {
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? input.value.length
  const outcome = applyTableCellInlineFormat(input.value, start, end, kind)
  input.value = outcome.value
  try {
    input.setSelectionRange(outcome.selectionStart, outcome.selectionEnd)
  } catch {
    return
  }
}

const canNavigateHorizontallyFromInput = (
  input: HTMLInputElement, grid: MarkdownTableGrid, row: number, col: number, key: string
): "previous" | "next" | null => {
  if (key === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0) {
    return row > 0 || col > 0 ? "previous" : null
  }
  const len = input.value.length
  if (key === "ArrowRight" && input.selectionStart === len && input.selectionEnd === len) {
    return row < grid.rows.length || col < grid.headers.length - 1 ? "next" : null
  }
  return null
}

export type OpenTableCellEditorParams = TableSessionCallbacks & {
  cellEl: HTMLElement; preservedControls: HTMLElement[]; row: number; col: number
  initialText?: string; deferFocus?: boolean
  clearActiveSessionIfMatch: (session: ActiveCellEditorSession) => void
  setActiveCoordinates: (row: number, col: number) => void
  flushActiveCellMarkdown: () => string
}

const syncColumnWidthsForPastedMarkdown = (markdown: string, visualOptions: TableVisualOptions) => {
  const nextGrid = parseMarkdownTableGrid(markdown)
  if (!nextGrid) return
  while (visualOptions.columnWidths.length < nextGrid.headers.length) {
    visualOptions.columnWidths.push(0)
  }
}

const handleCellEditorPaste = (
  event: ClipboardEvent,
  session: ActiveCellEditorSession,
  params: OpenTableCellEditorParams
) => {
  event.stopPropagation()
  const pastedText = event.clipboardData?.getData("text/plain") ?? ""
  if (!pastedText.includes("\t") && !pastedText.includes("\n") && !pastedText.includes("\r")) return
  const currentMd = params.getCurrentMarkdown()
  const edited =
    session.input.value !== session.initialValue
      ? (applyMarkdownTableGridCellEdit(currentMd, session.row, session.col, session.input.value) ?? currentMd)
      : currentMd
  const outcome = applyMarkdownTableGridPaste(edited, session.row, session.col, pastedText)
  if (!outcome) return
  event.preventDefault()
  session.handled = true
  params.clearActiveSessionIfMatch(session)
  syncColumnWidthsForPastedMarkdown(outcome.markdown, params.visualOptions)
  params.setActiveCoordinates(outcome.nextRow, outcome.nextCol)
  params.dispatchTableMarkdown(outcome.markdown, {
    row: outcome.nextRow, col: outcome.nextCol, openEditor: false,
  })
}

const handleCellEditorPlainKey = (
  event: KeyboardEvent,
  input: HTMLInputElement,
  params: OpenTableCellEditorParams
) => {
  if (event.key === "Enter") {
    event.preventDefault()
    params.executeGridAction({ kind: "enter" }, params.row, params.col)
    return
  }
  const horizDir = canNavigateHorizontallyFromInput(input, params.grid, params.row, params.col, event.key)
  if (horizDir) {
    event.preventDefault()
    params.executeGridAction({ kind: "tab", direction: horizDir }, params.row, params.col)
    return
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault()
    const step = event.key === "ArrowUp" ? -1 : 1
    const targetRow = Math.max(0, Math.min(params.grid.rows.length, params.row + step))
    params.dispatchTableMarkdown(params.flushActiveCellMarkdown(), { row: targetRow, col: params.col })
  }
}

const handleCellEditorKeydown = (
  event: KeyboardEvent,
  input: HTMLInputElement,
  params: OpenTableCellEditorParams,
  commitAndCloseSession: (focusProxyAfter?: boolean) => void
) => {
  event.stopPropagation()
  if (isImeComposingKeyEvent(event)) return
  const inlineKind = resolveInlineShortcutKind(event)
  if (inlineKind) {
    event.preventDefault()
    applyInlineShortcutOnInput(input, inlineKind)
    return
  }
  if (event.key === "Tab") {
    event.preventDefault()
    params.executeGridAction({ kind: "tab", direction: event.shiftKey ? "previous" : "next" }, params.row, params.col)
    return
  }
  if (event.key === "Escape") {
    event.preventDefault()
    commitAndCloseSession(true)
    return
  }
  if (!event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    handleCellEditorPlainKey(event, input, params)
  }
}

export const openTableCellEditorSession = (params: OpenTableCellEditorParams): ActiveCellEditorSession => {
  const { cellEl, preservedControls, grid, row, col, initialText } = params
  const initialValue = readCellText(grid, row, col)
  cellEl.textContent = ""
  const input = document.createElement("input")
  input.type = "text"
  input.className = "cm-live-table-cell-input"
  if (input.dataset) input.dataset.testid = "cm-live-table-cell-input"
  input.setAttribute("aria-label", "표 셀 편집")
  input.value = initialText ? `${initialValue}${initialText}` : initialValue
  cellEl.appendChild(input)
  for (const control of preservedControls) cellEl.appendChild(control)

  const commitAndCloseSession = (focusProxyAfter = false) => {
    if (session.handled) return
    const currentMd = params.getCurrentMarkdown()
    const committed = params.flushActiveCellMarkdown()
    if (committed !== currentMd) {
      params.dispatchTableMarkdown(committed, focusProxyAfter ? { row, col, openEditor: false } : undefined)
    }
    if (focusProxyAfter) params.focusSelectedTableTarget()
  }

  const onInputKeydown = (event: KeyboardEvent) =>
    handleCellEditorKeydown(event, input, params, commitAndCloseSession)
  const session: ActiveCellEditorSession = {
    row, col, cellEl, input, initialValue, handled: false, handleKeydown: onInputKeydown,
  }
  let inputComposing = false
  const stopBubble = (event: Event) => event.stopPropagation()
  for (const name of ["mousedown", "mouseup", "click", "dblclick", "input", "beforeinput"]) {
    input.addEventListener(name, stopBubble)
  }
  input.addEventListener("compositionstart", (event: Event) => {
    event.stopPropagation()
    inputComposing = true
  })
  input.addEventListener("compositionend", (event: Event) => {
    event.stopPropagation()
    inputComposing = false
  })
  input.addEventListener("paste", (event: ClipboardEvent) => handleCellEditorPaste(event, session, params))
  input.addEventListener("keydown", onInputKeydown)
  input.addEventListener("blur", () => commitAndCloseSession(false))

  const placeCaretAtEnd = (allowSelectionReset: boolean) => {
    if (session.handled || inputComposing) return
    focusElementPreventScroll(input)
    if (!allowSelectionReset) return
    try {
      input.setSelectionRange(input.value.length, input.value.length)
      input.scrollLeft = 0
    } catch {
      return
    }
  }
  if (!params.deferFocus) {
    placeCaretAtEnd(true)
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => {
        const alreadyFocused = typeof document !== "undefined" && document.activeElement === input
        placeCaretAtEnd(!alreadyFocused)
      })
    }
  }
  return session
}

export type TableSurfaceInteractionParams = TableSessionCallbacks & {
  wrap: HTMLElement
  getImeProxy: () => HTMLTextAreaElement | null
  getActiveSession: () => ActiveCellEditorSession | null
  flushActiveSession: () => void
  isEditable: () => boolean
  isTableActive: () => boolean
  hasOpenEditorSession: () => boolean
  getSelectionState: () => { row: number; col: number; mode: TableSelectionMode }
  setSelectionState: (next: { row?: number; col?: number; mode?: TableSelectionMode }) => void
  deactivateTable: () => void
  syncActiveCellHighlight: () => void
  activateCellEditor: (row: number, col: number, initialText?: string, deferFocus?: boolean) => void
}

const buildSelectedClipboardText = (
  grid: MarkdownTableGrid, row: number, col: number, mode: TableSelectionMode
): string => {
  if (mode === "row") {
    const cells = row === 0 ? grid.headers : (grid.rows[row - 1] ?? [])
    return grid.headers.map((_, idx) => cells[idx] ?? "").join("\t")
  }
  if (mode === "col") {
    return [grid.headers[col] ?? "", ...grid.rows.map((r) => r[col] ?? "")].join("\n")
  }
  return readCellText(grid, row, col)
}

const applyArrowNavigationStep = (
  key: string, grid: MarkdownTableGrid, row: number, col: number
): { row: number; col: number } | null => {
  if (key === "ArrowUp") return { row: Math.max(0, row - 1), col }
  if (key === "ArrowDown") return { row: Math.min(grid.rows.length, row + 1), col }
  if (key === "ArrowLeft") return { row, col: Math.max(0, col - 1) }
  if (key === "ArrowRight") return { row, col: Math.min(grid.headers.length - 1, col + 1) }
  return null
}

const handleClearSelectedCells = (params: TableSurfaceInteractionParams) => {
  const { row, col, mode } = params.getSelectionState()
  if (mode === "row") return params.executeGridAction({ kind: "clear-row" }, row, col, false)
  if (mode === "col") return params.executeGridAction({ kind: "clear-column" }, row, col, false)
  const currentMd = params.getCurrentMarkdown()
  const cleared = applyMarkdownTableGridCellEdit(currentMd, row, col, "")
  if (cleared && cleared !== currentMd) {
    params.dispatchTableMarkdown(cleared, { row, col, openEditor: false })
  }
}

const dispatchSurfaceCommandKey = (
  event: KeyboardEvent, row: number, col: number, params: TableSurfaceInteractionParams
): boolean => {
  const stop = () => {
    event.preventDefault()
    event.stopPropagation()
  }
  if (event.key === "Escape") {
    stop()
    params.deactivateTable()
    return true
  }
  if (event.key === "Enter" || event.key === "F2") {
    stop()
    params.activateCellEditor(row, col)
    return true
  }
  if (event.key === "Tab") {
    stop()
    params.setSelectionState({ mode: "cell" })
    params.executeGridAction({ kind: "tab", direction: event.shiftKey ? "previous" : "next" }, row, col, false)
    return true
  }
  const nextArrow = applyArrowNavigationStep(event.key, params.grid, row, col)
  if (nextArrow) {
    stop()
    params.setSelectionState({ row: nextArrow.row, col: nextArrow.col, mode: "cell" })
    params.syncActiveCellHighlight()
    params.focusSelectedTableTarget()
    return true
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    stop()
    handleClearSelectedCells(params)
    return true
  }
  return false
}

const handleSurfaceKeydown = (event: KeyboardEvent, params: TableSurfaceInteractionParams) => {
  if (!params.isEditable() || !params.isTableActive() || params.hasOpenEditorSession()) return
  if (isImeComposingKeyEvent(event)) {
    event.stopPropagation()
    return
  }
  const { row, col } = params.getSelectionState()
  if (dispatchSurfaceCommandKey(event, row, col, params)) return
  if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (event.key === " ") event.preventDefault()
    event.stopPropagation()
    params.activateCellEditor(row, col)
  }
}

const handleSurfaceCopy = (event: ClipboardEvent, params: TableSurfaceInteractionParams) => {
  if (!params.isTableActive() || params.hasOpenEditorSession() || !event.clipboardData) return
  const { row, col, mode } = params.getSelectionState()
  event.preventDefault()
  event.stopPropagation()
  event.clipboardData.setData("text/plain", buildSelectedClipboardText(params.grid, row, col, mode))
}

const handleSurfacePaste = (event: ClipboardEvent, params: TableSurfaceInteractionParams) => {
  if (!params.isEditable() || !params.isTableActive() || params.hasOpenEditorSession()) return
  const pastedText = event.clipboardData?.getData("text/plain") ?? ""
  if (!pastedText) return
  event.preventDefault()
  event.stopPropagation()
  const proxy = params.getImeProxy()
  if (proxy) proxy.value = ""
  const { row, col } = params.getSelectionState()
  const currentMd = params.getCurrentMarkdown()
  const multiOutcome = applyMarkdownTableGridPaste(currentMd, row, col, pastedText)
  if (multiOutcome) {
    syncColumnWidthsForPastedMarkdown(multiOutcome.markdown, params.visualOptions)
    params.setSelectionState({ row: multiOutcome.nextRow, col: multiOutcome.nextCol, mode: "cell" })
    params.dispatchTableMarkdown(multiOutcome.markdown, {
      row: multiOutcome.nextRow, col: multiOutcome.nextCol, openEditor: false,
    })
    return
  }
  const singleEdited = applyMarkdownTableGridCellEdit(currentMd, row, col, pastedText)
  if (singleEdited && singleEdited !== currentMd) {
    params.dispatchTableMarkdown(singleEdited, { row, col, openEditor: false })
  }
}

const syncProxyDraftIntoSession = (
  proxy: HTMLTextAreaElement,
  session: ActiveCellEditorSession,
  fallbackText = ""
) => {
  if (session.handled) return
  const draft = proxy.value || fallbackText
  session.input.value = `${session.initialValue}${draft}`
}

const focusSessionInputAtEnd = (input: HTMLInputElement) => {
  focusElementPreventScroll(input)
  try {
    const end = input.value.length
    input.setSelectionRange(end, end)
    input.scrollLeft = 0
  } catch {
    return
  }
}

export const attachImeProxyListeners = (
  proxy: HTMLTextAreaElement,
  params: TableSurfaceInteractionParams
): ImeProxyController => {
  let proxyComposing = false
  let proxyBoundSession: ActiveCellEditorSession | null = null
  let pendingHandoffTimer: ReturnType<typeof setTimeout> | null = null
  let handoffInProgress = false

  const clearPendingTimer = () => {
    if (pendingHandoffTimer !== null) {
      clearTimeout(pendingHandoffTimer)
      pendingHandoffTimer = null
    }
  }

  const getValidBoundSession = (): ActiveCellEditorSession | null =>
    proxyBoundSession && params.getActiveSession() === proxyBoundSession && !proxyBoundSession.handled
      ? proxyBoundSession
      : null

  const cancelPendingProxyHandoff = (syncToBoundSession = false) => {
    clearPendingTimer()
    proxyComposing = false
    const bound = getValidBoundSession()
    if (syncToBoundSession && bound && proxy.value) {
      bound.input.value = `${bound.initialValue}${proxy.value}`
    }
    proxyBoundSession = null
    proxy.value = ""
  }

  const handoffToBoundSessionInput = (): ActiveCellEditorSession | null => {
    clearPendingTimer()
    const bound = getValidBoundSession()
    proxyBoundSession = null
    if (!bound) {
      proxy.value = ""
      return null
    }
    if (proxy.value) {
      bound.input.value = `${bound.initialValue}${proxy.value}`
    }
    proxy.value = ""
    handoffInProgress = true
    try {
      focusSessionInputAtEnd(bound.input)
    } finally {
      handoffInProgress = false
    }
    return bound
  }

  proxy.addEventListener("compositionstart", (event: CompositionEvent) => {
    event.stopPropagation()
    clearPendingTimer()
    proxyComposing = true
    if (!params.isEditable() || !params.isTableActive()) {
      proxyBoundSession = null
      proxy.value = ""
      return
    }
    if (!params.hasOpenEditorSession()) {
      const seed = proxy.value || (typeof event.data === "string" ? event.data : "")
      const { row, col } = params.getSelectionState()
      params.activateCellEditor(row, col, seed || undefined, true)
      proxyBoundSession = params.getActiveSession()
      return
    }
    const bound = getValidBoundSession()
    if (bound) syncProxyDraftIntoSession(proxy, bound)
  })

  proxy.addEventListener("compositionupdate", (event: CompositionEvent) => {
    event.stopPropagation()
    const bound = getValidBoundSession()
    if (!bound) return
    const liveData = typeof event.data === "string" ? event.data : ""
    syncProxyDraftIntoSession(proxy, bound, liveData)
  })

  proxy.addEventListener("compositionend", (event: CompositionEvent) => {
    event.stopPropagation()
    proxyComposing = false
    const bound = getValidBoundSession()
    if (!bound) {
      cancelPendingProxyHandoff(false)
      return
    }
    const committedData = typeof event.data === "string" ? event.data : ""
    syncProxyDraftIntoSession(proxy, bound, committedData)
    clearPendingTimer()
    pendingHandoffTimer = setTimeout(() => {
      pendingHandoffTimer = null
      if (proxyComposing || proxyBoundSession !== bound) return
      handoffToBoundSessionInput()
    }, 0)
  })

  proxy.addEventListener("input", (event: Event) => {
    event.stopPropagation()
    const bound = getValidBoundSession()
    if (bound) {
      syncProxyDraftIntoSession(proxy, bound)
      return
    }
    if (proxyBoundSession) cancelPendingProxyHandoff(false)
    if (proxyComposing || Reflect.get(event, "isComposing") === true) return
    if (!params.isEditable() || !params.isTableActive() || params.hasOpenEditorSession()) {
      proxy.value = ""
      return
    }
    const typed = proxy.value
    proxy.value = ""
    if (typed.length > 0) {
      const { row, col } = params.getSelectionState()
      params.activateCellEditor(row, col, typed)
    }
  })

  proxy.addEventListener("keydown", (event: KeyboardEvent) => {
    if (proxyBoundSession) {
      const bound = getValidBoundSession()
      if (!bound) {
        cancelPendingProxyHandoff(false)
      } else {
        event.stopPropagation()
        if (proxyComposing || isImeComposingKeyEvent(event)) return
        const handedOff = handoffToBoundSessionInput()
        handedOff?.handleKeydown(event)
        return
      }
    }
    handleSurfaceKeydown(event, params)
  })

  proxy.addEventListener("blur", () => {
    clearPendingTimer()
    proxyComposing = false
    const bound = proxyBoundSession
    if (!bound) {
      proxy.value = ""
      return
    }
    const isCurrentBound = params.getActiveSession() === bound && !bound.handled
    if (isCurrentBound && proxy.value) {
      bound.input.value = `${bound.initialValue}${proxy.value}`
    }
    proxyBoundSession = null
    proxy.value = ""
    if (!isCurrentBound || handoffInProgress) return
    if (typeof document !== "undefined" && document.activeElement === bound.input) return
    params.flushActiveSession()
  })

  proxy.addEventListener("copy", (event: ClipboardEvent) => handleSurfaceCopy(event, params))
  proxy.addEventListener("paste", (event: ClipboardEvent) => handleSurfacePaste(event, params))
  return { cancelPendingProxyHandoff }
}

export const attachWrapSurfaceListeners = (params: TableSurfaceInteractionParams) => {
  const { wrap } = params
  wrap.addEventListener("compositionstart", (event: CompositionEvent) => {
    if (!params.isEditable() || !params.isTableActive() || params.hasOpenEditorSession()) return
    const seed = typeof event.data === "string" ? event.data : ""
    const { row, col } = params.getSelectionState()
    params.activateCellEditor(row, col, seed)
  })
  wrap.addEventListener("keydown", (event: KeyboardEvent) => handleSurfaceKeydown(event, params))
  wrap.addEventListener("copy", (event: ClipboardEvent) => handleSurfaceCopy(event, params))
  wrap.addEventListener("paste", (event: ClipboardEvent) => handleSurfacePaste(event, params))
}
