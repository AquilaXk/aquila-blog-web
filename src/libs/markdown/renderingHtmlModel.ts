import {
  extractNormalizedMermaidSource,
  normalizeEscapedMermaidFences,
} from "src/libs/markdown/mermaid"
import { normalizePublicPostImageUrl } from "src/libs/markdown/postImageUrlPolicy"
import { renderImmediateCodeToHtml } from "src/libs/markdown/prismRuntime"

const MERMAID_SOURCE_PATTERN =
  /^(%%\{|\s*(?:info|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|c4Context|C4Context|xychart-beta)\b)/

const HTML_ENTITY_MAP: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: "\"",
  "#39": "'",
  "#x27": "'",
  apos: "'",
}

const HTML_ATTRIBUTE_REGEX = /([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const HTML_CODE_BLOCK_REGEX = /<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi
const HTML_CODE_CONTAINER_OPEN_REGEX = /<(div|section|figure)\b([^>]*)>/gi

const HAS_FENCED_CODE_BLOCK_REGEX = /(^|\n)\s*[`~]{3,}[\w-]*[\t ]*\n[\s\S]*?\n[`~]{3,}(?=\n|$)/
const HAS_MERMAID_BLOCK_REGEX = /(^|\n)\s*[`~]{3,}\s*mermaid\b[\t ]*\n[\s\S]*?\n[`~]{3,}(?=\n|$)/i
const containsTokenByCharCodes = (text: string, token: number[]) => {
  if (!text || token.length === 0 || text.length < token.length) return false

  outer: for (let i = 0; i <= text.length - token.length; i += 1) {
    for (let j = 0; j < token.length; j += 1) {
      if (text.charCodeAt(i + j) !== token[j]) {
        continue outer
      }
    }
    return true
  }

  return false
}

const hasMermaidConnectorOrKeyword = (source: string) => {
  const normalized = source.toLowerCase()
  if (/\b(subgraph|end)\b/.test(normalized)) return true

  const connectorTokens = [
    [45, 45, 62],
    [61, 61, 62],
    [45, 46, 45, 62],
    [58, 58, 58],
  ]

  return connectorTokens.some((token) => containsTokenByCharCodes(normalized, token))
}

const decodeHtmlEntitiesOnce = (raw: string) =>
  raw.replace(/&(lt|gt|amp|quot|#39|#x27|apos|#\d+|#x[0-9a-f]+);/gi, (entity, key: string) => {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey.startsWith("#x")) {
      const codePoint = Number.parseInt(normalizedKey.slice(2), 16)
      return decodeHtmlCodePoint(entity, codePoint)
    }
    if (normalizedKey.startsWith("#")) {
      const codePoint = Number.parseInt(normalizedKey.slice(1), 10)
      return decodeHtmlCodePoint(entity, codePoint)
    }

    const decoded = HTML_ENTITY_MAP[normalizedKey]
    return decoded ?? entity
  })

const escapeHtml = (raw: string) =>
  raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")

const escapeHtmlAttribute = (raw: string) => escapeHtml(raw).replaceAll("\n", "&#10;")

const renderMermaidPre = (source: string) =>
  `<pre class="aq-mermaid" data-aq-mermaid="true" data-mermaid-rendered="pending" data-mermaid-source="${escapeHtmlAttribute(source)}"><code class="language-mermaid">${escapeHtml(source)}</code></pre>`

const decodeHtmlCodePoint = (entity: string, codePoint: number) =>
  Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : entity

const BLOCK_BREAK_TAGS = new Set(["p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"])

const isAsciiWhitespace = (char: string) => char === " " || char === "\n" || char === "\t" || char === "\r"

const isAsciiAlphaNumeric = (char: string) => {
  const code = char.charCodeAt(0)
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  )
}

const extractPlainTextByHtmlScanner = (rawHtml: string) => {
  let index = 0
  let plainText = ""

  while (index < rawHtml.length) {
    const currentChar = rawHtml[index]
    if (currentChar !== "<") {
      plainText += currentChar
      index += 1
      continue
    }

    const tagEndIndex = rawHtml.indexOf(">", index + 1)
    if (tagEndIndex < 0) {
      plainText += rawHtml.slice(index)
      break
    }

    const rawTagBody = rawHtml.slice(index + 1, tagEndIndex).trim()
    if (rawTagBody.length === 0 || rawTagBody.startsWith("!")) {
      index = tagEndIndex + 1
      continue
    }

    let tagPointer = 0
    let closing = false
    if (rawTagBody[tagPointer] === "/") {
      closing = true
      tagPointer += 1
      while (tagPointer < rawTagBody.length && isAsciiWhitespace(rawTagBody[tagPointer])) {
        tagPointer += 1
      }
    }

    const tagNameStart = tagPointer
    while (tagPointer < rawTagBody.length && isAsciiAlphaNumeric(rawTagBody[tagPointer])) {
      tagPointer += 1
    }
    const tagName = rawTagBody.slice(tagNameStart, tagPointer).toLowerCase()

    if (!closing && BLOCK_BREAK_TAGS.has(tagName)) {
      plainText += "\n"
    }

    index = tagEndIndex + 1
  }

  return plainText
}

const extractPlainTextFromHtml = (rawHtml: string) => {
  if (!rawHtml) return ""
  if (!rawHtml.includes("<")) return decodeHtmlEntitiesOnce(rawHtml)

  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(rawHtml, "text/html")

    doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"))
    doc.querySelectorAll("p,div,li,tr,h1,h2,h3,h4,h5,h6").forEach((el) => el.append("\n"))

    return doc.body.textContent || ""
  }

  return decodeHtmlEntitiesOnce(extractPlainTextByHtmlScanner(rawHtml))
}

const extractMermaidSource = (rawCode: string) => {
  return extractNormalizedMermaidSource(extractPlainTextFromHtml(rawCode))
}

export const isMermaidSource = (rawCode: string) => {
  const normalized = extractMermaidSource(rawCode).trimStart()
  if (!normalized) return false
  return MERMAID_SOURCE_PATTERN.test(normalized)
}

const normalizeMermaidCodeBlocksInHtml = (html: string) =>
  html.replace(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (full, rawCodeAttrs, rawCodeBody) => {
    const attrs = String(rawCodeAttrs || "")
    const lowerAttrs = attrs.toLowerCase()
    const hasMermaidClass =
      lowerAttrs.includes("language-mermaid") || lowerAttrs.includes("data-language=\"mermaid\"")
    const source = extractMermaidSource(String(rawCodeBody || ""))
    const looksLikeMermaid = MERMAID_SOURCE_PATTERN.test(source)
    if (!hasMermaidClass && !looksLikeMermaid) return full
    if (!source) return full

    return renderMermaidPre(source)
  })

const normalizeMermaidParagraphsInHtml = (html: string) =>
  html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (full, rawBody) => {
    const body = String(rawBody || "")
    const normalizedText = normalizeEscapedMermaidFences(extractPlainTextFromHtml(body)).trim()
    if (!normalizedText) return full

    const hasMermaidFence =
      /^`{3,}\s*mermaid\b/i.test(normalizedText) || /^\\`{3,}\s*mermaid\b/i.test(body.trim())
    const source = extractMermaidSource(body)
    const looksLikeMermaid = MERMAID_SOURCE_PATTERN.test(source) && hasMermaidConnectorOrKeyword(source)

    if (!hasMermaidFence && !looksLikeMermaid) return full
    if (!source) return full

    return renderMermaidPre(source)
  })

const normalizeStandaloneMermaidPreBlocksInHtml = (html: string) =>
  html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (full, rawPreAttrs, rawBody) => {
    if (/<code\b/i.test(rawBody)) return full

    const attrs = String(rawPreAttrs || "")
    const lowerAttrs = attrs.toLowerCase()
    const hasMermaidHint =
      lowerAttrs.includes("aq-mermaid") ||
      lowerAttrs.includes("language-mermaid") ||
      lowerAttrs.includes("data-language=\"mermaid\"") ||
      lowerAttrs.includes("data-language='mermaid'")

    const source = extractMermaidSource(String(rawBody || ""))
    const looksLikeMermaid = MERMAID_SOURCE_PATTERN.test(source)

    if (!hasMermaidHint && !looksLikeMermaid) return full
    if (!source) return full

    return renderMermaidPre(source)
  })

const readHtmlAttribute = (rawAttrs: string, name: string) => {
  const normalizedName = name.toLowerCase()
  HTML_ATTRIBUTE_REGEX.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = HTML_ATTRIBUTE_REGEX.exec(rawAttrs))) {
    if (match[1]?.toLowerCase() !== normalizedName) continue
    return decodeHtmlEntitiesOnce(match[2] ?? match[3] ?? match[4] ?? "")
  }

  return ""
}

const stripHtmlAttributes = (rawAttrs: string, names: Set<string>) => {
  HTML_ATTRIBUTE_REGEX.lastIndex = 0
  return rawAttrs
    .replace(HTML_ATTRIBUTE_REGEX, (full, rawName: string) => (names.has(rawName.toLowerCase()) ? "" : full))
    .replace(/\s+/g, " ")
    .trim()
}

const mergeClassNames = (...classNames: string[]) => {
  const tokens = new Set<string>()
  for (const className of classNames) {
    className
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => tokens.add(token))
  }
  return Array.from(tokens).join(" ")
}

const countHtmlTags = (source: string, tagName: string, closing: boolean) => {
  const pattern = new RegExp(closing ? `</${tagName}\\s*>` : `<${tagName}\\b`, "gi")
  return source.match(pattern)?.length ?? 0
}

const extractNearestCodeContainerAttrs = (html: string, preOffset: number) => {
  const prefix = html.slice(0, preOffset)
  const candidates: Array<{ attrs: string; index: number; tagName: string }> = []
  HTML_CODE_CONTAINER_OPEN_REGEX.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = HTML_CODE_CONTAINER_OPEN_REGEX.exec(prefix))) {
    candidates.push({
      attrs: match[2] || "",
      index: match.index,
      tagName: (match[1] || "").toLowerCase(),
    })
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]
    if (
      !readHtmlAttribute(candidate.attrs, "data-raw-code") &&
      !readHtmlAttribute(candidate.attrs, "data-prism-source")
    ) {
      continue
    }

    const segment = prefix.slice(candidate.index)
    const openCount = countHtmlTags(segment, candidate.tagName, false)
    const closeCount = countHtmlTags(segment, candidate.tagName, true)
    if (openCount > closeCount) return candidate.attrs
  }

  return ""
}

const extractCodeLanguageFromAttrs = (rawPreAttrs: string, rawCodeAttrs: string, rawContainerAttrs: string) => {
  const explicitLanguage =
    readHtmlAttribute(rawCodeAttrs, "data-language") ||
    readHtmlAttribute(rawCodeAttrs, "data-prism-language") ||
    readHtmlAttribute(rawPreAttrs, "data-language") ||
    readHtmlAttribute(rawPreAttrs, "data-prism-language") ||
    readHtmlAttribute(rawContainerAttrs, "data-language") ||
    readHtmlAttribute(rawContainerAttrs, "data-prism-language")
  if (explicitLanguage) return explicitLanguage

  const className = `${readHtmlAttribute(rawCodeAttrs, "class")} ${readHtmlAttribute(rawPreAttrs, "class")} ${readHtmlAttribute(rawContainerAttrs, "class")}`
  return className.match(/(?:^|\s)language-([\w-]+)/)?.[1] || "text"
}

const extractCodeSourceFromHtmlBlock = (rawPreAttrs: string, rawCodeAttrs: string, rawContainerAttrs: string, rawCodeBody: string) =>
  readHtmlAttribute(rawCodeAttrs, "data-raw-code") ||
  readHtmlAttribute(rawCodeAttrs, "data-prism-source") ||
  readHtmlAttribute(rawPreAttrs, "data-raw-code") ||
  readHtmlAttribute(rawPreAttrs, "data-prism-source") ||
  readHtmlAttribute(rawContainerAttrs, "data-raw-code") ||
  readHtmlAttribute(rawContainerAttrs, "data-prism-source") ||
  extractPlainTextFromHtml(rawCodeBody)

const normalizeContentHtmlCodeBlocks = (html: string) =>
  html.replace(HTML_CODE_BLOCK_REGEX, (full, rawPreAttrs, rawCodeAttrs, rawCodeBody, offset) => {
    const preAttrs = String(rawPreAttrs || "")
    const codeAttrs = String(rawCodeAttrs || "")
    const containerAttrs = extractNearestCodeContainerAttrs(html, Number(offset) || 0)
    const source = extractCodeSourceFromHtmlBlock(preAttrs, codeAttrs, containerAttrs, String(rawCodeBody || ""))
    if (!source) return full

    const language = extractCodeLanguageFromAttrs(preAttrs, codeAttrs, containerAttrs)
    const codeClassName = readHtmlAttribute(codeAttrs, "class")
    const hasMermaidHint =
      language.toLowerCase() === "mermaid" ||
      codeClassName.toLowerCase().includes("language-mermaid") ||
      readHtmlAttribute(preAttrs, "class").toLowerCase().includes("aq-mermaid") ||
      readHtmlAttribute(containerAttrs, "class").toLowerCase().includes("aq-mermaid")
    if (hasMermaidHint || isMermaidSource(source)) {
      const mermaidSource = extractMermaidSource(source)
      return mermaidSource ? renderMermaidPre(mermaidSource) : full
    }

    const presentation = renderImmediateCodeToHtml({ source, language })
    const retainedCodeAttrs = stripHtmlAttributes(
      codeAttrs,
      new Set(["class", "data-language", "data-prism-language", "data-prism-source", "data-raw-code"])
    )
    const normalizedClassName = mergeClassNames(codeClassName, `language-${presentation.language}`)
    const normalizedCodeAttrs = [
      retainedCodeAttrs,
      `class="${escapeHtmlAttribute(normalizedClassName)}"`,
      `data-language="${escapeHtmlAttribute(presentation.language)}"`,
      `data-prism-language="${escapeHtmlAttribute(presentation.language)}"`,
      `data-prism-source="${escapeHtmlAttribute(source)}"`,
      `data-raw-code="${escapeHtmlAttribute(source)}"`,
    ]
      .filter(Boolean)
      .join(" ")

    return `<pre${preAttrs}><code ${normalizedCodeAttrs}>${presentation.html}</code></pre>`
  })

export const normalizeContentHtmlForMermaid = (rawHtml: string): string =>
  rawHtml
    ? normalizeContentHtmlCodeBlocks(
      normalizeStandaloneMermaidPreBlocksInHtml(
        normalizeMermaidParagraphsInHtml(normalizeMermaidCodeBlocksInHtml(rawHtml))
      )
    )
    : ""

export const shouldPreferMarkdownPipeline = (markdown: string) => {
  if (!markdown.trim()) return false
  if (HAS_MERMAID_BLOCK_REGEX.test(markdown)) return true
  return HAS_FENCED_CODE_BLOCK_REGEX.test(markdown)
}
const findHtmlTagAttribute = (tag: string, attribute: string) => {
  const tagName = tag.match(/^<[^\s/>]+/)
  if (!tagName) return null

  let cursor = tagName[0].length
  while (cursor < tag.length) {
    const start = cursor
    while (/\s/.test(tag[cursor] ?? "")) cursor += 1
    if (!tag[cursor] || tag[cursor] === ">" || tag[cursor] === "/") break

    const nameStart = cursor
    while (tag[cursor] && !/[\s=/>]/.test(tag[cursor])) cursor += 1
    const name = tag.slice(nameStart, cursor)
    while (/\s/.test(tag[cursor] ?? "")) cursor += 1

    let value = ""
    if (tag[cursor] === "=") {
      cursor += 1
      while (/\s/.test(tag[cursor] ?? "")) cursor += 1
      const quote = tag[cursor] === '"' || tag[cursor] === "'" ? tag[cursor] : null
      if (quote) {
        cursor += 1
        const valueStart = cursor
        while (tag[cursor] && tag[cursor] !== quote) cursor += 1
        value = tag.slice(valueStart, cursor)
        if (tag[cursor] === quote) cursor += 1
      } else {
        const valueStart = cursor
        while (tag[cursor] && !/[\s>]/.test(tag[cursor])) cursor += 1
        value = tag.slice(valueStart, cursor)
      }
    }
    if (name.toLowerCase() === attribute.toLowerCase()) return { start, end: cursor, value }
  }
  return null
}

const getHtmlTagAttribute = (tag: string, attribute: string) =>
  findHtmlTagAttribute(tag, attribute)?.value ?? ""

const removeHtmlTagAttribute = (tag: string, attribute: string) => {
  let filteredTag = tag
  let match = findHtmlTagAttribute(filteredTag, attribute)
  while (match) {
    filteredTag = `${filteredTag.slice(0, match.start)}${filteredTag.slice(match.end)}`
    match = findHtmlTagAttribute(filteredTag, attribute)
  }
  return filteredTag
}

const rewriteHtmlTagSrc = (tag: string, safeSrc: string) =>
  removeHtmlTagAttribute(tag, "src").replace(/(\s*\/?>)$/, ` src="${safeSrc}"$1`)

export const filterTrustedPostImageHtml = (html: string) => {
  const withoutResponsiveSources = html.replace(/<source\b[^>]*>/gi, (tag) =>
    getHtmlTagAttribute(tag, "srcset") ? "" : tag)

  return withoutResponsiveSources.replace(/<img\b[^>]*>/gi, (tag) => {
    const safeSrc = normalizePublicPostImageUrl(getHtmlTagAttribute(tag, "src"))
    if (safeSrc) return rewriteHtmlTagSrc(removeHtmlTagAttribute(tag, "srcset"), safeSrc)
    const blockedLabel = getHtmlTagAttribute(tag, "alt") || "차단된 이미지"
    return `<span class="aq-image-blocked" role="img" aria-label="${escapeHtmlAttribute(blockedLabel)}">${escapeHtml(blockedLabel)}</span>`
  })
}
