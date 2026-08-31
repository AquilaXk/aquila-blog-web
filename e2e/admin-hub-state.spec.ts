import { readFileSync } from "node:fs"
import path from "node:path"
import { test, expect } from "@playwright/test"
import {
  ADMIN_HUB_GREETING_OPTIONS,
  ADMIN_HUB_GREETING_VARIANT_COUNT,
  resolveAdminHubGreeting,
} from "../src/routes/Admin/AdminHubSurfaceModel"

const expectedGreetingOptions = {
  dawn: [
    "고요한 새벽이에요",
    "이른 시간에도 반가워요",
    "차분한 새벽을 시작해요",
    "새벽의 집중력을 이어가요",
  ],
  morning: [
    "좋은 아침이에요",
    "상쾌한 아침이에요",
    "오늘도 기분 좋게 시작해요",
    "아침의 첫 작업을 시작해요",
  ],
  lunch: [
    "점심시간이에요",
    "잠깐 숨을 돌릴 시간이에요",
    "든든한 점심을 챙길 시간이에요",
    "오후를 준비할 시간이에요",
  ],
  afternoon: [
    "좋은 오후예요",
    "오후의 흐름을 이어가요",
    "오늘의 작업을 이어가요",
    "차분하게 집중할 오후예요",
  ],
  evening: [
    "좋은 저녁이에요",
    "오늘 하루도 수고 많았어요",
    "차분한 저녁이에요",
    "오늘의 작업을 마무리해요",
  ],
} as const

const periodInstants = {
  dawn: "2026-08-30T15:00:00.000Z",
  morning: "2026-08-30T21:00:00.000Z",
  lunch: "2026-08-31T02:00:00.000Z",
  afternoon: "2026-08-31T05:00:00.000Z",
  evening: "2026-08-31T09:00:00.000Z",
} as const

test("관리자 허브 인사는 서울 시간대 경계를 정확히 나눈다", () => {
  const boundaryCases = [
    ["2026-08-30T15:00:00.000Z", "고요한 새벽이에요"],
    ["2026-08-30T20:59:59.999Z", "고요한 새벽이에요"],
    ["2026-08-30T21:00:00.000Z", "좋은 아침이에요"],
    ["2026-08-31T01:59:59.999Z", "좋은 아침이에요"],
    ["2026-08-31T02:00:00.000Z", "점심시간이에요"],
    ["2026-08-31T04:59:59.999Z", "점심시간이에요"],
    ["2026-08-31T05:00:00.000Z", "좋은 오후예요"],
    ["2026-08-31T08:59:59.999Z", "좋은 오후예요"],
    ["2026-08-31T09:00:00.000Z", "좋은 저녁이에요"],
    ["2026-08-31T14:59:59.999Z", "좋은 저녁이에요"],
  ] as const

  for (const [instant, expected] of boundaryCases) {
    expect(resolveAdminHubGreeting(new Date(instant), 0)).toBe(expected)
  }
})

test("관리자 허브 인사는 각 시간대의 네 문구를 모두 선택할 수 있다", () => {
  expect(ADMIN_HUB_GREETING_OPTIONS).toEqual(expectedGreetingOptions)
  expect(ADMIN_HUB_GREETING_VARIANT_COUNT).toBe(4)

  for (const [period, options] of Object.entries(expectedGreetingOptions) as Array<
    [keyof typeof expectedGreetingOptions, readonly string[]]
  >) {
    options.forEach((expected, variantIndex) => {
      expect(resolveAdminHubGreeting(new Date(periodInstants[period]), variantIndex)).toBe(expected)
    })
  }
})

test.describe("admin hub state contract", () => {
  test("관리자 허브는 live admin profile snapshot을 first paint seed로 사용한다", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/pages/admin.tsx"), "utf8")

    expect(source).toContain("const hasAuthCookie = hasServerAuthCookie(req)")
    expect(source).toContain("const fallbackProfileSnapshot = resolvePublicAdminProfileSnapshot(req)")
    expect(source).toContain("const baseResultPromise = timed(() => getAdminPageProps(req))")
    expect(source).toContain("const adminProfileResultPromise = hasAuthCookie")
    expect(source).toContain("fetchServerAdminProfile(req, {")
    expect(source).toContain("const [baseResult, adminProfileResult] = await Promise.all([baseResultPromise, adminProfileResultPromise])")
    expect(source).toContain("initialProfileSnapshot: profileSnapshot")
    expect(source).toContain("const adminProfile = initialProfileSnapshot")
    expect(source).toContain("profileRole: adminProfile?.profileRole || sessionMember?.profileRole || \"\"")
    expect(source).toContain("profileBio: adminProfile?.profileBio || sessionMember?.profileBio || \"\"")
    expect(source).toContain("homeIntroTitle:")
    expect(source).toContain("adminProfile?.homeIntroTitle || sessionMember?.homeIntroTitle || \"\"")
    expect(source).toContain("serviceLinks: adminProfile?.serviceLinks || sessionMember?.serviceLinks || []")
    expect(source).toContain("contactLinks: adminProfile?.contactLinks || sessionMember?.contactLinks || []")
    expect(source).not.toContain("const profilePriorityAction =")
    expect(source).not.toContain("const priorityActions =")
    expect(source).not.toContain("const handoffActions =")
    expect(source).not.toContain("const supportRailGroups = [")
    expect(source).not.toContain("priorityActions={priorityActions}")
    expect(source).not.toContain("handoffActions={handoffActions}")
    expect(source).not.toContain("supportRailGroups={supportRailGroups}")
    expect(source).toContain("initialOperationalSnapshot")
    expect(source).toContain("readAdminHubOperationalSnapshot(req)")
    expect(source).toContain("const buildAdminHubPostListEndpoint = () =>")
    expect(source).toContain('"/post/api/v1/adm/posts?page=1&pageSize=20&kw=&sort=MODIFIED_AT"')
    expect(source).toContain("readJsonIfOk<AdminHubPageDto<AdminHubPostListItem>>(req, buildAdminHubPostListEndpoint())")
    expect(source).toContain('readJsonIfOk<AdminHubSystemHealthPayload>(req, "/system/api/v1/adm/health")')
    expect(source).toContain('readJsonIfOk<AdminHubDashboardSnapshotPayload>(req, "/system/api/v1/adm/dashboard-snapshot")')
    expect(source).not.toContain('from "src/routes/Admin/AdminPostsWorkspaceModel"')
    expect(source).not.toContain('from "src/routes/Admin/AdminDashboardWorkspaceModel"')
    expect(source).toContain("metrics={metrics}")
    expect(source).toContain("contentItems={recentContentItems}")
    expect(source).toContain("serviceStatusItems={serviceStatusItems}")
    expect(source).toContain("activityItems={activityItems}")
    expect(source).not.toContain("commentsCount?: number")
    expect(source).not.toContain("COMMENTS")
    expect(source).toContain("hitCount?: number")
    expect(source).toContain("checks?:")
    expect(source).toContain('label: "PUBLISHED"')
    expect(source).toContain('label: "DRAFTS"')
    expect(source).toContain('label: "VIEWS"')
    expect(source).not.toContain('label: "COMMENTS"')
    expect(source).toContain('label: "Public API"')
    expect(source).toContain('label: "PostgreSQL"')
    expect(source).toContain('label: "Redis"')
    expect(source).toContain("loadedViewsCount")
    expect(source).not.toContain("loadedCommentsCount")
    expect(source).not.toContain('label: "POSTS"')
    expect(source).not.toContain('label: "EVENTS"')
    expect(source).not.toContain('label: "Task Queue"')
    expect(source).not.toContain('label: "Signup Mail"')
    expect(source).not.toContain('label: "Storage"')
  })

  test("관리자 허브는 V4 ADMIN HUB reference 구조를 사용한다", () => {
    const pageSource = readFileSync(path.resolve(__dirname, "../src/pages/admin.tsx"), "utf8")
    const modelSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurfaceModel.ts"), "utf8")
    const source = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.tsx"), "utf8")
    const sectionSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.sections.tsx"), "utf8")
    const styleSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.styles.ts"), "utf8")

    expect(sectionSource).toContain("<HeroKicker>WORKSPACE</HeroKicker>")
    expect(sectionSource).toContain("<HeroHeading>{greeting}, {displayName}.</HeroHeading>")
    expect(sectionSource).not.toContain("<HeroHeading>좋은 아침이에요")
    expect(source).toContain("greeting: string")
    expect(source).toContain("greeting={greeting}")
    expect(pageSource).toContain("initialGreeting: resolveAdminHubGreeting(requestInstant, greetingVariantIndex)")
    expect(pageSource).toContain("greeting={initialGreeting}")
    expect(pageSource).toContain('import { randomInt } from "node:crypto"')
    expect(pageSource).toContain("randomInt(ADMIN_HUB_GREETING_VARIANT_COUNT)")
    expect(modelSource).not.toContain("Math.random")
    expect(sectionSource).toContain('aria-label="관리자 핵심 지표"')
    expect(sectionSource).toContain("<h2>최근 콘텐츠</h2>")
    expect(sectionSource).toContain("<h2>서비스 상태</h2>")
    expect(sectionSource).toContain("<h2>최근 활동</h2>")
    expect(sectionSource).toContain('aria-label="최근 콘텐츠"')
    expect(sectionSource).toContain('aria-label="서비스 상태"')
    expect(sectionSource).toContain('aria-label="최근 활동"')
    expect(styleSource).toContain("export const MetricGrid = styled.section`")
    expect(styleSource).toContain("export const ContentRow = styled.a`")
    expect(styleSource).toContain("export const StatusRow = styled.div`")
    expect(styleSource).not.toContain("border-bottom: 1px solid ${({ theme }) => adminCardBorder(theme)};")
    expect(styleSource).toContain("border-radius: 2px;")
    expect(styleSource).toContain("background: ${adminSurface};")
    expect(styleSource).not.toContain("transform: translateY")
    expect(source).toContain("metrics: AdminHubMetricItem[]")
    expect(source).toContain("contentItems: AdminHubContentItem[]")
    expect(source).toContain("serviceStatusItems: AdminHubStatusItem[]")
    expect(source).toContain("activityItems: AdminHubRecentWorkItem[]")
    expect(sectionSource).not.toContain("<h2>지금 할 일</h2>")
    expect(sectionSource).not.toContain("<h2>최근 작업</h2>")
    expect(sectionSource).not.toContain("<h2>공개 노출 상태</h2>")
    expect(source).not.toContain("새 글 작성, 최근 초안 복귀, 프로필 점검, 운영 상태 확인까지 지금 필요한 흐름만 먼저 보여줍니다.")
    expect(source).not.toContain("최근에 확인한 상태와 이어서 처리할 작업을 함께 봅니다.")
    expect(source).not.toContain("프로필 소개와 링크를 정리해 공개 카드와 같은 톤으로 맞춥니다.")
    expect(source).not.toContain("const SectionCard = styled(AdminElevatedCard)`")
    expect(source).not.toContain("const SupportCard = styled(AdminElevatedCard)`")
    expect(source).not.toContain("box-shadow: ${({ theme }) => adminElevatedShadow(theme)};")
    expect(source).not.toContain("const SummaryRail = styled.div`")
    expect(source).not.toContain("showDeferredPanels")
    expect(source).not.toContain("requestIdleCallback")
  })

  test("대시보드 first fold는 운영 상태 헤더와 갱신 컨트롤·가드 레일을 사용한다", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspaceView.tsx"), "utf8")
    const styleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts"),
      "utf8",
    )
    const refreshStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.refresh.ts"),
      "utf8",
    )

    expect(source).toContain("<h1>운영 상태와 복구</h1>")
    expect(source).toContain("<DashboardRefreshControls")
    expect(source).toContain('data-ui="monitoring-service-rail"')
    expect(source).toContain('data-ui="dashboard-guard-rows"')
    expect(source).toContain("<h2>Steady-state guard</h2>")
    expect(source).toContain("<h2>Live logs</h2>")
    expect(styleSource).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));")
    expect(refreshStyleSource).toContain("export const FreshnessLabel = styled.span`")
    expect(refreshStyleSource).toContain("export const RefreshButton = styled.button`")
    expect(source).not.toContain("큐 지연, 메일 상태, 인증 이상, 파일 정리처럼 운영 리스크가 큰 항목부터 먼저 읽습니다.")
    expect(source).not.toContain("실패 task, 메일 실패, 인증 차단처럼 문제가 생긴 항목을 먼저 판단합니다.")
    expect(source).not.toContain("운영 조치는 앱 내부 도구에서 먼저 처리하고, 외부 보드는 드릴다운으로만 엽니다.")
    expect(source).not.toContain("장기 추이와 원본 지표 확인은 아래 연결 채널에서 이어서 봅니다.")
  })

  test("dashboard 연결 채널 카드 스타일은 좁은 폭에서도 제목이 세로로 쪼개지지 않는 계약을 유지한다", () => {
    const styleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.priority.ts"),
      "utf8",
    )

    expect(styleSource).toContain("grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));")
    expect(styleSource).toContain("export const ContextMonitoringLinkCard = styled(AdminInfoLinkCard)`")
    expect(styleSource).toContain("word-break: keep-all;")
    expect(styleSource).not.toContain("grid-template-columns: repeat(3, minmax(0, 1fr));")
  })
})
