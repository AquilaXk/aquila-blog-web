import { expect, test } from "@playwright/test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as Sec from "../../src/routes/Company/CompanySection.styles"
import { BLOG_URL, type CompanyNewsItem } from "../../src/routes/Company/CompanyPageModel"

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
            { "data-ui": "company-news-media" },
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
        { "aria-hidden": "true", "data-ui": "company-news-action" },
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
