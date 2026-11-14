import { getApiBaseUrl } from "src/apis/backend/client"

const POST_IMAGE_PATH_PREFIX = "/post/api/v1/images/"

type PostImageUrlPolicyOptions = {
  publicApiOrigin?: string
  allowRelative?: boolean
}

const toOrigin = (value: string): string => {
  try {
    const parsed = new URL(value)
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return ""
    return parsed.origin
  } catch {
    return ""
  }
}

const resolvePublicApiOrigin = () => {
  const configuredPublicUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()
  if (configuredPublicUrl) return toOrigin(configuredPublicUrl)
  if (typeof window === "undefined" && process.env.BACKEND_INTERNAL_URL) return ""
  try {
    return toOrigin(getApiBaseUrl())
  } catch {
    return ""
  }
}

const normalizeRelativePostImageUrl = (value: string) => {
  if (!value.startsWith(POST_IMAGE_PATH_PREFIX)) return ""

  try {
    const parsed = new URL(value, "https://post-image-policy.invalid")
    if (!parsed.pathname.startsWith(POST_IMAGE_PATH_PREFIX)) return ""
    return parsed.pathname.slice(POST_IMAGE_PATH_PREFIX.length)
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : ""
  } catch {
    return ""
  }
}

export const normalizePostImageUrl = (
  raw: string,
  options: PostImageUrlPolicyOptions = {},
): string => {
  const value = raw.trim()
  if (!value || hasControlChars(value) || value.startsWith("//") || value.startsWith("/\\")) return ""

  if (value.startsWith("/")) {
    return options.allowRelative ? normalizeRelativePostImageUrl(value) : ""
  }

  const publicApiOrigin = options.publicApiOrigin ? toOrigin(options.publicApiOrigin) : resolvePublicApiOrigin()
  if (!publicApiOrigin) return ""

  try {
    const parsed = new URL(value)
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return ""
    if (parsed.origin !== publicApiOrigin || !parsed.pathname.startsWith(POST_IMAGE_PATH_PREFIX)) return ""
    if (!parsed.pathname.slice(POST_IMAGE_PATH_PREFIX.length)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

export const normalizePublicPostImageUrl = (
  raw: string,
  options: Omit<PostImageUrlPolicyOptions, "allowRelative"> = {},
) =>
  normalizePostImageUrl(raw, { ...options, allowRelative: true })

export const isCanonicalPostImageUploadUrl = (
  raw: string,
  options: Omit<PostImageUrlPolicyOptions, "allowRelative"> = {},
) =>
  Boolean(normalizePostImageUrl(raw, options))

export function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index) ?? 0
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}
