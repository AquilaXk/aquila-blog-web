import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "src/apis/backend/client"
import { queryKey } from "src/constants/queryKey"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import type { PostDetail as PostDetailType, RsData } from "src/types"

export const LIKED_POSTS_STORAGE_KEY = "aquila_blog_liked_posts_v1"
const LIKED_POSTS_MAX_ENTRIES = 200
const SAFE_POST_ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"

const toSafeLikedPostId = (rawPostId: string): string => {
  const trimmed = rawPostId.trim()
  if (!trimmed || trimmed.length > 64) return ""
  let safeId = ""
  for (let i = 0; i < trimmed.length; i += 1) {
    const idx = SAFE_POST_ID_ALPHABET.indexOf(trimmed[i])
    if (idx < 0) return ""
    safeId += SAFE_POST_ID_ALPHABET[idx]
  }
  return safeId
}

export const readLikedPostIds = (): string[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(LIKED_POSTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const ids: string[] = []
    for (const item of parsed) {
      if (typeof item !== "string") continue
      const safeId = toSafeLikedPostId(item)
      if (safeId && !ids.includes(safeId)) {
        ids.push(safeId)
      }
    }
    return ids.slice(-LIKED_POSTS_MAX_ENTRIES)
  } catch {
    return []
  }
}

export const isPostLikedInStorage = (postId: string): boolean => {
  const normalized = toSafeLikedPostId(postId)
  if (!normalized) return false
  return readLikedPostIds().includes(normalized)
}

export const writePostLikedInStorage = (postId: string, liked: boolean): void => {
  if (typeof window === "undefined") return
  const normalized = toSafeLikedPostId(postId)
  if (!normalized) return
  try {
    const existing = readLikedPostIds().filter((id) => id !== normalized)
    const next = liked
      ? [...existing, normalized].slice(-LIKED_POSTS_MAX_ENTRIES)
      : existing
    window.localStorage.setItem(LIKED_POSTS_STORAGE_KEY, JSON.stringify(next))
  } catch {
  }
}

type ShareFeedback = "copied" | "shared" | "failed"

type UsePostDetailEngagementActionsArgs = {
  data?: PostDetailType
  postId: string
}

export const usePostDetailEngagementActions = ({
  data,
  postId,
}: UsePostDetailEngagementActionsArgs) => {
  const queryClient = useQueryClient()
  const detailId = data?.id
  const incomingHitCount = data?.hitCount
  const incomingLikesCount = data?.likesCount
  const hasData = Boolean(data)
  const activeDetailIdRef = useRef<string | undefined>(detailId)
  activeDetailIdRef.current = detailId
  const didIncrementHitRef = useRef<string | null>(null)
  const likeInFlightRef = useRef(false)
  const likeRequestSeqRef = useRef(0)
  const latestPostRequestSeqRef = useRef<Map<string, number>>(new Map())
  const shareFeedbackResetTimerRef = useRef<number | null>(null)
  const [hitCount, setHitCount] = useState(incomingHitCount ?? 0)
  const [likesCount, setLikesCount] = useState(incomingLikesCount ?? 0)
  const [liked, setLiked] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback | null>(null)

  useEffect(() => {
    activeDetailIdRef.current = detailId
    likeInFlightRef.current = false
    setLikePending(false)
    if (!detailId) {
      setLiked(false)
      return
    }
    setLiked(isPostLikedInStorage(String(detailId)))
  }, [detailId])

  useEffect(() => {
    if (!hasData) return
    setHitCount(incomingHitCount ?? 0)
  }, [hasData, detailId, incomingHitCount])

  useEffect(() => {
    if (!hasData) return
    if (likeInFlightRef.current) return
    setLikesCount(incomingLikesCount ?? 0)
  }, [hasData, detailId, incomingLikesCount])

  useEffect(() => {
    if (!detailId) return
    if (didIncrementHitRef.current === detailId) return
    didIncrementHitRef.current = detailId

    let cancelled = false

    void apiFetch<RsData<{ hitCount: number }>>(`/post/api/v1/posts/${detailId}/hit`, {
      method: "POST",
    })
      .then((response) => {
        if (cancelled) return

        setHitCount(response.data.hitCount)
        queryClient.setQueryData<PostDetailType | undefined>(queryKey.post(detailId), (prev) =>
          prev ? { ...prev, hitCount: response.data.hitCount } : prev
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [detailId, queryClient])

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return
      if (shareFeedbackResetTimerRef.current !== null) {
        window.clearTimeout(shareFeedbackResetTimerRef.current)
      }
    }
  }, [])

  const handleToggleLike = useCallback(async () => {
    if (!detailId || likeInFlightRef.current) return
    const requestDetailId = detailId
    const normalizedId = String(requestDetailId)
    const prevLiked = liked
    const prevLikesCount = likesCount
    const nextLiked = !prevLiked
    const optimisticCount = Math.max(0, prevLikesCount + (nextLiked ? 1 : -1))

    const requestSeq = ++likeRequestSeqRef.current
    latestPostRequestSeqRef.current.set(normalizedId, requestSeq)
    const isLatestForPost = () =>
      latestPostRequestSeqRef.current.get(normalizedId) === requestSeq
    const isActiveViewForPost = () =>
      isLatestForPost() && activeDetailIdRef.current === requestDetailId

    likeInFlightRef.current = true
    setLikePending(true)
    setLiked(nextLiked)
    setLikesCount(optimisticCount)
    writePostLikedInStorage(normalizedId, nextLiked)

    try {
      const response = await apiFetch<RsData<{ likesCount: number; liked: boolean }>>(
        `/post/api/v1/posts/${requestDetailId}/like`,
        { method: nextLiked ? "PUT" : "DELETE" }
      )
      const resolvedLiked = Boolean(response.data.liked)
      if (isLatestForPost()) {
        writePostLikedInStorage(normalizedId, resolvedLiked)
        queryClient.setQueryData<PostDetailType | undefined>(
          queryKey.post(requestDetailId),
          (prev) => (prev ? { ...prev, likesCount: response.data.likesCount } : prev)
        )
      }
      if (isActiveViewForPost()) {
        setLiked(resolvedLiked)
        setLikesCount(response.data.likesCount)
      }
    } catch {
      if (isLatestForPost()) {
        writePostLikedInStorage(normalizedId, prevLiked)
      }
      if (isActiveViewForPost()) {
        setLiked(prevLiked)
        setLikesCount(prevLikesCount)
      }
    } finally {
      if (isActiveViewForPost()) {
        likeInFlightRef.current = false
        setLikePending(false)
      }
    }
  }, [detailId, liked, likesCount, queryClient])

  const flashShareFeedback = useCallback((next: ShareFeedback) => {
    if (typeof window === "undefined") return
    setShareFeedback(next)
    if (shareFeedbackResetTimerRef.current !== null) {
      window.clearTimeout(shareFeedbackResetTimerRef.current)
    }
    shareFeedbackResetTimerRef.current = window.setTimeout(() => {
      setShareFeedback(null)
    }, 1600)
  }, [])

  const handleSharePost = useCallback(async () => {
    if (!data) return
    const canonicalPath = toCanonicalPostPath(postId)
    const shareUrl =
      typeof window !== "undefined" ? window.location.href.split("#")[0] : canonicalPath

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: data.title,
          url: shareUrl,
        })
        flashShareFeedback("shared")
        return
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        flashShareFeedback("copied")
        return
      }

      if (typeof window !== "undefined" && typeof window.prompt === "function") {
        const promptResult = window.prompt("링크를 복사하세요.", shareUrl)
        if (promptResult !== null) {
          flashShareFeedback("copied")
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      flashShareFeedback("failed")
    }
  }, [data, flashShareFeedback, postId])

  return {
    hitCount,
    likesCount,
    liked,
    likePending,
    handleToggleLike,
    handleSharePost,
    shareFeedback,
  }
}
