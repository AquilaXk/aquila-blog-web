import { RefObject, useEffect } from "react"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { findDoubleBraceColorSpans } from "src/libs/markdown/inlineTokenScanners"

const hasInlineColorCandidate = (value: string | null | undefined): boolean =>
  Boolean(value?.includes("{{"))

const nodeContainsInlineColorToken = (node: Node | null): boolean => {
  if (!node) return false
  const text = (node as { nodeValue?: string | null }).nodeValue ?? node.textContent ?? ""
  return hasInlineColorCandidate(text)
}

const mutationContainsInlineColorToken = (mutation: MutationRecord): boolean => {
  if (mutation.type === "characterData") {
    return nodeContainsInlineColorToken(mutation.target)
  }
  const addedNodes = mutation.addedNodes
  if (!addedNodes) return false
  for (const addedNode of Array.from(addedNodes)) {
    if (nodeContainsInlineColorToken(addedNode)) return true
  }
  return false
}

export const shouldScheduleFromInlineColorMutations = (
  mutations: readonly MutationRecord[]
): boolean => mutations.some(mutationContainsInlineColorToken)

const collectInlineColorTextNodes = (root: HTMLElement): Text[] => {
  const showTextFilter = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4
  const walker = document.createTreeWalker(root, showTextFilter)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const value = node.nodeValue ?? node.textContent
    if (!hasInlineColorCandidate(value)) continue
    const parent = node.parentElement
    if (
      !parent ||
      parent.closest("pre, code, textarea, script, style, .katex, math, annotation, svg, .aq-inline-color")
    ) {
      continue
    }
    textNodes.push(node)
  }
  return textNodes
}

const appendInlineColorSpanSegment = (
  fragment: DocumentFragment,
  original: string,
  from: number,
  to: number,
  colorToken: string,
  rawContent: string
): boolean => {
  const content = rawContent.trim()
  const cssColor = resolveInlineColorValue(colorToken)
  if (!cssColor || !content) {
    fragment.appendChild(document.createTextNode(original.slice(from, to)))
    return false
  }
  const span = document.createElement("span")
  span.className = "aq-inline-color"
  span.style.setProperty("--aq-inline-color", cssColor)
  span.textContent = content
  fragment.appendChild(span)
  return true
}

const replaceInlineColorTextNode = (textNode: Text): void => {
  const original = textNode.nodeValue || ""
  const spans = findDoubleBraceColorSpans(original, {
    trimTrailingContentWhitespace: true,
    allowEmptyContent: false,
    singleLine: true,
    honorMarkdownEscapes: false,
  })
  if (spans.length === 0) return

  let matched = false
  let cursor = 0
  const fragment = document.createDocumentFragment()

  for (const match of spans) {
    if (match.from > cursor) {
      fragment.appendChild(document.createTextNode(original.slice(cursor, match.from)))
    }
    if (
      appendInlineColorSpanSegment(
        fragment,
        original,
        match.from,
        match.to,
        match.colorToken,
        match.content
      )
    ) {
      matched = true
    }
    cursor = match.to
  }

  if (!matched) return
  if (cursor < original.length) {
    fragment.appendChild(document.createTextNode(original.slice(cursor)))
  }
  textNode.parentNode?.replaceChild(fragment, textNode)
}

export const applyInlineColors = (root: HTMLElement) => {
  if (!hasInlineColorCandidate(root.textContent)) {
    return
  }
  for (const textNode of collectInlineColorTextNodes(root)) {
    replaceInlineColorTextNode(textNode)
  }
}

const observeRootInlineColors = (root: HTMLElement): (() => void) => {
  let rafId: number | null = null
  let destroyed = false

  const scheduleApply = () => {
    if (destroyed || rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      applyInlineColors(root)
    })
  }

  applyInlineColors(root)

  const observer = new MutationObserver((mutations) => {
    if (shouldScheduleFromInlineColorMutations(mutations)) scheduleApply()
  })

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  return () => {
    destroyed = true
    observer.disconnect()
    if (rafId !== null) window.cancelAnimationFrame(rafId)
  }
}

const useInlineColorEffect = (
  rootRef: RefObject<HTMLElement | null>,
  contentKey: string,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return
    return observeRootInlineColors(root)
  }, [contentKey, enabled, rootRef])
}

export default useInlineColorEffect
