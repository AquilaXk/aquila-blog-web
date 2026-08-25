import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { getServerSideProps } from "src/pages/page/[pageId]"

test.describe("legacy /page route", () => {
  test("정적 props 경로가 아니라 SSR 404/redirect 경로를 사용한다", async () => {
    const source = readFileSync(path.resolve(__dirname, "../src/pages/page/[pageId].tsx"), "utf8")

    expect(source).toContain("import { GetServerSideProps } from \"next\"")
    expect(source).not.toContain("GetStaticProps")
    expect(source).not.toContain("getStaticProps")
    expect(source).not.toContain("getStaticPaths")

    const responseHeaders = new Map<string, string>()
    const res = {
      statusCode: 200,
      setHeader: (key: string, value: string) => responseHeaders.set(key.toLowerCase(), value),
    } as { statusCode: number; setHeader: (key: string, value: string) => void }
    const result = await getServerSideProps({
      params: { pageId: "legacy-non-post" },
      req: { headers: { "x-request-id": "req-legacy-1" } } as never,
      res: res as never,
      query: {},
      resolvedUrl: "/page/legacy-non-post",
      locales: undefined,
      locale: undefined,
      defaultLocale: undefined,
      preview: false,
      previewData: undefined,
    })

    expect("props" in result).toBe(true)
    if ("props" in result) {
      expect(result.props).toEqual({ notFoundLegacy: true })
    }
    expect(res.statusCode).toBe(404)
    expect(responseHeaders.get("x-request-id")).toBe("req-legacy-1")
  })
})
