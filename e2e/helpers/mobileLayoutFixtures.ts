import type { Page } from "@playwright/test"
import { mockPublicAdminProfile } from "./smokeFixtures"

export const MOBILE_VIEWPORT = { width: 393, height: 852 }
export const AVATAR_PNG_BASE64 =
  "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"
export const AVATAR_PNG = Buffer.from(AVATAR_PNG_BASE64, "base64")

export const mockAvatarAsset = async (page: Page) => {
  await page.route("**/avatar.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: AVATAR_PNG,
    })
  })
}

export const mockAnonymousSession = async (page: Page) => {
  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ resultCode: "401-1", msg: "로그인 후 이용해주세요.", data: null }),
    })
  })
}

export const createExplorePage = (title: string, tag = "모바일테스트") => ({
  content: [
    {
      id: 1501,
      createdAt: "2026-03-20T00:00:00Z",
      modifiedAt: "2026-03-20T00:00:00Z",
      authorId: 1,
      authorName: "관리자",
      authorUsername: "aquila",
      authorProfileImgUrl: "/avatar.png",
      title,
      summary: "iPhone 15 Pro 레이아웃 회귀 자동화",
      summarySource: "MANUAL",
      tags: [tag],
      category: ["테스트"],
      published: true,
      listed: true,
      likesCount: 0,
      hitCount: 0,
    },
  ],
  pageable: {
    pageNumber: 0,
    pageSize: 30,
    totalElements: 1,
    totalPages: 1,
  },
})

export const MOBILE_TAG_ENTRIES = Array.from({ length: 14 }, (_, index) => ({
  tag: `모바일태그${String(index + 1).padStart(2, "0")}`,
  count: 14 - index,
}))

export const ADMIN_MEMBER_FIXTURE = {
  id: 1,
  username: "aquila",
  nickname: "aquila",
  isAdmin: true,
  profileImageUrl: "/avatar.png",
}

const ADMIN_PROFILE_FIXTURE = {
  id: 1,
  username: "aquila",
  name: "aquila",
  nickname: "aquila",
  profileImageUrl: "/avatar.png",
  blogTitle: "Aquila",
  isAdmin: true,
}

export const ADMIN_POST_FIXTURES = Array.from({ length: 6 }, (_, index) => ({
  id: 3200 + index,
  title: index === 0 ? "First fold 운영 점검" : `관리자 글 목록 회귀 ${index}`,
  authorName: "관리자",
  authorProfileImgUrl: "/avatar.png",
  published: index % 2 === 0,
  listed: index % 3 !== 0,
  tempDraft: false,
  createdAt: `2026-05-${String(10 + index).padStart(2, "0")}T01:00:00Z`,
  modifiedAt: `2026-05-${String(20 - index).padStart(2, "0")}T08:30:00Z`,
}))

export const createAdminPostPage = () => ({
  content: ADMIN_POST_FIXTURES,
  pageable: {
    pageNumber: 0,
    pageSize: 20,
    totalElements: ADMIN_POST_FIXTURES.length,
    totalPages: 1,
  },
})

export const mockAdminPostsWorkspaceEndpoints = async (page: Page) => {
  await mockPublicAdminProfile(page)

  await page.route("**/member/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ADMIN_MEMBER_FIXTURE),
    })
  })

  await page.route("**/member/api/v1/adm/members/bootstrap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ member: ADMIN_MEMBER_FIXTURE, profile: ADMIN_PROFILE_FIXTURE }),
    })
  })

  await page.route("**/post/api/v1/adm/posts**", async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          member: ADMIN_MEMBER_FIXTURE,
          firstPage: createAdminPostPage(),
        }),
      })
      return
    }

    if (url.pathname.includes("/deleted")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: [],
          pageable: { pageNumber: 0, pageSize: 20, totalElements: 0, totalPages: 0 },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createAdminPostPage()),
    })
  })
}

export const mockFeedEndpoints = async (page: Page) => {
  await mockPublicAdminProfile(page)

  await page.route("**/post/api/v1/posts/feed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage("모바일 카드 overflow 회귀 점검")),
    })
  })

  await page.route("**/post/api/v1/posts/search**", async (route) => {
    const url = new URL(route.request().url())
    const kw = url.searchParams.get("kw") || ""
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage(kw ? `검색:${kw}` : "검색초기")),
    })
  })

  await page.route("**/post/api/v1/posts/explore**", async (route) => {
    const url = new URL(route.request().url())
    const tag = url.searchParams.get("tag") || "모바일테스트"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createExplorePage(`태그:${tag}`, tag)),
    })
  })

  await page.route("**/post/api/v1/posts/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOBILE_TAG_ENTRIES),
    })
  })
}

export type MockDetailOverrides = {
  id?: number
  title?: string
  content?: string
  likesCount?: number
  hitCount?: number
  actorCanModify?: boolean
  actorCanDelete?: boolean
}

export const DETAIL_CONTENT = [
  "| 항목 | 설명 |",
  "| --- | --- |",
  "| 증상 | iPhone 15 Pro에서 가로 스크롤 없이 본문에 맞춰 표시되어야 한다 |",
  "| 원인 | 레이아웃 폭 계산/스크롤 컨테이너 처리 불일치 |",
  "",
  "| 단계 | 핵심 요소 | 설명 |",
  "| --- | --- | --- |",
  "| 연결 | WebSocket | 실시간 양방향 채널을 유지한다 |",
  "| 인증 | STOMP CONNECT | 토큰 검증 시점을 분리한다 |",
  "",
  "```kotlin",
  "fun ensureMobileLayout(width: Int) = if (width <= 393) \"safe\" else \"ok\"",
  "```",
].join("\n")

export const mockDetailEndpoint = async (page: Page, overrides: MockDetailOverrides = {}) => {
  const {
    id: overrideId,
    title: overrideTitle,
    content: overrideContent,
    likesCount: overrideLikesCount,
    hitCount: overrideHitCount,
    actorCanModify: overrideActorCanModify,
    actorCanDelete: overrideActorCanDelete,
  } = overrides
  const postId = overrideId ?? 990
  await page.route(`**/post/api/v1/posts/${postId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: postId,
        createdAt: "2026-03-21T00:00:00Z",
        modifiedAt: "2026-03-21T00:00:00Z",
        authorId: 1,
        authorName: "관리자",
        authorUsername: "aquila",
        authorProfileImageDirectUrl: "/avatar.png",
        title: overrideTitle ?? "모바일 테이블/코드블록 회귀 테스트",
        content: overrideContent ?? DETAIL_CONTENT,
        summary: "",
        summarySource: "NONE",
        tags: ["모바일"],
        category: ["프론트"],
        published: true,
        listed: true,
        likesCount: overrideLikesCount ?? 0,
        hitCount: overrideHitCount ?? 0,
        actorCanModify: overrideActorCanModify ?? false,
        actorCanDelete: overrideActorCanDelete ?? false,
      }),
    })
  })

  await page.route(`**/post/api/v1/posts/${postId}/hit**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resultCode: "200-1",
        msg: "ok",
        data: { hitCount: (overrides.hitCount ?? 0) + 1 },
      }),
    })
  })
}

export const captureLayoutSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const html = document.documentElement
    const body = document.body
    const cardRects = Array.from(document.querySelectorAll("a article")).map((el) =>
      (el as HTMLElement).getBoundingClientRect()
    )
    const firstCodeBlock = document.querySelector("pre")
    const tables = Array.from(document.querySelectorAll("table"))
    const firstTable = tables[0] ?? null
    const secondTable = tables[1] ?? null
    const firstTableHead = firstTable?.querySelector("thead") as HTMLElement | null
    const firstTableCell = firstTable?.querySelector("tbody td, tbody th") as HTMLElement | null
    const secondTableHead = secondTable?.querySelector("thead") as HTMLElement | null
    const secondTableCell = secondTable?.querySelector("tbody td, tbody th") as HTMLElement | null
    const tableScrolls = Array.from(document.querySelectorAll<HTMLElement>(".aq-table-scroll"))
    const firstTableScroll = tableScrolls[0] ?? null
    const secondTableScroll = tableScrolls[1] ?? null
    const firstCodeShell = document.querySelector(".aq-code-shell")
    const codeRect = firstCodeBlock ? (firstCodeBlock as HTMLElement).getBoundingClientRect() : null
    const tableRect = firstTable ? (firstTable as HTMLElement).getBoundingClientRect() : null
    const secondTableRect = secondTable ? (secondTable as HTMLElement).getBoundingClientRect() : null
    const firstTableScrollRect = firstTableScroll ? firstTableScroll.getBoundingClientRect() : null
    const secondTableScrollRect = secondTableScroll ? secondTableScroll.getBoundingClientRect() : null
    const codeStyle = firstCodeBlock ? window.getComputedStyle(firstCodeBlock as HTMLElement) : null
    const codeShellStyle = firstCodeShell ? window.getComputedStyle(firstCodeShell as HTMLElement) : null
    const firstTableScrollStyle = firstTableScroll ? window.getComputedStyle(firstTableScroll) : null
    const secondTableScrollStyle = secondTableScroll ? window.getComputedStyle(secondTableScroll) : null
    const codeShellElement = firstCodeShell as HTMLElement | null
    const codeShellScrollLeftBefore = codeShellElement?.scrollLeft ?? null
    if (codeShellElement) {
      const maxScrollX = Math.max(0, codeShellElement.scrollWidth - codeShellElement.clientWidth)
      codeShellElement.scrollLeft = Math.min(maxScrollX, 180)
    }
    const codeShellScrollLeftAfter = codeShellElement?.scrollLeft ?? null

    return {
      viewportWidth,
      htmlScrollWidth: html.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      maxCardRight: cardRects.length ? Math.max(...cardRects.map((rect) => rect.right)) : 0,
      minCardLeft: cardRects.length ? Math.min(...cardRects.map((rect) => rect.left)) : 0,
      firstCardWidth: cardRects[0]?.width ?? 0,
      codeRight: codeRect?.right ?? null,
      codeClientWidth: firstCodeBlock ? (firstCodeBlock as HTMLElement).clientWidth : null,
      codeScrollWidth: firstCodeBlock ? (firstCodeBlock as HTMLElement).scrollWidth : null,
      codeOverflowX: codeStyle?.overflowX ?? null,
      codeShellClientWidth: firstCodeShell ? (firstCodeShell as HTMLElement).clientWidth : null,
      codeShellScrollWidth: firstCodeShell ? (firstCodeShell as HTMLElement).scrollWidth : null,
      codeShellOverflowX: codeShellStyle?.overflowX ?? null,
      codeShellTouchAction: codeShellStyle?.touchAction ?? null,
      codeShellOverscrollBehaviorX: codeShellStyle?.overscrollBehaviorX ?? null,
      codeShellScrollLeftBefore,
      codeShellScrollLeftAfter,
      tableRight: tableRect?.right ?? null,
      secondTableRight: secondTableRect?.right ?? null,
      firstTableScrollRight: firstTableScrollRect?.right ?? null,
      secondTableScrollRight: secondTableScrollRect?.right ?? null,
      firstTableScrollClientWidth: firstTableScroll?.clientWidth ?? null,
      firstTableScrollWidth: firstTableScroll?.scrollWidth ?? null,
      secondTableScrollClientWidth: secondTableScroll?.clientWidth ?? null,
      secondTableScrollWidth: secondTableScroll?.scrollWidth ?? null,
      firstTableScrollOverflowX: firstTableScrollStyle?.overflowX ?? null,
      secondTableScrollOverflowX: secondTableScrollStyle?.overflowX ?? null,
      firstTableCellLabel: firstTableCell?.getAttribute("data-label") ?? null,
      firstTableHeadDisplay: firstTableHead ? window.getComputedStyle(firstTableHead).display : null,
      firstTableCellBeforeContent: firstTableCell
        ? window.getComputedStyle(firstTableCell, "::before").content
        : null,
      secondTableHeadDisplay: secondTableHead ? window.getComputedStyle(secondTableHead).display : null,
      secondTableCellBeforeContent: secondTableCell
        ? window.getComputedStyle(secondTableCell, "::before").content
        : null,
    }
  })
