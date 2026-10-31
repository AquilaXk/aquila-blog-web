import {
  MAX_EDIT_COLUMNS,
  type MarkdownTableGridAction,
} from "./markdownEditorTableModel"

export type TableVisualOptions = {
  headerRow: boolean
  headerColumn: boolean
  fitPageWidth: boolean
  columnWidths: number[]
}

export type TableVisualOptionKey = "headerRow" | "headerColumn" | "fitPageWidth"

type ResizePointerEvent = MouseEvent | PointerEvent
type ResizeMoveEventName = "mousemove" | "pointermove"
type ResizeUpEventName = "mouseup" | "pointerup" | "pointercancel"

const MAX_TABLE_VISUAL_OPTIONS = 128
const fallbackTableVisualOptionsByOffset = new Map<number, TableVisualOptions>()
const scopedTableVisualOptionsByView = new WeakMap<object, Map<number, TableVisualOptions>>()

const stopAndPrevent = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
}

const resolveVisualOptionsStore = (scopeKey?: object | null): Map<number, TableVisualOptions> => {
  if (!scopeKey) return fallbackTableVisualOptionsByOffset
  let store = scopedTableVisualOptionsByView.get(scopeKey)
  if (!store) {
    store = new Map<number, TableVisualOptions>()
    scopedTableVisualOptionsByView.set(scopeKey, store)
  }
  return store
}

const syncVisualOptionWidths = (options: TableVisualOptions, columnCount: number) => {
  while (options.columnWidths.length < columnCount) options.columnWidths.push(0)
  if (options.columnWidths.length > columnCount) options.columnWidths.length = columnCount
}

export const getOrCreateTableVisualOptions = (
  tableFrom: number,
  columnCount: number,
  scopeKey?: object | null
): TableVisualOptions => {
  const store = resolveVisualOptionsStore(scopeKey)
  const existing = store.get(tableFrom)
  if (existing) {
    store.delete(tableFrom)
    syncVisualOptionWidths(existing, columnCount)
    store.set(tableFrom, existing)
    return existing
  }
  if (store.size >= MAX_TABLE_VISUAL_OPTIONS) {
    const oldestKey = store.keys().next().value
    if (oldestKey !== undefined) store.delete(oldestKey)
  }
  const created: TableVisualOptions = {
    headerRow: true,
    headerColumn: false,
    fitPageWidth: false,
    columnWidths: Array.from({ length: columnCount }, () => 0),
  }
  store.set(tableFrom, created)
  return created
}

export const migrateTableVisualOptionsOffset = (
  prevFrom: number | undefined,
  nextFrom: number | undefined,
  columnCount: number,
  currentOptions?: TableVisualOptions,
  scopeKey?: object | null
): TableVisualOptions => {
  const store = resolveVisualOptionsStore(scopeKey)
  const prevKey = prevFrom ?? 0
  const nextKey = nextFrom ?? 0
  const existing = currentOptions ?? store.get(prevKey)
  if (existing) {
    if (prevKey !== nextKey && store.get(prevKey) === existing) store.delete(prevKey)
    syncVisualOptionWidths(existing, columnCount)
    store.set(nextKey, existing)
    return existing
  }
  return getOrCreateTableVisualOptions(nextKey, columnCount, scopeKey)
}

export const syncTableVisualWrapAttributes = (wrap: HTMLElement, visualOptions: TableVisualOptions) => {
  if (!wrap.dataset) return
  if (visualOptions.headerRow) wrap.dataset.headerRow = "true"
  else delete wrap.dataset.headerRow
  if (visualOptions.headerColumn) wrap.dataset.headerCol = "true"
  else delete wrap.dataset.headerCol
  if (visualOptions.fitPageWidth) wrap.dataset.fullWidth = "true"
  else delete wrap.dataset.fullWidth
}

const applyColElementWidth = (colEl: HTMLElement, width: number) => {
  if (width > 0) {
    const rounded = Math.round(width)
    if (colEl.style) colEl.style.width = `${rounded}px`
    if (colEl.dataset) colEl.dataset.colWidth = String(rounded)
    return
  }
  if (colEl.style) colEl.style.width = ""
  if (colEl.dataset) delete colEl.dataset.colWidth
}

export const syncTableColGroupWidths = (cols: readonly HTMLElement[], columnWidths: readonly number[]) => {
  for (let col = 0; col < cols.length; col += 1) {
    const colEl = cols[col]
    if (colEl) applyColElementWidth(colEl, columnWidths[col] ?? 0)
  }
}

export const createTableColGroup = (
  columnCount: number,
  columnWidths: readonly number[]
): { colgroup: HTMLElement; cols: HTMLElement[] } => {
  const colgroup = document.createElement("colgroup")
  const cols: HTMLElement[] = []
  for (let col = 0; col < columnCount; col += 1) {
    const colEl = document.createElement("col")
    colgroup.appendChild(colEl)
    cols.push(colEl)
  }
  syncTableColGroupWidths(cols, columnWidths)
  return { colgroup, cols }
}

const swapColumnWidths = (widths: number[], from: number, to: number) => {
  const prev = widths[to] ?? 0
  widths[to] = widths[from] ?? 0
  widths[from] = prev
}

const spliceColumnWidthsByAction = (
  columnWidths: number[],
  columnCount: number,
  clampedCol: number,
  kind: MarkdownTableGridAction["kind"]
) => {
  if (kind === "insert-column-left") columnWidths.splice(clampedCol, 0, 0)
  else if (kind === "add-column") columnWidths.splice(clampedCol + 1, 0, 0)
  else if (kind === "add-row-and-column" && columnCount < MAX_EDIT_COLUMNS) columnWidths.push(0)
  else if (kind === "duplicate-column") columnWidths.splice(clampedCol + 1, 0, columnWidths[clampedCol] ?? 0)
  else if (kind === "delete-column" && columnCount > 1) columnWidths.splice(clampedCol, 1)
}

export const applyTableColumnWidthsAction = (
  columnWidths: number[],
  columnCount: number,
  colIndex: number,
  action: MarkdownTableGridAction
) => {
  while (columnWidths.length < columnCount) columnWidths.push(0)
  if (columnWidths.length > columnCount) columnWidths.length = columnCount
  const clampedCol = Math.max(0, Math.min(colIndex, columnCount - 1))
  if (action.kind === "move-column-left" && clampedCol > 0) {
    swapColumnWidths(columnWidths, clampedCol, clampedCol - 1)
  } else if (action.kind === "move-column-right" && clampedCol < columnCount - 1) {
    swapColumnWidths(columnWidths, clampedCol, clampedCol + 1)
  } else if (action.kind === "move-column-to") {
    const targetCol = Math.max(0, Math.min(action.targetCol, columnCount - 1))
    if (targetCol !== clampedCol) {
      const [moved] = columnWidths.splice(clampedCol, 1)
      columnWidths.splice(targetCol, 0, moved ?? 0)
    }
  } else {
    spliceColumnWidthsByAction(columnWidths, columnCount, clampedCol, action.kind)
  }
}

const resolveInitialColumnResizeWidth = (configuredWidth: number, measuredWidth: number): number => {
  if (configuredWidth > 0) return configuredWidth
  return measuredWidth > 0 ? measuredWidth : 120
}

const bindWindowResizeListeners = (
  moveEventName: ResizeMoveEventName,
  upEventNames: readonly ResizeUpEventName[],
  onMove: (event: ResizePointerEvent) => void,
  onUp: () => void
): (() => void) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => {}
  window.addEventListener(moveEventName, onMove)
  for (const upName of upEventNames) window.addEventListener(upName, onUp)
  return () => {
    if (typeof window.removeEventListener !== "function") return
    window.removeEventListener(moveEventName, onMove)
    for (const upName of upEventNames) window.removeEventListener(upName, onUp)
  }
}

const beginColumnResizeSession = (params: {
  event: ResizePointerEvent
  th: HTMLElement
  colIndex: number
  colEl: HTMLElement
  visualOptions: TableVisualOptions
  moveEventName: ResizeMoveEventName
  upEventNames: readonly ResizeUpEventName[]
  onVisualOptionsChange?: () => void
  onEnd: () => void
}) => {
  const { event, th, colIndex, colEl, visualOptions, moveEventName, upEventNames, onVisualOptionsChange, onEnd } = params
  const startX = event.clientX
  const measuredWidth = typeof th.getBoundingClientRect === "function" ? th.getBoundingClientRect().width : 0
  const startWidth = resolveInitialColumnResizeWidth(visualOptions.columnWidths[colIndex] ?? 0, measuredWidth)
  let latestClientX = startX
  let hasMoved = false
  let rafId: number | null = null

  const applyWidth = (clientX: number) => {
    const nextWidth = Math.round(Math.max(72, Math.min(640, startWidth + (clientX - startX))))
    visualOptions.columnWidths[colIndex] = nextWidth
    applyColElementWidth(colEl, nextWidth)
  }

  const handleMove = (moveEvent: ResizePointerEvent) => {
    hasMoved = true
    latestClientX = moveEvent.clientX
    if (rafId !== null) return
    applyWidth(latestClientX)
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = null
        applyWidth(latestClientX)
      })
    }
  }

  let detachWindow = () => {}
  const handleUp = () => {
    onEnd()
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    detachWindow()
    if (hasMoved) {
      applyWidth(latestClientX)
      onVisualOptionsChange?.()
    }
  }

  detachWindow = bindWindowResizeListeners(moveEventName, upEventNames, handleMove, handleUp)
}

export const attachColumnResizeHandle = (
  th: HTMLElement,
  colIndex: number,
  colEl: HTMLElement,
  visualOptions: TableVisualOptions,
  onVisualOptionsChange?: () => void,
  isEditable?: () => boolean
): HTMLElement => {
  const resizer = document.createElement("span")
  resizer.className = "cm-live-table-col-resizer"
  if (resizer.dataset) {
    resizer.dataset.testid = "cm-live-table-col-resizer"
    resizer.dataset.colIndex = String(colIndex)
  }
  resizer.setAttribute("role", "separator")
  resizer.setAttribute("aria-orientation", "vertical")
  resizer.setAttribute("aria-label", `${colIndex + 1}열 너비 조절`)
  resizer.addEventListener("click", stopAndPrevent)
  resizer.addEventListener("dblclick", (event: MouseEvent) => {
    stopAndPrevent(event)
    if (isEditable && !isEditable()) return
    visualOptions.columnWidths[colIndex] = 0
    applyColElementWidth(colEl, 0)
    onVisualOptionsChange?.()
  })

  let isResizing = false
  const startResize = (
    event: ResizePointerEvent,
    moveEventName: ResizeMoveEventName,
    upEventNames: readonly ResizeUpEventName[]
  ) => {
    if ((isEditable && !isEditable()) || (typeof event.button === "number" && event.button !== 0)) return
    stopAndPrevent(event)
    if (isResizing) return
    isResizing = true
    beginColumnResizeSession({
      event,
      th,
      colIndex,
      colEl,
      visualOptions,
      moveEventName,
      upEventNames,
      onVisualOptionsChange,
      onEnd: () => {
        isResizing = false
      },
    })
  }

  resizer.addEventListener("pointerdown", (e: PointerEvent) =>
    startResize(e, "pointermove", ["pointerup", "pointercancel"])
  )
  resizer.addEventListener("mousedown", (e: MouseEvent) => startResize(e, "mousemove", ["mouseup"]))
  th.appendChild(resizer)
  return resizer
}
