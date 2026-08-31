import type { IncomingMessage, ServerResponse } from "node:http"

const ssrResponses = new WeakMap<IncomingMessage, ServerResponse>()

export const getSetCookieHeaders = (headers: Headers): string[] => {
  const withCookieList = headers as Headers & { getSetCookie?: () => string[] }
  const cookieList = withCookieList.getSetCookie?.()
  if (cookieList?.length) return cookieList

  const cookie = headers.get("set-cookie")
  return cookie ? [cookie] : []
}

export const bindSsrResponse = (req: IncomingMessage, res: ServerResponse) => {
  ssrResponses.set(req, res)
  return () => ssrResponses.delete(req)
}

const updateRequestCookies = (
  req: IncomingMessage,
  setCookieHeaders: string[]
) => {
  const cookies = new Map<string, string>()
  for (const entry of (req.headers.cookie || "").split(";")) {
    const cookie = entry.trim()
    const separator = cookie.indexOf("=")
    if (separator > 0)
      cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1))
  }

  for (const setCookie of setCookieHeaders) {
    const [pair, ...attributes] = setCookie.split(";")
    const separator = pair.indexOf("=")
    if (separator <= 0) continue
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    const deleted = attributes.some((attribute) =>
      /^\s*max-age\s*=\s*0\s*$/i.test(attribute)
    )
    if (deleted) cookies.delete(name)
    else cookies.set(name, value)
  }

  const cookie = [...cookies]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
  if (cookie) req.headers.cookie = cookie
  else delete req.headers.cookie
}

export const applySsrBackendCookies = (
  req: IncomingMessage,
  headers: Headers
) => {
  const setCookieHeaders = getSetCookieHeaders(headers)
  if (setCookieHeaders.length === 0) return

  const res = ssrResponses.get(req)
  if (!res) return

  const existing = res.getHeader("Set-Cookie")
  const existingHeaders = Array.isArray(existing)
    ? existing
    : existing
    ? [String(existing)]
    : []
  res.setHeader("Set-Cookie", [...existingHeaders, ...setCookieHeaders])
  updateRequestCookies(req, setCookieHeaders)
}
