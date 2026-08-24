import { gfmToMarkdown } from "mdast-util-gfm"
import { toMarkdown } from "mdast-util-to-markdown"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { hashString } from "src/libs/markdown/renderingCodeModel"
import type { MarkdownSegment } from "src/libs/markdown/renderingTypes"
import { unified } from "unified"

type MarkdownAstNode = {
  type: string
  identifier?: string
  children?: MarkdownAstNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}

type MarkdownCapableSegment = Extract<MarkdownSegment, { content: string }>
type ParsedSegment = { index: number; segment: MarkdownCapableSegment; tree: MarkdownAstNode }
type DefinitionRecord = { node: MarkdownAstNode }
type ReferenceRecord = { segmentIndex: number; node: MarkdownAstNode }
type SourcePatch = { start: number; end: number; replacement: string }

export type MarkdownFootnote = Readonly<{
  identifier: string
  number: number
  content: string
  targetId: string
  referenceIds: readonly string[]
}>

export type DocumentFootnoteModel = Readonly<{
  footnotes: readonly MarkdownFootnote[]
  marker: string
  segments: MarkdownSegment[]
}>

const footnoteTargetId = (number: number) => `aq-footnote-${number}`
const footnoteReferenceId = (number: number, occurrence: number) => `aq-footnote-ref-${number}-${occurrence}`

const getOffsets = (node: MarkdownAstNode) => {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return typeof start === "number" && typeof end === "number" ? { start, end } : null
}

const isMarkdownCapableSegment = (segment: MarkdownSegment): segment is MarkdownCapableSegment =>
  segment.type === "markdown" || segment.type === "toggle" || segment.type === "callout"

const visitDefinitionNodes = (node: MarkdownAstNode, callback: (candidate: MarkdownAstNode) => void) => {
  if (node.type === "footnoteDefinition") callback(node)
  node.children?.forEach((child) => visitDefinitionNodes(child, callback))
}

const visitRootVisibleNodes = (node: MarkdownAstNode, callback: (candidate: MarkdownAstNode) => void) => {
  callback(node)
  if (node.type === "footnoteDefinition") return
  node.children?.forEach((child) => visitRootVisibleNodes(child, callback))
}

const applySourcePatches = (markdown: string, patches: SourcePatch[]) =>
  patches
    .sort((left, right) => right.start - left.start)
    .reduce((result, patch) => `${result.slice(0, patch.start)}${patch.replacement}${result.slice(patch.end)}`, markdown)

const serializeDefinitionContent = (definition: MarkdownAstNode) =>
  (definition.children || [])
    .map((child) =>
      toMarkdown({ type: "root", children: [child] } as Parameters<typeof toMarkdown>[0], {
        extensions: [gfmToMarkdown()],
      }).trim()
    )
    .filter(Boolean)
    .join("\n\n")

const serializeDefinition = (definition: MarkdownAstNode) =>
  toMarkdown({ type: "root", children: [definition] } as Parameters<typeof toMarkdown>[0], {
    extensions: [gfmToMarkdown()],
  }).trim()

export const createDocumentFootnoteModel = ({
  source,
  segments,
}: {
  source: string
  segments: MarkdownSegment[]
}): DocumentFootnoteModel => {
  const marker = `aq-footnote:${source.length}:${hashString(source)}`
  const parsedSegments: ParsedSegment[] = segments.flatMap((segment, index) => {
    if (!isMarkdownCapableSegment(segment)) return []
    return [{
      index,
      segment,
      tree: unified().use(remarkParse).use(remarkGfm).parse(segment.content) as MarkdownAstNode,
    }]
  })
  const definitions = new Map<string, DefinitionRecord>()
  const references: ReferenceRecord[] = []

  for (const parsed of parsedSegments) {
    visitDefinitionNodes(parsed.tree, (node) => {
      if (node.identifier && !definitions.has(node.identifier)) definitions.set(node.identifier, { node })
    })
  }

  const registryDefinitionMarkdown = [...definitions.values()]
    .map(({ node }) => serializeDefinition(node))
    .filter(Boolean)
    .join("\n\n")
  for (const parsed of parsedSegments) {
    const originalLength = parsed.segment.content.length
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(`${parsed.segment.content}\n\n${registryDefinitionMarkdown}`) as MarkdownAstNode
    visitRootVisibleNodes(tree, (node) => {
      const offsets = getOffsets(node)
      if (node.type === "footnoteReference" && node.identifier && offsets && offsets.end <= originalLength) {
        references.push({ segmentIndex: parsed.index, node })
      }
    })
  }

  const patchesBySegment = new Map<number, SourcePatch[]>()
  const addPatch = (segmentIndex: number, patch: SourcePatch) => {
    const patches = patchesBySegment.get(segmentIndex) || []
    patches.push(patch)
    patchesBySegment.set(segmentIndex, patches)
  }
  for (const parsed of parsedSegments) {
    visitDefinitionNodes(parsed.tree, (node) => {
      const offsets = getOffsets(node)
      if (offsets) addPatch(parsed.index, { ...offsets, replacement: "" })
    })
  }

  const footnotes: Array<{
    identifier: string
    number: number
    content: string
    targetId: string
    referenceIds: string[]
  }> = []
  const footnotesByIdentifier = new Map<string, (typeof footnotes)[number]>()
  const referenceOccurrences = new Map<string, number>()

  for (const reference of references) {
    const identifier = reference.node.identifier
    const definition = identifier ? definitions.get(identifier) : undefined
    const offsets = getOffsets(reference.node)
    if (!identifier || !definition || !offsets) continue

    let footnote = footnotesByIdentifier.get(identifier)
    if (!footnote) {
      footnote = {
        identifier,
        number: footnotes.length + 1,
        content: serializeDefinitionContent(definition.node),
        targetId: footnoteTargetId(footnotes.length + 1),
        referenceIds: [],
      }
      footnotesByIdentifier.set(identifier, footnote)
      footnotes.push(footnote)
    }

    const occurrence = (referenceOccurrences.get(identifier) || 0) + 1
    referenceOccurrences.set(identifier, occurrence)
    const referenceId = footnoteReferenceId(footnote.number, occurrence)
    footnote.referenceIds.push(referenceId)
    addPatch(reference.segmentIndex, {
      ...offsets,
      replacement: `[${footnote.number}](#${footnote.targetId} "${marker}:${referenceId}")`,
    })
  }

  const transformedSegments = segments.map((segment, index) => {
    if (!isMarkdownCapableSegment(segment)) return segment
    return { ...segment, content: applySourcePatches(segment.content, patchesBySegment.get(index) || []) }
  })
  const immutableFootnotes = Object.freeze(
    footnotes.map((footnote) => Object.freeze({ ...footnote, referenceIds: Object.freeze([...footnote.referenceIds]) }))
  )

  return Object.freeze({ footnotes: immutableFootnotes, marker, segments: transformedSegments })
}
