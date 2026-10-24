import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"
import {
  isOffsetInsideFencedCodeBlock,
  type MarkdownFormatShortcut,
} from "./markdownEditorKeyboardModel"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import {
  planReplaceSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"

type MarkdownEditorNotionChromeProps = {
  containerRef: RefObject<HTMLElement | null>
  mode: "live" | "source" | "reading"
  disabled: boolean
  value: string
  selection: { from: number; to: number }
  isSlashMenuOpen: boolean
  isFindReplaceOpen: boolean
  resolveCoords: (
    pos: number
  ) => { top: number; bottom: number; left: number; right: number } | null
  onApplySnippet: (
    before: string,
    after?: string,
    options?: { toggle?: boolean }
  ) => void
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 5px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08);
  user-select: none;
`

const BubbleDivider = styled.span`
  width: 1px;
  height: 16px;
  margin: 0 3px;
  background: ${({ theme }) => theme.publicDesign.border};
  flex-shrink: 0;
`

const BubbleActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray11};
  font: 700 12px/1 var(--aq-font-sans);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;

  ${focusVisibleRing}

  &:hover {
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }
`

const GutterHandleButtonBase = styled.button<{ $top: number; $left: number }>`
  position: absolute;
  left: ${({ $left }) => $left}px;
  top: ${({ $top }) => $top}px;
  z-index: 4;
  width: 18px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray9};
  cursor: pointer;
  opacity: 0.62;
  user-select: none;
  transition: opacity 0.14s ease, background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;

  ${focusVisibleRing}

  &:hover,
  &:focus-visible,
  &[aria-expanded="true"] {
    opacity: 1;
    border-color: ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }

  @media (max-width: 820px) {
    display: none;
  }
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
  width: 204px;
  max-height: 360px;
  overflow-y: auto;
  padding: 5px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1px;
  user-select: none;
`

const BlockMenuSectionHeader = styled.div`
  padding: 5px 8px 3px;
  font: 650 11px/1.2 var(--aq-font-sans);
  color: ${({ theme }) => theme.colors.gray9};
`

const BlockMenuSectionDivider = styled.div`
  height: 1px;
  margin: 4px 2px;
  background: ${({ theme }) => theme.publicDesign.border};
`

const BlockMenuItemButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray12};
  font: 550 13px/1.25 var(--aq-font-sans);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s ease;

  ${focusVisibleRing}

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    font: 700 11px/1 ui-monospace, SFMono-Regular, monospace;
    color: ${({ theme }) => theme.colors.gray10};
    flex-shrink: 0;
  }
`

export const MarkdownEditorNotionChrome = ({
  containerRef,
  mode,
  disabled,
  value,
  selection,
  isSlashMenuOpen,
  isFindReplaceOpen,
  resolveCoords,
  onApplySnippet,
  onApplyFormatShortcut,
  onApplyListCommand,
  onStripBlockPrefix,
  onApplyLineCommand,
  onTriggerSlashCommand,
}: MarkdownEditorNotionChromeProps) => {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const blockMenuRef = useRef<HTMLDivElement | null>(null)
  const gutterHandleRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setIsDismissed(false)
    setIsBlockMenuOpen(false)
  }, [selection.from, selection.to, mode, disabled, isSlashMenuOpen])

  useEffect(() => {
    if (mode !== "live" || disabled) return
    const container = containerRef.current
    const bumpLayout = () => setLayoutTick((prev) => prev + 1)
    container?.addEventListener("scroll", bumpLayout, true)
    window.addEventListener("resize", bumpLayout)
    window.addEventListener("scroll", bumpLayout, true)
    return () => {
      container?.removeEventListener("scroll", bumpLayout, true)
      window.removeEventListener("resize", bumpLayout)
      window.removeEventListener("scroll", bumpLayout, true)
    }
  }, [containerRef, disabled, mode])

  const selectedText =
    selection.from < selection.to ? value.slice(selection.from, selection.to) : ""
  const canShowBubble =
    mode === "live" &&
    !disabled &&
    !isSlashMenuOpen &&
    !isFindReplaceOpen &&
    !isDismissed &&
    selection.from < selection.to &&
    selection.to - selection.from <= 600 &&
    selectedText.trim().length > 0 &&
    !isOffsetInsideFencedCodeBlock(value, selection.from) &&
    !/^\s*(`{3,}|~{3,})/.test(selectedText)

  useEffect(() => {
    if (!canShowBubble && !isBlockMenuOpen) return

    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (isBlockMenuOpen) {
        if (
          !blockMenuRef.current?.contains(target) &&
          !gutterHandleRef.current?.contains(target)
        ) {
          setIsBlockMenuOpen(false)
        }
      }
      if (canShowBubble) {
        if (bubbleRef.current?.contains(target)) return
        const element = target instanceof Element ? target : target.parentElement
        if (element?.closest('[data-testid="markdown-editor-content"]')) return
        setIsDismissed(true)
      }
    }

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [canShowBubble, isBlockMenuOpen])

  const bubblePosition = useMemo(() => {
    void layoutTick
    if (!canShowBubble) return null
    const startCoords = resolveCoords(selection.from)
    const endCoords = resolveCoords(selection.to)
    const containerRect = containerRef.current?.getBoundingClientRect() ?? null
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800

    if (startCoords && endCoords && startCoords.bottom > 0 && endCoords.bottom > 0) {
      if (
        containerRect &&
        (endCoords.bottom < containerRect.top || startCoords.top > containerRect.bottom)
      ) {
        return null
      }
      const centerX = (startCoords.left + endCoords.right) / 2
      const left = Math.max(12, Math.min(Math.round(centerX - 205), viewportWidth - 420))
      const placeBelow = startCoords.top - (containerRect?.top ?? 0) < 52
      const top = placeBelow
        ? Math.min(
            viewportHeight - 52,
            Math.round(Math.max(startCoords.bottom, endCoords.bottom) + 8)
          )
        : Math.max(12, Math.round(startCoords.top - 44))
      return { top, left }
    }

    if (containerRect && containerRect.height > 0) {
      return {
        top: Math.round(containerRect.top + 48),
        left: Math.max(12, Math.round(containerRect.left + 24)),
      }
    }

    return null
  }, [canShowBubble, containerRef, layoutTick, resolveCoords, selection.from, selection.to])

  const canShowGutterPlus =
    mode === "live" &&
    !disabled &&
    !isSlashMenuOpen &&
    selection.from === selection.to &&
    !isOffsetInsideFencedCodeBlock(value, selection.from)

  const gutterTop = useMemo(() => {
    void layoutTick
    if (!canShowGutterPlus) return null
    const containerRect = containerRef.current?.getBoundingClientRect() ?? null
    if (!containerRect || containerRect.height <= 0) return null
    const activeLineStart =
      selection.from > 0 ? value.lastIndexOf("\n", selection.from - 1) + 1 : 0
    const lineCoords = resolveCoords(activeLineStart)
    if (lineCoords && lineCoords.bottom > lineCoords.top) {
      const rawTop =
        lineCoords.top -
        containerRect.top +
        (lineCoords.bottom - lineCoords.top - 22) / 2
      if (rawTop >= 0 && rawTop <= containerRect.height - 22) {
        return Math.round(rawTop)
      }
      return null
    }
    return activeLineStart === 0 ? 24 : null
  }, [canShowGutterPlus, containerRef, layoutTick, resolveCoords, selection.from, value])

  const blockMenuPosition = useMemo(() => {
    void layoutTick
    if (!isBlockMenuOpen || !canShowGutterPlus || gutterTop === null) return null
    const containerRect = containerRef.current?.getBoundingClientRect() ?? null
    if (!containerRect) return null
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
    const top = Math.max(
      12,
      Math.min(Math.round(containerRect.top + gutterTop + 26), viewportHeight - 368)
    )
    const left = Math.max(
      12,
      Math.min(Math.round(containerRect.left + 22), viewportWidth - 216)
    )
    return { top, left }
  }, [canShowGutterPlus, containerRef, gutterTop, isBlockMenuOpen, layoutTick])

  const handleTriggerSlashAtCurrentLine = () => {
    setIsBlockMenuOpen(false)
    const lineStart =
      selection.from > 0 ? value.lastIndexOf("\n", selection.from - 1) + 1 : 0
    const nextBreak = value.indexOf("\n", selection.from)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lineText = value.slice(lineStart, lineEnd)
    const plan =
      lineText.trim().length === 0
        ? planReplaceSelection(selection.from, selection.to, "/")
        : planReplaceSelection(lineEnd, lineEnd, "\n/")
    onTriggerSlashCommand(plan)
  }

  const runMenuAction = (action: () => void) => {
    setIsBlockMenuOpen(false)
    action()
  }

  const turnIntoItems = [
    { label: "일반 문단으로 전환", glyph: "T", run: () => onStripBlockPrefix() },
    { label: "제목 1로 블록 전환", glyph: "H1", run: () => onApplySnippet("# ", "") },
    { label: "제목 2로 블록 전환", glyph: "H2", run: () => onApplySnippet("## ", "") },
    { label: "제목 3으로 블록 전환", glyph: "H3", run: () => onApplySnippet("### ", "") },
    { label: "글머리 목록으로 블록 전환", glyph: "•", run: () => onApplyListCommand("unordered") },
    { label: "번호 목록으로 블록 전환", glyph: "1.", run: () => onApplyListCommand("ordered") },
    { label: "할 일 목록으로 블록 전환", glyph: "☑", run: () => onApplyListCommand("task") },
    { label: "인용구로 블록 전환", glyph: "”", run: () => onApplySnippet("> ", "") },
  ]

  const lineActionItems = [
    { label: "현재 줄 복제", glyph: "⧉", run: () => onApplyLineCommand("duplicate") },
    { label: "현재 줄 위로 이동", glyph: "↑", run: () => onApplyLineCommand("move-up") },
    { label: "현재 줄 아래로 이동", glyph: "↓", run: () => onApplyLineCommand("move-down") },
    { label: "현재 줄 삭제", glyph: "⌫", run: () => onApplyLineCommand("delete") },
  ]

  const bubbleButtons = [
    { label: "선택 영역 일반 문단", glyph: "T", run: () => onStripBlockPrefix() },
    { label: "선택 영역 제목 1", glyph: "H1", run: () => onApplySnippet("# ", "") },
    { label: "선택 영역 제목 2", glyph: "H2", run: () => onApplySnippet("## ", "") },
    { label: "선택 영역 제목 3", glyph: "H3", run: () => onApplySnippet("### ", "") },
    { label: "선택 영역 인용구", glyph: "”", run: () => onApplySnippet("> ", "") },
    { label: "선택 영역 할 일", glyph: "☑", run: () => onApplyListCommand("task") },
  ]

  const inlineButtons = [
    { label: "선택 영역 굵게", glyph: "B", run: () => onApplyFormatShortcut("bold") },
    { label: "선택 영역 기울임", glyph: "I", run: () => onApplyFormatShortcut("italic") },
    { label: "선택 영역 취소선", glyph: "S", run: () => onApplyFormatShortcut("strikethrough") },
    { label: "선택 영역 인라인 코드", glyph: "<>", run: () => onApplyFormatShortcut("inlineCode") },
    {
      label: "선택 영역 하이라이트",
      glyph: "==",
      run: () => onApplySnippet("==", "==", { toggle: true }),
    },
    { label: "선택 영역 링크", glyph: "🔗", run: () => onApplyFormatShortcut("link") },
  ]

  return (
    <>
      {canShowGutterPlus && gutterTop !== null ? (
        <>
          <GutterPlusButton
            type="button"
            aria-label="현재 줄에 블록 삽입"
            data-testid="markdown-block-gutter-plus"
            $top={gutterTop}
            $left={4}
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleTriggerSlashAtCurrentLine}
          >
            +
          </GutterPlusButton>
          <GutterDragMenuButton
            ref={gutterHandleRef}
            type="button"
            aria-label="현재 줄 블록 메뉴"
            aria-haspopup="menu"
            aria-expanded={isBlockMenuOpen}
            data-testid="markdown-block-gutter-handle"
            $top={gutterTop}
            $left={22}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsBlockMenuOpen((prev) => !prev)}
          >
            ⋮⋮
          </GutterDragMenuButton>
        </>
      ) : null}
      {isBlockMenuOpen && blockMenuPosition ? (
        <BlockActionMenuPopover
          ref={blockMenuRef}
          role="menu"
          aria-label="블록 작업 메뉴"
          data-testid="markdown-block-action-menu"
          $top={blockMenuPosition.top}
          $left={blockMenuPosition.left}
        >
          <BlockMenuSectionHeader aria-hidden="true">블록 전환</BlockMenuSectionHeader>
          {turnIntoItems.map((item) => (
            <BlockMenuItemButton
              key={item.label}
              type="button"
              role="menuitem"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runMenuAction(item.run)}
            >
              <span className="glyph" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
            </BlockMenuItemButton>
          ))}
          <BlockMenuSectionDivider aria-hidden="true" />
          <BlockMenuSectionHeader aria-hidden="true">블록 작업</BlockMenuSectionHeader>
          {lineActionItems.map((item) => (
            <BlockMenuItemButton
              key={item.label}
              type="button"
              role="menuitem"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runMenuAction(item.run)}
            >
              <span className="glyph" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
            </BlockMenuItemButton>
          ))}
        </BlockActionMenuPopover>
      ) : null}
      {canShowBubble && bubblePosition ? (
        <SelectionBubbleToolbar
          ref={bubbleRef}
          role="toolbar"
          aria-label="선택 텍스트 빠른 서식"
          data-testid="markdown-selection-bubble"
          $top={bubblePosition.top}
          $left={bubblePosition.left}
        >
          {bubbleButtons.map((item) => (
            <BubbleActionButton
              key={item.label}
              type="button"
              aria-label={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.run}
            >
              {item.glyph}
            </BubbleActionButton>
          ))}
          <BubbleDivider aria-hidden="true" />
          {inlineButtons.map((item) => (
            <BubbleActionButton
              key={item.label}
              type="button"
              aria-label={item.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.run}
            >
              {item.glyph}
            </BubbleActionButton>
          ))}
        </SelectionBubbleToolbar>
      ) : null}
    </>
  )
}
