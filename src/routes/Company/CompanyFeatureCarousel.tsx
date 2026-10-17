import { COMPANY_FEATURE_CARDS } from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanySection.styles"

export const formatCapabilityIndex = (index: number) =>
  String(index + 1).padStart(2, "0")

export const CompanyFeatureExplorerView: React.FC = () => (
  <S.FeatureGrid role="region" aria-label="핵심 역량 카드">
    {COMPANY_FEATURE_CARDS.map((card, index) => (
      <S.FeatureCard
        key={card.id}
        data-reveal
        data-reveal-group="capabilities-cards"
      >
        <S.FeatureMeta>
          <S.FeatureIndex aria-hidden="true">
            {formatCapabilityIndex(index)}
          </S.FeatureIndex>
          <S.FeatureTag>{card.tag}</S.FeatureTag>
        </S.FeatureMeta>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </S.FeatureCard>
    ))}
  </S.FeatureGrid>
)

const CompanyFeatureCarousel: React.FC = () => <CompanyFeatureExplorerView />

export default CompanyFeatureCarousel


