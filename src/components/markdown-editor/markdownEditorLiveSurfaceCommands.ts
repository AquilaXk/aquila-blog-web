/**
 * 참조 구현:
 * - fuma-nama/fumadocs (packages/base-ui/src/components/callout.tsx, MIT License, Copyright (c) 2024 Fuma Nama)
 * - Milkdown/milkdown Crepe (packages/crepe/src/theme/common/table.css, MIT License, Copyright (c) 2021 Mirone)
 */
import { LanguageDescription, LanguageSupport } from "@codemirror/language"
import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from "@codemirror/lang-javascript"
import { htmlLanguage } from "@codemirror/lang-html"
import { cssLanguage } from "@codemirror/lang-css"
import { EditorSelection, Transaction } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { cycleTaskCheckboxInLine } from "./markdownEditorKeyboardModel"
import { getDocString } from "./markdownEditorLiveSurfaceDecorations"
import { liveTableAndCardThemeSpec } from "./markdownEditorLiveTableAndCardTheme"
import { EDITOR_SYNTAX_COLORS } from "./markdownEditorSyntaxThemeTokens"

export { handleFenceEnter, handleFenceShiftEnter } from "./markdownEditorFenceCommands"

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
    display: "none",
    backgroundColor: "transparent",
    borderRight: "none",
    border: "0",
    minWidth: "0",
  },
  ".cm-content": {
    width: "calc(100% - 112px)",
    maxWidth: "744px",
    flex: "0 1 744px",
    marginInline: "auto",
    boxSizing: "content-box",
    minHeight: "640px",
    padding: "12px 56px 96px 56px",
  },
  ".cm-line": { padding: "0" },
  ".cm-live-image-wrap": { display: "block", margin: "10px 0" },
  ".cm-live-image": { maxWidth: "100%", borderRadius: "8px" },
  ".cm-live-callout": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.info.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.info.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.info.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.info.title,
    border: "1px solid var(--callout-card-border)",
    borderLeft: "3px solid var(--callout-accent)",
    backgroundColor: "var(--callout-bg)",
    boxShadow: EDITOR_SYNTAX_COLORS.blockCardShadow,
    borderRadius: "8px",
    padding: "14px 18px",
    margin: "16px 0",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  ".cm-live-callout-tone-info": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.info.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.info.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.info.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.info.title,
  },
  ".cm-live-callout-tone-summary": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.summary.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.summary.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.summary.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.summary.title,
  },
  ".cm-live-callout-tone-tip": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.tip.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.tip.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.tip.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.tip.title,
  },
  ".cm-live-callout-tone-warning": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.warning.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.warning.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.warning.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.warning.title,
  },
  ".cm-live-callout-tone-danger": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.danger.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.danger.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.danger.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.danger.title,
  },
  ".cm-live-callout-tone-example": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.example.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.example.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.example.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.example.title,
  },
  ".cm-live-callout-tone-purple": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.purple.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.purple.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.purple.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.purple.title,
  },
  ".cm-live-callout-tone-default, .cm-live-callout-tone-outline": {
    "--callout-accent": EDITOR_SYNTAX_COLORS.calloutTones.default.border,
    "--callout-card-border": EDITOR_SYNTAX_COLORS.calloutTones.default.cardBorder,
    "--callout-bg": EDITOR_SYNTAX_COLORS.calloutTones.default.bg,
    "--callout-title": EDITOR_SYNTAX_COLORS.calloutTones.default.title,
  },
  ".cm-live-callout-header": {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: "650",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-live-callout-icon": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "22px",
    backgroundColor: "transparent",
    color: "var(--callout-accent)",
    lineHeight: "1",
    flexShrink: "0",
  },
  ".cm-live-callout-title": {
    color: "var(--callout-title)",
    fontWeight: "660",
    fontSize: "0.96em",
    letterSpacing: "-0.01em",
  },
  ".cm-live-callout-fold": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    marginLeft: "auto",
    color: "var(--callout-accent)",
    opacity: 0.72,
    flexShrink: "0",
    transition: "transform 0.16s ease",
  },
  ".cm-live-callout.is-collapsed .cm-live-callout-fold svg": {
    transform: "rotate(-90deg)",
  },
  ".cm-live-callout.is-collapsed .cm-live-callout-body": { display: "none" },
  ".cm-live-callout-body": {
    marginTop: "6px",
    paddingLeft: "28px",
    lineHeight: "1.68",
    opacity: 0.94,
    whiteSpace: "pre-wrap",
  },
  ".cm-line.cm-live-container-active-line": {
    paddingLeft: "14px",
    paddingRight: "14px",
    borderLeft: `3px solid ${EDITOR_SYNTAX_COLORS.calloutTones.info.border}`,
    backgroundColor: EDITOR_SYNTAX_COLORS.neutralTint04,
  },
  ".cm-line.cm-live-container-active-toggle, .cm-line.cm-live-container-active-bookmark": {
    borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.purple.border,
    backgroundColor: EDITOR_SYNTAX_COLORS.calloutTones.purple.activeBg,
  },
  ".cm-line.cm-live-container-tone-tip": { borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.tip.border, backgroundColor: EDITOR_SYNTAX_COLORS.calloutTones.tip.lineBg },
  ".cm-line.cm-live-container-tone-warning": { borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.warning.border, backgroundColor: EDITOR_SYNTAX_COLORS.calloutTones.warning.lineBg },
  ".cm-line.cm-live-container-tone-danger": { borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.danger.border, backgroundColor: EDITOR_SYNTAX_COLORS.calloutTones.danger.lineBg },
  ".cm-line.cm-live-container-tone-purple": { borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.purple.border, backgroundColor: EDITOR_SYNTAX_COLORS.calloutTones.purple.lineBg },
  ".cm-line.cm-live-container-tone-default": { borderLeftColor: EDITOR_SYNTAX_COLORS.calloutTones.default.border, backgroundColor: EDITOR_SYNTAX_COLORS.neutralTint08 },
  ".cm-line.cm-live-container-line-open": {
    paddingTop: "6px",
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
  },
  ".cm-line.cm-live-container-line-close": {
    paddingBottom: "6px",
    borderBottomLeftRadius: "8px",
    borderBottomRightRadius: "8px",
  },
  ".cm-live-table code, .cm-live-callout code, .cm-live-toggle-block code": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    fontSize: "0.86em",
    color: EDITOR_SYNTAX_COLORS.inlineCodeText,
    backgroundColor: EDITOR_SYNTAX_COLORS.inlineCodeSurface,
    padding: "0.14em 0.38em",
    borderRadius: "4px",
  },
  ".cm-live-table mark.cm-live-highlight, .cm-live-callout mark.cm-live-highlight, .cm-live-toggle-block mark.cm-live-highlight": {
    backgroundColor: EDITOR_SYNTAX_COLORS.calloutHighlightSurface,
    color: "inherit",
    padding: "0.06em 0.24em",
    borderRadius: "3px",
  },
  ".cm-live-table del.cm-live-strikethrough, .cm-live-callout del.cm-live-strikethrough, .cm-live-toggle-block del.cm-live-strikethrough": {
    textDecoration: "line-through",
    opacity: 0.68,
  },
  ...liveTableAndCardThemeSpec,
  ".cm-live-callout-header:focus-visible, .cm-live-toggle-caret:focus-visible, .cm-live-bookmark-open:focus-visible, .cm-live-table-toolbar-btn:focus-visible, .cm-live-table-col-handle:focus-visible, .cm-live-table-row-handle:focus-visible, .cm-live-table-add-col:focus-visible, .cm-live-table-add-row:focus-visible, .cm-live-table-add-corner:focus-visible": {
    outline: `2px solid ${EDITOR_SYNTAX_COLORS.accentBlue}`,
    outlineOffset: "1px",
  },
  "@media (max-width: 768px), (pointer: coarse)": {
    ".cm-live-callout-header": { minHeight: "44px" },
    ".cm-live-toggle-caret, .cm-live-bookmark-open, .cm-live-table-toolbar-btn, .cm-live-table-col-handle, .cm-live-table-row-handle, .cm-live-table-add-col, .cm-live-table-add-corner, .cm-live-table-add-row": {
      minHeight: "44px",
      minWidth: "44px",
    },
  },
  "@media (pointer: coarse) and (min-width: 821px)": {
    ".cm-content": { paddingLeft: "40px" },
  },
  '.cm-content[contenteditable="false"] .cm-live-table-toolbar, .cm-content[contenteditable="false"] .cm-live-table-footer-row, .cm-content[contenteditable="false"] .cm-live-table-add-col, .cm-content[contenteditable="false"] .cm-live-table-col-handle, .cm-content[contenteditable="false"] .cm-live-table-row-handle, .cm-content[contenteditable="false"] .cm-live-table-col-resizer': {
    display: "none",
  },
  "@media (max-width: 820px)": {
    ".cm-content": {
      width: "100%",
      maxWidth: "100%",
      flex: "1 1 auto",
      boxSizing: "border-box",
      padding: "14px 16px 32px 16px",
    },
  },
})
