/**
 * 참조 구현:
 * - fuma-nama/fumadocs (MIT License)
 * - shadcn-ui/ui (MIT License)
 */
import { memo } from "react"
import AppIcon from "src/components/icons/AppIcon"
import { useLanguage } from "src/libs/language"
import { MobileSummaryBar } from "./PostDetailSection.styles"
import {
  FloatingActionRail,
  PostLayoutSidebar,
  RightTocRail,
  formatLikeAriaLabel,
  resolveFloatingShareFeedbackLabel,
  type ShareFeedback,
} from "./PostDetailDesktopRails"

export { FloatingActionRail, PostLayoutSidebar, RightTocRail, resolveFloatingShareFeedbackLabel }

export const resolveMobileShareAriaLabel = (
  shareFeedback: ShareFeedback,
  isEnglish: boolean = false
): string => {
  if (shareFeedback === "failed") return isEnglish ? "Share failed, try again" : "공유 실패, 다시 시도"
  if (shareFeedback === "shared") return isEnglish ? "Shared" : "공유 완료"
  if (shareFeedback === "copied") return isEnglish ? "Link copied" : "공유 링크 복사 완료"
  return isEnglish ? "Share" : "공유"
}

export const resolveMobileShareButtonLabel = (
  shareFeedback: ShareFeedback,
  isEnglish: boolean = false
): string =>
  shareFeedback
    ? resolveFloatingShareFeedbackLabel(shareFeedback, isEnglish)
    : isEnglish
      ? "Share"
      : "공유"

export type MobileSummaryActionsProps = {
  likesCount: number
  liked?: boolean
  likePending?: boolean
  onToggleLike?: () => void
  shareFeedback: ShareFeedback
  onSharePost: () => void
}

export const MobileSummaryActions = memo(function MobileSummaryActions({
  likesCount,
  liked = false,
  likePending = false,
  onToggleLike,
  shareFeedback,
  onSharePost,
}: MobileSummaryActionsProps) {
  const { t, language } = useLanguage()
  const isEnglish = language === "en"
  const likeLabel = liked ? t("postUnlikeAction") : t("postLikeAction")
  const likeAriaLabel = formatLikeAriaLabel(likeLabel, likesCount, isEnglish)
  return (
    <MobileSummaryBar aria-label={isEnglish ? "Quick actions and reactions" : "빠른 이동 및 반응"}>
      <button
        type="button"
        className="mobileLikeStat"
        aria-pressed={liked}
        data-active={liked}
        data-feedback="true"
        aria-label={likeAriaLabel}
        disabled={likePending || !onToggleLike}
        onClick={onToggleLike}
      >
        <AppIcon name={liked ? "heart-filled" : "heart"} />
        <span>{`${t("postLikeAction")} ${likesCount}`}</span>
      </button>
      <button
        type="button"
        data-active={Boolean(shareFeedback)}
        data-feedback={Boolean(shareFeedback)}
        data-tone="accent"
        aria-live="polite"
        aria-label={resolveMobileShareAriaLabel(shareFeedback, isEnglish)}
        onClick={onSharePost}
      >
        <AppIcon name="share" />
        <span>{resolveMobileShareButtonLabel(shareFeedback, isEnglish)}</span>
      </button>
    </MobileSummaryBar>
  )
})
