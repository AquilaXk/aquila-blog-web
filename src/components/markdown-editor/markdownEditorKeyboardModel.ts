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
  planMarkdownEditorTableTab,
} from "./markdownEditorTableModel"
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

/** True when caret offset is on a content line inside an open ```/~~~ fence. */
export const isOffsetInsideFencedCodeBlock = (value: string, offset: number): boolean => {
  const clamped = Math.max(0, Math.min(offset, value.length))
  const before = value.slice(0, clamped)
  const lines = before.split("\n")
  let inFence = false
  let openMarker = ""
  let openLen = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const isCurrentLine = index === lines.length - 1
    const match = FENCE_LINE_RE.exec(line)
    if (!match?.groups) {
      if (isCurrentLine) return inFence
      continue
    }

    const fence = match.groups.fence ?? ""
    const marker = fence[0] ?? ""
    const len = fence.length
    const info = match.groups.info ?? ""

    if (!inFence) {
      if (isCurrentLine) return false
      inFence = true
      openMarker = marker
      openLen = len
      continue
    }

    if (marker === openMarker && len >= openLen && info.trim() === "") {
      if (isCurrentLine) return false
      inFence = false
      openMarker = ""
      openLen = 0
    } else if (isCurrentLine) {
      return true
    }
  }

  return inFence
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
    const rest = value.slice(lineEnd + 1)
    const restLines = rest.split("\n")
    let currentNum = nextNumber
    const renumbered: string[] = []
    let spanEnd = lineEnd

    for (const rLine of restLines) {
      const rMatch = matchListMarkerLine(rLine)
      if (rMatch && rMatch.kind === "ordered" && rMatch.indent === matched.indent) {
        currentNum += 1
        renumbered.push(`${rMatch.indent}${currentNum}. ${rMatch.content}`)
        spanEnd += 1 + rLine.length
      } else {
        break
      }
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

export const cycleTaskCheckboxInLine = (lineText: string): { replaced: boolean; lineText: string } => {
  const uncheckedMatch = /^([ \t]*[-*+][ \t]+\[) (\][ \t]*.*)$/.exec(lineText)
  if (uncheckedMatch) {
    const boxPos = uncheckedMatch[1].length
    return {
      replaced: true,
      lineText: `${lineText.slice(0, boxPos)}x${lineText.slice(boxPos + 1)}`,
    }
  }

  const checkedMatch = /^([ \t]*[-*+][ \t]+\[)[xX](\][ \t]*.*)$/.exec(lineText)
  if (checkedMatch) {
    const boxPos = checkedMatch[1].length
    return {
      replaced: true,
      lineText: `${lineText.slice(0, boxPos)} ${lineText.slice(boxPos + 1)}`,
    }
  }

  const bulletMatch = /^([ \t]*)(?:[-*+]|\d+\.)[ \t]+(.*)$/.exec(lineText)
  if (bulletMatch) {
    return {
      replaced: true,
      lineText: `${bulletMatch[1]}- [ ] ${bulletMatch[2]}`,
    }
  }

  const plainMatch = /^([ \t]*)(.*)$/.exec(lineText)
  const indent = plainMatch?.[1] ?? ""
  const content = plainMatch?.[2] ?? ""
  return {
    replaced: true,
    lineText: `${indent}- [ ] ${content}`,
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
  if (!event.shiftKey && key === "e") return "inlineCode"
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
