import { EditorState, StateField } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import {
  editorModeField,
  getDocString,
  setEditorMode,
} from "./markdownEditorLiveSurfaceDecorations"
import {
  planToggleWrapSelection,
  planWrapSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"

const BLOCK_LINE_PREFIXES = new Set(["# ", "## ", "### ", "#### ", "> "])
const FENCE_DELIMITER_LINE_RE =
  /^(?:(?: {0,3}> ?)+)?(?:[ \t]*(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const EXISTING_BLOCK_PREFIX_RE = /^(#{1,6}[ \t]+|>[ \t]?)/
const QUOTE_PREFIX_RE = /^(>[ \t]?)/
const NOTION_TODO_INPUT_RE = /^(?<indent>[ \t]*)\[(?<check>[ xX]?)\]$/
const NOTION_TOGGLE_INPUT_RE = /^(?<indent>[ \t]*)>>>$/
const NOTION_BACKSPACE_PREFIX_RE =
  /^(?<indent>[ \t]*)(?<prefix>#{1,6}[ \t]+|[-*+] \[[ xX]\] |[-*+] |\d+\. |> )$/
const NOTION_TOGGLE_TEMPLATE =
  "<details>\n<summary>토글 제목</summary>\n\n내용을 입력하세요.\n</details>"
const ACTIVE_EMPTY_LINE_PLACEHOLDER =
  "'/'를 눌러 블록을 삽입하거나 내용을 입력하세요..."

type LogicalLine = {
  start: number
  end: number
  text: string
  intersectsFence: boolean
}

type LinePrefixTransformation = {
  line: LogicalLine
  indentLength: number
  oldPrefixLength: number
  newPrefixLength: number
  replacement: string
}

const buildLogicalLines = (value: string): LogicalLine[] => {
  const rawLines = value.split("\n")
  let offset = 0
  let inFence = false
  let openMarker = ""
  let openLength = 0

  return rawLines.map((text, index) => {
    const match = FENCE_DELIMITER_LINE_RE.exec(text)
    let intersectsFence = inFence
    if (match) {
      const marker = match[2]?.[0] ?? ""
      const length = match[2]?.length ?? 0
      const info = match[3] ?? ""
      intersectsFence = true
      if (!inFence) {
        inFence = true
        openMarker = marker
        openLength = length
      } else if (marker === openMarker && length >= openLength && info.trim() === "") {
        inFence = false
        openMarker = ""
        openLength = 0
      }
    }
    const start = offset
    const end = offset + text.length
    offset = end + (index < rawLines.length - 1 ? 1 : 0)
    return { start, end, text, intersectsFence }
  })
}

const findLineIndexAt = (lines: LogicalLine[], offset: number): number => {
  for (let index = 0; index < lines.length; index += 1) {
    if (offset <= lines[index]!.end) return index
  }
  return lines.length - 1
}

export const isBlockLinePrefixSnippet = (before: string, after: string): boolean =>
  after === "" && BLOCK_LINE_PREFIXES.has(before)

export const planToggleBlockLinePrefix = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string
): PlannedTextMutation | null => {
  if (
    !BLOCK_LINE_PREFIXES.has(prefix) ||
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    return null
  }

  const lines = buildLogicalLines(value)
  const firstIndex = findLineIndexAt(lines, selectionStart)
  const lastIndex = findLineIndexAt(
    lines,
    selectionEnd === selectionStart ? selectionEnd : selectionEnd - 1
  )
  const selected = lines.slice(firstIndex, lastIndex + 1)
  if (selected.some((line) => line.intersectsFence)) return null

  const isQuotePrefix = prefix === "> "
  const shouldRemovePrefix = selected.every((line) => {
    const indentLength = /^[ \t]*/.exec(line.text)?.[0].length ?? 0
    const rest = line.text.slice(indentLength)
    return isQuotePrefix ? QUOTE_PREFIX_RE.test(rest) : rest.startsWith(prefix)
  })

  const transformations = selected.map((line): LinePrefixTransformation => {
    const indent = /^[ \t]*/.exec(line.text)?.[0] ?? ""
    const rest = line.text.slice(indent.length)

    if (shouldRemovePrefix) {
      const oldPrefixLength = isQuotePrefix
        ? (QUOTE_PREFIX_RE.exec(rest)?.[1]?.length ?? 0)
        : prefix.length
      const content = rest.slice(oldPrefixLength)
      return {
        line,
        indentLength: indent.length,
        oldPrefixLength,
        newPrefixLength: 0,
        replacement: `${indent}${content}`,
      }
    }

    const existingPrefix = EXISTING_BLOCK_PREFIX_RE.exec(rest)?.[1] ?? ""
    const oldPrefixLength = existingPrefix.length
    const content = rest.slice(oldPrefixLength)
    return {
      line,
      indentLength: indent.length,
      oldPrefixLength,
      newPrefixLength: prefix.length,
      replacement: `${indent}${prefix}${content}`,
    }
  })

  const rangeStart = selected[0]!.start
  const rangeEnd = selected[selected.length - 1]!.end
  const replacement = transformations.map((item) => item.replacement).join("\n")
  const totalDelta = replacement.length - (rangeEnd - rangeStart)

  const rebaseOffset = (offset: number): number => {
    if (offset < rangeStart) return offset
    if (offset > rangeEnd) return offset + totalDelta

    const transformation =
      transformations.find(({ line }) => offset <= line.end) ??
      transformations[transformations.length - 1]!
    const relative = offset - transformation.line.start
    const replacementStart =
      rangeStart +
      transformations
        .slice(0, transformations.indexOf(transformation))
        .reduce((acc, item) => acc + item.replacement.length + 1, 0)

    if (relative < transformation.indentLength) {
      return replacementStart + relative
    }
    if (relative <= transformation.indentLength + transformation.oldPrefixLength) {
      return replacementStart + transformation.indentLength + transformation.newPrefixLength
    }
    return (
      replacementStart +
      relative +
      transformation.newPrefixLength -
      transformation.oldPrefixLength
    )
  }

  return {
    rangeStart,
    rangeEnd,
    replacement,
    selectionStart: rebaseOffset(selectionStart),
    selectionEnd: rebaseOffset(selectionEnd),
  }
}

export const planMarkdownSnippetMutation = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after = "",
  options?: { toggle?: boolean }
): PlannedTextMutation | null => {
  if (isBlockLinePrefixSnippet(before, after)) {
    return planToggleBlockLinePrefix(value, selectionStart, selectionEnd, before)
  }
  return options?.toggle
    ? planToggleWrapSelection(value, selectionStart, selectionEnd, before, after)
    : planWrapSelection(value, selectionStart, selectionEnd, before, after)
}

export const planNotionSpaceInputRule = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation | null => {
  if (selectionStart !== selectionEnd) return null
  if (selectionStart < 0 || selectionStart > value.length) return null
  if (isOffsetInsideFencedCodeBlock(value, selectionStart)) return null

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1
  const nextBreak = value.indexOf("\n", selectionStart)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lineBeforeCursor = value.slice(lineStart, selectionStart)
  const lineAfterCursor = value.slice(selectionStart, lineEnd)

  const todoMatch = NOTION_TODO_INPUT_RE.exec(lineBeforeCursor)
  if (todoMatch?.groups) {
    const indent = todoMatch.groups.indent ?? ""
    const check = (todoMatch.groups.check ?? "").toLowerCase() === "x" ? "x" : " "
    const replacement = `${indent}- [${check}] `
    const cursor = lineStart + replacement.length
    return {
      rangeStart: lineStart,
      rangeEnd: selectionStart,
      replacement,
      selectionStart: cursor,
      selectionEnd: cursor,
    }
  }

  const toggleMatch = NOTION_TOGGLE_INPUT_RE.exec(lineBeforeCursor)
  if (toggleMatch && lineAfterCursor.trim().length === 0) {
    return {
      rangeStart: lineStart,
      rangeEnd: lineEnd,
      replacement: NOTION_TOGGLE_TEMPLATE,
      selectionStart: lineStart + 19,
      selectionEnd: lineStart + 24,
    }
  }

  return null
}

export const planNotionBlockPrefixBackspace = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation | null => {
  if (selectionStart !== selectionEnd || selectionStart <= 0) return null
  if (selectionStart > value.length) return null
  if (isOffsetInsideFencedCodeBlock(value, selectionStart)) return null

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1
  const lineBeforeCursor = value.slice(lineStart, selectionStart)
  const match = NOTION_BACKSPACE_PREFIX_RE.exec(lineBeforeCursor)
  if (!match?.groups) return null

  const indent = match.groups.indent ?? ""
  const prefixStart = lineStart + indent.length
  return {
    rangeStart: prefixStart,
    rangeEnd: selectionStart,
    replacement: "",
    selectionStart: prefixStart,
    selectionEnd: prefixStart,
  }
}

const buildActiveEmptyLineDecorations = (state: EditorState): DecorationSet => {
  const mode = state.field(editorModeField, false) ?? "live"
  if (mode !== "live" || state.doc.length === 0 || !state.selection.main.empty) {
    return Decoration.none
  }
  const line = state.doc.lineAt(state.selection.main.head)
  if (line.length > 0) return Decoration.none
  if (isOffsetInsideFencedCodeBlock(getDocString(state.doc), line.from)) {
    return Decoration.none
  }
  return Decoration.set([
    Decoration.line({
      class: "cm-live-empty-line",
      attributes: {
        "data-placeholder": ACTIVE_EMPTY_LINE_PLACEHOLDER,
      },
    }).range(line.from),
  ])
}

export const activeEmptyLineField = StateField.define<DecorationSet>({
  create: buildActiveEmptyLineDecorations,
  update: (decorations, transaction) => {
    if (
      transaction.docChanged ||
      transaction.selection ||
      transaction.effects.some((effect) => effect.is(setEditorMode))
    ) {
      return buildActiveEmptyLineDecorations(transaction.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})
