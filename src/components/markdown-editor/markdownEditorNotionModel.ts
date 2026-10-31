import { EditorState, StateField, type Range } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import { hasIntervalOverlap } from "./markdownEditorLivePreview"
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
  /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const EXISTING_BLOCK_PREFIX_RE = /^(#{1,6}[ \t]+|>[ \t]?)/
const STRIP_BLOCK_PREFIX_RE =
  /^(?<indent>[ \t]*)(?<prefix>#{1,6}[ \t]+|[-*+] \[[ xX]\] |[-*+] |\d+\. |>[ \t]?)/
const QUOTE_PREFIX_RE = /^(>[ \t]?)/
const NOTION_TODO_INPUT_RE = /^(?<indent>[ \t]*)\[(?<check>[ xX]?)\]$/
const NOTION_TOGGLE_INPUT_RE = /^(?<indent>[ \t]*)>>>$/
const NOTION_DIVIDER_INPUT_RE = /^(?<indent>[ \t]*)(?:---|[*]{3})$/
const NOTION_CALLOUT_INPUT_RE = /^(?<indent>[ \t]*)!!!$/
const NOTION_BACKSPACE_PREFIX_RE =
  /^(?<indent>[ \t]*)(?<prefix>#{1,6}[ \t]+|[-*+] \[[ xX]\] |[-*+] |\d+\. |> )$/
const CHECKED_TASK_LINE_RE = /^[ \t]*[-*+][ \t]+\[[xX]\][ \t]+/
const NOTION_TOGGLE_TEMPLATE = ":::toggle 토글 제목\n\n:::"
const NOTION_CALLOUT_TEMPLATE = "> [!INFO]\n> "
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
  replacementStart?: number
}

type FenceState = {
  inFence: boolean
  openMarker: string
  openLength: number
}

const advanceFenceState = (state: FenceState, text: string): boolean => {
  const match = FENCE_DELIMITER_LINE_RE.exec(text)
  if (!match) return state.inFence
  const marker = match[2]?.[0] ?? ""
  const length = match[2]?.length ?? 0
  const info = match[3] ?? ""
  if (!state.inFence) {
    state.inFence = true
    state.openMarker = marker
    state.openLength = length
  } else if (marker === state.openMarker && length >= state.openLength && info.trim() === "") {
    state.inFence = false
    state.openMarker = ""
    state.openLength = 0
  }
  return true
}

export const forEachLogicalLine = (
  value: string,
  visitor: (start: number, end: number, text: string, intersectsFence: boolean) => boolean
): void => {
  const fenceState: FenceState = { inFence: false, openMarker: "", openLength: 0 }
  let offset = 0
  while (true) {
    const nextBreak = value.indexOf("\n", offset)
    const end = nextBreak === -1 ? value.length : nextBreak
    const text = value.slice(offset, end)
    const intersectsFence = advanceFenceState(fenceState, text)
    if (!visitor(offset, end, text, intersectsFence) || nextBreak === -1) break
    offset = end + 1
  }
}

export const buildLogicalLines = (value: string): LogicalLine[] => {
  const lines: LogicalLine[] = []
  forEachLogicalLine(value, (start, end, text, intersectsFence) => {
    lines.push({ start, end, text, intersectsFence })
    return true
  })
  return lines
}

export const resolveSelectedLines = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): LogicalLine[] | null => {
  if (
    !Number.isInteger(selectionStart) ||
    !Number.isInteger(selectionEnd) ||
    selectionStart < 0 ||
    selectionEnd < selectionStart ||
    selectionEnd > value.length
  ) {
    return null
  }
  const lastOffset = selectionEnd === selectionStart ? selectionEnd : selectionEnd - 1
  const selected: LogicalLine[] = []
  let blockedByFence = false

  forEachLogicalLine(value, (start, end, text, intersectsFence) => {
    if (start > lastOffset) return false
    if (end >= selectionStart) {
      if (intersectsFence) {
        blockedByFence = true
        return false
      }
      selected.push({ start, end, text, intersectsFence })
    }
    return start < lastOffset
  })

  return blockedByFence ? null : selected
}

const buildMutationFromTransformations = (
  transformations: LinePrefixTransformation[],
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  const rangeStart = transformations[0]!.line.start
  const rangeEnd = transformations[transformations.length - 1]!.line.end
  let runningReplacementStart = rangeStart
  for (const item of transformations) {
    item.replacementStart = runningReplacementStart
    runningReplacementStart += item.replacement.length + 1
  }
  const replacement = transformations.map((item) => item.replacement).join("\n")
  const totalDelta = replacement.length - (rangeEnd - rangeStart)

  const rebaseOffset = (offset: number): number => {
    if (offset < rangeStart) return offset
    if (offset > rangeEnd) return offset + totalDelta

    const transformation =
      transformations.find(({ line }) => offset <= line.end) ??
      transformations[transformations.length - 1]!
    const relative = offset - transformation.line.start
    const replacementStart = transformation.replacementStart ?? rangeStart

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

export const isBlockLinePrefixSnippet = (before: string, after: string): boolean =>
  after === "" && BLOCK_LINE_PREFIXES.has(before)

export const planToggleBlockLinePrefix = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string
): PlannedTextMutation | null => {
  if (!BLOCK_LINE_PREFIXES.has(prefix)) return null
  const selected = resolveSelectedLines(value, selectionStart, selectionEnd)
  if (!selected) return null

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

  return buildMutationFromTransformations(transformations, selectionStart, selectionEnd)
}

export const planStripBlockLinePrefix = (
  value: string,
  selectionStart: number,
  selectionEnd: number
): PlannedTextMutation | null => {
  const selected = resolveSelectedLines(value, selectionStart, selectionEnd)
  if (!selected) return null

  const transformations = selected.map((line): LinePrefixTransformation => {
    const match = STRIP_BLOCK_PREFIX_RE.exec(line.text)
    if (!match?.groups) {
      return {
        line,
        indentLength: 0,
        oldPrefixLength: 0,
        newPrefixLength: 0,
        replacement: line.text,
      }
    }
    const indent = match.groups.indent ?? ""
    const prefix = match.groups.prefix ?? ""
    const content = line.text.slice(indent.length + prefix.length)
    return {
      line,
      indentLength: indent.length,
      oldPrefixLength: prefix.length,
      newPrefixLength: 0,
      replacement: `${indent}${content}`,
    }
  })

  if (transformations.every((item) => item.oldPrefixLength === 0)) {
    return null
  }

  return buildMutationFromTransformations(transformations, selectionStart, selectionEnd)
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

  if (lineAfterCursor.trim().length === 0) {
    if (NOTION_TOGGLE_INPUT_RE.test(lineBeforeCursor)) {
      return {
        rangeStart: lineStart,
        rangeEnd: lineEnd,
        replacement: NOTION_TOGGLE_TEMPLATE,
        selectionStart: lineStart + 10,
        selectionEnd: lineStart + 15,
      }
    }

    if (NOTION_DIVIDER_INPUT_RE.test(lineBeforeCursor)) {
      return {
        rangeStart: lineStart,
        rangeEnd: lineEnd,
        replacement: "---\n",
        selectionStart: lineStart + 4,
        selectionEnd: lineStart + 4,
      }
    }

    if (NOTION_CALLOUT_INPUT_RE.test(lineBeforeCursor)) {
      return {
        rangeStart: lineStart,
        rangeEnd: lineEnd,
        replacement: NOTION_CALLOUT_TEMPLATE,
        selectionStart: lineStart + 12,
        selectionEnd: lineStart + 12,
      }
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

type NotionDocLineMeta = {
  doc: EditorState["doc"]
  checkedTaskLineStarts: readonly number[]
  fencedRanges: readonly { from: number; to: number }[]
}

let cachedNotionLineMeta: NotionDocLineMeta | null = null

export const getCachedNotionLineMeta = (doc: EditorState["doc"]): NotionDocLineMeta => {
  if (cachedNotionLineMeta && cachedNotionLineMeta.doc === doc) {
    return cachedNotionLineMeta
  }
  const docText = getDocString(doc)
  if (
    !docText.includes("```") &&
    !docText.includes("~~~") &&
    !/\[[xX]\]/.test(docText)
  ) {
    cachedNotionLineMeta = {
      doc,
      checkedTaskLineStarts: [],
      fencedRanges: [],
    }
    return cachedNotionLineMeta
  }

  const checkedTaskLineStarts: number[] = []
  const fencedRanges: { from: number; to: number }[] = []

  forEachLogicalLine(docText, (start, end, text, intersectsFence) => {
    if (intersectsFence) {
      const rangeEnd = end + 1
      const prev = fencedRanges[fencedRanges.length - 1]
      if (prev && prev.to >= start) {
        prev.to = Math.max(prev.to, rangeEnd)
      } else {
        fencedRanges.push({ from: start, to: rangeEnd })
      }
    } else if (CHECKED_TASK_LINE_RE.test(text)) {
      checkedTaskLineStarts.push(start)
    }
    return true
  })

  cachedNotionLineMeta = { doc, checkedTaskLineStarts, fencedRanges }
  return cachedNotionLineMeta
}

const resolveActiveEmptyLineFrom = (
  state: EditorState,
  fencedRanges: readonly { from: number; to: number }[]
): number => {
  if (!state.selection.main.empty) return -1
  const line = state.doc.lineAt(state.selection.main.head)
  if (line.length !== 0) return -1
  if (hasIntervalOverlap(fencedRanges, line.from, line.from + 1)) return -1
  return line.from
}

let cachedActiveEmptyLineState: {
  doc: EditorState["doc"]
  mode: string
  emptyLineFrom: number
  decorations: DecorationSet
} | null = null

const buildActiveEmptyLineDecorations = (state: EditorState): DecorationSet => {
  const mode = state.field(editorModeField, false) ?? "live"
  if (mode === "source" || state.doc.length === 0) {
    return Decoration.none
  }

  const meta = getCachedNotionLineMeta(state.doc)
  const activeEmptyLineFrom =
    mode === "reading" ? -1 : resolveActiveEmptyLineFrom(state, meta.fencedRanges)
  if (
    cachedActiveEmptyLineState &&
    cachedActiveEmptyLineState.doc === state.doc &&
    cachedActiveEmptyLineState.mode === mode &&
    cachedActiveEmptyLineState.emptyLineFrom === activeEmptyLineFrom
  ) {
    return cachedActiveEmptyLineState.decorations
  }

  const decorations: Range<Decoration>[] = []
  let insertedActiveEmpty = activeEmptyLineFrom < 0

  for (const taskLineStart of meta.checkedTaskLineStarts) {
    if (!insertedActiveEmpty && activeEmptyLineFrom < taskLineStart) {
      decorations.push(
        Decoration.line({
          class: "cm-live-empty-line",
          attributes: {
            "data-placeholder": ACTIVE_EMPTY_LINE_PLACEHOLDER,
          },
        }).range(activeEmptyLineFrom)
      )
      insertedActiveEmpty = true
    }
    decorations.push(
      Decoration.line({
        class: "cm-live-task-checked-line",
      }).range(taskLineStart)
    )
  }

  if (!insertedActiveEmpty) {
    decorations.push(
      Decoration.line({
        class: "cm-live-empty-line",
        attributes: {
          "data-placeholder": ACTIVE_EMPTY_LINE_PLACEHOLDER,
        },
      }).range(activeEmptyLineFrom)
    )
  }

  const result = decorations.length > 0 ? Decoration.set(decorations) : Decoration.none
  cachedActiveEmptyLineState = {
    doc: state.doc,
    mode,
    emptyLineFrom: activeEmptyLineFrom,
    decorations: result,
  }
  return result
}

export const activeEmptyLineField = StateField.define<DecorationSet>({
  create: buildActiveEmptyLineDecorations,
  update: (decorations, transaction) => {
    const hasModeEffect = transaction.effects.some((effect) => effect.is(setEditorMode))
    const mode = transaction.state.field(editorModeField, false) ?? "live"
    if (
      transaction.docChanged ||
      hasModeEffect ||
      (transaction.selection && mode === "live")
    ) {
      return buildActiveEmptyLineDecorations(transaction.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})
