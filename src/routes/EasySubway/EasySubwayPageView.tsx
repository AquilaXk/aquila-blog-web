/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useState } from "react"
import { CONFIG } from "site.config"
import EasySubwayLineArt from "src/routes/EasySubway/EasySubwayLineArt"
import EasySubwayRouteSpecTable from "src/routes/EasySubway/EasySubwayRouteSpecTable"
import EasySubwayTechSpecGrid from "src/routes/EasySubway/EasySubwayTechSpecGrid"
import useScrollReveal from "src/routes/EasySubway/useScrollReveal"
import {
  COMPANY_SURFACE,
  COMPANY_URL,
  COMPARISON_TRACKS,
  CONTACT_MAILTO,
  FAQ_ITEMS,
  OFFICIAL_METRO_BADGES,
  PRODUCT_FEATURES,
  PRODUCT_FOOTER_LINKS,
  PRODUCT_META_FACTS,
  PRODUCT_RELEASE_STATUS,
  PRODUCT_SCOPE_CHIPS,
  PRODUCT_SCREENSHOT,
  PRODUCT_SCREENSHOT_ALT,
  PRODUCT_SCREENSHOT_SIZE,
  PRODUCT_SURFACE,
  TIMELINE_SCREENSHOT,
  TIMELINE_SCREENSHOT_ALT,
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

const EasySubwayPageView: React.FC<Props> = ({ surfaceUrl }) => {
  const surfaceRef = useScrollReveal<HTMLDivElement>()
  const [copied, setCopied] = useState(false)

  const handleCopyEmail = useCallback(() => {
    const email = PRODUCT_SURFACE.contactEmail
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(email)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  return (
    <S.ProductSurface ref={surfaceRef}>
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
            <S.StatusBadge>{PRODUCT_RELEASE_STATUS}</S.StatusBadge>
            <S.HeroTitle>
              갈 수 있는 길을
              <strong>먼저 보여주는 지하철</strong>
            </S.HeroTitle>
            <S.HeroLead>
              계단과 환승 동선을 함께 계산해 <S.InlineHighlight>끝까지 이동할 수 있는 경로</S.InlineHighlight>
              를 먼저 내놓습니다.
            </S.HeroLead>
          </S.HeroCopy>
          <S.HeroPhoneWrap data-reveal data-reveal-delay="120">
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
            <S.IntroLayout data-reveal>
              <div>
                <S.Eyebrow>제품 개요</S.Eyebrow>
                <S.DisplayHeading>
                  교통약자의 이동 경로를
                  <strong>직접 검증합니다</strong>
                </S.DisplayHeading>
              </div>
              <S.IntroAside>
                공공데이터와 현장 실측을 바탕으로 <strong>휠체어와 유모차 이동에 필요한 편의시설</strong>을 직접 검증합니다.
              </S.IntroAside>
            </S.IntroLayout>
            <S.MetaFactRow>
              {PRODUCT_META_FACTS.map((fact) => (
                <div key={fact.id} data-reveal data-reveal-group="overview-facts">
                  <dt>{fact.label}</dt>
                  <dd>
                    <S.MetaBadge $accent={fact.accent}>{fact.value}</S.MetaBadge>
                  </dd>
                </div>
              ))}
            </S.MetaFactRow>
          </S.SectionInner>
        </S.Section>

        <S.Section id="features">
          <S.SectionInner>
            <S.IntroLayout data-reveal>
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
              <div data-reveal>
                <S.FeatureIndex>{PICK_FEATURE.tag}</S.FeatureIndex>
                <S.FeatureName>{PICK_FEATURE.name}</S.FeatureName>
                <S.FeatureBody>
                  {PICK_FEATURE.lead} <S.InlineHighlight>{PICK_FEATURE.keyword}</S.InlineHighlight>
                  {PICK_FEATURE.tail}
                </S.FeatureBody>
              </div>
              <div>
                <S.FeatureStage data-reveal data-reveal-delay="100">
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
              <div data-reveal>
                <S.FeatureIndex>{ROUTE_FEATURE.tag}</S.FeatureIndex>
                <S.FeatureName>{ROUTE_FEATURE.name}</S.FeatureName>
                <S.FeatureBody>
                  {ROUTE_FEATURE.lead} <S.InlineHighlight>{ROUTE_FEATURE.keyword}</S.InlineHighlight>
                  {ROUTE_FEATURE.tail}
                </S.FeatureBody>
              </div>
              <div>
                <S.FeatureStage data-reveal data-reveal-delay="100">
                  <S.TimelineShowcase>
                    <S.TimelinePhoneFrame>
                      <img
                        src={TIMELINE_SCREENSHOT}
                        alt={TIMELINE_SCREENSHOT_ALT}
                        width={1080}
                        height={2340}
                        loading="lazy"
                        decoding="async"
                      />
                    </S.TimelinePhoneFrame>
                    <S.TimelineCalloutCluster>
                      <S.TimelineCalloutCard>
                        <S.CalloutHeader>
                          <img
                            src="/easysubway/badges/seoul_4_compact_256.png"
                            alt="4호선"
                            width={22}
                            height={22}
                          />
                          <S.CalloutTag>빠른 환승·하차</S.CalloutTag>
                        </S.CalloutHeader>
                        <strong>9-2 승차 위치 안내</strong>
                        <p>환승 엘리베이터 바로 앞으로 내릴 수 있는 최적의 승차 위치(칸·문)를 제시합니다.</p>
                      </S.TimelineCalloutCard>
                      <S.TimelineCalloutCard>
                        <S.CalloutHeader>
                          <S.CalloutIconSvg aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm2 2h6v2H9V6zm1 6l2-2 2 2h-1.5v3h-1v-3H10zm0 5l2 2 2-2h-1.5v-3h-1v3H10z" />
                            </svg>
                          </S.CalloutIconSvg>
                          <S.CalloutTag>단차 0cm 이동</S.CalloutTag>
                        </S.CalloutHeader>
                        <strong>엘리베이터 직결 동선</strong>
                        <p>계단과 턱을 배제하고 지상 출구부터 승강장까지 100% 수직 이동 경로를 시각화합니다.</p>
                      </S.TimelineCalloutCard>
                    </S.TimelineCalloutCluster>
                  </S.TimelineShowcase>
                </S.FeatureStage>
              </div>
            </S.FeatureBlock>

            <div style={{ marginTop: "clamp(2rem, 4vw, 3rem)" }}>
              {/* [Phase 1 P0] 교통약자를 위한 무장애 경로 기준 컴포넌트 */}
              <EasySubwayRouteSpecTable />
            </div>
          </S.SectionInner>
        </S.Section>

        {/* [P2] 일반 지도앱 vs EasySubway 1:1 비교 섹션 */}
        <S.Section id="compare">
          <S.SectionInner>
            <S.IntroLayout data-reveal>
              <div>
                <S.Eyebrow>비교 가이드</S.Eyebrow>
                <S.DisplayHeading>
                  일반 지도앱 vs
                  <strong>EasySubway 무장애 경로</strong>
                </S.DisplayHeading>
              </div>
              <S.IntroAside>
                계단과 단차를 고려하지 않는 일반 길찾기와 달리, <strong>교통약자가 실제로 끝까지 완주할 수 있는 동선</strong>을 제공합니다.
              </S.IntroAside>
            </S.IntroLayout>

            <S.ComparisonGrid>
              {COMPARISON_TRACKS.map((track) => (
                <S.ComparisonCard
                  key={track.id}
                  $variant={track.badgeVariant}
                  data-reveal
                  data-reveal-delay={track.id === "easysubway" ? "120" : "60"}
                >
                  <S.ComparisonCardHeader>
                    <S.ComparisonBadge $variant={track.badgeVariant}>
                      {track.label}
                    </S.ComparisonBadge>
                    <S.ComparisonTitle>{track.title}</S.ComparisonTitle>
                  </S.ComparisonCardHeader>
                  <S.ComparisonList>
                    {track.points.map((pt, i) => (
                      <li key={i}>
                        {track.id === "easysubway" ? (
                          <S.ComparisonCheckIcon aria-hidden="true">✓</S.ComparisonCheckIcon>
                        ) : (
                          <S.ComparisonCrossIcon aria-hidden="true">✕</S.ComparisonCrossIcon>
                        )}
                        <div>
                          <strong>{pt.title}</strong>
                          <p>{pt.description}</p>
                        </div>
                      </li>
                    ))}
                  </S.ComparisonList>
                </S.ComparisonCard>
              ))}
            </S.ComparisonGrid>
          </S.SectionInner>
        </S.Section>

        <S.Section $tone="raised" id="scope">
          <S.SectionInner>
            <S.IntroLayout data-reveal>
              <div>
                <S.Eyebrow>서비스 검증 기준</S.Eyebrow>
                <S.DisplayHeading>
                  안전한 이동을 보장하는
                  <strong>데이터 검증 기준</strong>
                </S.DisplayHeading>
              </div>
            </S.IntroLayout>
            <S.ScopeLayout>
              <div>
                <S.IntroAside data-reveal>
                  수도권과 광역시 주요 노선에서 <strong>검증을 통과한 이동편의시설 데이터</strong>만 선별하여 반영합니다.
                </S.IntroAside>
                <S.ChipCluster>
                  {PRODUCT_SCOPE_CHIPS.map((chip) => (
                    <li key={chip.id} data-reveal data-reveal-group="scope-chips">
                      <S.ScopeChip $accent={chip.accent}>{chip.label}</S.ScopeChip>
                    </li>
                  ))}
                </S.ChipCluster>
              </div>
              {/* [Phase 3 P2] 2x2 에디토리얼 기술 명세표 */}
              <EasySubwayTechSpecGrid />
            </S.ScopeLayout>

            {/* [P1] 공식 20개 노선 뱃지 그리드 */}
            <div style={{ marginTop: "clamp(2.5rem, 5vw, 3.5rem)" }} data-reveal>
              <S.Eyebrow>지원 노선 데이터</S.Eyebrow>
              <S.MetroSectionTitle>
                공식 20개 노선 무장애 데이터 연동
              </S.MetroSectionTitle>
              <S.MetroSectionLead>
                4호선 하늘색 원형을 포함한 수도권 핵심 20개 도시철도 노선의 엘리베이터 및 환승 정보를 실측 데이터로 제공합니다.
              </S.MetroSectionLead>
              <S.MetroBadgeGrid>
                {OFFICIAL_METRO_BADGES.map((badge) => (
                  <S.MetroBadgeCard key={badge.id} data-reveal data-reveal-group="metro-badges">
                    <img
                      src={`/easysubway/badges/${badge.fileName}`}
                      alt={badge.name}
                      width={26}
                      height={26}
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{badge.name}</span>
                  </S.MetroBadgeCard>
                ))}
              </S.MetroBadgeGrid>
            </div>
          </S.SectionInner>
        </S.Section>

        {/* [P2] FAQ 자주 묻는 질문 4종 */}
        <S.Section id="faq">
          <S.SectionInner>
            <S.IntroLayout data-reveal>
              <div>
                <S.Eyebrow>자주 묻는 질문</S.Eyebrow>
                <S.DisplayHeading>
                  EasySubway에 대해
                  <strong>궁금한 점을 확인하세요</strong>
                </S.DisplayHeading>
              </div>
              <S.IntroAside>
                서비스 무료 이용 여부, 지원 노선, 무추적 원칙 등 자주 묻는 질문 4종을 확인하실 수 있습니다.
              </S.IntroAside>
            </S.IntroLayout>

            <S.FaqSection role="region" aria-label="자주 묻는 질문">
              <S.FaqList>
                {FAQ_ITEMS.map((item, idx) => (
                  <S.FaqCard key={item.id} data-reveal data-reveal-group="faq-items">
                    <S.FaqQuestionHeader>
                      <S.FaqQuestionNumber>Q{idx + 1}</S.FaqQuestionNumber>
                      <S.FaqQuestionText>{item.question}</S.FaqQuestionText>
                    </S.FaqQuestionHeader>
                    <S.FaqAnswerText>{item.answer}</S.FaqAnswerText>
                  </S.FaqCard>
                ))}
              </S.FaqList>
            </S.FaqSection>
          </S.SectionInner>
        </S.Section>

        {/* [P2] 명확한 액션 라벨 및 원클릭 복사 CTA */}
        <S.Section>
          <S.ContactBand data-reveal>
            <div>
              <h2>출시 소식과 협업 문의</h2>
              <p>
                {PRODUCT_RELEASE_STATUS}입니다. 공개 다운로드가 열리면 이 페이지에서 안내합니다. 데이터
                검증과 기술 협업 문의도 같은 주소로 받습니다.
              </p>
            </div>
            <S.ContactActionGroup>
              <S.ButtonAction href={CONTACT_MAILTO}>서비스 문의하기</S.ButtonAction>
              <S.CopyEmailButton
                type="button"
                onClick={handleCopyEmail}
                aria-label="이메일 주소 복사"
              >
                <S.CopyIconWrapper aria-hidden="true">
                  {copied ? (
                    <svg viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                    </svg>
                  )}
                </S.CopyIconWrapper>
                <span>{copied ? "복사 완료!" : "이메일 복사"}</span>
                <S.CopyEmailAddress>{PRODUCT_SURFACE.contactEmail}</S.CopyEmailAddress>
              </S.CopyEmailButton>
            </S.ContactActionGroup>
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
}

export default EasySubwayPageView
