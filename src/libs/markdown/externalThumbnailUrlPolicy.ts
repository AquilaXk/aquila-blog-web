import { isPublicExternalHostname } from "src/libs/network/publicHostSafety"
import { hasControlChars } from "src/libs/markdown/postImageUrlPolicy"

export const normalizePublicExternalThumbnailUrl = (
  raw: string,
  baseUrl?: string,
): string => {
  const value = raw.trim()
  if (!value || hasControlChars(value) || value.startsWith("//") || value.startsWith("/\\")) return ""

  try {
    const parsed = baseUrl ? new URL(value, baseUrl) : new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return ""
    if (parsed.username || parsed.password) return ""
    if (!isPublicExternalHostname(parsed.hostname)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}
