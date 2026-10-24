export type MarkdownSourceRange = {
  start: number
  end: number
}

export type MarkdownDocumentHeading = {
  level: 1 | 2 | 3 | 4
  label: string
  offset: number
  range: MarkdownSourceRange
  slug: string
  id: string
}

export type MarkdownDocumentInsights = {
  characterCount: number
  wordCount: number
  readingMinutes: number
  headings: MarkdownDocumentHeading[]
}

const FENCE_OPEN_PATTERN = /^\s{0,3}(`{3,}|~{3,})/
const ATX_HEADING_PATTERN = /^\s{0,3}(#{1,4})\s+(.+?)(?:\s+#+)?\s*$/

const isUnicodeWhitespace = (code: number): boolean => {
  if (code <= 0x7f) {
    return code === 0x20 || (code >= 0x09 && code <= 0x0d)
  }
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  )
}

export const countCodePoints = (text: string): number => {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    if ((text.codePointAt(index) ?? 0) > 0xffff) {
      index += 1
    }
    count += 1
  }
  return count
}

export const countWords = (text: string): number =>
  countTrimmedCodePointsAndWords(text).wordCount

const findTrimmedBounds = (text: string): { start: number; end: number } => {
  let start = 0
  const len = text.length
  while (start < len && isUnicodeWhitespace(text.codePointAt(start) ?? 0)) {
    start += 1
  }
  let end = len
  while (end > start && isUnicodeWhitespace(text.codePointAt(end - 1) ?? 0)) {
    end -= 1
  }
  return { start, end }
}

const countTrimmedCodePointsAndWords = (
  text: string
): { characterCount: number; wordCount: number } => {
  const { start, end } = findTrimmedBounds(text)
  if (start >= end) {
    return { characterCount: 0, wordCount: 0 }
  }

  let characterCount = 0
  let wordCount = 0
  let inWord = false

  for (let index = start; index < end; index += 1) {
    const code = text.codePointAt(index) ?? 0
    if (isUnicodeWhitespace(code)) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      wordCount += 1
    }
    if (code > 0xffff) {
      index += 1
    }
    characterCount += 1
  }

  return { characterCount, wordCount }
}

export const hasHeadingInlineSyntax = (text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.codePointAt(index) ?? 0
    if (
      code === 0x60 ||
      code === 0x21 ||
      code === 0x5b ||
      code === 0x2a ||
      code === 0x5f ||
      code === 0x7e ||
      code === 0x5c
    ) {
      return true
    }
  }
  return false
}

const collapseAsciiWhitespace = (text: string): string => {
  let needsCollapse = false
  const len = text.length
  for (let index = 0; index < len; index += 1) {
    const code = text.codePointAt(index) ?? 0
    if (code === 0x09 || (code === 0x20 && index > 0 && text.codePointAt(index - 1) === 0x20)) {
      needsCollapse = true
      break
    }
  }
  return needsCollapse ? text.replace(/[ \t]+/g, " ").trim() : text.trim()
}

export const formatMarkdownHeadingLabel = (text: string): string => {
  if (!hasHeadingInlineSyntax(text)) {
    return collapseAsciiWhitespace(text)
  }
  const codeSpans: string[] = []
  const formatted = text
    .replace(/`([^`]+)`/g, (_, code: string) => {
      const token = `@@CODE_SPAN_${codeSpans.length}@@`
      codeSpans.push(code)
      return token
    })
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])__([^_\s](?:[^_]*[^_\s])?)__(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*[^_\s])?)_(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/@@CODE_SPAN_(\d+)@@/g, (_, index: string) => codeSpans[Number(index)] ?? "")
  return collapseAsciiWhitespace(formatted)
}

const toMarkdownHeadingSlug = (value: string) => {
  const normalized = value.trim().toLowerCase()
  const stripped = normalized.replace(/[^\p{L}\p{N}\s-]/gu, "")
  const dashed = stripped.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "")
  return dashed || "section"
}

export const createMarkdownHeadingSlugAllocator = () => {
  const usedIds = new Set<string>()
  const nextSuffixes = new Map<string, number>()

  const allocate = (label: string, existingId?: string) => {
    const base = existingId?.trim() || toMarkdownHeadingSlug(label)
    if (!usedIds.has(base)) {
      usedIds.add(base)
      nextSuffixes.set(base, 2)
      return base
    }

    let suffix = nextSuffixes.get(base) ?? 2
    while (usedIds.has(`${base}-${suffix}`)) suffix += 1
    const allocatedId = `${base}-${suffix}`
    usedIds.add(allocatedId)
    nextSuffixes.set(base, suffix + 1)
    return allocatedId
  }

  return { allocate }
}

type ActiveFenceState = { marker: "`" | "~"; length: number } | null

const updateActiveFenceState = (line: string, activeFence: ActiveFenceState): ActiveFenceState => {
  const fenceMatch = FENCE_OPEN_PATTERN.exec(line)
  if (!fenceMatch) return activeFence
  const fence = fenceMatch[1]
  const marker = fence[0] as "`" | "~"
  if (!activeFence) {
    return { marker, length: fence.length }
  }
  if (
    activeFence.marker === marker &&
    fence.length >= activeFence.length &&
    line.slice(fenceMatch[0].length).trim() === ""
  ) {
    return null
  }
  return activeFence
}

const hasAtxHeadingPrefixAt = (markdown: string, firstNonSpace: number, lineEnd: number): boolean => {
  let cursor = firstNonSpace
  while (cursor < lineEnd && cursor - firstNonSpace < 5 && markdown.codePointAt(cursor) === 0x23) {
    cursor += 1
  }
  const hashCount = cursor - firstNonSpace
  if (hashCount < 1 || hashCount > 4 || cursor >= lineEnd) return false
  const nextCode = markdown.codePointAt(cursor) ?? 0
  return nextCode === 0x20 || nextCode === 0x09
}

const appendMarkdownHeadingInsight = (
  line: string,
  offset: number,
  lineLength: number,
  slugAllocator: ReturnType<typeof createMarkdownHeadingSlugAllocator>,
  headings: MarkdownDocumentHeading[]
): void => {
  const headingMatch = ATX_HEADING_PATTERN.exec(line)
  if (!headingMatch) return
  const label = formatMarkdownHeadingLabel(headingMatch[2])
  if (!label) return
  const level = headingMatch[1].length as MarkdownDocumentHeading["level"]
  const slug = slugAllocator.allocate(label)
  const headingItem = {
    level,
    label,
    offset,
    range: { start: offset, end: offset + lineLength },
    slug,
  } as MarkdownDocumentHeading
  Object.defineProperty(headingItem, "id", {
    value: slug,
    enumerable: false,
  })
  headings.push(headingItem)
}

const findFirstNonSpaceWithinIndent = (markdown: string, lineStart: number, lineEnd: number): number => {
  let firstNonSpace = lineStart
  while (
    firstNonSpace < lineEnd &&
    firstNonSpace - lineStart < 3 &&
    (markdown.codePointAt(firstNonSpace) === 32 || markdown.codePointAt(firstNonSpace) === 9)
  ) {
    firstNonSpace += 1
  }
  return firstNonSpace
}

export const createMarkdownDocumentInsights = (markdown: string): MarkdownDocumentInsights => {
  const { characterCount, wordCount } = countTrimmedCodePointsAndWords(markdown)
  const headings: MarkdownDocumentHeading[] = []
  const slugAllocator = createMarkdownHeadingSlugAllocator()
  const len = markdown.length
  let lineStart = 0
  let offset = 0
  let activeFence: ActiveFenceState = null

  while (lineStart <= len) {
    const nextBreak = markdown.indexOf("\n", lineStart)
    const rawLineEnd = nextBreak === -1 ? len : nextBreak
    const lineEnd =
      rawLineEnd > lineStart && markdown.codePointAt(rawLineEnd - 1) === 13
        ? rawLineEnd - 1
        : rawLineEnd
    const lineLength = lineEnd - lineStart
    const firstNonSpace = findFirstNonSpaceWithinIndent(markdown, lineStart, lineEnd)
    const firstChar = firstNonSpace < lineEnd ? (markdown.codePointAt(firstNonSpace) ?? 0) : 0

    if (firstChar === 96 || firstChar === 126) {
      activeFence = updateActiveFenceState(markdown.slice(lineStart, lineEnd), activeFence)
    } else if (!activeFence && firstChar === 35 && hasAtxHeadingPrefixAt(markdown, firstNonSpace, lineEnd)) {
      appendMarkdownHeadingInsight(
        markdown.slice(lineStart, lineEnd),
        offset,
        lineLength,
        slugAllocator,
        headings
      )
    }

    offset += lineLength + 1
    if (nextBreak === -1) break
    lineStart = nextBreak + 1
  }

  return {
    characterCount,
    wordCount,
    readingMinutes: characterCount ? Math.max(1, Math.ceil(characterCount / 500)) : 0,
    headings,
  }
}
