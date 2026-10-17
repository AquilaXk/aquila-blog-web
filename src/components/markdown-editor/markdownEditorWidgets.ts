import { WidgetType, type EditorView } from "@codemirror/view"
import { Transaction } from "@codemirror/state"
import "katex/dist/katex.min.css"

let cachedKatex: any = null
let katexLoadPromise: Promise<any> | null = null

const getKatex = (): any => {
  if (cachedKatex) return cachedKatex
  if (!katexLoadPromise && typeof window !== "undefined") {
    katexLoadPromise = import("katex")
      .then((mod) => {
        cachedKatex = mod.default || mod
        return cachedKatex
      })
      .catch(() => null)
  }
  return null
}

export class MarkdownMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
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
  eq() {
    return true
  }

  toDOM() {
    const rule = document.createElement("span")
    rule.setAttribute("role", "separator")
    rule.className = "cm-live-horizontal-rule"
    return rule
  }
}

const INLINE_MARKDOWN_TOKEN_REGEX =
  /`([^`\r\n]+)`|\*\*([^*\r\n]+)\*\*|\*([^*\r\n]+)\*|\[([^\]\r\n]+)\]\(([^)\s\r\n]+)\)/g

const isSafeInlineHref = (href: string): boolean => {
  const trimmed = href.trim()
  return /^(?:\/|#|(?:\.\.?\/)|https?:\/\/|mailto:)/i.test(trimmed)
}

export const appendInlineMarkdownNodes = (container: HTMLElement, text: string): void => {
  if (!text.includes("`") && !text.includes("*") && !text.includes("[")) {
    container.textContent = text
    return
  }
  let lastIndex = 0
  INLINE_MARKDOWN_TOKEN_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_MARKDOWN_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }
    if (match[1] !== undefined) {
      const code = document.createElement("code")
      code.textContent = match[1]
      container.appendChild(code)
    } else if (match[2] !== undefined) {
      const strong = document.createElement("strong")
      strong.textContent = match[2]
      container.appendChild(strong)
    } else if (match[3] !== undefined) {
      const em = document.createElement("em")
      em.textContent = match[3]
      container.appendChild(em)
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const label = match[4]
      const href = match[5]
      if (isSafeInlineHref(href)) {
        const link = document.createElement("a")
        link.href = href.trim()
        link.textContent = label
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        container.appendChild(link)
      } else {
        container.appendChild(document.createTextNode(match[0]))
      }
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)))
  }
}

export class MarkdownTaskWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
    private readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownTaskWidget) {
    return other instanceof MarkdownTaskWidget && other.checked === this.checked
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("span")
    checkbox.className = `cm-live-task-checkbox ${this.checked ? "is-checked" : ""}`
    checkbox.setAttribute("role", "checkbox")
    checkbox.setAttribute("aria-checked", this.checked ? "true" : "false")
    checkbox.setAttribute("aria-label", "Toggle task item")
    checkbox.dataset.from = String(this.from)
    checkbox.dataset.to = String(this.to)
    checkbox.textContent = this.checked ? "✓" : ""

    checkbox.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
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
      } catch {
        // Fall back to stored coordinates
      }
      const current = view.state.doc.sliceString(targetFrom, targetTo)
      const next = this.checked ? "[ ]" : "[x]"
      if (/\[[ xX]\]/.test(current)) {
        view.dispatch({
          changes: { from: targetFrom, to: targetTo, insert: next },
          annotations: [Transaction.userEvent.of("input")],
        })
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
    const katex = getKatex()
    if (katex) {
      try {
        span.innerHTML = katex.renderToString(this.math, { displayMode: this.displayMode, throwOnError: false })
        return span
      } catch {
        // Fallback to text
      }
    } else if (katexLoadPromise) {
      void katexLoadPromise.then(() => {
        try {
          if (cachedKatex) {
            span.innerHTML = cachedKatex.renderToString(this.math, { displayMode: this.displayMode, throwOnError: false })
          }
        } catch {
          // Keep text
        }
      })
    }
    span.textContent = this.displayMode ? `$$ ${this.math} $$` : `$${this.math}$`
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
    img.src = this.src
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
  let resolvedFrom = fallbackFrom
  try {
    const domPos = view.posAtDOM(el)
    if (typeof domPos === "number") resolvedFrom = domPos
  } catch {
    // Fall back to stored coordinate
  }
  if (resolvedFrom !== undefined) {
    view.focus()
    view.dispatch({
      selection: { anchor: Math.min(view.state.doc.length, resolvedFrom + offset) },
      scrollIntoView: true,
    })
  }
}

const resolveLiveCalloutTone = (rawType: string): { kind: string; icon: string } => {
  const token = rawType.toLowerCase()
  if (["tip", "hint", "success", "check", "done"].includes(token)) return { kind: "tip", icon: "T" }
  if (["warning", "caution", "attention", "failure", "fail", "missing", "danger", "error", "bug"].includes(token)) {
    return { kind: "warning", icon: "!" }
  }
  if (["summary", "abstract", "tldr", "important"].includes(token)) return { kind: "summary", icon: "§" }
  if (token === "example") return { kind: "example", icon: "✓" }
  if (["outline", "quote", "cite"].includes(token)) return { kind: "outline", icon: "≡" }
  return { kind: "info", icon: "i" }
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
    let isCollapsed = this.foldState === "-"
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
      const body = document.createElement("div")
      body.className = "cm-live-callout-body"
      appendInlineMarkdownNodes(body, strippedContent)
      root.appendChild(body)

      header.addEventListener("mousedown", (e) => {
        e.preventDefault()
        e.stopPropagation()
        isCollapsed = root.classList.toggle("is-collapsed")
        foldIcon.textContent = isCollapsed ? "▶" : "▼"
      })

      if (view) {
        body.addEventListener("mousedown", (e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest("a")) return
          e.preventDefault()
          e.stopPropagation()
          moveCursorToWidgetOrigin(view, root, this.from)
        })
      }
    }

    return root
  }
}

export class MarkdownTableWidget extends WidgetType {
  constructor(private readonly markdown: string) {
    super()
  }

  eq(other: MarkdownTableWidget) {
    return other.markdown === this.markdown
  }

  toDOM() {
    const wrap = document.createElement("div")
    wrap.className = "cm-live-table-wrap"
    const table = document.createElement("table")
    table.className = "cm-live-table"

    const lines = this.markdown.trim().split("\n").filter((l) => l.trim().length > 0)
    if (lines.length === 0) return wrap

    const parseCells = (line: string): string[] =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/)
        .map((cell) => cell.replaceAll("\\|", "|").trim())

    const headerRow = lines[0]
    if (headerRow) {
      const thead = document.createElement("thead")
      const tr = document.createElement("tr")
      for (const cell of parseCells(headerRow)) {
        const th = document.createElement("th")
        appendInlineMarkdownNodes(th, cell)
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
    }

    const bodyStartIndex = lines[1] && /^[\s|:-]+$/.test(lines[1]) ? 2 : 1
    if (lines.length > bodyStartIndex) {
      const tbody = document.createElement("tbody")
      for (let i = bodyStartIndex; i < lines.length; i += 1) {
        const tr = document.createElement("tr")
        for (const cell of parseCells(lines[i]!)) {
          const td = document.createElement("td")
          appendInlineMarkdownNodes(td, cell)
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
    }

    wrap.appendChild(table)
    return wrap
  }
}

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
    return (
      other instanceof MarkdownWikilinkWidget &&
      other.target === this.target &&
      other.alias === this.alias
    )
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
    root.addEventListener("click", handleClick)
    root.addEventListener("keydown", handleKeyDown)

    return root
  }
}

type LiveMermaidRenderer = {
  initialize?: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let cachedMermaid: LiveMermaidRenderer | null = null
let mermaidLoadPromise: Promise<LiveMermaidRenderer | null> | null = null
let mermaidInitialized = false
let mermaidRenderCounter = 0
const LIVE_MERMAID_SVG_CACHE_LIMIT = 64
const liveMermaidSvgCache = new Map<string, string>()

const loadLiveMermaid = (): Promise<LiveMermaidRenderer | null> => {
  if (cachedMermaid) return Promise.resolve(cachedMermaid)
  if (!mermaidLoadPromise && typeof window !== "undefined") {
    mermaidLoadPromise = import("mermaid")
      .then((mod) => {
        const api = (mod.default || mod) as LiveMermaidRenderer
        if (!mermaidInitialized && typeof api.initialize === "function") {
          api.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
          })
          mermaidInitialized = true
        }
        cachedMermaid = api
        return cachedMermaid
      })
      .catch(() => null)
  }
  return mermaidLoadPromise ?? Promise.resolve(null)
}

const cacheLiveMermaidSvg = (source: string, svg: string) => {
  if (liveMermaidSvgCache.has(source)) liveMermaidSvgCache.delete(source)
  liveMermaidSvgCache.set(source, svg)
  if (liveMermaidSvgCache.size > LIVE_MERMAID_SVG_CACHE_LIMIT) {
    const oldest = liveMermaidSvgCache.keys().next().value
    if (oldest !== undefined) liveMermaidSvgCache.delete(oldest)
  }
}

export class MarkdownMermaidWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly from?: number,
    private readonly customRenderer?: (id: string, text: string) => Promise<{ svg: string }>
  ) {
    super()
  }

  eq(other: MarkdownMermaidWidget) {
    return (
      other instanceof MarkdownMermaidWidget &&
      other.source === this.source &&
      other.customRenderer === this.customRenderer
    )
  }

  toDOM(view?: EditorView) {
    const root = document.createElement("div")
    root.className = "cm-live-mermaid"
    if (this.from !== undefined) root.dataset.from = String(this.from)

    const renderFallbackCode = (container: HTMLElement, text: string) => {
      const pre = document.createElement("pre")
      pre.className = "cm-live-mermaid-fallback"
      const code = document.createElement("code")
      code.textContent = text
      pre.appendChild(code)
      container.appendChild(pre)
    }

    const renderErrorFallback = (container: HTMLElement, text: string) => {
      container.innerHTML = ""
      container.dataset.mermaidState = "error"
      const banner = document.createElement("div")
      banner.className = "cm-live-mermaid-error"
      banner.textContent = "Mermaid 다이어그램 문법 오류"
      container.appendChild(banner)
      renderFallbackCode(container, text)
    }

    if (view) {
      root.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        moveCursorToWidgetOrigin(view, root, this.from)
      })
    }

    const normalized = this.source.trim()
    if (!normalized) {
      root.dataset.mermaidState = "empty"
      renderFallbackCode(root, this.source)
      return root
    }

    if (!this.customRenderer) {
      const cachedSvg = liveMermaidSvgCache.get(normalized)
      if (cachedSvg) {
        root.dataset.mermaidState = "rendered"
        root.innerHTML = cachedSvg
        return root
      }
    }

    root.dataset.mermaidState = "loading"
    renderFallbackCode(root, normalized)

    const renderId = `cm-live-mermaid-${(mermaidRenderCounter += 1)}`
    const executeRender = this.customRenderer
      ? this.customRenderer(renderId, normalized)
      : loadLiveMermaid().then((mermaid) => {
          if (!mermaid) throw new Error("Mermaid unavailable")
          return mermaid.render(renderId, normalized)
        })

    void executeRender
      .then((res) => {
        if (!res?.svg) {
          renderErrorFallback(root, normalized)
          return
        }
        if (!this.customRenderer) cacheLiveMermaidSvg(normalized, res.svg)
        root.dataset.mermaidState = "rendered"
        root.innerHTML = res.svg
      })
      .catch(() => renderErrorFallback(root, normalized))

    return root
  }
}
