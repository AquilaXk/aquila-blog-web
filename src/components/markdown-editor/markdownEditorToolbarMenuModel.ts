export type ToolbarMenuEdge = "first" | "last"
export type ToolbarMenuDirection = "next" | "previous"

export const resolveToolbarMenuInitialIndex = (
  disabledItems: readonly boolean[],
  edge: ToolbarMenuEdge
) => {
  if (edge === "first") return disabledItems.findIndex((disabled) => !disabled)

  for (let index = disabledItems.length - 1; index >= 0; index -= 1) {
    if (!disabledItems[index]) return index
  }
  return -1
}

export const resolveToolbarMenuMoveIndex = (
  disabledItems: readonly boolean[],
  activeIndex: number,
  direction: ToolbarMenuDirection
) => {
  if (disabledItems.length === 0 || disabledItems.every(Boolean)) return -1

  const step = direction === "next" ? 1 : -1
  let index = activeIndex
  for (let visited = 0; visited < disabledItems.length; visited += 1) {
    index = (index + step + disabledItems.length) % disabledItems.length
    if (!disabledItems[index]) return index
  }
  return -1
}
