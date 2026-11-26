import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"

export type MarkdownInlineLinkHit = {
  from: number
  to: number
  label: string
  url: string
}

const findInlineCodeSpans = (line: string): Array<{ from: number; to: number }> => {
  const spans: Array<{ from: number; to: number }> = []
  let i = 0
  while (i < line.length) {
    if (line.charCodeAt(i) !== 96) { // '`'
      i += 1
      continue
    }
    let tickLen = 0
    while (i + tickLen < line.length && line.charCodeAt(i + tickLen) === 96) tickLen += 1
    let search = i + tickLen
    let closedAt = -1
    while (search < line.length) {
      if (line.charCodeAt(search) !== 96) {
        search += 1
        continue
      }
      let closeLen = 0
      while (search + closeLen < line.length && line.charCodeAt(search + closeLen) === 96) {
        closeLen += 1
      }
      if (closeLen === tickLen) {
        closedAt = search + closeLen
        break
      }
      search += closeLen
    }
    if (closedAt !== -1) {
      spans.push({ from: i, to: closedAt })
      i = closedAt
    } else {
      i += tickLen
    }
  }
  return spans
}

const isInsideSpans = (pos: number, spans: readonly { from: number; to: number }[]) =>
  spans.some((span) => pos >= span.from && pos < span.to)

const isEscapedAt = (text: string, idx: number): boolean => {
  let slashes = 0
  let cur = idx - 1
  while (cur >= 0 && text.charCodeAt(cur) === 92) { // '\\'
    slashes += 1
    cur -= 1
  }
  return (slashes & 1) === 1
}

export const findMarkdownLinkAtOffset = (
  markdown: string,
  offset: number
): MarkdownInlineLinkHit | null => {
  if (!markdown || offset < 0 || offset > markdown.length) return null
  if (isOffsetInsideFencedCodeBlock(markdown, offset)) return null

  const lineStart = offset > 0 ? markdown.lastIndexOf("\n", offset - 1) + 1 : 0
  const nextBreak = markdown.indexOf("\n", offset)
  const lineEnd = nextBreak === -1 ? markdown.length : nextBreak
  const line = markdown.slice(lineStart, lineEnd)
  if (!line.includes("](")) return null

  const relOffset = offset - lineStart
  const codeSpans = line.includes("`") ? findInlineCodeSpans(line) : []
  if (isInsideSpans(relOffset, codeSpans)) return null

  let pos = 0
  while (pos < line.length) {
    const openBracket = line.indexOf("[", pos)
    if (openBracket === -1) break
    if (
      (openBracket > 0 && line.charCodeAt(openBracket - 1) === 33) || // '!'
      isEscapedAt(line, openBracket) ||
      isInsideSpans(openBracket, codeSpans)
    ) {
      pos = openBracket + 1
      continue
    }
    if (line.charCodeAt(openBracket + 1) === 91) { // '[[' wikilink
      pos = openBracket + 2
      continue
    }
    let closeBracket = openBracket + 1
    let bracketDepth = 1
    while (closeBracket < line.length && bracketDepth > 0) {
      const ch = line.charCodeAt(closeBracket)
      if (ch === 92) {
        closeBracket += 2
        continue
      }
      if (ch === 91) bracketDepth += 1
      else if (ch === 93) bracketDepth -= 1
      if (bracketDepth > 0) closeBracket += 1
    }
    if (bracketDepth !== 0 || line.charCodeAt(closeBracket + 1) !== 40) { // '('
      pos = openBracket + 1
      continue
    }
    const label = line.slice(openBracket + 1, closeBracket)
    if (label.startsWith("^") && closeBracket === line.length - 1) {
      pos = openBracket + 1
      continue
    }

    let cursor = closeBracket + 2
    let parenDepth = 1
    while (cursor < line.length && parenDepth > 0) {
      const ch = line.charCodeAt(cursor)
      if (ch === 92) {
        cursor += 2
        continue
      }
      if (ch === 40) parenDepth += 1
      else if (ch === 41) parenDepth -= 1
      if (parenDepth > 0) cursor += 1
    }
    if (parenDepth !== 0) {
      pos = openBracket + 1
      continue
    }
    const matchEnd = cursor + 1
    if (relOffset >= openBracket && relOffset <= matchEnd && !isInsideSpans(closeBracket, codeSpans)) {
      const destRaw = line.slice(closeBracket + 2, cursor).trim()
      const unwrapped = destRaw.startsWith("<") && destRaw.endsWith(">")
        ? destRaw.slice(1, -1).trim()
        : destRaw.replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, "").trim()
      return {
        from: lineStart + openBracket,
        to: lineStart + matchEnd,
        label,
        url: unwrapped,
      }
    }
    pos = matchEnd
  }
  return null
}

export const readVisualViewportBounds = () => {
  if (typeof window === "undefined") {
    return { offsetLeft: 0, offsetTop: 0, width: 1280, height: 800, right: 1280, bottom: 800 }
  }
  const vv = window.visualViewport
  const offsetLeft = vv?.offsetLeft ?? 0
  const offsetTop = vv?.offsetTop ?? 0
  const width = vv?.width ?? window.innerWidth
  const height = vv?.height ?? window.innerHeight
  return {
    offsetLeft,
    offsetTop,
    width,
    height,
    right: offsetLeft + width,
    bottom: offsetTop + height,
  }
}

export const clampBoxToVisualViewport = (
  top: number,
  left: number,
  boxWidth: number,
  boxHeight: number
): { top: number; left: number } => {
  const vp = readVisualViewportBounds()
  const maxLeft = Math.max(vp.offsetLeft + 12, vp.right - boxWidth - 12)
  const maxTop = Math.max(vp.offsetTop + 12, vp.bottom - boxHeight - 12)
  return {
    left: Math.round(Math.max(vp.offsetLeft + 12, Math.min(left, maxLeft))),
    top: Math.round(Math.max(vp.offsetTop + 12, Math.min(top, maxTop))),
  }
}
