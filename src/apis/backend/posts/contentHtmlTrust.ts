import type { PostDetail, TrustedContentHtml } from "src/types"
import type { ContentHtmlTrustFields } from "./PostApiDtos"

const CURRENT_CONTENT_HTML_POLICY_VERSION =
  "content-html-v1" satisfies NonNullable<
    ContentHtmlTrustFields["contentHtmlSanitizerPolicyVersion"]
  >

const HASH_PATTERN = /^[a-f0-9]{64}$/

const sha256Utf8 = async (value: string): Promise<string | undefined> => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return undefined

  try {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch {
    return undefined
  }
}

export const resolveTrustedContentHtml = async ({
  contentHtml,
  contentHtmlHash,
  contentHtmlSanitizerPolicyVersion,
  contentHtmlTrustState,
}: ContentHtmlTrustFields): Promise<TrustedContentHtml | undefined> => {
  if (
    typeof contentHtml !== "string" ||
    contentHtml.trim().length === 0 ||
    typeof contentHtmlHash !== "string" ||
    !HASH_PATTERN.test(contentHtmlHash) ||
    contentHtmlSanitizerPolicyVersion !== CURRENT_CONTENT_HTML_POLICY_VERSION ||
    contentHtmlTrustState !== "TRUSTED_CURRENT"
  ) {
    return undefined
  }

  const actualHash = await sha256Utf8(contentHtml)
  return actualHash === contentHtmlHash
    ? { kind: "trusted-content-html", html: contentHtml }
    : undefined
}

export const withoutTrustedContentHtml = (post: PostDetail): PostDetail => {
  if (!post.trustedContentHtml) return post
  const { trustedContentHtml: _trustedContentHtml, ...safePost } = post
  return safePost
}
