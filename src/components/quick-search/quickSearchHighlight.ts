/**
 * Single-pass multi-token text highlighting adapted with attribution from:
 * - Quartz v4 (`jackyzha0/quartz`, MIT License) — `quartz/components/scripts/search.inline.ts`
 * - uFuzzy (`leeoniya/uFuzzy`, MIT License) — `src/uFuzzy.js` (`highlight` token matching)
 */

export type HighlightSegment = {
  text: string
  highlighted: boolean
}

const MAX_QUERY_CHARS = 200
const MAX_TOKENS = 8
const MAX_TEXT_SCAN_CHARS = 4000

const appendSortedSpan = (
  spans: Array<[number, number]>,
  start: number,
  end: number
) => {
  if (spans.length === 0) {
    spans.push([start, end])
    return
  }
  const last = spans[spans.length - 1]
  if (start <= last[1]) {
    if (end > last[1]) last[1] = end
    return
  }
  spans.push([start, end])
}

export const tokenizeHighlightTerms = (query: string): string[] => {
  const bounded = query.length > MAX_QUERY_CHARS ? query.slice(0, MAX_QUERY_CHARS) : query
  const rawParts = bounded.trim().split(/\s+/)
  if (rawParts.length === 0) return []

  const seenLower = new Set<string>()
  const tokens: string[] = []
  for (let i = 0; i < rawParts.length; i += 1) {
    const raw = rawParts[i]
    if (!raw) continue
    const lower = raw.toLowerCase()
    if (seenLower.has(lower)) continue
    seenLower.add(lower)
    tokens.push(lower)
    if (tokens.length >= MAX_TOKENS) break
  }

  // Sort longer tokens first so overlapping prefix/root matches favor full terms cleanly.
  if (tokens.length > 1) {
    tokens.sort((a, b) => b.length - a.length)
  }
  return tokens
}

export const splitHighlightSegments = (
  text: string,
  queryOrTokens: string | readonly string[]
): HighlightSegment[] => {
  if (!text) return []
  const tokens =
    typeof queryOrTokens === "string"
      ? tokenizeHighlightTerms(queryOrTokens)
      : queryOrTokens
  if (tokens.length === 0) {
    return [{ text, highlighted: false }]
  }

  const scanLimit = Math.min(text.length, MAX_TEXT_SCAN_CHARS)
  const lowerText = text.slice(0, scanLimit).toLowerCase()
  const rawSpans: Array<[number, number]> = []

  for (let tIdx = 0; tIdx < tokens.length; tIdx += 1) {
    const token = tokens[tIdx]
    if (!token) continue
    let searchFrom = 0
    while (searchFrom < scanLimit) {
      const matchIndex = lowerText.indexOf(token, searchFrom)
      if (matchIndex === -1) break
      rawSpans.push([matchIndex, matchIndex + token.length])
      searchFrom = matchIndex + token.length
    }
  }

  if (rawSpans.length === 0) {
    return [{ text, highlighted: false }]
  }

  if (rawSpans.length > 1) {
    rawSpans.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : b[1] - a[1]))
  }

  const mergedSpans: Array<[number, number]> = []
  for (let i = 0; i < rawSpans.length; i += 1) {
    appendSortedSpan(mergedSpans, rawSpans[i][0], rawSpans[i][1])
  }

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (let i = 0; i < mergedSpans.length; i += 1) {
    const [start, end] = mergedSpans[i]
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false })
    }
    segments.push({ text: text.slice(start, end), highlighted: true })
    cursor = end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }
  return segments
}
