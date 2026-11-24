import type { IncomingMessage } from "node:http"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib"
import {
  isPrivateIpv4,
  isPrivateIpv6,
  parseIpv6Words,
} from "src/libs/network/publicHostSafety"

export { isPrivateIpv4, isPrivateIpv6, parseIpv6Words }

export const MAX_UNFURL_RESPONSE_BYTES = 262_144

export class UnfurlResponseTooLargeError extends Error {
  constructor() {
    super("외부 링크 응답 크기가 허용 상한(256KB)을 초과했습니다.")
    this.name = "UnfurlResponseTooLargeError"
  }
}

export class UnfurlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnfurlValidationError"
  }
}

export class UnfurlUnsupportedEncodingError extends Error {
  constructor(message = "지원하지 않는 응답 인코딩입니다.") {
    super(message)
    this.name = "UnfurlUnsupportedEncodingError"
  }
}

export class UnfurlUpstreamRedirectError extends Error {
  constructor(message = "리다이렉트 처리 중 오류가 발생했습니다.") {
    super(message)
    this.name = "UnfurlUpstreamRedirectError"
  }
}

const BLOCKED_UNFURL_HOST_EXACT = new Set([
  "localhost",
  "example.com",
  "example.org",
  "example.net",
])

const BLOCKED_UNFURL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".arpa",
  ".test",
  ".invalid",
  ".example",
  ".example.com",
  ".example.org",
  ".example.net",
] as const

const DEFAULT_PORT_BY_PROTOCOL: Record<"http:" | "https:", string> = {
  "http:": "80",
  "https:": "443",
}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308])
const MAX_UNFURL_REDIRECTS = 4

type ResolvedPublicAddress = {
  address: string
  family: number
}

const resolveDefaultPort = (protocol: string) => {
  if (protocol === "http:" || protocol === "https:") {
    return DEFAULT_PORT_BY_PROTOCOL[protocol]
  }
  throw new UnfurlValidationError("http/https URL만 지원합니다.")
}

const resolvePublicAddress = async (hostname: string): Promise<ResolvedPublicAddress> => {
  if (isIP(hostname)) {
    throw new UnfurlValidationError("IP 주소 직접 unfurl은 허용되지 않습니다.")
  }

  const resolvedAddresses = await lookup(hostname, { all: true, verbatim: true })
  if (resolvedAddresses.length === 0) {
    throw new Error("외부 링크의 IP를 확인할 수 없습니다.")
  }

  const hasPrivateAddress = resolvedAddresses.some(({ address, family }) => {
    if (family === 4) return isPrivateIpv4(address)
    if (family === 6) return isPrivateIpv6(address)
    return true
  })

  if (hasPrivateAddress) {
    throw new UnfurlValidationError("비공개 네트워크로 해석되는 링크는 unfurl할 수 없습니다.")
  }

  return (
    resolvedAddresses.find(({ family }) => family === 4) ||
    resolvedAddresses[0]
  )
}

const parseConfiguredUnfurlAllowlist = (): string[] => {
  const raw = process.env.UNFURL_ALLOWED_HOSTS || ""
  if (!raw.trim()) return []
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^\.+/, ""))
    .filter(Boolean)
}

const isAllowedUnfurlHost = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.+$/, "")
  if (!normalizedHostname || !normalizedHostname.includes(".")) return false
  if (isIP(normalizedHostname)) return false
  if (BLOCKED_UNFURL_HOST_EXACT.has(normalizedHostname)) return false
  if (BLOCKED_UNFURL_HOST_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix))) {
    return false
  }
  const configuredAllowlist = parseConfiguredUnfurlAllowlist()
  if (configuredAllowlist.length > 0) {
    return configuredAllowlist.some(
      (suffix) =>
        normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`)
    )
  }
  return true
}

const hasUnsafeParentPathSegment = (rawUrl: string) => {
  const rawPath = rawUrl
    .replace(/^[a-z]+:\/\/[^/]+/i, "")
    .split(/[?#]/, 1)[0]

  const rawSegments = rawPath.split("/")
  return rawSegments.some((segment) => {
    try {
      return decodeURIComponent(segment) === ".."
    } catch {
      return segment === ".."
    }
  })
}

const assertSafeUnfurlUrl = (rawUrl: string) => {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new UnfurlValidationError("URL 형식이 올바르지 않습니다.")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new UnfurlValidationError("http/https URL만 지원합니다.")
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new UnfurlValidationError("인증 정보가 포함된 URL은 unfurl할 수 없습니다.")
  }

  const normalizedHostname = parsedUrl.hostname.trim().toLowerCase()
  if (!isAllowedUnfurlHost(normalizedHostname)) {
    throw new UnfurlValidationError("허용된 외부 링크만 unfurl할 수 있습니다.")
  }

  if (hasUnsafeParentPathSegment(rawUrl)) {
    throw new UnfurlValidationError("상위 경로 이동이 포함된 URL은 unfurl할 수 없습니다.")
  }

  if (
    parsedUrl.port &&
    parsedUrl.port !== DEFAULT_PORT_BY_PROTOCOL[parsedUrl.protocol]
  ) {
    throw new UnfurlValidationError("표준 포트의 외부 링크만 unfurl할 수 있습니다.")
  }

  const safeUrl = new URL(parsedUrl.toString())
  safeUrl.hostname = normalizedHostname
  safeUrl.username = ""
  safeUrl.password = ""
  safeUrl.hash = ""

  return safeUrl
}

export const normalizeSafeUnfurlUrl = (rawUrl: string) => assertSafeUnfurlUrl(rawUrl)

const MAX_UNFURL_ENCODING_LAYERS = 3
const HEAD_CLOSE_BYTES_LOWER = Buffer.from("</head>")

const findHeadClosingEndOffset = (buffer: Buffer, searchFrom: number): number => {
  const needle = HEAD_CLOSE_BYTES_LOWER
  const start = Math.max(0, searchFrom)
  outer: for (let i = start; i <= buffer.byteLength - needle.byteLength; i += 1) {
    for (let j = 0; j < needle.byteLength; j += 1) {
      let byte = buffer[i + j]!
      if (byte >= 65 && byte <= 90) byte += 32
      if (byte !== needle[j]) continue outer
    }
    return i + needle.byteLength
  }
  return -1
}

const extractCharsetFromHeader = (contentType: string): string => {
  const match = /charset\s*=\s*(?:"([^";]+)"|'([^';]+)'|([^;\s]+))/i.exec(contentType)
  return (match?.[1] || match?.[2] || match?.[3] || "").trim()
}

const extractCharsetFromHtmlPrefix = (buffer: Buffer): string => {
  const prefix = buffer.subarray(0, Math.min(buffer.byteLength, 4096)).toString("latin1")
  const metaCharset = /<meta[^>]+charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'>/]+))/i.exec(prefix)
  return (metaCharset?.[1] || metaCharset?.[2] || metaCharset?.[3] || "").trim()
}

export const decodeHtmlBufferWithCharset = (buffer: Buffer, contentTypeHeader = ""): string => {
  if (buffer.byteLength >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3))
  }
  if (buffer.byteLength >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2))
  }
  if (buffer.byteLength >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2))
  }

  const candidateCharset =
    extractCharsetFromHeader(contentTypeHeader) || extractCharsetFromHtmlPrefix(buffer)
  if (candidateCharset && !/^utf-?8$/i.test(candidateCharset)) {
    try {
      return new TextDecoder(candidateCharset).decode(buffer)
    } catch {
      // Unsupported charset label falls back cleanly to UTF-8
    }
  }
  return buffer.toString("utf8")
}

export const decodeUnfurlResponseBuffer = (buffer: Buffer, encoding: string): Buffer => {
  if (buffer.byteLength > MAX_UNFURL_RESPONSE_BYTES) {
    throw new UnfurlResponseTooLargeError()
  }

  const layers = encoding
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0 && token !== "identity")

  if (layers.length === 0) return buffer
  if (layers.length > MAX_UNFURL_ENCODING_LAYERS) {
    throw new UnfurlUnsupportedEncodingError()
  }

  const zlibOptions = { maxOutputLength: MAX_UNFURL_RESPONSE_BYTES }
  let current = buffer
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!
    try {
      if (layer === "gzip" || layer === "x-gzip") {
        current = gunzipSync(current, zlibOptions)
      } else if (layer === "deflate") {
        current = inflateSync(current, zlibOptions)
      } else if (layer === "br") {
        current = brotliDecompressSync(current, zlibOptions)
      } else {
        throw new UnfurlUnsupportedEncodingError()
      }
    } catch (error) {
      if (error instanceof UnfurlUnsupportedEncodingError) throw error
      const code = (error as { code?: unknown } | null)?.code
      if (code === "ERR_BUFFER_TOO_LARGE" || error instanceof RangeError) {
        throw new UnfurlResponseTooLargeError()
      }
      throw new UnfurlUnsupportedEncodingError()
    }
  }
  return current
}

const buildFetchHeadersFromIncoming = (rawHeaders: IncomingMessage["headers"]) => {
  const responseHeaders = new Headers()
  Object.entries(rawHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      responseHeaders.set(key, value)
      return
    }
    if (Array.isArray(value)) {
      responseHeaders.set(key, value.join(", "))
    }
  })
  return responseHeaders
}

export type BoundedIncomingResponseStream = {
  statusCode?: number
  headers: IncomingMessage["headers"]
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown
  on(event: "end", listener: () => void): unknown
  on(event: "error", listener: (error: Error) => void): unknown
  destroy: (error?: Error) => unknown
  resume: () => unknown
}

export const readBoundedIncomingResponse = (
  response: BoundedIncomingResponseStream,
  abortUpstream?: () => void,
  options?: { stopAtHeadEnd?: boolean }
): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    const statusCode = response.statusCode || 502
    const responseHeaders = buildFetchHeadersFromIncoming(response.headers)

    if (REDIRECT_STATUS_CODES.has(statusCode)) {
      response.resume()
      resolve(
        new Response(null, {
          status: statusCode,
          headers: responseHeaders,
        })
      )
      return
    }

    const contentEncoding = `${response.headers["content-encoding"] || ""}`.trim().toLowerCase()
    const isUncompressed = !contentEncoding || contentEncoding === "identity"
    const contentTypeHeader = `${response.headers["content-type"] || ""}`
    const mediaType = contentTypeHeader.split(";", 1)[0]?.trim().toLowerCase() || ""
    const stopAtHeadEnd =
      Boolean(options?.stopAtHeadEnd) &&
      isUncompressed &&
      (mediaType === "text/html" || mediaType === "application/xhtml+xml" || !mediaType)

    const declaredLengthRaw = response.headers["content-length"]
    const declaredLength =
      typeof declaredLengthRaw === "string" ? Number.parseInt(declaredLengthRaw, 10) : Number.NaN
    if (!stopAtHeadEnd && Number.isFinite(declaredLength) && declaredLength > MAX_UNFURL_RESPONSE_BYTES) {
      const limitError = new UnfurlResponseTooLargeError()
      response.destroy(limitError)
      abortUpstream?.()
      reject(limitError)
      return
    }

    const rawChunks: Buffer[] = []
    let receivedBytes = 0
    let settled = false

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error)
    }

    const finishWithBuffer = (rawBody: Buffer) => {
      try {
        const decodedBody = decodeUnfurlResponseBuffer(rawBody, contentEncoding)
        const textBody = decodeHtmlBufferWithCharset(decodedBody, contentTypeHeader)
        responseHeaders.delete("content-encoding")
        settled = true
        resolve(
          new Response(textBody, {
            status: statusCode,
            headers: responseHeaders,
          })
        )
      } catch (error) {
        fail(error)
      }
    }

    let tailCarry: Buffer = Buffer.alloc(0)

    response.on("data", (chunk) => {
      if (settled) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      if (stopAtHeadEnd) {
        const combinedTail = tailCarry.byteLength > 0 ? Buffer.concat([tailCarry, buf]) : buf
        const headEndInTail = findHeadClosingEndOffset(combinedTail, 0)
        if (headEndInTail !== -1) {
          const sliceLenInCurrentChunk = headEndInTail - tailCarry.byteLength
          if (receivedBytes + Math.max(0, sliceLenInCurrentChunk) <= MAX_UNFURL_RESPONSE_BYTES) {
            const keptChunk = buf.subarray(0, Math.max(0, sliceLenInCurrentChunk))
            rawChunks.push(keptChunk)
            receivedBytes += keptChunk.byteLength
            const headBuffer = Buffer.concat(rawChunks, receivedBytes)
            settled = true
            response.destroy()
            abortUpstream?.()
            finishWithBuffer(headBuffer)
            return
          }
        }
        const carryLen = Math.min(HEAD_CLOSE_BYTES_LOWER.byteLength - 1, combinedTail.byteLength)
        tailCarry = combinedTail.subarray(combinedTail.byteLength - carryLen)
      }

      receivedBytes += buf.byteLength
      if (receivedBytes > MAX_UNFURL_RESPONSE_BYTES) {
        const limitError = new UnfurlResponseTooLargeError()
        response.destroy()
        abortUpstream?.()
        fail(limitError)
        return
      }
      rawChunks.push(buf)
    })

    response.on("error", fail)
    response.on("end", () => {
      if (settled) return
      const rawBody = Buffer.concat(rawChunks, receivedBytes)
      finishWithBuffer(rawBody)
    })
  })

const fetchViaResolvedPublicAddress = async ({
  currentUrl,
  signal,
  headers,
  stopAtHeadEnd,
}: {
  currentUrl: URL
  signal: AbortSignal
  headers: HeadersInit
  stopAtHeadEnd: boolean
}) => {
  const resolvedAddress = await resolvePublicAddress(currentUrl.hostname)
  const port = Number.parseInt(currentUrl.port || resolveDefaultPort(currentUrl.protocol), 10)
  const requestHeaders = new Headers(headers)
  requestHeaders.set("host", currentUrl.host)
  requestHeaders.set("accept-encoding", "gzip, deflate, br")

  const clientRequest =
    currentUrl.protocol === "https:"
      ? httpsRequest
      : httpRequest

  return await new Promise<Response>((resolve, reject) => {
    const request = clientRequest(
      {
        protocol: currentUrl.protocol,
        hostname: resolvedAddress.address,
        family: resolvedAddress.family,
        port,
        path: `${currentUrl.pathname}${currentUrl.search}`,
        method: "GET",
        headers: Object.fromEntries(requestHeaders.entries()),
        signal,
        ...(currentUrl.protocol === "https:" ? { servername: currentUrl.hostname } : {}),
      },
      (response) => {
        void readBoundedIncomingResponse(
          response,
          () => {
            request.destroy()
          },
          { stopAtHeadEnd }
        ).then(resolve, reject)
      }
    )

    request.on("error", reject)
    request.end()
  })
}

export const fetchSafeUnfurlResponse = async ({
  initialUrl,
  signal,
  headers,
  stopAtHeadEnd = true,
}: {
  initialUrl: string
  signal: AbortSignal
  headers: HeadersInit
  stopAtHeadEnd?: boolean
}) => {
  let currentUrl = assertSafeUnfurlUrl(initialUrl)

  for (let redirectCount = 0; redirectCount <= MAX_UNFURL_REDIRECTS; redirectCount += 1) {
    const response = await fetchViaResolvedPublicAddress({
      currentUrl,
      headers,
      signal,
      stopAtHeadEnd,
    })

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return { response, finalUrl: currentUrl }
    }

    const redirectLocation = response.headers.get("location")
    if (!redirectLocation) {
      throw new UnfurlUpstreamRedirectError("리다이렉트 위치를 확인할 수 없습니다.")
    }

    if (redirectCount === MAX_UNFURL_REDIRECTS) {
      throw new UnfurlUpstreamRedirectError("리다이렉트가 너무 많습니다.")
    }

    currentUrl = assertSafeUnfurlUrl(new URL(redirectLocation, currentUrl).toString())
  }

  throw new UnfurlUpstreamRedirectError("리다이렉트가 너무 많습니다.")
}
