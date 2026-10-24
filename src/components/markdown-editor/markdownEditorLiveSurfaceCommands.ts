import {
  LanguageDescription,
  LanguageSupport,
} from "@codemirror/language"
import {
  javascriptLanguage,
  typescriptLanguage,
  jsxLanguage,
  tsxLanguage,
} from "@codemirror/lang-javascript"
import { htmlLanguage } from "@codemirror/lang-html"
import { cssLanguage } from "@codemirror/lang-css"
import {
  EditorSelection,
  Transaction,
} from "@codemirror/state"
import {
  EditorView,
  type KeyBinding,
} from "@codemirror/view"
import { cycleTaskCheckboxInLine } from "./markdownEditorKeyboardModel"
import { getDocString } from "./markdownEditorLiveSurfaceDecorations"

export const selectNextOccurrenceCommand = (view: EditorView): boolean => {
  const { state } = view
  const { selection, doc } = state
  const main = selection.main
  if (main.empty) {
    const word = state.wordAt(main.head)
    if (!word) return false
    view.dispatch({
      selection: EditorSelection.single(word.from, word.to),
      scrollIntoView: true,
    })
    return true
  }

  const selectedText = doc.sliceString(main.from, main.to)
  if (!selectedText) return false

  const docText = getDocString(doc)
  const selectedRanges = selection.ranges
  const maxTo = Math.max(...selectedRanges.map((r) => r.to))

  let nextIndex = docText.indexOf(selectedText, maxTo)
  if (nextIndex === -1) {
    nextIndex = docText.indexOf(selectedText, 0)
  }

  const isAlreadySelected = (idx: number) =>
    selectedRanges.some((r) => r.from === idx && r.to === idx + selectedText.length)

  while (nextIndex !== -1 && isAlreadySelected(nextIndex)) {
    nextIndex = docText.indexOf(selectedText, nextIndex + 1)
    if (nextIndex === -1 && maxTo > 0) {
      nextIndex = docText.indexOf(selectedText, 0)
    }
    if (nextIndex >= maxTo) {
      nextIndex = -1
      break
    }
  }

  if (nextIndex === -1) {
    return false
  }

  const nextRange = EditorSelection.range(nextIndex, nextIndex + selectedText.length)
  const newRanges = [...selectedRanges, nextRange].sort((a, b) => a.from - b.from)
  const newMainIndex = newRanges.findIndex((r) => r.from === nextRange.from)

  view.dispatch({
    selection: EditorSelection.create(newRanges, newMainIndex >= 0 ? newMainIndex : undefined),
    scrollIntoView: true,
  })
  return true
}

export const cycleTaskCommand = (view: EditorView): boolean => {
  const { state } = view
  const { selection, doc } = state
  const main = selection.main
  const line = doc.lineAt(main.head)
  const lineText = line.text

  const res = cycleTaskCheckboxInLine(lineText)
  if (res.replaced) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: res.lineText },
      annotations: [Transaction.userEvent.of("input")],
    })
    return true
  }
  return false
}

export const handleFenceEnter: KeyBinding = {
  key: "Enter",
  run: (view) => {
    const { state } = view
    const { selection, doc } = state
    const { from, to } = selection.main
    if (from !== to) return false
    const line = doc.lineAt(from)
    const lineText = line.text
    const match = /^( {0,3})(`{3,}|~{3,})([a-zA-Z0-9_-]*)\s*$/.exec(lineText)
    if (!match) return false
    if (from < line.from + match[0].length) return false

    let fenceCount = 0
    for (let lineNo = line.number + 1; lineNo <= doc.lines; lineNo += 1) {
      if (/^\s*(`{3,}|~{3,})/.test(doc.line(lineNo).text.trim())) {
        fenceCount += 1
      }
    }
    if (fenceCount % 2 === 1) {
      return false
    }

    const indent = match[1] ?? ""
    const marker = match[2] ?? "```"
    const insertion = `\n${indent}\n${indent}${marker}`
    view.dispatch({
      changes: { from, to: from, insert: insertion },
      selection: EditorSelection.cursor(from + 1 + indent.length),
      scrollIntoView: true,
      annotations: [Transaction.userEvent.of("input")],
    })
    return true
  },
}

export const codeLanguages = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "mjs", "cjs"],
    support: new LanguageSupport(javascriptLanguage),
  }),
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts"],
    support: new LanguageSupport(typescriptLanguage),
  }),
  LanguageDescription.of({
    name: "jsx",
    support: new LanguageSupport(jsxLanguage),
  }),
  LanguageDescription.of({
    name: "tsx",
    support: new LanguageSupport(tsxLanguage),
  }),
  LanguageDescription.of({
    name: "html",
    support: new LanguageSupport(htmlLanguage),
  }),
  LanguageDescription.of({
    name: "css",
    support: new LanguageSupport(cssLanguage),
  }),
  LanguageDescription.of({
    name: "json",
    support: new LanguageSupport(javascriptLanguage),
  }),
]

export const liveSurfaceTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit" },
  ".cm-content": {
    minHeight: "640px",
    padding: "24px 32px 40px 46px",
  },
  ".cm-line": { padding: "0" },
  ".cm-live-image-wrap": {
    display: "block",
    margin: "8px 0",
  },
  ".cm-live-image": {
    maxWidth: "100%",
    borderRadius: "6px",
  },
  ".cm-live-callout": {
    borderLeft: "4px solid #3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: "6px",
    padding: "10px 14px",
    margin: "12px 0",
  },
  ".cm-live-callout-tone-info": {
    borderLeftColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  ".cm-live-callout-tone-summary": {
    borderLeftColor: "#06b6d4",
    backgroundColor: "rgba(6, 182, 212, 0.08)",
  },
  ".cm-live-callout-tone-tip": {
    borderLeftColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  ".cm-live-callout-tone-warning": {
    borderLeftColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  ".cm-live-callout-tone-danger": {
    borderLeftColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  ".cm-live-callout-tone-outline": {
    borderLeftColor: "#64748b",
    backgroundColor: "rgba(100, 116, 139, 0.08)",
  },
  ".cm-live-callout-header": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "600",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-callout-icon": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.95em",
    lineHeight: "1",
  },
  ".cm-live-callout-fold": {
    fontSize: "10px",
    opacity: 0.7,
    marginLeft: "auto",
  },
  ".cm-live-callout.is-collapsed .cm-live-callout-body": {
    display: "none",
  },
  ".cm-live-callout-body": {
    marginTop: "6px",
    opacity: 0.9,
  },
  ".cm-live-toggle-block": {
    border: "1px solid rgba(128, 128, 128, 0.24)",
    backgroundColor: "rgba(128, 128, 128, 0.04)",
    borderRadius: "8px",
    padding: "10px 14px",
    margin: "10px 0",
  },
  ".cm-live-toggle-header": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "650",
    userSelect: "none",
  },
  ".cm-live-toggle-caret": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer",
    opacity: 0.75,
  },
  ".cm-live-toggle-title": {
    cursor: "text",
    flex: "1 1 auto",
  },
  ".cm-live-toggle-block.is-collapsed .cm-live-toggle-body": {
    display: "none",
  },
  ".cm-live-toggle-body": {
    marginTop: "6px",
    paddingLeft: "28px",
    whiteSpace: "pre-wrap",
    cursor: "text",
  },
  ".cm-live-toggle-body.is-empty": {
    opacity: 0.55,
    fontStyle: "italic",
  },
  ".cm-live-bookmark-card": {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    border: "1px solid rgba(128, 128, 128, 0.26)",
    backgroundColor: "rgba(128, 128, 128, 0.04)",
    borderRadius: "8px",
    padding: "12px 14px",
    margin: "10px 0",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-bookmark-icon": {
    fontSize: "18px",
    lineHeight: "1.2",
    flexShrink: "0",
  },
  ".cm-live-bookmark-content": {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: "0",
    flex: "1 1 auto",
  },
  ".cm-live-bookmark-title": {
    fontWeight: "650",
    fontSize: "0.95em",
    lineHeight: "1.35",
  },
  ".cm-live-bookmark-desc": {
    fontSize: "0.86em",
    opacity: 0.82,
    lineHeight: "1.4",
  },
  ".cm-live-bookmark-url": {
    fontSize: "0.78em",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    opacity: 0.68,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-live-table-wrap": {
    overflowX: "auto",
    margin: "12px 0",
  },
  ".cm-live-table": {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "0.9em",
  },
  ".cm-live-table th, .cm-live-table td": {
    border: "1px solid rgba(128, 128, 128, 0.3)",
    padding: "6px 12px",
    textAlign: "left",
  },
  ".cm-live-table th": {
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    fontWeight: "600",
  },
  ".cm-live-mermaid": {
    margin: "12px 0",
    padding: "12px 16px",
    borderRadius: "6px",
    border: "1px solid rgba(128, 128, 128, 0.24)",
    overflowX: "auto",
    cursor: "pointer",
  },
  ".cm-live-mermaid svg": {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    margin: "0 auto",
  },
  ".cm-live-mermaid-error": {
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "6px",
    opacity: 0.85,
  },
  ".cm-live-mermaid-fallback": {
    margin: "0",
    fontSize: "13px",
    whiteSpace: "pre-wrap",
  },
  "@media (max-width: 820px)": {
    ".cm-content": { padding: "18px 16px 32px 16px", maxWidth: "100%" },
  },
})
