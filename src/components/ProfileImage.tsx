/**
 * 참조 구현:
 * - shadcn-ui/ui (apps/v4/registry/new-york-v4/ui/avatar.tsx, MIT License)
 * - lucide-icons/lucide (icons/user.svg, ISC License, Copyright (c) Lucide Contributors)
 */
/* eslint-disable @next/next/no-img-element */
import React from "react"

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fillContainer?: boolean
  priority?: boolean
}

const ProfileImage: React.FC<Props> = ({
  fillContainer = false,
  priority = false,
  loading,
  alt,
  onError,
  src,
  style,
  width,
  height,
  ...props
}) => {
  const requestedSrc = typeof src === "string" ? src : ""
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const imageRef = React.useRef<HTMLImageElement | null>(null)

  React.useEffect(() => {
    setFailedSrc(null)
  }, [requestedSrc])

  React.useEffect(() => {
    const image = imageRef.current
    if (!requestedSrc || !image?.complete || image.naturalWidth !== 0) return
    setFailedSrc(requestedSrc)
  }, [requestedSrc])

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    onError?.(event)
    setFailedSrc(requestedSrc)
  }

  const imageStyle: React.CSSProperties = {
    display: "block",
    objectFit: "cover",
    objectPosition: "center 38%",
    ...(fillContainer
      ? {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }
      : {}),
    ...style,
  }

  if (!requestedSrc || failedSrc === requestedSrc) {
    return (
      <span
        {...props}
        role="img"
        aria-label={`${alt || "프로필"} 이미지를 불러올 수 없습니다.`}
        style={{
          width,
          height,
          background: "var(--aq-surface-subtle)",
          color: "var(--aq-muted)",
          ...imageStyle,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          style={{ width: "min(20px, 56%)", height: "min(20px, 56%)", opacity: 0.72 }}
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
    )
  }

  return (
    <img
      alt={alt}
      src={requestedSrc}
      width={width}
      height={height}
      loading={loading || (priority ? "eager" : "lazy")}
      {...(priority ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
      decoding="async"
      draggable={false}
      onError={handleImageError}
      ref={imageRef}
      style={imageStyle}
      {...props}
    />
  )
}

export default ProfileImage
