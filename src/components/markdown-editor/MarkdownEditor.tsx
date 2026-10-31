import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react"
import { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import { planMarkdownEditorLineCommand, type MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import { planToggleListCommand, type MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { EditorRoot, ToolbarError, LiveEditorBody } from "./MarkdownEditor.styles"
import { applyPlannedTextMutationToValue, type PlannedTextMutation } from "./markdownEditorTextMutation"
import { codeBlockSnippet, planInsertBlockSnippet, type BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import { projectMarkdownEditorToolbarCommands, type MarkdownEditorCommandDescriptor } from "./markdownEditorCommandRegistryModel"
import { MarkdownEditorFindReplace } from "./MarkdownEditorFindReplace"
import { useMarkdownEditorFindReplace } from "./useMarkdownEditorFindReplace"
import { type MarkdownFileUploadResult, type MarkdownImageUploadResult } from "./markdownEditorUploadModel"
import { modShortcutLabel } from "./markdownEditorToolbarModel"
import { useMarkdownEditorMediaTransfers } from "./useMarkdownEditorMediaTransfers"
import { useMarkdownEditorTextareaKeyboard } from "./useMarkdownEditorTextareaKeyboard"
import { type MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import { MarkdownEditorLiveSurface, type MarkdownEditorLiveSurfaceHandle } from "./MarkdownEditorLiveSurface"
import { planMarkdownSnippetMutation, planStripBlockLinePrefix } from "./markdownEditorNotionModel"
import { MarkdownEditorNotionChrome } from "./MarkdownEditorNotionChrome"
import { MarkdownEditorSlashMenu } from "./MarkdownEditorSlashMenu"
import { MarkdownEditorToolbar } from "./MarkdownEditorToolbar"
import { useMarkdownEditorSlashMenu } from "./useMarkdownEditorSlashMenu"
import {
  TABLE_ADD_ROW_EDIT,
  resolveActiveTableCellOffset,
  useMarkdownEditorTableControls,
} from "./useMarkdownEditorTableControls"
export { isTableEditActionDisabled, resolveActiveTableCellOffset } from "./useMarkdownEditorTableControls"
export { matchSlashCommandTrigger, resolveSlashCommandMutation, SLASH_COMMAND_SPECS } from "./useMarkdownEditorSlashMenu"

type MarkdownChangeMeta = { editorFocused: boolean }
export type MarkdownEditorFocusSelection = { from: number; to: number }
export type MarkdownEditorFocusRequest = (selection?: MarkdownEditorFocusSelection) => void

type MarkdownEditorProps = {
  value: string
  disabled?: boolean
  disableMermaid?: boolean
  onRequestFocusTitle?: () => void
  onChange: (markdown: string, meta?: MarkdownChangeMeta) => void
  onSelectionChange?: (selection: MarkdownEditorFocusSelection) => void
  onFlushMarkdownReady?: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: MarkdownEditorFocusRequest | null) => void
  onRequestSave?: () => void
  onUploadingChange?: (isUploading: boolean) => void
  onUploadImage?: (file: File) => Promise<MarkdownImageUploadResult>
  onUploadFile?: (file: File) => Promise<MarkdownFileUploadResult>
}

type TextareaSelection = MarkdownEditorFocusSelection

const nextEditorViewMode = (prev: MarkdownEditorSurfaceMode): MarkdownEditorSurfaceMode => {
  if (prev === "live") return "source"
  return prev === "source" ? "reading" : "live"
}

const isEditorAuthoringDisabled = (disabled: boolean, viewMode: MarkdownEditorSurfaceMode): boolean =>
  disabled || viewMode === "reading"

const selectSameOrNextSelection = (prev: TextareaSelection, next: TextareaSelection): TextareaSelection =>
  prev.from === next.from && prev.to === next.to ? prev : next

const clampSelectionToLength = (from: number, to: number, length: number): TextareaSelection => ({
  from: Math.max(0, Math.min(from, length)),
  to: Math.max(0, Math.min(to, length)),
})

const createOptionalInputPicker = (
  enabled: boolean,
  inputRef: RefObject<HTMLInputElement | null>
): (() => void) | undefined => (enabled ? () => inputRef.current?.click() : undefined)

const selectOptionalCallback = <T,>(enabled: boolean, callback: T): T | undefined =>
  enabled ? callback : undefined

const TEXTAREA_KEYBOARD_HELP =
  `표 셀에서는 Tab과 Shift+Tab으로 다음 또는 이전 셀로 이동합니다. 표 밖에서는 Tab은 2칸 들여쓰기, Shift+Tab은 내어쓰기입니다. 괄호·따옴표·인라인 코드는 자동으로 쌍을 입력합니다. Alt+ArrowUp과 Alt+ArrowDown은 현재 줄을 이동하고, Shift+Alt+ArrowDown은 복제합니다. ${modShortcutLabel}Shift+K는 현재 줄을 삭제합니다. Escape를 누른 다음 Tab은 포커스를 다음 요소로 이동합니다.`

type LifecycleEffectsInput = {
  value: string; disabled: boolean; viewMode: MarkdownEditorSurfaceMode
  valueRef: MutableRefObject<string>; documentGenerationRef: MutableRefObject<number>
  pendingFindReplaceInvalidationRef: MutableRefObject<boolean>
  liveEditorBodyRef: RefObject<HTMLDivElement | null>
  liveSurfaceRef: RefObject<MarkdownEditorLiveSurfaceHandle | null>
  setDraftValue: (next: string) => void; resetTableAvailability: () => void
  invalidateFindReplace: (resetQuery?: boolean) => void; closeSlashMenu: () => void
  onFlushMarkdownReady?: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: MarkdownEditorFocusRequest | null) => void
}

const useMarkdownEditorLifecycleEffects = ({
  value, disabled, viewMode, valueRef, documentGenerationRef, pendingFindReplaceInvalidationRef,
  liveEditorBodyRef, liveSurfaceRef, setDraftValue, resetTableAvailability,
  invalidateFindReplace, closeSlashMenu, onFlushMarkdownReady, onFocusRequestReady,
}: LifecycleEffectsInput) => {
  useEffect(() => {
    if (value === valueRef.current) return
    valueRef.current = value
    setDraftValue(value)
    resetTableAvailability()
    pendingFindReplaceInvalidationRef.current = true
    documentGenerationRef.current += 1
  }, [documentGenerationRef, pendingFindReplaceInvalidationRef, resetTableAvailability, setDraftValue, value, valueRef])

  useEffect(() => {
    onFlushMarkdownReady?.(() => {
      resolveActiveTableCellOffset(liveEditorBodyRef.current, () => valueRef.current)
      return valueRef.current
    })
    return () => onFlushMarkdownReady?.(null)
  }, [liveEditorBodyRef, onFlushMarkdownReady, valueRef])

  useEffect(() => {
    const focusIfEnabled: MarkdownEditorFocusRequest = (selection) => {
      if (!disabled) liveSurfaceRef.current?.focus(selection)
    }
    onFocusRequestReady?.(focusIfEnabled)
    return () => onFocusRequestReady?.(null)
  }, [disabled, liveSurfaceRef, onFocusRequestReady])

  useEffect(() => {
    if (!pendingFindReplaceInvalidationRef.current) return
    pendingFindReplaceInvalidationRef.current = false
    invalidateFindReplace(true)
  }, [invalidateFindReplace, pendingFindReplaceInvalidationRef, value])

  useEffect(() => {
    if (viewMode !== "live" || disabled) closeSlashMenu()
  }, [closeSlashMenu, disabled, viewMode])
}

type MutationOptions = { clearUploadError?: boolean }

type CommandActionsInput = {
  isAuthoringDisabled: boolean; isTableSelection: boolean
  valueRef: MutableRefObject<string>; selectionRef: MutableRefObject<TextareaSelection>
  liveSurfaceRef: RefObject<MarkdownEditorLiveSurfaceHandle | null>
  resolveActiveSelection: () => TextareaSelection
  applyMutationPlan: (plan: PlannedTextMutation, options?: MutationOptions) => boolean
  applyPlannedMarkdownMutation: (plan: PlannedTextMutation, options?: MutationOptions) => boolean
  tableEditAction: ReturnType<typeof useMarkdownEditorTableControls>["tableEditAction"]
}

const executeToolbarCommandAction = (
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

const applySurfaceMutationIfAllowed = (
  surface: MarkdownEditorLiveSurfaceHandle | null, isAuthoringDisabled: boolean, plan: PlannedTextMutation,
  options: MutationOptions | undefined, syncSelectionState: (next: TextareaSelection) => void, clearError: () => void
): boolean => {
  if (!surface || isAuthoringDisabled) return false
  syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
  if (options?.clearUploadError !== false) clearError()
  return surface.applyMutation(plan)
}

const applySurfaceOrFallbackBackgroundPlan = (
  surface: MarkdownEditorLiveSurfaceHandle | null, currentValue: string, plan: PlannedTextMutation,
  syncSelectionState: (next: TextareaSelection) => void,
  commitMarkdown: (nextMarkdown: string, editorFocused?: boolean, options?: MutationOptions) => void
): boolean => {
  if (surface) {
    syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
    return surface.applyMutation(plan, {
      focus: false, scrollIntoView: false, addToHistory: false, clearUploadError: false, replaceTransientContent: true,
    })
  }
  const next = applyPlannedTextMutationToValue(currentValue, plan)
  syncSelectionState({ from: next.selectionStart, to: next.selectionEnd })
  commitMarkdown(next.value, false, { clearUploadError: false })
  return true
}

const syncDomOrSnapshotSelection = (
  bodyEl: HTMLDivElement | null, surface: MarkdownEditorLiveSurfaceHandle | null, readValue: () => string,
  selectionRef: MutableRefObject<TextareaSelection>, syncSelectionState: (next: TextareaSelection) => void
): TextareaSelection => {
  const tableCellOffset = resolveActiveTableCellOffset(bodyEl, readValue)
  const snapshot = surface?.readSnapshot()
  if (tableCellOffset !== null) syncSelectionState({ from: tableCellOffset, to: tableCellOffset })
  else if (snapshot) syncSelectionState(snapshot.selection)
  return selectionRef.current
}

const applyPlannedOrFallbackMutation = (
  isAuthoringDisabled: boolean, plan: PlannedTextMutation, options: MutationOptions | undefined,
  applyMutationPlan: (plan: PlannedTextMutation, options?: MutationOptions) => boolean,
  applyFallback: (plan: PlannedTextMutation, options?: MutationOptions) => { value: string; selection: TextareaSelection },
  syncSelectionTableAvailability: (markdown: string, selection: TextareaSelection) => void
): boolean => {
  if (isAuthoringDisabled) return false
  if (applyMutationPlan(plan, options)) return true
  const next = applyFallback(plan, options)
  syncSelectionTableAvailability(next.value, next.selection)
  return true
}

const useMarkdownEditorCommandActions = ({
  isAuthoringDisabled, isTableSelection, valueRef, selectionRef, liveSurfaceRef,
  resolveActiveSelection, applyMutationPlan, applyPlannedMarkdownMutation, tableEditAction,
}: CommandActionsInput) => {
  const applyOptionalPlan = useCallback(
    (plan: PlannedTextMutation | null) => (plan ? applyMutationPlan(plan) : false),
    [applyMutationPlan]
  )

  const runAuthoringAction = useCallback(
    (fn: (sel: TextareaSelection) => void) => {
      if (!isAuthoringDisabled) fn(resolveActiveSelection())
    },
    [isAuthoringDisabled, resolveActiveSelection]
  )

  const insertMarkdownAtEditorSelection = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (!liveSurfaceRef.current || isAuthoringDisabled) return false
      const { from, to } = resolveActiveSelection()
      return applyOptionalPlan(planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options))
    },
    [applyOptionalPlan, isAuthoringDisabled, liveSurfaceRef, resolveActiveSelection, valueRef]
  )

  const applyBlockSnippet = useCallback(
    (spec: BlockSnippetSpec) =>
      runAuthoringAction(({ from, to }) => applyPlannedMarkdownMutation(planInsertBlockSnippet(from, to, spec))),
    [applyPlannedMarkdownMutation, runAuthoringAction]
  )

  const applyFormatShortcutOrAppend = useCallback(
    (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) =>
      runAuthoringAction(({ from, to }) =>
        applyPlannedMarkdownMutation(planFormatShortcutMutation(valueRef.current, from, to, shortcut))
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
      executeToolbarCommandAction(action, applyFormatShortcutOrAppend, applyBlockSnippet, tableEditAction)
    },
    [applyBlockSnippet, applyFormatShortcutOrAppend, isAuthoringDisabled, isTableSelection, selectionRef, tableEditAction]
  )

  const applySnippet = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (isAuthoringDisabled || insertMarkdownAtEditorSelection(before, after, options)) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      if (plan) applyPlannedMarkdownMutation(plan)
    },
    [applyPlannedMarkdownMutation, insertMarkdownAtEditorSelection, isAuthoringDisabled, resolveActiveSelection, valueRef]
  )

  const applyListCommand = useCallback(
    (command: MarkdownEditorListCommand) =>
      runAuthoringAction(({ from, to }) => applyOptionalPlan(planToggleListCommand(valueRef.current, from, to, command))),
    [applyOptionalPlan, runAuthoringAction, valueRef]
  )

  const applyStripBlockPrefix = useCallback(
    () => runAuthoringAction(({ from, to }) => applyOptionalPlan(planStripBlockLinePrefix(valueRef.current, from, to))),
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
    insertMarkdownAtEditorSelection, applyBlockSnippet, applyFormatShortcutOrAppend,
    applyMarkdownEditorCommand, applySnippet, applyListCommand, applyStripBlockPrefix, applyLineCommand,
  }
}

const renderUploadErrorBanner = (uploadError: string) =>
  uploadError ? <ToolbarError role="alert">{uploadError}</ToolbarError> : null

const renderFindReplaceSection = (
  findReplace: ReturnType<typeof useMarkdownEditorFindReplace>,
  onClose: () => void
) => {
  if (!findReplace.panel) return null
  const scopeLabel = findReplace.panel.scope ? "선택 영역" : "전체 문서"
  return (
    <MarkdownEditorFindReplace
      caseSensitive={findReplace.caseSensitive} currentMatch={findReplace.currentMatch}
      disabled={findReplace.panelDisabled} onCaseSensitiveChange={findReplace.updateCaseSensitive}
      onClose={onClose} onNext={() => findReplace.move("next")}
      onPrevious={() => findReplace.move("previous")} onQueryChange={findReplace.updateQuery}
      onReplaceAll={findReplace.replaceAll} onReplaceCurrent={findReplace.replaceCurrent}
      onReplacementChange={findReplace.updateReplacement} replacement={findReplace.replacement}
      replaceCurrentDisabled={findReplace.replaceCurrentDisabled} scopeLabel={scopeLabel}
      totalMatches={findReplace.totalMatches} query={findReplace.query}
    />
  )
}

export const MarkdownEditor = ({
  value, disabled = false, disableMermaid = false, onRequestFocusTitle, onChange,
  onSelectionChange, onFlushMarkdownReady, onFocusRequestReady, onRequestSave,
  onUploadingChange, onUploadImage, onUploadFile,
}: MarkdownEditorProps) => {
  const [uploadError, setUploadError] = useState("")
  const [draftValue, setDraftValue] = useState(value)
  const [viewMode, setViewMode] = useState<MarkdownEditorSurfaceMode>("live")
  const [editorSelection, setEditorSelectionState] = useState<TextareaSelection>({ from: 0, to: 0 })
  const liveEditorBodyRef = useRef<HTMLDivElement | null>(null)
  const liveSurfaceRef = useRef<MarkdownEditorLiveSurfaceHandle | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef(value)
  const selectionRef = useRef<TextareaSelection>({ from: 0, to: 0 })
  const documentGenerationRef = useRef(0)
  const uploadInFlightCountRef = useRef(0)
  const allowNativeTabAfterEscapeRef = useRef(false)
  const pendingFindReplaceInvalidationRef = useRef(false)
  const isAuthoringDisabled = isEditorAuthoringDisabled(disabled, viewMode)
  const cycleViewMode = useCallback(() => setViewMode(nextEditorViewMode), [])
  const clearUploadError = useCallback(() => setUploadError(""), [])

  const syncSelectionState = useCallback((next: TextareaSelection) => {
    selectionRef.current = next
    setEditorSelectionState((prev) => selectSameOrNextSelection(prev, next))
  }, [])

  const setUploadInFlight = useCallback(
    (delta: number) => {
      uploadInFlightCountRef.current = Math.max(0, uploadInFlightCountRef.current + delta)
      onUploadingChange?.(uploadInFlightCountRef.current > 0)
    },
    [onUploadingChange]
  )

  const commitMarkdown = useCallback(
    (nextMarkdown: string, editorFocused = false, options?: { clearUploadError?: boolean }) => {
      valueRef.current = nextMarkdown
      setDraftValue(nextMarkdown)
      if (options?.clearUploadError !== false) setUploadError("")
      onChange(nextMarkdown, { editorFocused })
    },
    [onChange]
  )

  const applyMutationPlan = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) =>
      applySurfaceMutationIfAllowed(
        liveSurfaceRef.current, isAuthoringDisabled, plan, options, syncSelectionState, clearUploadError
      ),
    [clearUploadError, isAuthoringDisabled, syncSelectionState]
  )

  const applyFallbackValueMutation = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      const selection = { from: next.selectionStart, to: next.selectionEnd }
      syncSelectionState(selection)
      commitMarkdown(next.value, true, options)
      return { value: next.value, selection }
    },
    [commitMarkdown, syncSelectionState]
  )

  const syncSelectionFromLiveDom = useCallback(
    () =>
      syncDomOrSnapshotSelection(
        liveEditorBodyRef.current, liveSurfaceRef.current, () => valueRef.current, selectionRef, syncSelectionState
      ),
    [syncSelectionState]
  )

  const readTableSelection = useCallback(
    () => (liveSurfaceRef.current ? syncSelectionFromLiveDom() : selectionRef.current),
    [syncSelectionFromLiveDom]
  )

  const {
    tableRows, setTableRows, tableColumns, setTableColumns,
    resetTableAvailability, syncSelectionTableAvailability,
    insertTable, tableEditAction, isTableEditDisabled, isTableSelection,
  } = useMarkdownEditorTableControls({
    disabled: isAuthoringDisabled, valueRef, readSelection: readTableSelection,
    applyMutationPlan, applyFallbackMutation: applyFallbackValueMutation,
  })

  const setEditorSelection = useCallback((from: number, to = from) => {
    const nextSelection = clampSelectionToLength(from, to, valueRef.current.length)
    syncSelectionState(nextSelection)
    syncSelectionTableAvailability(valueRef.current, nextSelection)
    onSelectionChange?.(nextSelection)
    liveSurfaceRef.current?.focus(nextSelection)
  }, [onSelectionChange, syncSelectionState, syncSelectionTableAvailability])

  const readEditorSnapshot = useCallback(() => liveSurfaceRef.current?.readSnapshot() ?? null, [])
  const selectFindReplaceRange = useCallback((from: number, to?: number) => setEditorSelection(from, to), [setEditorSelection])

  const findReplace = useMarkdownEditorFindReplace({
    disabled: isAuthoringDisabled, draftValue, readSnapshot: readEditorSnapshot,
    selectRange: selectFindReplaceRange, applyRecordedMutation: applyMutationPlan,
  })
  const { invalidate: invalidateFindReplace, onSelectionChange: handleFindReplaceSelectionChange } = findReplace

  const rememberTextareaSelection = useCallback(() => {
    const selection = syncSelectionFromLiveDom()
    handleFindReplaceSelectionChange(selection)
    syncSelectionTableAvailability(valueRef.current, selection)
    return selection
  }, [handleFindReplaceSelectionChange, syncSelectionFromLiveDom, syncSelectionTableAvailability])

  const resolveActiveSelection = useCallback(
    () => (liveSurfaceRef.current ? rememberTextareaSelection() : selectionRef.current),
    [rememberTextareaSelection]
  )

  const applyPlannedMarkdownMutation = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) =>
      applyPlannedOrFallbackMutation(
        isAuthoringDisabled, plan, options, applyMutationPlan, applyFallbackValueMutation, syncSelectionTableAvailability
      ),
    [applyFallbackValueMutation, applyMutationPlan, isAuthoringDisabled, syncSelectionTableAvailability]
  )

  const applyBackgroundMarkdownMutation = useCallback(
    (plan: PlannedTextMutation) =>
      applySurfaceOrFallbackBackgroundPlan(
        liveSurfaceRef.current, valueRef.current, plan, syncSelectionState, commitMarkdown
      ),
    [commitMarkdown, syncSelectionState]
  )

  const {
    insertMarkdownAtEditorSelection, applyBlockSnippet, applyFormatShortcutOrAppend,
    applyMarkdownEditorCommand, applySnippet, applyListCommand, applyStripBlockPrefix, applyLineCommand,
  } = useMarkdownEditorCommandActions({
    isAuthoringDisabled, isTableSelection, valueRef, selectionRef, liveSurfaceRef,
    resolveActiveSelection, applyMutationPlan, applyPlannedMarkdownMutation, tableEditAction,
  })

  const commandContext = useMemo(
    () => ({
      disabled: isAuthoringDisabled, selectionStart: editorSelection.from,
      selectionEnd: editorSelection.to, isTableSelection,
    }),
    [editorSelection, isAuthoringDisabled, isTableSelection]
  )
  const toolbarCommands = useMemo(() => projectMarkdownEditorToolbarCommands(), [])

  const insertUploadedMarkdown = useCallback(
    (markdown: string) => {
      if (insertMarkdownAtEditorSelection(markdown)) return
      commitMarkdown(`${valueRef.current}${markdown}`, true)
    },
    [commitMarkdown, insertMarkdownAtEditorSelection]
  )

  const handleCloseFindReplace = useCallback(() => {
    findReplace.closePanel()
    liveSurfaceRef.current?.focus(selectionRef.current)
  }, [findReplace])

  const { handleImageInput, handleFileInput, handlePaste, handleDragOver, handleDrop } =
    useMarkdownEditorMediaTransfers({
      disabled: isAuthoringDisabled, viewMode,
      valueRef, selectionRef, documentGenerationRef, onUploadImage, onUploadFile,
      applyPlannedMarkdownMutation, applyRecordedMarkdownMutation: applyMutationPlan,
      applyBackgroundMarkdownMutation, resolveActiveSelection,
      resolveDropTargetPosition: (coords) => liveSurfaceRef.current?.posAtCoords(coords) ?? null,
      setUploadInFlight, setEditorError: setUploadError, insertUploadedMarkdown,
    })

  const resolveSlashCoords = useCallback((pos: number) => liveSurfaceRef.current?.coordsAtPos?.(pos) ?? null, [])

  const { slashMenuState, slashMenuOpenRef, slashMenuItems, checkSlashCommand, closeSlashMenu } =
    useMarkdownEditorSlashMenu({
      selectionRef, applyMutationPlan, disableMermaid,
      onRequestImageUpload: createOptionalInputPicker(Boolean(onUploadImage), imageInputRef),
      onRequestFileUpload: createOptionalInputPicker(Boolean(onUploadFile), fileInputRef),
      resolveSlashCoords,
    })

  useMarkdownEditorLifecycleEffects({
    value, disabled, viewMode, valueRef, documentGenerationRef, pendingFindReplaceInvalidationRef,
    liveEditorBodyRef, liveSurfaceRef, setDraftValue, resetTableAvailability,
    invalidateFindReplace, closeSlashMenu, onFlushMarkdownReady, onFocusRequestReady,
  })

  const isCompletionOrSlashMenuActive = useCallback(
    () => slashMenuOpenRef.current || Boolean(liveSurfaceRef.current?.isCompletionActive?.()),
    [slashMenuOpenRef]
  )

  const handleRequestSave = useCallback(() => {
    if (!onRequestSave) return
    resolveActiveTableCellOffset(liveEditorBodyRef.current, () => valueRef.current)
    onRequestSave()
  }, [onRequestSave])

  const { handleTextareaKeyDown } = useMarkdownEditorTextareaKeyboard({
    disabled, authoringDisabled: isAuthoringDisabled, valueRef, allowNativeTabAfterEscapeRef,
    rememberTextareaSelection, applyMutationPlan, applyRecordedMutation: applyMutationPlan,
    setTextareaSelection: setEditorSelection,
    onRequestSave: selectOptionalCallback(Boolean(onRequestSave), handleRequestSave),
    onToggleViewMode: cycleViewMode, isCompletionActive: isCompletionOrSlashMenuActive,
  })

  const handleLiveSelectionChange = useCallback(
    (selection: TextareaSelection) => {
      syncSelectionState(selection)
      handleFindReplaceSelectionChange(selection)
      syncSelectionTableAvailability(valueRef.current, selection)
      onSelectionChange?.(selection)
      if (viewMode === "live" && !disabled) checkSlashCommand(valueRef.current, selection)
    },
    [checkSlashCommand, disabled, handleFindReplaceSelectionChange, onSelectionChange, syncSelectionState, syncSelectionTableAvailability, viewMode]
  )

  const handleLiveChange = useCallback(
    (nextMarkdown: string, editorFocused: boolean, options?: { clearUploadError?: boolean }) => {
      invalidateFindReplace()
      commitMarkdown(nextMarkdown, editorFocused, options)
    },
    [commitMarkdown, invalidateFindReplace]
  )

  const handleTriggerSlashCommand = useCallback(
    (plan: PlannedTextMutation) => {
      applyPlannedMarkdownMutation(plan)
      checkSlashCommand(valueRef.current, selectionRef.current)
    },
    [applyPlannedMarkdownMutation, checkSlashCommand]
  )

  const handleImageFileSelect = useCallback((file: File | null) => void handleImageInput(file), [handleImageInput])
  const handleAttachmentFileSelect = useCallback((file: File | null) => void handleFileInput(file), [handleFileInput])

  return (
    <EditorRoot data-testid="markdown-editor">
      <MarkdownEditorToolbar
        disabled={disabled} disableMermaid={disableMermaid} viewMode={viewMode}
        tableRows={tableRows} tableColumns={tableColumns} commandContext={commandContext}
        toolbarCommands={toolbarCommands} imageInputRef={imageInputRef} fileInputRef={fileInputRef}
        hasUploadImage={Boolean(onUploadImage)} hasUploadFile={Boolean(onUploadFile)}
        onTableRowsChange={setTableRows} onTableColumnsChange={setTableColumns}
        onRememberSelection={rememberTextareaSelection} onApplyCommand={applyMarkdownEditorCommand}
        onApplySnippet={applySnippet} onApplyFormatShortcut={applyFormatShortcutOrAppend}
        onApplyListCommand={applyListCommand} onApplyLineCommand={applyLineCommand}
        onApplyBlockSnippet={applyBlockSnippet} onInsertTable={insertTable}
        onApplyTableEdit={tableEditAction} isTableEditDisabled={isTableEditDisabled}
        onOpenFindReplace={findReplace.open} onImageFileSelect={handleImageFileSelect}
        onAttachmentFileSelect={handleAttachmentFileSelect} onViewModeChange={setViewMode}
      />
      {renderUploadErrorBanner(uploadError)}
      {renderFindReplaceSection(findReplace, handleCloseFindReplace)}
      <LiveEditorBody ref={liveEditorBodyRef} aria-disabled={disabled} $isEmpty={!draftValue}>
        <MarkdownEditorNotionChrome
          containerRef={liveEditorBodyRef} mode={viewMode} disabled={isAuthoringDisabled}
          value={draftValue} selection={editorSelection} isSlashMenuOpen={slashMenuState.isOpen}
          isFindReplaceOpen={Boolean(findReplace.panel)} resolveCoords={resolveSlashCoords}
          onApplySnippet={applySnippet} onApplyFormatShortcut={applyFormatShortcutOrAppend}
          onApplyListCommand={applyListCommand} onStripBlockPrefix={applyStripBlockPrefix}
          onApplyLineCommand={applyLineCommand} onTriggerSlashCommand={handleTriggerSlashCommand}
        />
        <MarkdownEditorLiveSurface
          ref={liveSurfaceRef} value={draftValue} disabled={disabled} disableMermaid={disableMermaid}
          mode={viewMode} onToggleViewMode={cycleViewMode} ariaDescription={TEXTAREA_KEYBOARD_HELP}
          onChange={handleLiveChange} onSelectionChange={handleLiveSelectionChange}
          onRequestFocusTitle={onRequestFocusTitle} onKeyDownCapture={handleTextareaKeyDown}
          onPasteCapture={handlePaste} onDragOver={handleDragOver} onDropCapture={handleDrop}
        />
      </LiveEditorBody>
      <MarkdownEditorSlashMenu
        isOpen={slashMenuState.isOpen} position={slashMenuState.position}
        items={slashMenuItems} onClose={closeSlashMenu}
      />
    </EditorRoot>
  )
}
