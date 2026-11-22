/**
 * 참조 구현:
 * - mickasmt/next-saas-stripe-starter & launch-ui/launch-ui 랜딩 데이터 모델 (MIT License)
 */
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
export const EASYOFFICE_URL = "/download"
export const EASYOFFICE_REPO_URL = "https://github.com/AquilaXk/easyoffice"
export const EASYCONVERT_URL = "https://convert.aquilaxk.site"

export type CompanyNoticeLink = {
  badge: string
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
  badge: "신규",
  label: "EasyOffice 데스크탑 & EasyConvert 파일 변환 공개",
  href: "#work",
}

/**
 * 프로덕트 쇼케이스 내 데스크탑·웹 제품 비주얼.
 *
 * 각 제품의 실제 실행 화면을 캡처한 정적 WebP 자산이다.
 */
export const EASYOFFICE_CAPTURE = "/company/easyoffice-home.webp"
export const EASYOFFICE_CAPTURE_ALT =
  "EasyOffice 데스크탑 시작 화면. 문서, 한글 문서, 스프레드시트, 프레젠테이션, 데이터베이스, 보드, PDF 스튜디오, 포맷 변환기 실행 타일과 최근 문서 미리보기가 보인다."
export const EASYOFFICE_CAPTURE_SIZE = { width: 1600, height: 1000 } as const

export const EASYCONVERT_CAPTURE = "/company/easyconvert-home.webp"
export const EASYCONVERT_CAPTURE_ALT =
  "EasyConvert 웹 서비스 홈 화면. 상단 내비게이션과 파일 업로드 드롭존, 13개 분류 308개 형식 지원 안내가 보인다."
export const EASYCONVERT_CAPTURE_SIZE = { width: 1600, height: 900 } as const

export const BLOG_CAPTURE = "/company/blog-home.webp"
export const BLOG_CAPTURE_ALT =
  "AquilaLog 기술 블로그 홈 화면. 상단 내비게이션과 좌측 주제별 태그 목차, 검색창과 최근 기술 글 목록이 보인다."
export const BLOG_CAPTURE_SIZE = { width: 1920, height: 733 } as const

/**
 * 공개할 수 있는 제품 실기기 검수본은 이 한 장이다. 같은 랜딩 자산의 다른 컷은 개발용 광고
 * 자리표시가 찍혀 있어 공개 페이지에 쓸 수 없다. 회사 표면에서는 쇼케이스 내 폰 목업으로
 * 한 번만 쓴다 - 같은 이미지를 여러 섹션에 반복하지 않는다.
 */
export const PRODUCT_SCREENSHOT_SIZE = {
  width: PRODUCT_SURFACE.screenshot.width,
  height: PRODUCT_SURFACE.screenshot.height,
} as const

export type CompanyShowcaseFrame =
  | { kind: "android" }
  | { kind: "window"; chromeLabel: string }

export type CompanyProductShowcase = {
  id: "easysubway" | "easyoffice" | "easyconvert" | "aquilalog"
  badge: string
  title: string
  summary: string
  description: string
  specs: readonly string[]
  stageTone: "cool" | "dark" | "warm"
  frame: CompanyShowcaseFrame
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
    specs: ["20개 노선 연동", "단차 0cm 직결 경로", "오프라인 노선도"],
    stageTone: "cool",
    frame: { kind: "android" },
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
    id: "easyoffice",
    badge: "오프라인 올인원 오피스",
    title: "EasyOffice",
    summary: "문서·시트·슬라이드·PDF·한글을 한 앱에서 여는 데스크탑 오피스",
    description:
      "Rust 엔진과 Tauri 셸 위에서 DOCX·XLSX·PPTX·PDF·HWP·HWPX 편집과 데이터베이스·무한 캔버스 보드를 로컬에서 실행합니다.",
    specs: ["Rust · Tauri v2", "313종 시트 함수", "HWP · HWPX 로컬 편집"],
    stageTone: "dark",
    frame: { kind: "window", chromeLabel: "macOS · Windows · Linux" },
    image: {
      src: EASYOFFICE_CAPTURE,
      alt: EASYOFFICE_CAPTURE_ALT,
      width: EASYOFFICE_CAPTURE_SIZE.width,
      height: EASYOFFICE_CAPTURE_SIZE.height,
    },
    action: {
      label: "EasyOffice 다운로드",
      href: EASYOFFICE_URL,
    },
  },
  {
    id: "easyconvert",
    badge: "파일 변환 웹 · HTTP API",
    title: "EasyConvert",
    summary: "13개 분류 308개 포맷을 지원하는 샌드박스 파일 변환 서비스",
    description:
      "문서·한글·이미지·오디오·영상·압축·CAD 등 2,816개 변환 조합을 웹 화면과 OpenAPI 3.1 REST API로 제공하며 처리 후 파일을 자동 삭제합니다.",
    specs: ["13개 분류 · 308포맷", "2,816개 변환 조합", "OpenAPI 3.1 · 자동 삭제"],
    stageTone: "warm",
    frame: { kind: "window", chromeLabel: "convert.aquilaxk.site" },
    image: {
      src: EASYCONVERT_CAPTURE,
      alt: EASYCONVERT_CAPTURE_ALT,
      width: EASYCONVERT_CAPTURE_SIZE.width,
      height: EASYCONVERT_CAPTURE_SIZE.height,
    },
    action: {
      label: "EasyConvert 바로가기",
      href: EASYCONVERT_URL,
    },
  },
  {
    id: "aquilalog",
    badge: "엔지니어링 & 테크 블로그",
    title: "AquilaLog",
    summary: "시스템 설계와 운영 과정을 기록하는 기술 블로그",
    description:
      "백엔드 설계, 문서·변환 엔진 구현, 홈서버 블루그린 배포와 공공데이터 검증 과정을 기록합니다.",
    specs: ["시스템 아키텍처", "Blue-Green 무중단 배포", "데이터 정합성 검증"],
    stageTone: "cool",
    frame: { kind: "window", chromeLabel: "blog.aquilaxk.site" },
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
    title: "계단 없는 지하철 경로를 먼저 계산합니다",
    body: "엘리베이터 직결 동선과 완만한 환승 경로를 기본값으로 탐색해 휠체어와 유모차 이동을 돕습니다.",
  },
  {
    id: "local-engine",
    tag: "LOCAL ENGINE",
    title: "문서와 한글 파일을 기기 안에서 편집합니다",
    body: "Rust와 Tauri 기반 데스크탑 엔진이 문서·시트·슬라이드·PDF·HWP·HWPX를 외부 전송 없이 로컬에서 처리합니다.",
  },
  {
    id: "sandbox-convert",
    tag: "SANDBOX PIPELINE",
    title: "격리된 샌드박스에서 308개 포맷을 변환합니다",
    body: "작업마다 네트워크가 차단된 샌드박스를 띄워 파일을 변환하고 처리 후 원본과 결과물을 정해진 시점에 삭제합니다.",
  },
  {
    id: "resilience",
    tag: "FAIL-CLOSED",
    title: "모든 입력 경로에 바이트와 차원 상한을 둡니다",
    body: "위조된 매직바이트, 압축 폭탄, 과도한 이미지 해상도를 디코딩 전에 차단해 장애 전파를 막습니다.",
  },
  {
    id: "operations",
    tag: "OPERATIONS",
    title: "자체 인프라로 서비스 지속성을 지킵니다",
    body: "빌드부터 무중단 Blue-Green 배포와 헬스체크 관제까지 직접 운영하는 인프라 위에서 서비스를 유지합니다.",
  },
  {
    id: "quality",
    tag: "QUALITY GATE",
    title: "검증된 빌드만 프로덕션에 배포합니다",
    body: "웹 접근성, 번들 예산, OpenAPI 계약, 보안 규칙을 자동 게이트로 통과한 산출물만 배포합니다.",
  },
]

export const COMPANY_STATS: CompanyStat[] = [
  {
    id: "services",
    value: "4개",
    label: "직접 개발·운영하는 공개 서비스 (EasySubway · EasyOffice · EasyConvert · AquilaLog)",
  },
  {
    id: "formats",
    value: "308개 포맷",
    label: "문서·한글·이미지·미디어·압축 등 13개 분류 2,816개 파일 변환 조합 지원",
  },
  {
    id: "office",
    value: "313종 함수",
    label: "문서·시트·슬라이드·PDF·한글(HWP/HWPX) 로컬 편집 데스크탑 오피스 엔진",
  },
  {
    id: "coverage",
    value: "20개 노선",
    label: "수도권 및 광역시 도시철도 무장애 실측 데이터 연동 및 무중단 컨테이너 운영",
  },
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
      { label: "EasyOffice 다운로드", href: EASYOFFICE_URL },
      { label: "EasyConvert", href: EASYCONVERT_URL },
      { label: "AquilaLog 기술 블로그", href: BLOG_URL },
    ],
  },
  {
    id: "company",
    title: "탐색 & 문의",
    links: [
      { label: "운영 중인 제품", href: "#work" },
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
