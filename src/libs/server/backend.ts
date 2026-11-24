import type { IncomingMessage } from "node:http"
import {
  ApiError,
  ApiNetworkError,
  ApiTimeoutError,
} from "src/apis/backend/client"
import {
  createServerApiFetchMetricsContext,
  type ServerApiFetchMetricsContext,
} from "src/apis/backend/serverMetricsBridge"
import { normalizeApiRequestPath } from "src/libs/backend/requestPath"
import { ipv4ToNumber, parseIpv6Words } from "src/libs/network/publicHostSafety"
import { getRequestIdForRequest } from "src/libs/server/requestId"
import { applySsrBackendCookies } from "src/libs/server/ssrBackendCookies"

type ServerApiFetchInit = RequestInit & {
  timeoutMs?: number
}

const FALLBACK_TIMEOUT_MS = 6_000

const readFirstHeaderValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || ""
  return typeof value === "string" ? value : ""
}

type TrustedIpv4Rule = {
  kind: "v4"
  network: number
  mask: number
}

type TrustedIpv6Rule = {
  kind: "v6"
  network: Uint16Array
  mask: Uint16Array
}

export type TrustedProxyAllowlist = {
  ipv4Rules: TrustedIpv4Rule[]
  ipv6Rules: TrustedIpv6Rule[]
}

const DEFAULT_TRUSTED_PROXY_V4_RULE: TrustedIpv4Rule = {
  kind: "v4",
  network: 0x7f000001, // 127.0.0.1/32
  mask: 0xffffffff,
}

const DEFAULT_TRUSTED_PROXY_V6_RULE: TrustedIpv6Rule = {
  kind: "v6",
  network: new Uint16Array([0, 0, 0, 0, 0, 0, 0, 1]), // ::1/128
  mask: new Uint16Array([0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff]),
}

let cachedTrustedProxyRaw: string | undefined
let cachedTrustedProxyAllowlist: TrustedProxyAllowlist | undefined

const formatIpv4Uint32 = (value: number): string =>
  `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`

const parseIpv4MappedWordsToUint32 = (words: Uint16Array): number | null => {
  if (
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0xffff
  ) {
    return ((words[6]! << 16) | words[7]!) >>> 0
  }
  return null
}

const parseCidrPrefix = (rawPrefix: string, maxPrefix: number): number | null => {
  if (!/^(?:0|[1-9]\d{0,2})$/.test(rawPrefix)) return null
  const prefix = Number.parseInt(rawPrefix, 10)
  return prefix >= 0 && prefix <= maxPrefix ? prefix : null
}

const createIpv4Rule = (ipNum: number, prefix: number): TrustedIpv4Rule => {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return {
    kind: "v4",
    mask,
    network: (ipNum & mask) >>> 0,
  }
}

const createIpv6Rule = (words: Uint16Array, prefix: number): TrustedIpv6Rule => {
  const mask = new Uint16Array(8)
  const network = new Uint16Array(8)
  for (let i = 0; i < 8; i += 1) {
    const remaining = prefix - i * 16
    const wordMask =
      remaining >= 16
        ? 0xffff
        : remaining <= 0
          ? 0
          : (0xffff << (16 - remaining)) & 0xffff
    mask[i] = wordMask
    network[i] = words[i]! & wordMask
  }
  return { kind: "v6", network, mask }
}

const stripValidatedSocketZoneId = (raw: string | undefined): string => {
  if (!raw) return ""
  const trimmed = raw.trim()
  const zoneIndex = trimmed.indexOf("%")
  if (zoneIndex < 0) return trimmed
  const host = trimmed.slice(0, zoneIndex)
  const zone = trimmed.slice(zoneIndex + 1)
  if (!host.includes(":") || !/^[A-Za-z0-9._-]+$/.test(zone)) return ""
  return host
}

const sanitizeClientIpCandidate = (raw: string | undefined): string => {
  if (!raw) return ""
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 64 || /[\r\n\0\s,]/.test(trimmed)) return ""
  const stripped = trimmed.replace(/^::ffff:/i, "")
  if (ipv4ToNumber(stripped) !== null) return stripped
  if (!trimmed.includes(":") || !/^[0-9a-fA-F:.]+$/.test(trimmed)) return ""
  const words = parseIpv6Words(trimmed)
  if (!words) return ""
  const mappedV4 = parseIpv4MappedWordsToUint32(words)
  return mappedV4 !== null ? formatIpv4Uint32(mappedV4) : trimmed
}

export const parseTrustedProxyAllowlist = (rawInput?: string): TrustedProxyAllowlist => {
  const envRaw = process.env.TRUSTED_PROXY_IPS || ""
  const effectiveRaw = rawInput ?? envRaw
  const useCache = rawInput === undefined
  if (useCache && cachedTrustedProxyAllowlist && cachedTrustedProxyRaw === effectiveRaw) {
    return cachedTrustedProxyAllowlist
  }

  const ipv4Rules: TrustedIpv4Rule[] = [DEFAULT_TRUSTED_PROXY_V4_RULE]
  const ipv6Rules: TrustedIpv6Rule[] = [DEFAULT_TRUSTED_PROXY_V6_RULE]

  for (const rawEntry of effectiveRaw.split(",")) {
    const trimmed = rawEntry.trim()
    if (!trimmed || trimmed.length > 64 || /[\r\n\0\s[\]%]/.test(trimmed)) continue

    const slashIndex = trimmed.indexOf("/")
    if (slashIndex < 0) {
      const normalizedSingle = sanitizeClientIpCandidate(trimmed)
      if (!normalizedSingle) continue
      const v4 = ipv4ToNumber(normalizedSingle)
      if (v4 !== null) {
        ipv4Rules.push(createIpv4Rule(v4, 32))
        continue
      }
      const v6 = parseIpv6Words(normalizedSingle)
      if (v6) {
        ipv6Rules.push(createIpv6Rule(v6, 128))
      }
      continue
    }

    if (trimmed.indexOf("/", slashIndex + 1) >= 0) continue
    const ipPart = trimmed.slice(0, slashIndex)
    const prefixPart = trimmed.slice(slashIndex + 1)
    if (!ipPart || !prefixPart) continue

    const v4 = ipv4ToNumber(ipPart)
    if (v4 !== null) {
      const prefix = parseCidrPrefix(prefixPart, 32)
      if (prefix !== null) ipv4Rules.push(createIpv4Rule(v4, prefix))
      continue
    }

    if (!ipPart.includes(":") || !/^[0-9a-fA-F:.]+$/.test(ipPart)) continue
    const words = parseIpv6Words(ipPart)
    if (!words) continue
    const mappedV4 = parseIpv4MappedWordsToUint32(words)
    if (mappedV4 !== null) {
      const v6Prefix = parseCidrPrefix(prefixPart, 128)
      if (v6Prefix !== null && v6Prefix >= 96) {
        ipv4Rules.push(createIpv4Rule(mappedV4, v6Prefix - 96))
      } else {
        const strippedIpPart = ipPart.replace(/^::ffff:/i, "")
        if (strippedIpPart !== ipPart && ipv4ToNumber(strippedIpPart) !== null) {
          const v4Prefix = parseCidrPrefix(prefixPart, 32)
          if (v4Prefix !== null) ipv4Rules.push(createIpv4Rule(mappedV4, v4Prefix))
        }
      }
      continue
    }

    const v6Prefix = parseCidrPrefix(prefixPart, 128)
    if (v6Prefix !== null) {
      ipv6Rules.push(createIpv6Rule(words, v6Prefix))
    }
  }

  const allowlist = { ipv4Rules, ipv6Rules }
  if (useCache) {
    cachedTrustedProxyRaw = effectiveRaw
    cachedTrustedProxyAllowlist = allowlist
  }
  return allowlist
}

export const isTrustedProxyPeerIp = (remoteAddress?: string | null): boolean => {
  if (!remoteAddress) return false
  const trimmed = remoteAddress.trim()
  if (!trimmed || trimmed.length > 64 || /[\r\n\0\s,[\]]/.test(trimmed)) return false

  const allowlist = parseTrustedProxyAllowlist()
  const strippedV4 = trimmed.replace(/^::ffff:/i, "")
  const v4 = ipv4ToNumber(strippedV4)
  if (v4 !== null) {
    return allowlist.ipv4Rules.some((rule) => ((v4 & rule.mask) >>> 0) === rule.network)
  }

  const zoneIndex = trimmed.indexOf("%")
  const hostWithoutZone = zoneIndex >= 0 ? trimmed.slice(0, zoneIndex) : trimmed
  if (zoneIndex >= 0 && !/^[A-Za-z0-9._-]+$/.test(trimmed.slice(zoneIndex + 1))) {
    return false
  }
  if (!hostWithoutZone.includes(":") || !/^[0-9a-fA-F:.]+$/.test(hostWithoutZone)) {
    return false
  }
  const words = parseIpv6Words(hostWithoutZone)
  if (!words) return false

  const mappedV4 = parseIpv4MappedWordsToUint32(words)
  if (mappedV4 !== null) {
    return allowlist.ipv4Rules.some((rule) => ((mappedV4 & rule.mask) >>> 0) === rule.network)
  }

  return allowlist.ipv6Rules.some((rule) => {
    for (let i = 0; i < 8; i += 1) {
      if ((words[i]! & rule.mask[i]!) !== rule.network[i]!) return false
    }
    return true
  })
}

export const resolveTrustedClientIp = (req: IncomingMessage): string => {
  const peerIp = sanitizeClientIpCandidate(stripValidatedSocketZoneId(req.socket?.remoteAddress))
  if (!isTrustedProxyPeerIp(req.socket?.remoteAddress)) {
    return peerIp
  }

  const headers = req.headers || {}
  const cfIp = sanitizeClientIpCandidate(readFirstHeaderValue(headers["cf-connecting-ip"]))
  if (cfIp) return cfIp

  const xffRaw = readFirstHeaderValue(headers["x-forwarded-for"])
  if (xffRaw) {
    const firstHop = sanitizeClientIpCandidate(xffRaw.split(",")[0])
    if (firstHop) return firstHop
  }

  const realIp = sanitizeClientIpCandidate(readFirstHeaderValue(headers["x-real-ip"]))
  if (realIp) return realIp

  return peerIp
}

const resolveServerTimeoutMs = (path: string, init: ServerApiFetchInit): number => {
  if (typeof init.timeoutMs === "number" && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0) {
    return init.timeoutMs
  }

  const normalizedPath = path.toLowerCase()
  const method = (init.method || "GET").toUpperCase()

  if (
    normalizedPath.includes("/member/api/v1/auth/me") ||
    normalizedPath.includes("/member/api/v1/auth/session") ||
    normalizedPath.includes("/members/adminprofile")
  ) {
    return 5_000
  }

  if (
    normalizedPath.includes("/post/api/v1/posts/feed") ||
    normalizedPath.includes("/post/api/v1/posts/explore") ||
    normalizedPath.includes("/post/api/v1/posts/search")
  ) {
    return 6_500
  }

  if (method === "GET") {
    return 6_000
  }

  return FALLBACK_TIMEOUT_MS
}

export const resolveServerApiBaseUrl = (_req: IncomingMessage): string => {
  const internal = process.env.BACKEND_INTERNAL_URL
  if (internal) return internal.replace(/\/+$/, "")

  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_INTERNAL_URL is required for server-side API calls in production.")
  }

  const publicUrl = process.env.NEXT_PUBLIC_BACKEND_URL
  if (publicUrl) {
    return publicUrl.replace(/\/+$/, "")
  }

  return "http://localhost:8080"
}

type ServerApiExchange = {
  response: Response
  requestId: string
  url: string
  observe: ServerApiFetchMetricsContext["observe"]
  observeStatus: ServerApiFetchMetricsContext["observeStatus"]
}

const createServerApiExchange = async (req: IncomingMessage, path: string, init: ServerApiFetchInit = {}): Promise<ServerApiExchange> => {
  const safePath = normalizeApiRequestPath(path)
  const baseUrl = resolveServerApiBaseUrl(req)
  const { timeoutMs: _timeoutMs, ...requestInit } = init
  const headers = new Headers(init.headers)
  const cookie = req.headers.cookie
  const timeoutMs = resolveServerTimeoutMs(safePath, init)

  if (cookie) {
    headers.set("cookie", cookie)
  }
  const clientIp = resolveTrustedClientIp(req)
  const trustedPeer = isTrustedProxyPeerIp(req.socket?.remoteAddress)
  if (!trustedPeer) {
    headers.delete("CF-Connecting-IP")
    headers.delete("X-Internal-Client-IP")
  }
  if (clientIp) {
    if (trustedPeer) {
      headers.set("CF-Connecting-IP", clientIp)
      headers.set("X-Internal-Client-IP", clientIp)
    }
    headers.set("X-Forwarded-For", clientIp)
  }
  headers.set("X-Request-Id", getRequestIdForRequest(req))
  const { requestId, observe, observeStatus } = createServerApiFetchMetricsContext(safePath, headers, "ssr")
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()

  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener("abort", onAbort, { once: true })
  }

  const cleanup = () => {
    clearTimeout(timeoutId)
    if (init.signal) init.signal.removeEventListener("abort", onAbort)
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${safePath}`, {
      ...requestInit,
      headers,
      signal: controller.signal,
    })
  } catch (error) {
    observe(classifyServerFetchError(error, init.signal, controller.signal))
    throw error
  } finally {
    cleanup()
  }

  applySsrBackendCookies(req, response.headers)
  return { response, requestId, url: `${baseUrl}${safePath}`, observe, observeStatus }
}

export const serverApiFetch = async (req: IncomingMessage, path: string, init: ServerApiFetchInit = {}) => {
  const exchange = await createServerApiExchange(req, path, init)
  exchange.observeStatus(exchange.response.status)
  return exchange.response
}

/**
 * JSON을 소비하는 SSR(GSSP/GSP helper) 표준 fetch.
 * 성공 시 파싱된 JSON, 실패 시 공용 ApiError(status/body/userMessage)를 throw한다.
 * 스트리밍·특수 Response 소비는 raw `serverApiFetch`를 유지한다.
 */
export const serverApiFetchJson = async <T>(
  req: IncomingMessage,
  path: string,
  init: ServerApiFetchInit = {}
): Promise<T> => {
  let exchange: ServerApiExchange
  try {
    exchange = await createServerApiExchange(req, path, init)
  } catch (error) {
    const safePath = normalizeApiRequestPath(path)
    const url = `${resolveServerApiBaseUrl(req)}${safePath}`
    const timeoutMs = resolveServerTimeoutMs(safePath, init)
    const requestId = getRequestIdForRequest(req)
    if (init.signal?.aborted) {
      throw error
    }

    const aborted =
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    if (aborted) {
      throw new ApiTimeoutError(url, timeoutMs, requestId)
    }

    if (error instanceof TypeError) {
      throw new ApiNetworkError(url, requestId)
    }

    throw error
  }

  const { response, requestId, url, observe, observeStatus } = exchange

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    observeStatus(response.status)
    throw new ApiError(response.status, url, body, requestId)
  }

  if (response.status === 204) {
    observe("2xx")
    return null as T
  }

  const contentLength = response.headers.get("content-length")
  if (contentLength === "0") {
    observe("2xx")
    return null as T
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  if (contentType.includes("application/json")) {
    let value: T
    try {
      value = (await response.json()) as T
    } catch (error) {
      if (error instanceof TypeError) {
        observe("network_error")
        throw new ApiNetworkError(url, requestId)
      }
      observe("other_error")
      throw new ApiError(response.status, url, "", requestId)
    }
    observe("2xx")
    return value
  }

  let body: string
  try {
    body = await response.text()
  } catch (error) {
    if (error instanceof TypeError) {
      observe("network_error")
      throw new ApiNetworkError(url, requestId)
    }
    observe("other_error")
    throw error
  }
  if (!body) {
    observe("2xx")
    return null as T
  }

  let value: T
  try {
    value = JSON.parse(body) as T
  } catch {
    observe("other_error")
    throw new ApiError(response.status, url, body, requestId)
  }
  observe("2xx")
  return value
}

const classifyServerFetchError = (error: unknown, callerSignal: AbortSignal | null | undefined, signal: AbortSignal) => {
  if (callerSignal?.aborted) return "aborted" as const
  if (signal.aborted) return "timeout" as const
  if (error instanceof TypeError || error instanceof DOMException) return "network_error" as const
  return "other_error" as const
}
