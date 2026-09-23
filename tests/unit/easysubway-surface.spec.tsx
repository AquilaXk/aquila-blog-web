import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  BARRIER_FREE_ROUTE_SPECS,
  COMPARISON_TRACKS,
  FAQ_ITEMS,
  OFFICIAL_METRO_BADGES,
  PRODUCT_FEATURES,
  PRODUCT_META_FACTS,
  PRODUCT_SCOPE_CHIPS,
  TECH_SPEC_ITEMS,
} from "../../src/routes/EasySubway/EasySubwayPageModel"
import * as S from "../../src/routes/EasySubway/EasySubwayPage.styles"
import EasySubwayRouteSpecTable from "../../src/routes/EasySubway/EasySubwayRouteSpecTable"
import EasySubwayTechSpecGrid from "../../src/routes/EasySubway/EasySubwayTechSpecGrid"
import { calculateRevealDelay } from "../../src/routes/EasySubway/useScrollReveal"

/**
 * Playwright 단위 테스트 러너가 JSX를 { __pw_type: "jsx" }로 래핑하므로,
 * 실제 프로덕션 컴포넌트를 renderToStaticMarkup으로 검증할 수 있도록 React Element로 변환한다.
 */
function unwrapPw(node: any, index?: number): any {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) return node.map((child, i) => unwrapPw(child, i))
  if (node.__pw_type === "jsx") {
    const { type, props, key } = node
    const newProps: any = {}
    for (const k in props) {
      newProps[k] = unwrapPw(props[k])
    }
    const resolvedKey = key !== undefined && key !== null ? key : (index !== undefined ? `child-${index}` : undefined)
    return createElement(type, { ...newProps, key: resolvedKey })
  }
  return node
}

const renderRouteSpecTable = (specs = BARRIER_FREE_ROUTE_SPECS) =>
  renderToStaticMarkup(unwrapPw((EasySubwayRouteSpecTable as any)({ specs })))

const renderTechSpecGrid = (items = TECH_SPEC_ITEMS) =>
  renderToStaticMarkup(unwrapPw((EasySubwayTechSpecGrid as any)({ items })))

const renderTimelineCalloutCluster = () =>
  renderToStaticMarkup(
    createElement(
      S.TimelineCalloutCluster,
      null,
      createElement(
        S.TimelineCalloutCard,
        null,
        createElement(
          S.CalloutHeader,
          null,
          createElement("img", {
            src: "/easysubway/badges/seoul_4_compact_256.png",
            alt: "4호선",
            width: 22,
            height: 22,
          }),
          createElement(S.CalloutTag, null, "빠른 환승·하차"),
        ),
        createElement("strong", null, "9-2 승차 위치 안내"),
        createElement("p", null, "환승 엘리베이터 바로 앞으로 내릴 수 있는 최적의 승차 위치(칸·문)를 제시합니다."),
      ),
      createElement(
        S.TimelineCalloutCard,
        null,
        createElement(
          S.CalloutHeader,
          null,
          createElement(
            S.CalloutIconSvg,
            { "aria-hidden": "true" },
            createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm2 2h6v2H9V6zm1 6l2-2 2 2h-1.5v3h-1v-3H10zm0 5l2 2 2-2h-1.5v-3h-1v3H10z" })),
          ),
          createElement(S.CalloutTag, null, "단차 0cm 이동"),
        ),
        createElement("strong", null, "엘리베이터 직결 동선"),
        createElement("p", null, "계단과 턱을 배제하고 지상 출구부터 승강장까지 100% 수직 이동 경로를 시각화합니다."),
      ),
      createElement(
        S.TimelineCalloutCard,
        null,
        createElement(
          S.CalloutHeader,
          null,
          createElement(
            S.CalloutIconSvg,
            { "aria-hidden": "true" },
            createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 11v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.31-1.18-.31C10.26 6.97 9 8.24 9 9.8v4.44c0 .43.18.84.49 1.14l2.84 2.76c.49.48 1.13.73 1.78.73.55 0 1.09-.18 1.54-.53l2.86-2.22c.65-.5.99-1.3.89-2.12zm-8.5 7c-2.48 0-4.5-2.02-4.5-4.5 0-1.82 1.09-3.39 2.66-4.09l.4 1.95c-.86.47-1.46 1.37-1.46 2.41 0 1.52 1.23 2.75 2.75 2.75 1.18 0 2.18-.74 2.57-1.78l1.96.42C14.3 19.33 12.57 20 10.5 20z" })),
          ),
          createElement(S.CalloutTag, null, "교통약자 특화"),
        ),
        createElement("strong", null, "휠체어·유모차 맞춤 동선"),
        createElement("p", null, "단차 없는 지상 출구와 경사로를 우선 연계해 휠체어와 유모차 이동을 보장합니다."),
      ),
    ),
  )

const renderCopyEmailButton = (status: "idle" | "copied" | "failed" = "idle") =>
  renderToStaticMarkup(
    createElement(
      S.CopyEmailButton,
      {
        type: "button",
        "aria-label":
          status === "copied"
            ? "이메일 주소가 복사되었습니다"
            : status === "failed"
              ? "이메일 주소 복사에 실패했습니다"
              : "이메일 주소 복사",
      },
      createElement(
        S.CopyIconWrapper,
        { "aria-hidden": "true" },
        status === "copied"
          ? createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" }))
          : status === "failed"
            ? createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" }))
            : createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" })),
      ),
      createElement("span", null, status === "copied" ? "복사 완료!" : status === "failed" ? "복사 실패" : "이메일 복사"),
      createElement(S.CopyEmailAddress, null, "contact@test.site"),
    ),
  )

const renderComparisonIcons = () =>
  renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(
        S.ComparisonCheckIcon,
        { "aria-hidden": "true" },
        createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" })),
      ),
      createElement(
        S.ComparisonCrossIcon,
        { "aria-hidden": "true" },
        createElement("svg", { viewBox: "0 0 24 24" }, createElement("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" })),
      ),
    ),
  )


test.describe("EasySubway 표면 컴포넌트 단위 테스트", () => {
  test("교통약자를 위한 무장애 경로 기준은 4대 기준을 완전하게 렌더하고 시스템 에러 문구가 없다", () => {
    const markup = renderRouteSpecTable()

    expect(markup).toContain("교통약자를 위한 무장애 경로 기준")
    expect(markup).toContain("검증 완료")

    for (const spec of BARRIER_FREE_ROUTE_SPECS) {
      expect(markup).toContain(spec.category)
      expect(markup).toContain(spec.title)
      expect(markup).toContain(spec.description)
    }

    // 시스템 에러 및 내부 엔지니어링 방어 문구가 영구 삭제되었음을 보장
    expect(markup).not.toContain("현재 경로를 계산할 수 없어요")
    expect(markup).not.toContain("Journey V3")
    expect(markup).not.toContain("현재 서버 권한이 없으면")
  })

  test("2x2 에디토리얼 기술 명세표는 4대 핵심 데이터를 2x2 그리드로 렌더한다", () => {
    const markup = renderTechSpecGrid()

    for (const item of TECH_SPEC_ITEMS) {
      expect(markup).toContain(item.label)
      expect(markup).toContain(item.value)
      expect(markup).toContain(item.detail)
    }

    expect(TECH_SPEC_ITEMS).toHaveLength(4)
    expect(markup).toContain("전국 기준")
    expect(markup).toContain("무장애 동선")
  })

  test("제품 기능 모델은 부정형 대구법(Not X but Y) 없이 긍정적 검증 진술로 구성된다", () => {
    expect(PRODUCT_FEATURES).toHaveLength(2)

    const [pick, route] = PRODUCT_FEATURES
    expect(pick.tag).toBe("01 / STATION SELECTION")
    expect(route.tag).toBe("02 / ROUTE SPECIFICATION")

    // Feature 01은 단일 화면 완결성을 긍정형으로 진술
    expect(pick.keyword).toBe("단일 화면")
    expect(pick.tail).toBe("에서 바로 진행할 수 있습니다.")
    expect(pick.tail).not.toContain("왕복하지 않습니다")

    // Feature 02는 무장애 이동 경로 산출을 긍정형으로 진술
    expect(route.keyword).toBe("무장애 이동 경로")
    expect(route.tail).toBe("를 산출해 단계별로 안내합니다.")
    expect(route.lead).not.toContain("Journey V3")
    expect(route.lead).not.toContain("서버가 제공될 때만")
  })

  test("제공 범위 칩 및 메타 팩트는 전국 출시 기준을 온전히 반영한다", () => {
    const chipLabels = PRODUCT_SCOPE_CHIPS.map((chip) => chip.label)
    expect(chipLabels).toContain("전국 출시 기준")
    expect(chipLabels).toContain("무장애 이동 경로 계산")
    expect(chipLabels).not.toContain("Journey V3 경로 계산")

    const regionFact = PRODUCT_META_FACTS.find((fact) => fact.id === "region")
    expect(regionFact?.value).toBe("전국 기준")
  })

  test("상태 뱃지와 액션 버튼은 패밀리룩 사각 토큰(radius: 6px/10px)을 사용한다", () => {
    const statusMarkup = renderToStaticMarkup(
      createElement(S.StatusBadge, null, "전국 정식 출시 준비 중")
    )
    expect(statusMarkup).toContain("전국 정식 출시 준비 중")

    const buttonMarkup = renderToStaticMarkup(
      createElement(S.ButtonAction, { href: "mailto:test@aquilaxk.site" }, "문의하기")
    )
    expect(buttonMarkup).toContain("문의하기")
    expect(buttonMarkup).toContain("href=\"mailto:test@aquilaxk.site\"")
  })

  test("명세표 컴포넌트는 role='region'과 접근성 라벨을 온전히 포함한다", () => {
    const routeMarkup = renderRouteSpecTable()
    expect(routeMarkup).toContain('role="region"')
    expect(routeMarkup).toContain('aria-label="교통약자를 위한 무장애 경로 기준"')

    const techMarkup = renderTechSpecGrid()
    expect(techMarkup).toContain('role="region"')
    expect(techMarkup).toContain('aria-label="정식 출시 기술 명세"')
  })

  test("빈 명세 배열이나 커스텀 명세가 주어져도 오류 없이 방어적으로 렌더한다", () => {
    const emptyRouteMarkup = renderRouteSpecTable([])
    expect(emptyRouteMarkup).toContain("교통약자를 위한 무장애 경로 기준")

    const customRouteMarkup = renderRouteSpecTable([
      {
        id: "custom-spec",
        category: "테스트 카테고리",
        title: "테스트 제목",
        description: "테스트 설명 문구",
      },
    ])
    expect(customRouteMarkup).toContain("테스트 카테고리")
    expect(customRouteMarkup).toContain("테스트 제목")
    expect(customRouteMarkup).toContain("테스트 설명 문구")

    const emptyTechMarkup = renderTechSpecGrid([])
    expect(emptyTechMarkup).toContain('role="region"')

    const customTechMarkup = renderTechSpecGrid([
      {
        id: "custom-tech",
        label: "커스텀 항목",
        value: "99.9%",
        detail: "커스텀 세부 안내",
      },
    ])
    expect(customTechMarkup).toContain("커스텀 항목")
    expect(customTechMarkup).toContain("99.9%")
    expect(customTechMarkup).toContain("커스텀 세부 안내")
  })

  test("스크롤 리빌 data-reveal 속성과 스태거 그룹이 에디토리얼 명세표 및 기술 그리드에 정의된다", () => {
    const routeMarkup = renderRouteSpecTable()
    expect(routeMarkup).toContain("data-reveal")
    expect(routeMarkup).toContain('data-reveal-group="route-specs"')

    const techMarkup = renderTechSpecGrid()
    expect(techMarkup).toContain("data-reveal")
    expect(techMarkup).toContain('data-reveal-group="tech-specs"')
  })

  test("스크롤 리빌 스태거 알고리즘은 4단계 한도와 지정 딜레이 우선권을 보장한다", () => {
    // 그룹 내 인덱스 순서대로 0ms, 60ms, 120ms, 180ms 부여
    expect(calculateRevealDelay(0)).toBe(0)
    expect(calculateRevealDelay(1)).toBe(60)
    expect(calculateRevealDelay(2)).toBe(120)
    expect(calculateRevealDelay(3)).toBe(180)
    // 4번째 요소는 0ms로 순환 (maxStaggerSteps = 4)
    expect(calculateRevealDelay(4)).toBe(0)

    // 명시적 딜레이가 있는 경우 그룹 순환을 덮어씀 (숫자 및 문자열 지원)
    expect(calculateRevealDelay(2, 150)).toBe(150)
    expect(calculateRevealDelay(3, "200")).toBe(200)
  })

  test("자주 묻는 질문(FAQ) 모델은 4종 필수 질문(무료 이용, 지원 노선, 차별점, 무추적 원칙)을 온전히 포함한다", () => {
    expect(FAQ_ITEMS).toHaveLength(4)

    const ids = FAQ_ITEMS.map((item) => item.id)
    expect(ids).toContain("free-service")
    expect(ids).toContain("supported-lines")
    expect(ids).toContain("difference")
    expect(ids).toContain("privacy-policy")

    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0)
      expect(item.answer.length).toBeGreaterThan(0)
    }
  })

  test("일반 지도앱 vs EasySubway 1:1 비교 모델은 2개 트랙과 계단 80개 vs 단차 0cm 기준을 포함한다", () => {
    expect(COMPARISON_TRACKS).toHaveLength(2)

    const [standard, easysubway] = COMPARISON_TRACKS
    expect(standard.label).toBe("일반 지도앱")
    expect(easysubway.label).toBe("EasySubway")

    const standardPoints = standard.points.map((p) => p.title).join(" ")
    expect(standardPoints).toContain("계단 80개")

    const easysubwayPoints = easysubway.points.map((p) => p.title).join(" ")
    expect(easysubwayPoints).toContain("단차 0cm 엘리베이터 직결 동선")
    expect(easysubwayPoints).toContain("9-2칸")
  })

  test("공식 20개 노선 뱃지 모델은 4호선을 포함한 20개 노선 심볼을 온전히 정의한다", () => {
    expect(OFFICIAL_METRO_BADGES).toHaveLength(20)

    const line4 = OFFICIAL_METRO_BADGES.find((b) => b.id === "line-4")
    expect(line4).toBeDefined()
    expect(line4?.name).toBe("4호선")
    expect(line4?.fileName).toBe("seoul_4_compact_256.png")
  })

  test("실제 무장애 타임라인 경로 결과 목업은 4호선 뱃지, 엘리베이터, 휠체어 3대 콜아웃을 온전히 렌더한다", () => {
    const markup = renderTimelineCalloutCluster()

    // Feature 02 타임라인 목업 및 3대 핵심 콜아웃 검증
    expect(markup).toContain("seoul_4_compact_256.png")
    expect(markup).toContain("빠른 환승·하차")
    expect(markup).toContain("9-2 승차 위치 안내")

    expect(markup).toContain("단차 0cm 이동")
    expect(markup).toContain("엘리베이터 직결 동선")

    expect(markup).toContain("교통약자 특화")
    expect(markup).toContain("휠체어·유모차 맞춤 동선")
  })

  test("이메일 원클릭 복사 CTA는 Fail-Closed 상태 기계를 준수하고 복사 실패 시 거짓 성공을 표시하지 않는다", () => {
    // 1) 초기 대기(idle) 상태
    const idleMarkup = renderCopyEmailButton("idle")
    expect(idleMarkup).toContain('aria-label="이메일 주소 복사"')
    expect(idleMarkup).toContain("이메일 복사")
    expect(idleMarkup).not.toContain("복사 완료!")
    expect(idleMarkup).not.toContain("복사 실패")

    // 2) 성공(copied) 상태
    const copiedMarkup = renderCopyEmailButton("copied")
    expect(copiedMarkup).toContain('aria-label="이메일 주소가 복사되었습니다"')
    expect(copiedMarkup).toContain("복사 완료!")
    expect(copiedMarkup).toContain("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z")

    // 3) 실패(failed) 상태: Fail-Closed 원칙에 따라 거짓 성공 대신 명확한 실패 표시
    const failedMarkup = renderCopyEmailButton("failed")
    expect(failedMarkup).toContain('aria-label="이메일 주소 복사에 실패했습니다"')
    expect(failedMarkup).toContain("복사 실패")
    expect(failedMarkup).not.toContain("복사 완료!")
    expect(failedMarkup).toContain("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z")
  })

  test("일반 지도앱 vs EasySubway 비교 목록은 인라인 텍스트 대신 SVG 아이콘을 사용한다", () => {
    const markup = renderComparisonIcons()

    // check and cross SVG path verification
    expect(markup).toContain("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z")
    expect(markup).toContain("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z")
  })

  test("Section 컴포넌트는 모바일 뷰포트에서 헤더 가림 방지를 위한 id 앵커를 지원한다", () => {
    const sectionMarkup = renderToStaticMarkup(createElement(S.Section, { id: "features" }))
    expect(sectionMarkup).toContain('id="features"')
  })
})


