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
})

