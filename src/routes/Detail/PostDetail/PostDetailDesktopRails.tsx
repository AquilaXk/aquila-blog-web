/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (layouts/PostLayout.tsx, MIT License)
 * - fuma-nama/fumadocs (packages/ui/src/components/layout/toc.tsx, MIT License)
 */
import { memo, type MutableRefObject, type Ref, type RefObject } from "react"
import Link from "next/link"
import AppIcon from "src/components/icons/AppIcon"
import ProfileImage from "src/components/ProfileImage"
import { useLanguage } from "src/libs/language"
import type { TocItem } from "./PostDetailTocModel"

export type ShareFeedback = "copied" | "shared" | "failed" | null

export const resolveFloatingShareFeedbackLabel = (
  shareFeedback: Exclude<ShareFeedback, null>,
  isEnglish: boolean = false
): string => {
  if (shareFeedback === "failed") return isEnglish ? "Failed to share" : "공유 실패"
  if (shareFeedback === "shared") return isEnglish ? "Shared" : "공유 완료"
  return isEnglish ? "Link copied" : "복사 완료"
}

export const formatLikeAriaLabel = (likeLabel: string, count: number, isEnglish: boolean) =>
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
            {visibleTocItems.map((item) => {
              const isItemActive = activeTocId === item.id
              return (
                <li key={item.id} data-level={item.level} data-active={isItemActive}>
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
                    data-active={isItemActive}
                    aria-current={isItemActive ? "location" : undefined}
                    title={item.text}
                    aria-label={item.text}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.text}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}
    </aside>
  )
})

export type PostLayoutSidebarProps = {
  authorName: string
  authorImageSrc: string
  viewText: string
  readingMinutes?: number
  tags: string[]
  isPostType: boolean
  likesCount: number
  liked: boolean
  likePending: boolean
  onToggleLike?: () => void
  shareFeedback: ShareFeedback
  onSharePost: () => void
  railRef: RefObject<HTMLElement | null>
  innerRef: RefObject<HTMLElement | null>
  listRef: RefObject<HTMLOListElement | null>
  buttonRefsById: MutableRefObject<Map<string, HTMLButtonElement>>
  active: boolean
  showStickyToc: boolean
  visibleTocItems: TocItem[]
  activeTocId: string
  hasDepth4Toc: boolean
  showDetailedToc: boolean
  onToggleDetailed: () => void
  onNavigate: (id: string) => void
}

export const PostLayoutSidebar = memo(function PostLayoutSidebar({
  authorName,
  authorImageSrc,
  viewText,
  readingMinutes,
  tags,
  isPostType,
  likesCount,
  liked,
  likePending,
  onToggleLike,
  shareFeedback,
  onSharePost,
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
}: PostLayoutSidebarProps) {
  const { t, language } = useLanguage()
  const isEnglish = language === "en"
  const likeLabel = liked ? t("postUnlikeAction") : t("postLikeAction")
  const likeAriaLabel = formatLikeAriaLabel(likeLabel, likesCount, isEnglish)
  const readingCopy =
    readingMinutes && readingMinutes > 0
      ? isEnglish
        ? `${readingMinutes}${t("postReadingMinutes")}`
        : `약 ${readingMinutes}${t("postReadingMinutes")}`
      : ""

  return (
    <aside className="postSidebar">
      <dl className="sidebarAuthorList">
        <dt className="srOnly">{t("metaAuthor")}</dt>
        <dd className="sidebarAuthorRow">
          <div className="sidebarAvatar">
            {authorImageSrc ? (
              <ProfileImage
                src={authorImageSrc}
                alt={`${authorName} profile image`}
                fillContainer
                width={38}
                height={38}
              />
            ) : (
              <span className="sidebarAvatarFallback" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
            )}
          </div>
          <div className="sidebarAuthorInfo">
            <span className="sidebarAuthorName">{authorName}</span>
            <span className="sidebarAuthorStats">
              <span className="stats">
                <span className="statChip">{viewText}</span>
              </span>
              {readingCopy ? ` · ${readingCopy}` : ""}
            </span>
          </div>
        </dd>
      </dl>

      <div className="sidebarDivided">
        {tags.length > 0 ? (
          <div className="sidebarSection">
            <h2 className="sidebarHeading">{isEnglish ? "Tags" : "태그"}</h2>
            <div className="sidebarTagList">
              {tags.map((tag) => (
                <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="sidebarTagLink">
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {isPostType ? (
          <div className="sidebarSection">
            <h2 className="sidebarHeading">{isEnglish ? "Feedback" : "반응"}</h2>
            <div
              className="sidebarActionsRow"
              role="group"
              aria-label={isEnglish ? "Post engagement" : "게시글 반응"}
            >
              <button
                type="button"
                className="sidebarActionButton"
                aria-pressed={liked}
                data-active={liked}
                aria-label={likeAriaLabel}
                disabled={likePending || !onToggleLike}
                onClick={onToggleLike}
              >
                <AppIcon name={liked ? "heart-filled" : "heart"} />
                <span>{`${t("postLikeAction")} ${likesCount}`}</span>
              </button>
              <button
                type="button"
                className="sidebarActionButton"
                aria-label={t("postShareAria")}
                onClick={onSharePost}
              >
                <AppIcon name="share" />
                <span>
                  {shareFeedback
                    ? resolveFloatingShareFeedbackLabel(shareFeedback, isEnglish)
                    : t("postShareAction")}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {showStickyToc ? (
          <div className="sidebarSection sidebarStickySlot">
            <RightTocRail
              railRef={railRef}
              innerRef={innerRef}
              listRef={listRef}
              buttonRefsById={buttonRefsById}
              active={active}
              showStickyToc={showStickyToc}
              visibleTocItems={visibleTocItems}
              activeTocId={activeTocId}
              hasDepth4Toc={hasDepth4Toc}
              showDetailedToc={showDetailedToc}
              onToggleDetailed={onToggleDetailed}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
      </div>

      <div className="sidebarBackWrap">
        <Link href="/" className="sidebarBackLink">
          <span aria-hidden="true">←</span>
          <span>{t("postAllPosts")}</span>
        </Link>
      </div>
    </aside>
  )
})
