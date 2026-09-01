# Aquila Blog Web

Next.js Pages Router 기반 사용자/관리자 UI 애플리케이션입니다.

## Stack

- Next.js Pages Router
- React 19 + TypeScript
- TanStack Query (SSR hydrate + client cache)
- Emotion
- Playwright (smoke/perf/live E2E)

## 주요 화면

- `/` 메인 피드 (feed/explore/search + cursor 기반 무한 스크롤)
- `/posts/[id]` 글 상세
- `/about` 소개 페이지
- `/admin` 운영 허브
- `/admin/profile` 관리자 프로필 관리
- `/admin/posts/new` 글 작성/수정
- `/admin/tools` 시스템 운영 도구

## 실행

```bash
yarn install --frozen-lockfile
yarn dev
```

Node.js 20.x와 Yarn 1.22.22를 기준으로 실행합니다. `package.json`의 `engines.node`는 CI의 Node 20 런타임과 맞춥니다.

## 필수 환경변수

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | 브라우저 런타임 API base URL |
| `BACKEND_INTERNAL_URL` | SSR/server-side API base URL. 홈서버에서는 Platform 저장소가 소유한 내부 Caddy 주소를 주입하며 Web 저장소는 이 값을 소유하지 않습니다. |

## 선택 환경변수

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_UPTIME_KUMA_STATUS_PATH` | 관리자 도구의 상태 페이지 임베드 경로 |
| `NEXT_PUBLIC_MONITORING_EMBED_URL` | 관리자 도구의 모니터링 iframe URL(예: Grafana kiosk URL) |
| `NEXT_PUBLIC_LOGS_EMBED_URL` | 관리자 도구의 로그 iframe URL |
| `NEXT_PUBLIC_PROMETHEUS_URL` | 관리자 도구의 Prometheus 바로가기 URL |
| `NEXT_PUBLIC_RUM_SAMPLE_RATE` | Web Vitals 수집 샘플 비율 |
| `UPTIME_KUMA_PROXY_ORIGIN` | `/status/*` rewrite 대상 오리진 |
| `PLAYWRIGHT_BASE_URL` | live E2E 대상 URL |
| `BUNDLE_BUDGET_MARGIN_PERCENT` | 번들 예산 허용 오차(%) |
| `BUNDLE_BUDGET_ENFORCEMENT` | `strict` 또는 `warn` |

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
yarn contracts:generate
yarn contracts:check
```

Platform canonical bundle을 새 snapshot으로 반영할 때만 importer를 사용합니다.

```bash
node scripts/contracts/import-platform-contracts.mjs \
  --source <platform-checkout>/contracts/public-api \
  --output contracts/platform \
  --source-repository AquilaXk/aquila-blog \
  --source-commit <40-hex-commit>
```

## 검증 명령

```bash
yarn lint
yarn build
yarn check:bundle-size
yarn test:e2e:smoke
yarn test:e2e:perf
yarn test:e2e:live
```

## 번들 예산

- 경로별 baseline + margin 정책으로 관리합니다.
- 기본 검사 대상 경로: `/`, `/posts/[id]`, `/admin`
- raw/gzip/brotli를 함께 측정하고 리포트를 `test-results/bundle-size`에 생성합니다.

## 문서

- 운영 release: [docs/operations/web-release.md](docs/operations/web-release.md)
- 운영 rollback: [docs/operations/web-rollback.md](docs/operations/web-rollback.md)
- UI 릴리즈 QA: [docs/design/release-ui-qa-matrix.md](docs/design/release-ui-qa-matrix.md)
