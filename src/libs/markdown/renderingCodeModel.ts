import { type ReactElement, type ReactNode, isValidElement } from "react"

const LANGUAGE_LABEL_MAP: Record<string, string> = {
  text: "TXT",
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  java: "Java",
  kt: "Kotlin",
  kotlin: "Kotlin",
  py: "Python",
  python: "Python",
  sh: "Shell",
  shell: "Shell",
  bash: "Bash",
  md: "Markdown",
  markdown: "Markdown",
  yml: "YAML",
  yaml: "YAML",
  sql: "SQL",
  json: "JSON",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  scss: "SCSS",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  mermaid: "Mermaid",
}

const extractTextFromNode = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("\n")
  if (!isValidElement(node)) return ""
  return extractTextFromNode((node.props as { children?: ReactNode }).children)
}

const readAstProperties = (node: unknown): Record<string, unknown> => {
  if (!node || typeof node !== "object") return {}
  const properties = (node as { properties?: unknown }).properties
  return properties && typeof properties === "object" ? properties as Record<string, unknown> : {}
}

const findCodeAstNode = (node: unknown): unknown => {
  if (!node || typeof node !== "object") return null
  if (String((node as { tagName?: unknown }).tagName || "").toLowerCase() === "code") return node
  const children = (node as { children?: unknown }).children
  if (!Array.isArray(children)) return null
  return children.find((child) => String((child as { tagName?: unknown })?.tagName || "").toLowerCase() === "code") || null
}

const readClassName = (...values: unknown[]): string =>
  values
    .flatMap((value) => {
      if (typeof value === "string") return [value]
      if (!Array.isArray(value)) return []
      return value.filter((item): item is string => typeof item === "string")
    })
    .join(" ")

const readLanguageAttribute = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value !== "string") continue
    const normalized = value.trim().toLowerCase()
    if (normalized) return normalized
  }
  return ""
}

const readCodeMeta = (node: unknown): string => {
  if (!node || typeof node !== "object") return ""
  const data = (node as { data?: unknown }).data
  const dataMeta = data && typeof data === "object" ? (data as { meta?: unknown }).meta : ""
  const meta = (node as { meta?: unknown }).meta || dataMeta
  return typeof meta === "string" ? meta.trim() : ""
}

const unquoteMetaValue = (value: string) => value.trim().replace(/^["']|["']$/g, "")

const extractCodeTitle = (meta: string) => {
  const titleMatch = meta.match(/(?:^|\s)title=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i)
  if (titleMatch) return unquoteMetaValue(titleMatch[1] || titleMatch[2] || titleMatch[3] || "")
  const filenameMatch = meta.match(/(?:^|\s)filename=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i)
  if (filenameMatch) return unquoteMetaValue(filenameMatch[1] || filenameMatch[2] || filenameMatch[3] || "")
  return ""
}

export const extractCodeHighlightSpec = (meta: string): string => {
  if (!meta || !meta.includes("{")) return ""
  const match = meta.match(/\{([\d,\s-]+)\}/)
  return match?.[1]?.replace(/\s+/g, "") || ""
}

const MAX_HIGHLIGHT_LINE_NUMBER = 100_000
const MAX_HIGHLIGHT_TOTAL_LINES = 2_000

export const parseHighlightedLineNumbers = (meta: string): Set<number> => {
  const result = new Set<number>()
  if (!meta) return result
  const rawSpec = meta.includes("{") ? extractCodeHighlightSpec(meta) : meta
  const tokens = rawSpec.split(",")
  for (let i = 0; i < tokens.length && result.size < MAX_HIGHLIGHT_TOTAL_LINES; i += 1) {
    const token = tokens[i].trim()
    if (!token) continue
    const dashIndex = token.indexOf("-")
    if (dashIndex > 0) {
      const start = Number.parseInt(token.slice(0, dashIndex), 10)
      const end = Number.parseInt(token.slice(dashIndex + 1), 10)
      if (
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start > 0 &&
        start <= MAX_HIGHLIGHT_LINE_NUMBER &&
        end >= start
      ) {
        const cappedEnd = Math.min(
          end,
          start + MAX_HIGHLIGHT_TOTAL_LINES,
          MAX_HIGHLIGHT_LINE_NUMBER
        )
        for (let line = start; line <= cappedEnd && result.size < MAX_HIGHLIGHT_TOTAL_LINES; line += 1) {
          result.add(line)
        }
      }
    } else {
      const single = Number.parseInt(token, 10)
      if (
        Number.isSafeInteger(single) &&
        single > 0 &&
        single <= MAX_HIGHLIGHT_LINE_NUMBER &&
        result.size < MAX_HIGHLIGHT_TOTAL_LINES
      ) {
        result.add(single)
      }
    }
  }
  return result
}

export const extractTextFromCodeAst = (node: unknown): string => {
  if (!node || typeof node !== "object") return ""

  const textValue = (node as { value?: unknown }).value
  if (typeof textValue === "string" || typeof textValue === "number") {
    return String(textValue)
  }

  const children = (node as { children?: unknown }).children
  if (!Array.isArray(children)) return ""
  return children.map(extractTextFromCodeAst).join("")
}

export type ExtractedCodeMeta = {
  language: string
  title: string
  rawCode: string
  highlightLines?: string
}

export const extractCodeMetaFromPreChildren = (
  children: ReactNode,
  preNode?: unknown
): ExtractedCodeMeta => {
  const list = Array.isArray(children) ? children : [children]
  const codeElement = list.find(
    (child): child is ReactElement<Record<string, unknown>> =>
      isValidElement(child) && typeof child.type === "string" && child.type.toLowerCase() === "code"
  )
  const codeAstNode = codeElement?.props.node || findCodeAstNode(preNode)
  const astProperties = readAstProperties(codeAstNode)

  const codeClassName = readClassName(codeElement?.props.className, astProperties.className)
  const classLanguage =
    codeClassName
      .split(" ")
      .map((token) => token.trim())
      .find((token) => token.startsWith("language-"))
      ?.replace("language-", "")
      .toLowerCase() || ""

  const dataLanguage = readLanguageAttribute(
    codeElement?.props["data-language"],
    astProperties["data-language"],
    astProperties.dataLanguage
  )
  const dataRawCode =
    typeof codeElement?.props["data-raw-code"] === "string"
      ? String(codeElement.props["data-raw-code"])
      : ""

  const codeChildren = (codeElement?.props.children as ReactNode | undefined) ?? children
  const rawCodeFromChildren = extractTextFromNode(codeChildren)
  const rawCodeFromAst = extractTextFromCodeAst(codeAstNode)
  const rawCode = (dataRawCode || rawCodeFromChildren || rawCodeFromAst).replace(/\n$/, "")
  const meta = readCodeMeta(codeAstNode)
  const highlightLines = extractCodeHighlightSpec(meta)

  return {
    language: dataLanguage || classLanguage || "text",
    title: extractCodeTitle(meta),
    rawCode,
    ...(highlightLines ? { highlightLines } : {}),
  }
}

export const toLanguageLabel = (lang: string) => {
  const normalized = lang.trim().toLowerCase()
  if (!normalized) return "TXT"
  return LANGUAGE_LABEL_MAP[normalized] || normalized.toUpperCase()
}

export const hashString = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
