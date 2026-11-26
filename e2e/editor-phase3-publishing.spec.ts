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
  options?: {
    initialContent?: string
    onPutPost?: (body: Record<string, unknown>) => void
    onPostCreate?: (body: Record<string, unknown>) => void
    onAdmGetPost?: (id: number) => void
    onPutTempDraft?: (body: Record<string, unknown>) => void
  }
) => {
  let nextCreatedId = 995
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
    if (urlPath === "/post/api/v1/adm/posts" && method === "GET") {
      await fulfillJson(route, { content: Array.from(drafts.values()), totalPages: 1, totalElements: drafts.size })
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
    if (method === "GET" && Number.isFinite(id)) options?.onAdmGetPost?.(id)
    const found = drafts.get(id) ?? drafts.get(990)
    await fulfillJson(route, found)
  })
  await page.route("**/api/revalidate", async (route) => {
    await fulfillJson(route, { revalidated: true })
  })
  await page.route("**/post/api/v1/posts", async (route) => {
    if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/post/api/v1/posts") {
      const body = route.request().postDataJSON() as Record<string, unknown>
      options?.onPostCreate?.(body)
      const assignedId = nextCreatedId++
      const created = {
        id: assignedId,
        version: 1,
        title: body.title,
        content: body.content,
        summary: "Created summary",
        summarySource: "EXTRACTED",
        published: body.published,
        listed: body.listed,
        tempDraft: false,
        scheduledAt: body.scheduledAt ?? null,
        seriesName: body.seriesName ?? null,
        seriesOrder: body.seriesOrder ?? null,
        canonicalUrl: body.canonicalUrl ?? null,
      }
      drafts.set(assignedId, created)
      await fulfillJson(route, { resultCode: "201-1", msg: "created", data: created }, 201)
      return
    }
    await route.continue()
  })
  await page.route("**/post/api/v1/posts/temp/*", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null
    if (body) options?.onPutTempDraft?.(body)
    await fulfillJson(route, {
      resultCode: "200-1",
      msg: "saved",
      data: { id: 990, version: 2, summary: "", summarySource: "NONE" },
    })
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

  test("Escape on stacked delete confirm keeps drafts drawer open and deleting active dirty draft navigates cleanly", async ({
    page,
  }) => {
    await setupAdminEditorRoutes(page, { initialContent: "Alpha body line" })
    await page.goto("/admin/editor/990")

    // Make active draft dirty before 2.5s server autosave fires
    const editorTextbox = page.getByTestId("markdown-editor-content")
    await editorTextbox.click()
    await page.keyboard.type(" edited locally")

    await page.getByTestId("editor-temp-drafts-button").click()
    const drawer = page.getByTestId("editor-temp-drafts-dialog")
    await expect(drawer).toBeVisible()

    // Open confirm dialog on current active draft 990 and press Escape -> drawer stays open
    await page.getByTestId("temp-draft-delete-990").click()
    const confirmDialog = page.getByRole("dialog", { name: "삭제" })
    await expect(confirmDialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(confirmDialog).toHaveCount(0)
    await expect(drawer).toBeVisible()

    // Now confirm delete on active dirty draft 990 -> transitions cleanly to 991 with no unsaved modal
    await page.getByTestId("temp-draft-delete-990").click()
    await page.getByRole("dialog", { name: "삭제" }).getByRole("button", { name: "삭제" }).click()
    await expect(page).toHaveURL(/\/admin\/editor\/991$/)
    await expect(page.getByRole("dialog", { name: "저장되지 않은 변경이 있습니다" })).toHaveCount(0)
  })

  test("bubble link popover handles balanced-paren URLs and real pointer drag reorders adjacent blocks cleanly", async ({
    page,
  }) => {
    await setupAdminEditorRoutes(page, {
      initialContent: "First block [Docs (v2)](https://example.com/a_(b))\nSecond block\nThird block",
    })
    await page.goto("/admin/editor/990")

    const editorTextbox = page.getByTestId("markdown-editor-content")
    await editorTextbox.locator(".cm-line").first().click()
    await expect(editorTextbox).toContainText("Docs (v2)")

    // Place caret inside the balanced-paren markdown link on line 1 and verify bubble popover exposes Open & Remove
    await page.keyboard.press("Home")
    for (let i = 0; i < 14; i += 1) await page.keyboard.press("ArrowRight")

    const linkDialog = page.getByRole("dialog", { name: "선택 텍스트 링크 편집" })
    await expect(linkDialog).toBeVisible()
    await expect(linkDialog.getByRole("link", { name: /새 탭에서 링크 열기/ })).toBeVisible()
    await linkDialog.getByRole("button", { name: "링크 제거" }).click()
    await expect(editorTextbox).toContainText("First block Docs (v2)")

    // Real pointer drag: hovering top half of adjacent next block keeps lines intact (no-op),
    // then dragging downward past Third block bottom reorders blocks cleanly
    const firstLine = editorTextbox.locator(".cm-line").first()
    const secondLine = editorTextbox.locator(".cm-line").nth(1)
    const thirdLine = editorTextbox.locator(".cm-line").nth(2)
    await firstLine.hover()
    const handle = page.getByTestId("markdown-block-gutter-handle")
    await expect(handle).toBeVisible()

    const handleBox = await handle.boundingBox()
    const secondBox = await secondLine.boundingBox()
    const thirdBox = await thirdLine.boundingBox()
    expect(handleBox).not.toBeNull()
    expect(secondBox).not.toBeNull()
    expect(thirdBox).not.toBeNull()
    if (handleBox && secondBox && thirdBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(secondBox.x + 24, secondBox.y + secondBox.height * 0.15, { steps: 6 })
      await page.mouse.up()

      await expect(editorTextbox.locator(".cm-line").first()).toContainText("First block Docs (v2)")
      await expect(editorTextbox.locator(".cm-line").nth(1)).toContainText("Second block")

      await firstLine.hover()
      const handleBoxAfterNoOp = await handle.boundingBox()
      expect(handleBoxAfterNoOp).not.toBeNull()
      if (handleBoxAfterNoOp) {
        await page.mouse.move(
          handleBoxAfterNoOp.x + handleBoxAfterNoOp.width / 2,
          handleBoxAfterNoOp.y + handleBoxAfterNoOp.height / 2
        )
        await page.mouse.down()
        await page.mouse.move(thirdBox.x + 24, thirdBox.y + thirdBox.height * 0.85, { steps: 8 })
        await page.mouse.up()
      }
    }

    await expect(editorTextbox.locator(".cm-line").first()).toContainText("Second block")
    await expect(editorTextbox.locator(".cm-line").nth(2)).toContainText("First block Docs (v2)")
  })

  test("EN mode localizes thumbnail controls and body aria-label, and temp autosave sanitizes partial canonical URL", async ({
    page,
  }) => {
    const tempDraftBodies: Array<Record<string, unknown>> = []
    await page.addInitScript(() => {
      window.localStorage.setItem("aquila_blog_lang", "en")
    })
    await setupAdminEditorRoutes(page, {
      onPutTempDraft: (body) => tempDraftBodies.push(body),
    })
    await page.goto("/admin/editor/990")

    await expect(page.getByTestId("markdown-editor-content")).toHaveAttribute("aria-label", "Markdown body")

    // Open inspector if needed, type partial invalid canonical URL, and verify autosave sends null
    const inspectorToggle = page.getByTestId("editor-inspector-toggle")
    if ((await inspectorToggle.getAttribute("aria-pressed")) !== "true") {
      await inspectorToggle.click()
    }
    const inspector = page.getByTestId("editor-inspector-aside")
    const canonicalInput = inspector.getByLabel("Canonical URL (cross-post)")
    await canonicalInput.fill("https://")
    await expect.poll(() => tempDraftBodies.length, { timeout: 6000 }).toBeGreaterThan(0)
    expect(tempDraftBodies[tempDraftBodies.length - 1]?.canonicalUrl).toBeNull()

    // Open publish modal and verify localized thumbnail panel controls
    await page.getByTestId("editor-publish-open-button").click()
    const modal = page.getByTestId("editor-publish-dialog")
    await expect(modal).toBeVisible()
    await expect(modal).toContainText("Adjust thumbnail focus")
    await expect(modal).toContainText("Upload cover image")
    await expect(modal).not.toContainText("썸네일 위치 조정")
  })

  test("create-mode publish from /admin/editor/new and /admin/editor with source=local-draft syncs URL without duplicate GET or exit prompt", async ({
    page,
  }) => {
    const admGetPostIds: number[] = []
    await setupAdminEditorRoutes(page, {
      onAdmGetPost: (id) => admGetPostIds.push(id),
    })

    // 1. /admin/editor/new?source=local-draft -> publish -> /admin/editor/995?returnTo=%2Fadmin%2Fposts
    await page.goto("/admin/editor/new?source=local-draft&returnTo=%2Fadmin%2Fposts")
    await expect(page).toHaveURL(/\/admin\/editor\/new\?returnTo=%2Fadmin%2Fposts$/)
    await expect(page.locator("#post-title")).toBeVisible()
    await page.locator("#post-title").fill("Created Post From New Route")
    const editorTextbox = page.getByTestId("markdown-editor-content")
    await expect(editorTextbox.locator(".cm-line").first()).toBeVisible()
    await editorTextbox.click()
    await page.keyboard.type("Fresh markdown body from /admin/editor/new.")
    await expect(editorTextbox).toContainText("Fresh markdown body from /admin/editor/new.")

    await page.getByTestId("editor-publish-open-button").click()
    await page.getByTestId("editor-publish-submit-button").click()

    await expect(page).toHaveURL(/\/admin\/editor\/995\?returnTo=%2Fadmin%2Fposts$/)
    expect(admGetPostIds).not.toContain(995)
    await expect(page.locator("#post-title")).toHaveValue("Created Post From New Route")
    await expect(page.getByTestId("markdown-editor-content")).toContainText(
      "Fresh markdown body from /admin/editor/new."
    )

    // Exiting immediately must not trigger any unsaved-changes confirmation dialog
    await page.getByRole("button", { name: "← 글 관리" }).click()
    await expect(page.getByRole("dialog", { name: /저장되지 않은 변경/ })).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/posts$/)

    // 2. /admin/editor?source=local-draft -> publish -> /admin/editor/996
    await page.goto("/admin/editor?source=local-draft")
    await expect(page).toHaveURL(/\/admin\/editor$/)
    await expect(page.locator("#post-title")).toBeVisible()
    await page.locator("#post-title").fill("Created Post From Root Route")
    const rootEditorTextbox = page.getByTestId("markdown-editor-content")
    await expect(rootEditorTextbox.locator(".cm-line").first()).toBeVisible()
    await rootEditorTextbox.click()
    await page.keyboard.type("Fresh markdown body from /admin/editor.")
    await expect(rootEditorTextbox).toContainText("Fresh markdown body from /admin/editor.")

    await page.getByTestId("editor-publish-open-button").click()
    await page.getByTestId("editor-publish-submit-button").click()

    await expect(page).toHaveURL(/\/admin\/editor\/996$/)
    expect(admGetPostIds).not.toContain(996)
    await expect(page.locator("#post-title")).toHaveValue("Created Post From Root Route")
  })

  test("reading mode restores scroll ratio after delayed MarkdownRenderer chunk mount and EN mode localizes CM6 widgets", async ({
    page,
  }) => {
    const longSections = Array.from(
      { length: 65 },
      (_, idx) =>
        `## Section ${idx + 1}\n\nParagraph ${idx + 1} with enough explanatory prose to ensure tall vertical overflow across both editing and reading surfaces.`
    ).join("\n\n")

    await setupAdminEditorRoutes(page, { initialContent: longSections })
    await page.goto("/admin/editor/990")
    await expect(page.getByTestId("markdown-editor-content").locator(".cm-line").first()).toBeVisible()

    // Scroll live editor host to ~50%
    const beforeMetrics = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>('[data-testid="editor-paper-scroll-sheet"]')
      const scroller = document.querySelector<HTMLElement>(".cm-scroller")
      const host =
        scroller && scroller.clientHeight > 0 && scroller.scrollHeight > scroller.clientHeight + 2
          ? scroller
          : sheet
      if (!host) return null
      const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight)
      host.scrollTop = Math.round(maxScroll * 0.5)
      return {
        scrollTop: host.scrollTop,
        maxScroll,
        ratio: maxScroll > 0 ? host.scrollTop / maxScroll : 0,
      }
    })
    expect(beforeMetrics).not.toBeNull()
    expect(beforeMetrics!.scrollTop).toBeGreaterThan(200)

    // Delay dynamic chunk fetch on first reading-mode toggle so loading placeholder renders asynchronously
    await page.route("**/_next/static/chunks/**/*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 160))
      await route.continue()
    })

    await page.getByRole("button", { name: "읽기 뷰" }).click()
    await expect(page.locator('[data-testid="markdown-editor-reading-surface"] .aq-markdown')).toBeVisible()

    // Allow two rAF passes for scroll ratio restoration to commit
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    )
    const afterMetrics = await page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>('[data-testid="editor-paper-scroll-sheet"]')
      const reading = document.querySelector<HTMLElement>('[data-testid="markdown-editor-reading-surface"]')
      const host = sheet && sheet.scrollHeight > sheet.clientHeight + 2 ? sheet : reading
      if (!host) return null
      const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight)
      return {
        scrollTop: host.scrollTop,
        maxScroll,
        ratio: maxScroll > 0 ? host.scrollTop / maxScroll : 0,
      }
    })
    expect(afterMetrics).not.toBeNull()
    expect(afterMetrics!.scrollTop).toBeGreaterThan(150)
    expect(Math.abs(afterMetrics!.ratio - beforeMetrics!.ratio)).toBeLessThan(0.2)

    await page.unroute("**/_next/static/chunks/**/*.js")

    // Verify EN CM6 widget localization in a clean English page session
    await page.addInitScript(() => {
      window.localStorage.setItem("aquila_blog_lang", "en")
    })
    await setupAdminEditorRoutes(page, {
      initialContent: [
        "Intro line",
        "",
        "![sample](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)",
        "",
        "```ts",
        "const x = 1",
        "```",
        "",
        "| Col1 | Col2 |",
        "| --- | --- |",
        "| A | B |",
        "",
        ":::callout",
        "En callout body",
        ":::",
        "",
        ":::summary",
        "En summary body",
        ":::",
        "",
        "- [x] En task",
        "[[WikiTarget|WikiAlias]]",
        "",
        ":::toggle",
        ":::",
      ].join("\n"),
    })
    await page.goto("/admin/editor/990")
    await expect(page.locator('.cm-editor[data-editor-lang="en"]')).toBeVisible()
    await expect(page.getByRole("button", { name: "Resize image width" })).toBeVisible()
    await expect(page.locator('input[placeholder="Caption / alt"]')).toBeVisible()
    await expect(page.getByRole("combobox", { name: "Code language" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible()
    await expect(page.getByRole("toolbar", { name: "Table quick edit toolbar" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Toggle expand/collapse" })).toBeVisible()
    await expect(page.locator(".cm-live-callout-title").filter({ hasText: "Callout" })).toBeVisible()
    await expect(page.locator(".cm-live-callout-title").filter({ hasText: "Summary" })).toBeVisible()
    await expect(page.locator(".cm-live-toggle-title").filter({ hasText: "Toggle block" })).toBeVisible()
    await expect(page.getByRole("checkbox", { name: "Toggle task item" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Wikilink: WikiAlias" })).toBeVisible()
  })
})
