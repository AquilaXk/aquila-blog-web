/**
 * 참조 구현:
 * - TryGhost/Koenig packages/koenig-lexical/src/components/ui/ToolbarMenu.jsx (MIT License, Copyright (c) Ghost Foundation)
 * - Milkdown/milkdown packages/crepe/src/feature/toolbar/ (MIT License, Copyright (c) 2021 Mirone)
 */
import { memo, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react"
import { useLanguage } from "../../libs/language"
import { editorT } from "./markdownEditorI18n"
import type { BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import type {
  MarkdownEditorCommandContext,
  MarkdownEditorCommandDescriptor,
} from "./markdownEditorCommandRegistryModel"
import type { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import {
  EditorIconArrowDown,
  EditorIconArrowUp,
  EditorIconBold,
  EditorIconBookmarkCard,
  EditorIconBulletList,
  EditorIconCalloutDanger,
  EditorIconCalloutInfo,
  EditorIconCalloutTip,
  EditorIconCalloutWarning,
  EditorIconCodeBlock,
  EditorIconDiagramNodes,
  EditorIconDivider,
  EditorIconDuplicate,
  EditorIconEmbedWindow,
  EditorIconEye,
  EditorIconFileCode,
  EditorIconHeading,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconHighlight,
  EditorIconImage,
  EditorIconInlineCode,
  EditorIconItalic,
  EditorIconLink,
  EditorIconMathSigma,
  EditorIconMoreHorizontal,
  EditorIconOrderedList,
  EditorIconPaperclip,
  EditorIconPenLine,
  EditorIconPlus,
  EditorIconQuote,
  EditorIconSearch,
  EditorIconStrikethrough,
  EditorIconTaskList,
  EditorIconToggle,
  EditorIconTrash,
} from "./MarkdownEditorIcons"
import {
  EditorToolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarHiddenInput,
} from "./MarkdownEditor.styles"
import {
  ToolbarCluster,
  ToolbarDivider,
  ToolbarModeSegmentButton,
  ToolbarModeSegmentGroup,
  ToolbarRailInner,
} from "./MarkdownEditorToolbar.styles"
import { createMarkdownEditorTable, type MarkdownEditorTableEdit } from "./markdownEditorTableModel"
import { MarkdownEditorTablePopover } from "./MarkdownEditorTablePopover"
import { MarkdownEditorToolbarMenu } from "./MarkdownEditorToolbarMenu"
import {
  blockMarkdownSnippets,
  buildToolbarTableSnippet,
  directiveBlockMarkdownSnippets,
  getToolbarCommandLabel,
  modShortcutLabel,
  toolbarListCommands,
  toolbarMarkdownSnippets,
} from "./markdownEditorToolbarModel"

type MarkdownEditorToolbarProps = {
  disabled: boolean
  disableMermaid: boolean
  viewMode: "live" | "source" | "reading"
  tableRows: number
  tableColumns: number
  commandContext: MarkdownEditorCommandContext
  toolbarCommands: readonly MarkdownEditorCommandDescriptor[]
  imageInputRef: RefObject<HTMLInputElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  hasUploadImage: boolean
  hasUploadFile: boolean
  onTableRowsChange: (rows: number) => void
  onTableColumnsChange: (columns: number) => void
  onRememberSelection: () => void
  onApplyCommand: (command: MarkdownEditorCommandDescriptor) => void
  onApplySnippet: (before: string, after?: string, options?: { toggle?: boolean }) => void
  onApplyFormatShortcut: (shortcut: Parameters<typeof planFormatShortcutMutation>[3]) => void
  onApplyListCommand: (command: MarkdownEditorListCommand) => void
  onApplyLineCommand?: (command: MarkdownEditorLineCommand) => void
  onApplyBlockSnippet: (spec: BlockSnippetSpec) => void
  onInsertTable: () => void
  onApplyTableEdit: (edit: MarkdownEditorTableEdit) => void
  isTableEditDisabled: (edit: MarkdownEditorTableEdit) => boolean
  onOpenFindReplace: () => void
  onImageFileSelect: (file: File | null) => void
  onAttachmentFileSelect: (file: File | null) => void
  onViewModeChange: (mode: "live" | "source" | "reading") => void
}

const handleEditorToolbarArrowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
  const key = event.key
  if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return
  const target = event.target instanceof HTMLElement ? event.target : null
  if (!target || target.tagName !== "BUTTON" || target.closest('[role="menu"], [role="dialog"]')) {
    return
  }

  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button")
  ).filter(
    (btn) =>
      !btn.disabled &&
      btn.getClientRects().length > 0 &&
      !btn.closest('[role="menu"], [role="dialog"]')
  )
  const currentIndex = buttons.indexOf(target as HTMLButtonElement)
  if (currentIndex === -1 || buttons.length === 0) return

  let nextIndex = currentIndex
  if (key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length
  else if (key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
  else if (key === "Home") nextIndex = 0
  else if (key === "End") nextIndex = buttons.length - 1

  event.preventDefault()
  buttons[nextIndex]?.focus()
}

const renderFormatCommandIcon = (command: MarkdownEditorCommandDescriptor): ReactNode => {
  if (command.id === "format.bold") return <EditorIconBold size={15} />
  return command.toolbarLabel
}

const renderPrimarySnippetIcon = (label: string): ReactNode => {
  if (label === "I") return <EditorIconItalic size={15} />
  if (label === "`") return <EditorIconInlineCode size={15} />
  return label
}

const MENU_ITEM_ICONS: Readonly<Record<string, ReactNode>> = {
  H1: <EditorIconHeading1 size={14} />,
  H2: <EditorIconHeading2 size={14} />,
  H3: <EditorIconHeading3 size={14} />,
  unordered: <EditorIconBulletList size={14} />,
  ordered: <EditorIconOrderedList size={14} />,
  task: <EditorIconTaskList size={14} />,
  인용구: <EditorIconQuote size={14} />,
  콜아웃: <EditorIconCalloutInfo size={14} />,
  "콜아웃 (정보)": <EditorIconCalloutInfo size={14} />,
  "콜아웃 (팁)": <EditorIconCalloutTip size={14} />,
  "콜아웃 (주의)": <EditorIconCalloutWarning size={14} />,
  "콜아웃 (위험)": <EditorIconCalloutDanger size={14} />,
  토글: <EditorIconToggle size={14} />,
  북마크: <EditorIconBookmarkCard size={14} />,
  "수식 블록": <EditorIconMathSigma size={14} />,
  Mermaid: <EditorIconDiagramNodes size={14} />,
  다이어그램: <EditorIconDiagramNodes size={14} />,
  임베드: <EditorIconEmbedWindow size={14} />,
  구분선: <EditorIconDivider size={14} />,
  "block.divider": <EditorIconDivider size={14} />,
  S: <EditorIconStrikethrough size={14} />,
  "format.highlight": <EditorIconHighlight size={14} />,
  "line.move-up": <EditorIconArrowUp size={14} />,
  "line.move-down": <EditorIconArrowDown size={14} />,
  "line.duplicate": <EditorIconDuplicate size={14} />,
  "line.delete": <EditorIconTrash size={14} />,
  "media.image": <EditorIconImage size={14} />,
  "media.file": <EditorIconPaperclip size={14} />,
  "tool.find-replace": <EditorIconSearch size={14} />,
}

const renderMenuItemIcon = (key: string): ReactNode => MENU_ITEM_ICONS[key] ?? null

const MarkdownEditorToolbarView = ({
  disabled,
  disableMermaid,
  viewMode,
  tableRows,
  tableColumns,
  commandContext,
  toolbarCommands,
  imageInputRef,
  fileInputRef,
  hasUploadImage,
  hasUploadFile,
  onTableRowsChange,
  onTableColumnsChange,
  onRememberSelection,
  onApplyCommand,
  onApplySnippet,
  onApplyFormatShortcut,
  onApplyListCommand,
  onApplyLineCommand,
  onApplyBlockSnippet,
  onInsertTable,
  onApplyTableEdit,
  isTableEditDisabled,
  onOpenFindReplace,
  onImageFileSelect,
  onAttachmentFileSelect,
  onViewModeChange,
}: MarkdownEditorToolbarProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const isAuthoringDisabled = disabled || viewMode === "reading"
  const effectiveCommandContext: MarkdownEditorCommandContext = isAuthoringDisabled
    ? { ...commandContext, disabled: true }
    : commandContext

  return (
    <EditorToolbar
      data-testid="markdown-editor-toolbar"
      role="toolbar"
      aria-label={editorT("toolbarAriaLabel", language)}
      onKeyDown={handleEditorToolbarArrowKeyDown}
    >
      <ToolbarRailInner>
        <ToolbarGroup>
          <ToolbarCluster role="group" aria-label={editorT("toolbarGroupFormat", language)}>
            {toolbarCommands
              .filter((command) => command.category === "format")
              .map((command) => {
                const label = getToolbarCommandLabel(command, language)
                return (
                  <ToolbarButton
                    key={command.id}
                    type="button"
                    title={label}
                    aria-label={label}
                    disabled={isAuthoringDisabled || !command.isEnabled(effectiveCommandContext)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onApplyCommand(command)}
                  >
                    {renderFormatCommandIcon(command)}
                  </ToolbarButton>
                )
              })}
            {toolbarMarkdownSnippets
              .filter((snippet) => snippet.group === "primary")
              .map((snippet) => {
                const localizedTitle = isEn ? snippet.titleEn : snippet.title
                return (
                  <ToolbarButton
                    key={snippet.title}
                    type="button"
                    title={localizedTitle}
                    aria-label={localizedTitle}
                    disabled={isAuthoringDisabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      onApplySnippet(snippet.before, snippet.after, {
                        toggle: "toggle" in snippet && snippet.toggle,
                      })
                    }
                  >
                    {renderPrimarySnippetIcon(snippet.label)}
                  </ToolbarButton>
                )
              })}

            <ToolbarButton
              type="button"
              title={editorT("toolbarLinkTitle", language)}
              aria-label={editorT("toolbarLinkTitle", language)}
              disabled={isAuthoringDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyFormatShortcut("link")}
            >
              <EditorIconLink size={15} />
            </ToolbarButton>

            {(
              [
                [editorT("toolbarQuote", language), "quote", "> ", ""],
                [editorT("toolbarCodeBlock", language), "codeblock", "```ts\n", "\n```"],
              ] as const
            ).map(([title, iconKey, before, after]) => (
              <ToolbarButton
                key={iconKey}
                type="button"
                data-mobile-hidden="true"
                title={title}
                aria-label={title}
                disabled={isAuthoringDisabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onApplySnippet(before, after)}
              >
                {iconKey === "quote" ? <EditorIconQuote size={15} /> : <EditorIconCodeBlock size={15} />}
              </ToolbarButton>
            ))}
          </ToolbarCluster>

          <ToolbarDivider role="separator" aria-orientation="vertical" />

          <ToolbarCluster role="group" aria-label={editorT("toolbarGroupBlock", language)}>
            <MarkdownEditorToolbarMenu
              label={editorT("toolbarHeading", language)}
              triggerIcon={<EditorIconHeading size={15} />}
              triggerLabel={editorT("toolbarHeading", language)}
              disabled={isAuthoringDisabled}
              onBeforeOpen={onRememberSelection}
              actions={toolbarMarkdownSnippets
                .filter((snippet) => snippet.group === "heading")
                .map((snippet) => ({
                  id: snippet.title,
                  label: isEn ? snippet.titleEn : snippet.title,
                  icon: renderMenuItemIcon(snippet.label),
                  onSelect: () => onApplySnippet(snippet.before, snippet.after),
                }))}
            />
            <MarkdownEditorToolbarMenu
              label={editorT("toolbarList", language)}
              triggerIcon={<EditorIconBulletList size={15} />}
              triggerLabel={editorT("toolbarList", language)}
              disabled={isAuthoringDisabled}
              onBeforeOpen={onRememberSelection}
              actions={toolbarListCommands.map((command) => ({
                id: command.command,
                label: isEn ? command.titleEn : command.title,
                icon: renderMenuItemIcon(command.command),
                onSelect: () => onApplyListCommand(command.command),
              }))}
            />
            <MarkdownEditorToolbarMenu
              label={editorT("toolbarInsert", language)}
              triggerIcon={<EditorIconPlus size={15} />}
              triggerLabel={editorT("toolbarInsert", language)}
              disabled={isAuthoringDisabled}
              onBeforeOpen={onRememberSelection}
              actions={[
                ...toolbarMarkdownSnippets
                  .filter((snippet) => snippet.group === "structure")
                  .map((snippet) => ({
                    id: snippet.title,
                    label: isEn ? snippet.titleEn : snippet.title,
                    icon: renderMenuItemIcon(snippet.title),
                    onSelect: () => onApplySnippet(snippet.before, snippet.after),
                  })),
                ...toolbarCommands
                  .filter((command) => command.category === "block")
                  .map((command) => ({
                    id: command.id,
                    label: isEn ? command.labelEn : command.label,
                    icon: renderMenuItemIcon(command.id),
                    disabled: !command.isEnabled(effectiveCommandContext),
                    onSelect: () => onApplyCommand(command),
                  })),
                ...blockMarkdownSnippets
                  .filter((snippet) => snippet.label !== "Table" && snippet.label !== "Code")
                  .map((snippet) => ({
                    id: snippet.title,
                    label: isEn ? snippet.titleEn : snippet.title,
                    icon: renderMenuItemIcon(snippet.title),
                    disabled: "disableWhenMermaid" in snippet && disableMermaid,
                    onSelect: () => onApplyBlockSnippet(snippet),
                  })),
                ...directiveBlockMarkdownSnippets.map((snippet) => ({
                  id: snippet.title,
                  label: isEn ? snippet.titleEn : snippet.title,
                  icon: renderMenuItemIcon(snippet.title),
                  onSelect: () => onApplyBlockSnippet(snippet),
                })),
              ]}
            />

            <MarkdownEditorTablePopover
              rows={tableRows}
              columns={tableColumns}
              disabled={isAuthoringDisabled}
              onRowsChange={onTableRowsChange}
              onColumnsChange={onTableColumnsChange}
              onInsertSize={(r, c) => {
                if (r === tableRows && c === tableColumns && createMarkdownEditorTable(r, c)) {
                  onInsertTable()
                  return
                }
                onApplyBlockSnippet(buildToolbarTableSnippet(r, c))
              }}
              onBeforeOpen={onRememberSelection}
              actions={[
                {
                  id: "table.insert",
                  label: `${editorT("toolbarTableInsertPrefix", language)} (${tableRows}×${tableColumns})`,
                  onSelect: () => {
                    if (createMarkdownEditorTable(tableRows, tableColumns)) {
                      onInsertTable()
                      return
                    }
                    onApplyBlockSnippet(buildToolbarTableSnippet(tableRows, tableColumns))
                  },
                },
                ...toolbarCommands
                  .filter((command) => command.category === "table")
                  .map((command) => ({
                    id: command.id,
                    label: isEn ? command.labelEn : command.label,
                    disabled: !command.isEnabled(effectiveCommandContext),
                    onSelect: () => onApplyCommand(command),
                  })),
                ...(
                  [
                    [editorT("toolbarTableDeleteRow", language), { kind: "delete-row" }],
                    [editorT("toolbarTableAddCol", language), { kind: "add-column" }],
                    [editorT("toolbarTableDeleteCol", language), { kind: "delete-column" }],
                    [editorT("toolbarTableAlignLeft", language), { kind: "set-alignment", alignment: "left" }],
                    [editorT("toolbarTableAlignCenter", language), { kind: "set-alignment", alignment: "center" }],
                    [editorT("toolbarTableAlignRight", language), { kind: "set-alignment", alignment: "right" }],
                  ] as const
                ).map(([label, edit]) => ({
                  id: label,
                  label,
                  disabled: isAuthoringDisabled || isTableEditDisabled(edit),
                  onSelect: () => onApplyTableEdit(edit),
                })),
              ]}
            />
            <MarkdownEditorToolbarMenu
              label={editorT("toolbarMore", language)}
              triggerLabel={<EditorIconMoreHorizontal size={15} />}
              showChevron={false}
              disabled={isAuthoringDisabled}
              align="end"
              onBeforeOpen={onRememberSelection}
              actions={[
                ...toolbarMarkdownSnippets
                  .filter((snippet) => snippet.group === "more")
                  .map((snippet) => ({
                    id: snippet.title,
                    label: isEn ? snippet.titleEn : snippet.title,
                    icon: renderMenuItemIcon(snippet.label),
                    onSelect: () =>
                      onApplySnippet(snippet.before, snippet.after, {
                        toggle: "toggle" in snippet && snippet.toggle,
                      }),
                  })),
                {
                  id: "format.highlight",
                  label: editorT("toolbarHighlight", language),
                  icon: renderMenuItemIcon("format.highlight"),
                  onSelect: () => onApplySnippet("==", "==", { toggle: true }),
                },
                ...(onApplyLineCommand
                  ? [
                      {
                        id: "line.move-up",
                        label: editorT("toolbarLineMoveUp", language),
                        icon: renderMenuItemIcon("line.move-up"),
                        onSelect: () => onApplyLineCommand("move-up"),
                      },
                      {
                        id: "line.move-down",
                        label: editorT("toolbarLineMoveDown", language),
                        icon: renderMenuItemIcon("line.move-down"),
                        onSelect: () => onApplyLineCommand("move-down"),
                      },
                      {
                        id: "line.duplicate",
                        label: editorT("toolbarLineDuplicate", language),
                        icon: renderMenuItemIcon("line.duplicate"),
                        onSelect: () => onApplyLineCommand("duplicate"),
                      },
                      {
                        id: "line.delete",
                        label: editorT("toolbarLineDelete", language),
                        icon: renderMenuItemIcon("line.delete"),
                        onSelect: () => onApplyLineCommand("delete"),
                      },
                    ]
                  : []),
                {
                  id: "media.image",
                  label: editorT("toolbarImage", language),
                  icon: renderMenuItemIcon("media.image"),
                  disabled: !hasUploadImage,
                  onSelect: () => imageInputRef.current?.click(),
                },
                {
                  id: "media.file",
                  label: editorT("toolbarFile", language),
                  icon: renderMenuItemIcon("media.file"),
                  disabled: !hasUploadFile,
                  onSelect: () => fileInputRef.current?.click(),
                },
                {
                  id: "tool.find-replace",
                  label: editorT("toolbarFindReplace", language),
                  icon: renderMenuItemIcon("tool.find-replace"),
                  onSelect: onOpenFindReplace,
                },
              ]}
            />
          </ToolbarCluster>
          <ToolbarHiddenInput
            ref={imageInputRef}
            type="file"
            accept="image/*"
            aria-hidden="true"
            tabIndex={-1}
            disabled={isAuthoringDisabled || !hasUploadImage}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              onImageFileSelect(file)
              event.currentTarget.value = ""
            }}
          />
          <ToolbarHiddenInput
            ref={fileInputRef}
            type="file"
            aria-hidden="true"
            tabIndex={-1}
            disabled={isAuthoringDisabled || !hasUploadFile}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              onAttachmentFileSelect(file)
              event.currentTarget.value = ""
            }}
          />
        </ToolbarGroup>
        <ToolbarGroup data-align="end">
          <ToolbarModeSegmentGroup role="group" aria-label={editorT("toolbarGroupMode", language)}>
            <ToolbarModeSegmentButton
              type="button"
              title={editorT("toolbarModeLiveTitle", language)}
              aria-label={editorT("toolbarModeLiveAria", language)}
              aria-pressed={viewMode === "live"}
              disabled={disabled}
              $active={viewMode === "live"}
              onClick={() => onViewModeChange("live")}
            >
              <EditorIconPenLine size={13} />
              <span>{editorT("toolbarModeLiveShort", language)}</span>
            </ToolbarModeSegmentButton>
            <ToolbarModeSegmentButton
              type="button"
              title={editorT("toolbarModeSourceTitle", language)}
              aria-label={editorT("toolbarModeSourceAria", language)}
              aria-pressed={viewMode === "source"}
              disabled={disabled}
              $active={viewMode === "source"}
              onClick={() => onViewModeChange("source")}
            >
              <EditorIconFileCode size={13} />
              <span>{editorT("toolbarModeSourceShort", language)}</span>
            </ToolbarModeSegmentButton>
            <ToolbarModeSegmentButton
              type="button"
              title={editorT("toolbarModeReadingTitle", language)}
              aria-label={editorT("toolbarModeReadingAria", language)}
              aria-pressed={viewMode === "reading"}
              disabled={disabled}
              $active={viewMode === "reading"}
              onClick={() => onViewModeChange("reading")}
            >
              <EditorIconEye size={13} />
              <span>{editorT("toolbarModeReadingShort", language)}</span>
            </ToolbarModeSegmentButton>
          </ToolbarModeSegmentGroup>
        </ToolbarGroup>
      </ToolbarRailInner>
    </EditorToolbar>
  )
}

export const MarkdownEditorToolbar = memo(MarkdownEditorToolbarView)
