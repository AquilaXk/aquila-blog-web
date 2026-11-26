import {
  fetchEditorUnfurl,
  formatUnfurlDirectiveBlock,
} from "../../libs/unfurl/fetchEditorUnfurl"
import { findExactSubstringIndex, parseSingleHttpUrl, planReplaceExactSubstring } from "./markdownEditorPasteDropModel"
import type { PlannedTextMutation } from "./markdownEditorTextMutation"

export type BareUrlDirectiveHit = {
  kind: "bookmark" | "embed"
  url: string
  from: number
  to: number
  rawBlock: string
}

const MAX_ATTEMPTED_UNFURLS = 64
const BARE_OPEN_RE = /^:::(bookmark|embed)\s+(https?:\/\/\S+)\s*$/
const METADATA_COMMENT_RE = /^<!--\s*aq-(?:bookmark|embed|link|card)\b/

const findLineBounds = (markdown: string, offset: number) => {
  const safeOffset = Math.max(0, Math.min(offset, markdown.length))
  const start = markdown.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1
  const nextBreak = markdown.indexOf("\n", safeOffset)
  const end = nextBreak === -1 ? markdown.length : nextBreak
  return { start, end }
}

const hasMetadataAbove = (markdown: string, openLineStart: number): boolean => {
  if (openLineStart <= 0) return false
  const prevEnd = openLineStart - 1
  const prevStart = markdown.lastIndexOf("\n", Math.max(0, prevEnd - 1)) + 1
  const prevLine = markdown.slice(prevStart, prevEnd).trim()
  return METADATA_COMMENT_RE.test(prevLine)
}

export const findBareUrlDirectiveAtOffset = (
  markdown: string,
  offset: number
): BareUrlDirectiveHit | null => {
  if (!markdown || !markdown.includes(":::")) return null
  const cursorLine = findLineBounds(markdown, offset)
  let scanStart = cursorLine.start
  let matchedOpen: { from: number; kind: "bookmark" | "embed"; url: string } | null = null

  for (let steps = 0; steps < 6; steps += 1) {
    const lineEndIdx = markdown.indexOf("\n", scanStart)
    const lineEnd = lineEndIdx === -1 ? markdown.length : lineEndIdx
    const trimmed = markdown.slice(scanStart, lineEnd).trim()
    const openMatch = BARE_OPEN_RE.exec(trimmed)
    if (openMatch) {
      const candidateUrl = parseSingleHttpUrl(openMatch[2] ?? "")
      if (candidateUrl && !hasMetadataAbove(markdown, scanStart)) {
        matchedOpen = {
          from: scanStart,
          kind: openMatch[1] as "bookmark" | "embed",
          url: candidateUrl,
        }
      }
      break
    }
    if (trimmed !== "" && trimmed !== ":::") break
    if (scanStart === 0) break
    scanStart = markdown.lastIndexOf("\n", Math.max(0, scanStart - 2)) + 1
  }

  if (!matchedOpen) return null

  const openEndIdx = markdown.indexOf("\n", matchedOpen.from)
  if (openEndIdx === -1) return null
  let pos = openEndIdx + 1
  for (let steps = 0; steps < 6 && pos <= markdown.length; steps += 1) {
    const lineEndIdx = markdown.indexOf("\n", pos)
    const lineEnd = lineEndIdx === -1 ? markdown.length : lineEndIdx
    const trimmed = markdown.slice(pos, lineEnd).trim()
    if (trimmed === ":::") {
      if (offset < matchedOpen.from || offset > lineEnd) return null
      return {
        kind: matchedOpen.kind,
        url: matchedOpen.url,
        from: matchedOpen.from,
        to: lineEnd,
        rawBlock: markdown.slice(matchedOpen.from, lineEnd),
      }
    }
    if (trimmed !== "") return null
    if (lineEndIdx === -1) break
    pos = lineEndIdx + 1
  }
  return null
}

export const createBareDirectiveUnfurlTracker = () => {
  let activeHit: BareUrlDirectiveHit | null = null
  const attemptedBlocks = new Set<string>()

  const markAttempted = (rawBlock: string) => {
    if (attemptedBlocks.size >= MAX_ATTEMPTED_UNFURLS) {
      const oldest = attemptedBlocks.values().next().value
      if (oldest !== undefined) attemptedBlocks.delete(oldest)
    }
    attemptedBlocks.add(rawBlock)
  }

  const reset = () => {
    activeHit = null
    attemptedBlocks.clear()
  }

  const trackSelection = ({
    markdown,
    offset,
    isCurrentGeneration,
    getCurrentValue,
    applyBackgroundMutation,
  }: {
    markdown: string
    offset: number
    isCurrentGeneration: () => boolean
    getCurrentValue: () => string
    applyBackgroundMutation: (plan: PlannedTextMutation) => boolean
  }) => {
    const currentHit = findBareUrlDirectiveAtOffset(markdown, offset)
    const previous = activeHit
    activeHit = currentHit

    if (!previous) return
    if (currentHit && currentHit.rawBlock === previous.rawBlock) return
    if (attemptedBlocks.has(previous.rawBlock)) return
    if (typeof window === "undefined" || !window.location.protocol.startsWith("http")) return
    if (typeof fetch !== "function") return
    if (findExactSubstringIndex(markdown, previous.rawBlock) === -1) return

    markAttempted(previous.rawBlock)
    void fetchEditorUnfurl(previous.url).then((meta) => {
      if (!meta || !isCurrentGeneration()) return
      const latest = getCurrentValue()
      if (findExactSubstringIndex(latest, previous.rawBlock) === -1) return
      const enriched = formatUnfurlDirectiveBlock(previous.kind, previous.url, meta)
      const replacePlan = planReplaceExactSubstring(latest, previous.rawBlock, enriched, 0, 0)
      if (replacePlan) {
        applyBackgroundMutation(replacePlan)
      }
    })
  }

  return { trackSelection, reset }
}
