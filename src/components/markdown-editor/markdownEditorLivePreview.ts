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
  level?: number
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

const isInsideSourceRange = (node: MarkdownSyntaxNode, sourceRanges: readonly MarkdownLiveSourceRange[]) =>
  sourceRanges.some((range) => node.from >= range.from && node.to <= range.to)

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
  if (node.name === "URL" && parent?.name === "Link") {
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
  }
  const kind = kindByNode[node.name]
  return kind ? { from: node.from, to: node.to, kind } : null
}

export const buildMarkdownLivePreviewPlan = (
  markdown: string,
  documentNode: MarkdownSyntaxNode,
  selections: readonly MarkdownLiveSelection[],
  composing = false
): MarkdownLivePreviewDecoration[] => {
  if (composing) return []

  const sourceRanges = resolveMarkdownLiveSourceRanges(markdown, documentNode, selections)
  const decorations: MarkdownLivePreviewDecoration[] = []

  const visit = (node: MarkdownSyntaxNode, parent: MarkdownSyntaxNode | null) => {
    if (node !== documentNode && isInsideSourceRange(node, sourceRanges)) return
    const decoration = decorationForNode(markdown, node, parent)
    if (decoration) decorations.push(decoration)
    for (const child of listChildren(node)) visit(child, node)
  }
  visit(documentNode, null)
  return decorations
}
