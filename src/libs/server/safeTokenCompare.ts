import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Compare two secret tokens in constant time using SHA-256 digests and timingSafeEqual.
 * Returns false if either input is falsy or not a non-empty string.
 */
export const safeTokenCompare = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") {
    return false
  }

  const hashA = createHash("sha256").update(a, "utf8").digest()
  const hashB = createHash("sha256").update(b, "utf8").digest()

  return timingSafeEqual(hashA, hashB)
}
