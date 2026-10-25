import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"
import { isOffsetInsideFencedCodeBlock, type MarkdownFormatShortcut } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"

type MarkdownEditorNotionChromeProps = {
  containerRef: RefObject<HTMLElement | null>
  mode: "live" | "source" | "reading"
  disabled: boolean
  value: string
  selection: { from: number; to: number }
  isSlashMenuOpen: boolean
  isFindReplaceOpen: boolean
  resolveCoords: (pos: number) => { top: number; bottom: number; left: number; right: number } | null
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
  overflow-x: auto;
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
  @media (pointer: coarse) { min-width: 36px; min-height: 36px; }
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
  &:hover, &:focus-visible, &[aria-expanded="true"] {
    opacity: 1;
    border-color: ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }
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
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08);
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
  width: 100%; display: flex; align-items: center; gap: 8px; padding: 4px 8px;
  border: 0; outline: none; border-radius: 6px; background: transparent;
  color: ${({ theme }) => theme.colors.gray12}; font: 550 12.5px/1.2 var(--aq-font-sans);
  text-align: left; cursor: pointer; transition: background-color 0.1s ease;
  &:hover, &:focus, &:focus-visible {
    outline: none !important;
    box-shadow: none !important;
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
  }
  &[data-active="true"] { font-weight: 650; }
  .glyph {
    display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
    border-radius: 5px; border: 1px solid ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    font: 700 10.5px/1 ui-monospace, SFMono-Regular, monospace; color: ${({ theme }) => theme.colors.gray11}; flex-shrink: 0;
  }
  .check { margin-left: auto; font: 700 12px/1 var(--aq-font-sans); color: ${({ theme }) => theme.colors.gray10}; }
`
const ColorSwatchRow = styled.div`
  display: flex; align-items: center; gap: 5px; padding: 2px 8px 3px;
`
const ColorSwatchMenuButton = styled.button<{ $color: string }>`
  flex: 1 1 0; height: 24px; border-radius: 6px; border: 1px solid ${({ theme }) => theme.publicDesign.border};
  background: ${({ theme }) => theme.publicDesign.surfaceElevated}; color: ${({ $color }) => $color};
  font: 750 11.5px/1 var(--aq-font-sans); display: inline-flex; align-items: center; justify-content: center;
  gap: 4px; cursor: pointer; outline: none;
  &:hover, &:focus, &:focus-visible {
    outline: none !important;
    box-shadow: none !important;
    border-color: ${({ $color }) => $color};
    background: ${({ theme }) => theme.publicDesign.readableSurface};
  }
`
const ColorSwatchDot = styled.span<{ $color: string }>`
  display: inline-block; width: 11px; height: 11px; border-radius: 3px;
  background: ${({ $color }) => $color}; border: 1px solid rgba(15, 23, 42, 0.16); flex-shrink: 0;
`

const NOTION_COLOR_SWATCH_SPECS = [
  { label: "글자 파란색", token: "sky", hex: "#2383e2" },
  { label: "글자 초록색", token: "emerald", hex: "#10b981" },
  { label: "글자 주황색", token: "amber", hex: "#f59e0b" },
  { label: "글자 보라색", token: "violet", hex: "#9065b0" },
  { label: "글자 빨간색", token: "rose", hex: "#eb5757" },
] as const

const resolveCurrentBlockKind = (trimmed: string) => {
  if (trimmed.startsWith("### ")) return "h3"
  if (trimmed.startsWith("## ")) return "h2"
  if (trimmed.startsWith("# ")) return "h1"
  if (/^[-*+]\s+\[[ xX]\]\s/.test(trimmed)) return "task"
  if (/^[-*+]\s/.test(trimmed)) return "unordered"
  if (/^\d+\.\s/.test(trimmed)) return "ordered"
  if (trimmed.startsWith("> ")) return "quote"
  return "paragraph"
}

const computeActiveLineState = (value: string, from: number) => {
  const lineStart = from > 0 ? value.lastIndexOf("\n", from - 1) + 1 : 0
  const nextBreak = value.indexOf("\n", from)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lineText = value.slice(lineStart, lineEnd)
  const hasFenceMarkers = value.includes("```") || value.includes("~~~")
  return {
    activeLineStart: lineStart,
    activeLineEnd: lineEnd,
    activeLineText: lineText,
    currentBlockKind: resolveCurrentBlockKind(lineText.trimStart()),
    insideFence: hasFenceMarkers ? isOffsetInsideFencedCodeBlock(value, from) : false,
  }
}

type CoordsRect = { top: number; bottom: number; left: number; right: number }

const computeBubbleToolbarPosition = (
  canShowBubble: boolean,
  selection: { from: number; to: number },
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): { top: number; left: number } | null => {
  if (!canShowBubble) return null
  const startCoords = resolveCoords(selection.from)
  const endCoords = resolveCoords(selection.to)
  const containerRect = container?.getBoundingClientRect() ?? null
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const estimatedWidth = Math.min(410, viewportWidth - 24)

  if (startCoords && endCoords && startCoords.bottom > 0 && endCoords.bottom > 0) {
    if (containerRect && (endCoords.bottom < containerRect.top || startCoords.top > containerRect.bottom)) {
      return null
    }
    const centerX = (startCoords.left + endCoords.right) / 2
    const left = Math.max(12, Math.min(Math.round(centerX - estimatedWidth / 2), viewportWidth - estimatedWidth - 12))
    const placeBelow = startCoords.top - (containerRect?.top ?? 0) < 52
    const top = placeBelow
      ? Math.min(viewportHeight - 52, Math.round(Math.max(startCoords.bottom, endCoords.bottom) + 8))
      : Math.max(12, Math.round(startCoords.top - 44))
    return { top, left }
  }

  if (containerRect && containerRect.height > 0) {
    return {
      top: Math.round(containerRect.top + 48),
      left: Math.max(12, Math.min(Math.round(containerRect.left + 24), viewportWidth - estimatedWidth - 12)),
    }
  }
  return null
}

const computeGutterTopPosition = (
  canShowGutterPlus: boolean,
  activeLineStart: number,
  resolveCoords: (pos: number) => CoordsRect | null,
  container: HTMLElement | null
): number | null => {
  if (!canShowGutterPlus) return null
  const containerRect = container?.getBoundingClientRect() ?? null
  if (!containerRect || containerRect.height <= 0) return null
  const lineCoords = resolveCoords(activeLineStart)
  if (lineCoords && lineCoords.bottom > lineCoords.top) {
    const rawTop = lineCoords.top - containerRect.top + (lineCoords.bottom - lineCoords.top - 22) / 2
    return rawTop >= 0 && rawTop <= containerRect.height - 22 ? Math.round(rawTop) : null
  }
  return activeLineStart === 0 ? 24 : null
}

const moveBlockMenuFocus = (
  key: string,
  items: HTMLButtonElement[],
  currentIndex: number,
  onClose: () => void
): boolean => {
  if (key === "ArrowDown") {
    items[currentIndex < 0 ? 0 : (currentIndex + 1) % items.length]?.focus()
    return true
  }
  if (key === "ArrowUp") {
    items[currentIndex <= 0 ? items.length - 1 : currentIndex - 1]?.focus()
    return true
  }
  if (key === "Home") {
    items[0]?.focus()
    return true
  }
  if (key === "End") {
    items.at(-1)?.focus()
    return true
  }
  if (key === "Escape") {
    onClose()
    return true
  }
  return false
}

export const MarkdownEditorNotionChrome = ({
  containerRef, mode, disabled, value, selection, isSlashMenuOpen, isFindReplaceOpen,
  resolveCoords, onApplySnippet, onApplyFormatShortcut, onApplyListCommand,
  onStripBlockPrefix, onApplyLineCommand, onTriggerSlashCommand,
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
        if (!element?.closest('[data-testid="markdown-editor-content"]')) setIsDismissed(true)
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
    return computeBubbleToolbarPosition(canShowBubble, selection, resolveCoords, containerRef.current)
  }, [canShowBubble, containerRef, layoutTick, resolveCoords, selection])

  const canShowGutterPlus =
    mode === "live" && !disabled && !isSlashMenuOpen && selection.from === selection.to && !insideFence

  const gutterTop = useMemo(() => {
    void layoutTick
    return computeGutterTopPosition(canShowGutterPlus, activeLineStart, resolveCoords, containerRef.current)
  }, [activeLineStart, canShowGutterPlus, containerRef, layoutTick, resolveCoords])

  const blockMenuPosition = useMemo(() => {
    void layoutTick
    if (!isBlockMenuOpen || !canShowGutterPlus || gutterTop === null) return null
    const containerRect = containerRef.current?.getBoundingClientRect() ?? null
    if (!containerRect) return null
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
    const menuHeight = 432
    const rawBelowTop = Math.round(containerRect.top + gutterTop + 26)
    const rawAboveTop = Math.round(containerRect.top + gutterTop - menuHeight - 6)
    const top =
      rawBelowTop + menuHeight > viewportHeight - 12 && rawAboveTop >= 12
        ? rawAboveTop
        : Math.max(12, Math.min(rawBelowTop, viewportHeight - menuHeight - 12))
    const left = Math.max(12, Math.min(Math.round(containerRect.left + 22), viewportWidth - 216))
    return { top, left }
  }, [canShowGutterPlus, containerRef, gutterTop, isBlockMenuOpen, layoutTick])

  useEffect(() => {
    if (!isBlockMenuOpen || !blockMenuPosition) return
    blockMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [blockMenuPosition, isBlockMenuOpen])

  const handleBlockMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
      onApplySnippet(`{{color:${token}|`, "}}", { toggle: true })
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
    const existingColorMatch = /^\{\{color:[^|{}]+\|([\s\S]*)\}\}$/.exec(rawBody)
    const innerText = (existingColorMatch ? existingColorMatch[1] ?? "" : rawBody) || "강조 텍스트"
    onTriggerSlashCommand(
      planReplaceSelection(lineStart + bodyOffset, lineEnd, `{{color:${token}|${innerText}}}`)
    )
  }

  const turnIntoItems = [
    { kind: "paragraph", label: "일반 문단으로 전환", glyph: "T", run: () => onStripBlockPrefix() },
    { kind: "h1", label: "제목 1로 블록 전환", glyph: "H1", run: () => onApplySnippet("# ", "") },
    { kind: "h2", label: "제목 2로 블록 전환", glyph: "H2", run: () => onApplySnippet("## ", "") },
    { kind: "h3", label: "제목 3으로 블록 전환", glyph: "H3", run: () => onApplySnippet("### ", "") },
    { kind: "unordered", label: "글머리 목록으로 블록 전환", glyph: "•", run: () => onApplyListCommand("unordered") },
    { kind: "ordered", label: "번호 목록으로 블록 전환", glyph: "1.", run: () => onApplyListCommand("ordered") },
    { kind: "task", label: "할 일 목록으로 블록 전환", glyph: "☑", run: () => onApplyListCommand("task") },
    { kind: "quote", label: "인용구로 블록 전환", glyph: "”", run: () => onApplySnippet("> ", "") },
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
    { label: "선택 영역 하이라이트", glyph: "==", run: () => onApplySnippet("==", "==", { toggle: true }) },
    { label: "선택 영역 링크", glyph: "🔗", run: () => onApplyFormatShortcut("link") },
  ]

  return (
    <>
      {canShowGutterPlus && gutterTop !== null ? (
        <>
          <GutterPlusButton type="button" aria-label="현재 줄에 블록 삽입" data-testid="markdown-block-gutter-plus" $top={gutterTop} $left={10} onMouseDown={(event) => event.preventDefault()} onClick={handleTriggerSlashAtCurrentLine}>+</GutterPlusButton>
          <GutterDragMenuButton ref={gutterHandleRef} type="button" aria-label="현재 줄 블록 메뉴" aria-haspopup="menu" aria-expanded={isBlockMenuOpen} data-block-kind={currentBlockKind} data-testid="markdown-block-gutter-handle" $top={gutterTop} $left={30} onMouseDown={(event) => event.preventDefault()} onClick={() => setIsBlockMenuOpen((prev) => !prev)}>⋮⋮</GutterDragMenuButton>
        </>
      ) : null}
      {isBlockMenuOpen && blockMenuPosition ? (
        <BlockActionMenuPopover ref={blockMenuRef} role="menu" aria-label="블록 작업 메뉴" data-testid="markdown-block-action-menu" $top={blockMenuPosition.top} $left={blockMenuPosition.left} onKeyDown={handleBlockMenuKeyDown}>
          <BlockMenuSectionHeader aria-hidden="true">블록 전환</BlockMenuSectionHeader>
          {turnIntoItems.map((item) => (
            <BlockMenuItemButton key={item.label} type="button" role="menuitem" data-active={currentBlockKind === item.kind ? "true" : undefined} onMouseDown={(event) => event.preventDefault()} onClick={() => runMenuAction(item.run)}>
              <span className="glyph" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
              {currentBlockKind === item.kind ? <span className="check" aria-hidden="true">✓</span> : null}
            </BlockMenuItemButton>
          ))}
          <BlockMenuSectionDivider aria-hidden="true" />
          <BlockMenuSectionHeader aria-hidden="true">글자 색상</BlockMenuSectionHeader>
          <ColorSwatchRow>
            {NOTION_COLOR_SWATCH_SPECS.map((swatch) => (
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
              <span className="glyph" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
            </BlockMenuItemButton>
          ))}
        </BlockActionMenuPopover>
      ) : null}
      {canShowBubble && bubblePosition ? (
        <SelectionBubbleToolbar ref={bubbleRef} role="toolbar" aria-label="선택 텍스트 빠른 서식" data-testid="markdown-selection-bubble" $top={bubblePosition.top} $left={bubblePosition.left}>
          {bubbleButtons.map((item) => (
            <BubbleActionButton key={item.label} type="button" aria-label={item.label} onMouseDown={(event) => event.preventDefault()} onClick={item.run}>{item.glyph}</BubbleActionButton>
          ))}
          <BubbleDivider aria-hidden="true" />
          {inlineButtons.map((item) => (
            <BubbleActionButton key={item.label} type="button" aria-label={item.label} onMouseDown={(event) => event.preventDefault()} onClick={item.run}>{item.glyph}</BubbleActionButton>
          ))}
          <BubbleDivider aria-hidden="true" />
          {NOTION_COLOR_SWATCH_SPECS.map((swatch) => (
            <BubbleActionButton key={swatch.label} type="button" aria-label={`선택 영역 ${swatch.label}`} title={swatch.label} onMouseDown={(event) => event.preventDefault()} onClick={() => onApplySnippet(`{{color:${swatch.token}|`, "}}", { toggle: true })}>
              <ColorSwatchDot $color={swatch.hex} />
            </BubbleActionButton>
          ))}
        </SelectionBubbleToolbar>
      ) : null}
    </>
  )
}
