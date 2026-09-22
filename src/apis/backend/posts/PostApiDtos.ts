import type { TPost } from "src/types"
import type { components } from "@shared/contracts"

type GeneratedPostWithContentDto = components["schemas"]["PostWithContentDto"]
type GeneratedPostDto = components["schemas"]["PostDto"]
type GeneratedPostWriteRequest = components["schemas"]["PostWriteRequest"]
type GeneratedPostModifyRequest = components["schemas"]["PostModifyRequest"]
type GeneratedPostWriteResult = components["schemas"]["PostWriteResultDto"]

type PostSummaryFields = Pick<GeneratedPostDto, "summary" | "summarySource">
type PostWithContentSummaryFields = Pick<GeneratedPostWithContentDto, "summary" | "summarySource">

export type ApiEditorPostDto = Pick<
  GeneratedPostWithContentDto,
  "id" | "title" | "content" | "contentHtml" | "version" | "published" | "listed" | "tempDraft" | "summary" | "summarySource"
>
export type ApiPostWriteRequest = GeneratedPostWriteRequest
export type ApiPostModifyRequest = GeneratedPostModifyRequest
export type ApiPostWriteResult = GeneratedPostWriteResult

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

export type ApiPostDto = GeneratedPostDto & {
  authorProfileImageUrl?: string
  authorProfileImageDirectUrl?: string
}
export type ApiPostWithContentDto = GeneratedPostWithContentDto & {
  authorProfileImgUrl?: string
  tags?: string[]
  category?: string[]
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
