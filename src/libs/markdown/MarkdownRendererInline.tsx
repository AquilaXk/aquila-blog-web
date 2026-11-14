// 참조 구현: Quartz v4 (`jackyzha0/quartz`, `quartz/plugins/transformers/ofm.ts`, MIT License, Copyright (c) 2021 Jacky Zhao)
import {
  createContext,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactNode,
  useContext,
} from "react"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { findMarkdownHighlightSpans } from "src/libs/markdown/inlineHighlightModel"
import {
  DEFAULT_PROTECTED_INLINE_SENTINELS,
  hasProtectedInlineSentinel,
  restoreProtectedInlineText,
  type ProtectedInlineSentinels,
} from "src/libs/markdown/inlineMathGuardModel"
import {
  collectSafeInlineStringLeaves,
  matchQuotedEmphasisAt,
  matchQuotedStrongAt,
  mergeAdjacentStringChildren,
  runRecursiveInlinePass,
  type QuotedStrongMatch,
} from "src/libs/markdown/inlineQuotedDelimiterHelpers"
import {
  findDoubleBraceColorSpans,
  findRawBrTagSpans,
  findWikilinkSpans,
  hasRawBrTag,
} from "src/libs/markdown/inlineTokenScanners"
import { slugifyMarkdownHeading } from "src/libs/markdown/markdownDocumentInsights"
import { normalizeSafeRelativeMarkdownPath } from "src/libs/markdown/safeMarkdownUrl"

const INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX = "__AQ_INLINE_COLOR_CHILD_"
const INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX = "__"
const INLINE_COLOR_CHILD_PLACEHOLDER_REGEX = /__AQ_INLINE_COLOR_CHILD_(\d+)__/g
const INLINE_FAST_TRIGGER_REGEX = /[{*_~`<\n\\=[\]\uE000]/
const INLINE_SYNTAX_WIKILINK_BIT = 1 << 0
const INLINE_SYNTAX_BR_BIT = 1 << 1
const INLINE_SYNTAX_COLOR_BIT = 1 << 2
const INLINE_SYNTAX_HIGHLIGHT_BIT = 1 << 3
const INLINE_SYNTAX_SENTINEL_BIT = 1 << 4
const INLINE_SYNTAX_STRONG_BIT = 1 << 5
const INLINE_SYNTAX_EMPHASIS_BIT = 1 << 6

const flattenChildNodes = (children: ReactNode, target: ReactNode[] = []): ReactNode[] => {
  if (children === null || children === undefined || typeof children === "boolean") {
    return target
  }
  if (Array.isArray(children)) {
    for (const child of children) flattenChildNodes(child, target)
    return target
  }
  target.push(children)
  return target
}

const hasStrongSyntax = (text: string): boolean => text.includes("**") || text.includes("__")
const hasEmphasisSyntax = (text: string): boolean => text.includes("*") || text.includes("_")
const hasInlineColorSyntax = (text: string): boolean => text.includes("{{")
const hasHighlightSyntax = (text: string): boolean => text.includes("==")
const hasWikilinkSyntax = (text: string): boolean => text.includes("[[")
const hasInlineBrSyntax = (text: string): boolean => hasRawBrTag(text)
const hasSoftBreakSyntax = (text: string): boolean => text.includes("\n")

// 참조 구현: Quartz v4 OFM 위키링크 구문 (https://github.com/jackyzha0/quartz, MIT License, Copyright (c) 2021 Jacky Zhao)
export const resolveMarkdownWikilinkTarget = (
  rawTarget: string,
  rawAlias?: string,
  sentinels: ProtectedInlineSentinels = DEFAULT_PROTECTED_INLINE_SENTINELS
): { href: string; label: string } | null => {
  const target = restoreProtectedInlineText(rawTarget, sentinels).trim()
  if (!target) return null
  const alias = restoreProtectedInlineText(rawAlias ?? "", sentinels).trim()
  const fallbackLabel = target.startsWith("#") ? target.slice(1) : target
  const label = (alias || fallbackLabel).trim()
  if (!label) return null

  if (target.startsWith("#")) {
    return { href: `#${slugifyMarkdownHeading(target.slice(1))}`, label }
  }
  const safePath = target.startsWith("/") ? normalizeSafeRelativeMarkdownPath(target) : ""
  if (safePath) return { href: safePath, label }
  return { href: `/?q=${encodeURIComponent(target)}`, label }
}

const restoreDelimitedText = (
  value: string,
  hasSyntax: (text: string) => boolean,
  matchAt: (text: string, index: number) => QuotedStrongMatch | null,
  renderWrap: (quotedText: string, keyIndex: number) => ReactNode
): ReactNode[] => {
  if (!hasSyntax(value)) return [value]
  const nodes: ReactNode[] = []
  let textCursor = 0
  let index = 0
  let matchCount = 0

  while (index < value.length) {
    const match = matchAt(value, index)
    if (!match) {
      index += 1
      continue
    }
    if (textCursor < index) nodes.push(value.slice(textCursor, index))
    nodes.push(renderWrap(match.quotedText, matchCount))
    matchCount += 1
    index = match.end
    textCursor = match.end
  }

  if (matchCount === 0) return [value]
  if (textCursor < value.length) nodes.push(value.slice(textCursor))
  return nodes
}

const normalizeQuotedStrongFlat = (children: ReactNode): ReactNode =>
  mergeAdjacentStringChildren(children).flatMap((child) => {
    if (typeof child !== "string") return [child]
    return restoreDelimitedText(child, hasStrongSyntax, matchQuotedStrongAt, (text, idx) =>
      createElement("strong", { key: `quoted-strong-${idx}` }, text)
    )
  })

const normalizeQuotedEmphasisFlat = (children: ReactNode): ReactNode =>
  mergeAdjacentStringChildren(children).flatMap((child) => {
    if (typeof child !== "string") return [child]
    return restoreDelimitedText(child, hasEmphasisSyntax, matchQuotedEmphasisAt, (text, idx) =>
      createElement("em", { key: `quoted-emphasis-${idx}` }, text)
    )
  })

const normalizeQuotedStrongChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasStrongSyntax, normalizeQuotedStrongFlat)

const normalizeQuotedEmphasisChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasEmphasisSyntax, normalizeQuotedEmphasisFlat)

const serializeMixedInlineChildren = (sourceChildren: ReactNode[]): string =>
  sourceChildren
    .map((child, index) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : `${INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX}${index}${INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX}`
    )
    .join("")

const restoreSerializedMarkdownChildren = (serialized: string, sourceChildren: ReactNode[]) => {
  if (!serialized) return []
  const nodes: ReactNode[] = []
  let cursor = 0
  INLINE_COLOR_CHILD_PLACEHOLDER_REGEX.lastIndex = 0
  let match = INLINE_COLOR_CHILD_PLACEHOLDER_REGEX.exec(serialized)

  while (match !== null) {
    const start = match.index
    if (start > cursor) nodes.push(serialized.slice(cursor, start))
    const nodeIndex = Number.parseInt(match[1] ?? "", 10)
    const node = sourceChildren[nodeIndex]
    if (node !== undefined) nodes.push(node)
    cursor = start + match[0].length
    match = INLINE_COLOR_CHILD_PLACEHOLDER_REGEX.exec(serialized)
  }

  if (cursor < serialized.length) nodes.push(serialized.slice(cursor))
  return nodes
}

const normalizeWikilinkFlat = (children: ReactNode, sentinels: ProtectedInlineSentinels): ReactNode => {
  const sourceChildren = mergeAdjacentStringChildren(children)
  let linkIndex = 0
  let matchedAny = false

  const nextNodes = sourceChildren.flatMap((child) => {
    if (typeof child !== "string" || !child.includes("[[")) return [child]
    const spans = findWikilinkSpans(child)
    if (spans.length === 0) return [child]
    const nodes: ReactNode[] = []
    let cursor = 0
    for (const span of spans) {
      const resolved = resolveMarkdownWikilinkTarget(span.rawTarget, span.rawAlias, sentinels)
      if (!resolved) continue
      if (span.from > cursor) nodes.push(child.slice(cursor, span.from))
      nodes.push(
        createElement("a", { key: `inline-wikilink-${linkIndex}`, className: "aq-wikilink", href: resolved.href }, resolved.label)
      )
      linkIndex += 1
      matchedAny = true
      cursor = span.to
    }
    if (cursor === 0) return [child]
    if (cursor < child.length) nodes.push(child.slice(cursor))
    return nodes
  })

  return matchedAny ? nextNodes : children
}

const normalizeWikilinkChildren = (children: ReactNode, sentinels: ProtectedInlineSentinels): ReactNode =>
  runRecursiveInlinePass(children, hasWikilinkSyntax, (flat) => normalizeWikilinkFlat(flat, sentinels))

const normalizeInlineBrFlat = (children: ReactNode): ReactNode => {
  const sourceChildren = mergeAdjacentStringChildren(children)
  let brIndex = 0
  let matchedAny = false

  const nextNodes = sourceChildren.flatMap((child) => {
    if (typeof child !== "string") return [child]
    const spans = findRawBrTagSpans(child)
    if (spans.length === 0) return [child]
    const nodes: ReactNode[] = []
    let cursor = 0
    for (const span of spans) {
      if (span.from > cursor) nodes.push(child.slice(cursor, span.from))
      nodes.push(createElement("br", { key: `inline-br-${brIndex}` }))
      brIndex += 1
      matchedAny = true
      cursor = span.to
    }
    if (cursor < child.length) nodes.push(child.slice(cursor))
    return nodes
  })

  return matchedAny ? nextNodes : children
}

const normalizeInlineBrChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasInlineBrSyntax, normalizeInlineBrFlat)

const normalizeHighlightFlat = (children: ReactNode): ReactNode => {
  const sourceChildren = mergeAdjacentStringChildren(children)
  if (sourceChildren.length === 0) return children
  const serialized = serializeMixedInlineChildren(sourceChildren)
  if (!serialized.includes("==")) return children

  const spans = findMarkdownHighlightSpans(serialized, { honorMarkdownEscapes: false })
  if (spans.length === 0) return children

  const nodes: ReactNode[] = []
  let cursor = 0
  let highlightIndex = 0
  let matched = false

  for (const span of spans) {
    const contentSerialized = serialized.slice(span.contentFrom, span.contentTo)
    if (!contentSerialized.trim()) continue
    if (span.from > cursor) {
      nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor, span.from), sourceChildren))
    }
    nodes.push(
      createElement(
        "mark",
        { key: `inline-highlight-${highlightIndex}`, className: "aq-highlight" },
        ...restoreSerializedMarkdownChildren(contentSerialized, sourceChildren)
      )
    )
    highlightIndex += 1
    matched = true
    cursor = span.to
  }

  if (!matched) return children
  if (cursor < serialized.length) {
    nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor), sourceChildren))
  }
  return nodes
}

const normalizeHighlightChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasHighlightSyntax, normalizeHighlightFlat)

const restoreProtectedInlineFlat = (
  children: ReactNode,
  sentinels: ProtectedInlineSentinels
): ReactNode => {
  if (typeof children === "string") return restoreProtectedInlineText(children, sentinels)
  if (!Array.isArray(children)) return children
  return children.map((child) =>
    typeof child === "string" && hasProtectedInlineSentinel(child, sentinels)
      ? restoreProtectedInlineText(child, sentinels)
      : child
  )
}

const restoreProtectedInlineChildren = (children: ReactNode, sentinels: ProtectedInlineSentinels): ReactNode =>
  runRecursiveInlinePass(children, (t) => hasProtectedInlineSentinel(t, sentinels), (c) => restoreProtectedInlineFlat(c, sentinels))

const normalizeInlineColorFlat = (children: ReactNode): ReactNode => {
  const sourceChildren = mergeAdjacentStringChildren(children)
  if (sourceChildren.length === 0) return children
  const serialized = serializeMixedInlineChildren(sourceChildren)
  if (!serialized.includes("{{")) return children

  const spans = findDoubleBraceColorSpans(serialized, {
    trimTrailingContentWhitespace: true,
    allowEmptyContent: false,
    singleLine: true,
    honorMarkdownEscapes: false,
  })
  if (spans.length === 0) return children

  const nodes: ReactNode[] = []
  let cursor = 0
  let colorIndex = 0
  let matched = false

  for (const span of spans) {
    const cssColor = resolveInlineColorValue(span.colorToken)
    if (span.from > cursor) {
      nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor, span.from), sourceChildren))
    }
    if (!cssColor) {
      nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(span.from, span.to), sourceChildren))
    } else {
      nodes.push(
        createElement(
          "span",
          {
            key: `inline-color-${colorIndex}`,
            className: "aq-inline-color",
            style: { "--aq-inline-color": cssColor } as CSSProperties,
          },
          ...restoreSerializedMarkdownChildren(span.content, sourceChildren)
        )
      )
      colorIndex += 1
      matched = true
    }
    cursor = span.to
  }

  if (!matched) return children
  if (cursor < serialized.length) {
    nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor), sourceChildren))
  }
  return nodes
}

const normalizeInlineColorChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasInlineColorSyntax, normalizeInlineColorFlat)

const appendSoftBreakSegments = (
  text: string,
  nodes: ReactNode[],
  startBreakIndex: number
): number => {
  let breakIndex = startBreakIndex
  let start = 0
  while (start <= text.length) {
    const nlIndex = text.indexOf("\n", start)
    if (nlIndex < 0) {
      if (start < text.length) nodes.push(text.slice(start))
      break
    }
    if (nlIndex > start) nodes.push(text.slice(start, nlIndex))
    nodes.push(createElement("br", { key: `blockquote-soft-break-${breakIndex}` }))
    breakIndex += 1
    start = nlIndex + 1
  }
  return breakIndex
}

const normalizeSoftBreakFlat = (children: ReactNode): ReactNode => {
  const flat = flattenChildNodes(children)
  if (!flat.some((child) => typeof child === "string" && child.includes("\n"))) {
    return children
  }
  const nodes: ReactNode[] = []
  let breakIndex = 0
  for (const child of flat) {
    if (typeof child !== "string" || !child.includes("\n")) {
      nodes.push(child)
      continue
    }
    breakIndex = appendSoftBreakSegments(child, nodes, breakIndex)
  }
  return nodes
}

export const normalizeSoftBreakChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasSoftBreakSyntax, normalizeSoftBreakFlat)

const MarkdownBlockquoteContext = createContext(false)

const scanStringSyntaxMask = (text: string, sentinelPrefix: string): number => {
  let mask = 0
  if (hasWikilinkSyntax(text)) mask |= INLINE_SYNTAX_WIKILINK_BIT
  if (hasInlineBrSyntax(text)) mask |= INLINE_SYNTAX_BR_BIT
  if (hasInlineColorSyntax(text)) mask |= INLINE_SYNTAX_COLOR_BIT
  if (hasHighlightSyntax(text)) mask |= INLINE_SYNTAX_HIGHLIGHT_BIT
  if (hasProtectedInlineSentinel(text, { prefix: sentinelPrefix } as ProtectedInlineSentinels)) {
    mask |= INLINE_SYNTAX_SENTINEL_BIT
  }
  if (hasStrongSyntax(text)) mask |= INLINE_SYNTAX_STRONG_BIT
  if (hasEmphasisSyntax(text)) mask |= INLINE_SYNTAX_EMPHASIS_BIT
  return mask
}

const computeInlineSyntaxMask = (children: ReactNode, sentinelPrefix: string): number => {
  if (typeof children === "string") return scanStringSyntaxMask(children, sentinelPrefix)
  let mask = 0
  collectSafeInlineStringLeaves(children, (leaf) => {
    mask |= scanStringSyntaxMask(leaf, sentinelPrefix)
  })
  return mask
}

export const normalizeMarkdownInlineChildren = (
  children: ReactNode,
  sentinels: ProtectedInlineSentinels = DEFAULT_PROTECTED_INLINE_SENTINELS
) => {
  if (typeof children === "string" && !INLINE_FAST_TRIGGER_REGEX.test(children)) {
    return children
  }
  const syntaxMask = computeInlineSyntaxMask(children, sentinels.prefix)
  if (syntaxMask === 0) return children
  let current = children
  if (syntaxMask & INLINE_SYNTAX_WIKILINK_BIT) current = normalizeWikilinkChildren(current, sentinels)
  if (syntaxMask & INLINE_SYNTAX_BR_BIT) current = normalizeInlineBrChildren(current)
  if (syntaxMask & INLINE_SYNTAX_COLOR_BIT) current = normalizeInlineColorChildren(current)
  if (syntaxMask & INLINE_SYNTAX_HIGHLIGHT_BIT) current = normalizeHighlightChildren(current)
  if (syntaxMask & INLINE_SYNTAX_SENTINEL_BIT) current = restoreProtectedInlineChildren(current, sentinels)
  if (syntaxMask & INLINE_SYNTAX_STRONG_BIT) current = normalizeQuotedStrongChildren(current)
  if (syntaxMask & INLINE_SYNTAX_EMPHASIS_BIT) current = normalizeQuotedEmphasisChildren(current)
  return current
}

export const MarkdownParagraph = ({
  children,
  inCallout = false,
  sentinels = DEFAULT_PROTECTED_INLINE_SENTINELS,
}: {
  children: ReactNode
  inCallout?: boolean
  sentinels?: ProtectedInlineSentinels
}) => {
  const inBlockquote = useContext(MarkdownBlockquoteContext)
  let normalizedChildren = normalizeMarkdownInlineChildren(children, sentinels)
  if (inBlockquote) {
    normalizedChildren = normalizeSoftBreakChildren(normalizedChildren)
  }

  if (!inCallout) return <p>{normalizedChildren}</p>
  return <p className="aq-markdown-text">{normalizedChildren}</p>
}

export const MarkdownBlockquote = ({ children }: { children: ReactNode }) => (
  <MarkdownBlockquoteContext.Provider value={true}>
    <blockquote>{children}</blockquote>
  </MarkdownBlockquoteContext.Provider>
)

export const extractTextFromMarkdownNode = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromMarkdownNode).join("")
  if (isValidElement(node) && node.type === "br") return " "
  if (!node || typeof node !== "object" || !("props" in node)) return ""
  return extractTextFromMarkdownNode((node as { props?: { children?: ReactNode } }).props?.children)
}
