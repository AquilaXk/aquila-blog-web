import React from "react"
import {
  TECH_SPEC_ITEMS,
  type TechSpecItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

type Props = {
  items?: TechSpecItem[]
}

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
