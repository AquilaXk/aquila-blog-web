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

export const resolveSlashCommandMutation = (
  spec: { id: string; snippet: string },
  slashStart: number,
  selectionEnd: number
): PlannedTextMutation => {
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
}: {
  selectionRef: MutableRefObject<SlashSelection>
  applyMutationPlan: (plan: PlannedTextMutation) => boolean
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
    },
    [applyMutationPlan, closeSlashMenu, selectionRef, slashMenuState.slashFrom]
  )

  const slashMenuItems: SlashMenuItem[] = useMemo(() => {
    const q = slashMenuState.query.trim().toLowerCase()
    const specs = !q
      ? SLASH_COMMAND_SPECS
      : SLASH_COMMAND_SPECS.filter(
          (spec) =>
            spec.label.toLowerCase().includes(q) ||
            spec.description.toLowerCase().includes(q) ||
            spec.id.toLowerCase().includes(q)
        )

    return specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      icon: spec.icon,
      action: () => handleSelectSlashItem(spec),
    }))
  }, [handleSelectSlashItem, slashMenuState.query])

  const checkSlashCommand = useCallback((markdown: string, selection: SlashSelection) => {
    const trigger = matchSlashCommandTrigger(markdown, selection)
    if (!trigger) {
      setSlashMenuState((prev) =>
        prev.isOpen ? { ...prev, isOpen: false, position: null, query: "" } : prev
      )
      return
    }

    const selectionObj = typeof window !== "undefined" ? window.getSelection() : null
    let coords = { top: 240, left: 340 }
    if (selectionObj && selectionObj.rangeCount > 0) {
      const range = selectionObj.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.bottom > 0) {
        coords = {
          top: Math.min(rect.bottom + 8, window.innerHeight - 380),
          left: Math.min(rect.left, window.innerWidth - 300),
        }
      }
    }

    setSlashMenuState((prev) => ({
      isOpen: true,
      position: prev.isOpen && prev.position ? prev.position : coords,
      query: trigger.query,
      slashFrom: trigger.slashFrom,
    }))
  }, [])

  return {
    slashMenuState,
    slashMenuOpenRef,
    slashMenuItems,
    checkSlashCommand,
    closeSlashMenu,
  }
}
