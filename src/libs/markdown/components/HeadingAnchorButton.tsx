// 참조 구현: Fumadocs (`fuma-nama/fumadocs`, `packages/base-ui/src/components/heading.tsx`, MIT License, Copyright (c) 2024 Fuma Nama)
import { FC, useEffect, useRef, useState } from "react"
import { copyTextToClipboard } from "./PrettyCodeBlock"

type HeadingAnchorButtonProps = {
  id: string
  copyAria: string
  copiedText: string
}

export const HeadingAnchorButton: FC<HeadingAnchorButtonProps> = ({
  id,
  copyAria,
  copiedText,
}) => {
  const [copied, setCopied] = useState(false)
  const [voiceOverTick, setVoiceOverTick] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleClick = async () => {
    if (typeof window === "undefined" || !id) return
    const encodedId = encodeURIComponent(id)
    const baseUrl = window.location.href.split("#")[0]
    const anchorUrl = `${baseUrl}#${encodedId}`
    window.history?.replaceState?.(null, "", `#${encodedId}`)
    const ok = await copyTextToClipboard(anchorUrl)
    if (!ok) return
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }
    setCopied(true)
    setVoiceOverTick((prev) => !prev)
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null
      setCopied(false)
    }, 1400)
  }

  return (
    <button
      type="button"
      className="aq-heading-anchor"
      data-toc-ignore="true"
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? `${copiedText}${voiceOverTick ? "\u00A0" : ""}` : copyAria}
      title={copied ? copiedText : copyAria}
      onClick={() => void handleClick()}
    >
      {copied ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )}
      {copied ? (
        <span className="aq-sr-only" role="status" aria-live="polite">
          {copiedText}
          {voiceOverTick ? "\u00A0" : ""}
        </span>
      ) : null}
    </button>
  )
}
