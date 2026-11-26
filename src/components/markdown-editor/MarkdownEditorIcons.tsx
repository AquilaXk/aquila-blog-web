/**
 * 참조 구현:
 * - lucide-icons/lucide icons/*.svg (ISC License, Copyright (c) Lucide Contributors) — 24×24 원본 벡터
 * - TryGhost/Koenig packages/koenig-lexical/ (MIT License, Copyright (c) Ghost Foundation)
 * - steven-tey/novel (Apache-2.0 License, Copyright (c) Steven Tey)
 * - Milkdown/milkdown packages/crepe/ (MIT License, Copyright (c) Mirone)
 */
import React from "react"

export type EditorIconProps = {
  size?: number
  strokeWidth?: number
  className?: string
}

type SvgFrameProps = EditorIconProps & {
  children: React.ReactNode
}

const IconFrame: React.FC<SvgFrameProps> = ({
  size = 16,
  strokeWidth = 1.75,
  className,
  children,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: "block", flexShrink: 0 }}
  >
    {children}
  </svg>
)

export const EditorIconBold: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
  </IconFrame>
)

export const EditorIconItalic: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <line x1="19" x2="10" y1="4" y2="4" />
    <line x1="14" x2="5" y1="20" y2="20" />
    <line x1="15" x2="9" y1="4" y2="20" />
  </IconFrame>
)

export const EditorIconStrikethrough: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M16 4H9a3 3 0 0 0-2.83 4" />
    <path d="M14 12a4 4 0 0 1 0 8H6" />
    <line x1="4" x2="20" y1="12" y2="12" />
  </IconFrame>
)

export const EditorIconHighlight: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </IconFrame>
)

export const EditorIconInlineCode: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </IconFrame>
)

export const EditorIconCodeBlock: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M10 9.5 8 12l2 2.5" />
    <path d="m14 9.5 2 2.5-2 2.5" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </IconFrame>
)

export const EditorIconQuote: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
    <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
  </IconFrame>
)

export const EditorIconLink: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </IconFrame>
)

export const EditorIconUnlink: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
    <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
    <line x1="8" x2="8" y1="2" y2="5" />
    <line x1="2" x2="5" y1="8" y2="8" />
    <line x1="16" x2="16" y1="19" y2="22" />
    <line x1="19" x2="22" y1="16" y2="16" />
  </IconFrame>
)

export const EditorIconCheck: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M20 6 9 17l-5-5" />
  </IconFrame>
)

export const EditorIconClose: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconFrame>
)

export const EditorIconPlus: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </IconFrame>
)

export const EditorIconGripSixDots: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </IconFrame>
)

export const EditorIconParagraph: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M13 4v16" />
    <path d="M17 4v16" />
    <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />
  </IconFrame>
)

export const EditorIconHeading: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M6 12h12" />
    <path d="M6 20V4" />
    <path d="M18 20V4" />
  </IconFrame>
)

export const EditorIconHeading1: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="m17 12 3-2v8" />
  </IconFrame>
)

export const EditorIconHeading2: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
  </IconFrame>
)

export const EditorIconHeading3: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
    <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
  </IconFrame>
)

export const EditorIconBulletList: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M3 12h.01" />
    <path d="M3 18h.01" />
    <path d="M3 6h.01" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <path d="M8 6h13" />
  </IconFrame>
)

export const EditorIconOrderedList: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M10 12h11" />
    <path d="M10 18h11" />
    <path d="M10 6h11" />
    <path d="M4 10h2" />
    <path d="M4 6h1v4" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </IconFrame>
)

export const EditorIconTaskList: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m3 17 2 2 4-4" />
    <path d="m3 7 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </IconFrame>
)

export const EditorIconDivider: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m16 16-4 4-4-4" />
    <path d="M3 12h18" />
    <path d="m8 8 4-4 4 4" />
  </IconFrame>
)

export const EditorIconTable: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M12 3v18" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </IconFrame>
)

export const EditorIconSearch: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </IconFrame>
)

export const EditorIconImage: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </IconFrame>
)

export const EditorIconPaperclip: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </IconFrame>
)

export const EditorIconCalloutInfo: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </IconFrame>
)

export const EditorIconCalloutTip: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </IconFrame>
)

export const EditorIconCalloutWarning: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </IconFrame>
)

export const EditorIconCalloutDanger: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </IconFrame>
)

export const EditorIconToggle: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m9 18 6-6-6-6" />
  </IconFrame>
)

export const EditorIconMathSigma: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2" />
  </IconFrame>
)

export const EditorIconDiagramNodes: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
    <path d="M12 12V8" />
  </IconFrame>
)

export const EditorIconEmbedWindow: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M10 4v4" />
    <path d="M2 8h20" />
    <path d="M6 4v4" />
  </IconFrame>
)

export const EditorIconBookmarkCard: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </IconFrame>
)

export const EditorIconChevronDown: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m6 9 6 6 6-6" />
  </IconFrame>
)

export const EditorIconEye: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </IconFrame>
)

export const EditorIconFileCode: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M10 12.5 8 15l2 2.5" />
    <path d="m14 12.5 2 2.5-2 2.5" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
  </IconFrame>
)

export const EditorIconPenLine: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </IconFrame>
)

export const EditorIconBookOpen: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </IconFrame>
)

export const EditorIconDuplicate: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </IconFrame>
)

export const EditorIconArrowLeft: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </IconFrame>
)

export const EditorIconArrowUp: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </IconFrame>
)

export const EditorIconArrowDown: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </IconFrame>
)

export const EditorIconTrash: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </IconFrame>
)

export const EditorIconMoreHorizontal: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
    <circle cx="5" cy="12" r="1" fill="currentColor" />
  </IconFrame>
)

export const EditorIconSidebarLeft: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </IconFrame>
)

export const EditorIconSidebarRight: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
  </IconFrame>
)

export const EditorIconMaximize: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <path d="M15 3h6v6" />
    <path d="M9 21H3v-6" />
    <path d="m21 3-7 7" />
    <path d="m3 21 7-7" />
  </IconFrame>
)

export const EditorIconSplitPane: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M12 3v18" />
  </IconFrame>
)

export const EditorIconCopy: React.FC<EditorIconProps> = (props) => (
  <IconFrame {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </IconFrame>
)

export {
  EditorIconBold as Bold,
  EditorIconItalic as Italic,
  EditorIconStrikethrough as Strikethrough,
  EditorIconInlineCode as InlineCode,
  EditorIconCodeBlock as CodeBlock,
  EditorIconQuote as Quote,
  EditorIconLink as Link,
  EditorIconUnlink as Unlink,
  EditorIconCheck as Check,
  EditorIconClose as Close,
  EditorIconPlus as Plus,
  EditorIconGripSixDots as GripSixDots,
  EditorIconParagraph as Paragraph,
  EditorIconHeading as Heading,
  EditorIconHeading1 as Heading1,
  EditorIconHeading2 as Heading2,
  EditorIconHeading3 as Heading3,
  EditorIconBulletList as BulletList,
  EditorIconOrderedList as OrderedList,
  EditorIconTaskList as TaskList,
  EditorIconDivider as Divider,
  EditorIconTable as Table,
  EditorIconSearch as Search,
  EditorIconImage as Image,
  EditorIconPaperclip as Paperclip,
  EditorIconCalloutInfo as CalloutInfo,
  EditorIconCalloutTip as CalloutTip,
  EditorIconCalloutWarning as CalloutWarning,
  EditorIconCalloutDanger as CalloutDanger,
  EditorIconToggle as Toggle,
  EditorIconMathSigma as MathSigma,
  EditorIconDiagramNodes as DiagramNodes,
  EditorIconEmbedWindow as EmbedWindow,
  EditorIconBookmarkCard as BookmarkCard,
  EditorIconChevronDown as ChevronDown,
  EditorIconEye as Eye,
  EditorIconFileCode as FileCode,
  EditorIconPenLine as PenLine,
  EditorIconBookOpen as BookOpen,
  EditorIconDuplicate as Duplicate,
  EditorIconArrowUp as ArrowUp,
  EditorIconArrowDown as ArrowDown,
  EditorIconTrash as Trash,
}
