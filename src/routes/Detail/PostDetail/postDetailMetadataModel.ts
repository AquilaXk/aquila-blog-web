// 참조 구현: satnaing/astro-paper (MIT) & timlrx/tailwind-nextjs-starter-blog (MIT) — 수동/본문 이미지 우선 + 동적 OG 이미지 폴백
import { CONFIG } from "site.config"
import { extractFirstPostContentImageUrl } from "src/libs/markdown/extractFirstContentImageUrl"
import {
  resolveMetadataImageUrl,
  resolveOpenGraphType,
  type MetaConfigProps,
} from "src/components/MetaConfig"
import { buildPostOgImagePath } from "src/libs/og/ogUrl"
import type { TPost } from "src/types"
import { normalizeSafeCanonicalUrl as normalizeExternalCanonicalUrl } from "src/libs/utils/canonicalUrl"
import { toCanonicalPostPath } from "src/libs/utils/postPath"

type JsonLdObject = Record<string, unknown>

const trimTrailingSlashes = (value: string): string => {
  let end = value.length
  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1
  }
  return value.slice(0, end)
}

const SITE_TITLE = CONFIG.blog.title || "AquilaLog"
const SITE_URL = trimTrailingSlashes(CONFIG.link)

const resolvePrimaryPostType = (type: TPost["type"]): string => {
  const candidate = Array.isArray(type) ? (type[0] ?? "") : (type ?? "")
  const trimmed = candidate.trim()
  return trimmed.length > 0 ? trimmed : "Post"
}

const toIsoDate = (value: string | undefined) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const normalizePostImage = (post: TPost) => {
  const postWithContent = post as TPost & {
    content?: string
    trustedContentHtml?: { html?: string }
  }
  const candidate =
    post.thumbnail?.trim() ||
    extractFirstPostContentImageUrl(
      postWithContent.content,
      postWithContent.trustedContentHtml?.html
    )
  const resolvedCandidate = resolveMetadataImageUrl(candidate, SITE_URL)
  if (resolvedCandidate) return resolvedCandidate

  const fallbackOgPath = buildPostOgImagePath({
    title: post.title,
    category: post.category,
    tags: post.tags,
  })
  return resolveMetadataImageUrl(fallbackOgPath, SITE_URL)
}

const normalizeAuthorName = (post: TPost) =>
  post.authorName?.trim() ||
  post.author?.find((author) => author.name.trim().length > 0)?.name.trim() ||
  "익명"

const buildBlogPostingJsonLd = ({
  post,
  canonicalUrl,
  publishedDate,
  modifiedDate,
  image,
}: {
  post: TPost
  canonicalUrl: string
  publishedDate?: string
  modifiedDate?: string
  image: string
}): JsonLdObject => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description: post.summary || "",
  url: canonicalUrl,
  mainEntityOfPage: canonicalUrl,
  ...(publishedDate ? { datePublished: publishedDate } : {}),
  ...(modifiedDate ? { dateModified: modifiedDate } : {}),
  ...(image ? { image: [image] } : {}),
  author: {
    "@type": "Person",
    name: normalizeAuthorName(post),
  },
  publisher: {
    "@type": "Organization",
    name: SITE_TITLE,
  },
})

const buildBreadcrumbJsonLd = (
  post: TPost,
  canonicalUrl: string
): JsonLdObject => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "홈",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: post.title,
      item: canonicalUrl,
    },
  ],
})

export { normalizeExternalCanonicalUrl }

export const buildPostDetailMetadata = (post: TPost): MetaConfigProps => {
  const canonicalPath = toCanonicalPostPath(post.id)
  const selfCanonicalUrl = `${SITE_URL}${canonicalPath}`
  const externalCanonicalUrl = normalizeExternalCanonicalUrl(post.canonicalUrl)
  const canonicalUrl = externalCanonicalUrl || selfCanonicalUrl
  const publishedDate =
    toIsoDate(post.createdAt) ?? toIsoDate(post.createdTime) ?? toIsoDate(post.date?.start_date)
  const modifiedDate =
    toIsoDate(post.modifiedAt) ?? toIsoDate(post.modifiedTime) ?? publishedDate
  const image = normalizePostImage(post)
  const rawType = resolvePrimaryPostType(post.type)

  return {
    title: post.title,
    date: publishedDate,
    modifiedDate,
    image,
    description: post.summary || "",
    type: resolveOpenGraphType(rawType),
    url: selfCanonicalUrl,
    canonicalUrl,
    jsonLd: [
      buildBlogPostingJsonLd({
        post,
        canonicalUrl: selfCanonicalUrl,
        publishedDate,
        modifiedDate,
        image,
      }),
      buildBreadcrumbJsonLd(post, selfCanonicalUrl),
    ],
  }
}
