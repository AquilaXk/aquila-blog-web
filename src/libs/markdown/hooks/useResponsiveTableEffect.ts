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

// 참조 구현: Responsive markdown table data-label mapper — 단일 패스 zero-allocation 경량화
const applyResponsiveTableLabels = (root: HTMLElement) => {
  const tables = root.querySelectorAll<HTMLTableElement>("table")
  for (let t = 0; t < tables.length; t += 1) {
    const table = tables[t]
    if (!table.classList.contains("aq-table-responsive")) {
      table.classList.add("aq-table-responsive")
    }
    const labels = buildHeaderLabels(table)

    const bodyRows: HTMLTableRowElement[] = []
    if (table.tBodies.length > 0) {
      for (let b = 0; b < table.tBodies.length; b += 1) {
        const rows = table.tBodies[b].rows
        for (let r = 0; r < rows.length; r += 1) bodyRows.push(rows[r])
      }
    } else {
      const allRows = table.querySelectorAll<HTMLTableRowElement>("tr")
      for (let r = 0; r < allRows.length; r += 1) {
        const row = allRows[r]
        if (row.closest("thead")) continue
        let hasTd = false
        for (let c = 0; c < row.cells.length; c += 1) {
          if (row.cells[c].tagName === "TD") {
            hasTd = true
            break
          }
        }
        if (hasTd) bodyRows.push(row)
      }
    }

    for (let r = 0; r < bodyRows.length; r += 1) {
      const children = bodyRows[r].children
      let visualColumnIndex = 0
      let cellIndex = 0
      for (let c = 0; c < children.length; c += 1) {
        const child = children[c]
        if (!(child instanceof HTMLTableCellElement) || (child.tagName !== "TD" && child.tagName !== "TH")) {
          continue
        }
        const colSpan = Math.max(1, child.colSpan || 1)
        let label = ""
        if (colSpan === 1) {
          label = labels[visualColumnIndex] || `항목 ${cellIndex + 1}`
        } else {
          let prev = ""
          for (let spanIdx = 0; spanIdx < colSpan; spanIdx += 1) {
            const part = labels[visualColumnIndex + spanIdx]
            if (!part || part === prev) continue
            label = label ? `${label} · ${part}` : part
            prev = part
          }
          if (!label) {
            label = labels[visualColumnIndex] || `항목 ${cellIndex + 1}`
          }
        }
        if (child.getAttribute("data-label") !== label) {
          child.setAttribute("data-label", label)
        }
        visualColumnIndex += colSpan
        cellIndex += 1
      }
    }
  }
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
  if (!root.querySelector("table")) return
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
