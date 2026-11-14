import { memo, type CSSProperties, useEffect, useRef, useState } from "react"
import { useLanguage } from "src/libs/language"
import type { MarkdownImageFigureProps } from "src/libs/markdown/MarkdownRenderer.types"
import { normalizeSafeMarkdownImageSrc } from "src/libs/markdown/safeMarkdownUrl"

export const MarkdownImageFigure = memo(
  ({
    alt,
    src,
    widthPx,
    heightPx,
    aspectRatio,
    align,
    eager = false,
    editable = false,
    imageIndex,
    onWidthCommit,
  }: MarkdownImageFigureProps) => {
    const { t } = useLanguage()
    const frameRef = useRef<HTMLElement>(null)
    const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
    const liveWidthRef = useRef<number | null>(null)
    const pointerCleanupRef = useRef<(() => void) | null>(null)
    const [draftWidthPx, setDraftWidthPx] = useState<number | null>(null)

    useEffect(() => {
      setDraftWidthPx(null)
      liveWidthRef.current = null
    }, [src, widthPx])

    useEffect(
      () => () => {
        pointerCleanupRef.current?.()
        pointerCleanupRef.current = null
      },
      []
    )

    const effectiveWidthPx = draftWidthPx ?? widthPx
    const effectiveHeightPx = heightPx
    const effectiveAspectRatio =
      aspectRatio || (widthPx && heightPx ? `${widthPx} / ${heightPx}` : undefined)
    const safeSrc = normalizeSafeMarkdownImageSrc(src)

    useEffect(() => {
      const image = frameRef.current?.querySelector<HTMLImageElement>("img")
      if (!image || editable || image.closest("a, button")) return
      image.tabIndex = 0
    }, [editable, safeSrc])

    const frameStyle: CSSProperties | undefined =
      effectiveWidthPx || effectiveAspectRatio
        ? ({
            ...(effectiveWidthPx ? { "--aq-image-width": `${effectiveWidthPx}px` } : {}),
            ...(effectiveAspectRatio ? { aspectRatio: effectiveAspectRatio } : {}),
          } as CSSProperties)
        : undefined

    if (!safeSrc) {
      const blockedLabel = alt || t("markdownBlockedImage")
      return <span className="aq-image-blocked" role="img" aria-label={blockedLabel}>{blockedLabel}</span>
    }

    return (
      <figure
        ref={frameRef}
        className="aq-image-frame"
        data-width-mode={effectiveWidthPx ? "custom" : "default"}
        data-align={align || undefined}
        data-editable={editable ? "true" : "false"}
        style={frameStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={safeSrc}
          alt={alt || ""}
          width={effectiveWidthPx || undefined}
          height={effectiveHeightPx || undefined}
          style={effectiveAspectRatio ? { aspectRatio: effectiveAspectRatio } : undefined}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          draggable={false}
        />
        {editable ? (
          <button
            type="button"
            className="aq-image-resize-handle"
            aria-label="이미지 폭 조절"
            onPointerDown={(event) => {
              if (!frameRef.current) return
              pointerCleanupRef.current?.()
              const containerWidth = frameRef.current.parentElement?.clientWidth ?? frameRef.current.clientWidth
              const currentWidth =
                draftWidthPx ??
                widthPx ??
                Math.min(frameRef.current.getBoundingClientRect().width, containerWidth || 960)

              dragStateRef.current = {
                startX: event.clientX,
                startWidth: currentWidth,
              }

              const handlePointerMove = (moveEvent: PointerEvent) => {
                const activeDrag = dragStateRef.current
                if (!activeDrag) return
                const nextWidth = Math.min(
                  Math.max(activeDrag.startWidth + (moveEvent.clientX - activeDrag.startX), 180),
                  Math.max(240, containerWidth || activeDrag.startWidth)
                )
                liveWidthRef.current = Math.round(nextWidth)
                setDraftWidthPx(Math.round(nextWidth))
              }

              const detachPointerListeners = () => {
                window.removeEventListener("pointermove", handlePointerMove)
                window.removeEventListener("pointerup", handlePointerUp)
                window.removeEventListener("pointercancel", handlePointerCancel)
                pointerCleanupRef.current = null
              }

              const handlePointerUp = () => {
                detachPointerListeners()
                const nextWidth = liveWidthRef.current ?? widthPx ?? currentWidth
                dragStateRef.current = null
                liveWidthRef.current = null
                setDraftWidthPx(null)
                onWidthCommit?.({ src: safeSrc, alt, index: imageIndex, widthPx: nextWidth })
              }

              const handlePointerCancel = () => {
                detachPointerListeners()
                dragStateRef.current = null
                liveWidthRef.current = null
                setDraftWidthPx(null)
              }

              pointerCleanupRef.current = detachPointerListeners
              window.addEventListener("pointermove", handlePointerMove)
              window.addEventListener("pointerup", handlePointerUp, { once: true })
              window.addEventListener("pointercancel", handlePointerCancel, { once: true })
            }}
          >
            <span />
          </button>
        ) : null}
        {alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    )
  }
)

MarkdownImageFigure.displayName = "MarkdownImageFigure"
