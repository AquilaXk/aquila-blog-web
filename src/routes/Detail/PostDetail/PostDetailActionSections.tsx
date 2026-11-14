import { memo, type MutableRefObject, type Ref, type RefObject } from "react"
import AppIcon from "src/components/icons/AppIcon"
import { useLanguage } from "src/libs/language"
import { MobileSummaryBar } from "./PostDetail.styles"
import type { TocItem } from "./PostDetailTocModel"

type ShareFeedback = "copied" | "shared" | "failed" | null

export const resolveFloatingShareFeedbackLabel = (
  shareFeedback: Exclude<ShareFeedback, null>,
  isEnglish: boolean = false
): string => {
  if (shareFeedback === "failed") return isEnglish ? "Failed to share" : "공유 실패"
  if (shareFeedback === "shared") return isEnglish ? "Shared" : "공유 완료"
  return isEnglish ? "Link copied" : "복사 완료"
}

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

const formatLikeAriaLabel = (likeLabel: string, count: number, isEnglish: boolean) =>
  isEnglish ? `${likeLabel} (${count})` : `${likeLabel} (현재 ${count}개)`

type FloatingActionRailProps = {
  railRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLDivElement | null>
  active: boolean
  showFloatingLike: boolean
  likesCount: number
  liked?: boolean
  likePending?: boolean
  onToggleLike?: () => void
  shareFeedback: ShareFeedback
  onSharePost: () => void
}

export const FloatingActionRail = memo(function FloatingActionRail({
  railRef,
  innerRef,
  active,
  showFloatingLike,
  likesCount,
  liked = false,
  likePending = false,
  onToggleLike,
  shareFeedback,
  onSharePost,
}: FloatingActionRailProps) {
  const { t, language } = useLanguage()
  const isEnglish = language === "en"
  const likeLabel = liked ? t("postUnlikeAction") : t("postLikeAction")
  const likeAriaLabel = formatLikeAriaLabel(likeLabel, likesCount, isEnglish)
  return (
    <aside ref={railRef as Ref<HTMLElement>} className="leftRail" data-hybrid-active={active} aria-hidden={!showFloatingLike}>
      {showFloatingLike ? (
        <div ref={innerRef as Ref<HTMLDivElement>} className="leftRailInner">
          <div className="floatingLikeCluster">
            <div className="floatingLikeStat">
              <button
                type="button"
                className="floatingActionButton floatingLikeBadge"
                aria-pressed={liked}
                data-active={liked}
                title={likeLabel}
                data-tooltip={likeLabel}
                aria-label={likeAriaLabel}
                disabled={likePending || !onToggleLike}
                onClick={onToggleLike}
              >
                <AppIcon name={liked ? "heart-filled" : "heart"} />
              </button>
              <span className="floatingLikeCount">{`${t("postLikeAction")} ${likesCount}`}</span>
            </div>
            <div className="floatingShareStat">
              <button
                type="button"
                className="floatingActionButton floatingShareButton"
                title={t("postShareAction")}
                data-tooltip={t("postShareAction")}
                aria-label={t("postShareAria")}
                onClick={onSharePost}
              >
                <AppIcon name="share" />
              </button>
            </div>
            {shareFeedback ? (
              <span className="floatingShareFeedback" role="status" aria-live="polite">
                {resolveFloatingShareFeedbackLabel(shareFeedback, isEnglish)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  )
})

type MobileSummaryActionsProps = {
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

type RightTocRailProps = {
  railRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLElement | null>
  listRef: RefObject<HTMLOListElement | null>
  buttonRefsById?: MutableRefObject<Map<string, HTMLButtonElement>>
  active: boolean
  showStickyToc: boolean
  visibleTocItems: TocItem[]
  activeTocId: string
  hasDepth4Toc: boolean
  showDetailedToc: boolean
  onToggleDetailed: () => void
  onNavigate: (id: string) => void
}

export const RightTocRail = memo(function RightTocRail({
  railRef,
  innerRef,
  listRef,
  buttonRefsById,
  active,
  showStickyToc,
  visibleTocItems,
  activeTocId,
  hasDepth4Toc,
  showDetailedToc,
  onToggleDetailed,
  onNavigate,
}: RightTocRailProps) {
  const { t } = useLanguage()
  return (
    <aside ref={railRef as Ref<HTMLElement>} className="rightRail" data-hybrid-active={active} aria-hidden={!showStickyToc}>
      {showStickyToc ? (
        <nav ref={innerRef as Ref<HTMLElement>} className="rightRailInner" aria-label={t("postTocLabel")}>
          <div className="rightRailHead">
            <div className="rightRailTitleGroup">
              <h2 className="rightRailTitle">{t("postTocLabel")}</h2>
            </div>
            {hasDepth4Toc && (
              <button
                type="button"
                className="tocDepthToggle"
                onClick={onToggleDetailed}
                aria-pressed={showDetailedToc}
              >
                {showDetailedToc ? t("postTocHideDetailed") : t("postTocShowDetailed")}
              </button>
            )}
          </div>
          <ol ref={listRef as Ref<HTMLOListElement>}>
            {visibleTocItems.map((item) => (
              <li key={item.id} data-level={item.level}>
                <button
                  ref={(node) => {
                    if (!buttonRefsById) return
                    if (node) {
                      buttonRefsById.current.set(item.id, node)
                    } else {
                      buttonRefsById.current.delete(item.id)
                    }
                  }}
                  type="button"
                  data-active={activeTocId === item.id}
                  aria-current={activeTocId === item.id ? "location" : undefined}
                  title={item.text}
                  aria-label={item.text}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </aside>
  )
})
