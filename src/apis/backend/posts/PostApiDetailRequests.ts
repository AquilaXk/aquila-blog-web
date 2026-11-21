import type { PostDetail } from "src/types"
import { ApiError, apiFetch } from "../client"
import type { ApiPostWithContentDto } from "./PostApiDtos"
import { extractPostIdFromSlug, mapPostDetail } from "./PostApiMappers"

export const getPostDetailBySlug = async (slug: string): Promise<PostDetail | null> => {
  const postId = extractPostIdFromSlug(slug)
  if (!postId) return null

  try {
    const post = await apiFetch<ApiPostWithContentDto>(`/post/api/v1/posts/${postId}`)
    const mapped = await mapPostDetail(post, {
      allowTrustedContentHtml: true,
    })

    // slug mismatch should 404 to avoid duplicate-url indexing.
    if (mapped.slug !== slug) return null

    return mapped
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export const getPostDetailById = async (id: string): Promise<PostDetail | null> => {
  const postId = Number(id)
  if (!Number.isInteger(postId) || postId <= 0) return null
  const endpoint = `/post/api/v1/posts/${postId}`
  // 공개 범위는 변경될 수 있으므로 요청 간 본문·진행 중 응답을 공유하지 않는다.
  try {
    const post = await apiFetch<ApiPostWithContentDto>(endpoint)
    return await mapPostDetail(post, { allowTrustedContentHtml: true })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}
