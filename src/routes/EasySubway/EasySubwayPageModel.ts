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
  index: string
  name: string
  lead: string
  keyword: string
  tail: string
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
  { id: "status", label: "상태", value: "정식 출시 준비 중", accent: true },
  { id: "region", label: "지역", value: "전국 출시 기준" },
  { id: "account", label: "계정", value: "가입 없이 이용" },
]

/** 두 블록 모두 위 스크린샷에서 실제로 보이는 동작만 서술한다. */
export const PRODUCT_FEATURES: ProductFeature[] = [
  {
    id: "station-pick",
    index: "01",
    name: "노선도에서 역을 바로 고릅니다",
    lead: "검증한 노선 위에서 역을 눌러 출발·경유·도착을 지정합니다. 인접 역으로 옮겨 가는 것도",
    keyword: "같은 화면 안에서",
    tail: " 끝나므로 목록과 지도를 왕복하지 않습니다.",
  },
  {
    id: "server-route-calculation",
    index: "02",
    name: "경로는 서버 기준으로 계산합니다",
    lead:
      "노선도와 역 검색은 기기에서 확인할 수 있습니다. 경로 계산은 Journey V3 서버가 제공할 때만 이용할 수 있으며,",
    keyword: "현재 서버 권한이 없으면",
    tail: " 경로를 안내하지 않습니다.",
  },
]

export const PRODUCT_SCOPE_CHIPS: ProductScopeChip[] = [
  { id: "platform", label: "Android · iOS", accent: true },
  { id: "nationwide-release", label: "전국 출시 기준", accent: true },
  { id: "map-and-station-search", label: "노선도·역 검색" },
  { id: "journey-v3-route-calculation", label: "Journey V3 경로 계산" },
  { id: "guest-access", label: "가입 없이 이용" },
  { id: "tracking", label: "추적 없음" },
]

export const PRODUCT_FOOTER_LINKS = [
  { label: "회사 소개", href: COMPANY_URL },
  { label: "기술 블로그", href: BLOG_URL },
  { label: "개인정보처리방침", href: `${BLOG_URL}/privacy` },
  { label: "이용약관", href: `${BLOG_URL}/terms` },
] as const
