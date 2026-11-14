import { normalizeSafeMarkdownUrl } from "../../libs/markdown/safeMarkdownUrl"
import {
  parseCustomDirectiveFromOpening,
  parseOpeningDirectiveLine,
  resolveClosingDirectiveFenceLength,
} from "../../libs/markdown/sharedDirectiveContainerParser"

const FENCE_DELIMITER_LINE_RE =
  /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const LEADING_EMOJI_RE =
  /^\[?(ℹ️|⚠️|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F)?)\]?(?:[ \t]+|$)/u

export type EditorCalloutTone = "info" | "tip" | "warning" | "danger" | "purple" | "default"

export type EditorCalloutContainerBlock = {
  kind: "callout"
  from: number
  to: number
  tone: EditorCalloutTone
  icon: string
  title: string
  body: string
  bodyOffset: number
}

export type EditorToggleContainerBlock = {
  kind: "toggle"
  from: number
  to: number
  title: string
  body: string
  bodyOffset: number
}

export type EditorBookmarkContainerBlock = {
  kind: "bookmark"
  from: number
  to: number
  url: string
  title: string
  description: string
}

export type EditorEmbedContainerBlock = {
  kind: "embed"
  from: number
  to: number
  url: string
  title: string
  caption: string
}

export type EditorFileContainerBlock = {
  kind: "file"
  from: number
  to: number
  url: string
  name: string
  description: string
}

export type EditorContainerBlock =
  | EditorCalloutContainerBlock
  | EditorToggleContainerBlock
  | EditorBookmarkContainerBlock
  | EditorEmbedContainerBlock
  | EditorFileContainerBlock

type OpenContainerCandidate =
  | {
      kind: "callout"
      from: number
      bodyOffset: number
      fenceStack: number[]
      rawHeader: string
      quotedTitle: string | null
      bodyLines: string[]
    }
  | {
      kind: "toggle"
      from: number
      bodyOffset: number
      fenceStack: number[]
      rawTitle: string
      bodyLines: string[]
    }
  | {
      kind: "bookmark" | "embed" | "file"
      from: number
      fenceStack: number[]
      url: string
      inlineTitle: string
      bodyLines: string[]
    }

const CALLOUT_TONE_KEYWORD_MAP: Record<string, { tone: EditorCalloutTone; icon: string }> = {
  info: { tone: "info", icon: "ℹ️" },
  note: { tone: "info", icon: "ℹ️" },
  tip: { tone: "tip", icon: "💡" },
  hint: { tone: "tip", icon: "💡" },
  success: { tone: "tip", icon: "✅" },
  check: { tone: "tip", icon: "✅" },
  warning: { tone: "warning", icon: "⚠️" },
  caution: { tone: "warning", icon: "⚠️" },
  danger: { tone: "danger", icon: "🚨" },
  error: { tone: "danger", icon: "🚨" },
  purple: { tone: "purple", icon: "📌" },
  summary: { tone: "purple", icon: "📌" },
  important: { tone: "purple", icon: "📌" },
  default: { tone: "default", icon: "💡" },
  outline: { tone: "default", icon: "📋" },
}

const CALLOUT_EMOJI_TONE_MAP: Record<string, EditorCalloutTone> = {
  "💡": "tip",
  "✨": "tip",
  "✅": "tip",
  "ℹ️": "info",
  "ℹ": "info",
  "⚠️": "warning",
  "⚠": "warning",
  "🚨": "danger",
  "❗": "danger",
  "⛔": "danger",
  "📌": "purple",
  "📚": "purple",
  "🧾": "purple",
}

const normalizeEmojiIcon = (raw: string): string => {
  if (raw === "ℹ") return "ℹ️"
  return raw === "⚠" ? "⚠️" : raw
}

const parseCalloutContainerPayload = (
  rawHeader: string,
  bodyLines: readonly string[],
  quotedTitle: string | null
): { tone: EditorCalloutTone; icon: string; title: string; body: string } => {
  let rest = rawHeader.trim()
  let tone: EditorCalloutTone = "info"
  let icon = "💡"
  let hasExplicitTone = false

  if (rest.length > 0) {
    const firstSpace = rest.search(/[ \t]/)
    const firstToken = (firstSpace === -1 ? rest : rest.slice(0, firstSpace)).toLowerCase()
    const mappedKeyword = Object.hasOwn(CALLOUT_TONE_KEYWORD_MAP, firstToken)
      ? CALLOUT_TONE_KEYWORD_MAP[firstToken]
      : undefined
    if (mappedKeyword) {
      tone = mappedKeyword.tone
      icon = mappedKeyword.icon
      hasExplicitTone = true
      rest = firstSpace === -1 ? "" : rest.slice(firstSpace).trim()
    }
  }

  const headerEmojiMatch = LEADING_EMOJI_RE.exec(rest)
  if (headerEmojiMatch) {
    const rawEmoji = headerEmojiMatch[1]!
    icon = normalizeEmojiIcon(rawEmoji)
    if (!hasExplicitTone) {
      tone = CALLOUT_EMOJI_TONE_MAP[icon] ?? CALLOUT_EMOJI_TONE_MAP[rawEmoji] ?? "info"
    }
    rest = rest.slice(headerEmojiMatch[0].length).trim()
  }

  if (quotedTitle !== null && quotedTitle.length > 0) {
    return {
      tone,
      icon,
      title: quotedTitle,
      body: bodyLines.join("\n").trim(),
    }
  }

  let remainingBodyLines = [...bodyLines]
  if (rest.length === 0 && remainingBodyLines.length > 0) {
    const firstLine = (remainingBodyLines[0] ?? "").trim()
    const bodyEmojiMatch = LEADING_EMOJI_RE.exec(firstLine)
    if (bodyEmojiMatch) {
      const rawEmoji = bodyEmojiMatch[1]!
      icon = normalizeEmojiIcon(rawEmoji)
      if (!hasExplicitTone) {
        tone = CALLOUT_EMOJI_TONE_MAP[icon] ?? CALLOUT_EMOJI_TONE_MAP[rawEmoji] ?? "info"
      }
      rest = firstLine.slice(bodyEmojiMatch[0].length).trim()
      remainingBodyLines = remainingBodyLines.slice(1)
    } else if (firstLine.length > 0) {
      rest = firstLine
      remainingBodyLines = remainingBodyLines.slice(1)
    }
  }

  return {
    tone,
    icon,
    title: rest || "콜아웃",
    body: remainingBodyLines.join("\n").trim(),
  }
}

const finalizeCustomContainerBlock = (
  candidate: Extract<OpenContainerCandidate, { kind: "bookmark" | "embed" | "file" }>,
  lineEnd: number
): EditorContainerBlock => {
  const nonEmptyLines: string[] = []
  for (const raw of candidate.bodyLines) {
    const trimmed = raw.trim()
    if (trimmed) nonEmptyLines.push(trimmed)
  }
  const hasInlineTitle = candidate.inlineTitle.length > 0
  const primaryTitle = hasInlineTitle ? candidate.inlineTitle : (nonEmptyLines[0] ?? candidate.url)
  const secondaryText = hasInlineTitle ? nonEmptyLines.join("\n") : nonEmptyLines.slice(1).join("\n")

  if (candidate.kind === "embed") {
    return {
      kind: "embed",
      from: candidate.from,
      to: lineEnd,
      url: candidate.url,
      title: primaryTitle,
      caption: secondaryText,
    }
  }
  if (candidate.kind === "file") {
    return {
      kind: "file",
      from: candidate.from,
      to: lineEnd,
      url: candidate.url,
      name: primaryTitle,
      description: secondaryText,
    }
  }
  return {
    kind: "bookmark",
    from: candidate.from,
    to: lineEnd,
    url: candidate.url,
    title: primaryTitle,
    description: secondaryText,
  }
}

export const parseBlockContainerBlocks = (docText: string): EditorContainerBlock[] => {
  if (!docText.includes(":::")) return []

  const blocks: EditorContainerBlock[] = []
  let pos = 0
  let inFence = false
  let openFenceMarker = ""
  let openFenceLength = 0
  let candidate: OpenContainerCandidate | null = null

  while (pos <= docText.length) {
    const nextBreak = docText.indexOf("\n", pos)
    const lineStart = pos
    const lineEnd = nextBreak === -1 ? docText.length : nextBreak
    const rawLine = docText.slice(lineStart, lineEnd)
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
    const offset = nextBreak === -1 ? lineEnd : lineEnd + 1
    pos = nextBreak === -1 ? docText.length + 1 : lineEnd + 1

    const fenceMatch = FENCE_DELIMITER_LINE_RE.exec(lineText)
    if (fenceMatch) {
      const marker = fenceMatch[2]?.[0] ?? ""
      const length = fenceMatch[2]?.length ?? 0
      const info = fenceMatch[3] ?? ""
      if (!inFence) {
        inFence = true
        openFenceMarker = marker
        openFenceLength = length
      } else if (marker === openFenceMarker && length >= openFenceLength && info.trim() === "") {
        inFence = false
        openFenceMarker = ""
        openFenceLength = 0
      }
      if (candidate) candidate.bodyLines.push(lineText)
      continue
    }

    if (inFence) {
      if (candidate) candidate.bodyLines.push(lineText)
      continue
    }

    if (candidate) {
      const closeLen = resolveClosingDirectiveFenceLength(lineText)
      if (closeLen >= 3) {
        const stack = candidate.fenceStack
        while (stack.length > 0 && closeLen > stack[stack.length - 1]!) {
          stack.pop()
        }
        if (stack.length > 0 && closeLen >= stack[stack.length - 1]!) {
          stack.pop()
        }
        if (stack.length === 0) {
          if (candidate.kind === "callout") {
            const parsed = parseCalloutContainerPayload(
              candidate.rawHeader,
              candidate.bodyLines,
              candidate.quotedTitle
            )
            blocks.push({
              kind: "callout",
              from: candidate.from,
              to: lineEnd,
              tone: parsed.tone,
              icon: parsed.icon,
              title: parsed.title,
              body: parsed.body,
              bodyOffset: candidate.bodyOffset,
            })
          } else if (candidate.kind === "toggle") {
            blocks.push({
              kind: "toggle",
              from: candidate.from,
              to: lineEnd,
              title: candidate.rawTitle.trim() || "토글 블록",
              body: candidate.bodyLines.join("\n").trim(),
              bodyOffset: candidate.bodyOffset,
            })
          } else {
            blocks.push(finalizeCustomContainerBlock(candidate, lineEnd))
          }
          candidate = null
          continue
        }
        candidate.bodyLines.push(lineText)
        continue
      }

      const nestedOpen = parseOpeningDirectiveLine(lineText)
      if (nestedOpen) {
        candidate.fenceStack.push(nestedOpen.fenceLength)
      }
      candidate.bodyLines.push(lineText)
      continue
    }

    const open = parseOpeningDirectiveLine(lineText)
    if (!open) continue

    if (open.kind === "callout") {
      candidate = {
        kind: "callout",
        from: lineStart,
        bodyOffset: Math.max(0, offset - lineStart),
        fenceStack: [open.fenceLength],
        rawHeader: open.remainder,
        quotedTitle: open.quotedTitle,
        bodyLines: [],
      }
      continue
    }

    if (open.kind === "toggle") {
      candidate = {
        kind: "toggle",
        from: lineStart,
        bodyOffset: Math.max(0, offset - lineStart),
        fenceStack: [open.fenceLength],
        rawTitle: open.quotedTitle !== null ? open.quotedTitle : open.remainder,
        bodyLines: [],
      }
      continue
    }

    const custom = parseCustomDirectiveFromOpening(open)
    if (!custom) continue
    const url = custom.rawUrl.trim()
    candidate = normalizeSafeMarkdownUrl(url)
      ? {
          kind: custom.directive,
          from: lineStart,
          fenceStack: [open.fenceLength],
          url,
          inlineTitle: custom.inlineTitle,
          bodyLines: [],
        }
      : null
  }

  return blocks
}
