import type { TPost } from "src/types"
import type { components } from "@shared/contracts"

type GeneratedPostWithContentDto = components["schemas"]["PostWithContentDto"]
type GeneratedPostDto = components["schemas"]["PostDto"]
type GeneratedPostWriteRequest = components["schemas"]["PostWriteRequest"]
type GeneratedPostModifyRequest = components["schemas"]["PostModifyRequest"]
type GeneratedPostWriteResult = components["schemas"]["PostWriteResultDto"]
type GeneratedPostSummaryPreviewRequest = components["schemas"]["PostSummaryPreviewRequest"]
type GeneratedPostSummaryPreviewResponse = components["schemas"]["PostSummaryPreviewResponse"]

type PostSummaryFields = Pick<GeneratedPostDto, "summary" | "summarySource">
type PostWithContentSummaryFields = Pick<GeneratedPostWithContentDto, "summary" | "summarySource">

export type ApiEditorPostDto = Pick<
  GeneratedPostWithContentDto,
  "id" | "title" | "content" | "contentHtml" | "version" | "published" | "listed" | "tempDraft" | "summary" | "summarySource"
>
export type ApiPostWriteRequest = GeneratedPostWriteRequest
export type ApiPostModifyRequest = GeneratedPostModifyRequest
export type ApiPostWriteResult = GeneratedPostWriteResult
export type ApiPostSummaryPreviewRequest = GeneratedPostSummaryPreviewRequest
export type ApiPostSummaryPreviewResponse = GeneratedPostSummaryPreviewResponse

export type ContentHtmlTrustFields = Pick<
  GeneratedPostWithContentDto,
  "contentHtml" | "contentHtmlHash" | "contentHtmlSanitizerPolicyVersion" | "contentHtmlTrustState"
>

export type PageDto<T> = {
  content: T[]
  pageable: {
    pageNumber: number
    pageSize: number
    totalElements: number
    totalPages: number
  }
}

export type CursorPageDto<T> = {
  content: T[]
  pageSize: number
  hasNext: boolean
  nextCursor?: string | null
}

export type PostsBootstrapDto = {
  feed: CursorPageDto<ApiPostDto>
  tags: ApiTagCountDto[]
}

export type ApiPostDto = PostSummaryFields & {
  id: number
  createdAt: string
  modifiedAt: string
  authorId: number
  authorName: string
  authorUsername?: string
  authorProfileImgUrl: string
  authorProfileImageUrl?: string
  authorProfileImageDirectUrl?: string
  title: string
  thumbnail?: string
  tags?: string[]
  category?: string[]
  published: boolean
  listed: boolean
  likesCount?: number
  commentsCount?: number
  hitCount?: number
  actorHasLiked?: boolean
}

export type ApiPostWithContentDto = ContentHtmlTrustFields & PostWithContentSummaryFields & {
  id: number
  createdAt: string
  modifiedAt: string
  authorId: number
  authorName: string
  authorUsername?: string
  authorProfileImageUrl?: string
  authorProfileImageDirectUrl?: string
  authorProfileImgUrl?: string
  title: string
  content: string
  tags?: string[]
  category?: string[]
  published: boolean
  listed: boolean
  likesCount: number
  commentsCount: number
  hitCount: number
  actorHasLiked?: boolean
  actorCanModify?: boolean
  actorCanDelete?: boolean
}

export type ApiTagCountDto = {
  tag: string
  count: number
}

export type FeedSortMode = "latest" | "views" | "likes"

export type ExplorePostsParams = {
  kw?: string
  tag?: string
  order?: "asc" | "desc"
  sortMode?: FeedSortMode
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

export type PostsBootstrapResult = {
  posts: TPost[]
  hasNext: boolean
  nextCursor: string | null
  pageSize: number
  tagCounts: Record<string, number>
}

export type ExplorePostsPage = {
  posts: TPost[]
  totalCount: number
  pageNumber: number
  pageSize: number
  hasNext?: boolean
  nextCursor?: string | null
  paginationMode?: "cursor" | "page"
}
