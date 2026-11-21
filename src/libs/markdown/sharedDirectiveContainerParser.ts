export type ContainerDirectiveKind = "callout" | "toggle" | "bookmark" | "embed" | "file"

export type CustomDirectiveKind = "bookmark" | "embed" | "file"

export type ParsedOpeningDirectiveLine = {
  fenceLength: number
  kind: ContainerDirectiveKind
  rawName: string
  tail: string
  quotedTitle: string | null
  remainder: string
}

export type DirectiveCloseScanRanges = {
  lineStarts?: readonly number[]
  excludedRanges?: readonly { from: number; to: number }[]
  commentRanges?: readonly { from: number; to: number }[]
  overlapsRange?: (ranges: readonly { from: number; to: number }[], from: number, to: number) => boolean
  isCommentLineStart?: (commentRanges: readonly { from: number; to: number }[], line: string, lineStart: number) => boolean
}

const DIRECTIVE_ALIAS_MAP: Record<string, ContainerDirectiveKind> = {
  callout: "callout",
  toggle: "toggle",
  bookmark: "bookmark",
  embed: "embed",
  video: "embed",
  youtube: "embed",
  file: "file",
  attachment: "file",
  pdf: "file",
}

const isAsciiWhitespaceCode = (code: number): boolean => code === 32 || code === 9

const isDirectiveNameCharCode = (code: number): boolean =>
  (code >= 97 && code <= 122) ||
  (code >= 65 && code <= 90) ||
  (code >= 48 && code <= 57) ||
  code === 45 ||
  code === 95

const unescapeQuotedAttribute = (raw: string): string => {
  if (!raw.includes("\\")) return raw
  let out = ""
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1]!
      if (next === "\\" || next === '"' || next === "'") {
        out += next
        i += 1
        continue
      }
    }
    out += ch
  }
  return out
}

export const extractQuotedTitleAttribute = (
  rawTail: string
): { quotedTitle: string | null; remainder: string } => {
  const len = rawTail.length
  let index = 0
  while (index < len) {
    if (index > 0 && !isAsciiWhitespaceCode(rawTail.charCodeAt(index - 1))) {
      const ch = rawTail.charCodeAt(index)
      if (ch === 34 || ch === 39) {
        const quote = ch
        index += 1
        while (index < len) {
          if (rawTail.charCodeAt(index) === 92 && index + 1 < len) {
            index += 2
            continue
          }
          if (rawTail.charCodeAt(index) === quote) break
          index += 1
        }
      }
      index += 1
      continue
    }

    if (
      index + 7 <= len &&
      rawTail.slice(index, index + 6).toLowerCase() === "title=" &&
      (rawTail.charCodeAt(index + 6) === 34 || rawTail.charCodeAt(index + 6) === 39)
    ) {
      const quote = rawTail.charCodeAt(index + 6)
      let cursor = index + 7
      let closed = false
      while (cursor < len) {
        const c = rawTail.charCodeAt(cursor)
        if (c === 92 && cursor + 1 < len) {
          cursor += 2
          continue
        }
        if (c === quote) {
          closed = true
          break
        }
        cursor += 1
      }
      if (closed && (cursor + 1 === len || isAsciiWhitespaceCode(rawTail.charCodeAt(cursor + 1)))) {
        const quotedTitle = unescapeQuotedAttribute(rawTail.slice(index + 7, cursor))
        const before = rawTail.slice(0, index).trimEnd()
        const after = rawTail.slice(cursor + 1).trimStart()
        const remainder = before && after ? `${before} ${after}` : before || after
        return { quotedTitle, remainder }
      }
    }
    index += 1
  }
  return { quotedTitle: null, remainder: rawTail.trim() }
}

export const canonicalizeContainerDirectiveName = (rawName: string): ContainerDirectiveKind | null => {
  const key = rawName.toLowerCase()
  return Object.hasOwn(DIRECTIVE_ALIAS_MAP, key) ? DIRECTIVE_ALIAS_MAP[key]! : null
}

export const resolveClosingDirectiveFenceLength = (rawLine: string): number => {
  const end = rawLine.endsWith("\r") ? rawLine.length - 1 : rawLine.length
  let colonCount = 0
  while (colonCount < end && rawLine.charCodeAt(colonCount) === 58) {
    colonCount += 1
  }
  if (colonCount < 3) return 0
  for (let i = colonCount; i < end; i += 1) {
    if (!isAsciiWhitespaceCode(rawLine.charCodeAt(i))) return 0
  }
  return colonCount
}

export const parseOpeningDirectiveLine = (rawLine: string): ParsedOpeningDirectiveLine | null => {
  const end = rawLine.endsWith("\r") ? rawLine.length - 1 : rawLine.length
  let fenceLength = 0
  while (fenceLength < end && rawLine.charCodeAt(fenceLength) === 58) {
    fenceLength += 1
  }
  if (fenceLength < 3 || fenceLength >= end) return null

  let nameEnd = fenceLength
  while (nameEnd < end && isDirectiveNameCharCode(rawLine.charCodeAt(nameEnd))) {
    nameEnd += 1
  }
  if (nameEnd === fenceLength) return null
  if (nameEnd < end && !isAsciiWhitespaceCode(rawLine.charCodeAt(nameEnd))) return null

  const rawName = rawLine.slice(fenceLength, nameEnd)
  const kind = canonicalizeContainerDirectiveName(rawName)
  if (!kind) return null

  const tail = rawLine.slice(nameEnd, end).trim()
  const { quotedTitle, remainder } = extractQuotedTitleAttribute(tail)
  return {
    fenceLength,
    kind,
    rawName: rawName.toLowerCase(),
    tail,
    quotedTitle,
    remainder,
  }
}

export const isSupportedOpeningDirectiveLine = (rawLine: string): boolean =>
  parseOpeningDirectiveLine(rawLine) !== null

export const parseCustomDirectiveFromOpening = (
  open: ParsedOpeningDirectiveLine
): { directive: CustomDirectiveKind; rawUrl: string; inlineTitle: string; fenceLength: number } | null => {
  if (open.kind !== "bookmark" && open.kind !== "embed" && open.kind !== "file") {
    return null
  }
  const rem = open.remainder.trim()
  if (!rem) {
    return {
      directive: open.kind,
      rawUrl: "",
      inlineTitle: open.quotedTitle ?? "",
      fenceLength: open.fenceLength,
    }
  }
  const urlSpace = rem.search(/\s/)
  if (urlSpace < 0) {
    return {
      directive: open.kind,
      rawUrl: rem,
      inlineTitle: open.quotedTitle ?? "",
      fenceLength: open.fenceLength,
    }
  }
  return {
    directive: open.kind,
    rawUrl: rem.slice(0, urlSpace),
    inlineTitle: open.quotedTitle || rem.slice(urlSpace).trim(),
    fenceLength: open.fenceLength,
  }
}

const parseCodeFenceDelimiter = (
  rawLine: string
): { marker: number; length: number; info: string } | null => {
  const end = rawLine.endsWith("\r") ? rawLine.length - 1 : rawLine.length
  let pos = 0
  while (pos < end) {
    const c = rawLine.charCodeAt(pos)
    if (c === 32 || c === 9 || c === 62) {
      pos += 1
      continue
    }
    break
  }
  let spaces = 0
  while (pos + spaces < end && rawLine.charCodeAt(pos + spaces) === 32 && spaces < 4) {
    spaces += 1
  }
  if (spaces >= 4) return null
  const start = pos + spaces
  if (start >= end) return null
  const marker = rawLine.charCodeAt(start)
  if (marker !== 96 && marker !== 126) return null
  let length = 0
  while (start + length < end && rawLine.charCodeAt(start + length) === marker) {
    length += 1
  }
  if (length < 3) return null
  const info = rawLine.slice(start + length, end)
  if (marker === 96 && info.includes("`")) return null
  return { marker, length, info }
}

export const findClosingDirectiveFenceLine = (
  lines: readonly string[],
  startIndex: number,
  openFenceLength = 3,
  scanRanges?: DirectiveCloseScanRanges
): number => {
  const lineStarts = scanRanges?.lineStarts ?? []
  const excludedRanges = scanRanges?.excludedRanges ?? []
  const commentRanges = scanRanges?.commentRanges ?? []
  const overlapsRange = scanRanges?.overlapsRange
  const isCommentLineStart = scanRanges?.isCommentLineStart
  const trackCodeFences = lineStarts.length === 0

  const fenceStack: number[] = [Math.max(3, openFenceLength)]
  let inFence = false
  let fenceMarker = 0
  let fenceLength = 0

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!
    if (trackCodeFences) {
      const fence = parseCodeFenceDelimiter(line)
      if (fence) {
        if (!inFence) {
          inFence = true
          fenceMarker = fence.marker
          fenceLength = fence.length
          continue
        }
        if (fence.marker === fenceMarker && fence.length >= fenceLength && fence.info.trim() === "") {
          inFence = false
          fenceMarker = 0
          fenceLength = 0
          continue
        }
      }
      if (inFence) continue
    } else {
      const lineStart = lineStarts[index]
      if (lineStart !== undefined) {
        const inExcluded =
          overlapsRange &&
          excludedRanges.length > 0 &&
          overlapsRange(excludedRanges, lineStart, lineStart + Math.max(1, line.length))
        const inComment =
          isCommentLineStart &&
          commentRanges.length > 0 &&
          isCommentLineStart(commentRanges, line, lineStart)
        if (inExcluded || inComment) continue
      }
    }

    const closeLen = resolveClosingDirectiveFenceLength(line)
    if (closeLen >= 3) {
      while (fenceStack.length > 0 && closeLen > fenceStack[fenceStack.length - 1]!) {
        fenceStack.pop()
        if (fenceStack.length === 0) return index
      }
      if (fenceStack.length > 0 && closeLen >= fenceStack[fenceStack.length - 1]!) {
        fenceStack.pop()
        if (fenceStack.length === 0) return index
      }
      continue
    }

    const nestedOpen = parseOpeningDirectiveLine(line)
    const topFence = fenceStack[fenceStack.length - 1] ?? 3
    if (nestedOpen && nestedOpen.fenceLength < topFence) {
      fenceStack.push(nestedOpen.fenceLength)
    }
  }
  return -1
}
