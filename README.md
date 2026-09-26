# Aquila Blog Web

Next.js Pages Router 기반 사용자/관리자 UI 웹 애플리케이션입니다.  
공개 블로그 피드, 게시글 상세, 관리자 글쓰기 작업실(에디터 스튜디오), 시스템 운영 도구를 제공합니다.

[Live Site](https://blog.aquilaxk.site) ·
[Platform Repository](https://github.com/AquilaXk/aquila-blog) ·
[Release Runbook](docs/operations/web-release.md) ·
[Rollback Runbook](docs/operations/web-rollback.md)

## Stack

- **Framework**: Next.js 15.5 (Pages Router)
- **UI & Language**: React 19.2, TypeScript 5.6
- **Data Fetching & Cache**: TanStack Query 5.102 (SSR hydrate + client cache)
- **Styling**: Emotion 11.14 (CSS-in-JS)
- **Component & Visual QA**: Storybook 10.6
- **Testing**: Playwright 1.62 (Unit, E2E Smoke, Perf, Live, A11y)

## 주요 화면

- `/`: 메인 피드 (feed/explore/search + cursor 기반 무한 스크롤)
- `/posts/[id]`: 글 상세
- `/about`: 소개 페이지
- `/admin`: 운영 허브
- `/admin/profile`: 관리자 프로필 관리
- `/admin/posts`: 글 목록 및 상태 관리
- `/admin/editor/new` & `/admin/editor/[id]`: 글 작성/수정 (통합 에디터 스튜디오)
- `/admin/tools`: 시스템 운영 도구

## 실행

```bash
# 1. 의존성 설치
yarn install --frozen-lockfile

# 2. 로컬 개발 서버 실행
yarn dev
```

Node.js 20.x(`>=20.19`)와 Yarn 1.22.22를 기준으로 실행합니다. `package.json`의 `engines.node`는 CI 및 컨테이너 런타임과 동기화되어 있습니다.

## 환경변수

### 1. 로컬 개발 환경변수

로컬 실행 시 필요한 기본 연결 설정입니다 (`.env.local` 또는 런타임 주입):

| 이름 | 필수 여부 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | 필수 | 브라우저 런타임 API base URL (예: `http://localhost:8080`) |
| `BACKEND_INTERNAL_URL` | 필수 | SSR/server-side API base URL (로컬: `http://localhost:8080`, 홈서버: 내부 Caddy 주소) |

### 2. 프로덕션 배포 계약 환경변수 (`config/env.contract.json`)

홈서버 및 프로덕션 컨테이너 런타임 계약 검증 대상 변수입니다:

| 이름 | 필수 여부 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 필수 (운영) | 사이트 정본 URL (`https://blog.aquilaxk.site`) |
| `TOKEN_FOR_REVALIDATE` | 필수 (운영) | 온디맨드 ISR revalidate 보안 시크릿 토큰 |
| `WEB_METRICS_TOKEN` | 필수 (운영) | 웹 메트릭 및 시스템 상태 조회 인증 토큰 |
| `BACKEND_PROXY_MAX_BODY_BYTES` | 필수 (운영) | API 프록시 요청 본문 최대 허용 크기 (바이트) |
| `BACKEND_PROXY_MAX_IN_FLIGHT_BODY_BYTES` | 필수 (운영) | 동시 처리 인플라이트 프록시 바디 총 상한 |

### 3. 선택 및 모니터링 환경변수

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_MONITORING_EMBED_URL` | 관리자 도구 모니터링 대시보드 임베드 URL (예: Grafana kiosk) |
| `NEXT_PUBLIC_LOGS_EMBED_URL` | 관리자 도구 로그 조회 대시보드 임베드 URL |
| `NEXT_PUBLIC_PROMETHEUS_URL` | 관리자 도구 Prometheus 바로가기 URL |
| `UPTIME_KUMA_PROXY_ORIGIN` | `/status/*` rewrite 대상 오리진 |
| `PLAYWRIGHT_BASE_URL` | Live E2E 대상 URL |
| `BUNDLE_BUDGET_MARGIN_PERCENT` | 번들 예산 허용 오차(%) |
| `BUNDLE_BUDGET_ENFORCEMENT` | 번들 예산 엄격 집행 모드 (`strict` / `warn`) |

## 인증/세션 동작 요약

- 로그인 상태 조회는 `/member/api/v1/auth/me` 기반입니다.
- SSR에서 auth 스냅샷(`authMeProbe`)을 주입하고, 비로그인 확정 상태에서는 클라이언트 재검증 호출을 생략합니다.
- 비로그인 새로고침 시 `auth/me 401` 콘솔 노이즈를 줄이기 위한 억제 로직이 포함되어 있습니다.

관련 코드:
- `src/hooks/useAuthSession.ts`
- `src/libs/server/authSession.ts`

## OpenAPI 계약 동기화

프론트는 검증된 Platform 계약 스냅샷을 타입으로 변환해 계약 드리프트를 검증합니다. 스냅샷은 `contracts/platform/manifest.lock.json`에 고정된 Platform repository와 40자리 source commit, artifact SHA-256을 포함합니다. 일반 검증은 network/live backend를 사용하지 않습니다.

```bash
# 타입 생성 및 계약 드리프트 검증
yarn contracts:generate
yarn contracts:check
```

Platform canonical bundle을 새 snapshot으로 반영할 때:

```bash
# 로컬 플랫폼 체크아웃에서 간편 동기화
yarn contracts:import:local

# 또는 특정 SHA 기반 직접 import
node scripts/contracts/import-platform-contracts.mjs \
  --source <platform-checkout>/contracts/public-api \
  --output contracts/platform \
  --source-repository AquilaXk/aquila-blog \
  --source-commit <40-hex-commit>
```

## 검증 명령

```bash
# 1. 정적 분석 및 타입/단위 검증
yarn lint
yarn type-check
yarn test:unit

# 2. 프로덕션 빌드 및 번들 크기 예산 검증
yarn build
yarn check:bundle-size

# 3. Playwright E2E 검증
yarn test:e2e:smoke
yarn test:e2e:perf
yarn test:e2e:live
```

## 번들 예산

- 경로별 baseline + margin 정책으로 관리합니다.
- 기본 검사 대상 경로: `/`, `/posts/[id]`, `/admin`
- raw/gzip/brotli를 함께 측정하고 리포트를 `test-results/bundle-size`에 생성합니다.

## 문서

| 문서 | 설명 |
| --- | --- |
| [Web Release Runbook](docs/operations/web-release.md) | 홈서버 배포 릴리즈 4단계 검증 및 증거 수집 가이드 |
| [Web Rollback Runbook](docs/operations/web-rollback.md) | 배포 실패 시 이전 승인 이미지 digest 복구 절차 |
| [Release UI QA Matrix](docs/design/release-ui-qa-matrix.md) | UI QA matrix 및 뷰포트별 릴리즈 점검 가이드 |
| [Frontend Working Guide](docs/design/Frontend-Working-Guide.md) | SSR 에러 핸들링, API 호출 규칙, Fail-fast 원칙 |
| [Editorial Design Guide](docs/design/family-look-guide.md) | 에디토리얼 디자인 시스템 명세 및 토큰 매핑 규칙 |
| [Security CSP Rollout](docs/design/security-csp-rollout.md) | 인라인 스크립트 해시 강제 및 CSP 정책 |
