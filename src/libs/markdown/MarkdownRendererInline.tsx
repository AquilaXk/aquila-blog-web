import {
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { findMarkdownHighlightSpans } from "src/libs/markdown/inlineHighlightModel"
import {
  findDoubleBraceColorSpans,
  findRawBrTagSpans,
  findWikilinkSpans,
  hasRawBrTag,
} from "src/libs/markdown/inlineTokenScanners"
import { slugifyMarkdownHeading } from "src/libs/markdown/markdownDocumentInsights"
import { normalizeSafeRelativeMarkdownPath } from "src/libs/markdown/safeMarkdownUrl"

const QUOTED_STRONG_MARKERS = ["**", "__"] as const
const QUOTED_EMPHASIS_MARKERS = ["*", "_"] as const
const INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX = "__AQ_INLINE_COLOR_CHILD_"
const INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX = "__"
const INLINE_COLOR_CHILD_PLACEHOLDER_REGEX = /__AQ_INLINE_COLOR_CHILD_(\d+)__/g
const LETTER_OR_NUMBER_PATTERN = /[\p{L}\p{N}]/u
const PUNCTUATION_OR_SYMBOL_PATTERN = /[\p{P}\p{S}]/u
const SINGLE_WHITESPACE_CHAR_PATTERN = /^\s$/u

const isLetterOrNumber = (value: string) => LETTER_OR_NUMBER_PATTERN.test(value)
const isPunctuationOrSymbol = (value: string) => PUNCTUATION_OR_SYMBOL_PATTERN.test(value)
const hasOuterWhitespace = (value: string) =>
  SINGLE_WHITESPACE_CHAR_PATTERN.test(value.at(0) ?? "") ||
  SINGLE_WHITESPACE_CHAR_PATTERN.test(value.at(-1) ?? "")

type QuotedStrongMatch = {
  end: number
  quotedText: string
}

const hasAdjacentSameMarker = (value: string, start: number, marker: string) => {
  const prevChar = start > 0 ? value[start - 1] || "" : ""
  const nextChar = value[start + marker.length] || ""
  return prevChar === marker || nextChar === marker
}

const findClosingMarkerIndex = (
  value: string,
  marker: string,
  contentStart: number,
  disallowAdjacentSameMarker: boolean
) => {
  let searchFrom = contentStart
  while (searchFrom < value.length) {
    const closeIndex = value.indexOf(marker, searchFrom)
    if (closeIndex < 0) return -1
    if (disallowAdjacentSameMarker && value[closeIndex + marker.length] === marker) {
      searchFrom = closeIndex + marker.length + 1
      continue
    }
    return closeIndex
  }
  return -1
}

const hasPunctuationBoundarySpan = (
  value: string,
  start: number,
  suffixIndex: number,
  inner: string
) => {
  if (!inner || inner.includes("\n") || hasOuterWhitespace(inner)) return false
  const prefixChar = start > 0 ? value[start - 1] || "" : ""
  const suffixChar = value[suffixIndex] || ""
  const firstInnerChar = inner.at(0) || ""
  const lastInnerChar = inner.at(-1) || ""
  return (
    (isPunctuationOrSymbol(lastInnerChar) && isLetterOrNumber(suffixChar)) ||
    (isPunctuationOrSymbol(firstInnerChar) && isLetterOrNumber(prefixChar))
  )
}

const matchBoundaryDelimitedSpanAt = (
  value: string,
  start: number,
  markers: readonly string[],
  disallowAdjacentSameMarker = false
): QuotedStrongMatch | null => {
  for (const marker of markers) {
    if (!value.startsWith(marker, start)) continue
    if (disallowAdjacentSameMarker && hasAdjacentSameMarker(value, start, marker)) continue

    const contentStart = start + marker.length
    const closeIndex = findClosingMarkerIndex(
      value,
      marker,
      contentStart,
      disallowAdjacentSameMarker
    )
    if (closeIndex < 0) continue

    const inner = value.slice(contentStart, closeIndex)
    const suffixIndex = closeIndex + marker.length
    if (hasPunctuationBoundarySpan(value, start, suffixIndex, inner)) {
      return {
        end: suffixIndex,
        quotedText: inner,
      }
    }
  }

  return null
}

const matchQuotedStrongAt = (value: string, start: number): QuotedStrongMatch | null =>
  matchBoundaryDelimitedSpanAt(value, start, QUOTED_STRONG_MARKERS, false)

const matchQuotedEmphasisAt = (value: string, start: number): QuotedStrongMatch | null =>
  matchBoundaryDelimitedSpanAt(value, start, QUOTED_EMPHASIS_MARKERS, true)

const SAFE_INLINE_WRAPPER_TAGS = new Set(["mark", "strong", "em", "del"])

const hasInlineColorClassToken = (className: unknown): boolean => {
  if (typeof className !== "string" || !className.includes("aq-inline-color")) return false
  return className.split(/\s+/).includes("aq-inline-color")
}

const isSafeInlineWrapperElement = (
  node: ReactNode
): node is ReactElement<{ children?: ReactNode; className?: string }> => {
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node)) return false
  if (typeof node.type !== "string") return false
  if (SAFE_INLINE_WRAPPER_TAGS.has(node.type)) return true
  return node.type === "span" && hasInlineColorClassToken(node.props.className)
}

const hasStringChildMatching = (
  children: ReactNode,
  predicate: (text: string) => boolean
): boolean => {
  if (typeof children === "string") return predicate(children)
  if (!children || typeof children === "number" || typeof children === "boolean") return false
  if (Array.isArray(children)) {
    return children.some((child) => hasStringChildMatching(child, predicate))
  }
  if (isSafeInlineWrapperElement(children)) {
    return hasStringChildMatching(children.props.children, predicate)
  }
  if (typeof children === "object" && "type" in children) {
    return false
  }
  return true
}

const mapOverSafeInlineWrappers = (
  children: ReactNode,
  transformInner: (innerChildren: ReactNode) => ReactNode
): ReactNode => {
  if (Array.isArray(children)) {
    let changed = false
    const mapped = children.map((child) => {
      const next = mapOverSafeInlineWrappers(child, transformInner)
      if (next !== child) changed = true
      return next
    })
    return changed ? mapped : children
  }
  if (isSafeInlineWrapperElement(children)) {
    const nextInner = transformInner(children.props.children)
    return nextInner === children.props.children
      ? children
      : cloneElement(children, undefined, nextInner)
  }
  return children
}

const runRecursiveInlinePass = (
  children: ReactNode,
  predicate: (text: string) => boolean,
  transformFlat: (flatChildren: ReactNode) => ReactNode
): ReactNode => {
  if (!hasStringChildMatching(children, predicate)) return children
  const topTransformed = transformFlat(children)
  return mapOverSafeInlineWrappers(topTransformed, (inner) =>
    runRecursiveInlinePass(inner, predicate, transformFlat)
  )
}

const flattenChildNodes = (children: ReactNode, target: ReactNode[] = []): ReactNode[] => {
  if (children === null || children === undefined || typeof children === "boolean") {
    return target
  }
  if (Array.isArray(children)) {
    for (const child of children) {
      flattenChildNodes(child, target)
    }
    return target
  }
  target.push(children)
  return target
}

const mergeAdjacentStringChildren = (children: ReactNode): ReactNode[] => {
  const rawList = flattenChildNodes(children)
  if (rawList.length <= 1) return rawList
  const merged: ReactNode[] = []
  for (const child of rawList) {
    const lastIndex = merged.length - 1
    if (typeof child === "string" && lastIndex >= 0 && typeof merged[lastIndex] === "string") {
      merged[lastIndex] = `${merged[lastIndex] as string}${child}`
    } else {
      merged.push(child)
    }
  }
  return merged
}

const hasStrongSyntax = (text: string): boolean => text.includes("**") || text.includes("__")
const hasEmphasisSyntax = (text: string): boolean => text.includes("*") || text.includes("_")
const hasInlineColorSyntax = (text: string): boolean => text.includes("{{")
const hasHighlightSyntax = (text: string): boolean => text.includes("==")
const hasWikilinkSyntax = (text: string): boolean => text.includes("[[")
const hasInlineBrSyntax = (text: string): boolean => hasRawBrTag(text)
const hasSoftBreakSyntax = (text: string): boolean => text.includes("\n")

export const resolveMarkdownWikilinkTarget = (
  rawTarget: string,
  rawAlias?: string
): { href: string; label: string } | null => {
  const target = rawTarget.trim()
  if (!target) return null
  const alias = (rawAlias ?? "").trim()
  const fallbackLabel = target.startsWith("#") ? target.slice(1) : target
  const label = (alias || fallbackLabel).trim()
  if (!label) return null

  if (target.startsWith("#")) {
    return {
      href: `#${slugifyMarkdownHeading(target.slice(1))}`,
      label,
    }
  }
  const safePath = target.startsWith("/") ? normalizeSafeRelativeMarkdownPath(target) : ""
  if (safePath) {
    return {
      href: safePath,
      label,
    }
  }
  return {
    href: `/?q=${encodeURIComponent(target)}`,
    label,
  }
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
    if (textCursor < index) {
      nodes.push(value.slice(textCursor, index))
    }
    nodes.push(renderWrap(match.quotedText, matchCount))
    matchCount += 1
    index = match.end
    textCursor = match.end
  }

  if (matchCount === 0) return [value]
  if (textCursor < value.length) {
    nodes.push(value.slice(textCursor))
  }
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
  const placeholderRegex = new RegExp(INLINE_COLOR_CHILD_PLACEHOLDER_REGEX.source, "g")
  let match = placeholderRegex.exec(serialized)

  while (match !== null) {
    const start = match.index
    if (start > cursor) nodes.push(serialized.slice(cursor, start))
    const nodeIndex = Number.parseInt(match[1] ?? "", 10)
    const node = sourceChildren[nodeIndex]
    if (node !== undefined) nodes.push(node)
    cursor = start + match[0].length
    match = placeholderRegex.exec(serialized)
  }

  if (cursor < serialized.length) {
    nodes.push(serialized.slice(cursor))
  }

  return nodes
}

const normalizeWikilinkFlat = (children: ReactNode): ReactNode => {
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
      const resolved = resolveMarkdownWikilinkTarget(span.rawTarget, span.rawAlias)
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

const normalizeWikilinkChildren = (children: ReactNode): ReactNode =>
  runRecursiveInlinePass(children, hasWikilinkSyntax, normalizeWikilinkFlat)

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

  const spans = findMarkdownHighlightSpans(serialized)
  if (spans.length === 0) return children

  const nodes: ReactNode[] = []
  let cursor = 0
  let highlightIndex = 0
  let matched = false

  for (const span of spans) {
    const contentSerialized = serialized.slice(span.contentFrom, span.contentTo)
    if (!contentSerialized.trim()) continue
    if (span.from > cursor) {
      nodes.push(
        ...restoreSerializedMarkdownChildren(serialized.slice(cursor, span.from), sourceChildren)
      )
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

const normalizeInlineColorFlat = (children: ReactNode): ReactNode => {
  const sourceChildren = mergeAdjacentStringChildren(children)
  if (sourceChildren.length === 0) return children
  const serialized = serializeMixedInlineChildren(sourceChildren)
  if (!serialized.includes("{{")) return children

  const spans = findDoubleBraceColorSpans(serialized, {
    trimTrailingContentWhitespace: true,
    allowEmptyContent: false,
  })
  if (spans.length === 0) return children

  const nodes: ReactNode[] = []
  let cursor = 0
  let colorIndex = 0
  let matched = false

  for (const span of spans) {
    const cssColor = resolveInlineColorValue(span.colorToken)
    if (span.from > cursor) {
      nodes.push(
        ...restoreSerializedMarkdownChildren(serialized.slice(cursor, span.from), sourceChildren)
      )
    }
    if (!cssColor) {
      nodes.push(
        ...restoreSerializedMarkdownChildren(serialized.slice(span.from, span.to), sourceChildren)
      )
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

export const normalizeMarkdownInlineChildren = (children: ReactNode) => {
  if (typeof children === "string" && !/[{*_~`<\n\\=[\]]/.test(children)) {
    return children
  }
  let normalizedChildren = normalizeWikilinkChildren(children)
  normalizedChildren = normalizeInlineBrChildren(normalizedChildren)
  normalizedChildren = normalizeHighlightChildren(normalizedChildren)
  normalizedChildren = normalizeInlineColorChildren(normalizedChildren)
  normalizedChildren = normalizeQuotedStrongChildren(normalizedChildren)
  normalizedChildren = normalizeQuotedEmphasisChildren(normalizedChildren)
  return normalizedChildren
}

export const MarkdownParagraph = ({
  children,
  inCallout = false,
}: {
  children: ReactNode
  inCallout?: boolean
}) => {
  const inBlockquote = useContext(MarkdownBlockquoteContext)
  let normalizedChildren = normalizeMarkdownInlineChildren(children)
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
