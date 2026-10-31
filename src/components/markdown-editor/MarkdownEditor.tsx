import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  isTableEditActionDisabled,
  resolveActiveTableCellOffset,
  useMarkdownEditorTableControls,
} from "./useMarkdownEditorTableControls"
export { isTableEditActionDisabled, resolveActiveTableCellOffset }
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

const TEXTAREA_KEYBOARD_HELP =
  `표 셀에서는 Tab과 Shift+Tab으로 다음 또는 이전 셀로 이동합니다. 표 밖에서는 Tab은 2칸 들여쓰기, Shift+Tab은 내어쓰기입니다. 괄호·따옴표·인라인 코드는 자동으로 쌍을 입력합니다. Alt+ArrowUp과 Alt+ArrowDown은 현재 줄을 이동하고, Shift+Alt+ArrowDown은 복제합니다. ${modShortcutLabel}Shift+K는 현재 줄을 삭제합니다. Escape를 누른 다음 Tab은 포커스를 다음 요소로 이동합니다.`

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
  const isAuthoringDisabled = disabled || viewMode === "reading"
  const cycleViewMode = useCallback(() => setViewMode(nextEditorViewMode), [])

  const syncSelectionState = useCallback((next: TextareaSelection) => {
    selectionRef.current = next
    setEditorSelectionState((prev) =>
      prev.from === next.from && prev.to === next.to ? prev : next
    )
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
      if (options?.clearUploadError !== false) {
        setUploadError("")
      }
      onChange(nextMarkdown, { editorFocused })
    },
    [onChange]
  )

  const applyRawMutationPlan = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      const surface = liveSurfaceRef.current
      if (!surface || isAuthoringDisabled) return false
      syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
      if (options?.clearUploadError !== false) setUploadError("")
      return surface.applyMutation(plan)
    },
    [isAuthoringDisabled, syncSelectionState]
  )
  const applyMutationPlan = applyRawMutationPlan

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

  const syncSelectionFromLiveDom = useCallback(() => {
    const tableCellOffset = resolveActiveTableCellOffset(liveEditorBodyRef.current, () => valueRef.current)
    const snapshot = liveSurfaceRef.current?.readSnapshot()
    if (tableCellOffset !== null) {
      syncSelectionState({ from: tableCellOffset, to: tableCellOffset })
    } else if (snapshot) {
      syncSelectionState(snapshot.selection)
    }
    return selectionRef.current
  }, [syncSelectionState])

  const readTableSelection = useCallback(
    () => (liveSurfaceRef.current ? syncSelectionFromLiveDom() : selectionRef.current),
    [syncSelectionFromLiveDom]
  )

  const {
    tableRows,
    setTableRows,
    tableColumns,
    setTableColumns,
    resetTableAvailability,
    syncSelectionTableAvailability,
    insertTable,
    tableEditAction,
    isTableEditDisabled,
    isTableSelection,
  } = useMarkdownEditorTableControls({
    disabled: isAuthoringDisabled,
    valueRef,
    readSelection: readTableSelection,
    applyMutationPlan,
    applyFallbackMutation: applyFallbackValueMutation,
  })

  useEffect(() => {
    if (value === valueRef.current) return
    valueRef.current = value
    setDraftValue(value)
    resetTableAvailability()
    pendingFindReplaceInvalidationRef.current = true
    documentGenerationRef.current += 1
  }, [resetTableAvailability, value])

  useEffect(() => {
    onFlushMarkdownReady?.(() => {
      resolveActiveTableCellOffset(liveEditorBodyRef.current, () => valueRef.current)
      return valueRef.current
    })
    return () => onFlushMarkdownReady?.(null)
  }, [onFlushMarkdownReady])

  const setEditorSelection = useCallback((from: number, to = from) => {
    const length = valueRef.current.length
    const nextSelection = {
      from: Math.max(0, Math.min(from, length)),
      to: Math.max(0, Math.min(to, length)),
    }
    syncSelectionState(nextSelection)
    syncSelectionTableAvailability(valueRef.current, nextSelection)
    onSelectionChange?.(nextSelection)
    liveSurfaceRef.current?.focus(nextSelection)
  }, [onSelectionChange, syncSelectionState, syncSelectionTableAvailability])

  useEffect(() => {
    onFocusRequestReady?.((selection) => {
      if (!disabled) liveSurfaceRef.current?.focus(selection)
    })
    return () => onFocusRequestReady?.(null)
  }, [disabled, onFocusRequestReady])

  const readEditorSnapshot = useCallback(() => liveSurfaceRef.current?.readSnapshot() ?? null, [])
  const selectFindReplaceRange = useCallback((from: number, to?: number) => setEditorSelection(from, to), [setEditorSelection])

  const findReplace = useMarkdownEditorFindReplace({
    disabled: isAuthoringDisabled, draftValue, readSnapshot: readEditorSnapshot,
    selectRange: selectFindReplaceRange, applyRecordedMutation: applyMutationPlan,
  })
  const { invalidate: invalidateFindReplace, onSelectionChange: handleFindReplaceSelectionChange } = findReplace

  useEffect(() => {
    if (!pendingFindReplaceInvalidationRef.current) return
    pendingFindReplaceInvalidationRef.current = false
    invalidateFindReplace(true)
  }, [invalidateFindReplace, value])

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
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      if (isAuthoringDisabled) return false
      if (applyMutationPlan(plan, options)) return true
      const next = applyFallbackValueMutation(plan, options)
      syncSelectionTableAvailability(next.value, next.selection)
      return true
    },
    [applyFallbackValueMutation, applyMutationPlan, isAuthoringDisabled, syncSelectionTableAvailability]
  )

  const applyBackgroundMarkdownMutation = useCallback(
    (plan: PlannedTextMutation) => {
      const surface = liveSurfaceRef.current
      if (surface) {
        syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
        return surface.applyMutation(plan, {
          focus: false, scrollIntoView: false, addToHistory: false, clearUploadError: false, replaceTransientContent: true,
        })
      }
      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      syncSelectionState({ from: next.selectionStart, to: next.selectionEnd })
      commitMarkdown(next.value, false, { clearUploadError: false })
      return true
    },
    [commitMarkdown, syncSelectionState]
  )

  const insertMarkdownAtEditorSelection = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (!liveSurfaceRef.current || isAuthoringDisabled) return false
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      return plan ? applyMutationPlan(plan) : false
    },
    [applyMutationPlan, isAuthoringDisabled, resolveActiveSelection]
  )

  const applyBlockSnippet = useCallback(
    (spec: BlockSnippetSpec) => {
      if (isAuthoringDisabled) return
      const { from, to } = resolveActiveSelection()
      applyPlannedMarkdownMutation(planInsertBlockSnippet(from, to, spec))
    },
    [applyPlannedMarkdownMutation, isAuthoringDisabled, resolveActiveSelection]
  )

  const commandContext = useMemo(
    () => ({
      disabled: isAuthoringDisabled,
      selectionStart: editorSelection.from,
      selectionEnd: editorSelection.to,
      isTableSelection,
    }),
    [editorSelection, isAuthoringDisabled, isTableSelection]
  )
  const toolbarCommands = useMemo(() => projectMarkdownEditorToolbarCommands(), [])

  const applyFormatShortcutOrAppend = useCallback(
    (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) => {
      if (isAuthoringDisabled) return
      const { from, to } = resolveActiveSelection()
      applyPlannedMarkdownMutation(planFormatShortcutMutation(valueRef.current, from, to, shortcut))
    },
    [applyPlannedMarkdownMutation, isAuthoringDisabled, resolveActiveSelection]
  )

  const applyMarkdownEditorCommand = useCallback(
    (command: MarkdownEditorCommandDescriptor) => {
      const action = command.execute({
        disabled: isAuthoringDisabled,
        selectionStart: selectionRef.current.from,
        selectionEnd: selectionRef.current.to,
        isTableSelection,
      })
      if (!action) return
      if (action.kind === "format") return applyFormatShortcutOrAppend(action.shortcut)
      if (action.kind === "block") return applyBlockSnippet(codeBlockSnippet)
      tableEditAction(TABLE_ADD_ROW_EDIT)
    },
    [applyBlockSnippet, applyFormatShortcutOrAppend, isAuthoringDisabled, isTableSelection, tableEditAction]
  )

  const applySnippet = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (isAuthoringDisabled || insertMarkdownAtEditorSelection(before, after, options)) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      if (plan) applyPlannedMarkdownMutation(plan)
    },
    [applyPlannedMarkdownMutation, insertMarkdownAtEditorSelection, isAuthoringDisabled, resolveActiveSelection]
  )

  const applyListCommand = useCallback(
    (command: MarkdownEditorListCommand) => {
      if (isAuthoringDisabled) return
      const { from, to } = resolveActiveSelection()
      const plan = planToggleListCommand(valueRef.current, from, to, command)
      if (plan) applyMutationPlan(plan)
    },
    [applyMutationPlan, isAuthoringDisabled, resolveActiveSelection]
  )

  const applyStripBlockPrefix = useCallback(() => {
    if (isAuthoringDisabled) return
    const { from, to } = resolveActiveSelection()
    const plan = planStripBlockLinePrefix(valueRef.current, from, to)
    if (plan) applyMutationPlan(plan)
  }, [applyMutationPlan, isAuthoringDisabled, resolveActiveSelection])

  const applyLineCommand = useCallback(
    (command: MarkdownEditorLineCommand) => {
      if (isAuthoringDisabled) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownEditorLineCommand(valueRef.current, from, to, command)
      if (plan) applyMutationPlan(plan)
    },
    [applyMutationPlan, isAuthoringDisabled, resolveActiveSelection]
  )

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
      disabled: isAuthoringDisabled,
      viewMode,
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
      onRequestImageUpload: onUploadImage ? () => imageInputRef.current?.click() : undefined,
      onRequestFileUpload: onUploadFile ? () => fileInputRef.current?.click() : undefined,
      resolveSlashCoords,
    })

  useEffect(() => {
    if (viewMode !== "live" || disabled) closeSlashMenu()
  }, [closeSlashMenu, disabled, viewMode])

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
    onRequestSave: onRequestSave ? handleRequestSave : undefined,
    onToggleViewMode: cycleViewMode, isCompletionActive: isCompletionOrSlashMenuActive,
  })

  const handleLiveSelectionChange = useCallback(
    (selection: TextareaSelection) => {
      syncSelectionState(selection)
      handleFindReplaceSelectionChange(selection)
      syncSelectionTableAvailability(valueRef.current, selection)
      onSelectionChange?.(selection)
      if (viewMode === "live" && !disabled) {
        checkSlashCommand(valueRef.current, selection)
      }
    },
    [checkSlashCommand, disabled, handleFindReplaceSelectionChange, onSelectionChange, syncSelectionState, syncSelectionTableAvailability, viewMode]
  )

  const handleLiveChange = useCallback(
    (
      nextMarkdown: string,
      editorFocused: boolean,
      options?: { clearUploadError?: boolean }
    ) => {
      invalidateFindReplace()
      commitMarkdown(nextMarkdown, editorFocused, options)
    },
    [commitMarkdown, invalidateFindReplace]
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
      {uploadError ? <ToolbarError role="alert">{uploadError}</ToolbarError> : null}
      {findReplace.panel ? (
        <MarkdownEditorFindReplace
          caseSensitive={findReplace.caseSensitive} currentMatch={findReplace.currentMatch}
          disabled={findReplace.panelDisabled} onCaseSensitiveChange={findReplace.updateCaseSensitive}
          onClose={handleCloseFindReplace} onNext={() => findReplace.move("next")}
          onPrevious={() => findReplace.move("previous")} onQueryChange={findReplace.updateQuery}
          onReplaceAll={findReplace.replaceAll} onReplaceCurrent={findReplace.replaceCurrent}
          onReplacementChange={findReplace.updateReplacement} replacement={findReplace.replacement}
          replaceCurrentDisabled={findReplace.replaceCurrentDisabled}
          scopeLabel={findReplace.panel.scope ? "선택 영역" : "전체 문서"}
          totalMatches={findReplace.totalMatches} query={findReplace.query}
        />
      ) : null}
      <LiveEditorBody ref={liveEditorBodyRef} aria-disabled={disabled} $isEmpty={!draftValue}>
        <MarkdownEditorNotionChrome
          containerRef={liveEditorBodyRef} mode={viewMode} disabled={isAuthoringDisabled}
          value={draftValue} selection={editorSelection} isSlashMenuOpen={slashMenuState.isOpen}
          isFindReplaceOpen={Boolean(findReplace.panel)} resolveCoords={resolveSlashCoords}
          onApplySnippet={applySnippet} onApplyFormatShortcut={applyFormatShortcutOrAppend}
          onApplyListCommand={applyListCommand} onStripBlockPrefix={applyStripBlockPrefix}
          onApplyLineCommand={applyLineCommand}
          onTriggerSlashCommand={(plan) => {
            applyPlannedMarkdownMutation(plan)
            checkSlashCommand(valueRef.current, selectionRef.current)
          }}
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
