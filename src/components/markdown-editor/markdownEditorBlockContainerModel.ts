// 참조 구현: silverbulletmd/silverbullet (MIT) — 콜아웃·접힘 토큰 및 embed/bookmark 컨테이너 모델
import { translations, type TranslationKey } from "../../libs/language/translations"
import {
  resolveCalloutBlockquote,
  resolveCalloutLegacyEmoji,
  type CalloutKind,
} from "../../libs/markdown/calloutRegistry"
import {
  extractAsideOpenTail,
  hasCommonMarkCodeIndent,
  overlapsSortedRanges,
  stripClosingAsideTag,
} from "../../libs/markdown/pandocMathScanner"
import { parseCommonMarkBlockRanges } from "../../libs/markdown/commonMarkCodeBlockRanges"
import {
  extractPromotedCalloutTitle,
  isLineStartInCommentRanges,
  resolveCustomDirectiveBlockPayload,
} from "../../libs/markdown/renderingDirectiveModel"
import { normalizeSafeMarkdownUrl } from "../../libs/markdown/safeMarkdownUrl"
import { normalizePublicExternalThumbnailUrl } from "../../libs/markdown/externalThumbnailUrlPolicy"
import { normalizePublicPostImageUrl } from "../../libs/markdown/postImageUrlPolicy"
import { resolveEmbedPreviewUrl } from "../../libs/unfurl/extractMeta"
import {
  parseCustomDirectiveFromOpening,
  parseOpeningDirectiveLine,
  resolveCalloutDirectiveRawHeader,
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
  thumbnailUrl?: string
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
  thumbnailUrl?: string
  embedUrl?: string
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

const DEFAULT_CALLOUT_TITLE_KEYS: Record<CalloutKind, TranslationKey> = {
  summary: "calloutTitleSummary",
  info: "calloutTitleInfo",
  tip: "calloutTitleTip",
  warning: "calloutTitleWarning",
  danger: "calloutTitleDanger",
  example: "calloutTitleExample",
  outline: "calloutTitleOutline",
}

const resolveCalloutToneFromKeyword = (
  token: string
): { tone: EditorCalloutTone; icon: string; calloutKind?: CalloutKind } | undefined => {
  if (Object.hasOwn(CONTAINER_KEYWORD_OVERRIDES, token)) {
    return CONTAINER_KEYWORD_OVERRIDES[token]
  }
  const registryEntry = resolveCalloutBlockquote(token)
  return registryEntry
    ? { ...CONTAINER_TONE_BY_CALLOUT_KIND[registryEntry.kind], calloutKind: registryEntry.kind }
    : undefined
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
  let calloutKind: CalloutKind | undefined

  if (rest.length > 0) {
    const bracketedTokenMatch = /^\[!([a-zA-Z0-9_-]+)\]([+-])?(?=[ \t]|$)/.exec(rest)
    if (bracketedTokenMatch) {
      const token = bracketedTokenMatch[1]!.toLowerCase()
      const foldSign = bracketedTokenMatch[2]
      const mappedKeyword = resolveCalloutToneFromKeyword(token)
      if (mappedKeyword) {
        tone = mappedKeyword.tone
        icon = mappedKeyword.icon
        calloutKind = mappedKeyword.calloutKind
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
        calloutKind = mappedKeyword.calloutKind
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
    } else {
      const promoted = extractPromotedCalloutTitle(remainingBodyLines)
      if (promoted.title) {
        rest = promoted.title
        remainingBodyLines = promoted.bodyLines
      }
    }
  }

  const resolvedDefaultTitle =
    calloutKind === "summary"
      ? translations.ko[DEFAULT_CALLOUT_TITLE_KEYS.summary]
      : foldable && calloutKind
        ? translations.ko[DEFAULT_CALLOUT_TITLE_KEYS[calloutKind]]
        : "콜아웃"

  return {
    tone,
    icon,
    title: rest || resolvedDefaultTitle,
    body: remainingBodyLines.join("\n").trim(),
    ...foldFields,
  }
}

const readExtraText = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined

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

  const siteName = readExtraText(resolved.extraAttrs.siteName)
  const provider = readExtraText(resolved.extraAttrs.provider)
  const rawThumb = readExtraText(resolved.extraAttrs.thumbnailUrl)
  const thumbnailUrl = rawThumb
    ? normalizePublicPostImageUrl(rawThumb) || normalizePublicExternalThumbnailUrl(rawThumb)
    : ""
  const rawEmbedUrl = readExtraText(resolved.extraAttrs.embedUrl)
  const embedUrl = rawEmbedUrl ? resolveEmbedPreviewUrl(rawEmbedUrl) : ""
  const mimeType = readExtraText(resolved.extraAttrs.mimeType)
  const rawSize = resolved.extraAttrs.sizeBytes
  const sizeBytes = typeof rawSize === "number" && Number.isFinite(rawSize) ? rawSize : undefined

  if (candidate.kind === "embed") {
    return {
      kind: "embed", from: candidate.from, to: lineEnd, url: finalizedUrl,
      title: primaryTitle, caption: resolved.secondaryText,
      ...(provider ? { provider } : {}), ...(siteName ? { siteName } : {}),
      ...(thumbnailUrl ? { thumbnailUrl } : {}), ...(embedUrl ? { embedUrl } : {}),
    }
  }
  if (candidate.kind === "file") {
    return {
      kind: "file", from: candidate.from, to: lineEnd, url: finalizedUrl,
      name: primaryTitle, description: resolved.secondaryText,
      ...(mimeType ? { mimeType } : {}), ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    }
  }
  return {
    kind: "bookmark", from: candidate.from, to: lineEnd, url: finalizedUrl,
    title: primaryTitle, description: resolved.secondaryText,
    ...(siteName ? { siteName } : {}), ...(provider ? { provider } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
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

const finalizeBlockCandidate = (
  candidate: OpenContainerCandidate,
  lineEnd: number
): EditorContainerBlock | null => {
  if (candidate.kind === "callout") {
    const parsed = parseCalloutContainerPayload(
      candidate.rawHeader,
      candidate.bodyLines,
      candidate.quotedTitle
    )
    return {
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
    }
  }
  if (candidate.kind === "toggle") {
    return {
      kind: "toggle",
      from: candidate.from,
      to: lineEnd,
      title: candidate.rawTitle.trim() || "토글 블록",
      body: candidate.bodyLines.join("\n").trim(),
      bodyOffset: candidate.bodyOffset,
    }
  }
  return finalizeCustomContainerBlock(candidate, lineEnd)
}

export const parseBlockContainerBlocks = (docText: string): EditorContainerBlock[] => {
  if (!docText.includes(":::") && !docText.includes("<aside")) return []

  const { codeBlockRanges, commentRanges } = parseCommonMarkBlockRanges(docText)
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

    const isInComment = isLineStartInCommentRanges(commentRanges, lineText, lineStart)
    const isInCommonMarkCode =
      overlapsSortedRanges(codeBlockRanges, lineStart, Math.max(lineStart + 1, lineEnd)) ||
      hasCommonMarkCodeIndent(lineText)

    const fenceMatch = isInComment ? null : FENCE_DELIMITER_LINE_RE.exec(lineText)
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
      if (!isInComment && !hasCommonMarkCodeIndent(lineText)) {
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
      if (!isInComment && !hasCommonMarkCodeIndent(lineText)) {
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
            const finalized = finalizeBlockCandidate(candidate, lineEnd)
            if (finalized) blocks.push(finalized)
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
      }
      candidate.bodyLines.push(lineText)
      continue
    }

    if (isInComment || isInCommonMarkCode) {
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
        rawHeader: resolveCalloutDirectiveRawHeader(open),
        quotedTitle: open.quotedTitle,
        bodyLines: [],
      }
      continue
    }
    if (open.kind === "toggle") {
      const rawTitle = open.quotedTitle !== null ? open.quotedTitle : open.remainder
      candidate = {
        kind: "toggle",
        from: lineStart,
        bodyOffset: Math.max(0, offset - lineStart),
        fenceStack: [open.fenceLength],
        rawTitle,
        bodyLines: [],
      }
      continue
    }
    const custom = parseCustomDirectiveFromOpening(open)
    if (!custom) continue
    const url = custom.rawUrl.trim()
    candidate = !url || normalizeSafeMarkdownUrl(url)
      ? { kind: custom.directive, from: lineStart, fenceStack: [open.fenceLength], url, inlineTitle: custom.inlineTitle, bodyLines: [] }
      : null
  }

  return blocks
}
