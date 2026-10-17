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
          ...imageStyle,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          style={{ width: "min(24px, 60%)", height: "min(24px, 60%)" }}
        >
          <circle cx="12" cy="8.5" r="4" fill="currentColor" opacity="0.72" />
          <path
            d="M4.5 19.5c1.8-3.4 4.4-5 7.5-5s5.7 1.6 7.5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.72"
          />
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
