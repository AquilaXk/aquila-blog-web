/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter (MIT License)
 * - magicuidesign/magicui (apps/www/registry/magicui/android.tsx, MIT License)
 * - lucide-icons/lucide (icons/check.svg, icons/x.svg, icons/copy.svg, ISC License, Copyright (c) Lucide Contributors)
 */
/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useRef, useState } from "react"
import { CONFIG } from "site.config"
import { ArrowRightGlyph } from "src/components/branding/BrandMark"
import { marketingLight as light } from "src/design-system/marketingPalette"
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
import * as F from "src/routes/EasySubway/EasySubwayFeatures.styles"
import * as Scope from "src/routes/EasySubway/EasySubwayScope.styles"

const [PICK_FEATURE, ROUTE_FEATURE] = PRODUCT_FEATURES

const AndroidDeviceFrame: React.FC<{
  src: string
  alt: string
  compact?: boolean
  priority?: boolean
}> = ({ src, alt, compact = false, priority = false }) => (
  <S.AndroidPhoneFigure $compact={compact}>
    <svg
      className="androidHardwareChrome"
      viewBox="0 0 380 830"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M376 153C376.5 153 378 154 378 156V250C378 252 376.5 253 376 253V153Z"
        fill={light.deviceOuterFill}
      />
      <path
        d="M376 301C376.5 301 378 302 378 304V349C378 351 376.5 352 376 352V301Z"
        fill={light.deviceOuterFill}
      />
      <circle cx="189" cy="24" r="7" fill={light.deviceCameraOuter} fillOpacity="0.22" />
      <circle cx="189" cy="24" r="3.5" fill={light.deviceCameraInner} fillOpacity="0.55" />
    </svg>
    <picture>
      <source srcSet={src.replace(/\.png$/, ".webp")} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={PRODUCT_SCREENSHOT_SIZE.width}
        height={PRODUCT_SCREENSHOT_SIZE.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  </S.AndroidPhoneFigure>
)

export const EasySubwayMetroDirectory: React.FC<{ badges?: MetroBadgeItem[] }> = ({
  badges = OFFICIAL_METRO_BADGES,
}) => (
  <Scope.MetroDirectoryBlock data-reveal="true">
    <S.Eyebrow>지원 노선 데이터</S.Eyebrow>
    <Scope.MetroSectionTitle>공식 20개 노선 무장애 데이터 연동</Scope.MetroSectionTitle>
    <Scope.MetroSectionLead>
      수도권 핵심 20개 도시철도 노선의 엘리베이터, 휠체어 리프트 및 환승 동선 정보를 실측 기준으로
      제공합니다.
    </Scope.MetroSectionLead>
    <Scope.MetroBadgeGrid>
      {badges.map((badge) => (
        <Scope.MetroBadgeCard key={badge.id} data-reveal="true" data-reveal-group="metro-badges">
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
        </Scope.MetroBadgeCard>
      ))}
    </Scope.MetroBadgeGrid>
  </Scope.MetroDirectoryBlock>
)

export const EasySubwayCopyEmailButton: React.FC<{
  status: "idle" | "copied" | "failed"
  onClick?: () => void
}> = ({ status, onClick }) => (
  <Scope.CopyEmailButton
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
    <Scope.CopyIconWrapper aria-hidden="true">
      {status === "copied" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : status === "failed" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </Scope.CopyIconWrapper>
    <span>
      {status === "copied"
        ? "복사 완료"
        : status === "failed"
          ? "복사 실패"
          : "이메일 주소 복사"}
    </span>
  </Scope.CopyEmailButton>
)

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
        <S.HeaderInner>
          <S.BrandLink href={surfaceUrl} aria-current="page">
            <span>{PRODUCT_SURFACE.name}</span>
            <small>by {COMPANY_SURFACE.name}</small>
          </S.BrandLink>
          <S.HeaderLinks aria-label="제품 소개 둘러보기">
            <S.NavLink href="#features">기능</S.NavLink>
            <S.NavLink href="#scope">제공 범위</S.NavLink>
            <S.NavLink href={COMPANY_URL}>회사 소개</S.NavLink>
            <S.HeaderAction href={CONTACT_MAILTO}>
              <span>문의</span>
              <ArrowRightGlyph size={14} />
            </S.HeaderAction>
          </S.HeaderLinks>
        </S.HeaderInner>
      </S.SurfaceHeader>

      <main>
        <S.GridBand $lines>
          <S.GridContainer $flush>
            <S.HeroShell>
              <S.HeroCopy data-reveal="true">
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
                  <S.SecondaryAction href="#scope">제공 범위 확인하기</S.SecondaryAction>
                </S.HeroActions>
              </S.HeroCopy>
              <S.HeroPhoneWrap data-reveal="true" data-reveal-delay="100">
                <AndroidDeviceFrame
                  src={PRODUCT_SCREENSHOT}
                  alt={PRODUCT_SCREENSHOT_ALT}
                  priority
                />
              </S.HeroPhoneWrap>
            </S.HeroShell>
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand id="features">
          <S.GridContainer $flush>
            <F.ModuleBandHead data-reveal="true">
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
            </F.ModuleBandHead>

            <F.FeatureGrid>
              <F.FeaturePane data-reveal="true">
                <div>
                  <F.FeatureIndex>{PICK_FEATURE.tag}</F.FeatureIndex>
                  <F.FeatureName>{PICK_FEATURE.name}</F.FeatureName>
                  <F.FeatureBody>
                    {PICK_FEATURE.lead} {PICK_FEATURE.keyword}
                    {PICK_FEATURE.tail}
                  </F.FeatureBody>
                </div>
                <F.DetailCrop data-cropped="true">
                  <div>
                    <picture>
                      <source
                        srcSet={PRODUCT_SCREENSHOT.replace(/\.png$/, ".webp")}
                        type="image/webp"
                      />
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
                </F.DetailCrop>
              </F.FeaturePane>

              <F.FeaturePane data-reveal="true" data-reveal-delay="100">
                <div>
                  <F.FeatureIndex>{ROUTE_FEATURE.tag}</F.FeatureIndex>
                  <F.FeatureName>{ROUTE_FEATURE.name}</F.FeatureName>
                  <F.FeatureBody>
                    {ROUTE_FEATURE.lead} {ROUTE_FEATURE.keyword}
                    {ROUTE_FEATURE.tail}
                  </F.FeatureBody>
                </div>
                <F.AndroidStage>
                  <AndroidDeviceFrame
                    src={TIMELINE_SCREENSHOT}
                    alt={TIMELINE_SCREENSHOT_ALT}
                    compact
                  />
                </F.AndroidStage>
              </F.FeaturePane>
            </F.FeatureGrid>

            <EasySubwayRouteSpecTable />
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand id="scope" $muted>
          <S.GridContainer $flush>
            <F.ModuleBandHead id="overview">
              <div data-reveal="true">
                <S.Eyebrow>제공 범위 및 검증 기준</S.Eyebrow>
                <S.DisplayHeading>
                  검증을 마친 전국 도시철도 기준과 노선 데이터를 제공합니다
                </S.DisplayHeading>
              </div>
              <S.IntroAside data-reveal="true" data-reveal-delay="80">
                공공데이터와 현장 실측을 바탕으로 수도권과 광역시 주요 노선의 이동편의시설 정보를
                선별하여 반영합니다.
              </S.IntroAside>
            </F.ModuleBandHead>

            <EasySubwayTechSpecGrid />

            <Scope.DirectoryContainer>
              <EasySubwayMetroDirectory />
            </Scope.DirectoryContainer>
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand>
          <S.GridContainer>
            <Scope.ClosingGrid data-reveal="true">
              <div>
                <S.Eyebrow>출시 및 협업 안내</S.Eyebrow>
                <S.DisplayHeading>출시 소식과 협업 문의</S.DisplayHeading>
                <S.IntroAside>
                  {PRODUCT_RELEASE_STATUS}입니다. 공개 다운로드가 열리면 이 페이지에서 안내합니다.
                  데이터 검증과 기술 협업 문의도 같은 주소로 받습니다.
                </S.IntroAside>
                <Scope.ContactActionGroup>
                  <S.ButtonAction href={CONTACT_MAILTO}>
                    <span>서비스 문의하기</span>
                    <ArrowRightGlyph size={15} />
                  </S.ButtonAction>
                  <EasySubwayCopyEmailButton status={copyStatus} onClick={handleCopyEmail} />
                </Scope.ContactActionGroup>
              </div>
              <Scope.ProofCard>
                <div className="proofTop">
                  <div>
                    <div className="proofTitle">{PRODUCT_SURFACE.name}</div>
                    <div className="proofSubtitle">{PRODUCT_SURFACE.contactEmail}</div>
                  </div>
                  <span className="proofBadge">{PRODUCT_RELEASE_STATUS}</span>
                </div>
                <p className="proofDesc">
                  회원가입·결제·위치 추적 없이 교통약자 우선 무장애 지하철 이동 경로를 안내합니다.
                </p>
                <dl className="proofStats">
                  <div>
                    <dt>연동 노선</dt>
                    <dd>20개 노선</dd>
                  </div>
                  <div>
                    <dt>이용 비용</dt>
                    <dd>무료 · 무추적</dd>
                  </div>
                </dl>
              </Scope.ProofCard>
            </Scope.ClosingGrid>
          </S.GridContainer>
        </S.GridBand>
      </main>

      <S.SurfaceFooter>
        <S.FooterInner>
          <S.FooterBrand>
            <strong>{PRODUCT_SURFACE.name}</strong>
            <span>교통약자를 먼저 생각한 지하철 길찾기</span>
          </S.FooterBrand>
          <S.FooterLinks aria-label="제품 관련 링크">
            <h2>연결 표면</h2>
            {PRODUCT_FOOTER_LINKS.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </S.FooterLinks>
          <S.FooterMeta>
            <h2>문의</h2>
            <span>{PRODUCT_SURFACE.contactEmail}</span>
          </S.FooterMeta>
        </S.FooterInner>
        <S.FooterBottomBar>
          <span>© {CONFIG.since} {COMPANY_SURFACE.name}</span>
          <span>{PRODUCT_SURFACE.name}</span>
        </S.FooterBottomBar>
      </S.SurfaceFooter>
    </S.ProductSurface>
  )
}

export default EasySubwayPageView
