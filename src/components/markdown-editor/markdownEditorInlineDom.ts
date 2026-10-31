import { resolveInlineColorValue } from "../../libs/markdown/inlineColor"
import {
  findBacktickAwareDoubleCloseBrace,
  matchDoubleBraceColorHeader,
} from "../../libs/markdown/inlineTokenScanners"
import {
  countCodePointRun,
  isEscapedMarkdownAt,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
} from "../../libs/markdown/pandocMathScanner"
import {
  normalizeSafeMarkdownLinkHref,
  setSafeAnchorHref,
} from "../../libs/markdown/safeMarkdownUrl"

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
const INLINE_TRIGGER_PATTERN = /[`*~=$[{<]/
const SINGLE_WHITESPACE_PATTERN = /^\s$/u

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

const applyKatexRender = (
  runtime: KatexRuntime,
  element: HTMLElement,
  math: string,
  displayMode: boolean
): boolean => {
  try {
    element.innerHTML = runtime.renderToString(math, { displayMode, throwOnError: false })
    return true
  } catch {
    return false
  }
}

export const renderKatexIntoElement = (
  element: HTMLElement,
  math: string,
  displayMode: boolean,
  fallbackText: string
): void => {
  const katex = getKatex()
  if (katex && applyKatexRender(katex, element, math, displayMode)) {
    return
  }
  if (!katex && katexLoadPromise) {
    void katexLoadPromise.then((loaded) => {
      if (loaded) applyKatexRender(loaded, element, math, displayMode)
    })
  }
  element.textContent = fallbackText
}

export const isSafeInlineHref = (href: string): boolean =>
  normalizeSafeMarkdownLinkHref(href).length > 0

const isNewlineCode = (code: number): boolean => code === 10 || code === 13

const isWhitespaceAt = (text: string, index: number): boolean => {
  const ch = text[index]
  return ch !== undefined && SINGLE_WHITESPACE_PATTERN.test(ch)
}

const findInlineLineEnd = (text: string, from: number): number => {
  let end = text.length
  const nlIndex = text.indexOf("\n", from)
  if (nlIndex >= 0 && nlIndex < end) end = nlIndex
  const crIndex = text.indexOf("\r", from)
  if (crIndex >= 0 && crIndex < end) end = crIndex
  return end
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
  const runLen = countCodePointRun(text, from, 96)
  const lineEnd = findInlineLineEnd(text, from)
  const closeEnd = scanInlineCodeSpanEnd(text, from, lineEnd)
  if (closeEnd > 0) {
    const rawContent = text.slice(from + runLen, closeEnd - runLen)
    return { kind: "code", from, end: closeEnd, content: normalizeCodeSpanContent(rawContent, runLen) }
  }
  if (runLen > 1) {
    return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
  }
  return null
}

const isClosingDoubleDelimiterAt = (
  text: string,
  pos: number,
  markerCode: number
): boolean =>
  text.codePointAt(pos) === markerCode &&
  text.codePointAt(pos + 1) === markerCode &&
  text.codePointAt(pos + 2) !== markerCode &&
  !isEscapedMarkdownAt(text, pos) &&
  !isWhitespaceAt(text, pos - 1)

const findClosingDoubleDelimiter = (
  text: string,
  innerStart: number,
  markerCode: number
): number => {
  for (let pos = innerStart; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (isNewlineCode(code)) return -1
    if (isClosingDoubleDelimiterAt(text, pos, markerCode)) return pos
  }
  return -1
}

const matchPairedDoubleDelimiterAt = (
  text: string,
  from: number,
  markerCode: number,
  kind: "strong" | "del"
): InlineDomToken | null => {
  const runLen = countCodePointRun(text, from, markerCode)
  if (runLen !== 2) {
    return runLen > 2
      ? { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
      : null
  }
  const innerStart = from + 2
  const firstCode = text.codePointAt(innerStart) ?? 0
  if (!firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, innerStart)) {
    return { kind: "literal", from, end: innerStart, raw: text.slice(from, innerStart) }
  }
  const closePos = findClosingDoubleDelimiter(text, innerStart, markerCode)
  if (closePos >= innerStart) {
    return { kind, from, end: closePos + 2, content: text.slice(innerStart, closePos) }
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
    if (code === 42 && !isEscapedMarkdownAt(text, pos)) {
      const closeRun = countCodePointRun(text, pos, 42)
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

const matchStarDelimiterAt = (text: string, from: number): InlineDomToken | null =>
  text.codePointAt(from + 1) === 42
    ? matchPairedDoubleDelimiterAt(text, from, 42, "strong")
    : matchEmphasisAt(text, from)

const isClosingHighlightAt = (text: string, index: number): boolean =>
  text.codePointAt(index) === 61 &&
  text.codePointAt(index + 1) === 61 &&
  text.codePointAt(index - 1) !== 61 &&
  !isWhitespaceAt(text, index - 1) &&
  text.codePointAt(index + 2) !== 61 &&
  !isEscapedMarkdownAt(text, index)

const findClosingInlineHighlight = (text: string, innerStart: number): number => {
  const lineEnd = findInlineLineEnd(text, innerStart)
  let pos = innerStart + 1
  while (pos + 1 < lineEnd) {
    const code = text.codePointAt(pos) ?? 0
    if (code === 96 && !isEscapedMarkdownAt(text, pos)) {
      const codeEnd = scanInlineCodeSpanEnd(text, pos, lineEnd)
      pos = codeEnd > pos ? codeEnd : pos + countCodePointRun(text, pos, 96)
      continue
    }
    if (code === 61 && isClosingHighlightAt(text, pos)) return pos
    pos += 1
  }
  return -1
}

const matchHighlightAt = (text: string, from: number): InlineDomToken | null => {
  const runLen = countCodePointRun(text, from, 61)
  if (runLen !== 2) {
    return runLen > 2
      ? { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
      : null
  }
  const innerStart = from + 2
  const firstCode = text.codePointAt(innerStart) ?? 0
  if (from + 3 >= text.length || !firstCode || isNewlineCode(firstCode) || isWhitespaceAt(text, innerStart)) {
    return { kind: "literal", from, end: innerStart, raw: "==" }
  }
  const closePos = findClosingInlineHighlight(text, innerStart)
  if (closePos > innerStart) {
    const content = text.slice(innerStart, closePos)
    if (content.trim().length > 0) {
      return { kind: "mark", from, end: closePos + 2, content }
    }
  }
  return { kind: "literal", from, end: innerStart, raw: "==" }
}

const matchMathAt = (text: string, from: number): InlineDomToken | null => {
  const runLen = countCodePointRun(text, from, 36)
  if (runLen > 2) {
    return { kind: "literal", from, end: from + runLen, raw: text.slice(from, from + runLen) }
  }
  if (runLen === 2) {
    const display = scanPandocDisplayMathAt(text, from, { singleLineOnly: true })
    return display
      ? { kind: "math", from, end: display.to, math: display.math }
      : { kind: "literal", from, end: from + 2, raw: "$$" }
  }
  const inline = scanPandocInlineMathAt(text, from)
  return inline ? { kind: "math", from, end: inline.to, math: inline.math } : null
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
    if (code === 91 && !isEscapedMarkdownAt(text, pos)) return -1
    if (code === 93 && !isEscapedMarkdownAt(text, pos)) return pos
  }
  return -1
}

const findClosingLinkParen = (text: string, start: number): number => {
  let depth = 1
  for (let pos = start; pos < text.length; pos += 1) {
    const code = text.codePointAt(pos) ?? 0
    if (code <= 32) return -1
    if (isEscapedMarkdownAt(text, pos)) continue
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
  return { kind: "link", from, end: closeParen + 1, label, href }
}

const matchBracketConstructAt = (text: string, from: number): InlineDomToken | null =>
  text.codePointAt(from + 1) === 91 ? matchWikilinkAt(text, from) : matchMarkdownLinkAt(text, from)

const matchInlineColorAt = (text: string, from: number): InlineDomToken | null => {
  if (text.codePointAt(from + 1) !== 123) return null
  const header = matchDoubleBraceColorHeader(text, from)
  if (!header) return null
  const closeBrace = findBacktickAwareDoubleCloseBrace(text, header.contentStart, true)
  if (closeBrace < 0) return null
  const content = text.slice(header.contentStart, closeBrace).trim()
  if (!content) return null
  const end = closeBrace + 2
  const color = resolveInlineColorValue(header.colorToken)
  if (color) {
    return { kind: "color", from, end, color, content }
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
  if (isEscapedMarkdownAt(text, cursor)) return null
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

const createInlineLinkElement = (
  token: Extract<InlineDomToken, { kind: "link" }>,
  depth: number
): HTMLElement => {
  const link = document.createElement("a")
  const safeHref = setSafeAnchorHref(link, token.href)
  if (!safeHref) {
    const fallback = document.createElement("span")
    appendInlineMarkdownNodes(fallback, token.label, depth + 1)
    return fallback
  }
  link.className = "cm-live-link"
  if (safeHref.startsWith("http://") || safeHref.startsWith("https://")) {
    link.target = "_blank"
    link.rel = "noopener noreferrer"
  }
  appendInlineMarkdownNodes(link, token.label, depth + 1)
  return link
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
    case "link":
      return createInlineLinkElement(token, depth)
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
