import {
  cloneElement,
  isValidElement,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
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
import { resolveMarkdownImageDimensions } from "src/libs/markdown/renderingImageModel"
import { extractNormalizedMermaidSource } from "src/libs/markdown/mermaid"
import { openImageLightboxOverlay } from "src/libs/markdown/imageLightboxOverlay"
import useMermaidEffect from "src/libs/markdown/hooks/useMermaidEffect"
import useResponsiveTableEffect from "src/libs/markdown/hooks/useResponsiveTableEffect"
import useInlineColorEffect from "src/libs/markdown/hooks/useInlineColorEffect"
import usePrismEffect from "src/libs/markdown/hooks/usePrismEffect"
import PrettyCodeBlock from "src/libs/markdown/components/PrettyCodeBlock"
import MarkdownRendererRoot from "src/libs/markdown/components/MarkdownRendererRoot"
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
import { renderMarkdownSegment } from "src/libs/markdown/MarkdownRendererSegments"
import {
  MarkdownFootnoteAppendix,
  MarkdownFootnoteReferenceLink,
  isExternalHttpHref,
  resolveSafeRenderedAnchorHref,
} from "src/libs/markdown/MarkdownRendererFootnotes"
import { createMarkdownHeadingSlugAllocator } from "src/libs/markdown/markdownDocumentInsights"
import { normalizeSafeMarkdownImageSrc } from "src/libs/markdown/safeMarkdownUrl"
import {
  escapeNonPandocSingleDollars,
  hasValidMarkdownMath,
  protectEscapedHighlightDelimiters,
} from "src/libs/markdown/inlineMathGuardModel"
import type { MarkdownRendererProps } from "src/libs/markdown/MarkdownRenderer.types"

export { markdownGuide } from "src/libs/markdown/rendering"
export {
  escapeNonPandocSingleDollars,
  hasValidMarkdownMath,
  hasValidMarkdownMath as hasLikelyMarkdownMath,
} from "src/libs/markdown/inlineMathGuardModel"

type MarkdownRenderPassState = {
  nextTableIndex: number
  tableIndices: WeakMap<object, number>
  nextImageIndex: number
  imageIndices: WeakMap<object, number>
  headingIds: WeakMap<object, string>
  headingSlugAllocator: ReturnType<typeof createMarkdownHeadingSlugAllocator>
}

const createMarkdownRenderPassState = (): MarkdownRenderPassState => ({
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

const handleImageLightboxClick = (target: Element): boolean => {
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

const REMARK_PLUGINS_DEFAULT = [remarkGfm]
const REMARK_PLUGINS_MATH = [remarkGfm, remarkMath]
const REHYPE_PLUGINS_DEFAULT: never[] = []
const REHYPE_PLUGINS_MATH = [rehypeKatex]
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

const normalizeAnchorInlineChildren = (children: ReactNode): ReactNode => {
  if (!hasAnchorTextMatching(children, (text) => text.includes("[["))) {
    return normalizeMarkdownInlineChildren(children)
  }
  let sentinel = "\uE000aqwl0\uE001"
  let idx = 1
  while (hasAnchorTextMatching(children, (text) => text.includes(sentinel))) {
    sentinel = `\uE000aqwl${idx}\uE001`
    idx += 1
  }
  const masked = replaceAnchorText(children, "[[", sentinel)
  return replaceAnchorText(normalizeMarkdownInlineChildren(masked), sentinel, "[[")
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
  return (
    <PrettyCodeBlock
      language={initialCode.language}
      title={title}
      rawCode={rawCode}
      highlightLines={highlightLines}
      preElement={
        <pre {...props} className="aq-code aq-pretty-pre">
          <code
            className={`language-${initialCode.language}`}
            data-language={initialCode.language}
            data-prism-language={initialCode.language}
            data-prism-source={rawCode}
            data-raw-code={rawCode}
            data-highlight-lines={highlightLines || undefined}
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
  imageRenderOrderRef?: { current: number }
) => {
  const imageSrc = normalizeSafeMarkdownImageSrc(typeof src === "string" ? src : "")
  if (!imageSrc) {
    const blockedLabel = alt || "차단된 이미지"
    return (
      <span className="aq-image-blocked" role="img" aria-label={blockedLabel}>
        {blockedLabel}
      </span>
    )
  }
  const imageIndex = allocateNodeOrderIndex(node, state.imageIndices, () =>
    imageRenderOrderRef ? imageRenderOrderRef.current++ : state.nextImageIndex++
  )
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
  tableRenderIndexRef,
  imageRenderOrderRef,
}: {
  footnotes: ReturnType<typeof resolveMarkdownRenderModel>["footnotes"]
  footnoteMarker: string
  tableLayouts: ReturnType<typeof resolveMarkdownRenderModel>["tableLayouts"]
  renderPassStateRef?: { current: MarkdownRenderPassState }
  tableRenderIndexRef?: { current: number }
  imageRenderOrderRef?: { current: number }
}) => {
  const fallbackPassStateRef = { current: createMarkdownRenderPassState() }
  const getPassState = () => (renderPassStateRef ?? fallbackPassStateRef).current

  const renderHeading = (
    Tag: "h1" | "h2" | "h3" | "h4",
    { children, node, id, ...props }: MarkdownElementProps
  ) => {
    const normalizedChildren = normalizeMarkdownInlineChildren(children)
    const resolvedId = resolveHeadingNodeId(getPassState(), node, id, normalizedChildren)
    return <Tag id={resolvedId} {...props}>{normalizedChildren}</Tag>
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
      {normalizeMarkdownInlineChildren(children)}
    </MarkdownTableCellRenderer>
  )

  const sharedComponents: Record<string, unknown> = {
    h1: (props: MarkdownElementProps) => renderHeading("h1", props),
    h2: (props: MarkdownElementProps) => renderHeading("h2", props),
    h3: (props: MarkdownElementProps) => renderHeading("h3", props),
    h4: (props: MarkdownElementProps) => renderHeading("h4", props),
    strong: ({ children, node: _node, ...props }: MarkdownElementProps) => (
      <strong {...props}>{normalizeMarkdownInlineChildren(children)}</strong>
    ),
    em: ({ children, node: _node, ...props }: MarkdownElementProps) => (
      <em {...props}>{normalizeMarkdownInlineChildren(children)}</em>
    ),
    del: ({ children, node: _node, ...props }: MarkdownElementProps) => (
      <del {...props}>{normalizeMarkdownInlineChildren(children)}</del>
    ),
    blockquote: ({ children }: MarkdownElementProps) => <MarkdownBlockquote>{children}</MarkdownBlockquote>,
    li: ({ children, node: _node, ...props }: MarkdownElementProps) => (
      <li {...props}>{normalizeMarkdownInlineChildren(children)}</li>
    ),
    table({ children, node, ...props }: MarkdownElementProps) {
      const state = getPassState()
      const tableIndex = allocateNodeOrderIndex(node, state.tableIndices, () =>
        tableRenderIndexRef ? tableRenderIndexRef.current++ : state.nextTableIndex++
      )
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
      renderMarkdownImageElement(props, getPassState(), imageRenderOrderRef),
    a({ children, href, title, node: _node, ...props }: MarkdownElementProps) {
      const normalizedChildren = normalizeAnchorInlineChildren(children)
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
    p: ({ children }: { children?: ReactNode }) => <MarkdownParagraph inCallout={false}>{children}</MarkdownParagraph>,
  }
  const calloutComponents = {
    ...sharedComponents,
    p: ({ children }: { children?: ReactNode }) => <MarkdownParagraph inCallout={true}>{children}</MarkdownParagraph>,
  }
  const inlineComponents = {
    ...sharedComponents,
    p: ({ children }: { children?: ReactNode }) => <>{normalizeMarkdownInlineChildren(children)}</>,
  }

  return {
    getComponents(inCallout = false, inlineOnly = false) {
      if (inlineOnly) return inlineComponents
      return inCallout ? calloutComponents : defaultComponents
    },
  }
}

const syncFocusableMarkdownImages = (root: HTMLElement | null, editableImages: boolean) => {
  if (!root || editableImages) return
  for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
    if (!image.closest("a, button") && !image.hasAttribute("tabindex")) {
      image.tabIndex = 0
    }
  }
}

const shouldOpenLightboxFromKeyDown = (
  event: ReactKeyboardEvent<HTMLDivElement>,
  editableImages: boolean
): boolean => {
  if (editableImages || (event.key !== "Enter" && event.key !== " ")) return false
  if (!(event.target instanceof HTMLImageElement)) return false
  if (!event.target.closest(".aq-markdown") || event.target.closest("a, button")) return false
  return handleImageLightboxClick(event.target)
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
  const renderPassStateRef = useRef<MarkdownRenderPassState>(createMarkdownRenderPassState())
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
    syncFocusableMarkdownImages(rootRef.current, editableImages)
  }, [editableImages, renderKey])

  const handleRootClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!editableImages && event.target instanceof Element) {
        handleImageLightboxClick(event.target)
      }
    },
    [editableImages]
  )

  const handleRootKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (shouldOpenLightboxFromKeyDown(event, editableImages)) {
        event.preventDefault()
      }
    },
    [editableImages]
  )

  const componentVariants = useMemo(
    () =>
      createMarkdownComponentVariants({
        footnotes,
        footnoteMarker,
        tableLayouts,
        renderPassStateRef,
      }),
    [footnoteMarker, footnotes, tableLayouts]
  )

  renderPassStateRef.current = createMarkdownRenderPassState()

  const renderMarkdown = (markdown: string, key: string, inCallout = false, inlineOnly = false) => {
    const hasMath = hasValidMarkdownMath(markdown)
    const preparedMarkdown = protectEscapedHighlightDelimiters(
      hasMath ? escapeNonPandocSingleDollars(markdown) : markdown
    )
    return (
      <ReactMarkdown
        key={key}
        remarkPlugins={hasMath ? REMARK_PLUGINS_MATH : REMARK_PLUGINS_DEFAULT}
        rehypePlugins={hasMath ? REHYPE_PLUGINS_MATH : REHYPE_PLUGINS_DEFAULT}
        components={componentVariants.getComponents(inCallout, inlineOnly)}
      >
        {preparedMarkdown}
      </ReactMarkdown>
    )
  }

  const editableDataValue = editableImages ? "true" : undefined

  if (resolvedContentHtml) {
    return (
      <MarkdownRendererRoot
        ref={rootRef}
        className="aq-markdown"
        data-editable={editableDataValue}
        data-force-scheme={forceScheme}
        onClick={handleRootClick}
        onKeyDown={handleRootKeyDown}
        dangerouslySetInnerHTML={{ __html: resolvedContentHtml }}
      />
    )
  }

  if (!normalizedContent) {
    return <MarkdownRendererRoot data-force-scheme={forceScheme}>본문이 없습니다.</MarkdownRendererRoot>
  }

  let standaloneImageIndex = -1

  return (
    <MarkdownRendererRoot
      ref={rootRef}
      className="aq-markdown"
      data-editable={editableDataValue}
      data-force-scheme={forceScheme}
      onClick={handleRootClick}
      onKeyDown={handleRootKeyDown}
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
