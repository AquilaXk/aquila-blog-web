import {
  isEscapedMarkdownAt,
  skipInlineLiteralConstructAt,
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

const isLineBreakCode = (code: number): boolean => code === 10 || code === 13

const hasLineBreakBetween = (text: string, from: number, to: number): boolean => {
  for (let idx = from; idx < to; idx += 1) {
    if (isLineBreakCode(text.codePointAt(idx) ?? 0)) return true
  }
  return false
}

const skipEscapedHighlightConstructAt = (
  text: string,
  cursor: number,
  honorEscapes: boolean,
  singleLineDisplayMath: boolean
): { nextCursor: number; abortLine: boolean } => {
  const nextCursor = skipInlineLiteralConstructAt(text, cursor, {
    honorEscapes,
    singleLineDisplayMath,
  })
  if (nextCursor <= cursor) return { nextCursor: cursor, abortLine: false }
  const code = text.codePointAt(cursor) ?? 0
  const abortLine =
    (code === 92 && isLineBreakCode(text.codePointAt(cursor + 1) ?? 0)) ||
    (code === 96 && hasLineBreakBetween(text, cursor, nextCursor))
  return { nextCursor, abortLine }
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
    if (isLineBreakCode(text.codePointAt(cursor) ?? 0)) {
      return { closeIndex: -1, abortedAtIndex: cursor + 1 }
    }
    const skipped = skipEscapedHighlightConstructAt(text, cursor, honorEscapes, true)
    if (skipped.abortLine) return { closeIndex: -1, abortedAtIndex: skipped.nextCursor }
    if (skipped.nextCursor > cursor) {
      cursor = skipped.nextCursor
      continue
    }
    if (isClosingHighlightAt(text, cursor, honorEscapes)) {
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
    const skipped = skipEscapedHighlightConstructAt(text, index, honorEscapes, false)
    if (skipped.nextCursor > index) {
      index = skipped.nextCursor
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
