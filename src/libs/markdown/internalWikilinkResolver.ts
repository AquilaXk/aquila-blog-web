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
    const titleKey = normalizeWikilinkLookupKey(post.title || "")
    if (titleKey && neededKeys.has(titleKey) && !Object.hasOwn(resolved, titleKey)) {
      resolved[titleKey] = `/posts/${postId}`
    }
    const slugKey = post.slug ? normalizeWikilinkLookupKey(post.slug) : ""
    if (slugKey && neededKeys.has(slugKey) && !Object.hasOwn(resolved, slugKey)) {
      resolved[slugKey] = `/posts/${postId}`
    }
    if (neededKeys.has(postId) && !Object.hasOwn(resolved, postId)) {
      resolved[postId] = `/posts/${postId}`
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
  const matchedPath = internalLinkTargets[normalizeWikilinkLookupKey(baseTarget)]
  if (!matchedPath || !/^\/posts\/[1-9]\d*$/.test(matchedPath)) {
    return { href: fallbackHref, isResolvedPost: false }
  }
  return {
    href: anchorSlug ? `${matchedPath}#${encodeURIComponent(anchorSlug)}` : matchedPath,
    isResolvedPost: true,
  }
}
