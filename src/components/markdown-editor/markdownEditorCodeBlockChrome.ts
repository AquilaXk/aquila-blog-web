import { EditorView, WidgetType } from "@codemirror/view"
import { CODE_BLOCK_LANGUAGE_OPTIONS } from "./markdownEditorCodeLanguages"
import { EDITOR_SYNTAX_COLORS } from "./markdownEditorSyntaxThemeTokens"

export const LIVE_CODE_HEADER_STYLES = `
  .cm-live-code-fence-open.cm-live-code-has-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 30px;
    padding-top: 6px;
    padding-bottom: 4px;
  }
  .cm-live-code-header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .cm-live-code-lang-select,
  .cm-live-code-copy-btn {
    height: 22px;
    padding: 0 7px;
    border-radius: 5px;
    border: 1px solid ${EDITOR_SYNTAX_COLORS.codeLangBadgeBorder};
    background: ${EDITOR_SYNTAX_COLORS.codeLangBadgeSurface};
    color: ${EDITOR_SYNTAX_COLORS.codeLangBadgeText};
    font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    cursor: pointer;
  }
  .cm-live-code-lang-select:focus-visible,
  .cm-live-code-copy-btn:focus-visible {
    outline: 2px solid ${EDITOR_SYNTAX_COLORS.codeBlockCursor};
    outline-offset: 1px;
  }
  @media (pointer: coarse) {
    .cm-live-code-lang-select,
    .cm-live-code-copy-btn {
      min-height: 32px;
      padding: 0 10px;
      font-size: 12px;
    }
  }
`

const resolveOpenLineFromDom = (view: EditorView, el: HTMLElement, fallbackFrom: number) => {
  let pos = fallbackFrom
  try {
    const domPos = view.posAtDOM(el)
    if (typeof domPos === "number" && domPos >= 0) pos = domPos
  } catch {
    // fallbackFrom 사용
  }
  return view.state.doc.lineAt(Math.min(pos, view.state.doc.length))
}

const updateFenceLineLanguage = (view: EditorView, el: HTMLElement, fallbackFrom: number, nextLanguage: string) => {
  if (!view.state.facet(EditorView.editable)) return
  const openLine = resolveOpenLineFromDom(view, el, fallbackFrom)
  const match = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/.exec(openLine.text)
  if (!match) return
  const indent = match[1] ?? ""
  const fence = match[2] ?? "```"
  const cleanLang = nextLanguage.trim().toLowerCase()
  const replacement = `${indent}${fence}${cleanLang}`
  if (replacement === openLine.text) return
  view.dispatch({
    changes: { from: openLine.from, to: openLine.to, insert: replacement },
  })
}

const extractCodeBlockBodyText = (view: EditorView, el: HTMLElement, fallbackFrom: number): string => {
  const openLine = resolveOpenLineFromDom(view, el, fallbackFrom)
  const openMatch = /^( {0,3})(`{3,}|~{3,})/.exec(openLine.text)
  if (!openMatch) return ""
  const fenceChar = openMatch[2]?.[0] ?? "`"
  const fenceLen = openMatch[2]?.length ?? 3
  const lines: string[] = []
  for (let lineNo = openLine.number + 1; lineNo <= view.state.doc.lines; lineNo += 1) {
    const line = view.state.doc.line(lineNo)
    const closeMatch = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(line.text)
    if (closeMatch && closeMatch[2]?.[0] === fenceChar && (closeMatch[2]?.length ?? 0) >= fenceLen) {
      break
    }
    lines.push(line.text)
  }
  return lines.join("\n")
}

const copyPlainTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 폴백 시도
    }
  }
  if (typeof document === "undefined") return false
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  textarea.remove()
  return ok
}

export class MarkdownCodeBlockHeaderWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly openFrom: number
  ) {
    super()
  }

  eq(other: MarkdownCodeBlockHeaderWidget) {
    return other.language === this.language
  }

  toDOM(view: EditorView) {
    const root = document.createElement("span")
    root.className = "cm-live-code-header"
    root.dataset.testid = "cm-live-code-header"
    root.setAttribute("contenteditable", "false")

    const normalizedLang = this.language.trim().toLowerCase()
    const select = document.createElement("select")
    select.className = "cm-live-code-lang-select"
    select.setAttribute("aria-label", "Code language")
    let hasCurrent = normalizedLang === ""

    for (const optionSpec of CODE_BLOCK_LANGUAGE_OPTIONS) {
      const option = document.createElement("option")
      option.value = optionSpec.value
      option.textContent = optionSpec.label
      if (optionSpec.value === normalizedLang) hasCurrent = true
      select.appendChild(option)
    }
    if (!hasCurrent && normalizedLang) {
      const customOption = document.createElement("option")
      customOption.value = normalizedLang
      customOption.textContent = normalizedLang
      select.appendChild(customOption)
    }
    select.value = normalizedLang

    const editable = view.state.facet(EditorView.editable)
    select.disabled = !editable
    for (const evName of ["mousedown", "pointerdown", "click"] as const) {
      select.addEventListener(evName, (event) => event.stopPropagation())
    }
    select.addEventListener("change", () => {
      updateFenceLineLanguage(view, root, this.openFrom, select.value)
    })

    const copyBtn = document.createElement("button")
    copyBtn.type = "button"
    copyBtn.className = "cm-live-code-copy-btn"
    copyBtn.textContent = "Copy"
    copyBtn.setAttribute("aria-label", "Copy code")
    for (const evName of ["mousedown", "pointerdown"] as const) {
      copyBtn.addEventListener(evName, (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
    }
    let copiedTimer: ReturnType<typeof setTimeout> | null = null
    copyBtn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      const code = extractCodeBlockBodyText(view, root, this.openFrom)
      void copyPlainTextToClipboard(code).then((ok) => {
        if (!ok) return
        copyBtn.textContent = "Copied"
        if (copiedTimer) clearTimeout(copiedTimer)
        copiedTimer = setTimeout(() => {
          copyBtn.textContent = "Copy"
        }, 1400)
      })
    })

    root.appendChild(select)
    root.appendChild(copyBtn)
    return root
  }

  ignoreEvent(event: Event) {
    return event.type !== "keydown"
  }
}
