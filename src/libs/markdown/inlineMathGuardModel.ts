const MAX_INLINE_MATH_LENGTH = 2048
const MAX_DISPLAY_MATH_LENGTH = 16384
const SINGLE_WHITESPACE_PATTERN = /^\s$/u

const ALLOWED_ASCII_PREFIX_CODES = new Set([
  40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124,
])

const isAsciiDigitCode = (code: number): boolean => code >= 48 && code <= 57

const isWhitespaceChar = (ch: string | undefined): boolean =>
  ch !== undefined && SINGLE_WHITESPACE_PATTERN.test(ch)

const isEscapedAt = (text: string, index: number): boolean => {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && text.codePointAt(cursor) === 92; cursor -= 1) {
    slashCount += 1
  }
  return (slashCount & 1) === 1
}

const isAtLineStart = (text: string, index: number): boolean =>
  index === 0 || text.codePointAt(index - 1) === 10

const findLineEnd = (text: string, from: number): number => {
  const nlIndex = text.indexOf("\n", from)
  return nlIndex < 0 ? text.length : nlIndex
}

const stripLineQuoteAndIndent = (line: string): string => {
  let cursor = 0
  while (cursor < line.length) {
    let spaces = 0
    while (spaces < 3 && line.codePointAt(cursor + spaces) === 32) {
      spaces += 1
    }
    if (line.codePointAt(cursor + spaces) === 62) {
      cursor += spaces + 1
      if (line.codePointAt(cursor) === 32) cursor += 1
      continue
    }
    break
  }
  let indent = 0
  while (indent < 3 && line.codePointAt(cursor + indent) === 32) {
    indent += 1
  }
  return line.slice(cursor + indent)
}

const parseOpeningFence = (line: string): { markerCode: number; length: number } | null => {
  const stripped = stripLineQuoteAndIndent(line)
  const firstCode = stripped.codePointAt(0) ?? 0
  if (firstCode !== 96 && firstCode !== 126) return null
  let runLen = 1
  while (stripped.codePointAt(runLen) === firstCode) {
    runLen += 1
  }
  if (runLen < 3) return null
  const info = stripped.slice(runLen)
  if (firstCode === 96 && info.includes("`")) return null
  return { markerCode: firstCode, length: runLen }
}

const isClosingFenceLine = (
  line: string,
  fence: { markerCode: number; length: number }
): boolean => {
  const stripped = stripLineQuoteAndIndent(line)
  let runLen = 0
  while (stripped.codePointAt(runLen) === fence.markerCode) {
    runLen += 1
  }
  if (runLen < fence.length) return false
  return stripped.slice(runLen).trim().length === 0
}

const matchFencedCodeBlockEnd = (text: string, lineStart: number): number => {
  const firstLineEnd = findLineEnd(text, lineStart)
  const fence = parseOpeningFence(text.slice(lineStart, firstLineEnd))
  if (!fence) return -1

  let cursor = firstLineEnd < text.length ? firstLineEnd + 1 : text.length
  while (cursor < text.length) {
    const lineEnd = findLineEnd(text, cursor)
    if (isClosingFenceLine(text.slice(cursor, lineEnd), fence)) {
      return lineEnd < text.length ? lineEnd + 1 : text.length
    }
    cursor = lineEnd < text.length ? lineEnd + 1 : text.length
  }
  return text.length
}

const isMarkdownBlockBoundaryLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed) return true
  return (
    trimmed.startsWith("#") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith(":::") ||
    trimmed.startsWith("|") ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("~~~")
  )
}

const hasBlankLineBetween = (text: string, from: number, to: number): boolean => {
  let cursor = text.indexOf("\n", from)
  while (cursor >= 0 && cursor < to) {
    const nextLineStart = cursor + 1
    const nextBreak = text.indexOf("\n", nextLineStart)
    const checkEnd = nextBreak < 0 || nextBreak > to ? to : nextBreak
    if (nextBreak >= 0 && nextBreak <= to && text.slice(nextLineStart, checkEnd).trim() === "") {
      return true
    }
    cursor = nextBreak
  }
  return false
}

const hasParagraphOrBlockBreakBetween = (text: string, from: number, to: number): boolean => {
  let cursor = text.indexOf("\n", from)
  while (cursor >= 0 && cursor < to) {
    const nextLineStart = cursor + 1
    const nextBreak = text.indexOf("\n", nextLineStart)
    const lineEnd = nextBreak < 0 ? text.length : nextBreak
    if (isMarkdownBlockBoundaryLine(text.slice(nextLineStart, lineEnd))) {
      return true
    }
    cursor = nextBreak
  }
  return false
}

const countRunOfCode = (text: string, start: number, targetCode: number): number => {
  let cursor = start
  while (cursor < text.length && text.codePointAt(cursor) === targetCode) {
    cursor += 1
  }
  return cursor - start
}

const matchInlineCodeSpanEnd = (text: string, index: number): number => {
  const runLen = countRunOfCode(text, index, 96)
  let cursor = index + runLen
  while (cursor < text.length) {
    if (text.codePointAt(cursor) === 10) {
      const nextEnd = findLineEnd(text, cursor + 1)
      if (text.slice(cursor + 1, nextEnd).trim() === "") {
        return index + runLen
      }
    }
    if (text.codePointAt(cursor) === 96) {
      const candidateLen = countRunOfCode(text, cursor, 96)
      if (candidateLen === runLen) {
        return cursor + candidateLen
      }
      cursor += candidateLen
      continue
    }
    cursor += 1
  }
  return index + runLen
}

const matchHtmlCommentEnd = (text: string, index: number): number => {
  if (!text.startsWith("<!--", index)) return -1
  const closeIdx = text.indexOf("-->", index + 4)
  return closeIdx < 0 ? text.length : closeIdx + 3
}

const AUTOLINK_SCHEMES = ["http://", "https://", "ftp://", "mailto:"] as const

const matchAutolinkEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 60) return -1
  const probe = text.slice(index + 1, index + 12).toLowerCase()
  if (!AUTOLINK_SCHEMES.some((scheme) => probe.startsWith(scheme))) return -1
  for (let cursor = index + 2; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 62) return cursor + 1
    if (code <= 32 || code === 60) return -1
  }
  return -1
}

const matchBareUrlEnd = (text: string, index: number): number => {
  const lowerSlice = text.slice(index, index + 8).toLowerCase()
  if (!lowerSlice.startsWith("http://") && !lowerSlice.startsWith("https://")) return -1
  if (index > 0) {
    const prevCode = text.codePointAt(index - 1) ?? 0
    const isPrevAlphaNum =
      isAsciiDigitCode(prevCode) ||
      (prevCode >= 65 && prevCode <= 90) ||
      (prevCode >= 97 && prevCode <= 122)
    if (isPrevAlphaNum) return -1
  }
  let cursor = index + 7
  while (cursor < text.length) {
    const code = text.codePointAt(cursor) ?? 0
    if (code <= 32 || code === 60 || code === 62 || code === 41) break
    cursor += 1
  }
  return cursor
}

const scanAngleBracketDestination = (text: string, openAngle: number): number => {
  for (let cursor = openAngle + 1; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13 || code === 60) return -1
    if (code === 62 && !isEscapedAt(text, cursor)) {
      const closeParen = text.indexOf(")", cursor + 1)
      if (closeParen < 0 || hasBlankLineBetween(text, cursor + 1, closeParen)) return -1
      return closeParen + 1
    }
  }
  return -1
}

const matchLinkDestinationEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 93 || isEscapedAt(text, index)) return -1
  if (text.codePointAt(index + 1) !== 40) return -1
  let cursor = index + 2
  while (cursor < text.length && (text.codePointAt(cursor) === 32 || text.codePointAt(cursor) === 9)) {
    cursor += 1
  }
  if (text.codePointAt(cursor) === 60) {
    return scanAngleBracketDestination(text, cursor)
  }
  let depth = 1
  for (let pos = cursor; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (code === 10 && text.slice(pos + 1, findLineEnd(text, pos + 1)).trim() === "") {
      return -1
    }
    if (isEscapedAt(text, pos)) continue
    if (code === 40) depth += 1
    else if (code === 41) {
      depth -= 1
      if (depth === 0) return pos + 1
    }
  }
  return -1
}

const trySkipLiteralConstructAt = (text: string, index: number): number => {
  if (isAtLineStart(text, index)) {
    const fenceEnd = matchFencedCodeBlockEnd(text, index)
    if (fenceEnd > index) return fenceEnd
  }
  const code = text.codePointAt(index) ?? 0
  if (code === 96 && !isEscapedAt(text, index)) {
    return matchInlineCodeSpanEnd(text, index)
  }
  if (code === 60) {
    const commentEnd = matchHtmlCommentEnd(text, index)
    if (commentEnd > index) return commentEnd
    const autolinkEnd = matchAutolinkEnd(text, index)
    if (autolinkEnd > index) return autolinkEnd
  }
  if (code === 93) {
    const linkDestEnd = matchLinkDestinationEnd(text, index)
    if (linkDestEnd > index) return linkDestEnd
  }
  if (code === 104 || code === 72) {
    const bareUrlEnd = matchBareUrlEnd(text, index)
    if (bareUrlEnd > index) return bareUrlEnd
  }
  return -1
}

const isDedicatedDoubleDollarLine = (line: string): boolean =>
  stripLineQuoteAndIndent(line).trim() === "$$"

const matchDedicatedDisplayMathEnd = (text: string, index: number): number => {
  let lineStart = index
  while (lineStart > 0 && text.codePointAt(lineStart - 1) !== 10) {
    lineStart -= 1
  }
  const firstLineEnd = findLineEnd(text, index)
  if (!isDedicatedDoubleDollarLine(text.slice(lineStart, firstLineEnd))) return -1

  let cursor = firstLineEnd < text.length ? firstLineEnd + 1 : text.length
  const limit = Math.min(text.length, index + 2 + MAX_DISPLAY_MATH_LENGTH)
  while (cursor < limit) {
    const lineEnd = findLineEnd(text, cursor)
    const line = text.slice(cursor, lineEnd)
    if (parseOpeningFence(line) !== null) return -1
    if (isDedicatedDoubleDollarLine(line)) {
      const inner = text.slice(firstLineEnd + 1, cursor)
      return inner.trim().length > 0 ? lineEnd : -1
    }
    cursor = lineEnd < text.length ? lineEnd + 1 : text.length
  }
  return -1
}

const matchParagraphDisplayMathEnd = (text: string, index: number): number => {
  const scanLimit = Math.min(text.length - 1, index + 2 + MAX_DISPLAY_MATH_LENGTH)
  for (let cursor = index + 2; cursor < scanLimit; cursor += 1) {
    if (
      text.codePointAt(cursor) === 36 &&
      text.codePointAt(cursor + 1) === 36 &&
      text.codePointAt(cursor + 2) !== 36 &&
      !isEscapedAt(text, cursor)
    ) {
      if (hasParagraphOrBlockBreakBetween(text, index + 2, cursor)) return -1
      const inner = text.slice(index + 2, cursor)
      return inner.trim().length > 0 ? cursor + 2 : -1
    }
  }
  return -1
}

const matchDisplayMathEnd = (text: string, index: number): number => {
  const dedicatedEnd = matchDedicatedDisplayMathEnd(text, index)
  if (dedicatedEnd > index) return dedicatedEnd
  return matchParagraphDisplayMathEnd(text, index)
}

const isAllowedInlineMathPrefix = (text: string, index: number): boolean => {
  if (index === 0) return true
  const prevChar = text[index - 1]
  if (isWhitespaceChar(prevChar)) return true
  const prevCode = text.codePointAt(index - 1) ?? 0
  if (prevCode > 0x7f) return true
  return ALLOWED_ASCII_PREFIX_CODES.has(prevCode)
}

const scanInlineMathClosingDollar = (text: string, index: number): number => {
  const scanLimit = Math.min(text.length, index + 1 + MAX_INLINE_MATH_LENGTH)
  for (let cursor = index + 1; cursor < scanLimit; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13) return -1
    if (code === 96 && !isEscapedAt(text, cursor)) return -1
    if (code === 93 && text.codePointAt(cursor + 1) === 40 && !isEscapedAt(text, cursor)) {
      return -1
    }
    if (code === 36 && !isEscapedAt(text, cursor)) {
      return text.codePointAt(cursor + 1) === 36 ? -1 : cursor
    }
  }
  return -1
}

const matchPandocInlineMathEnd = (text: string, index: number): number => {
  if (!isAllowedInlineMathPrefix(text, index)) return -1
  const firstInner = text[index + 1]
  if (!firstInner || isWhitespaceChar(firstInner)) return -1

  const closeIndex = scanInlineMathClosingDollar(text, index)
  if (closeIndex < index + 2) return -1

  const inner = text.slice(index + 1, closeIndex)
  const lastInner = inner.at(-1)
  if (!lastInner || isWhitespaceChar(lastInner) || lastInner.codePointAt(0) === 92) {
    return -1
  }

  const afterCloseCode = text.codePointAt(closeIndex + 1) ?? -1
  if (isAsciiDigitCode(afterCloseCode) || afterCloseCode === 36) {
    return -1
  }
  return closeIndex + 1
}

const handleDollarSequenceAt = (
  markdown: string,
  index: number
): { validMathEnd: number; nextIndex: number; escapeCount: number } => {
  const runLen = countRunOfCode(markdown, index, 36)
  if (runLen > 2) {
    return { validMathEnd: -1, nextIndex: index + runLen, escapeCount: runLen }
  }
  if (runLen === 2) {
    const displayEnd = matchDisplayMathEnd(markdown, index)
    if (displayEnd > index) {
      return { validMathEnd: displayEnd, nextIndex: displayEnd, escapeCount: 0 }
    }
    return { validMathEnd: -1, nextIndex: index + 2, escapeCount: 2 }
  }
  const inlineEnd = matchPandocInlineMathEnd(markdown, index)
  if (inlineEnd > index) {
    return { validMathEnd: inlineEnd, nextIndex: inlineEnd, escapeCount: 0 }
  }
  return { validMathEnd: -1, nextIndex: index + 1, escapeCount: 1 }
}

const scanMarkdownDollars = (
  markdown: string,
  stopOnFirstMath: boolean
): { hasMath: boolean; escaped: string } => {
  let hasMath = false
  let output = ""
  let copyFrom = 0
  let index = 0

  while (index < markdown.length) {
    const skippedEnd = trySkipLiteralConstructAt(markdown, index)
    if (skippedEnd > index) {
      index = skippedEnd
      continue
    }

    if (markdown.codePointAt(index) !== 36 || isEscapedAt(markdown, index)) {
      index += 1
      continue
    }

    const step = handleDollarSequenceAt(markdown, index)
    if (step.validMathEnd > index) {
      hasMath = true
      if (stopOnFirstMath) {
        return { hasMath: true, escaped: markdown }
      }
      index = step.nextIndex
      continue
    }

    if (step.escapeCount > 0 && !stopOnFirstMath) {
      output += `${markdown.slice(copyFrom, index)}${"\\$".repeat(step.escapeCount)}`
      copyFrom = index + step.escapeCount
    }
    index = step.nextIndex
  }

  if (stopOnFirstMath || copyFrom === 0) {
    return { hasMath, escaped: markdown }
  }
  return { hasMath, escaped: `${output}${markdown.slice(copyFrom)}` }
}

export const hasValidMarkdownMath = (markdown: string): boolean => {
  if (!markdown.includes("$")) return false
  return scanMarkdownDollars(markdown, true).hasMath
}

export const escapeNonPandocSingleDollars = (markdown: string): string => {
  if (!markdown.includes("$")) return markdown
  return scanMarkdownDollars(markdown, false).escaped
}
