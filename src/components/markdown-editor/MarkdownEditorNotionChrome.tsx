import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { zIndexes } from "src/styles/zIndexes"
import {
  isOffsetInsideFencedCodeBlock,
  type MarkdownFormatShortcut,
} from "./markdownEditorKeyboardModel"
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

const GutterPlusButton = styled.button<{ $top: number }>`
  position: absolute;
  left: 6px;
  top: ${({ $top }) => $top}px;
  z-index: 4;
  width: 20px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray9};
  font: 600 15px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
  opacity: 0.62;
  user-select: none;
  transition: opacity 0.14s ease, background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;

  ${focusVisibleRing}

  &:hover,
  &:focus-visible {
    opacity: 1;
    border-color: ${({ theme }) => theme.publicDesign.border};
    background: ${({ theme }) => theme.publicDesign.surfaceElevated};
    color: ${({ theme }) => theme.colors.gray12};
  }

  @media (max-width: 820px) {
    display: none;
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
  onTriggerSlashCommand,
}: MarkdownEditorNotionChromeProps) => {
  const [isDismissed, setIsDismissed] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const bubbleRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setIsDismissed(false)
  }, [selection.from, selection.to])

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
    if (!canShowBubble) return

    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (bubbleRef.current?.contains(target)) return
      const element = target instanceof Element ? target : target.parentElement
      if (element?.closest('[data-testid="markdown-editor-content"]')) return
      setIsDismissed(true)
    }

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDismissed(true)
      }
    }

    document.addEventListener("mousedown", handleMouseDownCapture, true)
    window.addEventListener("keydown", handleKeyDownCapture, true)
    return () => {
      document.removeEventListener("mousedown", handleMouseDownCapture, true)
      window.removeEventListener("keydown", handleKeyDownCapture, true)
    }
  }, [canShowBubble])

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
      const left = Math.max(12, Math.min(Math.round(centerX - 190), viewportWidth - 392))
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

  const handleTriggerSlashAtCurrentLine = () => {
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

  return (
    <>
      {canShowGutterPlus && gutterTop !== null ? (
        <GutterPlusButton
          type="button"
          aria-label="현재 줄에 블록 삽입"
          data-testid="markdown-block-gutter-plus"
          $top={gutterTop}
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleTriggerSlashAtCurrentLine}
        >
          +
        </GutterPlusButton>
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
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 제목 1"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplySnippet("# ", "")}
          >
            H1
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 제목 2"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplySnippet("## ", "")}
          >
            H2
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 제목 3"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplySnippet("### ", "")}
          >
            H3
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 인용구"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplySnippet("> ", "")}
          >
            ”
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 할 일"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyListCommand("task")}
          >
            ☑
          </BubbleActionButton>
          <BubbleDivider aria-hidden="true" />
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 굵게"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFormatShortcut("bold")}
          >
            B
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 기울임"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFormatShortcut("italic")}
          >
            I
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 취소선"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFormatShortcut("strikethrough")}
          >
            S
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 인라인 코드"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFormatShortcut("inlineCode")}
          >
            {"<>"}
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 하이라이트"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplySnippet("==", "==", { toggle: true })}
          >
            ==
          </BubbleActionButton>
          <BubbleActionButton
            type="button"
            aria-label="선택 영역 링크"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApplyFormatShortcut("link")}
          >
            🔗
          </BubbleActionButton>
        </SelectionBubbleToolbar>
      ) : null}
    </>
  )
}
