/**
 * 참조 구현:
 * - silverbulletmd/silverbullet (MIT) & Milkdown/milkdown (MIT) — 라이브 에디터 카드 위젯 & 메타 배지 DOM 빌더
 */
import { EditorView, WidgetType } from "@codemirror/view"
import { normalizeSafeMarkdownUrl, setSafeAnchorHref } from "../../libs/markdown/safeMarkdownUrl"
import { formatReadableFileSize, inferLinkProvider } from "../../libs/unfurl/extractMeta"
import { LIVE_BLOCK_UI_SVGS } from "./markdownEditorBlockSvgIcons"

export const focusContainerBlockOrigin = (
  view: EditorView | undefined,
  root: HTMLElement,
  fallbackFrom: number,
  fallbackTo: number,
  innerOffset: number
) => {
  if (!view?.state.facet(EditorView.editable)) return
  let resolvedFrom = fallbackFrom
  const datasetFrom = Number(root.dataset?.from)
  if (Number.isFinite(datasetFrom) && datasetFrom >= 0) resolvedFrom = datasetFrom
  try {
    const domPos = view.posAtDOM(root)
    if (typeof domPos === "number" && domPos >= 0) resolvedFrom = domPos
  } catch {}
  const resolvedTo = resolvedFrom + Math.max(0, fallbackTo - fallbackFrom)
  const targetAnchor = Math.min(
    view.state.doc.length,
    Math.min(resolvedTo, resolvedFrom + innerOffset)
  )
  view.focus()
  view.dispatch({ selection: { anchor: targetAnchor }, scrollIntoView: true })
}

export const bindContainerActivateTarget = (
  element: HTMLElement,
  view: EditorView | undefined,
  root: HTMLElement,
  from: number,
  to: number,
  offset: number,
  ignoreLinks = true
) => {
  const handler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (ignoreLinks && target?.closest("a")) return
    event.preventDefault()
    event.stopPropagation()
    focusContainerBlockOrigin(view, root, from, to, offset)
  }
  element.addEventListener("mousedown", handler)
  element.addEventListener("click", handler)
}

const formatHostBadge = (url: string): string => {
  const inferred = inferLinkProvider(url)
  if (inferred) return inferred
  try {
    return new URL(url).hostname.replace(/^www\./i, "")
  } catch {
    return ""
  }
}

const buildCardBadges = (badges: readonly string[]): HTMLElement | null => {
  const cleanBadges: string[] = []
  for (const badge of badges) {
    const trimmed = badge.trim()
    if (trimmed && !cleanBadges.includes(trimmed)) cleanBadges.push(trimmed)
  }
  if (cleanBadges.length === 0) return null
  const row = document.createElement("div")
  row.className = "cm-live-bookmark-badges"
  for (const text of cleanBadges) {
    const chip = document.createElement("span")
    chip.className = "cm-live-bookmark-badge"
    chip.textContent = text
    row.appendChild(chip)
  }
  return row
}

const buildLinkCardContainerDOM = (
  options: {
    cardKind: "bookmark" | "embed" | "file"
    openLabel: string
    url: string
    title: string
    secondary: string
    badges: readonly string[]
    sig: string
    from: number
    to: number
  },
  view?: EditorView
): HTMLElement => {
  const root = document.createElement("div")
  root.className =
    options.cardKind === "bookmark"
      ? "cm-live-bookmark-card"
      : `cm-live-bookmark-card cm-live-${options.cardKind}-card`
  root.dataset.testid = `cm-live-${options.cardKind}-widget`
  root.dataset.from = String(options.from)
  root.dataset.sig = options.sig

  const icon = document.createElement("span")
  icon.className = "cm-live-bookmark-icon"
  icon.setAttribute("aria-hidden", "true")
  icon.innerHTML = LIVE_BLOCK_UI_SVGS[options.cardKind]

  const content = document.createElement("div")
  content.className = "cm-live-bookmark-content"
  const badgesRow = buildCardBadges(options.badges)
  if (badgesRow) content.appendChild(badgesRow)

  const titleEl = document.createElement("span")
  titleEl.className = "cm-live-bookmark-title"
  titleEl.textContent = options.title || options.url
  content.appendChild(titleEl)
  if (options.secondary) {
    const descEl = document.createElement("span")
    descEl.className = "cm-live-bookmark-desc"
    descEl.textContent = options.secondary
    content.appendChild(descEl)
  }
  const urlEl = document.createElement("span")
  urlEl.className = "cm-live-bookmark-url"
  urlEl.textContent = options.url
  content.appendChild(urlEl)

  const openLink = document.createElement("a")
  openLink.className = "cm-live-bookmark-open"
  const safeUrl = normalizeSafeMarkdownUrl(options.url)
  if (safeUrl && setSafeAnchorHref(openLink, safeUrl)) {
    if (safeUrl.startsWith("http://") || safeUrl.startsWith("https://")) {
      openLink.target = "_blank"
      openLink.rel = "noopener noreferrer"
    }
    openLink.setAttribute("aria-label", options.openLabel)
    openLink.innerHTML = LIVE_BLOCK_UI_SVGS.externalLink
    root.append(icon, content, openLink)
  } else {
    root.append(icon, content)
  }
  bindContainerActivateTarget(root, view, root, options.from, options.to, 12, true)
  return root
}

export class MarkdownBookmarkBlockWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly title: string,
    readonly description: string,
    readonly from: number,
    readonly to: number,
    readonly siteName = "",
    readonly provider = ""
  ) {
    super()
  }

  private get signature() {
    return `${this.url}\0${this.title}\0${this.description}\0${this.siteName}\0${this.provider}`
  }

  eq(other: MarkdownBookmarkBlockWidget) {
    return (
      other instanceof MarkdownBookmarkBlockWidget &&
      other.signature === this.signature &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== this.signature) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const badge = this.siteName || this.provider || formatHostBadge(this.url)
    return buildLinkCardContainerDOM(
      {
        cardKind: "bookmark",
        openLabel: "북마크 링크 열기",
        url: this.url,
        title: this.title,
        secondary: this.description,
        badges: badge ? [badge] : [],
        sig: this.signature,
        from: this.from,
        to: this.to,
      },
      view
    )
  }
}

export class MarkdownEmbedBlockWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly title: string,
    readonly caption: string,
    readonly from: number,
    readonly to: number,
    readonly provider = "",
    readonly siteName = ""
  ) {
    super()
  }

  private get signature() {
    return `${this.url}\0${this.title}\0${this.caption}\0${this.provider}\0${this.siteName}`
  }

  eq(other: MarkdownEmbedBlockWidget) {
    return (
      other instanceof MarkdownEmbedBlockWidget &&
      other.signature === this.signature &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== this.signature) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const badge = this.provider || this.siteName || formatHostBadge(this.url)
    return buildLinkCardContainerDOM(
      {
        cardKind: "embed",
        openLabel: "임베드 링크 열기",
        url: this.url,
        title: this.title,
        secondary: this.caption,
        badges: badge ? [badge] : [],
        sig: this.signature,
        from: this.from,
        to: this.to,
      },
      view
    )
  }
}

export class MarkdownFileBlockWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly name: string,
    readonly description: string,
    readonly from: number,
    readonly to: number,
    readonly mimeType = "",
    readonly sizeBytes?: number
  ) {
    super()
  }

  private get signature() {
    return `${this.url}\0${this.name}\0${this.description}\0${this.mimeType}\0${this.sizeBytes ?? ""}`
  }

  eq(other: MarkdownFileBlockWidget) {
    return (
      other instanceof MarkdownFileBlockWidget &&
      other.signature === this.signature &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== this.signature) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const badges: string[] = []
    if (this.mimeType) badges.push(this.mimeType)
    const readableSize = formatReadableFileSize(this.sizeBytes)
    if (readableSize) badges.push(readableSize)
    return buildLinkCardContainerDOM(
      {
        cardKind: "file",
        openLabel: "첨부 파일 열기",
        url: this.url,
        title: this.name,
        secondary: this.description,
        badges,
        sig: this.signature,
        from: this.from,
        to: this.to,
      },
      view
    )
  }
}
