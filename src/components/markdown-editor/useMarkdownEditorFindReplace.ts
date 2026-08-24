import { useCallback, useEffect, useMemo, useState } from "react"
import {
  findMarkdownEditorMatches,
  planMarkdownEditorReplaceAll,
  planMarkdownEditorReplaceCurrent,
  selectMarkdownEditorMatch,
  type MarkdownEditorTextRange,
} from "./markdownEditorFindReplaceModel"
import { isComposingEditorKeyboardEvent } from "./markdownEditorKeyboardModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

type TextareaSelection = { from: number; to: number }

type EditorSnapshot = {
  documentValue: string
  selection: TextareaSelection
}

type HistorySnapshot = EditorSnapshot & { scope?: MarkdownEditorTextRange }
type HistoryEntry = { before: HistorySnapshot; after: HistorySnapshot }
type FindPanelSession = HistorySnapshot & { activeMatch: MarkdownEditorTextRange | null; stale: boolean }
type FindHistory = { documentValue: string; undoStack: HistoryEntry[]; redoStack: HistoryEntry[] }

type UseMarkdownEditorFindReplaceArgs = {
  disabled: boolean
  preview: boolean
  draftValue: string
  readSnapshot: () => EditorSnapshot | null
  selectRange: (from: number, to?: number) => void
  applyMutation: (plan: PlannedTextMutation) => boolean
}

const matchMatchesSelection = (match: MarkdownEditorTextRange, selection: TextareaSelection) =>
  match.start === selection.from && match.end === selection.to

const makeSnapshot = (documentValue: string, selection: TextareaSelection, scope?: MarkdownEditorTextRange): HistorySnapshot => ({
  documentValue,
  selection,
  ...(scope ? { scope } : {}),
})

export const useMarkdownEditorFindReplace = ({
  disabled,
  preview,
  draftValue,
  readSnapshot,
  selectRange,
  applyMutation,
}: UseMarkdownEditorFindReplaceArgs) => {
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [panel, setPanel] = useState<FindPanelSession | null>(null)
  const [history, setHistory] = useState<FindHistory | null>(null)

  useEffect(() => {
    setPanel((current) =>
      current && current.documentValue !== draftValue ? { ...current, activeMatch: null, stale: true } : current
    )
    setHistory((current) => (current && current.documentValue !== draftValue ? null : current))
  }, [draftValue])

  const matches = useMemo(
    () =>
      panel && !panel.stale && panel.documentValue === draftValue
        ? findMarkdownEditorMatches(panel.documentValue, query, { caseSensitive, scope: panel.scope })
        : [],
    [caseSensitive, draftValue, panel, query]
  )
  const activeMatchIndex = panel?.activeMatch
    ? matches.findIndex((match) => match.start === panel.activeMatch?.start && match.end === panel.activeMatch?.end)
    : -1

  const closePanel = useCallback(() => setPanel(null), [])

  const invalidate = useCallback((external = false) => {
    setHistory(null)
    setPanel((current) => (external || !current ? null : { ...current, activeMatch: null, stale: true }))
  }, [])

  const onSelectionChange = useCallback((selection: TextareaSelection) => {
    const activeMatch = panel?.activeMatch
    if (!activeMatch || matchMatchesSelection(activeMatch, selection)) return
    setPanel((current) => {
      if (!current?.activeMatch || matchMatchesSelection(current.activeMatch, selection)) return current
      return { ...current, activeMatch: null }
    })
  }, [panel])

  const open = useCallback(() => {
    if (disabled || preview) return
    const snapshot = readSnapshot()
    if (!snapshot) return
    const scope = snapshot.selection.from === snapshot.selection.to
      ? undefined
      : { start: snapshot.selection.from, end: snapshot.selection.to }
    setPanel({ ...makeSnapshot(snapshot.documentValue, snapshot.selection, scope), activeMatch: null, stale: false })
  }, [disabled, preview, readSnapshot])

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setPanel((current) => (current && !current.stale ? { ...current, activeMatch: null } : current))
  }, [])

  const updateCaseSensitive = useCallback((value: boolean) => {
    setCaseSensitive(value)
    setPanel((current) => (current && !current.stale ? { ...current, activeMatch: null } : current))
  }, [])

  const isCurrentPanel = useCallback(
    (current: FindPanelSession, snapshot: EditorSnapshot | null) =>
      !disabled &&
      !preview &&
      !current.stale &&
      current.documentValue === draftValue &&
      Boolean(snapshot && snapshot.documentValue === current.documentValue),
    [disabled, draftValue, preview]
  )

  const move = useCallback(
    (direction: "next" | "previous") => {
      if (!panel) return
      const snapshot = readSnapshot()
      if (!isCurrentPanel(panel, snapshot) || !snapshot) return
      const activeMatch = panel.activeMatch
      const anchor: TextareaSelection =
        activeMatch && matchMatchesSelection(activeMatch, snapshot.selection)
          ? { from: activeMatch.start, to: activeMatch.end }
          : snapshot.selection
      const match = selectMarkdownEditorMatch(panel.documentValue, query, anchor.from, anchor.to, direction, {
        caseSensitive,
        scope: panel.scope,
      })
      if (!match) return
      selectRange(match.start, match.end)
      setPanel({ ...panel, activeMatch: match })
    },
    [caseSensitive, isCurrentPanel, panel, query, readSnapshot, selectRange]
  )

  const applyReplacement = useCallback(
    (kind: "current" | "all") => {
      if (!panel) return
      const snapshot = readSnapshot()
      if (!isCurrentPanel(panel, snapshot) || !snapshot) return
      const planned =
        kind === "current"
          ? panel.activeMatch && matchMatchesSelection(panel.activeMatch, snapshot.selection)
            ? planMarkdownEditorReplaceCurrent(panel.documentValue, query, replacement, {
                caseSensitive,
                scope: panel.scope,
                match: panel.activeMatch,
              })
            : null
          : planMarkdownEditorReplaceAll(panel.documentValue, query, replacement, {
              caseSensitive,
              scope: panel.scope,
            })
      if (!planned || !applyMutation(planned.mutation)) return

      const { rangeStart, rangeEnd, replacement: nextReplacement, selectionStart, selectionEnd } = planned.mutation
      const nextDocument = `${panel.documentValue.slice(0, rangeStart)}${nextReplacement}${panel.documentValue.slice(rangeEnd)}`
      const before = makeSnapshot(panel.documentValue, snapshot.selection, panel.scope)
      const after = makeSnapshot(nextDocument, { from: selectionStart, to: selectionEnd }, planned.scope)
      const base = history && history.documentValue === panel.documentValue ? history : { documentValue: panel.documentValue, undoStack: [], redoStack: [] }
      setHistory({ documentValue: nextDocument, undoStack: [...base.undoStack, { before, after }], redoStack: [] })
      setPanel({ ...after, activeMatch: null, stale: false })
    },
    [applyMutation, caseSensitive, history, isCurrentPanel, panel, query, readSnapshot, replacement]
  )

  const handleUndoRedo = useCallback(
    (event: {
      metaKey: boolean
      ctrlKey: boolean
      altKey: boolean
      shiftKey: boolean
      key: string
      nativeEvent: { isComposing?: boolean; keyCode?: number }
    }) => {
      if (
        isComposingEditorKeyboardEvent(event) ||
        (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "z") ||
        !history
      ) {
        return false
      }
      const snapshot = readSnapshot()
      if (!snapshot || snapshot.documentValue !== history.documentValue || snapshot.documentValue !== draftValue) return false
      const undo = !event.shiftKey
      const entry = undo ? history.undoStack.at(-1) : history.redoStack[0]
      if (!entry) return false
      const target = undo ? entry.before : entry.after
      if (
        !applyMutation({
          rangeStart: 0,
          rangeEnd: snapshot.documentValue.length,
          replacement: target.documentValue,
          selectionStart: target.selection.from,
          selectionEnd: target.selection.to,
        })
      ) {
        return false
      }
      setHistory({
        documentValue: target.documentValue,
        undoStack: undo ? history.undoStack.slice(0, -1) : [...history.undoStack, entry],
        redoStack: undo ? [entry, ...history.redoStack] : history.redoStack.slice(1),
      })
      setPanel((current) =>
        current && current.documentValue === snapshot.documentValue
          ? { ...makeSnapshot(target.documentValue, target.selection, target.scope), activeMatch: null, stale: false }
          : current
      )
      return true
    },
    [applyMutation, draftValue, history, readSnapshot]
  )

  return {
    panel,
    query,
    replacement,
    caseSensitive,
    totalMatches: matches.length,
    currentMatch: activeMatchIndex + 1,
    panelDisabled: disabled || Boolean(panel?.stale),
    replaceCurrentDisabled: !panel?.activeMatch || panel.stale || panel.documentValue !== draftValue,
    open,
    closePanel,
    invalidate,
    onSelectionChange,
    updateQuery,
    updateReplacement: setReplacement,
    updateCaseSensitive,
    move,
    replaceCurrent: () => applyReplacement("current"),
    replaceAll: () => applyReplacement("all"),
    handleUndoRedo,
  }
}
