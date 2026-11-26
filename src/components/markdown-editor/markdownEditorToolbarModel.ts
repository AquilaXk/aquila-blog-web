import type { WheelEvent as ReactWheelEvent } from "react"
import type { SiteLanguage } from "../../libs/language"
import type { BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import type { MarkdownEditorCommandDescriptor } from "./markdownEditorCommandRegistryModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { createMarkdownEditorTable } from "./markdownEditorTableModel"

export { blockMarkdownSnippets, directiveBlockMarkdownSnippets } from "./markdownEditorBlockSnippets"

export const buildToolbarTableSnippet = (rows: number, columns: number): BlockSnippetSpec => {
  const existing = createMarkdownEditorTable(rows, columns)
  if (existing) return existing
  const safeRows = Math.max(2, Math.min(8, Math.trunc(rows)))
  const safeCols = Math.max(1, Math.min(8, Math.trunc(columns)))
  const emptyRow = `|${Array.from({ length: safeCols }, () => "  ").join("|")}|`
  const delimiter = `|${Array.from({ length: safeCols }, () => " --- ").join("|")}|`
  const snippet = ["", emptyRow, delimiter, ...Array.from({ length: safeRows - 1 }, () => emptyRow), ""].join("\n")
  return { snippet, cursorOffset: snippet.indexOf(emptyRow) + 2 }
}

export const getToolbarCommandLabel = (
  command: MarkdownEditorCommandDescriptor,
  language: SiteLanguage = "ko"
) => {
  const baseLabel = language === "en" ? command.labelEn : command.label
  return command.shortcut
    ? `${baseLabel} (${command.shortcut.replace("Mod+", modShortcutLabel)})`
    : baseLabel
}

export const modShortcutLabel =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl+"

export const toolbarMarkdownSnippets = [
  { group: "heading", label: "H2", title: "제목 2 (권장)", titleEn: "Heading 2", before: "## ", after: "" },
  { group: "heading", label: "H3", title: "제목 3", titleEn: "Heading 3", before: "### ", after: "" },
  { group: "heading", label: "H1", title: "제목 1 (본문 비권장 · TOC 제외)", titleEn: "Heading 1 (Not in TOC)", before: "# ", after: "" },
  { group: "primary", label: "I", title: `기울임 (${modShortcutLabel}I)`, titleEn: `Italic (${modShortcutLabel}I)`, before: "_", after: "_", toggle: true },
  { group: "more", label: "S", title: `취소선 (${modShortcutLabel}Shift+X)`, titleEn: `Strikethrough (${modShortcutLabel}Shift+X)`, before: "~~", after: "~~", toggle: true },
  { group: "primary", label: "`", title: `인라인 코드 (${modShortcutLabel}E)`, titleEn: `Inline code (${modShortcutLabel}E)`, before: "`", after: "`", toggle: true },
  { group: "structure", label: ">", title: "인용구", titleEn: "Quote", before: "> ", after: "" },
] as const

export const toolbarListCommands: ReadonlyArray<{
  label: string
  title: string
  titleEn: string
  command: MarkdownEditorListCommand
}> = [
  { label: "List", title: "목록", titleEn: "Bulleted list", command: "unordered" },
  { label: "Ordered List", title: "순서 목록", titleEn: "Numbered list", command: "ordered" },
  { label: "Task", title: "작업 목록", titleEn: "Task list", command: "task" },
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
