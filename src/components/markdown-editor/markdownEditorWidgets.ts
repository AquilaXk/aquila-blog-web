import { EditorView, WidgetType } from "@codemirror/view"
import { Transaction } from "@codemirror/state"
import "katex/dist/katex.min.css"
import { renderSerializedMermaidSvg } from "../../libs/markdown/mermaidRuntimeConfig"
import { sanitizeRenderableMermaidSource } from "../../libs/markdown/mermaidRuntimeSanitize"
import { normalizeSafeMarkdownImageSrc } from "../../libs/markdown/safeMarkdownUrl"
import { appendInlineMarkdownNodes, renderKatexIntoElement } from "./markdownEditorInlineDom"

export type MermaidColorScheme = "dark" | "light"

export { appendInlineMarkdownNodes, isSafeInlineHref } from "./markdownEditorInlineDom"

export class MarkdownMarkerWidget extends WidgetType {
  constructor(private readonly label: string, private readonly className: string) {
    super()
  }
  eq(other: MarkdownMarkerWidget) {
    return other.label === this.label && other.className === this.className
  }
  toDOM() {
    const marker = document.createElement("span")
    marker.className = this.className
    marker.setAttribute("aria-hidden", "true")
    marker.textContent = this.label
    return marker
  }
}

export class MarkdownRuleWidget extends WidgetType {
  eq() { return true }
  toDOM() {
    const rule = document.createElement("span")
    rule.setAttribute("role", "separator")
    rule.className = "cm-live-horizontal-rule"
    return rule
  }
}

export class MarkdownTaskWidget extends WidgetType {
  constructor(private readonly checked: boolean, private readonly from: number, private readonly to: number) {
    super()
  }

  eq(other: MarkdownTaskWidget) {
    return other instanceof MarkdownTaskWidget && other.checked === this.checked
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("span")
    checkbox.className = `cm-live-task-checkbox ${this.checked ? "is-checked" : ""}`
    checkbox.tabIndex = 0
    checkbox.setAttribute("tabindex", "0")
    checkbox.setAttribute("role", "checkbox")
    checkbox.setAttribute("aria-checked", this.checked ? "true" : "false")
    checkbox.setAttribute("aria-label", "Toggle task item")
    if (checkbox.dataset) {
      checkbox.dataset.from = String(this.from)
      checkbox.dataset.to = String(this.to)
    }
    checkbox.textContent = this.checked ? "✓" : ""

    const toggleTask = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      if (!view.state.facet(EditorView.editable)) return
      let targetFrom = this.from
      let targetTo = this.to
      try {
        const pos = view.posAtDOM(checkbox)
        if (typeof pos === "number") {
          const line = view.state.doc.lineAt(pos)
          const match = /^(\s*[-*+]\s+)(\[[ xX]\])/.exec(line.text)
          if (match) {
            targetFrom = line.from + match[1].length
            targetTo = targetFrom + match[2].length
          }
        }
      } catch {}
      const current = view.state.doc.sliceString(targetFrom, targetTo)
      const next = this.checked ? "[ ]" : "[x]"
      if (/\[[ xX]\]/.test(current)) {
        view.dispatch({
          changes: { from: targetFrom, to: targetTo, insert: next },
          annotations: [Transaction.userEvent.of("input")],
        })
      }
    }

    checkbox.addEventListener("mousedown", toggleTask)
    checkbox.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        toggleTask(e)
      }
    })

    return checkbox
  }
}

export class MarkdownMathWidget extends WidgetType {
  constructor(private readonly math: string, private readonly displayMode: boolean) {
    super()
  }

  eq(other: MarkdownMathWidget) {
    return other.math === this.math && other.displayMode === this.displayMode
  }

  toDOM(_view: EditorView) {
    const span = document.createElement("span")
    span.className = `cm-live-math ${this.displayMode ? "cm-live-math-display" : "cm-live-math-inline"}`
    const fallback = this.displayMode ? `$$ ${this.math} $$` : `$${this.math}$`
    renderKatexIntoElement(span, this.math, this.displayMode, fallback)
    return span
  }
}

export class MarkdownImageWidget extends WidgetType {
  constructor(private readonly src: string, private readonly alt: string) {
    super()
  }

  eq(other: MarkdownImageWidget) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM() {
    const wrap = document.createElement("span")
    wrap.className = "cm-live-image-wrap"
    const img = document.createElement("img")
    img.className = "cm-live-image"
    const safeSrc = normalizeSafeMarkdownImageSrc(this.src)
    if (safeSrc) img.src = safeSrc
    img.alt = this.alt
    img.loading = "lazy"
    wrap.appendChild(img)
    return wrap
  }
}

const moveCursorToWidgetOrigin = (
  view: EditorView,
  el: HTMLElement,
  fallbackFrom: number | undefined,
  offset = 0
) => {
  if (!view.state.facet(EditorView.editable)) return
  let resolvedFrom = fallbackFrom
  try {
    const domPos = view.posAtDOM(el)
    if (typeof domPos === "number") resolvedFrom = domPos
  } catch {}
  if (resolvedFrom !== undefined) {
    view.focus()
    view.dispatch({
      selection: { anchor: Math.min(view.state.doc.length, resolvedFrom + offset) },
      scrollIntoView: true,
    })
  }
}

export const resolveLiveCalloutTone = (rawType: string): { kind: string; icon: string } => {
  const token = rawType.toLowerCase()
  if (["tip", "hint", "success", "check", "done"].includes(token)) return { kind: "tip", icon: "💡" }
  if (["warning", "caution", "attention", "failure", "fail", "missing", "danger", "error", "bug"].includes(token)) {
    return { kind: "warning", icon: "⚠️" }
  }
  if (["summary", "abstract", "tldr", "important"].includes(token)) return { kind: "summary", icon: "📌" }
  if (token === "example") return { kind: "example", icon: "✨" }
  if (["outline", "quote", "cite"].includes(token)) return { kind: "outline", icon: "💬" }
  return { kind: "info", icon: "ℹ️" }
}

const attachCollapsibleCalloutBody = (
  root: HTMLElement,
  header: HTMLElement,
  foldIcon: HTMLElement,
  strippedContent: string,
  initialCollapsed: boolean,
  from: number,
  view?: EditorView
): void => {
  let isCollapsed = initialCollapsed
  const body = document.createElement("div")
  body.className = "cm-live-callout-body"
  appendInlineMarkdownNodes(body, strippedContent)
  root.appendChild(body)

  header.tabIndex = 0
  header.setAttribute("tabindex", "0")
  header.setAttribute("role", "button")
  header.setAttribute("aria-expanded", isCollapsed ? "false" : "true")

  const toggleCallout = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    isCollapsed = root.classList.toggle("is-collapsed")
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
    foldIcon.textContent = isCollapsed ? "▶" : "▼"
  }

  header.addEventListener("mousedown", toggleCallout)
  header.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      toggleCallout(e)
    }
  })

  if (!view) return
  body.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement | null
    if (target?.closest("a")) return
    e.preventDefault()
    e.stopPropagation()
    moveCursorToWidgetOrigin(view, root, from)
  })
}

const attachEmptyCalloutHeader = (
  root: HTMLElement,
  header: HTMLElement,
  originPos: number,
  view?: EditorView
): void => {
  if (!view) return
  header.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    moveCursorToWidgetOrigin(view, root, originPos)
  })
}

export class MarkdownCalloutWidget extends WidgetType {
  constructor(
    readonly calloutType: string,
    readonly title: string,
    readonly content: string,
    readonly from: number = 0,
    readonly to: number = 0,
    readonly foldState: "+" | "-" | null = null
  ) {
    super()
  }

  eq(other: MarkdownCalloutWidget) {
    return (
      other.calloutType === this.calloutType &&
      other.title === this.title &&
      other.content === this.content &&
      other.foldState === this.foldState
    )
  }

  toDOM(view?: EditorView) {
    const rawKind = this.calloutType.toLowerCase()
    const tone = resolveLiveCalloutTone(rawKind)
    const isCollapsed = this.foldState === "-"
    const root = document.createElement("div")
    root.className = `cm-live-callout cm-live-callout-${rawKind} cm-live-callout-tone-${tone.kind}${
      isCollapsed ? " is-collapsed" : ""
    }`
    if (root.dataset) {
      root.dataset.callout = tone.kind
      if (this.foldState) root.dataset.foldState = this.foldState
    }

    const header = document.createElement("div")
    header.className = "cm-live-callout-header"

    const badge = document.createElement("span")
    badge.className = "cm-live-callout-icon"
    badge.setAttribute("aria-hidden", "true")
    badge.textContent = tone.icon

    const foldIcon = document.createElement("span")
    foldIcon.className = "cm-live-callout-fold"
    foldIcon.textContent = isCollapsed ? "▶" : "▼"

    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-callout-title"
    appendInlineMarkdownNodes(titleSpan, this.title || this.calloutType.toUpperCase())

    header.appendChild(badge)
    header.appendChild(titleSpan)
    header.appendChild(foldIcon)
    root.appendChild(header)

    const strippedContent = this.content.replace(/^[ \t]*>[ \t]?/gm, "").trim()
    if (strippedContent) {
      attachCollapsibleCalloutBody(root, header, foldIcon, strippedContent, isCollapsed, this.from, view)
    } else {
      attachEmptyCalloutHeader(root, header, this.to || this.from, view)
    }

    return root
  }
}

export { MarkdownTableWidget } from "./markdownEditorTableWidget"

export class MarkdownWikilinkWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alias?: string,
    private readonly from?: number,
    private readonly to?: number
  ) {
    super()
  }

  eq(other: MarkdownWikilinkWidget) {
    return other instanceof MarkdownWikilinkWidget && other.target === this.target && other.alias === this.alias
  }

  toDOM(view: EditorView) {
    const root = document.createElement("span")
    root.className = "cm-live-wikilink"
    root.setAttribute("role", "link")
    root.setAttribute("tabindex", "0")
    root.setAttribute("aria-label", `Wikilink: ${this.alias || this.target}`)
    root.dataset.target = this.target
    if (this.alias) root.dataset.alias = this.alias
    if (this.from !== undefined) root.dataset.from = String(this.from)

    const icon = document.createElement("span")
    icon.className = "cm-live-wikilink-icon"
    icon.setAttribute("aria-hidden", "true")
    icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`

    const text = document.createElement("span")
    text.className = "cm-live-wikilink-text"
    text.textContent = this.alias || this.target

    root.appendChild(icon)
    root.appendChild(text)

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      moveCursorToWidgetOrigin(view, root, this.from, 2)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        moveCursorToWidgetOrigin(view, root, this.from, 2)
      }
    }

    root.addEventListener("mousedown", handleClick)
    root.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation() })
    root.addEventListener("keydown", handleKeyDown)

    return root
  }
}

let mermaidRenderCounter = 0
const LIVE_MERMAID_SVG_CACHE_LIMIT = 64
const liveMermaidSvgCache = new Map<string, string>()

const resolveLiveMermaidScheme = (): MermaidColorScheme => {
  if (typeof document === "undefined") return "light"
  const dataset = document.documentElement?.dataset
  return dataset?.theme === "dark" || dataset?.aquilaScheme === "dark" ? "dark" : "light"
}

const cacheLiveMermaidSvg = (source: string, svg: string) => {
  if (liveMermaidSvgCache.has(source)) liveMermaidSvgCache.delete(source)
  liveMermaidSvgCache.set(source, svg)
  if (liveMermaidSvgCache.size > LIVE_MERMAID_SVG_CACHE_LIMIT) {
    const oldest = liveMermaidSvgCache.keys().next().value
    if (oldest !== undefined) liveMermaidSvgCache.delete(oldest)
  }
}

const renderMermaidFallbackCode = (container: HTMLElement, text: string) => {
  const pre = document.createElement("pre")
  pre.className = "cm-live-mermaid-fallback"
  const code = document.createElement("code")
  code.textContent = text
  pre.appendChild(code)
  container.appendChild(pre)
}

const renderMermaidErrorFallback = (container: HTMLElement, text: string) => {
  container.innerHTML = ""
  container.dataset.mermaidState = "error"
  const banner = document.createElement("div")
  banner.className = "cm-live-mermaid-error"
  banner.textContent = "Mermaid 다이어그램 문법 오류"
  container.appendChild(banner)
  renderMermaidFallbackCode(container, text)
}

export type MarkdownMermaidWidgetOptions = {
  scheme?: MermaidColorScheme
  runtimeLoader?: () => Promise<unknown>
  timeoutMs?: number
}

export class MarkdownMermaidWidget extends WidgetType {
  private readonly scheme: MermaidColorScheme

  constructor(
    private readonly source: string,
    private readonly from?: number,
    private readonly customRenderer?: (id: string, text: string) => Promise<{ svg: string }>,
    private readonly options?: MarkdownMermaidWidgetOptions
  ) {
    super()
    this.scheme = options?.scheme ?? resolveLiveMermaidScheme()
  }

  eq(other: MarkdownMermaidWidget) {
    return (
      other instanceof MarkdownMermaidWidget &&
      other.source === this.source &&
      other.scheme === this.scheme &&
      other.customRenderer === this.customRenderer &&
      other.options?.runtimeLoader === this.options?.runtimeLoader &&
      other.options?.timeoutMs === this.options?.timeoutMs
    )
  }

  private runMermaidRender(renderId: string, normalized: string): Promise<{ svg: string }> {
    if (this.customRenderer) {
      return this.customRenderer(renderId, normalized)
    }
    return renderSerializedMermaidSvg({
      scheme: this.scheme,
      renderId,
      source: normalized,
      runtimeLoader: this.options?.runtimeLoader,
      timeoutMs: this.options?.timeoutMs,
    })
  }

  private usesSharedSvgCache(): boolean {
    return !this.customRenderer
  }

  toDOM(view?: EditorView) {
    const root = document.createElement("div")
    root.className = "cm-live-mermaid"
    if (this.from !== undefined) root.dataset.from = String(this.from)

    if (view) {
      root.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        moveCursorToWidgetOrigin(view, root, this.from)
      })
    }

    const normalized = sanitizeRenderableMermaidSource(this.source.trim())
    if (!normalized) {
      root.dataset.mermaidState = "empty"
      renderMermaidFallbackCode(root, this.source)
      return root
    }

    const cacheKey = `${this.scheme}:${normalized}`
    const cachedSvg = this.usesSharedSvgCache() ? liveMermaidSvgCache.get(cacheKey) : undefined
    if (cachedSvg) {
      root.dataset.mermaidState = "rendered"
      root.innerHTML = cachedSvg
      return root
    }

    root.dataset.mermaidState = "loading"
    renderMermaidFallbackCode(root, normalized)

    const renderId = `cm-live-mermaid-${(mermaidRenderCounter += 1)}`
    void this.runMermaidRender(renderId, normalized)
      .then((res) => {
        if (!res?.svg) {
          renderMermaidErrorFallback(root, normalized)
          return
        }
        if (this.usesSharedSvgCache()) cacheLiveMermaidSvg(cacheKey, res.svg)
        root.dataset.mermaidState = "rendered"
        root.innerHTML = res.svg
      })
      .catch(() => renderMermaidErrorFallback(root, normalized))

    return root
  }
}
