import { Fragment, useEffect, useRef, useState } from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"

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
  "heading-1|기본 블록|H1|제목 1 (H1)|가장 큰 섹션 제목|h1,heading1,title,제목1,대제목|# ",
  "heading-2|기본 블록|H2|제목 2 (H2)|중간 섹션 제목|h2,heading2,subtitle,제목2,중제목|## ",
  "heading-3|기본 블록|H3|제목 3 (H3)|작은 소제목|h3,heading3,제목3,소제목|### ",
  "bullet-list|기본 블록|•|글머리 기호 목록 (Bullet)|순서 없는 글머리 목록|ul,bullet,list,글머리,목록|- ",
  "ordered-list|기본 블록|1.|번호 매기기 목록 (Numbered)|순서 있는 번호 목록|ol,numbered,ordered,번호,순서,목록|1. ",
  "task-list|기본 블록|☑|할 일 목록 (Todo)|체크박스 목록|todo,task,check,할일,체크리스트|- [ ] ",
  "quote|기본 블록|”|인용구 (Quote)|참고 문헌이나 인용문|quote,blockquote,인용|> ",
  "divider|기본 블록|—|구분선 (Divider)|가로 구분선|hr,divider,line,구분선,선|\n---\n\n",
  "callout-info|콜아웃 · 확장|ℹ️|콜아웃 정보 (Info)|참고 및 배경 정보 블록|callout,info,note,콜아웃,정보,안내|> [!INFO]\n> ",
  "callout-tip|콜아웃 · 확장|💡|콜아웃 팁 (Tip)|유용한 팁 및 힌트 블록|callout,tip,hint,콜아웃,팁,힌트|> [!TIP]\n> ",
  "callout-warning|콜아웃 · 확장|⚠️|콜아웃 주의 (Warning)|주의사항 및 경고 블록|callout,warning,주의,경고|> [!WARNING]\n> ",
  "callout-danger|콜아웃 · 확장|🚨|콜아웃 위험 (Danger)|위험 및 중요 경고 블록|callout,danger,alert,위험|> [!DANGER]\n> ",
  "toggle|콜아웃 · 확장|▸|접기/펼치기 (Toggle)|접고 펼치는 상세 블록|toggle,details,collapse,접기,토글|:::toggle 토글 제목\n\n:::",
  "code-block|미디어 · 수식 · 표|</>|코드 블록 (Code)|언어 구문 강조 코드 블록|code,fence,코드|```ts\n\n```",
  "table|미디어 · 수식 · 표|▦|표 (Table)|기본 표 삽입|table,grid,표,테이블|__TABLE__",
  "math|미디어 · 수식 · 표|∑|수식 블록 (Math)|LaTeX 수식 블록 ($$)|math,latex,katex,수식|$$\n\n$$",
  "mermaid|미디어 · 수식 · 표|◇|다이어그램 (Mermaid)|Mermaid 순서도 및 구조도|mermaid,diagram,chart,다이어그램|```mermaid\ngraph TD\n  A --> B\n```",
  "image|미디어 · 수식 · 표|🖼️|이미지 업로드 (Image)|이미지 파일 업로드 및 삽입|image,img,photo,picture,이미지,사진,그림|__IMAGE_UPLOAD__",
  "attachment|미디어 · 수식 · 표|📎|파일 첨부 (File)|첨부 파일 업로드 및 링크 삽입|file,attach,attachment,upload,파일,첨부,업로드|__FILE_UPLOAD__",
  "bookmark|미디어 · 수식 · 표|🔖|북마크 카드 (Bookmark)|외부 링크 카드 블록|bookmark,link,url,embed,북마크,링크|:::bookmark https://\n\n:::",
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

const SlashMenuContainer = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 10};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 280px;
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const SlashMenuHeading = styled.div`
  padding: 4px 8px 6px;
  font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.gray9};
  border-bottom: 1px solid ${({ theme }) => theme.publicDesign.border};
  margin-bottom: 2px;
`

const SlashGroupHeader = styled.div`
  padding: 6px 8px 3px;
  font: 650 11px/1.2 var(--aq-font-sans);
  color: ${({ theme }) => theme.colors.gray9};
  user-select: none;
`

const SlashMenuFooter = styled.div`
  margin-top: 4px;
  padding: 6px 8px 2px;
  border-top: 1px solid ${({ theme }) => theme.publicDesign.border};
  font: 500 11px/1.2 var(--aq-font-sans);
  color: ${({ theme }) => theme.colors.gray9};
  user-select: none;
`

const SlashMenuEmpty = styled.div`
  padding: 14px 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.gray10};
  text-align: center;
`

const SlashMenuItemButton = styled.button<{ $active: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: ${({ theme, $active }) => ($active ? theme.publicDesign.surfaceElevated : "transparent")};
  color: ${({ theme }) => theme.colors.gray12};
  cursor: pointer;
  text-align: left;
  transition: background-color 0.1s ease;

  ${focusVisibleRing}

  &:hover {
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
    color: ${({ theme }) => theme.colors.gray11};
    flex-shrink: 0;
  }

  .icon[data-tone="heading"],
  .icon[data-tone="callout-info"],
  .icon[data-tone="table"] {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(35, 131, 226, 0.2)" : "#e9f3f7")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#7dd3fc" : "#14569b")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(35, 131, 226, 0.34)" : "rgba(20, 86, 155, 0.16)")};
  }

  .icon[data-tone="list"],
  .icon[data-tone="code"],
  .icon[data-tone="math"] {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(144, 101, 176, 0.2)" : "#f6f3f9")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#d8b4fe" : "#5b3678")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(144, 101, 176, 0.34)" : "rgba(91, 54, 120, 0.16)")};
  }

  .icon[data-tone="callout-tip"] {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(16, 185, 129, 0.2)" : "#edf3ec")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#6ee7b7" : "#255c3e")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(16, 185, 129, 0.32)" : "rgba(37, 92, 62, 0.16)")};
  }

  .icon[data-tone="callout-warning"],
  .icon[data-tone="media"] {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(245, 158, 11, 0.2)" : "#fbf3db")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#fcd34d" : "#78490a")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(245, 158, 11, 0.32)" : "rgba(120, 73, 10, 0.16)")};
  }

  .icon[data-tone="callout-danger"] {
    background: ${({ theme }) => (theme.scheme === "dark" ? "rgba(239, 68, 68, 0.2)" : "#fdebec")};
    color: ${({ theme }) => (theme.scheme === "dark" ? "#fca5a5" : "#9c2520")};
    border-color: ${({ theme }) => (theme.scheme === "dark" ? "rgba(239, 68, 68, 0.32)" : "rgba(156, 37, 32, 0.16)")};
  }

  .icon.icon-emoji {
    font-size: 16px;
    line-height: 1;
  }

  .icon.icon-text {
    font: 700 13px/1 ui-monospace, SFMono-Regular, monospace;
  }

  .text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;

    .label {
      font-size: 14px;
      font-weight: 650;
      line-height: 1.25;
      color: ${({ theme }) => theme.colors.gray12};
    }

    .description {
      font-size: 12px;
      color: ${({ theme }) => theme.colors.gray10};
      line-height: 1.35;
      margin-top: 2px;
    }
  }

  .shortcut {
    margin-left: auto;
    padding: 2px 5px;
    border-radius: 4px;
    font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: ${({ theme }) => theme.colors.gray9};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    flex-shrink: 0;
  }
`

const SLASH_SHORTCUT_BY_ID: Readonly<Record<string, string>> = {
  "heading-1": "#",
  "heading-2": "##",
  "heading-3": "###",
  "bullet-list": "-",
  "ordered-list": "1.",
  "task-list": "[]",
  quote: ">",
  divider: "---",
  toggle: ":::",
  "code-block": "```",
  math: "$$",
}

const isEmojiIcon = (icon: string) =>
  /\p{Extended_Pictographic}/u.test(icon) || icon === "☑" || icon === "▦"

const resolveSlashItemTone = (item: SlashMenuItem): string => {
  if (item.id.startsWith("heading-")) return "heading"
  if (item.id === "bullet-list" || item.id === "ordered-list" || item.id === "task-list") return "list"
  if (item.id === "callout-info" || item.id === "callout-tip" || item.id === "callout-warning" || item.id === "callout-danger") return item.id
  if (item.id === "code-block") return "code"
  if (item.id === "table") return "table"
  if (item.id === "math" || item.id === "mermaid") return "math"
  if (item.id === "image" || item.id === "attachment" || item.id === "bookmark") return "media"
  return "default"
}

const resolveNextSlashMenuIndex = (key: string, prev: number, count: number): number | null => {
  if (key === "ArrowDown") return count > 0 ? (prev + 1) % count : 0
  if (key === "ArrowUp") return count > 0 ? (prev - 1 + count) % count : 0
  if (key === "Home") return 0
  if (key === "End") return count > 0 ? count - 1 : 0
  return null
}

export const MarkdownEditorSlashMenu = ({
  isOpen,
  position,
  items,
  onClose,
}: MarkdownEditorSlashMenuProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    setSelectedIndex(0)
  }, [isOpen, items])

  useEffect(() => {
    if (!isOpen) return
    itemRefs.current[selectedIndex]?.scrollIntoView?.({ block: "nearest" })
  }, [isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      const nextIndex = resolveNextSlashMenuIndex(event.key, selectedIndex, items.length)
      if (nextIndex !== null) {
        event.preventDefault()
        event.stopPropagation()
        setSelectedIndex(nextIndex)
        return
      }

      if ((event.key === "Enter" || event.key === "Tab") && items.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        items[selectedIndex]?.action()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isOpen, items, selectedIndex, onClose])

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
      $top={position.top}
      $left={position.left}
      role="menu"
      aria-label="빠른 삽입 메뉴"
      aria-activedescendant={items[selectedIndex] ? `aq-slash-item-${items[selectedIndex].id}` : undefined}
    >
      <SlashMenuHeading>블록 빠른 삽입</SlashMenuHeading>
      {items.length === 0 ? (
        <SlashMenuEmpty>일치하는 명령어가 없습니다</SlashMenuEmpty>
      ) : (
        items.map((item, index) => {
          const showGroupHeader =
            Boolean(item.group) && item.group !== items[index - 1]?.group
          return (
            <Fragment key={item.id}>
              {showGroupHeader ? (
                <SlashGroupHeader aria-hidden="true">{item.group}</SlashGroupHeader>
              ) : null}
              <SlashMenuItemButton
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                id={`aq-slash-item-${item.id}`}
                type="button"
                role="menuitem"
                aria-current={index === selectedIndex ? "true" : undefined}
                $active={index === selectedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => item.action()}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span
                  className={`icon ${isEmojiIcon(item.icon) ? "icon-emoji" : "icon-text"}`}
                  data-tone={resolveSlashItemTone(item)}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <div className="text-group">
                  <span className="label">{item.label}</span>
                  <span className="description">{item.description}</span>
                </div>
                {SLASH_SHORTCUT_BY_ID[item.id] ? (
                  <span className="shortcut" aria-hidden="true">
                    {SLASH_SHORTCUT_BY_ID[item.id]}
                  </span>
                ) : null}
              </SlashMenuItemButton>
            </Fragment>
          )
        })
      )}
      <SlashMenuFooter aria-hidden="true">
        ↑↓ 이동 · Enter/Tab 선택 · Esc 닫기
      </SlashMenuFooter>
    </SlashMenuContainer>
  )
}
