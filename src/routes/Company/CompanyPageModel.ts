import { CONFIG } from "site.config"

export const COMPANY_SURFACE = CONFIG.surfaces.company
export const PRODUCT_SURFACE = CONFIG.surfaces.product
export const PRODUCT_SCREENSHOT = PRODUCT_SURFACE.screenshot.src
export const PRODUCT_SCREENSHOT_ALT = PRODUCT_SURFACE.screenshot.alt

/** 블로그는 별개의 canonical 표면이라 회사 표면에서는 절대 URL로 나간다. */
export const BLOG_URL = CONFIG.link
export const CONTACT_MAILTO = `mailto:${COMPANY_SURFACE.contactEmail}`

/**
 * 제품 표면 링크도 절대 URL이다.
 *
 * 제품은 자기 canonical 호스트를 가진 별개의 공개 표면이고, 회사 사이트의 내비는 그 호스트를
 * 가리켜야 한다 - 상대 경로로 두면 회사 호스트가 제품 URL을 자기 경로로 광고한다. 대가로 이 링크는
 * 제품 호스트 DNS가 붙기 전까지 도달하지 않는다(오너 승인된 컷오버 게이트 이후 유효).
 */
export const PRODUCT_URL = PRODUCT_SURFACE.url

export type CompanyNoticeLink = {
  label: string
  href: string
}

export type CompanyFeatureCard = {
  id: string
  tag: string
  title: string
  body: string
}

export type CompanyStat = {
  id: string
  value: string
  label: string
}

export type CompanyNewsItem = {
  id: string
  index: string
  title: string
  summary: string
  date: string
  href: string
  thumbnail: string
}

export const COMPANY_NOTICE: CompanyNoticeLink = {
  label: `EasySubway ${PRODUCT_SURFACE.releaseStatus} · 제품 소개 보기`,
  href: PRODUCT_URL,
}

/**
 * 프로덕트 쇼케이스 내 블로그 비주얼.
 *
 * 라이브 공개 블로그(`CONFIG.link`) 홈 화면을 1920x733 비율로 캡처한 정적 자산이며,
 * 상단 내비게이션·주제별 태그 목차·검색창과 최근 글 목록 상단을 담는다.
 */
export const BLOG_CAPTURE = "/company/blog-home.webp"
export const BLOG_CAPTURE_ALT =
  "AquilaLog 기술 블로그 홈 화면. 상단 내비게이션과 좌측 주제별 태그 목차, 검색창과 최근 기술 글 목록이 보인다."
export const BLOG_CAPTURE_SIZE = { width: 1920, height: 733 } as const

/**
 * 공개할 수 있는 제품 실기기 검수본은 이 한 장이다. 같은 랜딩 자산의 다른 컷은 개발용 광고
 * 자리표시가 찍혀 있어 공개 페이지에 쓸 수 없다. 회사 표면에서는 히어로 카드 위 작은 폰으로
 * 한 번만 쓴다 - 같은 이미지를 여러 섹션에 반복하지 않는다.
 */
export const PRODUCT_SCREENSHOT_SIZE = {
  width: PRODUCT_SURFACE.screenshot.width,
  height: PRODUCT_SURFACE.screenshot.height,
} as const

export type CompanyProductShowcase = {
  id: "easysubway" | "aquilalog"
  badge: string
  title: string
  summary: string
  description: string
  image: {
    src: string
    alt: string
    width: number
    height: number
  }
  action: {
    label: string
    href: string
  }
}

export const COMPANY_PRODUCT_SHOWCASES: CompanyProductShowcase[] = [
  {
    id: "easysubway",
    badge: "대중교통 길찾기 앱",
    title: "EasySubway",
    summary: "교통약자의 이동 문턱을 낮추는 지하철 경로 안내",
    description:
      "휠체어·유모차 이용자와 어르신이 계단 없이 이동할 수 있도록 엘리베이터 중심 경로와 승차 위치를 안내합니다.",
    image: {
      src: PRODUCT_SCREENSHOT,
      alt: PRODUCT_SCREENSHOT_ALT,
      width: PRODUCT_SCREENSHOT_SIZE.width,
      height: PRODUCT_SCREENSHOT_SIZE.height,
    },
    action: {
      label: "EasySubway 살펴보기",
      href: PRODUCT_URL,
    },
  },
  {
    id: "aquilalog",
    badge: "엔지니어링 & 테크 블로그",
    title: "AquilaLog",
    summary: "시스템 설계와 운영 과정을 기록하는 기술 블로그",
    description:
      "백엔드 설계, 홈서버 블루그린 배포, 공공데이터 검증 과정을 기록합니다.",
    image: {
      src: BLOG_CAPTURE,
      alt: BLOG_CAPTURE_ALT,
      width: BLOG_CAPTURE_SIZE.width,
      height: BLOG_CAPTURE_SIZE.height,
    },
    action: {
      label: "AquilaLog 기술 블로그 읽기",
      href: BLOG_URL,
    },
  },
]

export const COMPANY_FEATURE_CARDS: CompanyFeatureCard[] = [
  {
    id: "accessibility",
    tag: "ACCESSIBILITY",
    title: "계단과 환승 동선을 먼저 계산합니다",
    body: "엘리베이터와 완만한 환승 경로를 기본값으로 탐색하여 휠체어와 유모차도 이동할 수 있습니다.",
  },
  {
    id: "route-ui",
    tag: "ROUTE UI",
    title: "노선도 한 화면에서 바로 길을 찾습니다",
    body: "역을 터치해 출발·경유·도착지를 바로 지정하고 노선도 한 화면에서 탐색합니다.",
  },
  {
    id: "data-integrity",
    tag: "DATA INTEGRITY",
    title: "데이터 검증으로 오류를 방지합니다",
    body: "철도 공공데이터와 실제 역사 시설을 정기적으로 대조해 출구와 편의시설 정보를 제공합니다.",
  },
  {
    id: "resilience",
    tag: "RESILIENCE",
    title: "오프라인에서도 노선도와 역 조회가 동작합니다",
    body: "통신이 불안정한 지하 환경에서도 기기 내 데이터로 노선도와 역 정보를 바로 탐색합니다.",
  },
  {
    id: "operations",
    tag: "OPERATIONS",
    title: "자체 인프라로 서비스 지속성을 지킵니다",
    body: "빌드부터 배포, 관제까지 직접 운영하는 인프라로 서비스를 유지합니다.",
  },
  {
    id: "quality",
    tag: "QUALITY GATE",
    title: "검증된 빌드만 프로덕션에 배포합니다",
    body: "웹 접근성, 렌더링 성능, 보안 기준을 자동 게이트로 통과한 빌드만 배포합니다.",
  },
]

export const COMPANY_STATS: CompanyStat[] = [
  { id: "services", value: "2개", label: "직접 운영 중인 공개 서비스 (EasySubway · AquilaLog)" },
  { id: "coverage", value: "20개 노선", label: "수도권 및 광역시 도시철도 무장애 실측 데이터 연동" },
  { id: "availability", value: "Blue-Green", label: "자체 홈서버 기반 무중단 컨테이너 배포 및 실시간 관제" },
  { id: "barrier", value: "0원", label: "회원가입·결제·위치 추적 없이 모든 기능 즉시 이용" },
]

export const COMPANY_PRINCIPLES = [
  "검증한 범위만 공개합니다",
  "모르는 것은 모른다고 표시합니다",
  "접근성을 기본값으로 둡니다",
  "배포 경로를 직접 소유합니다",
] as const

export const COMPANY_FOOTER_LINK_GROUPS = [
  {
    id: "product",
    title: "제품",
    links: [
      { label: "EasySubway", href: PRODUCT_URL },
      { label: "기술 블로그", href: BLOG_URL },
    ],
  },
  {
    id: "company",
    title: "탐색 & 문의",
    links: [
      { label: "핵심 역량", href: "#capabilities" },
      { label: "회사 소개", href: "#approach" },
      { label: "이메일 문의", href: CONTACT_MAILTO },
    ],
  },
] as const

export const toCompanyNewsSummary = (summary: string | undefined) => summary ?? ""

/**
 * 소식 썸네일 URL을 블로그 절대 도메인 기준으로 정규화한다.
 * 상대 경로인 경우 BLOG_URL(https://blog.aquilaxk.site)을 붙여 회사 호스트(www.aquilaxk.site)에서의 404를 방지한다.
 * 프로토콜 상대 경로(//)나 data/blob URL은 온전히 유지한다.
 */
export const toCompanyNewsThumbnail = (thumbnail: string | undefined): string => {
  if (!thumbnail) return ""
  const trimmed = thumbnail.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  const colonIndex = trimmed.indexOf(":")
  if (colonIndex > 0) {
    const scheme = trimmed.slice(0, colonIndex).toLowerCase()
    if (scheme === "http" || scheme === "https" || scheme === "data" || scheme === "blob") {
      return trimmed
    }
    return ""
  }
  let baseUrl = BLOG_URL
  while (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1)
  }
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  return `${baseUrl}${cleanPath}`
}

export const toCompanyNewsDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return ""
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
  const day = String(parsed.getUTCDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

export const toCompanyNewsIndex = (position: number) => String(position + 1).padStart(2, "0")
