/**
 * 참조 구현:
 * - Milkdown/milkdown packages/crepe/src/feature/block-edit/ (MIT License, Copyright (c) 2021 Mirone)
 * - steven-tey/novel packages/headless/src/components/editor-bubble.tsx (Apache-2.0 License, Copyright (c) Steven Tey)
 * - marktext/marktext (MIT License, Copyright (c) 2017-present Jocs) — 타이핑 중 크롬 자동 감쇠
 */
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from "react"
import styled from "@emotion/styled"
import { focusVisibleRing } from "src/design-system/focusRing"
import { boxShadowColor } from "src/design-system/tokens"
import { useLanguage } from "src/libs/language"
import { zIndexes } from "src/styles/zIndexes"
import { getBlockChromeLabels, getColorSwatchLabel } from "./markdownEditorBlockChromeLabels"
import type { MarkdownFormatShortcut } from "./markdownEditorKeyboardModel"
import type { MarkdownEditorLineCommand } from "./markdownEditorLineCommandsModel"
import type { MarkdownEditorListCommand } from "./markdownEditorListCommandsModel"
import { MarkdownEditorBubbleLinkPopover, parseMarkdownLinkSelection } from "./MarkdownEditorBubbleLinkPopover"
import { findMarkdownLinkAtOffset } from "./markdownEditorLinkUtils"
import {
  EditorIconBold,
  EditorIconGripSixDots,
  EditorIconHeading1,
  EditorIconHeading2,
  EditorIconHeading3,
  EditorIconHighlight,
  EditorIconInlineCode,
  EditorIconItalic,
  EditorIconLink,
  EditorIconParagraph,
  EditorIconPlus,
  EditorIconQuote,
  EditorIconStrikethrough,
  EditorIconTaskList,
} from "./MarkdownEditorIcons"
import {
  EDITOR_COLOR_SWATCH_SPECS,
  computeActiveLineState,
  computeColorSwatchMutationPlan,
  measureBlockChromeLayout,
  moveBlockMenuFocus,
} from "./markdownEditorBlockChromeModel"
import {
  BubbleActionButton,
  BubbleColorSwatchPopover,
  BubbleColorTriggerGlyph,
  BubbleDivider,
  ColorSwatchDot,
} from "./MarkdownEditorBlockChrome.styles"
import { MarkdownEditorBlockMenuPopover } from "./MarkdownEditorBlockMenuPopover"
import type { MarkdownEditorSurfaceMode } from "./markdownEditorLivePreview"
import { isLivePreviewSurfaceMode } from "./markdownEditorLivePreview"
import {
  isWrapSelectionActive,
  planReplaceSelection,
  type PlannedTextMutation,
} from "./markdownEditorTextMutation"

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

type MarkdownEditorBlockChromeProps = {
  containerRef: RefObject<HTMLElement | null>
  mode: MarkdownEditorSurfaceMode
  disabled: boolean
  value: string
  selection: { from: number; to: number }
  isSlashMenuOpen: boolean
  isFindReplaceOpen: boolean
  resolveCoords: (pos: number) => { top: number; bottom: number; left: number; right: number } | null
  resolvePosAtCoords?: (coords: { x: number; y: number }) => number | null
  requestMeasure?: <T>(spec: { key?: string; read: () => T; write: (measured: T) => void }) => boolean
  linkPopoverTriggerNonce?: number
  onSelectGutterLine?: (lineStart: number) => void
  onApplySnippet: (before: string, after?: string, options?: { toggle?: boolean }) => void
  onApplyFormatShortcut: (shortcut: MarkdownFormatShortcut) => void
  onApplyListCommand: (command: MarkdownEditorListCommand) => void
  onStripBlockPrefix: () => void
  onApplyLineCommand: (command: MarkdownEditorLineCommand) => void
  onTriggerSlashCommand: (plan: PlannedTextMutation) => void
}

const SelectionBubbleToolbar = styled.div<{ $top: number; $left: number }>`
  position: fixed; z-index: ${zIndexes.dropdownMenu + 5}; top: ${({ $top }) => $top}px; left: ${({ $left }) => $left}px;
  max-width: calc(100vw - 24px); overflow: visible; display: flex; align-items: center; gap: 1px; padding: 3px 4px;
  border-radius: 8px; border: 1px solid ${({ theme }) => theme.publicDesign.borderStrong};
  background: ${({ theme }) => theme.publicDesign.readableSurface};
  box-shadow: 0 2px 6px ${boxShadowColor.cardHover}, 0 10px 24px ${boxShadowColor.popover}; user-select: none;
  @media (max-width: 720px) { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
`

const GutterHandleButtonBase = styled.button<{ $top: number; $left: number; $dimmed?: boolean }>`
  position: absolute; left: ${({ $left }) => $left}px; top: ${({ $top }) => $top}px; z-index: 4;
  width: 24px; height: 24px; padding: 2px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 5px; background: transparent; color: ${({ theme }) => theme.colors.gray9};
  cursor: pointer; opacity: ${({ $dimmed }) => ($dimmed ? 0.14 : 0.72)}; user-select: none;
  transition: opacity 0.18s ease, background-color 0.15s ease, color 0.15s ease; ${focusVisibleRing}
  &:hover, &:focus-visible { opacity: 1; border: 0; background: ${({ theme }) => theme.colors.gray3}; color: ${({ theme }) => theme.colors.gray12}; }
  &[aria-expanded="true"] { opacity: 1; border: 0; background: ${({ theme }) => theme.colors.gray4}; color: ${({ theme }) => theme.colors.gray12}; }
  @media (pointer: coarse) { display: none; }
  @media (max-width: 820px) { display: none; }
`

const GutterPlusButton = styled(GutterHandleButtonBase)`
  font: 600 15px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
`

const GutterDragMenuButton = styled(GutterHandleButtonBase)`
  font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: -1px;
`

export const MarkdownEditorBlockChrome = ({
  containerRef, mode, disabled, value, selection, isSlashMenuOpen, isFindReplaceOpen,
  resolveCoords, resolvePosAtCoords, requestMeasure, linkPopoverTriggerNonce = 0, onSelectGutterLine,
  onApplySnippet, onApplyFormatShortcut, onApplyListCommand,
  onStripBlockPrefix, onApplyLineCommand, onTriggerSlashCommand,
}: MarkdownEditorBlockChromeProps) => {
  const { language } = useLanguage()
  const labels = getBlockChromeLabels(language)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false)
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false)
  const [hoveredLineStart, setHoveredLineStart] = useState<number | null>(null)
  const [isTypingDimmed, setIsTypingDimmed] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const [bubblePosition, setBubblePosition] = useState<{ top: number; left: number } | null>(null)
  const [gutterTop, setGutterTop] = useState<number | null>(null)
  const [gutterLeft, setGutterLeft] = useState(10)
  const [blockMenuPosition, setBlockMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [linkAnchorPosition, setLinkAnchorPosition] = useState<{ top: number; left: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const blockMenuRef = useRef<HTMLDivElement | null>(null)
  const colorPopoverRef = useRef<HTMLDivElement | null>(null)
  const gutterHandleRef = useRef<HTMLButtonElement | null>(null)
  const prevValueRef = useRef(value)
  const lastLinkNonceRef = useRef(linkPopoverTriggerNonce)

  useEffect(() => {
    setIsDismissed(false)
    setIsBlockMenuOpen(false)
    setIsLinkPopoverOpen(false)
    setIsColorPopoverOpen(false)
  }, [selection.from, selection.to, mode, disabled, isSlashMenuOpen])

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      if (isLivePreviewSurfaceMode(mode) && !disabled && !isBlockMenuOpen) {
        setIsTypingDimmed(true)
        setHoveredLineStart(null)
      }
    }
  }, [disabled, isBlockMenuOpen, mode, value])

  const { activeLineStart, activeLineEnd, activeLineText, currentBlockKind, insideFence } = useMemo(
    () => computeActiveLineState(value, selection.from),
    [value, selection.from]
  )
  const activeCursorLink = useMemo(
    () =>
      isLivePreviewSurfaceMode(mode) &&
      !disabled &&
      !isSlashMenuOpen &&
      !isFindReplaceOpen &&
      !isDismissed &&
      selection.from === selection.to &&
      !insideFence
        ? findMarkdownLinkAtOffset(value, selection.from)
        : null,
    [disabled, insideFence, isDismissed, isFindReplaceOpen, isSlashMenuOpen, mode, selection.from, selection.to, value]
  )

  useEffect(() => {
    if (linkPopoverTriggerNonce === lastLinkNonceRef.current) return
    lastLinkNonceRef.current = linkPopoverTriggerNonce
    if (
      isLivePreviewSurfaceMode(mode) &&
      !disabled &&
      !isSlashMenuOpen &&
      !isFindReplaceOpen &&
      (selection.from < selection.to || activeCursorLink !== null)
    ) {
      setIsDismissed(false)
      setIsColorPopoverOpen(false)
      setIsLinkPopoverOpen(true)
    }
  }, [activeCursorLink, disabled, isFindReplaceOpen, isSlashMenuOpen, linkPopoverTriggerNonce, mode, selection.from, selection.to])

  useEffect(() => {
    if (!isLivePreviewSurfaceMode(mode) || disabled) return
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
    const handleMouseMove = (event: MouseEvent) => {
      setIsTypingDimmed(false)
      if (!resolvePosAtCoords || isBlockMenuOpen || selection.from !== selection.to) return
      const pos = resolvePosAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return
      const lineStart = pos > 0 ? value.lastIndexOf("\n", pos - 1) + 1 : 0
      setHoveredLineStart((prev) => (prev === lineStart ? prev : lineStart))
    }
    const handleMouseLeave = () => {
      setHoveredLineStart(null)
    }
    container?.addEventListener("scroll", bumpLayout, true)
    container?.addEventListener("mousemove", handleMouseMove)
    container?.addEventListener("mouseleave", handleMouseLeave)
    window.addEventListener("resize", bumpLayout)
    window.addEventListener("scroll", bumpLayout, true)
    return () => {
      if (rafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId)
      }
      container?.removeEventListener("scroll", bumpLayout, true)
      container?.removeEventListener("mousemove", handleMouseMove)
      container?.removeEventListener("mouseleave", handleMouseLeave)
      window.removeEventListener("resize", bumpLayout)
      window.removeEventListener("scroll", bumpLayout, true)
    }
  }, [containerRef, disabled, isBlockMenuOpen, mode, resolvePosAtCoords, selection.from, selection.to, value])

  const targetGutterPos = hoveredLineStart !== null ? hoveredLineStart : selection.from
  const targetLineState = useMemo(
    () =>
      hoveredLineStart !== null && hoveredLineStart !== activeLineStart
        ? computeActiveLineState(value, hoveredLineStart)
        : { activeLineStart, activeLineEnd, activeLineText, currentBlockKind, insideFence },
    [activeLineEnd, activeLineStart, activeLineText, currentBlockKind, hoveredLineStart, insideFence, value]
  )
  const effectiveGutterLineStart = targetLineState.activeLineStart
  const effectiveBlockKind = targetLineState.currentBlockKind

  const selectedText = useMemo(
    () => (selection.from < selection.to && selection.to - selection.from <= 600 ? value.slice(selection.from, selection.to) : ""),
    [selection.from, selection.to, value]
  )
  const canShowBubble =
    isLivePreviewSurfaceMode(mode) && !disabled && !isSlashMenuOpen && !isFindReplaceOpen && !isDismissed &&
    selection.from < selection.to && selection.to - selection.from <= 600 &&
    selectedText.trim().length > 0 && !insideFence && !/^\s*(`{3,}|~{3,})/.test(selectedText)

  useEffect(() => {
    if (!canShowBubble && !isBlockMenuOpen && !activeCursorLink) return
    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (isBlockMenuOpen && !blockMenuRef.current?.contains(target) && !gutterHandleRef.current?.contains(target)) {
        setIsBlockMenuOpen(false)
      }
      if ((canShowBubble || activeCursorLink) && !bubbleRef.current?.contains(target) && !colorPopoverRef.current?.contains(target)) {
        const element = target instanceof Element ? target : target.parentElement
        if (!element?.closest('[data-testid="markdown-editor-content"], [data-testid="markdown-bubble-link-popover"]')) {
          setIsDismissed(true)
          setIsLinkPopoverOpen(false)
          setIsColorPopoverOpen(false)
        }
      }
    }
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isColorPopoverOpen) {
          setIsColorPopoverOpen(false)
          return
        }
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
  }, [activeCursorLink, canShowBubble, isBlockMenuOpen, isColorPopoverOpen, isLinkPopoverOpen])

  const canShowGutterPlus =
    isLivePreviewSurfaceMode(mode) && !disabled && !isSlashMenuOpen && selection.from === selection.to && !targetLineState.insideFence && targetGutterPos >= 0

  useIsomorphicLayoutEffect(() => {
    let cancelled = false
    const readLayout = () => {
      const base = measureBlockChromeLayout({
        canShowBubble,
        canShowGutterPlus,
        isBlockMenuOpen,
        selection,
        activeLineStart: effectiveGutterLineStart,
        resolveCoords,
        container: containerRef.current,
        measuredBubbleWidth: bubbleRef.current?.offsetWidth,
      })
      const linkCoords = activeCursorLink ? resolveCoords(activeCursorLink.from) : null
      return {
        ...base,
        linkAnchor: linkCoords ? { top: Math.round(linkCoords.top), left: Math.round(linkCoords.left) } : null,
      }
    }
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
      setLinkAnchorPosition((prev) =>
        prev?.top === measured.linkAnchor?.top && prev?.left === measured.linkAnchor?.left
          ? prev
          : measured.linkAnchor
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
    activeCursorLink,
    canShowBubble,
    canShowGutterPlus,
    containerRef,
    effectiveGutterLineStart,
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
    setIsTypingDimmed(false)
    const insertPos =
      hoveredLineStart !== null && hoveredLineStart !== activeLineStart
        ? effectiveGutterLineStart
        : selection.from
    const insertEnd =
      hoveredLineStart !== null && hoveredLineStart !== activeLineStart
        ? effectiveGutterLineStart
        : selection.to
    const plan =
      targetLineState.activeLineText.trim().length === 0
        ? planReplaceSelection(insertPos, insertEnd, "/")
        : planReplaceSelection(targetLineState.activeLineEnd, targetLineState.activeLineEnd, "\n/")
    onTriggerSlashCommand(plan)
  }

  const applyLineColorSwatch = (token: string) => {
    const result = computeColorSwatchMutationPlan(value, selection, selectedText, token)
    if (result.kind === "replace") {
      onTriggerSlashCommand(result.plan)
      return
    }
    if (result.kind === "wrap") {
      onApplySnippet(result.before, result.after, { toggle: true })
    }
  }

  const bubbleButtons = [
    { label: labels.selParagraph, icon: <EditorIconParagraph size={14} />, run: () => onStripBlockPrefix() },
    { label: labels.selHeading1, icon: <EditorIconHeading1 size={14} />, run: () => onApplySnippet("# ", "") },
    { label: labels.selHeading2, icon: <EditorIconHeading2 size={14} />, run: () => onApplySnippet("## ", "") },
    { label: labels.selHeading3, icon: <EditorIconHeading3 size={14} />, run: () => onApplySnippet("### ", "") },
    { label: labels.selQuote, icon: <EditorIconQuote size={14} />, run: () => onApplySnippet("> ", "") },
    { label: labels.selTask, icon: <EditorIconTaskList size={14} />, run: () => onApplyListCommand("task") },
  ]

  const inlineButtons = [
    { label: labels.selBold, icon: <EditorIconBold size={14} />, active: isWrapSelectionActive(value, selection.from, selection.to, "**", "**"), run: () => onApplyFormatShortcut("bold") },
    { label: labels.selItalic, icon: <EditorIconItalic size={14} />, active: isWrapSelectionActive(value, selection.from, selection.to, "_", "_"), run: () => onApplyFormatShortcut("italic") },
    { label: labels.selStrikethrough, icon: <EditorIconStrikethrough size={14} />, active: /^~~[\s\S]+~~$/.test(selectedText), run: () => onApplyFormatShortcut("strikethrough") },
    { label: labels.selInlineCode, icon: <EditorIconInlineCode size={14} />, active: /^`[^`]+`$/.test(selectedText), run: () => onApplyFormatShortcut("inlineCode") },
    { label: labels.selHighlight, icon: <EditorIconHighlight size={14} />, active: /^==[\s\S]+==$/.test(selectedText), run: () => onApplySnippet("==", "==", { toggle: true }) },
    {
      label: labels.selLink,
      icon: <EditorIconLink size={14} />,
      active: Boolean(parseMarkdownLinkSelection(selectedText)) || isLinkPopoverOpen,
      expanded: isLinkPopoverOpen,
      run: () => {
        setIsColorPopoverOpen(false)
        setIsLinkPopoverOpen((prev) => !prev)
      },
    },
  ]

  const gutterDimmed = isTypingDimmed && !isBlockMenuOpen
  const hasInlineColorActive = /^\{\{color:([^|{}]+)\|/.test(selectedText)

  return (
    <>
      {canShowGutterPlus && gutterTop !== null ? (
        <>
          <GutterPlusButton type="button" aria-label={labels.gutterPlus} data-testid="markdown-block-gutter-plus" $top={gutterTop} $left={gutterLeft} $dimmed={gutterDimmed} onMouseDown={(event) => event.preventDefault()} onClick={handleTriggerSlashAtCurrentLine}><EditorIconPlus size={15} /></GutterPlusButton>
          <GutterDragMenuButton
            ref={gutterHandleRef}
            type="button"
            aria-label={labels.gutterHandle}
            aria-haspopup="menu"
            aria-expanded={isBlockMenuOpen}
            data-block-kind={effectiveBlockKind}
            data-testid="markdown-block-gutter-handle"
            $top={gutterTop}
            $left={gutterLeft + 25}
            $dimmed={gutterDimmed}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setIsTypingDimmed(false)
              if (!isBlockMenuOpen && hoveredLineStart !== null && hoveredLineStart !== activeLineStart) {
                onSelectGutterLine?.(hoveredLineStart)
              }
              setIsBlockMenuOpen((prev) => !prev)
            }}
          >
            <EditorIconGripSixDots size={15} />
          </GutterDragMenuButton>
        </>
      ) : null}
      {isBlockMenuOpen && blockMenuPosition ? (
        <MarkdownEditorBlockMenuPopover
          blockMenuRef={blockMenuRef}
          position={blockMenuPosition}
          activeBlockKind={effectiveBlockKind}
          onKeyDown={handleBlockMenuKeyDown}
          onClose={() => setIsBlockMenuOpen(false)}
          onApplySnippet={onApplySnippet}
          onApplyListCommand={onApplyListCommand}
          onStripBlockPrefix={onStripBlockPrefix}
          onApplyLineCommand={onApplyLineCommand}
          onApplyColorSwatch={applyLineColorSwatch}
        />
      ) : null}
      {canShowBubble && bubblePosition ? (
        <SelectionBubbleToolbar ref={bubbleRef} role="toolbar" aria-label={labels.selectionToolbar} data-testid="markdown-selection-bubble" $top={bubblePosition.top} $left={bubblePosition.left}>
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
          <BubbleActionButton
            type="button"
            aria-label={labels.selTextColor}
            title={labels.selTextColor}
            aria-pressed={hasInlineColorActive}
            aria-expanded={isColorPopoverOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setIsLinkPopoverOpen(false)
              setIsColorPopoverOpen((prev) => !prev)
            }}
          >
            <BubbleColorTriggerGlyph>A</BubbleColorTriggerGlyph>
          </BubbleActionButton>
        </SelectionBubbleToolbar>
      ) : null}
      {canShowBubble && bubblePosition && isColorPopoverOpen ? (
        <BubbleColorSwatchPopover
          ref={colorPopoverRef}
          role="menu"
          aria-label={labels.selTextColorPalette}
          $top={bubblePosition.top + 36}
          $left={bubblePosition.left}
        >
          {EDITOR_COLOR_SWATCH_SPECS.map((swatch) => (
            <BubbleActionButton
              key={swatch.token}
              type="button"
              role="menuitem"
              aria-label={getColorSwatchLabel(language, swatch.token, swatch.label, true)}
              title={getColorSwatchLabel(language, swatch.token, swatch.label)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                applyLineColorSwatch(swatch.token)
                setIsColorPopoverOpen(false)
              }}
            >
              <ColorSwatchDot $color={swatch.hex} />
            </BubbleActionButton>
          ))}
        </BubbleColorSwatchPopover>
      ) : null}
      {(canShowBubble && bubblePosition && isLinkPopoverOpen) || (activeCursorLink && linkAnchorPosition) ? (
        <MarkdownEditorBubbleLinkPopover
          isOpen={true}
          top={isLinkPopoverOpen && bubblePosition ? bubblePosition.top : (linkAnchorPosition?.top ?? 0)}
          left={isLinkPopoverOpen && bubblePosition ? bubblePosition.left : (linkAnchorPosition?.left ?? 0)}
          value={value}
          selection={activeCursorLink && !canShowBubble ? { from: activeCursorLink.from, to: activeCursorLink.to } : selection}
          autoFocus={isLinkPopoverOpen}
          onApplyPlan={onTriggerSlashCommand}
          onClose={() => {
            setIsLinkPopoverOpen(false)
            if (activeCursorLink) setIsDismissed(true)
          }}
        />
      ) : null}
    </>
  )
}
