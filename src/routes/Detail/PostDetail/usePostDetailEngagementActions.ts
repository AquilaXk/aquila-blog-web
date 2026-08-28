import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "src/apis/backend/client"
import { queryKey } from "src/constants/queryKey"
import { toCanonicalPostPath } from "src/libs/utils/postPath"
import type { PostDetail as PostDetailType } from "src/types"

type RsData<T> = {
  resultCode: string
  msg: string
  data: T
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
  const didIncrementHitRef = useRef<string | null>(null)
  const shareFeedbackResetTimerRef = useRef<number | null>(null)
  const [hitCount, setHitCount] = useState(data?.hitCount ?? 0)
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback | null>(null)
  const shareProgressLabel =
    shareFeedback === "failed"
      ? "재시도"
      : shareFeedback === "shared"
        ? "복사 완료"
        : shareFeedback === "copied"
          ? "복사 완료"
          : null

  useEffect(() => {
    if (!data) return
    setHitCount(data.hitCount ?? 0)
  }, [data, data?.hitCount, data?.id])

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
      .catch(() => {
        // 조회수 증가는 사용자 경험을 막지 않도록 실패를 조용히 흡수한다.
      })

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
    const shareUrl = typeof window !== "undefined" ? window.location.href : canonicalPath

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
        window.prompt("링크를 복사하세요.", shareUrl)
      }
      flashShareFeedback("copied")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      flashShareFeedback("failed")
    }
  }, [data, flashShareFeedback, postId])

  return {
    hitCount,
    handleSharePost,
    shareFeedback,
    shareProgressLabel,
  }
}
