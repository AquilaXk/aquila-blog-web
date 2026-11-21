// 참조 구현: silverbulletmd/silverbullet (MIT), TryGhost/Ghost (MIT)
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
    return mask & ~EDITOR_SURFACE_INSPECTOR_OPEN
  }
  return mask
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
  const count = items.length
  if (count === 0) return -1
  if (cursorOffset == null || cursorOffset < 0) return 0

  let firstHeading = 0
  while (firstHeading < count && !items[firstHeading]?.range) {
    firstHeading += 1
  }
  if (firstHeading >= count || cursorOffset < items[firstHeading]!.range!.start) {
    return 0
  }

  let low = firstHeading
  let high = count - 1
  let matched = firstHeading
  while (low <= high) {
    const mid = (low + high) >>> 1
    const range = items[mid]?.range
    if (range && range.start <= cursorOffset) {
      matched = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return matched
}

let cachedLineStarts: { markdown: string; starts: Int32Array } | null = null

const getLineStartOffsets = (markdown: string): Int32Array => {
  if (cachedLineStarts && cachedLineStarts.markdown === markdown) {
    return cachedLineStarts.starts
  }
  const len = markdown.length
  let capacity = Math.max(32, (len >>> 5) + 8)
  let buf = new Int32Array(capacity)
  let count = 1
  buf[0] = 0
  let searchPos = 0
  while (searchPos < len) {
    const nextBreak = markdown.indexOf("\n", searchPos)
    if (nextBreak === -1) break
    if (count === capacity) {
      capacity <<= 1
      const grown = new Int32Array(capacity)
      grown.set(buf)
      buf = grown
    }
    buf[count] = nextBreak + 1
    count += 1
    searchPos = nextBreak + 1
  }
  const starts = count === buf.length ? buf : buf.subarray(0, count)
  cachedLineStarts = { markdown, starts }
  return starts
}

export const computeCursorLineAndColumn = (
  markdown: string,
  cursorOffset?: number | null
): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(cursorOffset ?? 0, markdown.length))
  const starts = getLineStartOffsets(markdown)
  let low = 0
  let high = starts.length - 1
  let lineIndex = 0
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (starts[mid]! <= clamped) {
      lineIndex = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return { line: lineIndex + 1, column: clamped - starts[lineIndex]! + 1 }
}

const isFenceLineStart = (markdown: string, pos: number): boolean => {
  let cursor = pos
  let spaces = 0
  while (cursor > 0) {
    const prev = markdown.charCodeAt(cursor - 1)
    if (prev === 10 || prev === 13) return true
    if (prev !== 32 || spaces >= 3) return false
    spaces += 1
    cursor -= 1
  }
  return true
}

const skipFencedBlockFromOpener = (
  markdown: string,
  pos: number,
  len: number,
  marker: number,
  run: number
): number => {
  const lineBreak = markdown.indexOf("\n", pos + run)
  const lineEnd = lineBreak === -1 ? len : lineBreak
  if (marker === 96) {
    const firstBacktickInInfo = markdown.indexOf("`", pos + run)
    if (firstBacktickInInfo !== -1 && firstBacktickInInfo < lineEnd) {
      return -1
    }
  }
  if (lineBreak === -1) return len

  const closeToken = marker === 96 ? "```" : "~~~"
  let search = lineBreak + 1
  while (search < len) {
    const hit = markdown.indexOf(closeToken, search)
    if (hit === -1) return len
    let closeRun = 3
    while (hit + closeRun < len && markdown.charCodeAt(hit + closeRun) === marker) {
      closeRun += 1
    }
    if (closeRun >= run && isFenceLineStart(markdown, hit)) {
      const closeBreak = markdown.indexOf("\n", hit + closeRun)
      const closeLineEnd = closeBreak === -1 ? len : closeBreak
      let trailingOnlyWhitespace = true
      for (let k = hit + closeRun; k < closeLineEnd; k += 1) {
        const c = markdown.charCodeAt(k)
        if (c !== 32 && c !== 9 && c !== 13) {
          trailingOnlyWhitespace = false
          break
        }
      }
      if (trailingOnlyWhitespace) {
        return closeBreak === -1 ? len : closeBreak + 1
      }
    }
    search = hit + closeRun
  }
  return len
}

const hasBlankLineBefore = (markdown: string, from: number, limit: number): boolean => {
  let search = from
  while (search < limit) {
    const nl = markdown.indexOf("\n", search)
    if (nl === -1 || nl >= limit) return false
    const next = nl + 1 < limit && markdown.charCodeAt(nl + 1) === 13 ? nl + 2 : nl + 1
    if (next < limit && markdown.charCodeAt(next) === 10) return true
    search = nl + 1
  }
  return false
}

const scanInlineBacktickClose = (
  markdown: string,
  openPos: number,
  len: number,
  runLen: number
): number => {
  let cursor = openPos + runLen
  let checkedBlankFrom = cursor
  while (cursor < len) {
    const hit = markdown.indexOf("`", cursor)
    if (hit === -1) return -1
    if (hasBlankLineBefore(markdown, checkedBlankFrom, hit)) return -1
    checkedBlankFrom = hit
    let closeRun = 1
    while (hit + closeRun < len && markdown.charCodeAt(hit + closeRun) === 96) {
      closeRun += 1
    }
    if (closeRun === runLen) return hit + closeRun
    cursor = hit + closeRun
  }
  return -1
}

let cachedLinkAnalysis: { markdown: string; result: { totalLinks: number; linkWarnings: number } } | null = null

export const analyzeMarkdownLinks = (
  markdown: string
): { totalLinks: number; linkWarnings: number } => {
  if (cachedLinkAnalysis?.markdown === markdown) return cachedLinkAnalysis.result
  if (!markdown.includes("](") && !markdown.includes("[[")) {
    const emptyResult = { totalLinks: 0, linkWarnings: 0 }
    cachedLinkAnalysis = { markdown, result: emptyResult }
    return emptyResult
  }

  const len = markdown.length
  const hasBacktick = markdown.includes("`")
  const hasTildeFence = markdown.includes("~~~")
  let totalLinks = 0
  let linkWarnings = 0
  let pos = 0
  let nextBracket = markdown.indexOf("[", 0)
  if (nextBracket === -1) nextBracket = len
  let nextBacktick = hasBacktick ? markdown.indexOf("`", 0) : len
  if (nextBacktick === -1) nextBacktick = len
  let nextTilde = hasTildeFence ? markdown.indexOf("~~~", 0) : len
  if (nextTilde === -1) nextTilde = len

  while (pos < len) {
    if (nextBracket < pos) {
      nextBracket = markdown.indexOf("[", pos)
      if (nextBracket === -1) nextBracket = len
    }
    if (nextBacktick < pos) {
      nextBacktick = markdown.indexOf("`", pos)
      if (nextBacktick === -1) nextBacktick = len
    }
    if (nextTilde < pos) {
      nextTilde = markdown.indexOf("~~~", pos)
      if (nextTilde === -1) nextTilde = len
    }

    let target = nextBracket < nextBacktick ? nextBracket : nextBacktick
    if (nextTilde < target) target = nextTilde
    if (target >= len) break

    let bs = target
    while (bs > 0 && markdown.charCodeAt(bs - 1) === 92) bs -= 1
    if (((target - bs) & 1) === 1) {
      pos = target + 1
      continue
    }

    if (target === nextBacktick) {
      let run = 1
      while (target + run < len && markdown.charCodeAt(target + run) === 96) run += 1
      if (run >= 3 && isFenceLineStart(markdown, target)) {
        const afterFence = skipFencedBlockFromOpener(markdown, target, len, 96, run)
        if (afterFence !== -1) {
          pos = afterFence
          continue
        }
      }
      const closeEnd = scanInlineBacktickClose(markdown, target, len, run)
      pos = closeEnd !== -1 ? closeEnd : target + run
      continue
    }

    if (target === nextTilde) {
      let run = 3
      while (target + run < len && markdown.charCodeAt(target + run) === 126) run += 1
      if (isFenceLineStart(markdown, target)) {
        pos = skipFencedBlockFromOpener(markdown, target, len, 126, run)
        continue
      }
      pos = target + run
      continue
    }

    if (target + 1 < len && markdown.charCodeAt(target + 1) === 91) {
      let j = target + 2
      let validWiki = false
      while (j < len) {
        const c = markdown.charCodeAt(j)
        if (c === 10 || c === 13 || c === 91) break
        if (c === 93) {
          if (j + 1 < len && markdown.charCodeAt(j + 1) === 93 && j > target + 2) {
            validWiki = true
          }
          break
        }
        j += 1
      }
      if (validWiki) {
        totalLinks += 1
        pos = j + 2
        continue
      }
    }

    let closeBracket = target + 1
    while (closeBracket < len) {
      const c = markdown.charCodeAt(closeBracket)
      if (c === 93 || c === 91 || c === 10 || c === 13) break
      closeBracket += 1
    }
    if (
      closeBracket < len &&
      markdown.charCodeAt(closeBracket) === 93 &&
      closeBracket + 1 < len &&
      markdown.charCodeAt(closeBracket + 1) === 40
    ) {
      let destPos = closeBracket + 2
      while (destPos < len) {
        const c = markdown.charCodeAt(destPos)
        if (c === 40 || c === 41 || c === 32 || c === 9 || c === 10 || c === 13) break
        destPos += 1
      }
      const closed = destPos < len && markdown.charCodeAt(destPos) === 41
      if (closed) totalLinks += 1
      const destLen = destPos - (closeBracket + 2)
      if (
        destLen === 0 ||
        (destLen === 7 && markdown.startsWith("http://", closeBracket + 2)) ||
        (destLen === 8 && markdown.startsWith("https://", closeBracket + 2))
      ) {
        linkWarnings += 1
      }
      pos = closed ? destPos + 1 : destPos
      continue
    }

    pos = target + 1
  }

  const result = { totalLinks, linkWarnings }
  cachedLinkAnalysis = { markdown, result }
  return result
}

export const countMarkdownTotalLinks = (markdown: string): number =>
  analyzeMarkdownLinks(markdown).totalLinks

export const countMarkdownLinkWarnings = (markdown: string) =>
  analyzeMarkdownLinks(markdown).linkWarnings
