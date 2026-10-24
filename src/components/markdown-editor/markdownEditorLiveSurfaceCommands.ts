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
  ".cm-gutters, &.cm-editor .cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "none",
    border: "0",
    minWidth: "18px",
  },
  ".cm-content": {
    minHeight: "640px",
    padding: "24px 32px 40px 46px",
  },
  ".cm-line": { padding: "0" },
  ".cm-live-image-wrap": { display: "block", margin: "8px 0" },
  ".cm-live-image": { maxWidth: "100%", borderRadius: "6px" },
  ".cm-live-callout": {
    borderLeft: "4px solid #2383e2",
    backgroundColor: "rgba(35, 131, 226, 0.08)",
    borderRadius: "8px",
    padding: "11px 14px",
    margin: "12px 0",
  },
  ".cm-live-callout-tone-info": { borderLeftColor: "#2383e2", backgroundColor: "rgba(35, 131, 226, 0.08)" },
  ".cm-live-callout-tone-summary": { borderLeftColor: "#06b6d4", backgroundColor: "rgba(6, 182, 212, 0.08)" },
  ".cm-live-callout-tone-tip": { borderLeftColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.08)" },
  ".cm-live-callout-tone-warning": { borderLeftColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.09)" },
  ".cm-live-callout-tone-danger": { borderLeftColor: "#eb5757", backgroundColor: "rgba(235, 87, 87, 0.09)" },
  ".cm-live-callout-tone-purple": { borderLeftColor: "#9065b0", backgroundColor: "rgba(144, 101, 176, 0.09)" },
  ".cm-live-callout-tone-default, .cm-live-callout-tone-outline": {
    borderLeftColor: "#787774",
    backgroundColor: "rgba(135, 131, 120, 0.09)",
  },
  ".cm-live-callout-header": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "650",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-callout-icon": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.02em",
    lineHeight: "1",
  },
  ".cm-live-callout-fold": { fontSize: "10px", opacity: 0.7, marginLeft: "auto" },
  ".cm-live-callout.is-collapsed .cm-live-callout-body": { display: "none" },
  ".cm-live-callout-body": { marginTop: "6px", opacity: 0.92, whiteSpace: "pre-wrap" },
  ".cm-line.cm-live-container-active-line": {
    paddingLeft: "14px",
    paddingRight: "14px",
    borderLeft: "4px solid #2383e2",
    backgroundColor: "rgba(35, 131, 226, 0.07)",
  },
  ".cm-line.cm-live-container-active-toggle, .cm-line.cm-live-container-active-bookmark": {
    borderLeftColor: "#9065b0",
    backgroundColor: "rgba(144, 101, 176, 0.06)",
  },
  ".cm-line.cm-live-container-tone-tip": { borderLeftColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.07)" },
  ".cm-line.cm-live-container-tone-warning": { borderLeftColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.08)" },
  ".cm-line.cm-live-container-tone-danger": { borderLeftColor: "#eb5757", backgroundColor: "rgba(235, 87, 87, 0.08)" },
  ".cm-line.cm-live-container-tone-purple": { borderLeftColor: "#9065b0", backgroundColor: "rgba(144, 101, 176, 0.08)" },
  ".cm-line.cm-live-container-tone-default": { borderLeftColor: "#787774", backgroundColor: "rgba(135, 131, 120, 0.08)" },
  ".cm-line.cm-live-container-line-open": {
    paddingTop: "6px",
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
  },
  ".cm-line.cm-live-container-line-close": {
    paddingBottom: "6px",
    borderBottomLeftRadius: "6px",
    borderBottomRightRadius: "6px",
  },
  ".cm-live-toggle-block": {
    border: "1px solid rgba(128, 128, 128, 0.22)",
    backgroundColor: "rgba(135, 131, 120, 0.05)",
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
    color: "#2383e2",
    backgroundColor: "rgba(35, 131, 226, 0.1)",
  },
  ".cm-live-toggle-title": { cursor: "text", flex: "1 1 auto" },
  ".cm-live-toggle-block.is-collapsed .cm-live-toggle-body": { display: "none" },
  ".cm-live-toggle-body": { marginTop: "6px", paddingLeft: "28px", whiteSpace: "pre-wrap", cursor: "text" },
  ".cm-live-toggle-body.is-empty": { opacity: 0.55, fontStyle: "italic" },
  ".cm-live-bookmark-card": {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    border: "1px solid rgba(128, 128, 128, 0.24)",
    backgroundColor: "rgba(135, 131, 120, 0.05)",
    borderRadius: "8px",
    padding: "12px 14px",
    margin: "10px 0",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-bookmark-icon": { fontSize: "18px", lineHeight: "1.2", flexShrink: "0" },
  ".cm-live-bookmark-content": {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: "0",
    flex: "1 1 auto",
  },
  ".cm-live-bookmark-title": { fontWeight: "650", fontSize: "0.95em", lineHeight: "1.35" },
  ".cm-live-bookmark-desc": { fontSize: "0.86em", opacity: 0.82, lineHeight: "1.4" },
  ".cm-live-bookmark-url": {
    fontSize: "0.78em",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    color: "#2383e2",
    opacity: 0.85,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-live-table code, .cm-live-callout code, .cm-live-toggle-block code": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    fontSize: "0.86em",
    color: "#eb5757",
    backgroundColor: "rgba(135, 131, 120, 0.15)",
    padding: "0.14em 0.38em",
    borderRadius: "4px",
  },
  ".cm-live-table mark.cm-live-highlight, .cm-live-callout mark.cm-live-highlight, .cm-live-toggle-block mark.cm-live-highlight": {
    backgroundColor: "rgba(250, 204, 21, 0.32)",
    color: "inherit",
    padding: "0.06em 0.24em",
    borderRadius: "3px",
  },
  ".cm-live-table del.cm-live-strikethrough, .cm-live-callout del.cm-live-strikethrough, .cm-live-toggle-block del.cm-live-strikethrough": {
    textDecoration: "line-through",
    opacity: 0.68,
  },
  ".cm-live-table-wrap": {
    overflowX: "auto",
    margin: "14px 0",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  '.cm-live-table-wrap[data-full-width="true"]': { width: "100%" },
  ".cm-live-table-toolbar": {
    display: "inline-flex",
    flexWrap: "nowrap",
    overflowX: "auto",
    maxWidth: "100%",
    scrollbarWidth: "none",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: "2px",
    padding: "3px 6px",
    border: "1px solid rgba(128, 128, 128, 0.22)",
    backgroundColor: "color-mix(in srgb, var(--surface-elevated, #ffffff) 96%, #f7f6f3 4%)",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
  },
  ".cm-live-table-toolbar-btn": {
    border: "1px solid transparent",
    backgroundColor: "transparent",
    color: "inherit",
    borderRadius: "5px",
    padding: "3px 7px",
    fontSize: "11.5px",
    fontWeight: "550",
    lineHeight: "1.3",
    cursor: "pointer",
  },
  '.cm-live-table-toolbar-btn[data-group-start="true"]': {
    marginLeft: "3px",
    paddingLeft: "8px",
    borderLeft: "1px solid rgba(128, 128, 128, 0.22)",
    borderTopLeftRadius: "0",
    borderBottomLeftRadius: "0",
  },
  ".cm-live-table-toolbar-btn:hover:not(:disabled)": {
    backgroundColor: "rgba(35, 131, 226, 0.1)",
    color: "#2383e2",
  },
  '.cm-live-table-wrap[data-active-mode="row"] .cm-live-table-toolbar-btn[data-group="row"]:not(:disabled), .cm-live-table-wrap[data-active-mode="col"] .cm-live-table-toolbar-btn[data-group="col"]:not(:disabled)': {
    backgroundColor: "rgba(35, 131, 226, 0.08)",
    color: "#14569b",
  },
  '.cm-live-table-toolbar-btn[aria-pressed="true"]': {
    backgroundColor: "rgba(35, 131, 226, 0.14)",
    borderColor: "rgba(35, 131, 226, 0.38)",
    color: "#2383e2",
    fontWeight: "650",
  },
  ".cm-live-table-toolbar-btn:disabled": { opacity: 0.35, cursor: "not-allowed" },
  ".cm-live-table-grid-row": { display: "flex", alignItems: "stretch", gap: "4px" },
  '.cm-live-table-wrap[data-full-width="true"] .cm-live-table-grid-row': { width: "100%" },
  ".cm-live-table": {
    borderCollapse: "collapse",
    flex: "1 1 auto",
    width: "100%",
    fontSize: "0.9em",
  },
  '.cm-live-table-wrap[data-full-width="true"] .cm-live-table': {
    width: "100%",
    tableLayout: "fixed",
  },
  ".cm-live-table th, .cm-live-table td": {
    position: "relative",
    border: "1px solid rgba(128, 128, 128, 0.24)",
    padding: "7px 12px",
    textAlign: "left",
    cursor: "text",
    minWidth: "72px",
  },
  ".cm-live-table th:first-child, .cm-live-table td:first-child": {
    paddingLeft: "22px",
  },
  ".cm-live-table th": {
    paddingTop: "14px",
    backgroundColor: "color-mix(in srgb, var(--surface-elevated, #f7f6f3) 90%, rgba(135, 131, 120, 0.18) 10%)",
    fontWeight: "650",
  },
  '.cm-live-table-wrap[data-header-row="false"] .cm-live-table th, .cm-live-table-wrap[data-testid="cm-live-table-widget"]:not([data-header-row="true"]) .cm-live-table th': {
    backgroundColor: "transparent",
    fontWeight: "500",
  },
  '.cm-live-table-wrap[data-header-col="true"] .cm-live-table tbody td:first-child': {
    backgroundColor: "color-mix(in srgb, var(--surface-elevated, #f7f6f3) 90%, rgba(135, 131, 120, 0.18) 10%)",
    fontWeight: "650",
  },
  ".cm-live-table th.is-selected-col, .cm-live-table td.is-selected-col, .cm-live-table th.is-selected-row, .cm-live-table td.is-selected-row": {
    backgroundColor: "rgba(35, 131, 226, 0.08)",
  },
  ".cm-live-table th.is-drop-target-col": {
    borderLeft: "2px solid #2383e2",
  },
  ".cm-live-table tr.is-drop-target-row td, .cm-live-table tr.is-drop-target-row th": {
    borderTop: "2px solid #2383e2",
  },
  ".cm-live-table-col-handle": {
    position: "absolute",
    top: "1px",
    left: "50%",
    transform: "translateX(-50%)",
    height: "11px",
    minWidth: "24px",
    padding: "0 4px",
    border: "1px solid transparent",
    borderRadius: "4px",
    backgroundColor: "transparent",
    color: "#52514e",
    fontSize: "10px",
    lineHeight: "9px",
    cursor: "grab",
    opacity: 0.72,
    zIndex: "3",
  },
  ".cm-live-table-row-handle": {
    position: "absolute",
    left: "2px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "14px",
    height: "20px",
    padding: "0",
    border: "1px solid transparent",
    borderRadius: "4px",
    backgroundColor: "transparent",
    color: "#52514e",
    fontSize: "10px",
    lineHeight: "1",
    cursor: "grab",
    opacity: 0.72,
    zIndex: "3",
  },
  ".cm-live-table th:hover .cm-live-table-col-handle, .cm-live-table th.is-selected-col .cm-live-table-col-handle, .cm-live-table-col-handle:hover, .cm-live-table-col-handle:focus-visible, .cm-live-table tr:hover .cm-live-table-row-handle, .cm-live-table td.is-selected-row .cm-live-table-row-handle, .cm-live-table th.is-selected-row .cm-live-table-row-handle, .cm-live-table-row-handle:hover, .cm-live-table-row-handle:focus-visible": {
    opacity: 1,
    backgroundColor: "rgba(35, 131, 226, 0.12)",
    borderColor: "rgba(35, 131, 226, 0.32)",
    color: "#14569b",
  },
  ".cm-live-table-col-resizer": {
    position: "absolute",
    top: "0",
    right: "-3px",
    width: "6px",
    height: "100%",
    cursor: "col-resize",
    userSelect: "none",
    zIndex: "2",
  },
  ".cm-live-table-col-resizer:hover, .cm-live-table-col-resizer:active": {
    backgroundColor: "#2383e2",
    width: "2px",
    right: "-1px",
  },
  ".cm-live-table th.is-active-cell, .cm-live-table td.is-active-cell": {
    outline: "2px solid #2383e2",
    outlineOffset: "-2px",
    backgroundColor: "rgba(35, 131, 226, 0.06)",
  },
  ".cm-live-table-cell-input": {
    width: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "inherit",
    font: "inherit",
    padding: "0",
    margin: "0",
  },
  ".cm-live-table-footer-row": { display: "flex", alignItems: "stretch", gap: "4px" },
  ".cm-live-table-add-col": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    border: "1px dashed rgba(128, 128, 128, 0.26)",
    backgroundColor: "rgba(135, 131, 120, 0.04)",
    color: "inherit",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    opacity: 0.72,
  },
  ".cm-live-table-add-corner": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "26px",
    flexShrink: "0",
    border: "1px dashed rgba(128, 128, 128, 0.26)",
    backgroundColor: "rgba(135, 131, 120, 0.04)",
    color: "inherit",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    opacity: 0.72,
  },
  ".cm-live-table-add-col:hover:not(:disabled), .cm-live-table-add-row:hover:not(:disabled), .cm-live-table-add-corner:hover:not(:disabled)": {
    borderColor: "rgba(35, 131, 226, 0.45)",
    backgroundColor: "rgba(35, 131, 226, 0.08)",
    color: "#2383e2",
    opacity: 1,
  },
  ".cm-live-table-add-col:disabled, .cm-live-table-add-row:disabled, .cm-live-table-add-corner:disabled": {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  ".cm-live-table-add-row": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "26px",
    flex: "1 1 auto",
    width: "100%",
    border: "1px dashed rgba(128, 128, 128, 0.26)",
    backgroundColor: "rgba(135, 131, 120, 0.04)",
    color: "inherit",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12.5px",
    fontWeight: "550",
    opacity: 0.72,
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
  ".cm-live-mermaid-fallback": { margin: "0", fontSize: "13px", whiteSpace: "pre-wrap" },
  "@media (max-width: 820px)": {
    ".cm-content": { padding: "18px 16px 32px 16px", maxWidth: "100%" },
  },
})
