/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/theme/common/block-edit.css & feature/block-edit/menu/ (MIT License, Copyright (c) 2021 Mirone)
 */
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { useLanguage } from "src/libs/language"
import { zIndexes } from "src/styles/zIndexes"
import { editorT } from "./markdownEditorI18n"
import {
  EditorIconBookmarkCard,
  EditorIconBulletList,
  EditorIconCalloutDanger,
  EditorIconCalloutInfo,
  EditorIconCalloutTip,
  EditorIconCalloutWarning,
  EditorIconCodeBlock,
  EditorIconDiagramNodes,
  EditorIconDivider,
  EditorIconEmbedWindow,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconImage,
  EditorIconMathSigma,
  EditorIconOrderedList,
  EditorIconPaperclip,
  EditorIconParagraph,
  EditorIconQuote,
  EditorIconTable,
  EditorIconTaskList,
  EditorIconToggle,
  type EditorIconProps,
} from "./MarkdownEditorIcons"

export type SlashCommandGroup = "기본 블록" | "콜아웃 · 확장" | "미디어 · 수식 · 표"

export type SlashMenuItem = {
  id: string
  label: string
  description: string
  icon: string
  group?: SlashCommandGroup
  action: () => void
}

export type SlashCommandSpec = {
  id: string
  label: string
  description: string
  icon: string
  snippet: string
  group: SlashCommandGroup
  keywords: string[]
}

const SLASH_COMMAND_SPEC_ROWS = [
  "heading-1|기본 블록|heading-1|제목 1 (H1)|가장 큰 섹션 제목|h1,heading1,title,제목1,대제목|# ",
  "heading-2|기본 블록|heading-2|제목 2 (H2)|중간 섹션 제목|h2,heading2,subtitle,제목2,중제목|## ",
  "heading-3|기본 블록|heading-3|제목 3 (H3)|작은 소제목|h3,heading3,제목3,소제목|### ",
  "bullet-list|기본 블록|bullet-list|글머리 기호 목록 (Bullet)|순서 없는 글머리 목록|ul,bullet,list,글머리,목록|- ",
  "ordered-list|기본 블록|ordered-list|번호 매기기 목록 (Numbered)|순서 있는 번호 목록|ol,numbered,ordered,번호,순서,목록|1. ",
  "task-list|기본 블록|task-list|할 일 목록 (Todo)|체크박스 목록|todo,task,check,할일,체크리스트|- [ ] ",
  "quote|기본 블록|quote|인용구 (Quote)|참고 문헌이나 인용문|quote,blockquote,인용|> ",
  "divider|기본 블록|divider|구분선 (Divider)|가로 구분선|hr,divider,line,구분선,선|\n---\n\n",
  "callout-info|콜아웃 · 확장|callout-info|콜아웃 정보 (Info)|참고 및 배경 정보 블록|callout,info,note,콜아웃,정보,안내|> [!INFO]\n> ",
  "callout-tip|콜아웃 · 확장|callout-tip|콜아웃 팁 (Tip)|유용한 팁 및 힌트 블록|callout,tip,hint,콜아웃,팁,힌트|> [!TIP]\n> ",
  "callout-warning|콜아웃 · 확장|callout-warning|콜아웃 주의 (Warning)|주의사항 및 경고 블록|callout,warning,주의,경고|> [!WARNING]\n> ",
  "callout-danger|콜아웃 · 확장|callout-danger|콜아웃 위험 (Danger)|위험 및 중요 경고 블록|callout,danger,alert,위험|> [!DANGER]\n> ",
  "toggle|콜아웃 · 확장|toggle|접기/펼치기 (Toggle)|접고 펼치는 상세 블록|toggle,details,collapse,접기,토글|:::toggle 토글 제목\n\n:::",
  "code-block|미디어 · 수식 · 표|code-block|코드 블록 (Code)|언어 구문 강조 코드 블록|code,fence,코드|```ts\n\n```",
  "table|미디어 · 수식 · 표|table|표 (Table)|기본 표 삽입|table,grid,표,테이블|__TABLE__",
  "math|미디어 · 수식 · 표|math|수식 블록 (Math)|LaTeX 수식 블록 ($$)|math,latex,katex,수식|$$\n\n$$",
  "mermaid|미디어 · 수식 · 표|mermaid|다이어그램 (Mermaid)|Mermaid 순서도 및 구조도|mermaid,diagram,chart,다이어그램|```mermaid\ngraph TD\n  A --> B\n```",
  "image|미디어 · 수식 · 표|image|이미지 업로드 (Image)|이미지 파일 업로드 및 삽입|image,img,photo,picture,이미지,사진,그림|__IMAGE_UPLOAD__",
  "attachment|미디어 · 수식 · 표|attachment|파일 첨부 (File)|첨부 파일 업로드 및 링크 삽입|file,attach,attachment,upload,파일,첨부,업로드|__FILE_UPLOAD__",
  "embed|미디어 · 수식 · 표|embed|임베드 블록 (Embed)|외부 미디어·iframe 임베드 블록|embed,iframe,video,youtube,임베드,삽입|:::embed https://\n\n:::",
  "bookmark|미디어 · 수식 · 표|bookmark|북마크 카드 (Bookmark)|외부 링크 카드 블록|bookmark,link,url,embed,북마크,링크|:::bookmark https://\n\n:::",
]

export const SLASH_COMMAND_SPECS: readonly SlashCommandSpec[] = SLASH_COMMAND_SPEC_ROWS.map(
  (row) => {
    const [id = "", group = "기본 블록", icon = "", label = "", description = "", kw = "", snippet = ""] =
      row.split("|")
    return {
      id,
      label,
      description,
      icon,
      snippet,
      group: group as SlashCommandGroup,
      keywords: kw.split(","),
    }
  }
)

type MarkdownEditorSlashMenuProps = {
  isOpen: boolean
  position: { top: number; left: number } | null
  items: SlashMenuItem[]
  onClose: () => void
}

const SlashMenuContainer = styled.div<{ $top: number; $left: number; $maxHeight?: number | null }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 10};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  display: block;
  min-width: 260px;
  max-width: calc(100vw - 24px);
  color: ${({ theme }) => theme.colors.gray12};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  border-radius: 12px;
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover}, 0 12px 28px ${boxShadowColor.popover};

  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }
`

const TabGroup = styled.div`
  border-bottom: 1px solid color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  padding: 12px 12px 0;

  ul {
    padding: 8px 10px;
    display: flex;
    gap: 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`

const TabButton = styled.button<{ $selected: boolean }>`
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: ${({ theme, $selected }) => ($selected ? theme.colors.gray4 : "transparent")};
  color: ${({ theme }) => theme.colors.gray12};
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    background: ${({ theme, $selected }) => ($selected ? theme.colors.gray4 : theme.colors.gray3)};
  }

  @media (pointer: coarse), (max-width: 768px) {
    min-height: 44px;
  }
`

const MenuGroups = styled.div<{ $maxHeight?: number | null }>`
  padding: 0 12px 12px;
  max-height: ${({ $maxHeight }) => ($maxHeight ? `${$maxHeight}px` : "420px")};
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
`

const MenuGroup = styled.div`
  & + &::before {
    content: "";
    display: block;
    height: 1px;
    background: color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
    margin: 0 10px;
  }

  h6 {
    margin: 0;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    padding: 14px 10px;
    text-transform: uppercase;
    color: color-mix(in srgb, ${({ theme }) => theme.colors.gray12}, transparent 40%);
  }
`

const MenuGroupItemButton = styled.button<{ $active: boolean }>`
  min-width: 220px;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
  padding: 10px 10px;
  border: 0;
  border-radius: 8px;
  background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : "transparent")};
  color: ${({ theme }) => theme.colors.gray12};
  text-align: left;
  cursor: pointer;
  ${focusVisibleRing}

  &:hover {
    background: ${({ theme, $active }) => ($active ? theme.colors.gray4 : theme.colors.gray3)};
  }

  svg {
    width: 24px;
    height: 24px;
    color: ${({ theme }) => theme.colors.gray10};
    flex-shrink: 0;
  }

  > span {
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
  }

  @media (pointer: coarse) {
    min-height: 44px;
  }
`

const SlashMenuEmpty = styled.div`
  padding: 14px 10px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.gray10};
  text-align: center;
`

const SLASH_ICON_BY_ID: Readonly<Record<string, ComponentType<EditorIconProps>>> = {
  "heading-1": EditorIconHeading1,
  "heading-2": EditorIconHeading2,
  "heading-3": EditorIconHeading3,
  "bullet-list": EditorIconBulletList,
  "ordered-list": EditorIconOrderedList,
  "task-list": EditorIconTaskList,
  quote: EditorIconQuote,
  divider: EditorIconDivider,
  "callout-info": EditorIconCalloutInfo,
  "callout-tip": EditorIconCalloutTip,
  "callout-warning": EditorIconCalloutWarning,
  "callout-danger": EditorIconCalloutDanger,
  toggle: EditorIconToggle,
  "code-block": EditorIconCodeBlock,
  table: EditorIconTable,
  math: EditorIconMathSigma,
  mermaid: EditorIconDiagramNodes,
  image: EditorIconImage,
  attachment: EditorIconPaperclip,
  embed: EditorIconEmbedWindow,
  bookmark: EditorIconBookmarkCard,
}

const resolveNextSlashMenuIndex = (key: string, prev: number, count: number): number | null => {
  if (key === "ArrowDown") return count > 0 ? (prev + 1) % count : 0
  if (key === "ArrowUp") return count > 0 ? (prev - 1 + count) % count : 0
  if (key === "Home") return 0
  if (key === "End") return count > 0 ? count - 1 : 0
  return null
}

type SlashGroupFilter = "all" | SlashCommandGroup

const SLASH_GROUP_FILTERS: ReadonlyArray<{ id: SlashGroupFilter; label: string; labelEn: string }> = [
  { id: "all", label: "전체", labelEn: "All" },
  { id: "기본 블록", label: "기본", labelEn: "Basic" },
  { id: "콜아웃 · 확장", label: "확장", labelEn: "Blocks" },
  { id: "미디어 · 수식 · 표", label: "미디어", labelEn: "Media" },
]

const SLASH_GROUP_EN: Readonly<Record<SlashCommandGroup, string>> = {
  "기본 블록": "Basic Blocks",
  "콜아웃 · 확장": "Callouts & Toggles",
  "미디어 · 수식 · 표": "Media, Math & Tables",
}

const SLASH_ITEM_EN_LABELS: Readonly<Record<string, string>> = {
  "heading-1": "Heading 1 (H1)",
  "heading-2": "Heading 2 (H2)",
  "heading-3": "Heading 3 (H3)",
  "bullet-list": "Bullet List",
  "ordered-list": "Numbered List",
  "task-list": "Task List (Todo)",
  quote: "Quote",
  divider: "Divider",
  "callout-info": "Callout Info",
  "callout-tip": "Callout Tip",
  "callout-warning": "Callout Warning",
  "callout-danger": "Callout Danger",
  toggle: "Toggle",
  "code-block": "Code Block",
  table: "Table",
  math: "Math Block",
  mermaid: "Diagram (Mermaid)",
  image: "Upload Image",
  attachment: "Attach File",
  embed: "Embed Block",
  bookmark: "Bookmark Card",
}

export const MarkdownEditorSlashMenu = ({
  isOpen,
  position,
  items,
  onClose,
}: MarkdownEditorSlashMenuProps) => {
  const { language } = useLanguage()
  const isEn = language === "en"
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeGroupFilter, setActiveGroupFilter] = useState<SlashGroupFilter>("all")
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const filteredItems = useMemo(
    () =>
      activeGroupFilter === "all"
        ? items
        : items.filter((item) => item.group === activeGroupFilter),
    [activeGroupFilter, items]
  )

  const groupedSections = useMemo(() => {
    const groups: Array<{ groupLabel: string; entries: Array<{ item: SlashMenuItem; flatIndex: number }> }> = []
    const groupIndexByLabel = new Map<string, number>()
    for (let i = 0; i < filteredItems.length; i += 1) {
      const item = filteredItems[i]!
      const label = item.group ?? "기본 블록"
      let groupIdx = groupIndexByLabel.get(label)
      if (groupIdx === undefined) {
        groupIdx = groups.length
        groupIndexByLabel.set(label, groupIdx)
        groups.push({ groupLabel: label, entries: [] })
      }
      groups[groupIdx]!.entries.push({ item, flatIndex: i })
    }
    return groups
  }, [filteredItems])

  useEffect(() => {
    setActiveGroupFilter("all")
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [isOpen, items, activeGroupFilter])

  useEffect(() => {
    if (!isOpen || !position || typeof window === "undefined") {
      setMaxHeightPx(null)
      return
    }
    const updateMaxHeight = () => {
      const vv = window.visualViewport
      const viewportBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight)
      const isMobile = (vv?.width ?? window.innerWidth) <= 820
      const cap = isMobile ? Math.min(240, Math.round((vv?.height ?? window.innerHeight) * 0.42)) : 420
      const available = Math.floor(viewportBottom - position.top - 72)
      setMaxHeightPx(available > 0 ? Math.max(120, Math.min(cap, available)) : cap)
    }
    updateMaxHeight()
    const vv = window.visualViewport
    vv?.addEventListener("resize", updateMaxHeight)
    vv?.addEventListener("scroll", updateMaxHeight)
    window.addEventListener("resize", updateMaxHeight)
    return () => {
      vv?.removeEventListener("resize", updateMaxHeight)
      vv?.removeEventListener("scroll", updateMaxHeight)
      window.removeEventListener("resize", updateMaxHeight)
    }
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return
    itemRefs.current[selectedIndex]?.scrollIntoView?.({ block: "nearest" })
  }, [isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || Reflect.get(event, "keyCode") === 229) return

      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      const nextIndex = resolveNextSlashMenuIndex(event.key, selectedIndex, filteredItems.length)
      if (nextIndex !== null) {
        event.preventDefault()
        event.stopPropagation()
        setSelectedIndex(nextIndex)
        return
      }

      if ((event.key === "Enter" || event.key === "Tab") && filteredItems.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        filteredItems[selectedIndex]?.action()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    window.addEventListener("pointerdown", handlePointerDownOutside)
    return () => window.removeEventListener("pointerdown", handlePointerDownOutside)
  }, [isOpen, onClose])

  if (!isOpen || !position) return null

  return (
    <SlashMenuContainer
      ref={menuRef}
      data-testid="markdown-editor-slash-menu"
      $top={position.top}
      $left={position.left}
      role="menu"
      aria-label={editorT("slashMenuAria", language)}
      aria-activedescendant={
        filteredItems[selectedIndex] ? `aq-slash-item-${filteredItems[selectedIndex].id}` : undefined
      }
    >
      <TabGroup role="group" aria-label={editorT("slashGroupAria", language)}>
        <ul>
          {SLASH_GROUP_FILTERS.map((filter) => (
            <li key={filter.id} className={activeGroupFilter === filter.id ? "selected" : undefined}>
              <TabButton
                type="button"
                $selected={activeGroupFilter === filter.id}
                aria-pressed={activeGroupFilter === filter.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setActiveGroupFilter(filter.id)}
              >
                {isEn ? filter.labelEn : filter.label}
              </TabButton>
            </li>
          ))}
        </ul>
      </TabGroup>
      <MenuGroups $maxHeight={maxHeightPx}>
        {groupedSections.length === 0 ? (
          <SlashMenuEmpty>{isEn ? "No matching commands" : "일치하는 명령어가 없습니다"}</SlashMenuEmpty>
        ) : (
          groupedSections.map((group) => (
            <MenuGroup key={group.groupLabel}>
              <h6>{isEn ? (SLASH_GROUP_EN[group.groupLabel as SlashCommandGroup] ?? group.groupLabel) : group.groupLabel}</h6>
              <ul>
                {group.entries.map(({ item, flatIndex }) => {
                  const IconComponent = SLASH_ICON_BY_ID[item.id] ?? EditorIconParagraph
                  return (
                    <li key={item.id}>
                      <MenuGroupItemButton
                        ref={(node) => {
                          itemRefs.current[flatIndex] = node
                        }}
                        id={`aq-slash-item-${item.id}`}
                        type="button"
                        role="menuitem"
                        aria-current={flatIndex === selectedIndex ? "true" : undefined}
                        $active={flatIndex === selectedIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                      >
                        <IconComponent size={24} />
                        <span>{isEn ? (SLASH_ITEM_EN_LABELS[item.id] ?? item.label) : item.label}</span>
                      </MenuGroupItemButton>
                    </li>
                  )
                })}
              </ul>
            </MenuGroup>
          ))
        )}
      </MenuGroups>
    </SlashMenuContainer>
  )
}
