# Aquila Blog Web

**개인 기술 블로그, 마크다운 에디터 스튜디오, 제품·서비스 소개 및 다운로드 표면을 제공하는 프론트엔드 웹 애플리케이션**

Aquila Blog Web은 [blog.aquilaxk.site](https://blog.aquilaxk.site)와 [www.aquilaxk.site](https://www.aquilaxk.site)의 화면과 SSR 프록시 계층을 담당하는 Next.js(Pages Router) 저장소입니다. 라이트 전용 디자인 토큰, 네이티브 `<img>` 표준, 에디터·렌더러 단일 구문 스펙을 기준으로 동작합니다.

백엔드 API, 데이터베이스, 홈서버 인프라, 공개 API 계약 정본 생성은 [AquilaXk/aquila-blog](https://github.com/AquilaXk/aquila-blog)이 소유합니다. 이 저장소는 플랫폼 저장소의 공개 계약 스냅샷(`contracts/platform/manifest.lock.json`)을 타입으로 가져와 계약 드리프트를 검증합니다.

## 할 수 있는 일

* 기술 블로그와 아카이브(`/`, `/posts/[id]`, `/about`): 피드 탐색, 커서 기반 목록, 검색·태그 필터, 목차·수식·다이어그램·코드 블록 렌더링
* 마크다운 에디터 스튜디오(`/admin/editor/new`, `/admin/editor/[id]`): CodeMirror 6 기반 실시간 프리뷰, 커스텀 디렉티브(`:::callout`, `:::toggle`, `:::bookmark`, `:::embed`), 이미지 업로드·리비전 관리
* 제품·서비스 쇼케이스와 다운로드(`/company`, `/download`): 서비스 소개 화면과 EasyOffice 릴리스(`latest.json`, `SHA256SUMS.txt`) 자동 연동 다운로드 안내
* 관리자 워크스페이스(`/admin`, `/admin/profile`, `/admin/posts`, `/admin/tools`): 세션 관리, 프로필 워크스페이스 편집·발행, 운영 지표 확인
* 정적·성능 가드: 번들 크기 예산, 디자인 토큰 검사, 런타임 이미지 페이로드 검사, CSP 헤더 검증

운영 배포와 롤백 절차는 [Web Release Runbook](docs/operations/web-release.md)과 [Web Rollback Runbook](docs/operations/web-rollback.md)에, 프론트엔드 규칙과 보안 CSP 정책은 [Frontend Working Guide](docs/design/Frontend-Working-Guide.md)와 [Security CSP Rollout](docs/design/security-csp-rollout.md)에 있습니다.

## 개발하기

```sh
yarn install --frozen-lockfile   # 의존성 설치 (Node.js 20 LTS, Yarn 1.22.22)
yarn dev                         # 로컬 개발 서버 실행 (http://localhost:3000)
yarn build                       # 프로덕션 빌드
```

로컬 실행 시 `.env.local` 또는 환경변수로 `NEXT_PUBLIC_BACKEND_URL`과 `BACKEND_INTERNAL_URL`을 설정합니다. 플랫폼 저장소의 최신 공개 API 계약을 반영할 때는 아래 순서로 동기화합니다.

```sh
yarn contracts:import:local
yarn contracts:generate
yarn contracts:check
```

## 검증하기

```sh
node scripts/repo-boundary/check-web-root.mjs
node scripts/repo-boundary/check-web-boundary.mjs
yarn lint
yarn type-check
yarn check:refactor-boundaries
yarn check:design-colors
yarn contracts:check
yarn test:unit
```

렌더링·정적 자산·번들 변경 시 `yarn build && yarn check:bundle-size && yarn check:runtime-image-payload && yarn test:e2e:smoke`로 회귀를 확인합니다.

## 문제 신고

버그는 [이슈 양식](https://github.com/AquilaXk/aquila-blog-web/issues/new/choose)으로 신고해 주세요. 기능 요청과 PR은 받지 않습니다. 보안 문제 신고는 [SECURITY.md](SECURITY.md)에 있습니다.

## 라이선스

가져다 쓴 코드의 출처와 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다. 블로그 본문과 미디어 콘텐츠([blog.aquilaxk.site](https://blog.aquilaxk.site))는 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)을 따릅니다.

License: MIT
