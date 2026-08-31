/* eslint-disable @next/next/no-img-element */
import React from "react"

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string
  fillContainer?: boolean
  priority?: boolean
}

const ProfileImage: React.FC<Props> = ({
  fallbackSrc,
  fillContainer = false,
  priority = false,
  loading,
  alt,
  onError,
  src,
  style,
  ...props
}) => {
  const requestedSrc = src || fallbackSrc
  const fallbackAttemptKey = typeof requestedSrc === "string" ? requestedSrc : fallbackSrc
  const [resolvedSrc, setResolvedSrc] = React.useState(requestedSrc)
  const fallbackAttemptSourceRef = React.useRef<string | undefined>(undefined)
  const imageRef = React.useRef<HTMLImageElement | null>(null)

  const attemptFallback = React.useCallback(() => {
    if (!fallbackSrc || fallbackAttemptSourceRef.current === fallbackAttemptKey) return

    fallbackAttemptSourceRef.current = fallbackAttemptKey
    setResolvedSrc(fallbackSrc)
  }, [fallbackAttemptKey, fallbackSrc])

  React.useEffect(() => {
    fallbackAttemptSourceRef.current = undefined
    setResolvedSrc(requestedSrc)
  }, [requestedSrc])

  React.useEffect(() => {
    const image = imageRef.current
    if (
      resolvedSrc !== requestedSrc ||
      !image?.complete ||
      image.naturalWidth !== 0
    ) {
      return
    }

    attemptFallback()
  }, [attemptFallback, requestedSrc, resolvedSrc])

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    onError?.(event)
    attemptFallback()
  }

  return (
    <img
      alt={alt}
      src={resolvedSrc}
      loading={loading || (priority ? "eager" : "lazy")}
      {...({ fetchpriority: priority ? "high" : "auto" } as Record<string, string>)}
      decoding={priority ? "sync" : "async"}
      draggable={false}
      onError={handleImageError}
      ref={imageRef}
      style={{
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
      }}
      {...props}
    />
  )
}

export default ProfileImage
