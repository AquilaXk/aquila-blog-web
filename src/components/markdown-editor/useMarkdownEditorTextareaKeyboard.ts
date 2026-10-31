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

const COMPLETION_HANDLED_KEYS = new Set(["Enter", "ArrowUp", "ArrowDown", "Tab", "Escape"])

const isCompletionHandledKey = (key: string): boolean => COMPLETION_HANDLED_KEYS.has(key)

const isInsideTableOrFormInput = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  const tagName = element?.tagName
  if (tagName === "INPUT" || tagName === "TEXTAREA") return true
  return typeof element?.closest === "function" && element.closest(".cm-live-table-wrap") !== null
}

const isIgnoredEditorKeyEvent = (
  disabled: boolean,
  event: ReactKeyboardEvent<HTMLElement>
): boolean => disabled || event.defaultPrevented || isComposingEditorKeyboardEvent(event)

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
        if (!event.shiftKey) event.preventDefault()
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
        const plan = isOffsetInsideFencedCodeBlock(valueRef.current, from)
          ? planReplaceSelection(from, to, "\n")
          : planHardBreak(from, to)
        applyMutationPlan(plan)
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
      if (listPlan) {
        event.preventDefault()
        applyMutationPlan(listPlan)
      }
      return true
    },
    [applyMutationPlan, rememberTextareaSelection, valueRef]
  )

  const handleSaveShortcutKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      if (!isSaveShortcut(event)) return false
      if (onRequestSave) {
        event.preventDefault()
        onRequestSave()
      }
      return true
    },
    [onRequestSave]
  )

  const handleViewModeShortcutKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): boolean => {
      const isModToggle =
        (event.metaKey || event.ctrlKey) &&
        (event.key === "e" || event.key === "E") &&
        !event.shiftKey &&
        !event.altKey
      if (!isModToggle || !onToggleViewMode) return false
      event.preventDefault()
      onToggleViewMode()
      return true
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
      let rulePlan: PlannedTextMutation | null = null
      if (event.key === "Backspace") rulePlan = planNotionBlockPrefixBackspace(valueRef.current, from, to)
      else if (event.key === " ") rulePlan = planNotionSpaceInputRule(valueRef.current, from, to)
      if (rulePlan) {
        event.preventDefault()
        applyRecordedMutation(rulePlan)
        return true
      }
      const action =
        event.key === "Backspace"
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
      if (event.key !== "Home" && event.key !== "End") return false
      event.preventDefault()
      setTextareaSelection(event.key === "Home" ? 0 : valueRef.current.length)
      return true
    },
    [setTextareaSelection, valueRef]
  )

  const runReadOnlyKeyHandlers = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      for (const handler of [handleSaveShortcutKeyDown, handleViewModeShortcutKeyDown, handleHomeEndKeyDown]) {
        if (handler(event)) return
      }
    },
    [handleHomeEndKeyDown, handleSaveShortcutKeyDown, handleViewModeShortcutKeyDown]
  )

  const runAuthoringKeyHandlers = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const handlers = [
        handleEnterKeyDown,
        handleSaveShortcutKeyDown,
        handleFormatShortcutKeyDown,
        handleLineCommandKeyDown,
        handleAutoPairKeyDown,
        handleHomeEndKeyDown,
      ]
      for (const handler of handlers) {
        if (handler(event)) return
      }
    },
    [
      handleAutoPairKeyDown,
      handleEnterKeyDown,
      handleFormatShortcutKeyDown,
      handleHomeEndKeyDown,
      handleLineCommandKeyDown,
      handleSaveShortcutKeyDown,
    ]
  )

  const handleTextareaKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (isIgnoredEditorKeyEvent(disabled, event)) return
      if (authoringDisabled) {
        runReadOnlyKeyHandlers(event)
        return
      }
      if (isInsideTableOrFormInput(event.target)) {
        handleSaveShortcutKeyDown(event)
        return
      }
      if (isCompletionActive?.() && isCompletionHandledKey(event.key)) return
      if (event.key === "Escape") {
        allowNativeTabAfterEscapeRef.current = true
        return
      }
      if (event.key === "Tab") {
        handleTabKeyDown(event)
        return
      }
      allowNativeTabAfterEscapeRef.current = false
      runAuthoringKeyHandlers(event)
    },
    [
      allowNativeTabAfterEscapeRef,
      authoringDisabled,
      disabled,
      handleSaveShortcutKeyDown,
      handleTabKeyDown,
      isCompletionActive,
      runAuthoringKeyHandlers,
      runReadOnlyKeyHandlers,
    ]
  )

  return { handleTextareaKeyDown }
}
