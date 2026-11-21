type SecureRandomUuidSource = {
  randomUUID?: () => string
}

export const createSecureRandomUuid = (
  source: SecureRandomUuidSource | undefined = globalThis.crypto
): string => {
  if (!source || typeof source.randomUUID !== "function") {
    throw new Error("Secure random UUID is unavailable")
  }
  return source.randomUUID()
}
