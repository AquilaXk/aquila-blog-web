import {
  cloneElement,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  extractCodeMetaFromPreChildren,
  extractTextFromCodeAst,
  isMermaidSource,
  parseHighlightedLineNumbers,
  resolveMarkdownRenderModel,
} from "src/libs/markdown/rendering"
import { resolveMarkdownImageDimensions } from "src/libs/markdown/renderingImageModel"
import { extractNormalizedMermaidSource } from "src/libs/markdown/mermaid"
import { openImageLightboxOverlay } from "src/libs/markdown/imageLightboxOverlay"
import type { TranslationKey } from "src/libs/language"
import { HeadingAnchorButton } from "src/libs/markdown/components/HeadingAnchorButton"
import PrettyCodeBlock from "src/libs/markdown/components/PrettyCodeBlock"
import { renderImmediateCodeToHtml } from "src/libs/markdown/prismRuntime"
import { MarkdownImageFigure } from "src/libs/markdown/MarkdownRendererImage"
import {
  MarkdownBlockquote,
  MarkdownParagraph,
  extractTextFromMarkdownNode,
  normalizeMarkdownInlineChildren,
} from "src/libs/markdown/MarkdownRendererInline"
import {
  MarkdownTableCellRenderer,
  MarkdownTableRenderer,
  MarkdownTableRowRenderer,
} from "src/libs/markdown/MarkdownRendererTable"
import {
  MarkdownFootnoteReferenceLink,
  isExternalHttpHref,
  resolveSafeRenderedAnchorHref,
} from "src/libs/markdown/MarkdownRendererFootnotes"
import { createMarkdownHeadingSlugAllocator } from "src/libs/markdown/markdownDocumentInsights"
import { normalizeSafeMarkdownImageSrc } from "src/libs/markdown/safeMarkdownUrl"
import type { ProtectedInlineSentinels } from "src/libs/markdown/inlineMathGuardModel"

export type MarkdownRenderPassState = {
  nextTableIndex: number
  tableIndices: WeakMap<object, number>
  nextImageIndex: number
  imageIndices: WeakMap<object, number>
  headingIds: WeakMap<object, string>
  headingSlugAllocator: ReturnType<typeof createMarkdownHeadingSlugAllocator>
}

export const createMarkdownRenderPassState = (): MarkdownRenderPassState => ({
  nextTableIndex: 0,
  tableIndices: new WeakMap(),
  nextImageIndex: 0,
  imageIndices: new WeakMap(),
  headingIds: new WeakMap(),
  headingSlugAllocator: createMarkdownHeadingSlugAllocator(),
})

const allocateNodeOrderIndex = (
  node: unknown,
  nodeMap: WeakMap<object, number>,
  allocateNext: () => number
): number => {
  if (typeof node === "object" && node !== null) {
    const existing = nodeMap.get(node)
    if (existing !== undefined) return existing
    const next = allocateNext()
    nodeMap.set(node, next)
    return next
  }
  return allocateNext()
}

export const handleImageLightboxClick = (target: Element): boolean => {
  if (target.closest("a, button, .aq-image-resize-handle")) return false
  const image =
    target instanceof HTMLImageElement
      ? target
      : target.closest<HTMLImageElement>(".aq-image-frame img")
  if (!image) return false
  const frame = image.closest<HTMLElement>(".aq-image-frame")
  if (frame?.dataset.editable === "true") return false
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

const ANCHOR_INLINE_TRAVERSABLE_TAGS = new Set(["mark", "strong", "em", "del", "span"])

const isTraversableAnchorElement = (node: ReactNode): node is ReactElement<{ children?: ReactNode }> =>
  isValidElement<{ children?: ReactNode }>(node) &&
  typeof node.type === "string" &&
  ANCHOR_INLINE_TRAVERSABLE_TAGS.has(node.type)

const hasAnchorTextMatching = (node: ReactNode, predicate: (value: string) => boolean): boolean => {
  if (typeof node === "string") return predicate(node)
  if (Array.isArray(node)) return node.some((item) => hasAnchorTextMatching(item, predicate))
  return isTraversableAnchorElement(node) ? hasAnchorTextMatching(node.props.children, predicate) : false
}

const replaceAnchorText = (node: ReactNode, fromToken: string, toToken: string): ReactNode => {
  if (typeof node === "string") {
    return node.includes(fromToken) ? node.replaceAll(fromToken, toToken) : node
  }
  if (Array.isArray(node)) return node.map((item) => replaceAnchorText(item, fromToken, toToken))
  if (!isTraversableAnchorElement(node)) return node
  const nextChildren = replaceAnchorText(node.props.children, fromToken, toToken)
  return nextChildren === node.props.children ? node : cloneElement(node, undefined, nextChildren)
}

const normalizeAnchorInlineChildren = (children: ReactNode, sentinels?: ProtectedInlineSentinels): ReactNode => {
  if (!hasAnchorTextMatching(children, (text) => text.includes("[["))) {
    return normalizeMarkdownInlineChildren(children, sentinels)
  }
  let sentinel = "\uE000aqwl0\uE001"
  let idx = 1
  while (hasAnchorTextMatching(children, (text) => text.includes(sentinel))) {
    sentinel = `\uE000aqwl${idx}\uE001`
    idx += 1
  }
  const masked = replaceAnchorText(children, "[[", sentinel)
  return replaceAnchorText(normalizeMarkdownInlineChildren(masked, sentinels), sentinel, "[[")
}

export const resolvePreBlockMermaidSource = (language: string, rawCode: string): string => {
  const normalizedLanguage = (language || "").trim().toLowerCase()
  if (normalizedLanguage && normalizedLanguage !== "mermaid") return ""
  if (normalizedLanguage !== "mermaid" && !isMermaidSource(rawCode)) return ""
  return extractNormalizedMermaidSource(rawCode) || rawCode
}

type MarkdownElementProps = {
  children?: ReactNode
  node?: unknown
  id?: string
  className?: string
  href?: string
  title?: string
  src?: string
  alt?: string
} & Record<string, unknown>

type MarkdownTableCellProps = {
  children?: ReactNode
  node?: unknown
  align?: unknown
  style?: unknown
  className?: string
}

const resolveHeadingNodeId = (
  state: MarkdownRenderPassState,
  node: unknown,
  explicitId: unknown,
  normalizedChildren: ReactNode
): string => {
  if (typeof explicitId === "string" && explicitId.trim()) return explicitId.trim()
  if (typeof node === "object" && node !== null) {
    const cached = state.headingIds.get(node)
    if (cached) return cached
    const allocated = state.headingSlugAllocator.allocate(extractTextFromMarkdownNode(normalizedChildren))
    state.headingIds.set(node, allocated)
    return allocated
  }
  return state.headingSlugAllocator.allocate(extractTextFromMarkdownNode(normalizedChildren))
}

const extractRawCodeFromChildren = (children: ReactNode): string => {
  if (typeof children === "string") return children
  if (!Array.isArray(children)) return extractTextFromMarkdownNode(children)
  return children
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("\n")
}

const renderMarkdownCodeElement = ({ node, className, children, ...props }: MarkdownElementProps) => {
  const raw = extractRawCodeFromChildren(children) || extractTextFromCodeAst(node)
  if (!className && !raw.includes("\n")) {
    return <code className="aq-inline-code" {...props}>{children}</code>
  }
  return <code className={className} data-raw-code={raw} {...props}>{children}</code>
}

const renderMarkdownPreElement = ({ node, children, className: _className, ...props }: MarkdownElementProps) => {
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
  const highlightedLines = highlightLines ? parseHighlightedLineNumbers(highlightLines) : undefined
  const initialCode = renderImmediateCodeToHtml({ source: rawCode, language, highlightedLines })
  const cleanRawCode = initialCode.cleanSource
  return (
    <PrettyCodeBlock
      language={initialCode.language}
      title={title}
      rawCode={cleanRawCode}
      highlightLines={highlightLines}
      preElement={
        <pre {...props} className="aq-code aq-pretty-pre">
          <code
            className={`language-${initialCode.language}`}
            data-language={initialCode.language}
            data-prism-language={initialCode.language}
            data-prism-source={cleanRawCode}
            data-raw-code={cleanRawCode}
            data-highlight-lines={highlightLines || undefined}
            data-has-diff={initialCode.hasDiff ? "true" : undefined}
            dangerouslySetInnerHTML={{ __html: initialCode.html }}
          />
        </pre>
      }
    />
  )
}

const renderMarkdownImageElement = (
  { src, alt, node }: MarkdownElementProps,
  state: MarkdownRenderPassState,
  t: (key: TranslationKey) => string
) => {
  const imageSrc = normalizeSafeMarkdownImageSrc(typeof src === "string" ? src : "")
  if (!imageSrc) {
    const blockedLabel = alt || t("markdownBlockedImage")
    return (
      <span className="aq-image-blocked" role="img" aria-label={blockedLabel}>
        {blockedLabel}
      </span>
    )
  }
  const imageIndex = allocateNodeOrderIndex(node, state.imageIndices, () => state.nextImageIndex++)
  const { widthPx, heightPx, aspectRatio } = resolveMarkdownImageDimensions(imageSrc)
  return (
    <MarkdownImageFigure
      src={imageSrc}
      alt={alt || ""}
      widthPx={widthPx}
      heightPx={heightPx}
      aspectRatio={aspectRatio}
      eager={imageIndex === 0}
      imageIndex={imageIndex}
    />
  )
}

export const createMarkdownComponentVariants = ({
  footnotes,
  footnoteMarker,
  tableLayouts,
  renderPassStateRef,
  sentinels,
  t,
}: {
  footnotes: ReturnType<typeof resolveMarkdownRenderModel>["footnotes"]
  footnoteMarker: string
  tableLayouts: ReturnType<typeof resolveMarkdownRenderModel>["tableLayouts"]
  renderPassStateRef?: { current: MarkdownRenderPassState }
  sentinels?: ProtectedInlineSentinels
  t?: (key: TranslationKey) => string
}) => {
  const fallbackPassStateRef = { current: createMarkdownRenderPassState() }
  const getPassState = () => (renderPassStateRef ?? fallbackPassStateRef).current
  const normalizeInline = (children: ReactNode) => normalizeMarkdownInlineChildren(children, sentinels)

  const renderHeading = (
    Tag: "h1" | "h2" | "h3" | "h4",
    { children, node, id, ...props }: MarkdownElementProps
  ) => {
    const normalizedChildren = normalizeInline(children)
    const resolvedId = resolveHeadingNodeId(getPassState(), node, id, normalizedChildren)
    const showAnchor = Boolean(resolvedId && resolvedId !== "aq-footnote-heading")
    return (
      <Tag id={resolvedId} {...props}>
        {normalizedChildren}
        {showAnchor ? (
          <HeadingAnchorButton
            id={resolvedId}
            copyAria={t ? t("headingCopyAnchorAria") : "Copy section link"}
            copiedText={t ? t("headingCopiedToast") : "Copied"}
          />
        ) : null}
      </Tag>
    )
  }

  const renderTableCell = (
    as: "th" | "td",
    { children, node, align, style, className }: MarkdownTableCellProps
  ) => (
    <MarkdownTableCellRenderer
      as={as}
      alignment={resolveMarkdownTableCellAlignment(node, align, style)}
      className={className}
    >
      {normalizeInline(children)}
    </MarkdownTableCellRenderer>
  )

  const sharedComponents: Record<string, unknown> = {
    h1: (props: MarkdownElementProps) => renderHeading("h1", props),
    h2: (props: MarkdownElementProps) => renderHeading("h2", props),
    h3: (props: MarkdownElementProps) => renderHeading("h3", props),
    h4: (props: MarkdownElementProps) => renderHeading("h4", props),
    h5: ({ children, node: _node, ...props }: MarkdownElementProps) => <h5 {...props}>{normalizeInline(children)}</h5>,
    h6: ({ children, node: _node, ...props }: MarkdownElementProps) => <h6 {...props}>{normalizeInline(children)}</h6>,
    strong: ({ children, node: _node, ...props }: MarkdownElementProps) => <strong {...props}>{normalizeInline(children)}</strong>,
    em: ({ children, node: _node, ...props }: MarkdownElementProps) => <em {...props}>{normalizeInline(children)}</em>,
    del: ({ children, node: _node, ...props }: MarkdownElementProps) => <del {...props}>{normalizeInline(children)}</del>,
    blockquote: ({ children }: MarkdownElementProps) => <MarkdownBlockquote>{children}</MarkdownBlockquote>,
    li: ({ children, node: _node, ...props }: MarkdownElementProps) => <li {...props}>{normalizeInline(children)}</li>,
    table({ children, node, ...props }: MarkdownElementProps) {
      const state = getPassState()
      const tableIndex = allocateNodeOrderIndex(node, state.tableIndices, () => state.nextTableIndex++)
      return (
        <MarkdownTableRenderer layout={tableLayouts[tableIndex] || null} {...props}>
          {children}
        </MarkdownTableRenderer>
      )
    },
    tr: ({ children, ...props }: MarkdownElementProps) => (
      <MarkdownTableRowRenderer {...props}>{children}</MarkdownTableRowRenderer>
    ),
    th: (props: MarkdownTableCellProps) => renderTableCell("th", props),
    td: (props: MarkdownTableCellProps) => renderTableCell("td", props),
    img: (props: MarkdownElementProps) =>
      renderMarkdownImageElement(
        props,
        getPassState(),
        t ?? (() => "")
      ),
    a({ children, href, title, node: _node, ...props }: MarkdownElementProps) {
      const normalizedChildren = normalizeAnchorInlineChildren(children, sentinels)
      const safeHref = resolveSafeRenderedAnchorHref(href)
      if (!safeHref) return <span>{normalizedChildren}</span>
      const externalProps = isExternalHttpHref(safeHref)
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined
      return (
        <MarkdownFootnoteReferenceLink
          footnotes={footnotes}
          marker={footnoteMarker}
          href={safeHref}
          title={title}
          {...props}
          {...externalProps}
        >
          {normalizedChildren}
        </MarkdownFootnoteReferenceLink>
      )
    },
    code: renderMarkdownCodeElement,
    pre: renderMarkdownPreElement,
  }

  const defaultComponents = {
    ...sharedComponents,
    p: ({ children }: { children?: ReactNode }) => <MarkdownParagraph inCallout={false} sentinels={sentinels}>{children}</MarkdownParagraph>,
  }
  const calloutComponents = {
    ...sharedComponents,
    p: ({ children }: { children?: ReactNode }) => <MarkdownParagraph inCallout={true} sentinels={sentinels}>{children}</MarkdownParagraph>,
  }
  const inlineComponents = {
    ...sharedComponents,
    p: ({ children }: { children?: ReactNode }) => <>{normalizeInline(children)}</>,
  }

  return {
    getComponents(inCallout = false, inlineOnly = false) {
      if (inlineOnly) return inlineComponents
      return inCallout ? calloutComponents : defaultComponents
    },
  }
}

export const syncFocusableMarkdownImages = (root: HTMLElement | null, editableImages: boolean) => {
  if (!root || editableImages) return
  for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
    if (!image.closest("a, button") && !image.hasAttribute("tabindex")) {
      image.tabIndex = 0
    }
  }
}

export const shouldOpenLightboxFromKeyDown = (
  event: ReactKeyboardEvent<HTMLDivElement>,
  editableImages: boolean
): boolean => {
  if (editableImages || (event.key !== "Enter" && event.key !== " ")) return false
  if (!(event.target instanceof HTMLImageElement)) return false
  if (!event.target.closest(".aq-markdown") || event.target.closest("a, button")) return false
  return handleImageLightboxClick(event.target)
}
