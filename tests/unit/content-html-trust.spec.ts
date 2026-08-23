import { expect, test } from "@playwright/test"
import { createHash } from "node:crypto"
import { mapPostDetail } from "../../src/apis/backend/posts/PostApiMappers"
import type { ApiPostWithContentDto } from "../../src/apis/backend/posts/PostApiDtos"
import { withoutTrustedContentHtml } from "../../src/apis/backend/posts/contentHtmlTrust"
import { resolvePostQueryData } from "../../src/hooks/usePostQuery"

const CURRENT_POLICY_VERSION = "content-html-v1"
const sha256Utf8 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex")

const postPayload = (overrides: Record<string, unknown> = {}): ApiPostWithContentDto =>
  ({
    id: 45,
    createdAt: "2026-08-24T00:00:00Z",
    modifiedAt: "2026-08-24T00:00:00Z",
    authorId: 1,
    authorName: "관리자",
    title: "신뢰 본문",
    content: "",
    tags: [],
    category: [],
    published: true,
    listed: true,
    likesCount: 0,
    commentsCount: 0,
    hitCount: 0,
    ...overrides,
  }) as ApiPostWithContentDto

test("current policy와 UTF-8 SHA-256가 일치하는 HTML-only 응답만 trusted capability로 만든다", async () => {
  const contentHtml = "<p>안전한 HTML 본문</p>"

  const detail = await mapPostDetail(
    postPayload({
      contentHtml,
      contentHtmlHash: sha256Utf8(contentHtml),
      contentHtmlSanitizerPolicyVersion: CURRENT_POLICY_VERSION,
      contentHtmlTrustState: "TRUSTED_CURRENT",
    }),
    { allowTrustedContentHtml: true },
  )

  expect(detail.trustedContentHtml).toEqual({ kind: "trusted-content-html", html: contentHtml })
  expect("contentHtml" in detail).toBeFalsy()
})

test("untrusted, malformed, stale HTML metadata와 legacy raw HTML은 모두 fail-closed한다", async () => {
  const contentHtml = "<p>legacy raw HTML</p>"
  const currentTrust = {
    contentHtml,
    contentHtmlHash: sha256Utf8(contentHtml),
    contentHtmlSanitizerPolicyVersion: CURRENT_POLICY_VERSION,
    contentHtmlTrustState: "TRUSTED_CURRENT",
  }

  for (const metadata of [
    { ...currentTrust, contentHtmlTrustState: "UNKNOWN" },
    { ...currentTrust, contentHtmlTrustState: "REJECTED" },
    { contentHtml },
    { ...currentTrust, contentHtmlHash: "malformed" },
    { ...currentTrust, contentHtmlSanitizerPolicyVersion: "content-html-v0" },
    { ...currentTrust, contentHtmlHash: sha256Utf8("<p>other</p>") },
  ]) {
    const detail = await mapPostDetail(postPayload(metadata), {
      allowTrustedContentHtml: true,
    })

    expect(detail.trustedContentHtml).toBeUndefined()
    expect("contentHtml" in detail).toBeFalsy()
  }
})

test("nonblank Markdown은 verified HTML보다 우선하며 capability를 만들지 않는다", async () => {
  const contentHtml = "<p>HTML 후보</p>"
  const content = "# 원본 Markdown"

  const detail = await mapPostDetail(
    postPayload({
      content,
      contentHtml,
      contentHtmlHash: sha256Utf8(contentHtml),
      contentHtmlSanitizerPolicyVersion: CURRENT_POLICY_VERSION,
      contentHtmlTrustState: "TRUSTED_CURRENT",
    }),
    { allowTrustedContentHtml: true },
  )

  expect(detail.content).toBe(content)
  expect(detail.trustedContentHtml).toBeUndefined()
  expect("contentHtml" in detail).toBeFalsy()
})

test("Web Crypto가 없거나 digest가 실패하면 HTML capability를 만들지 않는다", async () => {
  const contentHtml = "<p>검증 실패 HTML</p>"
  const payload = postPayload({
    contentHtml,
    contentHtmlHash: sha256Utf8(contentHtml),
    contentHtmlSanitizerPolicyVersion: CURRENT_POLICY_VERSION,
    contentHtmlTrustState: "TRUSTED_CURRENT",
  })
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")

  try {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined })
    expect(
      (await mapPostDetail(payload, { allowTrustedContentHtml: true })).trustedContentHtml,
    ).toBeUndefined()

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: async () => {
            throw new Error("digest unavailable")
          },
        },
      },
    })
    expect(
      (await mapPostDetail(payload, { allowTrustedContentHtml: true })).trustedContentHtml,
    ).toBeUndefined()
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto)
    else delete (globalThis as { crypto?: Crypto }).crypto
  }
})

test("stale payload와 API-error retained data는 Markdown만 유지하고 capability를 제거한다", async () => {
  const contentHtml = "<p>신뢰됐던 HTML</p>"
  const payload = postPayload({
    contentHtml,
    contentHtmlHash: sha256Utf8(contentHtml),
    contentHtmlSanitizerPolicyVersion: CURRENT_POLICY_VERSION,
    contentHtmlTrustState: "TRUSTED_CURRENT",
  })
  const fresh = await mapPostDetail(payload, { allowTrustedContentHtml: true })

  expect(fresh.trustedContentHtml).toBeDefined()
  expect((await mapPostDetail(payload, { allowTrustedContentHtml: false })).trustedContentHtml)
    .toBeUndefined()
  expect(withoutTrustedContentHtml(fresh).trustedContentHtml).toBeUndefined()
  expect(resolvePostQueryData(fresh, true)?.trustedContentHtml).toBeUndefined()
  expect(resolvePostQueryData(fresh, false)?.trustedContentHtml).toEqual(
    fresh.trustedContentHtml,
  )
})
