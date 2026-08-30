export type MarkdownEditorCommandId = "format.bold" | "block.code" | "table.add-row"

export type MarkdownEditorCommandCategory = "format" | "block" | "table"

export type MarkdownEditorCommandContext = {
  disabled: boolean
  selectionStart: number
  selectionEnd: number
  isTableSelection: boolean
}

export type MarkdownEditorCommandAction =
  | { kind: "format"; shortcut: "bold" }
  | { kind: "block"; block: "code" }
  | { kind: "table"; edit: "add-row" }

export type MarkdownEditorCommandDescriptor = {
  id: MarkdownEditorCommandId
  category: MarkdownEditorCommandCategory
  label: string
  toolbarLabel: string
  shortcut?: "Mod+B"
  isEnabled: (context: MarkdownEditorCommandContext) => boolean
  execute: (context: MarkdownEditorCommandContext) => MarkdownEditorCommandAction | null
}

const canEdit = (context: MarkdownEditorCommandContext) => !context.disabled

export const markdownEditorCommands = [
  {
    id: "format.bold",
    category: "format",
    label: "굵게",
    toolbarLabel: "B",
    shortcut: "Mod+B",
    isEnabled: canEdit,
    execute: (context) => (canEdit(context) ? { kind: "format", shortcut: "bold" } : null),
  },
  {
    id: "block.code",
    category: "block",
    label: "코드 블록",
    toolbarLabel: "Code",
    isEnabled: canEdit,
    execute: (context) => (canEdit(context) ? { kind: "block", block: "code" } : null),
  },
  {
    id: "table.add-row",
    category: "table",
    label: "표 행 추가",
    toolbarLabel: "표 행 추가",
    isEnabled: (context) => canEdit(context) && context.isTableSelection,
    execute: (context) => (canEdit(context) && context.isTableSelection ? { kind: "table", edit: "add-row" } : null),
  },
] as const satisfies readonly MarkdownEditorCommandDescriptor[]

export const validateMarkdownEditorCommands = (commands: readonly MarkdownEditorCommandDescriptor[]) => {
  const ids = new Set<string>()
  const shortcuts = new Set<string>()

  for (const command of commands) {
    if (ids.has(command.id)) throw new Error(`Duplicate command id: ${command.id}`)
    ids.add(command.id)

    if (command.shortcut) {
      if (shortcuts.has(command.shortcut)) throw new Error(`Duplicate command shortcut: ${command.shortcut}`)
      shortcuts.add(command.shortcut)
    }
  }
}

validateMarkdownEditorCommands(markdownEditorCommands)

export const getMarkdownEditorCommand = (id: MarkdownEditorCommandId) =>
  markdownEditorCommands.find((command) => command.id === id)

export const projectMarkdownEditorToolbarCommands = () => markdownEditorCommands

export const groupMarkdownEditorCommands = () =>
  ([
    ["format", "서식"],
    ["block", "블록"],
    ["table", "표"],
  ] as const).map(([category, label]) => ({
    category,
    label,
    commands: markdownEditorCommands.filter((command) => command.category === category),
  }))

export const resolveMarkdownEditorCommandShortcut = (event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}) => {
  const mod = event.metaKey || event.ctrlKey
  if (!mod || event.shiftKey || event.altKey || event.key.toLowerCase() !== "b") return null
  return getMarkdownEditorCommand("format.bold") ?? null
}
