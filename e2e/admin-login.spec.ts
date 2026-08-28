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

test("관리자 로그인은 기존 세션 응답의 법적 재동의 상태를 보존한다", async ({ page }) => {
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

  await expect(page).toHaveURL(
    /\/settings\/privacy\?reconsent=required&next=%2Fadmin%2Feditor%2Fnew/
  )
  expect(navigationPaths[0]).toBe(
    "/settings/privacy?reconsent=required&next=%2Fadmin%2Feditor%2Fnew"
  )
})

test("관리자 로그인은 법적 재동의 상태가 없으면 fail closed 한다", async ({ page }) => {
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

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(
    page.getByText("법적 동의 상태를 확인하지 못했습니다. 다시 로그인해주세요.")
  ).toBeVisible()
})
