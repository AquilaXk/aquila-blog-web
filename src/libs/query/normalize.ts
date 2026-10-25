const isPureAscii = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 127) return false
  }
  return true
}

export const normalizeUnicode = (value: string) => {
  if (!value || isPureAscii(value)) return value
  if (typeof value.normalize !== "function") return value
  return value.normalize("NFKC")
}

const hasCollapsibleWhitespace = (value: string): boolean => {
  let prevWasSpace = false
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code === 32) {
      if (prevWasSpace) return true
      prevWasSpace = true
    } else if (code <= 13 && code >= 9) {
      return true
    } else if (code > 127 && /\s/.test(value[i])) {
      return true
    } else {
      prevWasSpace = false
    }
  }
  return false
}

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
