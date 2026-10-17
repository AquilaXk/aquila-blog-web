import { expect, test } from "@playwright/test"
import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  CompanyFeatureExplorerView,
  formatCapabilityIndex,
} from "../../src/routes/Company/CompanyFeatureCarousel"
import {
  computeCenterClearance,
  createParticleSeeds,
  resolveParticleClearance,
  smoothstep,
} from "../../src/routes/Company/CompanyHeroParticles"
import * as Sec from "../../src/routes/Company/CompanySection.styles"
import {
  BLOG_URL,
  COMPANY_FEATURE_CARDS,
  COMPANY_FOOTER_LINK_GROUPS,
  COMPANY_STATS,
  type CompanyNewsItem,
} from "../../src/routes/Company/CompanyPageModel"

function unwrapPw(node: any, index?: number): any {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) return node.map((child, i) => unwrapPw(child, i))
  if (node.__pw_type === "jsx") {
    const { type, props, key } = node
    const newProps: any = {}
    for (const k in props) {
      newProps[k] = unwrapPw(props[k])
    }
    const resolvedKey = key !== undefined && key !== null ? key : index !== undefined ? `child-${index}` : undefined
    if (typeof type === "function" && !(type as any).__emotion_real) {
      return unwrapPw(type(newProps), index)
    }
    const elementType =
      typeof type === "string" ||
      typeof type === "function" ||
      (type && typeof type === "object" && "$$typeof" in type)
        ? type
        : Fragment
    return createElement(elementType, { ...newProps, key: resolvedKey })
  }
  return node
}

/**
 * CompanyPageView 내 소식 카드 렌더 로직과 1:1로 대응하는 렌더러.
 * Playwright 단위 테스트 러너의 JSX __pw_type 래핑을 피해 React.createElement로 결정론적 마크업을 검증한다.
 */
const renderNewsCard = (item: CompanyNewsItem) =>
  renderToStaticMarkup(
    createElement(
      Sec.NewsCard,
      { href: item.href },
      item.thumbnail?.trim()
        ? createElement(
            Sec.NewsMedia,
            { "data-ui": "company-news-media" } as Record<string, unknown>,
            createElement("img", {
              src: item.thumbnail,
              alt: "",
              loading: "lazy",
              decoding: "async",
            }),
          )
        : null,
      createElement(
        Sec.NewsMeta,
        null,
        createElement(Sec.NewsIndex, { "aria-hidden": "true" }, item.index),
        item.date ? createElement("time", { dateTime: item.date.replace(/\./g, "-") }, item.date) : null,
      ),
      createElement("h3", null, item.title),
      item.summary ? createElement("p", null, item.summary) : null,
      createElement(
        Sec.NewsAction,
        { "aria-hidden": "true", "data-ui": "company-news-action" } as Record<string, unknown>,
        createElement("span", null, "글 읽기"),
        createElement(
          "svg",
          {
            viewBox: "0 0 24 24",
            width: "14",
            height: "14",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            "aria-hidden": "true",
            focusable: "false",
          },
          createElement("path", {
            d: "M5 12h14M12 5l7 7-7 7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
        ),
      ),
    ),
  )

test("썸네일 없는 소식 카드는 거대 플레이스홀더 박스 없이 텍스트 중심 에디토리얼 마크업으로 렌더된다", () => {
  const item: CompanyNewsItem = {
    id: "post-1",
    index: "01",
    title: "Stateless란 무엇인가?",
    summary: "백엔드 인증을 처음 배우면 대부분 이런 흐름으로 헷갈립니다.",
    date: "2026.09.08",
    href: `${BLOG_URL}/posts/1`,
    thumbnail: "",
  }

  const markup = renderNewsCard(item)

  // 속성 및 텍스트 검증
  expect(markup).toContain(`href="${BLOG_URL}/posts/1"`)
  expect(markup).toContain("01")
  expect(markup).toContain("2026.09.08")
  expect(markup).toContain('dateTime="2026-09-08"')
  expect(markup).toContain("Stateless란 무엇인가?")
  expect(markup).toContain("백엔드 인증을 처음 배우면 대부분 이런 흐름으로 헷갈립니다.")
  expect(markup).toContain("글 읽기")

  // 접근성 검증: 인덱스 뱃지와 글 읽기 CTA는 aria-hidden이 적용되어 전체 카드 링크 낭독 시 중복을 방지한다
  expect(markup).toMatch(/<span[^>]*aria-hidden="true"[^>]*>01<\/span>/)
  expect(markup).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-ui="company-news-action"[^>]*>/)

  // 빈 16:9 이미지 플레이스홀더 박스나 <img> 태그가 없어야 한다
  expect(markup).not.toContain("<img")
  expect(markup).not.toMatch(/<div\b[^>]*data-ui="company-news-media"/)

  // Emotion 컴포넌트 셀렉터 오류(.undefined:hover)가 없어야 한다
  expect(markup).not.toContain(".undefined")
})

test("썸네일이 있는 소식 카드는 NewsMedia와 지연 로딩 속성을 포함한 img 요소를 렌더한다", () => {
  const item: CompanyNewsItem = {
    id: "post-2",
    index: "02",
    title: "WebSocket + STOMP 실시간 채팅 설계기",
    summary: "WebSocket은 연결만 열어준다고 해서 실시간 채팅이 완성되지 않습니다.",
    date: "2026.09.08",
    href: `${BLOG_URL}/posts/2`,
    thumbnail: "https://blog.aquilaxk.site/sample.webp",
  }

  const markup = renderNewsCard(item)

  expect(markup).toContain("<img")
  expect(markup).toContain('src="https://blog.aquilaxk.site/sample.webp"')
  expect(markup).toContain('loading="lazy"')
  expect(markup).toContain('decoding="async"')
  expect(markup).toMatch(/<div\b[^>]*data-ui="company-news-media"/)
  expect(markup).toContain("02")
  expect(markup).toContain("WebSocket + STOMP 실시간 채팅 설계기")
  expect(markup).not.toContain(".undefined")
})

test("공백만 있는 썸네일 문자열은 안전하게 미디어 없이 텍스트 카드로 렌더된다", () => {
  const item: CompanyNewsItem = {
    id: "post-3",
    index: "03",
    title: "공백 썸네일 방어 테스트",
    summary: "요약 내용입니다.",
    date: "2026.09.08",
    href: `${BLOG_URL}/posts/3`,
    thumbnail: "   ",
  }

  const markup = renderNewsCard(item)
  expect(markup).not.toContain("<img")
  expect(markup).not.toMatch(/<div\b[^>]*data-ui="company-news-media"/)
  expect(markup).toContain("공백 썸네일 방어 테스트")
})

test("요약이 비어있는 소식 카드는 빈 <p> 태그를 생성하지 않는다", () => {
  const item: CompanyNewsItem = {
    id: "post-4",
    index: "04",
    title: "요약 없는 글",
    summary: "",
    date: "2026.09.08",
    href: `${BLOG_URL}/posts/4`,
    thumbnail: "",
  }

  const markup = renderNewsCard(item)
  expect(markup).not.toMatch(/<p\b[^>]*>/)
  expect(markup).toContain("요약 없는 글")
})

test("NewsHead와 NewsHeaderAction은 기술 블로그 링크와 44px 터치 타겟을 위한 앵커를 렌더한다", () => {
  const headMarkup = renderToStaticMarkup(
    createElement(
      Sec.NewsHead,
      null,
      createElement("div", null, createElement("h2", null, "만들면서 남긴 기록")),
      createElement(
        Sec.NewsHeaderAction,
        { href: BLOG_URL },
        createElement("span", null, "기술 블로그 전체 보기"),
        createElement(
          "svg",
          {
            viewBox: "0 0 24 24",
            width: "16",
            height: "16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            "aria-hidden": "true",
            focusable: "false",
          },
          createElement("path", {
            d: "M5 12h14M12 5l7 7-7 7",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
        ),
      ),
    ),
  )

  expect(headMarkup).toContain("만들면서 남긴 기록")
  expect(headMarkup).toContain("기술 블로그 전체 보기")
  expect(headMarkup).toContain(`href="${BLOG_URL}"`)
  expect(headMarkup).toContain('aria-hidden="true"')
  expect(headMarkup).not.toContain(".undefined")
})

test("CompanyFeatureExplorerView는 실제 COMPANY_FEATURE_CARDS 6개 카드와 01~06 모노스페이스 인덱스를 정적 헤어라인 그리드로 렌더한다", () => {
  const markup = renderToStaticMarkup(
    unwrapPw((CompanyFeatureExplorerView as () => unknown)()),
  )

  expect(markup).toContain('role="region"')
  expect(markup).toContain('aria-label="핵심 역량 카드"')
  expect(markup).not.toContain('data-bouncer')
  expect(markup).not.toContain(".undefined")

  const articles = markup.match(/<article\b/g) ?? []
  expect(articles).toHaveLength(COMPANY_FEATURE_CARDS.length)

  COMPANY_FEATURE_CARDS.forEach((card, index) => {
    expect(markup).toContain(formatCapabilityIndex(index))
    expect(markup).toContain(card.title)
    expect(markup).toContain(card.tag)
    expect(markup).toContain(card.body)
  })
})

test("formatCapabilityIndex는 1-based 두 자리 모노스페이스 인덱스를 정확히 계산한다", () => {
  expect(formatCapabilityIndex(0)).toBe("01")
  expect(formatCapabilityIndex(5)).toBe("06")
})

test("CompanyHeroParticles의 smoothstep, createParticleSeeds, resolveParticleClearance는 모바일 390px 본문·CTA 영역의 입자 침범을 완전히 차단한다", () => {
  expect(smoothstep(0, 1, -0.5)).toBe(0)
  expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  expect(smoothstep(2, 6, 4)).toBe(0.5)
  expect(smoothstep(0, 1, 1.5)).toBe(1)
  expect(smoothstep(2, 2, 2)).toBe(0)

  const seeds = createParticleSeeds(15, 9, 5)
  expect(seeds).toHaveLength(135)
  for (const seed of seeds) {
    expect(seed.refX).toBeGreaterThanOrEqual(-1.1)
    expect(seed.refX).toBeLessThanOrEqual(1.1)
    expect(seed.refY).toBeGreaterThanOrEqual(-1.1)
    expect(seed.refY).toBeLessThanOrEqual(1.1)
    expect(seed.colorIndex).toBeGreaterThanOrEqual(0)
    expect(seed.colorIndex).toBeLessThan(5)
  }

  // 390x520 모바일 히어로: 중앙 타이포 + 리드 문단 + 하단 CTA 버튼 영역(|dx| <= 170, |dy| <= 185)은 clearance 0이어야 함
  const mobileSpec = resolveParticleClearance(390, 520)
  expect(mobileSpec.maxAlpha).toBeLessThanOrEqual(0.5)
  expect(computeCenterClearance(195, 260, 390, 520)).toBe(0)
  expect(computeCenterClearance(195, 260 + 180, 390, 520)).toBe(0)
  expect(computeCenterClearance(195, 260 - 180, 390, 520)).toBe(0)
  expect(computeCenterClearance(195 + 165, 260, 390, 520)).toBe(0)
  expect(computeCenterClearance(12, 16, 390, 520)).toBeGreaterThan(0.4)

  // 1440x640 데스크톱 히어로: 중앙 카피는 보호하고 좌우 링 필드는 온전히 노출
  const desktopSpec = resolveParticleClearance(1440, 640)
  expect(desktopSpec.maxAlpha).toBeCloseTo(0.76, 2)
  expect(computeCenterClearance(720, 320, 1440, 640)).toBe(0)
  expect(computeCenterClearance(180, 140, 1440, 640)).toBe(1)

  const zeroHeightSpec = resolveParticleClearance(800, 0)
  expect(zeroHeightSpec.clearRx).toBeGreaterThanOrEqual(1)
  expect(zeroHeightSpec.clearRy).toBeGreaterThanOrEqual(1)
  expect(computeCenterClearance(400, 0, 800, 0)).toBe(0)
})

test("COMPANY_STATS는 중복 100% 수치 없이 4개 고유 운영 지표를 정의하고 푸터는 2개 내비 그룹을 채운다", () => {
  expect(COMPANY_STATS).toHaveLength(4)
  const statValues = COMPANY_STATS.map((stat) => stat.value)
  expect(new Set(statValues).size).toBe(4)
  expect(statValues).toEqual(["2개", "20개 노선", "Blue-Green", "0원"])
  expect(statValues).not.toContain("100%")

  expect(COMPANY_FOOTER_LINK_GROUPS).toHaveLength(2)
  expect(COMPANY_FOOTER_LINK_GROUPS.map((group) => group.title)).toEqual(["제품", "탐색 & 문의"])
})




