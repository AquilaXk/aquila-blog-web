# TODO

- `src/routes/Admin/useEditorStudioPersistenceModel.ts`, `src/routes/Admin/EditorStudioWorkspaceControllerRootView.tsx`: 백엔드에서 폐기된 일반 첨부파일 업로드(`POST /post/api/v1/posts/files`) 호출 경로 및 파일 첨부 UI 정리
- `src/pages/index.tsx`, `src/routes/Feed/index.tsx`: 관리자 프로필 설정(`/admin/profile`)의 `homeIntroTitle`, `profileRole`, `profileBio` 필드를 공개 홈(`/`)에 렌더링하거나 미사용 설정 섹션 정리
- `src/routes/Admin/AdminPostsWorkspaceList.tsx`: 글 관리 목록 좌측의 무반응 체크박스 열(`.selectCell`)에 일괄 선택·작업 기능을 연결하거나 장식용 열 제거
- `src/routes/Admin/AdminDashboardWorkspaceView.tsx`: 운영 대시보드 비율 차트의 오표기 제목(`Public read latency`) 및 로그 헤더의 `Loki · production` 하드코딩 수정
- `src/routes/Admin/AdminSearchRuntimeControlSection.tsx`: 검색 런타임 제어 화면 진입 시 `GET /system/api/v1/adm/search/runtime-flags`로 초기 플래그 상태를 조회하도록 연결
- `src/components/MetaConfig/index.tsx`: `og:image` 및 `twitter:image` 생성 시 `resolveMetadataImageUrl`을 적용해 `/easysubway` 등 상대 경로 이미지를 절대 URL로 변환
- `src/layouts/RootLayout/Header/NavBar.tsx`, `src/routes/Detail`, `src/pages/about.tsx`, `src/pages/500.tsx`, `src/routes/Admin/AdminToolsWorkspaceView.tsx`: 상단 `KO/EN` 토글 적용 범위를 글 상세·소개·오류 페이지까지 확장하고 관리자 도구 화면의 한/영 혼용 문구 통일
- `src/routes/Feed/FeedExplorer.tsx`, `src/routes/Feed/FeedExplorerRestoreModel.ts`: 피드 검색어(`q`)·정렬(`sortMode`)의 URL 쿼리 동기화 및 비기본 정렬 시 뒤로가기 세션 복원 지원
- `src/layouts/RootLayout/Header/NavBarSearchModel.tsx`: 데스크톱에서 상단 `태그`(`/#topics`) 클릭 시 좌측 토픽 레일 포커스 이동 및 하이라이트 피드백 제공
- `src/styles`, `src/design-system`, `src/routes/Admin/adminColorTokens.ts`, `scripts/check-design-colors.mjs`: 4중 파편화된 디자인 토큰과 미사용 다크모드 분기를 정리하고 `check-design-colors.mjs` 검사 범위에 `Detail`, `About`, `Admin`, `markdown-editor`, `libs/markdown` 추가
- `src/design-system/StatePresenters.tsx`, `src/pages/posts/[id].tsx`, `src/routes/Feed/PostList/index.tsx`, `src/routes/Admin/AdminPostsWorkspaceList.styles.ts`: 중복 정의된 라우트별 스켈레톤 UI를 공통 프리미티브로 통합
- `src/routes/Admin/EditorStudioWorkspaceControllerRoot.tsx`, `src/routes/Admin/editorStudioMetaModel.ts`: 에디터 워크스페이스의 대형 Props Bag(78개 프로퍼티) 및 비트마스크(`uiMask`) 패킹 단순화
