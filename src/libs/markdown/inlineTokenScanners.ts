import {
  countCodePointRun,
  isEscapedMarkdownAt,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
} from "./pandocMathScanner"

export type TextRangeSpan = {
  from: number
  to: number
}

export type InlineColorMatchSpan = {
  from: number
  to: number
  contentFrom: number
  contentTo: number
  colorToken: string
  content: string
}

export type WikilinkMatchSpan = {
  from: number
  to: number
  rawTarget: string
  rawAlias?: string
}

const SINGLE_CHAR_WHITESPACE_PATTERN = /^\s$/u

const isAsciiSpaceCode = (code: number): boolean =>
  code === 32 || (code >= 9 && code <= 13)

const isUnicodeSpaceAt = (text: string, index: number): boolean => {
  const ch = text[index]
  return ch !== undefined && SINGLE_CHAR_WHITESPACE_PATTERN.test(ch)
}

export const skipAsciiSpaces = (text: string, start: number): number => {
  let cursor = start
  while (cursor < text.length && isAsciiSpaceCode(text.codePointAt(cursor) ?? 0)) {
    cursor += 1
  }
  return cursor
}

export const startsWithAsciiCaseInsensitive = (
  text: string,
  start: number,
  keywordLower: string
): boolean => {
  if (start + keywordLower.length > text.length) return false
  for (let offset = 0; offset < keywordLower.length; offset += 1) {
    let code = text.codePointAt(start + offset) ?? 0
    if (code >= 65 && code <= 90) {
      code += 32
    }
    if (code !== keywordLower.codePointAt(offset)) {
      return false
    }
  }
  return true
}

export const matchRawBrTagAt = (text: string, start: number): number => {
  if (text.codePointAt(start) !== 60) return -1
  let cursor = skipAsciiSpaces(text, start + 1)
  if (!startsWithAsciiCaseInsensitive(text, cursor, "br")) return -1
  cursor = skipAsciiSpaces(text, cursor + 2)
  if (text.codePointAt(cursor) === 47) {
    cursor = skipAsciiSpaces(text, cursor + 1)
  }
  return text.codePointAt(cursor) === 62 ? cursor + 1 : -1
}

export const matchEntityBrTagAt = (text: string, start: number): number => {
  if (!startsWithAsciiCaseInsensitive(text, start, "&lt;")) return -1
  let cursor = skipAsciiSpaces(text, start + 4)
  if (!startsWithAsciiCaseInsensitive(text, cursor, "br")) return -1
  cursor = skipAsciiSpaces(text, cursor + 2)
  if (text.codePointAt(cursor) === 47) {
    cursor = skipAsciiSpaces(text, cursor + 1)
  }
  return startsWithAsciiCaseInsensitive(text, cursor, "&gt;") ? cursor + 4 : -1
}

export const hasRawBrTag = (text: string): boolean => {
  let index = text.indexOf("<")
  while (index >= 0) {
    if (matchRawBrTagAt(text, index) > index) return true
    index = text.indexOf("<", index + 1)
  }
  return false
}

export const findRawBrTagSpans = (text: string): TextRangeSpan[] => {
  const spans: TextRangeSpan[] = []
  let index = text.indexOf("<")
  while (index >= 0) {
    const end = matchRawBrTagAt(text, index)
    if (end > index) {
      spans.push({ from: index, to: end })
      index = text.indexOf("<", end)
    } else {
      index = text.indexOf("<", index + 1)
    }
  }
  return spans
}

export const replaceRawBrTags = (text: string, replacement: string): string => {
  const spans = findRawBrTagSpans(text)
  if (spans.length === 0) return text
  let result = ""
  let cursor = 0
  for (const span of spans) {
    if (span.from > cursor) result += text.slice(cursor, span.from)
    result += replacement
    cursor = span.to
  }
  if (cursor < text.length) result += text.slice(cursor)
  return result
}

export const replaceEntityBrTags = (text: string, replacement: string): string => {
  const lower = text.toLowerCase()
  let index = lower.indexOf("&lt;")
  if (index < 0) return text
  let result = ""
  let cursor = 0
  while (index >= 0) {
    const end = matchEntityBrTagAt(text, index)
    if (end > index) {
      if (index > cursor) result += text.slice(cursor, index)
      result += replacement
      cursor = end
      index = lower.indexOf("&lt;", end)
    } else {
      index = lower.indexOf("&lt;", index + 4)
    }
  }
  if (cursor === 0) return text
  if (cursor < text.length) result += text.slice(cursor)
  return result
}

const buildColorTokenResult = (
  text: string,
  tokenStart: number,
  tokenEnd: number,
  contentStart: number
): { colorToken: string; contentStart: number } | null => {
  const colorToken = text.slice(tokenStart, tokenEnd).trim()
  return colorToken ? { colorToken, contentStart } : null
}

const scanColorTokenBeforePipe = (
  text: string,
  tokenStart: number,
  allowBackslashInToken: boolean
): { colorToken: string; contentStart: number } | null => {
  for (let cursor = tokenStart; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 123 || code === 125 || code === 10 || code === 13) return null
    if (code === 124) {
      return buildColorTokenResult(text, tokenStart, cursor, cursor + 1)
    }
    if (code === 92) {
      if (text.codePointAt(cursor + 1) === 124) {
        return buildColorTokenResult(text, tokenStart, cursor, cursor + 2)
      }
      if (!allowBackslashInToken) return null
    }
  }
  return null
}

export const matchDoubleBraceColorHeader = (
  text: string,
  openIndex: number,
  allowBackslashInToken = false
): { colorToken: string; contentStart: number } | null => {
  if (!text.startsWith("{{", openIndex)) return null
  let cursor = skipAsciiSpaces(text, openIndex + 2)
  if (!startsWithAsciiCaseInsensitive(text, cursor, "color")) return null
  cursor = skipAsciiSpaces(text, cursor + 5)
  if (text.codePointAt(cursor) !== 58) return null
  cursor = skipAsciiSpaces(text, cursor + 1)
  return scanColorTokenBeforePipe(text, cursor, allowBackslashInToken)
}

const skipDollarConstructAt = (text: string, cursor: number): number => {
  const run = countCodePointRun(text, cursor, 36)
  if (run === 2) {
    const m = scanPandocDisplayMathAt(text, cursor)
    return m ? m.to : cursor + 2
  }
  if (run === 1) {
    const m = scanPandocInlineMathAt(text, cursor)
    return m ? m.to : cursor + 1
  }
  return cursor + run
}

export const findBacktickAwareDoubleCloseBrace = (
  text: string,
  contentStart: number,
  singleLine = false
): number => {
  let cursor = contentStart
  let braceDepth = 0
  while (cursor + 1 < text.length) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) {
      if (singleLine) return -1
      cursor += 1
      continue
    }
    if (code === 92) {
      const nextCode = text.codePointAt(cursor + 1) ?? 0
      if (singleLine && (nextCode === 10 || nextCode === 13)) return -1
      cursor += 2
      continue
    }
    if (code === 96) {
      const end = scanInlineCodeSpanEnd(text, cursor)
      cursor = end > cursor ? end : cursor + countCodePointRun(text, cursor, 96)
      continue
    }
    if (code === 36) {
      cursor = skipDollarConstructAt(text, cursor)
      continue
    }
    if (
      code === 123 &&
      text.codePointAt(cursor + 1) === 123 &&
      matchDoubleBraceColorHeader(text, cursor, true)
    ) {
      return -1
    }
    if (code === 123) {
      braceDepth += 1
      cursor += 1
      continue
    }
    if (code === 125) {
      if (braceDepth === 0 && text.codePointAt(cursor + 1) === 125) return cursor
      if (braceDepth > 0) braceDepth -= 1
      cursor += 1
      continue
    }
    cursor += 1
  }
  return -1
}

const trimColorContentEnd = (
  text: string,
  contentStart: number,
  closeIndex: number,
  trimTrailing: boolean
): number => {
  if (!trimTrailing) return closeIndex
  let contentEnd = closeIndex
  while (contentEnd > contentStart + 1 && isUnicodeSpaceAt(text, contentEnd - 1)) {
    contentEnd -= 1
  }
  return contentEnd
}

export type FindDoubleBraceColorSpanOptions = {
  trimTrailingContentWhitespace: boolean
  allowEmptyContent: boolean
  allowBackslashInToken?: boolean
  skipInlineCodeSpans?: boolean
  singleLine?: boolean
}

const resolveColorCloseBraceIndex = (
  text: string,
  contentStart: number,
  skipCode: boolean,
  singleLine: boolean
): number =>
  skipCode
    ? findBacktickAwareDoubleCloseBrace(text, contentStart, singleLine)
    : text.indexOf("}}", contentStart)

const trySkipUnescapedInlineCodeAt = (text: string, cursor: number): number => {
  if (text.codePointAt(cursor) !== 96 || isEscapedMarkdownAt(text, cursor)) return -1
  return scanInlineCodeSpanEnd(text, cursor)
}

const stepDoubleBraceColorAt = (
  text: string,
  cursor: number,
  options: FindDoubleBraceColorSpanOptions,
  skipCode: boolean
): { span: InlineColorMatchSpan | null; nextCursor: number; stop: boolean } => {
  const header = matchDoubleBraceColorHeader(
    text,
    cursor,
    options.allowBackslashInToken === true
  )
  if (!header) return { span: null, nextCursor: cursor + 2, stop: false }

  const closeIndex = resolveColorCloseBraceIndex(
    text,
    header.contentStart,
    skipCode,
    options.singleLine === true
  )
  if (closeIndex < 0) {
    return { span: null, nextCursor: cursor + 2, stop: !skipCode }
  }
  if (!options.allowEmptyContent && closeIndex === header.contentStart) {
    return { span: null, nextCursor: cursor + 2, stop: false }
  }
  const contentEnd = trimColorContentEnd(
    text,
    header.contentStart,
    closeIndex,
    options.trimTrailingContentWhitespace
  )
  return {
    span: {
      from: cursor,
      to: closeIndex + 2,
      contentFrom: header.contentStart,
      contentTo: contentEnd,
      colorToken: header.colorToken,
      content: text.slice(header.contentStart, contentEnd),
    },
    nextCursor: closeIndex + 2,
    stop: false,
  }
}

export const findDoubleBraceColorSpans = (
  text: string,
  options: FindDoubleBraceColorSpanOptions
): InlineColorMatchSpan[] => {
  if (!text.includes("{{")) return []
  const spans: InlineColorMatchSpan[] = []
  const skipCode = options.skipInlineCodeSpans !== false
  let cursor = 0
  while (cursor + 4 <= text.length) {
    const codeEnd = skipCode ? trySkipUnescapedInlineCodeAt(text, cursor) : -1
    if (codeEnd > cursor) {
      cursor = codeEnd
      continue
    }
    if (!text.startsWith("{{", cursor)) {
      cursor += 1
      continue
    }
    const step = stepDoubleBraceColorAt(text, cursor, options, skipCode)
    if (step.stop) break
    if (step.span) spans.push(step.span)
    cursor = step.nextCursor
  }
  return spans
}

export const stripDoubleBraceColorTokensOnce = (text: string): string => {
  const spans = findDoubleBraceColorSpans(text, {
    trimTrailingContentWhitespace: false,
    allowEmptyContent: true,
    allowBackslashInToken: true,
    singleLine: true,
  })
  if (spans.length === 0) return text
  let output = ""
  let cursor = 0
  for (const span of spans) {
    if (span.from > cursor) output += text.slice(cursor, span.from)
    output += span.content
    cursor = span.to
  }
  if (cursor < text.length) output += text.slice(cursor)
  return output
}

const matchSingleBraceColorOpenAt = (text: string, openIndex: number): number => {
  if (text.codePointAt(openIndex) !== 123 || text.codePointAt(openIndex + 1) === 123) {
    return -1
  }
  let cursor = skipAsciiSpaces(text, openIndex + 1)
  if (!startsWithAsciiCaseInsensitive(text, cursor, "color")) return -1
  cursor = skipAsciiSpaces(text, cursor + 5)
  if (text.codePointAt(cursor) !== 58) return -1
  const closeBrace = text.indexOf("}", cursor + 1)
  if (closeBrace < 0) return -1
  const token = text.slice(cursor + 1, closeBrace).trim()
  if (!token || token.includes("{")) return -1
  return closeBrace + 1
}

const matchSingleBraceColorCloseAt = (text: string, openIndex: number): number => {
  if (text.codePointAt(openIndex) !== 123) return -1
  let cursor = skipAsciiSpaces(text, openIndex + 1)
  if (text.codePointAt(cursor) !== 47) return -1
  cursor = skipAsciiSpaces(text, cursor + 1)
  if (!startsWithAsciiCaseInsensitive(text, cursor, "color")) return -1
  cursor = skipAsciiSpaces(text, cursor + 5)
  return text.codePointAt(cursor) === 125 ? cursor + 1 : -1
}

const findSingleBraceColorClose = (
  text: string,
  searchFrom: number
): { closeStart: number; closeEnd: number } | null => {
  let candidate = text.indexOf("{", searchFrom)
  while (candidate >= 0) {
    const closeEnd = matchSingleBraceColorCloseAt(text, candidate)
    if (closeEnd > candidate) {
      return { closeStart: candidate, closeEnd }
    }
    candidate = text.indexOf("{", candidate + 1)
  }
  return null
}

export const stripSingleBraceColorTokensOnce = (text: string): string => {
  let openIndex = text.indexOf("{")
  if (openIndex < 0) return text
  let output = ""
  let cursor = 0
  while (openIndex >= 0) {
    const openEnd = matchSingleBraceColorOpenAt(text, openIndex)
    if (openEnd < 0) {
      openIndex = text.indexOf("{", openIndex + 1)
      continue
    }
    const closeMatch = findSingleBraceColorClose(text, openEnd)
    if (!closeMatch) break
    if (openIndex > cursor) output += text.slice(cursor, openIndex)
    output += text.slice(openEnd, closeMatch.closeStart)
    cursor = closeMatch.closeEnd
    openIndex = text.indexOf("{", cursor)
  }
  if (cursor === 0) return text
  if (cursor < text.length) output += text.slice(cursor)
  return output
}

const scanWikilinkClose = (
  text: string,
  contentStart: number
): { closeIndex: number; nextSearchIndex: number } => {
  for (let cursor = contentStart; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 93 && text.codePointAt(cursor + 1) === 93) {
      return { closeIndex: cursor, nextSearchIndex: cursor + 2 }
    }
    if (code === 91) {
      return { closeIndex: -1, nextSearchIndex: cursor }
    }
    if (code === 93 || code === 10 || code === 13) {
      return { closeIndex: -1, nextSearchIndex: cursor + 1 }
    }
  }
  return { closeIndex: -1, nextSearchIndex: text.length }
}

const parseWikilinkBody = (
  inner: string
): { rawTarget: string; rawAlias?: string } | null => {
  if (!inner) return null
  const pipeIndex = inner.indexOf("|")
  if (pipeIndex < 0) {
    return inner.includes("\\") ? null : { rawTarget: inner }
  }
  const targetEnd =
    pipeIndex > 0 && inner.codePointAt(pipeIndex - 1) === 92 ? pipeIndex - 1 : pipeIndex
  const rawTarget = inner.slice(0, targetEnd)
  const rawAlias = inner.slice(pipeIndex + 1)
  if (!rawTarget || rawTarget.includes("\\") || !rawAlias) return null
  return { rawTarget, rawAlias }
}

export const findWikilinkSpans = (text: string): WikilinkMatchSpan[] => {
  const spans: WikilinkMatchSpan[] = []
  let openIndex = text.indexOf("[[")
  while (openIndex >= 0 && openIndex + 4 <= text.length) {
    const { closeIndex, nextSearchIndex } = scanWikilinkClose(text, openIndex + 2)
    if (closeIndex < 0) {
      openIndex = text.indexOf("[[", nextSearchIndex)
      continue
    }
    const parsed = parseWikilinkBody(text.slice(openIndex + 2, closeIndex))
    if (parsed) {
      spans.push({
        from: openIndex,
        to: closeIndex + 2,
        rawTarget: parsed.rawTarget,
        rawAlias: parsed.rawAlias,
      })
    }
    openIndex = text.indexOf("[[", nextSearchIndex)
  }
  return spans
}
