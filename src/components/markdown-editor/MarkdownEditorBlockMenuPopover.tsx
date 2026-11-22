import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react"
import { useLanguage } from "src/libs/language"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { EDITOR_COLOR_SWATCH_SPECS } from "./markdownEditorBlockChromeModel"
import { getBlockChromeLabels, getColorSwatchLabel } from "./markdownEditorBlockChromeLabels"
import {
  BlockActionMenuPopover,
  BlockMenuItemButton,
  BlockMenuSectionDivider,
  BlockMenuSectionHeader,
  ColorSwatchDot,
  ColorSwatchMenuButton,
  ColorSwatchRow,
} from "./MarkdownEditorBlockChrome.styles"
import {
  EditorIconArrowDown,
  EditorIconArrowUp,
  EditorIconBulletList,
  EditorIconCheck,
  EditorIconDuplicate,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconOrderedList,
  EditorIconParagraph,
  EditorIconQuote,
  EditorIconTaskList,
  EditorIconTrash,
} from "./MarkdownEditorIcons"

type MarkdownEditorBlockMenuPopoverProps = {
  blockMenuRef: RefObject<HTMLDivElement | null>
  position: { top: number; left: number }
  activeBlockKind: string
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onClose: () => void
  onApplySnippet: (before: string, after?: string, options?: { toggle?: boolean }) => void
  onApplyListCommand: (command: MarkdownEditorListCommand) => void
  onStripBlockPrefix: () => void
  onApplyLineCommand: (command: MarkdownEditorLineCommand) => void
  onApplyColorSwatch: (token: string) => void
}

export const MarkdownEditorBlockMenuPopover = ({
  blockMenuRef,
  position,
  activeBlockKind,
  onKeyDown,
  onClose,
  onApplySnippet,
  onApplyListCommand,
  onStripBlockPrefix,
  onApplyLineCommand,
  onApplyColorSwatch,
}: MarkdownEditorBlockMenuPopoverProps) => {
  const { language } = useLanguage()
  const labels = getBlockChromeLabels(language)
  const runAction = (action: () => void) => {
    onClose()
    action()
  }

  const turnIntoItems = [
    { kind: "paragraph", label: labels.turnIntoParagraph, icon: <EditorIconParagraph size={13} />, run: () => onStripBlockPrefix() },
    { kind: "h1", label: labels.turnIntoHeading1, icon: <EditorIconHeading1 size={13} />, run: () => onApplySnippet("# ", "") },
    { kind: "h2", label: labels.turnIntoHeading2, icon: <EditorIconHeading2 size={13} />, run: () => onApplySnippet("## ", "") },
    { kind: "h3", label: labels.turnIntoHeading3, icon: <EditorIconHeading3 size={13} />, run: () => onApplySnippet("### ", "") },
    { kind: "unordered", label: labels.turnIntoUnordered, icon: <EditorIconBulletList size={13} />, run: () => onApplyListCommand("unordered") },
    { kind: "ordered", label: labels.turnIntoOrdered, icon: <EditorIconOrderedList size={13} />, run: () => onApplyListCommand("ordered") },
    { kind: "task", label: labels.turnIntoTask, icon: <EditorIconTaskList size={13} />, run: () => onApplyListCommand("task") },
    { kind: "quote", label: labels.turnIntoQuote, icon: <EditorIconQuote size={13} />, run: () => onApplySnippet("> ", "") },
  ]

  const lineActionItems = [
    { label: labels.lineDuplicate, icon: <EditorIconDuplicate size={13} />, run: () => onApplyLineCommand("duplicate") },
    { label: labels.lineMoveUp, icon: <EditorIconArrowUp size={13} />, run: () => onApplyLineCommand("move-up") },
    { label: labels.lineMoveDown, icon: <EditorIconArrowDown size={13} />, run: () => onApplyLineCommand("move-down") },
    { label: labels.lineDelete, icon: <EditorIconTrash size={13} />, run: () => onApplyLineCommand("delete") },
  ]

  return (
    <BlockActionMenuPopover
      ref={blockMenuRef}
      role="menu"
      aria-label={labels.blockMenuAria}
      data-testid="markdown-block-action-menu"
      $top={position.top}
      $left={position.left}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose()
      }}
    >
      <BlockMenuSectionHeader aria-hidden="true">{labels.turnIntoSection}</BlockMenuSectionHeader>
      {turnIntoItems.map((item) => (
        <BlockMenuItemButton
          key={item.kind}
          type="button"
          role="menuitem"
          data-active={activeBlockKind === item.kind ? "true" : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runAction(item.run)}
        >
          <span className="glyph" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
          {activeBlockKind === item.kind ? (
            <span className="check" aria-hidden="true"><EditorIconCheck size={13} /></span>
          ) : null}
        </BlockMenuItemButton>
      ))}
      <BlockMenuSectionDivider aria-hidden="true" />
      <BlockMenuSectionHeader aria-hidden="true">{labels.textColorSection}</BlockMenuSectionHeader>
      <ColorSwatchRow>
        {EDITOR_COLOR_SWATCH_SPECS.map((swatch) => {
          const swatchLabel = getColorSwatchLabel(language, swatch.token, swatch.label)
          return (
            <ColorSwatchMenuButton
              key={swatch.token}
              type="button"
              role="menuitem"
              aria-label={swatchLabel}
              title={swatchLabel}
              $color={swatch.hex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(() => onApplyColorSwatch(swatch.token))}
            >
              <ColorSwatchDot $color={swatch.hex} />
              <span aria-hidden="true">A</span>
            </ColorSwatchMenuButton>
          )
        })}
      </ColorSwatchRow>
      <BlockMenuSectionDivider aria-hidden="true" />
      <BlockMenuSectionHeader aria-hidden="true">{labels.lineActionSection}</BlockMenuSectionHeader>
      {lineActionItems.map((item) => (
        <BlockMenuItemButton
          key={item.label}
          type="button"
          role="menuitem"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runAction(item.run)}
        >
          <span className="glyph" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </BlockMenuItemButton>
      ))}
    </BlockActionMenuPopover>
  )
}
