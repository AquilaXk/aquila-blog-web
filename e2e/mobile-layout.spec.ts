import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

const readSourceFile = (sourcePath: string) => readFileSync(path.resolve(__dirname, "..", sourcePath), "utf8")

test.describe("모바일 레이아웃 소스 경계", () => {
  test("공개 화면 토큰과 관리자 MYBOX 토큰은 분리하고 본문 타이포그래피를 변경하지 않는다", () => {
    const publicSurfaceSources = [
      "src/routes/Feed/index.tsx",
      "src/routes/Feed/PostList/PostCard.tsx",
      "src/routes/Feed/SearchInput.tsx",
      "src/routes/Feed/TagList.tsx",
      "src/routes/Detail/PostDetail/PostDetail.styles.ts",
      "src/routes/Detail/PostDetail/PostDetailSection.styles.ts",
      "src/routes/Detail/PostDetail/PostHeader.styles.ts",
    ].map((sourcePath) => [sourcePath, readSourceFile(sourcePath)] as const)
    const aboutSource = readSourceFile("src/routes/About/AboutPage.styles.ts")
    const themeSource = readSourceFile("src/styles/theme.ts")
    const articleSurfaceSource = [
      readSourceFile("src/routes/Detail/PostDetail/PostDetail.styles.ts"),
      readSourceFile("src/routes/Detail/PostDetail/PostDetailSection.styles.ts"),
      readSourceFile("src/routes/Detail/PostDetail/PostHeader.styles.ts"),
    ].join("\n")
    const rootLayoutSource = readSourceFile("src/layouts/RootLayout/index.tsx")
    const adminColorTokenSource = readSourceFile("src/routes/Admin/adminColorTokens.ts")
    const adminSurfaceSource = readSourceFile("src/routes/Admin/AdminSurfacePrimitives.tsx")
    const adminShellSource = readSourceFile("src/routes/Admin/AdminShell.tsx")
    const adminToolsSource = [
      readSourceFile("src/pages/admin/tools.tsx"),
      readSourceFile("src/routes/Admin/AdminToolsWorkspace.styles.ts"),
      readSourceFile("src/routes/Admin/AdminToolsWorkspace.styles.tokens.ts"),
      readSourceFile("src/routes/Admin/AdminToolsWorkspace.styles.layout.ts"),
    ].join("\n")
    const adminDashboardSource = [
      readSourceFile("src/pages/admin/dashboard.tsx"),
      readSourceFile("src/routes/Admin/AdminDashboardWorkspace.styles.ts"),
      readSourceFile("src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts"),
      readSourceFile("src/routes/Admin/AdminDashboardWorkspace.styles.priority.ts"),
    ].join("\n")
    const errorSource = readSourceFile("src/routes/Error/index.tsx")
    const editorComposeSource = [
      readSourceFile("src/routes/Admin/EditorStudioComposeWritingSurface.tsx"),
      readSourceFile("src/routes/Admin/EditorStudioComposeWritingSurfaceParts.tsx"),
    ].join("\n")
    const editorDedicatedSource = [
      readSourceFile("src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx"),
      readSourceFile("src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx"),
    ].join("\n")

    expect(themeSource).toContain("createPublicDesignTokens")
    expect(themeSource).not.toContain('blogDesign === "grid"')
    expect(themeSource).not.toContain("#101214")
    expect(themeSource).not.toContain("#ca6")
    expect(themeSource).toContain("pageBackgroundColor: scheme === \"light\"")
    expect(themeSource).toContain("readableSurface")
    expect(themeSource).toContain("operationSurface")
    expect(themeSource).toContain("operationSurfaceElevated")
    expect(rootLayoutSource).toContain('const isDesignAwareRoute = pathname[1] !== "_" && pathname !== "/sitemap.xml"')
    expect(rootLayoutSource).toContain(
      'const effectiveBlogDesign = isAdminRoute ? adminProfile?.blogDesign || "legacy" : "legacy"'
    )
    expect(rootLayoutSource).toContain('const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")')
    expect(rootLayoutSource).toContain("const isFullBleedRoute = isDedicatedEditorRoute || isAdminRoute")
    expect(rootLayoutSource).toContain("<LayoutShell $fullBleed={isFullBleedRoute}>")
    // 독립 표면(회사·제품)은 자기 <main>을 소유한다. 그 라우트에서만 이 레이아웃의 껍데기를 div로
    // 내려 main 랜드마크 중첩을 막는다 - 중첩은 화면에 아무 흔적을 남기지 않으므로 소스 경계로도
    // 고정한다(런타임 단언은 e2e/accessibility.spec.ts).
    expect(rootLayoutSource).toContain(
      "const LayoutShell = isStandaloneSurfaceRoute ? StandaloneShell : StyledMain"
    )
    expect(rootLayoutSource).toContain('const StandaloneShell = StyledMain.withComponent("div")')
    expect(rootLayoutSource).not.toContain("resolvePublicBlogAppearance(isDesignAwareRoute ? adminProfile : null)")
    expect(adminColorTokenSource).toContain("export const adminSystemThemeVariables = (theme: Theme) =>")
    expect(adminColorTokenSource).toContain('theme.scheme === "dark" ? adminDarkThemeVariables : adminLightThemeVariables')
    // 패밀리룩 토큰 통합(#1218): admin 팔레트는 공용 토큰에서 파생되며 자체 블루를 하드코딩하지 않는다.
    expect(adminColorTokenSource).toContain("createPublicDesignTokens")
    expect(adminColorTokenSource).toContain("--admin-app-bg: ${d.pageBackgroundColor};")
    expect(adminColorTokenSource).not.toContain("#0969da")
    expect(adminSurfaceSource).toContain("adminPlainSurface(theme)")
    expect(adminShellSource).toContain("adminSystemThemeVariables(theme)")
    expect(adminShellSource).toContain("background: ${adminAppBackground};")
    expect(adminToolsSource).toContain("adminSurface")
    expect(adminToolsSource).toContain("adminSurfaceRaised")
    expect(adminDashboardSource).toContain("adminSurface")
    expect(errorSource).toContain("theme.colors.gray1")
    expect(editorComposeSource).toContain("theme.publicDesign")
    expect(editorDedicatedSource).toContain("theme.publicDesign")
    for (const source of [errorSource, editorComposeSource, editorDedicatedSource]) {
      expect(source).not.toContain("theme.blogDesign")
    }
    for (const [sourcePath, source] of publicSurfaceSources) {
      expect(source, sourcePath).not.toContain("theme.blogDesign")
    }
    expect(publicSurfaceSources.map(([, source]) => source).join("\n")).toContain("theme.publicDesign")
    expect(aboutSource).toContain("var(--aq-surface)")
    expect(aboutSource).not.toContain("theme.blogDesign")
    expect(articleSurfaceSource).toContain("theme.publicDesign.readableSurface")
    expect(articleSurfaceSource).toContain(".detailHero")
    expect(articleSurfaceSource).not.toContain("article::before")
    expect(articleSurfaceSource).not.toContain("font-size: ${({ theme }) =>")
    expect(articleSurfaceSource).not.toContain("line-height: ${({ theme }) =>")
    expect(articleSurfaceSource).not.toContain("font-family: ${({ theme }) =>")
    expect(articleSurfaceSource).not.toContain("max-width: ${({ theme }) => theme.blogDesign")
  })

})
