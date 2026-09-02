import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

const readFrontText = (relativePath: string): string => readFileSync(path.resolve(__dirname, "..", relativePath), "utf8")
const frontPathExists = (relativePath: string): boolean => existsSync(path.resolve(__dirname, "..", relativePath))

test.describe("frontend legacy boundary", () => {
  test("package identity does not point to the upstream template project", () => {
    const packageJson = JSON.parse(readFrontText("package.json")) as {
      name?: string
      repository?: {
        url?: string
      }
    }

    expect(packageJson.name).toBe("aquila-blog-web")
    expect(packageJson.repository?.url).toBe("https://github.com/AquilaXk/aquila-blog-web.git")
    expect(JSON.stringify(packageJson)).not.toContain("morethan-log")
    expect(JSON.stringify(packageJson)).not.toContain("morethanmin")
  })

  test("legacy post routes stay redirect or SSR 404 only", () => {
    const legacySlugRoute = readFrontText("src/pages/[slug].tsx")
    const legacyPageRoute = readFrontText("src/pages/page/[pageId].tsx")

    expect(legacySlugRoute).toContain("export const getServerSideProps")
    expect(legacySlugRoute).toContain("extractPostIdFromLegacySlug")
    expect(legacySlugRoute).toContain("toCanonicalPostPath(post.id)")
    expect(legacySlugRoute).toContain("permanent: true")
    expect(legacySlugRoute).toContain("res.statusCode = 404")
    expect(legacySlugRoute).toContain("<CustomError />")
    expect(legacySlugRoute).not.toContain("getStaticProps")
    expect(legacySlugRoute).not.toContain("MarkdownRenderer")

    expect(legacyPageRoute).toContain("export const getServerSideProps")
    expect(legacyPageRoute).toContain("toCanonicalPostPath(post.id)")
    expect(legacyPageRoute).toContain("permanent: true")
    expect(legacyPageRoute).toContain("res.statusCode = 404")
    expect(legacyPageRoute).toContain("<CustomError />")
    expect(legacyPageRoute).not.toContain("getStaticProps")
    expect(legacyPageRoute).not.toContain("MarkdownRenderer")
  })

  test("canonical post query hook does not own legacy slug fallback", () => {
    const postQueryHook = readFrontText("src/hooks/usePostQuery.ts")

    expect(postQueryHook).toContain("extractCanonicalPostIdFromAsPath")
    expect(postQueryHook).toContain('pathname.match(/^\\/posts\\/(\\d+)(?:\\/)?$/)')
    expect(postQueryHook).not.toContain("extractPostIdFromLegacySlug")
    expect(postQueryHook).not.toContain("router.query.slug")
  })

  test("canonical post detail does not keep the retired Detail wrapper or PageDetail branch", () => {
    const canonicalPostPage = readFrontText("src/pages/posts/[id].tsx")

    expect(canonicalPostPage).toContain('import PostDetail from "src/routes/Detail/PostDetail"')
    expect(frontPathExists("src/routes/Detail/index.tsx")).toBe(false)
    expect(frontPathExists("src/routes/Detail/PageDetail/index.tsx")).toBe(false)
  })

  test("public auth and legacy editor page entrypoints are removed without redirects", () => {
    expect(frontPathExists("src/pages/login.tsx")).toBe(false)
    expect(frontPathExists("src/pages/signup.tsx")).toBe(false)
    expect(frontPathExists("src/pages/signup/verify.tsx")).toBe(false)
    expect(frontPathExists("src/pages/signup/social/complete.tsx")).toBe(false)
    expect(frontPathExists("src/pages/editor")).toBe(false)
    expect(frontPathExists("src/pages/admin/posts/write.tsx")).toBe(false)
    expect(frontPathExists("src/pages/admin/posts/new.tsx")).toBe(false)
    expect(frontPathExists("src/pages/admin/editor/index.tsx")).toBe(true)
    expect(frontPathExists("src/pages/admin/editor/new.tsx")).toBe(true)
    expect(frontPathExists("src/pages/admin/editor/[id].tsx")).toBe(true)
  })

  test("retired public account entrypoint is absent so Next serves its normal 404", () => {
    expect(frontPathExists("src/pages/settings/account.tsx")).toBe(false)
    expect(frontPathExists("src/pages/settings/privacy.tsx")).toBe(false)
    expect(frontPathExists("src/routes/Settings/SettingsLayout.tsx")).toBe(false)
    expect(frontPathExists("src/routes/Settings/SettingsPrivacyPage.tsx")).toBe(false)
    expect(frontPathExists("src/routes/LegalPolicy/OptionalTrackingConsentSettings.tsx")).toBe(false)
  })

  test("retired public tracking and Vercel fallback owners are absent", () => {
    const packageJson = readFrontText("package.json")
    const sourceFiles = [
      "site.config.js",
      "src/pages/_app.tsx",
      "src/apis/backend/client.ts",
      "src/libs/security/contentSecurityPolicy.js",
    ]

    expect(frontPathExists("src/layouts/RootLayout/Scripts.tsx")).toBe(false)
    expect(frontPathExists("src/layouts/RootLayout/useGtagEffect.ts")).toBe(false)
    expect(frontPathExists("src/libs/privacy/optionalTrackingConsent.ts")).toBe(false)
    expect(frontPathExists("src/libs/privacy/optionalTrackingConsentCore.ts")).toBe(false)
    expect(frontPathExists("src/libs/privacy/OptionalVercelTelemetry.tsx")).toBe(false)
    expect(frontPathExists("src/libs/gtag.ts")).toBe(false)
    expect(frontPathExists("src/libs/rum")).toBe(false)
    expect(frontPathExists("src/pages/api/rum")).toBe(false)
    expect(packageJson).not.toMatch(/@vercel\/(?:analytics|speed-insights)|@types\/gtag\.js/)
    for (const relativePath of sourceFiles) {
      expect(readFrontText(relativePath), relativePath).not.toMatch(
        /vercel|googleAnalytics|googletagmanager|optionalTracking|\/api\/rum|og-image-korean/i,
      )
    }
  })

  test("administrator remember-login stays server-scoped without a local preference fallback", () => {
    const adminLogin = readFrontText("src/pages/admin/login.tsx")

    expect(adminLogin).toContain("rememberMe: keepSignedIn")
    expect(adminLogin).not.toContain("auth.admin.keepSignedIn.v1")
  })

  test("production-orphan public auth sources are removed", () => {
    expect(frontPathExists("src/components/auth")).toBe(false)
    expect(frontPathExists("src/hooks/useSignupMailCooldown.ts")).toBe(false)
    expect(frontPathExists("src/libs/authLoginPolicy.ts")).toBe(false)
    expect(frontPathExists("src/libs/server/guestPage.ts")).toBe(false)
    expect(frontPathExists("public/images/auth/kakao_login_simple_medium.png")).toBe(false)
  })

  test("public comment and notification legacy modules are removed", () => {
    expect(frontPathExists("src/routes/Detail/PostDetail/CommentBox")).toBe(false)
    expect(frontPathExists("src/routes/Detail/PostDetail/DeferredCommentBox.tsx")).toBe(false)
    expect(frontPathExists("src/layouts/RootLayout/Header/NotificationBell.tsx")).toBe(false)
    expect(frontPathExists("src/layouts/RootLayout/Header/useNotificationBellState.ts")).toBe(false)
    expect(frontPathExists("src/apis/backend/notifications.ts")).toBe(false)

    expect(readFrontText("src/types/index.ts")).not.toContain("TPostComment")

    const backendClient = readFrontText("src/apis/backend/client.ts")
    expect(backendClient).not.toContain("/member/api/v1/notifications/snapshot")
    expect(backendClient).not.toContain("/member/api/v1/notifications(\\/|$)")
  })

  test("handwritten public-member compatibility inventory is retired from runtime, config, and admin tools", () => {
    expect(frontPathExists("src/apis/backend/privacy.ts")).toBe(false)

    const publicMemberCompatibilitySources = [
      "config/env.contract.json",
      "Dockerfile.runtime",
      ".github/workflows/ci.yml",
      "README.md",
      "scripts/env/env-contract.test.mjs",
      "src/apis/backend/client.ts",
      "src/apis/backend/errorMessages.ts",
      "src/apis/backend/legal.ts",
      "src/libs/backend/requestPath.ts",
      "src/libs/router.ts",
      "src/libs/server/runtimeMetrics.ts",
      "src/libs/privacy/browserStorageRegistry.ts",
      "src/styles/colors.ts",
      "src/pages/admin.tsx",
      "src/pages/admin/tools.tsx",
      "src/routes/Admin/AdminDashboardWorkspaceModel.ts",
      "src/routes/Admin/AdminDashboardWorkspacePage.tsx",
      "src/routes/Admin/AdminHubSurface.stories.tsx",
      "src/routes/Admin/AdminToolsDiagnosticsSection.tsx",
      "src/routes/Admin/AdminToolsExecutionRail.tsx",
      "src/routes/Admin/AdminToolsExecutionSection.tsx",
      "src/routes/Admin/AdminToolsOpsOverview.tsx",
      "src/routes/Admin/AdminToolsWorkspacePage.tsx",
      "src/routes/Admin/AdminToolsWorkspacePageState.ts",
      "src/routes/Admin/AdminToolsWorkspaceModel.ts",
      "src/routes/Admin/useEditorStudioProfileCommands.ts",
    ]
    const retiredPublicMemberPatterns = [
      /\/signup(?:\/|["'`])/i,
      /social[-/]?login/i,
      /comment-provider/i,
      /auth\/login/i,
      /to(?:Login|Signup)Path/,
      /privacy\/(?:export|requests)/i,
      /signup[- ]?mail/i,
      /SignupMail|signupMail|MAIL_SIGNUP|mailStatus|mailConnectivity|mailTest/,
      /getPrivacyExport|createPrivacyRequest|PrivacyExportResponse|PrivacyRequest(?:Item|Type)/,
      /privacy-request|signupPolicyVersion|signupStart|signupVerify|signupComplete|signupPolicyChangedMessage/,
      /signup_session|admin_tools_mail_snapshot_v1|auth\.login\.(?:keepSignedIn|ipSecurityOn)/,
      /auth\.signupMailCooldown\.v1|member\.notification\.(?:lastEventId|snapshot)\.v1/,
      /NEXT_PUBLIC_SIGNUP_ENABLED|kakaoLogin(?:Background|Text|FocusBorder)/,
    ]

    expect(frontPathExists("src/routes/Settings/SettingsLayout.tsx")).toBe(false)
    for (const relativePath of publicMemberCompatibilitySources) {
      const source = readFrontText(relativePath)
      for (const pattern of retiredPublicMemberPatterns) {
        expect(source, `${relativePath} must not retain ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})
