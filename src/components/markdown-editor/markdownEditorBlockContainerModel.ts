// 참조 구현: silverbulletmd/silverbullet (MIT) — 콜아웃·접힘 토큰 및 embed/bookmark 컨테이너 모델
import {
  resolveCalloutBlockquote,
  resolveCalloutLegacyEmoji,
  type CalloutKind,
} from "../../libs/markdown/calloutRegistry"
import {
  extractAsideOpenTail,
  hasCommonMarkCodeIndent,
  stripClosingAsideTag,
} from "../../libs/markdown/pandocMathScanner"
import { resolveCustomDirectiveBlockPayload } from "../../libs/markdown/renderingDirectiveModel"
import { normalizeSafeMarkdownUrl } from "../../libs/markdown/safeMarkdownUrl"
import {
  parseCustomDirectiveFromOpening,
  parseOpeningDirectiveLine,
  resolveClosingDirectiveFenceLength,
} from "../../libs/markdown/sharedDirectiveContainerParser"

const FENCE_DELIMITER_LINE_RE =
  /^(?: {0,3}>)*[ \t]*(?:(?:[-*+](?: \[[ xX]\])? |\d+\. )[ \t]*)?( {0,3})(`{3,}|~{3,})(.*)$/
const LEADING_EMOJI_RE =
  /^\[?(ℹ️?|⚠️|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F)?)\]?(?:[ \t]+|$)/u

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
  foldable?: boolean
  defaultCollapsed?: boolean
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
  siteName?: string
  provider?: string
}

export type EditorEmbedContainerBlock = {
  kind: "embed"
  from: number
  to: number
  url: string
  title: string
  caption: string
  provider?: string
  siteName?: string
}

export type EditorFileContainerBlock = {
  kind: "file"
  from: number
  to: number
  url: string
  name: string
  description: string
  mimeType?: string
  sizeBytes?: number
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

const CONTAINER_TONE_BY_CALLOUT_KIND: Record<CalloutKind, { tone: EditorCalloutTone; icon: string }> = {
  info: { tone: "info", icon: "ℹ️" },
  tip: { tone: "tip", icon: "💡" },
  warning: { tone: "warning", icon: "⚠️" },
  danger: { tone: "danger", icon: "🚨" },
  outline: { tone: "default", icon: "📋" },
  example: { tone: "tip", icon: "✨" },
  summary: { tone: "purple", icon: "📌" },
}

const CONTAINER_KEYWORD_OVERRIDES: Record<string, { tone: EditorCalloutTone; icon: string }> = {
  success: { tone: "tip", icon: "✅" },
  check: { tone: "tip", icon: "✅" },
  purple: { tone: "purple", icon: "📌" },
  default: { tone: "default", icon: "💡" },
}

const CONTAINER_EMOJI_TONE_OVERRIDES: Record<string, EditorCalloutTone> = {
  "✅": "tip",
  "✔️": "tip",
  "☑️": "tip",
  "❗": "danger",
  "📌": "purple",
}

const normalizeEmojiIcon = (raw: string): string => {
  if (raw === "ℹ") return "ℹ️"
  return raw === "⚠" ? "⚠️" : raw
}

const resolveCalloutToneFromKeyword = (token: string): { tone: EditorCalloutTone; icon: string } | undefined => {
  if (Object.hasOwn(CONTAINER_KEYWORD_OVERRIDES, token)) {
    return CONTAINER_KEYWORD_OVERRIDES[token]
  }
  const registryEntry = resolveCalloutBlockquote(token)
  return registryEntry ? CONTAINER_TONE_BY_CALLOUT_KIND[registryEntry.kind] : undefined
}

const resolveCalloutToneFromEmoji = (normalizedIcon: string, rawEmoji: string): EditorCalloutTone => {
  if (Object.hasOwn(CONTAINER_EMOJI_TONE_OVERRIDES, normalizedIcon)) {
    return CONTAINER_EMOJI_TONE_OVERRIDES[normalizedIcon]!
  }
  if (Object.hasOwn(CONTAINER_EMOJI_TONE_OVERRIDES, rawEmoji)) {
    return CONTAINER_EMOJI_TONE_OVERRIDES[rawEmoji]!
  }
  const legacyEntry = resolveCalloutLegacyEmoji(normalizedIcon) ?? resolveCalloutLegacyEmoji(rawEmoji)
  return legacyEntry ? CONTAINER_TONE_BY_CALLOUT_KIND[legacyEntry.kind].tone : "info"
}

const parseCalloutContainerPayload = (
  rawHeader: string,
  bodyLines: readonly string[],
  quotedTitle: string | null
): {
  tone: EditorCalloutTone
  icon: string
  title: string
  body: string
  foldable?: boolean
  defaultCollapsed?: boolean
} => {
  let rest = rawHeader.trim()
  let tone: EditorCalloutTone = "info"
  let icon = "💡"
  let hasExplicitTone = false
  let foldable = false
  let defaultCollapsed = false

  if (rest.length > 0) {
    const bracketedTokenMatch = /^\[!([a-zA-Z0-9_-]+)\]([+-])?(?=[ \t]|$)/.exec(rest)
    if (bracketedTokenMatch) {
      const token = bracketedTokenMatch[1]!.toLowerCase()
      const foldSign = bracketedTokenMatch[2]
      const mappedKeyword = resolveCalloutToneFromKeyword(token)
      if (mappedKeyword) {
        tone = mappedKeyword.tone
        icon = mappedKeyword.icon
        hasExplicitTone = true
      }
      if (foldSign === "+" || foldSign === "-") {
        foldable = true
        defaultCollapsed = foldSign === "-"
      }
      rest = rest.slice(bracketedTokenMatch[0].length).trim()
    } else {
      const firstSpace = rest.search(/[ \t]/)
      const rawToken = (firstSpace === -1 ? rest : rest.slice(0, firstSpace)).toLowerCase()
      let mappedKeyword = resolveCalloutToneFromKeyword(rawToken)
      if (!mappedKeyword && rawToken.length > 1) {
        const lastChar = rawToken[rawToken.length - 1]
        if (lastChar === "+" || lastChar === "-") {
          const baseKeyword = resolveCalloutToneFromKeyword(rawToken.slice(0, -1))
          if (baseKeyword) {
            mappedKeyword = baseKeyword
            foldable = true
            defaultCollapsed = lastChar === "-"
          }
        }
      }
      if (mappedKeyword) {
        tone = mappedKeyword.tone
        icon = mappedKeyword.icon
        hasExplicitTone = true
        rest = firstSpace === -1 ? "" : rest.slice(firstSpace).trim()
      }
    }
  }

  const headerEmojiMatch = LEADING_EMOJI_RE.exec(rest)
  if (headerEmojiMatch) {
    const rawEmoji = headerEmojiMatch[1]!
    icon = normalizeEmojiIcon(rawEmoji)
    if (!hasExplicitTone) {
      tone = resolveCalloutToneFromEmoji(icon, rawEmoji)
    }
    rest = rest.slice(headerEmojiMatch[0].length).trim()
  }

  const foldFields = foldable ? { foldable: true, defaultCollapsed } : {}

  if (quotedTitle !== null && quotedTitle.length > 0) {
    return {
      tone,
      icon,
      title: quotedTitle,
      body: bodyLines.join("\n").trim(),
      ...foldFields,
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
        tone = resolveCalloutToneFromEmoji(icon, rawEmoji)
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
    ...foldFields,
  }
}

const finalizeCustomContainerBlock = (
  candidate: Extract<OpenContainerCandidate, { kind: "bookmark" | "embed" | "file" }>,
  lineEnd: number
): EditorContainerBlock | null => {
  const resolved = resolveCustomDirectiveBlockPayload(
    candidate.kind,
    candidate.url,
    candidate.inlineTitle,
    candidate.bodyLines
  )
  const finalizedUrl =
    candidate.url && normalizeSafeMarkdownUrl(candidate.url) ? candidate.url : resolved.url
  if (!finalizedUrl) return null
  const primaryTitle =
    resolved.primaryTitle === resolved.url && finalizedUrl !== resolved.url
      ? finalizedUrl
      : resolved.primaryTitle

  const siteName =
    typeof resolved.extraAttrs.siteName === "string" && resolved.extraAttrs.siteName
      ? resolved.extraAttrs.siteName
      : undefined
  const provider =
    typeof resolved.extraAttrs.provider === "string" && resolved.extraAttrs.provider
      ? resolved.extraAttrs.provider
      : undefined
  const mimeType =
    typeof resolved.extraAttrs.mimeType === "string" && resolved.extraAttrs.mimeType
      ? resolved.extraAttrs.mimeType
      : undefined
  const sizeBytes =
    typeof resolved.extraAttrs.sizeBytes === "number" && Number.isFinite(resolved.extraAttrs.sizeBytes)
      ? resolved.extraAttrs.sizeBytes
      : undefined

  if (candidate.kind === "embed") {
    return {
      kind: "embed",
      from: candidate.from,
      to: lineEnd,
      url: finalizedUrl,
      title: primaryTitle,
      caption: resolved.secondaryText,
      ...(provider ? { provider } : {}),
      ...(siteName ? { siteName } : {}),
    }
  }
  if (candidate.kind === "file") {
    return {
      kind: "file",
      from: candidate.from,
      to: lineEnd,
      url: finalizedUrl,
      name: primaryTitle,
      description: resolved.secondaryText,
      ...(mimeType ? { mimeType } : {}),
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    }
  }
  return {
    kind: "bookmark",
    from: candidate.from,
    to: lineEnd,
    url: finalizedUrl,
    title: primaryTitle,
    description: resolved.secondaryText,
    ...(siteName ? { siteName } : {}),
    ...(provider ? { provider } : {}),
  }
}

type OpenAsideCandidate = {
  from: number
  bodyOffset: number
  bodyLines: string[]
}

const buildAsideCalloutBlock = (
  aside: OpenAsideCandidate,
  lineEnd: number
): EditorCalloutContainerBlock => {
  const trimmedBodyLines = aside.bodyLines.map((row) => row.trim())
  const parsed = parseCalloutContainerPayload("", trimmedBodyLines, null)
  return {
    kind: "callout",
    from: aside.from,
    to: lineEnd,
    tone: parsed.tone,
    icon: parsed.icon,
    title: parsed.title,
    body: parsed.body,
    bodyOffset: aside.bodyOffset,
    ...(parsed.foldable ? { foldable: true, defaultCollapsed: Boolean(parsed.defaultCollapsed) } : {}),
  }
}

export const parseBlockContainerBlocks = (docText: string): EditorContainerBlock[] => {
  if (!docText.includes(":::") && !docText.includes("<aside")) return []

  const blocks: EditorContainerBlock[] = []
  let pos = 0
  let inFence = false
  let openFenceMarker = ""
  let openFenceLength = 0
  let candidate: OpenContainerCandidate | null = null
  let asideCandidate: OpenAsideCandidate | null = null

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
      else if (asideCandidate) asideCandidate.bodyLines.push(lineText)
      continue
    }

    if (inFence) {
      if (candidate) candidate.bodyLines.push(lineText)
      else if (asideCandidate) asideCandidate.bodyLines.push(lineText)
      continue
    }

    if (asideCandidate) {
      if (!hasCommonMarkCodeIndent(lineText)) {
        const closedTail = stripClosingAsideTag(lineText)
        if (closedTail !== null) {
          if (closedTail.length > 0) asideCandidate.bodyLines.push(closedTail)
          blocks.push(buildAsideCalloutBlock(asideCandidate, lineEnd))
          asideCandidate = null
          continue
        }
      }
      asideCandidate.bodyLines.push(lineText)
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
              ...(parsed.foldable
                ? { foldable: true, defaultCollapsed: Boolean(parsed.defaultCollapsed) }
                : {}),
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
            const finalized = finalizeCustomContainerBlock(candidate, lineEnd)
            if (finalized) blocks.push(finalized)
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

    if (!hasCommonMarkCodeIndent(lineText)) {
      const asideOpenTail = extractAsideOpenTail(lineText)
      if (asideOpenTail !== null) {
        const inlineClosed = stripClosingAsideTag(asideOpenTail)
        const nextAside: OpenAsideCandidate = {
          from: lineStart,
          bodyOffset: Math.max(0, offset - lineStart),
          bodyLines: inlineClosed !== null
            ? (inlineClosed.length > 0 ? [inlineClosed] : [])
            : asideOpenTail.length > 0
              ? [asideOpenTail]
              : [],
        }
        if (inlineClosed !== null) {
          blocks.push(buildAsideCalloutBlock(nextAside, lineEnd))
        } else {
          asideCandidate = nextAside
        }
        continue
      }
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
    candidate =
      !url || normalizeSafeMarkdownUrl(url)
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
