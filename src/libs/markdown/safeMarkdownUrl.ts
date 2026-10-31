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
  return pathPart.split("/").some((segment) => segment === "..")
}

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

const normalizeSafeDotRelativePath = (value: string): string => {
  if (value.includes("//") || value.includes("\\") || !isSafeDecodedRelativePathPart(value, true)) {
    return ""
  }
  try {
    const probe = new URL(value, `${SAFE_RELATIVE_PROBE_ORIGIN}/dir/sub/`)
    if (probe.origin !== SAFE_RELATIVE_PROBE_ORIGIN || probe.pathname.startsWith("//")) {
      return ""
    }
    return value
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

export const normalizeSafeMarkdownLinkHref = (raw: string): string => {
  const value = raw.trim()
  if (!value || hasAsciiControlCharacters(value) || value.includes("\\")) return ""

  if (value.startsWith("#")) {
    try {
      const parsed = new URL(value, SAFE_RELATIVE_PROBE_ORIGIN)
      return parsed.origin === SAFE_RELATIVE_PROBE_ORIGIN ? parsed.hash : ""
    } catch {
      return ""
    }
  }

  if (value.toLowerCase().startsWith("mailto:") && value.length > 7) {
    try {
      const parsed = new URL(value)
      return parsed.protocol === "mailto:" && parsed.pathname.trim().length > 0
        ? parsed.toString()
        : ""
    } catch {
      return ""
    }
  }

  return normalizeSafeMarkdownUrl(value)
}

export const setSafeAnchorHref = (anchor: HTMLAnchorElement, rawHref: string): string => {
  const safeHref = normalizeSafeMarkdownLinkHref(rawHref)
  if (
    !safeHref ||
    !(
      safeHref.startsWith("https://") ||
      safeHref.startsWith("http://") ||
      safeHref.startsWith("mailto:") ||
      safeHref.startsWith("/") ||
      safeHref.startsWith("#") ||
      safeHref.startsWith("./") ||
      safeHref.startsWith("../")
    ) ||
    safeHref.startsWith("//")
  ) {
    return ""
  }
  anchor.setAttribute("href", safeHref)
  return safeHref
}

export const normalizeSafeMarkdownImageSrc = (raw: string): string => normalizePublicPostImageUrl(raw)
