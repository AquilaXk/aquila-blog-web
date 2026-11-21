// 참조 구현: jackyzha0/quartz (MIT) & fuma-nama/fumadocs (MIT) — 이전·다음 글 O(N) 단일 패스 탐색
import type { TPost } from "src/types"

export type AdjacentPostsResult = {
  previousPost: TPost | null
  nextPost: TPost | null
}

export const isEligibleForAdjacentLookup = (
  detailType: string | undefined,
  postId: string | undefined
): boolean => (!detailType || detailType === "Post") && Boolean(postId?.trim())

export const resolveAdjacentPosts = (
  feedPosts: readonly TPost[],
  currentPostId: string
): AdjacentPostsResult => {
  const targetId = currentPostId.trim()
  if (!targetId || feedPosts.length === 0) {
    return { previousPost: null, nextPost: null }
  }

  let matchIndex = -1
  for (let i = 0; i < feedPosts.length; i += 1) {
    const id = String(feedPosts[i]?.id ?? "").trim()
    if (id && id === targetId) {
      matchIndex = i
      break
    }
  }
  if (matchIndex === -1) {
    return { previousPost: null, nextPost: null }
  }

  let nextPost: TPost | null = null
  for (let i = matchIndex - 1; i >= 0; i -= 1) {
    const candidate = feedPosts[i]
    const id = String(candidate?.id ?? "").trim()
    if (id && id !== targetId) {
      nextPost = candidate
      break
    }
  }

  let previousPost: TPost | null = null
  for (let i = matchIndex + 1; i < feedPosts.length; i += 1) {
    const candidate = feedPosts[i]
    const id = String(candidate?.id ?? "").trim()
    if (id && id !== targetId) {
      previousPost = candidate
      break
    }
  }

  return { previousPost, nextPost }
}
