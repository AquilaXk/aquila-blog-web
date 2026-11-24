import { findWikilinkSpans } from "./inlineTokenScanners"
import { slugifyMarkdownHeading } from "./markdownDocumentInsights"

export const normalizeWikilinkLookupKey = (rawTarget: string): string =>
  rawTarget.trim().replace(/\s+/g, " ").toLowerCase()

export const splitWikilinkTargetAndAnchor = (
  rawTarget: string
): {
  baseTarget: string
  anchorSlug: string
} => {
  const hashIndex = rawTarget.indexOf("#")
  if (hashIndex < 0) {
    return { baseTarget: rawTarget.trim(), anchorSlug: "" }
  }
  const baseTarget = rawTarget.slice(0, hashIndex).trim()
  const rawAnchor = rawTarget.slice(hashIndex + 1).trim()
  return {
    baseTarget,
    anchorSlug: rawAnchor ? slugifyMarkdownHeading(rawAnchor) : "",
  }
}

const assignResolvedTarget = (
  resolved: Record<string, string>,
  key: string,
  href: string
) => {
  if (!key || Object.hasOwn(resolved, key)) return
  if (key === "__proto__") {
    Object.defineProperty(resolved, key, {
      value: href,
      enumerable: true,
      writable: true,
      configurable: true,
    })
    return
  }
  resolved[key] = href
}

export const buildPostInternalLinkTargets = (
  markdown: string,
  catalogPosts: readonly { id: string | number; title: string; slug?: string }[]
): Record<string, string> => {
  if (!markdown || !markdown.includes("[[") || catalogPosts.length === 0) return {}
  const spans = findWikilinkSpans(markdown)
  if (spans.length === 0) return {}

  const neededKeys = new Set<string>()
  for (const span of spans) {
    const { baseTarget } = splitWikilinkTargetAndAnchor(span.rawTarget)
    if (!baseTarget || baseTarget.startsWith("/") || /^https?:\/\//i.test(baseTarget)) continue
    neededKeys.add(normalizeWikilinkLookupKey(baseTarget))
  }
  if (neededKeys.size === 0) return {}

  const resolved: Record<string, string> = {}
  for (const post of catalogPosts) {
    const postId = String(post.id ?? "").trim()
    if (!/^[1-9]\d*$/.test(postId)) continue
    const href = `/posts/${postId}`
    const titleKey = normalizeWikilinkLookupKey(post.title || "")
    if (titleKey && neededKeys.has(titleKey)) {
      assignResolvedTarget(resolved, titleKey, href)
    }
    const slugKey = post.slug ? normalizeWikilinkLookupKey(post.slug) : ""
    if (slugKey && neededKeys.has(slugKey)) {
      assignResolvedTarget(resolved, slugKey, href)
    }
    if (neededKeys.has(postId)) {
      assignResolvedTarget(resolved, postId, href)
    }
  }
  return resolved
}

export const resolveInternalWikilinkHref = (
  rawTarget: string,
  fallbackHref: string,
  internalLinkTargets?: Readonly<Record<string, string>>
): { href: string; isResolvedPost: boolean } => {
  if (!internalLinkTargets) return { href: fallbackHref, isResolvedPost: false }
  const trimmed = rawTarget.trim()
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) {
    return { href: fallbackHref, isResolvedPost: false }
  }
  const { baseTarget, anchorSlug } = splitWikilinkTargetAndAnchor(trimmed)
  if (!baseTarget) return { href: fallbackHref, isResolvedPost: false }
  const normalizedKey = normalizeWikilinkLookupKey(baseTarget)
  if (!Object.hasOwn(internalLinkTargets, normalizedKey)) {
    return { href: fallbackHref, isResolvedPost: false }
  }
  const matchedPath = internalLinkTargets[normalizedKey]
  if (typeof matchedPath !== "string" || !/^\/posts\/[1-9]\d*$/.test(matchedPath)) {
    return { href: fallbackHref, isResolvedPost: false }
  }
  return {
    href: anchorSlug ? `${matchedPath}#${encodeURIComponent(anchorSlug)}` : matchedPath,
    isResolvedPost: true,
  }
}
