import type { ComponentPropsWithoutRef, ReactNode } from "react"
import type { MarkdownFootnote } from "src/libs/markdown/renderingFootnoteModel"
import { normalizeSafeMarkdownLinkHref } from "src/libs/markdown/safeMarkdownUrl"

type RenderMarkdown = (markdown: string, key: string, inCallout?: boolean, inlineOnly?: boolean) => ReactNode

type MarkdownFootnoteReferenceLinkProps = ComponentPropsWithoutRef<"a"> & {
  footnotes: readonly MarkdownFootnote[]
  marker: string
}

export const isExternalHttpHref = (href: string): boolean =>
  href.startsWith("http://") || href.startsWith("https://")

export const resolveSafeRenderedAnchorHref = (rawHref: unknown): string =>
  typeof rawHref === "string" ? normalizeSafeMarkdownLinkHref(rawHref) : ""

const extractFootnotePlainTextPreview = (content: string): string => {
  const cleaned = content
    .replace(/!?\[([^\][\r\n]*)\]\([^()\r\n]*\)/g, "$1")
    .replace(/`([^`\r\n]+)`/g, "$1")
    .replace(/(\*\*|__|~~|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (cleaned.length <= 220) return cleaned
  return `${cleaned.slice(0, 217).trimEnd()}...`
}

export const MarkdownFootnoteReferenceLink = ({
  children,
  href,
  title,
  footnotes,
  marker,
  ...props
}: MarkdownFootnoteReferenceLinkProps) => {
  const safeHref = resolveSafeRenderedAnchorHref(href)
  if (!safeHref) {
    return <span>{children}</span>
  }
  const referenceId = title?.startsWith(`${marker}:`) ? title.slice(marker.length + 1) : ""
  const footnote = footnotes.find(
    (candidate) =>
      safeHref === `#${candidate.targetId}` && candidate.referenceIds.includes(referenceId)
  )
  if (!footnote) {
    const externalProps = isExternalHttpHref(safeHref)
      ? { target: "_blank", rel: "noopener noreferrer" }
      : undefined
    return (
      <a {...props} {...externalProps} href={safeHref} title={title}>
        {children}
      </a>
    )
  }
  const occurrence = footnote.referenceIds.indexOf(referenceId) + 1
  const plainTextPreview = extractFootnotePlainTextPreview(footnote.content)
  const fallbackSuffix = `${footnote.identifier}-${occurrence}`
  const tooltipId = `aq-footnote-tooltip-${referenceId || fallbackSuffix}`

  return (
    <sup className="aq-footnote-reference">
      <a
        {...props}
        href={safeHref}
        id={referenceId}
        data-footnote-ref
        aria-describedby={plainTextPreview ? tooltipId : "aq-footnote-heading"}
        aria-label={`각주 ${footnote.number} 참조 ${occurrence}`}
      >
        {children}
      </a>
      {plainTextPreview ? (
        <span id={tooltipId} className="aq-footnote-popover" role="tooltip">
          {plainTextPreview}
        </span>
      ) : null}
    </sup>
  )
}

const renderFootnoteBackref = (footnoteNumber: number, referenceId: string, index: number) => {
  const safeBackrefHref = normalizeSafeMarkdownLinkHref(`#${referenceId}`)
  const ariaLabel = `본문의 각주 ${footnoteNumber}번 참조 ${index + 1}로 돌아가기`
  if (!safeBackrefHref) {
    return (
      <span key={referenceId} aria-label={ariaLabel}>
        ↩
      </span>
    )
  }
  return (
    <a
      key={referenceId}
      href={safeBackrefHref}
      data-footnote-backref
      aria-label={ariaLabel}
    >
      ↩
    </a>
  )
}

export const MarkdownFootnoteAppendix = ({
  footnotes,
  renderMarkdown,
}: {
  footnotes: readonly MarkdownFootnote[]
  renderMarkdown: RenderMarkdown
}) => {
  if (!footnotes.length) return null

  return (
    <section className="aq-footnotes" aria-labelledby="aq-footnote-heading">
      <h2 id="aq-footnote-heading">각주</h2>
      <ol>
        {footnotes.map((footnote) => (
          <li key={footnote.identifier} id={footnote.targetId}>
            {renderMarkdown(footnote.content, `footnote-definition-${footnote.identifier}`)}
            {footnote.referenceIds.map((referenceId, index) =>
              renderFootnoteBackref(footnote.number, referenceId, index)
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
