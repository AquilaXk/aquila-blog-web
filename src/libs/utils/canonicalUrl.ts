export const CANONICAL_URL_MAX_LENGTH = 2048

export const normalizeSafeCanonicalUrl = (raw: string | null | undefined): string => {
  const trimmed = (raw ?? "").trim()
  if (
    !trimmed ||
    trimmed.length > CANONICAL_URL_MAX_LENGTH ||
    /[\u0000-\u0020\u007f\\]/.test(trimmed)
  ) {
    return ""
  }

  const schemeEnd = trimmed.indexOf("://")
  if (schemeEnd < 0) return ""
  const scheme = trimmed.slice(0, schemeEnd).toLowerCase()
  if (scheme !== "http" && scheme !== "https") return ""

  const authorityStart = schemeEnd + 3
  let authorityEnd = trimmed.length
  for (let index = authorityStart; index < trimmed.length; index += 1) {
    const ch = trimmed.charCodeAt(index)
    if (ch === 47 || ch === 63 || ch === 35) {
      authorityEnd = index
      break
    }
  }
  if (authorityEnd <= authorityStart) return ""
  for (let index = authorityStart; index < authorityEnd; index += 1) {
    if (trimmed.charCodeAt(index) === 64) {
      return ""
    }
  }

  try {
    const parsed = new URL(trimmed)
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      return ""
    }
    return parsed.toString()
  } catch {
    return ""
  }
}
