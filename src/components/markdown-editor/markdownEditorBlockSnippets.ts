// 참조 구현: silverbulletmd/silverbullet (MIT)
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"
import { createMarkdownEditorTable } from "./markdownEditorTableModel"
import { defaultCalloutBlockquoteToken } from "src/libs/markdown/calloutRegistry"

export type BlockSnippetSpec = {
  snippet: string
  cursorOffset: number
}

const joinSnippetLines = (lines: string[]) => lines.join("\n")

const cursorAfter = (snippet: string, marker: string) => {
  const index = snippet.indexOf(marker)
  if (index === -1) {
    throw new Error(`Block snippet cursor marker not found: ${marker}`)
  }
  return index + marker.length
}

const defaultTableBlockSnippet = createMarkdownEditorTable(2, 2)
if (!defaultTableBlockSnippet) {
  throw new Error("Default table snippet is outside the supported bounds")
}
export const tableBlockSnippet: BlockSnippetSpec = defaultTableBlockSnippet

export const codeBlockSnippet: BlockSnippetSpec = (() => {
  const snippet = joinSnippetLines(["", "```", "", "```", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, "```\n"),
  }
})()

export const mermaidBlockSnippet: BlockSnippetSpec = (() => {
  const snippet = joinSnippetLines(["", "```mermaid", "flowchart TD", "    A --> B", "    ", "```", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, "    A --> B\n    "),
  }
})()

export const calloutBlockSnippet: BlockSnippetSpec = (() => {
  const marker = `> [!${defaultCalloutBlockquoteToken}]`
  const snippet = joinSnippetLines(["", marker, "> ", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, `${marker}\n> `),
  }
})()

export const toggleBlockSnippet: BlockSnippetSpec = (() => {
  const snippet = joinSnippetLines(["", ":::toggle ", "", ":::", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, ":::toggle "),
  }
})()

export const embedBlockSnippet: BlockSnippetSpec = (() => {
  const snippet = joinSnippetLines(["", ":::embed https://", "", ":::", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, ":::embed https://"),
  }
})()

export const bookmarkBlockSnippet: BlockSnippetSpec = (() => {
  const snippet = joinSnippetLines(["", ":::bookmark https://", "", ":::", ""])
  return {
    snippet,
    cursorOffset: cursorAfter(snippet, ":::bookmark https://"),
  }
})()

export const planCodeBlockToolbarInsertion = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  language = "ts"
): PlannedTextMutation => {
  const from = Math.max(0, Math.min(selectionStart, selectionEnd))
  const to = Math.max(from, Math.min(Math.max(selectionStart, selectionEnd), value.length))
  const selected = value.slice(from, to)
  const leadingNewline = from > 0 && value.charCodeAt(from - 1) !== 10 ? "\n" : ""
  const trailingNewline = to < value.length && value.charCodeAt(to) !== 10 ? "\n" : ""
  const openFence = `${leadingNewline}\`\`\`${language}\n`
  const closeFence = `\n\`\`\`${trailingNewline}`
  const replacement = `${openFence}${selected}${closeFence}`
  const caret = from + openFence.length
  return {
    rangeStart: from,
    rangeEnd: to,
    replacement,
    selectionStart: caret,
    selectionEnd: caret + selected.length,
  }
}

export const planInsertBlockSnippet = (
  selectionStart: number,
  selectionEnd: number,
  spec: BlockSnippetSpec
): PlannedTextMutation => {
  const insertAt = selectionStart
  const replaceEnd = selectionStart === selectionEnd ? selectionEnd : insertAt
  return planReplaceSelection(insertAt, replaceEnd, spec.snippet, spec.cursorOffset)
}

export const planStandaloneSnippetInsertion = (
  current: string,
  selection: { from: number; to: number },
  snippet: string
): PlannedTextMutation => {
  const from = Math.max(0, Math.min(selection.from, current.length))
  const to = Math.max(from, Math.min(selection.to, current.length))
  const prefix = from > 0 && current[from - 1] !== "\n" ? "\n\n" : ""
  const suffix = to < current.length && current[to] !== "\n" ? "\n\n" : "\n"
  const replacement = `${prefix}${snippet}${suffix}`
  const cursor = from + replacement.length
  return {
    rangeStart: from,
    rangeEnd: to,
    replacement,
    selectionStart: cursor,
    selectionEnd: cursor,
  }
}

export const blockMarkdownSnippets = [
  { label: "Code", title: "코드 블록", titleEn: "Code block", ...codeBlockSnippet },
  { label: "Table", title: "표", titleEn: "Table", ...tableBlockSnippet },
  { label: "Mermaid", title: "Mermaid", titleEn: "Mermaid", ...mermaidBlockSnippet, disableWhenMermaid: true },
  { label: "Callout", title: "콜아웃", titleEn: "Callout", ...calloutBlockSnippet },
  { label: "Toggle", title: "토글", titleEn: "Toggle", ...toggleBlockSnippet },
] as const

export const directiveBlockMarkdownSnippets = [
  { label: "Embed", title: "임베드", titleEn: "Embed", ...embedBlockSnippet },
  { label: "Bookmark", title: "북마크", titleEn: "Bookmark", ...bookmarkBlockSnippet },
] as const

export const BLOCK_SNIPPET_SAMPLE_MARKERS = [
  "항목",
  "설명",
  "값",
  "내용",
  "내용을 입력하세요.",
  "Admin write",
  "DB commit",
  "fun example",
  "invalidatePost.kt",
  "설계 원칙",
  "kotlin title",
] as const

export const snippetContainsSampleMarker = (snippet: string) =>
  BLOCK_SNIPPET_SAMPLE_MARKERS.some((marker) => snippet.includes(marker))
