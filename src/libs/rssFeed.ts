import type { ExplorePostsPage } from "src/apis/backend/posts"
import type { TPost } from "src/types"
import { toCanonicalPostPath } from "src/libs/utils/postPath"

export const RSS_FEED_CONTENT_TYPE = "application/rss+xml; charset=utf-8"
export const RSS_FEED_PAGE_SIZE = 30
export const RSS_FEED_MAX_PAGES = 1_000

export type RssFeedPostPageLoader = (params: {
  order?: "asc" | "desc"
  page?: number
  pageSize?: number
}) => Promise<ExplorePostsPage>

type CollectRssFeedPostsOptions = {
  pageSize?: number
  maxPages?: number
}

type BuildRssFeedOptions = {
  siteUrl: string
  title: string
  description: string
  lang: string
}

const toSafePositiveInteger = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.trunc(value || fallback))
}

const normalizeSiteUrl = (siteUrl: string) => siteUrl.replace(/\/+$/, "")

const toStableDate = (value: string | undefined) => {
  if (typeof value !== "string" || value.trim().length === 0) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp)
}

export const getRssPostDate = (post: TPost) =>
  toStableDate(post.modifiedAt) ??
  toStableDate(post.modifiedTime) ??
  toStableDate(post.createdAt) ??
  toStableDate(post.createdTime) ??
  (post.date ? toStableDate(post.date.start_date) : null) ??
  new Date(0)

const isRssVisiblePost = (post: TPost) => {
  if (typeof post.published === "boolean" && typeof post.listed === "boolean") {
    return post.published && post.listed
  }
  return (
    post.status?.includes("Public") === true &&
    !post.status?.includes("Private") &&
    !post.status?.includes("PublicOnDetail")
  )
}

const hasMoreRssPages = (page: ExplorePostsPage, requestedPage: number, requestedPageSize: number) => {
  if (page.hasNext === true) return true
  const responsePageSize = toSafePositiveInteger(page.pageSize, requestedPageSize)
  const totalCount = Number.isFinite(page.totalCount) ? Math.max(0, Math.trunc(page.totalCount)) : 0
  return requestedPage * responsePageSize < totalCount
}

const stripInvalidXmlChars = (value = ""): string => {
  if (!value) return ""
  let clean: string | null = null
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    const isBmpValid =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    if (isBmpValid) {
      if (clean !== null) clean += value[i]
      continue
    }
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        if (clean !== null) clean += value[i] + value[i + 1]
        i += 1
        continue
      }
    }
    if (clean === null) clean = value.slice(0, i)
  }
  return clean ?? value
}

const escapeXml = (value: string) =>
  stripInvalidXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export const collectRssFeedPosts = async (
  loadPage: RssFeedPostPageLoader,
  { pageSize = RSS_FEED_PAGE_SIZE, maxPages = RSS_FEED_MAX_PAGES }: CollectRssFeedPostsOptions = {}
) => {
  const safePageSize = toSafePositiveInteger(pageSize, RSS_FEED_PAGE_SIZE)
  const safeMaxPages = toSafePositiveInteger(maxPages, RSS_FEED_MAX_PAGES)
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
      if (!isRssVisiblePost(post) || seenPostIds.has(post.id)) continue
      seenPostIds.add(post.id)
      posts.push(post)
    }

    if (result.posts.length > 0 && addedRawRowInPage === 0) break

    const hasMore = result.posts.length > 0 && hasMoreRssPages(result, page, safePageSize)
    if (!hasMore) break

    if (page === safeMaxPages) {
      throw new Error(
        `RSS feed collection reached maxPages=${safeMaxPages} before exhausting posts. Increase the limit or split the feed.`
      )
    }
  }

  return posts.sort((left, right) => getRssPostDate(right).getTime() - getRssPostDate(left).getTime())
}

export const buildRssFeedXml = (posts: TPost[], options: BuildRssFeedOptions) => {
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  const selfFeedUrl = `${siteUrl}/feed`
  const latestPostDate = posts.length > 0 ? getRssPostDate(posts[0]) : new Date(0)
  const items = posts
    .map((post) => {
      const canonicalUrl = `${siteUrl}${toCanonicalPostPath(post.id)}`
      const summary = post.summary ?? ""
      const creatorName = (post.author?.[0]?.name || "").trim()
      const categories = (post.tags || [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 10)
        .map((tag) => `      <category>${escapeXml(tag)}</category>`)

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(canonicalUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(canonicalUrl)}</guid>`,
        ...(summary ? [`      <description>${escapeXml(summary)}</description>`] : []),
        ...(creatorName ? [`      <dc:creator>${escapeXml(creatorName)}</dc:creator>`] : []),
        ...categories,
        `      <pubDate>${getRssPostDate(post).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n")
    })
    .join("\n")

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(options.title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <atom:link href="${escapeXml(selfFeedUrl)}" rel="self" type="${RSS_FEED_CONTENT_TYPE}" />`,
    `    <description>${escapeXml(options.description)}</description>`,
    `    <language>${escapeXml(options.lang)}</language>`,
    `    <lastBuildDate>${latestPostDate.toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line) => line.length > 0)
    .join("\n")
}
