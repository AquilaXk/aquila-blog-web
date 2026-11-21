import { expect, type Page, test } from "@playwright/test"
import { buildPostOgImagePath } from "../src/libs/og/ogUrl"

type PostFixture = {
  id: number
  title: string
  summary: string
  createdAt: string
  modifiedAt: string
  thumbnail?: string
}

const fixtures: PostFixture[] = [
  {
    id: 1313,
    title: "구조화 데이터 첫 번째 글",
    summary: "첫 번째 글 요약입니다.",
    createdAt: "2026-06-01T01:02:03Z",
    modifiedAt: "2026-06-05T04:05:06Z",
  },
  {
    id: 1314,
    title: "구조화 데이터 두 번째 글",
    summary: "두 번째 글 요약입니다.",
    createdAt: "2026-06-10T07:08:09Z",
    modifiedAt: "2026-06-11T10:11:12Z",
    thumbnail: "https://images.example.test/thumbnail.png",
  },
]

const mockPost = async (page: Page, fixture: PostFixture) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
    })
  })
  await page.route(`**/post/api/v1/posts/${fixture.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: fixture.id,
        createdAt: fixture.createdAt,
        modifiedAt: fixture.modifiedAt,
        authorId: 1,
        authorName: "관리자",
        authorUsername: "aquila",
        authorProfileImageDirectUrl: "/avatar.png",
        title: fixture.title,
        summary: fixture.summary,
        summarySource: "MANUAL",
        content: fixture.summary,
        type: "Post",
        tags: ["SEO"],
        category: ["메타데이터"],
        published: true,
        listed: true,
        likesCount: 0,
        hitCount: 0,
        actorCanModify: false,
        actorCanDelete: false,
        thumbnail: fixture.thumbnail,
      }),
    })
  })
  await page.route(`**/post/api/v1/posts/${fixture.id}/hit`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "ok",
        data: { hitCount: 1 },
      }),
    })
  })
}

const toExpectedIso = (value: string) => new Date(value).toISOString()

const readStructuredData = async (page: Page) => {
  return await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          try {
            return JSON.parse(node.textContent || "{}")
          } catch {
            return null
          }
        })
        .filter(Boolean)
    )
}

test.describe("post detail structured metadata", () => {
  for (const fixture of fixtures) {
    test(`${fixture.title} head metadata는 canonical post와 같은 DTO 값을 사용한다`, async ({
      page,
    }) => {
      await mockPost(page, fixture)

      await page.goto(`/posts/${fixture.id}`)
      await expect(
        page.getByRole("heading", { name: fixture.title })
      ).toBeVisible()

      const canonicalUrl = `https://blog.aquilaxk.site/posts/${fixture.id}`
      const expectedCreatedAt = toExpectedIso(fixture.createdAt)
      const expectedModifiedAt = toExpectedIso(fixture.modifiedAt)
      const expectedFallbackOgUrl = `https://blog.aquilaxk.site${buildPostOgImagePath({
        title: fixture.title,
        category: ["메타데이터"],
        tags: ["SEO"],
      })}`
      const expectedImage = fixture.thumbnail ?? expectedFallbackOgUrl
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        canonicalUrl
      )
      await expect(
        page.locator('meta[property="og:site_name"]')
      ).toHaveAttribute("content", "AquilaLog")
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", expectedImage)
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", expectedImage)
      await expect(
        page.locator('meta[property="article:published_time"]')
      ).toHaveAttribute("content", expectedCreatedAt)
      await expect(
        page.locator('meta[property="article:modified_time"]')
      ).toHaveAttribute("content", expectedModifiedAt)

      const structuredData = await readStructuredData(page)
      const blogPosting = structuredData.find(
        (entry) => entry["@type"] === "BlogPosting"
      )
      const breadcrumb = structuredData.find(
        (entry) => entry["@type"] === "BreadcrumbList"
      )

      expect(blogPosting).toMatchObject({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: fixture.title,
        description: fixture.summary,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        datePublished: expectedCreatedAt,
        dateModified: expectedModifiedAt,
        image: [expectedImage],
      })
      expect(blogPosting.author).toMatchObject({
        "@type": "Person",
        name: "관리자",
      })
      expect(blogPosting.publisher).toMatchObject({
        "@type": "Organization",
        name: "AquilaLog",
      })

      expect(breadcrumb).toMatchObject({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
      })
      expect(breadcrumb.itemListElement).toEqual([
        {
          "@type": "ListItem",
          position: 1,
          name: "홈",
          item: "https://blog.aquilaxk.site",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: fixture.title,
          item: canonicalUrl,
        },
      ])
    })
  }

  test("동적 /api/og 엔드포인트는 1200x630 PNG를 반환하고 비허용 메서드·초과 쿼리를 차단한다", async ({
    request,
  }) => {
    const ogPath = buildPostOgImagePath({
      title: "기술블로그 동적 OG 렌더링 <script>alert(1)</script>",
      category: "Architecture",
      tags: ["Kotlin", "NextJS"],
    })
    const getRes = await request.get(ogPath)
    expect(getRes.status()).toBe(200)
    expect(getRes.headers()["content-type"]).toBe("image/png")
    expect(getRes.headers()["x-content-type-options"]).toBe("nosniff")
    expect(getRes.headers()["cache-control"]).toContain("public, max-age=86400")

    const body = await getRes.body()
    expect(body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
    expect(body.readUInt32BE(16)).toBe(1200)
    expect(body.readUInt32BE(20)).toBe(630)

    const headRes = await request.head(ogPath)
    expect(headRes.status()).toBe(200)
    expect((await headRes.body()).byteLength).toBe(0)

    const postRes = await request.post("/api/og")
    expect(postRes.status()).toBe(405)

    const oversizedQuery = "a".repeat(2100)
    const oversizedRes = await request.get(`/api/og?title=${oversizedQuery}`)
    expect(oversizedRes.status()).toBe(400)
  })

  test("본문 다이어그램 이미지는 og:image로 공유되지만 상세 상단 PostHeader 배너에는 중복 노출되지 않는다", async ({
    page,
  }) => {
    await page.route("**/member/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
      })
    })
    await page.route("**/post/api/v1/images/diagram-arch.png", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420"><rect width="800" height="420" fill="#eef2ff"/></svg>',
      })
    })
    await page.route("**/post/api/v1/posts/1315", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1315,
          createdAt: "2026-06-12T01:02:03Z",
          modifiedAt: "2026-06-12T04:05:06Z",
          authorId: 1,
          authorName: "관리자",
          authorUsername: "aquila",
          authorProfileImageDirectUrl: "/avatar.png",
          title: "시스템 아키텍처 분석",
          summary: "다이어그램 중복 렌더링 방지 검증",
          summarySource: "MANUAL",
          content: "## 구조도\n\n![시스템 구조도](/post/api/v1/images/diagram-arch.png)\n\n본문 설명입니다.",
          type: "Post",
          tags: ["Architecture"],
          category: ["Backend"],
          published: true,
          listed: true,
          likesCount: 0,
          hitCount: 0,
          actorCanModify: false,
          actorCanDelete: false,
          thumbnail: "/post/api/v1/images/diagram-arch.png",
        }),
      })
    })
    await page.route("**/post/api/v1/posts/1315/hit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ resultCode: "200-1", msg: "ok", data: { hitCount: 1 } }),
      })
    })

    await page.goto("/posts/1315")
    await expect(page.getByRole("heading", { name: "시스템 아키텍처 분석" })).toBeVisible()
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://blog.aquilaxk.site/post/api/v1/images/diagram-arch.png"
    )
    await expect(page.locator(".detailHero .thumbnail, .detailHero .thumbnailTrigger")).toHaveCount(0)
    await expect(page.locator('.aq-markdown img[src="/post/api/v1/images/diagram-arch.png"]')).toHaveCount(1)
  })
})
