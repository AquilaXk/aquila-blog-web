import type { ComponentPropsWithoutRef, ReactNode } from "react"
import type { MarkdownFootnote } from "src/libs/markdown/renderingFootnoteModel"

type RenderMarkdown = (markdown: string, key: string, inCallout?: boolean, inlineOnly?: boolean) => ReactNode

type MarkdownFootnoteReferenceLinkProps = ComponentPropsWithoutRef<"a"> & {
  footnotes: readonly MarkdownFootnote[]
  marker: string
}

export const MarkdownFootnoteReferenceLink = ({
  children,
  href,
  title,
  footnotes,
  marker,
  ...props
}: MarkdownFootnoteReferenceLinkProps) => {
  const referenceId = title?.startsWith(`${marker}:`) ? title.slice(marker.length + 1) : ""
  const footnote = footnotes.find(
    (candidate) => href === `#${candidate.targetId}` && candidate.referenceIds.includes(referenceId)
  )
  if (!footnote) {
    return <a href={href} title={title} {...props}>{children}</a>
  }
  const occurrence = footnote.referenceIds.indexOf(referenceId) + 1

  return (
    <sup className="aq-footnote-reference">
      <a
        {...props}
        href={href}
        id={referenceId}
        data-footnote-ref
        aria-describedby="aq-footnote-heading"
        aria-label={`각주 ${footnote.number} 참조 ${occurrence}`}
      >
        {children}
      </a>
    </sup>
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
            {footnote.referenceIds.map((referenceId, index) => (
              <a
                key={referenceId}
                href={`#${referenceId}`}
                data-footnote-backref
                aria-label={`본문의 각주 ${footnote.number}번 참조 ${index + 1}로 돌아가기`}
              >
                ↩
              </a>
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}
