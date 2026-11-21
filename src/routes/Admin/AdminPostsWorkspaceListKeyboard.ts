// 참조 구현: payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT) & TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT)
import type { KeyboardEvent as ReactKeyboardEvent } from "react"

export const ADMIN_POSTS_ROW_ATTR = "data-admin-posts-row"
export const ADMIN_POSTS_ROW_PRIMARY_ATTR = "data-admin-posts-row-primary"

const ROW_SELECTOR = `[${ADMIN_POSTS_ROW_ATTR}]`
const PRIMARY_SELECTOR = `[${ADMIN_POSTS_ROW_PRIMARY_ATTR}]`
const FALLBACK_ROW_FOCUS_SELECTOR = 'input[type="checkbox"]:not(:disabled), button:not(:disabled), a[href]'

const isElementLike = (value: unknown): value is HTMLElement =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { closest?: unknown }).closest === "function"

const isEditableTarget = (target: EventTarget | null) => {
  if (!isElementLike(target)) return false
  return Boolean(
    target.closest(
      "input:not([type='checkbox']):not([type='radio']):not([type='button']), textarea, select, [contenteditable='true']"
    )
  )
}

const isEnabledFocusable = (element: HTMLElement | null) => {
  if (!element) return false
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false
  return true
}

export const resolveAdminPostsRowPrimary = (row: HTMLElement): HTMLElement | null => {
  return row.querySelector<HTMLElement>(PRIMARY_SELECTOR)
}

const focusRowTarget = (row: HTMLElement): boolean => {
  const primary = resolveAdminPostsRowPrimary(row)
  const target = isEnabledFocusable(primary)
    ? primary
    : row.querySelector<HTMLElement>(FALLBACK_ROW_FOCUS_SELECTOR)
  if (!isEnabledFocusable(target)) return false
  target!.focus({ preventScroll: true })
  target!.scrollIntoView({ block: "nearest" })
  return true
}

export const focusAdjacentAdminPostsRow = (
  currentTarget: HTMLElement,
  direction: "prev" | "next" | "first" | "last",
  root: ParentNode
): boolean => {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(ROW_SELECTOR))
  if (rows.length === 0) return false

  const currentRow = currentTarget.closest<HTMLElement>(ROW_SELECTOR)
  if (!currentRow) return false

  const currentIndex = rows.indexOf(currentRow)
  if (currentIndex < 0) return false

  if (direction === "first") {
    for (let index = 0; index < rows.length; index += 1) {
      if (focusRowTarget(rows[index]!)) return true
    }
    return false
  }

  if (direction === "last") {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (focusRowTarget(rows[index]!)) return true
    }
    return false
  }

  if (direction === "next") {
    for (let index = currentIndex + 1; index < rows.length; index += 1) {
      if (focusRowTarget(rows[index]!)) return true
    }
    return false
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (focusRowTarget(rows[index]!)) return true
  }
  return false
}

export const handleAdminPostsListKeyDown = (
  event: ReactKeyboardEvent<HTMLElement>,
  root: ParentNode | null,
  options?: {
    onToggleCurrentRowSelect?: (currentRow: HTMLElement) => void
    onOpenCurrentRowEditor?: (currentRow: HTMLElement) => void
  }
) => {
  if (!root || isEditableTarget(event.target)) return
  if (event.nativeEvent?.isComposing || (event as unknown as { isComposing?: boolean }).isComposing) return
  if (!isElementLike(event.target)) return
  const currentTarget = event.target
  const currentRow = currentTarget.closest<HTMLElement>(ROW_SELECTOR)
  if (!currentRow) return

  if (event.metaKey || event.ctrlKey || event.altKey) return

  const key = event.key
  if (key === "ArrowDown" || key === "j" || key === "J") {
    focusAdjacentAdminPostsRow(currentTarget, "next", root)
    event.preventDefault()
    return
  }
  if (key === "ArrowUp" || key === "k" || key === "K") {
    focusAdjacentAdminPostsRow(currentTarget, "prev", root)
    event.preventDefault()
    return
  }
  if (key === "Home") {
    focusAdjacentAdminPostsRow(currentTarget, "first", root)
    event.preventDefault()
    return
  }
  if (key === "End") {
    focusAdjacentAdminPostsRow(currentTarget, "last", root)
    event.preventDefault()
    return
  }
  if (key === "x" || key === "X") {
    const checkbox = currentRow.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (checkbox && typeof checkbox.click === "function") {
      checkbox.click()
      event.preventDefault()
    } else if (options?.onToggleCurrentRowSelect) {
      options.onToggleCurrentRowSelect(currentRow)
      event.preventDefault()
    }
    return
  }
  if (key === "e" || key === "E") {
    const primary = resolveAdminPostsRowPrimary(currentRow)
    if (primary && typeof primary.click === "function") {
      primary.click()
      event.preventDefault()
    } else if (options?.onOpenCurrentRowEditor) {
      options.onOpenCurrentRowEditor(currentRow)
      event.preventDefault()
    }
    return
  }
}
