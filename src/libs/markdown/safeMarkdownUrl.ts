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

const hasPathTraversalSegment = (value: string): boolean => {
  const pathPart = value.split(/[?#]/, 1)[0] ?? ""
  return pathPart.split("/").includes("..")
}

const hasDotSegment = (segments: readonly string[]): boolean =>
  segments.includes(".") || segments.includes("..")

const isSafeDecodedRelativePathPart = (value: string, allowDotSegments: boolean): boolean => {
  const pathPart = value.split(/[?#]/, 1)[0] ?? ""
  try {
    const decoded = decodeURIComponent(pathPart)
    if (hasAsciiControlCharacters(decoded) || decoded.includes("\\") || decoded.includes("//")) {
      return false
    }
    if (!allowDotSegments && hasPathTraversalSegment(decoded)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export const normalizeSafeRelativeMarkdownPath = (rawPath: string): string => {
  const candidate = rawPath.trim()
  if (!candidate || hasAsciiControlCharacters(candidate) || candidate.includes("\\")) {
    return ""
  }
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    hasPathTraversalSegment(candidate) ||
    !isSafeDecodedRelativePathPart(candidate, false)
  ) {
    return ""
  }

  try {
    const probe = new URL(candidate, SAFE_RELATIVE_PROBE_ORIGIN)
    if (probe.origin !== SAFE_RELATIVE_PROBE_ORIGIN || probe.pathname.startsWith("//")) {
      return ""
    }
    return `${probe.pathname}${probe.search}${probe.hash}`
  } catch {
    return ""
  }
}

const isAllowedDotRelativeRest = (rest: string, requireNonEmpty: boolean): boolean => {
  if (requireNonEmpty && rest.length === 0) return false
  if (hasDotSegment(rest.split("/"))) return false
  return !hasDotSegment(decodeURIComponent(rest).split("/"))
}

const normalizeSafeDotRelativePath = (value: string): string => {
  const pathPart = value.split(/[?#]/, 1)[0] ?? ""
  if (
    pathPart.includes("//") ||
    value.includes("\\") ||
    /%2e/i.test(pathPart) ||
    !isSafeDecodedRelativePathPart(value, true)
  ) {
    return ""
  }
  const isCurrentDir = value.startsWith("./")
  const isParentDir = !isCurrentDir && value.startsWith("../")
  if (!isCurrentDir && !isParentDir) return ""
  const rest = isCurrentDir ? pathPart.slice(2) : pathPart.slice(3)
  if (!isAllowedDotRelativeRest(rest, isParentDir)) return ""

  try {
    const probe = new URL(value, `${SAFE_RELATIVE_PROBE_ORIGIN}/posts/`)
    if (probe.origin !== SAFE_RELATIVE_PROBE_ORIGIN || probe.pathname.startsWith("//")) {
      return ""
    }
    return isCurrentDir ? `./${value.slice(2)}` : `../${value.slice(3)}`
  } catch {
    return ""
  }
}

export const normalizeSafeMarkdownUrl = (raw: string): string => {
  const value = raw.trim()
  if (!value || hasAsciiControlCharacters(value) || value.includes("\\")) return ""

  if (value.startsWith("/")) {
    return normalizeSafeRelativeMarkdownPath(value)
  }

  if (value.startsWith("./") || value.startsWith("../")) {
    return normalizeSafeDotRelativePath(value)
  }

  try {
    const parsed = new URL(value)
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    ) {
      return parsed.toString()
    }
  } catch {
    return ""
  }

  return ""
}

const normalizeSafeHashHref = (value: string): string => {
  try {
    const parsed = new URL(value, SAFE_RELATIVE_PROBE_ORIGIN)
    if (parsed.origin !== SAFE_RELATIVE_PROBE_ORIGIN) return ""
    return value === "#" ? "#" : `#${value.slice(1)}`
  } catch {
    return ""
  }
}

const normalizeSafeMailtoHref = (value: string): string => {
  if (value.length <= 7) return ""
  try {
    const parsed = new URL(value)
    return parsed.protocol === "mailto:" && parsed.pathname.trim().length > 0
      ? parsed.toString()
      : ""
  } catch {
    return ""
  }
}

export const normalizeSafeMarkdownLinkHref = (raw: string): string => {
  const value = raw.trim()
  if (!value || hasAsciiControlCharacters(value) || value.includes("\\")) return ""
  if (value.startsWith("#")) return normalizeSafeHashHref(value)
  if (value.toLowerCase().startsWith("mailto:")) return normalizeSafeMailtoHref(value)
  return normalizeSafeMarkdownUrl(value)
}

export const setSafeAnchorHref = (anchor: HTMLAnchorElement, rawHref: string): string => {
  const normalizedHref = normalizeSafeMarkdownLinkHref(rawHref)
  if (!normalizedHref) return ""
  const safeHref = normalizedHref.replace(
    /[<>"']/g,
    (ch) => `%${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
  )
  anchor.setAttribute("href", safeHref)
  return safeHref
}

export const normalizeSafeMarkdownImageSrc = (raw: string): string => normalizePublicPostImageUrl(raw)
