import { FC, useEffect, useState } from "react"
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

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleClick = async () => {
    if (typeof window === "undefined" || !id) return
    const baseUrl = window.location.href.split("#")[0]
    const anchorUrl = `${baseUrl}#${encodeURIComponent(id)}`
    window.history?.replaceState?.(null, "", `#${id}`)
    const ok = await copyTextToClipboard(anchorUrl)
    if (ok) {
      setCopied(true)
    }
  }

  return (
    <button
      type="button"
      className="aq-heading-anchor"
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? copiedText : copyAria}
      title={copied ? copiedText : copyAria}
      onClick={() => void handleClick()}
    >
      {copied ? <span className="aq-sr-only" role="status">{copiedText}</span> : null}
    </button>
  )
}
