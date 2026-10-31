import { type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, useCallback } from "react"
import {
  isComposingEditorKeyboardEvent,
  isOffsetInsideFencedCodeBlock,
  isSaveShortcut,
  planFormatShortcutMutation,
  planHardBreak,
  planListEnterContinuation,
  planMarkdownEditorTableEnter,
  planTableCellTabMutation,
  resolveMarkdownEditorCommandShortcut,
  resolveFormatShortcut,
  resolveMarkdownEditorLineCommand,
} from "./markdownEditorKeyboardModel"
import { planMarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import {
  planMarkdownEditorAutoPairBackspace,
  planMarkdownEditorAutoPairInsert,
} from "./markdownEditorAutoPairModel"
import {
  planNotionBlockPrefixBackspace,
  planNotionSpaceInputRule,
} from "./markdownEditorNotionModel"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"

type TextareaSelection = {
  from: number
  to: number
}

type UseMarkdownEditorTextareaKeyboardArgs = {
  disabled: boolean
  authoringDisabled?: boolean
  valueRef: MutableRefObject<string>
  allowNativeTabAfterEscapeRef: MutableRefObject<boolean>
  rememberTextareaSelection: () => TextareaSelection
  applyMutationPlan: (plan: PlannedTextMutation) => boolean
  applyRecordedMutation: (plan: PlannedTextMutation) => boolean
  setTextareaSelection: (from: number, to?: number) => void
  onRequestSave?: () => void
  onToggleViewMode?: () => void
  isCompletionActive?: () => boolean
}

export const useMarkdownEditorTextareaKeyboard = ({
  disabled,
  authoringDisabled = disabled,
  valueRef,
  allowNativeTabAfterEscapeRef,
  rememberTextareaSelection,
  applyMutationPlan,
  applyRecordedMutation,
  setTextareaSelection,
  onRequestSave,
  onToggleViewMode,
  isCompletionActive,
}: UseMarkdownEditorTextareaKeyboardArgs) => {
  const handleTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (allowNativeTabAfterEscapeRef.current) {
        allowNativeTabAfterEscapeRef.current = false
        return
      }
      const { from, to } = rememberTextareaSelection()
      const tableTabPlan = planTableCellTabMutation(valueRef.current, from, to, event.shiftKey)
      if (tableTabPlan.handledTable) {
        event.preventDefault()
        if (tableTabPlan.mutation) applyMutationPlan(tableTabPlan.mutation)
        return
      }
      if (!tableTabPlan.mutation) {
        if (event.shiftKey) return
        event.preventDefault()
        return
      }
      event.preventDefault()
      applyMutationPlan(tableTabPlan.mutation)
    },
    [allowNativeTabAfterEscapeRef, applyMutationPlan, rememberTextareaSelection, valueRef]
  )

  const handleEnterKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (event.key !== "Enter") return false

      if (event.shiftKey) {
        event.preventDefault()
        const { from, to } = rememberTextareaSelection()
        if (isOffsetInsideFencedCodeBlock(valueRef.current, from)) {
          applyMutationPlan(planReplaceSelection(from, to, "\n"))
        } else {
          applyMutationPlan(planHardBreak(from, to))
        }
        return true
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return false

      const { from, to } = rememberTextareaSelection()
      const tableEnterPlan = planMarkdownEditorTableEnter(valueRef.current, from, to)
      if (tableEnterPlan) {
        event.preventDefault()
        applyMutationPlan(tableEnterPlan)
        return true
      }

      const listPlan = planListEnterContinuation(valueRef.current, from, to)
      if (!listPlan) return true
      event.preventDefault()
      applyMutationPlan(listPlan)
      return true
    },
    [applyMutationPlan, rememberTextareaSelection, valueRef]
  )

  const handleSaveShortcutKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (!isSaveShortcut(event)) return false
      if (!onRequestSave) return true
      event.preventDefault()
      onRequestSave()
      return true
    },
    [onRequestSave]
  )

  const handleViewModeShortcutKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "e" || event.key === "E") &&
        !event.shiftKey &&
        !event.altKey &&
        onToggleViewMode
      ) {
        event.preventDefault()
        onToggleViewMode()
        return true
      }
      return false
    },
    [onToggleViewMode]
  )

  const handleFormatShortcutKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      const command = resolveMarkdownEditorCommandShortcut(event)
      if (command) {
        event.preventDefault()
        const { from, to } = rememberTextareaSelection()
        const action = command.execute({
          disabled: authoringDisabled,
          selectionStart: from,
          selectionEnd: to,
          isTableSelection: false,
        })
        if (action?.kind === "format") {
          applyMutationPlan(planFormatShortcutMutation(valueRef.current, from, to, action.shortcut))
        }
        return true
      }
      if (handleViewModeShortcutKeyDown(event)) return true
      const formatShortcut = resolveFormatShortcut(event)
      if (!formatShortcut) return false
      event.preventDefault()
      const { from, to } = rememberTextareaSelection()
      applyMutationPlan(planFormatShortcutMutation(valueRef.current, from, to, formatShortcut))
      return true
    },
    [applyMutationPlan, authoringDisabled, handleViewModeShortcutKeyDown, rememberTextareaSelection, valueRef]
  )

  const handleLineCommandKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      const command = resolveMarkdownEditorLineCommand(event)
      if (!command) return false

      event.preventDefault()
      const { from, to } = rememberTextareaSelection()
      const plan = planMarkdownEditorLineCommand(valueRef.current, from, to, command)
      if (plan) applyRecordedMutation(plan)
      return true
    },
    [applyRecordedMutation, rememberTextareaSelection, valueRef]
  )

  const handleAutoPairKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (event.metaKey || event.ctrlKey || event.altKey) return false

      const { from, to } = rememberTextareaSelection()
      if (event.key === "Backspace") {
        const prefixPlan = planNotionBlockPrefixBackspace(valueRef.current, from, to)
        if (prefixPlan) {
          event.preventDefault()
          applyRecordedMutation(prefixPlan)
          return true
        }
      }
      if (event.key === " ") {
        const spacePlan = planNotionSpaceInputRule(valueRef.current, from, to)
        if (spacePlan) {
          event.preventDefault()
          applyRecordedMutation(spacePlan)
          return true
        }
      }

      const action = event.key === "Backspace"
        ? planMarkdownEditorAutoPairBackspace(valueRef.current, from, to)
        : planMarkdownEditorAutoPairInsert(valueRef.current, from, to, event.key)
      if (!action) return false

      event.preventDefault()
      if (action.kind === "mutation") applyRecordedMutation(action.mutation)
      else setTextareaSelection(action.selectionStart, action.selectionEnd)
      return true
    },
    [applyRecordedMutation, rememberTextareaSelection, setTextareaSelection, valueRef]
  )

  const handleHomeEndKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (event.shiftKey || (!event.metaKey && !event.ctrlKey)) return false
      if (event.key === "Home") {
        event.preventDefault()
        setTextareaSelection(0)
        return true
      }
      if (event.key === "End") {
        event.preventDefault()
        setTextareaSelection(valueRef.current.length)
        return true
      }
      return false
    },
    [setTextareaSelection, valueRef]
  )

  const handleTextareaKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (disabled || event.defaultPrevented || isComposingEditorKeyboardEvent(event)) return

      if (authoringDisabled) {
        if (handleSaveShortcutKeyDown(event)) return
        if (handleViewModeShortcutKeyDown(event)) return
        handleHomeEndKeyDown(event)
        return
      }

      const targetElement = event.target as HTMLElement | null
      const targetTagName = targetElement?.tagName
      const isInsideTableWidget =
        typeof targetElement?.closest === "function" &&
        targetElement.closest(".cm-live-table-wrap") !== null
      if (targetTagName === "INPUT" || targetTagName === "TEXTAREA" || isInsideTableWidget) {
        handleSaveShortcutKeyDown(event)
        return
      }

      if (
        isCompletionActive?.() &&
        (event.key === "Enter" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "Tab" ||
          event.key === "Escape")
      ) {
        return
      }

      if (event.key === "Escape") {
        allowNativeTabAfterEscapeRef.current = true
        return
      }

      if (event.key === "Tab") {
        handleTabKeyDown(event)
        return
      }

      allowNativeTabAfterEscapeRef.current = false

      if (handleEnterKeyDown(event)) return
      if (handleSaveShortcutKeyDown(event)) return
      if (handleFormatShortcutKeyDown(event)) return
      if (handleLineCommandKeyDown(event)) return
      if (handleAutoPairKeyDown(event)) return
      handleHomeEndKeyDown(event)
    },
    [
      allowNativeTabAfterEscapeRef,
      authoringDisabled,
      disabled,
      handleEnterKeyDown,
      handleFormatShortcutKeyDown,
      handleHomeEndKeyDown,
      handleLineCommandKeyDown,
      handleAutoPairKeyDown,
      handleSaveShortcutKeyDown,
      handleTabKeyDown,
      handleViewModeShortcutKeyDown,
      isCompletionActive,
    ]
  )

  return { handleTextareaKeyDown }
}
