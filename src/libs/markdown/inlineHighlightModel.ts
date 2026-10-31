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

const isOpeningHighlightAt = (text: string, index: number): boolean => {
  if (index + 2 >= text.length) return false
  if (text.codePointAt(index) !== 61 || text.codePointAt(index + 1) !== 61) return false
  if (index > 0 && text.codePointAt(index - 1) === 61) return false
  if (text.codePointAt(index + 2) === 61) return false
  return !isWhitespaceAt(text, index + 2)
}

const isClosingHighlightAt = (text: string, index: number): boolean => {
  if (index + 1 >= text.length) return false
  if (text.codePointAt(index) !== 61 || text.codePointAt(index + 1) !== 61) return false
  if (text.codePointAt(index - 1) === 61 || isWhitespaceAt(text, index - 1)) return false
  return text.codePointAt(index + 2) !== 61
}

const scanClosingHighlightOnLine = (
  text: string,
  searchFrom: number
): { closeIndex: number; abortedAtIndex: number } => {
  for (let cursor = searchFrom; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) {
      return { closeIndex: -1, abortedAtIndex: cursor + 1 }
    }
    if (code === 61 && isClosingHighlightAt(text, cursor)) {
      return { closeIndex: cursor, abortedAtIndex: cursor }
    }
  }
  return { closeIndex: -1, abortedAtIndex: text.length }
}

export const findMarkdownHighlightSpans = (text: string): MarkdownHighlightSpan[] => {
  if (!text.includes("==")) return []
  const spans: MarkdownHighlightSpan[] = []
  let index = 0

  while (index + 3 < text.length) {
    if (!isOpeningHighlightAt(text, index)) {
      index += 1
      continue
    }

    const { closeIndex, abortedAtIndex } = scanClosingHighlightOnLine(text, index + 3)
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
