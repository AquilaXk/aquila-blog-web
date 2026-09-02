import { useCallback, useEffect, useRef, useState } from "react"
import { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import {
  planToggleListCommand,
  type MarkdownEditorListCommand,
} from "./markdownEditorListCommandsModel"
import {
  EditorRoot,
  EditorToolbar,
  ToolbarGroup,
  ToolbarButton,
  ToolbarSelect,
  ToolbarHiddenInput,
  ToolbarError,
  LiveEditorBody,
} from "./MarkdownEditor.styles"
import {
  applyPlannedTextMutationToValue,
  planToggleWrapSelection,
  planWrapSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"
import { codeBlockSnippet, planInsertBlockSnippet, type BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import {
  projectMarkdownEditorToolbarCommands,
  type MarkdownEditorCommandDescriptor,
} from "./markdownEditorCommandRegistryModel"
import {
  createMarkdownEditorTable,
  isMarkdownEditorTableSelection,
  planMarkdownEditorTableEdit,
  type MarkdownEditorTableEdit,
} from "./markdownEditorTableModel"
import { MarkdownEditorFindReplace } from "./MarkdownEditorFindReplace"
import { useMarkdownEditorFindReplace } from "./useMarkdownEditorFindReplace"
import {
  type MarkdownFileUploadResult,
  type MarkdownImageUploadResult,
} from "./markdownEditorUploadModel"
import {
  blockMarkdownSnippets,
  modShortcutLabel,
  toolbarListCommands,
  toolbarMarkdownSnippets,
} from "./markdownEditorToolbarModel"
import { useMarkdownEditorMediaTransfers } from "./useMarkdownEditorMediaTransfers"
import { useMarkdownEditorTextareaKeyboard } from "./useMarkdownEditorTextareaKeyboard"
import {
  MarkdownEditorLiveSurface,
  type MarkdownEditorLiveSurfaceHandle,
} from "./MarkdownEditorLiveSurface"
import { MarkdownEditorToolbarMenu } from "./MarkdownEditorToolbarMenu"

type MarkdownChangeMeta = {
  editorFocused: boolean
}

export type MarkdownEditorFocusSelection = {
  from: number
  to: number
}

export type MarkdownEditorFocusRequest = (selection?: MarkdownEditorFocusSelection) => void

type MarkdownEditorProps = {
  value: string
  disabled?: boolean
  disableMermaid?: boolean
  onChange: (markdown: string, meta?: MarkdownChangeMeta) => void
  onFlushMarkdownReady?: (flush: (() => string) | null) => void
  onFocusRequestReady?: (focus: MarkdownEditorFocusRequest | null) => void
  onRequestSave?: () => void
  onUploadingChange?: (isUploading: boolean) => void
  onUploadImage?: (file: File) => Promise<MarkdownImageUploadResult>
  onUploadFile?: (file: File) => Promise<MarkdownFileUploadResult>
}

type TextareaSelection = MarkdownEditorFocusSelection

const TABLE_ADD_ROW_EDIT: MarkdownEditorTableEdit = { kind: "add-row" }

const getToolbarCommandLabel = (command: MarkdownEditorCommandDescriptor) =>
  command.shortcut
    ? `${command.label} (${command.shortcut.replace("Mod+", modShortcutLabel)})`
    : command.label

const TEXTAREA_KEYBOARD_HELP =
  `표 셀에서는 Tab과 Shift+Tab으로 다음 또는 이전 셀로 이동합니다. 표 밖에서는 Tab은 2칸 들여쓰기, Shift+Tab은 내어쓰기입니다. 괄호·따옴표·인라인 코드는 자동으로 쌍을 입력합니다. Alt+ArrowUp과 Alt+ArrowDown은 현재 줄을 이동하고, Shift+Alt+ArrowDown은 복제합니다. ${modShortcutLabel}Shift+K는 현재 줄을 삭제합니다. Escape를 누른 다음 Tab은 포커스를 다음 요소로 이동합니다.`

export const MarkdownEditor = ({
  value,
  disabled = false,
  disableMermaid = false,
  onChange,
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
  const [activeTableSelection, setActiveTableSelection] = useState<TextareaSelection | null>(null)
  const liveSurfaceRef = useRef<MarkdownEditorLiveSurfaceHandle | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef(value)
  const selectionRef = useRef<TextareaSelection>({ from: 0, to: 0 })
  const documentGenerationRef = useRef(0)
  const uploadInFlightCountRef = useRef(0)
  const allowNativeTabAfterEscapeRef = useRef(false)
  const pendingFindReplaceInvalidationRef = useRef(false)

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
    setActiveTableSelection(null)
    pendingFindReplaceInvalidationRef.current = true
    // External replace (e.g. restoreLocalDraft) — invalidate in-flight placeholder completions.
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
    setActiveTableSelection(
      isMarkdownEditorTableSelection(nextValue, selection.from, selection.to) ? selection : null
    )
  }, [])

  const setEditorSelection = useCallback((from: number, to = from) => {
    const length = valueRef.current.length
    const nextSelection = {
      from: Math.max(0, Math.min(from, length)),
      to: Math.max(0, Math.min(to, length)),
    }
    selectionRef.current = nextSelection
    updateActiveTableSelection(valueRef.current, nextSelection)
    liveSurfaceRef.current?.focus(nextSelection)
  }, [updateActiveTableSelection])

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
      selectionRef.current = { from: plan.selectionStart, to: plan.selectionEnd }
      if (options?.clearUploadError !== false) setUploadError("")
      return surface.applyMutation(plan)
    },
    [disabled]
  )

  const readEditorSnapshot = useCallback(() => liveSurfaceRef.current?.readSnapshot() ?? null, [])

  const applyMutationPlan = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) =>
      applyRawMutationPlan(plan, options),
    [applyRawMutationPlan]
  )

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
    if (snapshot) selectionRef.current = snapshot.selection
    handleFindReplaceSelectionChange(selectionRef.current)
    updateActiveTableSelection(valueRef.current, selectionRef.current)
    return selectionRef.current
  }, [handleFindReplaceSelectionChange, updateActiveTableSelection])

  const resolveActiveSelection = useCallback(
    () => liveSurfaceRef.current ? rememberTextareaSelection() : selectionRef.current,
    [rememberTextareaSelection]
  )

  const applyPlannedMarkdownMutation = useCallback(
    (plan: PlannedTextMutation, options?: { clearUploadError?: boolean }) => {
      if (applyMutationPlan(plan, options)) return true

      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      selectionRef.current = { from: next.selectionStart, to: next.selectionEnd }
      updateActiveTableSelection(next.value, selectionRef.current)
      commitMarkdown(next.value, true, options)
      return true
    },
    [applyMutationPlan, commitMarkdown, updateActiveTableSelection]
  )

  /**
   * Async upload placeholder swap/remove — update only the verified placeholder range, preserve focus/error state,
   * and preserve the active selection without moving focus.
   * Must proceed even when the editor UI is temporarily disabled (e.g. loadingKey), so in-flight
   * upload completions can still replace/remove placeholders. New user inserts stay blocked elsewhere.
   */
  const applyBackgroundMarkdownMutation = useCallback(
    (plan: PlannedTextMutation) => {
      const commitOptions = { clearUploadError: false as const }
      const surface = liveSurfaceRef.current
      if (surface) {
            selectionRef.current = { from: plan.selectionStart, to: plan.selectionEnd }
            return surface.applyMutation(plan, {
              focus: false,
              scrollIntoView: false,
              addToHistory: false,
              clearUploadError: false,
              replaceTransientContent: true,
            })
      }

      const next = applyPlannedTextMutationToValue(valueRef.current, plan)
      selectionRef.current = { from: next.selectionStart, to: next.selectionEnd }
      commitMarkdown(next.value, false, commitOptions)
      return true
    },
    [commitMarkdown]
  )

  const insertMarkdownAtEditorSelection = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (!liveSurfaceRef.current || disabled) return false

      const { from: selectionStart, to: selectionEnd } = resolveActiveSelection()
      const plan = options?.toggle
        ? planToggleWrapSelection(valueRef.current, selectionStart, selectionEnd, before, after)
        : planWrapSelection(valueRef.current, selectionStart, selectionEnd, before, after)

      return applyMutationPlan(plan)
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
    if (!table) return
    applyBlockSnippet(table)
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

  const isTableEditDisabled = (edit: MarkdownEditorTableEdit) =>
    disabled ||
    !activeTableSelection ||
    !planMarkdownEditorTableEdit(
      draftValue,
      activeTableSelection.from,
      activeTableSelection.to,
      edit
    )

  const commandContext = {
    disabled,
    selectionStart: selectionRef.current.from,
    selectionEnd: selectionRef.current.to,
    isTableSelection: !isTableEditDisabled(TABLE_ADD_ROW_EDIT),
  }
  const toolbarCommands = projectMarkdownEditorToolbarCommands()

  const applyMarkdownEditorCommand = (command: MarkdownEditorCommandDescriptor) => {
    const action = command.execute(commandContext)
    if (!action) return

    if (action.kind === "format") {
      applyFormatShortcutOrAppend(action.shortcut)
      return
    }
    if (action.kind === "block") {
      applyBlockSnippet(codeBlockSnippet)
      return
    }
    applyTableEdit(TABLE_ADD_ROW_EDIT)
  }

  const applySnippet = useCallback(
    (before: string, after = "", options?: { toggle?: boolean }) => {
      if (disabled) return
      if (insertMarkdownAtEditorSelection(before, after, options)) return

      const { from, to } = resolveActiveSelection()
      const plan = options?.toggle
        ? planToggleWrapSelection(valueRef.current, from, to, before, after)
        : planWrapSelection(valueRef.current, from, to, before, after)
      applyPlannedMarkdownMutation(plan)
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

  const applyFormatShortcutOrAppend = useCallback(
    (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) => {
      if (disabled) return
      const { from, to } = resolveActiveSelection()
      applyPlannedMarkdownMutation(planFormatShortcutMutation(valueRef.current, from, to, shortcut))
    },
    [applyPlannedMarkdownMutation, disabled, resolveActiveSelection]
  )

  const insertUploadedMarkdown = useCallback(
    (markdown: string) => {
      if (insertMarkdownAtEditorSelection(markdown)) return
      commitMarkdown(`${valueRef.current}${markdown}`, true)
    },
    [commitMarkdown, insertMarkdownAtEditorSelection]
  )

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
      setUploadInFlight,
      setEditorError: setUploadError,
      insertUploadedMarkdown,
    })

  const { handleTextareaKeyDown } = useMarkdownEditorTextareaKeyboard({
    disabled,
    valueRef,
    allowNativeTabAfterEscapeRef,
    rememberTextareaSelection,
    applyMutationPlan,
    applyRecordedMutation: applyMutationPlan,
    setTextareaSelection: setEditorSelection,
    onRequestSave,
  })

  const handleLiveSelectionChange = useCallback(
    (selection: TextareaSelection) => {
      selectionRef.current = selection
      handleFindReplaceSelectionChange(selection)
      updateActiveTableSelection(valueRef.current, selection)
    },
    [handleFindReplaceSelectionChange, updateActiveTableSelection]
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

  return (
    <EditorRoot data-testid="markdown-editor">
      <EditorToolbar role="toolbar" aria-label="Markdown 작성 도구">
        <ToolbarGroup>
          {toolbarCommands.filter((command) => command.category === "format").map((command) => {
            const label = getToolbarCommandLabel(command)
            return (
              <ToolbarButton
                key={command.id}
                type="button"
                title={label}
                aria-label={label}
                disabled={!command.isEnabled(commandContext)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyMarkdownEditorCommand(command)}
              >
                {command.toolbarLabel}
              </ToolbarButton>
            )
          })}
          {toolbarMarkdownSnippets.filter((snippet) => snippet.group === "primary").map((snippet) => (
            <ToolbarButton
              key={snippet.title}
              type="button"
              title={snippet.title}
              aria-label={snippet.title}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                applySnippet(snippet.before, snippet.after, {
                  toggle: "toggle" in snippet && snippet.toggle,
                })
              }
            >
              {snippet.label}
            </ToolbarButton>
          ))}

          <ToolbarButton
            type="button"
            title={`링크 (${modShortcutLabel}K)`}
            aria-label={`링크 (${modShortcutLabel}K)`}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatShortcutOrAppend("link")}
          >
            Link
          </ToolbarButton>

          <MarkdownEditorToolbarMenu
            label="제목"
            triggerLabel="H"
            disabled={disabled}
            onBeforeOpen={rememberTextareaSelection}
            actions={toolbarMarkdownSnippets
              .filter((snippet) => snippet.group === "heading")
              .map((snippet) => ({
                id: snippet.title,
                label: snippet.title,
                onSelect: () => applySnippet(snippet.before, snippet.after),
              }))}
          />
          <MarkdownEditorToolbarMenu
            label="목록"
            triggerLabel="List"
            disabled={disabled}
            onBeforeOpen={rememberTextareaSelection}
            actions={toolbarListCommands.map((command) => ({
              id: command.command,
              label: command.title,
              onSelect: () => applyListCommand(command.command),
            }))}
          />
          <MarkdownEditorToolbarMenu
            label="삽입"
            triggerLabel="+"
            disabled={disabled}
            onBeforeOpen={rememberTextareaSelection}
            actions={[
              ...toolbarMarkdownSnippets
                .filter((snippet) => snippet.group === "structure")
                .map((snippet) => ({
                  id: snippet.title,
                  label: snippet.title,
                  onSelect: () => applySnippet(snippet.before, snippet.after),
                })),
              ...toolbarCommands
                .filter((command) => command.category === "block")
                .map((command) => ({
                  id: command.id,
                  label: command.label,
                  disabled: !command.isEnabled(commandContext),
                  onSelect: () => applyMarkdownEditorCommand(command),
                })),
              ...blockMarkdownSnippets
                .filter((snippet) => snippet.title !== "표" && snippet.title !== "코드 블록")
                .map((snippet) => ({
                  id: snippet.title,
                  label: snippet.title,
                  disabled: "disableWhenMermaid" in snippet && disableMermaid,
                  onSelect: () => applyBlockSnippet(snippet),
                })),
            ]}
          />

          <ToolbarSelect
            aria-label="표 행"
            value={tableRows}
            disabled={disabled}
            onChange={(event) => setTableRows(Number(event.currentTarget.value))}
          >
            {[2, 3, 4, 5, 6].map((rows) => (
              <option key={rows} value={rows}>{`${rows}행`}</option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect
            aria-label="표 열"
            value={tableColumns}
            disabled={disabled}
            onChange={(event) => setTableColumns(Number(event.currentTarget.value))}
          >
            {[2, 3, 4, 5, 6].map((columns) => (
              <option key={columns} value={columns}>{`${columns}열`}</option>
            ))}
          </ToolbarSelect>
          <MarkdownEditorToolbarMenu
            label="표"
            triggerLabel="Table"
            disabled={disabled}
            onBeforeOpen={rememberTextareaSelection}
            actions={[
              {
                id: "table.insert",
                label: `표 삽입 (${tableRows}×${tableColumns})`,
                onSelect: insertTable,
              },
              ...toolbarCommands
                .filter((command) => command.category === "table")
                .map((command) => ({
                  id: command.id,
                  label: command.label,
                  disabled: !command.isEnabled(commandContext),
                  onSelect: () => applyMarkdownEditorCommand(command),
                })),
              ...([
                ["표 행 삭제", { kind: "delete-row" }],
                ["표 열 추가", { kind: "add-column" }],
                ["표 열 삭제", { kind: "delete-column" }],
                ["표 열 왼쪽 정렬", { kind: "set-alignment", alignment: "left" }],
                ["표 열 가운데 정렬", { kind: "set-alignment", alignment: "center" }],
                ["표 열 오른쪽 정렬", { kind: "set-alignment", alignment: "right" }],
              ] as const).map(([label, edit]) => ({
                id: label,
                label,
                disabled: isTableEditDisabled(edit),
                onSelect: () => applyTableEdit(edit),
              })),
            ]}
          />
          <MarkdownEditorToolbarMenu
            label="더보기"
            triggerLabel="⋯"
            disabled={disabled}
            align="end"
            onBeforeOpen={rememberTextareaSelection}
            actions={[
              ...toolbarMarkdownSnippets
                .filter((snippet) => snippet.group === "more")
                .map((snippet) => ({
                  id: snippet.title,
                  label: snippet.title,
                  onSelect: () => applySnippet(snippet.before, snippet.after, {
                    toggle: "toggle" in snippet && snippet.toggle,
                  }),
                })),
              {
                id: "media.image",
                label: "이미지",
                disabled: !onUploadImage,
                onSelect: () => imageInputRef.current?.click(),
              },
              {
                id: "media.file",
                label: "파일",
                disabled: !onUploadFile,
                onSelect: () => fileInputRef.current?.click(),
              },
              {
                id: "tool.find-replace",
                label: "찾기 및 바꾸기",
                onSelect: findReplace.open,
              },
            ]}
          />
          <ToolbarHiddenInput
            ref={imageInputRef}
            type="file"
            accept="image/*"
            aria-hidden="true"
            tabIndex={-1}
            disabled={disabled || !onUploadImage}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              void handleImageInput(file)
              event.currentTarget.value = ""
            }}
          />
          <ToolbarHiddenInput
            ref={fileInputRef}
            type="file"
            aria-hidden="true"
            tabIndex={-1}
            disabled={disabled || !onUploadFile}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              void handleFileInput(file)
              event.currentTarget.value = ""
            }}
          />
        </ToolbarGroup>
      </EditorToolbar>
      {uploadError ? <ToolbarError role="alert">{uploadError}</ToolbarError> : null}
      {findReplace.panel ? (
        <MarkdownEditorFindReplace
          caseSensitive={findReplace.caseSensitive}
          currentMatch={findReplace.currentMatch}
          disabled={findReplace.panelDisabled}
          onCaseSensitiveChange={findReplace.updateCaseSensitive}
          onClose={findReplace.closePanel}
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
      <LiveEditorBody aria-disabled={disabled}>
        <MarkdownEditorLiveSurface
          ref={liveSurfaceRef}
          value={draftValue}
          disabled={disabled}
          ariaDescription={TEXTAREA_KEYBOARD_HELP}
          onChange={handleLiveChange}
          onSelectionChange={handleLiveSelectionChange}
          onKeyDownCapture={handleTextareaKeyDown}
          onPasteCapture={handlePaste}
          onDragOver={handleDragOver}
          onDropCapture={handleDrop}
        />
      </LiveEditorBody>
    </EditorRoot>
  )
}
