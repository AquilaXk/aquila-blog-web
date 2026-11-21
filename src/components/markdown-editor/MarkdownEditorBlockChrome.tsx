/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/feature/block-edit/ (MIT License, Copyright (c) 2021 Mirone)
 * - steven-tey/novel packages/headless/src/components/editor-bubble.tsx (Apache-2.0 License, Copyright (c) Steven Tey)
 */
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { zIndexes } from "src/styles/zIndexes"
import type { MarkdownFormatShortcut } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { MarkdownEditorBubbleLinkPopover, parseMarkdownLinkSelection } from "./MarkdownEditorBubbleLinkPopover"
import {
  EditorIconArrowDown,
  EditorIconArrowUp,
  EditorIconBold,
  EditorIconBulletList,
  EditorIconCheck,
  EditorIconDuplicate,
  EditorIconGripSixDots,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconHighlight,
  EditorIconInlineCode,
  EditorIconItalic,
  EditorIconLink,
  EditorIconOrderedList,
  EditorIconParagraph,
  EditorIconPlus,
  EditorIconQuote,
  EditorIconStrikethrough,
  EditorIconTaskList,
  EditorIconTrash,
} from "./MarkdownEditorIcons"
import {
  EDITOR_COLOR_SWATCH_SPECS,
  computeActiveLineState,
  measureBlockChromeLayout,
  moveBlockMenuFocus,
} from "./markdownEditorBlockChromeModel"
import {
  isWrapSelectionActive,
  planReplaceSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

type MarkdownEditorBlockChromeProps = {
  containerRef: RefObject<HTMLElement | null>
  mode: "live" | "source" | "reading"
  disabled: boolean
  value: string
  selection: { from: number; to: number }
  isSlashMenuOpen: boolean
  isFindReplaceOpen: boolean
  resolveCoords: (pos: number) => { top: number; bottom: number; left: number; right: number } | null
  requestMeasure?: <T>(spec: { key?: string; read: () => T; write: (measured: T) => void }) => boolean
  onApplySnippet: (before: string, after?: string, options?: { toggle?: boolean }) => void
  onApplyFormatShortcut: (shortcut: MarkdownFormatShortcut) => void
  onApplyListCommand: (command: MarkdownEditorListCommand) => void
  onStripBlockPrefix: () => void
  onApplyLineCommand: (command: MarkdownEditorLineCommand) => void
  onTriggerSlashCommand: (plan: PlannedTextMutation) => void
}

const SelectionBubbleToolbar = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 5};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  max-width: calc(100vw - 24px);
  overflow: hidden;
  display: flex;
  align-items: center;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 8px ${boxShadowColor.popover};
  user-select: none;

  @media (max-width: 820px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`

const BubbleDivider = styled.span`
  width: 1px;
  height: 24px;
  margin: 10px;
  background: color-mix(in srgb, ${({ theme }) => theme.colors.gray8}, transparent 80%);
  flex-shrink: 0;
`

const BubbleActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 6px;
  padding: 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray10};
  font: 700 12px/1 var(--aq-font-sans);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.12s ease, color 0.12s ease;
  ${focusVisibleRing}
  &:hover {
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }
  &:active, &[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }
  @media (pointer: coarse), (max-width: 768px) { min-width: 44px; min-height: 44px; margin: 2px; }
`

const GutterHandleButtonBase = styled.button<{ $top: number; $left: number }>`
  position: absolute;
  left: ${({ $left }) => $left}px;
  top: ${({ $top }) => $top}px;
  z-index: 4;
  width: 32px;
  height: 32px;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray9};
  cursor: pointer;
  opacity: 0.72;
  user-select: none;
  transition: all 0.2s ease;
  ${focusVisibleRing}
  &:hover, &:focus-visible {
    opacity: 1;
    border: 0;
    background: ${({ theme }) => theme.colors.gray3};
    color: ${({ theme }) => theme.colors.gray12};
  }
  &[aria-expanded="true"] {
    opacity: 1;
    border: 0;
    background: ${({ theme }) => theme.colors.gray4};
    color: ${({ theme }) => theme.colors.gray12};
  }
  @media (pointer: coarse) { display: none; }
  @media (max-width: 720px) { display: none; }
`

const GutterPlusButton = styled(GutterHandleButtonBase)`
  font: 600 15px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
`

const GutterDragMenuButton = styled(GutterHandleButtonBase)`
  font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: -1px;
`

const BlockActionMenuPopover = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  z-index: ${zIndexes.dropdownMenu + 8};
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 220px;
  max-height: 480px;
  overflow-y: auto;
  padding: 5px;
  border-radius: 9px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover}, 0 10px 28px ${boxShadowColor.popover};
  display: flex;
  flex-direction: column;
  gap: 1px;
  user-select: none;
`

const BlockMenuSectionHeader = styled.div`
  padding: 4px 8px 2px; font: 650 11px/1.2 var(--aq-font-sans); color: ${({ theme }) => theme.colors.gray9};
`
const BlockMenuSectionDivider = styled.div`
  height: 1px; margin: 3px 2px; background: ${({ theme }) => theme.publicDesign.border};
`
const BlockMenuItemButton = styled.button`
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 5px 8px;
  border: 0; border-radius: 6px; background: transparent;
  color: ${({ theme }) => theme.colors.gray12}; font: 550 12.5px/1.2 var(--aq-font-sans);
  text-align: left; cursor: pointer; transition: background-color 0.1s ease;
  ${focusVisibleRing}
  @media (pointer: coarse), (max-width: 768px) { min-height: 44px; }
  &:hover, &:focus {
    background: ${({ theme }) => theme.colors.gray3};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: -2px;
    background: ${({ theme }) => theme.colors.gray3};
  }
  &[data-active="true"] { font-weight: 650; }
  .glyph {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
    border-radius: 5px; border: 0;
    background: ${({ theme }) => theme.colors.gray3};
    font: 700 10.5px/1 ui-monospace, SFMono-Regular, monospace; color: ${({ theme }) => theme.colors.gray12}; flex-shrink: 0;
  }
  .check {
    display: inline-flex;
    align-items: center;
    margin-left: auto;
    color: ${({ theme }) => theme.colors.gray11};
  }
`
const ColorSwatchRow = styled.div`
  display: flex; align-items: center; gap: 5px; padding: 2px 8px 3px;
`
const ColorSwatchMenuButton = styled.button<{ $color: string }>`
  flex: 1 1 0; height: 24px; border-radius: 6px; border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated}; color: ${({ $color }) => $color};
  font: 750 11.5px/1 var(--aq-font-sans); display: inline-flex; align-items: center; justify-content: center;
  gap: 4px; cursor: pointer;
  ${focusVisibleRing}
  @media (pointer: coarse), (max-width: 768px) { min-width: 44px; min-height: 44px; }
  &:hover, &:focus {
    border-color: ${({ $color }) => $color};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.gray12};
    outline-offset: -2px;
    border-color: ${({ $color }) => $color};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
  }
`
const ColorSwatchDot = styled.span<{ $color: string }>`
  display: inline-block; width: 12px; height: 12px; border-radius: 999px;
  background: ${({ $color }) => $color}; border: 1px solid ${boxShadowColor.swatchBorder}; flex-shrink: 0;
`

export const MarkdownEditorBlockChrome = ({
  containerRef, mode, disabled, value, selection, isSlashMenuOpen, isFindReplaceOpen,
  resolveCoords, requestMeasure, onApplySnippet, onApplyFormatShortcut, onApplyListCommand,
  onStripBlockPrefix, onApplyLineCommand, onTriggerSlashCommand,
}: MarkdownEditorBlockChromeProps) => {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false)
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const [bubblePosition, setBubblePosition] = useState<{ top: number; left: number } | null>(null)
  const [gutterTop, setGutterTop] = useState<number | null>(null)
  const [gutterLeft, setGutterLeft] = useState(10)
  const [blockMenuPosition, setBlockMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const blockMenuRef = useRef<HTMLDivElement | null>(null)
  const gutterHandleRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setIsDismissed(false)
    setIsBlockMenuOpen(false)
    setIsLinkPopoverOpen(false)
  }, [selection.from, selection.to, mode, disabled, isSlashMenuOpen])

  useEffect(() => {
    if (mode !== "live" || disabled) return
    const container = containerRef.current
    let rafId: number | null = null
    const bumpLayout = () => {
      if (rafId !== null) return
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        rafId = window.requestAnimationFrame(() => {
          rafId = null
          setLayoutTick((prev) => prev + 1)
        })
      } else {
        setLayoutTick((prev) => prev + 1)
      }
    }
    container?.addEventListener("scroll", bumpLayout, true)
    window.addEventListener("resize", bumpLayout)
    window.addEventListener("scroll", bumpLayout, true)
    return () => {
      if (rafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId)
      }
      container?.removeEventListener("scroll", bumpLayout, true)
      window.removeEventListener("resize", bumpLayout)
      window.removeEventListener("scroll", bumpLayout, true)
    }
  }, [containerRef, disabled, mode])

  const { activeLineStart, activeLineEnd, activeLineText, currentBlockKind, insideFence } = useMemo(
    () => computeActiveLineState(value, selection.from),
    [value, selection.from]
  )

  const selectedText = useMemo(
    () => (selection.from < selection.to && selection.to - selection.from <= 600 ? value.slice(selection.from, selection.to) : ""),
    [selection.from, selection.to, value]
  )
  const canShowBubble =
    mode === "live" && !disabled && !isSlashMenuOpen && !isFindReplaceOpen && !isDismissed &&
    selection.from < selection.to && selection.to - selection.from <= 600 &&
    selectedText.trim().length > 0 && !insideFence && !/^\s*(`{3,}|~{3,})/.test(selectedText)

  useEffect(() => {
    if (!canShowBubble && !isBlockMenuOpen) return
    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (isBlockMenuOpen && !blockMenuRef.current?.contains(target) && !gutterHandleRef.current?.contains(target)) {
        setIsBlockMenuOpen(false)
      }
      if (canShowBubble && !bubbleRef.current?.contains(target)) {
        const element = target instanceof Element ? target : target.parentElement
        if (!element?.closest('[data-testid="markdown-editor-content"], [data-testid="markdown-bubble-link-popover"]')) {
          setIsDismissed(true)
          setIsLinkPopoverOpen(false)
        }
      }
    }
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isLinkPopoverOpen) {
          setIsLinkPopoverOpen(false)
          return
        }
        setIsDismissed(true)
        setIsBlockMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDownCapture, true)
    window.addEventListener("keydown", handleKeyDownCapture, true)
    return () => {
      document.removeEventListener("mousedown", handleMouseDownCapture, true)
      window.removeEventListener("keydown", handleKeyDownCapture, true)
    }
  }, [canShowBubble, isBlockMenuOpen, isLinkPopoverOpen])

  const canShowGutterPlus =
    mode === "live" && !disabled && !isSlashMenuOpen && selection.from === selection.to && !insideFence

  useIsomorphicLayoutEffect(() => {
    let cancelled = false
    const readLayout = () =>
      measureBlockChromeLayout({
        canShowBubble,
        canShowGutterPlus,
        isBlockMenuOpen,
        selection,
        activeLineStart,
        resolveCoords,
        container: containerRef.current,
      })
    const writeLayout = (measured: ReturnType<typeof readLayout>) => {
      if (cancelled) return
      setBubblePosition((prev) =>
        prev?.top === measured.bubble?.top && prev?.left === measured.bubble?.left
          ? prev
          : measured.bubble
      )
      setGutterTop((prev) => (prev === measured.gutterTop ? prev : measured.gutterTop))
      setGutterLeft((prev) => (prev === measured.gutterLeft ? prev : measured.gutterLeft))
      setBlockMenuPosition((prev) =>
        prev?.top === measured.blockMenu?.top && prev?.left === measured.blockMenu?.left
          ? prev
          : measured.blockMenu
      )
    }
    const scheduled = requestMeasure?.({
      key: "block-chrome-layout",
      read: readLayout,
      write: writeLayout,
    })
    if (!scheduled) {
      writeLayout(readLayout())
    }
    return () => {
      cancelled = true
    }
  }, [
    activeLineStart,
    canShowBubble,
    canShowGutterPlus,
    containerRef,
    isBlockMenuOpen,
    layoutTick,
    requestMeasure,
    resolveCoords,
    selection,
  ])

  useEffect(() => {
    if (!isBlockMenuOpen || !blockMenuPosition) return
    blockMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [blockMenuPosition, isBlockMenuOpen])

  const handleBlockMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setIsBlockMenuOpen(false)
      return
    }
    const items = Array.from(blockMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const handled = moveBlockMenuFocus(event.key, items, currentIndex, () => {
      setIsBlockMenuOpen(false)
      gutterHandleRef.current?.focus()
    })
    if (handled) event.preventDefault()
  }

  const handleTriggerSlashAtCurrentLine = () => {
    setIsBlockMenuOpen(false)
    const plan =
      activeLineText.trim().length === 0
        ? planReplaceSelection(selection.from, selection.to, "/")
        : planReplaceSelection(activeLineEnd, activeLineEnd, "\n/")
    onTriggerSlashCommand(plan)
  }

  const runMenuAction = (action: () => void) => {
    setIsBlockMenuOpen(false)
    action()
  }

  const applyLineColorSwatch = (token: string) => {
    if (selection.from < selection.to) {
      const existingMatch = /^\{\{color:([^|{}]+)\|([\s\S]*)\}\}$/.exec(selectedText)
      if (existingMatch) {
        const inner = existingMatch[2] ?? ""
        const replacement = token === "default" || existingMatch[1]?.trim() === token ? inner : `{{color:${token}|${inner}}}`
        onTriggerSlashCommand(planReplaceSelection(selection.from, selection.to, replacement))
        return
      }
      if (token !== "default") onApplySnippet(`{{color:${token}|`, "}}", { toggle: true })
      return
    }
    const lineStart = selection.from > 0 ? value.lastIndexOf("\n", selection.from - 1) + 1 : 0
    const nextBreak = value.indexOf("\n", selection.from)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lineText = value.slice(lineStart, lineEnd)
    const prefixMatch =
      /^(?:[ \t]*(?:#{1,6}[ \t]+|>+[ \t]*|(?:[-+*]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?))/.exec(lineText)
    const bodyOffset = prefixMatch ? prefixMatch[0].length : 0
    const rawBody = lineText.slice(bodyOffset)
    const existingColorMatch = /^\{\{color:([^|{}]+)\|([\s\S]*)\}\}$/.exec(rawBody)
    const innerText = (existingColorMatch ? existingColorMatch[2] ?? "" : rawBody) || "강조 텍스트"
    const replacement = token === "default" || existingColorMatch?.[1]?.trim() === token ? innerText : `{{color:${token}|${innerText}}}`
    onTriggerSlashCommand(planReplaceSelection(lineStart + bodyOffset, lineEnd, replacement))
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

  const bubbleButtons = [
    { label: "선택 영역 일반 문단", icon: <EditorIconParagraph size={14} />, run: () => onStripBlockPrefix() },
    { label: "선택 영역 제목 1", icon: <EditorIconHeading1 size={14} />, run: () => onApplySnippet("# ", "") },
    { label: "선택 영역 제목 2", icon: <EditorIconHeading2 size={14} />, run: () => onApplySnippet("## ", "") },
    { label: "선택 영역 제목 3", icon: <EditorIconHeading3 size={14} />, run: () => onApplySnippet("### ", "") },
    { label: "선택 영역 인용구", icon: <EditorIconQuote size={14} />, run: () => onApplySnippet("> ", "") },
    { label: "선택 영역 할 일", icon: <EditorIconTaskList size={14} />, run: () => onApplyListCommand("task") },
  ]

  const inlineButtons = [
    { label: "선택 영역 굵게", icon: <EditorIconBold size={14} />, active: isWrapSelectionActive(value, selection.from, selection.to, "**", "**"), run: () => onApplyFormatShortcut("bold") },
    { label: "선택 영역 기울임", icon: <EditorIconItalic size={14} />, active: isWrapSelectionActive(value, selection.from, selection.to, "_", "_"), run: () => onApplyFormatShortcut("italic") },
    { label: "선택 영역 취소선", icon: <EditorIconStrikethrough size={14} />, active: /^~~[\s\S]+~~$/.test(selectedText), run: () => onApplyFormatShortcut("strikethrough") },
    { label: "선택 영역 인라인 코드", icon: <EditorIconInlineCode size={14} />, active: /^`[^`]+`$/.test(selectedText), run: () => onApplyFormatShortcut("inlineCode") },
    { label: "선택 영역 하이라이트", icon: <EditorIconHighlight size={14} />, active: /^==[\s\S]+==$/.test(selectedText), run: () => onApplySnippet("==", "==", { toggle: true }) },
    {
      label: "선택 영역 링크",
      icon: <EditorIconLink size={14} />,
      active: Boolean(parseMarkdownLinkSelection(selectedText)) || isLinkPopoverOpen,
      expanded: isLinkPopoverOpen,
      run: () => setIsLinkPopoverOpen((prev) => !prev),
    },
  ]

  return (
    <>
      {canShowGutterPlus && gutterTop !== null ? (
        <>
          <GutterPlusButton type="button" aria-label="현재 줄에 블록 삽입" data-testid="markdown-block-gutter-plus" $top={gutterTop} $left={gutterLeft} onMouseDown={(event) => event.preventDefault()} onClick={handleTriggerSlashAtCurrentLine}><EditorIconPlus size={18} /></GutterPlusButton>
          <GutterDragMenuButton ref={gutterHandleRef} type="button" aria-label="현재 줄 블록 메뉴" aria-haspopup="menu" aria-expanded={isBlockMenuOpen} data-block-kind={currentBlockKind} data-testid="markdown-block-gutter-handle" $top={gutterTop} $left={gutterLeft + 34} onMouseDown={(event) => event.preventDefault()} onClick={() => setIsBlockMenuOpen((prev) => !prev)}><EditorIconGripSixDots size={18} /></GutterDragMenuButton>
        </>
      ) : null}
      {isBlockMenuOpen && blockMenuPosition ? (
        <BlockActionMenuPopover ref={blockMenuRef} role="menu" aria-label="블록 작업 메뉴" data-testid="markdown-block-action-menu" $top={blockMenuPosition.top} $left={blockMenuPosition.left} onKeyDown={handleBlockMenuKeyDown} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsBlockMenuOpen(false) }}>
          <BlockMenuSectionHeader aria-hidden="true">블록 전환</BlockMenuSectionHeader>
          {turnIntoItems.map((item) => (
            <BlockMenuItemButton key={item.label} type="button" role="menuitem" data-active={currentBlockKind === item.kind ? "true" : undefined} onMouseDown={(event) => event.preventDefault()} onClick={() => runMenuAction(item.run)}>
              <span className="glyph" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {currentBlockKind === item.kind ? <span className="check" aria-hidden="true"><EditorIconCheck size={13} /></span> : null}
            </BlockMenuItemButton>
          ))}
          <BlockMenuSectionDivider aria-hidden="true" />
          <BlockMenuSectionHeader aria-hidden="true">글자 색상</BlockMenuSectionHeader>
          <ColorSwatchRow>
            {EDITOR_COLOR_SWATCH_SPECS.map((swatch) => (
              <ColorSwatchMenuButton key={swatch.label} type="button" role="menuitem" aria-label={swatch.label} title={swatch.label} $color={swatch.hex} onMouseDown={(event) => event.preventDefault()} onClick={() => runMenuAction(() => applyLineColorSwatch(swatch.token))}>
                <ColorSwatchDot $color={swatch.hex} />
                <span aria-hidden="true">A</span>
              </ColorSwatchMenuButton>
            ))}
          </ColorSwatchRow>
          <BlockMenuSectionDivider aria-hidden="true" />
          <BlockMenuSectionHeader aria-hidden="true">블록 작업</BlockMenuSectionHeader>
          {lineActionItems.map((item) => (
            <BlockMenuItemButton key={item.label} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => runMenuAction(item.run)}>
              <span className="glyph" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </BlockMenuItemButton>
          ))}
        </BlockActionMenuPopover>
      ) : null}
      {canShowBubble && bubblePosition ? (
        <SelectionBubbleToolbar ref={bubbleRef} role="toolbar" aria-label="선택 텍스트 빠른 서식" data-testid="markdown-selection-bubble" $top={bubblePosition.top} $left={bubblePosition.left}>
          {bubbleButtons.map((item) => (
            <BubbleActionButton key={item.label} type="button" aria-label={item.label} onMouseDown={(event) => event.preventDefault()} onClick={item.run}>{item.icon}</BubbleActionButton>
          ))}
          <BubbleDivider aria-hidden="true" />
          {inlineButtons.map((item) => (
            <BubbleActionButton
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-pressed={item.active}
              aria-expanded={"expanded" in item ? item.expanded : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.run}
            >
              {item.icon}
            </BubbleActionButton>
          ))}
          <BubbleDivider aria-hidden="true" />
          {EDITOR_COLOR_SWATCH_SPECS.map((swatch) => (
            <BubbleActionButton key={swatch.label} type="button" aria-label={`선택 영역 ${swatch.label}`} title={swatch.label} onMouseDown={(event) => event.preventDefault()} onClick={() => applyLineColorSwatch(swatch.token)}>
              <ColorSwatchDot $color={swatch.hex} />
            </BubbleActionButton>
          ))}
        </SelectionBubbleToolbar>
      ) : null}
      {canShowBubble && bubblePosition && isLinkPopoverOpen ? (
        <MarkdownEditorBubbleLinkPopover
          isOpen={isLinkPopoverOpen}
          top={bubblePosition.top}
          left={bubblePosition.left}
          value={value}
          selection={selection}
          onApplyPlan={onTriggerSlashCommand}
          onClose={() => setIsLinkPopoverOpen(false)}
        />
      ) : null}
    </>
  )
}
