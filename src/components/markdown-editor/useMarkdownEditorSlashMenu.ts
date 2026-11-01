import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react"
import { isOffsetInsideFencedCodeBlock } from "./markdownEditorKeyboardModel"
import { SLASH_COMMAND_SPECS, type SlashMenuItem } from "./MarkdownEditorSlashMenu"
export { SLASH_COMMAND_SPECS } from "./MarkdownEditorSlashMenu"
import { createMarkdownEditorTable } from "./markdownEditorTableModel"
import { planReplaceSelection, type PlannedTextMutation } from "./markdownEditorTextMutation"

type SlashSelection = {
  from: number
  to: number
}

const skipInlineSpaces = (text: string, index: number): number => {
  let cursor = index
  while (cursor < text.length && /\s/.test(text[cursor]!)) cursor += 1
  return cursor
}

const skipListBulletOrOrderedMarker = (text: string, start: number): number => {
  const ch = text[start]
  if (ch === "-" || ch === "+" || ch === "*") return start + 1
  let cursor = start
  while (cursor < text.length && text[cursor]! >= "0" && text[cursor]! <= "9") cursor += 1
  return cursor > start && text[cursor] === "." ? cursor + 1 : start
}

const skipOptionalTaskCheckbox = (text: string, start: number): number => {
  const box = text.slice(start, start + 3)
  if (box !== "[ ]" && box !== "[x]" && box !== "[X]") return start
  const afterSpaces = skipInlineSpaces(text, start + 3)
  return afterSpaces > start + 3 ? afterSpaces : start
}

const skipOptionalListPrefix = (text: string, start: number): number => {
  const markerEnd = skipListBulletOrOrderedMarker(text, start)
  if (markerEnd === start) return start
  const afterSpaces = skipInlineSpaces(text, markerEnd)
  return afterSpaces > markerEnd ? skipOptionalTaskCheckbox(text, afterSpaces) : start
}

const extractSlashQueryFromLinePrefix = (lineText: string): string | null => {
  let cursor = skipInlineSpaces(lineText, 0)
  while (lineText[cursor] === ">") {
    cursor = skipInlineSpaces(lineText, cursor + 1)
  }
  cursor = skipOptionalListPrefix(lineText, cursor)
  if (lineText[cursor] !== "/") return null
  const query = lineText.slice(cursor + 1)
  return /[\s/]/.test(query) ? null : query
}

export const matchSlashCommandTrigger = (
  markdown: string,
  selection: SlashSelection
): { query: string; slashFrom: number } | null => {
  const pos = selection.from
  if (pos === 0 || selection.from !== selection.to) return null
  const lineStart = markdown.lastIndexOf("\n", pos - 1) + 1
  const lineText = markdown.slice(lineStart, pos)
  const query = extractSlashQueryFromLinePrefix(lineText)
  if (query === null) return null
  if (isOffsetInsideFencedCodeBlock(markdown, pos)) return null
  return {
    query,
    slashFrom: pos - query.length - 1,
  }
}

export const SLASH_FLAG_MERMAID = 1
export const SLASH_FLAG_IMAGE = 1 << 1
export const SLASH_FLAG_ATTACHMENT = 1 << 2

export const packSlashDisabledFeaturesMask = (options?: {
  disableMermaid?: boolean
  disableImageUpload?: boolean
  disableFileUpload?: boolean
}): number =>
  (options?.disableMermaid ? SLASH_FLAG_MERMAID : 0) |
  (options?.disableImageUpload ? SLASH_FLAG_IMAGE : 0) |
  (options?.disableFileUpload ? SLASH_FLAG_ATTACHMENT : 0)

const resolveSlashSpecFlagMask = (id: string): number => {
  if (id === "mermaid") return SLASH_FLAG_MERMAID
  if (id === "image") return SLASH_FLAG_IMAGE
  if (id === "attachment") return SLASH_FLAG_ATTACHMENT
  return 0
}

const INDEXED_SLASH_SPECS = SLASH_COMMAND_SPECS.map((spec) => ({
  spec,
  flagMask: resolveSlashSpecFlagMask(spec.id),
  searchHaystack: `${spec.id}\n${spec.label}\n${spec.description}\n${spec.keywords.join("\n")}`.toLowerCase(),
}))

export const filterSlashCommandSpecs = (
  query: string,
  disableMermaid = false,
  options?: { disableImageUpload?: boolean; disableFileUpload?: boolean }
) => {
  const q = query.trim().toLowerCase()
  const disabledMask = packSlashDisabledFeaturesMask({
    disableMermaid,
    disableImageUpload: options?.disableImageUpload,
    disableFileUpload: options?.disableFileUpload,
  })
  const matched: (typeof SLASH_COMMAND_SPECS)[number][] = []
  for (const entry of INDEXED_SLASH_SPECS) {
    if ((entry.flagMask & disabledMask) !== 0) continue
    if (q && !entry.searchHaystack.includes(q)) continue
    matched.push(entry.spec)
  }
  return matched
}

export const resolveSlashCommandMutation = (
  spec: { id: string; snippet: string },
  slashStart: number,
  selectionEnd: number
): PlannedTextMutation => {
  if (spec.snippet === "__IMAGE_UPLOAD__" || spec.snippet === "__FILE_UPLOAD__") {
    return planReplaceSelection(slashStart, selectionEnd, "")
  }
  if (spec.snippet === "__TABLE__") {
    const table = createMarkdownEditorTable(2, 2)
    if (table) {
      const cursor = slashStart + table.cursorOffset
      return {
        rangeStart: slashStart,
        rangeEnd: selectionEnd,
        replacement: table.snippet,
        selectionStart: cursor,
        selectionEnd: cursor,
      }
    }
  }
  const cursorOffsetBySpecId: Record<string, number> = {
    "code-block": 6,
    math: 3,
    mermaid: 11,
    toggle: 16,
    bookmark: 20,
  }
  const innerOffset = cursorOffsetBySpecId[spec.id]
  if (innerOffset !== undefined) {
    const cursor = slashStart + innerOffset
    return {
      rangeStart: slashStart,
      rangeEnd: selectionEnd,
      replacement: spec.snippet,
      selectionStart: cursor,
      selectionEnd: cursor,
    }
  }
  return planReplaceSelection(slashStart, selectionEnd, spec.snippet)
}

type SlashAnchorRect = { top: number; bottom: number; left: number; right: number }

const readViewportMetrics = () => {
  const vv = typeof window !== "undefined" ? window.visualViewport : null
  const top = vv?.offsetTop ?? 0
  const left = vv?.offsetLeft ?? 0
  const width = vv?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280)
  const height = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 800)
  return { top, left, width, height, bottom: top + height, right: left + width }
}

const computeSlashMenuTop = (rect: { top: number; bottom: number }): number => {
  const vp = readViewportMetrics()
  const isMobile = vp.width <= 820
  const menuHeight = isMobile ? Math.min(240, Math.round(vp.height * 0.42)) : 340
  const minTop = Math.round(vp.top + 12)
  if (rect.bottom + menuHeight + 12 <= vp.bottom) {
    return Math.max(minTop, Math.round(rect.bottom + 8))
  }
  if (rect.top - vp.top > menuHeight + 16) {
    return Math.max(minTop, Math.round(rect.top - menuHeight - 6))
  }
  return isMobile
    ? Math.max(minTop, Math.min(Math.round(rect.bottom + 6), Math.max(minTop, Math.round(vp.bottom - 140))))
    : Math.min(Math.round(rect.bottom + 8), Math.max(minTop, Math.round(vp.bottom - 380)))
}

const clampSlashMenuLeft = (rawLeft: number): number => {
  const vp = readViewportMetrics()
  return Math.max(Math.round(vp.left + 12), Math.min(Math.round(rawLeft), Math.round(vp.right - 292)))
}

const resolveSlashMenuPosition = (
  slashFrom: number,
  resolveSlashCoords?: (pos: number) => SlashAnchorRect | null
): { top: number; left: number } => {
  const viewRect = resolveSlashCoords?.(slashFrom) ?? null
  if (viewRect && viewRect.bottom > 0 && typeof window !== "undefined") {
    return { top: computeSlashMenuTop(viewRect), left: clampSlashMenuLeft(viewRect.left) }
  }
  const selectionObj = typeof window !== "undefined" ? window.getSelection() : null
  if (selectionObj && selectionObj.rangeCount > 0) {
    const rect = selectionObj.getRangeAt(0).getBoundingClientRect()
    if (rect.bottom > 0) {
      return { top: computeSlashMenuTop(rect), left: clampSlashMenuLeft(rect.left) }
    }
  }
  return { top: 240, left: 340 }
}

export const useMarkdownEditorSlashMenu = ({
  selectionRef,
  applyMutationPlan,
  disableMermaid = false,
  disableImageUpload = false,
  disableFileUpload = false,
  onRequestImageUpload,
  onRequestFileUpload,
  resolveSlashCoords,
}: {
  selectionRef: MutableRefObject<SlashSelection>
  applyMutationPlan: (plan: PlannedTextMutation) => boolean
  disableMermaid?: boolean
  disableImageUpload?: boolean
  disableFileUpload?: boolean
  onRequestImageUpload?: () => void
  onRequestFileUpload?: () => void
  resolveSlashCoords?: (pos: number) => SlashAnchorRect | null
}) => {
  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean
    position: { top: number; left: number } | null
    query: string
    slashFrom: number
  }>({
    isOpen: false,
    position: null,
    query: "",
    slashFrom: 0,
  })
  const slashMenuOpenRef = useRef(slashMenuState.isOpen)
  slashMenuOpenRef.current = slashMenuState.isOpen

  const closeSlashMenu = useCallback(() => {
    setSlashMenuState({ isOpen: false, position: null, query: "", slashFrom: 0 })
  }, [])

  const handleSelectSlashItem = useCallback(
    (spec: { id: string; snippet: string }) => {
      const selection = selectionRef.current
      const start = slashMenuState.slashFrom
      const end = selection.to
      applyMutationPlan(resolveSlashCommandMutation(spec, start, end))
      closeSlashMenu()
      if (spec.snippet === "__IMAGE_UPLOAD__") {
        onRequestImageUpload?.()
      } else if (spec.snippet === "__FILE_UPLOAD__") {
        onRequestFileUpload?.()
      }
    },
    [
      applyMutationPlan,
      closeSlashMenu,
      onRequestFileUpload,
      onRequestImageUpload,
      selectionRef,
      slashMenuState.slashFrom,
    ]
  )

  const slashMenuItems: SlashMenuItem[] = useMemo(() => {
    const specs = filterSlashCommandSpecs(slashMenuState.query, disableMermaid, {
      disableImageUpload,
      disableFileUpload,
    })
    return specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      icon: spec.icon,
      group: spec.group,
      action: () => handleSelectSlashItem(spec),
    }))
  }, [
    disableFileUpload,
    disableImageUpload,
    disableMermaid,
    handleSelectSlashItem,
    slashMenuState.query,
  ])

  const checkSlashCommand = useCallback(
    (markdown: string, selection: SlashSelection) => {
      const trigger = matchSlashCommandTrigger(markdown, selection)
      if (!trigger) {
        setSlashMenuState((prev) =>
          prev.isOpen ? { ...prev, isOpen: false, position: null, query: "" } : prev
        )
        return
      }

      const coords = resolveSlashMenuPosition(trigger.slashFrom, resolveSlashCoords)
      setSlashMenuState((prev) => {
        if (
          prev.isOpen &&
          prev.position &&
          prev.slashFrom === trigger.slashFrom &&
          prev.query === trigger.query
        ) {
          return prev
        }
        return {
          isOpen: true,
          position:
            prev.isOpen && prev.position && prev.slashFrom === trigger.slashFrom
              ? prev.position
              : coords,
          query: trigger.query,
          slashFrom: trigger.slashFrom,
        }
      })
    },
    [resolveSlashCoords]
  )

  return {
    slashMenuState,
    slashMenuOpenRef,
    slashMenuItems,
    checkSlashCommand,
    closeSlashMenu,
  }
}
