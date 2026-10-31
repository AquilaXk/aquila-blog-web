import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"

export type HtmlPasteBypassCheckInput = {
  viewMode?: MarkdownEditorSurfaceMode
  markdown: string
  selectionFrom: number
  clipboardTypes: readonly string[]
  html: string
  plainText: string
}

type ParsedOpeningHtmlTag = {
  tag: string
  rawAttrs: string
}

type ParsedHtmlAttribute = {
  name: string
  value: string
}

const IDE_CLIPBOARD_TYPE_RE = /(?:vscode|jetbrains|code\.copy-metadata)/i

const MONOSPACE_FONT_NAMES = [
  "monospace",
  "menlo",
  "monaco",
  "consolas",
  "courier",
  "fira code",
  "jetbrains mono",
  "sf mono",
  "source code pro",
  "cascadia",
  "inconsolata",
  "d2coding",
] as const

const DOCUMENT_STRUCTURE_HTML_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "blockquote",
  "img",
])

const UNSAFE_PAYLOAD_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "svg",
  "math",
  "form",
  "base",
  "link",
  "button",
  "input",
  "select",
  "textarea",
  "template",
])

const URI_ATTRIBUTE_NAMES = new Set(["href", "src", "action", "formaction", "xlink:href"])

export const normalizeHtmlPasteText = (value: string): string => {
  const normalized = String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
  return /\S/.test(normalized) ? normalized : ""
}

const resolveInlineCodeScanBounds = (markdown: string, offset: number): { start: number; end: number } => {
  const windowRadius = 4096
  const scanStart = Math.max(0, offset - windowRadius)
  const scanEnd = Math.min(markdown.length, offset + windowRadius)
  const beforeBlank = markdown.lastIndexOf("\n\n", offset - 1)
  const afterBlank = markdown.indexOf("\n\n", offset)
  return {
    start: beforeBlank >= scanStart ? beforeBlank + 2 : scanStart,
    end: afterBlank !== -1 && afterBlank <= scanEnd ? afterBlank : scanEnd,
  }
}

const measureBacktickRun = (markdown: string, pos: number, end: number): number => {
  let len = 0
  while (pos + len < end && markdown.codePointAt(pos + len) === 96) {
    len += 1
  }
  return len
}

const hasOddPrecedingBackslashes = (markdown: string, pos: number, start: number): boolean => {
  let count = 0
  for (let b = pos - 1; b >= start && markdown.codePointAt(b) === 92; b -= 1) {
    count += 1
  }
  return count % 2 === 1
}

const findMatchingBacktickRun = (markdown: string, from: number, end: number, targetLen: number): number => {
  let j = from
  while (j < end) {
    const run = measureBacktickRun(markdown, j, end)
    if (run === 0) {
      j += 1
      continue
    }
    if (run === targetLen) return j
    j += run
  }
  return -1
}

export const isOffsetInsideInlineCodeSpan = (markdown: string, offset: number): boolean => {
  if (!markdown || offset <= 0 || offset >= markdown.length) return false
  const { start, end } = resolveInlineCodeScanBounds(markdown, offset)
  let i = start
  while (i < end) {
    const runLen = measureBacktickRun(markdown, i, end)
    if (runLen === 0 || hasOddPrecedingBackslashes(markdown, i, start)) {
      i += Math.max(1, runLen)
      continue
    }
    const openEnd = i + runLen
    const closeStart = findMatchingBacktickRun(markdown, openEnd, end, runLen)
    if (closeStart === -1) {
      i = openEnd
      continue
    }
    if (offset >= openEnd && offset <= closeStart) return true
    i = closeStart + runLen
  }
  return false
}

const isTagNameChar = (code: number | undefined): boolean =>
  code !== undefined &&
  ((code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 45 ||
    code === 58)

const findOpeningTagEnd = (html: string, start: number): number => {
  let quote = 0
  for (let i = start; i < html.length; i += 1) {
    const code = html.codePointAt(i) ?? 0
    if (quote !== 0) {
      if (code === quote) quote = 0
      continue
    }
    if (code === 34 || code === 39) {
      quote = code
      continue
    }
    if (code === 62) return i
  }
  return html.length
}

const collectOpeningHtmlTags = (html: string): ParsedOpeningHtmlTag[] => {
  const tags: ParsedOpeningHtmlTag[] = []
  let pos = 0
  while (pos < html.length) {
    const lt = html.indexOf("<", pos)
    if (lt === -1) break
    const firstCode = html.codePointAt(lt + 1)
    if (!isTagNameChar(firstCode)) {
      pos = lt + 1
      continue
    }
    const gt = findOpeningTagEnd(html, lt + 1)
    let nameEnd = lt + 1
    while (nameEnd < gt && isTagNameChar(html.codePointAt(nameEnd))) {
      nameEnd += 1
    }
    tags.push({
      tag: html.slice(lt + 1, nameEnd).toLowerCase(),
      rawAttrs: html.slice(nameEnd, gt),
    })
    pos = gt + 1
  }
  return tags
}

const skipAttrSeparators = (raw: string, start: number): number => {
  let i = start
  while (i < raw.length) {
    const code = raw.codePointAt(i) ?? 0
    if (code > 32 && code !== 47) break
    i += 1
  }
  return i
}

const skipAsciiWhitespace = (raw: string, start: number): number => {
  let i = start
  while (i < raw.length && (raw.codePointAt(i) ?? 0) <= 32) {
    i += 1
  }
  return i
}

const readAttrValue = (raw: string, start: number): { value: string; nextIndex: number } => {
  const quote = raw.codePointAt(start)
  if (quote === 34 || quote === 39) {
    const closeIdx = raw.indexOf(quote === 34 ? '"' : "'", start + 1)
    if (closeIdx === -1) return { value: raw.slice(start + 1), nextIndex: raw.length }
    return { value: raw.slice(start + 1, closeIdx), nextIndex: closeIdx + 1 }
  }
  let end = start
  while (end < raw.length && (raw.codePointAt(end) ?? 0) > 32) {
    end += 1
  }
  return { value: raw.slice(start, end), nextIndex: end }
}

const parseHtmlAttributes = (rawAttrs: string): ParsedHtmlAttribute[] => {
  const attrs: ParsedHtmlAttribute[] = []
  let i = 0
  while (i < rawAttrs.length) {
    i = skipAttrSeparators(rawAttrs, i)
    if (i >= rawAttrs.length) break
    const nameStart = i
    while (i < rawAttrs.length) {
      const code = rawAttrs.codePointAt(i) ?? 0
      if (code <= 32 || code === 61 || code === 47) break
      i += 1
    }
    const name = rawAttrs.slice(nameStart, i).toLowerCase()
    i = skipAsciiWhitespace(rawAttrs, i)
    if (rawAttrs.codePointAt(i) !== 61) {
      if (name) attrs.push({ name, value: "" })
      continue
    }
    i = skipAsciiWhitespace(rawAttrs, i + 1)
    const parsed = readAttrValue(rawAttrs, i)
    if (name) attrs.push({ name, value: parsed.value })
    i = parsed.nextIndex
  }
  return attrs
}

const collectStyleDeclarationsFromValue = (
  styleValue: string,
  declarations: Array<{ prop: string; val: string }>
) => {
  for (const chunk of styleValue.split(";")) {
    const colon = chunk.indexOf(":")
    if (colon <= 0) continue
    declarations.push({
      prop: chunk.slice(0, colon).trim().toLowerCase(),
      val: chunk.slice(colon + 1).trim().toLowerCase().replace(/\s+/g, " "),
    })
  }
}

const collectStyleDeclarations = (
  tags: readonly ParsedOpeningHtmlTag[]
): Array<{ prop: string; val: string }> => {
  const declarations: Array<{ prop: string; val: string }> = []
  for (const entry of tags) {
    for (const attr of parseHtmlAttributes(entry.rawAttrs)) {
      if (attr.name === "style" && attr.value) {
        collectStyleDeclarationsFromValue(attr.value, declarations)
      }
    }
  }
  return declarations
}

const isFontIdentifierChar = (code: number | undefined): boolean =>
  code !== undefined && ((code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45)

const containsBoundedToken = (haystack: string, token: string): boolean => {
  let pos = 0
  while (pos <= haystack.length - token.length) {
    const idx = haystack.indexOf(token, pos)
    if (idx === -1) return false
    const beforeOk = idx === 0 || !isFontIdentifierChar(haystack.codePointAt(idx - 1))
    const afterIdx = idx + token.length
    const afterOk = afterIdx >= haystack.length || !isFontIdentifierChar(haystack.codePointAt(afterIdx))
    if (beforeOk && afterOk) return true
    pos = idx + 1
  }
  return false
}

export const hasMonospacePreStyle = (html: string): boolean =>
  collectStyleDeclarations(collectOpeningHtmlTags(html)).some(({ prop, val }) => {
    if (prop !== "white-space") return false
    const token = val.split(/[\s!]/)[0] ?? ""
    return token === "pre" || token === "pre-wrap"
  })

export const hasMonospaceFontStyle = (html: string): boolean =>
  collectStyleDeclarations(collectOpeningHtmlTags(html)).some(
    ({ prop, val }) =>
      (prop === "font-family" || prop === "font") &&
      MONOSPACE_FONT_NAMES.some((fontName) => containsBoundedToken(val, fontName))
  )

export const hasDocumentStructureHtmlTag = (html: string): boolean =>
  collectOpeningHtmlTags(html).some(({ tag }) => DOCUMENT_STRUCTURE_HTML_TAGS.has(tag))

const hasDangerousUriProtocol = (rawValue: string): boolean => {
  let cleaned = ""
  for (let i = 0; i < rawValue.length; i += 1) {
    const code = rawValue.codePointAt(i) ?? 0
    if (code > 32 && code !== 127) cleaned += rawValue[i]
  }
  const lower = cleaned.toLowerCase()
  return lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")
}

const isInlineEventHandlerAttr = (name: string): boolean => {
  if (name.length <= 2 || !name.startsWith("on")) return false
  for (let i = 2; i < name.length; i += 1) {
    const code = name.codePointAt(i) ?? 0
    if (code < 97 || code > 122) return false
  }
  return true
}

const hasUnsafeOpeningTagEntry = (entry: ParsedOpeningHtmlTag): boolean => {
  if (UNSAFE_PAYLOAD_TAGS.has(entry.tag)) return true
  const attrs = parseHtmlAttributes(entry.rawAttrs)
  if (entry.tag === "meta" && attrs.some((a) => a.name === "http-equiv")) return true
  if (attrs.some((a) => isInlineEventHandlerAttr(a.name))) return true
  return attrs.some((a) => URI_ATTRIBUTE_NAMES.has(a.name) && hasDangerousUriProtocol(a.value))
}

export const hasUnsafeActiveHtmlPayload = (html: string): boolean =>
  collectOpeningHtmlTags(html).some(hasUnsafeOpeningTagEntry)

export const shouldBypassHtmlPasteConversion = ({
  viewMode,
  markdown,
  selectionFrom,
  clipboardTypes,
  html,
  plainText,
}: HtmlPasteBypassCheckInput): boolean => {
  if (viewMode === "source" || viewMode === "reading") return true
  if (isOffsetInsideFencedCodeBlock(markdown, selectionFrom)) return true
  if (isOffsetInsideInlineCodeSpan(markdown, selectionFrom)) return true
  if (!plainText) return false
  if (clipboardTypes.some((type) => IDE_CLIPBOARD_TYPE_RE.test(type))) return true
  return hasMonospacePreStyle(html) && hasMonospaceFontStyle(html) && !hasDocumentStructureHtmlTag(html)
}

export const shouldReportEmptyHtmlPasteError = (html: string, plainText: string): boolean => {
  if (hasUnsafeActiveHtmlPayload(html)) return true
  return !normalizeHtmlPasteText(plainText)
}
