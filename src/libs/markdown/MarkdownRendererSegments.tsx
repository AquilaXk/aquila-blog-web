import type { ReactNode } from "react"
import type { CalloutKind, MarkdownSegment } from "src/libs/markdown/rendering"
import FormulaRender from "src/libs/markdown/FormulaRender"
import { MarkdownImageFigure } from "src/libs/markdown/MarkdownRendererImage"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
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
}

const DEFAULT_CALLOUT_TITLES: Record<string, string> = {
  summary: "핵심 요약",
  info: "배경 메모",
  tip: "실전 팁",
  warning: "주의 포인트",
  example: "예시 시나리오",
  outline: "읽기 가이드",
}

const renderCalloutIcon = (kind: CalloutKind): ReactNode => {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
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
    case "warning":
      return (
        <svg {...commonProps}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case "example":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9.25" />
          <path d="m8.5 12.5 2.25 2.25 4.75-4.75" />
        </svg>
      )
    case "summary":
      return (
        <svg {...commonProps}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      )
    case "outline":
      return (
        <svg {...commonProps}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3.5 6h.01" />
          <path d="M3.5 12h.01" />
          <path d="M3.5 18h.01" />
        </svg>
      )
    case "info":
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9.25" />
          <path d="M12 16.5v-4.5" />
          <path d="M12 8h.01" />
        </svg>
      )
  }
}

export const renderMarkdownSegment = ({
  segment,
  index,
  imageIndex,
  editableImages,
  onImageWidthCommit,
  renderMarkdown,
}: RenderMarkdownSegmentPayload) => {
  if (segment.type === "toggle") {
    return (
      <details className="aq-toggle" key={`toggle-${index}`}>
        <summary>
          <span className="aq-toggle__caret" aria-hidden="true" />
          <span className="aq-toggle__title">{segment.title}</span>
        </summary>
        <div className="aq-toggle__body">{renderMarkdown(segment.content, `toggle-body-${index}`)}</div>
      </details>
    )
  }

  if (segment.type === "callout") {
    if (segment.foldable) {
      const resolvedTitle =
        segment.title ||
        DEFAULT_CALLOUT_TITLES[segment.kind] ||
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
            <span className="aq-callout-emoji" aria-hidden="true">
              {renderCalloutIcon(segment.kind)}
            </span>
            <strong className="aq-callout-title">{resolvedTitle}</strong>
            <span className="aq-callout-fold-chevron" aria-hidden="true" />
          </summary>
          <div className="aq-callout-box-text aq-callout-body aq-callout-content">
            {renderMarkdown(segment.content, `callout-body-${index}`, true)}
          </div>
        </details>
      )
    }

    const hasTitle = Boolean(segment.title)
    return (
      <div
        key={`callout-${index}`}
        className={`aq-callout aq-callout-box aq-admonition aq-admonition-${segment.kind}`}
        data-callout={segment.kind}
        data-has-title={hasTitle ? "true" : "false"}
      >
        <span className="aq-callout-emoji" aria-hidden="true">
          {renderCalloutIcon(segment.kind)}
        </span>
        <div className="aq-callout-box-text">
          {hasTitle ? (
            <div className="aq-callout-head" data-has-title="true">
              <strong className="aq-callout-title">{segment.title}</strong>
            </div>
          ) : null}
          {renderMarkdown(segment.content, `callout-body-${index}`, true)}
        </div>
      </div>
    )
  }

  if (segment.type === "bookmark") {
    const providerLabel = segment.provider || segment.siteName || inferLinkProvider(segment.url)
    const thumbnailSrc = normalizePublicPostImageUrl(segment.thumbnailUrl || "")
    return (
      <div key={`bookmark-${index}`} className="aq-bookmark-card">
        <a href={segment.url} target="_blank" rel="noreferrer">
          {thumbnailSrc ? (
            <div className="aq-link-card-thumb" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnailSrc} alt="" loading="lazy" decoding="async" />
            </div>
          ) : null}
          <div className="aq-link-card-copy">
            {providerLabel ? <small>{providerLabel}</small> : null}
            <strong>{segment.title || segment.url}</strong>
            <span>{segment.url}</span>
            {segment.description ? <p>{segment.description}</p> : null}
          </div>
        </a>
      </div>
    )
  }

  if (segment.type === "embed") {
    const previewUrl = segment.embedUrl || resolveEmbedPreviewUrl(segment.url)
    const providerLabel = segment.provider || segment.siteName || inferLinkProvider(segment.url)
    const thumbnailSrc = normalizePublicPostImageUrl(segment.thumbnailUrl || "")
    return (
      <div key={`embed-${index}`} className="aq-embed-card">
        <div className="aq-embed-header">
          <div className="aq-embed-copy">
            {providerLabel ? <small>{providerLabel}</small> : null}
            <strong>{segment.title || "임베드"}</strong>
          </div>
          <a href={segment.url} target="_blank" rel="noreferrer">
            원본 열기
          </a>
        </div>
        {previewUrl ? (
          <div className="aq-embed-frame">
            <iframe
              src={previewUrl}
              title={segment.title || segment.url}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aq-embed-fallback">
            <p>이 사이트는 인라인 임베드를 지원하지 않아 링크 카드로 대체했습니다.</p>
          </div>
        )}
        {thumbnailSrc && !previewUrl ? (
          <div className="aq-embed-thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailSrc} alt="" loading="lazy" decoding="async" />
          </div>
        ) : null}
        {segment.caption ? <p className="aq-embed-caption">{segment.caption}</p> : null}
      </div>
    )
  }

  if (segment.type === "file") {
    const meta = [segment.mimeType || "", formatReadableFileSize(segment.sizeBytes)].filter(Boolean).join(" · ")
    return (
      <div key={`file-${index}`} className="aq-file-card">
        <a href={segment.url} target="_blank" rel="noreferrer">
          <div className="aq-link-card-copy">
            {meta ? <small>{meta}</small> : null}
            <strong>{segment.name || "첨부 파일"}</strong>
            <span>{segment.url}</span>
          </div>
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
        eager={imageIndex === 0}
        editable={editableImages}
        imageIndex={imageIndex}
        onWidthCommit={onImageWidthCommit}
      />
    )
  }

  return renderMarkdown(segment.content, `markdown-${index}`)
}
