/* eslint-disable @next/next/no-img-element */
import React from "react"
import Link from "next/link"
import { CONFIG } from "site.config"
import AppIcon from "src/components/icons/AppIcon"
import ProfileImage from "src/components/ProfileImage"
import { formatDateTime } from "src/libs/utils"
import {
  parseThumbnailFocusXFromUrl,
  parseThumbnailFocusYFromUrl,
  parseThumbnailZoomFromUrl,
  stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
import { PostDetail } from "src/types"
import { StyledWrapper } from "./PostHeader.styles"

type Props = {
  data: PostDetail
  likesCount?: number
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

const resolvePostAuthorMeta = (data: PostDetail) => {
  const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null
  const authorName = data.authorName?.trim() || postAuthor?.name?.trim() || "익명"
  const authorImageSrc = data.authorProfileImgUrl || postAuthor?.profile_photo || ""
  return {
    authorName,
    authorImageSrc,
  }
}

const resolvePostDates = (data: PostDetail) => {
  const effectiveCreated = data.createdAt || data.createdTime || ""
  const effectiveModified = data.modifiedAt || data.modifiedTime || ""
  const publishedAt = formatDateTime(effectiveCreated, CONFIG.lang)
  const modifiedAt =
    effectiveModified && effectiveModified !== effectiveCreated
      ? formatDateTime(effectiveModified, CONFIG.lang)
      : ""
  return { publishedAt, modifiedAt }
}

const resolveShareFeedbackMessage = (
  shareFeedback: Props["shareFeedback"]
): string => {
  if (shareFeedback === "failed") return "공유에 실패했습니다."
  return "복사 완료"
}

const resolveHeroLabels = (data: PostDetail): string[] => {
  const tags = (data.tags || []).map((tag) => tag.trim()).filter(Boolean)
  const primaryTaxonomy = (data.category?.[0] || tags[0] || "").trim()
  const rawTypeLabel = data.type?.[0]?.trim() || "Post"
  const typeLabel = rawTypeLabel === "Post" ? "Production note" : rawTypeLabel
  return primaryTaxonomy ? [primaryTaxonomy, typeLabel] : [typeLabel]
}

export const resolvePostHeaderViewModel = (props: Props) => {
  const { data, likesCount, hitCount, shareFeedback = null, deckSummary } = props
  const { authorName, authorImageSrc } = resolvePostAuthorMeta(data)
  const { publishedAt, modifiedAt } = resolvePostDates(data)
  const heroLabels = resolveHeroLabels(data)
  const rawThumbnail = data.thumbnail || ""
  const thumbnailSrc = rawThumbnail
    ? normalizePublicPostImageUrl(stripThumbnailFocusFromUrl(rawThumbnail))
    : ""
  const thumbnailFocusX = parseThumbnailFocusXFromUrl(rawThumbnail)
  const thumbnailFocusY = parseThumbnailFocusYFromUrl(rawThumbnail)
  const thumbnailZoom = parseThumbnailZoomFromUrl(rawThumbnail)
  const shareFeedbackMessage = resolveShareFeedbackMessage(shareFeedback)
  const resolvedDeckSummary = deckSummary ?? data.summary ?? ""
  const viewCount = hitCount ?? data.hitCount ?? 0
  const viewText = `${Intl.NumberFormat(CONFIG.lang).format(viewCount)} VIEWS`
  const resolvedLikesCount = likesCount ?? data.likesCount ?? 0

  return {
    authorName,
    authorImageSrc,
    heroLabels,
    publishedAt,
    modifiedAt,
    thumbnailSrc,
    thumbnailFocusX,
    thumbnailFocusY,
    thumbnailZoom,
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
          <span className="avatarFallback" aria-hidden="true" />
        )}
      </div>
      <div className="authorText">
        <strong>{authorName}</strong>
      </div>
    </div>
  )
}

const PostHeaderEngagementSection: React.FC<{
  publishedAt: string
  viewText: string
  showReadingTime: boolean
  readingMinutes?: number
  modifiedAt: string
  resolvedLikesCount: number
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
  hideShareActionOnDesktop,
  hideActionButtonsOnMobile,
  onSharePost,
  shareFeedback,
  shareFeedbackMessage,
}) => {
  const hasReadingTime = Boolean(showReadingTime && readingMinutes && readingMinutes > 0)
  return (
    <div className="metaUtilities">
      <div className="actions" data-hide-mobile={hideActionButtonsOnMobile}>
        <div className="engagementRow" aria-label="post engagement">
          <div className="stats" aria-label="post stats">
            <span className="statChip">{publishedAt}</span>
            <span className="statChip">{viewText}</span>
            {hasReadingTime ? (
              <span className="statChip metaReadingTime">
                {`약 ${Math.max(1, readingMinutes ?? 1)}분 읽기`}
              </span>
            ) : null}
            {modifiedAt ? <span className="statChip">UPDATED {modifiedAt}</span> : null}
          </div>
          <span className="likeButton" data-hide-mobile={hideActionButtonsOnMobile}>
            <AppIcon name="heart" />
            <span>좋아요 {resolvedLikesCount}</span>
          </span>
          {onSharePost ? (
            <button
              type="button"
              className="shareButton"
              data-hide-desktop={hideShareActionOnDesktop}
              data-hide-mobile={hideActionButtonsOnMobile}
              aria-label="게시글 공유"
              onClick={onSharePost}
            >
              <AppIcon name="share" />
              <span>공유</span>
            </button>
          ) : null}
        </div>
        {shareFeedback ? (
          <span
            className="shareFeedbackPill"
            data-hide-desktop={hideShareActionOnDesktop}
            data-hide-mobile={hideActionButtonsOnMobile}
            role="status"
            aria-live="polite"
          >
            {shareFeedbackMessage}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const PostHeader: React.FC<Props> = (props) => {
  const {
    data,
    hideShareActionOnDesktop = false,
    hideActionButtonsOnMobile = false,
    shareFeedback = null,
    onSharePost,
    showEngagement = true,
    showReadingTime = false,
    readingMinutes,
    showThumbnail = true,
  } = props
  const vm = resolvePostHeaderViewModel(props)

  return (
    <StyledWrapper>
      <Link href="/" className="backLink">
        <span aria-hidden="true">←</span>
        <span>모든 글</span>
      </Link>
      {vm.heroLabels.length > 0 ? (
        <div className="heroLabel">
          {vm.heroLabels.map((label, index) => (
            <React.Fragment key={label}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {label}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <h1 className="title">{data.title}</h1>
      {vm.resolvedDeckSummary ? <p className="deck">{vm.resolvedDeckSummary}</p> : null}

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
            hideShareActionOnDesktop={hideShareActionOnDesktop}
            hideActionButtonsOnMobile={hideActionButtonsOnMobile}
            onSharePost={onSharePost}
            shareFeedback={shareFeedback}
            shareFeedbackMessage={vm.shareFeedbackMessage}
          />
        ) : null}
      </div>

      {showThumbnail && vm.thumbnailSrc ? (
        <div className="thumbnail">
          <img
            src={vm.thumbnailSrc}
            alt={data.title}
            loading="eager"
            {...({ fetchpriority: "high" } as Record<string, string>)}
            decoding="async"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${vm.thumbnailFocusX}% ${vm.thumbnailFocusY}%`,
              transform: `scale(${vm.thumbnailZoom})`,
              transformOrigin: `${vm.thumbnailFocusX}% ${vm.thumbnailFocusY}%`,
            }}
          />
        </div>
      ) : null}
    </StyledWrapper>
  )
}

export default React.memo(PostHeader)
