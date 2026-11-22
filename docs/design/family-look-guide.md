# 3대 표면 디자인 가이드 (정량 명세)

이 문서는 `aquila-blog-web` 전체 UI의 단일 시각 명세다. 모든 화면은 Light-only(`effectiveScheme = "light"`) 캔버스 위에서 목적별로 분리된 3대 표면 규약을 따른다.

## 1. 단일 테마 및 색상 정본 (`COLOR_SOURCE_ALLOWLIST`)

- 전역 테마는 라이트 스케일만 번들한다([colors.ts](../../src/styles/colors.ts), [theme.ts](../../src/styles/theme.ts), [adminColorTokens.ts](../../src/routes/Admin/adminColorTokens.ts)). `colors.dark = lightColors`, `adminDarkThemeVariables = adminLightThemeVariables`로 타입 호환만 유지한다.
- UI 표면 코드에는 직접 hex·`rgb()`·`hsl()` 리터럴을 쓰지 않고 `--aq-*`·`--admin-*` CSS 변수나 허용 목록 정본 모듈 토큰만 참조한다.
- 허용된 색상 정본 모듈([check-design-colors.mjs](../../scripts/check-design-colors.mjs)):
  - `src/styles/colors.ts` (Radix Light 기본 팔레트)
  - `src/styles/theme.ts` (`createPublicDesignTokens`)
  - `src/styles/variables.ts` (카드·플로팅 그림자 토큰)
  - `src/design-system/tokens.ts` (시맨틱·스크림·테이블 토큰)
  - `src/design-system/marketingPalette.ts` (회사·제품 쇼케이스 전용 인디고 팔레트)
  - `src/routes/Admin/adminColorTokens.ts` (관리자 `--admin-*` Zinc/Slate 팔레트)
  - `src/libs/markdown/inlineColor.ts` (본문 `{{color:...}}` 매핑)
  - `src/components/markdown-editor/markdownEditorBlockChromeModel.ts` (에디터 색상 스와치)
  - `src/components/markdown-editor/markdownEditorSyntaxThemeTokens.ts` (CodeMirror 6 구문 강조)
  - `src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts` (코드 블록 다크 서피스)
  - `src/libs/markdown/mermaidRuntimeConfig.ts` (Mermaid SVG 테마)

## 2. 3대 표면 체계 정량 규격

| 항목 | 공개 에디토리얼 (`/`, `/posts/[id]`, `/about`) | 회사·제품 쇼케이스 (`/company`, `/download`, `/easysubway`) | 관리자 스튜디오 (`/admin/*`, `MarkdownEditor`) |
| --- | --- | --- | --- |
| 기본 배경 | `#f7f7f5` (`--aq-page-bg`), 본문 면 `#ffffff` (`--aq-surface`) | `#f8f9ff` ~ `#1f2340` (`marketingPalette.ts` 브랜드 스케일) | `adminSurface` / `#ffffff` (`readableSurface`) |
| 랜드마크 | RootLayout `<main>` 공유 | 독립 `<main>` (`StandaloneShell`로 중첩 방지) | Full-bleed 워크스페이스 (`--admin-app-bg`) |
| 구획 문법 | `1px solid var(--aq-border)` 헤어라인 + 여백, 카드 그림자 미사용 | 플로팅 목업·카드 `bentoShadow` / `shadowFloating` 허용 | `--admin-border` 1px 경계 + 플랫 툴바 |
| 버튼·칩 형태 | 사각 컨트롤(`0.25rem`~`0.625rem`), 필(pill) 버튼 배제 | CTA 필(`9999px`)·버전 칩 허용 | 사각 툴바 버튼(`6px`), 상태 dot(`statusDot`) |
| 본문 가독 폭 | `46.5rem` (`744px`) | 섹션 그리드 `1080px` / `75rem` | 에디터 라이브 시트 `744px` 단일 패리티 |
| 본문 타이포 | `1rem` / `line-height: 1.74` / `word-break: keep-all` | 디스플레이 헤딩 강조 계층 | 본문 `1rem / 1.74` + 고정폭 모노 보조 배지 |
| 집중 모드 크롬 | 해당 없음 | 해당 없음 | `data-writing-focus="hidden"` 최소 불투명도 `0.48`~`0.52` |

- 파스텔 상태 배경 박스, box-in-box 장식 카드, 이모지 상태 배지 대신 텍스트·1px 보더·상태 dot·모노 라벨(`editorialLabel`: `11px`, `760`, `0.08em`, `uppercase`)을 쓴다.
- 피드 본문 태그 목록(`.tagLink`)·태그 레일 버튼·칩 레일은 영문 대소문자 보존(`text-transform` 미적용)을 원칙으로 한다.

## 3. 반응형 브레이크포인트 및 레일 계약

| 토큰 / 파일 | 기준(px) | 동작 |
| --- | ---: | --- |
| `breakpoint.sm` | `640` | 모바일 헤더 햄버거 메뉴(`639px` 이하) 전환 |
| `breakpoint.md` | `768` | 태블릿 레이아웃 보조 전환 |
| `breakpoint.lg` | `1024` | 포스트 상세 좌측 메타·목차 레일 표시, 본문 하단 `.mobileMetaTags`·`.mobileBackWrap` 숨김(`AdjacentNav`는 전 해상도 노출) |
| `FEED_TAG_RAIL_CHIP_MAX_PX` | `1200` | 홈 태그 세로 레일 숨김, 1열 상단 가로 칩 레일(`.chipRail`) 표시 |
| `FEED_TAG_RAIL_DESKTOP_MIN_PX` | `1201` | 홈 `220px` 좌측 헤어라인 스티키 태그 레일(`.desktopPanel`) 표시 |
| `breakpoint.xl` | `1280` | 피드 본문-레일 간격 `6rem` 확장 |

## 4. 레이어(`zIndexes`) 및 오버레이 계약

- [zIndexes.ts](../../src/styles/zIndexes.ts) 정본 계층: `hoverCard(28)` → `header(30)`(실제 Sticky 헤더 래퍼 `z-index: 50`) → `dialog(32)` → `dialogHoverCard(34)` → `dropdownMenu(36)` → `.detailReadProgress(90)` → `mobileNavOverlay(100)` → `mobileSheet(160)` → `editorGuide(190)` → `publishModal(210)` → `lightbox(220)` → `commandPalette(2250)` → `confirmDialog(2300)`.
- 모달·명령 팔레트·모바일 드로어·에디터 시트는 [useModalFocusTrap.ts](../../src/design-system/useModalFocusTrap.ts)로 포커스를 가두고 `Escape`·`popstate` 이동 시 스크롤 잠금을 반드시 해제한다.

## 5. 접근성·모바일·모션·다국어·검증 게이트

- **색상 대비**: 본문과 인라인 텍스트 색상([inlineColor.ts](../../src/libs/markdown/inlineColor.ts)) 및 에디터 스와치([markdownEditorBlockChromeModel.ts](../../src/components/markdown-editor/markdownEditorBlockChromeModel.ts))는 `#ffffff`·`#f7f7f5` 배경 기준 WCAG AA `4.5:1` 이상을 만족해야 한다. 전역 선택 영역(`::selection`)은 `blue4` 배경 + `gray12` 전경으로 고대비를 유지한다.
- **모바일 터치**: `@media (pointer: coarse)` 환경에서 입력 필드(`input`, `select`, `textarea`)는 `font-size >= 1rem(16px)` 이상을 유지해 iOS 자동 확대를 막고 모든 인터랙티브 컨트롤은 최소 `44x44px`(`MOBILE_TOUCH_TARGET_MIN_PX`) 터치 영역을 확보한다.
- **모션 감소**: [motion.ts](../../src/design-system/motion.ts)의 `getPreferredScrollBehavior()`·`respectReducedMotion`과 전역 `prefers-reduced-motion: reduce` 미디어 쿼리를 따른다.
- **다국어**: 사용자 노출 문구는 [LanguageContext.tsx](../../src/libs/language/LanguageContext.tsx)의 `useLanguage()` 한/영 사전에 등록한다.
- **정적 검증 게이트**:
  ```sh
  yarn check:design-colors
  DESIGN_COLOR_SCAN_MODE=full node scripts/check-design-colors.mjs
  yarn check:refactor-boundaries
  ```
