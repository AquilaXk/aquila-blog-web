import fs from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  CompanyFeatureExplorerView,
  formatCapabilityIndex,
} from "../../src/routes/Company/CompanyFeatureCarousel"
import { CompanyCapabilityOrbWave } from "../../src/routes/Company/CompanyCapabilityVisuals"
import {
  computeCenterClearance,
  computeFrameTrigRates,
  createCursorKinematicsState,
  createParticleSeeds,
  createParticleSoABuffers,
  resolveParticleClearance,
  smoothstep,
  stepCursorKinematics,
  stepParticleSpringFieldFromSoA,
  triggerCursorRipple,
} from "../../src/routes/Company/CompanyHeroParticles"
import { marketingLight } from "../../src/design-system/marketingPalette"
import * as Sec from "../../src/routes/Company/CompanySection.styles"
import {
  BLOG_URL,
  COMPANY_FEATURE_CARDS,
  COMPANY_FOOTER_LINK_GROUPS,
  COMPANY_PRODUCT_SHOWCASES,
  COMPANY_STATS,
  EASYCONVERT_URL,
  EASYOFFICE_URL,
  PRODUCT_URL,
  type CompanyNewsItem,
} from "../../src/routes/Company/CompanyPageModel"
import {
  AppleOsGlyph,
  CheckGlyph,
  CompanyVectorIcon,
  CopyGlyph,
  DownloadGlyph,
  LinuxOsGlyph,
  SparklesGlyph,
  WindowsOsGlyph,
  type CompanyIconName,
} from "../../src/routes/Company/CompanyIcons"
import {
  EASYOFFICE_OS_PLATFORMS,
  EASYOFFICE_STUDIO_MODULES,
  detectClientDownloadOs,
  normalizeDownloadOs,
  resolveEasyOfficeAssetUrl,
  resolvePlatformChecksums,
} from "../../src/routes/Company/CompanyDownloadModel"

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

test("COMPANY_STATS는 중복 100% 수치 없이 4개 고유 운영 지표를 정의하고 푸터는 4대 제품과 2개 내비 그룹을 채운다", () => {
  expect(COMPANY_STATS).toHaveLength(4)
  const statValues = COMPANY_STATS.map((stat) => stat.value)
  expect(new Set(statValues).size).toBe(4)
  expect(statValues).toEqual(["4개", "308개 포맷", "313종 함수", "20개 노선"])
  expect(statValues).not.toContain("100%")

  expect(COMPANY_FOOTER_LINK_GROUPS).toHaveLength(2)
  expect(COMPANY_FOOTER_LINK_GROUPS.map((group) => group.title)).toEqual(["제품", "탐색 & 문의"])
  expect(COMPANY_FOOTER_LINK_GROUPS[0].links).toEqual([
    { label: "EasySubway", href: PRODUCT_URL },
    { label: "EasyOffice 다운로드", href: "/download" },
    { label: "EasyConvert", href: EASYCONVERT_URL },
    { label: "AquilaLog 기술 블로그", href: BLOG_URL },
  ])
})

test("COMPANY_PRODUCT_SHOWCASES는 EasySubway·EasyOffice·EasyConvert·AquilaLog 4종과 실재하는 정적 프리뷰 자산을 정의한다", () => {
  expect(COMPANY_PRODUCT_SHOWCASES.map((item) => item.id)).toEqual([
    "easysubway",
    "easyoffice",
    "easyconvert",
    "aquilalog",
  ])
  expect(COMPANY_PRODUCT_SHOWCASES.map((item) => item.action.href)).toEqual([
    PRODUCT_URL,
    "/download",
    "https://convert.aquilaxk.site",
    BLOG_URL,
  ])

  const publicRoot = path.resolve(__dirname, "../../public")
  for (const showcase of COMPANY_PRODUCT_SHOWCASES) {
    expect(showcase.image.src.startsWith("/")).toBe(true)
    const assetPath = path.join(publicRoot, showcase.image.src)
    expect(fs.existsSync(assetPath), showcase.image.src).toBe(true)
    expect(fs.statSync(assetPath).size, showcase.image.src).toBeGreaterThan(1024)
    expect(showcase.image.width).toBeGreaterThan(0)
    expect(showcase.image.height).toBeGreaterThan(0)
    expect(showcase.image.alt.trim().length).toBeGreaterThan(10)
    expect(showcase.specs.length).toBeGreaterThanOrEqual(3)
  }
})

test("EasyOffice 다운로드 모델은 OS 판별·릴리스 자산 URL·스튜디오 모듈 6종을 정본으로 정의한다", () => {
  expect(normalizeDownloadOs("mac")).toBe("macos")
  expect(normalizeDownloadOs("Windows")).toBe("windows")
  expect(normalizeDownloadOs("linux")).toBe("linux")
  expect(normalizeDownloadOs(["ubuntu"])).toBe("linux")
  expect(normalizeDownloadOs("unknown")).toBe("macos")

  expect(detectClientDownloadOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows")
  expect(detectClientDownloadOs("Mozilla/5.0 (X11; Ubuntu; Linux x86_64)")).toBe("linux")
  expect(detectClientDownloadOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("macos")

  expect(EASYOFFICE_OS_PLATFORMS.map((p) => p.os)).toEqual(["macos", "windows", "linux"])
  expect(EASYOFFICE_OS_PLATFORMS[0].actions[0].href).toContain("EasyOffice-macos-universal.dmg")
  expect(EASYOFFICE_OS_PLATFORMS[1].actions[0].href).toContain("EasyOffice-windows-x64-setup.exe")
  expect(EASYOFFICE_OS_PLATFORMS[2].actions.map((a) => a.href)).toEqual([
    expect.stringContaining("EasyOffice-linux-x64.deb"),
    expect.stringContaining("EasyOffice-linux-arm64.deb"),
    expect.stringContaining("EasyOffice-linux-x64.rpm"),
    expect.stringContaining("EasyOffice-linux-x64.AppImage"),
  ])
  for (const platform of EASYOFFICE_OS_PLATFORMS) {
    expect(platform.requirements.length).toBeGreaterThan(10)
    expect(platform.snippets.length).toBeGreaterThanOrEqual(1)
  }

  expect(EASYOFFICE_STUDIO_MODULES).toHaveLength(6)

  const sampleRelease = {
    version: "0.1.0",
    tag: "v0.1.0",
    publishedDate: "2026.11.12",
    releaseUrl: "https://github.com/AquilaXk/easyoffice/releases/tag/v0.1.0",
    checksums: {
      "EasyOffice-macos-universal.dmg": "a".repeat(64),
      "EasyOffice-windows-x64-setup.exe": "b".repeat(64),
    },
  }
  expect(resolveEasyOfficeAssetUrl("EasyOffice-macos-universal.dmg", sampleRelease)).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/download/v0.1.0/EasyOffice-macos-universal.dmg"
  )
  expect(resolveEasyOfficeAssetUrl("EasyOffice-macos-universal.dmg", null)).toBe(
    "https://github.com/AquilaXk/easyoffice/releases/latest/download/EasyOffice-macos-universal.dmg"
  )
  expect(resolvePlatformChecksums("macos", sampleRelease)).toEqual([
    { assetName: "EasyOffice-macos-universal.dmg", sha256: "a".repeat(64) },
  ])
  expect(resolvePlatformChecksums("windows", null)).toEqual([])
})

test("CompanyIcons는 25종 아이콘 모두를 Lucide·Simple Icons 원본 24x24 SVG 벡터로 렌더한다", () => {
  const iconNames: readonly CompanyIconName[] = [
    "accessibility",
    "local-engine",
    "sandbox-convert",
    "resilience",
    "operations",
    "quality",
    "train-front",
    "file-text",
    "table-2",
    "presentation",
    "file-check-2",
    "terminal",
    "cpu",
    "layers",
    "git-branch",
    "lock",
    "globe",
    "database",
  ]
  for (const name of iconNames) {
    const html = renderToStaticMarkup(
      unwrapPw((CompanyVectorIcon as any)({ name, size: 20, strokeWidth: 1.85 })),
    )
    expect(html, name).toContain("<svg")
    expect(html, name).toContain('viewBox="0 0 24 24"')
    expect(html, name).toContain('aria-hidden="true"')
    expect(html, name).not.toContain("<polygon")
  }

  for (const [label, Glyph] of [
    ["apple", AppleOsGlyph],
    ["windows", WindowsOsGlyph],
    ["linux", LinuxOsGlyph],
    ["sparkles", SparklesGlyph],
    ["download", DownloadGlyph],
    ["copy", CopyGlyph],
    ["check", CheckGlyph],
  ] as const) {
    const html = renderToStaticMarkup(unwrapPw((Glyph as any)({})))
    expect(html, label).toContain("<svg")
    expect(html, label).toContain('viewBox="0 0 24 24"')
    expect(html, label).toContain('aria-hidden="true"')
    expect(html, label).not.toContain("<polygon")
    expect(html, label).toContain("<path")
  }

  const iconsSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/routes/Company/CompanyIcons.tsx"),
    "utf8",
  )
  expect(iconsSource).toContain("lucide-icons/lucide")
  expect(iconsSource).toContain("simple-icons/simple-icons")
  expect(iconsSource).not.toContain("<polygon")
})

test("히어로 커서 물리 엔진은 Aquila 5색 스펙트럼, 속도 슬립스트림, 클릭 파동, 스프링 복원 및 중앙 마스킹을 수행한다", () => {
  expect([...marketingLight.particleColors]).toEqual([
    "#4F46E5",
    "#5C6BC0",
    "#7C3AED",
    "#0284C7",
    "#047857",
  ])
  expect(marketingLight.particleColors).not.toContain("#F84242")
  expect(marketingLight.particleColors).not.toContain("#FFCF03")

  const buffers = createParticleSoABuffers(22, 12, marketingLight.particleColors.length)
  const clearance = resolveParticleClearance(1440, 640)
  const cursor = createCursorKinematicsState()
  cursor.pointerActive = true
  cursor.ringX = -0.68
  cursor.ringY = -0.2
  cursor.targetX = -0.52
  cursor.targetY = -0.18

  // 1) 커서를 +X 방향으로 이동시킬 때 커서 속도 vx > 0 및 중앙 타이포 마스킹 검증
  for (let frame = 0; frame < 4; frame += 1) {
    stepCursorKinematics(cursor, 0.5 + frame * (1 / 60), 1 / 60)
  }
  expect(cursor.vx).toBeGreaterThan(0)
  expect(cursor.speed).toBeGreaterThan(0)

  let nearIdx = -1
  let minNearDist = Infinity
  let centerIdx = -1
  let minCenterDist = Infinity
  for (let i = 0; i < buffers.count; i += 1) {
    const rx = buffers.refX[i]!
    const ry = buffers.refY[i]!
    const dCursor = Math.hypot(rx - cursor.ringX, ry - cursor.ringY)
    if (dCursor < minNearDist) {
      minNearDist = dCursor
      nearIdx = i
    }
    const dCenter = Math.hypot(rx, ry)
    if (dCenter < minCenterDist) {
      minCenterDist = dCenter
      centerIdx = i
    }
  }
  expect(nearIdx).toBeGreaterThanOrEqual(0)
  expect(centerIdx).toBeGreaterThanOrEqual(0)

  // 동일 입자에서 커서 이동 속도에 의한 슬립스트림(wake) +X 충격을 정적 커서 대비 차분으로 검증
  const staticBuffers = createParticleSoABuffers(22, 12, marketingLight.particleColors.length)
  const staticCursor = { ...cursor, vx: 0, vy: 0, speed: 0 }
  stepParticleSpringFieldFromSoA(
    staticBuffers,
    staticCursor,
    0.5,
    computeFrameTrigRates(0.5),
    clearance,
    1 / 60
  )

  const movingCursor = { ...cursor, vx: 0.08, vy: 0, speed: 0.08 }
  stepParticleSpringFieldFromSoA(
    buffers,
    movingCursor,
    0.5,
    computeFrameTrigRates(0.5),
    clearance,
    1 / 60
  )
  expect(buffers.energy[nearIdx]!).toBeGreaterThan(0.2)
  expect(buffers.velX[nearIdx]!).toBeGreaterThan(staticBuffers.velX[nearIdx]!)
  expect(buffers.screenAlpha[centerIdx]).toBe(0)

  // 2) 클릭 파동 트리거 시 반경·파동 에너지 전파 검증
  triggerCursorRipple(cursor, -0.7, 0.2)
  expect(cursor.rippleStrength).toBe(1)
  stepCursorKinematics(cursor, 0.55, 1 / 60)
  expect(cursor.rippleRadius).toBeGreaterThan(0.04)
  expect(cursor.rippleStrength).toBeLessThan(1)
  stepParticleSpringFieldFromSoA(
    buffers,
    cursor,
    0.55,
    computeFrameTrigRates(0.55),
    clearance,
    1 / 60
  )

  // 3) 포인터 이탈 후 후크의 법칙 스프링-댐퍼로 입자 변위·속도 감쇠 복원 검증
  cursor.pointerActive = false
  cursor.rippleStrength = 0
  buffers.velX[nearIdx] = 0.08
  for (let step = 0; step < 30; step += 1) {
    const t = 0.6 + step * (1 / 60)
    stepCursorKinematics(cursor, t, 1 / 60)
    stepParticleSpringFieldFromSoA(
      buffers,
      cursor,
      t,
      computeFrameTrigRates(t),
      clearance,
      1 / 60
    )
  }
  expect(Math.abs(buffers.velX[nearIdx]!)).toBeLessThan(0.08)
})

test("CompanyCapabilityOrbWave와 CompanyFeatureExplorerView 및 페이지 뷰는 커서 스포트라이트·마그네틱 오브 웨이브 계약을 노출한다", () => {
  const orbMarkup = renderToStaticMarkup(unwrapPw((CompanyCapabilityOrbWave as () => unknown)()))
  expect(orbMarkup).toContain('data-orb-wave="true"')
  expect((orbMarkup.match(/data-orb-index="/g) ?? []).length).toBe(12)

  const featureMarkup = renderToStaticMarkup(
    unwrapPw((CompanyFeatureExplorerView as () => unknown)())
  )
  expect((featureMarkup.match(/data-spotlight="true"/g) ?? []).length).toBe(
    COMPANY_FEATURE_CARDS.length
  )

  const pageViewSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/routes/Company/CompanyPageView.tsx"),
    "utf8"
  )
  expect(pageViewSource).toContain('data-spotlight="true"')

  const downloadViewSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/routes/Company/CompanyDownloadPageView.tsx"),
    "utf8"
  )
  expect(downloadViewSource).toContain("useCompanySurfaceMotion")
  expect(downloadViewSource).toContain('data-spotlight="true"')
})





