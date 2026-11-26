/**
 * 참조 구현:
 * - silverbulletmd/silverbullet (MIT) & Milkdown/milkdown (MIT) — 라이브 에디터 카드 위젯 & 메타 배지 DOM 빌더
 */
import { EditorView, WidgetType } from "@codemirror/view"
import type { SiteLanguage } from "src/libs/language"
import { normalizePublicExternalThumbnailUrl } from "../../libs/markdown/externalThumbnailUrlPolicy"
import { normalizePublicPostImageUrl } from "../../libs/markdown/postImageUrlPolicy"
import { normalizeSafeMarkdownUrl, setSafeAnchorHref } from "../../libs/markdown/safeMarkdownUrl"
import { fetchEditorUnfurl, getCachedEditorUnfurl } from "../../libs/unfurl/fetchEditorUnfurl"
import { formatReadableFileSize, inferLinkProvider, resolveEmbedPreviewUrl } from "../../libs/unfurl/extractMeta"
import { LIVE_BLOCK_UI_SVGS } from "./markdownEditorBlockSvgIcons"
import { resolveEditorViewLanguage } from "./markdownEditorLanguageState"
import { getCardBlockLabels } from "./markdownEditorWidgetLabels"

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

const resolveSafeCardThumbnail = (raw?: string): string => {
  if (!raw) return ""
  return normalizePublicPostImageUrl(raw) || normalizePublicExternalThumbnailUrl(raw)
}

const buildLinkCardContainerDOM = (
  options: {
    cardKind: "bookmark" | "embed" | "file"
    openLabel: string
    url: string
    title: string
    secondary: string
    thumbnailUrl?: string
    embedUrl?: string
    badges: readonly string[]
    sig: string
    from: number
    to: number
    uiLanguage?: SiteLanguage
  },
  view?: EditorView
): HTMLElement => {
  const uiLang = options.uiLanguage ?? resolveEditorViewLanguage(view, "ko")
  const root = document.createElement("div")
  root.className =
    options.cardKind === "bookmark"
      ? "cm-live-bookmark-card"
      : `cm-live-bookmark-card cm-live-${options.cardKind}-card`
  root.dataset.testid = `cm-live-${options.cardKind}-widget`
  root.dataset.from = String(options.from)
  root.dataset.sig = options.sig
  root.dataset.lang = uiLang

  const headerRow = document.createElement("div")
  headerRow.className = "cm-live-bookmark-header"

  const icon = document.createElement("span")
  icon.className = "cm-live-bookmark-icon"
  icon.setAttribute("aria-hidden", "true")
  icon.innerHTML = LIVE_BLOCK_UI_SVGS[options.cardKind]

  const content = document.createElement("div")
  content.className = "cm-live-bookmark-content"
  const badgesRow = buildCardBadges(options.badges)
  if (badgesRow) content.appendChild(badgesRow)

  const cachedMeta = options.cardKind !== "file" ? getCachedEditorUnfurl(options.url) : null
  const resolvedTitle =
    options.title && options.title !== options.url ? options.title : cachedMeta?.title || options.title || options.url
  const resolvedSecondary = options.secondary || cachedMeta?.description || ""

  const titleEl = document.createElement("span")
  titleEl.className = "cm-live-bookmark-title"
  titleEl.textContent = resolvedTitle
  content.appendChild(titleEl)

  const descEl = document.createElement("span")
  descEl.className = "cm-live-bookmark-desc"
  if (resolvedSecondary) {
    descEl.textContent = resolvedSecondary
    content.appendChild(descEl)
  }
  const urlEl = document.createElement("span")
  urlEl.className = "cm-live-bookmark-url"
  urlEl.textContent = options.url
  content.appendChild(urlEl)

  const openLink = document.createElement("a")
  openLink.className = "cm-live-bookmark-open"
  const safeUrl = normalizeSafeMarkdownUrl(options.url)
  const initialThumb = resolveSafeCardThumbnail(options.thumbnailUrl || cachedMeta?.thumbnailUrl)
  const attachThumbnail = (thumbSrc: string) => {
    if (!thumbSrc) return
    const existingThumb = headerRow.querySelector(".cm-live-bookmark-thumb")
    if (existingThumb) return
    const thumbImg = document.createElement("img")
    thumbImg.className = "cm-live-bookmark-thumb"
    thumbImg.src = thumbSrc
    thumbImg.alt = ""
    thumbImg.loading = "lazy"
    thumbImg.referrerPolicy = "no-referrer"
    headerRow.insertBefore(thumbImg, openLink.parentNode === headerRow ? openLink : null)
  }

  if (safeUrl && setSafeAnchorHref(openLink, safeUrl)) {
    if (safeUrl.startsWith("http://") || safeUrl.startsWith("https://")) {
      openLink.target = "_blank"
      openLink.rel = "noopener noreferrer"
    }
    openLink.setAttribute("aria-label", options.openLabel)
    openLink.innerHTML = LIVE_BLOCK_UI_SVGS.externalLink
    headerRow.append(icon, content, openLink)
  } else {
    headerRow.append(icon, content)
  }
  if (initialThumb) attachThumbnail(initialThumb)
  root.appendChild(headerRow)

  if (options.cardKind === "embed") {
    const safeEmbed = resolveEmbedPreviewUrl(options.embedUrl || cachedMeta?.embedUrl || options.url)
    if (safeEmbed) {
      const frameWrap = document.createElement("div")
      frameWrap.className = "cm-live-embed-preview"
      const iframe = document.createElement("iframe")
      iframe.src = safeEmbed
      iframe.title = resolvedTitle || getCardBlockLabels(uiLang).embedPreviewTitle
      iframe.loading = "lazy"
      iframe.referrerPolicy = "strict-origin-when-cross-origin"
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation")
      iframe.setAttribute("allowfullscreen", "true")
      frameWrap.appendChild(iframe)
      root.appendChild(frameWrap)
    }
  }

  if (
    options.cardKind !== "file" &&
    !initialThumb &&
    typeof window !== "undefined" &&
    typeof fetch === "function" &&
    window.location?.protocol?.startsWith("http") &&
    (options.url.startsWith("http://") || options.url.startsWith("https://"))
  ) {
    void fetchEditorUnfurl(options.url).then((fetched) => {
      if (!fetched || root.isConnected === false) return
      if (fetched.title && titleEl.textContent === options.url) titleEl.textContent = fetched.title
      if (fetched.description && !descEl.textContent) {
        descEl.textContent = fetched.description
        content.insertBefore(descEl, urlEl)
      }
      if (fetched.thumbnailUrl) attachThumbnail(fetched.thumbnailUrl)
    })
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
    readonly provider = "",
    readonly thumbnailUrl = "",
    readonly language: SiteLanguage = "ko"
  ) {
    super()
  }

  private get signature() {
    return `${this.url}\0${this.title}\0${this.description}\0${this.siteName}\0${this.provider}\0${this.thumbnailUrl}`
  }

  eq(other: MarkdownBookmarkBlockWidget) {
    return (
      other instanceof MarkdownBookmarkBlockWidget &&
      other.signature === this.signature &&
      other.from === this.from &&
      other.to === this.to &&
      other.language === this.language
    )
  }

  updateDOM(dom: HTMLElement, view?: EditorView) {
    const lang = resolveEditorViewLanguage(view, this.language)
    if (dom.dataset?.sig !== this.signature || (dom.dataset?.lang ?? "ko") !== lang) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const uiLanguage = resolveEditorViewLanguage(view, this.language)
    const badge = this.siteName || this.provider || formatHostBadge(this.url)
    return buildLinkCardContainerDOM(
      {
        cardKind: "bookmark",
        openLabel: getCardBlockLabels(uiLanguage).bookmarkOpen,
        url: this.url,
        title: this.title,
        secondary: this.description,
        thumbnailUrl: this.thumbnailUrl,
        badges: badge ? [badge] : [],
        sig: this.signature,
        from: this.from,
        to: this.to,
        uiLanguage,
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
    readonly siteName = "",
    readonly thumbnailUrl = "",
    readonly embedUrl = "",
    readonly language: SiteLanguage = "ko"
  ) {
    super()
  }

  private get signature() {
    return `${this.url}\0${this.title}\0${this.caption}\0${this.provider}\0${this.siteName}\0${this.thumbnailUrl}\0${this.embedUrl}`
  }

  eq(other: MarkdownEmbedBlockWidget) {
    return (
      other instanceof MarkdownEmbedBlockWidget &&
      other.signature === this.signature &&
      other.from === this.from &&
      other.to === this.to &&
      other.language === this.language
    )
  }

  updateDOM(dom: HTMLElement, view?: EditorView) {
    const lang = resolveEditorViewLanguage(view, this.language)
    if (dom.dataset?.sig !== this.signature || (dom.dataset?.lang ?? "ko") !== lang) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const uiLanguage = resolveEditorViewLanguage(view, this.language)
    const badge = this.provider || this.siteName || formatHostBadge(this.url)
    return buildLinkCardContainerDOM(
      {
        cardKind: "embed",
        openLabel: getCardBlockLabels(uiLanguage).embedOpen,
        url: this.url,
        title: this.title,
        secondary: this.caption,
        thumbnailUrl: this.thumbnailUrl,
        embedUrl: this.embedUrl,
        badges: badge ? [badge] : [],
        sig: this.signature,
        from: this.from,
        to: this.to,
        uiLanguage,
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
    readonly sizeBytes?: number,
    readonly language: SiteLanguage = "ko"
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
      other.to === this.to &&
      other.language === this.language
    )
  }

  updateDOM(dom: HTMLElement, view?: EditorView) {
    const lang = resolveEditorViewLanguage(view, this.language)
    if (dom.dataset?.sig !== this.signature || (dom.dataset?.lang ?? "ko") !== lang) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const uiLanguage = resolveEditorViewLanguage(view, this.language)
    const badges: string[] = []
    if (this.mimeType) badges.push(this.mimeType)
    const readableSize = formatReadableFileSize(this.sizeBytes)
    if (readableSize) badges.push(readableSize)
    return buildLinkCardContainerDOM(
      {
        cardKind: "file",
        openLabel: getCardBlockLabels(uiLanguage).fileOpen,
        url: this.url,
        title: this.name,
        secondary: this.description,
        badges,
        sig: this.signature,
        from: this.from,
        to: this.to,
        uiLanguage,
      },
      view
    )
  }
}
