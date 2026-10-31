import {
  countCodePointRun,
  findLineEndOffset,
  hasBlankLineBetween,
  isEscapedMarkdownAt,
  matchFencedCodeBlockEnd,
  scanInlineCodeSpanEnd,
  scanPandocDisplayMathAt,
  scanPandocInlineMathAt,
} from "./pandocMathScanner"

const AUTOLINK_SCHEMES = ["http://", "https://", "ftp://", "mailto:"] as const
const ESCAPED_DOLLAR_TOKEN = String.raw`\$`

const isAtLineStart = (text: string, index: number): boolean =>
  index === 0 || text.codePointAt(index - 1) === 10

const isAsciiAlphaNumericCode = (code: number): boolean => {
  const isDigit = code >= 48 && code <= 57
  const isUpper = code >= 65 && code <= 90
  const isLower = code >= 97 && code <= 122
  return isDigit || isUpper || isLower
}

const skipSpacesAndTabs = (text: string, start: number): number => {
  let cursor = start
  while (cursor < text.length && (text.codePointAt(cursor) === 32 || text.codePointAt(cursor) === 9)) {
    cursor += 1
  }
  return cursor
}

const matchHtmlCommentEnd = (text: string, index: number): number => {
  if (!text.startsWith("<!--", index)) return -1
  const closeIdx = text.indexOf("-->", index + 4)
  return closeIdx < 0 ? text.length : closeIdx + 3
}

const scanAutolinkClosingAngle = (text: string, start: number): number => {
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 62) return cursor + 1
    if (code <= 32 || code === 60) return -1
  }
  return -1
}

const matchAutolinkEnd = (text: string, index: number): number => {
  if (text.codePointAt(index) !== 60) return -1
  const probe = text.slice(index + 1, index + 12).toLowerCase()
  if (!AUTOLINK_SCHEMES.some((scheme) => probe.startsWith(scheme))) return -1
  return scanAutolinkClosingAngle(text, index + 2)
}

const isBareUrlStopCode = (code: number): boolean =>
  code <= 32 || code === 60 || code === 62 || code === 41

const matchBareUrlEnd = (text: string, index: number): number => {
  const lowerSlice = text.slice(index, index + 8).toLowerCase()
  if (!lowerSlice.startsWith("http://") && !lowerSlice.startsWith("https://")) return -1
  if (index > 0 && isAsciiAlphaNumericCode(text.codePointAt(index - 1) ?? 0)) return -1
  let cursor = index + 7
  while (cursor < text.length && !isBareUrlStopCode(text.codePointAt(cursor) ?? 0)) {
    cursor += 1
  }
  return cursor
}

const resolveAngleDestinationClose = (text: string, angleClose: number): number => {
  const closeParen = text.indexOf(")", angleClose + 1)
  if (closeParen < 0 || hasBlankLineBetween(text, angleClose + 1, closeParen)) return -1
  return closeParen + 1
}

const scanAngleBracketDestination = (text: string, openAngle: number): number => {
  for (let cursor = openAngle + 1; cursor < text.length; cursor += 1) {
    const code = text.codePointAt(cursor) ?? 0
    if (code === 10 || code === 13 || code === 60) return -1
    if (code === 62 && !isEscapedMarkdownAt(text, cursor)) {
      return resolveAngleDestinationClose(text, cursor)
    }
  }
  return -1
}

const isBlankLineAfterNewline = (text: string, newlinePos: number): boolean =>
  text.slice(newlinePos + 1, findLineEndOffset(text, newlinePos + 1)).trim() === ""

const adjustParenDepthAt = (text: string, pos: number, depth: number): number => {
  if (isEscapedMarkdownAt(text, pos)) return depth
  const code = text.codePointAt(pos) ?? 0
  if (code === 40) return depth + 1
  return code === 41 ? depth - 1 : depth
}

const scanBalancedParenDestination = (text: string, start: number): number => {
  let depth = 1
  for (let pos = start; pos < text.length; pos += 1) {
    if (text.codePointAt(pos) === 10 && isBlankLineAfterNewline(text, pos)) return -1
    depth = adjustParenDepthAt(text, pos, depth)
    if (depth === 0) return pos + 1
  }
  return -1
}

const matchLinkDestinationEnd = (text: string, index: number): number => {
  if (
    text.codePointAt(index) !== 93 ||
    text.codePointAt(index + 1) !== 40 ||
    isEscapedMarkdownAt(text, index)
  ) {
    return -1
  }
  const cursor = skipSpacesAndTabs(text, index + 2)
  return text.codePointAt(cursor) === 60
    ? scanAngleBracketDestination(text, cursor)
    : scanBalancedParenDestination(text, cursor)
}

const skipUnescapedBacktickAt = (text: string, index: number): number => {
  if (isEscapedMarkdownAt(text, index)) return -1
  const codeEnd = scanInlineCodeSpanEnd(text, index)
  return codeEnd > index ? codeEnd : index + countCodePointRun(text, index, 96)
}

const skipAngleConstructAt = (text: string, index: number): number => {
  const commentEnd = matchHtmlCommentEnd(text, index)
  return commentEnd > index ? commentEnd : matchAutolinkEnd(text, index)
}

const trySkipLiteralConstructAt = (text: string, index: number): number => {
  if (isAtLineStart(text, index)) {
    const fenceEnd = matchFencedCodeBlockEnd(text, index)
    if (fenceEnd > index) return fenceEnd
  }
  const code = text.codePointAt(index) ?? 0
  if (code === 96) return skipUnescapedBacktickAt(text, index)
  if (code === 60) return skipAngleConstructAt(text, index)
  if (code === 93) return matchLinkDestinationEnd(text, index)
  if (code === 104 || code === 72) return matchBareUrlEnd(text, index)
  return -1
}

const handleDollarSequenceAt = (
  markdown: string,
  index: number
): { validMathEnd: number; nextIndex: number; escapeCount: number } => {
  const runLen = countCodePointRun(markdown, index, 36)
  if (runLen > 2) {
    return { validMathEnd: -1, nextIndex: index + runLen, escapeCount: runLen }
  }
  if (runLen === 2) {
    const displayToken = scanPandocDisplayMathAt(markdown, index)
    if (displayToken) {
      return { validMathEnd: displayToken.to, nextIndex: displayToken.to, escapeCount: 0 }
    }
    return { validMathEnd: -1, nextIndex: index + 2, escapeCount: 2 }
  }
  const inlineToken = scanPandocInlineMathAt(markdown, index)
  if (inlineToken) {
    return { validMathEnd: inlineToken.to, nextIndex: inlineToken.to, escapeCount: 0 }
  }
  return { validMathEnd: -1, nextIndex: index + 1, escapeCount: 1 }
}

const advancePastNonDollarAt = (markdown: string, index: number): number => {
  const skippedEnd = trySkipLiteralConstructAt(markdown, index)
  if (skippedEnd > index) return skippedEnd
  if (markdown.codePointAt(index) !== 36 || isEscapedMarkdownAt(markdown, index)) {
    return index + 1
  }
  return index
}

export const hasValidMarkdownMath = (markdown: string): boolean => {
  if (!markdown.includes("$")) return false
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index)
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

const buildProtectedInlineSentinels = (nonce: number): ProtectedInlineSentinels => {
  const prefix = `\uE000aqp${nonce}_`
  return {
    prefix,
    eq: `${prefix}eq\uE001`,
    lt: `${prefix}lt\uE001`,
    lb: `${prefix}lb\uE001`,
    rb: `${prefix}rb\uE001`,
    entityPattern: new RegExp(`${prefix}ent[0-9]+\uE001`, "g"),
  }
}

export const DEFAULT_PROTECTED_INLINE_SENTINELS = buildProtectedInlineSentinels(0)

export const createProtectedInlineSentinels = (source: string): ProtectedInlineSentinels => {
  let nonce = 0
  while (source.includes(`aqp${nonce}_`)) {
    nonce += 1
  }
  return nonce === 0 ? DEFAULT_PROTECTED_INLINE_SENTINELS : buildProtectedInlineSentinels(nonce)
}

const LT_ENTITY_PREFIX_PATTERN = /^&(?:lt|#0*60|#x0*3c);/i

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
    token: `${sentinels.prefix}ent${registry.entityByRaw.size}\uE001`,
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
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const next = advancePastNonDollarAt(markdown, index)
    if (next > index) {
      index = next
      continue
    }
    const step = handleDollarSequenceAt(markdown, index)
    if (step.escapeCount > 0) {
      output += `${markdown.slice(copyFrom, index)}${ESCAPED_DOLLAR_TOKEN.repeat(step.escapeCount)}`
      copyFrom = index + step.escapeCount
    }
    index = step.nextIndex
  }
  return copyFrom === 0 ? markdown : `${output}${markdown.slice(copyFrom)}`
}

const advancePastSkippedConstructAt = (markdown: string, index: number): number => {
  const skippedEnd = trySkipLiteralConstructAt(markdown, index)
  if (skippedEnd > index) return skippedEnd
  const code = markdown.codePointAt(index) ?? 0
  if (code === 36 && !isEscapedMarkdownAt(markdown, index)) {
    return handleDollarSequenceAt(markdown, index).nextIndex
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
  const registry: TokenRegistry = { seenTokens: new Map(), entityByRaw: new Map() }
  let output = ""
  let copyFrom = 0
  let index = 0
  while (index < markdown.length) {
    const jumped = advancePastSkippedConstructAt(markdown, index)
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
