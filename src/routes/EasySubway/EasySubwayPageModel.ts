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

export const TIMELINE_SCREENSHOT = "/easysubway/timeline-detail.png"
export const TIMELINE_SCREENSHOT_ALT =
  "EasySubway 실제 무장애 타임라인 경로 결과 화면. 4호선 빠른 하차 9-2칸 및 엘리베이터 동선 안내."

export type ComparisonPoint = {
  title: string
  description: string
}

export type ComparisonTrack = {
  id: "standard" | "easysubway"
  label: string
  title: string
  badgeVariant: "standard" | "highlighted"
  points: ComparisonPoint[]
}

export const COMPARISON_TRACKS: ComparisonTrack[] = [
  {
    id: "standard",
    label: "일반 지도앱",
    title: "소요 시간 중심 경로",
    badgeVariant: "standard",
    points: [
      {
        title: "계단 80개 구간 통과 강요",
        description: "최단 시간 단축만을 위해 휠체어나 유모차가 갈 수 없는 가파른 계단 구간 안내",
      },
      {
        title: "단차 정보 없는 출구 안내",
        description: "도착 후 출구에 턱이나 계단이 있어 지상으로 나가지 못하고 되돌아오는 위험",
      },
      {
        title: "복잡한 환승 동선 방치",
        description: "승강기 위치와 무관한 일반 계단 환승 통로를 안내해 이동 거리와 피로도 가중",
      },
      {
        title: "승강기 고장 사전 인지 불가",
        description: "현장에 도착해서야 엘리베이터 점검이나 리프트 고장을 발견해 이동이 중단되는 문제",
      },
    ],
  },
  {
    id: "easysubway",
    label: "EasySubway",
    title: "단차 0cm 무장애 이동 경로",
    badgeVariant: "highlighted",
    points: [
      {
        title: "단차 0cm 엘리베이터 직결 동선",
        description: "계단을 전면 배제하고 지상 출구부터 승강장까지 100% 승강기로만 이어지는 안전 동선",
      },
      {
        title: "교통약자 전용 출구 및 경사로 우선",
        description: "휠체어 경사로와 교통약자 전용 개찰구 위치를 사전에 확인하여 목적지로 직결",
      },
      {
        title: "빠른 환승 9-2칸 맞춤 승하차",
        description: "환승 시 엘리베이터 바로 앞으로 내리는 최적 승차 위치(칸·문)를 안내해 환승 단축",
      },
      {
        title: "실시간 승강기 운행·점검 상태 연동",
        description: "점검 중인 승강기를 실시간으로 감지하여 대체 엘리베이터 우회 경로를 즉시 재계산",
      },
    ],
  },
]

export type FaqItem = {
  id: string
  question: string
  answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "free-service",
    question: "EasySubway는 무료로 이용할 수 있나요?",
    answer:
      "네, 모든 무장애 경로 탐색, 실시간 편의시설 정보, 노선도 기능은 100% 무료입니다. 유료 결제나 광고 유도 없이 누구나 편안하게 이용할 수 있습니다.",
  },
  {
    id: "supported-lines",
    question: "현재 어떤 지하철 노선과 지역을 지원하나요?",
    answer:
      "수도권 1~9호선, 수인분당선, 신분당선, 공항철도, 경의중앙선, GTX-A 등 20여 개 핵심 노선을 포함하여 부산, 대구, 대전, 광주 등 전국 주요 도시철도 전 노선으로 데이터를 지속 검증 및 확장하고 있습니다.",
  },
  {
    id: "difference",
    question: "일반 지도앱과 가장 큰 차이점은 무엇인가요?",
    answer:
      "일반 지도앱의 최단 시간 위주 검색과 달리, EasySubway는 계단 80개를 배제한 '단차 0cm 엘리베이터 직결 동선'과 '빠른 환승 9-2칸 안내'를 결합하여 휠체어와 유모차가 실제로 끝까지 완주할 수 있는 경로를 계산합니다.",
  },
  {
    id: "privacy-policy",
    question: "회원가입이 필요하거나 위치 추적이 발생하나요?",
    answer:
      "아닙니다. EasySubway는 별도의 회원가입이나 로그인 없이 바로 이용할 수 있으며, 사용자의 위치나 이동 검색 기록을 서버에 수집하거나 추적하지 않는 무추적(Zero-tracking) 원칙을 철저히 지킵니다.",
  },
]

export type MetroBadgeItem = {
  id: string
  name: string
  fileName: string
}

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

