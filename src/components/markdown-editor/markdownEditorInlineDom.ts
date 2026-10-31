import { resolveInlineColorValue } from "../../libs/markdown/inlineColor"
import { hasAsciiControlCharacters, normalizeSafeMarkdownUrl } from "../../libs/markdown/safeMarkdownUrl"

type KatexRuntime = {
  renderToString: (math: string, options: { displayMode: boolean; throwOnError: boolean }) => string
}

type InlineDomToken =
  | { kind: "literal"; from: number; end: number; raw: string }
  | { kind: "code"; from: number; end: number; content: string }
  | { kind: "strong"; from: number; end: number; content: string }
  | { kind: "em"; from: number; end: number; content: string }
  | { kind: "del"; from: number; end: number; content: string }
  | { kind: "mark"; from: number; end: number; content: string }
  | { kind: "math"; from: number; end: number; math: string }
  | { kind: "link"; from: number; end: number; label: string; href: string }
  | { kind: "color"; from: number; end: number; color: string; content: string }
  | { kind: "br"; from: number; end: number }
  | { kind: "wikilink"; from: number; end: number; display: string }

const MAX_INLINE_NESTING_DEPTH = 4
const MAX_INLINE_MATH_SCAN_LENGTH = 2048
const INLINE_TRIGGER_PATTERN = /[`*~=$[{<]/
const SINGLE_WHITESPACE_PATTERN = /^\s$/u

const ALLOWED_ASCII_MATH_PREFIX_CODES = new Set([
  40, 91, 123, 34, 39, 45, 61, 47, 43, 60, 62, 44, 59, 58, 33, 63, 42, 95, 126, 124,
])

let cachedKatex: KatexRuntime | null = null
let katexLoadPromise: Promise<KatexRuntime | null> | null = null

const getKatex = (): KatexRuntime | null => {
  if (cachedKatex) return cachedKatex
  if (!katexLoadPromise && typeof window !== "undefined") {
    katexLoadPromise = import("katex")
      .then((mod) => (cachedKatex = mod.default || mod))
      .catch(() => null)
  }
  return null
}

export const renderKatexIntoElement = (
  element: HTMLElement,
  math: string,
  displayMode: boolean,
  fallbackText: string
): void => {
  const katex = getKatex()
  if (katex) {
    try {
      element.innerHTML = katex.renderToString(math, { displayMode, throwOnError: false })
      return
    } catch {}
  } else if (katexLoadPromise) {
    void katexLoadPromise.then(() => {
      try {
        if (cachedKatex) {
          element.innerHTML = cachedKatex.renderToString(math, { displayMode, throwOnError: false })
        }
      } catch {}
    })
  }
  element.textContent = fallbackText
}

export const isSafeInlineHref = (href: string): boolean => {
  const trimmed = href.trim()
  if (!trimmed || hasAsciiControlCharacters(trimmed)) return false
  if (trimmed.startsWith("#")) return true
  if (trimmed.toLowerCase().startsWith("mailto:") && trimmed.length > 7) return true
  return normalizeSafeMarkdownUrl(trimmed).length > 0
}

const isNewlineCode = (code: number): boolean => code === 10 || code === 13

const isWhitespaceAt = (text: string, index: number): boolean => {
  const ch = text[index]
  return ch !== undefined && SINGLE_WHITESPACE_PATTERN.test(ch)
}

const isEscapedAt = (text: string, index: number): boolean => {
  let slashCount = 0
  for (let pos = index - 1; pos >= 0 && text.codePointAt(pos) === 92; pos -= 1) {
    slashCount += 1
  }
  return (slashCount & 1) === 1
}

const countCodeRun = (text: string, start: number, targetCode: number): number => {
  let end = start
  while (end < text.length && text.codePointAt(end) === targetCode) {
    end += 1
  }
  return end - start
}

const normalizeCodeSpanContent = (rawContent: string, runLen: number): string => {
  if (
    runLen > 1 &&
    rawContent.length > 2 &&
    rawContent.startsWith(" ") &&
    rawContent.endsWith(" ") &&
    rawContent.trim().length > 0
  ) {
    return rawContent.slice(1, -1)
  }
  return rawContent
}

const matchInlineCodeAt = (text: string, from: number): InlineDomToken | null => {
  const runLen = countCodeRun(text, from, 96)
  let pos = from + runLen
  while (pos < text.length) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) break
    if (code === 96) {
      const closeLen = countCodeRun(text, pos, 96)
      if (closeLen === runLen) {
        const end = pos + closeLen
        if (pos === from + runLen) {
          return { kind: "literal", from, end, raw: text.slice(from, end) }
        }
        const content = normalizeCodeSpanContent(text.slice(from + runLen, pos), runLen)
        return { kind: "code", from, end, content }
      }
      pos += closeLen
      continue
    }
    pos += 1
  }
  if (runLen > 1) {
    return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
  }
  return null
}

const matchPairedDoubleDelimiterAt = (
  text: string,
  from: number,
  markerCode: number,
  kind: "strong" | "del"
): InlineDomToken | null => {
  const runLen = countCodeRun(text, from, markerCode)
  if (runLen !== 2) {
    if (runLen > 2) {
      return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
    }
    return null
  }
  const innerStart = from + 2
  const firstCode = text.codePointAt(innerStart) ?? 0
  if (!firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, innerStart)) {
    return { kind: "literal", from, end: innerStart, raw: text.slice(from, innerStart) }
  }
  for (let pos = innerStart; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) break
    if (
      code === markerCode &&
      text.codePointAt(pos + 1) === markerCode &&
      text.codePointAt(pos + 2) !== markerCode &&
      !isEscapedAt(text, pos) &&
      !isWhitespaceAt(text, pos - 1)
    ) {
      return { kind, from, end: pos + 2, content: text.slice(innerStart, pos) }
    }
  }
  return { kind: "literal", from, end: innerStart, raw: text.slice(from, innerStart) }
}

const matchEmphasisAt = (text: string, from: number): InlineDomToken | null => {
  const innerStart = from + 1
  const firstCode = text.codePointAt(innerStart) ?? 0
  if (!firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, innerStart)) return null
  let pos = innerStart
  while (pos < text.length) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) return null
    if (code === 42 && !isEscapedAt(text, pos)) {
      const closeRun = countCodeRun(text, pos, 42)
      if (closeRun === 1 && !isWhitespaceAt(text, pos - 1)) {
        return { kind: "em", from, end: pos + 1, content: text.slice(innerStart, pos) }
      }
      pos += closeRun
      continue
    }
    pos += 1
  }
  return null
}

const matchStarDelimiterAt = (text: string, from: number): InlineDomToken | null => {
  if (text.codePointAt(from + 1) === 42) {
    return matchPairedDoubleDelimiterAt(text, from, 42, "strong")
  }
  return matchEmphasisAt(text, from)
}

const isClosingHighlightAt = (text: string, index: number): boolean =>
  text.codePointAt(index) === 61 &&
  text.codePointAt(index + 1) === 61 &&
  text.codePointAt(index - 1) !== 61 &&
  !isWhitespaceAt(text, index - 1) &&
  text.codePointAt(index + 2) !== 61

const matchHighlightAt = (text: string, from: number): InlineDomToken | null => {
  const runLen = countCodeRun(text, from, 61)
  if (runLen !== 2) {
    if (runLen > 2) {
      return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
    }
    return null
  }
  const innerStart = from + 2
  const firstCode = text.codePointAt(innerStart) ?? 0
  if (from + 3 >= text.length || !firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, innerStart)) {
    return { kind: "literal", from, end: innerStart, raw: "==" }
  }
  for (let pos = from + 3; pos + 1 < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) break
    if (code === 61 && isClosingHighlightAt(text, pos)) {
      const content = text.slice(innerStart, pos)
      if (content.trim().length > 0) {
        return { kind: "mark", from, end: pos + 2, content }
      }
      break
    }
  }
  return { kind: "literal", from, end: innerStart, raw: "==" }
}

const isAllowedMathPrefix = (text: string, index: number): boolean => {
  if (index === 0 || isWhitespaceAt(text, index - 1)) return true
  const prevCode = text.codePointAt(index - 1) ?? 0
  return prevCode > 0x7f || ALLOWED_ASCII_MATH_PREFIX_CODES.has(prevCode)
}

const matchSingleLineDoubleDollarAt = (text: string, from: number): InlineDomToken => {
  const limit = Math.min(text.length - 1, from + 2 + MAX_INLINE_MATH_SCAN_LENGTH)
  for (let pos = from + 2; pos < limit; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) break
    if (
      code === 36 &&
      text.codePointAt(pos + 1) === 36 &&
      text.codePointAt(pos + 2) !== 36 &&
      !isEscapedAt(text, pos)
    ) {
      const math = text.slice(from + 2, pos)
      if (math.trim().length > 0) {
        return { kind: "math", from, end: pos + 2, math }
      }
      break
    }
  }
  return { kind: "literal", from, end: from + 2, raw: "$$" }
}

const isValidPandocMathClose = (text: string, from: number, closePos: number): boolean => {
  if (closePos < from + 2) return false
  if (isWhitespaceAt(text, closePos - 1) || text.codePointAt(closePos - 1) === 92) return false
  const afterCode = text.codePointAt(closePos + 1) ?? -1
  return !((afterCode >= 48 && afterCode <= 57) || afterCode === 36)
}

const matchPandocSingleDollarAt = (text: string, from: number): InlineDomToken | null => {
  if (!isAllowedMathPrefix(text, from)) return null
  const firstCode = text.codePointAt(from + 1) ?? 0
  if (!firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, from + 1)) return null
  const limit = Math.min(text.length, from + 1 + MAX_INLINE_MATH_SCAN_LENGTH)
  for (let pos = from + 1; pos < limit; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) return null
    if (code === 96 && !isEscapedAt(text, pos)) return null
    if (code === 36 && !isEscapedAt(text, pos)) {
      if (text.codePointAt(pos + 1) === 36) return null
      if (!isValidPandocMathClose(text, from, pos)) return null
      return { kind: "math", from, end: pos + 1, math: text.slice(from + 1, pos) }
    }
  }
  return null
}

const matchMathAt = (text: string, from: number): InlineDomToken | null => {
  const runLen = countCodeRun(text, from, 36)
  if (runLen > 2) {
    return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
  }
  if (runLen === 2) {
    return matchSingleLineDoubleDollarAt(text, from)
  }
  return matchPandocSingleDollarAt(text, from)
}

const parseWikilinkInner = (raw: string): string | null => {
  const pipeIdx = raw.indexOf("|")
  const rawTarget = pipeIdx < 0 ? raw : raw.slice(0, pipeIdx)
  const trimmedTarget = (rawTarget.endsWith("\\") ? rawTarget.slice(0, -1) : rawTarget).trim()
  if (!trimmedTarget || trimmedTarget.includes("\\")) return null
  if (pipeIdx < 0) return trimmedTarget
  const alias = raw.slice(pipeIdx + 1).trim()
  return alias || null
}

const matchWikilinkAt = (text: string, from: number): InlineDomToken | null => {
  for (let pos = from + 2; pos + 1 < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code) || code === 91) return null
    if (code === 93 && text.codePointAt(pos + 1) === 93) {
      const display = parseWikilinkInner(text.slice(from + 2, pos))
      return display ? { kind: "wikilink", from, end: pos + 2, display } : null
    }
  }
  return null
}

const findClosingLinkBracket = (text: string, start: number): number => {
  for (let pos = start; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) return -1
    if (code === 91 && !isEscapedAt(text, pos)) return -1
    if (code === 93 && !isEscapedAt(text, pos)) return pos
  }
  return -1
}

const findClosingLinkParen = (text: string, start: number): number => {
  let depth = 1
  for (let pos = start; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (code <= 32) return -1
    if (isEscapedAt(text, pos)) continue
    if (code === 40) depth += 1
    else if (code === 41) {
      depth -= 1
      if (depth === 0) return pos
    }
  }
  return -1
}

const matchMarkdownLinkAt = (text: string, from: number): InlineDomToken | null => {
  const closeBracket = findClosingLinkBracket(text, from + 1)
  if (closeBracket <= from + 1 || text.codePointAt(closeBracket + 1) !== 40) return null
  const closeParen = findClosingLinkParen(text, closeBracket + 2)
  if (closeParen <= closeBracket + 2) return null
  const label = text.slice(from + 1, closeBracket)
  const href = text.slice(closeBracket + 2, closeParen)
  const end = closeParen + 1
  if (isSafeInlineHref(href)) {
    return { kind: "link", from, end, label, href: href.trim() }
  }
  return { kind: "literal", from, end, raw: text.slice(from, end) }
}

const matchBracketConstructAt = (text: string, from: number): InlineDomToken | null => {
  if (text.codePointAt(from + 1) === 91) {
    return matchWikilinkAt(text, from)
  }
  return matchMarkdownLinkAt(text, from)
}

const findDoubleCloseBrace = (text: string, start: number): number => {
  for (let pos = start; pos + 1 < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (code === 123) return -1
    if (code === 125) {
      return text.codePointAt(pos + 1) === 125 ? pos : -1
    }
  }
  return -1
}

const parseInlineColorDirective = (
  inner: string
): { rawColor: string; content: string } | null => {
  const trimmedStart = inner.trimStart()
  if (!trimmedStart.toLowerCase().startsWith("color")) return null
  const afterKeyword = trimmedStart.slice(5).trimStart()
  if (!afterKeyword.startsWith(":")) return null
  const payload = afterKeyword.slice(1)
  const pipeIdx = payload.indexOf("|")
  if (pipeIdx < 0) return null
  const rawLeft = payload.slice(0, pipeIdx)
  const rawColor = (rawLeft.endsWith("\\") ? rawLeft.slice(0, -1) : rawLeft).trim()
  const content = payload.slice(pipeIdx + 1).trim()
  if (!rawColor || rawColor.includes("\\") || !content) return null
  return { rawColor, content }
}

const matchInlineColorAt = (text: string, from: number): InlineDomToken | null => {
  if (text.codePointAt(from + 1) !== 123) return null
  const closeBrace = findDoubleCloseBrace(text, from + 2)
  if (closeBrace < 0) return null
  const parsed = parseInlineColorDirective(text.slice(from + 2, closeBrace))
  if (!parsed) return null
  const end = closeBrace + 2
  const color = resolveInlineColorValue(parsed.rawColor)
  if (color) {
    return { kind: "color", from, end, color, content: parsed.content }
  }
  return { kind: "literal", from, end, raw: text.slice(from, end) }
}

const skipHorizontalSpaces = (text: string, start: number): number => {
  let pos = start
  while (pos < text.length && (text.codePointAt(pos) === 32 || text.codePointAt(pos) === 9)) {
    pos += 1
  }
  return pos
}

const matchLineBreakTagAt = (text: string, from: number): InlineDomToken | null => {
  const bCode = text.codePointAt(from + 1) ?? 0
  const rCode = text.codePointAt(from + 2) ?? 0
  if ((bCode !== 98 && bCode !== 66) || (rCode !== 114 && rCode !== 82)) return null
  let pos = skipHorizontalSpaces(text, from + 3)
  if (text.codePointAt(pos) === 47) {
    pos = skipHorizontalSpaces(text, pos + 1)
  }
  return text.codePointAt(pos) === 62 ? { kind: "br", from, end: pos + 1 } : null
}

const matchInlineTokenAt = (text: string, cursor: number): InlineDomToken | null => {
  const code = text.codePointAt(cursor) ?? 0
  if (code === 60) return matchLineBreakTagAt(text, cursor)
  if (isEscapedAt(text, cursor)) return null
  if (code === 96) return matchInlineCodeAt(text, cursor)
  if (code === 42) return matchStarDelimiterAt(text, cursor)
  if (code === 126) return matchPairedDoubleDelimiterAt(text, cursor, 126, "del")
  if (code === 61) return matchHighlightAt(text, cursor)
  if (code === 36) return matchMathAt(text, cursor)
  if (code === 91) return matchBracketConstructAt(text, cursor)
  if (code === 123) return matchInlineColorAt(text, cursor)
  return null
}

const scanInlineMarkdownTokens = (text: string): InlineDomToken[] => {
  const tokens: InlineDomToken[] = []
  let cursor = 0
  while (cursor < text.length) {
    const token = matchInlineTokenAt(text, cursor)
    if (token && token.end > cursor) {
      tokens.push(token)
      cursor = token.end
    } else {
      cursor += 1
    }
  }
  return tokens
}

const createInlineElementForToken = (
  token: Exclude<InlineDomToken, { kind: "literal" }>,
  depth: number
): HTMLElement => {
  switch (token.kind) {
    case "code": {
      const code = document.createElement("code")
      code.className = "cm-live-inline-code"
      code.textContent = token.content
      return code
    }
    case "strong": {
      const strong = document.createElement("strong")
      appendInlineMarkdownNodes(strong, token.content, depth + 1)
      return strong
    }
    case "em": {
      const em = document.createElement("em")
      appendInlineMarkdownNodes(em, token.content, depth + 1)
      return em
    }
    case "del": {
      const del = document.createElement("del")
      del.className = "cm-live-strikethrough"
      appendInlineMarkdownNodes(del, token.content, depth + 1)
      return del
    }
    case "mark": {
      const mark = document.createElement("mark")
      mark.className = "cm-live-highlight"
      appendInlineMarkdownNodes(mark, token.content, depth + 1)
      return mark
    }
    case "math": {
      const span = document.createElement("span")
      span.className = "cm-live-math cm-live-math-inline"
      renderKatexIntoElement(span, token.math, false, token.math)
      return span
    }
    case "link": {
      const link = document.createElement("a")
      link.className = "cm-live-link"
      link.href = token.href
      link.target = "_blank"
      link.rel = "noopener noreferrer"
      appendInlineMarkdownNodes(link, token.label, depth + 1)
      return link
    }
    case "color": {
      const span = document.createElement("span")
      span.className = "cm-live-color"
      if (span.style) span.style.color = token.color
      appendInlineMarkdownNodes(span, token.content, depth + 1)
      return span
    }
    case "br":
      return document.createElement("br")
    case "wikilink": {
      const span = document.createElement("span")
      span.className = "cm-live-wikilink"
      span.textContent = token.display
      return span
    }
  }
}

export const appendInlineMarkdownNodes = (
  container: HTMLElement,
  text: string,
  depth = 0
): void => {
  if (depth > MAX_INLINE_NESTING_DEPTH || !INLINE_TRIGGER_PATTERN.test(text)) {
    container.textContent = text
    return
  }
  const tokens = scanInlineMarkdownTokens(text)
  if (!tokens.some((token) => token.kind !== "literal")) {
    container.textContent = text
    return
  }
  let textStart = 0
  for (const token of tokens) {
    if (token.kind === "literal") continue
    if (token.from > textStart) {
      container.appendChild(document.createTextNode(text.slice(textStart, token.from)))
    }
    container.appendChild(createInlineElementForToken(token, depth))
    textStart = token.end
  }
  if (textStart < text.length) {
    container.appendChild(document.createTextNode(text.slice(textStart)))
  }
}
