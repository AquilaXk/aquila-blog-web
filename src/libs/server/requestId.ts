import { createSecureRandomUuid } from "src/libs/security/secureRandomUuid"

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,120}$/

export const isValidRequestId = (value: unknown): value is string =>
  typeof value === "string" && value !== "-" && REQUEST_ID_PATTERN.test(value)

export const resolveRequestId = (
  incomingRequestId: unknown,
  createId: () => string = createSecureRandomUuid
): string => (isValidRequestId(incomingRequestId) ? incomingRequestId : createId())
