import { isAsciiAlphaNumericCode } from "./asciiScannerTable"
import { collectCommonMarkCodeBlockRanges } from "./commonMarkCodeBlockRanges"
import {
  countCodePointRun,
  findContainingSortedRangeEnd,
  isEscapedMarkdownAt,
  matchAutolinkEnd,
  matchBareUrlEnd,
  matchHtmlCommentEnd,
  matchLinkDestinationEnd,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
  type MathSpanRange,
} from "./pandocMathScanner"

const ESCAPED_DOLLAR_TOKEN = String.raw`\$`

const skipUnescapedBacktickAt = (text: string, index: number): number => {
  if (isEscapedMarkdownAt(text, index)) return -1
  const codeEnd = scanInlineCodeSpanEnd(text, index)
  return codeEnd > index ? codeEnd : index + countCodePointRun(text, index, 96)
}

const skipAngleConstructAt = (text: string, index: number): number => {
  const commentEnd = matchHtmlCommentEnd(text, index)
  return commentEnd > index ? commentEnd : matchAutolinkEnd(text, index)
}

const trySkipLiteralConstructAt = (
  text: string,
  index: number,
  codeBlockRanges: readonly MathSpanRange[]
): number => {
  const codeBlockEnd = findContainingSortedRangeEnd(codeBlockRanges, index)
  if (codeBlockEnd > index) return codeBlockEnd
  const code = text.codePointAt(index) ?? 0
  if (code === 96) return skipUnescapedBacktickAt(text, index)
  if (code === 60) return skipAngleConstructAt(text, index)
  if (code === 93) return matchLinkDestinationEnd(text, index)
  if (code === 104 || code === 72) return matchBareUrlEnd(text, index)
  return -1
}

const handleDollarSequenceAt = (
  markdown: string,
  index: number,
  codeBlockRanges: readonly MathSpanRange[]
): { validMathEnd: number; nextIndex: number; escapeCount: number } => {
  const runLen = countCodePointRun(markdown, index, 36)
  if (runLen > 2) {
    return { validMathEnd: -1, nextIndex: index + runLen, escapeCount: runLen }
  }
  if (runLen === 2) {
    const displayToken = scanPandocDisplayMathAt(markdown, index, {
      excludedRanges: codeBlockRanges,
    })
    if (displayToken) {
      return { validMathEnd: displayToken.to, nextIndex: displayToken.to, escapeCount: 0 }
    }
    return { validMathEnd: -1, nextIndex: index + 2, escapeCount: 2 }
  }
  const inlineToken = scanPandocInlineMathAt(markdown, index, {
    excludedRanges: codeBlockRanges,
  })
  if (inlineToken) {
    return { validMathEnd: inlineToken.to, nextIndex: inlineToken.to, escapeCount: 0 }
  }
  return { validMathEnd: -1, nextIndex: index + 1, escapeCount: 1 }
}

const advancePastNonDollarAt = (
  markdown: string,
  index: number,
  codeBlockRanges: readonly MathSpanRange[]
): number => {
  const skippedEnd = trySkipLiteralConstructAt(markdown, index, codeBlockRanges)
  if (skippedEnd > index) return skippedEnd
  if (markdown.codePointAt(index) !== 36 || isEscapedMarkdownAt(markdown, index)) {
    return index + 1
  }
  return index
}

export const hasValidMarkdownMath = (markdown: string): boolean => {
  if (!markdown.includes("$")) return false
  const codeBlockRanges = collectCommonMarkCodeBlockRanges(markdown)
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index, codeBlockRanges)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index, codeBlockRanges)
    if (step.validMathEnd > index) return true
    index = step.nextIndex
  }
  return false
}

export type ProtectedInlineSentinels = {
  prefix: string
  eq: string
  lt: string
  lb: string
  rb: string
  entityPattern: RegExp
}

export type ProtectedInlineTokenEntry = {
  token: string
  raw: string
  unescaped: string
}

export type ProtectedMarkdownState = {
  markdown: string
  sentinels: ProtectedInlineSentinels
  tokens: readonly ProtectedInlineTokenEntry[]
}

const BACKSLASH_CHAR = String.fromCodePoint(92)
const NUMERIC_ENTITY_PROBE_PATTERN = /&#(?:[xX]([\da-fA-F]+)|(\d+));/g

const isValidUnicodeScalar = (codePoint: number): boolean =>
  Number.isInteger(codePoint) &&
  codePoint > 0 &&
  codePoint <= 0x10ffff &&
  (codePoint < 0xd800 || codePoint > 0xdfff)

const decodeNumericEntitiesForSentinelProbe = (source: string): string =>
  source.replace(NUMERIC_ENTITY_PROBE_PATTERN, (raw, hex?: string, dec?: string) => {
    const codePoint = hex ? Number.parseInt(hex, 16) : Number.parseInt(dec ?? "", 10)
    return isValidUnicodeScalar(codePoint) ? String.fromCodePoint(codePoint) : raw
  })

const buildProtectedInlineSentinels = (nonce: number): ProtectedInlineSentinels => {
  const prefix = `\uE000aqp${nonce}z`
  return {
    prefix,
    eq: `${prefix}eq\uE001`,
    lt: `${prefix}lt\uE001`,
    lb: `${prefix}lb\uE001`,
    rb: `${prefix}rb\uE001`,
    entityPattern: new RegExp(`${prefix}ent[0-9]+e\uE001`, "g"),
  }
}

export const DEFAULT_PROTECTED_INLINE_SENTINELS = buildProtectedInlineSentinels(0)

const MAX_32BIT_MASKED_NONCE = 31

const scanSentinelCollisionMask = (
  text: string,
  outsideAnglesOnly: boolean,
  initialMask: number,
  overflowNonces: Set<number>
): number => {
  let usedMask = initialMask
  let inAngle = false
  let state = 0
  let digitNonce = 0
  let hasLeadingZero = false

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (outsideAnglesOnly) {
      if (code === 60) {
        inAngle = true
        continue
      }
      if (code === 62 || code === 10 || code === 13 || code === 0xe000) {
        inAngle = false
        continue
      }
      if (inAngle) continue
    }
    if (!isAsciiAlphaNumericCode(code)) continue
    if (state === 3) {
      if (code >= 48 && code <= 57) {
        digitNonce = code - 48
        hasLeadingZero = code === 48
        state = 4
        continue
      }
      state = code === 97 ? 1 : 0
      continue
    }
    if (state === 4) {
      if (code >= 48 && code <= 57) {
        if (hasLeadingZero) {
          state = 0
          continue
        }
        const nextNonce = digitNonce * 10 + (code - 48)
        if (nextNonce <= Number.MAX_SAFE_INTEGER) {
          digitNonce = nextNonce
        } else {
          state = 0
        }
        continue
      }
      if (code === 122) {
        if (digitNonce <= MAX_32BIT_MASKED_NONCE) usedMask |= 1 << digitNonce
        else overflowNonces.add(digitNonce)
        state = 0
        continue
      }
      state = code === 97 ? 1 : 0
      continue
    }
    if (code === 97) state = 1
    else if (state === 1 && code === 113) state = 2
    else if (state === 2 && code === 112) state = 3
    else state = 0
  }

  return usedMask
}

export const createProtectedInlineSentinels = (source: string): ProtectedInlineSentinels => {
  const hasNumericEntity = source.includes("&#")
  if (!hasNumericEntity && !source.includes("a")) {
    return DEFAULT_PROTECTED_INLINE_SENTINELS
  }
  const overflowNonces = new Set<number>()
  let usedMask = scanSentinelCollisionMask(source, false, 0, overflowNonces)
  usedMask = scanSentinelCollisionMask(source, true, usedMask, overflowNonces)
  if (hasNumericEntity) {
    const decoded = decodeNumericEntitiesForSentinelProbe(source)
    usedMask = scanSentinelCollisionMask(decoded, false, usedMask, overflowNonces)
    usedMask = scanSentinelCollisionMask(decoded, true, usedMask, overflowNonces)
  }
  const freeMask = ~usedMask
  if (freeMask !== 0) {
    const lowestFreeBit = freeMask & -freeMask
    const nonce = 31 - Math.clz32(lowestFreeBit)
    return nonce === 0 ? DEFAULT_PROTECTED_INLINE_SENTINELS : buildProtectedInlineSentinels(nonce)
  }
  let nonce = 32
  while (overflowNonces.has(nonce)) nonce += 1
  return buildProtectedInlineSentinels(nonce)
}

const LT_ENTITY_PREFIX_PATTERN = /^&(?:lt|LT|#0*60|#[xX]0*3[cC]);/

const resolveBackslashProtectedEntry = (
  nextCode: number,
  sentinels: ProtectedInlineSentinels
): ProtectedInlineTokenEntry | null => {
  if (nextCode === 61) return { token: sentinels.eq, raw: String.raw`\=`, unescaped: "=" }
  if (nextCode === 60) return { token: sentinels.lt, raw: String.raw`\<`, unescaped: "<" }
  if (nextCode === 123) return { token: sentinels.lb, raw: String.raw`\{`, unescaped: "{" }
  if (nextCode === 125) return { token: sentinels.rb, raw: String.raw`\}`, unescaped: "}" }
  return null
}

const matchLtEntityAt = (markdown: string, index: number): string | null => {
  if (markdown.codePointAt(index) !== 38 || isEscapedMarkdownAt(markdown, index)) return null
  return LT_ENTITY_PREFIX_PATTERN.exec(markdown.slice(index, index + 32))?.[0] ?? null
}

type TokenRegistry = {
  seenTokens: Map<string, ProtectedInlineTokenEntry>
  entityByRaw: Map<string, ProtectedInlineTokenEntry>
}

const registerProtectedEntry = (
  registry: TokenRegistry,
  entry: ProtectedInlineTokenEntry
): ProtectedInlineTokenEntry => {
  if (!registry.seenTokens.has(entry.token)) {
    registry.seenTokens.set(entry.token, entry)
  }
  return entry
}

const registerEntityToken = (
  registry: TokenRegistry,
  sentinels: ProtectedInlineSentinels,
  raw: string
): ProtectedInlineTokenEntry => {
  const existing = registry.entityByRaw.get(raw)
  if (existing) return existing
  const entry: ProtectedInlineTokenEntry = {
    token: `${sentinels.prefix}ent${registry.entityByRaw.size}e\uE001`,
    raw,
    unescaped: "<",
  }
  registry.entityByRaw.set(raw, entry)
  return registerProtectedEntry(registry, entry)
}

const matchProtectedInlineTokenAt = (
  markdown: string,
  index: number,
  sentinels: ProtectedInlineSentinels,
  registry: TokenRegistry
): { length: number; token: string } | null => {
  const code = markdown.codePointAt(index) ?? 0
  if (code === 92 && !isEscapedMarkdownAt(markdown, index)) {
    const entry = resolveBackslashProtectedEntry(markdown.codePointAt(index + 1) ?? 0, sentinels)
    if (entry) {
      return { length: 2, token: registerProtectedEntry(registry, entry).token }
    }
  }
  const rawEntity = matchLtEntityAt(markdown, index)
  if (rawEntity) {
    return {
      length: rawEntity.length,
      token: registerEntityToken(registry, sentinels, rawEntity).token,
    }
  }
  return null
}

export const escapeNonPandocSingleDollars = (markdown: string): string => {
  if (!markdown.includes("$")) return markdown
  const codeBlockRanges = collectCommonMarkCodeBlockRanges(markdown)
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index, codeBlockRanges)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index, codeBlockRanges)
    if (step.escapeCount > 0) {
      output += `${markdown.slice(copyFrom, index)}${ESCAPED_DOLLAR_TOKEN.repeat(step.escapeCount)}`
      copyFrom = index + step.escapeCount
    }
    index = step.nextIndex
  }
  return copyFrom === 0 ? markdown : `${output}${markdown.slice(copyFrom)}`
}

const advancePastSkippedConstructAt = (
  markdown: string,
  index: number,
  codeBlockRanges: readonly MathSpanRange[]
): number => {
  const skippedEnd = trySkipLiteralConstructAt(markdown, index, codeBlockRanges)
  if (skippedEnd > index) return skippedEnd
  const code = markdown.codePointAt(index) ?? 0
  if (code === 36 && !isEscapedMarkdownAt(markdown, index)) {
    return handleDollarSequenceAt(markdown, index, codeBlockRanges).nextIndex
  }
  if (code === 92 && markdown.codePointAt(index + 1) === 92) {
    return index + 2
  }
  return -1
}

export const protectEscapedInlineSyntax = (
  markdown: string,
  sentinels: ProtectedInlineSentinels = createProtectedInlineSentinels(markdown)
): ProtectedMarkdownState => {
  if (!markdown.includes(BACKSLASH_CHAR) && !markdown.includes("&")) {
    return { markdown, sentinels, tokens: [] }
  }
  const codeBlockRanges = collectCommonMarkCodeBlockRanges(markdown)
  const registry: TokenRegistry = { seenTokens: new Map(), entityByRaw: new Map() }
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const jumped = advancePastSkippedConstructAt(markdown, index, codeBlockRanges)
    if (jumped > index) {
      index = jumped
      continue
    }
    const matched = matchProtectedInlineTokenAt(markdown, index, sentinels, registry)
    if (matched) {
      output += `${markdown.slice(copyFrom, index)}${matched.token}`
      copyFrom = index + matched.length
      index += matched.length
      continue
    }
    index += 1
  }
  if (copyFrom === 0) return { markdown, sentinels, tokens: [] }
  return {
    markdown: `${output}${markdown.slice(copyFrom)}`,
    sentinels,
    tokens: [...registry.seenTokens.values()],
  }
}

export const hasProtectedInlineSentinel = (
  text: string,
  sentinels: ProtectedInlineSentinels = DEFAULT_PROTECTED_INLINE_SENTINELS
): boolean => text.includes(sentinels.prefix)

export const restoreProtectedInlineText = (
  text: string,
  sentinels: ProtectedInlineSentinels = DEFAULT_PROTECTED_INLINE_SENTINELS
): string => {
  if (!text.includes(sentinels.prefix)) return text
  let restored = text
    .replaceAll(sentinels.eq, "=")
    .replaceAll(sentinels.lt, "<")
    .replaceAll(sentinels.lb, "{")
    .replaceAll(sentinels.rb, "}")
  if (restored.includes(`${sentinels.prefix}ent`)) {
    restored = restored.replace(sentinels.entityPattern, "<")
  }
  return restored
}

const restoreRawTokensInString = (value: string, state: ProtectedMarkdownState): string => {
  if (!value.includes(state.sentinels.prefix)) return value
  let restored = value
  for (const entry of state.tokens) {
    restored = restored.replaceAll(entry.token, entry.raw)
  }
  return restored
}

const RAW_RESTORE_MDAST_TYPES = new Set(["code", "inlineCode", "html", "math", "inlineMath"])
const ATTR_RESTORE_MDAST_TYPES = new Set(["image", "link", "definition"])
const ATTR_RESTORE_KEYS = ["alt", "title", "url"] as const

type MutableAstNode = {
  type?: unknown
  identifier?: unknown
  value?: unknown
  lang?: unknown
  meta?: unknown
  alt?: unknown
  title?: unknown
  url?: unknown
  data?: { hChildren?: unknown }
  children?: unknown
}

const restoreRawInHastSubtree = (nodes: unknown, state: ProtectedMarkdownState): void => {
  if (!Array.isArray(nodes)) return
  for (const child of nodes) {
    if (!child || typeof child !== "object") continue
    const record = child as MutableAstNode
    if (typeof record.value === "string") {
      record.value = restoreRawTokensInString(record.value, state)
    }
    restoreRawInHastSubtree(record.children, state)
  }
}

const restoreUnescapedAttributesOnNode = (
  node: MutableAstNode,
  sentinels: ProtectedInlineSentinels
): void => {
  for (const key of ATTR_RESTORE_KEYS) {
    const current = node[key]
    if (typeof current === "string") {
      node[key] = restoreProtectedInlineText(current, sentinels)
    }
  }
}

const collectDefinedIdentifiers = (node: unknown, definedIds: Set<string>): void => {
  if (!node || typeof node !== "object") return
  const current = node as MutableAstNode
  if (current.type === "definition") {
    const id = typeof current.identifier === "string" ? current.identifier.toUpperCase() : ""
    if (id) definedIds.add(id)
  }
  if (!Array.isArray(current.children)) return
  for (const child of current.children) {
    collectDefinedIdentifiers(child, definedIds)
  }
}

const restoreRawMdastNode = (
  node: MutableAstNode,
  nodeType: string,
  state: ProtectedMarkdownState
): void => {
  if (typeof node.value === "string") {
    node.value = restoreRawTokensInString(node.value, state)
  }
  if (nodeType === "code") {
    if (typeof node.lang === "string") {
      node.lang = restoreProtectedInlineText(node.lang, state.sentinels)
    }
    if (typeof node.meta === "string") {
      node.meta = restoreProtectedInlineText(node.meta, state.sentinels)
    }
  }
  restoreRawInHastSubtree(node.data?.hChildren, state)
}

const shouldRestoreNodeAttributes = (
  node: MutableAstNode,
  nodeType: string,
  definedIds: ReadonlySet<string>
): boolean => {
  if (ATTR_RESTORE_MDAST_TYPES.has(nodeType)) return true
  if (nodeType !== "imageReference") return false
  const id = typeof node.identifier === "string" ? node.identifier.toUpperCase() : ""
  return Boolean(id) && definedIds.has(id)
}

const walkMdastRestoreProtectedTokens = (
  node: unknown,
  state: ProtectedMarkdownState,
  definedIds: ReadonlySet<string>
): void => {
  if (!node || typeof node !== "object") return
  const current = node as MutableAstNode
  const nodeType = typeof current.type === "string" ? current.type : ""
  if (RAW_RESTORE_MDAST_TYPES.has(nodeType)) {
    restoreRawMdastNode(current, nodeType, state)
  } else if (shouldRestoreNodeAttributes(current, nodeType, definedIds)) {
    restoreUnescapedAttributesOnNode(current, state.sentinels)
  }
  if (!Array.isArray(current.children)) return
  for (const child of current.children) {
    walkMdastRestoreProtectedTokens(child, state, definedIds)
  }
}

export const remarkRestoreProtectedInlineTokens =
  (state: ProtectedMarkdownState) =>
  (tree: unknown): void => {
    if (state.tokens.length === 0) return
    const definedIds = new Set<string>()
    collectDefinedIdentifiers(tree, definedIds)
    walkMdastRestoreProtectedTokens(tree, state, definedIds)
  }
