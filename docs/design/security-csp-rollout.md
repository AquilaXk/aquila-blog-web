# Frontend CSP Rollout

## 목적
- `next.config.js`의 `Content-Security-Policy`는 운영 차단 정책으로 유지한다.
- 새 외부 script, API, image, iframe, monitoring origin을 추가할 때는 개발·스테이징 환경에서 콘솔 위반 여부를 먼저 확인한 뒤 `src/libs/security/contentSecurityPolicy.js`에 반영한다.

## 현재 정책
- `default-src 'self'`를 기본값으로 둔다.
- `script-src`는 Next.js runtime(`'self'`)과 document inline script **sha256 hash**만 허용한다. **`'unsafe-inline'`은 사용하지 않는다**.
- document inline script 본문과 hash 계약은 `src/libs/security/documentInlineScripts.js` + `src/libs/security/contentSecurityPolicy.js`가 소유한다.
- `style-src`는 Emotion/Next.js inline style 운용을 위해 `'self' 'unsafe-inline'`을 유지한다.
- `img-src`는 `'self'`, `data:`, `blob:`, `https://*.aquilaxk.site`, `configuredRuntimeOrigins()`, 명시 허용 이미지 호스트만 통과시킨다(임의 `http:`/`https:` 와일드카드는 허용하지 않는다).
- `connect-src`의 `http://localhost:8080`, `http://127.0.0.1:8080`은 development build의 로컬 백엔드 fallback용으로만 포함한다.
- per-request nonce + 전면 dynamic rendering은 SSG 비용이 커서 hash enforce 방식을 사용한다. `next.config.js`는 별도 `Content-Security-Policy-Report-Only` 헤더를 중복 발행하지 않고 차단 정책 단일 헤더를 정본으로 내려준다.

## Monitoring iframe (Caddy)
- Grafana/Uptime 응답에서 CSP를 빈 상태로 strip하지 않는다.
- Caddy가 `Content-Security-Policy: frame-ancestors {$ADMIN_EMBED_ORIGINS}`를 내려 admin UI origin allowlist만 iframe parent로 허용한다.
- `ADMIN_EMBED_ORIGINS`는 space-separated origin 목록이며 플랫폼 저장소의 `.env.prod` / `.env.caddy.prod`로 materialize한다.

## 변경 절차
1. 새 외부 origin이 필요한 경우 `src/libs/security/contentSecurityPolicy.js`에 추가할 origin과 사유를 정리한다.
2. preview 또는 로컬 프로덕션 빌드에서 브라우저 콘솔 CSP 위반이 없는지 확인한다.
3. path·query string·광역 와일드카드 허용을 피하고 필요한 origin만 명시한다.
4. `e2e/security-csp-header.spec.ts`에 새 source 계약을 추가한 뒤 적용한다.

## Violation Triage
- `script-src`: 새 script host가 필요한지 먼저 확인한다. 새 document inline script는 hash를 `documentInlineScripts.js`에 추가하고 `'unsafe-inline'`으로 되돌리지 않는다.
- `connect-src`: API, analytics, SSE/WebSocket endpoint인지 확인하고 credential 전송 범위를 함께 본다.
- `img-src`: 허용 이미지 origin 목록 확장이 필요한 경우 `contentSecurityPolicy.js` `imageSources`와 CSP 회귀 테스트를 함께 갱신한다.
- `frame-src`: 실제 iframe이 필요한 monitoring origin만 추가한다.
- `style-src`: Emotion 호환을 위해 `'unsafe-inline'`을 유지한다.

## 검증
- `PLAYWRIGHT_USE_WEBSERVER=false yarn playwright test e2e/security-csp-header.spec.ts --workers=1`
- `yarn build`
- 배포 후 실제 페이지 브라우저 콘솔에 CSP 위반 로그가 없는지 확인한다.
- Grafana/Uptime 응답에 `frame-ancestors` admin allowlist가 있는지 header dump로 확인한다.
