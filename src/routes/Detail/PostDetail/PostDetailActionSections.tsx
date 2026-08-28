import type { Ref, RefObject } from "react"
import AppIcon from "src/components/icons/AppIcon"
import { MobileSummaryBar } from "./PostDetail.styles"
import type { TocItem } from "./PostDetailTocModel"

type ShareFeedback = "copied" | "shared" | "failed" | null

type FloatingActionRailProps = {
  railRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLDivElement | null>
  active: boolean
  showFloatingLike: boolean
  likesCount: number
  shareFeedback: ShareFeedback
  onSharePost: () => void
}

export const FloatingActionRail = ({
  railRef,
  innerRef,
  active,
  showFloatingLike,
  likesCount,
  shareFeedback,
  onSharePost,
}: FloatingActionRailProps) => (
  <aside ref={railRef as Ref<HTMLElement>} className="leftRail" data-hybrid-active={active} aria-hidden={!showFloatingLike}>
    {showFloatingLike ? (
      <div ref={innerRef as Ref<HTMLDivElement>} className="leftRailInner">
        <div className="floatingLikeCluster">
          <div className="floatingLikeStat">
            <span
              className="floatingActionButton floatingLikeButton"
            >
              <AppIcon name="heart" />
            </span>
            <span className="floatingLikeCount">좋아요 {likesCount}</span>
          </div>
          <div className="floatingShareStat">
            <button
              type="button"
              className="floatingActionButton floatingShareButton"
              title="공유"
              data-tooltip="공유"
              aria-label="게시글 공유"
              onClick={onSharePost}
            >
              <AppIcon name="share" />
            </button>
          </div>
          {shareFeedback ? (
            <span className="floatingShareFeedback" role="status" aria-live="polite">
              {shareFeedback === "failed" ? "공유 실패" : "복사 완료"}
            </span>
          ) : null}
        </div>
      </div>
    ) : null}
  </aside>
)

type MobileSummaryActionsProps = {
  likesCount: number
  shareFeedback: ShareFeedback
  shareProgressLabel: string | null
  onSharePost: () => void
}

export const MobileSummaryActions = ({
  likesCount,
  shareFeedback,
  shareProgressLabel,
  onSharePost,
}: MobileSummaryActionsProps) => (
  <MobileSummaryBar aria-label="빠른 이동 및 반응">
    <span data-tone="accent" aria-label={`좋아요 ${likesCount}`}>
      <AppIcon name="heart" />
      <span>{`좋아요 ${likesCount}`}</span>
    </span>
    <button
      type="button"
      data-active={Boolean(shareFeedback)}
      data-tone="accent"
      aria-label={
        shareFeedback === "failed"
          ? "공유 실패, 다시 시도"
          : shareFeedback === "shared"
            ? "링크 복사 완료"
            : shareFeedback === "copied"
              ? "공유 링크 복사 완료"
              : "공유"
      }
      onClick={onSharePost}
    >
      <AppIcon name="share" />
      <span>{shareFeedback === "copied" ? "복사" : shareFeedback === "shared" ? "복사" : shareFeedback === "failed" ? "실패" : "공유"}</span>
      {shareProgressLabel ? <strong>{shareProgressLabel}</strong> : null}
    </button>
  </MobileSummaryBar>
)

type RightTocRailProps = {
  railRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLElement | null>
  listRef: RefObject<HTMLOListElement | null>
  active: boolean
  showStickyToc: boolean
  visibleTocItems: TocItem[]
  activeTocId: string
  hasDepth4Toc: boolean
  showDetailedToc: boolean
  onToggleDetailed: () => void
  onNavigate: (id: string) => void
}

export const RightTocRail = ({
  railRef,
  innerRef,
  listRef,
  active,
  showStickyToc,
  visibleTocItems,
  activeTocId,
  hasDepth4Toc,
  showDetailedToc,
  onToggleDetailed,
  onNavigate,
}: RightTocRailProps) => (
  <aside ref={railRef as Ref<HTMLElement>} className="rightRail" data-hybrid-active={active} aria-hidden={!showStickyToc}>
    {showStickyToc ? (
      <nav ref={innerRef as Ref<HTMLElement>} className="rightRailInner" aria-label="목차">
        <div className="rightRailHead">
          <div className="rightRailTitleGroup">
            <h2 className="rightRailTitle">On this page</h2>
          </div>
          {hasDepth4Toc && (
            <button
              type="button"
              className="tocDepthToggle"
              onClick={onToggleDetailed}
              aria-pressed={showDetailedToc}
            >
              {showDetailedToc ? "h4 접기" : "h4 보기"}
            </button>
          )}
        </div>
        <ol ref={listRef as Ref<HTMLOListElement>}>
          {visibleTocItems.map((item) => (
            <li key={item.id} data-level={item.level}>
              <button
                type="button"
                data-active={activeTocId === item.id}
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
