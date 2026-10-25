const NON_ASCII_PATTERN = /[^\u0000-\u007f]/
const COLLAPSIBLE_WHITESPACE_PATTERN = /  |[^\S ]/

const isPureAscii = (value: string): boolean => !NON_ASCII_PATTERN.test(value)

export const normalizeUnicode = (value: string) => {
  if (!value || isPureAscii(value)) return value
  if (typeof value.normalize !== "function") return value
  return value.normalize("NFKC")
}

const hasCollapsibleWhitespace = (value: string): boolean =>
  COLLAPSIBLE_WHITESPACE_PATTERN.test(value)

const collapseWhitespace = (value: string) =>
  hasCollapsibleWhitespace(value) ? value.replace(/\s+/g, " ") : value

const normalizeQueryText = (value: string) => collapseWhitespace(normalizeUnicode(value).trim())

const SPACED_QUERY_KEYS = new Set(["kw", "tag", "q"])

export const normalizeKeywordQuery = (value: string) => normalizeQueryText(value)

export const normalizeTagQuery = (value: string | null | undefined) =>
  normalizeQueryText(typeof value === "string" ? value : "")

export const normalizeOptionalTagQuery = (value: string | null | undefined) => {
  const normalized = normalizeTagQuery(value)
  return normalized || undefined
}

export const normalizeShallowRouteValue = (key: string, value: string) => {
  if (SPACED_QUERY_KEYS.has(key)) return normalizeQueryText(value)
  return normalizeUnicode(value).trim()
}
