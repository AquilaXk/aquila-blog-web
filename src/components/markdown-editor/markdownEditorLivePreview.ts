import { GFM, parser } from "@lezer/markdown"
import { INLINE_COLOR_TOKEN_REGEX, resolveInlineColorValue } from "../../libs/markdown/inlineColor"

const fallbackMarkdownParser = parser.configure(GFM)

export const ENTRY_FLAG_IN_TASK = 1
export const ENTRY_FLAG_HAS_PRIMARY_HIDE = 2
export const ENTRY_FLAG_HAS_SECONDARY_HIDE = 4
export const ENTRY_KIND_MASK = 0x1f

const KIND_TO_CODE: Record<string, number> = {
  "hide-mark": 0, heading: 1, strong: 2, emphasis: 3, strikethrough: 4,
  "inline-code": 5, link: 6, task: 7, quote: 8, "quote-mark": 9,
  list: 10, "list-marker": 11, "fenced-code": 12, "horizontal-rule": 13,
  "inline-color": 14, highlight: 15, wikilink: 16,
}

export const packLivePreviewEntryMeta = (
  kind: MarkdownLivePreviewDecoration["kind"],
  flags = 0,
  level = 0
): number => ((KIND_TO_CODE[kind] ?? 0) & ENTRY_KIND_MASK) | ((flags & 0xff) << 5) | ((level & 0x7) << 13)

export const unpackLivePreviewEntryMeta = (packed: number) => ({
  kindCode: packed & ENTRY_KIND_MASK,
  flags: (packed >>> 5) & 0xff,
  level: (packed >>> 13) & 0x7,
})

export type MarkdownLiveSelection = {
  from: number
  to: number
}

type MarkdownSyntaxNode = {
  name: string
  from: number
  to: number
  firstChild: MarkdownSyntaxNode | null
  nextSibling: MarkdownSyntaxNode | null
}

export type MarkdownLiveSourceRange = MarkdownLiveSelection

export type MarkdownLivePreviewDecoration = {
  from: number
  to: number
  kind:
    | "hide-mark"
    | "heading"
    | "strong"
    | "emphasis"
    | "strikethrough"
    | "inline-code"
    | "link"
    | "task"
    | "quote"
    | "quote-mark"
    | "list"
    | "list-marker"
    | "fenced-code"
    | "horizontal-rule"
    | "inline-color"
    | "highlight"
    | "wikilink"
  level?: number
  color?: string
  target?: string
  alias?: string
  codeLanguage?: string
  flags?: number
}

export type MarkdownLivePreviewDecorationSpec = MarkdownLivePreviewDecoration

const HIDDEN_MARK_NODES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "LinkMark",
  "CodeMark",
  "CodeInfo",
  "TaskMarker",
])

const WIKILINK_TOKEN_REGEX = /\[\[([^\]\r\n]+)\]\]/g
const HIGHLIGHT_TOKEN_REGEX = /(?<!=)==((?:[^\r\n=]|=(?!=))+?)==(?!=)/g

const clampOffset = (offset: number, length: number) => Math.max(0, Math.min(offset, length))

const normalizeSelection = (selection: MarkdownLiveSelection, length: number): MarkdownLiveSelection => {
  const from = clampOffset(Math.min(selection.from, selection.to), length)
  const to = clampOffset(Math.max(selection.from, selection.to), length)
  return { from, to }
}

const selectionIntersectsNode = (selection: MarkdownLiveSelection, node: MarkdownSyntaxNode) =>
  selection.from === selection.to
    ? selection.from >= node.from && selection.from < node.to
    : selection.from < node.to && selection.to > node.from

const resolveFallbackLineRange = (markdown: string, offset: number): MarkdownLiveSourceRange => {
  const from = markdown.lastIndexOf("\n", Math.max(0, offset - 1)) + 1
  const nextBreak = markdown.indexOf("\n", offset)
  return { from, to: nextBreak === -1 ? markdown.length : nextBreak }
}

const mergeRanges = (ranges: MarkdownLiveSourceRange[]) => {
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to)
  const merged: MarkdownLiveSourceRange[] = []
  for (const range of sorted) {
    const previous = merged.at(-1)
    if (previous && range.from <= previous.to) {
      previous.to = Math.max(previous.to, range.to)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

export const hasIntervalOverlap = (
  sortedRanges: ReadonlyArray<{ from: number; to: number }>,
  from: number,
  to: number
): boolean => {
  const len = sortedRanges.length
  if (len === 0 || from >= to) return false

  let low = 0
  let high = len - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (sortedRanges[mid].from < to) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (candidate === -1) return false
  if (sortedRanges[candidate].to > from) return true

  for (let i = candidate - 1; i >= 0; i -= 1) {
    if (sortedRanges[i].to > from) return true
    if (sortedRanges[i].to <= sortedRanges[candidate].from) break
  }
  return false
}

export const hasEnclosingInterval = (
  sortedRanges: ReadonlyArray<{ from: number; to: number }>,
  from: number,
  to: number
): boolean => {
  let low = 0
  let high = sortedRanges.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (sortedRanges[mid].from <= from) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return candidate !== -1 && sortedRanges[candidate].to >= to
}

export const resolveMarkdownLiveSourceRanges = (
  markdown: string,
  documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[]
): MarkdownLiveSourceRange[] => {
  const sourceRanges: MarkdownLiveSourceRange[] = []

  for (const rawSelection of selections) {
    const selection = normalizeSelection(rawSelection, markdown.length)
    let matchedTopLevel = false
    for (let child = documentNode.firstChild; child; child = child.nextSibling) {
      if (selectionIntersectsNode(selection, child)) {
        sourceRanges.push({ from: child.from, to: child.to })
        matchedTopLevel = true
      }
    }
    if (!matchedTopLevel) {
      sourceRanges.push(resolveFallbackLineRange(markdown, selection.from))
    }
  }

  return mergeRanges(sourceRanges)
}

export const isTokenActive = (
  from: number,
  to: number,
  selections: readonly MarkdownLiveSelection[]
): boolean => {
  for (const sel of selections) {
    if (sel.from === sel.to) {
      if (sel.from >= from && sel.from <= to) return true
    } else if (sel.from < to && sel.to > from) {
      return true
    }
  }
  return false
}

const decorationForNode = (
  markdown: string,
  node: MarkdownSyntaxNode,
  parent: MarkdownSyntaxNode | null
): MarkdownLivePreviewDecoration | null => {
  if (node.name === "ListMark") {
    return { from: node.from, to: node.to, kind: "list-marker" }
  }
  if (node.name === "QuoteMark") {
    return { from: node.from, to: node.to, kind: "quote-mark" }
  }
  if (node.name === "HeaderMark") {
    let to = node.to
    while (to < markdown.length && (markdown[to] === " " || markdown[to] === "\t")) to += 1
    return { from: node.from, to, kind: "hide-mark" }
  }
  if (HIDDEN_MARK_NODES.has(node.name)) {
    return { from: node.from, to: node.to, kind: "hide-mark" }
  }
  if (node.name === "URL" && (parent?.name === "Link" || parent?.name === "Image")) {
    return { from: node.from, to: node.to, kind: "hide-mark" }
  }
  if (/^ATXHeading[1-6]$/.test(node.name)) {
    return { from: node.from, to: node.to, kind: "heading", level: Number(node.name.at(-1)) }
  }

  const kindByNode: Partial<Record<string, MarkdownLivePreviewDecoration["kind"]>> = {
    StrongEmphasis: "strong",
    Emphasis: "emphasis",
    Strikethrough: "strikethrough",
    InlineCode: "inline-code",
    Link: "link",
    Task: "task",
    Blockquote: "quote",
    BulletList: "list",
    OrderedList: "list",
    FencedCode: "fenced-code",
    HorizontalRule: "horizontal-rule",
  }
  const kind = kindByNode[node.name]
  return kind ? { from: node.from, to: node.to, kind } : null
}

export type MarkdownLivePreviewPlanEntry = {
  from: number
  to: number
  kind: MarkdownLivePreviewDecoration["kind"]
  flags?: number
  packedMeta: number
  decoration: MarkdownLivePreviewDecoration
  hideWhenActiveRange?: MarkdownLiveSourceRange
  secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
}

export type MarkdownLivePreviewEntry = MarkdownLivePreviewPlanEntry

const createPlanEntry = (
  decoration: MarkdownLivePreviewDecoration,
  hideWhenActiveRange?: MarkdownLiveSourceRange,
  secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
): MarkdownLivePreviewPlanEntry => {
  const hideFlags =
    (hideWhenActiveRange ? ENTRY_FLAG_HAS_PRIMARY_HIDE : 0) |
    (secondaryHideWhenActiveRange ? ENTRY_FLAG_HAS_SECONDARY_HIDE : 0)
  const flags = (decoration.flags ?? 0) | hideFlags
  return {
    from: decoration.from,
    to: decoration.to,
    kind: decoration.kind,
    flags: decoration.flags,
    packedMeta: packLivePreviewEntryMeta(decoration.kind, flags, decoration.level ?? 0),
    decoration,
    hideWhenActiveRange,
    secondaryHideWhenActiveRange,
  }
}

const cachedPreviewEntriesByNode = new WeakMap<
  MarkdownSyntaxNode,
  { markdown: string; entries: readonly MarkdownLivePreviewPlanEntry[] }
>()

const LITERAL_NODE_NAMES = new Set([
  "InlineCode", "FencedCode", "CodeBlock", "HTMLBlock", "HTMLTag", "URL",
])

const collectLiteralRanges = (rootNode: MarkdownSyntaxNode): MarkdownLiveSourceRange[] => {
  const literalRanges: MarkdownLiveSourceRange[] = []
  const walk = (node: MarkdownSyntaxNode) => {
    if (LITERAL_NODE_NAMES.has(node.name)) {
      literalRanges.push({ from: node.from, to: node.to })
      return
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      walk(child)
    }
  }
  walk(rootNode)
  return literalRanges
}

const collectRegexPlanEntries = (
  markdown: string,
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges: MarkdownLiveSourceRange[] = []
  if (markdown.includes("[[")) {
    for (const match of markdown.matchAll(WIKILINK_TOKEN_REGEX)) {
      const from = match.index
      const to = from + match[0].length
      if (hasIntervalOverlap(literalRanges, from, to)) continue

      const raw = match[1]
      const pipeIndex = raw.indexOf("|")
      const target = pipeIndex === -1 ? raw.trim() : raw.slice(0, pipeIndex).trim()
      const rawAlias = pipeIndex === -1 ? undefined : raw.slice(pipeIndex + 1).trim()
      const alias = rawAlias || undefined
      if (!target) continue

      const activeRange = { from, to }
      wikilinkRanges.push(activeRange)
      entries.push(createPlanEntry({ from, to, kind: "wikilink", target, alias }, activeRange))
    }
  }

  if (markdown.includes("{{color:")) {
    INLINE_COLOR_TOKEN_REGEX.lastIndex = 0
    for (const match of markdown.matchAll(INLINE_COLOR_TOKEN_REGEX)) {
      const from = match.index
      const to = from + match[0].length
      if (hasEnclosingInterval(literalRanges, from, to) || hasEnclosingInterval(wikilinkRanges, from, to)) continue
      const color = resolveInlineColorValue(match[1])
      if (!color) continue
      const bodyFrom = from + match[0].indexOf("|") + 1
      const bodyTo = to - 2
      const activeRange = { from, to }
      entries.push(
        createPlanEntry({ from, to: bodyFrom, kind: "hide-mark" }, activeRange),
        createPlanEntry({ from: bodyFrom, to: bodyTo, kind: "inline-color", color }, activeRange),
        createPlanEntry({ from: bodyTo, to, kind: "hide-mark" }, activeRange)
      )
    }
  }

  if (markdown.includes("==")) {
    for (const match of markdown.matchAll(HIGHLIGHT_TOKEN_REGEX)) {
      const from = match.index
      const to = from + match[0].length
      if (hasIntervalOverlap(literalRanges, from, to) || hasIntervalOverlap(wikilinkRanges, from, to)) continue
      if (!match[1]?.trim()) continue

      const bodyFrom = from + 2
      const bodyTo = to - 2
      const activeRange = { from, to }
      entries.push(
        createPlanEntry({ from: bodyFrom, to: bodyTo, kind: "highlight" }),
        createPlanEntry({ from, to: bodyFrom, kind: "hide-mark" }, activeRange),
        createPlanEntry({ from: bodyTo, to, kind: "hide-mark" }, activeRange)
      )
    }
  }

  return wikilinkRanges
}

const extractFencedCodeLanguage = (markdown: string, node: MarkdownSyntaxNode): string | undefined => {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "CodeInfo") {
      const rawInfo = markdown.slice(child.from, child.to).trim()
      const langToken = rawInfo.split(/\s+/)[0]?.trim()
      return langToken || undefined
    }
  }
  return undefined
}

const tagEntriesInsideTasks = (
  entries: MarkdownLivePreviewPlanEntry[],
  taskRanges: readonly MarkdownLiveSourceRange[]
): void => {
  if (taskRanges.length === 0) return
  let taskIdx = 0
  for (const entry of entries) {
    if (entry.kind !== "hide-mark") continue
    while (taskIdx < taskRanges.length && taskRanges[taskIdx].to < entry.from) {
      taskIdx += 1
    }
    for (let j = taskIdx; j < taskRanges.length; j += 1) {
      const task = taskRanges[j]
      if (task.from > entry.from) break
      if (entry.from >= task.from && entry.to <= task.to) {
        const nextFlags = (entry.flags ?? 0) | ENTRY_FLAG_IN_TASK
        entry.flags = nextFlags
        entry.decoration.flags = nextFlags
        entry.packedMeta |= ENTRY_FLAG_IN_TASK << 5
        break
      }
    }
  }
}

export const buildMarkdownLivePreviewEntries = (
  markdown: string,
  documentNode: MarkdownSyntaxNode = fallbackMarkdownParser.parse(markdown).topNode as unknown as MarkdownSyntaxNode
): readonly MarkdownLivePreviewPlanEntry[] => {
  const cached = cachedPreviewEntriesByNode.get(documentNode)
  if (cached && cached.markdown === markdown) {
    return cached.entries
  }

  const entries: MarkdownLivePreviewPlanEntry[] = []
  const literalRanges = collectLiteralRanges(documentNode)
  const wikilinkRanges = collectRegexPlanEntries(markdown, literalRanges, entries)
  const taskRanges: MarkdownLiveSourceRange[] = []

  const visit = (
    node: MarkdownSyntaxNode,
    parent: MarkdownSyntaxNode | null,
    currentHeading: MarkdownSyntaxNode | null = null
  ) => {
    const isHeading = /^ATXHeading[1-6]$/.test(node.name)
    const activeHeading = isHeading ? node : currentHeading

    if (node === documentNode) {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        visit(child, node, null)
      }
      return
    }

    if (hasEnclosingInterval(wikilinkRanges, node.from, node.to)) return

    if (node.name === "HeaderMark") {
      let to = node.to
      while (to < markdown.length && (markdown[to] === " " || markdown[to] === "\t")) to += 1
      entries.push(
        createPlanEntry(
          { from: node.from, to, kind: "hide-mark" },
          parent ? { from: parent.from, to: parent.to } : undefined
        )
      )
      return
    }

    if (
      node.name === "EmphasisMark" ||
      node.name === "StrikethroughMark" ||
      node.name === "CodeMark" ||
      node.name === "LinkMark"
    ) {
      entries.push(
        createPlanEntry(
          { from: node.from, to: node.to, kind: "hide-mark" },
          parent ? { from: parent.from, to: parent.to } : undefined,
          activeHeading ? { from: activeHeading.from, to: activeHeading.to } : undefined
        )
      )
      return
    }

    if (node.name === "URL" && (parent?.name === "Link" || parent?.name === "Image")) {
      entries.push(
        createPlanEntry(
          { from: node.from, to: node.to, kind: "hide-mark" },
          parent ? { from: parent.from, to: parent.to } : undefined
        )
      )
      return
    }

    if (node.name === "HorizontalRule") {
      entries.push(
        createPlanEntry(
          { from: node.from, to: node.to, kind: "horizontal-rule" },
          { from: node.from, to: node.to }
        )
      )
      return
    }

    if (node.name === "FencedCode") {
      const codeLanguage = extractFencedCodeLanguage(markdown, node)
      entries.push(
        createPlanEntry({
          from: node.from,
          to: node.to,
          kind: "fenced-code",
          ...(codeLanguage ? { codeLanguage } : {}),
        })
      )
      return
    }

    if (node.name === "Task") {
      taskRanges.push({ from: node.from, to: node.to })
    }

    const decoration = decorationForNode(markdown, node, parent)
    if (decoration && decoration.kind !== "hide-mark" && decoration.kind !== "horizontal-rule") {
      entries.push(createPlanEntry(decoration))
    }

    for (let child = node.firstChild; child; child = child.nextSibling) {
      visit(child, node, activeHeading)
    }
  }

  visit(documentNode, null, null)

  entries.sort((a, b) => a.from - b.from || a.to - b.to)
  tagEntriesInsideTasks(entries, taskRanges)

  cachedPreviewEntriesByNode.set(documentNode, { markdown, entries })
  return entries
}

export const resolveMarkdownLivePreviewPlanFromEntries = (
  entries: readonly MarkdownLivePreviewPlanEntry[],
  selections: readonly MarkdownLiveSelection[],
  composing = false
): MarkdownLivePreviewDecoration[] => {
  if (composing) return []
  const decorations: MarkdownLivePreviewDecoration[] = []
  const hasSelections = selections.length > 0
  const primaryBit = ENTRY_FLAG_HAS_PRIMARY_HIDE << 5
  const secondaryBit = ENTRY_FLAG_HAS_SECONDARY_HIDE << 5
  for (const entry of entries) {
    if (hasSelections) {
      if (
        (entry.packedMeta & primaryBit) !== 0 &&
        entry.hideWhenActiveRange &&
        isTokenActive(entry.hideWhenActiveRange.from, entry.hideWhenActiveRange.to, selections)
      ) {
        continue
      }
      if (
        (entry.packedMeta & secondaryBit) !== 0 &&
        entry.secondaryHideWhenActiveRange &&
        isTokenActive(
          entry.secondaryHideWhenActiveRange.from,
          entry.secondaryHideWhenActiveRange.to,
          selections
        )
      ) {
        continue
      }
    }
    decorations.push(entry.decoration)
  }
  return decorations
}

export const buildMarkdownLivePreviewPlan = (
  markdown: string,
  documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[],
  composing = false
): MarkdownLivePreviewDecoration[] => {
  if (composing) return []
  const entries = buildMarkdownLivePreviewEntries(markdown, documentNode)
  return resolveMarkdownLivePreviewPlanFromEntries(entries, selections, composing)
}

export const buildMarkdownLivePreviewDecorationSpecs = (
  markdown: string,
  selections: readonly MarkdownLiveSelection[],
  composing = false
): MarkdownLivePreviewDecoration[] => {
  if (composing) return []
  const entries = buildMarkdownLivePreviewEntries(markdown)
  return resolveMarkdownLivePreviewPlanFromEntries(entries, selections, composing)
}

export const computeMarkdownFoldRange = (
  state: {
    doc: {
      lines: number
      lineAt: (pos: number) => { number: number; from: number; to: number; text: string }
      line: (lineNo: number) => { number: number; from: number; to: number; text: string }
    }
  },
  lineStart: number,
  _lineEnd?: number
): { from: number; to: number } | null => {
  const line = state.doc.lineAt(lineStart)
  const headingMatch = /^\s{0,3}(#{1,6})\s+/.exec(line.text)
  if (headingMatch) {
    const level = headingMatch[1].length
    let endPos = line.to
    for (let lineNo = line.number + 1; lineNo <= state.doc.lines; lineNo += 1) {
      const nextLine = state.doc.line(lineNo)
      const nextHeading = /^\s{0,3}(#{1,6})\s+/.exec(nextLine.text)
      if (nextHeading && nextHeading[1].length <= level) {
        break
      }
      endPos = nextLine.to
    }
    return endPos > line.to ? { from: line.to, to: endPos } : null
  }

  const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line.text)
  if (fenceMatch) {
    const fence = fenceMatch[1]
    const marker = fence[0]
    for (let lineNo = line.number + 1; lineNo <= state.doc.lines; lineNo += 1) {
      const nextLine = state.doc.line(lineNo)
      const closeMatch = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(nextLine.text)
      if (closeMatch && closeMatch[1][0] === marker && closeMatch[1].length >= fence.length) {
        return nextLine.to > line.to ? { from: line.to, to: nextLine.to } : null
      }
    }
  }

  return null
}
