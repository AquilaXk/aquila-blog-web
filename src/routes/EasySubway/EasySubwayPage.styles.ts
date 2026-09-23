import styled from "@emotion/styled"
import { breakpoint, editorialLabel, fontWeight, layoutBreakpoint, radius } from "src/design-system/tokens"
import { focusVisibleRing } from "src/design-system/focusRing"
import { marketingDark as dark } from "src/design-system/marketingPalette"
import { variables } from "src/styles"

/**
 * 제품 표면은 방문자 테마와 무관하게 인디고-블랙 다크로 고정한다 - 이 페이지의 색은 사용자 설정이
 * 아니라 제품 정체성이다. 색·대비 근거는 `src/design-system/marketingPalette.ts` 주석에 있다.
 *
 * 패밀리룩 원칙:
 * 1) 과도한 3D 틸트, 마이너스 마진 폰 클리핑, 다각형 클립패스 및 인위적 radial 광원(AI 슬롭)을 배제한다.
 * 2) 999px pill 컨트롤 대신 플랫폼 공통의 사각 제어 버튼(radius: 8px/10px) 및 사각 보더 칩(radius: 6px)을 사용한다.
 * 3) 9rem 고스트 숫자와 거대 StatCard 대신 정제된 2x2 에디토리얼 기술 명세표 및 무장애 경로 명세표를 배치한다.
 */
const CONTENT_MAX_WIDTH = "75rem"
const SECTION_PADDING_Y = "clamp(3.5rem, 8vw, 7rem)"
const SECTION_PADDING_X = "clamp(1.25rem, 5vw, 3rem)"
const TRANSITION = "160ms ease-out"

export const ProductSurface = styled.div`
  background: ${dark.field};
  color: ${dark.textPrimary};
  word-break: keep-all;
  overflow-wrap: break-word;
`

export const SurfaceHeader = styled.header`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndexes.header};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 72px;
  padding: 0.75rem ${SECTION_PADDING_X};
  background: ${dark.fieldDeep};
  border-bottom: 1px solid ${dark.hairline};

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    flex-wrap: wrap;
    row-gap: 0.35rem;
  }
`

export const BrandLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  min-height: 44px;
  border-radius: ${radius.md}px;
  color: ${dark.textPrimary};
  text-decoration: none;
  font-size: 1.06rem;
  font-weight: ${fontWeight.bold};
  letter-spacing: -0.02em;

  small {
    font-size: 0.875rem;
    font-weight: ${fontWeight.regular};
    color: ${dark.textMuted};

    @media (max-width: ${breakpoint.sm}px) {
      display: none;
    }
  }
`

export const HeaderLinks = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  @media (max-width: ${layoutBreakpoint.navCompact}px) {
    flex: 1 0 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-left: -0.5rem;
    row-gap: 0.25rem;
  }
`

export const NavLink = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.75rem;
  border-radius: ${radius.md}px;
  color: ${dark.textSecondary};
  text-decoration: none;
  font-size: 1rem;
  font-weight: ${fontWeight.regular};
  transition: color ${TRANSITION}, background-color ${TRANSITION};

  &:hover {
    color: ${dark.textPrimary};
    background: ${dark.fieldRaised};
  }

  @media (max-width: ${breakpoint.sm}px) {
    padding: 0 0.5rem;
  }
`

/** 패밀리룩 전환: 999px Pill ➔ 사각 제어 버튼(radius: 10px) */
export const ButtonAction = styled.a`
  ${focusVisibleRing};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 1.5rem;
  border-radius: ${radius.md}px;
  background: ${dark.accent};
  color: ${dark.onAccent};
  text-decoration: none;
  font-size: 1rem;
  font-weight: ${fontWeight.semibold};
  letter-spacing: -0.01em;
  transition: background-color ${TRANSITION};

  &:hover {
    background: ${dark.accentPressed};
  }

  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
`

export const PillAction = ButtonAction

export const HeaderAction = styled(ButtonAction)`
  min-height: 44px;
  padding: 0 1.15rem;
  border-radius: ${radius.md}px;
`

/** 상태 뱃지: 999px Pill ➔ 사각 배지(radius: 6px) 및 원형 상태 점(50%) */
export const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.sm}px;
  background: ${dark.fieldRaised};
  color: ${dark.textPrimary};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};

  &::before {
    content: "";
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: ${dark.signature};
  }

  @media (forced-colors: active) {
    border-color: CanvasText;

    &::before {
      background: CanvasText;
    }
  }
`

export const StatusPill = StatusBadge

/**
 * 에디토리얼 다크 히어로.
 * 과도한 3D 회전과 마이너스 마진을 제거하고, 목업과 카피가 균형 있게 정돈된 레이아웃을 제공한다.
 */
export const Hero = styled.section`
  position: relative;
  overflow: hidden;
  padding: clamp(3rem, 7vw, 5.5rem) ${SECTION_PADDING_X} clamp(3rem, 7vw, 5rem);
  background: ${dark.fieldDeep};
`

/** 배경 추상 노선도 라인 아트 레이어 */
export const LineArtLayer = styled.div<{ $align?: "top" | "bottom" }>`
  position: absolute;
  right: 0;
  left: 0;
  ${({ $align }) => ($align === "bottom" ? "bottom: 0;" : "top: 0;")}
  height: clamp(14rem, 34vw, 26rem);
  pointer-events: none;
`

export const HeroCopy = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: min(100%, 46rem);
  margin: 0 auto;
  text-align: center;
`

export const HeroTitle = styled.h1`
  margin: 0;
  font-size: clamp(2.1rem, 5.4vw, 3.9rem);
  line-height: 1.12;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.regular};
  color: ${dark.textMuted};

  strong {
    display: block;
    font-weight: ${fontWeight.bold};
    color: ${dark.textPrimary};
  }
`

export const HeroLead = styled.p`
  position: relative;
  margin: 0;
  max-width: 32rem;
  font-size: clamp(1.0625rem, 1.5vw, 1.125rem);
  line-height: 1.7;
  color: ${dark.textSecondary};
`

export const InlineHighlight = styled.strong`
  padding: 0.1rem 0.35rem;
  border-radius: ${radius.sm}px;
  background: ${dark.hairline};
  color: ${dark.textPrimary};
  font-weight: ${fontWeight.semibold};
`

/**
 * 폰 프레임 목업:
 * 회전(-4deg) ➔ 0deg 평면 정렬, 56px 플로팅 그림자 및 가짜 CSS 노치 제거.
 * 스크린샷 1080x2340 원본 비율을 깨끗한 에디토리얼 테두리로 감싼다.
 */
export const PhoneFrame = styled.figure<{ $width?: string }>`
  position: relative;
  margin: 0;
  width: min(94%, ${({ $width }) => $width || "21rem"});
  padding: 0.5rem;
  border: 1px solid ${dark.borderStrong};
  border-radius: 1.75rem;
  background: ${dark.fieldDeep};
  box-shadow: none;
  transform: none;

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 1.35rem;
  }

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const HeroPhoneWrap = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  margin-bottom: 0;
`

export const Section = styled.section<{ $tone?: "base" | "raised" }>`
  position: relative;
  overflow: hidden;
  padding: ${SECTION_PADDING_Y} ${SECTION_PADDING_X};
  background: ${({ $tone }) => ($tone === "raised" ? dark.fieldRaised : dark.field)};
  border-top: 1px solid ${dark.hairline};
`

export const SectionInner = styled.div`
  position: relative;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
`

export const Eyebrow = styled.p`
  margin: 0 0 1rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.textMuted};
`

export const DisplayHeading = styled.h2`
  margin: 0;
  max-width: 34rem;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.regular};
  color: ${dark.textMuted};

  strong {
    display: block;
    font-weight: ${fontWeight.bold};
    color: ${dark.textPrimary};
  }
`

export const IntroLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
  align-items: start;
  gap: clamp(1.5rem, 4vw, 4rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const IntroAside = styled.p`
  margin: 0;
  max-width: 24rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${dark.textSecondary};

  strong {
    font-weight: ${fontWeight.semibold};
    color: ${dark.textPrimary};
  }
`

export const MetaFactRow = styled.dl`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem 1.5rem;
  margin: clamp(2rem, 4vw, 3rem) 0 0;
  padding-top: clamp(1.5rem, 3vw, 2.25rem);
  border-top: 1px solid ${dark.hairline};

  dt {
    margin: 0 0 0.5rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.textMuted};
  }

  dd {
    margin: 0;
  }

  @media (max-width: ${breakpoint.md}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

/** 메타 라벨 뱃지: 사각 컨트롤(radius: 6px) */
export const MetaBadge = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.85rem;
  border: 1px solid ${({ $accent }) => ($accent ? dark.signature : dark.hairline)};
  border-radius: ${radius.sm}px;
  background: ${({ $accent }) => ($accent ? dark.signature : dark.fieldDeep)};
  color: ${({ $accent }) => ($accent ? dark.onSignature : dark.textSecondary)};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const MetaPill = MetaBadge

export const FeatureBlock = styled.div<{ $reverse?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(2.5rem, 6vw, 4.5rem) 0;

  > div:last-of-type {
    order: ${({ $reverse }) => ($reverse ? -1 : 0)};
  }

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);

    > div:last-of-type {
      order: 0;
    }
  }
`

/** 9rem 고스트 숫자 대신 단정한 에디토리얼 인덱스 라벨 */
export const FeatureIndex = styled.span`
  display: inline-block;
  margin-bottom: 0.75rem;
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.textMuted};
`

export const FeatureName = styled.h3`
  margin: 0 0 1rem;
  font-size: clamp(1.4rem, 2.5vw, 1.85rem);
  line-height: 1.3;
  letter-spacing: -0.02em;
  font-weight: ${fontWeight.bold};
  color: ${dark.textPrimary};
`

export const FeatureBody = styled.p`
  margin: 0;
  max-width: 30rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: ${dark.textSecondary};
`

export const FeatureStage = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.75rem);
  padding: clamp(1.25rem, 2.4vw, 1.85rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.fieldDeep};

  @media (max-width: ${breakpoint.sm}px) {
    flex-direction: column;
    align-items: center;
  }
`

export const DetailCrop = styled.figure`
  margin: 0;
  width: min(100%, 26rem);

  > div {
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border: 1px solid ${dark.borderStrong};
    border-radius: ${radius.md}px;
    background: ${dark.fieldRaised};
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 51%;
  }

  figcaption {
    margin-top: 0.6rem;
    font-size: 0.875rem;
    color: ${dark.textMuted};
  }
`

/**
 * [Phase 1] 무장애 이동 경로 에디토리얼 명세표 컴포넌트
 * 기존의 가짜 시스템 에러 문구 패널(StatementPanel)을 완전히 대체하여
 * 제품의 안전성과 경로 계산 알고리즘 기준을 명확하게 전달한다.
 */
export const RouteSpecPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: clamp(1.5rem, 3.5vw, 2.25rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.fieldDeep};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

export const RouteSpecHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid ${dark.hairline};
`

export const RouteSpecTitle = styled.h4`
  margin: 0;
  font-size: 1.1rem;
  font-weight: ${fontWeight.bold};
  color: ${dark.textPrimary};
  letter-spacing: -0.01em;
`

export const RouteSpecTag = styled.span`
  font-family: ${editorialLabel.fontFamily};
  font-size: ${editorialLabel.fontSize};
  font-weight: ${editorialLabel.fontWeight};
  letter-spacing: ${editorialLabel.letterSpacing};
  text-transform: ${editorialLabel.textTransform};
  color: ${dark.signature};
`

export const RouteSpecList = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const RouteSpecCard = styled.div`
  padding: 1rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.sm}px;
  background: ${dark.fieldRaised};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }

  dt {
    margin: 0 0 0.35rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.signature};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.9375rem;
      font-weight: ${fontWeight.bold};
      color: ${dark.textPrimary};
    }

    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.55;
      color: ${dark.textSecondary};
    }
  }
`

export const ScopeLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  align-items: start;
  gap: clamp(2rem, 5vw, 4rem);
  margin-top: clamp(2rem, 4vw, 3rem);

  @media (max-width: ${layoutBreakpoint.adminCompact}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const ChipCluster = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;
`

/** [Phase 3] radius: 6px 사각 보더 칩 */
export const ScopeChip = styled.span<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 0.85rem;
  border: 1px solid ${({ $accent }) => ($accent ? dark.signature : dark.hairline)};
  border-radius: ${radius.sm}px;
  background: ${({ $accent }) => ($accent ? dark.fieldRaised : dark.fieldDeep)};
  color: ${({ $accent }) => ($accent ? dark.textPrimary : dark.textSecondary)};
  font-size: 0.9375rem;
  font-weight: ${fontWeight.medium};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }
`

/**
 * [Phase 3] 2x2 에디토리얼 기술 명세표
 * 기존의 과장된 StatCard를 대체하여 신뢰할 수 있는 4개 기술 팩트를 정갈한 2x2 그리드로 제시한다.
 */
export const TechSpecGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
  padding: clamp(1.25rem, 3vw, 1.75rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.md}px;
  background: ${dark.fieldDeep};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }

  @media (max-width: ${breakpoint.sm}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const TechSpecCell = styled.div`
  padding: 1.15rem;
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.sm}px;
  background: ${dark.fieldRaised};

  @media (forced-colors: active) {
    border-color: CanvasText;
  }

  dt {
    margin: 0 0 0.5rem;
    font-family: ${editorialLabel.fontFamily};
    font-size: ${editorialLabel.fontSize};
    font-weight: ${editorialLabel.fontWeight};
    letter-spacing: ${editorialLabel.letterSpacing};
    text-transform: ${editorialLabel.textTransform};
    color: ${dark.textMuted};
  }

  dd {
    margin: 0;

    strong {
      display: block;
      font-size: 1.25rem;
      line-height: 1.3;
      font-weight: ${fontWeight.bold};
      color: ${dark.textPrimary};
      letter-spacing: -0.01em;
    }

    p {
      margin: 0.35rem 0 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: ${dark.textSecondary};
    }
  }
`

export const ContactBand = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
  padding: clamp(1.75rem, 4vw, 3rem);
  border: 1px solid ${dark.hairline};
  border-radius: ${radius.lg}px;
  background: ${dark.fieldRaised};

  h2 {
    margin: 0 0 0.6rem;
    font-size: clamp(1.4rem, 2.8vw, 2rem);
    line-height: 1.25;
    letter-spacing: -0.02em;
    font-weight: ${fontWeight.bold};
    color: ${dark.textPrimary};
  }

  p {
    margin: 0;
    max-width: 30rem;
    font-size: 1.0625rem;
    line-height: 1.7;
    color: ${dark.textSecondary};
  }
`

export const SurfaceFooter = styled.footer`
  padding: clamp(2.5rem, 5vw, 4rem) ${SECTION_PADDING_X};
  border-top: 1px solid ${dark.hairline};
  background: ${dark.fieldDeep};
`

export const FooterInner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem 2.5rem;
  width: min(100%, ${CONTENT_MAX_WIDTH});
  margin: 0 auto;
`

export const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  strong {
    font-size: 1rem;
    font-weight: ${fontWeight.bold};
    letter-spacing: -0.02em;
    color: ${dark.textPrimary};
  }

  span {
    font-size: 1rem;
    color: ${dark.textSecondary};
  }

  small {
    font-size: 0.875rem;
    color: ${dark.textMuted};
  }
`

export const FooterLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;

  a {
    ${focusVisibleRing};
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    border-radius: ${radius.sm}px;
    color: ${dark.textSecondary};
    text-decoration: none;
    font-size: 1rem;
    font-weight: ${fontWeight.regular};
    transition: color ${TRANSITION};

    &:hover {
      color: ${dark.signature};
    }
  }
`
