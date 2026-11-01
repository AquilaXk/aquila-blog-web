import { CONFIG } from "site.config"
import {
  resolveMetadataImageUrl,
  resolveOpenGraphType,
  type MetaConfigProps,
} from "src/components/MetaConfig"
import type { TPost } from "src/types"
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

const normalizePostImage = (post: TPost) => resolveMetadataImageUrl(post.thumbnail, SITE_URL)

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

export const buildPostDetailMetadata = (post: TPost): MetaConfigProps => {
  const canonicalPath = toCanonicalPostPath(post.id)
  const canonicalUrl = `${SITE_URL}${canonicalPath}`
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
    url: canonicalUrl,
    jsonLd: [
      buildBlogPostingJsonLd({
        post,
        canonicalUrl,
        publishedDate,
        modifiedDate,
        image,
      }),
      buildBreadcrumbJsonLd(post, canonicalUrl),
    ],
  }
}
