import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react"
import { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import {
  planMarkdownEditorLineCommand,
  type MarkdownEditorLineCommand,
} from "./markdownEditorLineCommandsModel"
import {
  planToggleListCommand,
  type MarkdownEditorListCommand,
} from "./markdownEditorListCommandsModel"
import {
  applyPlannedTextMutationToValue,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"
import {
  codeBlockSnippet,
  planInsertBlockSnippet,
  planStandaloneSnippetInsertion,
  type BlockSnippetSpec,
} from "./markdownEditorBlockSnippets"
import { type MarkdownEditorCommandDescriptor } from "./markdownEditorCommandRegistryModel"
import { type MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import { type MarkdownEditorLiveSurfaceHandle } from "./MarkdownEditorLiveSurface"
import {
  planMarkdownSnippetMutation,
  planStripBlockLinePrefix,
} from "./markdownEditorBlockModel"
import {
  TABLE_ADD_ROW_EDIT,
  resolveActiveTableCellOffset,
  type useMarkdownEditorTableControls,
} from "./useMarkdownEditorTableControls"

export type EditorSelectionRange = { from: number; to: number }

export type EditorFocusRequestOptions =
  | EditorSelectionRange
  | { insertSnippet: string; fallbackSelection?: EditorSelectionRange }

export type EditorFocusRequest = (options?: EditorFocusRequestOptions) => boolean | void

export type MutationOptions = { clearUploadError?: boolean }

export const executeToolbarCommandAction = (
  action: ReturnType<MarkdownEditorCommandDescriptor["execute"]>,
  applyFormatShortcutOrAppend: (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) => void,
  applyBlockSnippet: (spec: BlockSnippetSpec) => void,
  tableEditAction: ReturnType<typeof useMarkdownEditorTableControls>["tableEditAction"]
): void => {
  if (!action) return
  if (action.kind === "format") return applyFormatShortcutOrAppend(action.shortcut)
  if (action.kind === "block") return applyBlockSnippet(codeBlockSnippet)
  tableEditAction(TABLE_ADD_ROW_EDIT)
}

export const applySurfaceMutationIfAllowed = (
  surface: MarkdownEditorLiveSurfaceHandle | null,
  isAuthoringDisabled: boolean,
  plan: PlannedTextMutation,
  options: MutationOptions | undefined,
  syncSelectionState: (next: EditorSelectionRange) => void,
  clearError: () => void
): boolean => {
  if (!surface || isAuthoringDisabled) return false
  syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
  if (options?.clearUploadError !== false) clearError()
  return surface.applyMutation(plan)
}

export const applySurfaceOrFallbackBackgroundPlan = (
  surface: MarkdownEditorLiveSurfaceHandle | null,
  currentValue: string,
  plan: PlannedTextMutation,
  syncSelectionState: (next: EditorSelectionRange) => void,
  commitMarkdown: (nextMarkdown: string, editorFocused?: boolean, options?: MutationOptions) => void
): boolean => {
  if (surface) {
    syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
    return surface.applyMutation(plan, {
      focus: false,
      scrollIntoView: false,
      addToHistory: false,
      clearUploadError: false,
      replaceTransientContent: true,
    })
  }
  const next = applyPlannedTextMutationToValue(currentValue, plan)
  syncSelectionState({ from: next.selectionStart, to: next.selectionEnd })
  commitMarkdown(next.value, false, { clearUploadError: false })
  return true
}

export const syncDomOrSnapshotSelection = (
  bodyEl: HTMLDivElement | null,
  surface: MarkdownEditorLiveSurfaceHandle | null,
  readValue: () => string,
  selectionRef: MutableRefObject<EditorSelectionRange>,
  syncSelectionState: (next: EditorSelectionRange) => void
): EditorSelectionRange => {
  const tableCellOffset = resolveActiveTableCellOffset(bodyEl, readValue)
  const snapshot = surface?.readSnapshot()
  if (tableCellOffset !== null) {
    syncSelectionState({ from: tableCellOffset, to: tableCellOffset })
  } else if (snapshot) {
    syncSelectionState(snapshot.selection)
  }
  return selectionRef.current
}

export const applyPlannedOrFallbackMutation = (
  isAuthoringDisabled: boolean,
  plan: PlannedTextMutation,
  options: MutationOptions | undefined,
  applyMutationPlan: (plan: PlannedTextMutation, options?: MutationOptions) => boolean,
  applyFallback: (
    plan: PlannedTextMutation,
    options?: MutationOptions
  ) => { value: string; selection: EditorSelectionRange },
  syncSelectionTableAvailability: (markdown: string, selection: EditorSelectionRange) => void
): boolean => {
  if (isAuthoringDisabled) return false
  if (applyMutationPlan(plan, options)) return true
  const next = applyFallback(plan, options)
  syncSelectionTableAvailability(next.value, next.selection)
  return true
}

type LifecycleEffectsInput = {
  value: string
  disabled: boolean
  viewMode: MarkdownEditorSurfaceMode
  valueRef: MutableRefObject<string>
  documentGenerationRef: MutableRefObject<number>
  pendingFindReplaceInvalidationRef: MutableRefObject<boolean>
  liveEditorBodyRef: RefObject<HTMLDivElement | null>
  liveSurfaceRef: RefObject<MarkdownEditorLiveSurfaceHandle | null>
  setDraftValue: (next: string) => void
  resetTableAvailability: () => void
  invalidateFindReplace: (resetQuery?: boolean) => void
  closeSlashMenu: () => void
  resolveActiveSelection: () => EditorSelectionRange
  applyMutationPlan: (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => boolean
  onFlushMarkdownReady?: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: EditorFocusRequest | null) => void
}

export const useMarkdownEditorLifecycleEffects = ({
  value,
  disabled,
  viewMode,
  valueRef,
  documentGenerationRef,
  pendingFindReplaceInvalidationRef,
  liveEditorBodyRef,
  liveSurfaceRef,
  setDraftValue,
  resetTableAvailability,
  invalidateFindReplace,
  closeSlashMenu,
  resolveActiveSelection,
  applyMutationPlan,
  onFlushMarkdownReady,
  onFocusRequestReady,
}: LifecycleEffectsInput) => {
  useEffect(() => {
    if (value === valueRef.current) return
    valueRef.current = value
    setDraftValue(value)
    resetTableAvailability()
    pendingFindReplaceInvalidationRef.current = true
    documentGenerationRef.current += 1
  }, [
    documentGenerationRef,
    pendingFindReplaceInvalidationRef,
    resetTableAvailability,
    setDraftValue,
    value,
    valueRef,
  ])

  useEffect(() => {
    onFlushMarkdownReady?.(() => {
      resolveActiveTableCellOffset(liveEditorBodyRef.current, () => valueRef.current)
      return valueRef.current
    })
    return () => onFlushMarkdownReady?.(null)
  }, [liveEditorBodyRef, onFlushMarkdownReady, valueRef])

  useEffect(() => {
    const focusIfEnabled: EditorFocusRequest = (options) => {
      if (disabled) return false
      if (options && "insertSnippet" in options) {
        if (!liveSurfaceRef.current) return false
        const active = resolveActiveSelection()
        const rawSel =
          active.from === 0 && active.to === 0 && options.fallbackSelection
            ? options.fallbackSelection
            : active
        return applyMutationPlan(
          planStandaloneSnippetInsertion(valueRef.current, rawSel, options.insertSnippet)
        )
      }
      liveSurfaceRef.current?.focus(options)
      return true
    }
    onFocusRequestReady?.(focusIfEnabled)
    return () => onFocusRequestReady?.(null)
  }, [
    applyMutationPlan,
    disabled,
    liveSurfaceRef,
    onFocusRequestReady,
    resolveActiveSelection,
    valueRef,
  ])

  useEffect(() => {
    if (!pendingFindReplaceInvalidationRef.current) return
    pendingFindReplaceInvalidationRef.current = false
    invalidateFindReplace(true)
  }, [invalidateFindReplace, pendingFindReplaceInvalidationRef, value])

  useEffect(() => {
    if (viewMode !== "live" || disabled) closeSlashMenu()
  }, [closeSlashMenu, disabled, viewMode])
}

type CommandActionsInput = {
  isAuthoringDisabled: boolean
  isTableSelection: boolean
  valueRef: MutableRefObject<string>
  selectionRef: MutableRefObject<EditorSelectionRange>
  liveSurfaceRef: RefObject<MarkdownEditorLiveSurfaceHandle | null>
  resolveActiveSelection: () => EditorSelectionRange
  applyMutationPlan: (plan: PlannedTextMutation, options?: MutationOptions) => boolean
  applyPlannedMarkdownMutation: (plan: PlannedTextMutation, options?: MutationOptions) => boolean
  tableEditAction: ReturnType<typeof useMarkdownEditorTableControls>["tableEditAction"]
}

export const useMarkdownEditorCommandActions = ({
  isAuthoringDisabled,
  isTableSelection,
  valueRef,
  selectionRef,
  liveSurfaceRef,
  resolveActiveSelection,
  applyMutationPlan,
  applyPlannedMarkdownMutation,
  tableEditAction,
}: CommandActionsInput) => {
  const applyOptionalPlan = useCallback(
    (plan: PlannedTextMutation | null) => (plan ? applyMutationPlan(plan) : false),
    [applyMutationPlan]
  )

  const runAuthoringAction = useCallback(
    (fn: (sel: EditorSelectionRange) => void) => {
      if (!isAuthoringDisabled) fn(resolveActiveSelection())
    },
    [isAuthoringDisabled, resolveActiveSelection]
  )

  const insertMarkdownAtEditorSelection = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (!liveSurfaceRef.current || isAuthoringDisabled) return false
      const { from, to } = resolveActiveSelection()
      return applyOptionalPlan(
        planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      )
    },
    [applyOptionalPlan, isAuthoringDisabled, liveSurfaceRef, resolveActiveSelection, valueRef]
  )

  const applyBlockSnippet = useCallback(
    (spec: BlockSnippetSpec) =>
      runAuthoringAction(({ from, to }) =>
        applyPlannedMarkdownMutation(planInsertBlockSnippet(from, to, spec))
      ),
    [applyPlannedMarkdownMutation, runAuthoringAction]
  )

  const applyFormatShortcutOrAppend = useCallback(
    (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) =>
      runAuthoringAction(({ from, to }) =>
        applyPlannedMarkdownMutation(
          planFormatShortcutMutation(valueRef.current, from, to, shortcut)
        )
      ),
    [applyPlannedMarkdownMutation, runAuthoringAction, valueRef]
  )

  const applyMarkdownEditorCommand = useCallback(
    (command: MarkdownEditorCommandDescriptor) => {
      const action = command.execute({
        disabled: isAuthoringDisabled,
        selectionStart: selectionRef.current.from,
        selectionEnd: selectionRef.current.to,
        isTableSelection,
      })
      executeToolbarCommandAction(
        action,
        applyFormatShortcutOrAppend,
        applyBlockSnippet,
        tableEditAction
      )
    },
    [
      applyBlockSnippet,
      applyFormatShortcutOrAppend,
      isAuthoringDisabled,
      isTableSelection,
      selectionRef,
      tableEditAction,
    ]
  )

  const applySnippet = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (isAuthoringDisabled || insertMarkdownAtEditorSelection(before, after, options)) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      if (plan) applyPlannedMarkdownMutation(plan)
    },
    [
      applyPlannedMarkdownMutation,
      insertMarkdownAtEditorSelection,
      isAuthoringDisabled,
      resolveActiveSelection,
      valueRef,
    ]
  )

  const applyListCommand = useCallback(
    (command: MarkdownEditorListCommand) =>
      runAuthoringAction(({ from, to }) =>
        applyOptionalPlan(planToggleListCommand(valueRef.current, from, to, command))
      ),
    [applyOptionalPlan, runAuthoringAction, valueRef]
  )

  const applyStripBlockPrefix = useCallback(
    () =>
      runAuthoringAction(({ from, to }) =>
        applyOptionalPlan(planStripBlockLinePrefix(valueRef.current, from, to))
      ),
    [applyOptionalPlan, runAuthoringAction, valueRef]
  )

  const applyLineCommand = useCallback(
    (command: MarkdownEditorLineCommand) =>
      runAuthoringAction(({ from, to }) =>
        applyOptionalPlan(planMarkdownEditorLineCommand(valueRef.current, from, to, command))
      ),
    [applyOptionalPlan, runAuthoringAction, valueRef]
  )

  return {
    insertMarkdownAtEditorSelection,
    applyBlockSnippet,
    applyFormatShortcutOrAppend,
    applyMarkdownEditorCommand,
    applySnippet,
    applyListCommand,
    applyStripBlockPrefix,
    applyLineCommand,
  }
}
