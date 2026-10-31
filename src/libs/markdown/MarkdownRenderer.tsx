import {
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
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
} from "src/libs/markdown/MarkdownRendererFootnotes"
import { createMarkdownHeadingSlugAllocator } from "src/libs/markdown/markdownDocumentInsights"
import { normalizeSafeMarkdownImageSrc } from "src/libs/markdown/safeMarkdownUrl"
import type { MarkdownRendererProps } from "src/libs/markdown/MarkdownRenderer.types"

export { markdownGuide } from "src/libs/markdown/rendering"

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
    const state = getPassState()
    let resolvedId = typeof id === "string" && id.trim() ? id.trim() : ""
    if (!resolvedId) {
      if (typeof node === "object" && node !== null) {
        const cached = state.headingIds.get(node)
        if (cached) {
          resolvedId = cached
        } else {
          resolvedId = state.headingSlugAllocator.allocate(
            extractTextFromMarkdownNode(normalizedChildren)
          )
          state.headingIds.set(node, resolvedId)
        }
      } else {
        resolvedId = state.headingSlugAllocator.allocate(
          extractTextFromMarkdownNode(normalizedChildren)
        )
      }
    }
    return (
      <Tag id={resolvedId} {...props}>
        {normalizedChildren}
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
      {normalizeMarkdownInlineChildren(children)}
    </MarkdownTableCellRenderer>
  )

  const sharedComponents: Record<string, unknown> = {
    h1: (props: MarkdownElementProps) => renderHeading("h1", props),
    h2: (props: MarkdownElementProps) => renderHeading("h2", props),
    h3: (props: MarkdownElementProps) => renderHeading("h3", props),
    h4: (props: MarkdownElementProps) => renderHeading("h4", props),
    strong({ children, node: _node, ...props }: MarkdownElementProps) {
      return <strong {...props}>{normalizeMarkdownInlineChildren(children)}</strong>
    },
    em({ children, node: _node, ...props }: MarkdownElementProps) {
      return <em {...props}>{normalizeMarkdownInlineChildren(children)}</em>
    },
    del({ children, node: _node, ...props }: MarkdownElementProps) {
      return <del {...props}>{normalizeMarkdownInlineChildren(children)}</del>
    },
    blockquote({ children }: MarkdownElementProps) {
      return <MarkdownBlockquote>{children}</MarkdownBlockquote>
    },
    li({ children, node: _node, ...props }: MarkdownElementProps) {
      return <li {...props}>{normalizeMarkdownInlineChildren(children)}</li>
    },
    table({ children, node, ...props }: MarkdownElementProps) {
      const state = getPassState()
      const tableIndex = allocateNodeOrderIndex(node, state.tableIndices, () =>
        tableRenderIndexRef ? tableRenderIndexRef.current++ : state.nextTableIndex++
      )
      const layout = tableLayouts[tableIndex] || null
      return (
        <MarkdownTableRenderer layout={layout} {...props}>
          {children}
        </MarkdownTableRenderer>
      )
    },
    tr({ children, ...props }: MarkdownElementProps) {
      return <MarkdownTableRowRenderer {...props}>{children}</MarkdownTableRowRenderer>
    },
    th: (props: MarkdownTableCellProps) => renderTableCell("th", props),
    td: (props: MarkdownTableCellProps) => renderTableCell("td", props),
    img({ src, alt, node }: MarkdownElementProps) {
      const imageSrc = normalizeSafeMarkdownImageSrc(typeof src === "string" ? src : "")
      if (!imageSrc) {
        const blockedLabel = alt || "차단된 이미지"
        return (
          <span className="aq-image-blocked" role="img" aria-label={blockedLabel}>
            {blockedLabel}
          </span>
        )
      }
      const state = getPassState()
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
    },
    a({ children, href, title, node: _node, ...props }: MarkdownElementProps) {
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
    code({ node, className, children, ...props }: MarkdownElementProps) {
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
    pre({ node, children, className: _className, ...props }: MarkdownElementProps) {
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
      return <>{normalizeMarkdownInlineChildren(children)}</>
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
    const root = rootRef.current
    if (!root || editableImages) return
    for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
      if (!image.closest("a, button") && !image.hasAttribute("tabindex")) {
        image.tabIndex = 0
      }
    }
  }, [editableImages, renderKey])

  const handleRootClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (editableImages) return
      if (!(event.target instanceof Element)) return
      handleImageLightboxClick(event.target)
    },
    [editableImages]
  )

  const handleRootKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (editableImages) return
      if (event.key !== "Enter" && event.key !== " ") return
      if (!(event.target instanceof HTMLImageElement)) return
      if (!event.target.closest(".aq-markdown") || event.target.closest("a, button")) return
      if (handleImageLightboxClick(event.target)) {
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
      data-editable={editableImages ? "true" : undefined}
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
