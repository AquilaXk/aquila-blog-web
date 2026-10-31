import { normalizePublicPostImageUrl } from "./postImageUrlPolicy"

const SAFE_RELATIVE_PROBE_ORIGIN = "https://local.invalid"

export const hasAsciiControlCharacters = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }
  return false
}

export const normalizeSafeRelativeMarkdownPath = (rawPath: string): string => {
  const candidate = rawPath.trim()
  if (!candidate || hasAsciiControlCharacters(candidate)) return ""
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return ""
  }

  try {
    const probe = new URL(candidate, SAFE_RELATIVE_PROBE_ORIGIN)
    if (
      probe.origin !== SAFE_RELATIVE_PROBE_ORIGIN ||
      probe.pathname.startsWith("//") ||
      probe.pathname.startsWith("/\\")
    ) {
      return ""
    }
    return `${probe.pathname}${probe.search}${probe.hash}`
  } catch {
    return ""
  }
}

export const normalizeSafeMarkdownUrl = (raw: string): string => {
  const value = raw.trim()
  if (!value || hasAsciiControlCharacters(value)) return ""

  if (value.startsWith("/")) {
    return normalizeSafeRelativeMarkdownPath(value)
  }

  if (value.startsWith("./") || value.startsWith("../")) {
    try {
      const probe = new URL(value, `${SAFE_RELATIVE_PROBE_ORIGIN}/dir/sub/`)
      return probe.origin === SAFE_RELATIVE_PROBE_ORIGIN ? value : ""
    } catch {
      return ""
    }
  }

  try {
    const parsed = new URL(value)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString()
    }
  } catch {
    return ""
  }

  return ""
}

export const normalizeSafeMarkdownImageSrc = (raw: string): string => normalizePublicPostImageUrl(raw)
