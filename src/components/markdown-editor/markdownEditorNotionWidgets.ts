import { EditorState, StateField, type Range } from "@codemirror/state"
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view"
import { hasIntervalOverlap, isTokenActive } from "./markdownEditorLivePreview"
import {
  compositionField,
  editorModeField,
  getDocString,
  pointerSelectingField,
  setComposition,
  setEditorMode,
  setPointerSelecting,
} from "./markdownEditorLiveSurfaceDecorations"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

const FENCE_DELIMITER_LINE_RE =
  /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const TOGGLE_OPEN_LINE_RE = /^:::toggle(?:[ \t]+(.*))?$/
const BOOKMARK_OPEN_LINE_RE = /^:::bookmark(?:[ \t]+(\S+)(?:[ \t]+(.*))?)?$/
const CONTAINER_CLOSE_LINE_RE = /^:::[ \t]*$/
const HTTP_URL_PREFIX_RE = /^https?:\/\//i

export type NotionToggleContainerBlock = {
  kind: "toggle"
  from: number
  to: number
  title: string
  body: string
}

export type NotionBookmarkContainerBlock = {
  kind: "bookmark"
  from: number
  to: number
  url: string
  title: string
  description: string
}

export type NotionContainerBlock =
  | NotionToggleContainerBlock
  | NotionBookmarkContainerBlock

type OpenContainerCandidate =
  | {
      kind: "toggle"
      from: number
      rawTitle: string
      bodyLines: string[]
    }
  | {
      kind: "bookmark"
      from: number
      url: string
      inlineTitle: string
      bodyLines: string[]
    }

export const parseNotionContainerBlocks = (docText: string): NotionContainerBlock[] => {
  if (!docText.includes(":::")) return []

  const rawLines = docText.split("\n")
  const blocks: NotionContainerBlock[] = []
  let offset = 0
  let inFence = false
  let openFenceMarker = ""
  let openFenceLength = 0
  let candidate: OpenContainerCandidate | null = null

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index] ?? ""
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    const lineStart = offset
    const lineEnd = offset + rawLine.length
    offset = lineEnd + (index < rawLines.length - 1 ? 1 : 0)

    const fenceMatch = FENCE_DELIMITER_LINE_RE.exec(lineText)
    if (fenceMatch) {
      const marker = fenceMatch[2]?.[0] ?? ""
      const length = fenceMatch[2]?.length ?? 0
      const info = fenceMatch[3] ?? ""
      if (!inFence) {
        inFence = true
        openFenceMarker = marker
        openFenceLength = length
      } else if (
        marker === openFenceMarker &&
        length >= openFenceLength &&
        info.trim() === ""
      ) {
        inFence = false
        openFenceMarker = ""
        openFenceLength = 0
      }
      if (candidate) {
        candidate.bodyLines.push(lineText)
      }
      continue
    }

    if (inFence) {
      if (candidate) {
        candidate.bodyLines.push(lineText)
      }
      continue
    }

    if (candidate && CONTAINER_CLOSE_LINE_RE.test(lineText)) {
      if (candidate.kind === "toggle") {
        const title = candidate.rawTitle.trim() || "토글 블록"
        const body = candidate.bodyLines.join("\n").trim()
        blocks.push({
          kind: "toggle",
          from: candidate.from,
          to: lineEnd,
          title,
          body,
        })
      } else {
        const nonEmptyLines = candidate.bodyLines
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
        const hasInlineTitle = candidate.inlineTitle.length > 0
        const title = hasInlineTitle
          ? candidate.inlineTitle
          : (nonEmptyLines[0] ?? candidate.url)
        const description = hasInlineTitle
          ? nonEmptyLines.join("\n")
          : nonEmptyLines.slice(1).join("\n")
        blocks.push({
          kind: "bookmark",
          from: candidate.from,
          to: lineEnd,
          url: candidate.url,
          title,
          description,
        })
      }
      candidate = null
      continue
    }

    const toggleMatch = TOGGLE_OPEN_LINE_RE.exec(lineText)
    if (toggleMatch) {
      candidate = {
        kind: "toggle",
        from: lineStart,
        rawTitle: (toggleMatch[1] ?? "").trim(),
        bodyLines: [],
      }
      continue
    }

    const bookmarkMatch = BOOKMARK_OPEN_LINE_RE.exec(lineText)
    if (bookmarkMatch) {
      const url = (bookmarkMatch[1] ?? "").trim()
      if (HTTP_URL_PREFIX_RE.test(url)) {
        candidate = {
          kind: "bookmark",
          from: lineStart,
          url,
          inlineTitle: (bookmarkMatch[2] ?? "").trim(),
          bodyLines: [],
        }
      } else {
        candidate = null
      }
      continue
    }

    if (candidate) {
      candidate.bodyLines.push(lineText)
    }
  }

  return blocks
}

const focusContainerBlockOrigin = (
  view: EditorView | undefined,
  root: HTMLElement,
  fallbackFrom: number,
  fallbackTo: number,
  innerOffset: number
) => {
  if (!view) return
  let resolvedFrom = fallbackFrom
  try {
    const domPos = view.posAtDOM(root)
    if (typeof domPos === "number") resolvedFrom = domPos
  } catch {}
  const resolvedTo = resolvedFrom + Math.max(0, fallbackTo - fallbackFrom)
  const targetAnchor = Math.min(
    view.state.doc.length,
    Math.min(resolvedTo, resolvedFrom + innerOffset)
  )
  view.focus()
  view.dispatch({
    selection: { anchor: targetAnchor },
    scrollIntoView: true,
  })
}

export class MarkdownToggleBlockWidget extends WidgetType {
  constructor(
    readonly title: string,
    readonly body: string,
    readonly from: number,
    readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownToggleBlockWidget) {
    return (
      other instanceof MarkdownToggleBlockWidget &&
      other.title === this.title &&
      other.body === this.body &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  toDOM(view?: EditorView) {
    let isCollapsed = false
    const root = document.createElement("div")
    root.className = "cm-live-toggle-block"
    root.setAttribute("data-testid", "cm-live-toggle-widget")
    root.dataset.from = String(this.from)

    const header = document.createElement("div")
    header.className = "cm-live-toggle-header"

    const caret = document.createElement("span")
    caret.className = "cm-live-toggle-caret"
    caret.setAttribute("role", "button")
    caret.setAttribute("aria-label", "토글 접기/펼치기")
    caret.textContent = "▼"

    const toggleCollapse = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      isCollapsed = root.classList.toggle("is-collapsed")
      caret.textContent = isCollapsed ? "▶" : "▼"
    }
    caret.addEventListener("mousedown", (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    caret.addEventListener("click", toggleCollapse)

    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-toggle-title"
    appendInlineMarkdownNodes(titleSpan, this.title || "토글 블록")

    const activateEditAtTitle = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("a")) return
      event.preventDefault()
      event.stopPropagation()
      focusContainerBlockOrigin(view, root, this.from, this.to, 10)
    }
    titleSpan.addEventListener("mousedown", activateEditAtTitle)
    titleSpan.addEventListener("click", activateEditAtTitle)

    header.appendChild(caret)
    header.appendChild(titleSpan)
    root.appendChild(header)

    const bodyEl = document.createElement("div")
    bodyEl.className = `cm-live-toggle-body${this.body ? "" : " is-empty"}`
    if (this.body) {
      appendInlineMarkdownNodes(bodyEl, this.body)
    } else {
      bodyEl.textContent = "내용을 입력하려면 클릭하세요..."
    }

    const bodyOffset = 10 + this.title.length + 1
    const activateEditAtBody = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("a")) return
      event.preventDefault()
      event.stopPropagation()
      focusContainerBlockOrigin(view, root, this.from, this.to, bodyOffset)
    }
    bodyEl.addEventListener("mousedown", activateEditAtBody)
    bodyEl.addEventListener("click", activateEditAtBody)

    root.appendChild(bodyEl)
    return root
  }
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

  toDOM(view?: EditorView) {
    const root = document.createElement("div")
    root.className = "cm-live-bookmark-card"
    root.setAttribute("data-testid", "cm-live-bookmark-widget")
    root.dataset.from = String(this.from)

    const icon = document.createElement("span")
    icon.className = "cm-live-bookmark-icon"
    icon.setAttribute("aria-hidden", "true")
    icon.textContent = "🔖"

    const content = document.createElement("div")
    content.className = "cm-live-bookmark-content"

    const titleEl = document.createElement("span")
    titleEl.className = "cm-live-bookmark-title"
    titleEl.textContent = this.title || this.url
    content.appendChild(titleEl)

    if (this.description) {
      const descEl = document.createElement("span")
      descEl.className = "cm-live-bookmark-desc"
      descEl.textContent = this.description
      content.appendChild(descEl)
    }

    const urlEl = document.createElement("span")
    urlEl.className = "cm-live-bookmark-url"
    urlEl.textContent = this.url
    content.appendChild(urlEl)

    root.appendChild(icon)
    root.appendChild(content)

    const activateEdit = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      focusContainerBlockOrigin(view, root, this.from, this.to, 12)
    }
    root.addEventListener("mousedown", activateEdit)
    root.addEventListener("click", activateEdit)

    return root
  }
}

let cachedContainerBlocksEntry: {
  doc: EditorState["doc"]
  blocks: readonly NotionContainerBlock[]
} | null = null

const getCachedNotionContainerBlocks = (
  doc: EditorState["doc"]
): readonly NotionContainerBlock[] => {
  if (cachedContainerBlocksEntry && cachedContainerBlocksEntry.doc === doc) {
    return cachedContainerBlocksEntry.blocks
  }
  const blocks = parseNotionContainerBlocks(getDocString(doc))
  cachedContainerBlocksEntry = { doc, blocks }
  return blocks
}

const buildNotionContainerBlockDecorations = (state: EditorState): DecorationSet => {
  const mode = state.field(editorModeField, false) ?? "live"
  if (mode === "source" || state.doc.length === 0) {
    return Decoration.none
  }

  const blocks = getCachedNotionContainerBlocks(state.doc)
  if (blocks.length === 0) {
    return Decoration.none
  }

  const composing = state.field(compositionField, false) ?? false
  const pointerSelecting = state.field(pointerSelectingField, false) ?? false
  const selections = [...state.selection.ranges]
    .map(({ from, to }) => ({ from, to }))
    .sort((a, b) => a.from - b.from || a.to - b.to)

  const decorations: Range<Decoration>[] = []

  for (const block of blocks) {
    if (
      mode === "live" &&
      (composing ||
        pointerSelecting ||
        isTokenActive(block.from, block.to, selections) ||
        hasIntervalOverlap(selections, block.from, block.to))
    ) {
      continue
    }

    const widget =
      block.kind === "toggle"
        ? new MarkdownToggleBlockWidget(block.title, block.body, block.from, block.to)
        : new MarkdownBookmarkBlockWidget(
            block.url,
            block.title,
            block.description,
            block.from,
            block.to
          )

    decorations.push(
      Decoration.replace({ widget, block: true }).range(block.from, block.to)
    )
  }

  return decorations.length > 0 ? Decoration.set(decorations, true) : Decoration.none
}

export const notionContainerBlockField = StateField.define<DecorationSet>({
  create: buildNotionContainerBlockDecorations,
  update: (decorations, transaction) => {
    if (
      transaction.docChanged ||
      transaction.selection ||
      transaction.effects.some(
        (effect) =>
          effect.is(setComposition) ||
          effect.is(setPointerSelecting) ||
          effect.is(setEditorMode)
      )
    ) {
      return buildNotionContainerBlockDecorations(transaction.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})
