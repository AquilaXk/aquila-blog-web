import { expect, test, type Page } from "@playwright/test"

const adminMember = {
  id: 1,
  username: "admin",
  nickname: "Admin",
  isAdmin: true,
}

const fulfillLogin = async (page: Page) => {
  await page.route("**/member/api/v1/auth/login", async (route) => {
    await route.fulfill({ contentType: "application/json", status: 200, body: "{}" })
  })
}

const submitAdminLogin = async (page: Page) => {
  await page.getByLabel("이메일").fill("admin@example.com")
  await page.getByLabel("비밀번호").fill("password")
  await page.getByRole("button", { name: "로그인" }).click()
}

test("관리자 로그인은 저장한 정규화 이메일을 다음 방문에 복원하고 해제하면 제거한다", async ({ page }) => {
  await page.goto("/admin/login")

  await page.getByLabel("이메일").fill("  ADMIN@example.com  ")
  await page.getByLabel("아이디 저장").check()
  await page.reload()

  await expect(page.getByLabel("이메일")).toHaveValue("admin@example.com")

  await page.getByLabel("아이디 저장").uncheck()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("auth.admin.savedEmail.v1")))
    .toBeNull()
})

test("관리자 로그인은 선택한 로그인 유지 값을 요청에 그대로 보낸다", async ({ page }) => {
  let loginPayload: unknown
  await page.route("**/member/api/v1/auth/login", async (route) => {
    loginPayload = route.request().postDataJSON()
    await route.fulfill({ contentType: "application/json", status: 401, body: "{}" })
  })

  await page.goto("/admin/login")
  await expect(page.getByLabel("로그인 유지")).toBeChecked()
  await page.getByLabel("로그인 유지").uncheck()
  await submitAdminLogin(page)

  expect(loginPayload).toEqual(
    expect.objectContaining({ email: "admin@example.com", password: "password", rememberMe: false })
  )
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("auth.admin.keepSignedIn.v1")))
    .toBe("false")
})

test("관리자 로그인은 재동의가 필요해도 요청한 관리자 경로로 이동한다", async ({ page }) => {
  const navigationPaths: string[] = []
  page.on("request", (request) => {
    if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return
    const url = new URL(request.url())
    navigationPaths.push(`${url.pathname}${url.search}`)
  })

  await fulfillLogin(page)
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ...adminMember,
        legalReconsent: { required: true },
      }),
    })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  navigationPaths.length = 0
  await submitAdminLogin(page)

  await expect(page).toHaveURL(/\/admin\/editor\/new$/)
  expect(navigationPaths[0]).toBe("/admin/editor/new")
})

test("관리자 로그인은 법적 재동의 상태가 없어도 요청한 관리자 경로로 이동한다", async ({ page }) => {
  await fulfillLogin(page)
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(adminMember),
    })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  await submitAdminLogin(page)

  await expect(page).toHaveURL(/\/admin\/editor\/new$/)
})

test("관리자 로그인은 세션을 확인하지 못하면 로그인 페이지에 오류를 표시한다", async ({ page }) => {
  await fulfillLogin(page)
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({ contentType: "application/json", status: 503, body: "{}" })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  await submitAdminLogin(page)

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(
    page.getByText("관리자 세션을 확인하지 못했습니다. 다시 로그인해주세요.")
  ).toBeVisible()
})
