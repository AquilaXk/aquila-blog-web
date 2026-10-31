import {
  countCodePointRun,
  findLineEndOffset,
  hasBlankLineBetween,
  isEscapedMarkdownAt,
  matchFencedCodeBlockEnd,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
} from "./pandocMathScanner"

const AUTOLINK_SCHEMES = ["http://", "https://", "ftp://", "mailto:"] as const
const ESCAPED_DOLLAR_TOKEN = String.raw`\$`

const isAtLineStart = (text: string, index: number): boolean =>
  index === 0 || text.codePointAt(index - 1) === 10

const isAsciiAlphaNumericCode = (code: number): boolean => {
  const isDigit = code >= 48 && code <= 57
  const isUpper = code >= 65 && code <= 90
  const isLower = code >= 97 && code <= 122
  return isDigit || isUpper || isLower
}

const skipSpacesAndTabs = (text: string, start: number): number => {
  let cursor = start
  while (cursor < text.length && (text.codePointAt(cursor) === 32 || text.codePointAt(cursor) === 9)) {
    cursor += 1
  }
  return cursor
}

const matchHtmlCommentEnd = (text: string, index: number): number => {
  if (!text.startsWith("<!--", index)) return -1
  const closeIdx = text.indexOf("-->", index + 4)
  return closeIdx < 0 ? text.length : closeIdx + 3
}

const scanAutolinkClosingAngle = (text: string, start: number): number => {
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 62) return cursor + 1
    if (code <= 32 || code === 60) return -1
  }
  return -1
}

const matchAutolinkEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 60) return -1
  const probe = text.slice(index + 1, index + 12).toLowerCase()
  if (!AUTOLINK_SCHEMES.some((scheme) => probe.startsWith(scheme))) return -1
  return scanAutolinkClosingAngle(text, index + 2)
}

const isBareUrlStopCode = (code: number): boolean =>
  code <= 32 || code === 60 || code === 62 || code === 41

const matchBareUrlEnd = (text: string, index: number): number => {
  const lowerSlice = text.slice(index, index + 8).toLowerCase()
  if (!lowerSlice.startsWith("http://") && !lowerSlice.startsWith("https://")) return -1
  if (index > 0 && isAsciiAlphaNumericCode(text.codePointAt(index - 1) ?? 0)) return -1
  let cursor = index + 7
  while (cursor < text.length && !isBareUrlStopCode(text.codePointAt(cursor) ?? 0)) {
    cursor += 1
  }
  return cursor
}

const resolveAngleDestinationClose = (text: string, angleClose: number): number => {
  const closeParen = text.indexOf(")", angleClose + 1)
  if (closeParen < 0 || hasBlankLineBetween(text, angleClose + 1, closeParen)) return -1
  return closeParen + 1
}

const scanAngleBracketDestination = (text: string, openAngle: number): number => {
  for (let cursor = openAngle + 1; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13 || code === 60) return -1
    if (code === 62 && !isEscapedMarkdownAt(text, cursor)) {
      return resolveAngleDestinationClose(text, cursor)
    }
  }
  return -1
}

const isBlankLineAfterNewline = (text: string, newlinePos: number): boolean =>
  text.slice(newlinePos + 1, findLineEndOffset(text, newlinePos + 1)).trim() === ""

const adjustParenDepthAt = (text: string, pos: number, depth: number): number => {
  if (isEscapedMarkdownAt(text, pos)) return depth
  const code = text.codePointAt(pos) ?? 0
  if (code === 40) return depth + 1
  return code === 41 ? depth - 1 : depth
}

const scanBalancedParenDestination = (text: string, start: number): number => {
  let depth = 1
  for (let pos = start; pos < text.length; pos += 1) {
    if (text.codePointAt(pos) === 10 && isBlankLineAfterNewline(text, pos)) return -1
    depth = adjustParenDepthAt(text, pos, depth)
    if (depth === 0) return pos + 1
  }
  return -1
}

const matchLinkDestinationEnd = (text: string, index: number): number => {
  if (
    text.codePointAt(index) !== 93 ||
    text.codePointAt(index + 1) !== 40 ||
    isEscapedMarkdownAt(text, index)
  ) {
    return -1
  }
  const cursor = skipSpacesAndTabs(text, index + 2)
  return text.codePointAt(cursor) === 60
    ? scanAngleBracketDestination(text, cursor)
    : scanBalancedParenDestination(text, cursor)
}

const skipUnescapedBacktickAt = (text: string, index: number): number => {
  if (isEscapedMarkdownAt(text, index)) return -1
  const codeEnd = scanInlineCodeSpanEnd(text, index)
  return codeEnd > index ? codeEnd : index + countCodePointRun(text, index, 96)
}

const skipAngleConstructAt = (text: string, index: number): number => {
  const commentEnd = matchHtmlCommentEnd(text, index)
  return commentEnd > index ? commentEnd : matchAutolinkEnd(text, index)
}

const trySkipLiteralConstructAt = (text: string, index: number): number => {
  if (isAtLineStart(text, index)) {
    const fenceEnd = matchFencedCodeBlockEnd(text, index)
    if (fenceEnd > index) return fenceEnd
  }
  const code = text.codePointAt(index) ?? 0
  if (code === 96) return skipUnescapedBacktickAt(text, index)
  if (code === 60) return skipAngleConstructAt(text, index)
  if (code === 93) return matchLinkDestinationEnd(text, index)
  if (code === 104 || code === 72) return matchBareUrlEnd(text, index)
  return -1
}

const handleDollarSequenceAt = (
  markdown: string,
  index: number
): { validMathEnd: number; nextIndex: number; escapeCount: number } => {
  const runLen = countCodePointRun(markdown, index, 36)
  if (runLen > 2) {
    return { validMathEnd: -1, nextIndex: index + runLen, escapeCount: runLen }
  }
  if (runLen === 2) {
    const displayToken = scanPandocDisplayMathAt(markdown, index)
    if (displayToken) {
      return { validMathEnd: displayToken.to, nextIndex: displayToken.to, escapeCount: 0 }
    }
    return { validMathEnd: -1, nextIndex: index + 2, escapeCount: 2 }
  }
  const inlineToken = scanPandocInlineMathAt(markdown, index)
  if (inlineToken) {
    return { validMathEnd: inlineToken.to, nextIndex: inlineToken.to, escapeCount: 0 }
  }
  return { validMathEnd: -1, nextIndex: index + 1, escapeCount: 1 }
}

const advancePastNonDollarAt = (markdown: string, index: number): number => {
  const skippedEnd = trySkipLiteralConstructAt(markdown, index)
  if (skippedEnd > index) return skippedEnd
  if (markdown.codePointAt(index) !== 36 || isEscapedMarkdownAt(markdown, index)) {
    return index + 1
  }
  return index
}

export const hasValidMarkdownMath = (markdown: string): boolean => {
  if (!markdown.includes("$")) return false
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index)
    if (step.validMathEnd > index) return true
    index = step.nextIndex
  }
  return false
}

export const ESCAPED_HIGHLIGHT_SENTINEL = "\uE000aqhl\uE001"
export const ESCAPED_LT_SENTINEL = "\uE000aqlt\uE001"

const PROTECTED_INLINE_TOKEN_HINT = /\\(?:==|<)|&#(?:0*60|x0*3c);|&lt;/i
const ESCAPED_BR_ENTITY_PREFIX = /^&(?:lt|#0*60|#x0*3c);(?=\s*br(?:[\s/>]|&(?:gt|#0*62|#x0*3e);))/i

const matchProtectedInlineTokenAt = (
  markdown: string,
  index: number
): { length: number; sentinel: string } | null => {
  const code = markdown.codePointAt(index) ?? 0
  if (code === 92 && !isEscapedMarkdownAt(markdown, index)) {
    const nextCode = markdown.codePointAt(index + 1) ?? 0
    if (nextCode === 61 && markdown.codePointAt(index + 2) === 61) {
      return { length: 3, sentinel: ESCAPED_HIGHLIGHT_SENTINEL }
    }
    if (nextCode === 60) {
      return { length: 2, sentinel: ESCAPED_LT_SENTINEL }
    }
  }
  if (code === 38) {
    const entityMatch = ESCAPED_BR_ENTITY_PREFIX.exec(markdown.slice(index, index + 24))
    if (entityMatch) {
      return { length: entityMatch[0].length, sentinel: ESCAPED_LT_SENTINEL }
    }
  }
  return null
}

export const escapeNonPandocSingleDollars = (markdown: string): string => {
  if (!markdown.includes("$")) return markdown
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index)
    if (step.escapeCount > 0) {
      output += `${markdown.slice(copyFrom, index)}${ESCAPED_DOLLAR_TOKEN.repeat(step.escapeCount)}`
      copyFrom = index + step.escapeCount
    }
    index = step.nextIndex
  }
  return copyFrom === 0 ? markdown : `${output}${markdown.slice(copyFrom)}`
}

export const protectEscapedHighlightDelimiters = (markdown: string): string => {
  if (!PROTECTED_INLINE_TOKEN_HINT.test(markdown)) return markdown
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const skippedEnd = trySkipLiteralConstructAt(markdown, index)
    if (skippedEnd > index) {
      index = skippedEnd
      continue
    }
    const code = markdown.codePointAt(index) ?? 0
    if (code === 36 && !isEscapedMarkdownAt(markdown, index)) {
      index = handleDollarSequenceAt(markdown, index).nextIndex
      continue
    }
    if (code === 92 && markdown.codePointAt(index + 1) === 92) {
      index += 2
      continue
    }
    const matched = matchProtectedInlineTokenAt(markdown, index)
    if (matched) {
      output += `${markdown.slice(copyFrom, index)}${matched.sentinel}`
      copyFrom = index + matched.length
      index += matched.length
      continue
    }
    index += 1
  }
  return copyFrom === 0 ? markdown : `${output}${markdown.slice(copyFrom)}`
}
