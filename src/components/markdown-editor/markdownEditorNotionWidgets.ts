import { EditorState, StateField, type Range } from "@codemirror/state"
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view"
import { hasIntervalOverlap, isTokenActive } from "./markdownEditorLivePreview"
import {
  editorModeField,
  getDocString,
  setEditorMode,
} from "./markdownEditorLiveSurfaceDecorations"
import { appendInlineMarkdownNodes } from "./markdownEditorWidgets"

const FENCE_DELIMITER_LINE_RE =
  /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const CALLOUT_OPEN_LINE_RE = /^:::callout(?:[ \t]+(.*))?$/
const TOGGLE_OPEN_LINE_RE = /^:::toggle(?:[ \t]+(.*))?$/
const BOOKMARK_OPEN_LINE_RE = /^:::bookmark(?:[ \t]+(\S+)(?:[ \t]+(.*))?)?$/
const CONTAINER_CLOSE_LINE_RE = /^:::[ \t]*$/
const HTTP_URL_PREFIX_RE = /^https?:\/\//i
const LEADING_EMOJI_RE =
  /^\[?(ℹ️|⚠️|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F)?)\]?(?:[ \t]+|$)/u

export type NotionCalloutTone = "info" | "tip" | "warning" | "danger" | "purple" | "default"

export type NotionCalloutContainerBlock = {
  kind: "callout"; from: number; to: number; tone: NotionCalloutTone; icon: string; title: string; body: string; bodyOffset: number
}
export type NotionToggleContainerBlock = {
  kind: "toggle"; from: number; to: number; title: string; body: string; bodyOffset: number
}
export type NotionBookmarkContainerBlock = {
  kind: "bookmark"; from: number; to: number; url: string; title: string; description: string
}
export type NotionContainerBlock = NotionCalloutContainerBlock | NotionToggleContainerBlock | NotionBookmarkContainerBlock

type OpenContainerCandidate =
  | { kind: "callout"; from: number; bodyOffset: number; rawHeader: string; bodyLines: string[] }
  | { kind: "toggle"; from: number; bodyOffset: number; rawTitle: string; bodyLines: string[] }
  | { kind: "bookmark"; from: number; url: string; inlineTitle: string; bodyLines: string[] }

const CALLOUT_TONE_KEYWORD_MAP: Record<string, { tone: NotionCalloutTone; icon: string }> = {
  info: { tone: "info", icon: "ℹ️" },
  note: { tone: "info", icon: "ℹ️" },
  tip: { tone: "tip", icon: "💡" },
  hint: { tone: "tip", icon: "💡" },
  success: { tone: "tip", icon: "✅" },
  check: { tone: "tip", icon: "✅" },
  warning: { tone: "warning", icon: "⚠️" },
  caution: { tone: "warning", icon: "⚠️" },
  danger: { tone: "danger", icon: "🚨" },
  error: { tone: "danger", icon: "🚨" },
  purple: { tone: "purple", icon: "📌" },
  summary: { tone: "purple", icon: "📌" },
  important: { tone: "purple", icon: "📌" },
  default: { tone: "default", icon: "💡" },
  outline: { tone: "default", icon: "📋" },
}

const CALLOUT_EMOJI_TONE_MAP: Record<string, NotionCalloutTone> = {
  "💡": "tip",
  "✨": "tip",
  "✅": "tip",
  "ℹ️": "info",
  "ℹ": "info",
  "⚠️": "warning",
  "⚠": "warning",
  "🚨": "danger",
  "❗": "danger",
  "⛔": "danger",
  "📌": "purple",
  "📚": "purple",
  "🧾": "purple",
}

const normalizeEmojiIcon = (raw: string): string => {
  if (raw === "ℹ") return "ℹ️"
  return raw === "⚠" ? "⚠️" : raw
}

const parseCalloutContainerPayload = (
  rawHeader: string,
  bodyLines: readonly string[]
): { tone: NotionCalloutTone; icon: string; title: string; body: string } => {
  let rest = rawHeader.trim()
  let tone: NotionCalloutTone = "info"
  let icon = "💡"
  let hasExplicitTone = false

  if (rest.length > 0) {
    const firstSpace = rest.search(/[ \t]/)
    const firstToken = (firstSpace === -1 ? rest : rest.slice(0, firstSpace)).toLowerCase()
    const mappedKeyword = Object.hasOwn(CALLOUT_TONE_KEYWORD_MAP, firstToken)
      ? CALLOUT_TONE_KEYWORD_MAP[firstToken]
      : undefined
    if (mappedKeyword) {
      tone = mappedKeyword.tone
      icon = mappedKeyword.icon
      hasExplicitTone = true
      rest = firstSpace === -1 ? "" : rest.slice(firstSpace).trim()
    }
  }

  const headerEmojiMatch = LEADING_EMOJI_RE.exec(rest)
  if (headerEmojiMatch) {
    const rawEmoji = headerEmojiMatch[1]!
    icon = normalizeEmojiIcon(rawEmoji)
    if (!hasExplicitTone) {
      tone = CALLOUT_EMOJI_TONE_MAP[icon] ?? CALLOUT_EMOJI_TONE_MAP[rawEmoji] ?? "info"
    }
    rest = rest.slice(headerEmojiMatch[0].length).trim()
  }

  let remainingBodyLines = [...bodyLines]
  if (rest.length === 0 && remainingBodyLines.length > 0) {
    const firstLine = (remainingBodyLines[0] ?? "").trim()
    const bodyEmojiMatch = LEADING_EMOJI_RE.exec(firstLine)
    if (bodyEmojiMatch) {
      const rawEmoji = bodyEmojiMatch[1]!
      icon = normalizeEmojiIcon(rawEmoji)
      if (!hasExplicitTone) {
        tone = CALLOUT_EMOJI_TONE_MAP[icon] ?? CALLOUT_EMOJI_TONE_MAP[rawEmoji] ?? "info"
      }
      rest = firstLine.slice(bodyEmojiMatch[0].length).trim()
      remainingBodyLines = remainingBodyLines.slice(1)
    } else if (firstLine.length > 0) {
      rest = firstLine
      remainingBodyLines = remainingBodyLines.slice(1)
    }
  }

  return {
    tone,
    icon,
    title: rest || "콜아웃",
    body: remainingBodyLines.join("\n").trim(),
  }
}

export const parseNotionContainerBlocks = (docText: string): NotionContainerBlock[] => {
  if (!docText.includes(":::")) return []

  const blocks: NotionContainerBlock[] = []
  let pos = 0
  let inFence = false
  let openFenceMarker = ""
  let openFenceLength = 0
  let candidate: OpenContainerCandidate | null = null

  while (pos <= docText.length) {
    const nextBreak = docText.indexOf("\n", pos)
    const lineStart = pos
    const lineEnd = nextBreak === -1 ? docText.length : nextBreak
    const rawLine = docText.slice(lineStart, lineEnd)
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    const offset = nextBreak === -1 ? lineEnd : lineEnd + 1
    pos = nextBreak === -1 ? docText.length + 1 : lineEnd + 1

    const fenceMatch = FENCE_DELIMITER_LINE_RE.exec(lineText)
    if (fenceMatch) {
      const marker = fenceMatch[2]?.[0] ?? ""
      const length = fenceMatch[2]?.length ?? 0
      const info = fenceMatch[3] ?? ""
      if (!inFence) {
        inFence = true
        openFenceMarker = marker
        openFenceLength = length
      } else if (marker === openFenceMarker && length >= openFenceLength && info.trim() === "") {
        inFence = false
        openFenceMarker = ""
        openFenceLength = 0
      }
      if (candidate) candidate.bodyLines.push(lineText)
      continue
    }

    if (inFence) {
      if (candidate) candidate.bodyLines.push(lineText)
      continue
    }

    if (candidate && CONTAINER_CLOSE_LINE_RE.test(lineText)) {
      if (candidate.kind === "callout") {
        const parsed = parseCalloutContainerPayload(candidate.rawHeader, candidate.bodyLines)
        blocks.push({
          kind: "callout",
          from: candidate.from,
          to: lineEnd,
          tone: parsed.tone,
          icon: parsed.icon,
          title: parsed.title,
          body: parsed.body,
          bodyOffset: candidate.bodyOffset,
        })
      } else if (candidate.kind === "toggle") {
        blocks.push({
          kind: "toggle",
          from: candidate.from,
          to: lineEnd,
          title: candidate.rawTitle.trim() || "토글 블록",
          body: candidate.bodyLines.join("\n").trim(),
          bodyOffset: candidate.bodyOffset,
        })
      } else {
        const nonEmptyLines: string[] = []
        for (const raw of candidate.bodyLines) {
          const trimmed = raw.trim()
          if (trimmed) nonEmptyLines.push(trimmed)
        }
        const hasInlineTitle = candidate.inlineTitle.length > 0
        blocks.push({
          kind: "bookmark",
          from: candidate.from,
          to: lineEnd,
          url: candidate.url,
          title: hasInlineTitle ? candidate.inlineTitle : (nonEmptyLines[0] ?? candidate.url),
          description: hasInlineTitle ? nonEmptyLines.join("\n") : nonEmptyLines.slice(1).join("\n"),
        })
      }
      candidate = null
      continue
    }

    const calloutMatch = CALLOUT_OPEN_LINE_RE.exec(lineText)
    if (calloutMatch) {
      candidate = {
        kind: "callout",
        from: lineStart,
        bodyOffset: Math.max(0, offset - lineStart),
        rawHeader: (calloutMatch[1] ?? "").trim(),
        bodyLines: [],
      }
      continue
    }

    const toggleMatch = TOGGLE_OPEN_LINE_RE.exec(lineText)
    if (toggleMatch) {
      candidate = {
        kind: "toggle",
        from: lineStart,
        bodyOffset: Math.max(0, offset - lineStart),
        rawTitle: (toggleMatch[1] ?? "").trim(),
        bodyLines: [],
      }
      continue
    }

    const bookmarkMatch = BOOKMARK_OPEN_LINE_RE.exec(lineText)
    if (bookmarkMatch) {
      const url = (bookmarkMatch[1] ?? "").trim()
      candidate = HTTP_URL_PREFIX_RE.test(url)
        ? {
            kind: "bookmark",
            from: lineStart,
            url,
            inlineTitle: (bookmarkMatch[2] ?? "").trim(),
            bodyLines: [],
          }
        : null
      continue
    }

    if (candidate) candidate.bodyLines.push(lineText)
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

export class MarkdownNotionCalloutBlockWidget extends WidgetType {
  constructor(
    readonly tone: NotionCalloutTone, readonly icon: string, readonly title: string, readonly body: string,
    readonly from: number, readonly to: number, readonly bodyOffset = 11 + title.length + 1
  ) {
    super()
  }

  eq(other: MarkdownNotionCalloutBlockWidget) {
    return (
      other instanceof MarkdownNotionCalloutBlockWidget &&
      other.tone === this.tone && other.icon === this.icon && other.title === this.title &&
      other.body === this.body && other.from === this.from && other.to === this.to && other.bodyOffset === this.bodyOffset
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
    root.setAttribute("data-testid", "cm-live-callout-widget")
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
    readonly title: string, readonly body: string, readonly from: number, readonly to: number,
    readonly bodyOffset = 10 + title.length + 1
  ) {
    super()
  }

  eq(other: MarkdownToggleBlockWidget) {
    return (
      other instanceof MarkdownToggleBlockWidget &&
      other.title === this.title && other.body === this.body &&
      other.from === this.from && other.to === this.to && other.bodyOffset === this.bodyOffset
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
    root.setAttribute("data-testid", "cm-live-toggle-widget")
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

export class MarkdownBookmarkBlockWidget extends WidgetType {
  constructor(
    readonly url: string, readonly title: string, readonly description: string,
    readonly from: number, readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownBookmarkBlockWidget) {
    return (
      other instanceof MarkdownBookmarkBlockWidget &&
      other.url === this.url && other.title === this.title &&
      other.description === this.description && other.from === this.from && other.to === this.to
    )
  }

  updateDOM(dom: HTMLElement) {
    if (dom.dataset?.sig !== `${this.url}\0${this.title}\0${this.description}`) return false
    dom.dataset.from = String(this.from)
    return true
  }

  toDOM(view?: EditorView) {
    const root = document.createElement("div")
    root.className = "cm-live-bookmark-card"
    root.setAttribute("data-testid", "cm-live-bookmark-widget")
    root.dataset.from = String(this.from)
    root.dataset.sig = `${this.url}\0${this.title}\0${this.description}`

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
    const openLink = document.createElement("a")
    openLink.className = "cm-live-bookmark-open"
    openLink.href = this.url
    openLink.target = "_blank"
    openLink.rel = "noopener noreferrer"
    openLink.setAttribute("aria-label", "북마크 링크 열기")
    openLink.textContent = "↗"
    root.append(icon, content, openLink)
    bindContainerActivateTarget(root, view, root, this.from, this.to, 12, true)
    return root
  }
}

let cachedContainerBlocksEntry: { doc: EditorState["doc"]; blocks: readonly NotionContainerBlock[] } | null = null

const getCachedNotionContainerBlocks = (doc: EditorState["doc"]): readonly NotionContainerBlock[] => {
  if (cachedContainerBlocksEntry && cachedContainerBlocksEntry.doc === doc) return cachedContainerBlocksEntry.blocks
  const blocks = parseNotionContainerBlocks(getDocString(doc))
  cachedContainerBlocksEntry = { doc, blocks }
  return blocks
}

const isContainerBlockActive = (block: NotionContainerBlock, selections: readonly { from: number; to: number }[]) =>
  isTokenActive(block.from, block.to, selections) || hasIntervalOverlap(selections, block.from, block.to)

const haveSameActiveContainerBlocks = (
  blocks: readonly NotionContainerBlock[],
  prevRanges: readonly { from: number; to: number }[],
  nextRanges: readonly { from: number; to: number }[]
): boolean => {
  if (blocks.length === 0) return true
  for (const block of blocks) {
    if (isContainerBlockActive(block, prevRanges) !== isContainerBlockActive(block, nextRanges)) return false
  }
  return true
}

const createNotionContainerBlockWidget = (block: NotionContainerBlock): WidgetType => {
  if (block.kind === "callout") {
    return new MarkdownNotionCalloutBlockWidget(block.tone, block.icon, block.title, block.body, block.from, block.to, block.bodyOffset)
  }
  if (block.kind === "toggle") {
    return new MarkdownToggleBlockWidget(block.title, block.body, block.from, block.to, block.bodyOffset)
  }
  return new MarkdownBookmarkBlockWidget(block.url, block.title, block.description, block.from, block.to)
}

const buildNotionContainerBlockDecorations = (state: EditorState): DecorationSet => {
  const mode = state.field(editorModeField, false) ?? "live"
  if (mode === "source" || state.doc.length === 0) return Decoration.none

  const blocks = getCachedNotionContainerBlocks(state.doc)
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

    const widget = createNotionContainerBlockWidget(block)
    decorations.push(Decoration.replace({ widget, block: true }).range(block.from, block.to))
  }

  return decorations.length > 0 ? Decoration.set(decorations, true) : Decoration.none
}

export const notionContainerBlockField = StateField.define<DecorationSet>({
  create: buildNotionContainerBlockDecorations,
  update: (decorations, transaction) => {
    const hasModeEffect = transaction.effects.some((effect) => effect.is(setEditorMode))
    if (!transaction.docChanged && !hasModeEffect) {
      if (!transaction.selection) return decorations
      const blocks = getCachedNotionContainerBlocks(transaction.state.doc)
      if (haveSameActiveContainerBlocks(blocks, transaction.startState.selection.ranges, transaction.state.selection.ranges)) {
        return decorations
      }
    }
    return buildNotionContainerBlockDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

