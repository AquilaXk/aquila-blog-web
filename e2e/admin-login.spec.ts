import { expect, test, type Page } from "@playwright/test"

const adminMember = {
  id: 1,
  username: "admin",
  nickname: "Admin",
  isAdmin: true,
}

const adminCodeClockStart = new Date("2026-08-31T00:00:00.000Z")

const fulfillAdminEmailChallenge = async (page: Page) => {
  await page.route(
    "**/member/api/v1/auth/admin-email/request",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          data: {
            challengeId: "challenge-id-1234567890",
            expiresInSeconds: 300,
          },
        }),
      })
    }
  )
}

const requestAdminEmailCode = async (page: Page) => {
  await expect(
    page.getByRole("button", { name: "인증 코드 받기" })
  ).toBeEnabled()
  await page.getByLabel("이메일").fill("admin@example.com")
  await page.getByRole("button", { name: "인증 코드 받기" }).click()
}

const verifyAdminEmailCode = async (page: Page) => {
  await page.getByLabel("인증 코드").fill("12345678")
  await page.getByRole("button", { name: "로그인" }).click()
}

test("관리자 이메일 로그인은 비밀번호 없이 로그인 유지 선택을 challenge 요청에만 반영한다", async ({
  page,
}) => {
  const requestPayloads: Array<{ email: string; rememberMe: boolean }> = []
  await page.route(
    "**/member/api/v1/auth/admin-email/request",
    async (route) => {
      requestPayloads.push(route.request().postDataJSON())
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          data: {
            challengeId: `challenge-id-${requestPayloads.length}-1234567890`,
            expiresInSeconds: 600,
          },
        }),
      })
    }
  )

  await page.goto("/admin/login")

  await expect(page.getByLabel("비밀번호")).toHaveCount(0)
  await expect(page.getByLabel("로그인 유지")).not.toBeChecked()
  await requestAdminEmailCode(page)
  expect(requestPayloads[0]).toEqual({
    email: "admin@example.com",
    rememberMe: false,
  })
  await page.getByRole("button", { name: "이메일 다시 입력" }).click()
  await page.getByLabel("로그인 유지").check()
  await page.getByRole("button", { name: "인증 코드 받기" }).click()
  expect(requestPayloads[1]).toEqual({
    email: "admin@example.com",
    rememberMe: true,
  })
})

test("관리자 이메일 로그인은 저장한 정규화 이메일만 다음 방문에 복원한다", async ({
  page,
}) => {
  await page.goto("/admin/login")

  await page.getByLabel("이메일").fill("  ADMIN@example.com  ")
  await page.getByLabel("아이디 저장").check()
  await page.reload()

  await expect(page.getByLabel("이메일")).toHaveValue("admin@example.com")
  await expect(page.getByLabel("로그인 유지")).not.toBeChecked()

  await page.getByLabel("아이디 저장").uncheck()
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("auth.admin.savedEmail.v1")
      )
    )
    .toBeNull()
})

test("관리자 이메일 코드는 세션 확인 후 안전한 관리자 경로로 이동하고 저장소에 남지 않는다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        challengeId: "challenge-id-1234567890",
        code: "12345678",
      })
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(adminMember),
    })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(page).toHaveURL(/\/admin\/editor\/new$/)
  const authStorageKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) =>
      /challenge|code|token|session/i.test(key)
    )
  )
  expect(authStorageKeys).toEqual([])
})

test("관리자 이메일 요청은 진행 상태를 알리고 코드 입력으로 자연스럽게 전환한다", async ({
  page,
}) => {
  let releaseRequest!: () => void
  const requestPending = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route(
    "**/member/api/v1/auth/admin-email/request",
    async (route) => {
      await requestPending
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          data: {
            challengeId: "challenge-id-1234567890",
            expiresInSeconds: 300,
          },
        }),
      })
    }
  )

  await page.goto("/admin/login")
  await page.getByLabel("이메일").fill("admin@example.com")
  await page.getByRole("button", { name: "인증 코드 받기" }).click()

  const inputGroup = page.getByRole("group", { name: "관리자 로그인 입력" })
  await expect(inputGroup).toHaveAttribute("aria-busy", "true")
  const requestStatus = page.getByText("인증 코드를 전송하고 있습니다.", {
    exact: true,
  })
  await expect(requestStatus).toHaveAttribute("aria-live", "polite")
  await expect(requestStatus).toBeVisible()
  await expect(
    inputGroup.getByText("인증 코드를 전송하고 있습니다.")
  ).toHaveCount(0)
  const loginButton = page.getByRole("button", { name: "로그인" })
  await expect(loginButton).toBeDisabled()
  await expect(page.getByRole("button", { name: "전송 중..." })).toHaveCount(0)
  await expect(page.getByLabel("인증 코드")).toBeVisible()
  await expect(page.getByLabel("인증 코드")).toBeDisabled()

  releaseRequest()

  await expect(inputGroup).toHaveAttribute("aria-busy", "false")
  await expect(page.getByRole("timer")).toHaveText("05:00")
  await expect(page.getByLabel("인증 코드")).toBeEnabled()
  await expect(page.getByLabel("인증 코드")).toBeFocused()
  await expect(loginButton).toBeEnabled()
})

test("만료된 관리자 인증 코드는 제출할 수 없다", async ({ page }) => {
  await page.clock.install({ time: adminCodeClockStart })
  await page.route(
    "**/member/api/v1/auth/admin-email/request",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          data: {
            challengeId: "challenge-id-1234567890",
            expiresInSeconds: 1,
          },
        }),
      })
    }
  )

  await page.goto("/admin/login")
  await page.getByLabel("이메일").fill("admin@example.com")
  await page.getByRole("button", { name: "인증 코드 받기" }).click()

  await expect(page.getByRole("timer")).toHaveText("00:01")
  await page.clock.fastForward(1_000)
  await expect(page.getByRole("timer")).toHaveText("00:00")
  await expect(page.getByLabel("인증 코드")).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "인증 코드 만료됨" })
  ).toBeDisabled()
  await expect(
    page.getByText("인증 코드가 만료되었습니다. 새 코드를 요청해주세요.", {
      exact: true,
    })
  ).toBeVisible()
})

test("실제 만료 시각이 지나면 검증 요청을 보내지 않는다", async ({ page }) => {
  await page.clock.install({ time: adminCodeClockStart })
  await page.route(
    "**/member/api/v1/auth/admin-email/request",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          data: {
            challengeId: "challenge-id-1234567890",
            expiresInSeconds: 1,
          },
        }),
      })
    }
  )
  let verifyRequestCount = 0
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      verifyRequestCount += 1
      await route.fulfill({ status: 500, body: "{}" })
    }
  )

  await page.goto("/admin/login")
  await page.getByLabel("이메일").fill("admin@example.com")
  await page.getByRole("button", { name: "인증 코드 받기" }).click()
  await expect(page.getByRole("timer")).toHaveText("00:01")
  await page.getByLabel("인증 코드").fill("12345678")

  const challengeResponseTime = await page.evaluate(() => Date.now())
  await page.clock.setSystemTime(challengeResponseTime + 1_001)
  await page.getByRole("button", { name: "로그인" }).click()

  await expect(
    page.getByText("인증 코드가 만료되었습니다. 새 코드를 요청해주세요.", {
      exact: true,
    })
  ).toBeVisible()
  await expect(page.getByRole("timer")).toHaveText("00:00")
  await expect(
    page.getByRole("button", { name: "인증 코드 만료됨" })
  ).toBeDisabled()
  expect(verifyRequestCount).toBe(0)
})

test("관리자 이메일 검증은 이동이 시작된 뒤에도 완료 상태를 유지한다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify(adminMember),
    })
  })
  await page.route("**/admin/editor/new", async (route) => {
    await route.fulfill({ status: 204, body: "" })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  const inputGroup = page.getByRole("group", { name: "관리자 로그인 입력" })
  await expect(inputGroup).toHaveAttribute("aria-busy", "true")
  await expect(
    page.getByRole("button", { name: "관리자 페이지 여는 중..." })
  ).toBeDisabled()
  await expect(
    page.getByText("관리자 페이지를 열고 있습니다.", { exact: true })
  ).toBeVisible()

  await expect(page).toHaveURL(/\/admin\/login/)
})

test("관리자 이메일 로그인은 재동의 상태와 무관하게 요청한 관리자 경로를 유지한다", async ({
  page,
}) => {
  const navigationPaths: string[] = []
  page.on("request", (request) => {
    if (!request.isNavigationRequest() || request.frame() !== page.mainFrame())
      return
    const url = new URL(request.url())
    navigationPaths.push(`${url.pathname}${url.search}`)
  })
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
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
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(page).toHaveURL(/\/admin\/editor\/new$/)
  expect(navigationPaths[0]).toBe("/admin/editor/new")
})

test("잘못되거나 만료된 관리자 이메일 코드는 새 코드 요청 경로를 제공한다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 401,
        body: "{}",
      })
    }
  )

  await page.goto("/admin/login")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(
    page.getByText("인증 코드가 올바르지 않거나 만료되었습니다.")
  ).toBeVisible()
  await page.getByRole("button", { name: "이메일 다시 입력" }).click()
  await expect(
    page.getByRole("button", { name: "인증 코드 받기" })
  ).toBeVisible()
})

test("1~7자리 관리자 이메일 코드는 제출 후 검증 오류를 표시한다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)

  await page.goto("/admin/login")
  await requestAdminEmailCode(page)
  await page.getByLabel("인증 코드").fill("1234567")
  await page.getByRole("button", { name: "로그인" }).click()

  await expect(
    page.getByText("8자리 인증 코드를 입력해주세요.", { exact: true })
  ).toBeVisible()
})

test("구분자가 포함된 8자리 관리자 이메일 코드를 붙여넣을 수 있다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)

  await page.goto("/admin/login")
  await requestAdminEmailCode(page)
  await page.getByLabel("인증 코드").focus()
  await page.keyboard.insertText("1234 5678")

  await expect(page.getByLabel("인증 코드")).toHaveValue("12345678")
})

test("관리자 이메일 코드 검증 뒤 세션을 확인하지 못하면 세션을 종료하고 요청 단계로 돌아간다", async ({
  page,
}) => {
  let logoutRequests = 0
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: "{}",
    })
  })
  await page.route("**/member/api/v1/auth/logout", async (route) => {
    expect(route.request().method()).toBe("DELETE")
    logoutRequests += 1
    await route.fulfill({
      contentType: "application/json",
      status: 204,
      body: "",
    })
  })

  await page.goto("/admin/login?next=%2Fadmin%2Feditor%2Fnew")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(page).toHaveURL(/\/admin\/login/)
  await expect(
    page.getByText("관리자 세션을 확인하지 못했습니다. 새 코드를 요청해주세요.")
  ).toBeVisible()
  expect(logoutRequests).toBe(1)
  await expect(
    page.getByRole("button", { name: "인증 코드 받기" })
  ).toBeVisible()
})

test("관리자 이메일 코드 검증 뒤 isAdmin 없는 세션은 종료하고 요청 단계로 돌아간다", async ({
  page,
}) => {
  let logoutRequests = 0
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        ...adminMember,
        isAdmin: undefined,
        admin: true,
      }),
    })
  })
  await page.route("**/member/api/v1/auth/logout", async (route) => {
    expect(route.request().method()).toBe("DELETE")
    logoutRequests += 1
    await route.fulfill({
      contentType: "application/json",
      status: 204,
      body: "",
    })
  })

  await page.goto("/admin/login")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(
    page.getByText("관리자 권한이 필요한 페이지입니다.", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "인증 코드 받기" })
  ).toBeVisible()
  await expect(page.getByLabel("인증 코드")).toHaveCount(0)
  await expect(page.getByText(/인증 코드를 보냈습니다/)).toHaveCount(0)
  expect(logoutRequests).toBe(1)
})

test("관리자 이메일 코드 검증 뒤 세션 종료에 실패하면 종료 오류와 요청 단계를 표시한다", async ({
  page,
}) => {
  await fulfillAdminEmailChallenge(page)
  await page.route(
    "**/member/api/v1/auth/admin-email/verify",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: "{}",
      })
    }
  )
  await page.route("**/member/api/v1/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: "{}",
    })
  })
  await page.route("**/member/api/v1/auth/logout", async (route) => {
    expect(route.request().method()).toBe("DELETE")
    await route.fulfill({
      contentType: "application/json",
      status: 503,
      body: "{}",
    })
  })

  await page.goto("/admin/login")
  await requestAdminEmailCode(page)
  await verifyAdminEmailCode(page)

  await expect(
    page.getByText(
      "관리자 세션을 종료하지 못했습니다. 새 코드를 요청해주세요.",
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "인증 코드 받기" })
  ).toBeVisible()
})
