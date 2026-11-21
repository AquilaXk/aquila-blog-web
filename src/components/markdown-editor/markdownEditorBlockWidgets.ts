import { EditorState, StateField, type Range } from "@codemirror/state"
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view"
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
import { forEachOverlappingSortedIndex, isRangeActiveInSelections } from "./markdownEditorLiveDecorationRegions"
import { getLiveCalloutIconSvg, LIVE_BLOCK_UI_SVGS } from "./markdownEditorBlockSvgIcons"
import { editorModeField, getDocString, setEditorMode } from "./markdownEditorLiveSurfaceDecorations"
import {
  bindContainerActivateTarget,
  MarkdownBookmarkBlockWidget,
  MarkdownEmbedBlockWidget,
  MarkdownFileBlockWidget,
} from "./markdownEditorCardBlockWidgets"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

export {
  MarkdownBookmarkBlockWidget,
  MarkdownEmbedBlockWidget,
  MarkdownFileBlockWidget,
  parseBlockContainerBlocks,
  type EditorBookmarkContainerBlock,
  type EditorCalloutContainerBlock,
  type EditorCalloutTone,
  type EditorContainerBlock,
  type EditorEmbedContainerBlock,
  type EditorFileContainerBlock,
  type EditorToggleContainerBlock,
}

export class MarkdownCalloutBlockWidget extends WidgetType {
  constructor(
    readonly tone: EditorCalloutTone,
    readonly icon: string,
    readonly title: string,
    readonly body: string,
    readonly from: number,
    readonly to: number,
    readonly bodyOffset = 11 + title.length + 1,
    readonly foldable = false,
    readonly defaultCollapsed = false
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
      other.bodyOffset === this.bodyOffset &&
      other.foldable === this.foldable &&
      other.defaultCollapsed === this.defaultCollapsed
    )
  }

  private getDomSignature() {
    const base = `${this.tone}\0${this.icon}\0${this.title}\0${this.body}\0${this.bodyOffset}`
    return this.foldable || this.defaultCollapsed
      ? `${base}\0${this.foldable ? "1" : "0"}\0${this.defaultCollapsed ? "1" : "0"}`
      : base
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== this.getDomSignature()) {
      return false
    }
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    let isCollapsed = this.foldable && this.defaultCollapsed
    const root = document.createElement("div")
    root.className = `cm-live-callout cm-live-callout-tone-${this.tone}${isCollapsed ? " is-collapsed" : ""}`
    root.dataset.testid = "cm-live-callout-widget"
    root.dataset.from = String(this.from)
    root.dataset.callout = this.tone
    root.dataset.sig = this.getDomSignature()

    const header = document.createElement("div")
    header.className = "cm-live-callout-header"
    const badge = document.createElement("span")
    badge.className = "cm-live-callout-icon"
    badge.setAttribute("aria-hidden", "true")
    badge.innerHTML = getLiveCalloutIconSvg(this.tone)
    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-callout-title"
    appendInlineMarkdownNodes(titleSpan, this.title || "콜아웃")
    header.append(badge, titleSpan)
    if (this.foldable) {
      const foldIcon = document.createElement("span")
      foldIcon.className = "cm-live-callout-fold"
      foldIcon.setAttribute("aria-hidden", "true")
      foldIcon.innerHTML = LIVE_BLOCK_UI_SVGS.chevronDown
      header.appendChild(foldIcon)
      header.tabIndex = 0
      header.setAttribute("tabindex", "0")
      header.setAttribute("role", "button")
      header.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
      const toggleCollapse = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        isCollapsed = root.classList.toggle("is-collapsed")
        header.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
      }
      header.addEventListener("mousedown", toggleCollapse)
      header.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          toggleCollapse(event)
        }
      })
    } else {
      bindContainerActivateTarget(header, view, root, this.from, this.to, 11)
    }
    root.appendChild(header)

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
    caret.innerHTML = LIVE_BLOCK_UI_SVGS.chevronDown
    const toggleCollapse = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      isCollapsed = root.classList.toggle("is-collapsed")
      caret.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
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

const containerBlocksCacheByDoc = new WeakMap<EditorState["doc"], readonly EditorContainerBlock[]>()

export const getCachedBlockContainerBlocks = (doc: EditorState["doc"]): readonly EditorContainerBlock[] => {
  const cached = containerBlocksCacheByDoc.get(doc)
  if (cached) return cached
  const blocks = parseBlockContainerBlocks(getDocString(doc))
  containerBlocksCacheByDoc.set(doc, blocks)
  return blocks
}

const isContainerBlockActive = (block: EditorContainerBlock, selections: readonly { from: number; to: number }[]) =>
  isRangeActiveInSelections(block.from, block.to, selections)

export const haveSameActiveContainerBlocks = (
  blocks: readonly EditorContainerBlock[],
  prevRanges: readonly { from: number; to: number }[],
  nextRanges: readonly { from: number; to: number }[]
): boolean => {
  if (blocks.length === 0) return true
  const checkSelectionRanges = (ranges: readonly { from: number; to: number }[]): boolean => {
    for (let i = 0; i < ranges.length; i += 1) {
      const sel = ranges[i]!
      const qFrom = Math.min(sel.from, sel.to)
      const qTo = Math.max(sel.from, sel.to)
      const same = forEachOverlappingSortedIndex(blocks, qFrom, qTo, true, (block) => {
        if (isContainerBlockActive(block, prevRanges) !== isContainerBlockActive(block, nextRanges)) {
          return false
        }
        return true
      })
      if (!same) return false
    }
    return true
  }
  return checkSelectionRanges(prevRanges) && checkSelectionRanges(nextRanges)
}

const createBlockContainerWidget = (block: EditorContainerBlock): WidgetType => {
  if (block.kind === "callout") {
    return new MarkdownCalloutBlockWidget(
      block.tone,
      block.icon,
      block.title,
      block.body,
      block.from,
      block.to,
      block.bodyOffset,
      Boolean(block.foldable),
      Boolean(block.defaultCollapsed)
    )
  }
  if (block.kind === "toggle") {
    return new MarkdownToggleBlockWidget(block.title, block.body, block.from, block.to, block.bodyOffset)
  }
  if (block.kind === "embed") {
    return new MarkdownEmbedBlockWidget(
      block.url,
      block.title,
      block.caption,
      block.from,
      block.to,
      block.provider ?? "",
      block.siteName ?? ""
    )
  }
  if (block.kind === "file") {
    return new MarkdownFileBlockWidget(
      block.url,
      block.name,
      block.description,
      block.from,
      block.to,
      block.mimeType ?? "",
      block.sizeBytes
    )
  }
  return new MarkdownBookmarkBlockWidget(
    block.url,
    block.title,
    block.description,
    block.from,
    block.to,
    block.siteName ?? "",
    block.provider ?? ""
  )
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
