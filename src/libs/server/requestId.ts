import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"
import type { IncomingMessage } from "http"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,120}$/

export const isValidRequestId = (value: unknown): value is string =>
  typeof value === "string" && value !== "-" && REQUEST_ID_PATTERN.test(value)

export const resolveRequestId = (
  incomingRequestId: unknown,
  createId: () => string = createSecureRandomUuid
): string => (isValidRequestId(incomingRequestId) ? incomingRequestId : createId())

const requestIds = new WeakMap<IncomingMessage, string>()

const readRequestHeader = (req: IncomingMessage): string | undefined => {
  const value = req.headers["x-request-id"]
  return Array.isArray(value) ? value[0] : value
}

export const getRequestIdForRequest = (req: IncomingMessage): string => {
  const existing = requestIds.get(req)
  if (existing) return existing

  const requestId = resolveRequestId(readRequestHeader(req))
  requestIds.set(req, requestId)
  return requestId
}
