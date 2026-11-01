import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"

export const NOTION_COLOR_SWATCH_SPECS = [
  { label: "글자 기본색", token: "default", hex: "#787774" },
  { label: "글자 파란색", token: "sky", hex: "#2383e2" },
  { label: "글자 초록색", token: "emerald", hex: "#10b981" },
  { label: "글자 주황색", token: "amber", hex: "#f59e0b" },
  { label: "글자 보라색", token: "violet", hex: "#9065b0" },
  { label: "글자 빨간색", token: "rose", hex: "#eb5757" },
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

export const computeBubbleToolbarPosition = (
  canShowBubble: boolean,
  selection: { from: number; to: number },
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): { top: number; left: number } | null => {
  if (!canShowBubble) return null
  const startCoords = resolveCoords(selection.from)
  const endCoords = resolveCoords(selection.to)
  const containerRect = container?.getBoundingClientRect() ?? null
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const estimatedWidth = Math.min(410, viewportWidth - 24)

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
      12,
      Math.min(Math.round(centerX - estimatedWidth / 2), viewportWidth - estimatedWidth - 12)
    )
    const bottomEdge = Math.max(startCoords.bottom, endCoords.bottom)
    const isMobileViewport = viewportWidth <= 820
    const placeBelow = isMobileViewport
      ? bottomEdge + 60 <= viewportHeight
      : startCoords.top - (containerRect?.top ?? 0) < 52
    const top = placeBelow
      ? Math.min(viewportHeight - 56, Math.round(bottomEdge + 8))
      : Math.max(12, Math.round(startCoords.top - 48))
    return { top, left }
  }

  if (containerRect && containerRect.height > 0) {
    return {
      top: Math.round(containerRect.top + 48),
      left: Math.max(
        12,
        Math.min(Math.round(containerRect.left + 24), viewportWidth - estimatedWidth - 12)
      ),
    }
  }
  return null
}

export const computeGutterTopPosition = (
  canShowGutterPlus: boolean,
  activeLineStart: number,
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): number | null => {
  if (!canShowGutterPlus) return null
  const containerRect = container?.getBoundingClientRect() ?? null
  if (!containerRect || containerRect.height <= 0) return null
  const lineCoords = resolveCoords(activeLineStart)
  if (lineCoords && lineCoords.bottom > lineCoords.top) {
    const rawTop =
      lineCoords.top - containerRect.top + (lineCoords.bottom - lineCoords.top - 22) / 2
    return rawTop >= 0 && rawTop <= containerRect.height - 22 ? Math.round(rawTop) : null
  }
  return activeLineStart === 0 ? 24 : null
}

export const computeBlockMenuPosition = (
  isBlockMenuOpen: boolean,
  canShowGutterPlus: boolean,
  gutterTop: number | null,
  activeLineStart: number,
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): { top: number; left: number } | null => {
  if (!isBlockMenuOpen || !canShowGutterPlus || gutterTop === null) return null
  const containerRect = container?.getBoundingClientRect() ?? null
  if (!containerRect) return null
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const menuHeight = 432
  const lineCoords = resolveCoords(activeLineStart)
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
    rawBelowTop + menuHeight > viewportHeight - 12 && rawAboveTop >= 12
      ? rawAboveTop
      : Math.max(12, Math.min(rawBelowTop, viewportHeight - menuHeight - 12))
  const left = Math.max(12, Math.min(Math.round(containerRect.left + 10), viewportWidth - 232))
  return { top, left }
}

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
