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
 * 공개할 수 있는 실기기 검수본은 이 한 장이다. 같은 랜딩 자산의 다른 컷은 개발용 광고 자리표시가
 * 찍혀 있어 공개 페이지에 쓸 수 없다(이 저장소는 광고 슬롯이 없다). 그래서 화면은 한 장을 전면
 * 1회 + 확대 1회로만 쓰고, 나머지 섹션은 타이포와 단색 패널로 만든다 - 자리를 채우는 이미지를
 * 만들지 않는다.
 */
export const PRODUCT_SCREENSHOT = PRODUCT_SURFACE.screenshot.src
export const PRODUCT_SCREENSHOT_ALT = PRODUCT_SURFACE.screenshot.alt
export const PRODUCT_SCREENSHOT_SIZE = {
  width: PRODUCT_SURFACE.screenshot.width,
  height: PRODUCT_SURFACE.screenshot.height,
  } as const

export type ProductMetaFact = {
  id: string
  label: string
  value: string
  accent?: boolean
}

export type ProductFeature = {
  id: string
  index?: string
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

export type ProductScopeChip = {
  id: string
  label: string
  accent?: boolean
}

/**
 * 사실만 적는다. 검증 범위·출시 상태는 제품의 공개 서술과 같은 값이며 늘리거나 앞당기지 않는다.
 */
export const PRODUCT_META_FACTS: ProductMetaFact[] = [
  { id: "platform", label: "플랫폼", value: "Android · iOS" },
  { id: "status", label: "상태", value: "전국 정식 출시 준비 중", accent: true },
  { id: "region", label: "지역", value: "전국 기준" },
  { id: "account", label: "계정", value: "가입 없이 이용" },
]

/** 두 블록 모두 실제 서비스 동작과 무장애 이동 가치를 직관적으로 서술한다. */
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

/** 무장애 이동 경로 에디토리얼 명세표 데이터 */
export const BARRIER_FREE_ROUTE_SPECS: RouteSpecItem[] = [
  {
    id: "vertical-transit",
    category: "수직 이동",
    title: "엘리베이터 우선 경로",
    description: "단차 및 계단 구간을 배제하고 지상 출구부터 승강장까지 엘리베이터로 직결되는 동선을 계산합니다.",
  },
  {
    id: "transfer-optimization",
    category: "환승 연계",
    title: "최적 환승 차량 안내",
    description: "호선 환승 시 엘리베이터 및 휠체어 리프트와 가장 가까운 승차 위치(칸·문 번호)를 제시합니다.",
  },
  {
    id: "station-facilities",
    category: "시설 데이터",
    title: "역사 편의시설 실측 정보",
    description: "전국 도시철도 역사의 교통약자 전용 개찰구, 장애인 화장실, 휠체어 급속충전기 위치를 제공합니다.",
  },
  {
    id: "safe-routing",
    category: "운행 안전",
    title: "실시간 운행 상태 연동",
    description: "승강기 점검이나 역사 시설 장애 발생 시 우회 경로를 실시간으로 반영하여 안내합니다.",
  },
]

/** 2x2 에디토리얼 기술 명세표 데이터 */
export const TECH_SPEC_ITEMS: TechSpecItem[] = [
  {
    id: "coverage",
    label: "적용 범위",
    value: "전국 기준",
    detail: "수도권 및 5대 광역시 도시철도 전 노선",
  },
  {
    id: "accessibility",
    label: "접근성 데이터",
    value: "무장애 동선",
    detail: "엘리베이터·경사로 실측 연계 검증",
  },
  {
    id: "privacy",
    label: "서비스 형태",
    value: "가입 없음",
    detail: "개인정보 수집 및 위치 추적 배제",
  },
  {
    id: "platform-spec",
    label: "제공 플랫폼",
    value: "Android · iOS",
    detail: "모바일 네이티브 환경 지원",
  },
]

export const PRODUCT_SCOPE_CHIPS: ProductScopeChip[] = [
  { id: "platform", label: "Android · iOS", accent: true },
  { id: "nationwide-release", label: "전국 출시 기준", accent: true },
  { id: "map-and-station-search", label: "노선도·역 검색" },
  { id: "barrier-free-route-calculation", label: "무장애 이동 경로 계산" },
  { id: "guest-access", label: "가입 없이 이용" },
  { id: "tracking", label: "추적 없음" },
]

export const PRODUCT_FOOTER_LINKS = [
  { label: "회사 소개", href: COMPANY_URL },
  { label: "기술 블로그", href: BLOG_URL },
] as const
