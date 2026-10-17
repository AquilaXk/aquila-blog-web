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

const isUnicodeWhitespace = (code: number): boolean =>
  code === 0x20 ||
  (code >= 0x09 && code <= 0x0d) ||
  code === 0xa0 ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x202f ||
  code === 0x205f ||
  code === 0x3000 ||
  code === 0xfeff

export const countCodePoints = (text: string): number => {
  let count = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1
      }
    }
    count += 1
  }
  return count
}

export const countWords = (text: string): number => {
  let words = 0
  let inWord = false
  for (let index = 0; index < text.length; index += 1) {
    if (isUnicodeWhitespace(text.charCodeAt(index))) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      words += 1
    }
  }
  return words
}

const countTrimmedCodePointsAndWords = (
  text: string
): { characterCount: number; wordCount: number } => {
  let start = 0
  const len = text.length
  while (start < len && isUnicodeWhitespace(text.charCodeAt(start))) {
    start += 1
  }
  let end = len
  while (end > start && isUnicodeWhitespace(text.charCodeAt(end - 1))) {
    end -= 1
  }
  if (start >= end) {
    return { characterCount: 0, wordCount: 0 }
  }

  let characterCount = 0
  let wordCount = 0
  let inWord = false

  for (let index = start; index < end; index += 1) {
    const code = text.charCodeAt(index)
    if (isUnicodeWhitespace(code)) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      wordCount += 1
    }
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < end) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1
      }
    }
    characterCount += 1
  }

  return { characterCount, wordCount }
}

const formatMarkdownHeadingLabel = (text: string) => {
  const codeSpans: string[] = []
  return text
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
    .trim()
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

export const createMarkdownDocumentInsights = (markdown: string): MarkdownDocumentInsights => {
  const { characterCount, wordCount } = countTrimmedCodePointsAndWords(markdown)
  const headings: MarkdownDocumentHeading[] = []
  const slugAllocator = createMarkdownHeadingSlugAllocator()
  const len = markdown.length
  let lineStart = 0
  let offset = 0
  let activeFence: { marker: "`" | "~"; length: number } | null = null

  while (lineStart <= len) {
    const nextBreak = markdown.indexOf("\n", lineStart)
    const rawLineEnd = nextBreak === -1 ? len : nextBreak
    const lineEnd =
      rawLineEnd > lineStart && markdown.charCodeAt(rawLineEnd - 1) === 13
        ? rawLineEnd - 1
        : rawLineEnd
    const lineLength = lineEnd - lineStart

    let firstNonSpace = lineStart
    while (
      firstNonSpace < lineEnd &&
      firstNonSpace - lineStart < 3 &&
      (markdown.charCodeAt(firstNonSpace) === 32 || markdown.charCodeAt(firstNonSpace) === 9)
    ) {
      firstNonSpace += 1
    }

    const firstChar = firstNonSpace < lineEnd ? markdown.charCodeAt(firstNonSpace) : 0
    if (firstChar === 96 || firstChar === 126) {
      const line = markdown.slice(lineStart, lineEnd)
      const fenceMatch = FENCE_OPEN_PATTERN.exec(line)
      if (fenceMatch) {
        const fence = fenceMatch[1]
        const marker = fence[0] as "`" | "~"
        if (!activeFence) {
          activeFence = { marker, length: fence.length }
        } else if (
          activeFence.marker === marker &&
          fence.length >= activeFence.length &&
          line.slice(fenceMatch[0].length).trim() === ""
        ) {
          activeFence = null
        }
      }
    } else if (!activeFence && firstChar === 35) {
      const line = markdown.slice(lineStart, lineEnd)
      const headingMatch = ATX_HEADING_PATTERN.exec(line)
      if (headingMatch) {
        const label = formatMarkdownHeadingLabel(headingMatch[2])
        if (label) {
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
      }
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
