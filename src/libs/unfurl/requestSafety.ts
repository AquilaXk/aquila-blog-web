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

const ALLOWED_UNFURL_HOST_SUFFIXES = [
  "github.com",
  "gist.github.com",
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "loom.com",
  "figma.com",
  "codepen.io",
  "codesandbox.io",
  "notion.so",
  "notion.site",
  "medium.com",
  "velog.io",
  "substack.com",
  "tistory.com",
  "naver.com",
  "x.com",
  "twitter.com",
  "developer.mozilla.org",
  "docs.google.com",
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
  throw new Error("http/https URL만 지원합니다.")
}

const resolvePublicAddress = async (hostname: string): Promise<ResolvedPublicAddress> => {
  if (isIP(hostname)) {
    throw new Error("IP 주소 직접 unfurl은 허용되지 않습니다.")
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
    throw new Error("비공개 네트워크로 해석되는 링크는 unfurl할 수 없습니다.")
  }

  return (
    resolvedAddresses.find(({ family }) => family === 4) ||
    resolvedAddresses[0]
  )
}

const isAllowedUnfurlHost = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase()
  return ALLOWED_UNFURL_HOST_SUFFIXES.some(
    (suffix) =>
      normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`)
  )
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
    throw new Error("URL 형식이 올바르지 않습니다.")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("http/https URL만 지원합니다.")
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("인증 정보가 포함된 URL은 unfurl할 수 없습니다.")
  }

  const normalizedHostname = parsedUrl.hostname.trim().toLowerCase()
  if (!isAllowedUnfurlHost(normalizedHostname)) {
    throw new Error("허용된 외부 링크만 unfurl할 수 있습니다.")
  }

  if (hasUnsafeParentPathSegment(rawUrl)) {
    throw new Error("상위 경로 이동이 포함된 URL은 unfurl할 수 없습니다.")
  }

  if (
    parsedUrl.port &&
    parsedUrl.port !== DEFAULT_PORT_BY_PROTOCOL[parsedUrl.protocol]
  ) {
    throw new Error("표준 포트의 외부 링크만 unfurl할 수 있습니다.")
  }

  const safeUrl = new URL(parsedUrl.toString())
  safeUrl.hostname = normalizedHostname
  safeUrl.username = ""
  safeUrl.password = ""
  safeUrl.hash = ""

  return safeUrl
}

export const normalizeSafeUnfurlUrl = (rawUrl: string) => assertSafeUnfurlUrl(rawUrl)

export const decodeUnfurlResponseBuffer = (buffer: Buffer, encoding: string) => {
  if (buffer.byteLength > MAX_UNFURL_RESPONSE_BYTES) {
    throw new UnfurlResponseTooLargeError()
  }

  const normalizedEncoding = encoding.trim().toLowerCase()
  if (!normalizedEncoding || normalizedEncoding === "identity") return buffer

  const zlibOptions = { maxOutputLength: MAX_UNFURL_RESPONSE_BYTES }
  if (normalizedEncoding === "gzip") return gunzipSync(buffer, zlibOptions)
  if (normalizedEncoding === "deflate") return inflateSync(buffer, zlibOptions)
  if (normalizedEncoding === "br") return brotliDecompressSync(buffer, zlibOptions)
  return buffer
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
  abortUpstream?: () => void
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

    const declaredLengthRaw = response.headers["content-length"]
    const declaredLength =
      typeof declaredLengthRaw === "string" ? Number.parseInt(declaredLengthRaw, 10) : Number.NaN
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UNFURL_RESPONSE_BYTES) {
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

    response.on("data", (chunk) => {
      if (settled) return
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
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
      try {
        const rawBody = Buffer.concat(rawChunks, receivedBytes)
        const contentEncoding = `${response.headers["content-encoding"] || ""}`
        const decodedBody = decodeUnfurlResponseBuffer(rawBody, contentEncoding)
        responseHeaders.delete("content-encoding")
        settled = true
        resolve(
          new Response(
            decodedBody.toString("utf8"),
            {
              status: statusCode,
              headers: responseHeaders,
            }
          )
        )
      } catch (error) {
        fail(error)
      }
    })
  })

const fetchViaResolvedPublicAddress = async ({
  currentUrl,
  signal,
  headers,
}: {
  currentUrl: URL
  signal: AbortSignal
  headers: HeadersInit
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
        void readBoundedIncomingResponse(response, () => {
          request.destroy()
        }).then(resolve, reject)
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
}: {
  initialUrl: string
  signal: AbortSignal
  headers: HeadersInit
}) => {
  let currentUrl = assertSafeUnfurlUrl(initialUrl)

  for (let redirectCount = 0; redirectCount <= MAX_UNFURL_REDIRECTS; redirectCount += 1) {
    const response = await fetchViaResolvedPublicAddress({
      currentUrl,
      headers,
      signal,
    })

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return { response, finalUrl: currentUrl }
    }

    const redirectLocation = response.headers.get("location")
    if (!redirectLocation) {
      throw new Error("리다이렉트 위치를 확인할 수 없습니다.")
    }

    if (redirectCount === MAX_UNFURL_REDIRECTS) {
      throw new Error("리다이렉트가 너무 많습니다.")
    }

    currentUrl = assertSafeUnfurlUrl(new URL(redirectLocation, currentUrl).toString())
  }

  throw new Error("리다이렉트가 너무 많습니다.")
}
