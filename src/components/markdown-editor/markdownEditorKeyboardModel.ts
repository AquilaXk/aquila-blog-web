import {
  planHardBreak,
  planIndentLines,
  planInsertMarkdownLink,
  planOutdentLines,
  planReplaceSelection,
  planToggleWrapSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"
import {
  isMarkdownEditorTableSelection,
  planMarkdownEditorTableCellNavigation,
  planMarkdownEditorTableEnter,
  planMarkdownEditorTableTab,
} from "./markdownEditorTableModel"

export { planMarkdownEditorTableCellNavigation, planMarkdownEditorTableEnter }
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import { matchListMarkerLine } from "./markdownEditorListCommandsModel"
import { resolveMarkdownEditorCommandShortcut } from "./markdownEditorCommandRegistryModel"

export type MarkdownFormatShortcut =
  | "bold"
  | "italic"
  | "link"
  | "strikethrough"
  | "inlineCode"

export type { ListMarkerMatch } from "./markdownEditorListCommandsModel"

const FORMAT_WRAP: Record<Exclude<MarkdownFormatShortcut, "link">, { before: string; after: string }> = {
  bold: { before: "**", after: "**" },
  italic: { before: "_", after: "_" },
  strikethrough: { before: "~~", after: "~~" },
  inlineCode: { before: "`", after: "`" },
}

export const isComposingEditorKeyboardEvent = (event: {
  nativeEvent: { isComposing?: boolean; keyCode?: number }
}): boolean => {
  const nativeEvent = event.nativeEvent
  return nativeEvent.isComposing === true || nativeEvent.keyCode === 229
}

const FENCE_LINE_RE = /^(?<indent> {0,3})(?<fence>`{3,}|~{3,})(?<info>.*)$/

type FenceInterval = {
  openStart: number
  openEnd: number
  closeStart: number
  closeEnd: number
  unclosed: boolean
}

let cachedFenceIntervals: { value: string; intervals: readonly FenceInterval[] } | null = null

const getFenceIntervals = (value: string): readonly FenceInterval[] => {
  if (cachedFenceIntervals && cachedFenceIntervals.value === value) {
    return cachedFenceIntervals.intervals
  }
  const intervals: FenceInterval[] = []
  let inFence = false
  let openMarker = ""
  let openLen = 0
  let openStart = 0
  let openEnd = 0
  let lineStart = 0

  while (lineStart <= value.length) {
    const nextBreak = value.indexOf("\n", lineStart)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const line = value.slice(lineStart, lineEnd)
    const match = FENCE_LINE_RE.exec(line)
    if (match?.groups) {
      const fence = match.groups.fence ?? ""
      const marker = fence[0] ?? ""
      const len = fence.length
      const info = match.groups.info ?? ""
      if (!inFence) {
        inFence = true
        openMarker = marker
        openLen = len
        openStart = lineStart
        openEnd = lineEnd
      } else if (marker === openMarker && len >= openLen && info.trim() === "") {
        intervals.push({
          openStart,
          openEnd,
          closeStart: lineStart,
          closeEnd: lineEnd,
          unclosed: false,
        })
        inFence = false
        openMarker = ""
        openLen = 0
      }
    }
    if (nextBreak === -1) break
    lineStart = nextBreak + 1
  }

  if (inFence) {
    intervals.push({
      openStart,
      openEnd,
      closeStart: value.length + 1,
      closeEnd: value.length + 1,
      unclosed: true,
    })
  }

  cachedFenceIntervals = { value, intervals }
  return intervals
}

export const isOffsetInsideFencedCodeBlock = (value: string, offset: number): boolean => {
  if (!value.includes("```") && !value.includes("~~~")) return false
  const clamped = Math.max(0, Math.min(offset, value.length))
  const intervals = getFenceIntervals(value)
  if (intervals.length === 0) return false

  let low = 0
  let high = intervals.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (intervals[mid]!.openEnd < clamped) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (candidate === -1) return false
  return clamped < intervals[candidate]!.closeStart
}

export { matchListMarkerLine }

export const planListEnterContinuation = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation | null => {
  if (isOffsetInsideFencedCodeBlock(value, selectionStart)) return null

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1
  const nextBreak = value.indexOf("\n", selectionStart)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const line = value.slice(lineStart, lineEnd)
  const matched = matchListMarkerLine(line)
  if (!matched) return null

  if (matched.content === "") {
    if (matched.indent.length > 0) {
      const outdentLen = matched.indent.startsWith("\t") ? 1 : Math.min(2, matched.indent.length)
      const nextIndent = matched.indent.slice(outdentLen)
      const nextMarker = matched.kind === "ordered" ? "1. " : matched.marker
      const replacement = `${nextIndent}${nextMarker}`
      return {
        rangeStart: lineStart,
        rangeEnd: lineEnd,
        replacement,
        selectionStart: lineStart + replacement.length,
        selectionEnd: lineStart + replacement.length,
      }
    }

    return {
      rangeStart: lineStart,
      rangeEnd: lineEnd,
      replacement: "",
      selectionStart: lineStart,
      selectionEnd: lineStart,
    }
  }

  if (matched.kind === "ordered") {
    const nextNumber = matched.number + 1
    const nextMarker = `${matched.indent}${nextNumber}. `
    let currentNum = nextNumber
    const renumbered: string[] = []
    let spanEnd = lineEnd
    let cursor = lineEnd + 1

    while (cursor <= value.length) {
      const nextLineBreak = value.indexOf("\n", cursor)
      const rLine = nextLineBreak === -1 ? value.slice(cursor) : value.slice(cursor, nextLineBreak)
      const rMatch = matchListMarkerLine(rLine)
      if (rMatch?.kind !== "ordered" || rMatch.indent !== matched.indent) {
        break
      }
      currentNum += 1
      renumbered.push(`${rMatch.indent}${currentNum}. ${rMatch.content}`)
      spanEnd += 1 + rLine.length
      if (nextLineBreak === -1) break
      cursor = nextLineBreak + 1
    }

    if (renumbered.length > 0) {
      const remainderOfLine = value.slice(selectionEnd, lineEnd)
      const replacement = `\n${nextMarker}${remainderOfLine.trimStart()}\n${renumbered.join("\n")}`
      return {
        rangeStart: selectionStart,
        rangeEnd: spanEnd,
        replacement,
        selectionStart: selectionStart + 1 + nextMarker.length,
        selectionEnd: selectionStart + 1 + nextMarker.length,
      }
    }

    return planReplaceSelection(selectionStart, selectionEnd, `\n${nextMarker}`)
  }

  const nextMarker = `${matched.indent}${matched.marker}`

  return planReplaceSelection(selectionStart, selectionEnd, `\n${nextMarker}`)
}

const UNCHECKED_TASK_RE = /^([ \t]*[-*+][ \t]+\[) (\][ \t]*.*)$/
const CHECKED_TASK_RE = /^([ \t]*[-*+][ \t]+\[)[xX](\][ \t]*.*)$/
const BULLET_OR_ORDERED_RE = /^([ \t]*)(?:[-*+]|\d+\.)[ \t]+(.*)$/

export const cycleTaskCheckboxInLine = (lineText: string): { replaced: boolean; lineText: string } => {
  let i = 0
  while (i < lineText.length) {
    const ch = lineText.charCodeAt(i)
    if (ch !== 32 && ch !== 9) break
    i += 1
  }
  const code = i < lineText.length ? lineText.charCodeAt(i) : -1

  if (code === 45 || code === 42 || code === 43) {
    const uncheckedMatch = UNCHECKED_TASK_RE.exec(lineText)
    if (uncheckedMatch) {
      const boxPos = uncheckedMatch[1].length
      return {
        replaced: true,
        lineText: `${lineText.slice(0, boxPos)}x${lineText.slice(boxPos + 1)}`,
      }
    }

    const checkedMatch = CHECKED_TASK_RE.exec(lineText)
    if (checkedMatch) {
      const boxPos = checkedMatch[1].length
      return {
        replaced: true,
        lineText: `${lineText.slice(0, boxPos)} ${lineText.slice(boxPos + 1)}`,
      }
    }

    const bulletMatch = BULLET_OR_ORDERED_RE.exec(lineText)
    if (bulletMatch) {
      return {
        replaced: true,
        lineText: `${bulletMatch[1]}- [ ] ${bulletMatch[2]}`,
      }
    }
  } else if (code >= 48 && code <= 57) {
    const bulletMatch = BULLET_OR_ORDERED_RE.exec(lineText)
    if (bulletMatch) {
      return {
        replaced: true,
        lineText: `${bulletMatch[1]}- [ ] ${bulletMatch[2]}`,
      }
    }
  }

  return {
    replaced: true,
    lineText: `${lineText.slice(0, i)}- [ ] ${lineText.slice(i)}`,
  }
}

export const planFormatShortcutMutation = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shortcut: MarkdownFormatShortcut
): PlannedTextMutation => {
  if (shortcut === "link") {
    return planInsertMarkdownLink(value, selectionStart, selectionEnd)
  }
  const wrap = FORMAT_WRAP[shortcut]
  return planToggleWrapSelection(value, selectionStart, selectionEnd, wrap.before, wrap.after)
}

export const resolveFormatShortcut = (event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): MarkdownFormatShortcut | null => {
  const mod = event.metaKey || event.ctrlKey
  if (!mod || event.altKey) return null

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

  if (!event.shiftKey && key === "i") return "italic"
  if (!event.shiftKey && key === "k") return "link"
  if (event.shiftKey && (key === "c" || key === "C")) return "inlineCode"
  if (event.shiftKey && (key === "x" || key === "X")) return "strikethrough"
  return null
}

export { resolveMarkdownEditorCommandShortcut }

export const resolveMarkdownEditorLineCommand = (event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): MarkdownEditorLineCommand | null => {
  const hasOnlyAlt = event.altKey && !event.metaKey && !event.ctrlKey
  if (hasOnlyAlt && event.key === "ArrowUp" && !event.shiftKey) return "move-up"
  if (hasOnlyAlt && event.key === "ArrowDown" && !event.shiftKey) return "move-down"
  if (hasOnlyAlt && event.key === "ArrowDown" && event.shiftKey) return "duplicate"

  const hasSingleMod = event.metaKey !== event.ctrlKey
  if (hasSingleMod && event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") return "delete"

  return null
}

export const isSaveShortcut = (event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}): boolean => {
  if (event.altKey || event.shiftKey) return false
  if (!event.metaKey && !event.ctrlKey) return false
  return event.key.toLowerCase() === "s"
}

export const planTabIndentMutation = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shiftKey: boolean
): PlannedTextMutation | null => {
  if (shiftKey) {
    return planOutdentLines(value, selectionStart, selectionEnd)
  }
  return planIndentLines(value, selectionStart, selectionEnd)
}

export type TableCellTabMutationPlan = {
  handledTable: boolean
  mutation: PlannedTextMutation | null
}

export const planTableCellTabMutation = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shiftKey: boolean
): TableCellTabMutationPlan => {
  if (isMarkdownEditorTableSelection(value, selectionStart, selectionEnd)) {
    return {
      handledTable: true,
      mutation: planMarkdownEditorTableTab(value, selectionStart, selectionEnd, shiftKey ? "previous" : "next"),
    }
  }

  return {
    handledTable: false,
    mutation: planTabIndentMutation(value, selectionStart, selectionEnd, shiftKey),
  }
}

export { planHardBreak }
