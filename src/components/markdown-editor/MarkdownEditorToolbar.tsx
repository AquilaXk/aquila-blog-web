import type { RefObject } from "react"
import type { BlockSnippetSpec } from "./markdownEditorBlockSnippets"
import type {
  MarkdownEditorCommandContext,
  MarkdownEditorCommandDescriptor,
} from "./markdownEditorCommandRegistryModel"
import type { planFormatShortcutMutation } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import {
  EditorToolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarHiddenInput,
} from "./MarkdownEditor.styles"
import type { MarkdownEditorTableEdit } from "./markdownEditorTableModel"
import { MarkdownEditorTablePopover } from "./MarkdownEditorTablePopover"
import { MarkdownEditorToolbarMenu } from "./MarkdownEditorToolbarMenu"
import {
  blockMarkdownSnippets,
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
  onApplyBlockSnippet: (spec: BlockSnippetSpec) => void
  onInsertTable: () => void
  onApplyTableEdit: (edit: MarkdownEditorTableEdit) => void
  isTableEditDisabled: (edit: MarkdownEditorTableEdit) => boolean
  onOpenFindReplace: () => void
  onImageFileSelect: (file: File | null) => void
  onAttachmentFileSelect: (file: File | null) => void
  onViewModeChange: (mode: "live" | "source" | "reading") => void
}

const getToolbarCommandLabel = (command: MarkdownEditorCommandDescriptor) =>
  command.shortcut
    ? `${command.label} (${command.shortcut.replace("Mod+", modShortcutLabel)})`
    : command.label

export const MarkdownEditorToolbar = ({
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
  onApplyBlockSnippet,
  onInsertTable,
  onApplyTableEdit,
  isTableEditDisabled,
  onOpenFindReplace,
  onImageFileSelect,
  onAttachmentFileSelect,
  onViewModeChange,
}: MarkdownEditorToolbarProps) => (
  <EditorToolbar role="toolbar" aria-label="Markdown 작성 도구">
    <ToolbarGroup>
      {toolbarCommands
        .filter((command) => command.category === "format")
        .map((command) => {
          const label = getToolbarCommandLabel(command)
          return (
            <ToolbarButton
              key={command.id}
              type="button"
              title={label}
              aria-label={label}
              disabled={!command.isEnabled(commandContext)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onApplyCommand(command)}
            >
              {command.toolbarLabel}
            </ToolbarButton>
          )
        })}
      {toolbarMarkdownSnippets
        .filter((snippet) => snippet.group === "primary")
        .map((snippet) => (
          <ToolbarButton
            key={snippet.title}
            type="button"
            title={snippet.title}
            aria-label={snippet.title}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              onApplySnippet(snippet.before, snippet.after, {
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
        onClick={() => onApplyFormatShortcut("link")}
      >
        링크
      </ToolbarButton>

      {(
        [
          ["제목 1 (H1)", "H1", "# "],
          ["제목 2 (H2)", "H2", "## "],
          ["인용구", "”", "> "],
          ["코드 블록", "</>", "```ts\n", "\n```"],
        ] as const
      ).map(([title, label, before, after = ""]) => (
        <ToolbarButton
          key={title}
          type="button"
          title={title}
          aria-label={title}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onApplySnippet(before, after)}
        >
          {label === "”" ? <span style={{ fontSize: "15px", lineHeight: 1 }}>”</span> : label}
        </ToolbarButton>
      ))}

      <MarkdownEditorToolbarMenu
        label="제목"
        triggerLabel="제목"
        disabled={disabled}
        onBeforeOpen={onRememberSelection}
        actions={toolbarMarkdownSnippets
          .filter((snippet) => snippet.group === "heading")
          .map((snippet) => ({
            id: snippet.title,
            label: snippet.title,
            onSelect: () => onApplySnippet(snippet.before, snippet.after),
          }))}
      />
      <MarkdownEditorToolbarMenu
        label="목록"
        triggerLabel="목록"
        disabled={disabled}
        onBeforeOpen={onRememberSelection}
        actions={toolbarListCommands.map((command) => ({
          id: command.command,
          label: command.title,
          onSelect: () => onApplyListCommand(command.command),
        }))}
      />
      <MarkdownEditorToolbarMenu
        label="삽입"
        triggerLabel="삽입"
        disabled={disabled}
        onBeforeOpen={onRememberSelection}
        actions={[
          ...toolbarMarkdownSnippets
            .filter((snippet) => snippet.group === "structure")
            .map((snippet) => ({
              id: snippet.title,
              label: snippet.title,
              onSelect: () => onApplySnippet(snippet.before, snippet.after),
            })),
          ...toolbarCommands
            .filter((command) => command.category === "block")
            .map((command) => ({
              id: command.id,
              label: command.label,
              disabled: !command.isEnabled(commandContext),
              onSelect: () => onApplyCommand(command),
            })),
          ...blockMarkdownSnippets
            .filter((snippet) => snippet.title !== "표" && snippet.title !== "코드 블록")
            .map((snippet) => ({
              id: snippet.title,
              label: snippet.title,
              disabled: "disableWhenMermaid" in snippet && disableMermaid,
              onSelect: () => onApplyBlockSnippet(snippet),
            })),
        ]}
      />

      <MarkdownEditorTablePopover
        rows={tableRows}
        columns={tableColumns}
        disabled={disabled}
        onRowsChange={onTableRowsChange}
        onColumnsChange={onTableColumnsChange}
        onBeforeOpen={onRememberSelection}
        actions={[
          {
            id: "table.insert",
            label: `표 삽입 (${tableRows}×${tableColumns})`,
            onSelect: onInsertTable,
          },
          ...toolbarCommands
            .filter((command) => command.category === "table")
            .map((command) => ({
              id: command.id,
              label: command.label,
              disabled: !command.isEnabled(commandContext),
              onSelect: () => onApplyCommand(command),
            })),
          ...(
            [
              ["표 행 삭제", { kind: "delete-row" }],
              ["표 열 추가", { kind: "add-column" }],
              ["표 열 삭제", { kind: "delete-column" }],
              ["표 열 왼쪽 정렬", { kind: "set-alignment", alignment: "left" }],
              ["표 열 가운데 정렬", { kind: "set-alignment", alignment: "center" }],
              ["표 열 오른쪽 정렬", { kind: "set-alignment", alignment: "right" }],
            ] as const
          ).map(([label, edit]) => ({
            id: label,
            label,
            disabled: isTableEditDisabled(edit),
            onSelect: () => onApplyTableEdit(edit),
          })),
        ]}
      />
      <MarkdownEditorToolbarMenu
        label="더보기"
        triggerLabel="⋯"
        disabled={disabled}
        align="end"
        onBeforeOpen={onRememberSelection}
        actions={[
          ...toolbarMarkdownSnippets
            .filter((snippet) => snippet.group === "more")
            .map((snippet) => ({
              id: snippet.title,
              label: snippet.title,
              onSelect: () =>
                onApplySnippet(snippet.before, snippet.after, {
                  toggle: "toggle" in snippet && snippet.toggle,
                }),
            })),
          {
            id: "media.image",
            label: "이미지",
            disabled: !hasUploadImage,
            onSelect: () => imageInputRef.current?.click(),
          },
          {
            id: "media.file",
            label: "파일",
            disabled: !hasUploadFile,
            onSelect: () => fileInputRef.current?.click(),
          },
          {
            id: "tool.find-replace",
            label: "찾기 및 바꾸기",
            onSelect: onOpenFindReplace,
          },
        ]}
      />
      <ToolbarHiddenInput
        ref={imageInputRef}
        type="file"
        accept="image/*"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled || !hasUploadImage}
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
        disabled={disabled || !hasUploadFile}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          onAttachmentFileSelect(file)
          event.currentTarget.value = ""
        }}
      />
    </ToolbarGroup>
    <ToolbarGroup style={{ marginLeft: "auto" }}>
      <ToolbarButton
        type="button"
        title={`라이브 프리뷰 (${modShortcutLabel}E)`}
        aria-label="라이브 프리뷰"
        $active={viewMode === "live"}
        onClick={() => onViewModeChange("live")}
      >
        라이브
      </ToolbarButton>
      <ToolbarButton
        type="button"
        title={`소스 모드 (${modShortcutLabel}E)`}
        aria-label="소스 모드"
        $active={viewMode === "source"}
        onClick={() => onViewModeChange("source")}
      >
        소스
      </ToolbarButton>
      <ToolbarButton
        type="button"
        title={`읽기 뷰 (${modShortcutLabel}E)`}
        aria-label="읽기 뷰"
        $active={viewMode === "reading"}
        onClick={() => onViewModeChange("reading")}
      >
        읽기
      </ToolbarButton>
    </ToolbarGroup>
  </EditorToolbar>
)
