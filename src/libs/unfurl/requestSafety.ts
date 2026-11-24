import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import {
  isPrivateIpv4,
  isPrivateIpv6,
  parseIpv6Words,
} from "src/libs/network/publicHostSafety"
import {
  decodeHtmlBufferWithCharset,
  decodeUnfurlResponseBuffer,
  MAX_UNFURL_RESPONSE_BYTES,
  readBoundedIncomingResponse,
  UnfurlResponseTooLargeError,
  UnfurlUnsupportedEncodingError,
  UnfurlUpstreamRedirectError,
  UnfurlValidationError,
} from "src/libs/unfurl/responseSafety"

export {
  decodeHtmlBufferWithCharset,
  decodeUnfurlResponseBuffer,
  isPrivateIpv4,
  isPrivateIpv6,
  MAX_UNFURL_RESPONSE_BYTES,
  parseIpv6Words,
  readBoundedIncomingResponse,
  UnfurlResponseTooLargeError,
  UnfurlUnsupportedEncodingError,
  UnfurlUpstreamRedirectError,
  UnfurlValidationError,
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

const stripIpv6Brackets = (hostname: string): string =>
  hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname

const resolvePublicAddress = async (hostname: string): Promise<ResolvedPublicAddress> => {
  if (isIP(stripIpv6Brackets(hostname.trim()))) {
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
  const unbracketedHostname = stripIpv6Brackets(normalizedHostname)
  if (!unbracketedHostname || !unbracketedHostname.includes(".")) return false
  if (
    normalizedHostname.startsWith("[") ||
    normalizedHostname.endsWith("]") ||
    normalizedHostname.includes(":") ||
    isIP(unbracketedHostname)
  ) {
    return false
  }
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

const createAbortError = (signal: AbortSignal): Error => {
  const reason = (signal as { reason?: unknown }).reason
  if (reason instanceof Error) return reason
  return new DOMException("The operation was aborted.", "AbortError")
}

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
  if (signal.aborted) {
    throw createAbortError(signal)
  }
  const resolvedAddress = await resolvePublicAddress(currentUrl.hostname)
  if (signal.aborted) {
    throw createAbortError(signal)
  }
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
