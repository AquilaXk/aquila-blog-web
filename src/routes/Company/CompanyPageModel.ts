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

/**
 * 아이콘 이름. 값은 `CompanyIcon`이 옮겨 적은 Lucide 아이콘 파일 이름 그대로다 - 이름만 보고
 * 원본을 대조할 수 있게 하려는 것이며, 의미 매핑은 각 카드·타일에 붙은 주석이 소유한다.
 */
export type CompanyIconName =
  | "accessibility"
  | "map-pinned"
  | "file-check-2"
  | "wifi-off"
  | "server"
  | "shield-check"
  | "train-front"
  | "notebook-pen"
  | "workflow"
  | "hard-drive"
  | "check"

export type CompanyNoticeLink = {
  label: string
  href: string
}

export type CompanyWordmark = {
  id: string
  label: string
}

export type CompanyFeatureCard = {
  id: string
  tag: string
  icon: CompanyIconName
  title: string
  body: string
}

export type CompanyWorkTile = {
  id: string
  label: string
  icon: CompanyIconName
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

/** 헤더 위 공지 스트립. 제품 출시 상태는 제품 모델의 단일 값을 쓴다. */
export const COMPANY_NOTICE: CompanyNoticeLink = {
  label: `EasySubway ${PRODUCT_SURFACE.releaseStatus} — 제품 소개 보기`,
  href: PRODUCT_URL,
}

/**
 * 히어로 와이드 카드의 비주얼.
 *
 * 브라우저 프레임 안의 컷은 라이브 공개 블로그(`CONFIG.link`) 홈을 1440 폭으로 캡처한 것이다.
 * 실제로 운영 중인 화면이라 자리를 채우는 껍데기가 아니며, 캡처 범위는 헤더·히어로·목차까지로
 * 잘라 글 목록의 외부 썸네일이 들어가지 않게 했다.
 */
export const BLOG_CAPTURE = "/company/blog-home.webp"
export const BLOG_CAPTURE_ALT =
  "AquilaLog 기술 블로그 홈 화면. 상단 내비게이션과 소개 헤드라인, FOCUS·UPDATED·REPOSITORY 메타 목록, 주제별 글 수 목차가 보인다."
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

/** @deprecated 모노크롬 워드마크 스트립은 슬롭 정리로 제거되었습니다. */
export const COMPANY_WORDMARKS: CompanyWordmark[] = [
  { id: "easysubway", label: "EASYSUBWAY" },
  { id: "aquilalog", label: "AQUILALOG" },
  { id: "datapack", label: "DATA PIPELINE" },
  { id: "homeserver", label: "HOMESERVER OPS" },
]

/**
 * 2대 플래그십 프로덕트 전용 쇼케이스 모델.
 * 실제 서비스 화면 캡처, 핵심 가치 설명, 서비스 바로가기 링크를 담는다.
 */
export type CompanyProductShowcase = {
  id: "easysubway" | "aquilalog"
  badge: string
  title: string
  summary: string
  description: string
  highlights: string[]
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
      "휠체어·유모차 이용자와 어르신이 겪는 계단과 환승 장벽을 최소화하는 맞춤형 경로를 최우선으로 제공합니다.",
    highlights: [
      "엘리베이터 및 완만한 환승 우선 경로 안내",
      "노선도 한 화면에서 출발·경유·도착지 원스톱 탐색",
      "철도 공공데이터 기반 실시간 역사 정보 반영",
    ],
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
    summary: "시스템 설계와 운영 경험을 투명하게 기록하는 지식 플랫폼",
    description:
      "백엔드 아키텍처, 자체 인프라 블루그린 무중단 배포, 데이터 무결성 검증 파이프라인의 엔지니어링 과정을 상세히 공유합니다.",
    highlights: [
      "실전 인프라 장애 트러블슈팅과 해결 기록",
      "자체 홈서버 독립 운영 및 무중단 배포 노하우",
      "엄격한 품질 게이트와 기술 부채 개선 과정 공유",
    ],
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

/**
 * 하단 기술 신뢰성 및 운영 원칙.
 * 내부 인프라와 품질 원칙을 제품 카드와 분리해 기술적 토대로 설명한다.
 */
export type CompanyReliabilityItem = {
  id: string
  tag: string
  title: string
  description: string
}

export const COMPANY_RELIABILITY_ITEMS: CompanyReliabilityItem[] = [
  {
    id: "pipeline",
    tag: "DATA PIPELINE",
    title: "데이터 검증 파이프라인",
    description:
      "역명, 시설물, 환승 동선 등 공공데이터 원본과 UI 표면의 일치 여부를 배포마다 자동 대조하여 데이터 정합성을 철저히 보장합니다.",
  },
  {
    id: "infrastructure",
    tag: "INFRASTRUCTURE",
    title: "자체 인프라 & 무중단 배포",
    description:
      "외부 클라우드 종속을 낮추고 직접 소유·운영하는 홈서버 환경 위에 컨테이너 기반 Blue-Green 무중단 배포와 실시간 모니터링을 가동합니다.",
  },
  {
    id: "quality",
    tag: "QUALITY GATES",
    title: "엄격한 품질 게이트",
    description:
      "웹 접근성 표준 준수, 렌더링 성능, 번들 및 리소스 예산을 사전에 자동 검증하여 결함 없는 프로덕션 릴리즈를 유지합니다.",
  },
]

/**
 * 핵심 역량 카드. 고객/이용자 지향의 가치 언어로 실제 제품 판단과 사용자 혜택을 명시한다.
 */
export const COMPANY_FEATURE_CARDS: CompanyFeatureCard[] = [
  {
    id: "accessibility",
    tag: "ACCESSIBILITY",
    icon: "accessibility",
    title: "계단과 환승 동선을 먼저 계산합니다",
    body: "엘리베이터와 완만한 환승 경로를 기본값으로 탐색하여 휠체어와 유모차도 안심하고 이동할 수 있습니다.",
  },
  {
    id: "route-ui",
    tag: "ROUTE UI",
    icon: "map-pinned",
    title: "노선도 한 화면에서 바로 길을 찾습니다",
    body: "역을 터치하는 즉시 출발·경유·도착지를 지정할 수 있어 목록과 지도를 오갈 필요 없이 직관적으로 탐색합니다.",
  },
  {
    id: "data-integrity",
    tag: "DATA INTEGRITY",
    icon: "file-check-2",
    title: "철저한 데이터 검증으로 오류를 방지합니다",
    body: "철도 공공데이터와 실제 역사 시설을 정기적으로 대조하여 어긋남 없는 정확한 출구 및 편의시설 정보를 제공합니다.",
  },
  {
    id: "resilience",
    tag: "RESILIENCE",
    icon: "wifi-off",
    title: "오프라인에서도 노선도와 역 조회가 동작합니다",
    body: "통신이 불안정한 지하 환경에서도 기기 내 데이터로 노선도와 역 정보를 즉시 탐색할 수 있습니다.",
  },
  {
    id: "operations",
    tag: "OPERATIONS",
    icon: "server",
    title: "자체 인프라로 서비스 지속성을 지킵니다",
    body: "빌드부터 배포, 관제까지 직접 통제하는 인프라를 통해 외부 환경 변화에도 흔들림 없이 서비스를 유지합니다.",
  },
  {
    id: "quality",
    tag: "QUALITY GATE",
    icon: "shield-check",
    title: "검증된 안정성만 프로덕션에 배포합니다",
    body: "웹 접근성, 렌더링 성능, 보안 기준을 자동 게이트로 엄격히 통과한 검증된 결과물만 배포합니다.",
  },
]

/** @deprecated 구 6개 타일 그리드는 2대 프로덕트 쇼케이스로 개편되었습니다. */
export const COMPANY_WORK_TILES: CompanyWorkTile[] = [
  { id: "easysubway", label: "EasySubway", icon: "train-front" },
  { id: "aquilalog", label: "AquilaLog 기술 블로그", icon: "notebook-pen" },
  { id: "pipeline", label: "데이터 검증 파이프라인", icon: "workflow" },
  { id: "homeserver", label: "자체 인프라 운영", icon: "hard-drive" },
  { id: "accessibility", label: "접근성 설계", icon: "accessibility" },
  { id: "gates", label: "품질 게이트", icon: "shield-check" },
]

/**
 * 통계 지표. 숫자인 척하는 텍스트 대신 정량 지표 중심의 간결하고 명확한 팩트 리스트로 제공한다.
 */
export const COMPANY_STATS: CompanyStat[] = [
  { id: "services", value: "2개", label: "직접 운영 중인 공개 서비스 (EasySubway · AquilaLog)" },
  { id: "coverage", value: "100%", label: "전국 도시철도 역사 데이터 정합성 검증" },
  { id: "availability", value: "100%", label: "자체 인프라 기반 무중단 Blue-Green 배포 체계" },
  { id: "barrier", value: "0원", label: "회원가입이나 결제 없이 모든 기능 즉시 이용 가능" },
]

/** 비전 체크리스트. 지킬 수 있는 문장만 남긴다. */
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
] as const

/** canonical 요약을 그대로 전달하고, 없는 값에는 별도 문구를 만들지 않는다. */
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
