/**
 * 참조 구현:
 * - fuma-nama/fumadocs (packages/base-ui/src/components/callout.tsx, MIT License)
 * - TryGhost/Koenig (packages/koenig-lexical/src/components/ui/cards/BookmarkCard.jsx, ToggleCard.jsx, FileCard.jsx, MIT License)
 * - lucide-icons/lucide (icons/lightbulb.svg, icons/octagon-alert.svg, icons/triangle-alert.svg, icons/circle-check.svg, icons/file-text.svg, icons/list.svg, icons/info.svg, icons/chevron-down.svg, icons/globe.svg, icons/file-down.svg, icons/arrow-up-right.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import type { ReactNode } from "react"
import { translations, type TranslationKey } from "src/libs/language/translations"
import type { CalloutKind, MarkdownSegment } from "src/libs/markdown/rendering"
import FormulaRender from "src/libs/markdown/FormulaRender"
import { MarkdownImageFigure } from "src/libs/markdown/MarkdownRendererImage"
import { normalizePublicExternalThumbnailUrl } from "src/libs/markdown/externalThumbnailUrlPolicy"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
import { normalizeSafeMarkdownUrl } from "src/libs/markdown/safeMarkdownUrl"
import type { MarkdownImageWidthCommitPayload } from "src/libs/markdown/MarkdownRenderer.types"
import { formatReadableFileSize, inferLinkProvider, resolveEmbedPreviewUrl } from "src/libs/unfurl/extractMeta"

type RenderMarkdownBlock = (markdown: string, key: string, inCallout?: boolean, inlineOnly?: boolean) => ReactNode

type RenderMarkdownSegmentPayload = {
  segment: MarkdownSegment
  index: number
  imageIndex: number
  editableImages: boolean
  onImageWidthCommit?: (payload: MarkdownImageWidthCommitPayload) => void
  renderMarkdown: RenderMarkdownBlock
  t?: (key: TranslationKey) => string
}

const DEFAULT_CALLOUT_TITLE_KEYS: Record<string, TranslationKey> = {
  summary: "calloutTitleSummary",
  info: "calloutTitleInfo",
  tip: "calloutTitleTip",
  warning: "calloutTitleWarning",
  danger: "calloutTitleDanger",
  example: "calloutTitleExample",
  outline: "calloutTitleOutline",
}

const fallbackTranslate = (key: TranslationKey): string => translations.ko[key]

const renderCalloutIcon = (kind: CalloutKind): ReactNode => {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  }

  switch (kind) {
    case "tip":
      return (
        <svg {...commonProps}>
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      )
    case "danger":
      return (
        <svg {...commonProps}>
          <path d="M12 16h.01" />
          <path d="M12 8v4" />
          <path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" />
        </svg>
      )
    case "warning":
      return (
        <svg {...commonProps}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case "example":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case "summary":
      return (
        <svg {...commonProps}>
          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2 2 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
          <path d="M14 2v5a1 1 0 0 0 1 1h5" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      )
    case "outline":
      return (
        <svg {...commonProps}>
          <path d="M3 5h.01" />
          <path d="M3 12h.01" />
          <path d="M3 19h.01" />
          <path d="M8 5h13" />
          <path d="M8 12h13" />
          <path d="M8 19h13" />
        </svg>
      )
    case "info":
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      )
  }
}

const renderGlobeFallbackIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
)

const renderArrowUpRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
)

const renderFileDownIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M12 18v-6" />
    <path d="m9 15 3 3 3-3" />
  </svg>
)

export const renderMarkdownSegment = ({
  segment,
  index,
  imageIndex,
  editableImages,
  onImageWidthCommit,
  renderMarkdown,
  t = fallbackTranslate,
}: RenderMarkdownSegmentPayload) => {
  if (segment.type === "toggle") {
    return (
      <details className="aq-toggle" key={`toggle-${index}`}>
        <summary>
          <span className="aq-toggle__caret" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span className="aq-toggle__title">{segment.title || t("markdownToggleLabel")}</span>
        </summary>
        {segment.content ? (
          <div className="aq-toggle__body">{renderMarkdown(segment.content, `toggle-body-${index}`)}</div>
        ) : null}
      </details>
    )
  }

  if (segment.type === "callout") {
    if (segment.foldable) {
      const titleKey = DEFAULT_CALLOUT_TITLE_KEYS[segment.kind]
      const resolvedTitle =
        segment.title ||
        (titleKey ? t(titleKey) : "") ||
        segment.kind.toUpperCase()
      return (
        <details
          key={`callout-${index}`}
          className={`aq-callout aq-callout-box aq-admonition aq-admonition-${segment.kind}`}
          data-callout={segment.kind}
          data-callout-foldable="true"
          open={!segment.defaultCollapsed}
        >
          <summary className="aq-callout-head aq-callout-header">
            <div role="none" className="aq-callout-rail" />
            <span className="aq-callout-emoji" aria-hidden="true">
              {renderCalloutIcon(segment.kind)}
            </span>
            <strong className="aq-callout-title">{resolvedTitle}</strong>
            <span className="aq-callout-fold-chevron" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          {segment.content ? (
            <div className="aq-callout-box-text aq-callout-body aq-callout-content">
              {renderMarkdown(segment.content, `callout-body-${index}`, true)}
            </div>
          ) : null}
        </details>
      )
    }

    const resolvedNonFoldableTitle =
      segment.title || (segment.kind === "summary" ? (t ? t("calloutTitleSummary") : fallbackTranslate("calloutTitleSummary")) : "")
    const hasTitle = Boolean(resolvedNonFoldableTitle)
    return (
      <div
        key={`callout-${index}`}
        className={`aq-callout aq-callout-box aq-admonition aq-admonition-${segment.kind}`}
        data-callout={segment.kind}
        data-has-title={hasTitle ? "true" : "false"}
      >
        <div role="none" className="aq-callout-rail" />
        <span className="aq-callout-emoji" aria-hidden="true">
          {renderCalloutIcon(segment.kind)}
        </span>
        <div className="aq-callout-box-text">
          {hasTitle ? (
            <div className="aq-callout-head" data-has-title="true">
              <strong className="aq-callout-title">{resolvedNonFoldableTitle}</strong>
            </div>
          ) : null}
          {segment.content ? renderMarkdown(segment.content, `callout-body-${index}`, true) : null}
        </div>
      </div>
    )
  }

  if (segment.type === "bookmark") {
    const safeUrl = normalizeSafeMarkdownUrl(segment.url || "")
    const providerLabel =
      segment.provider || segment.siteName || (safeUrl ? inferLinkProvider(safeUrl) : "")
    const rawThumbnail = segment.thumbnailUrl || ""
    const thumbnailSrc =
      normalizePublicPostImageUrl(rawThumbnail) || normalizePublicExternalThumbnailUrl(rawThumbnail)
    const cardInner = (
      <>
        <div className="aq-link-card-copy">
          <div className="aq-link-card-meta">
            <span className="aq-link-card-favicon" aria-hidden="true">
              {renderGlobeFallbackIcon()}
            </span>
            {providerLabel ? <small>{providerLabel}</small> : null}
            {safeUrl ? (
              <span className="aq-card-external-icon" aria-hidden="true">
                {renderArrowUpRightIcon()}
              </span>
            ) : null}
          </div>
          <strong>{segment.title || safeUrl || t("markdownBookmarkLabel")}</strong>
          {segment.description ? <p>{segment.description}</p> : null}
          {safeUrl ? <span>{safeUrl}</span> : null}
        </div>
        {thumbnailSrc ? (
          <div className="aq-link-card-thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailSrc} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </div>
        ) : null}
      </>
    )

    if (!safeUrl) {
      return (
        <div key={`bookmark-${index}`} className="aq-bookmark-card" data-disabled="true">
          <div className="aq-bookmark-card__body">{cardInner}</div>
        </div>
      )
    }

    return (
      <div key={`bookmark-${index}`} className="aq-bookmark-card">
        <a href={safeUrl} target="_blank" rel="noopener noreferrer">
          {cardInner}
        </a>
      </div>
    )
  }

  if (segment.type === "embed") {
    const safeUrl = normalizeSafeMarkdownUrl(segment.url || "")
    const previewUrl =
      (segment.embedUrl ? resolveEmbedPreviewUrl(segment.embedUrl) : "") ||
      (safeUrl ? resolveEmbedPreviewUrl(safeUrl) : "")
    const providerLabel =
      segment.provider || segment.siteName || (safeUrl ? inferLinkProvider(safeUrl) : "")
    const rawThumbnail = segment.thumbnailUrl || ""
    const thumbnailSrc =
      normalizePublicPostImageUrl(rawThumbnail) || normalizePublicExternalThumbnailUrl(rawThumbnail)
    return (
      <div key={`embed-${index}`} className="aq-embed-card" data-disabled={safeUrl ? undefined : "true"}>
        <div className="aq-embed-header">
          <div className="aq-embed-copy">
            {providerLabel ? <small>{providerLabel}</small> : null}
            <strong>{segment.title || t("markdownEmbedLabel")}</strong>
          </div>
          {safeUrl ? (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              <span>{t("markdownEmbedOpenSource")}</span>
              {renderArrowUpRightIcon()}
            </a>
          ) : (
            <span className="aq-embed-open" data-disabled="true" aria-disabled="true">
              {t("markdownEmbedOpenSource")}
            </span>
          )}
        </div>
        {previewUrl ? (
          <div className="aq-embed-frame">
            <iframe
              src={previewUrl}
              title={segment.title || safeUrl || t("markdownEmbedLabel")}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aq-embed-fallback">
            <p>{t("markdownEmbedFallback")}</p>
          </div>
        )}
        {thumbnailSrc && !previewUrl ? (
          <div className="aq-embed-thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailSrc} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </div>
        ) : null}
        {segment.caption ? <p className="aq-embed-caption">{segment.caption}</p> : null}
      </div>
    )
  }

  if (segment.type === "file") {
    const safeUrl = normalizeSafeMarkdownUrl(segment.url || "")
    const meta = [segment.mimeType || "", formatReadableFileSize(segment.sizeBytes)].filter(Boolean).join(" · ")
    const cardBody = (
      <>
        <div className="aq-file-card-main">
          <span className="aq-file-card-icon" aria-hidden="true">
            {renderFileDownIcon()}
          </span>
          <div className="aq-link-card-copy">
            {meta ? <small>{meta}</small> : null}
            <strong>{segment.name || t("markdownAttachmentLabel")}</strong>
            {safeUrl ? <span>{safeUrl}</span> : null}
          </div>
        </div>
        {safeUrl ? (
          <span className="aq-card-external-icon" aria-hidden="true">
            {renderArrowUpRightIcon()}
          </span>
        ) : null}
      </>
    )
    if (!safeUrl) {
      return (
        <div key={`file-${index}`} className="aq-file-card" data-disabled="true" aria-disabled="true">
          <div className="aq-file-card__body">{cardBody}</div>
          {segment.description ? <p>{segment.description}</p> : null}
        </div>
      )
    }
    return (
      <div key={`file-${index}`} className="aq-file-card">
        <a href={safeUrl} target="_blank" rel="noopener noreferrer">
          {cardBody}
        </a>
        {segment.description ? <p>{segment.description}</p> : null}
      </div>
    )
  }

  if (segment.type === "formula") {
    return (
      <div key={`formula-${index}`} className="aq-formula-card">
        <FormulaRender className="aq-formula-render" formula={segment.formula} displayMode />
      </div>
    )
  }

  if (segment.type === "image") {
    return (
      <MarkdownImageFigure
        key={`image-${imageIndex}-${segment.src}`}
        alt={segment.alt}
        src={segment.src}
        widthPx={segment.widthPx}
        heightPx={segment.heightPx}
        aspectRatio={segment.aspectRatio}
        align={segment.align}
        eager={imageIndex === 0}
        editable={editableImages}
        imageIndex={imageIndex}
        onWidthCommit={onImageWidthCommit}
      />
    )
  }

  return renderMarkdown(segment.content, `markdown-${index}`)
}
