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

const SLASH_TRIGGER_PATTERN = /(?:^|\s)\/([^\s/]*)$/

export const matchSlashCommandTrigger = (
  markdown: string,
  selection: SlashSelection
): { query: string; slashFrom: number } | null => {
  const pos = selection.from
  if (pos === 0 || selection.from !== selection.to) return null
  const lineStart = markdown.lastIndexOf("\n", pos - 1) + 1
  const lineText = markdown.slice(lineStart, pos)
  const match = SLASH_TRIGGER_PATTERN.exec(lineText)
  if (!match) return null
  if (isOffsetInsideFencedCodeBlock(markdown, pos)) return null
  const query = match[1] ?? ""
  return {
    query,
    slashFrom: pos - query.length - 1,
  }
}

export const filterSlashCommandSpecs = (
  query: string,
  disableMermaid = false,
  options?: { disableImageUpload?: boolean; disableFileUpload?: boolean }
) => {
  const q = query.trim().toLowerCase()
  const availableSpecs = SLASH_COMMAND_SPECS.filter((spec) => {
    if (disableMermaid && spec.id === "mermaid") return false
    if (options?.disableImageUpload && spec.id === "image") return false
    if (options?.disableFileUpload && spec.id === "attachment") return false
    return true
  })
  if (!q) return availableSpecs
  return availableSpecs.filter(
    (spec) =>
      spec.label.toLowerCase().includes(q) ||
      spec.description.toLowerCase().includes(q) ||
      spec.id.toLowerCase().includes(q) ||
      spec.keywords.some((kw) => kw.toLowerCase().includes(q))
  )
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
  resolveSlashCoords?: (pos: number) => { top: number; bottom: number; left: number; right: number } | null
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

      let coords = { top: 240, left: 340 }
      const viewRect = resolveSlashCoords?.(trigger.slashFrom) ?? null
      if (viewRect && viewRect.bottom > 0 && typeof window !== "undefined") {
        coords = {
          top: Math.min(viewRect.bottom + 8, window.innerHeight - 380),
          left: Math.max(12, Math.min(viewRect.left, window.innerWidth - 300)),
        }
      } else {
        const selectionObj = typeof window !== "undefined" ? window.getSelection() : null
        if (selectionObj && selectionObj.rangeCount > 0) {
          const range = selectionObj.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          if (rect.bottom > 0) {
            coords = {
              top: Math.min(rect.bottom + 8, window.innerHeight - 380),
              left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
            }
          }
        }
      }

      setSlashMenuState((prev) => ({
        isOpen: true,
        position:
          prev.isOpen && prev.position && prev.slashFrom === trigger.slashFrom
            ? prev.position
            : coords,
        query: trigger.query,
        slashFrom: trigger.slashFrom,
      }))
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
