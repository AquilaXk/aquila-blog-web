import {
  type CSSProperties,
  type FC,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import {
  extractCodeMetaFromPreChildren,
  extractTextFromCodeAst,
  isMermaidSource,
  parseHighlightedLineNumbers,
  resolveMarkdownRenderModel,
} from "src/libs/markdown/rendering"
import { extractNormalizedMermaidSource } from "src/libs/markdown/mermaid"
import { openImageLightboxOverlay } from "src/libs/markdown/imageLightboxOverlay"
import useMermaidEffect from "src/libs/markdown/hooks/useMermaidEffect"
import useResponsiveTableEffect from "src/libs/markdown/hooks/useResponsiveTableEffect"
import useInlineColorEffect from "src/libs/markdown/hooks/useInlineColorEffect"
import usePrismEffect from "src/libs/markdown/hooks/usePrismEffect"
import PrettyCodeBlock from "src/libs/markdown/components/PrettyCodeBlock"
import MarkdownRendererRoot from "src/libs/markdown/components/MarkdownRendererRoot"
import { renderImmediateCodeToHtml } from "src/libs/markdown/prismRuntime"
import {
  MarkdownBlockquote,
  MarkdownParagraph,
  extractTextFromMarkdownNode,
} from "src/libs/markdown/MarkdownRendererInline"
import {
  MarkdownTableCellRenderer,
  MarkdownTableRenderer,
  MarkdownTableRowRenderer,
} from "src/libs/markdown/MarkdownRendererTable"
import { renderMarkdownSegment } from "src/libs/markdown/MarkdownRendererSegments"
import {
  MarkdownFootnoteAppendix,
  MarkdownFootnoteReferenceLink,
} from "src/libs/markdown/MarkdownRendererFootnotes"
import { normalizeSafeMarkdownImageSrc } from "src/libs/markdown/safeMarkdownUrl"
import type { MarkdownRendererProps } from "src/libs/markdown/MarkdownRenderer.types"

export { markdownGuide } from "src/libs/markdown/rendering"

export const buildHeadingAnchorUrl = (locationHref: string, headingId: string): string => {
  const trimmedId = headingId.trim().replace(/^#/, "")
  const hashIndex = locationHref.indexOf("#")
  const baseHref = hashIndex >= 0 ? locationHref.slice(0, hashIndex) : locationHref
  if (!trimmedId) return baseHref
  return `${baseHref}#${trimmedId}`
}

const handleHeadingAnchorClick = (target: Element): boolean => {
  const heading = target.closest<HTMLElement>("h2[id], h3[id], h4[id]")
  if (!heading?.id || target.closest("a")) return false
  if (typeof window === "undefined") return false
  const selectionText = window.getSelection?.()?.toString().trim() ?? ""
  if (selectionText.length > 0) return false

  window.history.replaceState(null, "", `#${heading.id}`)
  const fullUrl = buildHeadingAnchorUrl(window.location.href, heading.id)
  void navigator.clipboard?.writeText(fullUrl)?.catch(() => undefined)
  heading.setAttribute("data-anchor-copied", "true")
  window.setTimeout(() => {
    heading.removeAttribute("data-anchor-copied")
  }, 1500)
  return true
}

const handleImageLightboxClick = (target: Element): boolean => {
  if (target.closest("a[href], .aq-image-resize-handle")) return false
  const image = target.closest<HTMLImageElement>(".aq-image-frame img")
  if (!image) return false
  const frame = image.closest<HTMLElement>(".aq-image-frame")
  if (frame?.getAttribute("data-editable") === "true") return false
  const src = image.getAttribute("src") || image.src
  if (!src) return false
  const caption = frame?.querySelector("figcaption")?.textContent || undefined
  openImageLightboxOverlay({
    src,
    alt: image.getAttribute("alt") || "",
    caption,
    trigger: image,
  })
  return true
}

const resolveMarkdownTableCellAlignment = (node: unknown, propAlignment: unknown, style: unknown) => {
  const nodeProperties = (node as { properties?: { align?: unknown; style?: unknown } } | null)?.properties
  const nodeAlignment = nodeProperties?.align
  const styleAlignment =
    typeof style === "object" && style && "textAlign" in style
      ? (style as { textAlign?: unknown }).textAlign
      : undefined
  const serializedStyle = typeof nodeProperties?.style === "string" ? nodeProperties.style : ""
  const serializedStyleAlignment = /text-align:\s*(left|center|right)/i
    .exec(serializedStyle)?.[1]
    ?.toLowerCase()
  const alignment = propAlignment || nodeAlignment || styleAlignment || serializedStyleAlignment
  return typeof alignment === "string" ? alignment : undefined
}

const REMARK_PLUGINS_DEFAULT = [remarkGfm]
const REMARK_PLUGINS_MATH = [remarkGfm, remarkMath]
const REHYPE_PLUGINS_DEFAULT: never[] = []
const REHYPE_PLUGINS_MATH = [rehypeKatex]

export const resolvePreBlockMermaidSource = (language: string, rawCode: string): string => {
  const normalizedLanguage = (language || "").trim().toLowerCase()
  if (normalizedLanguage && normalizedLanguage !== "mermaid") {
    return ""
  }
  if (normalizedLanguage === "mermaid") {
    return extractNormalizedMermaidSource(rawCode) || rawCode
  }
  if (!isMermaidSource(rawCode)) {
    return ""
  }
  return extractNormalizedMermaidSource(rawCode) || rawCode
}

export const hasLikelyMarkdownMath = (markdown: string): boolean => {
  const firstDollar = markdown.indexOf("$")
  if (firstDollar === -1) return false
  if (markdown.includes("$$")) return true
  let index = firstDollar
  const length = markdown.length
  while (index < length) {
    const lineEnd = markdown.indexOf("\n", index)
    const currentLineEnd = lineEnd === -1 ? length : lineEnd
    let dollarCountOnLine = 0
    let cursor = index
    while (cursor < currentLineEnd) {
      const nextDollar = markdown.indexOf("$", cursor)
      if (nextDollar === -1 || nextDollar >= currentLineEnd) break
      if (nextDollar === 0 || markdown.codePointAt(nextDollar - 1) !== 92) {
        dollarCountOnLine += 1
        if (dollarCountOnLine >= 2) return true
      }
      cursor = nextDollar + 1
    }
    if (lineEnd === -1) break
    index = lineEnd + 1
  }
  return false
}

export const createMarkdownComponentVariants = ({
  footnotes,
  footnoteMarker,
  tableLayouts,
  tableRenderIndexRef,
  imageRenderOrderRef,
}: {
  footnotes: ReturnType<typeof resolveMarkdownRenderModel>["footnotes"]
  footnoteMarker: string
  tableLayouts: ReturnType<typeof resolveMarkdownRenderModel>["tableLayouts"]
  tableRenderIndexRef: { current: number }
  imageRenderOrderRef: { current: number }
}) => {
  const sharedComponents: Record<string, unknown> = {
    blockquote({ children }: { children?: ReactNode }) {
      return <MarkdownBlockquote>{children}</MarkdownBlockquote>
    },
    table({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
      const layout = tableLayouts[tableRenderIndexRef.current] || null
      tableRenderIndexRef.current += 1
      return (
        <MarkdownTableRenderer layout={layout} {...props}>
          {children}
        </MarkdownTableRenderer>
      )
    },
    tr({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
      return <MarkdownTableRowRenderer {...props}>{children}</MarkdownTableRowRenderer>
    },
    th({
      children,
      node,
      ...props
    }: {
      children?: ReactNode
      node?: unknown
      align?: unknown
      style?: unknown
      className?: string
    }) {
      return (
        <MarkdownTableCellRenderer
          as="th"
          alignment={resolveMarkdownTableCellAlignment(node, props.align, props.style)}
          className={props.className}
        >
          {children}
        </MarkdownTableCellRenderer>
      )
    },
    td({
      children,
      node,
      ...props
    }: {
      children?: ReactNode
      node?: unknown
      align?: unknown
      style?: unknown
      className?: string
    }) {
      return (
        <MarkdownTableCellRenderer
          as="td"
          alignment={resolveMarkdownTableCellAlignment(node, props.align, props.style)}
          className={props.className}
        >
          {children}
        </MarkdownTableCellRenderer>
      )
    },
    img({ src, alt }: { src?: string; alt?: string }) {
      const imageSrc = normalizeSafeMarkdownImageSrc(typeof src === "string" ? src : "")
      if (!imageSrc) {
        const blockedLabel = alt || "차단된 이미지"
        return (
          <span className="aq-image-blocked" role="img" aria-label={blockedLabel}>
            {blockedLabel}
          </span>
        )
      }
      const isFirstImage = imageRenderOrderRef.current === 0
      imageRenderOrderRef.current += 1

      let imgWidth: number | undefined
      let imgHeight: number | undefined
      try {
        const parsed = new URL(imageSrc, "https://dummy.local")
        const w = parsed.searchParams.get("w") || parsed.searchParams.get("width")
        const h = parsed.searchParams.get("h") || parsed.searchParams.get("height")
        if (w && /^\d+$/.test(w)) imgWidth = Number.parseInt(w, 10)
        if (h && /^\d+$/.test(h)) imgHeight = Number.parseInt(h, 10)
      } catch {}

      const aspectRatio = imgWidth && imgHeight ? `${imgWidth} / ${imgHeight}` : undefined

      return (
        <figure
          className="aq-image-frame"
          style={aspectRatio ? ({ aspectRatio } as CSSProperties) : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={alt || ""}
            width={imgWidth}
            height={imgHeight}
            style={aspectRatio ? { aspectRatio } : undefined}
            loading={isFirstImage ? "eager" : "lazy"}
            fetchPriority={isFirstImage ? "high" : undefined}
            decoding="async"
          />
          {alt ? <figcaption>{alt}</figcaption> : null}
        </figure>
      )
    },
    a({
      children,
      href,
      title,
      node: _node,
      ...props
    }: {
      children?: ReactNode
      href?: string
      title?: string
      node?: unknown
    } & Record<string, unknown>) {
      return (
        <MarkdownFootnoteReferenceLink
          footnotes={footnotes}
          marker={footnoteMarker}
          href={href}
          title={title}
          {...props}
        >
          {children}
        </MarkdownFootnoteReferenceLink>
      )
    },
    code({
      node,
      className,
      children,
      ...props
    }: {
      node?: unknown
      className?: string
      children?: ReactNode
    } & Record<string, unknown>) {
      let rawFromChildren = ""
      if (typeof children === "string") {
        rawFromChildren = children
      } else if (Array.isArray(children)) {
        rawFromChildren = children
          .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
          .join("\n")
      } else {
        rawFromChildren = extractTextFromMarkdownNode(children)
      }
      const raw = rawFromChildren || extractTextFromCodeAst(node)
      const isInlineCode = !className && !raw.includes("\n")

      if (isInlineCode) {
        return (
          <code className="aq-inline-code" {...props}>
            {children}
          </code>
        )
      }

      return (
        <code className={className} data-raw-code={raw} {...props}>
          {children}
        </code>
      )
    },
    pre({
      node,
      children,
      className: _className,
      ...props
    }: {
      node?: unknown
      children?: ReactNode
      className?: string
    } & Record<string, unknown>) {
      const { language, title, rawCode, highlightLines } = extractCodeMetaFromPreChildren(children, node)
      const mermaidSource = resolvePreBlockMermaidSource(language, rawCode)

      if (mermaidSource) {
        return (
          <pre
            className="aq-mermaid"
            data-aq-mermaid="true"
            data-mermaid-rendered="pending"
            data-mermaid-source={mermaidSource}
          >
            <code className="language-mermaid">{mermaidSource}</code>
          </pre>
        )
      }

      const mergedClassName = "aq-code aq-pretty-pre"
      const highlightedLines = highlightLines
        ? parseHighlightedLineNumbers(highlightLines)
        : undefined
      const initialCodePresentation = renderImmediateCodeToHtml({
        source: rawCode,
        language,
        highlightedLines,
      })

      return (
        <PrettyCodeBlock
          language={initialCodePresentation.language}
          title={title}
          rawCode={rawCode}
          highlightLines={highlightLines}
          preElement={
            <pre {...props} className={mergedClassName}>
              <code
                className={`language-${initialCodePresentation.language}`}
                data-language={initialCodePresentation.language}
                data-prism-language={initialCodePresentation.language}
                data-prism-source={rawCode}
                data-raw-code={rawCode}
                data-highlight-lines={highlightLines || undefined}
                dangerouslySetInnerHTML={{ __html: initialCodePresentation.html }}
              />
            </pre>
          }
        />
      )
    },
  }

  const defaultComponents = {
    ...sharedComponents,
    p({ children }: { children?: ReactNode }) {
      return <MarkdownParagraph inCallout={false}>{children}</MarkdownParagraph>
    },
  }
  const calloutComponents = {
    ...sharedComponents,
    p({ children }: { children?: ReactNode }) {
      return <MarkdownParagraph inCallout={true}>{children}</MarkdownParagraph>
    },
  }
  const inlineComponents = {
    ...sharedComponents,
    p({ children }: { children?: ReactNode }) {
      return <>{children}</>
    },
  }

  return {
    getComponents(inCallout = false, inlineOnly = false) {
      if (inlineOnly) return inlineComponents
      return inCallout ? calloutComponents : defaultComponents
    },
  }
}

const MarkdownRendererComponent: FC<MarkdownRendererProps> = ({
  content,
  trustedContentHtml,
  disableMermaid = false,
  forceScheme,
  editableImages = false,
  onImageWidthCommit,
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const imageRenderOrderRef = useRef(0)
  const tableRenderIndexRef = useRef(0)
  const renderModel = useMemo(
    () => resolveMarkdownRenderModel({ content, trustedContentHtml }),
    [content, trustedContentHtml]
  )
  const { normalizedContent, renderKey, resolvedContentHtml, segments, footnotes, footnoteMarker } = renderModel
  const { tableLayouts } = renderModel

  useMermaidEffect(rootRef, renderKey, !disableMermaid, {
    observeMutations: false,
    forceScheme,
  })
  useResponsiveTableEffect(rootRef, renderKey)
  useInlineColorEffect(rootRef, renderKey)
  usePrismEffect(rootRef, renderKey, true, {
    mutationDebounceMs: 96,
  })

  useEffect(() => {
    imageRenderOrderRef.current = 0
  }, [renderKey])

  const handleRootClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (editableImages) return
      if (!(event.target instanceof Element)) return
      if (handleImageLightboxClick(event.target)) return
      handleHeadingAnchorClick(event.target)
    },
    [editableImages]
  )

  const componentVariants = useMemo(
    () =>
      createMarkdownComponentVariants({
        footnotes,
        footnoteMarker,
        tableLayouts,
        tableRenderIndexRef,
        imageRenderOrderRef,
      }),
    [footnoteMarker, footnotes, tableLayouts]
  )

  tableRenderIndexRef.current = 0
  imageRenderOrderRef.current = 0

  const renderMarkdown = (markdown: string, key: string, inCallout = false, inlineOnly = false) => {
    const hasMath = hasLikelyMarkdownMath(markdown)
    return (
      <ReactMarkdown
        key={key}
        remarkPlugins={hasMath ? REMARK_PLUGINS_MATH : REMARK_PLUGINS_DEFAULT}
        rehypePlugins={hasMath ? REHYPE_PLUGINS_MATH : REHYPE_PLUGINS_DEFAULT}
        components={componentVariants.getComponents(inCallout, inlineOnly)}
      >
        {markdown}
      </ReactMarkdown>
    )
  }

  if (resolvedContentHtml) {
    return (
      <MarkdownRendererRoot
        ref={rootRef}
        className="aq-markdown"
        data-editable={editableImages ? "true" : undefined}
        onClick={handleRootClick}
        dangerouslySetInnerHTML={{ __html: resolvedContentHtml }}
      />
    )
  }

  if (!normalizedContent) return <MarkdownRendererRoot>본문이 없습니다.</MarkdownRendererRoot>

  let standaloneImageIndex = -1

  return (
    <MarkdownRendererRoot
      ref={rootRef}
      className="aq-markdown"
      data-editable={editableImages ? "true" : undefined}
      onClick={handleRootClick}
    >
      {segments.map((segment, index) => {
        const imageIndex = segment.type === "image" ? (standaloneImageIndex += 1) : -1
        return renderMarkdownSegment({
          segment,
          index,
          imageIndex,
          editableImages,
          onImageWidthCommit,
          renderMarkdown,
        })
      })}
      <MarkdownFootnoteAppendix footnotes={footnotes} renderMarkdown={renderMarkdown} />
    </MarkdownRendererRoot>
  )
}

MarkdownRendererComponent.displayName = "MarkdownRenderer"

const MarkdownRenderer = memo(MarkdownRendererComponent)

MarkdownRenderer.displayName = "MarkdownRendererMemo"

export default MarkdownRenderer
