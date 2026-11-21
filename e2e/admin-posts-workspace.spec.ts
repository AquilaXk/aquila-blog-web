import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

test.describe("admin posts workspace link contract", () => {
  test("posts workspace uses detail-like hero copy and checklist rail labels", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePage.tsx"), "utf8")
    const pageViewSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePageView.tsx"), "utf8")
    expect(pageViewSource).toContain('<h1>{adminT("navPosts", language)}</h1>')
    expect(source).not.toContain("최근 초안 복귀, 공개 상태 점검, 목록 필터링까지 지금 필요한 글 작업 흐름을 한곳에 모읍니다.")
    expect(source).not.toContain("<h2>검수 체크리스트</h2>")
    expect(source).not.toContain("<h2>상태 의미</h2>")
    expect(source).not.toContain("<h2>바로가기</h2>")
    expect(source).not.toContain("const WorkspaceRail = styled(AdminStickyRail)`")
  })

  test("관리자 글 목록은 Ghost + shadcn DataTable 행 에디터 진입 계약을 유지한다", () => {
    const listSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceList.tsx"), "utf8")
    const listStyleSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceList.styles.ts"), "utf8")
    const modelSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceModel.ts"), "utf8")
    const pageSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePage.tsx"), "utf8")
    const pageViewSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePageView.tsx"), "utf8")
    expect(modelSource).toContain('if (visibility === "PUBLIC_UNLISTED") return "링크 공개"')
    expect(listSource).toContain('from "./AdminPostsWorkspaceList.styles"')
    expect(listStyleSource).toContain("AdminStatusPill,")
    expect(listSource).toContain('<th scope="col">{adminT("tableColTitle", language)}</th>')
    expect(listSource).toContain('<th className="topicCell" scope="col">{adminT("tableColTopic", language)}</th>')
    expect(listSource).toContain('<th className="statusCell" scope="col">{adminT("tableColStatus", language)}</th>')
    expect(listSource).toContain('adminT("tableColDate", language)')
    expect(listSource).toContain('adminT("tableColViews", language)')
    expect(listSource).toContain('<th className="actionsCell" scope="col">{adminT("tableColActions", language)}</th>')
    const titleAnchorSource = listSource.match(/<TitleAnchor[\s\S]*?<\/TitleAnchor>/)?.[0] ?? ""
    expect(titleAnchorSource).toContain("ADMIN_POSTS_ROW_PRIMARY_ATTR")
    expect(titleAnchorSource).toContain("`/admin/editor/${encodeURIComponent(String(row.id))}`")
    expect(listSource).not.toContain('role={isDeletedScope ? undefined : "button"}')
    expect(listSource).toContain("onRestorePost(row)")
    expect(listSource).toContain("onHardDeletePost(row)")
    expect(listSource).toContain("onDeletePost(row)")
    expect(listSource).toContain("onClick={() => onPageChange(currentPage + 1)}")
    expect(listSource).toContain("<EnhancedPagination>")
    expect(listStyleSource).toContain("export const TitleAnchor = styled.a`")
    expect(listStyleSource).toContain("export const PostThumbnailSlot = styled.span`")
    expect(pageSource).toContain("listPage={listPage}")
    expect(pageSource).toContain("status: listStatus")
    expect(pageSource).not.toContain("for (let pageNumber")
    expect(pageSource).not.toContain("const displayListState = useMemo")
    expect(modelSource).toContain("if (isServerTempDraftPost(row)) return \"draft\"")
    expect(modelSource).toContain('query.set("status", options.status)')
    expect(listSource).toContain("workspaceStatusLabel(row, language)")
    expect(listSource).toContain("workspaceStatusTone(row)")
    expect(listSource).toContain('<div className="metaRow">')
    expect(listSource).toContain("getWorkspaceTopicLabel(row)")
    expect(listSource).toContain("formatWorkspaceViews(row)")
    expect(modelSource).toContain('category?: string | string[]')
    expect(modelSource).toContain('tags?: string[]')
    expect(listSource).toContain("TitleAnchor")
    expect(listSource).toContain('"글 보기"')
    expect(listSource).not.toContain("링크 복사")
    expect(pageViewSource).toContain('<h1>{adminT("navPosts", language)}</h1>')
    expect(pageViewSource).toContain("<UnifiedTableCard")
  })

  test("글 관리 API 실패 문구는 raw fetch detail을 사용자-facing 상태에 직접 노출하지 않는다", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePage.tsx"), "utf8")

    expect(source).toContain("POSTS_LIST_LOAD_ERROR_MESSAGE")
    expect(source).not.toContain("글 목록을 불러오지 못했습니다: ${message}")
    expect(source).not.toContain("최근 글을 불러오지 못했습니다: ${message}")
  })

  test("관리자 작성 화면은 V4 editor head에서 canonical 링크 액션을 노출하지 않는다", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/EditorStudioWorkspaceControllerRootView.tsx"),
      "utf8"
    )
    const editorSurfaceSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx"),
      "utf8"
    )

    expect(source).not.toContain("onOpenPostDetail")
    expect(source).not.toContain("onCopyPostDetailLink")
    expect(editorSurfaceSource).not.toContain("본문 형식 · Markdown")
    expect(editorSurfaceSource).not.toContain("onOpenPostDetail")
    expect(editorSurfaceSource).not.toContain("onCopyPostDetailLink")
    expect(editorSurfaceSource).not.toContain("상세 열기")
    expect(editorSurfaceSource).not.toContain("링크 복사")
  })

  test("V4 markdown editor는 code title snippet과 단일 live surface를 유지한다", () => {
    const source = [
      readFileSync(path.resolve(__dirname, "../src/components/markdown-editor/MarkdownEditor.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/components/markdown-editor/MarkdownEditorToolbar.tsx"), "utf8"),
    ].join("\n")
    const styleSource = [
      readFileSync(path.resolve(__dirname, "../src/components/markdown-editor/MarkdownEditor.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/components/markdown-editor/MarkdownEditorToolbar.styles.ts"), "utf8"),
    ].join("\n")
    const editorNewPageSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/editor/new.tsx"), "utf8")
    const editorPostPageSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/editor/[id].tsx"), "utf8")
    const controllerRootSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/EditorStudioWorkspaceControllerRoot.tsx"),
      "utf8"
    )
    const guideSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedSurfaceComponents.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedPanelParts.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioGuideModal.tsx"), "utf8"),
    ].join("\n")
    const editorSurfaceModelSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/editorStudioDedicatedSurfaceModel.ts"),
      "utf8"
    )
    const editorPartsSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioDedicatedPanelParts.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioEditorialStyles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/EditorStudioGuideModal.tsx"), "utf8"),
    ].join("\n")
    const controllerSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/EditorStudioWorkspaceControllerRootView.tsx"),
      "utf8"
    )
    const writerHostCalls = controllerSource.match(/<WriterEditorHost[\s\S]*?\/>/g) ?? []
    const editorRootStyle = editorPartsSource.match(/export const EditorStudioRoot = styled\.main`[\s\S]*?\n`/)?.[0] ?? ""
    const editorFrameStyle = editorPartsSource.match(/export const EditorStudioFrame = styled\.div(?:<[^>]*>)?`[\s\S]*?\n`/)?.[0] ?? ""
    const editorWritingColumnStyle =
      editorPartsSource.match(/export const EditorStudioWritingColumn = styled\.section(?:<[^>]*>)?`[\s\S]*?\n`/)?.[0] ?? ""
    const editorCanvasSectionStyle =
      editorPartsSource.match(/export const EditorStudioDedicatedCanvasSection = styled\.section`[\s\S]*?\n`/)?.[0] ?? ""
    const publishNoticeStyle = editorPartsSource.match(/export const PublishNotice = styled\.div`[\s\S]*?\n`/)?.[0] ?? ""
    const editorTagRowStyle = editorPartsSource.match(/export const EditorTagRow = styled\.div`[\s\S]*?\n`/)?.[0] ?? ""
    const selectedTagChipStyle = editorPartsSource.match(/export const SelectedTagChip = styled\.span`[\s\S]*?\n`/)?.[0] ?? ""
    const editorHeaderMetaRowStyle = editorPartsSource.match(/export const EditorHeaderMetaRow = styled\.div(?:<[^>]*>)?`[\s\S]*?\n`/)?.[0] ?? ""
    const editorMetaSectionStyle =
      editorPartsSource.match(/export const EditorStudioDedicatedMetaSection = styled\.section`[\s\S]*?\n`/)?.[0] ?? ""
    const titleInputStyle = editorPartsSource.match(/export const TitleInput = styled\.textarea`[\s\S]*?\n`/)?.[0] ?? ""
    const editorInspectorStyle = editorPartsSource.match(/export const EditorInspector = styled\.aside`[\s\S]*?\n`/)?.[0] ?? ""
    const inspectorTagInputRowStyle =
      editorPartsSource.match(/export const EditorInspectorTagInputRow = styled\.div`[\s\S]*?\n`/)?.[0] ?? ""
    const inspectorFullWidthActionStyle =
      editorPartsSource.match(/export const EditorInspectorFullWidthAction = styled\([^)]+\)`[\s\S]*?\n`/)?.[0] ?? ""
    const markdownEditorRootStyle = styleSource.match(/export const EditorRoot = styled\.section`[\s\S]*?\n`/)?.[0] ?? ""
    const markdownEditorToolbarStyle = styleSource.match(/export const EditorToolbar = styled\.div`[\s\S]*?\n`/)?.[0] ?? ""
    const markdownToolbarGroupStyle = styleSource.match(/export const ToolbarRailInner = styled\.div`[\s\S]*?\n`/)?.[0] ?? ""
    const liveEditorBodyStyle =
      styleSource.match(/export const LiveEditorBody = styled\.div(?:<[^>]*>)?`[\s\S]*?\n`/)?.[0] ?? ""

    expect(editorNewPageSource).toContain("getEditorStudioPageProps")
    expect(editorPostPageSource).toContain("getEditorStudioPageProps")
    expect(controllerRootSource).toContain('const isDedicatedEditorRoute = router.pathname.startsWith("/admin/editor")')
    expect(controllerSource).toContain("if (isDedicatedEditorRoute) {")
    expect(controllerSource).toContain("<EditorStudioDedicatedEditorSurface")
    expect(controllerSource).toContain("editorCanvas={dedicatedEditorCanvas}")
    expect(source).not.toContain("| Column 1 | Column 2 | Column 3 |")
    expect(source).toContain("title={snippet.title}")
    expect(source).toContain('id: "media.image"')
    expect(source).toContain('id: "media.file"')
    expect(source).toContain('aria-hidden="true"')
    expect(source).toContain("tabIndex={-1}")
    expect(source).toContain("onUploadFile")
    expect(source).toContain("<MarkdownEditorLiveSurface")
    expect(source).not.toContain("previewTitle?: string")
    expect(source).not.toContain("previewSummary?: string")
    expect(source).not.toContain("MarkdownRenderer")
    expect(source).not.toContain("markdown-editor-preview-pane")
    expect(source).not.toContain("<h1>캐시가 빨라질수록")
    expect(styleSource).toContain("@media (max-width: 820px)")
    expect(styleSource).not.toContain("@media (max-width: 980px)")
    expect(styleSource).not.toContain('[data-mode="split"]')
    expect(source).not.toContain("previewScrollRef")
    expect(source).not.toContain("handlePreviewScroll")
    expect(source).not.toContain("handlePreviewWheel")
    expect(markdownEditorRootStyle).toContain("box-sizing: border-box;")
    expect(markdownEditorRootStyle).toContain("width: 100%;")
    expect(markdownEditorRootStyle).toContain("max-width: 100%;")
    expect(markdownEditorRootStyle).toContain("min-width: 0;")
    expect(markdownEditorToolbarStyle).toContain("box-sizing: border-box;")
    expect(markdownEditorToolbarStyle).toContain("position: sticky;")
    expect(markdownEditorToolbarStyle).toContain("top: 0;")
    expect(markdownEditorToolbarStyle).toContain("width: 100%;")
    expect(markdownEditorToolbarStyle).toContain("max-width: 100%;")
    expect(markdownEditorToolbarStyle).toContain("min-width: 0;")
    expect(markdownToolbarGroupStyle).toContain("min-width: 0;")
    expect(markdownToolbarGroupStyle).toContain("max-width: 100%;")
    expect(markdownToolbarGroupStyle).toContain("flex-wrap: wrap;")
    expect(markdownToolbarGroupStyle).toContain("overflow: visible;")
    expect(styleSource).toContain("white-space: nowrap;")
    expect(liveEditorBodyStyle).toContain("min-height: 0;")
    expect(liveEditorBodyStyle).toContain("min-width: 0;")
    expect(liveEditorBodyStyle).toContain("max-width: 100%;")
    expect(liveEditorBodyStyle).not.toContain("min-height: 640px;")
    expect(liveEditorBodyStyle).toContain("overscroll-behavior: contain;")
    expect(liveEditorBodyStyle).toContain(".cm-editor.cm-focused")
    expect(writerHostCalls).toHaveLength(1)
    expect(writerHostCalls.every((call) => !call.includes("previewTitle") && !call.includes("previewSummary"))).toBe(true)
    expect(controllerSource).not.toContain("캐시가 빨라질수록")
    expect(controllerSource).not.toContain("ETag, Redis, CDN")
    expect(controllerSource).toContain("postTags={postTags}")
    expect(controllerSource).toContain("postTitle={postTitle}")
    expect(controllerSource).toContain("postSummary={postSummary}")
    expect(controllerSource).toContain("postVisibility={postVisibility}")
    expect(controllerSource).toContain("onPostSummaryChange={handlePostSummaryChange}")
    expect(controllerSource).toContain("onPostVisibilityChange={setPostVisibility}")
    expect(controllerSource).not.toContain("handleRecommend")
    expect(controllerSource).not.toContain('loadingKey === "recommend')
    expect(guideSource).not.toContain("EditorInspectorPreview")
    expect(guideSource).not.toContain("thumbnailPreviewLabel")
    expect(guideSource).not.toContain('|| "DRAFT"')
    expect(guideSource).toContain("value={postTitle}")
    expect(guideSource).toContain("value={postSummary}")
    expect(guideSource).toContain("value={postVisibility}")
    expect(guideSource).toContain("{postTags.map((tag) => (")
    expect(guideSource).toContain("const handleTagDraftChange = (nextValue: string) =>")
    expect(guideSource).toContain("const handleTagDraftKeyDown: KeyboardEventHandler<HTMLInputElement>")
    expect(guideSource).toContain("<EditorInspectorTagInputRow>")
    expect(guideSource).not.toContain("onRecommend")
    expect(guideSource).not.toContain("isRecommend")
    expect(guideSource).toContain("placeholder=\"태그 추가\"")
    expect(guideSource).toContain("useDeferredValue")
    expect(guideSource).not.toContain("documentInsights")
    expect(guideSource).not.toContain("캐시가 빨라질수록 더 중요해지는 무효화 전략")
    expect(guideSource).not.toContain("ETag, Redis, CDN surrogate key")
    expect(guideSource).not.toContain("2026.06.19")
    expect(guideSource).not.toContain("2.1K")
    expect(editorSurfaceModelSource).toContain("export const countMarkdownLinkWarnings = (markdown: string) =>")
    expect(editorSurfaceModelSource).toContain("destLen === 0 ||")
    expect(editorSurfaceModelSource).toContain('(destLen === 7 && markdown.startsWith("http://", closeBracket + 2))')
    expect(editorSurfaceModelSource).toContain('(destLen === 8 && markdown.startsWith("https://", closeBracket + 2))')
    expect(guideSource).toContain("countMarkdownLinkWarnings(deferredPostContent)")
    expect(guideSource).toContain('aria-label="발행 설정"')
    expect(guideSource).toContain("<h3>글 설정</h3>")
    expect(guideSource).toContain("<span>공개 범위</span>")
    expect(guideSource).toContain("<span>요약</span>")
    expect(guideSource).toContain("<span>분류 (선택)</span>")
    expect(guideSource).toContain("하나의 글에는 넓은 분류를 하나만 선택하세요. 세부 키워드는 태그로 추가할 수 있습니다.")
    expect(guideSource).toContain("<span>태그</span>")
    expect(guideSource).toContain("{linkWarningCount > 0 ? (")
    expect(guideSource).toContain("링크 주소가 비어 있거나 http:// 또는 https://만 입력된 링크가 {linkWarningCount}개 있습니다.")
    expect(guideSource).toContain('role="alert"')
    expect(guideSource).not.toContain("Quality checks")
    expect(guideSource).not.toContain("hasTitleAndBody")
    expect(guideSource).not.toContain("hasMarkdownBody")
    expect(guideSource).not.toContain('linkWarningCount === 0 ? "PASS"')
    expect(guideSource).not.toContain("<strong>요약</strong>")
    expect(guideSource).not.toContain("ETag, Redis, CDN")
    expect(guideSource).not.toContain("ETAG")
    expect(guideSource).not.toContain("INVALIDATION")
    expect(editorRootStyle).toContain("height: 100vh;")
    expect(editorRootStyle).toContain("height: 100dvh;")
    expect(editorRootStyle).toContain("min-height: 100dvh;")
    expect(editorRootStyle).toContain("grid-template-rows: 56px minmax(0, 1fr);")
    expect(editorRootStyle).toContain("overflow: hidden;")
    expect(editorRootStyle).toContain("theme.publicDesign.readableSurface")
    expect(editorRootStyle).not.toContain("grid-template-rows: auto 1fr;")
    expect(editorPartsSource).toContain("height: 56px;")
    expect(editorPartsSource).toContain("min-height: 56px;")
    expect(editorPartsSource).toContain("grid-template-columns: auto minmax(0, 1fr) auto;")
    expect(editorPartsSource).toContain("gap: 14px;")
    expect(editorPartsSource).toContain("padding: 0 24px;")
    expect(editorFrameStyle).toContain("min-height: 0;")
    expect(editorFrameStyle).toContain("width: 100%;")
    expect(editorFrameStyle).toContain("max-width: 100%;")
    expect(editorFrameStyle).toContain("overflow-x: hidden;")
    expect(editorFrameStyle).toContain("overflow-y: auto;")
    expect(editorPartsSource).toContain("letter-spacing: -0.015em;")
    expect(editorPartsSource).toContain("display: flex;")
    expect(editorPartsSource).toContain("gap: 8px;")
    expect(editorMetaSectionStyle).toContain("gap: 0;")
    expect(editorMetaSectionStyle).toContain("border: 0;")
    expect(editorMetaSectionStyle).toContain("theme.publicDesign.readableSurface")
    expect(editorMetaSectionStyle).toContain("width: 100%;")
    expect(editorMetaSectionStyle).toContain("max-width: 100%;")
    expect(editorMetaSectionStyle).toContain("box-sizing: border-box;")
    expect(titleInputStyle).toContain("max-width: 100%;")
    expect(editorTagRowStyle).toContain("gap: 7px;")
    expect(editorTagRowStyle).toContain("min-height: 26px;")
    expect(selectedTagChipStyle).toContain("min-height: 24px;")
    expect(selectedTagChipStyle).toContain("font: 650 11px/1 ui-monospace")
    expect(selectedTagChipStyle).not.toContain("transform 0.18s ease")
    expect(selectedTagChipStyle).not.toContain("transform: none;")
    expect(editorHeaderMetaRowStyle).toContain("gap: 10px;")
    expect(editorHeaderMetaRowStyle).toContain("margin-top: 12px;")
    expect(editorHeaderMetaRowStyle).not.toContain("justify-content: space-between;")
    expect(editorWritingColumnStyle).toContain("position: relative;")
    expect(editorWritingColumnStyle).toContain("grid-template-rows: auto minmax(0, 1fr);")
    expect(editorWritingColumnStyle).toContain("overflow: hidden;")
    expect(editorCanvasSectionStyle).toContain("overflow: visible;")
    expect(editorCanvasSectionStyle).toContain("border: 0;")
    expect(editorCanvasSectionStyle).toContain("width: 100vw;")
    expect(editorCanvasSectionStyle).toContain("max-width: 100vw;")
    expect(editorCanvasSectionStyle).toContain("box-sizing: border-box;")
    expect(editorCanvasSectionStyle).not.toContain("border: 1px solid")
    expect(publishNoticeStyle).toContain("position: absolute;")
    expect(publishNoticeStyle).toContain("top: 10px;")
    expect(publishNoticeStyle).toContain("border-radius: 999px;")
    expect(publishNoticeStyle).not.toContain("border-radius: 10px;")
    expect(editorPartsSource).toContain("padding: 28px 40px 0;")
    expect(editorPartsSource).not.toContain("export const EditorInspectorPreview")
    expect(editorPartsSource).toContain("@media (max-width: 1100px)")
    expect(editorPartsSource).toContain('"236px minmax(0, 1fr)"')
    expect(editorPartsSource).toContain("grid-template-rows: minmax(0, 1fr) auto;")
    expect(editorPartsSource).toContain("@media (max-width: 820px)")
    expect(editorPartsSource).toContain("z-index: ${zIndexes.editorGuide};")
    expect(editorPartsSource).toContain("background: ${overlayScrim.sheet};")
    expect(editorPartsSource).toContain("width: min(100%, 560px);")
    expect(editorPartsSource).toContain("height: 58px;")
    expect(editorInspectorStyle).toContain("letter-spacing: -0.01em;")
    expect(editorInspectorStyle).toContain("grid-column: 1 / -1;")
    expect(editorInspectorStyle).toContain("max-height: min(38vh, 360px);")
    expect(editorInspectorStyle).not.toContain("display: none;")
    expect(inspectorTagInputRowStyle).toContain("display: flex;")
    expect(inspectorTagInputRowStyle).toContain("min-width: 0;")
    expect(inspectorFullWidthActionStyle).toContain("width: 100%;")
    expect(inspectorFullWidthActionStyle).toContain("margin-top: 8px;")
    expect(guideSource).toContain("### 제목 3")
    expect(guideSource).toContain("- [ ] 예정")
    expect(guideSource).toContain('```kotlin title=\\"invalidatePost.kt\\"')
    expect(guideSource).toContain("CONFIG.projects?.[0]")
    expect(guideSource).toContain("프로젝트 리포지터리")
  })

  test("V4 상세 헤더는 reference 샘플 대신 backend post 데이터를 사용한다", () => {
    const headerSource = readFileSync(path.resolve(__dirname, "../src/routes/Detail/PostDetail/PostHeader.tsx"), "utf8")
    const headerStyleSource = readFileSync(path.resolve(__dirname, "../src/routes/Detail/PostDetail/PostHeader.styles.ts"), "utf8")
    const mapperSource = readFileSync(path.resolve(__dirname, "../src/apis/backend/posts/PostApiMappers.ts"), "utf8")
    const metadataSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Detail/PostDetail/postDetailMetadataModel.ts"),
      "utf8"
    )

    expect(mapperSource).toContain('post.authorName || post.authorUsername || "익명"')
    expect(headerSource).toContain("<h1 className=\"title\">{data.title}</h1>")
    expect(headerSource).toContain('alt={`${authorName} profile image`}')
    expect(headerSource).toContain("width={38}")
    expect(headerSource).toContain("height={38}")
    expect(headerStyleSource).toContain("width: 100%;")
    expect(headerStyleSource).toContain("margin: 0 auto;")
    expect(headerStyleSource).toContain("padding: 2rem 0 2rem;")
    expect(headerStyleSource).toContain("text-align: center;")
    expect(headerStyleSource).toContain("border-bottom: 1px solid var(--aq-border);")
    expect(headerStyleSource).not.toContain(".taxonomyRow")
    expect(headerStyleSource).not.toContain(".staticTag")
    expect(headerStyleSource).toContain("letter-spacing: -0.025em;")
    expect(headerStyleSource).not.toContain("max-width: 14ch;")
    expect(headerStyleSource).not.toContain("@media (max-width: 768px)")
    expect(headerStyleSource).toContain("@media (min-width: ${breakpoint.md}px)")
    expect(headerStyleSource).toContain("gap: 12px 20px;")
    expect(headerStyleSource).toContain("font-size: 0.8125rem;")
    expect(headerStyleSource).toContain("line-height: 1.4;")
    expect(headerStyleSource).toContain("border: 0;")
    expect(headerStyleSource).toContain("width: 38px;")
    expect(headerStyleSource).toContain("height: 38px;")
    expect(headerStyleSource).not.toContain("width: 48px;")
    expect(headerStyleSource).not.toContain("height: 48px;")
    expect(headerStyleSource).not.toContain("border-bottom: 1px solid #dfe1e5;")
    expect(headerSource).toContain("const postAuthor = data.author?.find((author) => author.name?.trim()) ?? null")
    expect(headerSource).toContain('const fallbackAuthor = locale.startsWith("en") ? "Anonymous" : "익명"')
    expect(headerSource).toContain("const authorName = data.authorName?.trim() || postAuthor?.name?.trim() || fallbackAuthor")
    expect(headerSource).toContain('postAuthor?.profile_photo || ""')
    expect(headerSource).not.toContain("usingAdminFallback")
    expect(headerSource).not.toContain("adminProfile?.profileImageUrl")
    expect(headerSource).not.toContain("profileImageDirectUrl")
    expect(headerSource).toContain("const resolvePrimaryTaxonomy = (data: PostDetail): string =>")
    expect(headerSource).toContain("return [primaryTaxonomy, typeLabel].filter(Boolean)")
    expect(headerSource).not.toContain("CONFIG.profile.image")
    expect(headerSource).toContain('<span className="avatarFallback" aria-hidden="true">')
    expect(headerSource).toContain('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2')
    expect(headerStyleSource).toContain(".avatarFallback")
    expect(headerStyleSource).not.toContain(".avatarFallback::before")
    expect(headerStyleSource).not.toContain(".avatarFallback::after")
    expect(headerSource).toContain("if (!authorName) return null")
    expect(headerSource).toContain("<strong>{authorName}</strong>")
    expect(headerSource).not.toContain("useRootAdminProfile")
    expect(metadataSource).toContain('post.author?.find((author) => author.name.trim().length > 0)?.name.trim() ||\n  "익명"')
    expect(metadataSource).not.toContain("CONFIG.profile.name")
    expect(headerSource).toContain("const viewText =")
    expect(headerSource).toContain("getNumberFormatter(locale).format(viewCount)")
    expect(headerSource).toContain("<span className=\"statChip\">{publishedAt}</span>")
    expect(headerSource).not.toContain("{readTimeText}")
    expect(headerSource).toContain("<span className=\"statChip\">{viewText}</span>")
    expect(headerSource).toContain('t("postUpdatedLabel")')
    expect(headerSource).not.toContain("댓글 {data.commentsCount ?? 0}")
    expect(headerSource).toContain("likesCount ?? data.likesCount ?? 0")
    expect(headerSource).not.toContain("캐시가 빨라질수록")
    expect(headerSource).not.toContain("ETag")
    expect(headerSource).not.toContain("2.1K")
    expect(headerSource).not.toContain("11분")
  })

  test("canonical detail uses request-time SSR without stored body recovery", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/libs/server/postDetailPage.ts"), "utf8")

    const page = readFileSync(path.resolve(__dirname, "../src/pages/posts/[id].tsx"), "utf8")
    expect(page).toContain("export const getServerSideProps")
    expect(page).not.toContain("getStaticProps")
    expect(page).not.toContain("getStaticPaths")
    expect(source).toContain('res.setHeader("Cache-Control", "private, no-store")')
    expect(source).not.toContain("revalidate:")
    expect(source).not.toContain("shouldClientRecover")
  })
})
