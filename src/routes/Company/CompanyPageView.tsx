/* eslint-disable @next/next/no-img-element */
import { CONFIG } from "site.config"
import BrandMark, { ArrowRightGlyph } from "src/components/branding/BrandMark"
import { marketingLight as light } from "src/design-system/marketingPalette"
import { CompanyCapabilityOrbWave } from "src/routes/Company/CompanyCapabilityVisuals"
import CompanyFeatureCarousel from "src/routes/Company/CompanyFeatureCarousel"
import CompanyHeroParticles from "src/routes/Company/CompanyHeroParticles"
import { CheckGlyph, SparklesGlyph } from "src/routes/Company/CompanyIcons"
import {
  BLOG_URL,
  COMPANY_FOOTER_LINK_GROUPS,
  COMPANY_NOTICE,
  COMPANY_PRINCIPLES,
  COMPANY_PRODUCT_SHOWCASES,
  COMPANY_STATS,
  COMPANY_SURFACE,
  CONTACT_MAILTO,
  type CompanyNewsItem,
} from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanyPage.styles"
import * as Sec from "src/routes/Company/CompanySection.styles"
import * as News from "src/routes/Company/CompanyNews.styles"
import { useCompanySurfaceMotion } from "src/routes/Company/useCompanySurfaceMotion"

type Props = {
  news: CompanyNewsItem[]
  surfaceUrl: string
}

const NEWS_SECTION_ID = "news"

const NAV_ITEMS = [
  { id: "product", label: "제품", href: "#work" },
  { id: "capabilities", label: "역량", href: "#capabilities" },
  { id: NEWS_SECTION_ID, label: "소식", href: `#${NEWS_SECTION_ID}` },
  { id: "blog", label: "기술 블로그", href: BLOG_URL },
] as const

const OPS_ITEMS = [
  "홈서버·클라우드 기반 무중단 배포 및 실시간 헬스체크 관제",
  "접근성·번들 예산·디자인 토큰·SSRF 자동 CI 검증 게이트",
  "격리 샌드박스 실행과 입력 바이트·해상도 상한 검증",
  "가입 없이 바로 시작하는 웹·앱 경험과 처리 후 파일 자동 삭제",
] as const

const CompanyAndroidFrame: React.FC<{
  src: string
  alt: string
  width: number
  height: number
}> = ({ src, alt, width, height }) => (
  <Sec.AndroidFrameWrap>
    <div className="androidDeviceShell">
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
      <picture className="androidScreenBezel">
        <source srcSet={src.replace(/\.png$/, ".webp")} type="image/webp" />
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          data-ui="company-showcase-easysubway"
        />
      </picture>
    </div>
  </Sec.AndroidFrameWrap>
)

const FooterWordmarkSvg: React.FC = () => (
  <Sec.FooterWordmarkBanner aria-hidden="true">
    <svg viewBox="0 0 1120 154" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="560"
        y="126"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="148"
        fontWeight="700"
        letterSpacing="-5.5"
      >
        Aquila Software
      </text>
    </svg>
  </Sec.FooterWordmarkBanner>
)

const visibleNavItems = (hasNews: boolean) =>
  NAV_ITEMS.filter((item) => item.id !== NEWS_SECTION_ID || hasNews)

const CompanyPageView: React.FC<Props> = ({ news, surfaceUrl }) => {
  const surfaceRef = useCompanySurfaceMotion<HTMLDivElement>()

  return (
    <S.CompanySurface ref={surfaceRef}>
      <S.SurfaceHeader data-header data-scroll-reactive="true">
        <S.HeaderInner>
          <S.BrandLink href={surfaceUrl} aria-current="page" style={{ minHeight: 44 }}>
            <BrandMark priority />
            <span>{COMPANY_SURFACE.name}</span>
          </S.BrandLink>
          <S.SurfaceNav aria-label="회사 소개 둘러보기">
            {visibleNavItems(news.length > 0).map((item) => (
              <S.NavLink key={item.id} href={item.href}>
                {item.label}
              </S.NavLink>
            ))}
          </S.SurfaceNav>
          <S.HeaderAction href={CONTACT_MAILTO}>
            <span>문의하기</span>
            <ArrowRightGlyph size={14} />
          </S.HeaderAction>
        </S.HeaderInner>
      </S.SurfaceHeader>

      <main>
        <S.GridBand>
          <S.GridContainer $flush>
            <S.HeroWash>
              <CompanyHeroParticles />
              <S.HeroCopy data-reveal data-reveal-group="hero">
                <S.NoticePill href={COMPANY_NOTICE.href}>
                  <span className="noticeBadge">
                    <SparklesGlyph size={12} />
                    <span>{COMPANY_NOTICE.badge}</span>
                  </span>
                  <span className="noticeText">{COMPANY_NOTICE.label}</span>
                  <ArrowRightGlyph size={13} />
                </S.NoticePill>
                <S.HeroTitle>
                  일상의 문턱을 낮추는
                  <span>소프트웨어를 만듭니다</span>
                </S.HeroTitle>
                <S.HeroLead>
                  무장애 지하철 길찾기, 오프라인 올인원 오피스, 308개 포맷 파일 변환 웹·API까지 직접 설계하고
                  운영하는 인프라 위에 제품을 올립니다.
                </S.HeroLead>
                <S.HeroActions>
                  <S.PrimaryCta href="#work">
                    <span>운영 중인 제품 보기</span>
                    <ArrowRightGlyph size={15} />
                  </S.PrimaryCta>
                  <S.SecondaryCta href="#capabilities">
                    핵심 역량 둘러보기
                  </S.SecondaryCta>
                </S.HeroActions>
              </S.HeroCopy>
            </S.HeroWash>
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand id="approach">
          <S.GridContainer>
            <Sec.StatsGrid data-reveal="true" data-reveal-group="approach-stats">
              {COMPANY_STATS.map((stat, idx) => (
                <Sec.StatCell key={stat.id}>
                  <dt>
                    <span className="statEyebrow">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="statValue">{stat.value}</span>
                  </dt>
                  <dd>{stat.label}</dd>
                </Sec.StatCell>
              ))}
            </Sec.StatsGrid>
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand id="work">
          <S.GridContainer>
            <Sec.ShowcaseHead data-reveal data-reveal-group="work-head">
              <S.SectionEyebrow>운영 중인 제품</S.SectionEyebrow>
              <S.SectionHeading>회사가 지금 만들고 운영하는 것</S.SectionHeading>
              <S.SectionLead>
                모바일 앱, 크로스플랫폼 데스크탑 오피스, 대용량 웹·API 파이프라인과 기술 저널을 자체 표준으로 구축합니다.
              </S.SectionLead>
            </Sec.ShowcaseHead>
            <Sec.ShowcaseStack>
              {COMPANY_PRODUCT_SHOWCASES.map((product) => (
                <Sec.ShowcaseRow key={product.id} data-reveal data-reveal-group="work-cards">
                  <Sec.ShowcaseCopy>
                    <span className="paneBadge">{product.badge}</span>
                    <h3>{product.title}</h3>
                    <p className="paneSummary">{product.summary}</p>
                    <p className="paneDescription">{product.description}</p>
                    <Sec.ShowcaseSpecList aria-label={`${product.title} 주요 사양`}>
                      {product.specs.map((spec) => (
                        <li key={spec}>{spec}</li>
                      ))}
                    </Sec.ShowcaseSpecList>
                    <Sec.ShowcaseActionPill href={product.action.href}>
                      <span>{product.action.label}</span>
                      <ArrowRightGlyph size={15} />
                    </Sec.ShowcaseActionPill>
                  </Sec.ShowcaseCopy>
                  <Sec.ShowcaseStage $tone={product.stageTone} data-spotlight="true">
                    {product.frame.kind === "android" ? (
                      <CompanyAndroidFrame
                        src={product.image.src}
                        alt={product.image.alt}
                        width={product.image.width}
                        height={product.image.height}
                      />
                    ) : (
                      <Sec.BrowserFrame>
                        <div className="browserChrome" aria-hidden="true">
                          <div className="chromeDots">
                            <span />
                            <span />
                            <span />
                          </div>
                          <span className="chromeHost">{product.frame.chromeLabel}</span>
                        </div>
                        <img
                          src={product.image.src}
                          alt={product.image.alt}
                          width={product.image.width}
                          height={product.image.height}
                          loading="lazy"
                          decoding="async"
                          data-ui={`company-showcase-${product.id}`}
                        />
                      </Sec.BrowserFrame>
                    )}
                  </Sec.ShowcaseStage>
                </Sec.ShowcaseRow>
              ))}
            </Sec.ShowcaseStack>
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand id="capabilities" $muted>
          <S.GridContainer>
            <CompanyCapabilityOrbWave />
            <Sec.SplitHeader data-reveal data-reveal-group="capabilities-head">
              <div>
                <S.SectionEyebrow>핵심 역량</S.SectionEyebrow>
                <S.SectionHeading>제품에 실제로 들어간 판단</S.SectionHeading>
              </div>
              <p>모빌리티 앱, 오프라인 데스크탑 오피스, 대용량 파일 변환 엔진과 기술 블로그를 직접 개발하고 운영합니다.</p>
            </Sec.SplitHeader>
            <CompanyFeatureCarousel />
          </S.GridContainer>
        </S.GridBand>

        <S.GridBand>
          <S.GridContainer>
            <Sec.CenteredHeader data-reveal data-reveal-group="principles">
              <S.SectionEyebrow>일하는 방식</S.SectionEyebrow>
              <S.SectionHeading>먼저 확인한 뒤 공개합니다</S.SectionHeading>
              <S.SectionLead>기획, 엔진 구현, 인프라 운영을 직접 맡아 현장의 불편을 제품에서 바로 고칩니다.</S.SectionLead>
            </Sec.CenteredHeader>
            <Sec.ComparisonGrid>
              <Sec.ComparisonCard $highlighted data-spotlight="true">
                <div className="cardTop">
                  <h3>엔지니어링 원칙</h3>
                  <span className="cardTag">Core Standard</span>
                </div>
                <ul>
                  {COMPANY_PRINCIPLES.map((principle) => (
                    <li key={principle}>
                      <span className="itemIcon">
                        <CheckGlyph />
                      </span>
                      <span>{principle}</span>
                    </li>
                  ))}
                </ul>
              </Sec.ComparisonCard>
              <Sec.ComparisonCard data-spotlight="true">
                <div className="cardTop">
                  <h3>인프라 및 검증</h3>
                  <span className="cardTag">Operations</span>
                </div>
                <ul>
                  {OPS_ITEMS.map((item) => (
                    <li key={item}>
                      <span className="itemIcon">
                        <CheckGlyph />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Sec.ComparisonCard>
            </Sec.ComparisonGrid>
          </S.GridContainer>
        </S.GridBand>

        {news.length > 0 ? (
          <S.GridBand id={NEWS_SECTION_ID} $muted>
            <S.GridContainer>
              <News.NewsHead data-reveal data-reveal-group="news-head">
                <div>
                  <S.SectionEyebrow>소식</S.SectionEyebrow>
                  <S.SectionHeading>만들면서 남긴 기록</S.SectionHeading>
                </div>
                <News.NewsHeaderAction href={BLOG_URL}>
                  <span>기술 블로그 전체 보기</span>
                  <ArrowRightGlyph size={15} />
                </News.NewsHeaderAction>
              </News.NewsHead>
              <News.NewsGrid>
                {news.map((item) => (
                  <li key={item.id} data-reveal data-reveal-group="news-cards">
                    <News.NewsCard href={item.href}>
                      {item.thumbnail?.trim() ? (
                        <News.NewsMedia data-ui="company-news-media">
                          <img src={item.thumbnail} alt="" loading="lazy" decoding="async" />
                        </News.NewsMedia>
                      ) : null}
                      <News.NewsMeta>
                        <News.NewsIndex aria-hidden="true">{item.index}</News.NewsIndex>
                        {item.date ? (
                          <time dateTime={item.date.replace(/\./g, "-")}>{item.date}</time>
                        ) : null}
                      </News.NewsMeta>
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                      <News.NewsAction aria-hidden="true" data-ui="company-news-action">
                        <span>글 읽기</span>
                        <ArrowRightGlyph size={14} />
                      </News.NewsAction>
                    </News.NewsCard>
                  </li>
                ))}
              </News.NewsGrid>
            </S.GridContainer>
          </S.GridBand>
        ) : null}

        <S.GridBand>
          <S.GridContainer>
            <Sec.DarkClosingCard data-reveal data-reveal-group="contact-band">
              <div>
                <p className="closingEyebrow">협업 및 문의</p>
                <h2>함께 만들 이야기가 있다면</h2>
                <p className="closingLead">제품 협업, 데이터 검증, 기술 문의를 이메일로 받습니다.</p>
                <S.HeroActions style={{ justifyContent: "flex-start" }}>
                  <Sec.InversePrimaryPill href={CONTACT_MAILTO}>
                    <span>이메일로 문의하기</span>
                    <ArrowRightGlyph size={15} />
                  </Sec.InversePrimaryPill>
                  <Sec.InverseSecondaryPill href={BLOG_URL}>기술 블로그 읽기</Sec.InverseSecondaryPill>
                </S.HeroActions>
              </div>
              <Sec.DarkProofCard>
                <div className="proofTop">
                  <div className="proofIdentity">
                    <BrandMark />
                    <div>
                      <div className="proofTitle">{COMPANY_SURFACE.name}</div>
                      <div className="proofSubtitle">{COMPANY_SURFACE.contactEmail}</div>
                    </div>
                  </div>
                  <span className="proofBadge">Public</span>
                </div>
                <p className="proofDesc">
                  작은 팀이 끝까지 검증하고 운영하는 공개 소프트웨어 제품과 엔지니어링 기록을 제공합니다.
                </p>
                <dl className="proofStats">
                  <div>
                    <dt>운영 서비스</dt>
                    <dd>4개 서비스</dd>
                  </div>
                  <div>
                    <dt>데이터 보호</dt>
                    <dd>로컬 · 자동 삭제</dd>
                  </div>
                </dl>
                <div className="proofFoot">
                  <span>Blue-Green Infrastructure</span>
                  <span>Seoul</span>
                </div>
              </Sec.DarkProofCard>
            </Sec.DarkClosingCard>
          </S.GridContainer>
        </S.GridBand>
      </main>

      <S.SurfaceFooter>
        <S.FooterInner>
          <S.FooterBrand>
            <div>
              <BrandMark />
              <span>{COMPANY_SURFACE.name}</span>
            </div>
            <p>일상의 문턱을 낮추는 소프트웨어를 만듭니다.</p>
          </S.FooterBrand>
          {COMPANY_FOOTER_LINK_GROUPS.map((group) => (
            <S.FooterGroup as="nav" key={group.id} aria-label={group.title}>
              <h2>{group.title}</h2>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </S.FooterGroup>
          ))}
        </S.FooterInner>
        <FooterWordmarkSvg />
        <S.FooterBottomBar>
          <span>© {CONFIG.since} {COMPANY_SURFACE.name}</span>
          <span>EasySubway · EasyOffice · EasyConvert · AquilaLog</span>
        </S.FooterBottomBar>
      </S.SurfaceFooter>
    </S.CompanySurface>
  )
}

export default CompanyPageView
