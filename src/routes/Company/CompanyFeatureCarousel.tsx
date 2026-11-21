import { COMPANY_FEATURE_CARDS } from "src/routes/Company/CompanyPageModel"
import { renderCapabilityVisual } from "src/routes/Company/CompanyCapabilityVisuals"
import { CompanyVectorIcon, type CompanyIconName } from "src/routes/Company/CompanyIcons"
import * as Sec from "src/routes/Company/CompanySection.styles"

const resolveCardIconName = (id: string): CompanyIconName => {
  switch (id) {
    case "accessibility":
      return "accessibility"
    case "local-engine":
      return "local-engine"
    case "sandbox-convert":
      return "sandbox-convert"
    case "resilience":
      return "resilience"
    case "operations":
      return "operations"
    default:
      return "quality"
  }
}

export const formatCapabilityIndex = (index: number) => String(index + 1).padStart(2, "0")

export const CompanyFeatureExplorerView: React.FC = () => (
  <Sec.BentoGrid role="region" aria-label="핵심 역량 카드">
    {COMPANY_FEATURE_CARDS.map((card, index) => (
      <Sec.BentoCard
        key={card.id}
        $wide={index === 0 || index === 3 || index === 5}
        data-reveal
        data-reveal-group="capabilities-cards"
      >
        <div>
          <Sec.BentoMetaRow>
            <Sec.BentoIconBox>
              <CompanyVectorIcon name={resolveCardIconName(card.id)} size={20} strokeWidth={1.85} />
            </Sec.BentoIconBox>
            <Sec.BentoTag>
              {formatCapabilityIndex(index)} · {card.tag}
            </Sec.BentoTag>
          </Sec.BentoMetaRow>
          {renderCapabilityVisual(card.id)}
        </div>
        <Sec.BentoBody>
          <h3>{card.title}</h3>
          <p>{card.body}</p>
        </Sec.BentoBody>
      </Sec.BentoCard>
    ))}
  </Sec.BentoGrid>
)

const CompanyFeatureCarousel: React.FC = () => <CompanyFeatureExplorerView />

export default CompanyFeatureCarousel
