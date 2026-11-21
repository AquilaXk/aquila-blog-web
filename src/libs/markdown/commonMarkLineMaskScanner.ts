import {
  countCodePointRun,
  hasCommonMarkCodeIndent,
  mergeSortedSpanRanges,
  overlapsSortedRanges,
  parseOpeningCodeFence,
  type MathSpanRange,
} from "./pandocMathScanner"
import {
  isAsideCloseLineExcluded,
  isDedicatedFormulaFenceLine,
  isLineStartInCommentRanges,
  isTopLevelFormulaStopLine,
} from "./renderingDirectiveModel"

export const LINE_BIT_FENCED_CODE = 1 << 0
export const LINE_BIT_INDENTED_CODE = 1 << 1
export const LINE_BIT_CONTAINER = 1 << 2
export const LINE_BIT_MATH = 1 << 3
export const LINE_BIT_COMMENT = 1 << 4

const ATX_HEADING_PATTERN = /^[ ]{0,3}#{1,6}(?:[ \t\r]|$)/
const THEMATIC_BREAK_PATTERN = /^[ ]{0,3}(?:(\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/
const LIST_MARKER_PREFIX_PATTERN = /^([ ]{0,3})([-+*]|\d{1,9}[.)])(?:[ \t]+|$)/

const stripLeadingQuotesOnly = (line: string): { quoteDepth: number; afterQuotes: string } => {
  let cursor = 0
  let quoteDepth = 0
  while (cursor < line.length) {
    const spaces = countCodePointRun(line, cursor, 32)
    if (spaces > 3 || line.charCodeAt(cursor + spaces) !== 62) break
    quoteDepth += 1
    cursor += spaces + 1
    if (line.charCodeAt(cursor) === 32) cursor += 1
  }
  return { quoteDepth, afterQuotes: line.slice(cursor) }
}

const isClosingCodeFenceFor = (line: string, markerCode: number, minLength: number, minQuoteDepth: number): boolean => {
  const { quoteDepth, afterQuotes } = stripLeadingQuotesOnly(line)
  if (quoteDepth < minQuoteDepth) return false
  const indent = Math.min(3, countCodePointRun(afterQuotes, 0, 32))
  const stripped = afterQuotes.slice(indent)
  if (stripped.charCodeAt(0) !== markerCode) return false
  const runLen = countCodePointRun(stripped, 0, markerCode)
  if (runLen < minLength) return false
  return stripped.slice(runLen).trim() === ""
}

export const findDedicatedFormulaCloseIndex = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  codeBlockRanges: readonly MathSpanRange[]
): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (isTopLevelFormulaStopLine(line)) return -1
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(codeBlockRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return index
    }
  }
  return -1
}

export const findBoundedFormulaCloseInContainer = (
  lines: readonly string[],
  startIndex: number,
  lineStarts: readonly number[],
  codeRanges: readonly MathSpanRange[],
  isCloseLine: (candidate: string, lineIndex: number) => boolean
): number => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    if (isTopLevelFormulaStopLine(line) || isCloseLine(line, index)) return -1
    const lineStart = lineStarts[index]!
    if (
      isDedicatedFormulaFenceLine(line) &&
      !overlapsSortedRanges(codeRanges, lineStart, lineStart + Math.max(1, line.length))
    ) {
      return index
    }
  }
  return -1
}

export const isContainerLineExcluded = (
  line: string,
  lineStart: number,
  ranges: { codeBlockRanges: readonly MathSpanRange[]; commentRanges: readonly MathSpanRange[] },
  isAside: boolean,
  checkingCloseLine: boolean
): boolean => {
  if (isAside && checkingCloseLine) {
    return isAsideCloseLineExcluded(ranges.codeBlockRanges, ranges.commentRanges, line, lineStart)
  }
  const lineEnd = lineStart + Math.max(1, line.length)
  return (
    overlapsSortedRanges(ranges.codeBlockRanges, lineStart, lineEnd) ||
    isLineStartInCommentRanges(ranges.commentRanges, line, lineStart)
  )
}

const measureLineIndentColumns = (line: string): { columns: number; contentOffset: number } => {
  let columns = 0
  let i = 0
  while (i < line.length) {
    const ch = line.charCodeAt(i)
    if (ch === 32) {
      columns += 1
      i += 1
    } else if (ch === 9) {
      columns += 4 - (columns % 4)
      i += 1
    } else {
      break
    }
  }
  return { columns, contentOffset: i }
}

const isBlockBreakerLine = (trimmed: string): boolean =>
  trimmed.length === 0 ||
  ATX_HEADING_PATTERN.test(trimmed) ||
  THEMATIC_BREAK_PATTERN.test(trimmed)

export const markMaskRangeBits = (
  lineMasks: Uint8Array,
  fromLine: number,
  toLine: number,
  bit: number
): void => {
  const start = Math.max(0, fromLine)
  const end = Math.min(lineMasks.length - 1, toLine)
  for (let i = start; i <= end; i += 1) {
    lineMasks[i]! |= bit
  }
}

export const scanMaskedLineBitmaskRanges = ({
  lines,
  lineStarts,
  lineMasks,
  initialListRanges,
  extraCodeRanges,
  asideRanges,
  containerCloseRanges,
}: {
  lines: readonly string[]
  lineStarts: readonly number[]
  lineMasks: Uint8Array
  initialListRanges: readonly MathSpanRange[]
  extraCodeRanges: readonly MathSpanRange[]
  asideRanges: readonly MathSpanRange[]
  containerCloseRanges: readonly MathSpanRange[]
}): {
  codeBlockRanges: MathSpanRange[]
  commentRanges: MathSpanRange[]
  listRanges: MathSpanRange[]
  asideRanges: MathSpanRange[]
  containerCloseRanges: MathSpanRange[]
} => {
  const codeBlockRanges: MathSpanRange[] = [...extraCodeRanges]
  const commentRanges: MathSpanRange[] = []
  const clearFlags = ~(LINE_BIT_FENCED_CODE | LINE_BIT_INDENTED_CODE | LINE_BIT_COMMENT)
  for (let i = 0; i < lineMasks.length; i += 1) lineMasks[i]! &= clearFlags

  let openFence: { markerCode: number; length: number; quoteDepth: number; startLine: number } | null = null
  let openCommentStartOffset = -1
  let openIndentedStart = -1
  let openIndentedLastNonBlank = -1
  let prevCanOpenIndented = true
  let listItemContentIndent = -1

  const flushIndented = () => {
    if (openIndentedStart >= 0 && openIndentedLastNonBlank >= openIndentedStart) {
      const from = lineStarts[openIndentedStart]!
      const lastLine = lines[openIndentedLastNonBlank]!
      codeBlockRanges.push({ from, to: lineStarts[openIndentedLastNonBlank]! + lastLine.length })
    }
    openIndentedStart = -1
    openIndentedLastNonBlank = -1
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!
    const lineStart = lineStarts[i]!
    const isContainerMasked = (lineMasks[i]! & (LINE_BIT_CONTAINER | LINE_BIT_MATH)) !== 0
    const { quoteDepth, afterQuotes } = stripLeadingQuotesOnly(line)

    if (openFence !== null) {
      if (quoteDepth < openFence.quoteDepth && line.trim() !== "") {
        const prevIdx = Math.max(openFence.startLine, i - 1)
        codeBlockRanges.push({
          from: lineStarts[openFence.startLine]!,
          to: lineStarts[prevIdx]! + lines[prevIdx]!.length,
        })
        openFence = null
        prevCanOpenIndented = true
      } else {
        lineMasks[i]! |= LINE_BIT_FENCED_CODE
        if (isClosingCodeFenceFor(line, openFence.markerCode, openFence.length, openFence.quoteDepth)) {
          codeBlockRanges.push({
            from: lineStarts[openFence.startLine]!,
            to: lineStart + line.length,
          })
          openFence = null
          prevCanOpenIndented = true
        }
        continue
      }
    }

    if (openCommentStartOffset >= 0) {
      lineMasks[i]! |= LINE_BIT_COMMENT
      if (line.includes("-->")) {
        commentRanges.push({ from: openCommentStartOffset, to: lineStart + line.length })
        openCommentStartOffset = -1
        prevCanOpenIndented = true
      }
      continue
    }

    const trimmed = afterQuotes.trim()
    if (isContainerMasked) {
      flushIndented()
      prevCanOpenIndented = true
      listItemContentIndent = -1
      continue
    }

    const { columns, contentOffset } = measureLineIndentColumns(afterQuotes)
    const afterIndent = afterQuotes.slice(contentOffset)

    if (openIndentedStart >= 0) {
      if (trimmed.length === 0) {
        lineMasks[i]! |= LINE_BIT_INDENTED_CODE
        continue
      }
      if (hasCommonMarkCodeIndent(afterQuotes) && (listItemContentIndent < 0 || columns >= listItemContentIndent + 4)) {
        lineMasks[i]! |= LINE_BIT_INDENTED_CODE
        openIndentedLastNonBlank = i
        continue
      }
      flushIndented()
    }

    const fenceOpen = parseOpeningCodeFence(line)
    if (fenceOpen) {
      listItemContentIndent = -1
      openFence = { ...fenceOpen, quoteDepth, startLine: i }
      lineMasks[i]! |= LINE_BIT_FENCED_CODE
      continue
    }

    if (quoteDepth === 0 && columns <= 3 && afterIndent.startsWith("<!--")) {
      listItemContentIndent = -1
      lineMasks[i]! |= LINE_BIT_COMMENT
      if (afterIndent.includes("-->")) {
        commentRanges.push({ from: lineStart + contentOffset, to: lineStart + line.length })
        prevCanOpenIndented = true
      } else {
        openCommentStartOffset = lineStart + contentOffset
      }
      continue
    }

    if (trimmed.length === 0) {
      prevCanOpenIndented = true
      continue
    }

    const listMatch = quoteDepth === 0 ? LIST_MARKER_PREFIX_PATTERN.exec(line) : null
    if (listMatch) {
      listItemContentIndent = listMatch[0]!.length
      prevCanOpenIndented = false
      continue
    }

    const lineEnd = lineStart + Math.max(1, line.length)
    const insideInitialList = overlapsSortedRanges(initialListRanges, lineStart, lineEnd)
    const qualifiesListIndent = listItemContentIndent >= 0 && columns < listItemContentIndent + 4

    if (hasCommonMarkCodeIndent(afterQuotes) && prevCanOpenIndented && !insideInitialList && !qualifiesListIndent) {
      openIndentedStart = i
      openIndentedLastNonBlank = i
      lineMasks[i]! |= LINE_BIT_INDENTED_CODE
      prevCanOpenIndented = false
      continue
    }

    if (insideInitialList || qualifiesListIndent) {
      prevCanOpenIndented = false
      continue
    }

    listItemContentIndent = -1
    if (quoteDepth === 0 && !afterIndent.startsWith("```") && isBlockBreakerLine(trimmed)) {
      prevCanOpenIndented = true
    } else if (quoteDepth > 0 && trimmed.length === 0) {
      prevCanOpenIndented = true
    } else {
      prevCanOpenIndented = false
    }
  }

  if (openFence !== null) {
    const lastIdx = Math.max(openFence.startLine, lines.length - 1)
    codeBlockRanges.push({
      from: lineStarts[openFence.startLine]!,
      to: lineStarts[lastIdx]! + lines[lastIdx]!.length,
    })
  }
  if (openCommentStartOffset >= 0 && lines.length > 0) {
    const lastIdx = lines.length - 1
    commentRanges.push({ from: openCommentStartOffset, to: lineStarts[lastIdx]! + lines[lastIdx]!.length })
  }
  flushIndented()

  return {
    codeBlockRanges: mergeSortedSpanRanges(codeBlockRanges),
    commentRanges: mergeSortedSpanRanges(commentRanges),
    listRanges: [...initialListRanges],
    asideRanges: [...asideRanges],
    containerCloseRanges: mergeSortedSpanRanges(containerCloseRanges),
  }
}
