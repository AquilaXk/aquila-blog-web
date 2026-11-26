import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

const getRelativeLuminance = (hexColor: string) => {
  const [red, green, blue] = hexColor
    .replace("#", "")
    .match(/.{2}/g)!
    .map((channel) => {
      const value = Number.parseInt(channel, 16) / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const getContrastRatio = (foreground: string, background: string) => {
  const [lighter, darker] = [getRelativeLuminance(foreground), getRelativeLuminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

const getStyledComponentBlock = (source: string, componentName: string) => {
  const marker = `const ${componentName} =`
  const start = source.indexOf(marker)
  expect(start, `${componentName} const`).toBeGreaterThanOrEqual(0)

  const templateStart = source.indexOf("`", start)
  expect(templateStart, `${componentName} template start`).toBeGreaterThanOrEqual(0)

  const templateEnd = source.indexOf("`", templateStart + 1)
  expect(templateEnd, `${componentName} template end`).toBeGreaterThan(templateStart)

  return source.slice(start, templateEnd + 1)
}

const expectStyledComponentRadius = (source: string, componentName: string, radius: string) => {
  expect(getStyledComponentBlock(source, componentName)).toContain(`border-radius: ${radius};`)
}

test.describe("관리자 표면 공통 계약", () => {
  test("관리자 표면은 Ghost + shadcn zinc 스튜디오 시스템 테마 토큰을 공유한다", () => {
    const colorTokenSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/adminColorTokens.ts"), "utf8")
    const shellSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShell.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShellSidebar.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShellTopBar.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShellModel.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/adminShellI18n.ts"), "utf8"),
    ].join("\n")
    const rootLayoutSource = readFileSync(path.resolve(__dirname, "../src/layouts/RootLayout/index.tsx"), "utf8")
    const cloudStyleSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspace.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspaceControls.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspaceDetail.styles.ts"), "utf8"),
    ].join("\n")
    const cloudPageSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudAssetGrid.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspacePage.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspaceDetailDrawer.tsx"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudPreviewDrawer.tsx"), "utf8"),
    ].join("\n")
    const cloudModelSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspaceModel.ts"), "utf8")
    const primitiveSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminSurfacePrimitives.tsx"),
      "utf8",
    )
    const hubStyleSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.styles.ts"), "utf8")

    expect(colorTokenSource).toContain("export const adminSystemThemeVariables =")
    expect(colorTokenSource).toContain('theme.scheme === "dark" ? adminDarkThemeVariables : adminLightThemeVariables')
    expect(colorTokenSource).toContain("createPublicDesignTokens")
    expect(colorTokenSource).toContain("--admin-frame-bg: #f4f4f5;")
    expect(colorTokenSource).toContain("--admin-primary: #18181b;")
    expect(colorTokenSource).toContain("--admin-accent-text: #18181b;")
    expect(colorTokenSource).toContain("--admin-control-text: #fafafa;")
    expect(colorTokenSource).toContain("--admin-text-muted: #52525b;")
    expect(colorTokenSource).toContain("export const adminAppBackground = ")
    expect(colorTokenSource).toContain("export const adminTextMuted = ")
    expect(colorTokenSource).toContain("export const adminSurface = ")
    expect(colorTokenSource).toContain("export const adminSurfaceAccent = ")
    expect(colorTokenSource).toContain("export const adminAccentText = ")
    expect(colorTokenSource).toContain("export const adminGold = adminAccentText")
    expect(colorTokenSource).toContain("export const adminTeal = ")
    expect(colorTokenSource).toContain('export const usesDarkAdminSurface = (theme: Theme) => theme.scheme !== "light"')
    expect(colorTokenSource).not.toContain("#4f74ff")
    expect(colorTokenSource).not.toContain("#155eef")

    expect(rootLayoutSource).toContain('const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")')
    expect(rootLayoutSource).toContain('const isDesignAwareRoute = pathname[1] !== "_" && pathname !== "/sitemap.xml"')
    expect(rootLayoutSource).toContain('const effectiveScheme = "light"')
    expect(rootLayoutSource).toContain(
      'const effectiveBlogDesign = isAdminRoute ? adminProfile?.blogDesign || "legacy" : "legacy"'
    )
    expect(rootLayoutSource).toContain("{isAdminRoute || isDedicatedEditorRoute || isStandaloneSurfaceRoute ? null : (")
    expect(rootLayoutSource).not.toContain("publicAppearance.scheme")
    expect(shellSource).toContain("${({ theme }) => adminSystemThemeVariables(theme)}")
    expect(shellSource).toContain("14.25rem minmax(0, 1fr)")
    expect(shellSource).toContain("StudioCardFrame")
    expect(shellSource).not.toContain("FrameTopChrome")
    expect(shellSource).toContain("width: 100%;")
    expect(shellSource).not.toContain("width: 100vw;")
    expect(shellSource).toContain("background: ${adminFrameBackground};")
    expect(shellSource).toContain("<TopBar>")
    expect(shellSource).toMatch(/<SecondaryTopAction\s+as=\{Link\}\s+href="\/"/)
    expect(shellSource).not.toContain('<button type="button" onClick={() => void handleLogout()}>')
    expect(shellSource).toContain('apiFetch("/member/api/v1/auth/logout", { method: "DELETE" })')
    expect(shellSource).toContain("SidebarLogoutAction")
    expect(shellSource).toContain("ResponsiveLogoutAction")
    expect(shellSource).toContain('<AppIcon name="log-out" />')
    expect(shellSource).not.toContain('"/api/backend/member/api/v1/auth/logout"')
    expect(shellSource).toContain('<PrimaryTopAction as={Link} href="/admin/editor/new">')
    expect(shellSource).toContain("CompactNav")
    expect(shellSource).toContain("aria-label={item.label}")

    expect(cloudStyleSource).toContain("background: ${surface};")
    expect(cloudStyleSource).toContain("grid-template-columns: minmax(0, 1fr);")
    expect(cloudStyleSource).toContain('data-detail-open="true"')
    expect(cloudStyleSource).toContain('data-detail-mode="inline"')
    expect(cloudStyleSource).toContain("grid-template-columns: minmax(0, 1fr) minmax(21rem, 24rem);")
    expect(colorTokenSource).toContain("export const adminCloudSelectionAccent = ")
    expect(cloudStyleSource).toContain("border-left-color: ${adminCloudSelectionAccent};")
    expect(cloudStyleSource).toMatch(/export const SearchInput = styled\.input`[\s\S]*?border-radius: 8px;/)
    expect(cloudPageSource).toContain('<AppIcon name="folder" />')
    expect(cloudPageSource).toContain('<AppIcon name="lock" />')
    expect(cloudPageSource).not.toContain('<span aria-hidden="true">T</span>')
    expect(cloudPageSource).toContain("resolveCloudEmptyTitle")
    expect(cloudModelSource).toContain("선택한 조건에 맞는 파일이 없습니다.")
    expect(cloudModelSource).not.toContain("아직 올린 파일이 없습니다.")
    expect(cloudPageSource).not.toContain("아직 올린 파일이 없습니다.")

    expect(primitiveSource).toContain("adminPlainSurface(theme)")
    expect(primitiveSource).not.toContain("linear-gradient")
    expect(primitiveSource).toContain("background: ${({ theme }) => adminMutedSurface(theme)};")
    expect(primitiveSource).not.toContain("box-shadow: 0 0 0 1px ${({ theme }) => adminCardBorder(theme)} inset;")
    expect(primitiveSource).toContain("& + & {")
    expect(primitiveSource).toContain("margin-top: 0.4rem;")
    expect(hubStyleSource).not.toContain("transform: translateY")
  })

  test("관리자 프로필은 대표 제목과 내부 섹션 제목 텍스트를 중복하지 않는다", () => {
    const profileSectionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspaceSections.tsx"),
      "utf8",
    )
    const profileModelSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspaceModel.ts"),
      "utf8",
    )

    expect(profileSectionSource).toContain("<h1>개인정보와 계정 설정</h1>")
    expect(profileModelSource).toContain('label: "기본 정보"')
    expect(profileModelSource).not.toContain('label: "프로필"')
  })

  test("관리자 클라우드 표면은 Strapi 에셋 그리드·목록 전환과 업로드 드롭존 계약을 유지한다", () => {
    const cloudStyleSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspace.styles.ts"), "utf8")
    const cloudPageSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudWorkspacePage.tsx"), "utf8")
    const cloudGridSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminCloudAssetGrid.tsx"), "utf8")
    const cloudI18nSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/cloud/adminCloudI18n.ts"), "utf8")

    expect(cloudPageSource).toContain("<CloudHeaderActions>")
    expect(cloudPageSource).toContain("t.uploadButton")
    expect(cloudPageSource).toContain("<CloudDropOverlay")
    expect(cloudPageSource).toContain("onDragOver={handleUploadDragOver}")
    expect(cloudPageSource).toContain("onDrop={handleUploadDrop}")
    expect(cloudPageSource).toContain("<h1>{t.pageTitle}</h1>")
    expect(cloudPageSource).toContain("{t.capacityLimitHint}")
    expect(cloudPageSource).toContain("aria-label={activeUploadCount > 0 ? t.uploadingButton : t.uploadButton}")
    expect(cloudPageSource).toContain("<AdminCloudAssetGrid")
    expect(cloudPageSource).toContain("<CloudViewToggle")
    expect(cloudGridSource).toContain("adminCheckerboardBackground")
    expect(cloudPageSource).not.toContain("<h1>내 파일</h1>")
    expect(cloudPageSource).not.toContain("<h1>미디어 라이브러리</h1>")
    expect(cloudI18nSource).toContain('pageTitle: "클라우드"')
    expect(cloudI18nSource).toContain('uploadButton: "파일 업로드"')
    expect(cloudI18nSource).toContain('capacityLimitHint: "사진 50MB · 문서/압축 95MB · 동영상 5GB 이하"')

    expect(getStyledComponentBlock(cloudStyleSource, "CloudContent")).toContain("padding: 1.35rem 1.75rem 3.5rem;")
    expect(getStyledComponentBlock(cloudStyleSource, "CloudTitleBar")).toContain("align-items: center;")
    expect(getStyledComponentBlock(cloudStyleSource, "CloudDropOverlay")).toContain("border: 2px dashed ${accentTeal};")
    expect(getStyledComponentBlock(cloudStyleSource, "FileTable")).toContain('tbody tr[data-loading-row="true"]')
    expect(getStyledComponentBlock(cloudStyleSource, "FileTable")).toContain(
      "grid-template-columns: 2.25rem minmax(0, 1fr) 6rem 10.5rem;",
    )
    expect(getStyledComponentBlock(cloudStyleSource, "FileTable")).toContain(
      'tbody tr[data-selected="true"]:focus-within',
    )
    expect(getStyledComponentBlock(cloudStyleSource, "FileTable")).toContain("display: grid;")
    expect(getStyledComponentBlock(cloudStyleSource, "FileThumbnailFrame")).toContain("border-radius: 6px;")
    expect(getStyledComponentBlock(cloudStyleSource, "FileThumbnailFrame")).toContain("adminCheckerboardBackground")
  })

  test("관리자 공통 프리미티브는 포커스 표시와 모바일 스냅 계약을 가진다", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminSurfacePrimitives.tsx"),
      "utf8",
    )

    expect(source).toContain("export const adminInteractiveFocusRing = (theme: Theme) =>")
    expect(source).toContain("scroll-snap-type: x proximity;")
    expect(source).toContain("scroll-snap-align: start;")
    expect(source).toContain("box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};")
    expect(source).toContain("export const AdminWorkspaceSectionNavButton = styled.button`")
    expect(source).toContain("export const AdminInfoLinkCard = styled.a<{ $withIcon?: boolean }>`")
    expect(source).toContain('export const AdminStatusPill = styled.span<{ $size?: "sm" | "md" }>`')
    expect(source).toContain("export const AdminTextActionButton = styled.button`")
    expect(source).toContain("export const AdminTextActionLink = styled.a`")
    expect(source).toContain("export const AdminActionCardButton = styled.button`")
    expect(source).toContain("export const AdminInlineActionRow = styled.div`")
    expect(source).toContain("background: ${({ theme }) => adminMutedSurface(theme)};")
    expect(source).toContain("border-bottom: 0;")
    const actionButtonBlock = source.match(/export const AdminActionCardButton = styled\.button`[\s\S]*?`\n/)?.[0] ?? ""
    expect(actionButtonBlock).toContain("background: ${({ theme }) => adminRaisedSurface(theme)};")
    expect(actionButtonBlock).toContain("background: ${({ theme }) => adminAccentSurface(theme)};")
    expect(actionButtonBlock).not.toContain("background: transparent;")
    expect(source).toContain("export const AdminWorkspaceHero = styled.section`")
  })

  test("대시보드는 Bull Board pulse·guard·터미널 로그 구조를 노출한다", () => {
    const workspaceSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspacePage.tsx"),
      "utf8",
    )
    const viewSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspaceView.tsx"),
      "utf8",
    )
    const layoutStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts"),
      "utf8",
    )
    const refreshStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.refresh.ts"),
      "utf8",
    )
    const priorityStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.priority.ts"),
      "utf8",
    )

    expect(workspaceSource).toContain('"/system/api/v1/adm/dashboard-snapshot"')
    expect(workspaceSource).toContain("const chartBars: DashboardChartBar[]")
    expect(workspaceSource).toContain("const logRows: DashboardLogRow[]")
    expect(viewSource).toContain('<h2>{isEn ? "Operational Metrics" : "운영 지표 요약"}</h2>')
    expect(viewSource).toContain('isEn ? "Subsystem Checks" : "서브시스템 점검 항목"')
    expect(viewSource).toContain('isEn ? "Recent Events" : "최근 운영 이벤트"')
    expect(viewSource).toContain('<StatusRows data-ui="dashboard-guard-rows">')
    expect(viewSource).toContain("<TerminalCard")
    expect(viewSource).not.toContain("<ContextGrid>")
    expect(viewSource).not.toContain("<AdditionalPanelsSection>")
    expect(viewSource).not.toContain("<PriorityTable>")
    expect(layoutStyleSource).toContain("export const OpsGrid = styled.section`")
    expect(`${layoutStyleSource}\n${refreshStyleSource}`).toContain("export const ChartBars = styled.div`")
    expect(priorityStyleSource).toContain("export const LogLines = styled.div`")
    expect(priorityStyleSource).toContain("export const PrioritySection = styled(AdminPlainCard)`")
    expect(priorityStyleSource).toContain("export const PrioritySummary = styled.div`")
    expect(`${layoutStyleSource}\n${priorityStyleSource}`).not.toContain("${AdminInfoPanelCard}")
    expect(`${layoutStyleSource}\n${priorityStyleSource}`).not.toContain("${AdminInfoLinkCard}")
  })

  test("글 관리와 운영 도구는 공통 배지와 언더라인 탭·액션 프리미티브를 재사용한다", () => {
    const postsListSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceList.tsx"), "utf8")
    const postsListStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceList.styles.ts"),
      "utf8",
    )
    const postsFilterSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceFilterToolbar.tsx"),
      "utf8",
    )
    const postsSectionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePageSections.tsx"),
      "utf8",
    )
    const toolsPageSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspacePage.tsx"), "utf8")
    const toolsExecutionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsExecutionSection.tsx"),
      "utf8",
    )
    const toolsTokenStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.tokens.ts"),
      "utf8",
    )
    const toolsLayoutStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.layout.ts"),
      "utf8",
    )

    const postsI18nSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/adminI18n.ts"),
      "utf8",
    )
    expect(postsListStyleSource).toContain("export const VisibilityBadge = styled(AdminStatusPill)<{ \"data-tone\": string }>`")
    expect(postsListSource).toContain("VisibilityBadge,")
    expect(postsListSource).toContain('<th className="topicCell" scope="col">')
    expect(postsListSource).toContain('<th className="viewsCell" scope="col" aria-sort={viewsAriaSort}>')
    expect(postsListSource).toContain('<th className="actionsCell" scope="col">')
    expect(postsListSource).toContain("RowActions,")
    expect(postsListSource).not.toContain('<th className="actionCell">Actions</th>')
    expect(postsI18nSource).toContain('"글 검색"')
    expect(postsListSource).toContain("getWorkspaceTopicLabel(row)")
    expect(getStyledComponentBlock(postsFilterSource, "ScopeTabButton")).toContain(
      "border-block-end: 2px solid ${adminTeal};",
    )
    expect(getStyledComponentBlock(postsFilterSource, "SearchField")).toContain("border-radius: 6px;")
    expectStyledComponentRadius(postsSectionSource, "PrimaryCta", "6px")

    expect(toolsTokenStyleSource).toContain("export const StatusBadge = styled(AdminStatusPill)`")
    expect(toolsTokenStyleSource).toContain("export const FreshnessBadge = styled(AdminStatusPill)`")
    expect(toolsLayoutStyleSource).toContain("export const ActionRowButton = styled(AdminActionCardButton)``")
    expect(toolsPageSource).toContain("const [isQueueDiagnosticsOpen, setIsQueueDiagnosticsOpen] = useState(true)")
    expect(toolsPageSource).toContain("const [activeExecutionTab, setActiveExecutionTab] = useState<ExecutionDiagnosticTab>")
    expect(`${toolsPageSource}\n${toolsExecutionSource}`).not.toContain("<WorkspaceIntroCard>")
    expect(toolsExecutionSource).toContain("<DetailsPanel>")
    expect(`${toolsPageSource}\n${toolsExecutionSource}`).not.toContain('<SectionNav aria-label="운영 섹션">')
    expect(`${toolsTokenStyleSource}\n${toolsLayoutStyleSource}`).not.toContain("const SectionNav = styled(AdminWorkspaceSectionNav)`")
    expect(`${toolsTokenStyleSource}\n${toolsLayoutStyleSource}`).not.toContain("const SectionNavButton = styled(AdminWorkspaceSectionNavButton)``")
  })

  test("큰 관리자 페이지는 스타일 정의를 오케스트레이션 페이지 밖으로 분리한다", () => {
    const profileSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/profile.tsx"), "utf8")
    const profileSectionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspaceSections.tsx"),
      "utf8",
    )
    const toolsSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/tools.tsx"), "utf8")
    const toolsSectionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspaceSections.tsx"),
      "utf8",
    )
    const dashboardSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/dashboard.tsx"), "utf8")
    const profileLayoutStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspace.styles.layout.ts"),
      "utf8",
    )
    const profileSectionStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspace.styles.sections.ts"),
      "utf8",
    )
    const profileLinkStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspace.styles.links.ts"),
      "utf8",
    )
    const toolsMainStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.ts"),
      "utf8",
    )
    const toolsLayoutStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.layout.ts"),
      "utf8",
    )
    const toolsResultsSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsResultsPanel.tsx"),
      "utf8",
    )
    const dashboardLayoutStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.layout.ts"),
      "utf8",
    )
    const dashboardRefreshStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.refresh.ts"),
      "utf8",
    )
    const dashboardPriorityStyles = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.priority.ts"),
      "utf8",
    )

    expect(profileSectionSource).toContain('from "src/routes/Admin/AdminProfileWorkspace.styles"')
    expect(toolsSectionSource).toContain('from "src/routes/Admin/AdminToolsWorkspace.styles"')
    expect(dashboardSource).toContain('export { default } from "src/routes/Admin/AdminDashboardWorkspacePage"')

    expect(profileSource).not.toContain("const PreviewRail = styled(")
    expect(profileSource).not.toContain("const ModalOverlay = styled.div`")
    expect(profileSource).not.toContain("const LinkRowCard = styled.div`")
    expect(toolsSource).not.toContain("const ExecutionLayout = styled.div`")
    expect(toolsSource).not.toContain("const ResultPanel = styled.pre`")
    expect(toolsSource).not.toContain("const WorkspaceSection = styled.section`")
    expect(dashboardSource).not.toContain("const PanelGrid = styled.section`")
    expect(dashboardSource).not.toContain("const PriorityTable = styled.table`")
    expect(dashboardSource).not.toContain("const ServiceRail = styled.section`")

    expect(profileSectionStyles).toContain("export const PreviewRail = styled(AdminStickyRail)`")
    expect(`${profileLayoutStyles}\n${profileLinkStyles}`).toContain("export const LinkRowCard = styled.div`")
    expectStyledComponentRadius(profileSectionStyles, "PreviewToggleButton", "6px")
    expectStyledComponentRadius(profileSectionStyles, "DockSecondaryButton", "8px")
    expectStyledComponentRadius(profileSectionStyles, "DockPrimaryButton", "8px")
    expectStyledComponentRadius(profileSectionStyles, "ModalCloseButton", "8px")
    expectStyledComponentRadius(profileSectionStyles, "ModalHistoryAction", "6px")
    expect(toolsLayoutStyles).toContain("export const ExecutionLayout = styled.div`")
    expect(`${toolsMainStyles}\n${toolsLayoutStyles}\n${toolsResultsSource}`).toContain(
      "export const ResultPanel = styled.pre`",
    )
    expect(dashboardLayoutStyles).toContain("export const OpsGrid = styled.section`")
    expect(`${dashboardLayoutStyles}\n${dashboardRefreshStyles}`).toContain("export const ChartBars = styled.div`")
    expect(dashboardPriorityStyles).toContain("export const LogLines = styled.div`")
    expect(dashboardPriorityStyles).toContain("export const PrioritySection = styled(AdminPlainCard)`")

    expect(profileSource.split("\n").length).toBeLessThan(2600)
    expect(toolsSource.split("\n").length).toBeLessThan(2100)
    expect(dashboardSource.split("\n").length).toBeLessThan(1050)
  })

  test("글 관리 작업공간은 반복 UI 영역을 페이지에서 분리한다", () => {
    const postsSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePageView.tsx"), "utf8")
    const controllerSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspacePage.tsx"), "utf8")
    const filterSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceFilterToolbar.tsx"),
      "utf8",
    )
    const listSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceList.tsx"),
      "utf8",
    )
    const feedbackSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminPostsWorkspaceFeedbackLayer.tsx"),
      "utf8",
    )

    expect(postsSource).toContain('import { AdminPostsWorkspaceFilterToolbar } from "./AdminPostsWorkspaceFilterToolbar"')
    expect(postsSource).toContain('import { AdminPostsWorkspaceList } from "./AdminPostsWorkspaceList"')
    expect(postsSource).toContain('import { AdminPostsWorkspaceFeedbackLayer } from "./AdminPostsWorkspaceFeedbackLayer"')
    expect(postsSource).toContain("<AdminPostsWorkspaceFilterToolbar")
    expect(postsSource).toContain("<AdminPostsWorkspaceList")
    expect(postsSource).toContain("<AdminPostsWorkspaceFeedbackLayer")
    expect(controllerSource).not.toContain("const renderRecentEdited = () =>")
    expect(postsSource).not.toContain("const RecentPostList = styled.ul`")
    expect(postsSource).not.toContain("const DesktopListTable = styled.table`")
    expect(postsSource).not.toContain("const ToastViewport = styled.div`")
    expect(controllerSource.length).toBeLessThan(76000)

    expect(filterSource).toContain("export const AdminPostsWorkspaceFilterToolbar")
    expect(listSource).toContain("export const AdminPostsWorkspaceList")
    expect(feedbackSource).toContain("export const AdminPostsWorkspaceFeedbackLayer")
  })

  test("나머지 관리자 페이지는 과도한 카드 반경을 쓰지 않는다", () => {
    const dashboardSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/dashboard.tsx"), "utf8")
    const profileSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/profile.tsx"), "utf8")
    const toolsSource = readFileSync(path.resolve(__dirname, "../src/pages/admin/tools.tsx"), "utf8")
    const dashboardStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminDashboardWorkspace.styles.ts"),
      "utf8",
    )
    const profileStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminProfileWorkspace.styles.ts"),
      "utf8",
    )
    const toolsStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.ts"),
      "utf8",
    )

    for (const source of [dashboardSource, profileSource, toolsSource, dashboardStyleSource, profileStyleSource, toolsStyleSource]) {
      expect(source).not.toContain("border-radius: 28px;")
      expect(source).not.toContain("border-radius: 30px;")
      expect(source).not.toContain("border-radius: 32px;")
    }
  })

  test("운영 도구 작업공간은 상세형 대표 문구와 작업 레일 라벨을 사용한다", () => {
    const toolsPageSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspacePage.tsx"), "utf8")
    const toolsSectionsSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspaceSections.tsx"),
      "utf8",
    )
    const toolsOverviewSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsOpsOverview.tsx"),
      "utf8",
    )
    const toolsDiagnosticsSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsDiagnosticsSection.tsx"),
      "utf8",
    )
    const toolsExecutionSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsExecutionSection.tsx"),
      "utf8",
    )
    const toolsExecutionRailSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsExecutionRail.tsx"),
      "utf8",
    )
    const toolsResultsSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsResultsPanel.tsx"),
      "utf8",
    )
    const toolsMainStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.ts"),
      "utf8",
    )
    const toolsTokenStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.tokens.ts"),
      "utf8",
    )
    const toolsLayoutStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminToolsWorkspace.styles.layout.ts"),
      "utf8",
    )

    const bullQueueCardsSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminBullQueueCards.tsx"),
      "utf8",
    )
    const toolsSurfaceSource = `${toolsPageSource}\n${toolsSectionsSource}\n${toolsOverviewSource}\n${toolsDiagnosticsSource}\n${toolsExecutionSource}`

    expect(toolsSectionsSource).toContain("<AdminToolsOpsOverview")
    expect(toolsOverviewSource).toContain("운영 상태와 복구")
    expect(toolsOverviewSource).toContain("<AdminBullQueueCards")
    expect(bullQueueCardsSource).toContain('data-ui="bullboard-queue-grid"')
    expect(bullQueueCardsSource).toContain("<PulseTrack")
    expect(toolsOverviewSource).not.toContain("<h2>Steady-state guard</h2>")
    expect(toolsOverviewSource).not.toContain("<h2>Live logs</h2>")
    expect(toolsMainStyleSource).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));")
    expect(toolsDiagnosticsSource).toContain("<h2>작업 큐</h2>")
    expect(toolsExecutionSource).toContain("<h2>정리와 보안</h2>")
    expect(toolsResultsSource).toContain("<h2>최근 진단 결과</h2>")
    expect(toolsSurfaceSource).not.toContain("<h2>진단</h2>")
    expect(toolsSurfaceSource).not.toContain("<h2>실행</h2>")
    expect(toolsSurfaceSource).not.toContain("<h2>최근 실행 결과</h2>")
    expect(toolsSurfaceSource).not.toContain("<h2>실데이터 테스트</h2>")
    expect(`${toolsTokenStyleSource}\n${toolsLayoutStyleSource}`).toContain("AdminStickyRail,")
    expect(toolsLayoutStyleSource).toContain("export const ExecutionLayout = styled.div`")
    expect(toolsLayoutStyleSource).toContain("export const ExecutionRail = styled(AdminStickyRail)`")
    expect(toolsExecutionRailSource).toContain("<h3>실행 전 체크</h3>")
    expect(toolsExecutionRailSource).toContain("<h3>런북/장애 문서</h3>")
    expect(toolsSurfaceSource).not.toContain("메일, 작업 큐, 정리 상태, 보안 이벤트처럼 장애와 직접 연결되는 항목만 우선 다룹니다.")
    expect(toolsSurfaceSource).not.toContain("운영 변경 없이 현재 상태와 영향 범위를 먼저 다시 확인합니다.")
    expect(toolsSurfaceSource).not.toContain("<ExecutionGrid>")
    expect(toolsSurfaceSource).not.toContain("requestIdleCallback")
    expect(toolsSurfaceSource).not.toContain("isWorkspaceReady")
    expect(toolsLayoutStyleSource).toContain("&:focus-visible {")
    expect(toolsLayoutStyleSource).toContain("box-shadow: ${({ theme }) => adminInteractiveFocusRing(theme)};")
  })

  test("관리자 사이드바는 Ghost + shadcn 스튜디오 프레임과 하단 프로필을 유지한다", () => {
    const shellTsxSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminShell.tsx"), "utf8")
    const shellSidebarStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminShellSidebar.styles.ts"),
      "utf8",
    )
    const shellTopBarStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminShellTopBar.styles.ts"),
      "utf8",
    )
    const shellI18nSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/adminShellI18n.ts"),
      "utf8",
    )
    const source = `${shellTsxSource}\n${shellSidebarStyleSource}\n${shellTopBarStyleSource}\n${shellI18nSource}`

    expect(shellTsxSource).toContain('import ProfileImage from "src/components/ProfileImage"')
    expect(shellTsxSource).toContain('import BrandLogoMark from "src/components/branding/BrandMark"')
    expect(shellTsxSource).toContain("profileSnapshot?: AdminProfile | null")
    expect(shellTsxSource).toContain('const sidebarIdentityName = (member.nickname || member.username || "관리자").trim()')
    expect(shellTsxSource).toContain("useAdminShellProfile(member.id, profileSnapshot)")
    expect(shellTsxSource).toContain('const brandTitle = profile?.blogTitle?.trim() || "Aquila Studio"')
    expect(shellTsxSource).toContain('const sidebarProfileImageSrc = (profile?.profileImageUrl ?? "").trim()')
    expect(shellTsxSource).toContain("setIsProfileImageFailed(false)")
    expect(source).toContain('"프로필 정보를 불러올 수 없습니다."')
    expect(shellTsxSource).not.toContain("member.profileImage")
    expect(shellTsxSource).not.toContain("CONFIG.profile.image")
    expect(shellTsxSource).not.toContain("CONFIG.blog.title")
    expect(shellTsxSource).not.toContain('import { useAdminProfile } from "src/hooks/useAdminProfile"')
    expect(shellI18nSource).toContain('"허브"')
    expect(shellI18nSource).toContain('"운영 대시보드"')
    expect(shellI18nSource).toContain('"글 관리"')
    expect(shellI18nSource).toContain('"새 글 작성"')
    expect(shellI18nSource).toContain('"클라우드"')
    expect(shellI18nSource).toContain('"운영 도구"')
    expect(shellI18nSource).toContain('"설정"')
    expect(shellTsxSource).toContain("<StudioCardFrame")
    expect(shellTsxSource).toContain("<SidebarProfile")
    expect(shellTsxSource).toContain("<SidebarProfileIdentity>")
    expect(shellSidebarStyleSource).toContain("export const SidebarLogoutAction = styled.button`")
    expect(shellTsxSource).toContain("SidebarLogoutAction")
    expect(shellTopBarStyleSource).toContain("export const ResponsiveLogoutAction = styled.button`")
    expect(getStyledComponentBlock(shellTopBarStyleSource, "ResponsiveLogoutAction")).toContain(
      "layoutBreakpoint.adminCompact"
    )
    expect(getStyledComponentBlock(shellTopBarStyleSource, "ResponsiveLogoutAction")).toContain("display: inline-flex;")
    expect(shellTsxSource).not.toContain("<SidebarSectionLabel>관리 메뉴</SidebarSectionLabel>")
    expect(shellTsxSource.indexOf("<BrandBlock>")).toBeLessThan(shellTsxSource.indexOf("<SidebarNavSection>"))
    expect(shellTsxSource.indexOf("<SidebarNavSection>")).toBeLessThan(shellTsxSource.indexOf("<SidebarProfile"))
    expect(shellTsxSource).not.toContain('<SidebarStatusCard aria-label="현재 화면">')
    expect(shellTsxSource).not.toContain("SidebarCardTitle")
  })

  test("관리자 zinc 모노크롬 색상 토큰은 WCAG 명도 대비 기준을 만족한다", () => {
    const tokenSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/adminColorTokens.ts"), "utf8")
    const shellSidebarStyleSource = readFileSync(
      path.resolve(__dirname, "../src/routes/Admin/AdminShellSidebar.styles.ts"),
      "utf8",
    )

    expect(tokenSource).not.toContain("#b9954f")
    expect(tokenSource).not.toContain("#9d7d3f")
    expect(tokenSource).not.toContain("#6f5524")
    expect(tokenSource).not.toContain("#f7f1e3")
    expect(tokenSource).not.toContain("#2d291a")
    expect(tokenSource).toContain("--admin-primary: #18181b;")
    expect(tokenSource).toContain("--admin-primary-hover: #27272a;")
    expect(tokenSource).toContain("--admin-accent-text: #18181b;")
    expect(getContrastRatio("#18181b", "#fafafa")).toBeGreaterThanOrEqual(12)
    expect(getContrastRatio("#fafafa", "#09090b")).toBeGreaterThanOrEqual(15)
    expect(getContrastRatio("#52525b", "#ffffff")).toBeGreaterThanOrEqual(7)
    expect(shellSidebarStyleSource).toContain("adminAccentText")
    expect(shellSidebarStyleSource).not.toContain("adminGold")
  })

  test("관리자 허브는 SectionCards·SVG 분석 밴드·최근 콘텐츠 테이블을 둔다", () => {
    const sectionSource = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.sections.tsx"), "utf8")
    const styleSource = [
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.styles.ts"), "utf8"),
      readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminHubSurface.styles.chrome.ts"), "utf8"),
    ].join("\n")

    expect(sectionSource).toContain('"관리자 핵심 지표"')
    expect(sectionSource).toContain('"최근 콘텐츠"')
    expect(sectionSource).toContain("<AnalyticsBand>")
    expect(styleSource).toContain("export const MetricCard = styled.div`")
    expect(styleSource).toContain("export const Panel = styled.section`")
    expect(styleSource).toContain("export const ContentRow = styled.a`")
    expect(styleSource).toContain("export const StatusRow = styled.div`")
    expect(sectionSource).not.toContain("<h2>체크</h2>")
    expect(sectionSource).not.toContain("<h2>바로가기</h2>")
    expect(sectionSource).not.toContain("<h2>상태</h2>")
    expect(sectionSource).not.toContain("최근에 확인한 상태와 이어서 처리할 작업을 함께 봅니다.")
    expect(styleSource).not.toContain("border-radius: 24px;")
  })

  test("공통 관리자 랜딩 프리미티브는 전용 리드 문장 스타일을 제공한다", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/routes/Admin/AdminSurfacePrimitives.tsx"), "utf8")

    expect(source).toContain("export const AdminLandingSectionLead = styled.p`")
    expect(source).toContain("font-size: 0.86rem;")
    expect(source).toContain("line-height: 1.58;")
    expect(source).toContain("color: ${({ theme }) => adminMutedText(theme)};")
  })
})
