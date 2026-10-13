import { expect, test } from "@playwright/test"
const nextConfig = require("../../next.config.js")

test.describe("next.config.js static asset cache headers", () => {
  test("defines long-term cache headers for static public assets", async () => {
    const headersList = await nextConfig.headers()
    const bySource = new Map<string, Array<{ key: string; value: string }>>()
    for (const entry of headersList) {
      bySource.set(entry.source, entry.headers)
    }

    expect(bySource.has("/:path*")).toBe(true)

    const easysubwayHeaders = bySource.get("/easysubway/:path*")
    expect(easysubwayHeaders).toBeDefined()
    expect(easysubwayHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ])
    )

    const companyHeaders = bySource.get("/company/:path*")
    expect(companyHeaders).toBeDefined()
    expect(companyHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ])
    )

    const brandMascotHeaders = bySource.get("/brand-mascot.:slug*.png")
    expect(brandMascotHeaders).toBeDefined()
    expect(brandMascotHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ])
    )
  })
})
