import { expect, test, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import {
  mockPublicAdminProfile,
  createExplorePost,
  mockAvatarAsset,
} from "./helpers/smokeFixtures"
import { PUBLIC_ADMIN_PROFILE_FIXTURE } from "../tests/fixtures/publicAdminProfileFixture"

const SCREENSHOT_DIR = resolve(process.cwd(), "test-results/screenshots")

test.beforeAll(() => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

const TAGS = [
  "JWT",
  "Spring",
  "Security",
  "Architecture",
  "Performance",
].map((tag, index) => ({ tag, count: 10 - index }))

const POSTS = [
  createExplorePost({
    id: 7001,
    title: "JWT vs Session: Stateless 인증의 실전 한계와 보안 트레이드오프",
    summary:
      "JWT가 완전한 무상태(Stateless)라고 해서 항상 우월한 것은 아닙니다. 토큰 무효화, 블랙리스트 동기화, 리프레시 토큰 로테이션 문제를 실무 관점에서 짚어봅니다.",
    tags: ["JWT", "Security"],
    category: ["Security"],
    thumbnail: "",
    hitCount: 3420,
    likesCount: 42,
    createdAt: "2026-09-18T10:00:00Z",
    modifiedAt: "2026-09-18T10:00:00Z",
  }),
  createExplorePost({
    id: 7002,
    title: "대규모 트래픽 환경에서의 데이터베이스 캐싱 및 낙관적 락 전략",
    summary:
      "동시성 경합이 잦은 재고 관리 및 좋아요 수치 집계에서 비관적 락 대신 조건부 업데이트와 낙관적 락을 적용해 처리량을 4배 개선한 사례를 공유합니다.",
    tags: ["Spring", "Architecture"],
    category: ["Architecture"],
    thumbnail: "",
    hitCount: 2180,
    likesCount: 29,
    createdAt: "2026-09-15T14:30:00Z",
    modifiedAt: "2026-09-15T14:30:00Z",
  }),
]

const mockHomeFeedEndpoints = async (page: Page) => {
  await mockAvatarAsset(page)
  await mockPublicAdminProfile(page)

  const pageResponse = {
    content: POSTS,
    pageable: { pageNumber: 0, pageSize: 30, totalElements: POSTS.length, totalPages: 1 },
  }

  await page.route("**/post/api/v1/posts/feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pageResponse),
    })
  })

  await page.route("**/post/api/v1/posts/explore**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pageResponse),
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

const mockEditorEndpoints = async (page: Page) => {
  await page.route("**/member/api/v1/auth/me", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: 1, username: "admin", nickname: "aquila", isAdmin: true }),
    })
  )
  await page.route("**/member/api/v1/members/adminProfile", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(PUBLIC_ADMIN_PROFILE_FIXTURE) })
  })
  await page.route("**/post/api/v1/posts/tags", async (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify([]) })
  )
  await page.route("**/post/api/v1/adm/posts/990", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: 990,
        title: "실전 웹 아키텍처 설계와 구현",
        content: "# 실전 웹 아키텍처\n\n## 1. 개요\n이 문서는 현대적인 웹 아키텍처 설계 원칙을 다룹니다.\n\n## 2. 세부 사항\n확장성과 성능을 위한 가이드라인입니다.",
        summary: "현대적인 웹 아키텍처 설계 원칙과 실전 가이드라인",
        summarySource: "MANUAL",
        published: false,
        listed: false,
        tempDraft: true,
        version: 1,
      }),
    })
  })
  await page.route("**/post/api/v1/posts/temp", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "temp draft",
        data: {
          id: 990,
          title: "실전 웹 아키텍처 설계와 구현",
          content: "# 실전 웹 아키텍처\n\n## 1. 개요\n이 문서는 현대적인 웹 아키텍처 설계 원칙을 다룹니다.\n\n## 2. 세부 사항\n확장성과 성능을 위한 가이드라인입니다.",
          summary: "현대적인 웹 아키텍처 설계 원칙과 실전 가이드라인",
          summarySource: "MANUAL",
          published: false,
          listed: false,
          tempDraft: true,
        },
      }),
    })
  })

  // Seed a local draft so LocalDraftRestoreCard appears in inspector
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "admin.editor.localDraft.create.v3",
      JSON.stringify({
        title: "자동 복구된 브라우저 초안",
        content: "임시 저장되었던 내용입니다.",
        summary: "임시 요약",
        summarySource: "MANUAL",
        summaryIntent: { kind: "manual", summary: "임시 요약" },
        thumbnailUrl: "",
        thumbnailFocusX: 50,
        thumbnailFocusY: 50,
        thumbnailZoom: 1,
        tags: ["Architecture"],
        category: "Tech",
        visibility: "PUBLIC_UNLISTED",
        savedAt: new Date().toISOString(),
        source: { kind: "create" },
      })
    )
  })
}

test.describe("Visual verification of Home Feed and Editor", () => {
  test("capture Home Feed clean typography and layout (Desktop & Mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockHomeFeedEndpoints(page)
    await page.goto("/")
    await expect(page.locator("main")).toBeVisible()
    await expect(page.getByText("JWT vs Session")).toBeVisible()

    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "01-home-feed-desktop.png"),
      fullPage: true,
    })

    // Mobile viewport
    await page.setViewportSize({ width: 393, height: 852 })
    await page.waitForTimeout(300)
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "02-home-feed-mobile.png"),
      fullPage: true,
    })
  })

  test("capture Editor UI/UX: crisp chevron, clean sidebar, inline draft restore card, no focus rectangle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockEditorEndpoints(page)
    await page.goto("/admin/editor")

    const editorFrame = page.getByTestId("editor-studio-frame")
    await expect(editorFrame).toBeVisible()

    // 1. Full Editor Layout with sidebars
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "03-editor-full-studio.png"),
    })

    // 2. Click title input to verify no giant focus rectangle
    const titleInput = page.getByPlaceholder("제목을 입력하세요")
    await expect(titleInput).toBeVisible()
    await titleInput.click()
    await expect(titleInput).toBeFocused()
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "04-editor-title-focused.png"),
    })

    // 3. Open toolbar dropdown to verify crisp 12px SVG chevron
    const headingMenuTrigger = page.getByRole("button", { name: "제목 메뉴" })
    await expect(headingMenuTrigger).toBeVisible()
    await headingMenuTrigger.click()
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "05-editor-toolbar-dropdown.png"),
    })

    // 4. Verify LocalDraftRestoreCard is rendered inline inside the inspector panel
    const restoreSelect = page.getByLabel("복구할 브라우저 초안")
    await expect(restoreSelect).toBeVisible()
    const inspector = page.locator("aside[aria-label='발행 설정']")
    await expect(inspector).toBeVisible()
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "06-editor-inspector-inline-draft-card.png"),
    })

    // 5. Mobile Editor Layout
    await page.setViewportSize({ width: 393, height: 852 })
    await page.waitForTimeout(300)
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, "07-editor-mobile.png"),
      fullPage: true,
    })
  })
})
