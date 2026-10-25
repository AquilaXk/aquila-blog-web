import type { PostDetail, PostSummarySource, TPost } from "src/types"
import { normalizeCategoryValue } from "src/libs/utils"
import type { ApiPostDto, ApiPostWithContentDto } from "./PostApiDtos"
import { resolveTrustedContentHtml } from "./contentHtmlTrust"

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")

export const normalizeMetaItems = (raw: string): string[] => {
  const normalized = raw.trim().replace(/^\[|\]$/g, "")
  if (!normalized) return []

  const tokens = normalized
    .split(",")
    .map((token) => token.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean)

  return Array.from(new Set(tokens))
}

type ParsedPostMeta = {
  content: string
  tags: string[]
  category: string[]
}

export const parsePostMeta = (content: string): ParsedPostMeta => {
  let trimmed = content.replace(/\r\n?/g, "\n").trimStart()
  const tags: string[] = []
  const categories: string[] = []

  const pushTags = (items: string[]) => {
    items.forEach((item) => {
      if (!tags.includes(item)) tags.push(item)
    })
  }
  const pushCategories = (items: string[]) => {
    items.map(normalizeCategoryValue).forEach((item) => {
      if (!categories.includes(item)) categories.push(item)
    })
  }

  if (trimmed.startsWith("---\n")) {
    const closingIndex = trimmed.indexOf("\n---", 4)
    if (closingIndex > 0) {
      let cursor = 4
      while (cursor <= closingIndex) {
        const nextBreak = trimmed.indexOf("\n", cursor)
        const lineEnd = nextBreak === -1 || nextBreak > closingIndex ? closingIndex : nextBreak
        const line = trimmed.slice(cursor, lineEnd)
        const colonIdx = line.indexOf(":")
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim().toLowerCase()
          const value = line.slice(colonIdx + 1).trim()
          if (value) {
            if (key === "tags" || key === "tag") pushTags(normalizeMetaItems(value))
            if (key === "category" || key === "categories") {
              pushCategories(normalizeMetaItems(value))
            }
          }
        }
        if (nextBreak === -1 || nextBreak >= closingIndex) break
        cursor = nextBreak + 1
      }
      trimmed = trimmed.slice(closingIndex + 4).trimStart()
    }
  }

  const metadataLineRegex = /^\s*(tags?|category|categories)\s*:\s*(.+)\s*$/i
  let cursor = 0
  let consumedAny = false
  while (cursor <= trimmed.length) {
    const nextBreak = trimmed.indexOf("\n", cursor)
    const line = nextBreak === -1 ? trimmed.slice(cursor) : trimmed.slice(cursor, nextBreak)
    if (!line.trim()) {
      consumedAny = true
      cursor = nextBreak === -1 ? trimmed.length : nextBreak + 1
      break
    }
    const match = line.match(metadataLineRegex)
    if (!match) break
    const key = match[1].toLowerCase()
    const value = match[2]
    if (key === "tag" || key === "tags") pushTags(normalizeMetaItems(value))
    if (key === "category" || key === "categories") {
      pushCategories(normalizeMetaItems(value))
    }
    consumedAny = true
    if (nextBreak === -1) {
      cursor = trimmed.length
      break
    }
    cursor = nextBreak + 1
  }

  if (consumedAny) {
    trimmed = trimmed.slice(cursor).trimStart()
  }

  return { content: trimmed, tags, category: categories }
}

const toStatus = (published: boolean, listed: boolean): TPost["status"] => {
  if (!published) return ["Private"]
  if (listed) return ["Public"]
  return ["PublicOnDetail"]
}

const toSlug = (id: number, title: string) => {
  const normalized = slugify(title)
  return normalized ? `${normalized}-${id}` : `${id}`
}

export const normalizeStringArray = (value?: string[]) => {
  if (!Array.isArray(value) || value.length === 0) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i]
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }
  return result
}

const normalizeCategoryArray = (value?: string[]) =>
  normalizeStringArray(value).map(normalizeCategoryValue)

const pickPreferredImageUrl = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue
    const normalized = candidate.trim()
    if (normalized.length > 0) return normalized
  }
  return ""
}

export const POST_SUMMARY_SOURCES = new Set<PostSummarySource>([
  "MANUAL",
  "LEADING_BLOCK",
  "EXTRACTED",
  "MIGRATED",
  "NONE",
])

export const normalizeCanonicalSummary = ({
  summary,
  summarySource,
}: {
  summary?: unknown
  summarySource?: unknown
}): { summary: string; summarySource: PostSummarySource } => {
  if (
    typeof summary !== "string" ||
    typeof summarySource !== "string" ||
    !POST_SUMMARY_SOURCES.has(summarySource as PostSummarySource) ||
    (summarySource === "NONE" ? summary.length > 0 : summary.trim().length === 0)
  ) {
    throw new Error("canonical post summary pair is malformed")
  }

  return { summary, summarySource: summarySource as PostSummarySource }
}

export const mapPostDto = (post: ApiPostDto): TPost => {
  const normalizedTags = normalizeStringArray(post.tags)
  const normalizedCategories = normalizeCategoryArray(post.category)
  const canonicalSummary = normalizeCanonicalSummary(post)
  const normalizedThumbnail = pickPreferredImageUrl(post.thumbnail)
  const hasThumbnail = normalizedThumbnail.length > 0
  const authorProfileImage = pickPreferredImageUrl(
    post.authorProfileImageDirectUrl,
    post.authorProfileImgUrl,
    post.authorProfileImageUrl
  )
  const postId = post.id ?? 0
  const postTitle = post.title ?? ""
  const postCreatedAt = post.createdAt ?? ""
  const authorName = post.authorName || post.authorUsername || "익명"
  return {
    id: String(postId),
    title: postTitle,
    slug: toSlug(postId, postTitle),
    createdAt: postCreatedAt,
    modifiedAt: post.modifiedAt,
    published: post.published ?? false,
    listed: post.listed ?? false,
    authorId: post.authorId,
    authorName,
    authorUsername: post.authorUsername,
    authorProfileImgUrl: authorProfileImage || undefined,
    summary: canonicalSummary.summary,
    summarySource: canonicalSummary.summarySource,
    ...(hasThumbnail ? { thumbnail: normalizedThumbnail } : {}),
    ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
    ...(normalizedCategories.length > 0 ? { category: normalizedCategories } : {}),
    likesCount: post.likesCount ?? 0,
    hitCount: post.hitCount ?? 0,
    date: { start_date: postCreatedAt.slice(0, 10) },
    type: ["Post"],
    status: toStatus(post.published ?? false, post.listed ?? false),
    author: [
      {
        id: String(post.authorId ?? ""),
        name: authorName,
        profile_photo: authorProfileImage,
      },
    ],
    createdTime: postCreatedAt,
    modifiedTime: post.modifiedAt,
    fullWidth: false,
  }
}

export const mapPostDetail = async (
  post: ApiPostWithContentDto & { thumbnail?: string },
  { allowTrustedContentHtml }: { allowTrustedContentHtml: boolean },
): Promise<PostDetail> => {
  const postContent = post.content ?? ""
  const parsed = parsePostMeta(postContent)
  const dtoTags = normalizeStringArray(post.tags)
  const dtoCategories = normalizeCategoryArray(post.category)
  const tags = dtoTags.length > 0 ? dtoTags : parsed.tags
  const category = dtoCategories.length > 0 ? dtoCategories : parsed.category
  const normalizedContent = parsed.content

  const hasActorCanModify = typeof post.actorCanModify === "boolean"
  const hasActorCanDelete = typeof post.actorCanDelete === "boolean"
  const trustedContentHtml = !allowTrustedContentHtml || postContent.trim()
    ? undefined
    : await resolveTrustedContentHtml(post)

  return {
    ...mapPostDto({
      id: post.id,
      createdAt: post.createdAt,
      modifiedAt: post.modifiedAt,
      authorId: post.authorId,
      authorName: post.authorName,
      authorUsername: post.authorUsername,
      authorProfileImgUrl:
        post.authorProfileImageDirectUrl || post.authorProfileImageUrl || post.authorProfileImgUrl || "",
      title: post.title,
      summary: post.summary,
      summarySource: post.summarySource,
      thumbnail: post.thumbnail,
      tags,
      category,
      published: post.published,
      listed: post.listed,
    }),
    ...(tags.length > 0 ? { tags } : {}),
    ...(category.length > 0 ? { category } : {}),
    content: normalizedContent,
    ...(trustedContentHtml ? { trustedContentHtml } : {}),
    modifiedTime: post.modifiedAt,
    likesCount: post.likesCount ?? 0,
    hitCount: post.hitCount ?? 0,
    ...(hasActorCanModify ? { actorCanModify: post.actorCanModify } : {}),
    ...(hasActorCanDelete ? { actorCanDelete: post.actorCanDelete } : {}),
  }
}
export const extractPostIdFromSlug = (slug: string): number | null => {
  const dashIdx = slug.lastIndexOf("-")
  const tail = dashIdx === -1 ? slug : slug.slice(dashIdx + 1)
  if (!tail) return null
  const id = Number(tail)
  return Number.isInteger(id) && id > 0 ? id : null
}
