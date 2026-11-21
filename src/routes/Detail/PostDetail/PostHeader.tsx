/**
 * 참조 구현:
 * - timlrx/tailwind-nextjs-starter-blog (MIT License)
 * - fuma-nama/fumadocs (MIT License)
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/avatar.tsx, MIT License)
 * - lucide-icons/lucide (icons/user.svg, icons/arrow-left.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { CONFIG } from "site.config"
import AppIcon from "src/components/icons/AppIcon"
import ProfileImage from "src/components/ProfileImage"
import { formatDateTime, isDefaultCategoryValue, splitCategoryDisplay } from "src/libs/utils"
import { translations, useLanguage } from "src/libs/language"
import { PostDetail } from "src/types"
import type { PostHeaderThumbnailProps } from "./PostHeaderThumbnail"
import { StyledWrapper } from "./PostHeader.styles"

const PostHeaderThumbnail = dynamic<PostHeaderThumbnailProps>(
  () => import("./PostHeaderThumbnail")
)

type Props = {
  data: PostDetail
  likesCount?: number
  liked?: boolean
  likePending?: boolean
  onToggleLike?: () => void
  hitCount?: number
  hideShareActionOnDesktop?: boolean
  hideActionButtonsOnMobile?: boolean
  shareFeedback?: "copied" | "shared" | "failed" | null
  onSharePost?: () => void
  deckSummary?: string
  showEngagement?: boolean
  showReadingTime?: boolean
  readingMinutes?: number
  showThumbnail?: boolean
}

const resolvePostAuthorMeta = (data: PostDetail, locale: string = CONFIG.lang) => {
  const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null
  const fallbackAuthor = locale.startsWith("en") ? "Anonymous" : "익명"
  const authorName = data.authorName?.trim() || postAuthor?.name?.trim() || fallbackAuthor
  const authorImageSrc = data.authorProfileImgUrl || postAuthor?.profile_photo || ""
  return {
    authorName,
    authorImageSrc,
  }
}

const resolvePostDates = (data: PostDetail, locale: string = CONFIG.lang) => {
  const effectiveCreated = data.createdAt || data.createdTime || ""
  const effectiveModified = data.modifiedAt || data.modifiedTime || ""
  const publishedAt = formatDateTime(effectiveCreated, locale)
  const modifiedAt =
    effectiveModified && effectiveModified !== effectiveCreated
      ? formatDateTime(effectiveModified, locale)
      : ""
  return { publishedAt, modifiedAt }
}

const resolveShareFeedbackMessage = (
  shareFeedback: Props["shareFeedback"],
  locale: string = CONFIG.lang
): string => {
  const isEnglish = locale.toLowerCase().startsWith("en")
  if (shareFeedback === "failed") return isEnglish ? "Failed to share." : "공유에 실패했습니다."
  if (shareFeedback === "shared") return isEnglish ? "Shared" : "공유 완료"
  return isEnglish ? "Link copied" : "복사 완료"
}

const numberFormatters = new Map<string, Intl.NumberFormat>()

const getNumberFormatter = (locale: string): Intl.NumberFormat => {
  let formatter = numberFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale)
    numberFormatters.set(locale, formatter)
  }
  return formatter
}

const findPrimaryTag = (tags?: readonly string[] | null): string => {
  if (!tags) return ""
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (trimmed) return trimmed
  }
  return ""
}

const resolvePrimaryTaxonomy = (data: PostDetail): string => {
  const rawCategory = data.category?.[0]?.trim() || ""
  if (rawCategory && !isDefaultCategoryValue(rawCategory)) {
    const parsed = splitCategoryDisplay(rawCategory).label.trim()
    if (parsed && !isDefaultCategoryValue(parsed)) return parsed
  }
  return findPrimaryTag(data.tags)
}

const resolveHeroLabels = (
  data: PostDetail,
  primaryTaxonomy: string = resolvePrimaryTaxonomy(data)
): string[] => {
  const rawTypeLabel = data.type?.[0]?.trim() || "Post"
  const typeLabel = rawTypeLabel === "Post" ? "" : rawTypeLabel
  return [primaryTaxonomy, typeLabel].filter(Boolean)
}

export const shouldRenderPostHeader = (data: PostDetail | null | undefined): boolean => {
  if (!data) return false
  if ((data.type?.[0] ?? "Post") === "Post") return true
  const primaryTaxonomy = resolvePrimaryTaxonomy(data)
  const hasVisibleTags = Array.isArray(data.tags) && data.tags.some((tag) => Boolean(tag?.trim()))
  return Boolean(
    data.title?.trim() ||
      data.summary?.trim() ||
      primaryTaxonomy ||
      data.thumbnail?.trim() ||
      hasVisibleTags ||
      data.createdAt ||
      data.createdTime
  )
}

export const resolvePostHeaderViewModel = (props: Props, locale: string = CONFIG.lang) => {
  const { data, likesCount, hitCount, shareFeedback = null, deckSummary } = props
  const { authorName, authorImageSrc } = resolvePostAuthorMeta(data, locale)
  const { publishedAt, modifiedAt } = resolvePostDates(data, locale)
  const primaryTaxonomy = resolvePrimaryTaxonomy(data)
  const heroLabels = resolveHeroLabels(data, primaryTaxonomy)
  const rawThumbnail = data.thumbnail?.trim() || ""
  const shareFeedbackMessage = resolveShareFeedbackMessage(shareFeedback, locale)
  const resolvedDeckSummary = deckSummary ?? data.summary ?? ""
  const viewCount = hitCount ?? data.hitCount ?? 0
  const isEnglish = locale.toLowerCase().startsWith("en")
  const headerT = isEnglish ? translations.en : translations.ko
  const formattedViews = getNumberFormatter(locale).format(viewCount)
  const viewText = isEnglish
    ? `${formattedViews} ${headerT.postViewsLabel}`
    : `${headerT.postViewsLabel} ${formattedViews}`
  const resolvedLikesCount = likesCount ?? data.likesCount ?? 0

  return {
    authorName,
    authorImageSrc,
    primaryTaxonomy,
    heroLabels,
    publishedAt,
    modifiedAt,
    rawThumbnail,
    shareFeedbackMessage,
    resolvedDeckSummary,
    viewText,
    resolvedLikesCount,
  }
}

const PostHeaderAuthorMeta: React.FC<{
  authorName: string
  authorImageSrc: string
}> = ({ authorName, authorImageSrc }) => {
  if (!authorName) return null
  return (
    <div className="author">
      <div className="avatar">
        {authorImageSrc ? (
          <ProfileImage
            src={authorImageSrc}
            alt={`${authorName} profile image`}
            fillContainer
            width={38}
            height={38}
          />
        ) : (
          <span className="avatarFallback" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
        )}
      </div>
      <div className="authorText">
        <strong>{authorName}</strong>
      </div>
    </div>
  )
}

export const PostHeaderEngagementSection: React.FC<{
  publishedAt: string
  viewText: string
  showReadingTime: boolean
  readingMinutes?: number
  modifiedAt: string
  resolvedLikesCount: number
  liked: boolean
  likePending: boolean
  onToggleLike?: () => void
  hideShareActionOnDesktop: boolean
  hideActionButtonsOnMobile: boolean
  onSharePost?: () => void
  shareFeedback: Props["shareFeedback"]
  shareFeedbackMessage: string
}> = ({
  publishedAt,
  viewText,
  showReadingTime,
  readingMinutes,
  modifiedAt,
  resolvedLikesCount,
  liked,
  likePending,
  onToggleLike,
  hideShareActionOnDesktop,
  hideActionButtonsOnMobile,
  onSharePost,
  shareFeedback,
  shareFeedbackMessage,
}) => {
  const { t, language } = useLanguage()
  const hasReadingTime = Boolean(showReadingTime && readingMinutes && readingMinutes > 0)
  const readingMinutesValue = Math.max(1, readingMinutes ?? 1)
  const readingTimeCopy =
    language === "en"
      ? `${readingMinutesValue}${t("postReadingMinutes")}`
      : `약 ${readingMinutesValue}${t("postReadingMinutes")}`
  const likeLabel = liked ? t("postUnlikeAction") : t("postLikeAction")
  const likeAriaLabel =
    language === "en"
      ? `${likeLabel} (${resolvedLikesCount})`
      : `${likeLabel} (현재 ${resolvedLikesCount}개)`
  return (
    <div className="metaUtilities">
      <div className="actions" data-hide-mobile={hideActionButtonsOnMobile}>
        <div className="engagementRow" aria-label={t("postEngagementAria")}>
          <div className="stats" aria-label={t("postStatsAria")}>
            <span className="statChip">{publishedAt}</span>
            <span className="statChip">{viewText}</span>
            {hasReadingTime ? (
              <span className="statChip metaReadingTime">
                {readingTimeCopy}
              </span>
            ) : null}
            {modifiedAt ? (
              <span className="statChip">{`${t("postUpdatedLabel")} ${modifiedAt}`}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="likeButton"
            aria-pressed={liked}
            data-active={liked}
            aria-label={likeAriaLabel}
            disabled={likePending || !onToggleLike}
            onClick={onToggleLike}
          >
            <AppIcon name={liked ? "heart-filled" : "heart"} />
            <span>{`${t("postLikeAction")} ${resolvedLikesCount}`}</span>
          </button>
          {onSharePost ? (
            <button
              type="button"
              className="shareButton"
              data-hide-desktop={hideShareActionOnDesktop}
              aria-label={t("postShareAria")}
              onClick={onSharePost}
            >
              <AppIcon name="share" />
              <span>{t("postShareAction")}</span>
            </button>
          ) : null}
        </div>
        {shareFeedback ? (
          <span
            className="shareFeedbackPill"
            data-hide-desktop={hideShareActionOnDesktop}
            role="status"
            aria-live="polite"
          >
            {language === "en" ? resolveShareFeedbackMessage(shareFeedback, "en") : shareFeedbackMessage}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const PostHeader: React.FC<Props> = (props) => {
  const { t, language } = useLanguage()
  const {
    data,
    liked = false,
    likePending = false,
    onToggleLike,
    hideShareActionOnDesktop = false,
    hideActionButtonsOnMobile = false,
    shareFeedback = null,
    onSharePost,
    showEngagement = true,
    showReadingTime = false,
    readingMinutes,
    showThumbnail = false,
  } = props
  const locale = language === "en" ? "en-US" : CONFIG.lang
  const vm = resolvePostHeaderViewModel(props, locale)
  const isPostType = (data.type?.[0] ?? "Post") === "Post"
  const rawDate = data.createdAt || data.date?.start_date || data.createdTime || ""

  return (
    <StyledWrapper>
      {!isPostType && vm.heroLabels.length > 0 ? (
        <div className="heroLabel">
          {vm.heroLabels.map((label, index) => (
            <React.Fragment key={label}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {index === 0 && label === vm.primaryTaxonomy ? (
                <Link
                  href={`/?tag=${encodeURIComponent(vm.primaryTaxonomy)}`}
                  className="heroLabelLink"
                >
                  {label}
                </Link>
              ) : (
                label
              )}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {vm.publishedAt ? (
        <dl className="headerDateList">
          <dt className="srOnly">{t("metaDate")}</dt>
          <dd className="headerDate">
            <time dateTime={rawDate}>{vm.publishedAt}</time>
            {vm.modifiedAt ? (
              <span className="headerModified">
                {" · "}
                {`${t("postUpdatedLabel")} ${vm.modifiedAt}`}
              </span>
            ) : null}
          </dd>
        </dl>
      ) : null}
      <h1 className="title">{data.title}</h1>
      {vm.resolvedDeckSummary ? <p className="deck">{vm.resolvedDeckSummary}</p> : null}

      <div className="headerMobileMeta">
        <div className="metaRow">
          <PostHeaderAuthorMeta
            authorName={vm.authorName}
            authorImageSrc={vm.authorImageSrc}
          />
          {showEngagement ? (
            <PostHeaderEngagementSection
              publishedAt={vm.publishedAt}
              viewText={vm.viewText}
              showReadingTime={showReadingTime}
              readingMinutes={readingMinutes}
              modifiedAt={vm.modifiedAt}
              resolvedLikesCount={vm.resolvedLikesCount}
              liked={liked}
              likePending={likePending}
              onToggleLike={onToggleLike}
              hideShareActionOnDesktop={hideShareActionOnDesktop}
              hideActionButtonsOnMobile={hideActionButtonsOnMobile}
              onSharePost={onSharePost}
              shareFeedback={shareFeedback}
              shareFeedbackMessage={vm.shareFeedbackMessage}
            />
          ) : null}
        </div>
      </div>

      {showThumbnail && vm.rawThumbnail ? (
        <PostHeaderThumbnail rawThumbnail={vm.rawThumbnail} alt={data.title} />
      ) : null}
    </StyledWrapper>
  )
}

export default React.memo(PostHeader)
