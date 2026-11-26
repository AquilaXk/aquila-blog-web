import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react"
import type { SiteLanguage } from "../../libs/language"
import {
  hasWhitespaceOrSlash,
  isAsciiWhitespace,
  isOffsetInsideCodeOrMathContext,
} from "./markdownEditorSlashContextScanner"
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
  while (cursor < text.length && isAsciiWhitespace(text.charCodeAt(cursor))) cursor += 1
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

export const extractSlashTriggerFromLine = (
  lineText: string
): { query: string; slashIndex: number } | null => {
  // 1. 줄 시작 / 인용(>) / 리스트(-, 1., - [ ]) 접두사 뒤 슬래시
  let cursor = skipInlineSpaces(lineText, 0)
  while (lineText[cursor] === ">") {
    cursor = skipInlineSpaces(lineText, cursor + 1)
  }
  cursor = skipOptionalListPrefix(lineText, cursor)
  if (lineText[cursor] === "/") {
    const query = lineText.slice(cursor + 1)
    if (!hasWhitespaceOrSlash(query)) {
      return { query, slashIndex: cursor }
    }
  }

  // 2. 줄 중간 공백(' ' 또는 '\t') 바로 뒤의 슬래시
  const lastSlashIndex = lineText.lastIndexOf("/")
  if (lastSlashIndex > 0) {
    const prevChar = lineText.charCodeAt(lastSlashIndex - 1)
    if (prevChar === 32 || prevChar === 9) {
      // 거부 패턴 검사: URL, 닫는 태그, 마크다운 링크/이미지
      const beforeSpace = lineText.slice(0, lastSlashIndex - 1).trimEnd()
      if (
        !beforeSpace.endsWith("http:") &&
        !beforeSpace.endsWith("https:") &&
        !beforeSpace.endsWith(":") &&
        !beforeSpace.endsWith("]") &&
        !beforeSpace.endsWith(")")
      ) {
        const query = lineText.slice(lastSlashIndex + 1)
        if (query.length > 0 && !hasWhitespaceOrSlash(query)) {
          return { query, slashIndex: lastSlashIndex }
        }
      }
    }
  }

  return null
}

export const matchSlashCommandTrigger = (
  markdown: string,
  selection: SlashSelection
): { query: string; slashFrom: number } | null => {
  const pos = selection.from
  if (pos === 0 || selection.from !== selection.to) return null
  const lineStart = markdown.lastIndexOf("\n", pos - 1) + 1
  const lineText = markdown.slice(lineStart, pos)
  const trigger = extractSlashTriggerFromLine(lineText)
  if (trigger === null) return null
  // 단일 패스 컨텍스트 판정: 인라인 코드, 수식, 펜스 코드블록 내부 제외
  if (isOffsetInsideCodeOrMathContext(markdown, pos)) return null
  return {
    query: trigger.query,
    slashFrom: lineStart + trigger.slashIndex,
  }
}

export const SLASH_FLAG_MERMAID = 1
export const SLASH_FLAG_IMAGE = 1 << 1
export const SLASH_FLAG_ATTACHMENT = 1 << 2
export const SLASH_FLAG_CLOUD = 1 << 3

export const packSlashDisabledFeaturesMask = (options?: {
  disableMermaid?: boolean
  disableImageUpload?: boolean
  disableFileUpload?: boolean
  disableCloudAsset?: boolean
}): number =>
  (options?.disableMermaid ? SLASH_FLAG_MERMAID : 0) |
  (options?.disableImageUpload ? SLASH_FLAG_IMAGE : 0) |
  (options?.disableFileUpload ? SLASH_FLAG_ATTACHMENT : 0) |
  (options?.disableCloudAsset ? SLASH_FLAG_CLOUD : 0)

const resolveSlashSpecFlagMask = (id: string): number => {
  if (id === "mermaid") return SLASH_FLAG_MERMAID
  if (id === "image") return SLASH_FLAG_IMAGE
  if (id === "attachment") return SLASH_FLAG_ATTACHMENT
  if (id === "cloud") return SLASH_FLAG_CLOUD
  return 0
}

const INDEXED_SLASH_SPECS = SLASH_COMMAND_SPECS.map((spec) => ({
  spec,
  flagMask: resolveSlashSpecFlagMask(spec.id),
  searchHaystack: `${spec.id}\n${spec.label}\n${spec.description}\n${spec.keywords.join("\n")}`.toLowerCase(),
}))

const isSubsequenceMatch = (query: string, target: string): boolean => {
  let qIdx = 0
  for (let i = 0; i < target.length && qIdx < query.length; i += 1) {
    if (target.charCodeAt(i) === query.charCodeAt(qIdx)) {
      qIdx += 1
    }
  }
  return qIdx === query.length
}

export const computeSlashSpecMatchScore = (
  spec: (typeof SLASH_COMMAND_SPECS)[number],
  order: number,
  query: string
): number => {
  if (!query) {
    return (1 << 16) | (255 << 8) | (255 - Math.min(255, order))
  }

  const q = query.toLowerCase()
  const id = spec.id.toLowerCase()
  const label = spec.label.toLowerCase()

  // Tier 4: ID 정확 일치
  if (id === q) {
    return (4 << 16) | (255 << 8) | (255 - Math.min(255, order))
  }

  // Tier 3: ID 접두사 일치
  if (id.startsWith(q)) {
    return (3 << 16) | (255 << 8) | (255 - Math.min(255, order))
  }

  // Tier 2: 라벨 또는 키워드 접두사 일치
  if (label.startsWith(q)) {
    return (2 << 16) | (255 << 8) | (255 - Math.min(255, order))
  }
  for (const kw of spec.keywords) {
    if (kw.toLowerCase().startsWith(q)) {
      return (2 << 16) | (255 << 8) | (255 - Math.min(255, order))
    }
  }

  // Tier 1: 부분 문자열 일치 또는 서브시퀀스 매칭
  const idPos = id.indexOf(q)
  const labelPos = label.indexOf(q)
  let minPos = 255
  if (idPos >= 0) minPos = Math.min(minPos, idPos)
  if (labelPos >= 0) minPos = Math.min(minPos, labelPos)
  for (const kw of spec.keywords) {
    const kwPos = kw.toLowerCase().indexOf(q)
    if (kwPos >= 0) minPos = Math.min(minPos, kwPos)
  }
  const descPos = spec.description.toLowerCase().indexOf(q)
  if (descPos >= 0) minPos = Math.min(minPos, descPos)

  if (minPos < 255) {
    return (1 << 16) | ((255 - Math.min(255, minPos)) << 8) | (255 - Math.min(255, order))
  }

  if (isSubsequenceMatch(q, id) || isSubsequenceMatch(q, label)) {
    return (1 << 16) | (128 << 8) | (255 - Math.min(255, order))
  }

  return 0
}

export const filterSlashCommandSpecs = (
  query: string,
  disableMermaid = false,
  options?: { disableImageUpload?: boolean; disableFileUpload?: boolean; disableCloudAsset?: boolean }
) => {
  const q = query.trim().toLowerCase()
  const disabledMask = packSlashDisabledFeaturesMask({
    disableMermaid,
    disableImageUpload: options?.disableImageUpload,
    disableFileUpload: options?.disableFileUpload,
    disableCloudAsset: options?.disableCloudAsset,
  })

  type ScoredItem = { spec: (typeof SLASH_COMMAND_SPECS)[number]; score: number }
  const scored: ScoredItem[] = []

  for (let order = 0; order < INDEXED_SLASH_SPECS.length; order += 1) {
    const entry = INDEXED_SLASH_SPECS[order]!
    if ((entry.flagMask & disabledMask) !== 0) continue

    const score = computeSlashSpecMatchScore(entry.spec, order, q)
    if (score > 0) {
      scored.push({ spec: entry.spec, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((item) => item.spec)
}

export const resolveSlashCommandMutation = (
  spec: { id: string; snippet: string },
  slashStart: number,
  selectionEnd: number,
  language: SiteLanguage = "ko"
): PlannedTextMutation => {
  if (
    spec.snippet === "__IMAGE_UPLOAD__" ||
    spec.snippet === "__FILE_UPLOAD__" ||
    spec.snippet === "__CLOUD_ASSET__"
  ) {
    return planReplaceSelection(slashStart, selectionEnd, "")
  }
  if (spec.id === "toggle" && language === "en") {
    const snippet = ":::toggle Toggle title\n\n:::"
    const cursor = slashStart + 23
    return {
      rangeStart: slashStart,
      rangeEnd: selectionEnd,
      replacement: snippet,
      selectionStart: cursor,
      selectionEnd: cursor,
    }
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
    wikilink: 2,
    embed: 17,
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
  return Math.max(Math.round(vp.left + 12), Math.min(Math.round(rawLeft), Math.round(vp.right - 332)))
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
  language = "ko",
  disableMermaid = false,
  disableImageUpload = false,
  disableFileUpload = false,
  disableCloudAsset = false,
  onRequestImageUpload,
  onRequestFileUpload,
  onRequestCloudAsset,
  resolveSlashCoords,
}: {
  selectionRef: MutableRefObject<SlashSelection>
  applyMutationPlan: (plan: PlannedTextMutation) => boolean
  language?: SiteLanguage
  disableMermaid?: boolean
  disableImageUpload?: boolean
  disableFileUpload?: boolean
  disableCloudAsset?: boolean
  onRequestImageUpload?: () => void
  onRequestFileUpload?: () => void
  onRequestCloudAsset?: () => void
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
      applyMutationPlan(resolveSlashCommandMutation(spec, start, end, language))
      closeSlashMenu()
      if (spec.snippet === "__IMAGE_UPLOAD__") {
        onRequestImageUpload?.()
      } else if (spec.snippet === "__FILE_UPLOAD__") {
        onRequestFileUpload?.()
      } else if (spec.snippet === "__CLOUD_ASSET__") {
        onRequestCloudAsset?.()
      }
    },
    [
      applyMutationPlan,
      closeSlashMenu,
      language,
      onRequestCloudAsset,
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
      disableCloudAsset,
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
    disableCloudAsset,
    disableFileUpload,
    disableImageUpload,
    disableMermaid,
    handleSelectSlashItem,
    slashMenuState.query,
  ])

  const checkSlashCommand = useCallback(
    (markdown: string, selection: SlashSelection, options?: { isComposing?: boolean }) => {
      if (options?.isComposing) return
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
