export type MarkdownSourceRange = {
  start: number
  end: number
}

export type MarkdownDocumentHeading = {
  level: 2 | 3 | 4
  label: string
  offset: number
  range: MarkdownSourceRange
  slug: string
}

export type MarkdownDocumentInsights = {
  characterCount: number
  wordCount: number
  readingMinutes: number
  headings: MarkdownDocumentHeading[]
}

const FENCE_OPEN_PATTERN = /^\s{0,3}(`{3,}|~{3,})/
const ATX_HEADING_PATTERN = /^\s{0,3}(#{2,4})\s+(.+?)(?:\s+#+)?\s*$/

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
  const body = markdown.trim()
  const characterCount = Array.from(body).length
  const wordCount = body ? body.split(/\s+/u).length : 0
  const headings: MarkdownDocumentHeading[] = []
  const slugAllocator = createMarkdownHeadingSlugAllocator()
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  let offset = 0
  let activeFence: { marker: "`" | "~"; length: number } | null = null

  for (const line of lines) {
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
    } else if (!activeFence) {
      const headingMatch = ATX_HEADING_PATTERN.exec(line)
      if (headingMatch) {
        const label = formatMarkdownHeadingLabel(headingMatch[2])
        if (label) {
          const level = headingMatch[1].length as MarkdownDocumentHeading["level"]
          headings.push({
            level,
            label,
            offset,
            range: { start: offset, end: offset + line.length },
            slug: slugAllocator.allocate(label),
          })
        }
      }
    }
    offset += line.length + 1
  }

  return {
    characterCount,
    wordCount,
    readingMinutes: characterCount ? Math.max(1, Math.ceil(characterCount / 500)) : 0,
    headings,
  }
}
