import {
  type ComponentProps,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
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
import { resolveMarkdownRenderModel } from "src/libs/markdown/rendering"
import useMermaidEffect from "src/libs/markdown/hooks/useMermaidEffect"
import useResponsiveTableEffect from "src/libs/markdown/hooks/useResponsiveTableEffect"
import useInlineColorEffect from "src/libs/markdown/hooks/useInlineColorEffect"
import usePrismEffect from "src/libs/markdown/hooks/usePrismEffect"
import { useLanguage } from "src/libs/language"
import MarkdownRendererRoot from "src/libs/markdown/components/MarkdownRendererRoot"
import {
  MarkdownRenderPassState,
  createMarkdownComponentVariants,
  createMarkdownRenderPassState,
  handleImageLightboxClick,
  resolvePreBlockMermaidSource,
  shouldOpenLightboxFromKeyDown,
  syncFocusableMarkdownImages,
} from "src/libs/markdown/MarkdownRendererComponents"
import { useTrustedHtmlCodeBlocksEffect } from "src/libs/markdown/useTrustedHtmlCodeBlocksEffect"
import { renderMarkdownSegment } from "src/libs/markdown/MarkdownRendererSegments"
import { MarkdownFootnoteAppendix } from "src/libs/markdown/MarkdownRendererFootnotes"
import {
  createProtectedInlineSentinels,
  escapeNonPandocSingleDollars,
  hasValidMarkdownMath,
  protectEscapedInlineSyntax,
  remarkRestoreProtectedInlineTokens,
} from "src/libs/markdown/inlineMathGuardModel"
import type { MarkdownRendererProps } from "src/libs/markdown/MarkdownRenderer.types"

export { markdownGuide } from "src/libs/markdown/rendering"
export { createMarkdownComponentVariants, resolvePreBlockMermaidSource }
export {
  escapeNonPandocSingleDollars,
  hasValidMarkdownMath,
  hasValidMarkdownMath as hasLikelyMarkdownMath,
} from "src/libs/markdown/inlineMathGuardModel"

type RemarkPluginList = NonNullable<ComponentProps<typeof ReactMarkdown>["remarkPlugins"]>
const REMARK_PLUGINS_DEFAULT: RemarkPluginList = [remarkGfm]
const REMARK_PLUGINS_MATH: RemarkPluginList = [remarkGfm, remarkMath]
const REHYPE_PLUGINS_DEFAULT: never[] = []
const REHYPE_PLUGINS_MATH = [rehypeKatex]

const MarkdownRendererComponent: FC<MarkdownRendererProps> = ({
  content,
  trustedContentHtml,
  disableMermaid = false,
  forceScheme,
  editableImages = false,
  onImageWidthCommit,
}) => {
  const { t } = useLanguage()
  const rootRef = useRef<HTMLDivElement>(null)
  const renderPassStateRef = useRef<MarkdownRenderPassState>(createMarkdownRenderPassState())
  const renderModel = useMemo(
    () => resolveMarkdownRenderModel({ content, trustedContentHtml }),
    [content, trustedContentHtml]
  )
  const { normalizedContent, renderKey, resolvedContentHtml, segments, footnotes, footnoteMarker, tableLayouts } = renderModel
  const sentinels = useMemo(
    () => createProtectedInlineSentinels(`${content ?? ""}\n${normalizedContent}`),
    [content, normalizedContent]
  )
  const standaloneImageIndices = useMemo(
    () =>
      segments.reduce<{ next: number; indices: number[] }>(
        (acc, segment) => {
          acc.indices.push(segment.type === "image" ? acc.next++ : -1)
          return acc
        },
        { next: 0, indices: [] }
      ).indices,
    [segments]
  )

  useMermaidEffect(rootRef, renderKey, !disableMermaid, {
    observeMutations: false,
    forceScheme,
  })
  useResponsiveTableEffect(rootRef, renderKey)
  useInlineColorEffect(rootRef, renderKey, Boolean(resolvedContentHtml))
  usePrismEffect(rootRef, renderKey, true, {
    mutationDebounceMs: 96,
  })
  useTrustedHtmlCodeBlocksEffect(rootRef, Boolean(resolvedContentHtml), renderKey, t)

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
        sentinels,
        t,
      }),
    [footnoteMarker, footnotes, sentinels, t, tableLayouts]
  )

  renderPassStateRef.current = createMarkdownRenderPassState()

  const renderMarkdown = (markdown: string, key: string, inCallout = false, inlineOnly = false) => {
    const hasMath = hasValidMarkdownMath(markdown)
    const protectedState = protectEscapedInlineSyntax(
      hasMath ? escapeNonPandocSingleDollars(markdown) : markdown,
      sentinels
    )
    const baseRemarkPlugins = hasMath ? REMARK_PLUGINS_MATH : REMARK_PLUGINS_DEFAULT
    const remarkPlugins: RemarkPluginList =
      protectedState.tokens.length > 0
        ? [...baseRemarkPlugins, [remarkRestoreProtectedInlineTokens, protectedState]]
        : baseRemarkPlugins
    return (
      <ReactMarkdown
        key={key}
        remarkPlugins={remarkPlugins}
        rehypePlugins={hasMath ? REHYPE_PLUGINS_MATH : REHYPE_PLUGINS_DEFAULT}
        components={componentVariants.getComponents(inCallout, inlineOnly)}
      >
        {protectedState.markdown}
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
    return <MarkdownRendererRoot data-force-scheme={forceScheme}>{t("markdownEmptyBody")}</MarkdownRendererRoot>
  }

  return (
    <MarkdownRendererRoot
      ref={rootRef}
      className="aq-markdown"
      data-editable={editableDataValue}
      data-force-scheme={forceScheme}
      onClick={handleRootClick}
      onKeyDown={handleRootKeyDown}
    >
      {segments.map((segment, index) =>
        renderMarkdownSegment({
          segment,
          index,
          imageIndex: standaloneImageIndices[index] ?? -1,
          editableImages,
          onImageWidthCommit,
          renderMarkdown,
          t,
        })
      )}
      <MarkdownFootnoteAppendix footnotes={footnotes} renderMarkdown={renderMarkdown} />
    </MarkdownRendererRoot>
  )
}

MarkdownRendererComponent.displayName = "MarkdownRenderer"

const MarkdownRenderer = memo(MarkdownRendererComponent)

MarkdownRenderer.displayName = "MarkdownRendererMemo"

export default MarkdownRenderer
