/* eslint-disable @next/next/no-img-element */
import React from "react"
import Link from "next/link"
import { CONFIG } from "site.config"
import AppIcon from "src/components/icons/AppIcon"
import ProfileImage from "src/components/ProfileImage"
import { useRootAdminProfile } from "src/layouts/RootLayout"
import { formatDateTime } from "src/libs/utils"
import {
  parseThumbnailFocusXFromUrl,
  parseThumbnailFocusYFromUrl,
  parseThumbnailZoomFromUrl,
  stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
import { createMarkdownDocumentInsights } from "src/libs/markdown/markdownDocumentInsights"
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
  interactiveTags?: boolean
  showEngagement?: boolean
  showReadingTime?: boolean
  showThumbnail?: boolean
}

const PostHeader: React.FC<Props> = ({
  data,
  likesCount,
  hitCount,
  hideShareActionOnDesktop = false,
  hideActionButtonsOnMobile = false,
  shareFeedback = null,
  onSharePost,
  deckSummary,
  showEngagement = true,
  showReadingTime = showEngagement,
  showThumbnail = true,
}) => {
  const adminProfile = useRootAdminProfile()
  const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null
  const usingAdminFallback = !postAuthor
  const authorName =
    postAuthor?.name?.trim() || adminProfile?.nickname?.trim() || adminProfile?.name?.trim() || "익명"
  const authorImageSrc = usingAdminFallback
    ? adminProfile?.profileImageDirectUrl || adminProfile?.profileImageUrl || ""
    : postAuthor?.profile_photo || ""
  const tags = (data.tags || []).map((tag) => tag.trim()).filter(Boolean)
  const primaryTaxonomy = (data.category?.[0] || tags[0] || "").trim()
  const rawTypeLabel = data.type?.[0]?.trim() || "Post"
  const typeLabel = rawTypeLabel === "Post" ? "Production note" : rawTypeLabel
  const heroLabels = primaryTaxonomy ? [primaryTaxonomy, typeLabel] : [typeLabel]
  const publishedAt = formatDateTime(data.createdTime, CONFIG.lang)
  const modifiedAt =
    data.modifiedTime && data.modifiedTime !== data.createdTime
      ? formatDateTime(data.modifiedTime, CONFIG.lang)
      : ""
  const thumbnailSrc = data.thumbnail ? normalizePublicPostImageUrl(stripThumbnailFocusFromUrl(data.thumbnail)) : ""
  const thumbnailFocusX = parseThumbnailFocusXFromUrl(data.thumbnail || "")
  const thumbnailFocusY = parseThumbnailFocusYFromUrl(data.thumbnail || "")
  const thumbnailZoom = parseThumbnailZoomFromUrl(data.thumbnail || "")
  const shareFeedbackMessage =
    shareFeedback === "failed"
      ? "공유에 실패했습니다."
      : shareFeedback === "shared"
        ? "복사 완료"
        : "복사 완료"
  const resolvedDeckSummary = deckSummary ?? data.summary ?? ""
  const readingMinutes = createMarkdownDocumentInsights(data.content).readingMinutes
  const readTimeText = readingMinutes ? `${readingMinutes}분 READ` : ""
  const viewCount = hitCount ?? data.hitCount ?? 0
  const viewText = `${Intl.NumberFormat(CONFIG.lang).format(viewCount)} VIEWS`
  const authorRole = usingAdminFallback ? adminProfile?.profileRole?.trim() || "" : ""

  return (
    <StyledWrapper>
      <Link href="/" className="backLink">
        <span aria-hidden="true">←</span>
        <span>모든 글</span>
      </Link>
      {heroLabels.length > 0 ? (
        <div className="heroLabel">
          {heroLabels.map((label, index) => (
            <React.Fragment key={label}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {label}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <h1 className="title">{data.title}</h1>
      {resolvedDeckSummary ? <p className="deck">{resolvedDeckSummary}</p> : null}

      <div className="metaRow">
        {authorName && (
          <div className="author">
            <div className="avatar">
              {authorImageSrc ? (
                <ProfileImage
                  src={authorImageSrc}
                  alt={`${authorName} profile image`}
                  priority
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
              {authorRole ? <div className="metaText">{authorRole}</div> : null}
            </div>
          </div>
        )}

        {showEngagement || showReadingTime ? (
          <div className="metaUtilities">
            {showEngagement || showReadingTime ? (
              <div className="actions" data-hide-mobile={hideActionButtonsOnMobile}>
                <div className="engagementRow" aria-label="post engagement">
                  <div className="stats" aria-label="post stats">
                    {showEngagement ? <span className="statChip">{publishedAt}</span> : null}
                    {showReadingTime && readTimeText ? <span className="statChip">{readTimeText}</span> : null}
                    {showEngagement ? <span className="statChip">{viewText}</span> : null}
                    {showEngagement && modifiedAt ? <span className="statChip">UPDATED {modifiedAt}</span> : null}
                  </div>
                  {showEngagement ? <span
                    className="likeButton"
                    data-hide-mobile={hideActionButtonsOnMobile}
                  >
                    <AppIcon name="heart" />
                    <span>좋아요 {likesCount ?? data.likesCount ?? 0}</span>
                  </span> : null}

                  {showEngagement && onSharePost && (
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
                  )}
                </div>
                {shareFeedback && (
                  <span
                    className="shareFeedbackPill"
                    data-hide-desktop={hideShareActionOnDesktop}
                    data-hide-mobile={hideActionButtonsOnMobile}
                    role="status"
                    aria-live="polite"
                  >
                    {shareFeedbackMessage}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showThumbnail && thumbnailSrc && (
        <div className="thumbnail">
          <img
            src={thumbnailSrc}
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
              objectPosition: `${thumbnailFocusX}% ${thumbnailFocusY}%`,
              transform: `scale(${thumbnailZoom})`,
              transformOrigin: `${thumbnailFocusX}% ${thumbnailFocusY}%`,
            }}
          />
        </div>
      )}

    </StyledWrapper>
  )
}

export default PostHeader
