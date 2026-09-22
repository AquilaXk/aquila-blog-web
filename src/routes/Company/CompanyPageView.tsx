/* eslint-disable @next/next/no-img-element */
import { CONFIG } from "site.config"
import BrandMark from "src/components/branding/BrandMark"
import CompanyFeatureCarousel from "src/routes/Company/CompanyFeatureCarousel"
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

/**
 * 회사 표면은 링크가 전부 정적이라 next/link 없이 일반 앵커를 쓴다. 블로그·제품·약관은 자기
 * canonical을 가진 다른 표면이라 절대 URL로 나간다.
 * 이미지도 next/image를 쓰지 않는다: 이 앱은 전부 native img이고, 랜딩 두 장을 위해 런타임 이미지
 * 최적화 경로를 새로 여는 것은 이 표면이 감당할 이유가 없는 운영 비용이다.
 *
 * 페이지의 주어는 언제나 '회사'다. 제품은 회사가 만드는 것 중 하나로만 등장하고, 기능 서술은
 * 제품 표면이 소유한다.
 */
/**
 * `surfaceUrl`은 요청 호스트로 resolve한 이 표면의 공개 URL이다(페이지의 canonical과 같은 값).
 * 브랜드 셀프 링크에 내부 라우트 `/company`를 쓰면 전용 호스트에서 robots가 disallow한 중복 경로로
 * 방문자를 보낸다 - 그 호스트의 공개 페이지는 루트다.
 */
type Props = {
  news: CompanyNewsItem[]
  surfaceUrl: string
}

/**
 * 소식 섹션은 backend가 응답하지 않거나 글이 0건이면 자리를 채우지 않고 사라진다. 내비 항목은 그
 * 조건을 그대로 따라야 한다 - 섹션 없이 링크만 남으면 '소식' 클릭이 아무 일도 하지 않는 죽은
 * anchor가 된다. 그래서 섹션 id와 내비 href가 같은 상수를 공유한다.
 */
const NEWS_SECTION_ID = "news"

const NAV_ITEMS = [
  { id: "product", label: "제품", href: PRODUCT_URL },
  { id: "capabilities", label: "역량", href: "#capabilities" },
  { id: NEWS_SECTION_ID, label: "소식", href: `#${NEWS_SECTION_ID}` },
  { id: "blog", label: "기술 블로그", href: BLOG_URL },
] as const

const visibleNavItems = (hasNews: boolean) =>
  NAV_ITEMS.filter((item) => item.id !== NEWS_SECTION_ID || hasNews)

const CompanyPageView: React.FC<Props> = ({ news, surfaceUrl }) => (
  <S.CompanySurface>
    <S.NoticeBanner>
      <a href={COMPANY_NOTICE.href}>{COMPANY_NOTICE.label}</a>
    </S.NoticeBanner>

    <S.SurfaceHeader>
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
      <S.HeaderAction href={CONTACT_MAILTO}>문의하기</S.HeaderAction>
    </S.SurfaceHeader>

    <main>
      <S.Hero>
        <S.HeroCopy>
          <S.HeroTitle>
            이동의 <S.HeroAccent>문턱</S.HeroAccent>을 낮추는
            <br />
            소프트웨어를 만듭니다
          </S.HeroTitle>
          <S.HeroLead>
            교통약자가 먼저 쓸 수 있는 길찾기부터 만듭니다. 검증한 데이터와 직접 운영하는 인프라 위에
            제품을 올립니다.
          </S.HeroLead>
          <S.PillAction href={PRODUCT_URL}>EasySubway 살펴보기</S.PillAction>
        </S.HeroCopy>
        <S.HeroShowcase>
          <S.HeroPhoneFrame>
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
          </S.HeroPhoneFrame>
        </S.HeroShowcase>
      </S.Hero>

      <S.Section id="capabilities">
        <S.SectionInner>
          <Sec.CarouselHead>
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
          <Sec.WorkHeading>회사가 지금 만들고 운영하는 것</Sec.WorkHeading>
          <Sec.ProductShowcaseGrid>
            {COMPANY_PRODUCT_SHOWCASES.map((product) => (
              <Sec.ProductShowcaseCard key={product.id}>
                <Sec.ProductShowcaseMedia $layout={product.id === "easysubway" ? "phone" : "desktop"}>
                  <img
                    src={product.image.src}
                    alt={product.image.alt}
                    width={product.image.width}
                    height={product.image.height}
                    loading="lazy"
                    decoding="async"
                    data-ui={`company-showcase-${product.id}`}
                  />
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
                    {product.action.label}
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Sec.ProductAction>
                </Sec.ProductShowcaseContent>
              </Sec.ProductShowcaseCard>
            ))}
          </Sec.ProductShowcaseGrid>

          <Sec.ReliabilityBlock>
            <Sec.ReliabilityHeader>
              <S.SectionLabel>기술 신뢰성 & 운영 원칙</S.SectionLabel>
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
          <Sec.StoryLayout>
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
          <Sec.StatList>
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
        <S.SectionInner>
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
            <S.SectionLabel>소식</S.SectionLabel>
            <S.SectionHeading>만들면서 남긴 기록</S.SectionHeading>
            <Sec.NewsGrid>
              {news.map((item) => (
                <li key={item.id}>
                  <Sec.NewsCard href={item.href}>
                    <Sec.NewsMedia>
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span aria-hidden="true">{item.index}</span>
                      )}
                    </Sec.NewsMedia>
                    {item.date ? (
                      <time dateTime={item.date.replace(/\./g, "-")}>{item.date}</time>
                    ) : null}
                    <strong>{item.title}</strong>
                    {item.summary ? <p>{item.summary}</p> : null}
                  </Sec.NewsCard>
                </li>
              ))}
            </Sec.NewsGrid>
          </S.SectionInner>
        </S.Section>
      ) : null}

      <S.Section>
        <Sec.ContactBand>
          <div>
            <h2>함께 만들 이야기가 있다면</h2>
            <p>제품 협업, 데이터 검증, 기술 문의를 이메일로 받습니다.</p>
          </div>
          <S.PillAction href={CONTACT_MAILTO}>이메일로 문의하기</S.PillAction>
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

export default CompanyPageView
