import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import { planMarkdownEditorLineCommand, type MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import { planToggleListCommand, type MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { EditorRoot, ToolbarError, LiveEditorBody } from "./MarkdownEditor.styles"
import { applyPlannedTextMutationToValue, type PlannedTextMutation } from "./markdownEditorTextMutation"
import { codeBlockSnippet, planInsertBlockSnippet, type BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import { projectMarkdownEditorToolbarCommands, type MarkdownEditorCommandDescriptor } from "./markdownEditorCommandRegistryModel"
import {
  createMarkdownEditorTable,
  getMarkdownEditorTableEditAvailability,
  packTableEditAvailabilityMask,
  planMarkdownEditorTableEdit,
  unpackTableEditAvailabilityMask,
  type MarkdownEditorTableEdit,
} from "./markdownEditorTableModel"
import { MarkdownEditorFindReplace } from "./MarkdownEditorFindReplace"
import { useMarkdownEditorFindReplace } from "./useMarkdownEditorFindReplace"
import { type MarkdownFileUploadResult, type MarkdownImageUploadResult } from "./markdownEditorUploadModel"
import { modShortcutLabel } from "./markdownEditorToolbarModel"
import { useMarkdownEditorMediaTransfers } from "./useMarkdownEditorMediaTransfers"
import { useMarkdownEditorTextareaKeyboard } from "./useMarkdownEditorTextareaKeyboard"
import { MarkdownEditorLiveSurface, type MarkdownEditorLiveSurfaceHandle } from "./MarkdownEditorLiveSurface"
import { planMarkdownSnippetMutation, planStripBlockLinePrefix } from "./markdownEditorNotionModel"
import { MarkdownEditorNotionChrome } from "./MarkdownEditorNotionChrome"
import { MarkdownEditorSlashMenu } from "./MarkdownEditorSlashMenu"
import { MarkdownEditorToolbar } from "./MarkdownEditorToolbar"
import { useMarkdownEditorSlashMenu } from "./useMarkdownEditorSlashMenu"
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

const TABLE_ADD_ROW_EDIT: MarkdownEditorTableEdit = { kind: "add-row" }

const TEXTAREA_KEYBOARD_HELP =
  `표 셀에서는 Tab과 Shift+Tab으로 다음 또는 이전 셀로 이동합니다. 표 밖에서는 Tab은 2칸 들여쓰기, Shift+Tab은 내어쓰기입니다. 괄호·따옴표·인라인 코드는 자동으로 쌍을 입력합니다. Alt+ArrowUp과 Alt+ArrowDown은 현재 줄을 이동하고, Shift+Alt+ArrowDown은 복제합니다. ${modShortcutLabel}Shift+K는 현재 줄을 삭제합니다. Escape를 누른 다음 Tab은 포커스를 다음 요소로 이동합니다.`

export const MarkdownEditor = ({
  value,
  disabled = false,
  disableMermaid = false,
  onRequestFocusTitle,
  onChange,
  onSelectionChange,
  onFlushMarkdownReady,
  onFocusRequestReady,
  onRequestSave,
  onUploadingChange,
  onUploadImage,
  onUploadFile,
}: MarkdownEditorProps) => {
  const [uploadError, setUploadError] = useState("")
  const [draftValue, setDraftValue] = useState(value)
  const [tableRows, setTableRows] = useState(2)
  const [tableColumns, setTableColumns] = useState(2)
  const [tableEditAvailabilityMask, setTableEditAvailabilityMask] = useState(-1)
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

  useEffect(() => {
    if (value === valueRef.current) return
    valueRef.current = value
    setDraftValue(value)
    setTableEditAvailabilityMask(-1)
    pendingFindReplaceInvalidationRef.current = true
    documentGenerationRef.current += 1
  }, [value])

  useEffect(() => {
    onFlushMarkdownReady?.(() => valueRef.current)
    return () => onFlushMarkdownReady?.(null)
  }, [onFlushMarkdownReady])

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

  const updateActiveTableSelection = useCallback((nextValue = valueRef.current, selection = selectionRef.current) => {
    setTableEditAvailabilityMask(
      packTableEditAvailabilityMask(
        getMarkdownEditorTableEditAvailability(nextValue, selection.from, selection.to)
      )
    )
  }, [])

  const setEditorSelection = useCallback((from: number, to = from) => {
    const length = valueRef.current.length
    const nextSelection = {
      from: Math.max(0, Math.min(from, length)),
      to: Math.max(0, Math.min(to, length)),
    }
    syncSelectionState(nextSelection)
    updateActiveTableSelection(valueRef.current, nextSelection)
    onSelectionChange?.(nextSelection)
    liveSurfaceRef.current?.focus(nextSelection)
  }, [onSelectionChange, syncSelectionState, updateActiveTableSelection])

  useEffect(() => {
    onFocusRequestReady?.((selection) => {
      if (disabled) return
      liveSurfaceRef.current?.focus(selection)
    })
    return () => onFocusRequestReady?.(null)
  }, [disabled, onFocusRequestReady])

  const applyRawMutationPlan = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      const surface = liveSurfaceRef.current
      if (!surface || disabled) return false
      syncSelectionState({ from: plan.selectionStart, to: plan.selectionEnd })
      if (options?.clearUploadError !== false) setUploadError("")
      return surface.applyMutation(plan)
    },
    [disabled, syncSelectionState]
  )

  const readEditorSnapshot = useCallback(() => liveSurfaceRef.current?.readSnapshot() ?? null, [])
  const applyMutationPlan = applyRawMutationPlan
  const selectFindReplaceRange = useCallback((from: number, to?: number) => {
    setEditorSelection(from, to)
  }, [setEditorSelection])

  const findReplace = useMarkdownEditorFindReplace({
    disabled,
    draftValue,
    readSnapshot: readEditorSnapshot,
    selectRange: selectFindReplaceRange,
    applyRecordedMutation: applyMutationPlan,
  })
  const {
    invalidate: invalidateFindReplace,
    onSelectionChange: handleFindReplaceSelectionChange,
  } = findReplace

  useEffect(() => {
    if (!pendingFindReplaceInvalidationRef.current) return
    pendingFindReplaceInvalidationRef.current = false
    invalidateFindReplace(true)
  }, [invalidateFindReplace, value])

  const rememberTextareaSelection = useCallback(() => {
    const snapshot = liveSurfaceRef.current?.readSnapshot()
    if (snapshot) syncSelectionState(snapshot.selection)
    handleFindReplaceSelectionChange(selectionRef.current)
    updateActiveTableSelection(valueRef.current, selectionRef.current)
    return selectionRef.current
  }, [handleFindReplaceSelectionChange, syncSelectionState, updateActiveTableSelection])

  const resolveActiveSelection = useCallback(
    () => (liveSurfaceRef.current ? rememberTextareaSelection() : selectionRef.current),
    [rememberTextareaSelection]
  )

  const applyPlannedMarkdownMutation = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      if (applyMutationPlan(plan, options)) return true

      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      syncSelectionState({ from: next.selectionStart, to: next.selectionEnd })
      updateActiveTableSelection(next.value, selectionRef.current)
      commitMarkdown(next.value, true, options)
      return true
    },
    [applyMutationPlan, commitMarkdown, syncSelectionState, updateActiveTableSelection]
  )

  const applyBackgroundMarkdownMutation = useCallback(
    (plan: PlannedTextMutation) => {
      const commitOptions = { clearUploadError: false as const }
      const surface = liveSurfaceRef.current
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

      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      syncSelectionState({ from: next.selectionStart, to: next.selectionEnd })
      commitMarkdown(next.value, false, commitOptions)
      return true
    },
    [commitMarkdown, syncSelectionState]
  )

  const insertMarkdownAtEditorSelection = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (!liveSurfaceRef.current || disabled) return false
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      return plan ? applyMutationPlan(plan) : false
    },
    [applyMutationPlan, disabled, resolveActiveSelection]
  )

  const applyBlockSnippet = useCallback(
    (spec: BlockSnippetSpec) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      applyPlannedMarkdownMutation(planInsertBlockSnippet(from, to, spec))
    },
    [applyPlannedMarkdownMutation, disabled, resolveActiveSelection]
  )

  const insertTable = useCallback(() => {
    if (disabled) return
    const table = createMarkdownEditorTable(tableRows, tableColumns)
    if (table) applyBlockSnippet(table)
  }, [applyBlockSnippet, disabled, tableColumns, tableRows])

  const applyTableEdit = useCallback(
    (edit: MarkdownEditorTableEdit) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownEditorTableEdit(valueRef.current, from, to, edit)
      if (plan) applyPlannedMarkdownMutation(plan)
    },
    [applyPlannedMarkdownMutation, disabled, resolveActiveSelection]
  )

  const tableEditAvailability = useMemo(
    () => (disabled ? null : unpackTableEditAvailabilityMask(tableEditAvailabilityMask)),
    [disabled, tableEditAvailabilityMask]
  )

  const isTableEditDisabled = useCallback(
    (edit: MarkdownEditorTableEdit) => {
      if (!tableEditAvailability) return true
      switch (edit.kind) {
        case "add-row":
        case "insert-row-above":
        case "duplicate-row":
          return !tableEditAvailability.addRow
        case "move-row-up":
        case "move-row-down":
        case "move-row-to":
        case "delete-row":
          return !tableEditAvailability.deleteRow
        case "add-column":
        case "insert-column-left":
        case "duplicate-column":
          return !tableEditAvailability.addColumn
        case "add-row-and-column":
          return !tableEditAvailability.addRow && !tableEditAvailability.addColumn
        case "move-column-left":
        case "move-column-right":
        case "move-column-to":
        case "delete-column":
          return !tableEditAvailability.deleteColumn
        case "clear-row":
        case "clear-column":
          return false
        case "set-alignment":
          if (edit.alignment === "left") return !tableEditAvailability.alignLeft
          if (edit.alignment === "center") return !tableEditAvailability.alignCenter
          return !tableEditAvailability.alignRight
      }
    },
    [tableEditAvailability]
  )

  const commandContext = useMemo(
    () => ({
      disabled,
      selectionStart: selectionRef.current.from,
      selectionEnd: selectionRef.current.to,
      isTableSelection: !isTableEditDisabled(TABLE_ADD_ROW_EDIT),
    }),
    [disabled, isTableEditDisabled]
  )
  const toolbarCommands = useMemo(() => projectMarkdownEditorToolbarCommands(), [])

  const applyFormatShortcutOrAppend = useCallback(
    (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      applyPlannedMarkdownMutation(planFormatShortcutMutation(valueRef.current, from, to, shortcut))
    },
    [applyPlannedMarkdownMutation, disabled, resolveActiveSelection]
  )

  const applyMarkdownEditorCommand = useCallback(
    (command: MarkdownEditorCommandDescriptor) => {
      const action = command.execute({
        disabled,
        selectionStart: selectionRef.current.from,
        selectionEnd: selectionRef.current.to,
        isTableSelection: !isTableEditDisabled(TABLE_ADD_ROW_EDIT),
      })
      if (!action) return
      if (action.kind === "format") return applyFormatShortcutOrAppend(action.shortcut)
      if (action.kind === "block") return applyBlockSnippet(codeBlockSnippet)
      applyTableEdit(TABLE_ADD_ROW_EDIT)
    },
    [applyBlockSnippet, applyFormatShortcutOrAppend, applyTableEdit, disabled, isTableEditDisabled]
  )

  const applySnippet = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (disabled || insertMarkdownAtEditorSelection(before, after, options)) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownSnippetMutation(valueRef.current, from, to, before, after, options)
      if (plan) applyPlannedMarkdownMutation(plan)
    },
    [
      applyPlannedMarkdownMutation,
      disabled,
      insertMarkdownAtEditorSelection,
      resolveActiveSelection,
    ]
  )

  const applyListCommand = useCallback(
    (command: MarkdownEditorListCommand) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      const plan = planToggleListCommand(valueRef.current, from, to, command)
      if (plan) applyMutationPlan(plan)
    },
    [applyMutationPlan, disabled, resolveActiveSelection]
  )

  const applyStripBlockPrefix = useCallback(() => {
    if (disabled) return
    const { from, to } = resolveActiveSelection()
    const plan = planStripBlockLinePrefix(valueRef.current, from, to)
    if (plan) applyMutationPlan(plan)
  }, [applyMutationPlan, disabled, resolveActiveSelection])

  const applyLineCommand = useCallback(
    (command: MarkdownEditorLineCommand) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      const plan = planMarkdownEditorLineCommand(valueRef.current, from, to, command)
      if (plan) applyMutationPlan(plan)
    },
    [applyMutationPlan, disabled, resolveActiveSelection]
  )

  const insertUploadedMarkdown = useCallback(
    (markdown: string) => {
      if (insertMarkdownAtEditorSelection(markdown)) return
      commitMarkdown(`${valueRef.current}${markdown}`, true)
    },
    [commitMarkdown, insertMarkdownAtEditorSelection]
  )

  const [viewMode, setViewMode] = useState<"live" | "source" | "reading">("live")
  const cycleViewMode = useCallback(() => {
    setViewMode((prev) => {
      if (prev === "live") return "source"
      if (prev === "source") return "reading"
      return "live"
    })
  }, [])
  const handleCloseFindReplace = useCallback(() => {
    findReplace.closePanel()
    liveSurfaceRef.current?.focus(selectionRef.current)
  }, [findReplace])

  const { handleImageInput, handleFileInput, handlePaste, handleDragOver, handleDrop } =
    useMarkdownEditorMediaTransfers({
      disabled,
      valueRef,
      selectionRef,
      documentGenerationRef,
      onUploadImage,
      onUploadFile,
      applyPlannedMarkdownMutation,
      applyRecordedMarkdownMutation: applyMutationPlan,
      applyBackgroundMarkdownMutation,
      resolveActiveSelection,
      resolveDropTargetPosition: (coords) => liveSurfaceRef.current?.posAtCoords(coords) ?? null,
      setUploadInFlight,
      setEditorError: setUploadError,
      insertUploadedMarkdown,
    })

  const resolveSlashCoords = useCallback(
    (pos: number) => liveSurfaceRef.current?.coordsAtPos?.(pos) ?? null,
    []
  )

  const {
    slashMenuState,
    slashMenuOpenRef,
    slashMenuItems,
    checkSlashCommand,
    closeSlashMenu,
  } = useMarkdownEditorSlashMenu({
    selectionRef,
    applyMutationPlan,
    disableMermaid,
    onRequestImageUpload: onUploadImage ? () => imageInputRef.current?.click() : undefined,
    onRequestFileUpload: onUploadFile ? () => fileInputRef.current?.click() : undefined,
    resolveSlashCoords,
  })

  const isCompletionOrSlashMenuActive = useCallback(
    () => slashMenuOpenRef.current || Boolean(liveSurfaceRef.current?.isCompletionActive?.()),
    [slashMenuOpenRef]
  )

  const { handleTextareaKeyDown } = useMarkdownEditorTextareaKeyboard({
    disabled,
    valueRef,
    allowNativeTabAfterEscapeRef,
    rememberTextareaSelection,
    applyMutationPlan,
    applyRecordedMutation: applyMutationPlan,
    setTextareaSelection: setEditorSelection,
    onRequestSave,
    onToggleViewMode: cycleViewMode,
    isCompletionActive: isCompletionOrSlashMenuActive,
  })

  const handleLiveSelectionChange = useCallback(
    (selection: TextareaSelection) => {
      syncSelectionState(selection)
      handleFindReplaceSelectionChange(selection)
      updateActiveTableSelection(valueRef.current, selection)
      onSelectionChange?.(selection)
      checkSlashCommand(valueRef.current, selection)
    },
    [checkSlashCommand, handleFindReplaceSelectionChange, onSelectionChange, syncSelectionState, updateActiveTableSelection]
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
        disabled={disabled}
        disableMermaid={disableMermaid}
        viewMode={viewMode}
        tableRows={tableRows}
        tableColumns={tableColumns}
        commandContext={commandContext}
        toolbarCommands={toolbarCommands}
        imageInputRef={imageInputRef}
        fileInputRef={fileInputRef}
        hasUploadImage={Boolean(onUploadImage)}
        hasUploadFile={Boolean(onUploadFile)}
        onTableRowsChange={setTableRows}
        onTableColumnsChange={setTableColumns}
        onRememberSelection={rememberTextareaSelection}
        onApplyCommand={applyMarkdownEditorCommand}
        onApplySnippet={applySnippet}
        onApplyFormatShortcut={applyFormatShortcutOrAppend}
        onApplyListCommand={applyListCommand}
        onApplyBlockSnippet={applyBlockSnippet}
        onInsertTable={insertTable}
        onApplyTableEdit={applyTableEdit}
        isTableEditDisabled={isTableEditDisabled}
        onOpenFindReplace={findReplace.open}
        onImageFileSelect={handleImageFileSelect}
        onAttachmentFileSelect={handleAttachmentFileSelect}
        onViewModeChange={setViewMode}
      />
      {uploadError ? <ToolbarError role="alert">{uploadError}</ToolbarError> : null}
      {findReplace.panel ? (
        <MarkdownEditorFindReplace
          caseSensitive={findReplace.caseSensitive}
          currentMatch={findReplace.currentMatch}
          disabled={findReplace.panelDisabled}
          onCaseSensitiveChange={findReplace.updateCaseSensitive}
          onClose={handleCloseFindReplace}
          onNext={() => findReplace.move("next")}
          onPrevious={() => findReplace.move("previous")}
          onQueryChange={findReplace.updateQuery}
          onReplaceAll={findReplace.replaceAll}
          onReplaceCurrent={findReplace.replaceCurrent}
          onReplacementChange={findReplace.updateReplacement}
          replacement={findReplace.replacement}
          replaceCurrentDisabled={findReplace.replaceCurrentDisabled}
          scopeLabel={findReplace.panel.scope ? "선택 영역" : "전체 문서"}
          totalMatches={findReplace.totalMatches}
          query={findReplace.query}
        />
      ) : null}
      <LiveEditorBody ref={liveEditorBodyRef} aria-disabled={disabled} $isEmpty={!draftValue}>
        <MarkdownEditorNotionChrome
          containerRef={liveEditorBodyRef}
          mode={viewMode}
          disabled={disabled}
          value={draftValue}
          selection={editorSelection}
          isSlashMenuOpen={slashMenuState.isOpen}
          isFindReplaceOpen={Boolean(findReplace.panel)}
          resolveCoords={resolveSlashCoords}
          onApplySnippet={applySnippet}
          onApplyFormatShortcut={applyFormatShortcutOrAppend}
          onApplyListCommand={applyListCommand}
          onStripBlockPrefix={applyStripBlockPrefix}
          onApplyLineCommand={applyLineCommand}
          onTriggerSlashCommand={(plan) => {
            applyPlannedMarkdownMutation(plan)
            checkSlashCommand(valueRef.current, selectionRef.current)
          }}
        />
        <MarkdownEditorLiveSurface
          ref={liveSurfaceRef}
          value={draftValue}
          disabled={disabled}
          disableMermaid={disableMermaid}
          mode={viewMode}
          onToggleViewMode={cycleViewMode}
          ariaDescription={TEXTAREA_KEYBOARD_HELP}
          onChange={handleLiveChange}
          onSelectionChange={handleLiveSelectionChange}
          onRequestFocusTitle={onRequestFocusTitle}
          onKeyDownCapture={handleTextareaKeyDown}
          onPasteCapture={handlePaste}
          onDragOver={handleDragOver}
          onDropCapture={handleDrop}
        />
      </LiveEditorBody>
      <MarkdownEditorSlashMenu
        isOpen={slashMenuState.isOpen}
        position={slashMenuState.position}
        items={slashMenuItems}
        onClose={closeSlashMenu}
      />
    </EditorRoot>
  )
}
