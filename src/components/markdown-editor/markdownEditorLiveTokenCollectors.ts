import { resolveInlineColorValue } from "../../libs/markdown/inlineColor"
import { findMarkdownHighlightSpans } from "../../libs/markdown/inlineHighlightModel"
import { findDoubleBraceColorSpans, findWikilinkSpans } from "../../libs/markdown/inlineTokenScanners"
import type {
  MarkdownLivePreviewPlanEntry,
  MarkdownLiveSourceRange,
} from "./markdownEditorLivePreview"

export const isWrappedSpanBlockedByLiterals = (
  span: { from: number; to: number; contentFrom: number; contentTo: number },
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  hasEnclosingInterval: (ranges: readonly MarkdownLiveSourceRange[], from: number, to: number) => boolean,
  hasIntervalOverlap: (ranges: readonly MarkdownLiveSourceRange[], from: number, to: number) => boolean
): boolean =>
  hasEnclosingInterval(blockLiteralRanges, span.from, span.to) ||
  hasIntervalOverlap(literalRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(literalRanges, span.contentTo, span.to) ||
  hasIntervalOverlap(wikilinkRanges, span.from, span.contentFrom) ||
  hasIntervalOverlap(wikilinkRanges, span.contentTo, span.to)

export type PlanEntryFactory = (
  decoration: MarkdownLivePreviewPlanEntry["decoration"],
  hideWhenActiveRange?: MarkdownLiveSourceRange,
  secondaryHideWhenActiveRange?: MarkdownLiveSourceRange
) => MarkdownLivePreviewPlanEntry

type TokenRangeHelpers = {
  createPlanEntry: PlanEntryFactory
  hasEnclosingInterval: (ranges: readonly MarkdownLiveSourceRange[], from: number, to: number) => boolean
  hasIntervalOverlap: (ranges: readonly MarkdownLiveSourceRange[], from: number, to: number) => boolean
}

const collectWikilinkEntries = (
  markdown: string,
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[],
  helpers: TokenRangeHelpers
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges: MarkdownLiveSourceRange[] = []
  if (!markdown.includes("[[")) return wikilinkRanges
  for (const span of findWikilinkSpans(markdown)) {
    const { from, to } = span
    if (helpers.hasIntervalOverlap(literalRanges, from, to)) continue
    const target = span.rawTarget.trim()
    const alias = (span.rawAlias?.trim() ?? "") || undefined
    if (!target) continue
    const activeRange = { from, to }
    wikilinkRanges.push(activeRange)
    entries.push(helpers.createPlanEntry({ from, to, kind: "wikilink", target, alias }, activeRange))
  }
  return wikilinkRanges
}

const collectInlineColorEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[],
  helpers: TokenRangeHelpers
): void => {
  const spans = findDoubleBraceColorSpans(markdown, {
    trimTrailingContentWhitespace: false,
    allowEmptyContent: false,
    skipInlineCodeSpans: true,
    singleLine: true,
  })
  for (const span of spans) {
    if (
      isWrappedSpanBlockedByLiterals(
        span,
        blockLiteralRanges,
        literalRanges,
        wikilinkRanges,
        helpers.hasEnclosingInterval,
        helpers.hasIntervalOverlap
      )
    ) {
      continue
    }
    const color = resolveInlineColorValue(span.colorToken)
    if (!color) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      helpers.createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      helpers.createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "inline-color", color }, activeRange),
      helpers.createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

const collectHighlightEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  wikilinkRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[],
  helpers: TokenRangeHelpers
): void => {
  for (const span of findMarkdownHighlightSpans(markdown)) {
    if (
      isWrappedSpanBlockedByLiterals(
        span,
        blockLiteralRanges,
        literalRanges,
        wikilinkRanges,
        helpers.hasEnclosingInterval,
        helpers.hasIntervalOverlap
      )
    ) {
      continue
    }
    if (!markdown.slice(span.contentFrom, span.contentTo).trim()) continue
    const activeRange = { from: span.from, to: span.to }
    entries.push(
      helpers.createPlanEntry({ from: span.contentFrom, to: span.contentTo, kind: "highlight" }),
      helpers.createPlanEntry({ from: span.from, to: span.contentFrom, kind: "hide-mark" }, activeRange),
      helpers.createPlanEntry({ from: span.contentTo, to: span.to, kind: "hide-mark" }, activeRange)
    )
  }
}

export const collectRegexTokenPlanEntries = (
  markdown: string,
  blockLiteralRanges: readonly MarkdownLiveSourceRange[],
  literalRanges: readonly MarkdownLiveSourceRange[],
  entries: MarkdownLivePreviewPlanEntry[],
  helpers: TokenRangeHelpers
): MarkdownLiveSourceRange[] => {
  const wikilinkRanges = collectWikilinkEntries(markdown, literalRanges, entries, helpers)
  collectInlineColorEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries, helpers)
  collectHighlightEntries(markdown, blockLiteralRanges, literalRanges, wikilinkRanges, entries, helpers)
  return wikilinkRanges
}
