import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { variables } from "src/styles"
import { CONTENT_MAX_WIDTH, TRANSITION } from "src/routes/Company/CompanyPage.styles"

/**
 * 회사 표면 섹션 레이아웃: 핵심 역량 그리드 · 프로덕트 쇼케이스 & 기술 신뢰성 ·
 * 비대칭 스토리 · 비전 체크리스트 · 소식 카드 · 문의 밴드.
 */
export const CarouselHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
`

/**
 * 3x2 핵심 역량 정적 그리드.
 * 한눈에 보이는 6개 카드로 구성되며 좁은 뷰포트에서는 반응형으로 2열, 1열로 축소된다.
 */
export const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  margin-top: clamp(2rem, 4vw, 3rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const FeatureCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: clamp(1.25rem, 2.2vw, 1.65rem);
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background: ${light.surface};
  transition: border-color ${TRANSITION};

  &:hover {
    border-color: ${light.borderStrong};
  }

  h3 {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.4;
    letter-spacing: -0.01em;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

/**
 * 카드 상단 컴팩트 아이콘 뱃지.
 * 거대 아이콘을 축소하고 정돈된 2.75rem(44px) 뱃지로 제공한다.
 */
export const FeatureIconPanel = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: ${radius.md}px;
  background: ${light.surfaceBrand};
  color: ${light.accentText};

  svg {
    width: 1.5rem;
    height: 1.5rem;
    stroke-width: 1.75;
  }
`

/**
 * 카드 분류 pill.
 */
export const FeatureTag = styled.span`
  align-self: flex-start;
  padding: 0.25rem 0.6rem;
  border-radius: ${variables.ui.button.radiusPill}px;
  background: ${light.surfaceBrandStrong};
  color: ${light.onSignature};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: 0.06em;
  text-transform: uppercase;
`

export const WorkHeading = styled.h2`
  margin: 0 auto clamp(2.5rem, 5vw, 4rem);
  max-width: 40rem;
  font-size: clamp(1.85rem, 3.8vw, 3rem);
  line-height: 1.18;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};
  text-align: center;
`

/**
 * 2대 프로덕트(EasySubway · AquilaLog) 전용 쇼케이스 그리드.
 */
export const ProductShowcaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin: clamp(2.5rem, 5vw, 3.5rem) 0 0;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ProductShowcaseCard = styled.article`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background: ${light.surface};
  transition: border-color ${TRANSITION};

  &:hover {
    border-color: ${light.borderStrong};
  }
`

export const ProductShowcaseMedia = styled.div<{ $layout?: "phone" | "desktop" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(220px, 24vw, 290px);
  padding: 1.25rem;
  background: ${light.surfaceBrand};
  overflow: hidden;

  img {
    display: block;
    max-height: 100%;
    max-width: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: ${({ $layout }) => ($layout === "phone" ? `${radius.md}px` : `${radius.sm}px`)};
    box-shadow: ${variables.ui.card.shadowFloating};
  }
`

export const ProductShowcaseContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  padding: clamp(1.35rem, 2.5vw, 1.85rem);
  gap: 0.75rem;

  h3 {
    margin: 0;
    font-size: clamp(1.35rem, 2.2vw, 1.6rem);
    font-weight: ${fontWeight.extraBold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  .summary {
    margin: 0;
    font-size: 1.05rem;
    font-weight: ${fontWeight.semibold};
    line-height: 1.5;
    color: ${light.accentText};
  }

  .description {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

export const ProductBadge = styled.span`
  align-self: flex-start;
  padding: 0.25rem 0.6rem;
  border-radius: ${variables.ui.button.radiusPill}px;
  background: ${light.surfaceBrandStrong};
  color: ${light.onSignature};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: 0.05em;
  text-transform: uppercase;
`

export const ProductHighlightList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin: 0.35rem 0 0.75rem;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.925rem;
    line-height: 1.5;
    color: ${light.inkPrimary};

    svg {
      flex: 0 0 auto;
      width: 1rem;
      height: 1rem;
      color: ${light.accentText};
      stroke-width: 2.2;
    }
  }
`

export const ProductAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.75rem;
  font-size: 1rem;
  font-weight: ${fontWeight.bold};
  color: ${light.accentText};
  text-decoration: none;
  transition: color ${TRANSITION}, gap ${TRANSITION};

  svg {
    transition: transform ${TRANSITION};
  }

  &:hover {
    color: ${light.accentPressed};
    gap: 0.65rem;

    svg {
      transform: translateX(2px);
    }
  }
`

/**
 * 하단 기술 신뢰성 섹션.
 * 내부 인프라, 데이터 검증 파이프라인, 품질 게이트를 제품 카드가 아닌 텍스트 리스트로 분리해 기술적 토대로 설명한다.
 */
export const ReliabilityBlock = styled.div`
  margin-top: clamp(3rem, 6vw, 4.5rem);
  padding-top: clamp(2.5rem, 5vw, 3.5rem);
  border-top: 1px solid ${light.border};
`

export const ReliabilityHeader = styled.div`
  max-width: 38rem;
  margin-bottom: clamp(1.75rem, 3.5vw, 2.5rem);

  h3 {
    margin: 0.35rem 0 0.5rem;
    font-size: clamp(1.35rem, 2.4vw, 1.75rem);
    font-weight: ${fontWeight.extraBold};
    letter-spacing: -0.02em;
    color: ${light.inkPrimary};
  }

  p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

export const ReliabilityList = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
`

export const ReliabilityItem = styled.li`
  display: flex;
  flex-direction: column;
  padding-top: 1.25rem;
  border-top: 1px solid ${light.border};

  .tag {
    margin-bottom: 0.5rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    color: ${light.accentText};
  }

  h4 {
    margin: 0 0 0.45rem;
    font-size: 1.1rem;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
    font-size: 0.925rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
  }
`

export const StoryLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: start;
  gap: clamp(1.75rem, 5vw, 4.5rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const StoryHeadline = styled.h2`
  margin: 0;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.16;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.extraBold};
  color: ${light.inkPrimary};

  strong {
    display: block;
    font-weight: inherit;
    color: ${light.accentText};
  }
`

/**
 * hairline divider stat 리스트. 확인 가능한 값만 올린다.
 *
 * 구분선은 **항목 사이와 마지막 항목 아래**에만 둔다 - 첫 항목 위 여는 선은 섹션 리드와 리스트를
 * 한 번 더 끊어 리스트가 별개의 표처럼 떠 보인다(오너 지시 2026-08-03). 1열로 스택되는 좁은 폭에서도
 * 같은 규칙이 유지된다: 선 규칙이 열 수가 아니라 항목 순서에 걸려 있다.
 */
export const StatList = styled.dl`
  margin: clamp(2.25rem, 5vw, 3.5rem) 0 0;
  max-width: 34rem;

  > div {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    align-items: baseline;
    gap: 0.35rem 1.5rem;
    padding: 1.15rem 0;
    border-top: 1px solid ${light.border};
  }

  > div:first-of-type {
    border-top: none;
  }

  > div:last-of-type {
    border-bottom: 1px solid ${light.border};
  }

  dt {
    margin: 0;
    font-size: clamp(1.3rem, 2.4vw, 1.75rem);
    line-height: 1.2;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.extraBold};
    color: ${light.inkPrimary};
  }

  dd {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
    color: ${light.inkSecondary};
  }

  @media (max-width: ${breakpoint.sm}px) {
    > div {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

/**
 * 2x2 비전 체크리스트.
 * 구분선 규칙은 StatList와 같다: 여는 선 없음 · 줄 사이 · 닫는 선.
 */
const PRINCIPLE_RULE = `1px solid ${light.borderBrand}`

export const PrincipleList = styled.ul`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 clamp(1.5rem, 4vw, 3.5rem);
  margin: clamp(2.25rem, 5vw, 3.5rem) 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 1.1rem 0;
    border-top: ${PRINCIPLE_RULE};
    font-size: clamp(1.0625rem, 1.8vw, 1.15rem);
    line-height: 1.6;
    font-weight: ${fontWeight.semibold};
    color: ${light.inkPrimary};
  }

  li:nth-child(-n + 2) {
    border-top: none;
  }

  li:nth-last-child(-n + 2) {
    border-bottom: ${PRINCIPLE_RULE};
  }

  li > span:first-of-type {
    display: flex;
    flex: 0 0 auto;
    color: ${light.accentText};
  }

  /** 22px에 24 viewBox 기준 2.1 → 렌더 2.1px 획. 본문 옆에서 확인 표시가 또렷하게 읽히는 두께다. */
  li > span:first-of-type svg {
    width: 1.375rem;
    height: 1.375rem;
    stroke-width: 2.1;
  }

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: minmax(0, 1fr);

    li:nth-child(2) {
      border-top: ${PRINCIPLE_RULE};
    }

    li:nth-last-child(2) {
      border-bottom: none;
    }
  }
`

export const NewsHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem 2.5rem;
`

export const NewsHeaderAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.4rem 0.25rem;
  font-size: 1rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.accentText};
  text-decoration: none;
  transition: color ${TRANSITION}, gap ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform ${TRANSITION};
  }

  &:hover {
    color: ${light.accentPressed};
    gap: 0.6rem;

    svg {
      transform: translateX(2px);
    }
  }
`

export const NewsGrid = styled.ul`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  margin: clamp(2rem, 4vw, 3rem) 0 0;
  padding: 0;
  list-style: none;

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const NewsCard = styled.a`
  ${focusVisibleRing};
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  height: 100%;
  padding: clamp(1.25rem, 2.2vw, 1.65rem);
  border: 1px solid ${light.border};
  border-radius: ${radius.lg}px;
  background: ${light.surface};
  text-decoration: none;
  transition: border-color ${TRANSITION};

  &:hover {
    border-color: ${light.borderStrong};
  }

  &:hover h3,
  &:hover strong {
    color: ${light.accentText};
  }

  &:hover [data-ui="company-news-media"] img {
    transform: scale(1.025);
  }

  &:hover [data-ui="company-news-action"] {
    color: ${light.accentPressed};
    gap: 0.55rem;

    svg {
      transform: translateX(2px);
    }
  }

  h3,
  strong {
    margin: 0;
    font-size: clamp(1.125rem, 1.8vw, 1.25rem);
    line-height: 1.45;
    letter-spacing: -0.015em;
    font-weight: ${fontWeight.bold};
    color: ${light.inkPrimary};
    transition: color ${TRANSITION};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.65;
    color: ${light.inkSecondary};
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  time {
    font-family: ${editorialLabel.fontFamily};
    font-size: 0.875rem;
    color: ${light.inkMuted};
    letter-spacing: 0.02em;
  }
`

export const NewsMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`

export const NewsIndex = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.55rem;
  border-radius: ${variables.ui.button.radiusPill}px;
  background: ${light.surfaceBrand};
  color: ${light.accentText};
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
`

/** 실제 썸네일 이미지가 존재할 때만 렌더되는 미디어 슬롯 */
export const NewsMedia = styled.div`
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: ${radius.md}px;
  background: ${light.surfaceBrandChrome};

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform ${TRANSITION};
  }
`

export const NewsAction = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.75rem;
  font-size: 1rem;
  font-weight: ${fontWeight.semibold};
  color: ${light.accentText};
  transition: gap ${TRANSITION}, color ${TRANSITION};

  svg {
    flex: 0 0 auto;
    transition: transform ${TRANSITION};
  }
`

/**
 * 문의 밴드. 오너 페어링의 시그니처 면이고 그 위 텍스트·focus는 전부 onSignature다
 * (기본 focus 색은 이 면에서 3:1을 못 넘긴다).
 */
export const ContactBand = styled.div`
  --aq-focus-ring: ${light.onSignature};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
  padding: clamp(1.75rem, 4vw, 3rem);
  border-radius: 1.75rem;
  background: ${light.signature};
  color: ${light.onSignature};

  h2 {
    margin: 0 0 0.5rem;
    font-size: clamp(1.4rem, 2.8vw, 2rem);
    line-height: 1.25;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.extraBold};
  }

  p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.65;
  }
`
