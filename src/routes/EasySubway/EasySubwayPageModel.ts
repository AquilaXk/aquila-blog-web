import { CONFIG } from "site.config"

export const PRODUCT_SURFACE = CONFIG.surfaces.product
export const COMPANY_SURFACE = CONFIG.surfaces.company

export const BLOG_URL = CONFIG.link
export const CONTACT_MAILTO = `mailto:${PRODUCT_SURFACE.contactEmail}`

/**
 * 회사 표면 링크는 절대 URL이다.
 *
 * 회사는 자기 canonical 호스트를 가진 별개의 공개 표면이다. 상대 경로 `/company`로 두면 제품
 * 호스트에서 그 경로가 그대로 서빙되고(표면 vhost의 catch-all), canonical이 회사 호스트인 페이지가
 * 제품 호스트 밑에 중복 노출된다. 회사 표면이 제품을 가리킬 때도 같은 규칙을 쓴다.
 */
export const COMPANY_URL = COMPANY_SURFACE.url

export const PRODUCT_RELEASE_STATUS = PRODUCT_SURFACE.releaseStatus

/**
 * 공개할 수 있는 실기기 검수본은 노선도 역 선택 컷(`station-detail.png`)과 무장애 타임라인 경로
 * 결과 컷(`timeline-detail.png`) 두 장이다. 개발용 광고 자리표시가 찍힌 다른 컷은 공개 페이지에
 * 쓰지 않는다.
 */
export const PRODUCT_SCREENSHOT = PRODUCT_SURFACE.screenshot.src
export const PRODUCT_SCREENSHOT_ALT = PRODUCT_SURFACE.screenshot.alt
export const PRODUCT_SCREENSHOT_SIZE = {
  width: PRODUCT_SURFACE.screenshot.width,
  height: PRODUCT_SURFACE.screenshot.height,
} as const

export const TIMELINE_SCREENSHOT = "/easysubway/timeline-detail.png"
export const TIMELINE_SCREENSHOT_ALT =
  "EasySubway 실제 무장애 타임라인 경로 결과 화면. 강남역에서 양재역까지 빠른 환승 3-2칸 및 엘리베이터 가까운 문 8-1 동선 안내."

export type ProductFeature = {
  id: string
  index: string
  tag: string
  name: string
  lead: string
  keyword: string
  tail: string
}

export type RouteSpecItem = {
  id: string
  category: string
  title: string
  description: string
}

export type TechSpecItem = {
  id: string
  label: string
  value: string
  detail: string
}

export type MetroBadgeItem = {
  id: string
  name: string
  fileName: string
}

/** 두 블록 모두 실제 서비스 동작과 무장애 이동 가치를 긍정형 평문으로 서술한다. */
export const PRODUCT_FEATURES: ProductFeature[] = [
  {
    id: "station-pick",
    index: "01",
    tag: "01 / STATION SELECTION",
    name: "노선도에서 역을 바로 선택합니다",
    lead: "노선도 화면에서 원하는 역을 터치해 출발·경유·도착을 바로 지정합니다. 인접 역 탐색과 경로 지정을",
    keyword: "단일 화면",
    tail: "에서 바로 진행할 수 있습니다.",
  },
  {
    id: "barrier-free-route",
    index: "02",
    tag: "02 / ROUTE SPECIFICATION",
    name: "엘리베이터와 환승 동선을 고려한 경로를 계산합니다",
    lead: "역사 내 엘리베이터, 단차 없는 수직 이동 동선, 최단 환승 칸 정보를 바탕으로",
    keyword: "무장애 이동 경로",
    tail: "를 산출해 단계별로 안내합니다.",
  },
]

/** 무장애 이동 경로 4대 에디토리얼 명세표 데이터 */
export const BARRIER_FREE_ROUTE_SPECS: RouteSpecItem[] = [
  {
    id: "vertical-transit",
    category: "수직 이동 · 단차 0cm",
    title: "엘리베이터 직결 동선",
    description:
      "계단과 턱을 배제하고 지상 출구부터 승강장까지 100% 엘리베이터와 경사로로 이어지는 수직 이동 경로를 안내합니다.",
  },
  {
    id: "transfer-optimization",
    category: "환승 연계 · 빠른 환승",
    title: "9-2 승차 위치 안내",
    description:
      "환승 엘리베이터 및 휠체어 리프트 바로 앞으로 내릴 수 있는 최적의 승차 위치(칸·문 번호)를 제시합니다.",
  },
  {
    id: "station-facilities",
    category: "시설 데이터 · 교통약자 특화",
    title: "역사 편의시설 실측 정보",
    description:
      "휠체어·유모차 이동에 필요한 전용 개찰구, 장애인 화장실, 휠체어 급속충전기 위치를 실측 데이터로 제공합니다.",
  },
  {
    id: "safe-routing",
    category: "운행 안전 · 실시간 연동",
    title: "실시간 운행 상태 연동",
    description:
      "승강기 점검이나 역사 시설 장애 발생 시 대체 엘리베이터 우회 경로를 실시간으로 반영하여 안내합니다.",
  },
]

/** 4열 에디토리얼 기술 명세표 데이터 */
export const TECH_SPEC_ITEMS: TechSpecItem[] = [
  {
    id: "coverage",
    label: "적용 범위",
    value: "전국 기준",
    detail: "수도권 20개 노선 및 5대 광역시 도시철도",
  },
  {
    id: "accessibility",
    label: "접근성 데이터",
    value: "무장애 동선",
    detail: "단차 0cm 엘리베이터·경사로 실측 검증",
  },
  {
    id: "privacy",
    label: "서비스 형태",
    value: "가입 없음",
    detail: "개인정보 수집·위치 추적 없는 무료 서비스",
  },
  {
    id: "platform-spec",
    label: "제공 플랫폼",
    value: "Android · iOS",
    detail: "모바일 네이티브 앱 · 전국 정식 출시 준비 중",
  },
]

export const PRODUCT_FOOTER_LINKS = [
  { label: "회사 소개", href: COMPANY_URL },
  { label: "기술 블로그", href: BLOG_URL },
] as const

export const OFFICIAL_METRO_BADGES: MetroBadgeItem[] = [
  { id: "line-1", name: "1호선", fileName: "seoul_1_compact_256.png" },
  { id: "line-2", name: "2호선", fileName: "seoul_2_compact_256.png" },
  { id: "line-3", name: "3호선", fileName: "seoul_3_compact_256.png" },
  { id: "line-4", name: "4호선", fileName: "seoul_4_compact_256.png" },
  { id: "line-5", name: "5호선", fileName: "seoul_5_compact_256.png" },
  { id: "line-6", name: "6호선", fileName: "seoul_6_compact_256.png" },
  { id: "line-7", name: "7호선", fileName: "seoul_7_compact_256.png" },
  { id: "line-8", name: "8호선", fileName: "seoul_8_compact_256.png" },
  { id: "line-9", name: "9호선", fileName: "seoul_9_compact_256.png" },
  { id: "suin-bundang", name: "수인분당", fileName: "suin_bundang_compact_256.png" },
  { id: "shinbundang", name: "신분당", fileName: "shinbundang_compact_256.png" },
  { id: "airport", name: "공항철도", fileName: "airport_railroad_compact_256.png" },
  { id: "gyeongui", name: "경의중앙", fileName: "gyeongui_jungang_compact_256.png" },
  { id: "gtx-a", name: "GTX-A", fileName: "gtx_a_compact_256.png" },
  { id: "incheon-1", name: "인천1호선", fileName: "incheon_1_compact_256.png" },
  { id: "incheon-2", name: "인천2호선", fileName: "incheon_2_compact_256.png" },
  { id: "gyeongchun", name: "경춘선", fileName: "gyeongchun_compact_256.png" },
  { id: "gyeonggang", name: "경강선", fileName: "gyeonggang_compact_256.png" },
  { id: "seohae", name: "서해선", fileName: "seohae_compact_256.png" },
  { id: "sillim", name: "신림선", fileName: "sillim_compact_256.png" },
]
