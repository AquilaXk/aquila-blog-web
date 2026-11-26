import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { useLanguage, type SiteLanguage } from "../../libs/language"
import { createBareDirectiveUnfurlTracker } from "./markdownEditorBareDirectiveUnfurl"
import {
  applyImageWidthCommitToMarkdown,
  type MarkdownImageWidthCommitPayload,
} from "./markdownEditorImageControls"
import { findMarkdownLinkAtOffset } from "./markdownEditorLinkUtils"
import {
  EDITOR_ACTIVE_LINE_PLACEHOLDER,
  EDITOR_EMPTY_BODY_PLACEHOLDER,
  editorT,
} from "./markdownEditorI18n"
import { useModShortcutLabel } from "./markdownEditorToolbarModel"
import { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import { EditorRoot, ToolbarError, ToolbarHiddenInput, LiveEditorBody } from "./MarkdownEditor.styles"
import { applyPlannedTextMutationToValue, type PlannedTextMutation } from "./markdownEditorTextMutation"
import {
  projectMarkdownEditorToolbarCommands,
} from "./markdownEditorCommandRegistryModel"
import { MarkdownEditorFindReplace } from "./MarkdownEditorFindReplace"
import { useMarkdownEditorFindReplace } from "./useMarkdownEditorFindReplace"
import { type MarkdownFileUploadResult, type MarkdownImageUploadResult } from "./markdownEditorUploadModel"
import { useMarkdownEditorMediaTransfers } from "./useMarkdownEditorMediaTransfers"
import { useMarkdownEditorTextareaKeyboard } from "./useMarkdownEditorTextareaKeyboard"
import {
  isLivePreviewSurfaceMode,
  nextEditorViewMode,
  scheduleScrollSyncAfterModeToggle,
  type MarkdownEditorSurfaceMode,
} from "./markdownEditorLivePreview"
import { MarkdownEditorLiveSurface, type MarkdownEditorLiveSurfaceHandle } from "./MarkdownEditorLiveSurface"
import { MarkdownEditorReadingPreview } from "./MarkdownEditorReadingPreview"
import { MarkdownEditorBlockChrome } from "./MarkdownEditorBlockChrome"
import { MarkdownEditorSlashMenu } from "./MarkdownEditorSlashMenu"
import { MarkdownEditorToolbar } from "./MarkdownEditorToolbar"
import { useMarkdownEditorSlashMenu } from "./useMarkdownEditorSlashMenu"
import { resolveActiveTableCellOffset, useMarkdownEditorTableControls } from "./useMarkdownEditorTableControls"
import {
  applyPlannedOrFallbackMutation,
  applySurfaceMutationIfAllowed,
  applySurfaceOrFallbackBackgroundPlan,
  syncDomOrSnapshotSelection,
  useMarkdownEditorCommandActions,
  useMarkdownEditorLifecycleEffects,
} from "./useMarkdownEditorCommandLifecycle"
export { isTableEditActionDisabled, resolveActiveTableCellOffset } from "./useMarkdownEditorTableControls"
export { matchSlashCommandTrigger, resolveSlashCommandMutation, SLASH_COMMAND_SPECS } from "./useMarkdownEditorSlashMenu"

type MarkdownChangeMeta = { editorFocused: boolean }
export type MarkdownEditorFocusSelection = { from: number; to: number }
export type MarkdownEditorFocusRequestOptions =
  | MarkdownEditorFocusSelection
  | { insertSnippet: string; fallbackSelection?: MarkdownEditorFocusSelection }
export type MarkdownEditorFocusRequest = (options?: MarkdownEditorFocusRequestOptions) => boolean | void

type MarkdownEditorProps = {
  value: string; disabled?: boolean; disableMermaid?: boolean
  internalLinkTargets?: Readonly<Record<string, string>>
  onRequestFocusTitle?: () => void
  onChange: (markdown: string, meta?: MarkdownChangeMeta) => void
  onSelectionChange?: (selection: MarkdownEditorFocusSelection) => void
  onFlushMarkdownReady?: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: MarkdownEditorFocusRequest | null) => void
  onToggleViewModeRequestReady?: (toggle: (() => void) | null) => void
  onRequestSave?: () => void; onUploadingChange?: (isUploading: boolean) => void
  onUploadImage?: (file: File) => Promise<MarkdownImageUploadResult>
  onUploadFile?: (file: File) => Promise<MarkdownFileUploadResult>
  onRequestCloudAsset?: () => void
}

type TextareaSelection = MarkdownEditorFocusSelection

const isEditorAuthoringDisabled = (disabled: boolean, viewMode: MarkdownEditorSurfaceMode): boolean =>
  disabled || viewMode === "reading"

const selectSameOrNextSelection = (prev: TextareaSelection, next: TextareaSelection): TextareaSelection =>
  prev.from === next.from && prev.to === next.to ? prev : next

const clampSelectionToLength = (from: number, to: number, length: number): TextareaSelection => ({
  from: Math.max(0, Math.min(from, length)), to: Math.max(0, Math.min(to, length)),
})

const createOptionalInputPicker = (enabled: boolean, inputRef: RefObject<HTMLInputElement | null>): (() => void) | undefined =>
  enabled ? () => inputRef.current?.click() : undefined

const selectOptionalCallback = <T,>(enabled: boolean, callback: T): T | undefined => (enabled ? callback : undefined)

const renderUploadErrorBanner = (uploadError: string) =>
  uploadError ? <ToolbarError role="alert">{uploadError}</ToolbarError> : null

const renderFindReplaceSection = (
  findReplace: ReturnType<typeof useMarkdownEditorFindReplace>,
  language: SiteLanguage,
  onClose: () => void
) => {
  if (!findReplace.panel) return null
  const scopeLabel = editorT(findReplace.panel.scope ? "findScopeSelection" : "findScopeDocument", language)
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
  value, disabled = false, disableMermaid = false, internalLinkTargets, onRequestFocusTitle, onChange,
  onSelectionChange, onFlushMarkdownReady, onFocusRequestReady, onToggleViewModeRequestReady, onRequestSave,
  onUploadingChange, onUploadImage, onUploadFile, onRequestCloudAsset,
}: MarkdownEditorProps) => {
  const { language } = useLanguage()
  const activeModLabel = useModShortcutLabel()
  const [uploadError, setUploadError] = useState("")
  const [draftValue, setDraftValue] = useState(value)
  const [viewMode, setViewModeState] = useState<MarkdownEditorSurfaceMode>("live")
  const [editorSelection, setEditorSelectionState] = useState<TextareaSelection>({ from: 0, to: 0 })
  const liveEditorBodyRef = useRef<HTMLDivElement | null>(null)
  const liveSurfaceRef = useRef<MarkdownEditorLiveSurfaceHandle | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef(value)
  const selectionRef = useRef<TextareaSelection>({ from: 0, to: 0 })
  const documentGenerationRef = useRef(0)
  const bareDirectiveUnfurlTrackerRef = useRef<ReturnType<typeof createBareDirectiveUnfurlTracker> | null>(null)
  if (!bareDirectiveUnfurlTrackerRef.current) {
    bareDirectiveUnfurlTrackerRef.current = createBareDirectiveUnfurlTracker()
  }
  const uploadInFlightCountRef = useRef(0)
  const allowNativeTabAfterEscapeRef = useRef(false)
  const pendingFindReplaceInvalidationRef = useRef(false)
  const isAuthoringDisabled = isEditorAuthoringDisabled(disabled, viewMode)
  const applyViewModeWithScrollSync = useCallback((nextOrUpdater: MarkdownEditorSurfaceMode | ((prev: MarkdownEditorSurfaceMode) => MarkdownEditorSurfaceMode)) => {
    scheduleScrollSyncAfterModeToggle(() => liveEditorBodyRef.current)
    setViewModeState(nextOrUpdater)
  }, [])
  const cycleViewMode = useCallback(() => applyViewModeWithScrollSync(nextEditorViewMode), [applyViewModeWithScrollSync])
  useEffect(() => {
    onToggleViewModeRequestReady?.(cycleViewMode)
    return () => onToggleViewModeRequestReady?.(null)
  }, [cycleViewMode, onToggleViewModeRequestReady])
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
      setUploadInFlight, setEditorError: setUploadError,
    })

  const resolveSlashCoords = useCallback((pos: number) => liveSurfaceRef.current?.coordsAtPos?.(pos) ?? null, [])
  const requestChromeMeasure = useCallback(
    <T,>(spec: { key?: string; read: () => T; write: (measured: T) => void }) =>
      liveSurfaceRef.current?.requestMeasure?.(spec) ?? false,
    []
  )

  const { slashMenuState, slashMenuOpenRef, slashMenuItems, checkSlashCommand, closeSlashMenu } =
    useMarkdownEditorSlashMenu({
      selectionRef, applyMutationPlan, language, disableMermaid,
      disableCloudAsset: !onRequestCloudAsset,
      onRequestImageUpload: createOptionalInputPicker(Boolean(onUploadImage), imageInputRef),
      onRequestFileUpload: createOptionalInputPicker(Boolean(onUploadFile), fileInputRef),
      onRequestCloudAsset,
      resolveSlashCoords,
    })

  useMarkdownEditorLifecycleEffects({
    value, disabled, viewMode, valueRef, documentGenerationRef, pendingFindReplaceInvalidationRef,
    liveEditorBodyRef, liveSurfaceRef, setDraftValue, resetTableAvailability,
    invalidateFindReplace, closeSlashMenu, resolveActiveSelection, applyMutationPlan,
    onFlushMarkdownReady, onFocusRequestReady,
  })

  const [linkPopoverTriggerNonce, setLinkPopoverTriggerNonce] = useState(0)
  const [toolbarPortalSlot, setToolbarPortalSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setToolbarPortalSlot(document.getElementById("editor-studio-toolbar-slot"))
  }, [])

  const isCompletionOrSlashMenuActive = useCallback(
    () => slashMenuOpenRef.current || Boolean(liveSurfaceRef.current?.isCompletionActive?.()),
    [slashMenuOpenRef]
  )

  const handleOpenLiveLinkPopover = useCallback(
    (explicitSelection?: TextareaSelection): boolean => {
      if (isAuthoringDisabled || !isLivePreviewSurfaceMode(viewMode)) return false
      const activeSel = explicitSelection ?? resolveActiveSelection()
      const hasCollapsedLink =
        activeSel.from === activeSel.to && findMarkdownLinkAtOffset(valueRef.current, activeSel.from) !== null
      if (activeSel.from >= activeSel.to && !hasCollapsedLink) return false
      setLinkPopoverTriggerNonce((prev) => prev + 1)
      return true
    },
    [isAuthoringDisabled, resolveActiveSelection, viewMode]
  )

  const handleToolbarLinkPopover = useCallback(() => handleOpenLiveLinkPopover(), [handleOpenLiveLinkPopover])

  const resolvePosAtCoords = useCallback(
    (coords: { x: number; y: number }) => liveSurfaceRef.current?.posAtCoords(coords) ?? null,
    []
  )

  const handleSelectGutterLine = useCallback((lineStart: number) => {
    liveSurfaceRef.current?.setSelection({ from: lineStart, to: lineStart })
  }, [])

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
    onToggleViewMode: cycleViewMode, onOpenFindReplace: findReplace.open,
    onRequestOpenLinkPopover: handleOpenLiveLinkPopover,
    isFindReplaceOpen: Boolean(findReplace.panel), onCloseFindReplace: handleCloseFindReplace,
    isCompletionActive: isCompletionOrSlashMenuActive,
  })

  const handleLiveSelectionChange = useCallback(
    (selection: TextareaSelection, _docChanged?: boolean, isComposing?: boolean) => {
      syncSelectionState(selection)
      handleFindReplaceSelectionChange(selection)
      syncSelectionTableAvailability(valueRef.current, selection)
      onSelectionChange?.(selection)
      if (isLivePreviewSurfaceMode(viewMode) && !disabled) {
        checkSlashCommand(valueRef.current, selection, { isComposing })
        const expectedGen = documentGenerationRef.current
        bareDirectiveUnfurlTrackerRef.current?.trackSelection({
          markdown: valueRef.current,
          offset: selection.from,
          isCurrentGeneration: () => documentGenerationRef.current === expectedGen,
          getCurrentValue: () => valueRef.current,
          applyBackgroundMutation: applyBackgroundMarkdownMutation,
        })
      }
    },
    [
      applyBackgroundMarkdownMutation,
      checkSlashCommand,
      disabled,
      handleFindReplaceSelectionChange,
      onSelectionChange,
      syncSelectionState,
      syncSelectionTableAvailability,
      viewMode,
    ]
  )

  const handleImageWidthCommit = useCallback(
    (payload: MarkdownImageWidthCommitPayload) => {
      if (disabled) return
      const plan = applyImageWidthCommitToMarkdown(valueRef.current, payload)
      if (!plan) return
      if (isAuthoringDisabled) {
        applyFallbackValueMutation(plan)
      } else {
        applyPlannedMarkdownMutation(plan)
      }
    },
    [applyFallbackValueMutation, applyPlannedMarkdownMutation, disabled, isAuthoringDisabled]
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

  const toolbarElement = (
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
      onOpenFindReplace={findReplace.open} onOpenLinkPopover={handleToolbarLinkPopover}
      onImageFileSelect={handleImageFileSelect}
      onAttachmentFileSelect={handleAttachmentFileSelect} onViewModeChange={applyViewModeWithScrollSync}
    />
  )

  return (
    <EditorRoot data-testid="markdown-editor">
      {toolbarPortalSlot ? createPortal(toolbarElement, toolbarPortalSlot) : toolbarElement}
      {renderUploadErrorBanner(uploadError)}
      {renderFindReplaceSection(findReplace, language, handleCloseFindReplace)}
      <LiveEditorBody
        ref={liveEditorBodyRef}
        aria-disabled={disabled}
        data-view-mode={viewMode}
        $isEmpty={!draftValue}
        $isReading={viewMode === "reading"}
        $emptyPlaceholder={EDITOR_EMPTY_BODY_PLACEHOLDER[language]}
        $activeLinePlaceholder={EDITOR_ACTIVE_LINE_PLACEHOLDER[language]}
      >
        <MarkdownEditorBlockChrome
          containerRef={liveEditorBodyRef} mode={viewMode} disabled={isAuthoringDisabled}
          value={draftValue} selection={editorSelection} isSlashMenuOpen={slashMenuState.isOpen}
          isFindReplaceOpen={Boolean(findReplace.panel)} resolveCoords={resolveSlashCoords}
          resolvePosAtCoords={resolvePosAtCoords} requestMeasure={requestChromeMeasure}
          linkPopoverTriggerNonce={linkPopoverTriggerNonce} onSelectGutterLine={handleSelectGutterLine}
          onApplySnippet={applySnippet} onApplyFormatShortcut={applyFormatShortcutOrAppend}
          onApplyListCommand={applyListCommand} onStripBlockPrefix={applyStripBlockPrefix}
          onApplyLineCommand={applyLineCommand} onTriggerSlashCommand={handleTriggerSlashCommand}
        />
        <MarkdownEditorLiveSurface
          ref={liveSurfaceRef} value={draftValue} disabled={disabled} disableMermaid={disableMermaid}
          mode={viewMode} language={language} onToggleViewMode={cycleViewMode}
          ariaDescription={editorT("keyboardHelp", language, activeModLabel)}
          onChange={handleLiveChange} onSelectionChange={handleLiveSelectionChange}
          onRequestFocusTitle={onRequestFocusTitle} onKeyDownCapture={handleTextareaKeyDown}
          onPasteCapture={handlePaste} onDragOver={handleDragOver} onDropCapture={handleDrop}
        />
        {viewMode === "reading" || viewMode === "split" ? (
          <MarkdownEditorReadingPreview
            value={draftValue}
            disableMermaid={disableMermaid}
            internalLinkTargets={internalLinkTargets}
            onImageWidthCommit={disabled ? undefined : handleImageWidthCommit}
          />
        ) : null}
      </LiveEditorBody>
      <MarkdownEditorSlashMenu
        isOpen={slashMenuState.isOpen} position={slashMenuState.position}
        items={slashMenuItems} onClose={closeSlashMenu}
      />
      <ToolbarHiddenInput
        ref={imageInputRef}
        type="file"
        accept="image/*"
        aria-hidden="true"
        tabIndex={-1}
        disabled={isAuthoringDisabled || !onUploadImage}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          handleImageFileSelect(file)
          event.currentTarget.value = ""
        }}
      />
      <ToolbarHiddenInput
        ref={fileInputRef}
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        disabled={isAuthoringDisabled || !onUploadFile}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          handleAttachmentFileSelect(file)
          event.currentTarget.value = ""
        }}
      />
    </EditorRoot>
  )
}
