export const HTML_PASTE_EMPTY_CONTENT_MESSAGE = "붙여넣을 수 있는 안전한 HTML 내용이 없습니다."

export type HtmlPasteImportResult =
  | { kind: "none" }
  | { kind: "markdown"; markdown: string }
  | { kind: "error"; message: typeof HTML_PASTE_EMPTY_CONTENT_MESSAGE }

const ACTIVE_TAGS = new Set([
  "base",
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "object",
  "script",
  "style",
  "svg",
  "select",
  "option",
  "template",
  "textarea",
])

const BLOCK_TAGS = new Set([
  "article",
  "aside",
  "blockquote",
  "div",
  "footer",
  "header",
  "main",
  "section",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ol",
  "p",
  "pre",
  "nav",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "ul",
])

const TABLE_CELL_TAGS = new Set(["td", "th"])

const escapeMarkdownText = (value: string) => value.replace(/[\\`*_{}\[\]()#+!|><~.=-]/g, "\\$&")

/** Canonical whitespace used for untrusted HTML text nodes and alt text. */
export const normalizeHtmlPasteText = (value: string): string => {
  const normalized = String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
  return /\S/.test(normalized) ? normalized : ""
}

const collapseExcessNewlines = (value: string): string => {
  let result = ""
  let consecutiveNewlines = 0
  for (const character of value) {
    if (character === "\n") {
      consecutiveNewlines += 1
      if (consecutiveNewlines <= 2) result += character
      continue
    }
    consecutiveNewlines = 0
    result += character
  }
  return result
}

const normalizeMarkdown = (value: string): string =>
  collapseExcessNewlines(value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n"))
    .trim()

export const createHtmlPasteEmptyResult = (): HtmlPasteImportResult => ({
  kind: "error",
  message: HTML_PASTE_EMPTY_CONTENT_MESSAGE,
})

/** `none` is reserved for the absence of HTML clipboard data, never a conversion fallback. */
export const resolveSafeHtmlPasteImportBoundary = (html: string | null): HtmlPasteImportResult | null => {
  if (html === null) return { kind: "none" }
  if (!normalizeHtmlPasteText(html).trim()) return createHtmlPasteEmptyResult()
  return null
}

/** Only credential-free absolute HTTP(S) links become Markdown destinations. */
export const resolveSafeHtmlPasteHref = (rawHref: string): string | null => {
  const href = rawHref.trim()
  if (!href) return null
  try {
    const url = new URL(href)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

const normalizeInlineHtmlPasteText = (value: string): string =>
  String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t\n]+/g, " ")

const inlineText = (value: string) => escapeMarkdownText(normalizeInlineHtmlPasteText(value))

const elementTag = (node: Node): string =>
  node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).tagName.toLowerCase() : ""

const isActiveNode = (node: Node) => ACTIVE_TAGS.has(elementTag(node))

const safeTextContent = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ""
  if (node.nodeType !== Node.ELEMENT_NODE || isActiveNode(node)) return ""
  return Array.from(node.childNodes).map(safeTextContent).join("")
}

const serializeCode = (element: HTMLElement): string => {
  const source = normalizeHtmlPasteText(safeTextContent(element)).trim()
  if (!source) return ""
  const longestBacktickRun = Math.max(0, ...Array.from(source.matchAll(/`+/g), (match) => match[0].length))
  const delimiter = "`".repeat(longestBacktickRun + 1)
  return `${delimiter}${source}${delimiter}`
}

const wrapInlineFormatting = (inner: string, delimiter: string): string => {
  let start = 0
  while (start < inner.length && !inner[start].trim()) start += 1
  let end = inner.length
  while (end > start && !inner[end - 1].trim()) end -= 1
  if (start === end) return inner
  return `${inner.slice(0, start)}${delimiter}${inner.slice(start, end)}${delimiter}${inner.slice(end)}`
}

const serializeInline = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return inlineText(node.textContent || "")
  if (node.nodeType !== Node.ELEMENT_NODE || isActiveNode(node)) return ""

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()
  const inner = Array.from(element.childNodes).map(serializeInline).join("")
  if (tag === "br") return "\n"
  if (tag === "strong" || tag === "b") return wrapInlineFormatting(inner, "**")
  if (tag === "em" || tag === "i") return wrapInlineFormatting(inner, "*")
  if (tag === "s" || tag === "del" || tag === "strike") return wrapInlineFormatting(inner, "~~")
  if (tag === "code") return serializeCode(element)
  if (tag === "a") {
    const href = resolveSafeHtmlPasteHref(element.getAttribute("href") || "")
    return href && inner ? `[${inner}](${href.replace(/[\\()]/g, "\\$&")})` : inner
  }
  if (tag === "img") return inlineText(element.getAttribute("alt") || "")
  return inner
}

const serializeListItemContent = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return inlineText(node.textContent || "")
  if (node.nodeType !== Node.ELEMENT_NODE || isActiveNode(node)) return ""

  const tag = elementTag(node)
  if (tag === "ol" || tag === "ul") return ""
  if (TABLE_CELL_TAGS.has(tag)) return serializeInline(node).trim()
  if (!BLOCK_TAGS.has(tag)) return serializeInline(node)

  return Array.from(node.childNodes)
    .map(serializeListItemContent)
    .filter(Boolean)
    .join("\n\n")
}

const serializeList = (element: HTMLElement, ordered: boolean): string => {
  const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li")
  return items
    .map((item, index) => {
      const contentChunks = Array.from(item.childNodes)
        .filter((child) => !["ol", "ul"].includes(elementTag(child)))
        .map((child) => ({ value: serializeListItemContent(child), block: BLOCK_TAGS.has(elementTag(child)) }))
        .filter((chunk) => Boolean(chunk.value))
      const content = contentChunks
        .reduce(
          (result, chunk, chunkIndex) => {
            const previousIsBlock = contentChunks[chunkIndex - 1]?.block || false
            const boundary = chunkIndex > 0 && (previousIsBlock || chunk.block) ? "\n\n" : ""
            return `${result}${boundary}${chunk.value}`
          },
          ""
        )
        .trim()
      const nested = Array.from(item.children)
        .filter((child) => ["ol", "ul"].includes(child.tagName.toLowerCase()))
        .map((child) => serializeList(child as HTMLElement, child.tagName.toLowerCase() === "ol"))
        .filter(Boolean)
        .map((value) => value.split("\n").map((line) => `  ${line}`).join("\n"))
      const marker = ordered ? `${index + 1}.` : "-"
      const contentLines = content.split("\n")
      const firstLine = contentLines.shift() || ""
      const itemLines = [
        `${marker}${firstLine ? ` ${firstLine}` : ""}`,
        ...contentLines.map((line) => `  ${line}`),
      ]
      return [...itemLines, ...nested].join("\n")
    })
    .join("\n")
}

const serializeBlock = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return inlineText(node.textContent || "")
  if (node.nodeType !== Node.ELEMENT_NODE || isActiveNode(node)) return ""

  const element = node as HTMLElement
  const tag = element.tagName.toLowerCase()
  if (TABLE_CELL_TAGS.has(tag)) return serializeInline(element).trim()
  if (tag === "tr") {
    return Array.from(element.children)
      .filter((child) => TABLE_CELL_TAGS.has(child.tagName.toLowerCase()))
      .map(serializeBlock)
      .filter(Boolean)
      .join(" ")
  }
  if (/^h[1-6]$/.test(tag)) {
    const content = serializeInline(element).trim()
    return content ? `${"#".repeat(Number(tag[1]))} ${content}` : ""
  }
  if (tag === "p") return serializeInline(element).trim()
  if (tag === "ul" || tag === "ol") return serializeList(element, tag === "ol")
  if (!BLOCK_TAGS.has(tag)) return serializeInline(element).trim()

  const blocks: string[] = []
  let inlineRun = ""
  const flushInlineRun = () => {
    const value = inlineRun.trim()
    if (value) blocks.push(value)
    inlineRun = ""
  }

  for (const child of Array.from(element.childNodes)) {
    if (!BLOCK_TAGS.has(elementTag(child))) {
      inlineRun += serializeInline(child)
      continue
    }
    flushInlineRun()
    const value = serializeBlock(child)
    if (value) blocks.push(value)
  }
  flushInlineRun()
  return blocks.join("\n\n")
}

/** Converts only the HTML clipboard allowlist; unsupported markup becomes safe text. */
export const convertSafeHtmlPasteToMarkdown = (html: string | null): HtmlPasteImportResult => {
  if (html === null) return { kind: "none" }
  const boundary = resolveSafeHtmlPasteImportBoundary(html)
  if (boundary) return boundary
  if (typeof DOMParser === "undefined") return createHtmlPasteEmptyResult()

  const document = new DOMParser().parseFromString(html, "text/html")
  const markdown = normalizeMarkdown(Array.from(document.body.childNodes).map(serializeBlock).filter(Boolean).join("\n\n"))
  return markdown ? { kind: "markdown", markdown } : createHtmlPasteEmptyResult()
}
