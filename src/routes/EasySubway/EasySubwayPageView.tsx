/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useRef, useState } from "react"
import { CONFIG } from "site.config"
import { ArrowRightGlyph } from "src/components/branding/BrandMark"
import EasySubwayRouteSpecTable from "src/routes/EasySubway/EasySubwayRouteSpecTable"
import EasySubwayTechSpecGrid from "src/routes/EasySubway/EasySubwayTechSpecGrid"
import useScrollReveal from "src/routes/EasySubway/useScrollReveal"
import {
  COMPANY_SURFACE,
  COMPANY_URL,
  CONTACT_MAILTO,
  OFFICIAL_METRO_BADGES,
  PRODUCT_FEATURES,
  PRODUCT_FOOTER_LINKS,
  PRODUCT_RELEASE_STATUS,
  PRODUCT_SCREENSHOT,
  PRODUCT_SCREENSHOT_ALT,
  PRODUCT_SCREENSHOT_SIZE,
  PRODUCT_SURFACE,
  TIMELINE_SCREENSHOT,
  TIMELINE_SCREENSHOT_ALT,
  type MetroBadgeItem,
} from "src/routes/EasySubway/EasySubwayPageModel"
import * as S from "src/routes/EasySubway/EasySubwayPage.styles"

const [PICK_FEATURE, ROUTE_FEATURE] = PRODUCT_FEATURES

export const EasySubwayMetroDirectory: React.FC<{ badges?: MetroBadgeItem[] }> = ({
  badges = OFFICIAL_METRO_BADGES,
}) => (
  <S.MetroDirectoryBlock data-reveal>
    <S.Eyebrow>지원 노선 데이터</S.Eyebrow>
    <S.MetroSectionTitle>공식 20개 노선 무장애 데이터 연동</S.MetroSectionTitle>
    <S.MetroSectionLead>
      수도권 핵심 20개 도시철도 노선의 엘리베이터, 휠체어 리프트 및 환승 동선 정보를 실측 기준으로
      제공합니다.
    </S.MetroSectionLead>
    <S.MetroBadgeGrid>
      {badges.map((badge) => (
        <S.MetroBadgeCard key={badge.id} data-reveal data-reveal-group="metro-badges">
          <picture>
            <source
              srcSet={`/easysubway/badges/${badge.fileName.replace(/\.png$/, ".webp")}`}
              type="image/webp"
            />
            <img
              src={`/easysubway/badges/${badge.fileName}`}
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <span>{badge.name}</span>
        </S.MetroBadgeCard>
      ))}
    </S.MetroBadgeGrid>
  </S.MetroDirectoryBlock>
)

export const EasySubwayCopyEmailButton: React.FC<{
  status: "idle" | "copied" | "failed"
  onClick?: () => void
}> = ({ status, onClick }) => (
  <S.CopyEmailButton
    type="button"
    onClick={onClick}
    aria-label={
      status === "copied"
        ? "이메일 주소가 복사되었습니다"
        : status === "failed"
          ? "이메일 주소 복사에 실패했습니다"
          : "이메일 주소 복사"
    }
  >
    <S.CopyIconWrapper aria-hidden="true">
      {status === "copied" ? (
        <svg viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      ) : status === "failed" ? (
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
        </svg>
      )}
    </S.CopyIconWrapper>
    <span>
      {status === "copied"
        ? "복사 완료"
        : status === "failed"
          ? "복사 실패"
          : "이메일 주소 복사"}
    </span>
  </S.CopyEmailButton>
)

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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle")
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  const scheduleCopyReset = useCallback((nextStatus: "copied" | "failed") => {
    setCopyStatus(nextStatus)
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current)
    }
    copyResetTimerRef.current = setTimeout(() => {
      setCopyStatus("idle")
      copyResetTimerRef.current = null
    }, 2000)
  }, [])

  const handleCopyEmail = useCallback(async () => {
    const email = PRODUCT_SURFACE.contactEmail
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email)
        scheduleCopyReset("copied")
        return
      }
      if (typeof document !== "undefined" && document.execCommand) {
        const textarea = document.createElement("textarea")
        textarea.value = email
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        textarea.style.pointerEvents = "none"
        document.body.appendChild(textarea)
        textarea.select()
        const successful = document.execCommand("copy")
        document.body.removeChild(textarea)
        if (successful) {
          scheduleCopyReset("copied")
          return
        }
      }
      scheduleCopyReset("failed")
    } catch {
      scheduleCopyReset("failed")
    }
  }, [scheduleCopyReset])

  return (
    <S.ProductSurface ref={surfaceRef}>
      <S.SurfaceHeader data-header data-scroll-reactive="true">
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
          <S.HeroCopy data-reveal>
            <S.StatusBadge>{PRODUCT_RELEASE_STATUS}</S.StatusBadge>
            <S.HeroTitle>
              갈 수 있는 길을
              <span>먼저 보여주는 지하철</span>
            </S.HeroTitle>
            <S.HeroLead>
              계단과 환승 동선을 함께 계산해 끝까지 이동할 수 있는 경로를 먼저 내놓습니다.
            </S.HeroLead>
            <S.HeroActions>
              <S.ButtonAction href="#features">
                <span>핵심 기능 살펴보기</span>
                <ArrowRightGlyph size={15} />
              </S.ButtonAction>
              <S.SecondaryPillAction href="#scope">제공 범위 확인하기</S.SecondaryPillAction>
            </S.HeroActions>
          </S.HeroCopy>
          <S.HeroPhoneWrap data-reveal data-reveal-delay="100">
            <S.PhoneFrame $width="20.5rem">
              <picture>
                <source srcSet="/easysubway/station-detail.webp" type="image/webp" />
                <img
                  src={PRODUCT_SCREENSHOT}
                  alt={PRODUCT_SCREENSHOT_ALT}
                  width={PRODUCT_SCREENSHOT_SIZE.width}
                  height={PRODUCT_SCREENSHOT_SIZE.height}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </picture>
            </S.PhoneFrame>
          </S.HeroPhoneWrap>
        </S.Hero>

        <S.Section $tone="raised" id="features">
          <S.SectionInner>
            <S.IntroLayout data-reveal>
              <div>
                <S.Eyebrow>핵심 기능</S.Eyebrow>
                <S.DisplayHeading>
                  노선도 한 화면에서 역 선택과 이동 경로를 확인합니다
                </S.DisplayHeading>
              </div>
              <S.IntroAside>
                노선도 화면에서 출발·경유·도착역 선택과 엘리베이터 중심의 환승 경로 확인을 한 번에
                진행할 수 있습니다.
              </S.IntroAside>
            </S.IntroLayout>

            <S.FeatureBlock>
              <div data-reveal>
                <S.FeatureIndex>{PICK_FEATURE.tag}</S.FeatureIndex>
                <S.FeatureName>{PICK_FEATURE.name}</S.FeatureName>
                <S.FeatureBody>
                  {PICK_FEATURE.lead} {PICK_FEATURE.keyword}
                  {PICK_FEATURE.tail}
                </S.FeatureBody>
              </div>
              <div>
                <S.FeatureStage data-reveal data-reveal-delay="100">
                  <S.DetailCrop>
                    <div>
                      <picture>
                        <source srcSet="/easysubway/station-detail.webp" type="image/webp" />
                        <img
                          src={PRODUCT_SCREENSHOT}
                          alt="노선도에서 역을 선택하면 출발·경유·도착 버튼이 함께 열린 모습."
                          width={PRODUCT_SCREENSHOT_SIZE.width}
                          height={PRODUCT_SCREENSHOT_SIZE.height}
                          loading="lazy"
                          decoding="async"
                        />
                      </picture>
                    </div>
                    <figcaption>노선도 화면 일부. 역을 눌러 출발·경유·도착을 바로 지정합니다.</figcaption>
                  </S.DetailCrop>
                </S.FeatureStage>
              </div>
            </S.FeatureBlock>

            <S.FeatureBlock $reverse>
              <div data-reveal>
                <S.FeatureIndex>{ROUTE_FEATURE.tag}</S.FeatureIndex>
                <S.FeatureName>{ROUTE_FEATURE.name}</S.FeatureName>
                <S.FeatureBody>
                  {ROUTE_FEATURE.lead} {ROUTE_FEATURE.keyword}
                  {ROUTE_FEATURE.tail}
                </S.FeatureBody>
              </div>
              <div>
                <S.FeatureStage data-reveal data-reveal-delay="100">
                  <S.TimelineShowcase>
                    <S.TimelinePhoneFrame>
                      <picture>
                        <source srcSet="/easysubway/timeline-detail.webp" type="image/webp" />
                        <img
                          src={TIMELINE_SCREENSHOT}
                          alt={TIMELINE_SCREENSHOT_ALT}
                          width={1080}
                          height={2340}
                          loading="lazy"
                          decoding="async"
                        />
                      </picture>
                    </S.TimelinePhoneFrame>
                  </S.TimelineShowcase>
                </S.FeatureStage>
              </div>
            </S.FeatureBlock>

            <EasySubwayRouteSpecTable />
          </S.SectionInner>
        </S.Section>

        <S.Section id="scope">
          <S.SectionInner>
            <div id="overview">
              <S.IntroLayout data-reveal>
                <div>
                  <S.Eyebrow>제공 범위 및 검증 기준</S.Eyebrow>
                  <S.DisplayHeading>
                    검증을 마친 전국 도시철도 기준과 노선 데이터를 제공합니다
                  </S.DisplayHeading>
                </div>
                <S.IntroAside>
                  공공데이터와 현장 실측을 바탕으로 수도권과 광역시 주요 노선의 이동편의시설 정보를
                  선별하여 반영합니다.
                </S.IntroAside>
              </S.IntroLayout>

              <S.TechSpecBlock>
                <EasySubwayTechSpecGrid />
              </S.TechSpecBlock>
            </div>

            <EasySubwayMetroDirectory />
          </S.SectionInner>
        </S.Section>

        <S.Section $tone="raised">
          <S.ContactBand data-reveal>
            <div>
              <h2>출시 소식과 협업 문의</h2>
              <p>
                {PRODUCT_RELEASE_STATUS}입니다. 공개 다운로드가 열리면 이 페이지에서 안내합니다. 데이터
                검증과 기술 협업 문의도 같은 주소로 받습니다.
              </p>
            </div>
            <S.ContactActionGroup>
              <S.ButtonAction href={CONTACT_MAILTO}>
                <span>서비스 문의하기</span>
                <ArrowRightGlyph size={15} />
              </S.ButtonAction>
              <EasySubwayCopyEmailButton status={copyStatus} onClick={handleCopyEmail} />
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
