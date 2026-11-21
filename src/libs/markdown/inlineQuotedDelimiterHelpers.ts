import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"

const QUOTED_STRONG_MARKERS = ["**", "__"] as const
const QUOTED_EMPHASIS_MARKERS = ["*", "_"] as const
const LETTER_OR_NUMBER_PATTERN = /[\p{L}\p{N}]/u
const PUNCTUATION_OR_SYMBOL_PATTERN = /[\p{P}\p{S}]/u
const SINGLE_WHITESPACE_CHAR_PATTERN = /^\s$/u
const SAFE_INLINE_WRAPPER_TAGS = new Set(["mark", "strong", "em", "del"])

export type QuotedStrongMatch = {
  end: number
  quotedText: string
}

const isLetterOrNumber = (value: string) => LETTER_OR_NUMBER_PATTERN.test(value)
const isPunctuationOrSymbol = (value: string) => PUNCTUATION_OR_SYMBOL_PATTERN.test(value)
const hasOuterWhitespace = (value: string) =>
  SINGLE_WHITESPACE_CHAR_PATTERN.test(value.at(0) ?? "") ||
  SINGLE_WHITESPACE_CHAR_PATTERN.test(value.at(-1) ?? "")

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

export const matchQuotedStrongAt = (value: string, start: number): QuotedStrongMatch | null =>
  matchBoundaryDelimitedSpanAt(value, start, QUOTED_STRONG_MARKERS, false)

export const matchQuotedEmphasisAt = (value: string, start: number): QuotedStrongMatch | null =>
  matchBoundaryDelimitedSpanAt(value, start, QUOTED_EMPHASIS_MARKERS, true)

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

export const runRecursiveInlinePass = (
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

export const collectSafeInlineStringLeaves = (
  children: ReactNode,
  visitor: (text: string) => void
): void => {
  if (typeof children === "string") {
    visitor(children)
    return
  }
  if (!children || typeof children === "number" || typeof children === "boolean") return
  if (Array.isArray(children)) {
    for (const child of children) collectSafeInlineStringLeaves(child, visitor)
    return
  }
  if (isSafeInlineWrapperElement(children)) {
    collectSafeInlineStringLeaves(children.props.children, visitor)
  }
}

export const flattenChildNodes = (children: ReactNode, target: ReactNode[] = []): ReactNode[] => {
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

export const mergeAdjacentStringChildren = (children: ReactNode): ReactNode[] => {
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
