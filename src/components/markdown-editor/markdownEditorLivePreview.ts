import { INLINE_COLOR_TOKEN_REGEX, resolveInlineColorValue } from "../../libs/markdown/inlineColor"

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
}

const HIDDEN_MARK_NODES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "LinkMark",
  "CodeMark",
  "CodeInfo",
  "TaskMarker",
])

const clampOffset = (offset: number, length: number) => Math.max(0, Math.min(offset, length))

const normalizeSelection = (selection: MarkdownLiveSelection, length: number): MarkdownLiveSelection => {
  const from = clampOffset(Math.min(selection.from, selection.to), length)
  const to = clampOffset(Math.max(selection.from, selection.to), length)
  return { from, to }
}

const listChildren = (node: MarkdownSyntaxNode): MarkdownSyntaxNode[] => {
  const children: MarkdownSyntaxNode[] = []
  let child = node.firstChild
  while (child) {
    children.push(child)
    child = child.nextSibling
  }
  return children
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

export const resolveMarkdownLiveSourceRanges = (
  markdown: string,
  documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[]
): MarkdownLiveSourceRange[] => {
  const topLevelNodes = listChildren(documentNode)
  const sourceRanges: MarkdownLiveSourceRange[] = []

  for (const rawSelection of selections) {
    const selection = normalizeSelection(rawSelection, markdown.length)
    const intersectingNodes = topLevelNodes.filter((node) => selectionIntersectsNode(selection, node))
    if (intersectingNodes.length > 0) {
      sourceRanges.push(...intersectingNodes.map(({ from, to }) => ({ from, to })))
      continue
    }
    sourceRanges.push(resolveFallbackLineRange(markdown, selection.from))
  }

  return mergeRanges(sourceRanges)
}

export const isTokenActive = (
  from: number,
  to: number,
  selections: readonly MarkdownLiveSelection[]
): boolean => {
  return selections.some((sel) => {
    if (sel.from === sel.to) {
      return sel.from >= from && sel.from <= to
    }
    return sel.from < to && sel.to > from
  })
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
  decoration: MarkdownLivePreviewDecoration
  hideWhenActiveRange?: MarkdownLiveSourceRange
  secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
}

const cachedPreviewEntriesByNode = new WeakMap<
  MarkdownSyntaxNode,
  { markdown: string; entries: readonly MarkdownLivePreviewPlanEntry[] }
>()

export const buildMarkdownLivePreviewEntries = (
  markdown: string,
  documentNode: MarkdownSyntaxNode
): readonly MarkdownLivePreviewPlanEntry[] => {
  const cached = cachedPreviewEntriesByNode.get(documentNode)
  if (cached && cached.markdown === markdown) {
    return cached.entries
  }

  const entries: MarkdownLivePreviewPlanEntry[] = []
  const literalRanges: MarkdownLiveSourceRange[] = []

  const collectLiterals = (node: MarkdownSyntaxNode) => {
    if (["InlineCode", "FencedCode", "CodeBlock", "HTMLBlock", "HTMLTag", "URL"].includes(node.name)) {
      literalRanges.push({ from: node.from, to: node.to })
      return
    }
    for (const child of listChildren(node)) collectLiterals(child)
  }
  collectLiterals(documentNode)

  const wikilinkRanges: MarkdownLiveSourceRange[] = []
  for (const match of markdown.matchAll(/\[\[([^\]\r\n]+)\]\]/g)) {
    const from = match.index
    const to = from + match[0].length
    if (literalRanges.some((range) => from < range.to && to > range.from)) continue

    const raw = match[1]
    const pipeIndex = raw.indexOf("|")
    const target = pipeIndex === -1 ? raw.trim() : raw.slice(0, pipeIndex).trim()
    const rawAlias = pipeIndex === -1 ? undefined : raw.slice(pipeIndex + 1).trim()
    const alias = rawAlias ? rawAlias : undefined
    if (!target) continue

    const activeRange = { from, to }
    wikilinkRanges.push(activeRange)
    entries.push({
      decoration: { from, to, kind: "wikilink", target, alias },
      hideWhenActiveRange: activeRange,
    })
  }

  for (const match of markdown.matchAll(new RegExp(INLINE_COLOR_TOKEN_REGEX))) {
    const from = match.index
    const to = from + match[0].length
    if (literalRanges.some((range) => from >= range.from && to <= range.to)) continue
    if (wikilinkRanges.some((range) => from >= range.from && to <= range.to)) continue
    const color = resolveInlineColorValue(match[1])
    if (!color) continue
    const bodyFrom = from + match[0].indexOf("|") + 1
    const bodyTo = to - 2
    const activeRange = { from, to }
    entries.push(
      { decoration: { from, to: bodyFrom, kind: "hide-mark" }, hideWhenActiveRange: activeRange },
      { decoration: { from: bodyFrom, to: bodyTo, kind: "inline-color", color }, hideWhenActiveRange: activeRange },
      { decoration: { from: bodyTo, to, kind: "hide-mark" }, hideWhenActiveRange: activeRange }
    )
  }

  for (const match of markdown.matchAll(/(?<!=)==((?:[^\r\n=]|=(?!=))+?)==(?!=)/g)) {
    const from = match.index
    const to = from + match[0].length
    if (literalRanges.some((range) => from < range.to && to > range.from)) continue
    if (wikilinkRanges.some((range) => from < range.to && to > range.from)) continue
    if (!match[1] || match[1].trim().length === 0) continue

    const bodyFrom = from + 2
    const bodyTo = to - 2
    const activeRange = { from, to }
    entries.push(
      { decoration: { from: bodyFrom, to: bodyTo, kind: "highlight" } },
      { decoration: { from, to: bodyFrom, kind: "hide-mark" }, hideWhenActiveRange: activeRange },
      { decoration: { from: bodyTo, to, kind: "hide-mark" }, hideWhenActiveRange: activeRange }
    )
  }

  const visit = (
    node: MarkdownSyntaxNode,
    parent: MarkdownSyntaxNode | null,
    currentHeading: MarkdownSyntaxNode | null = null
  ) => {
    const isHeading = /^ATXHeading[1-6]$/.test(node.name)
    const activeHeading = isHeading ? node : currentHeading

    if (node === documentNode) {
      for (const child of listChildren(node)) visit(child, node, null)
      return
    }

    if (wikilinkRanges.some((w) => node.from >= w.from && node.to <= w.to)) {
      return
    }

    if (node.name === "HeaderMark") {
      const headingNode = parent
      let to = node.to
      while (to < markdown.length && (markdown[to] === " " || markdown[to] === "\t")) to += 1
      entries.push({
        decoration: { from: node.from, to, kind: "hide-mark" },
        hideWhenActiveRange: headingNode ? { from: headingNode.from, to: headingNode.to } : undefined,
      })
      return
    }

    if (
      node.name === "EmphasisMark" ||
      node.name === "StrikethroughMark" ||
      node.name === "CodeMark" ||
      node.name === "LinkMark"
    ) {
      entries.push({
        decoration: { from: node.from, to: node.to, kind: "hide-mark" },
        hideWhenActiveRange: parent ? { from: parent.from, to: parent.to } : undefined,
        secondaryHideWhenActiveRange: activeHeading
          ? { from: activeHeading.from, to: activeHeading.to }
          : undefined,
      })
      return
    }

    if (node.name === "URL" && (parent?.name === "Link" || parent?.name === "Image")) {
      entries.push({
        decoration: { from: node.from, to: node.to, kind: "hide-mark" },
        hideWhenActiveRange: parent ? { from: parent.from, to: parent.to } : undefined,
      })
      return
    }

    if (node.name === "HorizontalRule") {
      entries.push({
        decoration: { from: node.from, to: node.to, kind: "horizontal-rule" },
        hideWhenActiveRange: { from: node.from, to: node.to },
      })
      return
    }

    if (node.name === "FencedCode") {
      entries.push({ decoration: { from: node.from, to: node.to, kind: "fenced-code" } })
      return
    }

    const decoration = decorationForNode(markdown, node, parent)
    if (decoration && decoration.kind !== "hide-mark" && decoration.kind !== "horizontal-rule") {
      entries.push({ decoration })
    }

    for (const child of listChildren(node)) visit(child, node, activeHeading)
  }

  visit(documentNode, null, null)
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
  for (const entry of entries) {
    if (
      entry.hideWhenActiveRange &&
      isTokenActive(entry.hideWhenActiveRange.from, entry.hideWhenActiveRange.to, selections)
    ) {
      continue
    }
    if (
      entry.secondaryHideWhenActiveRange &&
      isTokenActive(
        entry.secondaryHideWhenActiveRange.from,
        entry.secondaryHideWhenActiveRange.to,
        selections
      )
    ) {
      continue
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
