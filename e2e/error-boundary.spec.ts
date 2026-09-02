import { expect, test } from "@playwright/test"
import { existsSync, readFileSync } from "fs"
import path from "path"

const sourcePath = (...parts: string[]) => path.resolve(__dirname, "../src", ...parts)
test.describe("error boundary launch gate", () => {
  test("source wiring keeps global, markdown, and editor boundaries without client reporting", () => {
    const appSource = readFileSync(sourcePath("pages", "_app.tsx"), "utf8")
    const errorBoundarySource = readFileSync(sourcePath("components", "error", "ErrorBoundary.tsx"), "utf8")
    const serverErrorSource = readFileSync(sourcePath("pages", "500.tsx"), "utf8")
    const postDetailSource = readFileSync(sourcePath("routes", "Detail", "PostDetail", "index.tsx"), "utf8")
    const writerHostSource = readFileSync(sourcePath("routes", "Admin", "WriterEditorHost.tsx"), "utf8")

    expect(existsSync(sourcePath("pages", "500.tsx"))).toBe(true)
    expect(existsSync(sourcePath("components", "error", "ErrorBoundary.tsx"))).toBe(true)
    expect(existsSync(sourcePath("libs", "rum", "reportClientError.ts"))).toBe(false)
    expect(existsSync(sourcePath("pages", "api", "rum", "client-errors.ts"))).toBe(false)

    expect(appSource).toContain("GlobalErrorBoundary")
    expect(postDetailSource).toContain('surface="markdown"')
    expect(postDetailSource).toContain("<RecoverableSurfaceBoundary")
    expect(writerHostSource).toContain('surface="editor"')
    expect(writerHostSource).toContain("<RecoverableSurfaceBoundary")
    expect(serverErrorSource).toContain('onRetry={() => router.reload()}')
    expect(errorBoundarySource).not.toContain("reportClientError")
    expect(errorBoundarySource).not.toContain("/api/rum")
    expect(appSource).not.toContain("src/libs/rum")
  })

  test("global render exception shows recoverable 500 UX without telemetry", async ({ page }) => {
    await page.goto("/_qa/error-boundary?mode=global")

    await expect(page.getByRole("heading", { name: "문제가 발생했습니다" })).toBeVisible()
    await expect(page.getByText(/오류 ID: err_/)).toBeVisible()
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible()
    await expect(page.getByRole("link", { name: "홈으로 이동" })).toBeVisible()
  })

  test("local surface render exception is contained without replacing the whole app", async ({ page }) => {
    await page.goto("/_qa/error-boundary?mode=local")

    await expect(page.getByTestId("qa-error-boundary-shell")).toBeVisible()
    await expect(page.getByRole("heading", { name: "콘텐츠를 표시하지 못했습니다" })).toBeVisible()
    await expect(page.getByText(/오류 ID: err_/)).toBeVisible()
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible()
    await expect(page.getByRole("link", { name: "홈으로 이동" })).toBeVisible()
  })

  test("500 page keeps the global retry action available", async ({ page }) => {
    await page.goto("/500")

    await expect(page.getByRole("heading", { name: "문제가 발생했습니다" })).toBeVisible()
    await expect(page.getByText("오류 ID: err_server_500")).toBeVisible()
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible()
    await expect(page.getByRole("link", { name: "홈으로 이동" })).toBeVisible()
  })
})
