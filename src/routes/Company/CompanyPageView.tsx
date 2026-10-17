/* eslint-disable @next/next/no-img-element */
import { CONFIG } from "site.config"
import BrandMark from "src/components/branding/BrandMark"
import CompanyFeatureCarousel from "src/routes/Company/CompanyFeatureCarousel"
import CompanyHeroParticles from "src/routes/Company/CompanyHeroParticles"
import CompanyIcon from "src/routes/Company/CompanyIcon"
import {
  BLOG_URL,
  COMPANY_FOOTER_LINK_GROUPS,
  COMPANY_NOTICE,
  COMPANY_PRINCIPLES,
  COMPANY_PRODUCT_SHOWCASES,
  COMPANY_RELIABILITY_ITEMS,
  COMPANY_STATS,
  COMPANY_SURFACE,
  CONTACT_MAILTO,
  PRODUCT_SCREENSHOT,
  PRODUCT_SCREENSHOT_ALT,
  PRODUCT_SCREENSHOT_SIZE,
  PRODUCT_URL,
  type CompanyNewsItem,
} from "src/routes/Company/CompanyPageModel"
import * as S from "src/routes/Company/CompanyPage.styles"
import * as Sec from "src/routes/Company/CompanySection.styles"
import { useCompanySurfaceMotion } from "src/routes/Company/useCompanySurfaceMotion"

type Props = {
  news: CompanyNewsItem[]
  surfaceUrl: string
}

const NEWS_SECTION_ID = "news"

const NAV_ITEMS = [
  { id: "product", label: "제품", href: PRODUCT_URL },
  { id: "capabilities", label: "역량", href: "#capabilities" },
  { id: NEWS_SECTION_ID, label: "소식", href: `#${NEWS_SECTION_ID}` },
  { id: "blog", label: "기술 블로그", href: BLOG_URL },
] as const

const visibleNavItems = (hasNews: boolean) =>
  NAV_ITEMS.filter((item) => item.id !== NEWS_SECTION_ID || hasNews)

const ArrowRightGlyph: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CompanyPageView: React.FC<Props> = ({ news, surfaceUrl }) => {
  const surfaceRef = useCompanySurfaceMotion<HTMLDivElement>()

  return (
    <S.CompanySurface ref={surfaceRef}>
      <S.NoticeBanner>
        <a href={COMPANY_NOTICE.href}>
          <span className="noticeBadge" aria-hidden="true">
            NEW
          </span>
          <span>{COMPANY_NOTICE.label}</span>
          <span className="noticeArrow" aria-hidden="true">
            <ArrowRightGlyph size={14} />
          </span>
        </a>
      </S.NoticeBanner>

      <S.SurfaceHeader data-header data-scroll-reactive="true">
        <S.BrandLink href={surfaceUrl} aria-current="page">
          <BrandMark priority />
          {COMPANY_SURFACE.name}
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
          <ArrowRightGlyph size={15} />
        </S.HeaderAction>
      </S.SurfaceHeader>

      <main>
        <S.Hero>
          <CompanyHeroParticles />
          <S.HeroCopy data-reveal data-reveal-group="hero">
            <S.HeroEyebrowPill aria-hidden="true">
              <span className="pulseDot" />
              <span>AQUILA SOFTWARE · PLATFORM &amp; MOBILITY</span>
            </S.HeroEyebrowPill>
            <S.HeroTitle>
              이동의 <S.HeroAccent>문턱</S.HeroAccent>을 낮추는
              <br />
              소프트웨어를 만듭니다
              <S.HeroCursorBlock data-cursor-container aria-hidden="true" />
            </S.HeroTitle>
            <S.HeroLead>
              교통약자가 먼저 쓸 수 있는 길찾기부터 만듭니다. 검증한 데이터와 직접 운영하는 인프라 위에
              제품을 올립니다.
            </S.HeroLead>
            <S.HeroActions>
              <S.PillAction href={PRODUCT_URL}>
                <span>EasySubway 살펴보기</span>
                <ArrowRightGlyph size={16} />
              </S.PillAction>
              <S.SecondaryPillAction href="#capabilities">
                핵심 역량 둘러보기
              </S.SecondaryPillAction>
            </S.HeroActions>
          </S.HeroCopy>
          <S.HeroShowcase data-reveal data-reveal-group="hero">
            <S.HeroFloatingPill $position="left" aria-hidden="true">
              <span className="pillTag">ROUTE</span>
              <span>단차 0cm 무장애 동선</span>
            </S.HeroFloatingPill>
            <S.HeroPhoneFrame>
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
                  data-ui="company-hero-phone"
                />
              </picture>
            </S.HeroPhoneFrame>
            <S.HeroFloatingPill $position="right" aria-hidden="true">
              <span className="pillTag">INFRA</span>
              <span>Blue-Green 무중단 운영</span>
            </S.HeroFloatingPill>
          </S.HeroShowcase>
        </S.Hero>

        <S.Section id="capabilities">
          <S.SectionInner>
            <Sec.CarouselHead data-reveal data-reveal-group="capabilities-head">
              <div>
                <S.SectionLabel>핵심 역량</S.SectionLabel>
                <S.SectionHeading>제품에 실제로 들어간 판단</S.SectionHeading>
              </div>
              <S.SectionAside>
                사용자의 실제 이용 경험과 이동 안전에 초점을 맞춰 구현했습니다.
              </S.SectionAside>
            </Sec.CarouselHead>
            <CompanyFeatureCarousel />
          </S.SectionInner>
        </S.Section>

        <S.Section id="work" $tone="scaffold">
          <S.SectionInner>
            <Sec.WorkHeading data-reveal data-reveal-group="work-head">
              회사가 지금 만들고 운영하는 것
            </Sec.WorkHeading>
            <Sec.ProductShowcaseGrid>
              {COMPANY_PRODUCT_SHOWCASES.map((product) => (
                <Sec.ProductShowcaseCard
                  key={product.id}
                  data-reveal
                  data-reveal-group="work-cards"
                >
                  <Sec.ProductShowcaseMedia $layout={product.id === "easysubway" ? "phone" : "desktop"}>
                    <picture>
                      {product.image.src.endsWith(".png") ? (
                        <source
                          srcSet={product.image.src.replace(/\.png$/, ".webp")}
                          type="image/webp"
                        />
                      ) : null}
                      <img
                        src={product.image.src}
                        alt={product.image.alt}
                        width={product.image.width}
                        height={product.image.height}
                        loading="lazy"
                        decoding="async"
                        data-ui={`company-showcase-${product.id}`}
                      />
                    </picture>
                  </Sec.ProductShowcaseMedia>
                  <Sec.ProductShowcaseContent>
                    <Sec.ProductBadge>{product.badge}</Sec.ProductBadge>
                    <h3>{product.title}</h3>
                    <p className="summary">{product.summary}</p>
                    <p className="description">{product.description}</p>
                    <Sec.ProductHighlightList>
                      {product.highlights.map((item) => (
                        <li key={item}>
                          <CompanyIcon name="check" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </Sec.ProductHighlightList>
                    <Sec.ProductAction href={product.action.href}>
                      <span>{product.action.label}</span>
                      <ArrowRightGlyph size={16} />
                    </Sec.ProductAction>
                  </Sec.ProductShowcaseContent>
                </Sec.ProductShowcaseCard>
              ))}
            </Sec.ProductShowcaseGrid>

            <Sec.ReliabilityBlock data-reveal data-reveal-group="work-reliability">
              <Sec.ReliabilityHeader>
                <S.SectionLabel>기술 신뢰성 &amp; 운영 원칙</S.SectionLabel>
                <h3>제품의 안정성을 뒷받침하는 기술적 토대</h3>
                <p>화려한 설명 대신 실제 시스템과 검증 파이프라인으로 약속을 지킵니다.</p>
              </Sec.ReliabilityHeader>
              <Sec.ReliabilityList role="list" data-ui="company-reliability-list">
                {COMPANY_RELIABILITY_ITEMS.map((item) => (
                  <Sec.ReliabilityItem key={item.id}>
                    <span className="tag">{item.tag}</span>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </Sec.ReliabilityItem>
                ))}
              </Sec.ReliabilityList>
            </Sec.ReliabilityBlock>
          </S.SectionInner>
        </S.Section>

        <S.Section id="approach">
          <S.SectionInner>
            <Sec.StoryLayout data-reveal data-reveal-group="approach-story">
              <div>
                <S.SectionLabel>회사 소개</S.SectionLabel>
                <Sec.StoryHeadline>
                  작은 팀이
                  <strong>끝까지 봅니다</strong>
                </Sec.StoryHeadline>
              </div>
              <S.SectionAside>
                기획부터 개발, 인프라 운영까지 유기적으로 연결하여 사용자의 목소리를 빠르게 제품에
                반영합니다.
              </S.SectionAside>
            </Sec.StoryLayout>
            <Sec.StatList data-reveal data-reveal-group="approach-stats">
              {COMPANY_STATS.map((stat) => (
                <div key={stat.id}>
                  <dt>{stat.value}</dt>
                  <dd>{stat.label}</dd>
                </div>
              ))}
            </Sec.StatList>
          </S.SectionInner>
        </S.Section>

        <S.Section $tone="chrome">
          <S.SectionInner data-reveal data-reveal-group="principles">
            <S.SectionLabel>일하는 방식</S.SectionLabel>
            <S.SectionHeading>먼저 확인하고, 그다음 공개합니다</S.SectionHeading>
            <Sec.PrincipleList>
              {COMPANY_PRINCIPLES.map((principle) => (
                <li key={principle}>
                  <span>
                    <CompanyIcon name="check" />
                  </span>
                  {principle}
                </li>
              ))}
            </Sec.PrincipleList>
          </S.SectionInner>
        </S.Section>

        {news.length > 0 ? (
          <S.Section id={NEWS_SECTION_ID}>
            <S.SectionInner>
              <Sec.NewsHead data-reveal data-reveal-group="news-head">
                <div>
                  <S.SectionLabel>소식</S.SectionLabel>
                  <S.SectionHeading>만들면서 남긴 기록</S.SectionHeading>
                </div>
                <Sec.NewsHeaderAction href={BLOG_URL}>
                  <span>기술 블로그 전체 보기</span>
                  <ArrowRightGlyph size={16} />
                </Sec.NewsHeaderAction>
              </Sec.NewsHead>
              <Sec.NewsGrid>
                {news.map((item) => (
                  <li key={item.id} data-reveal data-reveal-group="news-cards">
                    <Sec.NewsCard href={item.href}>
                      {item.thumbnail?.trim() ? (
                        <Sec.NewsMedia data-ui="company-news-media">
                          <img src={item.thumbnail} alt="" loading="lazy" decoding="async" />
                        </Sec.NewsMedia>
                      ) : null}
                      <Sec.NewsMeta>
                        <Sec.NewsIndex aria-hidden="true">{item.index}</Sec.NewsIndex>
                        {item.date ? (
                          <time dateTime={item.date.replace(/\./g, "-")}>{item.date}</time>
                        ) : null}
                      </Sec.NewsMeta>
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                      <Sec.NewsAction aria-hidden="true" data-ui="company-news-action">
                        <span>글 읽기</span>
                        <ArrowRightGlyph size={14} />
                      </Sec.NewsAction>
                    </Sec.NewsCard>
                  </li>
                ))}
              </Sec.NewsGrid>
            </S.SectionInner>
          </S.Section>
        ) : null}

        <S.Section>
          <Sec.ContactBand data-reveal data-reveal-group="contact-band">
            <div>
              <h2>함께 만들 이야기가 있다면</h2>
              <p>제품 협업, 데이터 검증, 기술 문의를 이메일로 받습니다.</p>
            </div>
            <S.PillAction href={CONTACT_MAILTO}>
              <span>이메일로 문의하기</span>
              <ArrowRightGlyph size={16} />
            </S.PillAction>
          </Sec.ContactBand>
        </S.Section>
      </main>

      <S.SurfaceFooter>
        <S.FooterInner>
          <S.FooterBrand>
            <div>
              <BrandMark />
              {COMPANY_SURFACE.name}
            </div>
            <p>이동의 문턱을 낮추는 소프트웨어를 만듭니다.</p>
            <small>
              © {CONFIG.since} {COMPANY_SURFACE.name}
            </small>
          </S.FooterBrand>
          {COMPANY_FOOTER_LINK_GROUPS.map((group) => (
            <S.FooterGroup key={group.id} aria-labelledby={`company-footer-${group.id}`}>
              <h2 id={`company-footer-${group.id}`}>{group.title}</h2>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </S.FooterGroup>
          ))}
        </S.FooterInner>
      </S.SurfaceFooter>
    </S.CompanySurface>
  )
}

export default CompanyPageView
