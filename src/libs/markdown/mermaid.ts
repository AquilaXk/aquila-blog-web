const normalizeLineEndings = (raw: string) => raw.replace(/\r\n?/g, "\n")

const normalizeFenceChars = (raw: string) => raw.replace(/[｀´ˋ'‘’]/g, "`")
const stripInvisibleChars = (raw: string) => raw.replace(/[\u200B-\u200D\uFEFF]/g, "")
const SEQUENCE_DECLARATION_REGEX = /\b(participant|actor)\s+(.+?)(?=\s+(?:participant|actor)\s+|$)/gi
const MERMAID_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

const stripWrappingQuotes = (value: string) => {
  const trimmed = value.trim()
  const match = trimmed.match(/^["'`](.*)["'`]$/)
  return match ? match[1] : trimmed
}

const escapeMermaidQuotedText = (value: string) => {
  let escaped = ""
  for (const char of value) {
    if (char === "\\") {
      escaped += "\\\\"
      continue
    }
    if (char === '"') {
      escaped += '\\"'
      continue
    }
    if (char === "\n") {
      escaped += "\\n"
      continue
    }
    if (char === "\r") continue
    escaped += char
  }
  return escaped
}

const buildMermaidIdentifier = (
  raw: string,
  kind: "participant" | "actor",
  usedIdentifiers: Set<string>
) => {
  const preferred =
    stripWrappingQuotes(raw)
      .replace(/<br\s*\/?>/gi, "_")
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "") || (kind === "actor" ? "Actor" : "Participant")
  const base = /^[0-9]/.test(preferred) ? `${kind}_${preferred}` : preferred

  let candidate = base
  let suffix = 2
  while (usedIdentifiers.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  usedIdentifiers.add(candidate)
  return candidate
}

const normalizeSequenceParticipantAliases = (source: string) => {
  const lines = source.split("\n")
  const normalized: string[] = []
  const aliasByRawToken = new Map<string, string>()
  const usedIdentifiers = new Set<string>()
  let inSequenceDiagram = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!inSequenceDiagram && /^sequenceDiagram\b/i.test(trimmed)) {
      inSequenceDiagram = true
      normalized.push(line)
      continue
    }

    if (!inSequenceDiagram) {
      normalized.push(line)
      continue
    }

    const declarationMatches = Array.from(trimmed.matchAll(SEQUENCE_DECLARATION_REGEX))
    const normalizedTrimmed = trimmed.replace(/\s+/g, " ").trim().toLowerCase()
    const isOnlyDeclarationsLine =
      declarationMatches.length > 0 &&
      declarationMatches
        .map((match) => `${match[1]} ${match[2]}`.trim())
        .join(" ")
        .trim()
        .toLowerCase() === normalizedTrimmed

    if (isOnlyDeclarationsLine) {
      const indent = line.match(/^\s*/)?.[0] || ""
      declarationMatches.forEach((match) => {
        const kind = (match[1].toLowerCase() === "actor" ? "actor" : "participant") as
          | "participant"
          | "actor"
        const declarationBody = (match[2] || "").trim()
        if (!declarationBody) return

        const aliasMatch = declarationBody.match(/^(.+?)\s+as\s+(.+)$/i)
        if (aliasMatch) {
          const identifier = aliasMatch[1].trim()
          if (MERMAID_IDENTIFIER_PATTERN.test(identifier)) {
            usedIdentifiers.add(identifier)
          }
          normalized.push(`${indent}${kind} ${declarationBody}`)
          return
        }

        if (MERMAID_IDENTIFIER_PATTERN.test(declarationBody)) {
          usedIdentifiers.add(declarationBody)
          normalized.push(`${indent}${kind} ${declarationBody}`)
          return
        }

        const identifier = buildMermaidIdentifier(declarationBody, kind, usedIdentifiers)
        aliasByRawToken.set(declarationBody, identifier)
        const label = escapeMermaidQuotedText(stripWrappingQuotes(declarationBody))
        normalized.push(`${indent}${kind} ${identifier} as "${label}"`)
      })
      continue
    }

    if (aliasByRawToken.size > 0 && /-{1,2}.+>/.test(line)) {
      let rewritten = line
      aliasByRawToken.forEach((identifier, rawToken) => {
        rewritten = rewritten.split(rawToken).join(identifier)
      })
      normalized.push(rewritten)
      continue
    }

    normalized.push(line)
  }

  return normalized.join("\n")
}

const isLikelyFenceLeadCode = (code: number): boolean =>
  code === 0x60 ||
  code === 0x7e ||
  code === 0x5c ||
  code === 0x27 ||
  code === 0xb4 ||
  code === 0x2cb ||
  code === 0x2018 ||
  code === 0x2019 ||
  code === 0xff40 ||
  (code >= 0x200b && code <= 0x200d) ||
  code === 0xfeff

const hasUniformMarkerRun = (fence: string, marker: string): boolean => {
  for (let index = 0; index < fence.length; index += 1) {
    if (fence[index] !== marker) return false
  }
  return true
}

const parseFenceLine = (rawLine: string) => {
  let cursor = 0
  while (
    cursor < rawLine.length &&
    (rawLine.codePointAt(cursor) === 0x20 || rawLine.codePointAt(cursor) === 0x09)
  ) {
    cursor += 1
  }
  if (cursor >= rawLine.length || !isLikelyFenceLeadCode(rawLine.codePointAt(cursor) ?? 0)) {
    return null
  }

  const normalized = normalizeFenceChars(stripInvisibleChars(rawLine)).trim()
  const unescapedEscapedFence = normalized.replaceAll("\\`", "`").replaceAll("\\~", "~")
  const unescaped = unescapedEscapedFence.startsWith("\\")
    ? unescapedEscapedFence.slice(1).trimStart()
    : unescapedEscapedFence
  const match = unescaped.match(/^([`~]{3,})(.*)$/)
  if (!match) return null

  const fence = match[1]
  const marker = fence[0]
  if (!hasUniformMarkerRun(fence, marker)) return null

  return {
    marker,
    tail: (match[2] || "").trim(),
  }
}

const extractFirstFencedMermaidSource = (normalized: string) => {
  const lines = normalized.split("\n")
  let startIndex = -1
  let fenceMarker: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseFenceLine(lines[index])
    if (!parsed) continue
    if (parsed.tail.toLowerCase() !== "mermaid") continue

    startIndex = index
    fenceMarker = parsed.marker
    break
  }

  if (startIndex < 0 || !fenceMarker) return ""

  const body: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const parsed = parseFenceLine(lines[index])
    if (parsed && parsed.marker === fenceMarker) {
      return body.join("\n").trim()
    }
    body.push(lines[index])
  }

  return body.join("\n").trim()
}

export const normalizeEscapedMermaidFences = (raw: string): string => {
  if (!raw || !/mermaid/i.test(raw)) return raw

  const lines = normalizeLineEndings(raw).split("\n")
  const normalized: string[] = []

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const parsedStartFence = parseFenceLine(line)
    const isMermaidFenceStart =
      parsedStartFence &&
      parsedStartFence.tail.length > 0 &&
      parsedStartFence.tail.toLowerCase() === "mermaid"

    if (!isMermaidFenceStart) {
      normalized.push(line)
      index += 1
      continue
    }

    normalized.push("```mermaid")
    index += 1

    while (index < lines.length) {
      const current = lines[index]
      const parsedEndFence = parseFenceLine(current)
      if (parsedEndFence && parsedEndFence.tail.length === 0) {
        normalized.push("```")
        index += 1
        break
      }
      normalized.push(current)
      index += 1
    }
  }

  return normalized.join("\n")
}

export const hasPotentialFenceCharacters = (raw: string): boolean => {
  if (!raw) return false
  return (
    raw.includes("```") ||
    raw.includes("~~~") ||
    /mermaid/i.test(raw) ||
    /[｀´ˋ'‘’]{3}/.test(raw)
  )
}

export const stepFenceNormalization = (
  line: string,
  activeFenceMarker: string | null,
  normalized: string[]
): string | null => {
  const parsed = parseFenceLine(line)

  if (!activeFenceMarker) {
    if (!parsed) {
      normalized.push(line)
      return null
    }
    const openingTail = parsed.tail ? parsed.tail : ""
    normalized.push(`${parsed.marker.repeat(3)}${openingTail}`)
    return parsed.marker
  }

  if (!parsed || parsed.marker !== activeFenceMarker) {
    normalized.push(line)
    return activeFenceMarker
  }

  normalized.push(activeFenceMarker.repeat(3))
  if (parsed.tail.length > 0) {
    normalized.push(parsed.tail)
  }
  return null
}

export const normalizeEscapedMarkdownFences = (raw: string): string => {
  if (!hasPotentialFenceCharacters(raw)) {
    return raw
  }

  const lines = normalizeLineEndings(raw).split("\n")
  const normalized: string[] = []
  let activeFenceMarker: string | null = null

  for (const line of lines) {
    activeFenceMarker = stepFenceNormalization(line, activeFenceMarker, normalized)
  }

  if (activeFenceMarker) {
    normalized.push(activeFenceMarker.repeat(3))
  }

  return normalizeEscapedMermaidFences(normalized.join("\n"))
}

export const extractNormalizedMermaidSource = (raw: string): string => {
  const normalized = normalizeEscapedMarkdownFences(raw).trim()
  if (!normalized) return ""

  const fencedSource = extractFirstFencedMermaidSource(normalized)
  if (fencedSource) return normalizeSequenceParticipantAliases(fencedSource).trim()

  return normalizeSequenceParticipantAliases(normalized).trim()
}

const FLOWCHART_HEADER_PATTERN = /^\s*(?:flowchart|graph)\b/i
const WRAP_LINE_MAX_UNITS = 24
const WRAP_MIN_TRIGGER_UNITS = 32
const MERMAID_WRAP_SKIP_DIRECTIVE_PATTERN =
  /^\s*(?:%%|subgraph\b|end\b|style\b|linkStyle\b|classDef\b|class\b|click\b)/i

export const computeTextUnits = (text: string): number => {
  let sum = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0
    if (code > 0xffff) i += 1
    sum += code > 0x7f ? 1.75 : 1
  }
  return sum
}

const mergeSoftWrapChunks = (chunks: string[]) => {
  const lines: string[] = []
  let current = ""
  let currentUnits = 0

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const chunkUnits = computeTextUnits(trimmed)
    const nextUnits = current ? currentUnits + 1 + chunkUnits : chunkUnits
    if (nextUnits <= WRAP_LINE_MAX_UNITS) {
      current = current ? `${current} ${trimmed}` : trimmed
      currentUnits = nextUnits
      continue
    }
    if (current) lines.push(current)
    current = trimmed
    currentUnits = chunkUnits
  }

  if (current) lines.push(current)
  return lines
}

const splitLongToken = (token: string) => {
  const output: string[] = []
  let chunkStart = 0
  let currentUnits = 0

  for (let index = 0; index < token.length; ) {
    const code = token.codePointAt(index) ?? 0
    const step = code > 0xffff ? 2 : 1
    const charUnits = code > 0x7f ? 1.75 : 1
    if (currentUnits + charUnits > WRAP_LINE_MAX_UNITS && index > chunkStart) {
      output.push(token.slice(chunkStart, index))
      chunkStart = index
      currentUnits = charUnits
    } else {
      currentUnits += charUnits
    }
    index += step
  }

  if (chunkStart < token.length) {
    output.push(token.slice(chunkStart))
  }
  return output
}

const toSoftWrappedText = (label: string) => {
  const normalized = label.replace(/\s+/g, " ").trim()
  if (!normalized) return normalized
  if (/<br\s*\/?>/i.test(normalized) || /\\n/.test(normalized)) return normalized
  if (/https?:\/\/|www\./i.test(normalized)) return normalized
  if (computeTextUnits(normalized) < WRAP_MIN_TRIGGER_UNITS) return normalized

  const baseTokens = normalized.split(/\s+/).filter(Boolean)
  const expandedTokens = baseTokens.flatMap((token) => {
    if (computeTextUnits(token) <= WRAP_LINE_MAX_UNITS) return [token]
    if (/[/|,+>\-–—]/.test(token)) {
      return token
        .split(/([/|,+>\-–—])/)
        .map((part) => part.trim())
        .filter(Boolean)
    }
    return splitLongToken(token)
  })

  const lines = mergeSoftWrapChunks(expandedTokens)
  if (lines.length <= 1) return normalized
  return lines.join("<br/>")
}

const wrapNodeLabel = (label: string) => {
  const trimmed = label.trim()
  const quotedMatch = trimmed.match(/^(['"`])(.*)\1$/)
  const inner = quotedMatch ? quotedMatch[2] : trimmed
  const wrapped = toSoftWrappedText(inner)
  if (wrapped === inner) return label
  const escaped = escapeMermaidQuotedText(wrapped)
  return `"${escaped}"`
}

const wrapEdgeLabel = (label: string) => toSoftWrappedText(label)

const applySoftWrapToFlowchartLine = (line: string) => {
  if (!line.trim() || MERMAID_WRAP_SKIP_DIRECTIVE_PATTERN.test(line)) return line

  let nextLine = line.replace(/\|([^|\n]+)\|/g, (full, label) => {
    const wrapped = wrapEdgeLabel(label)
    return wrapped === label ? full : `|${wrapped}|`
  })

  const replacers: Array<{ regex: RegExp; open: string; close: string }> = [
    { regex: /\[\[([^\]\n]+)\]\]/g, open: "[[", close: "]]" },
    { regex: /\(\(([^\)\n]+)\)\)/g, open: "((", close: "))" },
    { regex: /\[\(([^\)\n]+)\)\]/g, open: "[(", close: ")]" },
    { regex: /\(\[([^\]\n]+)\]\)/g, open: "([", close: "])" },
    { regex: /\[([^\]\n]+)\]/g, open: "[", close: "]" },
    { regex: /\{([^}\n]+)\}/g, open: "{", close: "}" },
    { regex: /\(([^()\n]+)\)/g, open: "(", close: ")" },
  ]

  replacers.forEach(({ regex, open, close }) => {
    nextLine = nextLine.replace(regex, (full, label) => {
      const wrapped = wrapNodeLabel(label)
      return wrapped === label ? full : `${open}${wrapped}${close}`
    })
  })

  return nextLine
}

export const applyMermaidSoftWrapHints = (source: string) => {
  const normalized = source.trim()
  if (!normalized) return normalized
  if (!FLOWCHART_HEADER_PATTERN.test(normalized)) return normalized

  return normalized
    .split("\n")
    .map((line) => applySoftWrapToFlowchartLine(line))
    .join("\n")
}
