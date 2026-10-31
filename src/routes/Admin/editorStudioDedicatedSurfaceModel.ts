import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { splitCategoryDisplay } from "src/libs/utils"
import { dedupeStrings } from "./editorStudioMetaModel"

export const EDITOR_SURFACE_GUIDE_OPEN = 1
export const EDITOR_SURFACE_OUTLINE_OPEN = 1 << 1
export const EDITOR_SURFACE_INSPECTOR_OPEN = 1 << 2
export const EDITOR_SURFACE_MOBILE_PROPS_OPEN = 1 << 3
export const EDITOR_SURFACE_ZEN_BITS = EDITOR_SURFACE_OUTLINE_OPEN | EDITOR_SURFACE_INSPECTOR_OPEN

export const applyBitFlag = (
  mask: number,
  bit: number,
  next: boolean | ((prev: boolean) => boolean)
) => {
  const enabled = typeof next === "function" ? next((mask & bit) !== 0) : next
  return enabled ? mask | bit : mask & ~bit
}

export const isMobileEditorViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= 820

export const toggleZenBits = (mask: number) =>
  (mask & EDITOR_SURFACE_ZEN_BITS) === 0
    ? mask | EDITOR_SURFACE_ZEN_BITS
    : mask & ~EDITOR_SURFACE_ZEN_BITS

export const toggleResponsiveSidebarBits = (mask: number, targetBit: number) => {
  if (!isMobileEditorViewport()) return applyBitFlag(mask, targetBit, (prev) => !prev)
  const nextOpen = (mask & targetBit) === 0
  const cleared = mask & ~EDITOR_SURFACE_ZEN_BITS
  return nextOpen ? cleared | targetBit : cleared
}

export const resolveViewportPanelUiMask = (
  mask: number,
  options: { isMobileViewport: boolean; isTabletViewport: boolean }
): number => {
  if (options.isMobileViewport) {
    return mask & ~EDITOR_SURFACE_ZEN_BITS
  }
  if (options.isTabletViewport) {
    return (mask | EDITOR_SURFACE_OUTLINE_OPEN) & ~EDITOR_SURFACE_INSPECTOR_OPEN
  }
  return mask | EDITOR_SURFACE_ZEN_BITS
}

const STORED_CATEGORY_PREFIX_PATTERN = /^[a-z0-9-]+::(.*)$/i

export const formatCategoryDraftInputValue = (category: string): string => {
  if (!category) return ""
  const trimmed = category.trim()
  if (category === "📂 All" || trimmed.toLowerCase() === "all::all") {
    return "All"
  }
  const storedMatch = STORED_CATEGORY_PREFIX_PATTERN.exec(category)
  if (storedMatch) {
    return storedMatch[1] ?? ""
  }
  return category
}

export const toCategorySuggestionLabels = (categories: ReadonlyArray<string>): string[] =>
  dedupeStrings(
    categories
      .map((category) => category.trim())
      .filter((category) => category.length > 0)
      .map((category) => splitCategoryDisplay(category))
      .filter((parsed) => !parsed.isDefault && parsed.label.length > 0)
      .map((parsed) => parsed.label)
  )

export const buildEditorOutlineItems = (
  postTitle: string,
  headings: ReadonlyArray<{
    slug: string
    offset: number
    level: 1 | 2 | 3 | 4
    label: string
    range: { start: number; end: number }
  }>
) => {
  const title = postTitle.trim()
  return [
    ...(title ? [{ id: "title", level: 1 as const, label: title, range: null }] : []),
    ...headings.map((heading) => ({
      id: `${heading.slug}:${heading.offset}`,
      level: heading.level,
      label: heading.label,
      range: heading.range,
    })),
  ]
}

export const computeSelectedCharCount = (range?: { from: number; to: number } | null) =>
  range ? Math.max(0, range.to - range.from) : 0

export const applyCommaSeparatedTagDraft = (
  nextValue: string,
  onTagDraftChange: (value: string) => void,
  onAddTags: (values: string[]) => void
) => {
  const commaSeparated = /[,，]/
  if (!commaSeparated.test(nextValue)) {
    onTagDraftChange(nextValue)
    return
  }
  const fragments = nextValue.split(commaSeparated)
  const tailDraft = fragments.pop() ?? ""
  const tagsToAdd = fragments.map((fragment) => fragment.trim()).filter(Boolean)
  if (tagsToAdd.length > 0) onAddTags(tagsToAdd)
  onTagDraftChange(tailDraft)
}

export const isComposingKeyboardEvent = (event: ReactKeyboardEvent<HTMLElement>) => {
  const nativeEvent = event.nativeEvent as globalThis.KeyboardEvent & {
    isComposing?: boolean
    keyCode?: number
  }
  return nativeEvent.isComposing === true || nativeEvent.keyCode === 229
}

export const handleTagInputKeyDown = (
  event: ReactKeyboardEvent<HTMLInputElement>,
  onAddTag: (value: string) => void
) => {
  if (isComposingKeyboardEvent(event)) return
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault()
    onAddTag(event.currentTarget.value)
  }
}

export const resolveActiveOutlineItemIndex = (
  items: ReadonlyArray<{ range: { start: number; end: number } | null }>,
  cursorOffset?: number | null
): number => {
  if (items.length === 0) return -1
  if (cursorOffset == null || cursorOffset < 0) return 0
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const range = items[index]?.range
    if (range && cursorOffset >= range.start) {
      return index
    }
  }
  return 0
}

export const computeCursorLineAndColumn = (
  markdown: string,
  cursorOffset?: number | null
): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(cursorOffset ?? 0, markdown.length))
  let line = 1
  let lastNewlineIndex = -1
  let searchPos = 0
  while (searchPos < clamped) {
    const nextBreak = markdown.indexOf("\n", searchPos)
    if (nextBreak === -1 || nextBreak >= clamped) break
    line += 1
    lastNewlineIndex = nextBreak
    searchPos = nextBreak + 1
  }
  return { line, column: clamped - lastNewlineIndex }
}

let cachedLinkAnalysis: { markdown: string; result: { totalLinks: number; linkWarnings: number } } | null = null

export const analyzeMarkdownLinks = (
  markdown: string
): { totalLinks: number; linkWarnings: number } => {
  if (cachedLinkAnalysis?.markdown === markdown) return cachedLinkAnalysis.result
  if (!markdown.includes("](") && !markdown.includes("[[")) {
    return { totalLinks: 0, linkWarnings: 0 }
  }
  let totalLinks = 0
  let linkWarnings = 0
  for (const match of markdown.matchAll(/!?\[[^\][\r\n]*\]\(([^()\s]*)(\))?|(\[\[[^\][\r\n]+\]\])/g)) {
    if (match[3]) {
      totalLinks += 1
      continue
    }
    const href = match[1]?.trim() ?? ""
    if (match[2]) totalLinks += 1
    if (!href || /^https?:\/\/$/.test(href)) linkWarnings += 1
  }
  const result = { totalLinks, linkWarnings }
  cachedLinkAnalysis = { markdown, result }
  return result
}

export const countMarkdownTotalLinks = (markdown: string): number =>
  analyzeMarkdownLinks(markdown).totalLinks

export const countMarkdownLinkWarnings = (markdown: string) =>
  analyzeMarkdownLinks(markdown).linkWarnings
