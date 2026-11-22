# Frontend Working Guide

프론트엔드 SSR/CSR 공통 운영 규칙. 화면별 세부 가이드는 관련 design 문서를 따른다.

## SSR 에러 처리

JSON을 소비하는 SSR 데이터 로딩은 `serverApiFetchJson`을 사용한다.
성공 시 파싱된 JSON을 반환하고, 실패 시 공용 `ApiError`(status/body/`userMessage` 규칙 동일)를 throw한다.
raw `serverApiFetch`는 스트리밍·특수 Response 소비에만 남긴다.

공개 ISR(홈/글 상세)처럼 request cookie 전달이 필요 없는 정적 경로는 `apiFetch`를 계속 쓸 수 있다.
이 경우에도 실패 타입은 동일한 `ApiError`/`ApiNetworkError`/`ApiTimeoutError`다.

### Decision tree

| 페이지 유형 | 실패 시 동작 |
|---|---|
| 공개 GSP/ISR (홈) | `BACKEND_INTERNAL_URL` 호출 실패를 `catch`하면 `status: "degraded"`와 빈 초기 목록(`revalidate: 15`)을 반환한다. 기존 ISR 캐시가 있으면 유지하고 `FeedExplorer`가 안내 상태와 클라이언트 재시도를 제공한다 |
| 공개 GSSP (글 상세) | 미존재 시 `notFound: true`, 백엔드 오류 시 throw → 500 에러 페이지 |
| admin GSSP | 401/403 → 로그인 redirect(또는 auth cookie 있을 때 fallback guard). 그 외(5xx/network/timeout) → throw하여 Next 500 (`destination: null` 금지). `timed()`로 bootstrap을 감싼 경우에도 `!ok`면 즉시 rethrow해 fallback으로 삼키지 않는다 |
| RSS/feed | 503 + `console.error` |

### 구현 위치

- `src/libs/server/backend.ts` — `serverApiFetch` / `serverApiFetchJson`
- `src/libs/server/adminPage.ts` — `readAdminProtectedBootstrap`
- `src/pages/feed.tsx` — RSS 503 경로
- `src/pages/index.tsx`, `src/libs/server/postDetailPage.ts` — fail-fast 에러 전파 및 notFound 가드

## 관련 의사결정 문서

- 마크다운 에디터 및 공개 렌더러 파서·수식·센티넬·CodeMirror 6 장식 아키텍처와 트레이드오프는 `docs/design/markdown-editor-and-renderer-decisions.md`를 따른다.
