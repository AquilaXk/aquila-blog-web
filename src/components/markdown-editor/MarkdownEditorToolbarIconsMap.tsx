import type { ReactNode } from "react"
import type { MarkdownEditorCommandDescriptor } from "./markdownEditorCommandRegistryModel"
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
  EditorIconDiagramNodes,
  EditorIconDivider,
  EditorIconDuplicate,
  EditorIconEmbedWindow,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconHighlight,
  EditorIconImage,
  EditorIconInlineCode,
  EditorIconItalic,
  EditorIconMathSigma,
  EditorIconOrderedList,
  EditorIconPaperclip,
  EditorIconQuote,
  EditorIconSearch,
  EditorIconStrikethrough,
  EditorIconTaskList,
  EditorIconToggle,
  EditorIconTrash,
} from "./MarkdownEditorIcons"

export const renderFormatCommandIcon = (command: MarkdownEditorCommandDescriptor): ReactNode => {
  if (command.id === "format.bold") return <EditorIconBold size={15} />
  return command.toolbarLabel
}

export const renderPrimarySnippetIcon = (label: string): ReactNode => {
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

export const renderMenuItemIcon = (key: string): ReactNode => MENU_ITEM_ICONS[key] ?? null
