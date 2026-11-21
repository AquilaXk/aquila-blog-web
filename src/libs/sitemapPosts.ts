import {
  getFeedPostsPage,
  getPublicSitemapPosts,
  type ExplorePostsPage,
} from "src/apis/backend/posts"
import type { TPost } from "src/types"
import { toCanonicalPostPath } from "src/libs/utils/postPath"

export const SITEMAP_POST_PAGE_SIZE = 30
export const SITEMAP_MAX_POST_PAGES = 1_000
export const SITEMAP_XML_CONTENT_TYPE = "application/xml; charset=utf-8"

export type SitemapPostPageLoader = (params: {
  order?: "asc" | "desc"
  page?: number
  pageSize?: number
}) => Promise<ExplorePostsPage>

type CollectSitemapPostsOptions = {
  pageSize?: number
  maxPages?: number
}

type SitemapField = {
  loc: string
  lastmod: string
  priority: number
  changefreq: "daily"
}

const toSafePositiveInteger = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.trunc(value || fallback))
}

const toStableIsoTimestamp = (value: string | undefined) => {
  if (typeof value !== "string" || value.trim().length === 0) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp).toISOString()
}

const isSitemapVisiblePost = (post: TPost) => {
  if (typeof post.published === "boolean" && typeof post.listed === "boolean") {
    return post.published && post.listed
  }
  return (
    post.status?.includes("Public") === true &&
    !post.status?.includes("Private") &&
    !post.status?.includes("PublicOnDetail")
  )
}

export const getSitemapPostLastmod = (post: TPost) =>
  toStableIsoTimestamp(post.modifiedAt) ??
  toStableIsoTimestamp(post.modifiedTime) ??
  toStableIsoTimestamp(post.createdAt) ??
  toStableIsoTimestamp(post.createdTime) ??
  (post.date ? toStableIsoTimestamp(post.date.start_date) : null) ??
  "1970-01-01T00:00:00.000Z"

const getLatestLastmod = (lastmods: string[], fallback: string) =>
  lastmods.reduce((latest, candidate) => {
    const latestTime = Date.parse(latest)
    const candidateTime = Date.parse(candidate)
    if (!Number.isFinite(candidateTime)) return latest
    if (!Number.isFinite(latestTime)) return candidate
    return candidateTime > latestTime ? candidate : latest
  }, fallback)

const hasMoreSitemapPages = (page: ExplorePostsPage, requestedPage: number, requestedPageSize: number) => {
  if (page.hasNext === true) return true
  const responsePageSize = toSafePositiveInteger(page.pageSize, requestedPageSize)
  const totalCount = Number.isFinite(page.totalCount) ? Math.max(0, Math.trunc(page.totalCount)) : 0
  return requestedPage * responsePageSize < totalCount
}

const SITEMAP_PROJECTION_MAX_ITEMS = 10_000

export const collectSitemapPosts = async (
  loadPage: SitemapPostPageLoader = getFeedPostsPage,
  options: CollectSitemapPostsOptions = {}
) => {
  const safePageSize = toSafePositiveInteger(options.pageSize, SITEMAP_POST_PAGE_SIZE)
  const safeMaxPages = toSafePositiveInteger(options.maxPages, SITEMAP_MAX_POST_PAGES)

  if (loadPage === getFeedPostsPage && options.pageSize === undefined && options.maxPages === undefined) {
    try {
      const projected = await getPublicSitemapPosts({ limit: SITEMAP_PROJECTION_MAX_ITEMS })
      if (projected.length < SITEMAP_PROJECTION_MAX_ITEMS) {
        const seenIds = new Set<string>()
        const deduplicated: TPost[] = []
        for (const post of projected) {
          if (!isSitemapVisiblePost(post) || seenIds.has(post.id)) continue
          seenIds.add(post.id)
          deduplicated.push(post)
        }
        return deduplicated
      }
    } catch {
      // Fall back to paged feed scan during rolling deployment or transient projection failure
    }
  }

  const posts: TPost[] = []
  const seenPostIds = new Set<string>()
  const seenRawRowIds = new Set<string>()

  for (let page = 1; page <= safeMaxPages; page += 1) {
    const result = await loadPage({
      order: "desc",
      page,
      pageSize: safePageSize,
    })

    let addedRawRowInPage = 0
    for (const post of result.posts) {
      if (!seenRawRowIds.has(post.id)) {
        seenRawRowIds.add(post.id)
        addedRawRowInPage += 1
      }
      if (!isSitemapVisiblePost(post) || seenPostIds.has(post.id)) continue
      seenPostIds.add(post.id)
      posts.push(post)
    }

    if (result.posts.length > 0 && addedRawRowInPage === 0) {
      break
    }

    const hasMore = result.posts.length > 0 && hasMoreSitemapPages(result, page, safePageSize)
    if (!hasMore) {
      break
    }

    if (page === safeMaxPages) {
      throw new Error(
        `Sitemap collection reached maxPages=${safeMaxPages} before exhausting posts. Increase the limit or split the sitemap.`
      )
    }
  }

  return posts
}

export const buildSitemapFields = (
  posts: TPost[],
  siteUrl: string,
  fallbackSiteLastmod = "1970-01-01T00:00:00.000Z"
): SitemapField[] => {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "")
  const normalizedFallbackLastmod =
    toStableIsoTimestamp(fallbackSiteLastmod) ?? "1970-01-01T00:00:00.000Z"

  const postFields = posts.map((post) => ({
    loc: `${normalizedSiteUrl}${toCanonicalPostPath(post.id)}`,
    lastmod: getSitemapPostLastmod(post),
    priority: 0.7,
    changefreq: "daily" as const,
  }))

  return [
    {
      loc: normalizedSiteUrl,
      lastmod: getLatestLastmod(
        postFields.map((field) => field.lastmod),
        normalizedFallbackLastmod
      ),
      priority: 1.0,
      changefreq: "daily",
    },
    ...postFields,
  ]
}

const xmlEntityFor = (code: number): string | null => {
  switch (code) {
    case 38:
      return "&amp;"
    case 60:
      return "&lt;"
    case 62:
      return "&gt;"
    case 34:
      return "&quot;"
    case 39:
      return "&apos;"
    default:
      return null
  }
}

const escapeXml = (value = ""): string => {
  if (!value) return ""
  let out = ""
  let lastCleanIndex = 0
  let dirty = false

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    const entity = xmlEntityFor(code)
    if (entity !== null) {
      dirty = true
      if (lastCleanIndex < i) out += value.slice(lastCleanIndex, i)
      out += entity
      lastCleanIndex = i + 1
      continue
    }
    const isBmpValid =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    if (isBmpValid) continue

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1
        continue
      }
    }
    dirty = true
    if (lastCleanIndex < i) out += value.slice(lastCleanIndex, i)
    lastCleanIndex = i + 1
  }

  if (!dirty) return value
  if (lastCleanIndex < value.length) out += value.slice(lastCleanIndex)
  return out
}

export const buildSitemapXml = (fields: ReadonlyArray<SitemapField>): string => {
  const entries = new Array<string>(fields.length)
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]!
    const loc = escapeXml(field.loc)
    const lastmod = escapeXml(field.lastmod)
    const changefreq = escapeXml(field.changefreq)
    const priority = Number.isFinite(field.priority) ? String(field.priority) : "0.7"
    entries[i] =
      `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>` +
      `<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    (entries.length > 0 ? `${entries.join("\n")}\n` : "") +
    `</urlset>`
  )
}
