import { RefObject, useEffect } from "react"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { findDoubleBraceColorSpans } from "src/libs/markdown/inlineTokenScanners"

const nodeContainsInlineColorToken = (node: Node | null): boolean => {
  if (!node) return false
  const text = (node as { nodeValue?: string | null }).nodeValue ?? node.textContent ?? ""
  return text.includes("{{color:")
}

export const shouldScheduleFromInlineColorMutations = (
  mutations: readonly MutationRecord[]
): boolean => {
  for (const mutation of mutations) {
    if (mutation.type === "characterData") {
      if (nodeContainsInlineColorToken(mutation.target)) return true
      continue
    }
    const addedNodes = mutation.addedNodes
    if (!addedNodes) continue
    let index = 0
    while (index < addedNodes.length) {
      if (nodeContainsInlineColorToken(addedNodes[index])) return true
      index += 1
    }
  }
  return false
}

export const applyInlineColors = (root: HTMLElement) => {
  if (!(root.textContent || "").includes("{{color:")) {
    return
  }
  const showTextFilter = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4
  const walker = document.createTreeWalker(root, showTextFilter)
  const textNodes: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const value = node.nodeValue ?? node.textContent
    if (!value?.includes("{{color:")) continue
    const parent = node.parentElement
    if (!parent) continue
    if (parent.closest("pre, code, textarea, script, style, .aq-inline-color")) continue
    textNodes.push(node)
  }

  textNodes.forEach((textNode) => {
    const original = textNode.nodeValue || ""
    const spans = findDoubleBraceColorSpans(original, {
      trimTrailingContentWhitespace: true,
      allowEmptyContent: false,
      singleLine: true,
    })
    if (spans.length === 0) return

    let matched = false
    let cursor = 0
    const fragment = document.createDocumentFragment()

    for (const match of spans) {
      const content = match.content.trim()
      const cssColor = resolveInlineColorValue(match.colorToken)

      if (match.from > cursor) {
        fragment.appendChild(document.createTextNode(original.slice(cursor, match.from)))
      }

      if (!cssColor || !content) {
        fragment.appendChild(document.createTextNode(original.slice(match.from, match.to)))
      } else {
        const span = document.createElement("span")
        span.className = "aq-inline-color"
        span.style.setProperty("--aq-inline-color", cssColor)
        span.textContent = content
        fragment.appendChild(span)
        matched = true
      }

      cursor = match.to
    }

    if (!matched) return

    if (cursor < original.length) {
      fragment.appendChild(document.createTextNode(original.slice(cursor)))
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  })
}

const useInlineColorEffect = (rootRef: RefObject<HTMLElement | null>, contentKey: string) => {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let rafId: number | null = null
    let destroyed = false

    const scheduleApply = () => {
      if (destroyed) return
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        applyInlineColors(root)
      })
    }

    applyInlineColors(root)

    const observer = new MutationObserver((mutations) => {
      if (!shouldScheduleFromInlineColorMutations(mutations)) return
      scheduleApply()
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      destroyed = true
      observer.disconnect()
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [contentKey, rootRef])
}

export default useInlineColorEffect
