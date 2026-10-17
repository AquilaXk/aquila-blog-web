import { RefObject, useEffect } from "react"

const normalizeHeaderLabel = (value: string, index: number) => {
  const trimmed = value.trim()
  if (!trimmed) return `항목 ${index + 1}`
  return trimmed
}

const buildHeaderLabels = (table: HTMLTableElement) => {
  const headRows = table.tHead ? Array.from(table.tHead.rows) : []
  if (!headRows.length) {
    const fallbackHeadCells = Array.from(table.querySelectorAll<HTMLTableCellElement>("tr:first-of-type th"))
    return fallbackHeadCells.map((cell, index) => normalizeHeaderLabel(cell.textContent || "", index))
  }

  const matrix: string[][] = []
  let maxColumns = 0

  headRows.forEach((row, rowIndex) => {
    matrix[rowIndex] ||= []
    let colIndex = 0

    Array.from(row.cells).forEach((cell) => {
      const colSpan = Math.max(1, cell.colSpan || 1)
      const rowSpan = Math.max(1, cell.rowSpan || 1)
      const label = normalizeHeaderLabel(cell.textContent || "", colIndex)

      while (matrix[rowIndex][colIndex] !== undefined) {
        colIndex += 1
      }

      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        matrix[r] ||= []
        for (let c = colIndex; c < colIndex + colSpan; c += 1) {
          matrix[r][c] = label
        }
      }

      colIndex += colSpan
      maxColumns = Math.max(maxColumns, colIndex)
    })
  })

  return Array.from({ length: maxColumns }, (_, columnIndex) => {
    const path = matrix
      .map((row) => (row[columnIndex] || "").trim())
      .filter(Boolean)
      .filter((value, index, source) => index === 0 || value !== source[index - 1])

    if (!path.length) return `항목 ${columnIndex + 1}`
    return path.join(" · ")
  })
}

const applyResponsiveTableLabels = (root: HTMLElement) => {
  const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table"))
  tables.forEach((table) => {
    table.classList.add("aq-table-responsive")
    const labels = buildHeaderLabels(table)

    const bodyRows =
      table.tBodies.length > 0
        ? Array.from(table.tBodies).flatMap((section) => Array.from(section.rows))
        : Array.from(table.querySelectorAll<HTMLTableRowElement>("tr")).filter((row) => {
            if (row.closest("thead")) return false
            return Array.from(row.cells).some((cell) => cell.tagName === "TD")
          })

    bodyRows.forEach((row) => {
      const cells = Array.from(row.children).filter((child): child is HTMLTableCellElement => {
        return child instanceof HTMLTableCellElement && (child.tagName === "TD" || child.tagName === "TH")
      })
      let visualColumnIndex = 0
      cells.forEach((cell, index) => {
        const colSpan = Math.max(1, cell.colSpan || 1)
        const columnLabels = labels
          .slice(visualColumnIndex, visualColumnIndex + colSpan)
          .filter(Boolean)
          .filter((value, labelIndex, source) => labelIndex === 0 || value !== source[labelIndex - 1])
        const label =
          columnLabels.join(" · ") ||
          labels[visualColumnIndex] ||
          `항목 ${index + 1}`
        cell.setAttribute("data-label", label)
        visualColumnIndex += colSpan
      })
    })
  })
}

const TABLE_NODE_SELECTOR = "table, thead, tbody, tr, th, td"

const resolveElementFromMutationNode = (node: Node | null): Element | null => {
  if (!node) return null
  if (typeof (node as Element).matches === "function") return node as Element
  if (node.nodeType === 3) return (node as Text).parentElement
  return null
}

const isTableTargetNode = (node: Node | null): boolean => {
  const element = resolveElementFromMutationNode(node)
  if (!element) return false
  return Boolean(element.matches(TABLE_NODE_SELECTOR) || element.closest?.(TABLE_NODE_SELECTOR))
}

const isTableSubtreeNode = (node: Node | null): boolean => {
  if (isTableTargetNode(node)) return true
  const element = resolveElementFromMutationNode(node)
  if (!element || typeof element.querySelector !== "function") return false
  return Boolean(element.querySelector(TABLE_NODE_SELECTOR))
}

export const shouldScheduleFromTableMutations = (
  mutations: readonly MutationRecord[]
): boolean => {
  for (const mutation of mutations) {
    if (isTableTargetNode(mutation.target)) return true
    for (const added of Array.from(mutation.addedNodes || [])) {
      if (isTableSubtreeNode(added)) return true
    }
    for (const removed of Array.from(mutation.removedNodes || [])) {
      if (isTableSubtreeNode(removed)) return true
    }
  }
  return false
}

export const syncResponsiveTables = (root: HTMLElement) => {
  applyResponsiveTableLabels(root)
}

const useResponsiveTableEffect = (rootRef?: RefObject<HTMLElement | null>, contentKey?: string) => {
  useEffect(() => {
    const root = rootRef?.current
    if (!root) return

    syncResponsiveTables(root)
  }, [contentKey, rootRef])
}

export default useResponsiveTableEffect
