import {
  findLineEndOffset,
  findLineStartOffset,
  overlapsSortedRanges,
  type MathSpanRange,
} from "../../libs/markdown/pandocMathScanner"
import type { MathReplacementSpec } from "./markdownEditorMathModel"

export const hasNewlineBetween = (text: string, from: number, to: number): boolean => {
  if (from >= to) return false
  const idx = text.indexOf("\n", from)
  return idx !== -1 && idx < to
}

export const findFirstRangeEndingAfter = (
  ranges: readonly MathSpanRange[],
  from: number
): number => {
  let low = 0
  let high = ranges.length - 1
  let startIdx = ranges.length
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (ranges[mid]!.to > from) {
      startIdx = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  return startIdx
}

const isPoisoningMathSpec = (
  spec: MathReplacementSpec,
  literalRanges: readonly MathSpanRange[]
): boolean => {
  for (
    let idx = findFirstRangeEndingAfter(literalRanges, spec.from);
    idx < literalRanges.length;
    idx += 1
  ) {
    const r = literalRanges[idx]!
    if (r.from >= spec.to) break
    if (r.from >= spec.from && r.to > spec.to) return true
  }
  return false
}

export const findFirstPoisoningMathSpec = (
  mathSpecs: readonly MathReplacementSpec[],
  literalRanges: readonly MathSpanRange[]
): MathReplacementSpec | null => {
  if (mathSpecs.length === 0 || literalRanges.length === 0) return null
  for (const spec of mathSpecs) {
    if (isPoisoningMathSpec(spec, literalRanges)) return spec
  }
  return null
}

export const findPoisoningMathSpecs = (
  mathSpecs: readonly MathReplacementSpec[],
  literalRanges: readonly MathSpanRange[]
): MathReplacementSpec[] => {
  if (mathSpecs.length === 0 || literalRanges.length === 0) return []
  const poisoned: MathReplacementSpec[] = []
  for (const spec of mathSpecs) {
    if (isPoisoningMathSpec(spec, literalRanges)) poisoned.push(spec)
  }
  return poisoned
}

const pushMaskedSpanChunks = (
  markdown: string,
  from: number,
  to: number,
  parts: string[]
): void => {
  let cursor = from
  while (cursor < to) {
    const lf = markdown.indexOf("\n", cursor)
    const cr = markdown.indexOf("\r", cursor)
    let nextBreak = to
    if (lf !== -1 && lf < nextBreak) nextBreak = lf
    if (cr !== -1 && cr < nextBreak) nextBreak = cr
    if (nextBreak > cursor) parts.push("x".repeat(nextBreak - cursor))
    if (nextBreak < to) {
      parts.push(markdown[nextBreak]!)
      cursor = nextBreak + 1
    } else {
      break
    }
  }
}

export const maskMultipleMathSpansPreservingOffsets = (
  markdown: string,
  specs: readonly MathSpanRange[]
): string => {
  if (specs.length === 0) return markdown
  const parts: string[] = []
  let cursor = 0
  for (const spec of specs) {
    if (spec.to <= cursor || spec.from >= spec.to) continue
    const clampedFrom = Math.max(cursor, spec.from)
    if (clampedFrom > cursor) parts.push(markdown.slice(cursor, clampedFrom))
    pushMaskedSpanChunks(markdown, clampedFrom, spec.to, parts)
    cursor = spec.to
  }
  if (cursor < markdown.length) parts.push(markdown.slice(cursor))
  return parts.join("")
}

export const maskMathSpanPreservingOffsets = (markdown: string, spec: MathSpanRange): string =>
  maskMultipleMathSpansPreservingOffsets(markdown, [spec])

const REPLACE_PLAN_SPEC_KINDS = new Set([
  "hide-mark",
  "horizontal-rule",
  "task",
  "list-marker",
  "wikilink",
  "quote-mark",
])

export const isLivePlanSpecBlockedByReplacedRanges = (
  markdown: string,
  specKind: string,
  specFrom: number,
  checkTo: number,
  replacedRanges: readonly MathSpanRange[]
): boolean => {
  if (replacedRanges.length === 0 || specFrom >= checkTo) return specFrom >= checkTo
  const isReplaceSpec = REPLACE_PLAN_SPEC_KINDS.has(specKind)
  const allowEqualBounds =
    !isReplaceSpec && (specKind === "highlight" || specKind === "inline-color")
  const specLen = checkTo - specFrom
  for (
    let idx = findFirstRangeEndingAfter(replacedRanges, specFrom);
    idx < replacedRanges.length;
    idx += 1
  ) {
    const r = replacedRanges[idx]!
    if (r.from >= checkTo) break
    const rLen = r.to - r.from
    const fitsInside =
      r.from >= specFrom && r.to <= checkTo && (allowEqualBounds ? rLen <= specLen : rLen < specLen)
    if (isReplaceSpec || !fitsInside || hasNewlineBetween(markdown, r.from, r.to)) return true
  }
  return false
}

const isAbsorbedDedicatedDisplayOpen = (
  markdown: string,
  nodeName: "Table" | "Blockquote" | "BulletList" | "OrderedList",
  nodeFrom: number,
  mathFrom: number
): { truncatedTo: number } | null => {
  const openLineStart = findLineStartOffset(markdown, mathFrom)
  if (openLineStart <= nodeFrom) return null
  if (nodeName === "BulletList" || nodeName === "OrderedList") {
    if (mathFrom !== openLineStart) return null
  } else if (!/^ {0,3}$/.test(markdown.slice(openLineStart, mathFrom))) {
    return null
  }
  const openLineEnd = findLineEndOffset(markdown, mathFrom + 2)
  if (markdown.slice(mathFrom + 2, openLineEnd).trim() !== "") return null
  const truncatedTo =
    openLineStart >= 2 && markdown.codePointAt(openLineStart - 2) === 13
      ? openLineStart - 2
      : openLineStart - 1
  return { truncatedTo }
}

export const resolveBlockNodeEndWithMath = (
  markdown: string,
  nodeName: "Table" | "Blockquote" | "BulletList" | "OrderedList",
  nodeFrom: number,
  nodeTo: number,
  maths: readonly MathReplacementSpec[]
): number | null => {
  let effectiveTo = nodeTo
  for (const m of maths) {
    if (m.to <= nodeFrom) continue
    if (m.from >= effectiveTo) break
    if (!hasNewlineBetween(markdown, m.from, m.to)) continue
    const absorbed = isAbsorbedDedicatedDisplayOpen(markdown, nodeName, nodeFrom, m.from)
    if (absorbed) {
      effectiveTo = absorbed.truncatedTo
      break
    }
    if (nodeName === "Table" && m.from >= nodeFrom) return null
  }
  if (effectiveTo <= nodeFrom) return null
  if (nodeName === "Table" && !hasNewlineBetween(markdown, nodeFrom, effectiveTo)) return null
  return effectiveTo
}

export const filterDisjointPreorderItems = <T extends MathSpanRange>(items: readonly T[]): T[] => {
  const kept: T[] = []
  for (const item of items) {
    const prev = kept.at(-1)
    if (!prev || item.from >= prev.to) kept.push(item)
  }
  return kept
}

export const filterItemsOutsideSortedRanges = <T extends MathSpanRange>(
  items: readonly T[],
  excluded: readonly MathSpanRange[]
): T[] =>
  excluded.length === 0
    ? [...items]
    : items.filter((item) => !overlapsSortedRanges(excluded, item.from, item.to))
