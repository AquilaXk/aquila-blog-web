/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (components/sections/pricing-comparison.tsx, MIT License)
 * - lucide-icons/lucide (icons/check.svg, icons/minus.svg, ISC License, Copyright (c) Lucide Contributors)
 */
import React from "react"
import {
  BARRIER_FREE_ROUTE_SPECS,
  type RouteSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"
import * as Scope from "src/routes/EasySubway/EasySubwayScope.styles"

type Props = {
  specs?: RouteSpecItem[]
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const MinusIcon = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M5 12h14" />
  </svg>
)

export const EasySubwayRouteSpecTable: React.FC<Props> = ({
  specs = BARRIER_FREE_ROUTE_SPECS,
}) => (
  <section role="region" aria-label="교통약자를 위한 무장애 경로 기준">
    <Scope.ComparisonHead data-reveal="true">
      <S.Eyebrow>무장애 경로 비교</S.Eyebrow>
      <S.DisplayHeading id="es-route-comparison-heading">
        교통약자를 위한 무장애 경로 기준
      </S.DisplayHeading>
      <S.IntroAside>
        일반 지하철 길찾기와 달리 승강기·단차·빠른 환승 칸 번호를 핵심 4대 기준으로 계산합니다.
      </S.IntroAside>
    </Scope.ComparisonHead>
    <Scope.ComparisonScroll
      role="region"
      aria-label="무장애 경로 비교 표"
      tabIndex={0}
    >
      <Scope.ComparisonTable>
        <colgroup>
          <col className="featureCol" />
          <col className="planCol" />
          <col className="planCol" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">검증 항목</th>
            <th scope="col">일반 길찾기</th>
            <th scope="col" className="isHighlighted">
              EasySubway 무장애
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="groupRow">
            <td colSpan={3}>핵심 4대 기준</td>
          </tr>
          {specs.map((spec) => (
            <tr key={spec.id} data-reveal="true" data-reveal-group="route-specs">
              <th scope="row">
                <span className="rowTitle">{spec.title}</span>
                <span className="rowDesc">{spec.description}</span>
              </th>
              <td>
                <span className="mutedDash" role="img" aria-label="미지원 또는 제한적">
                  <MinusIcon />
                </span>
              </td>
              <td className="isHighlighted">
                <span className="checkBadge">
                  <CheckIcon />
                  <span>{spec.category}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Scope.ComparisonTable>
    </Scope.ComparisonScroll>
  </section>
)

export default EasySubwayRouteSpecTable
