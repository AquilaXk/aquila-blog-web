import {
  countCodePointRun,
  isEscapedMarkdownAt,
  scanInlineCodeSpanEnd,
} from "./pandocMathScanner"

export type MarkdownHighlightSpan = {
  from: number
  to: number
  contentFrom: number
  contentTo: number
}

const SINGLE_CHAR_WHITESPACE_PATTERN = /^\s$/u

const isWhitespaceAt = (text: string, index: number): boolean => {
  const ch = text[index]
  return ch !== undefined && SINGLE_CHAR_WHITESPACE_PATTERN.test(ch)
}

const hasLineBreakBetween = (text: string, from: number, to: number): boolean => {
  for (let idx = from; idx < to; idx += 1) {
    const code = text.codePointAt(idx) ?? 0
    if (code === 10 || code === 13) return true
  }
  return false
}

const skipInlineCodeRunAt = (text: string, cursor: number): number => {
  const end = scanInlineCodeSpanEnd(text, cursor)
  return end > cursor ? end : cursor + countCodePointRun(text, cursor, 96)
}

const isOpeningHighlightAt = (
  text: string,
  index: number,
  honorEscapes: boolean
): boolean => {
  if (index + 2 >= text.length) return false
  if (honorEscapes && isEscapedMarkdownAt(text, index)) return false
  if (text.codePointAt(index) !== 61 || text.codePointAt(index + 1) !== 61) return false
  if (
    index > 0 &&
    text.codePointAt(index - 1) === 61 &&
    (!honorEscapes || !isEscapedMarkdownAt(text, index - 1))
  ) {
    return false
  }
  if (text.codePointAt(index + 2) === 61) return false
  return !isWhitespaceAt(text, index + 2)
}

const isClosingHighlightAt = (
  text: string,
  index: number,
  honorEscapes: boolean
): boolean => {
  if (index + 1 >= text.length) return false
  if (honorEscapes && isEscapedMarkdownAt(text, index)) return false
  if (text.codePointAt(index) !== 61 || text.codePointAt(index + 1) !== 61) return false
  const hasUnescapedPrevEqual =
    text.codePointAt(index - 1) === 61 && (!honorEscapes || !isEscapedMarkdownAt(text, index - 1))
  if (hasUnescapedPrevEqual || isWhitespaceAt(text, index - 1)) return false
  return text.codePointAt(index + 2) !== 61
}

const scanClosingHighlightOnLine = (
  text: string,
  searchFrom: number,
  honorEscapes: boolean
): { closeIndex: number; abortedAtIndex: number } => {
  let cursor = searchFrom
  while (cursor < text.length) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) {
      return { closeIndex: -1, abortedAtIndex: cursor + 1 }
    }
    if (honorEscapes && code === 92) {
      const nextCode = text.codePointAt(cursor + 1) ?? 0
      if (nextCode === 10 || nextCode === 13) {
        return { closeIndex: -1, abortedAtIndex: cursor + 2 }
      }
      cursor += 2
      continue
    }
    if (honorEscapes && code === 96) {
      const nextCursor = skipInlineCodeRunAt(text, cursor)
      if (hasLineBreakBetween(text, cursor, nextCursor)) {
        return { closeIndex: -1, abortedAtIndex: nextCursor }
      }
      cursor = nextCursor
      continue
    }
    if (code === 61 && isClosingHighlightAt(text, cursor, honorEscapes)) {
      return { closeIndex: cursor, abortedAtIndex: cursor }
    }
    cursor += 1
  }
  return { closeIndex: -1, abortedAtIndex: text.length }
}

export const findMarkdownHighlightSpans = (
  text: string,
  options?: { honorMarkdownEscapes?: boolean }
): MarkdownHighlightSpan[] => {
  if (!text.includes("==")) return []
  const honorEscapes = options?.honorMarkdownEscapes !== false
  const spans: MarkdownHighlightSpan[] = []
  let index = 0

  while (index + 3 < text.length) {
    const code = text.codePointAt(index) ?? 0
    if (honorEscapes && code === 92) {
      index += 2
      continue
    }
    if (honorEscapes && code === 96) {
      index = skipInlineCodeRunAt(text, index)
      continue
    }
    if (!isOpeningHighlightAt(text, index, honorEscapes)) {
      index += 1
      continue
    }

    const { closeIndex, abortedAtIndex } = scanClosingHighlightOnLine(text, index + 2, honorEscapes)
    if (closeIndex < 0) {
      index = abortedAtIndex
      continue
    }

    spans.push({
      from: index,
      to: closeIndex + 2,
      contentFrom: index + 2,
      contentTo: closeIndex,
    })
    index = closeIndex + 2
  }

  return spans
}

export const stripMarkdownHighlightDelimiters = (text: string): string => {
  const spans = findMarkdownHighlightSpans(text)
  if (spans.length === 0) return text

  let output = ""
  let cursor = 0
  for (const span of spans) {
    if (span.from > cursor) {
      output += text.slice(cursor, span.from)
    }
    output += text.slice(span.contentFrom, span.contentTo)
    cursor = span.to
  }
  if (cursor < text.length) {
    output += text.slice(cursor)
  }
  return output
}
