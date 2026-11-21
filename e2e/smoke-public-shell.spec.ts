import { expect, test } from "@playwright/test"
import { existsSync, readFileSync } from "fs"
import path from "path"
import { resolveStaticAdminProfileSeed } from "../src/libs/server/postDetailPage"
import {
  mockAvatarAsset,
  mockFeedEndpoints,
  mockPublicAdminProfile,
  PUBLIC_ADMIN_PROFILE_ROUTE,
} from "./helpers/smokeFixtures"

test.beforeEach(async ({ page }) => {
  await mockAvatarAsset(page)
  await mockPublicAdminProfile(page)
})

test.describe("core smoke public shell", () => {
  test("system dark 공개 페이지는 hydration 첫 렌더와 bootstrap 동기화 경계를 분리한다", async () => {
    const useSchemeSource = readFileSync(path.resolve(__dirname, "../src/hooks/useScheme.ts"), "utf8")
    const rootLayoutSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/index.tsx"), "utf8")

    expect(useSchemeSource).toContain("LIGHT_SCHEME")
    expect(useSchemeSource).toContain("Intentional light-only")
    expect(useSchemeSource).toContain("PR 1275")
    expect(useSchemeSource).toContain("HIG P5-5")
    expect(useSchemeSource).toContain("Clamp: requested scheme (including \"dark\") cannot leave light-only.")
    expect(useSchemeSource).not.toContain("resolveBootstrapScheme")
    expect(rootLayoutSource).toContain("useScheme()")
    expect(rootLayoutSource).toContain('const effectiveScheme = "light"')
    expect(rootLayoutSource).not.toContain("showThemeToggle")
    expect(rootLayoutSource).not.toMatch(/from ["'].*ThemeToggle["']/)
  })

  test("OS 다크 첫 로드는 bootstrap guard를 삽입하고 공개 V4 route는 light로 수렴한다", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await mockFeedEndpoints(page)
    await page.route("**/member/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
      })
    })

    await page.addInitScript(() => {
      type BootstrapCaptureWindow = Window & { __aquilaBootstrapStyles?: string[] }

      const captureWindow = window as BootstrapCaptureWindow
      const originalAppendChild = Node.prototype.appendChild
      captureWindow.__aquilaBootstrapStyles = []
      Node.prototype.appendChild = function appendChildWithBootstrapCapture<T extends Node>(
        child: T
      ): T {
        if (
          child instanceof HTMLStyleElement &&
          child.getAttribute("data-aquila-scheme-bootstrap-style") === "true"
        ) {
          captureWindow.__aquilaBootstrapStyles?.push(child.textContent || "")
        }

        return originalAppendChild.call(this, child) as T
      }
    })

    await page.goto("/", { waitUntil: "domcontentloaded" })

    type FirstLoadSchemeCapture = {
      bodyBackground: string
      datasetScheme?: string
      styles: string[]
    }
    const readFirstLoadScheme = async (): Promise<FirstLoadSchemeCapture | null> => {
      try {
        return await page.evaluate(() => {
          type BootstrapCaptureWindow = Window & { __aquilaBootstrapStyles?: string[] }

          const captureWindow = window as BootstrapCaptureWindow
          return {
            bodyBackground: window.getComputedStyle(document.body).backgroundColor,
            datasetScheme: document.documentElement.dataset.aquilaScheme,
            styles: captureWindow.__aquilaBootstrapStyles ?? [],
          }
        })
      } catch {
        return null
      }
    }

    let firstLoadScheme: FirstLoadSchemeCapture | null = null
    for (let attempt = 0; attempt < 50; attempt += 1) {
      firstLoadScheme = await readFirstLoadScheme()
      if (firstLoadScheme?.styles[0]) break
      await page.waitForTimeout(100)
    }

    const bootstrapStyle = firstLoadScheme?.styles[0]
    if (!firstLoadScheme || !bootstrapStyle) {
      throw new Error("OS 다크 첫 로드 bootstrap style을 캡처하지 못했습니다.")
    }

    expect(firstLoadScheme.datasetScheme).toBe("light")
    expect(firstLoadScheme.bodyBackground).toBe("rgb(247, 247, 245)")
    expect(bootstrapStyle).toContain("html[data-aquila-scheme-bootstrap]{background:#f7f7f5;color-scheme:light;}")
    expect(bootstrapStyle).toContain("html[data-aquila-scheme-bootstrap] body{background:#f7f7f5;color:#101214;color-scheme:light;}")
    expect(bootstrapStyle).not.toContain('html[data-aquila-scheme-bootstrap="dark"] *{color-scheme:dark!important;}')
    expect(bootstrapStyle).not.toContain("background-color:transparent!important")
    expect(bootstrapStyle).not.toContain("#121212")
  })

  test("public blog appearance는 V4 전역 theme와 sticky header 계약을 유지한다", async () => {
  const rootLayoutSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/index.tsx"), "utf8")
  const headerSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/index.tsx"), "utf8")
  const navBarSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/NavBar.tsx"), "utf8")
  const navBarMobileMenuStylesSource = readFileSync(
    path.resolve(__dirname, "../src/layouts/RootLayout/Header/NavBarMobileMenu.styles.ts"),
    "utf8"
  )
  const logoSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/Logo.tsx"), "utf8")
  const adminShellSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShell.tsx"), "utf8")
  const adminPageSource = readFileSync(path.resolve(__dirname, "../src/libs/server/adminPage.ts"), "utf8")
  const appSource = readFileSync(path.resolve(__dirname, "../src/pages/_app.tsx"), "utf8")
  const homePageSource = readFileSync(path.resolve(__dirname, "../src/pages/index.tsx"), "utf8")
  const aboutPageSource = readFileSync(path.resolve(__dirname, "../src/pages/about.tsx"), "utf8")
  const postDetailPageSource = readFileSync(path.resolve(__dirname, "../src/libs/server/postDetailPage.ts"), "utf8")
  const useAdminProfileSource = readFileSync(path.resolve(__dirname, "../src/hooks/useAdminProfile.ts"), "utf8")
  const themeSource = readFileSync(path.resolve(__dirname, "../src/styles/theme.ts"), "utf8")
  const globalSource = readFileSync(
    path.resolve(__dirname, "../src/layouts/RootLayout/ThemeProvider/Global/index.tsx"),
    "utf8"
  )

  expect(rootLayoutSource).not.toContain("resolvePublicBlogAppearance")
  expect(rootLayoutSource).toContain("useAdminProfile(initialAdminProfile")
  expect(headerSource).toContain('data-ui="app-header"')
  expect(headerSource).toContain("z-index: 50;")
  expect(headerSource).toContain("position: sticky;")
  expect(headerSource).toContain("background: var(--aq-page-bg);")
  expect(headerSource).toContain("border-bottom: 1px solid var(--aq-border);")
  expect(headerSource).toContain("max-width: 64rem;")
  expect(headerSource).toContain("@media (min-width: 640px)")
  expect(headerSource).toContain("@media (min-width: 1280px)")
  expect(themeSource).toContain('pageBackgroundImage: "none"')
  expect(themeSource).toContain('border: scheme === "light" ? "#dfe1e5" : schemeColors.gray6')
  expect(themeSource).toContain('borderStrong: scheme === "light" ? "#c8ccd2" : schemeColors.gray7')
  expect(themeSource).toContain('accent: scheme === "light" ? "#155eef" : "#78a7ff"')
  expect(themeSource).toContain('accentHover: scheme === "light" ? "#0d4ed8" : "#9bbdff"')
  expect(themeSource).toContain('accentMuted: scheme === "light" ? "#edf4ff" : "#17243d"')
  expect(globalSource).toContain(
    "--aq-header-bg: color-mix(in srgb, ${lightDesign.pageBackgroundColor} 92%, transparent);"
  )
  expect(globalSource).toContain("--aq-accent-link: ${lightDesign.accent};")
  expect(headerSource).not.toContain("data-autohide")
  expect(headerSource).not.toContain("data-hidden")
  expect(headerSource).not.toContain("transform: translateY(0);")
  expect(headerSource).not.toContain("will-change: transform")
  expect(headerSource).not.toContain("backface-visibility")
  expect(headerSource).not.toContain("translateY(calc(-100%")
  expect(navBarSource).toContain("min-height: 44px;")
  expect(navBarSource).toContain("min-width: ${control.lg}px;")
  expect(navBarSource).toContain("min-height: ${control.lg}px;")
  expect(navBarSource).toContain("border-radius: 0.375rem;")
  expect(navBarSource).toContain("const [activeHash, setActiveHash] = useState<string | null>(null)")
  expect(navBarSource).toContain("window.addEventListener(\"hashchange\", syncHash)")
  expect(navBarSource).toContain("return () => window.removeEventListener(\"hashchange\", syncHash)")
  expect(navBarSource).toContain('id === "notes" && router.pathname === "/" && activeHash !== "topics"')
  expect(navBarSource).toContain('id === "topics" && router.pathname === "/" && activeHash === "topics"')
  expect(navBarSource).not.toContain("theme.variables.navControl.height")
  expect(navBarSource).toContain("@media (min-width: 640px)")
  expect(navBarSource).not.toContain("@media (max-width: 860px)")
  expect(navBarSource).not.toContain("@media (max-width: 720px)")
  expect(navBarSource).toContain("const [mobileMenuOpen, setMobileMenuOpen] = useState(false)")
  expect(navBarSource).toContain('className="mobileMenuButton"')
  expect(navBarSource).toContain('className="mobileMenuPanel"')
  expect(navBarSource).toContain('createPortal(')
  expect(navBarSource).toContain("document.body")
  expect(navBarSource).toContain('from "src/design-system/useModalFocusTrap"')
  expect(navBarSource).toContain("useModalFocusTrap({")
  expect(navBarSource).toContain("returnFocusRef: mobileMenuButtonRef")
  expect(navBarMobileMenuStylesSource).toContain('from "src/styles/zIndexes"')
  expect(navBarMobileMenuStylesSource).toContain("zIndexes.mobileNavOverlay")
  expect(navBarSource).toContain('data-ui="mobile-nav-search"')
  expect(navBarSource).toContain('aria-keyshortcuts="Meta+K Control+K"')
  expect(navBarSource).toContain('className="desktopLinks"')
  expect(navBarSource).toContain('className="searchButton"')
  expect(navBarSource).toContain('router.pathname === "/" ? t("navSearch") : t("navSearchTriggerAria")')
  expect(navBarSource).toContain('className="langToggleBtn"')
  expect(navBarSource).toContain("waitForFeedSearchInputFocus")
  expect(navBarSource).toContain('from "src/routes/Feed/feedSearchFocus"')
  expect(navBarSource).not.toContain('from "src/routes/Feed/SearchInput"')
  expect(navBarSource).not.toContain("ThemeToggle")
  expect(navBarSource).not.toContain("showThemeToggle")
  expect(navBarSource).toContain(".langToggleBtn {\n    display: none;")
  expect(navBarSource).toContain(".mobileMenuButton {\n    display: inline-flex;")
  expect(navBarSource).not.toContain(".mobileMenuPanel {\n      display: grid;")
  expect(existsSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/NotificationBell.tsx"))).toBe(false)
  expect(existsSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/NotificationBell.styles.ts"))).toBe(false)
  expect(existsSync(path.resolve(__dirname, "../src/layouts/RootLayout/Header/useNotificationBellState.ts"))).toBe(false)
  expect(headerSource).not.toContain('blogDesign === "grid"')
  expect(logoSource).not.toContain("useAdminProfile")
  expect(logoSource).not.toContain('blogDesign === "grid"')
  expect(logoSource).not.toContain("@media (max-width: 720px)")
  expect(logoSource).toContain("blogTitle")
  expect(adminShellSource).not.toContain("useAdminProfile")
  expect(adminPageSource).toContain("initialProfileSnapshot?: AdminProfile | null")
  expect(adminPageSource).not.toContain("fetchServerAdminProfile")
  expect(adminPageSource).not.toContain("resolvePublicAdminProfileSnapshot")
  expect(appSource).toContain("initialAdminProfile={initialAdminProfile}")
  expect(appSource).toContain("initialProfileSnapshot?: AdminProfile | null")
  expect(appSource).toContain(
    "appPageProps.initialAdminProfile ?? appPageProps.initialProfileSnapshot ?? null"
  )
  expect(homePageSource).toContain("resolveStaticAdminProfileSeed")
  expect(homePageSource).toContain("initialAdminProfileSource")
  expect(homePageSource).toContain('initialAdminProfileSource === "unavailable"')
  expect(aboutPageSource).toContain("initialAdminProfileSource")
  expect(aboutPageSource).toContain("resolvePublicAdminProfileCacheControl")
  expect(postDetailPageSource).toContain("queryKey.adminProfile()")
  expect(postDetailPageSource).toContain("initialAdminProfile")
  expect(postDetailPageSource).toContain('res.setHeader("Cache-Control", "private, no-store")')
  expect(postDetailPageSource).not.toContain("revalidate:")
  expect(appSource).toContain("shouldRefetchAdminProfileSource")
  expect(appSource).toContain("initialAdminProfileShouldRefetch")
  expect(rootLayoutSource).toContain('pathname[1] !== "_"')
  expect(rootLayoutSource).toContain(
    'const effectiveBlogDesign = isAdminRoute ? adminProfile?.blogDesign || "legacy" : "legacy"'
  )
  expect(rootLayoutSource).not.toContain("@media (max-width: 768px)")
  expect(rootLayoutSource).toContain("useScheme()")
  expect(rootLayoutSource).toContain('const effectiveScheme = "light"')
  expect(rootLayoutSource).not.toContain("showThemeToggle")
  expect(rootLayoutSource).toContain("enabled: shouldLoadAdminProfile")
  expect(rootLayoutSource).toContain("refetchOnMount: shouldRefetchAdminProfile")
  expect(rootLayoutSource).toContain("staleTimeMs: shouldRefetchAdminProfile ? 0 : undefined")
  expect(rootLayoutSource).toContain('pathname[1] !== "_"')
  expect(rootLayoutSource).toContain('pathname !== "/sitemap.xml"')
  expect(appSource).toContain("initialProfileSnapshot?: AdminProfile | null")
  expect(useAdminProfileSource).toContain("enabled?: boolean")
  expect(useAdminProfileSource).toContain("refetchOnMount?: boolean")
  expect(useAdminProfileSource).toContain("staleTimeMs?: number")
})

  test("post detail adminProfile seed는 published와 unavailable source를 구분한다", async () => {
  const publishedProfile = {
    username: "aquila",
    name: "aquila",
    nickname: "aquila",
    profileImageUrl: "/avatar.png",
    blogDesign: "grid" as never,
    legacyBlogScheme: "light" as const,
  }

  const publishedSeed = await resolveStaticAdminProfileSeed(async () => publishedProfile)
  expect(publishedSeed).toEqual({ profile: publishedProfile, source: "published" })
  await expect(resolveStaticAdminProfileSeed(async () => {
    throw new Error("admin profile unavailable")
  })).resolves.toEqual({ profile: null, source: "unavailable" })
})

  test("about unavailable profile 응답은 public cache로 저장하지 않는다", async ({ page }) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
    })
  })
  await page.route(PUBLIC_ADMIN_PROFILE_ROUTE, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "503-1", msg: "profile unavailable" }),
    })
  })

  const unavailableResponse = await page.goto("/about")
  expect(unavailableResponse?.headers()["cache-control"]).toBe("private, no-store")
  expect(unavailableResponse?.headers()["server-timing"]).toContain('desc="unavailable"')
})

  test("about 자기소개 문구는 작성 개행을 유지하는 white-space 계약을 가진다", async ({ page }) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
    })
  })

  await mockPublicAdminProfile(page)
  await page.goto("/about")
  await expect(page.locator(".authorHeader h1")).toHaveText("소개")
  await expect(page.locator(".authorProse h2")).toHaveText("이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다.")

  const profileBioStyle = await page.locator(".authorProse p").evaluate((element) => {
    const styles = window.getComputedStyle(element as HTMLElement)
    return {
      whiteSpace: styles.whiteSpace,
      lineHeight: styles.lineHeight,
      text: element.textContent || "",
    }
  })

  expect(profileBioStyle.whiteSpace).toBe("pre-line")
  expect(profileBioStyle.lineHeight).not.toBe("normal")
  expect(profileBioStyle.text.length).toBeGreaterThan(0)
})

  test("about 공개 프로필은 AuthorLayout 구조와 원형 avatar를 유지한다", async ({ page }) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
    })
  })

  await mockPublicAdminProfile(page)
  await page.goto("/about")

  await expect(page.getByRole("heading", { level: 1, name: "About Me" })).toHaveCount(0)
  await expect(page.locator(".authorHeader h1")).toHaveText("소개")
  await expect(page.locator(".authorProfileCol")).toBeVisible()
  await expect(page.locator(".authorProse h2")).toHaveText("이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다.")
  await expect(page.locator(".authorProse")).toContainText("안녕하세요, 백엔드 개발자 아퀼라입니다.")
  await expect(page.locator('[data-ui="about-projects"]')).toBeVisible()
  await expect(page.locator('[data-ui="about-project-list"] .projectCard').first()).toBeVisible()
  await expect(page.locator('[data-ui="about-timeline"] .proseListItem').first()).toBeVisible()

  const aboutLayoutTone = await page.evaluate(() => {
    const parsePixel = (value: string) => Number.parseFloat(value.replace("px", ""))
    const avatar = document.querySelector('[data-ui="about-avatar"]') as HTMLElement | null
    const projectGrid = document.querySelector('[data-ui="about-project-list"]') as HTMLElement | null
    const projectCard = document.querySelector('[data-ui="about-project-list"] .projectCard') as HTMLElement | null
    const roleBadge = projectCard?.querySelector(".projectCardRole") as HTMLElement | null
    const sectionBlock = document.querySelector('[data-ui="about-projects"]') as HTMLElement | null
    const avatarStyle = avatar ? window.getComputedStyle(avatar) : null
    const projectGridStyle = projectGrid ? window.getComputedStyle(projectGrid) : null
    const projectCardStyle = projectCard ? window.getComputedStyle(projectCard) : null
    const roleBadgeStyle = roleBadge ? window.getComputedStyle(roleBadge) : null
    const sectionBlockStyle = sectionBlock ? window.getComputedStyle(sectionBlock) : null
    const gridCols = projectGridStyle?.gridTemplateColumns.trim().split(/\s+/) ?? []

    return {
      roleBadgeFontSize: roleBadgeStyle ? parsePixel(roleBadgeStyle.fontSize) : null,
      roleBadgeTextTransform: roleBadgeStyle?.textTransform ?? null,
      avatarBorderRadius: avatarStyle?.borderRadius ?? null,
      sectionBorderTopWidth: sectionBlockStyle?.borderTopWidth ?? null,
      projectGridDisplay: projectGridStyle?.display ?? null,
      projectGridColumnCount: gridCols.length,
      projectCardBorderTopWidth: projectCardStyle?.borderTopWidth ?? null,
      projectCardBorderRadius: projectCardStyle?.borderRadius ?? null,
    }
  })

  expect(aboutLayoutTone.roleBadgeFontSize).toBeLessThanOrEqual(12)
  expect(aboutLayoutTone.roleBadgeTextTransform).toBe("uppercase")
  expect(["9999px", "50%"]).toContain(aboutLayoutTone.avatarBorderRadius)
  expect(aboutLayoutTone.sectionBorderTopWidth).toBe("1px")
  expect(aboutLayoutTone.projectGridDisplay).toBe("grid")
  expect(aboutLayoutTone.projectGridColumnCount).toBe(2)
  expect(aboutLayoutTone.projectCardBorderTopWidth).toBe("2px")
  expect(aboutLayoutTone.projectCardBorderRadius).toBe("6px")

  const timelineAlignment = await page.evaluate(() => {
    const row = document.querySelector('[data-ui="about-timeline"] .proseListItem')
    const date = row?.querySelector(".proseListMeta") as HTMLElement | null
    const label = row?.querySelector("span:last-child") as HTMLElement | null
    const rowStyle = row ? getComputedStyle(row) : null
    const dateStyle = date ? getComputedStyle(date) : null
    const labelStyle = label ? getComputedStyle(label) : null

    return {
      display: rowStyle?.display ?? null,
      dateLineHeight: dateStyle?.lineHeight ?? null,
      labelLineHeight: labelStyle?.lineHeight ?? null,
    }
  })

  expect(timelineAlignment.display).toBe("flex")
  expect(timelineAlignment.dateLineHeight).not.toBe("normal")
  expect(timelineAlignment.labelLineHeight).not.toBe("normal")

  const socialLinkMetrics = await page.evaluate(() => {
    const link = document.querySelector(".authorSocialLink") as HTMLElement | null
    if (!link) return null
    const rect = link.getBoundingClientRect()
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
  })

  expect(socialLinkMetrics).not.toBeNull()
  expect(socialLinkMetrics?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(socialLinkMetrics?.height ?? 0).toBeGreaterThanOrEqual(44)
})

  test("상단 내비 컨트롤은 공통 높이 토큰을 유지한다", async ({ page }) => {
  await mockFeedEndpoints(page)
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "unauthorized" }),
    })
  })

  await page.goto("/")
  await expect(page.locator("[data-ui='nav-control']").first()).toBeVisible()

  const uniqueHeights = await page.locator("[data-ui='nav-control']").evaluateAll((elements) => {
    const roundedHeights = elements
      .map((element) => Math.round(element.getBoundingClientRect().height))
      .filter((value) => value > 0)
    return Array.from(new Set(roundedHeights))
  })

  expect(uniqueHeights.length).toBeGreaterThanOrEqual(1)
  expect(uniqueHeights.length).toBeLessThanOrEqual(2)
  for (const height of uniqueHeights) {
    expect(height).toBeGreaterThanOrEqual(34)
    expect(height).toBeLessThanOrEqual(44)
  }
})

  test("상세 페이지는 조회수만 1회 기록하고 공개 반응·댓글 요청을 만들지 않는다", async ({ page }) => {
  let hitCountRequest = 0
  let commentRequestCount = 0
  let likeRequestCount = 0
  const runtimeErrors: string[] = []
  const isHydrationRuntimeSignal = (value: string) =>
    /minified react error|hydration|did not match/i.test(value)

  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message)
  })

  page.on("console", (message) => {
    if (message.type() === "error" && isHydrationRuntimeSignal(message.text())) {
      runtimeErrors.push(message.text())
    }
  })

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname
    if (/^\/post\/api\/v1\/posts\/101\/comments(?:\/|$)/.test(pathname)) {
      commentRequestCount += 1
    }
    if (/^\/post\/api\/v1\/posts\/101\/like(?:\/|$)/.test(pathname)) {
      likeRequestCount += 1
    }
  })

  await page.route("**/post/api/v1/posts/101", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 101,
        createdAt: "2026-03-16T00:00:00Z",
        modifiedAt: "2026-03-16T00:00:00Z",
        authorId: 1,
        authorName: "관리자",
        authorUsername: "aquila",
        authorProfileImageDirectUrl: "/avatar.png",
        title: "상세 E2E 글",
        content: "본문 E2E",
        summary: "",
        summarySource: "NONE",
        tags: ["테스트태그"],
        category: [],
        published: true,
        listed: true,
        likesCount: 3,
        hitCount: 7,
        actorCanModify: false,
        actorCanDelete: false,
      }),
    })
  })

  await page.route("**/post/api/v1/posts/101/hit", async (route) => {
    hitCountRequest += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "ok",
        data: { hitCount: 8 },
      }),
    })
  })

  await page.goto("/posts/101")
  await expect(page.getByText("상세 E2E 글")).toBeVisible()
  await expect.poll(() => hitCountRequest).toBe(1)
  const viewStatChip = page.locator(".postSidebar .stats .statChip").filter({ hasText: "조회 8" })
  await expect(viewStatChip).toBeVisible()
  await expect(
    page.getByLabel("게시글 반응", { exact: true }).getByText("좋아요 3", { exact: true })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: /좋아요/ }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "게시글 공유" })).toBeVisible()
  await expect(page.getByRole("button", { name: /댓글/ })).toHaveCount(0)
  await expect(page.getByText(/^댓글(?:\s|$)/)).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(commentRequestCount).toBe(0)
  expect(likeRequestCount).toBe(0)
  expect(runtimeErrors).toEqual([])
})
})
