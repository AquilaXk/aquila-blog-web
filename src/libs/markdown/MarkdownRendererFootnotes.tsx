import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { useLanguage } from "src/libs/language"
import type { MarkdownFootnote } from "src/libs/markdown/renderingFootnoteModel"
import { normalizeSafeMarkdownLinkHref } from "src/libs/markdown/safeMarkdownUrl"

type RenderMarkdown = (markdown: string, key: string, inCallout?: boolean, inlineOnly?: boolean) => ReactNode

type MarkdownFootnoteReferenceLinkProps = ComponentPropsWithoutRef<"a"> & {
  footnotes: readonly MarkdownFootnote[]
  marker: string
}

type FootnoteLookupIndex = {
  byHref: Map<string, { footnote: MarkdownFootnote; occurrenceByRefId: Map<string, number> }>
}

const footnoteLookupCache = new WeakMap<readonly MarkdownFootnote[], FootnoteLookupIndex>()

const getFootnoteLookupIndex = (footnotes: readonly MarkdownFootnote[]): FootnoteLookupIndex => {
  const cached = footnoteLookupCache.get(footnotes)
  if (cached) return cached
  const byHref = new Map<string, { footnote: MarkdownFootnote; occurrenceByRefId: Map<string, number> }>()
  for (const footnote of footnotes) {
    const occurrenceByRefId = new Map<string, number>()
    for (let i = 0; i < footnote.referenceIds.length; i += 1) {
      occurrenceByRefId.set(footnote.referenceIds[i]!, i + 1)
    }
    byHref.set(`#${footnote.targetId}`, { footnote, occurrenceByRefId })
  }
  const index = { byHref }
  footnoteLookupCache.set(footnotes, index)
  return index
}

export const isExternalHttpHref = (href: string): boolean =>
  href.startsWith("http://") || href.startsWith("https://")

export const resolveSafeRenderedAnchorHref = (rawHref: unknown): string =>
  typeof rawHref === "string" ? normalizeSafeMarkdownLinkHref(rawHref) : ""

const isEnglishDocLang = (): boolean =>
  typeof document !== "undefined" && (document.documentElement?.lang ?? "").toLowerCase().startsWith("en")

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
  const { language } = useLanguage()
  const isEnglish = language === "en" || isEnglishDocLang()
  const safeHref = resolveSafeRenderedAnchorHref(href)
  if (!safeHref) {
    return <span>{children}</span>
  }
  const referenceId = title?.startsWith(`${marker}:`) ? title.slice(marker.length + 1) : ""
  const entry = getFootnoteLookupIndex(footnotes).byHref.get(safeHref)
  const occurrence = entry ? (entry.occurrenceByRefId.get(referenceId) ?? 0) : 0
  const footnote = occurrence > 0 ? entry?.footnote : undefined
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
  const plainTextPreview = extractFootnotePlainTextPreview(footnote.content)
  const fallbackSuffix = `${footnote.identifier}-${occurrence}`
  const tooltipId = `aq-footnote-tooltip-${referenceId || fallbackSuffix}`
  const refAriaLabel = isEnglish
    ? `Footnote ${footnote.number} reference ${occurrence}`
    : `각주 ${footnote.number} 참조 ${occurrence}`

  return (
    <sup className="aq-footnote-reference">
      <a
        {...props}
        href={safeHref}
        id={referenceId}
        data-footnote-ref
        aria-describedby={plainTextPreview ? tooltipId : "aq-footnote-heading"}
        aria-label={refAriaLabel}
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

const renderFootnoteBackref = (
  footnoteNumber: number,
  referenceId: string,
  index: number,
  isEnglish: boolean
) => {
  const safeBackrefHref = normalizeSafeMarkdownLinkHref(`#${referenceId}`)
  const ariaLabel = isEnglish
    ? `Back to footnote ${footnoteNumber} reference ${index + 1}`
    : `본문의 각주 ${footnoteNumber}번 참조 ${index + 1}로 돌아가기`
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
  const { language } = useLanguage()
  const isEnglish = language === "en" || isEnglishDocLang()
  if (!footnotes.length) return null

  return (
    <section className="aq-footnotes" aria-labelledby="aq-footnote-heading">
      <h2 id="aq-footnote-heading">{isEnglish ? "Footnotes" : "각주"}</h2>
      <ol>
        {footnotes.map((footnote) => (
          <li key={footnote.identifier} id={footnote.targetId}>
            {renderMarkdown(footnote.content, `footnote-definition-${footnote.identifier}`)}
            {footnote.referenceIds.map((referenceId, index) =>
              renderFootnoteBackref(footnote.number, referenceId, index, isEnglish)
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
