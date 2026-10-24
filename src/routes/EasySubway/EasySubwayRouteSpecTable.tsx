import React from "react"
import {
  BARRIER_FREE_ROUTE_SPECS,
  type RouteSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

type Props = {
  specs?: RouteSpecItem[]
}

export const EasySubwayRouteSpecTable: React.FC<Props> = ({
  specs = BARRIER_FREE_ROUTE_SPECS,
}) => (
  <S.RouteSpecPanel role="region" aria-label="교통약자를 위한 무장애 경로 기준">
    <S.RouteSpecHeader>
      <S.RouteSpecTitle>교통약자를 위한 무장애 경로 기준</S.RouteSpecTitle>
      <S.RouteSpecTag>검증 완료</S.RouteSpecTag>
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
