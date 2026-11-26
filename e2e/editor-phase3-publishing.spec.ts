import type { Page, Route } from "./helpers/authoringPlaywright"
import { expect, test } from "./helpers/authoringPlaywright"
import { PUBLIC_ADMIN_PROFILE_FIXTURE } from "../tests/fixtures/publicAdminProfileFixture"

const adminMember = {
  id: 1,
  username: "qa-admin",
  nickname: "aquila",
  isAdmin: true,
}

const fulfillJson = async (route: Route, data: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  })
}

const setupAdminEditorRoutes = async (
  page: Page,
  options?: { initialContent?: string; onPutPost?: (body: Record<string, unknown>) => void }
) => {
  const drafts = new Map<number, Record<string, unknown>>([
    [
      990,
      {
        id: 990,
        title: "임시글",
        content: options?.initialContent ?? "Initial Phase 3 draft body.",
        summary: "",
        summarySource: "NONE",
        published: false,
        listed: false,
        tempDraft: true,
        version: 1,
      },
    ],
    [
      991,
      {
        id: 991,
        title: "Architecture notes draft",
        content: "Second draft body.",
        summary: "",
        summarySource: "NONE",
        published: false,
        listed: false,
        tempDraft: true,
        version: 1,
      },
    ],
  ])

  await page.route("**/member/api/v1/auth/me", async (route) => fulfillJson(route, adminMember))
  await page.route("**/member/api/v1/members/adminProfile", async (route) => {
    await fulfillJson(route, PUBLIC_ADMIN_PROFILE_FIXTURE)
  })
  await page.route("**/post/api/v1/posts/tags", async (route) => fulfillJson(route, []))
  await page.route("**/post/api/v1/adm/posts/**", async (route) => {
    const urlPath = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (urlPath.endsWith("/adm/posts/series")) {
      await fulfillJson(route, ["Compiler Design", "Systems Notes"])
      return
    }
    if (urlPath.endsWith("/adm/posts/temp")) {
      if (method === "GET") {
        await fulfillJson(route, Array.from(drafts.values()))
        return
      }
      if (method === "POST") {
        const created = {
          id: 992,
          title: "임시글",
          content: "",
          summary: "",
          summarySource: "NONE",
          published: false,
          listed: false,
          tempDraft: true,
          version: 1,
        }
        drafts.set(992, created)
        await fulfillJson(route, { resultCode: "201-1", msg: "created", data: created }, 201)
        return
      }
    }
    if (urlPath.includes("/adm/posts/temp/") && method === "DELETE") {
      const id = Number(urlPath.split("/").pop())
      drafts.delete(id)
      await fulfillJson(route, { resultCode: "200-1", msg: "deleted", data: null })
      return
    }
    const id = Number(urlPath.split("/").pop())
    const found = drafts.get(id) ?? drafts.get(990)
    await fulfillJson(route, found)
  })
  await page.route("**/post/api/v1/posts/temp/*", async (route) => {
    await fulfillJson(route, { resultCode: "200-1", msg: "saved", data: { id: 990, version: 2 } })
  })
  await page.route("**/post/api/v1/posts/*", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>
      options?.onPutPost?.(body)
      await fulfillJson(route, {
        resultCode: "200-1",
        msg: "updated",
        data: {
          id: 990,
          version: 2,
          title: body.title,
          summary: "Saved summary",
          summarySource: "MANUAL",
          published: body.published,
          listed: body.listed,
          tempDraft: false,
          scheduledAt: body.scheduledAt ?? null,
          seriesName: body.seriesName ?? null,
          seriesOrder: body.seriesOrder ?? null,
          canonicalUrl: body.canonicalUrl ?? null,
        },
      })
      return
    }
    await route.continue()
  })
}

test.describe("Editor Phase 3 multi-draft, publishing metadata, mobile & public detail", () => {
  test("multi-temp-draft drawer lists, creates, switches, and deletes server drafts", async ({ page }) => {
    await setupAdminEditorRoutes(page)
    await page.goto("/admin/editor/990")

    await page.getByTestId("editor-temp-drafts-button").click()
    const drawer = page.getByTestId("editor-temp-drafts-dialog")
    await expect(drawer).toBeVisible()
    await expect(page.getByTestId("temp-draft-row-990")).toBeVisible()
    await expect(page.getByTestId("temp-draft-row-990")).toContainText("현재 편집 중")
    await expect(page.getByTestId("temp-draft-row-991")).toBeVisible()

    // Delete secondary draft 991 via ConfirmDialog
    await page.getByTestId("temp-draft-delete-991").click()
    await page.getByRole("dialog", { name: "삭제" }).getByRole("button", { name: "삭제" }).click()
    await expect(page.getByTestId("temp-draft-row-991")).toHaveCount(0)

    // Create a brand new server draft 992 and navigate to it
    await page.getByTestId("editor-temp-drafts-create-new").click()
    await expect(page).toHaveURL(/\/admin\/editor\/992$/)
  })

  test("publish modal configures future schedule, series, and canonical URL cleanly and fails closed on unsafe URL", async ({
    page,
  }) => {
    const submittedPayloads: Array<Record<string, unknown>> = []
    await setupAdminEditorRoutes(page, {
      onPutPost: (body) => {
        submittedPayloads.push(body)
      },
    })

    await page.goto("/admin/editor/990")
    await page.locator("#post-title").fill("Compiler Frontend Pass")

    await page.getByTestId("editor-publish-open-button").click()
    const modal = page.getByTestId("editor-publish-dialog")
    await expect(modal).toBeVisible()

    // Invalid canonical URL shows validation feedback immediately
    await modal.getByTestId("publish-canonical-url-input").fill("javascript:alert(1)")
    await expect(modal.getByRole("alert")).toContainText("http://")

    await modal.getByTestId("publish-canonical-url-input").fill("https://origin.example.com/posts/compiler-pass")
    await modal.getByTestId("publish-series-name-input").fill("Compiler Design")
    await modal.getByTestId("publish-series-order-input").fill("3")

    // Switch to scheduled publishing
    await modal.getByRole("button", { name: "예약 발행" }).click()
    await expect(modal.getByTestId("publish-schedule-input")).toBeVisible()

    const submitButton = modal.getByTestId("editor-publish-submit-button")
    await expect(submitButton).toHaveText("예약 발행")
    await submitButton.click()

    await expect.poll(() => submittedPayloads.length).toBe(1)
    const submittedPayload = submittedPayloads[0]
    expect(submittedPayload?.published).toBe(false)
    expect(submittedPayload?.listed).toBe(true)
    expect(typeof submittedPayload?.scheduledAt).toBe("string")
    expect(submittedPayload?.seriesName).toBe("Compiler Design")
    expect(submittedPayload?.seriesOrder).toBe(3)
    expect(submittedPayload?.canonicalUrl).toBe("https://origin.example.com/posts/compiler-pass")
  })

  test("public post detail renders external canonical link and ordered series navigation card", async ({ page }) => {
    await page.route("**/member/api/v1/auth/me", async (route) => {
      await fulfillJson(route, { resultCode: "401-1", msg: "unauthorized" }, 401)
    })
    await page.route("**/post/api/v1/posts/1401", async (route) => {
      await fulfillJson(route, {
        id: 1401,
        createdAt: "2026-11-20T00:00:00Z",
        modifiedAt: "2026-11-20T01:00:00Z",
        authorId: 1,
        authorName: "aquila",
        authorUsername: "aquila",
        title: "Part 1: Lexer",
        summary: "Building a zero-copy lexer",
        summarySource: "MANUAL",
        content: "## Lexer states\n\nBody text.",
        type: "Post",
        tags: ["compiler"],
        category: ["Engineering"],
        published: true,
        listed: true,
        seriesName: "Compiler Design",
        seriesOrder: 1,
        canonicalUrl: "https://origin.example.com/archive/part-1",
        likesCount: 0,
        hitCount: 0,
        actorCanModify: false,
        actorCanDelete: false,
      })
    })
    await page.route("**/post/api/v1/posts/1401/series", async (route) => {
      await fulfillJson(route, {
        seriesName: "Compiler Design",
        items: [
          { id: 1401, title: "Part 1: Lexer", seriesOrder: 1, createdAt: "2026-11-20T00:00:00Z" },
          { id: 1402, title: "Part 2: Parser", seriesOrder: 2, createdAt: "2026-11-25T00:00:00Z" },
        ],
      })
    })
    await page.route("**/post/api/v1/posts/1401/adjacent", async (route) => {
      await fulfillJson(route, { prevPost: null, nextPost: null })
    })
    await page.route("**/post/api/v1/posts/1401/hit", async (route) => {
      await fulfillJson(route, { resultCode: "200-1", msg: "ok", data: { hitCount: 1 } })
    })

    await page.goto("/posts/1401")
    await expect(page.getByRole("heading", { name: "Part 1: Lexer" })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://origin.example.com/archive/part-1"
    )

    const seriesCard = page.getByTestId("post-series-card")
    await expect(seriesCard).toBeVisible()
    await expect(seriesCard).toContainText("Compiler Design")
    await expect(seriesCard).toContainText("1 / 2")
    await expect(seriesCard.locator('a[href="/posts/1401"]')).toHaveAttribute("aria-current", "page")
    await expect(seriesCard.locator('a[href="/posts/1402"]')).toContainText("Part 2: Parser")
  })

  test("coarse pointer mobile viewport preserves >= 16px table cell input and visible compact word count pill", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    try {
      await setupAdminEditorRoutes(page, {
        initialContent: "Intro paragraph outside table.\n\n| Key | Value |\n| --- | --- |\n| Alpha | Beta |",
      })
      await page.goto("/admin/editor/990")

      const hud = page.getByTestId("editor-status-hud")
      await expect(hud).toBeVisible()
      await expect(hud).toContainText("단어")

      const tableWidget = page.getByTestId("cm-live-table-widget")
      await expect(tableWidget).toBeVisible()
      await tableWidget.locator("td").first().click()
      const cellInput = tableWidget.getByTestId("cm-live-table-cell-input")
      await expect(cellInput).toBeVisible()
      const fontSizePx = await cellInput.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      expect(fontSizePx).toBeGreaterThanOrEqual(16)
    } finally {
      await context.close()
    }
  })
})
