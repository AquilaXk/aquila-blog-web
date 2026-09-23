import React from "react"
import {
  BARRIER_FREE_ROUTE_SPECS,
  type RouteSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

type Props = {
  specs?: RouteSpecItem[]
}

/**
 * [Phase 1 P0] 무장애 이동 경로 에디토리얼 명세표 컴포넌트.
 * 시스템 에러/방어적 문구를 완전히 걷어내고 역사 내 수직 이동, 최적 환승 위치,
 * 편의시설 실측 데이터, 실시간 운행 상태 연동 기준을 명확한 에디토리얼 규격으로 전달한다.
 */
export const EasySubwayRouteSpecTable: React.FC<Props> = ({
  specs = BARRIER_FREE_ROUTE_SPECS,
}) => (
  <S.RouteSpecPanel role="region" aria-label="무장애 이동 경로 에디토리얼 명세표">
    <S.RouteSpecHeader>
      <S.RouteSpecTitle>무장애 이동 경로 에디토리얼 명세표</S.RouteSpecTitle>
      <S.RouteSpecTag>VERIFIED SPEC</S.RouteSpecTag>
    </S.RouteSpecHeader>
    <S.RouteSpecList>
      {specs.map((spec) => (
        <S.RouteSpecCard
          key={spec.id}
          data-reveal
          data-reveal-group="route-specs"
        >
          <dt>{spec.category}</dt>
          <dd>
            <strong>{spec.title}</strong>
            <p>{spec.description}</p>
          </dd>
        </S.RouteSpecCard>
      ))}
    </S.RouteSpecList>
  </S.RouteSpecPanel>
)

export default EasySubwayRouteSpecTable
