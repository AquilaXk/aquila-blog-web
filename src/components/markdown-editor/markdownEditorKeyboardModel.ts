// 참조 구현: @codemirror/lang-markdown (MIT)
import {
  isWrapSelectionActive,
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

export {
  isWrapSelectionActive,
  planMarkdownEditorTableCellNavigation,
  planMarkdownEditorTableEnter,
  planToggleWrapSelection,
}
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

// Flat [openEnd0, closeStart0, openEnd1, closeStart1, ...] Int32Array scanned with charCodeAt
let cachedFenceIntervals: { value: string; pairs: Int32Array; count: number } | null = null

const scanFenceLineCharCodes = (
  value: string,
  lineStart: number,
  lineEnd: number
): { marker: number; len: number; hasBacktickInInfo: boolean; infoNonEmpty: boolean } | null => {
  let pos = lineStart
  let spaces = 0
  while (pos < lineEnd && spaces < 3 && value.charCodeAt(pos) === 32) {
    spaces += 1
    pos += 1
  }
  if (pos >= lineEnd) return null
  const marker = value.charCodeAt(pos)
  if (marker !== 96 && marker !== 126) return null
  let run = 1
  while (pos + run < lineEnd && value.charCodeAt(pos + run) === marker) {
    run += 1
  }
  if (run < 3) return null
  let infoPos = pos + run
  let infoNonEmpty = false
  let hasBacktickInInfo = false
  while (infoPos < lineEnd) {
    const c = value.charCodeAt(infoPos)
    if (c === 96) hasBacktickInInfo = true
    if (c !== 32 && c !== 9 && c !== 13) infoNonEmpty = true
    infoPos += 1
  }
  return { marker, len: run, hasBacktickInInfo, infoNonEmpty }
}

const getFenceIntervalPairs = (value: string): { pairs: Int32Array; count: number } => {
  if (cachedFenceIntervals && cachedFenceIntervals.value === value) {
    return { pairs: cachedFenceIntervals.pairs, count: cachedFenceIntervals.count }
  }
  let capacity = 16
  let pairs = new Int32Array(capacity)
  let count = 0
  let inFence = false
  let openMarker = 0
  let openLen = 0
  let openEnd = 0
  let lineStart = 0
  const len = value.length

  const appendPair = (openLineEnd: number, closeLineStart: number) => {
    const writeAt = count << 1
    if (writeAt + 2 > capacity) {
      capacity <<= 1
      const grown = new Int32Array(capacity)
      grown.set(pairs)
      pairs = grown
    }
    pairs[writeAt] = openLineEnd
    pairs[writeAt + 1] = closeLineStart
    count += 1
  }

  while (lineStart <= len) {
    const nextBreak = value.indexOf("\n", lineStart)
    const lineEnd = nextBreak === -1 ? len : nextBreak
    const fence = scanFenceLineCharCodes(value, lineStart, lineEnd)
    if (fence) {
      if (!inFence) {
        if (!(fence.marker === 96 && fence.hasBacktickInInfo)) {
          inFence = true
          openMarker = fence.marker
          openLen = fence.len
          openEnd = lineEnd
        }
      } else if (fence.marker === openMarker && fence.len >= openLen && !fence.infoNonEmpty) {
        appendPair(openEnd, lineStart)
        inFence = false
        openMarker = 0
        openLen = 0
      }
    }
    if (nextBreak === -1) break
    lineStart = nextBreak + 1
  }

  if (inFence) {
    appendPair(openEnd, len + 1)
  }

  cachedFenceIntervals = { value, pairs, count }
  return { pairs, count }
}

export const isOffsetInsideFencedCodeBlock = (value: string, offset: number): boolean => {
  if (!value.includes("```") && !value.includes("~~~")) return false
  const clamped = Math.max(0, Math.min(offset, value.length))
  const { pairs, count } = getFenceIntervalPairs(value)
  if (count === 0) return false

  let low = 0
  let high = count - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (pairs[mid << 1]! < clamped) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (candidate === -1) return false
  return clamped < pairs[(candidate << 1) + 1]!
}

export { matchListMarkerLine }

const stepOutNestedQuoteMarker = (marker: string): string | null => {
  const withoutTrailingSpace = marker.replace(/[ \t]+$/, "")
  const lastQuoteIndex = withoutTrailingSpace.lastIndexOf(">")
  if (lastQuoteIndex <= 0) return null
  const outer = withoutTrailingSpace.slice(0, lastQuoteIndex).replace(/[ \t]+$/, "")
  return outer ? `${outer} ` : null
}

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

  if (selectionStart === lineStart && selectionEnd === lineStart) {
    return planReplaceSelection(selectionStart, selectionEnd, "\n")
  }

  if (matched.content === "") {
    if (matched.kind === "quote") {
      const parentQuote = stepOutNestedQuoteMarker(matched.marker)
      if (parentQuote) {
        const replacement = `${matched.indent}${parentQuote}`
        return {
          rangeStart: lineStart,
          rangeEnd: lineEnd,
          replacement,
          selectionStart: lineStart + replacement.length,
          selectionEnd: lineStart + replacement.length,
        }
      }
    }
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

const TASK_BOX_PREFIX_RE = /^[-*+][ \t]+\[([ xX])\][ \t]*/
const BULLET_OR_ORDERED_PREFIX_RE = /^(?:[-*+]|\d+\.)[ \t]+/

export const cycleTaskCheckboxInLine = (lineText: string): { replaced: boolean; lineText: string } => {
  const trimmed = lineText.trimStart()
  const indent = lineText.slice(0, lineText.length - trimmed.length)
  const taskMatch = TASK_BOX_PREFIX_RE.exec(trimmed)
  if (taskMatch) {
    const boxPos = indent.length + taskMatch[0].indexOf("[") + 1
    const nextMark = taskMatch[1] === " " ? "x" : " "
    return {
      replaced: true,
      lineText: `${lineText.slice(0, boxPos)}${nextMark}${lineText.slice(boxPos + 1)}`,
    }
  }

  const bulletMatch = BULLET_OR_ORDERED_PREFIX_RE.exec(trimmed)
  if (bulletMatch) {
    return {
      replaced: true,
      lineText: `${indent}- [ ] ${trimmed.slice(bulletMatch[0].length)}`,
    }
  }

  return {
    replaced: true,
    lineText: `${indent}- [ ] ${trimmed}`,
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
