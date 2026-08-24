import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type MarkdownEditorTextRange = {
  start: number
  end: number
}

export type MarkdownEditorFindOptions = {
  caseSensitive?: boolean
  scope?: MarkdownEditorTextRange
}

export type MarkdownEditorFindDirection = "next" | "previous"

type MarkdownEditorReplaceCurrentOptions = MarkdownEditorFindOptions & {
  match: MarkdownEditorTextRange
}

type MarkdownEditorReplaceResult = {
  mutation: PlannedTextMutation
  scope?: MarkdownEditorTextRange
}

type MarkdownEditorReplaceAllResult = MarkdownEditorReplaceResult & {
  count: number
}

const clampOffset = (offset: number, length: number) => Math.max(0, Math.min(offset, length))

const normalizeScope = (
  value: string,
  scope?: MarkdownEditorTextRange
): MarkdownEditorTextRange | null => {
  if (!scope) return { start: 0, end: value.length }
  if (!Number.isInteger(scope.start) || !Number.isInteger(scope.end)) return null

  const start = clampOffset(scope.start, value.length)
  const end = clampOffset(scope.end, value.length)
  return start <= end ? { start, end } : null
}

const caseInsensitiveSearchCollator = new Intl.Collator("en", { usage: "search", sensitivity: "accent" })

const matchesQuery = (candidate: string, query: string, caseSensitive: boolean) =>
  caseSensitive ? candidate === query : caseInsensitiveSearchCollator.compare(candidate, query) === 0

export const findMarkdownEditorMatches = (
  value: string,
  query: string,
  options: MarkdownEditorFindOptions = {}
): MarkdownEditorTextRange[] => {
  if (query === "") return []
  const scope = normalizeScope(value, options.scope)
  if (!scope || query.length > scope.end - scope.start) return []

  const matches: MarkdownEditorTextRange[] = []
  for (let start = scope.start; start <= scope.end - query.length; ) {
    const end = start + query.length
    if (matchesQuery(value.slice(start, end), query, options.caseSensitive === true)) {
      matches.push({ start, end })
      start = end
      continue
    }
    start += 1
  }
  return matches
}

export const selectMarkdownEditorMatch = (
  value: string,
  query: string,
  selectionStart: number,
  selectionEnd: number,
  direction: MarkdownEditorFindDirection,
  options: MarkdownEditorFindOptions = {}
): MarkdownEditorTextRange | null => {
  if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) return null
  const matches = findMarkdownEditorMatches(value, query, options)
  if (matches.length === 0) return null

  const start = clampOffset(selectionStart, value.length)
  const end = clampOffset(selectionEnd, value.length)
  if (start > end) return null

  const currentIndex = matches.findIndex((match) => match.start === start && match.end === end)
  if (currentIndex !== -1) {
    const offset = direction === "next" ? 1 : -1
    return matches[(currentIndex + offset + matches.length) % matches.length]!
  }

  if (direction === "next") {
    return matches.find((match) => match.start >= end) ?? matches[0]!
  }

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    if (matches[index]!.end <= start) return matches[index]!
  }
  return matches[matches.length - 1]!
}

const containsMatch = (scope: MarkdownEditorTextRange, match: MarkdownEditorTextRange) =>
  scope.start <= match.start && match.end <= scope.end

const adjustedScope = (
  scope: MarkdownEditorTextRange | undefined,
  match: MarkdownEditorTextRange,
  replacement: string
): MarkdownEditorTextRange | undefined => {
  if (!scope) return undefined
  return { start: scope.start, end: scope.end + replacement.length - (match.end - match.start) }
}

export const planMarkdownEditorReplaceCurrent = (
  value: string,
  query: string,
  replacement: string,
  options: MarkdownEditorReplaceCurrentOptions
): MarkdownEditorReplaceResult | null => {
  if (query === "") return null
  const scope = normalizeScope(value, options.scope)
  const match = options.match
  if (
    !scope ||
    !Number.isInteger(match.start) ||
    !Number.isInteger(match.end) ||
    match.start < 0 ||
    match.end > value.length ||
    match.end - match.start !== query.length ||
    !containsMatch(scope, match) ||
    !matchesQuery(value.slice(match.start, match.end), query, options.caseSensitive === true)
  ) {
    return null
  }

  return {
    mutation: {
      rangeStart: match.start,
      rangeEnd: match.end,
      replacement,
      selectionStart: match.start,
      selectionEnd: match.start + replacement.length,
    },
    ...(options.scope ? { scope: adjustedScope(scope, match, replacement) } : {}),
  }
}

export const planMarkdownEditorReplaceAll = (
  value: string,
  query: string,
  replacement: string,
  options: MarkdownEditorFindOptions = {}
): MarkdownEditorReplaceAllResult | null => {
  const scope = normalizeScope(value, options.scope)
  if (!scope) return null
  const matches = findMarkdownEditorMatches(value, query, { ...options, scope })
  if (matches.length === 0) return null

  let cursor = scope.start
  let nextScope = ""
  for (const match of matches) {
    nextScope += value.slice(cursor, match.start)
    nextScope += replacement
    cursor = match.end
  }
  nextScope += value.slice(cursor, scope.end)

  const nextEnd = scope.start + nextScope.length
  return {
    mutation: {
      rangeStart: scope.start,
      rangeEnd: scope.end,
      replacement: nextScope,
      selectionStart: scope.start,
      selectionEnd: nextEnd,
    },
    count: matches.length,
    ...(options.scope ? { scope: { start: scope.start, end: nextEnd } } : {}),
  }
}
