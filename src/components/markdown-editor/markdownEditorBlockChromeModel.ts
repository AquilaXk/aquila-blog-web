import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import { readVisualViewportBounds } from "./markdownEditorLinkUtils"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"

export const EDITOR_COLOR_SWATCH_SPECS = [
  { label: "글자 기본색", token: "default", hex: "#57534e" },
  { label: "글자 파란색", token: "sky", hex: "#0369a1" },
  { label: "글자 초록색", token: "emerald", hex: "#047857" },
  { label: "글자 주황색", token: "amber", hex: "#b45309" },
  { label: "글자 보라색", token: "violet", hex: "#6d28d9" },
  { label: "글자 빨간색", token: "rose", hex: "#be123c" },
] as const

export type CoordsRect = { top: number; bottom: number; left: number; right: number }

const resolveCurrentBlockKind = (trimmed: string) => {
  if (trimmed.startsWith("### ")) return "h3"
  if (trimmed.startsWith("## ")) return "h2"
  if (trimmed.startsWith("# ")) return "h1"
  if (/^[-*+]\s+\[[ xX]\]\s/.test(trimmed)) return "task"
  if (/^[-*+]\s/.test(trimmed)) return "unordered"
  if (/^\d+\.\s/.test(trimmed)) return "ordered"
  if (trimmed.startsWith("> ")) return "quote"
  return "paragraph"
}

export const computeActiveLineState = (value: string, from: number) => {
  const lineStart = from > 0 ? value.lastIndexOf("\n", from - 1) + 1 : 0
  const nextBreak = value.indexOf("\n", from)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lineText = value.slice(lineStart, lineEnd)
  const hasFenceMarkers = value.includes("```") || value.includes("~~~")
  return {
    activeLineStart: lineStart,
    activeLineEnd: lineEnd,
    activeLineText: lineText,
    currentBlockKind: resolveCurrentBlockKind(lineText.trimStart()),
    insideFence: hasFenceMarkers ? isOffsetInsideFencedCodeBlock(value, from) : false,
  }
}

export type BlockChromeMeasuredLayout = {
  bubble: { top: number; left: number } | null
  gutterTop: number | null
  gutterLeft: number
  blockMenu: { top: number; left: number } | null
}

const computeBubbleFromRects = (
  canShowBubble: boolean,
  startCoords: CoordsRect | null,
  endCoords: CoordsRect | null,
  containerRect: DOMRect | null,
  measuredBubbleWidth?: number
): { top: number; left: number } | null => {
  if (!canShowBubble) return null
  const vp = readVisualViewportBounds()
  const viewportWidth = vp.width
  const viewportHeight = vp.height
  const targetWidth = measuredBubbleWidth && measuredBubbleWidth > 0 ? measuredBubbleWidth : 348
  const estimatedWidth = Math.min(targetWidth, viewportWidth - 24)

  if (startCoords && endCoords && startCoords.bottom > 0 && endCoords.bottom > 0) {
    if (
      containerRect &&
      (endCoords.bottom < containerRect.top || startCoords.top > containerRect.bottom)
    ) {
      return null
    }
    const centerX =
      (Math.min(startCoords.left, endCoords.left) +
        Math.max(startCoords.right, endCoords.right)) /
      2
    const left = Math.max(
      vp.offsetLeft + 12,
      Math.min(Math.round(centerX - estimatedWidth / 2), vp.right - estimatedWidth - 12)
    )
    const bottomEdge = Math.max(startCoords.bottom, endCoords.bottom)
    const isMobileViewport = viewportWidth <= 820
    const placeBelow = isMobileViewport
      ? bottomEdge + 60 <= vp.bottom
      : startCoords.top - (containerRect?.top ?? 0) < 52
    const top = placeBelow
      ? Math.min(vp.bottom - 56, Math.round(bottomEdge + 8))
      : Math.max(vp.offsetTop + 12, Math.round(startCoords.top - 48))
    return { top, left }
  }

  if (containerRect && containerRect.height > 0) {
    return {
      top: Math.max(vp.offsetTop + 12, Math.round(containerRect.top + 48)),
      left: Math.max(
        vp.offsetLeft + 12,
        Math.min(Math.round(containerRect.left + 24), vp.right - estimatedWidth - 12)
      ),
    }
  }
  return null
}

const computeGutterTopFromRects = (
  canShowGutterPlus: boolean,
  activeLineStart: number,
  lineCoords: CoordsRect | null,
  containerRect: DOMRect | null
): number | null => {
  if (!canShowGutterPlus || !containerRect || containerRect.height <= 0) return null
  if (lineCoords && lineCoords.bottom > lineCoords.top) {
    const rawTop =
      lineCoords.top - containerRect.top + (lineCoords.bottom - lineCoords.top - 22) / 2
    return rawTop >= 0 && rawTop <= containerRect.height - 22 ? Math.round(rawTop) : null
  }
  return activeLineStart === 0 ? 24 : null
}

const computeBlockMenuFromRects = (
  isBlockMenuOpen: boolean,
  canShowGutterPlus: boolean,
  gutterTop: number | null,
  lineCoords: CoordsRect | null,
  containerRect: DOMRect | null,
  contentRect: DOMRect | null
): { top: number; left: number } | null => {
  if (!isBlockMenuOpen || !canShowGutterPlus || gutterTop === null || !containerRect) return null
  const vp = readVisualViewportBounds()
  const menuHeight = Math.min(432, Math.max(200, vp.height - 24))
  const rawBelowTop = Math.round(
    Math.max((lineCoords?.bottom ?? 0) + 6, containerRect.top + gutterTop + 26)
  )
  const rawAboveTop = Math.round(
    Math.min(
      (lineCoords?.top ?? containerRect.top + gutterTop) - menuHeight - 6,
      containerRect.top + gutterTop - menuHeight - 6
    )
  )
  const top =
    rawBelowTop + menuHeight > vp.bottom - 12 && rawAboveTop >= vp.offsetTop + 12
      ? rawAboveTop
      : Math.max(vp.offsetTop + 12, Math.min(rawBelowTop, vp.bottom - menuHeight - 12))
  const leftAnchor = contentRect ? contentRect.left : containerRect.left
  const left = Math.max(vp.offsetLeft + 12, Math.min(Math.round(leftAnchor + 10), vp.right - 236))
  return { top, left }
}

export const measureBlockChromeLayout = ({
  canShowBubble,
  canShowGutterPlus,
  isBlockMenuOpen,
  selection,
  activeLineStart,
  resolveCoords,
  container,
  measuredBubbleWidth,
}: {
  canShowBubble: boolean
  canShowGutterPlus: boolean
  isBlockMenuOpen: boolean
  selection: { from: number; to: number }
  activeLineStart: number
  resolveCoords: (pos: number) => CoordsRect | null
  container: HTMLElement | null
  measuredBubbleWidth?: number
}): BlockChromeMeasuredLayout => {
  if (!canShowBubble && !canShowGutterPlus) {
    return { bubble: null, gutterTop: null, gutterLeft: 10, blockMenu: null }
  }
  const containerRect = container?.getBoundingClientRect() ?? null
  const contentEl = typeof container?.querySelector === "function" ? container.querySelector(".cm-content") : null
  const contentRect = contentEl?.getBoundingClientRect?.() ?? null
  const gutterLeft =
    containerRect && contentRect ? Math.max(2, Math.round(contentRect.left - containerRect.left + 2)) : 2
  const startCoords = canShowBubble ? resolveCoords(selection.from) : null
  const endCoords = canShowBubble ? resolveCoords(selection.to) : null
  const lineCoords = canShowGutterPlus ? resolveCoords(activeLineStart) : null
  const bubble = computeBubbleFromRects(
    canShowBubble,
    startCoords,
    endCoords,
    containerRect,
    measuredBubbleWidth
  )
  const gutterTop = computeGutterTopFromRects(
    canShowGutterPlus,
    activeLineStart,
    lineCoords,
    containerRect
  )
  const blockMenu = computeBlockMenuFromRects(
    isBlockMenuOpen,
    canShowGutterPlus,
    gutterTop,
    lineCoords,
    containerRect,
    contentRect
  )
  return { bubble, gutterTop, gutterLeft, blockMenu }
}

export const computeBubbleToolbarPosition = (
  canShowBubble: boolean,
  selection: { from: number; to: number },
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): { top: number; left: number } | null =>
  computeBubbleFromRects(
    canShowBubble,
    canShowBubble ? resolveCoords(selection.from) : null,
    canShowBubble ? resolveCoords(selection.to) : null,
    container?.getBoundingClientRect() ?? null
  )

export const computeGutterTopPosition = (
  canShowGutterPlus: boolean,
  activeLineStart: number,
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): number | null =>
  computeGutterTopFromRects(
    canShowGutterPlus,
    activeLineStart,
    canShowGutterPlus ? resolveCoords(activeLineStart) : null,
    container?.getBoundingClientRect() ?? null
  )

export const computeBlockMenuPosition = (
  isBlockMenuOpen: boolean,
  canShowGutterPlus: boolean,
  gutterTop: number | null,
  activeLineStart: number,
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): { top: number; left: number } | null =>
  computeBlockMenuFromRects(
    isBlockMenuOpen,
    canShowGutterPlus,
    gutterTop,
    isBlockMenuOpen && canShowGutterPlus ? resolveCoords(activeLineStart) : null,
    container?.getBoundingClientRect() ?? null,
    (typeof container?.querySelector === "function"
      ? container.querySelector(".cm-content")?.getBoundingClientRect?.()
      : null) ?? null
  )

export const moveBlockMenuFocus = (
  key: string,
  items: HTMLButtonElement[],
  currentIndex: number,
  onClose: () => void
): boolean => {
  if (key === "ArrowDown") {
    items[currentIndex < 0 ? 0 : (currentIndex + 1) % items.length]?.focus()
    return true
  }
  if (key === "ArrowUp") {
    items[currentIndex <= 0 ? items.length - 1 : currentIndex - 1]?.focus()
    return true
  }
  if (key === "Home") {
    items[0]?.focus()
    return true
  }
  if (key === "End") {
    items.at(-1)?.focus()
    return true
  }
  if (key === "Escape") {
    onClose()
    return true
  }
  return false
}

export type ColorSwatchMutationResult =
  | { kind: "replace"; plan: PlannedTextMutation }
  | { kind: "wrap"; before: string; after: string }
  | { kind: "noop" }

export const computeColorSwatchMutationPlan = (
  value: string,
  selection: { from: number; to: number },
  selectedText: string,
  token: string
): ColorSwatchMutationResult => {
  if (selection.from < selection.to) {
    const existingMatch = /^\{\{color:([^|{}]+)\|([\s\S]*)\}\}$/.exec(selectedText)
    if (existingMatch) {
      const inner = existingMatch[2] ?? ""
      const replacement =
        token === "default" || existingMatch[1]?.trim() === token
          ? inner
          : `{{color:${token}|${inner}}}`
      return {
        kind: "replace",
        plan: planReplaceSelection(selection.from, selection.to, replacement),
      }
    }
    if (token !== "default") {
      return { kind: "wrap", before: `{{color:${token}|`, after: "}}" }
    }
    return { kind: "noop" }
  }

  const lineStart = selection.from > 0 ? value.lastIndexOf("\n", selection.from - 1) + 1 : 0
  const nextBreak = value.indexOf("\n", selection.from)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lineText = value.slice(lineStart, lineEnd)
  const prefixMatch =
    /^(?:[ \t]*(?:#{1,6}[ \t]+|>+[ \t]*|(?:[-+*]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?))/.exec(lineText)
  const bodyOffset = prefixMatch ? prefixMatch[0].length : 0
  const rawBody = lineText.slice(bodyOffset)
  const existingColorMatch = /^\{\{color:([^|{}]+)\|([\s\S]*)\}\}$/.exec(rawBody)
  const innerText = (existingColorMatch ? existingColorMatch[2] ?? "" : rawBody) || "강조 텍스트"
  const replacement =
    token === "default" || existingColorMatch?.[1]?.trim() === token
      ? innerText
      : `{{color:${token}|${innerText}}}`
  return {
    kind: "replace",
    plan: planReplaceSelection(lineStart + bodyOffset, lineEnd, replacement),
  }
}
