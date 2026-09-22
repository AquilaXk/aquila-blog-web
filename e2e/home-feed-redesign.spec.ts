import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"
import {
  mockPublicAdminProfile,
  createPublicAdminProfileSnapshotFixture,
  createExplorePost,
  mockAvatarAsset,
  PUBLIC_ADMIN_PROFILE_ROUTE,
} from "./helpers/smokeFixtures"

const TAGS = [
  "JWT",
  "Spring",
  "Security",
  "Kafka",
  "Architecture",
  "Infrastructure",
  "Performance",
  "Realtime",
].map((tag, index) => ({ tag, count: 20 - index }))

const POSTS = Array.from({ length: 9 }, (_, index) =>
  createExplorePost({
    id: 7000 + index,
    title: index === 0 ? "JWT VS Session" : `AquilaLog 아키텍처 노트 ${index + 1}`,
    summary:
      index === 0
        ? "JWT가 Stateless하다고 해서 무조건 좋은 것은 아니라는 점을 운영 관점에서 정리합니다."
        : "Spring, Infrastructure, Security를 제품 수준의 글 카드에서 읽기 쉽게 정리합니다.",
    tags: index === 0 ? [] : [TAGS[index % TAGS.length].tag],
    category: [index === 0 ? "Security" : TAGS[index % TAGS.length].tag],
    thumbnail: index % 3 === 0 ? "" : `/mock-cover-${index}.png`,
    hitCount: 1200 + index * 137,
    likesCount: index + 1,
    createdAt: `2026-06-${String(10 + index).padStart(2, "0")}T00:00:00Z`,
    modifiedAt: `2026-06-${String(10 + index).padStart(2, "0")}T00:00:00Z`,
  })
)

const createPageResponse = (posts = POSTS) => ({
  content: posts,
  pageable: {
    pageNumber: 0,
    pageSize: 30,
    totalElements: posts.length,
    totalPages: 1,
  },
})

const mockHomeFeedRedesignEndpoints = async (page: Page, posts = POSTS) => {
  await mockAvatarAsset(page)
  await mockPublicAdminProfile(page)

  await page.route("**/mock-cover-*.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlH0WkAAAAASUVORK5CYII=",
        "base64"
      ),
    })
  })

  await page.route("**/post/api/v1/posts/feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createPageResponse(posts)),
    })
  })

  await page.route("**/post/api/v1/posts/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createPageResponse(posts)),
    })
  })

  await page.route("**/post/api/v1/posts/explore**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createPageResponse(posts)),
    })
  })

  await page.route("**/post/api/v1/posts/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TAGS),
    })
  })
}

const mockEmptyProfileLinks = async (page: Page) => {
  const profile = {
    ...createPublicAdminProfileSnapshotFixture(),
    contactLinks: [],
    serviceLinks: [],
  }

  await page.route(PUBLIC_ADMIN_PROFILE_ROUTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile),
    })
  })

}

test.describe("home feed product redesign", () => {
  test("1440px 이상 홈은 intro 없이 topics rail·list card 구조를 사용한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")

    await expect(page.locator('[data-ui="feed-home-product-shell"]')).toBeVisible()
    await expect(page.locator('[data-ui="feed-brand-role"]')).toHaveCount(0)
    await expect(page.getByRole("region", { name: "태그 목록" })).toBeVisible()
    await expect(page.locator('[data-ui="feed-tag-chip-rail"]')).toBeHidden()
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "AquilaLog")
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", "AquilaLog")
    await expect(page.locator(".desktopPanel")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "최근 글" })).toBeVisible()
    await expect(page.locator(".feedDescription")).toHaveCount(0)
    await expect(page.locator(".feedTitle p")).toHaveCount(0)
    await expect(page.locator('[data-ui="feed-post-card"]').nth(2)).toBeVisible()

    const cardRects = await page.locator('[data-ui="feed-post-card"]').evaluateAll((cards) =>
      cards.slice(0, 3).map((card) => {
        const rect = card.getBoundingClientRect()
        return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
      })
    )
    expect(new Set(cardRects.map((rect) => rect.left)).size).toBe(1)
    expect(Math.min(...cardRects.map((rect) => rect.width))).toBeGreaterThanOrEqual(480)
  })

  test("1280px 데스크톱도 포스트 카드 1열 list 레이아웃을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")
    await expect(page.locator('[data-ui="feed-post-card"]').nth(3)).toBeVisible()

    const cardRects = await page.locator('[data-ui="feed-post-card"]').evaluateAll((cards) =>
      cards.slice(0, 4).map((card) => {
        const rect = card.getBoundingClientRect()
        return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
      })
    )
    expect(new Set(cardRects.map((rect) => rect.left)).size).toBe(1)
    expect(Math.min(...cardRects.map((rect) => rect.width))).toBeGreaterThanOrEqual(420)
  })
  test("editorial entries show title, summary, date and author without card decoration", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")

    const entry = page.locator('[data-ui="feed-post-card"]').filter({
      hasText: "JWT VS Session",
    })
    await expect(entry).toBeVisible()
    await expect(entry.getByRole("heading", { name: "JWT VS Session" })).toBeVisible()
    await expect(entry.locator(".meta")).toContainText("작성일:")
    await expect(entry.locator(".meta")).toContainText("글쓴이:")
    await expect(entry.locator(".meta .avatar img")).toBeVisible()
    await expect(entry.locator(".cover, .coverImage, .rowIndex, .tagRow, .side, .arrowBtn, .like")).toHaveCount(0)
    await expect(entry).not.toContainText("views")
    await expect(entry).not.toContainText("Reading Time")
    await expect(entry.getByRole("heading")).toHaveCSS("font-size", "24px")
    await expect(entry.getByRole("heading")).toHaveCSS("font-weight", "600")
    await expect(entry.locator(".summary")).toHaveCSS("font-size", "16px")
    await expect(entry.locator(".summary")).toHaveCSS("line-height", "26.4px")
    await expect(entry.locator(".summary")).toHaveCSS("-webkit-line-clamp", "5")
    await expect(entry.locator(".meta")).toHaveCSS("font-size", "14px")
    await expect(entry).toHaveCSS("box-shadow", "none")
    await expect(entry).toHaveCSS("border-top-width", "0px")
    await expect(page.locator("body")).toHaveCSS("font-family", /-apple-system/)
  })

  test("저장용 category prefix는 카드와 cover 라벨에 노출하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const categorizedPosts = [
      createExplorePost({
        id: 8110,
        title: "Spring 운영 패턴",
        summary: "저장용 카테고리 prefix 대신 사용자에게 보이는 라벨만 보여줘야 합니다.",
        tags: [],
        category: ["monitor::Spring"],
        thumbnail: "",
      }),
    ]
    await mockHomeFeedRedesignEndpoints(page, categorizedPosts)

    await page.goto("/")

    const categorizedCard = page.locator('[data-ui="feed-post-card"]').filter({
      hasText: "Spring 운영 패턴",
    })
    await expect(categorizedCard).toBeVisible()
    await expect(categorizedCard.locator(".tagRow")).toHaveCount(0)
    await expect(categorizedCard.getByText("monitor::Spring", { exact: true })).toHaveCount(0)
  })

  test("pinned 내부 태그는 카드 category 라벨로 노출하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const pinnedPosts = [
      createExplorePost({
        id: 8101,
        title: "Pinned SSE 운영 노트",
        summary: "Pinned 내부 태그 대신 실제 주제 태그를 카드 라벨로 보여줘야 합니다.",
        tags: ["Pinned", "SSE"],
        category: [],
        thumbnail: "",
      }),
    ]
    await mockHomeFeedRedesignEndpoints(page, pinnedPosts)

    await page.goto("/")

    const pinnedCover = page.locator('[data-ui="feed-post-card"]').filter({
      hasText: "Pinned SSE 운영 노트",
    })
    await expect(pinnedCover).toBeVisible()
    await expect(pinnedCover.locator(".tagRow")).toHaveCount(0)
    await expect(pinnedCover.locator(".meta .avatar img")).toBeVisible()
    await expect(pinnedCover.getByText("Pinned", { exact: true })).toHaveCount(0)
  })

  test("명시적으로 비운 profile 링크는 홈 intro에 기본 링크로 되살리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedRedesignEndpoints(page)
    await mockEmptyProfileLinks(page)

    await page.goto("/")

    const intro = page.locator('[data-ui="feed-home-product-shell"] .introCopy')
    await expect(intro).toHaveCount(0)
    await expect(intro.locator("a")).toHaveCount(0)
    await expect(page.locator('[data-ui="feed-contact-links"]')).toHaveCount(0)
    await expect(page.locator('[data-ui="feed-service-links"]')).toHaveCount(0)
  })

  test("비관리자 empty state는 글 작성이나 admin CTA를 노출하지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedRedesignEndpoints(page, [])

    await page.goto("/")

    const emptyState = page.locator(".emptyState")
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText("아직 게시글이 없습니다.")
    await expect(emptyState).toContainText("곧 새로운 글을 준비하겠습니다.")
    await expect(emptyState.getByRole("link", { name: "블로그 소개" })).toHaveAttribute("href", "/about")
    await expect(emptyState.getByRole("link", { name: /글 작성/ })).toHaveCount(0)
    await expect(emptyState.locator('a[href="/admin"]')).toHaveCount(0)
  })

  test("category-only 글은 restore snapshot과 memo guard에서도 stale fallback으로 떨어지지 않는다", () => {
    const feedRoot = path.resolve(__dirname, "../src/routes/Feed")
    const restoreSource = readFileSync(path.join(feedRoot, "FeedExplorerRestoreModel.ts"), "utf8")
    const postListSource = readFileSync(path.join(feedRoot, "PostList/index.tsx"), "utf8")
    const postCardSource = readFileSync(path.join(feedRoot, "PostList/PostCard.tsx"), "utf8")
    const pinnedPostsSource = readFileSync(path.join(feedRoot, "PostList/PinnedPosts.tsx"), "utf8")

    expect(restoreSource).toContain("category?: string[]")
    expect(restoreSource.match(/post\.category\?\.length \? \{ category: post\.category \}/g)).toHaveLength(2)
    expect(postListSource).toContain("export default memo(PostList)")
    expect(postListSource).not.toContain("arePostListPropsEqual")
    expect(postListSource).not.toContain("arePostsEqual")
    expect(postCardSource).toContain("export default memo(PostCard)")
    expect(postCardSource).not.toContain("arePostCardPropsEqual")
    expect(postCardSource).not.toContain("INTERNAL_CATEGORY_TAGS")
    expect(pinnedPostsSource).toContain("export default memo(PinnedPosts)")
    expect(pinnedPostsSource).not.toContain("arePinnedPostsEqual")
  })

  test("모바일 홈은 태그 칩과 카드 1열을 유지하고 가로 overflow를 만들지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")

    await expect(page.locator('[data-ui="feed-tag-chip-rail"]')).toBeVisible()
    await expect(page.locator('[data-ui="feed-brand-role"]')).toHaveCount(0)
    await expect(page.locator(".desktopPanel")).toBeHidden()
    await expect(page.locator('[data-ui="feed-post-card"]').nth(2)).toBeVisible()

    const layout = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-ui="feed-post-card"]')).slice(0, 3)
      const rects = cards.map((card) => {
        const rect = card.getBoundingClientRect()
        return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) }
      })

      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        rects,
      }
    })

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
    expect(new Set(layout.rects.map((rect) => rect.left)).size).toBe(1)
  })

  test("데스크톱 언어 전환기는 한국어와 영어를 전환하고 새로고침 후에도 유지된다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")

    // 1. Initial default state: Korean
    await expect(page.getByRole("heading", { level: 1, name: "최근 글" })).toBeVisible()
    await expect(page.getByRole("region", { name: "태그 목록" })).toBeVisible()
    await expect(page.getByRole("link", { name: "글" })).toBeVisible()
    await expect(page.getByRole("link", { name: "태그" })).toBeVisible()
    await expect(page.getByRole("link", { name: "소개" })).toBeVisible()
    await expect(page.getByPlaceholder("제목, 요약, 태그로 검색")).toBeVisible()
    const langBtn = page.getByRole("button", { name: "Switch to English" })
    await expect(langBtn).toBeVisible()

    // 2. Switch to English
    await langBtn.click()
    await expect(page.getByRole("heading", { level: 1, name: "Recent Posts" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Tag list" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Posts" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Tags" })).toBeVisible()
    await expect(page.getByRole("link", { name: "About" })).toBeVisible()
    await expect(page.getByPlaceholder("Search by title, summary, or tag...")).toBeVisible()
    await expect(page.getByRole("button", { name: "한국어로 전환" })).toBeVisible()
    const firstEnCard = page.locator('[data-ui="feed-post-card"]').first()
    await expect(firstEnCard.locator(".meta")).toContainText("Date:")
    await expect(firstEnCard.locator(".meta")).toContainText("Author:")
    await expect(firstEnCard.locator(".meta .avatar img")).toBeVisible()

    // 3. Verify persistence across page reload
    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "Recent Posts" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Tag list" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Posts" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Tags" })).toBeVisible()
    await expect(page.getByRole("link", { name: "About" })).toBeVisible()
    await expect(page.getByRole("button", { name: "한국어로 전환" })).toBeVisible()

    // 4. Switch back to Korean
    await page.getByRole("button", { name: "한국어로 전환" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "최근 글" })).toBeVisible()
    await expect(page.getByRole("link", { name: "글" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Switch to English" })).toBeVisible()
    const firstKoCard = page.locator('[data-ui="feed-post-card"]').first()
    await expect(firstKoCard.locator(".meta")).toContainText("작성일:")
    await expect(firstKoCard.locator(".meta")).toContainText("글쓴이:")
    await expect(firstKoCard.locator(".meta .avatar img")).toBeVisible()
  })

  test("모바일 메뉴 언어 전환기는 한국어와 영어를 전환한다", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await mockHomeFeedRedesignEndpoints(page)

    await page.goto("/")
    await page.getByRole("button", { name: "메뉴" }).click()
    const menu = page.getByRole("dialog", { name: "메뉴" })
    await expect(menu).toBeVisible()

    const mobileLangBtn = menu.getByRole("button", { name: "Switch to English (EN)" })
    await expect(mobileLangBtn).toBeVisible()

    await mobileLangBtn.click()

    await expect(page.getByRole("heading", { level: 1, name: "Recent Posts" })).toBeVisible()
    await expect(page.getByPlaceholder("Search by title, summary, or tag...")).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US")
  })

  test("날짜 없는 글은 선행 파이프 구분자를 노출하지 않고, 사진 없는 작성자는 fallback 실루엣을 렌더링한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const edgeCasePosts = [
      createExplorePost({
        id: 8901,
        title: "사진 없는 외부 기여자 글",
        summary: "작성자는 있으나 프로필 사진이 비어 있는 경우입니다.",
        authorName: "GuestContributor",
        authorUsername: "guest",
        authorProfileImgUrl: "",
        createdAt: "2026-04-08T00:00:00Z",
      }),
      createExplorePost({
        id: 8902,
        title: "작성일이 없는 글",
        summary: "날짜 정보가 비어 있는 경우 선행 파이프가 없어야 합니다.",
        authorName: "Aquila",
        authorUsername: "aquila",
        authorProfileImgUrl: "/avatar.png",
        createdAt: "",
        modifiedAt: "",
      }),
    ]
    await mockHomeFeedRedesignEndpoints(page, edgeCasePosts)

    await page.goto("/")

    // 1. Post with author but no photo: shows avatar fallback silhouette, no img inside avatar
    const fallbackCard = page.locator('[data-ui="feed-post-card"]').filter({
      hasText: "사진 없는 외부 기여자 글",
    })
    await expect(fallbackCard).toBeVisible()
    await expect(fallbackCard.locator(".meta")).toContainText("작성일: 2026년 4월 8일")
    await expect(fallbackCard.locator(".meta")).toContainText("글쓴이:")
    await expect(fallbackCard.locator(".meta")).toContainText("GuestContributor")
    await expect(fallbackCard.locator(".meta .avatar .avatarFallback")).toBeVisible()
    await expect(fallbackCard.locator(".meta .avatar img")).toHaveCount(0)

    // 2. Post without date: does not contain pipe divider or 작성일:
    const noDateCard = page.locator('[data-ui="feed-post-card"]').filter({
      hasText: "작성일이 없는 글",
    })
    await expect(noDateCard).toBeVisible()
    await expect(noDateCard.locator(".meta")).not.toContainText("작성일:")
    await expect(noDateCard.locator(".meta")).not.toContainText("|")
    await expect(noDateCard.locator(".meta")).toContainText("글쓴이:")
    await expect(noDateCard.locator(".meta")).toContainText("Aquila")
    await expect(noDateCard.locator(".meta .avatar img")).toBeVisible()
  })

  test("데스크톱과 모바일 태그 더보기 (+숫자) 버튼은 잘리지 않고 접기 전환이 동작한다", async ({ page }) => {
    const manyTags = Array.from({ length: 25 }, (_, i) => ({
      tag: `Tag${String(i + 1).padStart(2, "0")}`,
      count: 30 - i,
    }))

    // 1. Desktop test
    await page.setViewportSize({ width: 1440, height: 800 })
    await mockHomeFeedRedesignEndpoints(page)
    await page.route("**/post/api/v1/posts/tags", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(manyTags),
      })
    })

    await page.goto("/")

    const desktopPanel = page.locator(".desktopPanel")
    await expect(desktopPanel).toBeVisible()

    const desktopToggle = desktopPanel.locator(".toggleButton")
    await expect(desktopToggle).toBeVisible()
    await expect(desktopToggle).toHaveText("더보기 (+5)")

    // Verify toggle button is within panel bounding box and not clipped
    const panelBox = await desktopPanel.boundingBox()
    const toggleBox = await desktopToggle.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(toggleBox).not.toBeNull()
    if (panelBox && toggleBox) {
      expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1)
      expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1)
    }

    // Switch to English and verify text updates
    await page.getByRole("button", { name: "Switch to English" }).click()
    await expect(desktopToggle).toHaveText("More (+5)")

    // Click to expand: button should change to Collapse (접기) and not disappear
    await desktopToggle.click()
    await expect(desktopToggle).toHaveText("Collapse")
    await expect(desktopPanel.locator(".desktopList li")).toHaveCount(26) // 1 "All" + 25 tags

    // Click to collapse back: button should change back to More (+5)
    await desktopToggle.click()
    await expect(desktopToggle).toHaveText("More (+5)")
    await expect(desktopPanel.locator(".desktopList li")).toHaveCount(21) // 1 "All" + 20 tags

    // 2. Mobile / Chip rail test
    await page.setViewportSize({ width: 393, height: 852 })
    const chipRail = page.locator('[data-ui="feed-tag-chip-rail"]')
    await expect(chipRail).toBeVisible()

    const chipToggle = chipRail.locator(".chipToggle")
    await expect(chipToggle).toBeVisible()
    await expect(chipToggle.locator(".name")).toHaveText("More")
    await expect(chipToggle.locator(".count")).toHaveText("(+19)") // 25 - 6 = 19

    // Click to expand
    await chipToggle.click()
    await expect(chipToggle.locator(".name")).toHaveText("Collapse")
    await expect(chipToggle.locator(".count")).toHaveCount(0)

    // Click to collapse
    await chipToggle.click()
    await expect(chipToggle.locator(".name")).toHaveText("More")
    await expect(chipToggle.locator(".count")).toHaveText("(+19)")
  })
})


