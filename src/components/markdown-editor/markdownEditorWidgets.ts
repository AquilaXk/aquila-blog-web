import { WidgetType, type EditorView } from "@codemirror/view"
import { Transaction } from "@codemirror/state"

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

export class MarkdownTaskWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
    private readonly to: number
  ) {
    super()
  }

  eq(other: MarkdownTaskWidget) {
    return (
      other.checked === this.checked &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("span")
    checkbox.className = `cm-live-task-checkbox ${this.checked ? "is-checked" : ""}`
    checkbox.setAttribute("role", "checkbox")
    checkbox.setAttribute("aria-checked", this.checked ? "true" : "false")
    checkbox.setAttribute("aria-label", "Toggle task item")
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
  constructor(
    private readonly math: string,
    private readonly displayMode: boolean
  ) {
    super()
  }

  eq(other: MarkdownMathWidget) {
    return other.math === this.math && other.displayMode === this.displayMode
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span")
    span.className = `cm-live-math ${
      this.displayMode ? "cm-live-math-display" : "cm-live-math-inline"
    }`
    const katex = getKatex()
    if (katex) {
      try {
        span.innerHTML = katex.renderToString(this.math, {
          displayMode: this.displayMode,
          throwOnError: false,
        })
        return span
      } catch {
        // Fallback to text
      }
    } else if (katexLoadPromise) {
      void katexLoadPromise.then(() => {
        // Trigger a lightweight re-render or update
        try {
          if (cachedKatex) {
            span.innerHTML = cachedKatex.renderToString(this.math, {
              displayMode: this.displayMode,
              throwOnError: false,
            })
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
  constructor(
    private readonly src: string,
    private readonly alt: string
  ) {
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

export class MarkdownCalloutWidget extends WidgetType {
  constructor(
    private readonly calloutType: string,
    private readonly title: string,
    private readonly content: string
  ) {
    super()
  }

  eq(other: MarkdownCalloutWidget) {
    return (
      other.calloutType === this.calloutType &&
      other.title === this.title &&
      other.content === this.content
    )
  }

  toDOM() {
    const root = document.createElement("div")
    root.className = `cm-live-callout cm-live-callout-${this.calloutType.toLowerCase()}`

    const header = document.createElement("div")
    header.className = "cm-live-callout-header"

    const foldIcon = document.createElement("span")
    foldIcon.className = "cm-live-callout-fold"
    foldIcon.textContent = "▼"

    const titleSpan = document.createElement("span")
    titleSpan.className = "cm-live-callout-title"
    titleSpan.textContent = this.title || this.calloutType.toUpperCase()

    header.appendChild(foldIcon)
    header.appendChild(titleSpan)
    root.appendChild(header)

    if (this.content.trim()) {
      const body = document.createElement("div")
      body.className = "cm-live-callout-body"
      body.textContent = this.content
      root.appendChild(body)

      header.addEventListener("mousedown", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const isCollapsed = root.classList.toggle("is-collapsed")
        foldIcon.textContent = isCollapsed ? "▶" : "▼"
      })
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

    const parseCells = (line: string): string[] => {
      const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
      return trimmed
        .split(/(?<!\\)\|/)
        .map((cell) => cell.replaceAll("\\|", "|").trim())
    }

    // Header row
    const headerRow = lines[0]
    if (headerRow) {
      const thead = document.createElement("thead")
      const tr = document.createElement("tr")
      for (const cell of parseCells(headerRow)) {
        const th = document.createElement("th")
        th.textContent = cell
        tr.appendChild(th)
      }
      thead.appendChild(tr)
      table.appendChild(thead)
    }

    // Body rows (skip delimiter line if lines[1] contains ---)
    const bodyStartIndex = lines[1] && /^[\s|:-]+$/.test(lines[1]) ? 2 : 1
    if (lines.length > bodyStartIndex) {
      const tbody = document.createElement("tbody")
      for (let i = bodyStartIndex; i < lines.length; i += 1) {
        const tr = document.createElement("tr")
        for (const cell of parseCells(lines[i]!)) {
          const td = document.createElement("td")
          td.textContent = cell
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
      other.target === this.target &&
      other.alias === this.alias &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  toDOM(view: EditorView) {
    const root = document.createElement("span")
    root.className = "cm-live-wikilink"
    root.setAttribute("role", "link")
    root.setAttribute("tabindex", "0")
    root.setAttribute("aria-label", `Wikilink: ${this.alias || this.target}`)
    root.dataset.target = this.target
    if (this.alias) {
      root.dataset.alias = this.alias
    }

    const icon = document.createElement("span")
    icon.className = "cm-live-wikilink-icon"
    icon.setAttribute("aria-hidden", "true")
    icon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`

    const text = document.createElement("span")
    text.className = "cm-live-wikilink-text"
    text.textContent = this.alias || this.target

    root.appendChild(icon)
    root.appendChild(text)

    const handleActivate = () => {
      if (this.from !== undefined) {
        view.focus()
        view.dispatch({
          selection: { anchor: this.from + 2 },
          scrollIntoView: true,
        })
      }
    }

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      handleActivate()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        handleActivate()
      }
    }

    root.addEventListener("mousedown", handleClick)
    root.addEventListener("click", handleClick)
    root.addEventListener("keydown", handleKeyDown)

    return root
  }
}

