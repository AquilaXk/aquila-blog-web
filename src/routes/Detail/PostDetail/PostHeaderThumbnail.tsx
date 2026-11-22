/* eslint-disable @next/next/no-img-element */
import React from "react"
import styled from "@emotion/styled"
import {
  parseThumbnailFocusXFromUrl,
  parseThumbnailFocusYFromUrl,
  parseThumbnailZoomFromUrl,
  stripThumbnailFocusFromUrl,
} from "src/libs/thumbnailFocus"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
import { useLanguage } from "src/libs/language"

export type PostHeaderThumbnailProps = {
  rawThumbnail: string
  alt: string
}

const StyledThumbnailBox = styled.div`
  overflow: hidden;
  position: relative;
  margin-top: 2rem;
  border-radius: 0;
  width: 100%;
  border: 1px solid var(--aq-border);
  background-color: var(--aq-surface);
  padding-bottom: 52%;

  .thumbnailTrigger {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;

    &:focus-visible {
      outline: 2px solid var(--aq-focus-ring);
      outline-offset: -2px;
    }
  }
`

export const PostHeaderThumbnail: React.FC<PostHeaderThumbnailProps> = ({
  rawThumbnail,
  alt,
}) => {
  const { t } = useLanguage()
  const thumbnailSrc = rawThumbnail
    ? normalizePublicPostImageUrl(stripThumbnailFocusFromUrl(rawThumbnail))
    : ""
  if (!thumbnailSrc) return null

  const focusX = parseThumbnailFocusXFromUrl(rawThumbnail)
  const focusY = parseThumbnailFocusYFromUrl(rawThumbnail)
  const zoom = parseThumbnailZoomFromUrl(rawThumbnail)

  return (
    <StyledThumbnailBox className="thumbnail">
      <button
        type="button"
        className="thumbnailTrigger"
        aria-label={t("postThumbnailZoomAria")}
        onClick={(event) => {
          const trigger = event.currentTarget
          void import("src/libs/markdown/imageLightboxOverlay")
            .then(({ openImageLightboxOverlay }) => {
              openImageLightboxOverlay({
                src: thumbnailSrc,
                alt,
                trigger,
              })
            })
            .catch(() => {})
        }}
      >
        <img
          src={thumbnailSrc}
          alt={alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${focusX}% ${focusY}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${focusX}% ${focusY}%`,
          }}
        />
      </button>
    </StyledThumbnailBox>
  )
}

export default PostHeaderThumbnail
