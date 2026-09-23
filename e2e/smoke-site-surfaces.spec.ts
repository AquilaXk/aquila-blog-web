import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * 회사·제품 표면 스모크. 두 라우트는 블로그와 같은 이미지에서 나가지만 전용 호스트의 루트로
 * 서빙되므로, 블로그 헤더와 본문 폭 컨테이너를 쓰지 않고 자기 헤더·풀블리드 섹션을 가져야 한다.
 *
 * 스크린샷은 1080x2340 원본 비율이 유지돼야 한다 - 폰 목업 프레임이 화면을 잘라 내면 검수본을
 * 쓰는 의미가 사라진다.
 */
const SCREENSHOT_ASPECT_RATIO = 1080 / 2340
const BLOG_CAPTURE_ASPECT_RATIO = 1920 / 733
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow", width: 600, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const

const measureLayoutOverflow = async (page: Page) =>
  await page.evaluate(() => {
    const layoutWidth = Math.min(document.documentElement.clientWidth, document.body.clientWidth)
    return {
      layoutWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }
  })

const expectNoHorizontalOverflow = async (page: Page) => {
  const { layoutWidth, scrollWidth } = await measureLayoutOverflow(page)
  expect(scrollWidth).toBeLessThanOrEqual(layoutWidth + 1)
}

/**
 * 레이아웃 크기로 비율을 본다. `getBoundingClientRect`는 transform이 걸린 요소에서 축 정렬
 * 바운딩 박스를 돌려주므로, 기울인 폰 목업에서는 원본 비율과 다른 값이 나온다.
 */
const measureRenderedAspectRatio = async (image: Locator) =>
  await image.evaluate((element) => {
    const measured = element as HTMLImageElement
    return measured.offsetWidth / measured.offsetHeight
  })

/**
 * 요소가 뷰포트 가로 범위 안에 실제로 남아 있는지 본다.
 *
 * `toBeVisible`로는 부족하다 - 그 단언은 박스가 비어 있지 않고 visibility가 살아 있는지만 보므로,
 * 상위 래퍼가 가로 overflow를 clip해 화면 밖으로 밀려난 요소도 그대로 통과한다. 헤더가 잘리는
 * 회귀는 정확히 그 형태이고, 가로 스크롤도 생기지 않아 overflow 단언에도 걸리지 않는다.
 */
const expectWithinViewport = async (page: Page, target: Locator, label: string) => {
  await expect(target).toBeVisible()
  const box = await target.boundingBox()
  expect(box, label).not.toBeNull()
  const viewport = page.viewportSize()
  const viewportWidth = viewport?.width ?? 0
  expect(box?.x ?? -1, label).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0), label).toBeLessThanOrEqual(viewportWidth + 1)
}

const expectTouchTargets = async (page: Page, selector: string) => {
  const boxes = await page.locator(selector).all()
  expect(boxes.length).toBeGreaterThan(0)
  for (const target of boxes) {
    const box = await target.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
}

test.describe("공개 표면 스모크: 회사 소개", () => {
  test("헤더·hero·역량·활동·문의 섹션이 렌더되고 canonical이 요청 호스트를 따른다", async ({ page, baseURL }) => {
    const response = await page.goto("/company")
    expect(response?.status()).toBe(200)

    await expect(page.getByRole("heading", { level: 1 })).toContainText("소프트웨어를 만듭니다")
    await expect(page.locator("#capabilities")).toBeVisible()
    await expect(page.locator("#work")).toBeVisible()
    await expect(page.locator("#approach")).toBeVisible()
    await expect(page.getByRole("heading", { name: "함께 만들 이야기가 있다면" })).toBeVisible()
    await expect(page.getByText("EasySubway 전국 정식 출시 준비 중")).toBeVisible()
    await expect(page.getByRole("link", { name: "이메일로 문의하기" })).toHaveAttribute(
      "href",
      "mailto:aquila@aquilaxk.site"
    )

    // 블로그 헤더(검색·로그인 shell)는 이 표면에 나오지 않는다.
    await expect(page.locator("[data-ui='app-header']")).toHaveCount(0)

    const canonical = page.locator("link[rel='canonical']")
    await expect(canonical).toHaveAttribute("href", `${baseURL}/company`)
    await expect(page.locator("meta[property='og:site_name']")).toHaveAttribute(
      "content",
      "Aquila Software"
    )
    await expect(page).toHaveTitle(/Aquila Software/)
    // 블로그 브랜드가 회사 표면 탭 제목에 강제로 붙지 않아야 한다.
    await expect(page).not.toHaveTitle(/AquilaLog/)
  })

  test("백엔드가 응답하지 않으면 소식 섹션은 자리를 채우지 않고 사라진다", async ({ page }) => {
    // e2e 웹서버는 도달 불가한 BACKEND_INTERNAL_URL로 뜬다. placeholder 카드를 만들지 않는 계약이다.
    await page.goto("/company")
    await expect(page.locator("#news")).toHaveCount(0)
    // 섹션이 사라졌는데 내비 항목이 남으면 '소식'은 아무 일도 하지 않는 죽은 anchor가 된다.
    const nav = page.getByRole("navigation", { name: "회사 소개 둘러보기" })
    await expect(nav.getByRole("link", { name: "소식" })).toHaveCount(0)
    // 나머지 항목은 그대로 있어야 한다 - 조건이 넓게 걸려 내비가 통째로 비면 그것도 회귀다.
    await expect(nav.getByRole("link", { name: "역량" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "제품" })).toBeVisible()
  })

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} ${viewport.width}x${viewport.height}에서 가로 넘침이 없다`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto("/company")
      await expectNoHorizontalOverflow(page)
    })
  }

  test("헤더 내비와 CTA는 44px 터치 타겟을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/company")
    await expectTouchTargets(page, "header a")
  })

  test("hero 폰 목업이 1080x2340 원본 비율을 유지한다", async ({ page }) => {
    await page.goto("/company")
    // hero 폰은 제품 검수본이므로 1080x2340이 잘리지 않아야 한다.
    const phone = page.locator("[data-ui='company-hero-phone']")
    await expect(phone).toBeVisible()
    expect(await measureRenderedAspectRatio(phone)).toBeCloseTo(SCREENSHOT_ASPECT_RATIO, 2)
  })

  test("브랜드 셀프 링크는 canonical과 같은 공개 URL이고 블로그 RSS alternate를 상속하지 않는다", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/company")
    // 브랜드 링크가 내부 rewrite 경로를 노출하면 전용 호스트에서 robots가 disallow한 중복 경로로
    // 방문자를 보낸다. 그 호스트의 공개 페이지는 루트이므로 resolved 공개 URL이어야 한다.
    await expect(page.locator("header a[aria-current='page']")).toHaveAttribute(
      "href",
      `${baseURL}/company`
    )
    // RSS는 블로그 호스트의 자산이다. 표면이 자기 호스트로 광고하면 같은 아이템이 두 번째 호스트의
    // 피드로 색인된다.
    await expect(page.locator("link[rel='alternate'][type='application/rss+xml']")).toHaveCount(0)

    // 조건이 넓게 걸려 블로그에서도 alternate가 사라지면 그것도 회귀다.
    await page.goto("/")
    await expect(page.locator("link[rel='alternate'][type='application/rss+xml']")).toHaveCount(1)
  })

  test("핵심 역량은 6개 카드가 한눈에 보이는 정적 그리드로 렌더된다", async ({ page }) => {
    await page.goto("/company")
    const grid = page.getByRole("region", { name: "핵심 역량 카드" })
    await expect(grid).toBeVisible()
    await expect(grid.locator("article")).toHaveCount(6)
  })

  test("2대 프로덕트 쇼케이스 카드와 하단 기술 신뢰성 텍스트 리스트를 렌더한다", async ({ page }) => {
    await page.goto("/company")
    const workSection = page.locator("#work")
    await expect(workSection.locator("[data-ui='company-showcase-easysubway']")).toBeVisible()
    await expect(workSection.locator("[data-ui='company-showcase-aquilalog']")).toBeVisible()
    await expect(workSection.getByRole("link", { name: "EasySubway 살펴보기" })).toBeVisible()
    await expect(workSection.getByRole("link", { name: "AquilaLog 기술 블로그 읽기" })).toBeVisible()

    const reliabilityList = workSection.locator("[data-ui='company-reliability-list']")
    await expect(reliabilityList).toBeVisible()
    await expect(reliabilityList.locator("li")).toHaveCount(3)
    await expect(workSection.getByText("DATA PIPELINE")).toBeVisible()
    await expect(workSection.getByText("INFRASTRUCTURE")).toBeVisible()
    await expect(workSection.getByText("QUALITY GATES")).toBeVisible()
  })

  test("통계 위젯은 정량 지표 중심의 값을 렌더한다", async ({ page }) => {
    await page.goto("/company")
    const statList = page.locator("#approach dl")
    await expect(statList).toBeVisible()
    await expect(statList.getByText("2개")).toBeVisible()
    await expect(statList.getByText("100%").first()).toBeVisible()
    await expect(statList.getByText("0원")).toBeVisible()
  })
})

test.describe("공개 표면 스모크: EasySubway 제품", () => {
  test("hero·개요·기능·제공 범위·문의 섹션이 렌더되고 canonical이 요청 호스트를 따른다", async ({
    page,
    baseURL,
  }) => {
    const response = await page.goto("/easysubway")
    expect(response?.status()).toBe(200)

    await expect(page.getByRole("heading", { level: 1 })).toContainText("먼저 보여주는 지하철")
    await expect(page.locator("#overview")).toBeVisible()
    await expect(page.locator("#features")).toBeVisible()
    await expect(page.locator("#scope")).toBeVisible()
    await expect(page.getByText("전국 정식 출시 준비 중").first()).toBeVisible()
    await expect(page.locator("[data-ui='app-header']")).toHaveCount(0)

    const canonical = page.locator("link[rel='canonical']")
    await expect(canonical).toHaveAttribute("href", `${baseURL}/easysubway`)
    await expect(page.locator("meta[property='og:site_name']")).toHaveAttribute("content", "EasySubway")
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", "/easysubway/og-image.png")
    await expect(page).toHaveTitle("교통약자를 먼저 생각한 지하철 길찾기 | EasySubway")
    await expect(page).not.toHaveTitle(/EasySubway.*EasySubway/)

    await expect(page.locator("#compare")).toBeVisible()
    await expect(page.locator("#faq")).toBeVisible()

    const description = page.locator("meta[name='description']")
    await expect(description).toHaveAttribute("content", /Android\/iOS/)
    await expect(description).toHaveAttribute("content", /무장애/)
    await expect(description).toHaveAttribute("content", /전국 정식 출시를 준비/)
  })

  test("390px 헤더의 내비 링크와 문의 CTA가 뷰포트 안에 남는다", async ({ page }) => {
    // 헤더가 단일 flex row로 고정돼 있으면 이 폭에서 우측 링크와 문의 CTA가 clip돼 닿을 수 없다.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/easysubway")

    const nav = page.getByRole("navigation", { name: "제품 소개 둘러보기" })
    await expectWithinViewport(page, nav.getByRole("link", { name: "문의" }), "문의 CTA")
    for (const label of ["기능", "제공 범위", "회사 소개"]) {
      await expectWithinViewport(page, nav.getByRole("link", { name: label }), label)
    }
    await expectTouchTargets(page, "header a")
  })

  test("셀프 링크는 공개 URL이고 회사 표면 교차 링크는 절대 URL이다", async ({ page, baseURL }) => {
    await page.goto("/easysubway")
    await expect(page.locator("header a[aria-current='page']")).toHaveAttribute(
      "href",
      `${baseURL}/easysubway`
    )
    // 회사는 자기 canonical 호스트를 가진 별개 표면이다. 상대 경로로 두면 제품 호스트의 catch-all이
    // 회사 페이지를 그 호스트 밑에 중복 서빙한다.
    for (const scope of [
      page.getByRole("navigation", { name: "제품 소개 둘러보기" }),
      page.getByRole("navigation", { name: "제품 관련 링크" }),
    ]) {
      await expect(scope.getByRole("link", { name: "회사 소개" })).toHaveAttribute(
        "href",
        "https://www.aquilaxk.site"
      )
    }
    await expect(page.locator("link[rel='alternate'][type='application/rss+xml']")).toHaveCount(0)
  })

  test("전국 정식 출시 범위와 무장애 이동 경로 명세를 노출한다", async ({ page }) => {
    await page.goto("/easysubway")
    const scope = page.locator("#scope")
    await expect(scope).toContainText("전국 기준")
    for (const staleScopeCopy of ["파일럿", "상록수", "사당", "2역"]) {
      await expect(scope).not.toContainText(staleScopeCopy)
    }

    // [Phase 1 P0] 교통약자를 위한 무장애 경로 기준 4대 규격 렌더 검증
    const routeSpec = page.getByRole("region", { name: "교통약자를 위한 무장애 경로 기준" })
    await expect(routeSpec).toBeVisible()
    await expect(routeSpec).toContainText("검증 완료")
    for (const specCategory of ["수직 이동", "환승 연계", "시설 데이터", "운행 안전"]) {
      await expect(routeSpec).toContainText(specCategory)
    }

    // [P1/P2] 실기기 타임라인 목업, 1:1 비교, FAQ, 공식 20개 노선 렌더 검증
    await expect(page.locator("main")).toContainText("빠른 환승·하차")
    await expect(page.locator("main")).toContainText("9-2 승차 위치 안내")
    await expect(page.locator("main")).toContainText("단차 0cm 이동")
    await expect(page.getByRole("region", { name: "자주 묻는 질문" })).toBeVisible()
    await expect(page.locator("#scope")).toContainText("공식 20개 노선 무장애 데이터 연동")
    await expect(page.locator("#compare")).toContainText("계단 80개 구간 통과 강요")
    await expect(page.locator("#compare")).toContainText("단차 0cm 엘리베이터 직결 동선")
    await expect(page.getByRole("link", { name: "서비스 문의하기" })).toBeVisible()
    await expect(page.getByRole("button", { name: "이메일 주소 복사" })).toBeVisible()

    // 시스템 에러 및 내부 엔지니어링 방어 카피 영구 제거 단언
    await expect(page.locator("main")).not.toContainText("현재 경로를 계산할 수 없어요")
    await expect(page.locator("main")).not.toContainText("Journey V3")
    await expect(page.locator("main")).not.toContainText("경로 검색은 계속")

    // [Phase 2 P1] 탈-슬롭: 9rem 고스트 넘버 및 BreakCut 띠 섹션 제거 단언
    await expect(page.locator("main")).not.toContainText("현재 서버 기준의 결과만 안내합니다")

    // [Phase 3 P2] 2x2 에디토리얼 기술 명세표 4대 팩트 렌더 검증
    const techSpec = page.getByRole("region", { name: "정식 출시 기술 명세" })
    await expect(techSpec).toBeVisible()
    for (const specLabel of ["적용 범위", "접근성 데이터", "서비스 형태", "제공 플랫폼"]) {
      await expect(techSpec).toContainText(specLabel)
    }

    // [Phase 3 P2] Not X but Y 대구법 카피라이팅 제거 단언
    for (const notXbutY of ["시간보다 먼저", "화면을 늘리는 대신", "넓히기 전에"]) {
      await expect(page.locator("main")).not.toContainText(notXbutY)
    }
  })

  test("스크롤 리빌 요소는 뷰포트 진입 시 is-visible 클래스를 부여받고 순차 노출된다", async ({
    page,
  }) => {
    await page.goto("/easysubway")

    const overviewIntro = page.locator("#overview [data-reveal]").first()
    await expect(overviewIntro).toHaveAttribute("data-reveal", "true")

    // 요소로 스크롤하여 진입 트리거
    await overviewIntro.scrollIntoViewIfNeeded()
    await expect(overviewIntro).toHaveClass(/is-visible/)
    await expect(overviewIntro).toHaveAttribute("data-visible", "true")

    // 기술 명세 셀 스태거 검증
    const techSpecCell = page.locator("[data-reveal-group='tech-specs']").first()
    await techSpecCell.scrollIntoViewIfNeeded()
    await expect(techSpecCell).toHaveClass(/is-visible/)
    await expect(techSpecCell).toHaveAttribute("data-visible", "true")

    // 키보드 탭 이동 시 focus-within으로 즉시 시각적 노출 보장 (A11y)
    const contactCta = page.locator("a[href^='mailto:']").last()
    await contactCta.focus()
    const contactBand = page.locator("[data-reveal]").filter({ has: contactCta })
    await expect(contactBand).toBeVisible()
  })

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} ${viewport.width}x${viewport.height}에서 가로 넘침이 없다`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto("/easysubway")
      await expectNoHorizontalOverflow(page)
    })
  }

  test("hero 폰 목업은 원본 비율을 유지하고 확대 컷만 잘린 컷으로 밝힌다", async ({ page }) => {
    await page.goto("/easysubway")
    // 전면 노출은 hero 한 번이며 1080x2340 원본 비율이어야 한다.
    const heroPhone = page.locator("main figure img").first()
    await expect(heroPhone).toBeVisible()
    expect(await measureRenderedAspectRatio(heroPhone)).toBeCloseTo(SCREENSHOT_ASPECT_RATIO, 2)
    // 기능 블록의 확대 컷은 잘린 컷이므로 캡션이 그 사실을 밝혀야 한다.
    await expect(page.locator("#features figcaption")).toContainText("화면 일부")
  })

  test("공개 페이지 자산에 개발용 광고 자리표시가 섞이지 않는다", async ({ page }) => {
    // 광고 슬롯이 없는 저장소다. 랜딩 자산 중 개발용 광고 자리표시가 찍힌 컷은 쓰지 않는다.
    await page.goto("/easysubway")
    const sources = await page.locator("img").evaluateAll((images) =>
      images.map((image) => image.getAttribute("src") || "")
    )
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source).not.toContain("route-map")
    }
  })
})

test.describe("공개 표면 sitemap 경계", () => {
  test("전용 표면 호스트로 온 sitemap 요청은 404다", async ({ request }) => {
    // 회사·제품 호스트에서 200이면 한 사이트가 다른 호스트의 URL 목록을 자기 sitemap으로 광고한다.
    for (const host of ["www.aquilaxk.site", "easysubway.aquilaxk.site"]) {
      const response = await request.get("/sitemap.xml", { headers: { host } })
      expect(response.status(), host).toBe(404)
    }
  })
})
