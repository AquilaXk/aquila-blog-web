import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { EDITOR_COLOR_SWATCH_SPECS } from "./markdownEditorBlockChromeModel"
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
  const runAction = (action: () => void) => {
    onClose()
    action()
  }

  const turnIntoItems = [
    { kind: "paragraph", label: "일반 문단으로 전환", icon: <EditorIconParagraph size={13} />, run: () => onStripBlockPrefix() },
    { kind: "h1", label: "제목 1로 블록 전환", icon: <EditorIconHeading1 size={13} />, run: () => onApplySnippet("# ", "") },
    { kind: "h2", label: "제목 2로 블록 전환", icon: <EditorIconHeading2 size={13} />, run: () => onApplySnippet("## ", "") },
    { kind: "h3", label: "제목 3으로 블록 전환", icon: <EditorIconHeading3 size={13} />, run: () => onApplySnippet("### ", "") },
    { kind: "unordered", label: "글머리 목록으로 블록 전환", icon: <EditorIconBulletList size={13} />, run: () => onApplyListCommand("unordered") },
    { kind: "ordered", label: "번호 목록으로 블록 전환", icon: <EditorIconOrderedList size={13} />, run: () => onApplyListCommand("ordered") },
    { kind: "task", label: "할 일 목록으로 블록 전환", icon: <EditorIconTaskList size={13} />, run: () => onApplyListCommand("task") },
    { kind: "quote", label: "인용구로 블록 전환", icon: <EditorIconQuote size={13} />, run: () => onApplySnippet("> ", "") },
  ]

  const lineActionItems = [
    { label: "현재 줄 복제", icon: <EditorIconDuplicate size={13} />, run: () => onApplyLineCommand("duplicate") },
    { label: "현재 줄 위로 이동", icon: <EditorIconArrowUp size={13} />, run: () => onApplyLineCommand("move-up") },
    { label: "현재 줄 아래로 이동", icon: <EditorIconArrowDown size={13} />, run: () => onApplyLineCommand("move-down") },
    { label: "현재 줄 삭제", icon: <EditorIconTrash size={13} />, run: () => onApplyLineCommand("delete") },
  ]

  return (
    <BlockActionMenuPopover
      ref={blockMenuRef}
      role="menu"
      aria-label="블록 작업 메뉴"
      data-testid="markdown-block-action-menu"
      $top={position.top}
      $left={position.left}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose()
      }}
    >
      <BlockMenuSectionHeader aria-hidden="true">블록 전환</BlockMenuSectionHeader>
      {turnIntoItems.map((item) => (
        <BlockMenuItemButton
          key={item.label}
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
      <BlockMenuSectionHeader aria-hidden="true">글자 색상</BlockMenuSectionHeader>
      <ColorSwatchRow>
        {EDITOR_COLOR_SWATCH_SPECS.map((swatch) => (
          <ColorSwatchMenuButton
            key={swatch.label}
            type="button"
            role="menuitem"
            aria-label={swatch.label}
            title={swatch.label}
            $color={swatch.hex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runAction(() => onApplyColorSwatch(swatch.token))}
          >
            <ColorSwatchDot $color={swatch.hex} />
            <span aria-hidden="true">A</span>
          </ColorSwatchMenuButton>
        ))}
      </ColorSwatchRow>
      <BlockMenuSectionDivider aria-hidden="true" />
      <BlockMenuSectionHeader aria-hidden="true">블록 작업</BlockMenuSectionHeader>
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
