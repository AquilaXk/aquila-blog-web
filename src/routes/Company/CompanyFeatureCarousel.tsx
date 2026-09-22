import CompanyIcon from "src/routes/Company/CompanyIcon"
import { COMPANY_FEATURE_CARDS } from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanySection.styles"

/**
 * 핵심 역량 3x2 정적 그리드.
 * 복잡한 캐러셀 스크롤 없이 6대 핵심 역량을 한눈에 조망할 수 있는 정적 그리드로 배치한다.
 */
const CompanyFeatureCarousel: React.FC = () => (
  <S.FeatureGrid role="region" aria-label="핵심 역량 카드">
    {COMPANY_FEATURE_CARDS.map((card) => (
      <S.FeatureCard key={card.id}>
        <S.FeatureIconPanel>
          <CompanyIcon name={card.icon} />
        </S.FeatureIconPanel>
        <S.FeatureTag>{card.tag}</S.FeatureTag>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </S.FeatureCard>
    ))}
  </S.FeatureGrid>
)

export default CompanyFeatureCarousel
