import { gfmToMarkdown } from "mdast-util-gfm"
import { mathToMarkdown } from "mdast-util-math"
import { toMarkdown } from "mdast-util-to-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
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
type CombinedSegmentRange = { segmentIndex: number; start: number; end: number }
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
const combinedSegmentBoundary = "\n\n---\n\n"

const parseMarkdownAst = (markdown: string) =>
  unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown) as MarkdownAstNode

const getOffsets = (node: MarkdownAstNode) => {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return typeof start === "number" && typeof end === "number" ? { start, end } : null
}

const isMarkdownCapableSegment = (segment: MarkdownSegment): segment is MarkdownCapableSegment =>
  segment.type === "markdown" || segment.type === "toggle" || segment.type === "callout"

const visitNodes = (node: MarkdownAstNode, callback: (candidate: MarkdownAstNode) => void) => {
  callback(node)
  node.children?.forEach((child) => visitNodes(child, callback))
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

const markdownExtensions = [gfmToMarkdown(), mathToMarkdown()]

const serializeDefinitionContent = (definition: MarkdownAstNode) =>
  (definition.children || [])
    .map((child) =>
      toMarkdown({ type: "root", children: [child] } as Parameters<typeof toMarkdown>[0], {
        extensions: markdownExtensions,
      }).trim()
    )
    .filter(Boolean)
    .join("\n\n")

const serializeDefinition = (definition: MarkdownAstNode) =>
  toMarkdown({ type: "root", children: [definition] } as Parameters<typeof toMarkdown>[0], {
    extensions: markdownExtensions,
  }).trim()

const collectReferencedDefinitionIdentifiers = (definition: MarkdownAstNode) => {
  const identifiers = new Set<string>()
  visitNodes(definition, (node) => {
    if (node.type === "linkReference" && node.identifier) {
      identifiers.add(node.identifier)
    }
  })
  return identifiers
}

const appendReferencedDefinitions = (
  content: string,
  definition: MarkdownAstNode,
  ordinaryDefinitions: ReadonlyMap<string, DefinitionRecord>
) => {
  const supportingDefinitions = [...collectReferencedDefinitionIdentifiers(definition)]
    .map((identifier) => ordinaryDefinitions.get(identifier)?.node)
    .filter((node): node is MarkdownAstNode => Boolean(node))
    .map(serializeDefinition)
    .filter(Boolean)
  return [content, ...supportingDefinitions].filter(Boolean).join("\n\n")
}

const buildCombinedSource = (parsedSegments: ParsedSegment[]) => {
  const ranges: CombinedSegmentRange[] = []
  let combinedSource = ""
  parsedSegments.forEach((parsed, index) => {
    if (index > 0) combinedSource += combinedSegmentBoundary
    const start = combinedSource.length
    combinedSource += parsed.segment.content
    ranges.push({ segmentIndex: parsed.index, start, end: combinedSource.length })
  })
  return { combinedSource, ranges }
}

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
    return [{ index, segment, tree: parseMarkdownAst(segment.content) }]
  })
  const footnoteDefinitions = new Map<string, DefinitionRecord>()
  const ordinaryDefinitions = new Map<string, DefinitionRecord>()
  const references: ReferenceRecord[] = []

  for (const parsed of parsedSegments) {
    visitNodes(parsed.tree, (node) => {
      if (node.type === "footnoteDefinition" && node.identifier && !footnoteDefinitions.has(node.identifier)) {
        footnoteDefinitions.set(node.identifier, { node })
      }
      if (node.type === "definition" && node.identifier && !ordinaryDefinitions.has(node.identifier)) {
        ordinaryDefinitions.set(node.identifier, { node })
      }
    })
  }

  const { combinedSource, ranges } = buildCombinedSource(parsedSegments)
  const combinedTree = parseMarkdownAst(combinedSource)
  let rangeCursor = 0
  visitRootVisibleNodes(combinedTree, (node) => {
    if (node.type !== "footnoteReference" || !node.identifier) return
    const offsets = getOffsets(node)
    if (!offsets) return
    while (rangeCursor < ranges.length && offsets.start >= ranges[rangeCursor].end) rangeCursor += 1
    const range = ranges[rangeCursor]
    if (!range || offsets.start < range.start || offsets.end > range.end) return
    references.push({
      segmentIndex: range.segmentIndex,
      node: {
        ...node,
        position: {
          start: { offset: offsets.start - range.start },
          end: { offset: offsets.end - range.start },
        },
      },
    })
  })

  const patchesBySegment = new Map<number, SourcePatch[]>()
  const addPatch = (segmentIndex: number, patch: SourcePatch) => {
    const patches = patchesBySegment.get(segmentIndex) || []
    patches.push(patch)
    patchesBySegment.set(segmentIndex, patches)
  }
  for (const parsed of parsedSegments) {
    visitNodes(parsed.tree, (node) => {
      if (node.type !== "footnoteDefinition") return
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
    const definition = identifier ? footnoteDefinitions.get(identifier) : undefined
    const offsets = getOffsets(reference.node)
    if (!identifier || !definition || !offsets) continue

    let footnote = footnotesByIdentifier.get(identifier)
    if (!footnote) {
      footnote = {
        identifier,
        number: footnotes.length + 1,
        content: appendReferencedDefinitions(
          serializeDefinitionContent(definition.node),
          definition.node,
          ordinaryDefinitions
        ),
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
