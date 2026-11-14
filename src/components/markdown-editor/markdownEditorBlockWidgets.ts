import { EditorState, StateField, type Range } from "@codemirror/state"
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view"
import { normalizeSafeMarkdownUrl, setSafeAnchorHref } from "../../libs/markdown/safeMarkdownUrl"
import {
  parseBlockContainerBlocks,
  type EditorBookmarkContainerBlock,
  type EditorCalloutContainerBlock,
  type EditorCalloutTone,
  type EditorContainerBlock,
  type EditorEmbedContainerBlock,
  type EditorFileContainerBlock,
  type EditorToggleContainerBlock,
} from "./markdownEditorBlockContainerModel"
import { hasIntervalOverlap, isTokenActive } from "./markdownEditorLivePreview"
import { editorModeField, getDocString, setEditorMode } from "./markdownEditorLiveSurfaceDecorations"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export {
  parseBlockContainerBlocks,
  type EditorBookmarkContainerBlock,
  type EditorCalloutContainerBlock,
  type EditorCalloutTone,
  type EditorContainerBlock,
  type EditorEmbedContainerBlock,
  type EditorFileContainerBlock,
  type EditorToggleContainerBlock,
}

const focusContainerBlockOrigin = (
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

const bindContainerActivateTarget = (
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

export class MarkdownCalloutBlockWidget extends WidgetType {
  constructor(
    readonly tone: EditorCalloutTone,
    readonly icon: string,
    readonly title: string,
    readonly body: string,
    readonly from: number,
    readonly to: number,
    readonly bodyOffset = 11 + title.length + 1
  ) {
    super()
  }

  eq(other: MarkdownCalloutBlockWidget) {
    return (
      other instanceof MarkdownCalloutBlockWidget &&
      other.tone === this.tone &&
      other.icon === this.icon &&
      other.title === this.title &&
      other.body === this.body &&
      other.from === this.from &&
      other.to === this.to &&
      other.bodyOffset === this.bodyOffset
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.tone}\0${this.icon}\0${this.title}\0${this.body}\0${this.bodyOffset}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const root = document.createElement("div")
    root.className = `cm-live-callout cm-live-callout-tone-${this.tone}`
    root.dataset.testid = "cm-live-callout-widget"
    root.dataset.from = String(this.from)
    root.dataset.callout = this.tone
    root.dataset.sig = `${this.tone}\0${this.icon}\0${this.title}\0${this.body}\0${this.bodyOffset}`

    const header = document.createElement("div")
    header.className = "cm-live-callout-header"
    const badge = document.createElement("span")
    badge.className = "cm-live-callout-icon"
    badge.setAttribute("aria-hidden", "true")
    badge.textContent = this.icon
    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-callout-title"
    appendInlineMarkdownNodes(titleSpan, this.title || "콜아웃")
    header.append(badge, titleSpan)
    root.appendChild(header)
    bindContainerActivateTarget(header, view, root, this.from, this.to, 11)

    if (this.body) {
      const bodyEl = document.createElement("div")
      bodyEl.className = "cm-live-callout-body"
      appendInlineMarkdownNodes(bodyEl, this.body)
      bindContainerActivateTarget(bodyEl, view, root, this.from, this.to, this.bodyOffset)
      root.appendChild(bodyEl)
    }
    return root
  }
}

export class MarkdownToggleBlockWidget extends WidgetType {
  constructor(
    readonly title: string,
    readonly body: string,
    readonly from: number,
    readonly to: number,
    readonly bodyOffset = 10 + title.length + 1
  ) {
    super()
  }

  eq(other: MarkdownToggleBlockWidget) {
    return (
      other instanceof MarkdownToggleBlockWidget &&
      other.title === this.title &&
      other.body === this.body &&
      other.from === this.from &&
      other.to === this.to &&
      other.bodyOffset === this.bodyOffset
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.title}\0${this.body}\0${this.bodyOffset}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    let isCollapsed = false
    const root = document.createElement("div")
    root.className = "cm-live-toggle-block"
    root.dataset.testid = "cm-live-toggle-widget"
    root.dataset.from = String(this.from)
    root.dataset.sig = `${this.title}\0${this.body}\0${this.bodyOffset}`

    const header = document.createElement("div")
    header.className = "cm-live-toggle-header"
    const caret = document.createElement("span")
    caret.className = "cm-live-toggle-caret"
    caret.tabIndex = 0
    caret.setAttribute("tabindex", "0")
    caret.setAttribute("role", "button")
    caret.setAttribute("aria-expanded", "true")
    caret.setAttribute("aria-label", "토글 접기/펼치기")
    caret.textContent = "▼"
    const toggleCollapse = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      isCollapsed = root.classList.toggle("is-collapsed")
      caret.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
      caret.textContent = isCollapsed ? "▶" : "▼"
    }
    caret.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    caret.addEventListener("click", toggleCollapse)
    caret.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") toggleCollapse(event)
    })

    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-toggle-title"
    appendInlineMarkdownNodes(titleSpan, this.title || "토글 블록")
    bindContainerActivateTarget(titleSpan, view, root, this.from, this.to, 10)
    header.append(caret, titleSpan)
    root.appendChild(header)

    const bodyEl = document.createElement("div")
    bodyEl.className = `cm-live-toggle-body${this.body ? "" : " is-empty"}`
    if (this.body) appendInlineMarkdownNodes(bodyEl, this.body)
    else bodyEl.textContent = "내용을 입력하려면 클릭하세요..."
    bindContainerActivateTarget(bodyEl, view, root, this.from, this.to, this.bodyOffset)
    root.appendChild(bodyEl)
    return root
  }
}

const buildLinkCardContainerDOM = (
  options: {
    cardKind: "bookmark" | "embed" | "file"
    iconText: string
    openLabel: string
    url: string
    title: string
    secondary: string
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
  root.dataset.sig = `${options.url}\0${options.title}\0${options.secondary}`

  const icon = document.createElement("span")
  icon.className = "cm-live-bookmark-icon"
  icon.setAttribute("aria-hidden", "true")
  icon.textContent = options.iconText

  const content = document.createElement("div")
  content.className = "cm-live-bookmark-content"
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
    openLink.textContent = "↗"
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
    readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownBookmarkBlockWidget) {
    return (
      other instanceof MarkdownBookmarkBlockWidget &&
      other.url === this.url &&
      other.title === this.title &&
      other.description === this.description &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.url}\0${this.title}\0${this.description}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    return buildLinkCardContainerDOM(
      {
        cardKind: "bookmark",
        iconText: "🔖",
        openLabel: "북마크 링크 열기",
        url: this.url,
        title: this.title,
        secondary: this.description,
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
    readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownEmbedBlockWidget) {
    return (
      other instanceof MarkdownEmbedBlockWidget &&
      other.url === this.url &&
      other.title === this.title &&
      other.caption === this.caption &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.url}\0${this.title}\0${this.caption}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    return buildLinkCardContainerDOM(
      {
        cardKind: "embed",
        iconText: "🎬",
        openLabel: "임베드 링크 열기",
        url: this.url,
        title: this.title,
        secondary: this.caption,
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
    readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownFileBlockWidget) {
    return (
      other instanceof MarkdownFileBlockWidget &&
      other.url === this.url &&
      other.name === this.name &&
      other.description === this.description &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.url}\0${this.name}\0${this.description}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    return buildLinkCardContainerDOM(
      {
        cardKind: "file",
        iconText: "📎",
        openLabel: "첨부 파일 열기",
        url: this.url,
        title: this.name,
        secondary: this.description,
        from: this.from,
        to: this.to,
      },
      view
    )
  }
}

let cachedContainerBlocksEntry: { doc: EditorState["doc"]; blocks: readonly EditorContainerBlock[] } | null = null

const getCachedBlockContainerBlocks = (doc: EditorState["doc"]): readonly EditorContainerBlock[] => {
  if (cachedContainerBlocksEntry && cachedContainerBlocksEntry.doc === doc) return cachedContainerBlocksEntry.blocks
  const blocks = parseBlockContainerBlocks(getDocString(doc))
  cachedContainerBlocksEntry = { doc, blocks }
  return blocks
}

const isContainerBlockActive = (block: EditorContainerBlock, selections: readonly { from: number; to: number }[]) =>
  isTokenActive(block.from, block.to, selections) || hasIntervalOverlap(selections, block.from, block.to)

const haveSameActiveContainerBlocks = (
  blocks: readonly EditorContainerBlock[],
  prevRanges: readonly { from: number; to: number }[],
  nextRanges: readonly { from: number; to: number }[]
): boolean => {
  if (blocks.length === 0) return true
  for (const block of blocks) {
    if (isContainerBlockActive(block, prevRanges) !== isContainerBlockActive(block, nextRanges)) return false
  }
  return true
}

const createBlockContainerWidget = (block: EditorContainerBlock): WidgetType => {
  if (block.kind === "callout") {
    return new MarkdownCalloutBlockWidget(block.tone, block.icon, block.title, block.body, block.from, block.to, block.bodyOffset)
  }
  if (block.kind === "toggle") {
    return new MarkdownToggleBlockWidget(block.title, block.body, block.from, block.to, block.bodyOffset)
  }
  if (block.kind === "embed") {
    return new MarkdownEmbedBlockWidget(block.url, block.title, block.caption, block.from, block.to)
  }
  if (block.kind === "file") {
    return new MarkdownFileBlockWidget(block.url, block.name, block.description, block.from, block.to)
  }
  return new MarkdownBookmarkBlockWidget(block.url, block.title, block.description, block.from, block.to)
}

const buildBlockContainerDecorations = (state: EditorState): DecorationSet => {
  const mode = state.field(editorModeField, false) ?? "live"
  if (mode === "source" || state.doc.length === 0) return Decoration.none

  const blocks = getCachedBlockContainerBlocks(state.doc)
  if (blocks.length === 0) return Decoration.none

  const selections = state.selection.ranges
  const decorations: Range<Decoration>[] = []

  for (const block of blocks) {
    if (mode === "live" && isContainerBlockActive(block, selections)) {
      const startLineNo = state.doc.lineAt(block.from).number
      const endLineNo = state.doc.lineAt(block.to).number
      const toneClass = block.kind === "callout" ? ` cm-live-container-tone-${block.tone}` : ""
      for (let lineNo = startLineNo; lineNo <= endLineNo; lineNo += 1) {
        const line = state.doc.line(lineNo)
        const openCls = lineNo === startLineNo ? " cm-live-container-line-open" : ""
        const closeCls = lineNo === endLineNo ? " cm-live-container-line-close" : ""
        decorations.push(
          Decoration.line({
            class: `cm-live-container-active-line cm-live-container-active-${block.kind}${toneClass}${openCls}${closeCls}`,
          }).range(line.from)
        )
      }
      continue
    }

    const widget = createBlockContainerWidget(block)
    decorations.push(Decoration.replace({ widget, block: true }).range(block.from, block.to))
  }

  return decorations.length > 0 ? Decoration.set(decorations, true) : Decoration.none
}

export const blockContainerBlockField = StateField.define<DecorationSet>({
  create: buildBlockContainerDecorations,
  update: (decorations, transaction) => {
    const hasModeEffect = transaction.effects.some((effect) => effect.is(setEditorMode))
    if (!transaction.docChanged && !hasModeEffect) {
      if (!transaction.selection) return decorations
      const blocks = getCachedBlockContainerBlocks(transaction.state.doc)
      if (haveSameActiveContainerBlocks(blocks, transaction.startState.selection.ranges, transaction.state.selection.ranges)) {
        return decorations
      }
    }
    return buildBlockContainerDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})
