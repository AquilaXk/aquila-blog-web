import { expect, test } from "@playwright/test"
import {
  normalizePostImageUrl,
  normalizePublicPostImageUrl,
  isCanonicalPostImageUploadUrl,
} from "src/libs/markdown/postImageUrlPolicy"
import { detectPublishPlaceholderIssue } from "src/routes/Admin/editorStudioMetaModel"
import { filterTrustedPostImageHtml } from "src/libs/markdown/renderingHtmlModel"

const publicApiOrigin = "https://blog.aquilaxk.site"
const canonicalImage = "https://blog.aquilaxk.site/post/api/v1/images/posts/example.png?focusX=50#hero"

test.describe("post image URL policy", () => {
  test("allows only the canonical public image endpoint", () => {
    expect(normalizePostImageUrl(canonicalImage, { publicApiOrigin })).toBe(canonicalImage)
    expect(normalizePostImageUrl("/post/api/v1/images/posts/example.png?focusX=50", {
      publicApiOrigin,
      allowRelative: true,
    })).toBe("/post/api/v1/images/posts/example.png?focusX=50")
    expect(isCanonicalPostImageUploadUrl(canonicalImage, { publicApiOrigin })).toBe(true)
  })

  test("rejects external, retired, credentialed, malformed, and non-image sources", () => {
    for (const source of [
      "https://cdn.example.test/post.png",
      "https://api.aquilaxk.site/post/api/v1/images/posts/example.png",
      "https://user:pass@blog.aquilaxk.site/post/api/v1/images/posts/example.png",
      "//blog.aquilaxk.site/post/api/v1/images/posts/example.png",
      "data:image/png;base64,abc",
      "blob:https://blog.aquilaxk.site/example",
      "https://blog.aquilaxk.site/post/api/v1/images/",
      "/post/api/v1/images/../posts/example.png",
      "https://blog.aquilaxk.site/post/api/v1/posts/example.png",
      "../post/api/v1/images/posts/example.png",
    ]) {
      expect(normalizePostImageUrl(source, { publicApiOrigin, allowRelative: true })).toBe("")
    }
  })

  test("renderer keeps legacy root-relative sources but producers require absolute canonical URLs", () => {
    expect(normalizePublicPostImageUrl("/post/api/v1/images/posts/example.png", { publicApiOrigin })).toBe(
      "/post/api/v1/images/posts/example.png",
    )
    expect(isCanonicalPostImageUploadUrl("/post/api/v1/images/posts/example.png", { publicApiOrigin })).toBe(false)
  })

  test("direct Markdown publishing blocks noncanonical images without treating code examples as images", () => {
    const previousPublicApiUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    process.env.NEXT_PUBLIC_BACKEND_URL = publicApiOrigin
    try {
      expect(detectPublishPlaceholderIssue("![published](https://cdn.example.test/post.png)")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue("![reference][external]\n\n[external]: https://cdn.example.test/post.png")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue("> ![quoted](https://cdn.example.test/post.png)")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue("![external]\n[external]: https://cdn.example.test/post.png")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue("![external][same]\n[same]: https://cdn.example.test/post.png\n[same]: https://blog.aquilaxk.site/post/api/v1/images/safe.png")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue("> ![external][quoted]\n>\n> [quoted]: https://cdn.example.test/post.png")).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue('<!-- aq-bookmark {"thumbnailUrl":"https://cdn.example.test/card.png"} -->\n:::bookmark /posts/1\n외부 카드\n:::')).toContain("Aquila 이미지 URL")
      expect(detectPublishPlaceholderIssue('<!-- aq-bookmark {"thumbnailUrl":"javascript:alert(1)"} -->\n:::bookmark /posts/1\n제거되는 카드\n:::')).toBeNull()
      expect(detectPublishPlaceholderIssue("```md\n![example](https://cdn.example.test/post.png)\n```\n")).toBeNull()
      expect(detectPublishPlaceholderIssue("~~~md\n![example](https://cdn.example.test/post.png)\n~~~\n")).toBeNull()
      expect(detectPublishPlaceholderIssue("    ![example](https://cdn.example.test/post.png)")).toBeNull()
      expect(detectPublishPlaceholderIssue("`![example](https://cdn.example.test/post.png)`")).toBeNull()
      expect(detectPublishPlaceholderIssue(`![published](${canonicalImage})`)).toBeNull()
      expect(detectPublishPlaceholderIssue(`![canonical]\n[canonical]: ${canonicalImage}`)).toBeNull()
      expect(detectPublishPlaceholderIssue(`![canonical][]\n[canonical]: ${canonicalImage}`)).toBeNull()
      expect(detectPublishPlaceholderIssue(`![canonical][same]\n[same]: ${canonicalImage}\n[same]: https://cdn.example.test/post.png`)).toBeNull()
      expect(detectPublishPlaceholderIssue(`<!-- aq-bookmark {"thumbnailUrl":"${canonicalImage}"} -->\n:::bookmark /posts/1\n정본 카드\n:::`)).toBeNull()
    } finally {
      if (previousPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL
      else process.env.NEXT_PUBLIC_BACKEND_URL = previousPublicApiUrl
    }
  })

  test("trusted HTML removes blocked image sources and preserves alt text", () => {
    const previousPublicApiUrl = process.env.NEXT_PUBLIC_BACKEND_URL
    process.env.NEXT_PUBLIC_BACKEND_URL = publicApiOrigin
    try {
      expect(filterTrustedPostImageHtml('<p><img src="https://cdn.example.test/post.png" alt="외부 예시" /></p>')).toBe(
        '<p><span class="aq-image-blocked" role="img" aria-label="외부 예시">외부 예시</span></p>',
      )
      expect(filterTrustedPostImageHtml(`<img src="${canonicalImage}" alt="게시 이미지" />`)).toContain(canonicalImage)
    } finally {
      if (previousPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_BACKEND_URL
      else process.env.NEXT_PUBLIC_BACKEND_URL = previousPublicApiUrl
    }
  })
})
