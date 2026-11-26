import type { MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"

export type MarkdownScrollSnapshot = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  fallbackHost: HTMLElement
}

export const computePreservedScrollTop = (
  prevScrollTop: number,
  prevScrollHeight: number,
  prevClientHeight: number,
  nextScrollHeight: number,
  nextClientHeight: number
): number => {
  const prevMax = Math.max(0, prevScrollHeight - prevClientHeight)
  const nextMax = Math.max(0, nextScrollHeight - nextClientHeight)
  if (prevMax <= 0 || nextMax <= 0) return 0
  const ratio = Math.max(0, Math.min(1, prevScrollTop / prevMax))
  return Math.round(ratio * nextMax)
}

export const resolveMarkdownScrollHost = (bodyNode: HTMLElement | null): HTMLElement | null => {
  if (!bodyNode) return null
  const cmScroller = bodyNode.querySelector<HTMLElement>(".cm-scroller")
  if (cmScroller && cmScroller.clientHeight > 0 && cmScroller.scrollHeight > cmScroller.clientHeight + 2) {
    return cmScroller
  }
  const paperSheet = bodyNode.closest<HTMLElement>('[data-testid="editor-paper-scroll-sheet"]')
  if (paperSheet && paperSheet.scrollHeight > paperSheet.clientHeight + 2) return paperSheet
  const readingSurface = bodyNode.matches?.('[data-testid="markdown-editor-reading-surface"]')
    ? bodyNode
    : bodyNode.querySelector<HTMLElement>('[data-testid="markdown-editor-reading-surface"]') ??
      bodyNode.closest<HTMLElement>('[data-testid="markdown-editor-reading-surface"]')
  if (readingSurface && readingSurface.scrollHeight > readingSurface.clientHeight + 2) return readingSurface
  return paperSheet ?? cmScroller ?? readingSurface
}

export const captureMarkdownScrollSnapshot = (bodyNode: HTMLElement | null): MarkdownScrollSnapshot | null => {
  const host = resolveMarkdownScrollHost(bodyNode)
  if (!host) return null
  return {
    scrollTop: host.scrollTop,
    scrollHeight: host.scrollHeight,
    clientHeight: host.clientHeight,
    fallbackHost: host,
  }
}

export const restoreMarkdownScrollSnapshot = (snapshot: MarkdownScrollSnapshot, bodyNode: HTMLElement | null): void => {
  const target = resolveMarkdownScrollHost(bodyNode) ?? snapshot.fallbackHost
  const nextTop = computePreservedScrollTop(
    snapshot.scrollTop,
    snapshot.scrollHeight,
    snapshot.clientHeight,
    target.scrollHeight,
    target.clientHeight
  )
  if (Math.abs(target.scrollTop - nextTop) > 2) target.scrollTop = nextTop
}

export const scheduleScrollSyncAfterModeToggle = (
  getBodyNode: () => HTMLElement | null,
  initialSnapshot?: MarkdownScrollSnapshot | null
) => {
  const snapshot = initialSnapshot ?? captureMarkdownScrollSnapshot(getBodyNode())
  if (!snapshot || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      restoreMarkdownScrollSnapshot(snapshot, getBodyNode())
    })
  })
}

export const nextEditorViewMode = (prev: MarkdownEditorSurfaceMode): MarkdownEditorSurfaceMode =>
  prev === "live" ? "source" : prev === "source" ? "split" : prev === "split" ? "reading" : "live"
