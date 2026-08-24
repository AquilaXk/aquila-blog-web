import { realpathSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const PAGE_SIZE = 30
const DEFAULT_MAX_PAGES = 20
const DEFAULT_MAX_POSTS = 600
const IMAGE_PATH_PREFIX = "/post/api/v1/images/"
const CARD_METADATA_PATTERN = /^\s*<!--\s*aq-(bookmark|embed)\s+(\{[\s\S]*\})\s*-->\s*$/i
const CARD_DIRECTIVE_PATTERN = /^:::(bookmark|embed)(?:\s+\S+)?\s*$/i

export class InventoryError extends Error {
  constructor(message, aggregate) {
    super(message)
    this.name = "InventoryError"
    this.aggregate = aggregate
  }
}

const emptyAggregate = () => ({
  scannedPosts: 0,
  scannedPages: 0,
  canonicalAbsolute: 0,
  canonicalRelative: 0,
  external: 0,
  protocolRelative: 0,
  data: 0,
  blob: 0,
  malformed: 0,
  truncated: false,
})

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0
const isEscapedMarkdownMarker = (content, index) => {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}
const stripBlockquotePrefixes = (line) => {
  let value = line
  while (/^\s{0,3}>\s?/.test(value)) value = value.replace(/^\s{0,3}>\s?/, "")
  return value
}
const normalizeCardThumbnailSource = (raw) => {
  const value = raw.trim()
  if (!value || value.startsWith("//")) return ""
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return value
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : ""
  } catch {
    return ""
  }
}

const parseBaseUrl = (value) => {
  if (typeof value !== "string" || value.trim() === "") throw new InventoryError("base URL is required")
  let url
  try {
    url = new URL(value)
  } catch {
    throw new InventoryError("base URL is invalid")
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new InventoryError("base URL is invalid")
  }
  return url.origin
}

const classifySource = (value, baseOrigin, aggregate) => {
  if (typeof value !== "string" || value.trim() === "") return
  const source = value.trim()
  if (source.startsWith("//")) return void (aggregate.protocolRelative += 1)
  if (source.toLowerCase().startsWith("data:")) return void (aggregate.data += 1)
  if (source.toLowerCase().startsWith("blob:")) return void (aggregate.blob += 1)
  try {
    const isRelative = source.startsWith("/")
    const parsed = isRelative ? new URL(source, baseOrigin) : new URL(source)
    if (parsed.username || parsed.password) return void (aggregate.malformed += 1)
    if (isRelative && parsed.pathname.startsWith(IMAGE_PATH_PREFIX) && parsed.pathname.slice(IMAGE_PATH_PREFIX.length).length > 0) {
      aggregate.canonicalRelative += 1
      return
    }
    if (parsed.origin === baseOrigin && parsed.pathname.startsWith(IMAGE_PATH_PREFIX) && parsed.pathname.slice(IMAGE_PATH_PREFIX.length).length > 0) {
      aggregate.canonicalAbsolute += 1
      return
    }
    aggregate.external += 1
  } catch {
    aggregate.malformed += 1
  }
}

const markdownImageSources = (content) => {
  if (typeof content !== "string") return []
  const visibleLines = []
  let fence = null
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const containerLine = stripBlockquotePrefixes(line)
    const fenceMatch = containerLine.trim().match(/^(`{3,}|~{3,})/)
    if (!fence && fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length }
      continue
    }
    if (fence) {
      const closingMatch = containerLine.trim().match(/^(`+|~+)\s*$/)
      if (closingMatch && closingMatch[1][0] === fence.marker && closingMatch[1].length >= fence.length) fence = null
      continue
    }
    if (!/^( {4}|\t)/.test(containerLine)) {
      visibleLines.push(line.replace(/(`+)[^`]*\1/g, ""))
    }
  }
  const visibleContent = visibleLines.join("\n")
  const sources = [...visibleContent.matchAll(/!\[[^\]]*]\(<?([^\s)>]+)>?(?:\s+["'][^)]*["'])?\)/g)]
    .filter((match) => !isEscapedMarkdownMarker(visibleContent, match.index ?? 0))
    .map((match) => match[1])
  let pendingMetadata = null
  const lines = visibleContent.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const metadataMatch = line.match(CARD_METADATA_PATTERN)
    if (metadataMatch) {
      try {
        const payload = JSON.parse(metadataMatch[2])
        const thumbnailUrl = typeof payload.thumbnailUrl === "string"
          ? normalizeCardThumbnailSource(payload.thumbnailUrl)
          : ""
        pendingMetadata = thumbnailUrl
          ? { kind: metadataMatch[1].toLowerCase(), thumbnailUrl }
          : null
      } catch {
        pendingMetadata = null
      }
      continue
    }
    const directiveMatch = line.trim().match(CARD_DIRECTIVE_PATTERN)
    const hasClosingMarker = lines.slice(index + 1).some((candidate) => candidate.trim() === ":::")
    if (pendingMetadata && directiveMatch?.[1].toLowerCase() === pendingMetadata.kind && hasClosingMarker) {
      sources.push(pendingMetadata.thumbnailUrl)
    }
    pendingMetadata = null
  }
  const definitions = new Map()
  for (const line of visibleContent.split("\n")) {
    const match = stripBlockquotePrefixes(line).match(/^\s{0,3}\[([^\]]+)]:\s*<?([^\s>]+)>?/)
    if (!match) continue
    const label = match[1].trim().replace(/\s+/g, " ").toLowerCase()
    if (!definitions.has(label)) definitions.set(label, match[2])
  }
  for (const match of visibleContent.matchAll(/!\[([^\]]*)]\[([^\]]*)]/g)) {
    if (isEscapedMarkdownMarker(visibleContent, match.index ?? 0)) continue
    const reference = (match[2] || match[1]).trim().replace(/\s+/g, " ").toLowerCase()
    const destination = definitions.get(reference)
    if (destination) sources.push(destination)
  }
  for (const match of visibleContent.matchAll(/!\[([^\]]+)](?![\[(])/g)) {
    if (isEscapedMarkdownMarker(visibleContent, match.index ?? 0)) continue
    const reference = match[1].trim().replace(/\s+/g, " ").toLowerCase()
    const destination = definitions.get(reference)
    if (destination) sources.push(destination)
  }
  return sources
}

const htmlImageSources = (contentHtml) => {
  if (typeof contentHtml !== "string") return []
  const sources = []
  for (const tagMatch of contentHtml.matchAll(/<img\b(?:"[^"]*"|'[^']*'|[^'">])*?>/gi)) {
    const tag = tagMatch[0]
    const attributePattern = /\s([^\s=/>]+)\s*=\s*(["'])(.*?)\2/g
    for (const attribute of tag.matchAll(attributePattern)) {
      if (attribute[1].toLowerCase() === "src") {
        sources.push(attribute[3])
        break
      }
    }
  }
  return sources
}

const assertPage = (payload, expectedPage) => {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.content) || !payload.pageable || typeof payload.pageable !== "object") {
    throw new InventoryError("feed response shape is invalid")
  }
  const { pageNumber, pageSize, totalElements, totalPages, numberOfElements } = payload.pageable
  const expectedElements = totalPages === 0
    ? 0
    : expectedPage < totalPages
      ? PAGE_SIZE
      : totalElements - PAGE_SIZE * (totalPages - 1)
  if (
    pageNumber !== expectedPage ||
    pageSize !== PAGE_SIZE ||
    !isNonNegativeInteger(totalElements) ||
    !isNonNegativeInteger(totalPages) ||
    totalPages !== Math.ceil(totalElements / PAGE_SIZE) ||
    numberOfElements !== payload.content.length ||
    payload.content.length !== expectedElements ||
    expectedPage > Math.max(totalPages, 1) ||
    (totalPages === 0 && payload.content.length > 0)
  ) {
    throw new InventoryError("feed pagination is inconsistent")
  }
  return payload
}

const assertDetail = (payload, expectedPostId) => {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.id !== expectedPostId ||
    typeof payload.content !== "string" ||
    (payload.thumbnail != null && typeof payload.thumbnail !== "string") ||
    (payload.contentHtml != null && typeof payload.contentHtml !== "string")
  ) {
    throw new InventoryError("post response shape is invalid")
  }
  return payload
}

const getJson = async (fetchImpl, url) => {
  let response
  try {
    response = await fetchImpl(String(url), { method: "GET", headers: { Accept: "application/json" } })
  } catch {
    throw new InventoryError("public API request failed")
  }
  if (!response || response.ok !== true) throw new InventoryError("public API returned a non-success status")
  try {
    return await response.json()
  } catch {
    throw new InventoryError("public API returned invalid JSON")
  }
}

export const runInventory = async ({ baseUrl, maxPages = DEFAULT_MAX_PAGES, maxPosts = DEFAULT_MAX_POSTS, fetchImpl = globalThis.fetch } = {}) => {
  const baseOrigin = parseBaseUrl(baseUrl)
  if (!isPositiveInteger(maxPages) || !isPositiveInteger(maxPosts) || typeof fetchImpl !== "function") {
    throw new InventoryError("inventory options are invalid")
  }
  const aggregate = emptyAggregate()
  const postIds = new Set()
  let totalPages = null
  let totalElements = null

  for (let page = 1; ; page += 1) {
    if (page > maxPages) {
      aggregate.truncated = true
      throw new InventoryError("inventory page bound reached", aggregate)
    }
    const feedUrl = new URL("/post/api/v1/posts/feed", baseOrigin)
    feedUrl.searchParams.set("page", String(page))
    feedUrl.searchParams.set("pageSize", String(PAGE_SIZE))
    feedUrl.searchParams.set("sort", "CREATED_AT")
    const feed = assertPage(await getJson(fetchImpl, feedUrl), page)
    if (totalPages !== null && totalPages !== feed.pageable.totalPages) throw new InventoryError("feed pagination is inconsistent")
    if (totalElements !== null && totalElements !== feed.pageable.totalElements) throw new InventoryError("feed pagination is inconsistent")
    totalPages = feed.pageable.totalPages
    totalElements = feed.pageable.totalElements
    aggregate.scannedPages += 1

    for (const post of feed.content) {
      if (
        !post ||
        typeof post !== "object" ||
        !isPositiveInteger(post.id) ||
        (post.thumbnail != null && typeof post.thumbnail !== "string")
      ) {
        throw new InventoryError("feed post shape is invalid")
      }
      classifySource(post.thumbnail, baseOrigin, aggregate)
      postIds.add(post.id)
      if (postIds.size > maxPosts) {
        aggregate.truncated = true
        throw new InventoryError("inventory post bound reached", aggregate)
      }
    }
    if (totalPages === 0 || page === totalPages) break
  }

  if (postIds.size !== totalElements) throw new InventoryError("feed pagination is inconsistent")

  for (const postId of postIds) {
    const detail = assertDetail(
      await getJson(fetchImpl, new URL(`/post/api/v1/posts/${postId}`, baseOrigin)),
      postId,
    )
    classifySource(detail.thumbnail, baseOrigin, aggregate)
    for (const source of markdownImageSources(detail.content)) classifySource(source, baseOrigin, aggregate)
    for (const source of htmlImageSources(detail.contentHtml)) classifySource(source, baseOrigin, aggregate)
    aggregate.scannedPosts += 1
  }
  return aggregate
}

const parseCliArgs = (argv) => {
  const options = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!value || !["--base-url", "--max-pages", "--max-posts"].includes(flag) || Object.hasOwn(options, flag)) {
      throw new InventoryError("usage: --base-url <url> [--max-pages <positive integer>] [--max-posts <positive integer>]")
    }
    options[flag] = value
  }
  return {
    baseUrl: options["--base-url"],
    maxPages: options["--max-pages"] === undefined ? DEFAULT_MAX_PAGES : Number(options["--max-pages"]),
    maxPosts: options["--max-posts"] === undefined ? DEFAULT_MAX_POSTS : Number(options["--max-posts"]),
  }
}

const isCli = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))
if (isCli) {
  try {
    process.stdout.write(`${JSON.stringify(await runInventory(parseCliArgs(process.argv.slice(2))))}\n`)
  } catch (error) {
    if (error instanceof InventoryError && error.aggregate) process.stdout.write(`${JSON.stringify(error.aggregate)}\n`)
    process.stderr.write(`Inventory failed: ${error instanceof InventoryError ? error.message : "unexpected error"}\n`)
    process.exitCode = 1
  }
}
