import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
} from "react"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { slugifyMarkdownHeading } from "src/libs/markdown/markdownDocumentInsights"

const QUOTED_STRONG_MARKERS = ["**", "__"] as const
const QUOTED_EMPHASIS_MARKERS = ["*", "_"] as const
const INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX = "__AQ_INLINE_COLOR_CHILD_"
const INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX = "__"
const INLINE_COLOR_CHILD_PLACEHOLDER_REGEX = /__AQ_INLINE_COLOR_CHILD_(\d+)__/g
const INLINE_COLOR_RENDER_REGEX = /\{\{\s*color\s*:\s*([^|{}\\]+?)\s*\\?\|([\s\S]+?)\s*\}\}/gi
const INLINE_HIGHLIGHT_REGEX = /==([^\r\n=]+?)==/g
const INLINE_WIKILINK_REGEX = /\[\[([^\][\r\n|\\]+?)(?:\\?\|([^\][\r\n]+?))?\]\]/g
const INLINE_HTML_BR_REGEX = /<\s*br\s*\/?\s*>/gi
const isLetterOrNumber = (value: string) => /[\p{L}\p{N}]/u.test(value)
const isPunctuationOrSymbol = (value: string) => /[\p{P}\p{S}]/u.test(value)

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
  if (!inner || inner.includes("\n") || /^\s|\s$/.test(inner)) return false
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

const hasStringChildMatching = (
  children: ReactNode,
  predicate: (text: string) => boolean
): boolean => {
  if (typeof children === "string") return predicate(children)
  if (!children || typeof children === "number" || typeof children === "boolean") return false
  if (Array.isArray(children)) {
    for (const child of children) {
      if (hasStringChildMatching(child, predicate)) return true
    }
    return false
  }
  if (typeof children === "object" && "type" in children) {
    return false
  }
  return true
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
const hasInlineBrSyntax = (text: string): boolean => /<\s*br\s*\/?\s*>/i.test(text)
const hasSoftBreakSyntax = (text: string): boolean => text.includes("\n")

export const resolveMarkdownWikilinkTarget = (
  rawTarget: string,
  rawAlias?: string
): { href: string; label: string } | null => {
  const target = rawTarget.trim()
  if (!target) return null
  const alias = (rawAlias ?? "").trim()
  const label = (alias || target.replace(/^#/, "")).trim()
  if (!label) return null

  if (target.startsWith("#")) {
    return {
      href: `#${slugifyMarkdownHeading(target.slice(1))}`,
      label,
    }
  }
  if (target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\")) {
    return {
      href: target,
      label,
    }
  }
  return {
    href: `/?q=${encodeURIComponent(target)}`,
    label,
  }
}

const restoreQuotedStrongText = (value: string): ReactNode[] => {
  if (!hasStrongSyntax(value)) {
    return [value]
  }

  const nodes: ReactNode[] = []
  let textCursor = 0
  let index = 0
  let strongIndex = 0

  while (index < value.length) {
    const match = matchQuotedStrongAt(value, index)
    if (!match) {
      index += 1
      continue
    }

    if (textCursor < index) {
      nodes.push(value.slice(textCursor, index))
    }

    nodes.push(<strong key={`quoted-strong-${strongIndex}`}>{match.quotedText}</strong>)
    strongIndex += 1
    index = match.end
    textCursor = match.end
  }

  if (strongIndex === 0) return [value]
  if (textCursor < value.length) {
    nodes.push(value.slice(textCursor))
  }

  return nodes
}

const normalizeQuotedStrongChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasStrongSyntax)) return children
  return mergeAdjacentStringChildren(children).flatMap((child) => {
    if (typeof child !== "string") return [child]
    return restoreQuotedStrongText(child)
  })
}

const restoreQuotedEmphasisText = (value: string): ReactNode[] => {
  if (!hasEmphasisSyntax(value)) {
    return [value]
  }

  const nodes: ReactNode[] = []
  let textCursor = 0
  let index = 0
  let emphasisIndex = 0

  while (index < value.length) {
    const match = matchQuotedEmphasisAt(value, index)
    if (!match) {
      index += 1
      continue
    }

    if (textCursor < index) {
      nodes.push(value.slice(textCursor, index))
    }

    nodes.push(<em key={`quoted-emphasis-${emphasisIndex}`}>{match.quotedText}</em>)
    emphasisIndex += 1
    index = match.end
    textCursor = match.end
  }

  if (emphasisIndex === 0) return [value]
  if (textCursor < value.length) {
    nodes.push(value.slice(textCursor))
  }

  return nodes
}

const normalizeQuotedEmphasisChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasEmphasisSyntax)) return children
  return mergeAdjacentStringChildren(children).flatMap((child) => {
    if (typeof child !== "string") return [child]
    return restoreQuotedEmphasisText(child)
  })
}

const restoreSerializedMarkdownChildren = (serialized: string, sourceChildren: ReactNode[]) => {
  if (!serialized) return []

  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of serialized.matchAll(INLINE_COLOR_CHILD_PLACEHOLDER_REGEX)) {
    const start = match.index ?? 0
    if (start > cursor) nodes.push(serialized.slice(cursor, start))

    const nodeIndex = Number.parseInt(match[1] || "", 10)
    const node = sourceChildren[nodeIndex]
    if (node !== undefined) nodes.push(node)
    cursor = start + match[0].length
  }

  if (cursor < serialized.length) {
    nodes.push(serialized.slice(cursor))
  }

  return nodes
}

const normalizeWikilinkChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasWikilinkSyntax)) return children
  const sourceChildren = mergeAdjacentStringChildren(children)
  let linkIndex = 0
  let matchedAny = false

  const nextNodes = sourceChildren.flatMap((child) => {
    if (typeof child !== "string" || !child.includes("[[")) return [child]
    const nodes: ReactNode[] = []
    let cursor = 0
    for (const match of child.matchAll(INLINE_WIKILINK_REGEX)) {
      const start = match.index ?? 0
      const resolved = resolveMarkdownWikilinkTarget(match[1] || "", match[2])
      if (!resolved) continue
      if (start > cursor) {
        nodes.push(child.slice(cursor, start))
      }
      nodes.push(
        <a key={`inline-wikilink-${linkIndex}`} className="aq-wikilink" href={resolved.href}>
          {resolved.label}
        </a>
      )
      linkIndex += 1
      matchedAny = true
      cursor = start + match[0].length
    }
    if (cursor === 0) return [child]
    if (cursor < child.length) {
      nodes.push(child.slice(cursor))
    }
    return nodes
  })

  return matchedAny ? nextNodes : children
}

const normalizeInlineBrChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasInlineBrSyntax)) return children
  const sourceChildren = mergeAdjacentStringChildren(children)
  let brIndex = 0
  let matchedAny = false

  const nextNodes = sourceChildren.flatMap((child) => {
    if (typeof child !== "string" || !hasInlineBrSyntax(child)) return [child]
    const nodes: ReactNode[] = []
    let cursor = 0
    for (const match of child.matchAll(INLINE_HTML_BR_REGEX)) {
      const start = match.index ?? 0
      if (start > cursor) {
        nodes.push(child.slice(cursor, start))
      }
      nodes.push(<br key={`inline-br-${brIndex}`} />)
      brIndex += 1
      matchedAny = true
      cursor = start + match[0].length
    }
    if (cursor < child.length) {
      nodes.push(child.slice(cursor))
    }
    return nodes
  })

  return matchedAny ? nextNodes : children
}

const normalizeHighlightChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasHighlightSyntax)) return children
  const sourceChildren = mergeAdjacentStringChildren(children)
  if (sourceChildren.length === 0) return sourceChildren

  const serialized = sourceChildren
    .map((child, index) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : `${INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX}${index}${INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX}`
    )
    .join("")

  if (!serialized.includes("==")) return sourceChildren

  const nodes: ReactNode[] = []
  let cursor = 0
  let highlightIndex = 0
  let matched = false

  for (const match of serialized.matchAll(INLINE_HIGHLIGHT_REGEX)) {
    const full = match[0]
    const contentSerialized = match[1] || ""
    const start = match.index ?? 0
    if (!contentSerialized.trim()) continue

    if (start > cursor) {
      nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor, start), sourceChildren))
    }

    const contentNodes = restoreSerializedMarkdownChildren(contentSerialized, sourceChildren)
    nodes.push(
      <mark key={`inline-highlight-${highlightIndex}`} className="aq-highlight">
        {contentNodes}
      </mark>
    )
    highlightIndex += 1
    matched = true
    cursor = start + full.length
  }

  if (!matched) return children

  if (cursor < serialized.length) {
    nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor), sourceChildren))
  }

  return nodes
}

const normalizeInlineColorChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasInlineColorSyntax)) return children
  const sourceChildren = mergeAdjacentStringChildren(children)
  if (sourceChildren.length === 0) return sourceChildren

  const serialized = sourceChildren
    .map((child, index) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : `${INLINE_COLOR_CHILD_PLACEHOLDER_PREFIX}${index}${INLINE_COLOR_CHILD_PLACEHOLDER_SUFFIX}`
    )
    .join("")

  if (!serialized.includes("{{")) return sourceChildren

  const nodes: ReactNode[] = []
  let cursor = 0
  let colorIndex = 0
  let matched = false

  for (const match of serialized.matchAll(INLINE_COLOR_RENDER_REGEX)) {
    const full = match[0]
    const colorToken = match[1] || ""
    const contentSerialized = match[2] || ""
    const start = match.index ?? 0
    const cssColor = resolveInlineColorValue(colorToken)

    if (start > cursor) {
      nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor, start), sourceChildren))
    }

    if (!cssColor) {
      nodes.push(...restoreSerializedMarkdownChildren(full, sourceChildren))
    } else {
      const contentNodes = restoreSerializedMarkdownChildren(contentSerialized, sourceChildren)
      nodes.push(
        <span
          key={`inline-color-${colorIndex}`}
          className="aq-inline-color"
          style={{ "--aq-inline-color": cssColor } as CSSProperties}
        >
          {contentNodes}
        </span>
      )
      colorIndex += 1
      matched = true
    }

    cursor = start + full.length
  }

  if (!matched) return sourceChildren

  if (cursor < serialized.length) {
    nodes.push(...restoreSerializedMarkdownChildren(serialized.slice(cursor), sourceChildren))
  }

  return nodes
}

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
    nodes.push(<br key={`blockquote-soft-break-${breakIndex}`} />)
    breakIndex += 1
    start = nlIndex + 1
  }
  return breakIndex
}

export const normalizeSoftBreakChildren = (children: ReactNode): ReactNode => {
  if (!hasStringChildMatching(children, hasSoftBreakSyntax)) return children
  const nodes: ReactNode[] = []
  let breakIndex = 0

  for (const child of flattenChildNodes(children)) {
    if (typeof child !== "string" || !child.includes("\n")) {
      nodes.push(child)
      continue
    }
    breakIndex = appendSoftBreakSegments(child, nodes, breakIndex)
  }

  return nodes
}

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

export const MarkdownParagraph = ({ children, inCallout = false }: { children: ReactNode; inCallout?: boolean }) => {
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
  if (Array.isArray(node)) return node.map(extractTextFromMarkdownNode).join("\n")
  if (!node || typeof node !== "object" || !("props" in node)) return ""
  return extractTextFromMarkdownNode((node as { props?: { children?: ReactNode } }).props?.children)
}
