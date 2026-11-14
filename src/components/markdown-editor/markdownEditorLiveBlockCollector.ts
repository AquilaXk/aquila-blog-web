import type { EditorState } from "@codemirror/state"
import { parseStandaloneMarkdownImageLine } from "../../libs/markdown/renderingImageModel"
import type {
  MarkdownLivePreviewDecoration,
  MarkdownLivePreviewPlanEntry,
  MarkdownSyntaxNode,
} from "./markdownEditorLivePreview"
import {
  isNodeShadowedByMath,
  resolveBlockNodeEndWithMath,
  type MathReplacementSpec,
} from "./markdownEditorMathModel"
import { parseLeadingTableLayoutLine } from "./markdownEditorTableMetadataModel"
import { parseCalloutBlockquoteSpec, type CalloutReplacementSpec } from "./markdownEditorWidgets"

export type RangeSpec = { from: number; to: number }
export type TableReplacementSpec = RangeSpec & { markdown: string }
export type ImageReplacementSpec = RangeSpec & {
  alt: string
  src: string
  title?: string
  widthPx?: number
  align?: string
}
export type MermaidReplacementSpec = RangeSpec & { source: string }

const resolveImageNodeEnd = (markdownValue: string, nodeTo: number): number => {
  const attrMatch = /^[ \t]*\{[^}\r\n]*\}/.exec(markdownValue.slice(nodeTo, nodeTo + 160))
  return attrMatch ? nodeTo + attrMatch[0].length : nodeTo
}

const parseImageReplacementSpec = (
  raw: string,
  from: number,
  to: number
): ImageReplacementSpec | null => {
  if (!raw.includes("\n") && !raw.includes("\r")) {
    const parsed = parseStandaloneMarkdownImageLine(raw)
    if (parsed) {
      return {
        from,
        to,
        alt: parsed.alt,
        src: parsed.src,
        title: parsed.title,
        widthPx: parsed.widthPx,
        align: parsed.align,
      }
    }
  }
  const match = /^!\[([^\][\r\n]*)\]\(([^()\r\n]*)\)$/.exec(raw)
  return match ? { from, to, alt: match[1] ?? "", src: match[2] ?? "" } : null
}

const parseMermaidReplacementSpec = (
  raw: string,
  from: number,
  to: number
): MermaidReplacementSpec | null => {
  const firstBreak = raw.indexOf("\n")
  if (firstBreak === -1) return null
  const lastBreak = raw.lastIndexOf("\n")
  const firstLine = raw.slice(0, firstBreak).replace(/\r$/, "")
  const closeLine = raw.slice(lastBreak + 1).replace(/\r$/, "")
  const openMatch = /^( {0,3})(`{3,}|~{3,})\s*mermaid\b/i.exec(firstLine)
  if (!openMatch || !/^( {0,3})(`{3,}|~{3,})\s*$/.test(closeLine)) return null
  const bodyEnd = lastBreak > 0 && raw.codePointAt(lastBreak - 1) === 13 ? lastBreak - 1 : lastBreak
  const source = firstBreak >= lastBreak ? "" : raw.slice(firstBreak + 1, bodyEnd).replaceAll("\r\n", "\n")
  return { from, to, source }
}

const ACTIVE_WIDGET_KINDS = new Set<MarkdownLivePreviewDecoration["kind"]>([
  "task",
  "wikilink",
  "list-marker",
  "quote-mark",
  "fenced-code",
])

export const resolveTaskPrefixRange = (markdownValue: string, from: number, to: number) => {
  const markerMatch = /^\[[ xX]\]/.exec(markdownValue.slice(from, to))
  const markerTo = from + (markerMatch ? markerMatch[0].length : Math.min(3, to - from))
  let prefixFrom = from
  while (prefixFrom > 0 && /[ \t]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  if (prefixFrom > 0 && /[-+*]/.test(markdownValue[prefixFrom - 1] ?? "")) prefixFrom -= 1
  return { from: prefixFrom, to: markerTo, markerTo }
}

const collectEntryWatchRanges = (
  markdownValue: string,
  entry: MarkdownLivePreviewPlanEntry,
  raw: RangeSpec[]
): void => {
  if (entry.hideWhenActiveRange) raw.push({ ...entry.hideWhenActiveRange })
  if (entry.secondaryHideWhenActiveRange) raw.push({ ...entry.secondaryHideWhenActiveRange })
  if (entry.kind === "task") {
    const taskPrefix = resolveTaskPrefixRange(markdownValue, entry.from, entry.to)
    raw.push({ from: taskPrefix.from, to: taskPrefix.to })
  } else if (ACTIVE_WIDGET_KINDS.has(entry.kind)) {
    raw.push({ from: entry.from, to: entry.to })
  }
}

const dedupeSortedRanges = (sorted: readonly RangeSpec[]): RangeSpec[] => {
  const deduped: RangeSpec[] = []
  for (const r of sorted) {
    const prev = deduped.at(-1)
    if (!prev || prev.from !== r.from || prev.to !== r.to) deduped.push(r)
  }
  return deduped
}

export const buildActiveWatchRanges = (
  markdownValue: string,
  previewEntries: readonly MarkdownLivePreviewPlanEntry[],
  blockGroups: readonly (readonly RangeSpec[])[]
): RangeSpec[] => {
  const raw: RangeSpec[] = []
  for (const entry of previewEntries) collectEntryWatchRanges(markdownValue, entry, raw)
  for (const group of blockGroups) {
    for (const item of group) raw.push({ from: item.from, to: item.to })
  }
  raw.sort((a, b) => a.from - b.from || a.to - b.to)
  return dedupeSortedRanges(raw)
}

const pushIfPresent = <T>(list: T[], item: T | null) => {
  if (item) list.push(item)
}

const collectTableBlockSpec = (
  state: EditorState,
  markdownValue: string,
  nodeFrom: number,
  nodeTo: number
): TableReplacementSpec | null => {
  let tableFrom = nodeFrom
  const headerLine = state.doc.lineAt(nodeFrom)
  if (headerLine.number > 1) {
    const prevLine = state.doc.line(headerLine.number - 1)
    const parsedComment = parseLeadingTableLayoutLine(prevLine.text)
    if (parsedComment.kind === "malformed") return null
    if (parsedComment.kind === "valid") tableFrom = prevLine.from
  }
  return { from: tableFrom, to: nodeTo, markdown: markdownValue.slice(tableFrom, nodeTo) }
}

export type DocBlockCollector = {
  state: EditorState
  markdownValue: string
  hasCalloutMarker: boolean
  hasMermaidMarker: boolean
  maths: readonly MathReplacementSpec[]
  tables: TableReplacementSpec[]
  callouts: CalloutReplacementSpec[]
  images: ImageReplacementSpec[]
  mermaids: MermaidReplacementSpec[]
}

export const walkSyntaxTreeForDocBlocks = (
  node: MarkdownSyntaxNode,
  collector: DocBlockCollector
): void => {
  if (node.name === "Table" || node.name === "Blockquote") {
    const end = resolveBlockNodeEndWithMath(
      collector.markdownValue,
      node.name,
      node.from,
      node.to,
      collector.maths
    )
    if (end !== null && !isNodeShadowedByMath(collector.maths, node.from, end)) {
      if (node.name === "Table") {
        pushIfPresent(
          collector.tables,
          collectTableBlockSpec(collector.state, collector.markdownValue, node.from, end)
        )
      } else if (collector.hasCalloutMarker) {
        pushIfPresent(
          collector.callouts,
          parseCalloutBlockquoteSpec(collector.markdownValue.slice(node.from, end), node.from, end)
        )
      }
    }
  } else if (!isNodeShadowedByMath(collector.maths, node.from, node.to)) {
    if (node.name === "Image") {
      const replaceTo = resolveImageNodeEnd(collector.markdownValue, node.to)
      pushIfPresent(
        collector.images,
        parseImageReplacementSpec(
          collector.markdownValue.slice(node.from, replaceTo),
          node.from,
          replaceTo
        )
      )
    } else if (node.name === "FencedCode" && collector.hasMermaidMarker) {
      pushIfPresent(
        collector.mermaids,
        parseMermaidReplacementSpec(collector.markdownValue.slice(node.from, node.to), node.from, node.to)
      )
    }
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    walkSyntaxTreeForDocBlocks(child, collector)
  }
}
