import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"

const readNormalizedSource = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, relativePath), "utf8").replace(/\s+/g, " ")

test.describe("public profile SSR contract", () => {
  test("홈 static seed는 published 응답 또는 unavailable만 전달한다", () => {
    const source = readNormalizedSource("../src/pages/index.tsx")

    expect(source).toContain("const adminProfileSeed = await resolveStaticAdminProfileSeed(fetchPublicAdminProfile)")
    expect(source).toContain('initialAdminProfileSource === "unavailable"')
    expect(source).not.toContain("static-fallback")
  })

  test("어바웃은 공개 admin profile fetch 실패를 unavailable로 표시한다", () => {
    const source = readNormalizedSource("../src/pages/about.tsx")

    expect(source).toContain("const adminProfileResult = await timed(() => fetchServerAdminProfile(req, {")
    expect(source).toContain('adminProfileResult.ok && adminProfileResult.value ? adminProfileResult.value : null')
    expect(source).toContain('"unavailable"')
    expect(source).toContain("<ErrorState")
    expect(source).not.toContain("resolvePublicAdminProfileSnapshot")
    expect(source).not.toContain("buildStaticAdminProfileSnapshot")
  })
})
