import { isOffsetInsideInlineCodeSpan } from "../../components/markdown-editor/markdownEditorHtmlPasteModel"
import {
  parseOpeningDirectiveLine,
  resolveClosingDirectiveFenceLength,
} from "../../libs/markdown/sharedDirectiveContainerParser"

export type MarkdownPrePublishWarning =
  | { kind: "unclosed-fence"; line: number }
  | { kind: "unclosed-directive"; line: number }
  | { kind: "placeholder-marker"; line: number; token: string }
  | { kind: "body-h1"; count: number; firstLine: number }
  | { kind: "content-too-long"; length: number; maxLength: number }

const MAX_POST_BODY_LENGTH = 500_000

const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/
const ATX_H1_RE = /^ {0,3}#(?:\s+|$)/

const findPlaceholderTokenOutsideInlineCode = (line: string, fullDocOffset: number, fullDoc: string): string | null => {
  if (!line.includes("TK") && !line.includes("TODO") && !line.includes("todo")) return null
  const tokenRe = /\b(TK|TODO)\b/gi
  let match = tokenRe.exec(line)
  while (match) {
    const raw = match[1] ?? ""
    const isValidCase = raw === "TK" || raw.toUpperCase() === "TODO"
    if (isValidCase && !isOffsetInsideInlineCodeSpan(fullDoc, fullDocOffset + match.index)) {
      return raw.toUpperCase()
    }
    match = tokenRe.exec(line)
  }
  return null
}

export const scanMarkdownPrePublishWarnings = (content: string): MarkdownPrePublishWarning[] => {
  if (!content.trim()) return []
  const normalized = content.replace(/\r\n?/g, "\n")
  let openFence: { char: string; len: number; line: number } | null = null
  const containerStack: Array<{ len: number; line: number }> = []
  let firstPlaceholder: { line: number; token: string } | null = null
  let bodyH1Count = 0
  let firstBodyH1Line = 0

  let pos = 0
  let lineNo = 1
  while (pos <= normalized.length) {
    const nextBreak = normalized.indexOf("\n", pos)
    const lineEnd = nextBreak === -1 ? normalized.length : nextBreak
    const line = normalized.slice(pos, lineEnd)
    const trimmed = line.trim()

    if (openFence) {
      const closeMatch = /^( {0,3})(`{3,}|~{3,})\s*$/.exec(trimmed)
      if (
        closeMatch &&
        closeMatch[2]?.[0] === openFence.char &&
        (closeMatch[2]?.length ?? 0) >= openFence.len
      ) {
        openFence = null
      }
    } else {
      const fenceMatch = FENCE_OPEN_RE.exec(trimmed)
      if (fenceMatch) {
        const marker = fenceMatch[2] ?? "```"
        const info = fenceMatch[3] ?? ""
        if (marker[0] === "~" || !info.includes("`")) {
          openFence = { char: marker[0]!, len: marker.length, line: lineNo }
        }
      } else {
        const closeLen = containerStack.length > 0 ? resolveClosingDirectiveFenceLength(trimmed) : 0
        if (closeLen >= (containerStack[containerStack.length - 1]?.len ?? Number.POSITIVE_INFINITY)) {
          containerStack.pop()
        } else {
          const openContainer = parseOpeningDirectiveLine(trimmed)
          if (openContainer) {
            containerStack.push({ len: openContainer.fenceLength, line: lineNo })
          }
        }

        if (ATX_H1_RE.test(line)) {
          if (bodyH1Count === 0) firstBodyH1Line = lineNo
          bodyH1Count += 1
        }

        if (!firstPlaceholder) {
          const token = findPlaceholderTokenOutsideInlineCode(line, pos, normalized)
          if (token) {
            firstPlaceholder = { line: lineNo, token }
          }
        }
      }
    }

    if (nextBreak === -1) break
    pos = nextBreak + 1
    lineNo += 1
  }

  const warnings: MarkdownPrePublishWarning[] = []
  if (openFence) {
    warnings.push({ kind: "unclosed-fence", line: openFence.line })
  }
  if (containerStack.length > 0) {
    warnings.push({ kind: "unclosed-directive", line: containerStack[0]!.line })
  }
  if (firstPlaceholder) {
    warnings.push({
      kind: "placeholder-marker",
      line: firstPlaceholder.line,
      token: firstPlaceholder.token,
    })
  }
  if (bodyH1Count > 0) {
    warnings.push({ kind: "body-h1", count: bodyH1Count, firstLine: firstBodyH1Line })
  }
  if (normalized.length > MAX_POST_BODY_LENGTH) {
    warnings.push({ kind: "content-too-long", length: normalized.length, maxLength: MAX_POST_BODY_LENGTH })
  }
  return warnings
}
