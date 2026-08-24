import { extractMarkdownTableLayouts } from "src/libs/markdown/tableMetadata"
import { hashString } from "src/libs/markdown/renderingCodeModel"
import { filterTrustedPostImageHtml, normalizeContentHtmlForMermaid } from "src/libs/markdown/renderingHtmlModel"
import { normalizeMarkdownForRender, parseMarkdownSegments } from "src/libs/markdown/renderingMarkdownModel"
import { createDocumentFootnoteModel } from "src/libs/markdown/renderingFootnoteModel"
import type { MarkdownRenderModel } from "src/libs/markdown/renderingTypes"
import type { TrustedContentHtml } from "src/types"

export type {
  CalloutKind,
  MarkdownRenderModel,
  MarkdownSegment,
} from "src/libs/markdown/renderingTypes"
export { markdownGuide } from "src/libs/markdown/renderingTypes"
export {
  extractCodeMetaFromPreChildren,
  extractTextFromCodeAst,
  hashString,
  toLanguageLabel,
} from "src/libs/markdown/renderingCodeModel"
export {
  isMermaidSource,
  normalizeContentHtmlForMermaid,
  shouldPreferMarkdownPipeline,
} from "src/libs/markdown/renderingHtmlModel"
export {
  clampImageWidthPx,
  normalizeImageAlign,
  parseStandaloneMarkdownImageLine,
  serializeStandaloneMarkdownImageLine,
  type ParsedStandaloneMarkdownImage,
} from "src/libs/markdown/renderingImageModel"
export {
  normalizeMarkdownForRender,
  parseMarkdownSegments,
} from "src/libs/markdown/renderingMarkdownModel"

export const resolveMarkdownRenderModel = ({
  content,
  trustedContentHtml,
}: {
  content?: string
  trustedContentHtml?: TrustedContentHtml
}): MarkdownRenderModel => {
  const normalizedContent = normalizeMarkdownForRender(content || "")
  const { cleanedMarkdown, layouts: tableLayouts } = extractMarkdownTableLayouts(normalizedContent)
  const normalizedContentHtml = trustedContentHtml?.html.trim() || ""
  const sanitizedContentHtml = filterTrustedPostImageHtml(normalizeContentHtmlForMermaid(normalizedContentHtml))

  // 원문 markdown이 있으면 interactive block 책임은 항상 클라이언트 markdown 파이프라인에 둔다.
  const resolvedContentHtml = normalizedContent ? "" : sanitizedContentHtml
  const footnoteModel = resolvedContentHtml
    ? { footnotes: [], marker: "", segments: [] }
    : createDocumentFootnoteModel({ source: cleanedMarkdown, segments: parseMarkdownSegments(cleanedMarkdown) })
  const segments = footnoteModel.segments
  const renderKeySeed = resolvedContentHtml
    ? `html:${resolvedContentHtml}`
    : `md:${cleanedMarkdown}::footnote:${footnoteModel.marker}::table:${JSON.stringify(tableLayouts)}`

  return {
    normalizedContent: cleanedMarkdown,
    resolvedContentHtml,
    renderKey: `${renderKeySeed.length}:${hashString(renderKeySeed)}`,
    segments,
    tableLayouts,
    footnotes: footnoteModel.footnotes,
    footnoteMarker: footnoteModel.marker,
  }
}
