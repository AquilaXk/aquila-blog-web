// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/{posts-list-screen.tsx,components/post-list-row.tsx} (MIT) & payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT)
import { isServerTempDraftPost } from "./editorTempDraft"
import { formatIsoDateTime } from "src/libs/utils"
import type { SiteLanguage } from "src/libs/language"

export type PostListScope = "active" | "deleted"
export type PostStatusFilter = "all" | "draft" | "published" | "unlisted" | "private" | "deleted"

export type AdminPostListItem = {
  id: number
  title: string
  authorName: string
  authorProfileImgUrl?: string
  thumbnailUrl?: string | null
  category?: string | string[]
  tags?: string[]
  published: boolean
  listed: boolean
  tempDraft?: boolean
  createdAt: string
  modifiedAt: string
  deletedAt?: string
  hitCount?: number
  likesCount?: number
}

export type PageDto<T> = {
  content: T[]
  pageable?: {
    pageNumber?: number
    pageSize?: number
    totalElements?: number
    totalPages?: number
  }
}

export type PostWriteResult = {
  id: number
}

export type LocalDraftPayload = {
  title: string
  content: string
  summary: string
  thumbnailUrl: string
  tags: string[]
  category: string
  visibility: "PRIVATE" | "PUBLIC_UNLISTED" | "PUBLIC_LISTED"
  savedAt: string
}

export type ListSort = "MODIFIED_AT" | "CREATED_AT" | "CREATED_AT_ASC" | "HIT_COUNT" | "LIKES_COUNT"

export type AdminPostsFacetCounts = {
  all?: number
  published?: number
  draft?: number
  privateCount?: number
  unlisted?: number
  deleted?: number
}

export const parseAdminPostsFacetCounts = (data: unknown): AdminPostsFacetCounts | null => {
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, unknown>
  const readNumber = (val: unknown): number | undefined =>
    typeof val === "number" && Number.isFinite(val) && val >= 0 ? Math.trunc(val) : undefined

  return {
    all: readNumber(obj.all),
    published: readNumber(obj.published),
    draft: readNumber(obj.draft),
    privateCount: readNumber(obj.privateCount),
    unlisted: readNumber(obj.unlisted),
    deleted: readNumber(obj.deleted),
  }
}

export type WorkspaceConfirmState =
  | {
      kind: "delete" | "hardDelete" | "bulkDelete" | "bulkHardDelete"
      rowId: number
      rowTitle: string
      headline: string
      description: string
      confirmLabel: string
      tone: "danger"
    }
  | null

export type WorkspaceToastState =
  | {
      tone: "success" | "error"
      text: string
      actionLabel?: string
      action?: {
        kind: "restore"
        rowId: number
        rowTitle: string
      }
    }
  | null

export type WorkspaceRecentAction = {
  id: string
  tone: "success" | "error"
  label: string
  detail: string
  stateLabel: string
  occurredAt: string
}

export type ListState = {
  rows: AdminPostListItem[]
  total: number
  loadedAt: string
}

export const EDITOR_NEW_ROUTE_PATH = "/admin/editor/new"
export const DEFAULT_PAGE = "1"
export const DEFAULT_PAGE_SIZE = "20"
export const DEFAULT_SORT: ListSort = "MODIFIED_AT"
export const LIST_SKELETON_ROW_COUNT = 5
export const POSTS_WORKSPACE_MOBILE_LIST_DELAY_MS = 180
export const POSTS_WORKSPACE_MOBILE_LIST_QUERY = "(max-width: 1100px)"

export const formatDateTime = (value?: string) => formatIsoDateTime(value)

export const toVisibility = (published: boolean, listed: boolean) => {
  if (!published) return "PRIVATE" as const
  if (listed) return "PUBLIC_LISTED" as const
  return "PUBLIC_UNLISTED" as const
}

export const visibilityLabel = (
  published: boolean,
  listed: boolean,
  language: SiteLanguage = "ko"
) => {
  const visibility = toVisibility(published, listed)
  if (visibility === "PRIVATE") return language === "en" ? "Private" : "비공개"
  if (visibility === "PUBLIC_UNLISTED") return language === "en" ? "Unlisted" : "링크 공개"
  return language === "en" ? "Public" : "전체 공개"
}

export const getWorkspacePostStatusFilter = (
  row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">
): Exclude<PostStatusFilter, "all" | "deleted"> => {
  if (isServerTempDraftPost(row)) return "draft"
  if (!row.published) return "private"
  if (!row.listed) return "unlisted"
  return "published"
}

export const workspaceStatusLabel = (
  row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">,
  language: SiteLanguage = "ko"
) => {
  if (isServerTempDraftPost(row)) return language === "en" ? "Draft" : "임시 초안"
  return visibilityLabel(row.published, row.listed, language)
}

export const workspaceStatusTone = (row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">) => {
  if (isServerTempDraftPost(row)) return "DRAFT" as const
  return toVisibility(row.published, row.listed)
}

export const getWorkspaceTopicLabel = (row: Pick<AdminPostListItem, "category" | "tags">) => {
  if (typeof row.category === "string" && row.category.trim()) return row.category.trim()
  const firstCategory = Array.isArray(row.category) ? row.category.find((category) => category.trim()) : undefined
  if (firstCategory?.trim()) return firstCategory.trim()
  const firstTag = row.tags?.find((tag) => tag.trim())
  return firstTag?.trim() || "-"
}

export const formatWorkspaceViews = (row: Pick<AdminPostListItem, "hitCount">) =>
  typeof row.hitCount === "number" ? row.hitCount.toLocaleString() : "-"

export const isWorkspaceTempDraft = (row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">) =>
  isServerTempDraftPost(row)

export const getWorkspaceRowTitle = (
  row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">
) => {
  const trimmed = row.title.trim()
  if (isWorkspaceTempDraft(row)) {
    return trimmed || "임시 저장"
  }
  return trimmed ? row.title : ""
}

export const visibilityLabelFromValue = (visibility: LocalDraftPayload["visibility"]) => {
  if (visibility === "PRIVATE") return "비공개"
  if (visibility === "PUBLIC_UNLISTED") return "링크 공개"
  return "전체 공개"
}

export const buildRowTitle = (row: Pick<AdminPostListItem, "title" | "published" | "listed" | "tempDraft">) =>
  getWorkspaceRowTitle(row) || "제목 없는 글"

export const buildWorkspacePostSubtitle = (
  row: Pick<AdminPostListItem, "authorName" | "title" | "published" | "listed" | "tempDraft" | "tags" | "likesCount">,
  scope: PostListScope,
  language: SiteLanguage = "ko"
): string => {
  const parts: string[] = []
  const author = row.authorName?.trim()
  if (author) {
    parts.push(language === "en" ? `By ${author}` : author)
  }

  if (scope === "deleted") {
    parts.push(language === "en" ? "Moved to trash" : "삭제 보관됨")
  } else if (isWorkspaceTempDraft(row)) {
    parts.push(language === "en" ? "Autosaved draft" : "자동 저장 초안")
  } else if (row.published && !row.listed) {
    parts.push(language === "en" ? "Direct link access" : "링크 보유자 열람")
  } else if (typeof row.likesCount === "number" && row.likesCount > 0) {
    parts.push(language === "en" ? `${row.likesCount.toLocaleString()} likes` : `좋아요 ${row.likesCount.toLocaleString()}`)
  } else if (Array.isArray(row.tags)) {
    const firstTag = row.tags.find((tag) => tag.trim())?.trim()
    if (firstTag) parts.push(`#${firstTag}`)
  }

  return parts.join(" · ")
}

export const buildWorkspaceAuthorFallbackInitial = (authorName: string) => {
  const source = authorName.trim() || "작"
  return source.slice(0, 1).toUpperCase()
}

export const canOpenCanonicalPost = (row: Pick<AdminPostListItem, "published" | "tempDraft">) =>
  row.published && row.tempDraft !== true

export const sanitizeNumberInput = (value: string, fallback: string) => {
  const digits = value.replace(/[^0-9]/g, "")
  return digits.length > 0 ? digits : fallback
}

export const buildListEndpoint = (
  scope: PostListScope,
  options: { page: string; pageSize: string; kw: string; sort: ListSort; status?: PostStatusFilter }
) => {
  const query = new URLSearchParams({
    page: options.page,
    pageSize: options.pageSize,
    kw: options.kw,
  })

  const endpoint = scope === "deleted" ? "/post/api/v1/adm/posts/deleted" : "/post/api/v1/adm/posts"
  if (scope === "active") {
    query.set("sort", options.sort)
    if (options.status && options.status !== "all" && options.status !== "deleted") {
      query.set("status", options.status)
    }
  }

  return `${endpoint}?${query.toString()}`
}
