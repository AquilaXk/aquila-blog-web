/* eslint-disable @next/next/no-img-element */
import { CONFIG } from "site.config"
import EasySubwayLineArt from "src/routes/EasySubway/EasySubwayLineArt"
import {
  BARRIER_FREE_ROUTE_SPECS,
  COMPANY_SURFACE,
  COMPANY_URL,
  CONTACT_MAILTO,
  PRODUCT_FEATURES,
  PRODUCT_FOOTER_LINKS,
  PRODUCT_META_FACTS,
  PRODUCT_RELEASE_STATUS,
  PRODUCT_SCOPE_CHIPS,
  PRODUCT_SCREENSHOT,
  PRODUCT_SCREENSHOT_ALT,
  PRODUCT_SCREENSHOT_SIZE,
  PRODUCT_SURFACE,
  TECH_SPEC_ITEMS,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

const [PICK_FEATURE, ROUTE_FEATURE] = PRODUCT_FEATURES

/**
 * `surfaceUrl`은 요청 호스트로 resolve한 이 표면의 공개 URL이다(페이지의 canonical과 같은 값).
 *
 * 브랜드 셀프 링크에 내부 라우트 `/easysubway`를 쓰지 않는 이유: 전용 호스트에서 공개 페이지는
 * 루트이고 `/easysubway`는 Caddy rewrite가 쓰는 내부 경로다. 그 경로는 표면 robots에서 disallow돼
 * 있으므로, 브랜드를 누른 방문자가 canonical 루트에서 중복 경로로 이동하게 된다.
 */
type Props = {
  surfaceUrl: string
}

const EasySubwayPageView: React.FC<Props> = ({ surfaceUrl }) => (
  <S.ProductSurface>
    <S.SurfaceHeader>
      <S.BrandLink href={surfaceUrl} aria-current="page">
        {PRODUCT_SURFACE.name}
        <small>by {COMPANY_SURFACE.name}</small>
      </S.BrandLink>
      <S.HeaderLinks aria-label="제품 소개 둘러보기">
        <S.NavLink href="#features">기능</S.NavLink>
        <S.NavLink href="#scope">제공 범위</S.NavLink>
        <S.NavLink href={COMPANY_URL}>회사 소개</S.NavLink>
        <S.HeaderAction href={CONTACT_MAILTO}>문의</S.HeaderAction>
      </S.HeaderLinks>
    </S.SurfaceHeader>

    <main>
      <S.Hero>
        <S.LineArtLayer $align="bottom">
          <EasySubwayLineArt />
        </S.LineArtLayer>
        <S.HeroCopy>
          <S.StatusPill>{PRODUCT_RELEASE_STATUS}</S.StatusPill>
          <S.HeroTitle>
            갈 수 있는 길을
            <strong>먼저 보여주는 지하철</strong>
          </S.HeroTitle>
          <S.HeroLead>
            계단과 환승 동선을 함께 계산해 <S.InlineHighlight>끝까지 이동할 수 있는 경로</S.InlineHighlight>
            를 먼저 내놓습니다.
          </S.HeroLead>
        </S.HeroCopy>
        <S.HeroPhoneWrap>
          <S.PhoneFrame $width="21.5rem">
            <img
              src={PRODUCT_SCREENSHOT}
              alt={PRODUCT_SCREENSHOT_ALT}
              width={PRODUCT_SCREENSHOT_SIZE.width}
              height={PRODUCT_SCREENSHOT_SIZE.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </S.PhoneFrame>
        </S.HeroPhoneWrap>
      </S.Hero>

      <S.Section $tone="raised" id="overview">
        <S.SectionInner>
          <S.IntroLayout>
            <div>
              <S.Eyebrow>제품 개요</S.Eyebrow>
              <S.DisplayHeading>
                교통약자의 이동 경로를
                <strong>직접 검증합니다</strong>
              </S.DisplayHeading>
            </div>
            <S.IntroAside>
              전국 정식 출시를 목표로 <strong>현장 데이터와 이동편의시설 근거</strong>를 꼼꼼히 검증해 반영합니다.
            </S.IntroAside>
          </S.IntroLayout>
          <S.MetaFactRow>
            {PRODUCT_META_FACTS.map((fact) => (
              <div key={fact.id}>
                <dt>{fact.label}</dt>
                <dd>
                  <S.MetaPill $accent={fact.accent}>{fact.value}</S.MetaPill>
                </dd>
              </div>
            ))}
          </S.MetaFactRow>
        </S.SectionInner>
      </S.Section>

      <S.Section id="features">
        <S.SectionInner>
          <S.IntroLayout>
            <div>
              <S.Eyebrow>핵심 기능</S.Eyebrow>
              <S.DisplayHeading>
                노선도 한 화면에서
                <strong>역 선택과 이동 경로를 확인합니다</strong>
              </S.DisplayHeading>
            </div>
            <S.IntroAside>
              노선도 화면에서 <strong>출발·경유·도착역 선택</strong>과 <strong>환승 경로 확인</strong>을 한 번에
              진행할 수 있습니다.
            </S.IntroAside>
          </S.IntroLayout>

          <S.FeatureBlock>
            <div>
              <S.FeatureIndex>01 / STATION SELECTION</S.FeatureIndex>
              <S.FeatureName>{PICK_FEATURE.name}</S.FeatureName>
              <S.FeatureBody>
                {PICK_FEATURE.lead} <S.InlineHighlight>{PICK_FEATURE.keyword}</S.InlineHighlight>
                {PICK_FEATURE.tail}
              </S.FeatureBody>
            </div>
            <div>
              <S.FeatureStage>
                <S.DetailCrop>
                  <div>
                    <img
                      src={PRODUCT_SCREENSHOT}
                      alt="노선도에서 역을 선택하면 출발·경유·도착 버튼이 함께 열린 모습."
                      width={PRODUCT_SCREENSHOT_SIZE.width}
                      height={PRODUCT_SCREENSHOT_SIZE.height}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <figcaption>노선도 화면 일부 — 역 선택 시 출발·경유·도착 지정</figcaption>
                </S.DetailCrop>
              </S.FeatureStage>
            </div>
          </S.FeatureBlock>

          <S.FeatureBlock $reverse>
            <div>
              <S.FeatureIndex>02 / ROUTE SPECIFICATION</S.FeatureIndex>
              <S.FeatureName>{ROUTE_FEATURE.name}</S.FeatureName>
              <S.FeatureBody>
                {ROUTE_FEATURE.lead} <S.InlineHighlight>{ROUTE_FEATURE.keyword}</S.InlineHighlight>
                {ROUTE_FEATURE.tail}
              </S.FeatureBody>
            </div>
            <div>
              {/* [Phase 1] 무장애 이동 경로 에디토리얼 명세표 컴포넌트 */}
              <S.RouteSpecPanel>
                <S.RouteSpecHeader>
                  <S.RouteSpecTitle>무장애 이동 경로 에디토리얼 명세표</S.RouteSpecTitle>
                  <S.RouteSpecTag>VERIFIED SPEC</S.RouteSpecTag>
                </S.RouteSpecHeader>
                <S.RouteSpecList>
                  {BARRIER_FREE_ROUTE_SPECS.map((spec) => (
                    <S.RouteSpecCard key={spec.id}>
                      <dt>{spec.category}</dt>
                      <dd>
                        <strong>{spec.title}</strong>
                        <p>{spec.description}</p>
                      </dd>
                    </S.RouteSpecCard>
                  ))}
                </S.RouteSpecList>
              </S.RouteSpecPanel>
            </div>
          </S.FeatureBlock>
        </S.SectionInner>
      </S.Section>

      <S.Section $tone="raised" id="scope">
        <S.SectionInner>
          <S.Eyebrow>정식 출시 기준</S.Eyebrow>
          <S.DisplayHeading>
            전국 정식 출시를 위한
            <strong>데이터 검증 기준</strong>
          </S.DisplayHeading>
          <S.ScopeLayout>
            <div>
              <S.IntroAside>
                전국 출시 기준에 맞춰 <strong>검증을 통과한 이동편의시설 데이터</strong>만 선별하여 반영합니다.
              </S.IntroAside>
              <S.ChipCluster>
                {PRODUCT_SCOPE_CHIPS.map((chip) => (
                  <li key={chip.id}>
                    <S.ScopeChip $accent={chip.accent}>{chip.label}</S.ScopeChip>
                  </li>
                ))}
              </S.ChipCluster>
            </div>
            {/* [Phase 3] 2x2 에디토리얼 기술 명세표 */}
            <S.TechSpecGrid>
              {TECH_SPEC_ITEMS.map((item) => (
                <S.TechSpecCell key={item.id}>
                  <dt>{item.label}</dt>
                  <dd>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </dd>
                </S.TechSpecCell>
              ))}
            </S.TechSpecGrid>
          </S.ScopeLayout>
        </S.SectionInner>
      </S.Section>

      <S.Section>
        <S.ContactBand>
          <div>
            <h2>출시 소식과 협업 문의</h2>
            <p>
              {PRODUCT_RELEASE_STATUS}입니다. 공개 다운로드가 열리면 이 페이지에서 안내합니다. 데이터
              검증과 기술 협업 문의도 같은 주소로 받습니다.
            </p>
          </div>
          <S.PillAction href={CONTACT_MAILTO}>{PRODUCT_SURFACE.contactEmail}</S.PillAction>
        </S.ContactBand>
      </S.Section>
    </main>

    <S.SurfaceFooter>
      <S.FooterInner>
        <S.FooterBrand>
          <strong>{PRODUCT_SURFACE.name}</strong>
          <span>교통약자를 먼저 생각한 지하철 길찾기</span>
          <small>
            © {CONFIG.since} {COMPANY_SURFACE.name}
          </small>
        </S.FooterBrand>
        <S.FooterLinks aria-label="제품 관련 링크">
          {PRODUCT_FOOTER_LINKS.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </S.FooterLinks>
      </S.FooterInner>
    </S.SurfaceFooter>
  </S.ProductSurface>
)

export default EasySubwayPageView
