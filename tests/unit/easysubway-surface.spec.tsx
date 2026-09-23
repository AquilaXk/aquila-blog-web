import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  BARRIER_FREE_ROUTE_SPECS,
  PRODUCT_FEATURES,
  PRODUCT_META_FACTS,
  PRODUCT_SCOPE_CHIPS,
  TECH_SPEC_ITEMS,
} from "../../src/routes/EasySubway/EasySubwayPageModel"
import * as S from "../../src/routes/EasySubway/EasySubwayPage.styles"

/**
 * EasySubway RouteSpec 및 TechSpec 렌더 로직과 1:1로 대응하는 렌더러.
 * Playwright 단위 테스트 러너의 JSX __pw_type 래핑을 피해 React.createElement로 결정론적 마크업을 검증한다.
 */
const renderRouteSpecTable = (specs = BARRIER_FREE_ROUTE_SPECS) =>
  renderToStaticMarkup(
    createElement(
      S.RouteSpecPanel,
      { role: "region", "aria-label": "무장애 이동 경로 에디토리얼 명세표" },
      createElement(
        S.RouteSpecHeader,
        null,
        createElement(S.RouteSpecTitle, null, "무장애 이동 경로 에디토리얼 명세표"),
        createElement(S.RouteSpecTag, null, "VERIFIED SPEC")
      ),
      createElement(
        S.RouteSpecList,
        null,
        specs.map((spec) =>
          createElement(
            S.RouteSpecCard,
            { key: spec.id },
            createElement("dt", null, spec.category),
            createElement(
              "dd",
              null,
              createElement("strong", null, spec.title),
              createElement("p", null, spec.description)
            )
          )
        )
      )
    )
  )

const renderTechSpecGrid = (items = TECH_SPEC_ITEMS) =>
  renderToStaticMarkup(
    createElement(
      S.TechSpecGrid,
      { role: "region", "aria-label": "정식 출시 기술 명세" },
      items.map((item) =>
        createElement(
          S.TechSpecCell,
          { key: item.id },
          createElement("dt", null, item.label),
          createElement(
            "dd",
            null,
            createElement("strong", null, item.value),
            createElement("p", null, item.detail)
          )
        )
      )
    )
  )

test.describe("EasySubway 표면 컴포넌트 단위 테스트", () => {
  test("무장애 이동 경로 에디토리얼 명세표는 4대 기준을 완전하게 렌더하고 시스템 에러 문구가 없다", () => {
    const markup = renderRouteSpecTable()

    expect(markup).toContain("무장애 이동 경로 에디토리얼 명세표")
    expect(markup).toContain("VERIFIED SPEC")

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
    expect(routeMarkup).toContain('aria-label="무장애 이동 경로 에디토리얼 명세표"')

    const techMarkup = renderTechSpecGrid()
    expect(techMarkup).toContain('role="region"')
    expect(techMarkup).toContain('aria-label="정식 출시 기술 명세"')
  })

  test("빈 명세 배열이나 커스텀 명세가 주어져도 오류 없이 방어적으로 렌더한다", () => {
    const emptyRouteMarkup = renderRouteSpecTable([])
    expect(emptyRouteMarkup).toContain("무장애 이동 경로 에디토리얼 명세표")

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
})
