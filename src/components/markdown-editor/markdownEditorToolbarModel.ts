import type { WheelEvent as ReactWheelEvent } from "react"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"

export { blockMarkdownSnippets } from "./markdownEditorBlockSnippets"

export const modShortcutLabel =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl+"

export const toolbarMarkdownSnippets = [
  { label: "H1", title: "제목 1", before: "# ", after: "" },
  { label: "H2", title: "제목 2", before: "## ", after: "" },
  { label: "H3", title: "제목 3", before: "### ", after: "" },
  { label: "I", title: `기울임 (${modShortcutLabel}I)`, before: "_", after: "_", toggle: true },
  { label: "S", title: `취소선 (${modShortcutLabel}Shift+X)`, before: "~~", after: "~~", toggle: true },
  { label: "`", title: `인라인 코드 (${modShortcutLabel}E)`, before: "`", after: "`", toggle: true },
  { label: ">", title: "인용문", before: "> ", after: "" },
] as const

export const toolbarListCommands: ReadonlyArray<{
  label: string
  title: string
  command: MarkdownEditorListCommand
}> = [
  { label: "List", title: "목록", command: "unordered" },
  { label: "Ordered List", title: "순서 목록", command: "ordered" },
  { label: "Task", title: "작업 목록", command: "task" },
]

export const WHEEL_DELTA_PIXEL = 0
export const WHEEL_DELTA_LINE = 1
export const WHEEL_DELTA_PAGE = 2
export const DEFAULT_WHEEL_LINE_HEIGHT_PX = 16

export const getWheelDeltaYPixels = (event: ReactWheelEvent<HTMLElement>, element: HTMLElement) => {
  if (event.deltaMode === WHEEL_DELTA_PIXEL) return event.deltaY
  if (event.deltaMode === WHEEL_DELTA_PAGE) return event.deltaY * element.clientHeight
  if (event.deltaMode !== WHEEL_DELTA_LINE) return event.deltaY

  const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight)
  const resolvedLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : DEFAULT_WHEEL_LINE_HEIGHT_PX
  return event.deltaY * resolvedLineHeight
}
