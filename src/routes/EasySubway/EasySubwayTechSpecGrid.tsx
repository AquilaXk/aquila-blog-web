import React from "react"
import {
  TECH_SPEC_ITEMS,
  type TechSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

type Props = {
  items?: TechSpecItem[]
}

/**
 * [Phase 3 P2] 2x2 에디토리얼 기술 명세표 컴포넌트.
 * 이전의 과장된 StatCard 단일 수치를 대체하여 4대 기술 기준(적용 범위, 접근성 데이터,
 * 서비스 형태, 제공 플랫폼)을 2x2 그리드로 정갈하게 안내한다.
 */
export const EasySubwayTechSpecGrid: React.FC<Props> = ({
  items = TECH_SPEC_ITEMS,
}) => (
  <section role="region" aria-label="정식 출시 기술 명세">
    <S.TechSpecGrid>
      {items.map((item) => (
        <S.TechSpecCell
          key={item.id}
          data-reveal
          data-reveal-group="tech-specs"
        >
          <dt>{item.label}</dt>
          <dd>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </dd>
        </S.TechSpecCell>
      ))}
    </S.TechSpecGrid>
  </section>
)

export default EasySubwayTechSpecGrid
