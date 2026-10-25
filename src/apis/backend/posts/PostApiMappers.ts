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

const pushUniqueStrings = (target: string[], items: string[]) => {
  for (const item of items) {
    if (!target.includes(item)) target.push(item)
  }
}

const applyPostMetaKeyValue = (
  key: string,
  value: string,
  tags: string[],
  categories: string[]
): boolean => {
  if (key === "tag" || key === "tags") {
    pushUniqueStrings(tags, normalizeMetaItems(value))
    return true
  }
  if (key === "category" || key === "categories") {
    pushUniqueStrings(categories, normalizeMetaItems(value).map(normalizeCategoryValue))
    return true
  }
  return false
}

const parsePostMetaKeyValueLine = (line: string): { key: string; value: string } | null => {
  const colonIdx = line.indexOf(":")
  if (colonIdx <= 0) return null
  const key = line.slice(0, colonIdx).trim().toLowerCase()
  const value = line.slice(colonIdx + 1).trim()
  if (!value) return null
  if (key !== "tag" && key !== "tags" && key !== "category" && key !== "categories") {
    return null
  }
  return { key, value }
}

const consumeFrontmatterPostMeta = (
  trimmed: string,
  tags: string[],
  categories: string[]
): string => {
  if (!trimmed.startsWith("---\n")) return trimmed
  const closingIndex = trimmed.indexOf("\n---", 4)
  if (closingIndex <= 0) return trimmed

  let cursor = 4
  while (cursor <= closingIndex) {
    const nextBreak = trimmed.indexOf("\n", cursor)
    const lineEnd = nextBreak === -1 || nextBreak > closingIndex ? closingIndex : nextBreak
    const parsed = parsePostMetaKeyValueLine(trimmed.slice(cursor, lineEnd))
    if (parsed) {
      applyPostMetaKeyValue(parsed.key, parsed.value, tags, categories)
    }
    if (nextBreak === -1 || nextBreak >= closingIndex) break
    cursor = nextBreak + 1
  }
  return trimmed.slice(closingIndex + 4).trimStart()
}

export const parsePostMeta = (content: string): ParsedPostMeta => {
  const tags: string[] = []
  const categories: string[] = []
  let trimmed = consumeFrontmatterPostMeta(
    content.replace(/\r\n?/g, "\n").trimStart(),
    tags,
    categories
  )

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
    const parsed = parsePostMetaKeyValueLine(line)
    if (!parsed) break
    applyPostMetaKeyValue(parsed.key, parsed.value, tags, categories)
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
  for (const item of value) {
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
