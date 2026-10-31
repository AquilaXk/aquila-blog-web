import { GFM, parser } from "@lezer/markdown"
import { resolveInlineColorValue } from "../../libs/markdown/inlineColor"
import { findMarkdownHighlightSpans } from "../../libs/markdown/inlineHighlightModel"
import { findDoubleBraceColorSpans } from "../../libs/markdown/inlineTokenScanners"

export type MarkdownEditorSurfaceMode = "live" | "source" | "reading"

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

export type MarkdownLiveSelection = { from: number; to: number }

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
    | "hide-mark" | "heading" | "strong" | "emphasis" | "strikethrough"
    | "inline-code" | "link" | "task" | "quote" | "quote-mark"
    | "list" | "list-marker" | "fenced-code" | "horizontal-rule"
    | "inline-color" | "highlight" | "wikilink"
  level?: number
  color?: string
  target?: string
  alias?: string
  codeLanguage?: string
  flags?: number
}

export type MarkdownLivePreviewDecorationSpec = MarkdownLivePreviewDecoration

const WIKILINK_TOKEN_REGEX = /\[\[([^\]\r\n]+)\]\]/g

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

const decorationForNode = (node: MarkdownSyntaxNode): MarkdownLivePreviewDecoration | null => {
  if (node.name === "ListMark") {
    return { from: node.from, to: node.to, kind: "list-marker" }
  }
  if (node.name === "QuoteMark") {
    return { from: node.from, to: node.to, kind: "quote-mark" }
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

const BLOCK_LITERAL_NODE_NAMES = new Set(["FencedCode", "CodeBlock", "HTMLBlock"])
const LITERAL_NODE_NAMES = new Set([
  "InlineCode", "FencedCode", "CodeBlock", "HTMLBlock", "HTMLTag", "URL", "Autolink",
])

const collectLiteralRanges = (
  rootNode: MarkdownSyntaxNode
): { literalRanges: MarkdownLiveSourceRange[]; blockLiteralRanges: MarkdownLiveSourceRange[] } => {
  const literalRanges: MarkdownLiveSourceRange[] = []
  const blockLiteralRanges: MarkdownLiveSourceRange[] = []
  const walk = (node: MarkdownSyntaxNode) => {
    if (BLOCK_LITERAL_NODE_NAMES.has(node.name)) {
      const range = { from: node.from, to: node.to }
      blockLiteralRanges.push(range)
      literalRanges.push(range)
      return
    }
    if (LITERAL_NODE_NAMES.has(node.name)) {
      literalRanges.push({ from: node.from, to: node.to })
      return
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      walk(child)
    }
  }
  walk(rootNode)
  return { literalRanges, blockLiteralRanges }
}

const isWrappedSpanBlockedByLiterals = (
  span: { from: number; to: number; contentFrom: number; contentTo: number },
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[]
): boolean =>
  hasEnclosingInterval(blockLiteralRanges, span.from, span.to) ||
  hasIntervalOverlap(literalRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(literalRanges, span.contentTo, span.to) ||
  hasIntervalOverlap(wikilinkRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(wikilinkRanges, span.contentTo, span.to)

const collectWikilinkEntries = (
  markdown: string,
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges: MarkdownLiveSourceRange[] = []
  if (!markdown.includes("[[")) return wikilinkRanges
  for (const match of markdown.matchAll(WIKILINK_TOKEN_REGEX)) {
    const from = match.index
    const to = from + match[0].length
    if (hasIntervalOverlap(literalRanges, from, to)) continue

    const raw = match[1]
    const pipeIndex = raw.indexOf("|")
    const target = pipeIndex === -1 ? raw.trim() : raw.slice(0, pipeIndex).replace(/\\$/, "").trim()
    const rawAlias = pipeIndex === -1 ? undefined : raw.slice(pipeIndex + 1).trim()
    const alias = rawAlias || undefined
    if (!target) continue

    const activeRange = { from, to }
    wikilinkRanges.push(activeRange)
    entries.push(createPlanEntry({ from, to, kind: "wikilink", target, alias }, activeRange))
  }
  return wikilinkRanges
}

const collectInlineColorEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): void => {
  const spans = findDoubleBraceColorSpans(markdown, {
    trimTrailingContentWhitespace: false,
    allowEmptyContent: false,
    skipInlineCodeSpans: true,
    singleLine: true,
  })
  for (const span of spans) {
    if (isWrappedSpanBlockedByLiterals(span, blockLiteralRanges, literalRanges, wikilinkRanges)) continue
    const color = resolveInlineColorValue(span.colorToken)
    if (!color) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "inline-color", color }, activeRange),
      createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

const collectHighlightEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): void => {
  for (const span of findMarkdownHighlightSpans(markdown)) {
    if (isWrappedSpanBlockedByLiterals(span, blockLiteralRanges, literalRanges, wikilinkRanges)) {
      continue
    }
    if (!markdown.slice(span.contentFrom, span.contentTo).trim()) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "highlight" }),
      createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

const collectRegexPlanEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[]
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges = collectWikilinkEntries(markdown, literalRanges, entries)
  collectInlineColorEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries)
  collectHighlightEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries)
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
  documentNode: MarkdownSyntaxNode = fallbackMarkdownParser.parse(markdown).topNode
): readonly MarkdownLivePreviewPlanEntry[] => {
  const cached = cachedPreviewEntriesByNode.get(documentNode)
  if (cached && cached.markdown === markdown) {
    return cached.entries
  }

  const entries: MarkdownLivePreviewPlanEntry[] = []
  const { literalRanges, blockLiteralRanges } = collectLiteralRanges(documentNode)
  const wikilinkRanges = collectRegexPlanEntries(markdown, blockLiteralRanges, literalRanges, entries)
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

    const decoration = decorationForNode(node)
    if (decoration) {
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
  composing = false,
  mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] => {
  if (mode === "source" || (composing && mode !== "reading")) return []
  const effectiveSelections = mode === "reading" ? [] : selections
  const decorations: MarkdownLivePreviewDecoration[] = []
  const hasSelections = effectiveSelections.length > 0
  const primaryBit = ENTRY_FLAG_HAS_PRIMARY_HIDE << 5
  const secondaryBit = ENTRY_FLAG_HAS_SECONDARY_HIDE << 5
  for (const entry of entries) {
    if (hasSelections) {
      const primaryRange = entry.hideWhenActiveRange
      if (
        (entry.packedMeta & primaryBit) !== 0 &&
        primaryRange &&
        isTokenActive(primaryRange.from, primaryRange.to, effectiveSelections)
      ) {
        continue
      }
      const secondaryRange = entry.secondaryHideWhenActiveRange
      if (
        (entry.packedMeta & secondaryBit) !== 0 &&
        secondaryRange &&
        isTokenActive(secondaryRange.from, secondaryRange.to, effectiveSelections)
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
  composing = false,
  mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] =>
  mode === "source" || (composing && mode !== "reading")
    ? []
    : resolveMarkdownLivePreviewPlanFromEntries(
        buildMarkdownLivePreviewEntries(markdown, documentNode),
        selections,
        composing,
        mode
      )

export const buildMarkdownLivePreviewDecorationSpecs = (
  markdown: string,
  selections: readonly MarkdownLiveSelection[],
  composing = false,
  mode: MarkdownEditorSurfaceMode = "live"
): MarkdownLivePreviewDecoration[] =>
  mode === "source" || (composing && mode !== "reading")
    ? []
    : resolveMarkdownLivePreviewPlanFromEntries(
        buildMarkdownLivePreviewEntries(markdown),
        selections,
        composing,
        mode
      )

export { computeMarkdownFoldRange } from "./markdownEditorFoldModel"
