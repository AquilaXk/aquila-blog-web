import {
  countCodePointRun,
  isEscapedMarkdownAt,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
  type MathSpanRange,
} from "../../libs/markdown/pandocMathScanner"

export type MathLiteralRange = MathSpanRange

export type MathReplacementSpec = {
  from: number
  to: number
  math: string
  displayMode: boolean
}

const MAX_MATH_BLOCKS_PER_DOC = 512

export const MATH_LITERAL_SYNTAX_NODE_NAMES = new Set([
  "FencedCode",
  "CodeBlock",
  "InlineCode",
  "HTMLBlock",
  "HTMLTag",
  "Comment",
  "CommentBlock",
  "ProcessingInstruction",
  "URL",
  "Autolink",
])

const BARE_URL_PATTERN = /\b(?:https?|ftp):\/\/[^\s<>()]+/gi

const appendInlineCodeExcludedRanges = (docText: string, combined: MathLiteralRange[]): void => {
  let cursor = 0
  while (cursor < docText.length) {
    if (docText.codePointAt(cursor) !== 96 || isEscapedMarkdownAt(docText, cursor)) {
      cursor += 1
      continue
    }
    const closeEnd = scanInlineCodeSpanEnd(docText, cursor)
    if (closeEnd > cursor) {
      combined.push({ from: cursor, to: closeEnd })
      cursor = closeEnd
    } else {
      cursor += countCodePointRun(docText, cursor, 96)
    }
  }
}

const buildExcludedMathRanges = (
  docText: string,
  literalRanges: readonly MathLiteralRange[]
): MathLiteralRange[] => {
  const combined: MathLiteralRange[] = [...literalRanges]
  if (docText.includes("://")) {
    BARE_URL_PATTERN.lastIndex = 0
    for (const match of docText.matchAll(BARE_URL_PATTERN)) {
      combined.push({ from: match.index, to: match.index + match[0].length })
    }
  }
  if (literalRanges.length === 0 && docText.includes("`")) {
    appendInlineCodeExcludedRanges(docText, combined)
  }
  return mergeSortedSpanRanges(combined)
}

const overlapsActiveLine = (
  from: number,
  to: number,
  activeLineFrom: number,
  activeLineTo: number
): boolean =>
  activeLineFrom >= 0 &&
  activeLineTo >= activeLineFrom &&
  from <= activeLineTo &&
  to >= activeLineFrom

const isSkippedDollarAt = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): boolean =>
  docText.codePointAt(index) !== 36 ||
  isEscapedMarkdownAt(docText, index) ||
  overlapsSortedRanges(excludedRanges, index, index + 1)

const tryMatchMathAt = (
  docText: string,
  index: number,
  excludedRanges: readonly MathLiteralRange[]
): { spec: MathReplacementSpec | null; nextIndex: number } => {
  const runLength = countCodePointRun(docText, index, 36)
  if (runLength > 2) {
    return { spec: null, nextIndex: index + runLength }
  }
  if (runLength === 2) {
    const display = scanPandocDisplayMathAt(docText, index, { excludedRanges })
    return {
      spec: display
        ? { from: display.from, to: display.to, math: display.math, displayMode: true }
        : null,
      nextIndex: display ? display.to : index + 2,
    }
  }
  const inline = scanPandocInlineMathAt(docText, index, { excludedRanges })
  return {
    spec: inline
      ? { from: inline.from, to: inline.to, math: inline.math, displayMode: false }
      : null,
    nextIndex: inline ? inline.to : index + 1,
  }
}

export const collectMathReplacementSpecs = (
  docText: string,
  activeLineFrom = -1,
  activeLineTo = -1,
  shouldRevealAll = false,
  literalRanges: readonly MathLiteralRange[] = []
): MathReplacementSpec[] => {
  if (shouldRevealAll || !docText.includes("$")) return []

  const excludedRanges = buildExcludedMathRanges(docText, literalRanges)
  const specs: MathReplacementSpec[] = []
  let index = 0

  while (index < docText.length && specs.length < MAX_MATH_BLOCKS_PER_DOC) {
    if (isSkippedDollarAt(docText, index, excludedRanges)) {
      index += 1
      continue
    }
    const { spec, nextIndex } = tryMatchMathAt(docText, index, excludedRanges)
    if (spec && !overlapsActiveLine(spec.from, spec.to, activeLineFrom, activeLineTo)) {
      specs.push(spec)
    }
    index = nextIndex
  }

  return specs
}

export const collectMarkdownMathSpans = collectMathReplacementSpecs
