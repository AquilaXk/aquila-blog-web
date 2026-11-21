import { useCallback, useMemo, useState, type RefObject } from "react"
import { planInsertBlockSnippet } from "./markdownEditorBlockSnippets"
import {
  createMarkdownEditorTable,
  getMarkdownEditorTableEditAvailability,
  packTableEditAvailabilityMask,
  planMarkdownEditorTableEdit,
  resolveTableCellSelectionOffset,
  unpackTableEditAvailabilityMask,
  type MarkdownEditorTableEdit,
} from "./markdownEditorTableModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

type TableSelectionRange = {
  from: number
  to: number
}

type TableEditAvailability = NonNullable<ReturnType<typeof getMarkdownEditorTableEditAvailability>>
type TableAlignment = Extract<MarkdownEditorTableEdit, { kind: "set-alignment" }>["alignment"]

export const TABLE_ADD_ROW_EDIT: MarkdownEditorTableEdit = { kind: "add-row" }

const isAlignmentDisabled = (alignment: TableAlignment, availability: TableEditAvailability): boolean => {
  if (alignment === "left") return !availability.alignLeft
  return alignment === "center" ? !availability.alignCenter : !availability.alignRight
}

export const isTableEditActionDisabled = (
  edit: MarkdownEditorTableEdit,
  availability: TableEditAvailability | null
): boolean => {
  if (!availability) return true
  switch (edit.kind) {
    case "add-row":
    case "insert-row-above":
    case "duplicate-row":
      return !availability.addRow
    case "move-row-up":
    case "move-row-down":
    case "move-row-to":
    case "delete-row":
      return !availability.deleteRow
    case "add-column":
    case "insert-column-left":
    case "duplicate-column":
      return !availability.addColumn
    case "add-row-and-column":
      return !availability.addRow && !availability.addColumn
    case "move-column-left":
    case "move-column-right":
    case "move-column-to":
    case "delete-column":
      return !availability.deleteColumn
    case "clear-row":
    case "clear-column":
      return false
    case "set-alignment":
      return isAlignmentDisabled(edit.alignment, availability)
  }
}

type FocusableTableElement = {
  classList?: { contains?: (token: string) => boolean }
  closest?: <T extends Element = Element>(selector: string) => T | null
  blur?: () => void
}

const asFocusableTableElement = (el: unknown): FocusableTableElement | null =>
  el && typeof el === "object" ? (el as FocusableTableElement) : null

const isTableCellOrImeProxyElement = (el: FocusableTableElement | null): boolean =>
  Boolean(
    el?.classList?.contains?.("cm-live-table-cell-input") ||
      el?.classList?.contains?.("cm-live-table-ime-proxy")
  )

const isEditorContentOutsideTable = (el: FocusableTableElement | null): boolean =>
  Boolean(el?.closest?.(".cm-content") && !el.closest?.(".cm-live-table-wrap"))

const parseDatasetCoordinate = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "0", 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export const resolveActiveTableCellOffset = (
  root: HTMLElement | null,
  readMarkdown: () => string
): number | null => {
  const activeEl = asFocusableTableElement(typeof document !== "undefined" ? document.activeElement : null)
  const isTableInput = isTableCellOrImeProxyElement(activeEl)
  if (!isTableInput && isEditorContentOutsideTable(activeEl)) return null
  const activeWrap =
    (isTableInput ? activeEl?.closest?.<HTMLElement>(".cm-live-table-wrap") : null) ??
    root?.querySelector<HTMLElement>(".cm-live-table-wrap[data-active-mode]") ??
    null
  if (isTableInput) activeEl?.blur?.()
  if (!activeWrap) return null
  const tableFrom = Number.parseInt(activeWrap.dataset?.tableFrom ?? "", 10)
  const row = parseDatasetCoordinate(activeWrap.dataset?.activeRow)
  const col = parseDatasetCoordinate(activeWrap.dataset?.activeCol)
  return resolveTableCellSelectionOffset(readMarkdown(), tableFrom, row, col)
}

type UseMarkdownEditorTableControlsArgs = {
  disabled: boolean
  valueRef: RefObject<string>
  readSelection: () => TableSelectionRange
  applyMutationPlan: (plan: PlannedTextMutation) => boolean
  applyFallbackMutation: (plan: PlannedTextMutation) => {
    value: string
    selection: TableSelectionRange
  }
}

const resolveUnpackedTableAvailability = (
  disabled: boolean,
  mask: number
): TableEditAvailability | null => (disabled ? null : unpackTableEditAvailabilityMask(mask))

const buildInsertedTablePlan = (
  rows: number,
  columns: number,
  resolveSelection: () => TableSelectionRange
): PlannedTextMutation | null => {
  const table = createMarkdownEditorTable(rows, columns)
  if (!table) return null
  const { from, to } = resolveSelection()
  return planInsertBlockSnippet(from, to, table)
}

export const useMarkdownEditorTableControls = ({
  disabled,
  valueRef,
  readSelection,
  applyMutationPlan,
  applyFallbackMutation,
}: UseMarkdownEditorTableControlsArgs) => {
  const [tableRows, setTableRows] = useState(2)
  const [tableColumns, setTableColumns] = useState(2)
  const [tableEditAvailabilityMask, setTableEditAvailabilityMask] = useState(-1)

  const resetTableAvailability = useCallback(() => {
    setTableEditAvailabilityMask(-1)
  }, [])

  const syncSelectionTableAvailability = useCallback(
    (nextValue: string, selection: TableSelectionRange) => {
      setTableEditAvailabilityMask(
        packTableEditAvailabilityMask(
          getMarkdownEditorTableEditAvailability(nextValue, selection.from, selection.to)
        )
      )
    },
    []
  )

  const commitTablePlan = useCallback(
    (plan: PlannedTextMutation | null) => {
      if (disabled || !plan) return
      if (applyMutationPlan(plan)) return
      const next = applyFallbackMutation(plan)
      syncSelectionTableAvailability(next.value, next.selection)
    },
    [applyFallbackMutation, applyMutationPlan, disabled, syncSelectionTableAvailability]
  )

  const resolveSelectionForTable = useCallback(() => {
    const selection = readSelection()
    syncSelectionTableAvailability(valueRef.current, selection)
    return selection
  }, [readSelection, syncSelectionTableAvailability, valueRef])

  const insertTable = useCallback(() => {
    if (disabled) return
    commitTablePlan(buildInsertedTablePlan(tableRows, tableColumns, resolveSelectionForTable))
  }, [commitTablePlan, disabled, resolveSelectionForTable, tableColumns, tableRows])

  const tableEditAction = useCallback(
    (edit: MarkdownEditorTableEdit) => {
      if (disabled) return
      const { from, to } = resolveSelectionForTable()
      commitTablePlan(planMarkdownEditorTableEdit(valueRef.current, from, to, edit))
    },
    [commitTablePlan, disabled, resolveSelectionForTable, valueRef]
  )

  const tableEditAvailability = useMemo(
    () => resolveUnpackedTableAvailability(disabled, tableEditAvailabilityMask),
    [disabled, tableEditAvailabilityMask]
  )

  const isTableEditDisabled = useCallback(
    (edit: MarkdownEditorTableEdit) => isTableEditActionDisabled(edit, tableEditAvailability),
    [tableEditAvailability]
  )

  const isTableSelection = !isTableEditDisabled(TABLE_ADD_ROW_EDIT)

  return {
    tableRows,
    setTableRows,
    tableColumns,
    setTableColumns,
    resetTableAvailability,
    syncSelectionTableAvailability,
    insertTable,
    tableEditAction,
    isTableEditDisabled,
    isTableSelection,
  }
}
