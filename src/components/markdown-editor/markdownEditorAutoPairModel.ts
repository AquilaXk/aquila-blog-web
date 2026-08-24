import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorAutoPairAction =
  | { kind: "mutation"; mutation: PlannedTextMutation }
  | { kind: "select"; selectionStart: number; selectionEnd: number }

const OPEN_TO_CLOSE: Readonly<Record<string, string>> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "\"": "\"",
  "'": "'",
  "`": "`",
}

const CLOSE_TO_OPEN: Readonly<Record<string, string>> = {
  ")": "(",
  "]": "[",
  "}": "{",
}

const hasValidSelection = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  Number.isInteger(selectionStart) &&
  Number.isInteger(selectionEnd) &&
  selectionStart >= 0 &&
  selectionEnd >= selectionStart &&
  selectionEnd <= value.length

const isSingleLineSelection = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  !value.slice(selectionStart, selectionEnd).includes("\n")

const isEscapedAt = (value: string, offset: number): boolean => {
  let slashCount = 0
  for (let index = offset - 1; index >= 0 && value[index] === "\\"; index -= 1) slashCount += 1
  return slashCount % 2 === 1
}

const isLineLeadingWhitespace = (value: string, offset: number): boolean => {
  const lineStart = value.lastIndexOf("\n", offset - 1) + 1
  return /^[ \t]*$/.test(value.slice(lineStart, offset))
}

const isWordCharacter = (character: string | undefined): boolean =>
  Boolean(character && /[\p{L}\p{N}_]/u.test(character))

const isApostropheInsideWord = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  selectionStart === selectionEnd && isWordCharacter(value[selectionStart - 1])

const isInFencedCode = (value: string, selectionStart: number, selectionEnd: number): boolean =>
  isOffsetInsideFencedCodeBlock(value, selectionStart) ||
  (selectionEnd > selectionStart && isOffsetInsideFencedCodeBlock(value, selectionEnd - 1))

const isBacktickFenceContext = (value: string, selectionStart: number, key: string): boolean => {
  if (key !== "`") return false
  if (isLineLeadingWhitespace(value, selectionStart)) return true
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1
  return /^[ \t]*`/.test(value.slice(lineStart, selectionStart))
}

const canAutoPair = (value: string, selectionStart: number, selectionEnd: number, key: string): boolean =>
  hasValidSelection(value, selectionStart, selectionEnd) &&
  isSingleLineSelection(value, selectionStart, selectionEnd) &&
  !isInFencedCode(value, selectionStart, selectionEnd) &&
  !isEscapedAt(value, selectionStart) &&
  !isBacktickFenceContext(value, selectionStart, key)

export const planMarkdownEditorAutoPairInsert = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  key: string
): MarkdownEditorAutoPairAction | null => {
  if (!canAutoPair(value, selectionStart, selectionEnd, key)) return null

  if (selectionStart === selectionEnd && CLOSE_TO_OPEN[key] && value[selectionStart] === key) {
    return { kind: "select", selectionStart: selectionStart + 1, selectionEnd: selectionStart + 1 }
  }

  const closer = OPEN_TO_CLOSE[key]
  if (!closer) return null

  if (selectionStart === selectionEnd && key === closer && value[selectionStart] === closer) {
    return { kind: "select", selectionStart: selectionStart + 1, selectionEnd: selectionStart + 1 }
  }
  if (key === "'" && isApostropheInsideWord(value, selectionStart, selectionEnd)) return null

  const selected = value.slice(selectionStart, selectionEnd)
  return {
    kind: "mutation",
    mutation: {
      rangeStart: selectionStart,
      rangeEnd: selectionEnd,
      replacement: `${key}${selected}${closer}`,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1 + selected.length,
    },
  }
}

export const planMarkdownEditorAutoPairBackspace = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): MarkdownEditorAutoPairAction | null => {
  if (
    !hasValidSelection(value, selectionStart, selectionEnd) ||
    selectionStart !== selectionEnd ||
    selectionStart === 0 ||
    isInFencedCode(value, selectionStart, selectionEnd)
  ) {
    return null
  }

  const openerIndex = selectionStart - 1
  const opener = value[openerIndex]
  const closer = value[selectionStart]
  if (!opener || !closer || OPEN_TO_CLOSE[opener] !== closer || isEscapedAt(value, openerIndex)) return null
  if (isBacktickFenceContext(value, selectionStart, opener)) return null

  return {
    kind: "mutation",
    mutation: {
      rangeStart: openerIndex,
      rangeEnd: selectionStart + 1,
      replacement: "",
      selectionStart: openerIndex,
      selectionEnd: openerIndex,
    },
  }
}
