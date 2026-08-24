import { useCallback, useEffect, useMemo, useState } from "react"
import {
  findMarkdownEditorMatches,
  planMarkdownEditorReplaceAll,
  planMarkdownEditorReplaceCurrent,
  selectMarkdownEditorMatch,
  type MarkdownEditorTextRange,
} from "./markdownEditorFindReplaceModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

type TextareaSelection = { from: number; to: number }

type EditorSnapshot = {
  documentValue: string
  selection: TextareaSelection
}

type FindPanelSession = EditorSnapshot & {
  scope?: MarkdownEditorTextRange
  activeMatch: MarkdownEditorTextRange | null
  stale: boolean
}

type UseMarkdownEditorFindReplaceArgs = {
  disabled: boolean
  preview: boolean
  draftValue: string
  readSnapshot: () => EditorSnapshot | null
  selectRange: (from: number, to?: number) => void
  applyRecordedMutation: (plan: PlannedTextMutation) => boolean
}

const matchMatchesSelection = (match: MarkdownEditorTextRange, selection: TextareaSelection) =>
  match.start === selection.from && match.end === selection.to

const makeSnapshot = (documentValue: string, selection: TextareaSelection, scope?: MarkdownEditorTextRange) => ({
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
  applyRecordedMutation,
}: UseMarkdownEditorFindReplaceArgs) => {
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [panel, setPanel] = useState<FindPanelSession | null>(null)

  useEffect(() => {
    setPanel((current) =>
      current && current.documentValue !== draftValue ? { ...current, activeMatch: null, stale: true } : current
    )
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
      if (!planned || !applyRecordedMutation(planned.mutation)) return

      const { rangeStart, rangeEnd, replacement: nextReplacement, selectionStart, selectionEnd } = planned.mutation
      const nextDocument = `${panel.documentValue.slice(0, rangeStart)}${nextReplacement}${panel.documentValue.slice(rangeEnd)}`
      const after = makeSnapshot(nextDocument, { from: selectionStart, to: selectionEnd }, planned.scope)
      setPanel({ ...after, activeMatch: null, stale: false })
    },
    [applyRecordedMutation, caseSensitive, isCurrentPanel, panel, query, readSnapshot, replacement]
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
  }
}
