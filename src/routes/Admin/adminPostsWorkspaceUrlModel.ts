// 참조 구현: TryGhost/Ghost apps/admin/src/posts/list/posts-list-screen.tsx (MIT) & payloadcms/payload packages/ui/src/elements/ListSelection/ (MIT)
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  type ListSort,
  type PostListScope,
  type PostStatusFilter,
} from "./AdminPostsWorkspaceModel"

export type PostsWorkspaceQueryParams = {
  status: PostStatusFilter
  page: string
  pageSize: string
  kw: string
  sort: ListSort
  scope: PostListScope
}

const VALID_STATUSES = new Set<PostStatusFilter>(["all", "draft", "published", "unlisted", "private", "deleted"])
const VALID_SORTS = new Set<ListSort>(["MODIFIED_AT", "CREATED_AT", "CREATED_AT_ASC", "HIT_COUNT", "LIKES_COUNT"])
const VALID_PAGE_SIZES = new Set(["10", "20", "30"])

export const parsePostsWorkspaceQueryParams = (
  query: Record<string, string | string[] | undefined>
): PostsWorkspaceQueryParams => {
  const rawStatus = typeof query.status === "string" ? query.status : Array.isArray(query.status) ? query.status[0] : ""
  const status: PostStatusFilter = rawStatus && VALID_STATUSES.has(rawStatus as PostStatusFilter) ? (rawStatus as PostStatusFilter) : "all"

  const rawPage = typeof query.page === "string" ? query.page : Array.isArray(query.page) ? query.page[0] : ""
  const parsedPage = Number.parseInt(rawPage || "", 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? String(parsedPage) : DEFAULT_PAGE

  const rawPageSize = typeof query.pageSize === "string" ? query.pageSize : Array.isArray(query.pageSize) ? query.pageSize[0] : ""
  const pageSize = rawPageSize && VALID_PAGE_SIZES.has(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE

  const rawKw = typeof query.kw === "string" ? query.kw : Array.isArray(query.kw) ? query.kw[0] : ""
  const kw = (rawKw || "").trim()

  const rawSort = typeof query.sort === "string" ? query.sort : Array.isArray(query.sort) ? query.sort[0] : ""
  const sort: ListSort = rawSort && VALID_SORTS.has(rawSort as ListSort) ? (rawSort as ListSort) : DEFAULT_SORT

  const scope: PostListScope = status === "deleted" ? "deleted" : "active"

  return {
    status,
    page,
    pageSize,
    kw,
    sort,
    scope,
  }
}

export const serializePostsWorkspaceQueryParams = (
  params: PostsWorkspaceQueryParams
): Record<string, string> => {
  const query: Record<string, string> = {}
  if (params.status !== "all") query.status = params.status
  if (params.page !== DEFAULT_PAGE) query.page = params.page
  if (params.pageSize !== DEFAULT_PAGE_SIZE) query.pageSize = params.pageSize
  if (params.kw) query.kw = params.kw
  if (params.sort !== DEFAULT_SORT) query.sort = params.sort
  return query
}
