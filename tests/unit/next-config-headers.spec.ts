import { expect, test } from "@playwright/test"
const { match } = require("next/dist/compiled/path-to-regexp")
const nextConfig = require("../../next.config.js")

test.describe("next.config.js static asset cache headers", () => {
  test("defines long-term cache headers for static public assets without polluting SSR HTML routes", async () => {
    const headersList = await nextConfig.headers()
    const bySource = new Map<string, Array<{ key: string; value: string }>>()
    for (const entry of headersList) {
      bySource.set(entry.source, entry.headers)
    }

    expect(bySource.has("/:path*")).toBe(true)
    expect(bySource.has("/easysubway/:path*")).toBe(false)
    expect(bySource.has("/company/:path*")).toBe(false)

    const easysubwayStaticSource = "/easysubway/:path+.:ext(webp|png|jpg|jpeg|gif|svg|ico|avif)"
    const companyStaticSource = "/company/:path+.:ext(webp|png|jpg|jpeg|gif|svg|ico|avif)"

    const easysubwayHeaders = bySource.get(easysubwayStaticSource)
    expect(easysubwayHeaders).toBeDefined()
    expect(easysubwayHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ])
    )

    const companyHeaders = bySource.get(companyStaticSource)
    expect(companyHeaders).toBeDefined()
    expect(companyHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ])
    )

    const matchEasysubway = match(easysubwayStaticSource)
    expect(Boolean(matchEasysubway("/easysubway"))).toBe(false)
    expect(Boolean(matchEasysubway("/easysubway/"))).toBe(false)
    expect(Boolean(matchEasysubway("/easysubway/og-image.png"))).toBe(true)
    expect(Boolean(matchEasysubway("/easysubway/badges/seoul_1_compact_256.webp"))).toBe(true)

    const matchCompany = match(companyStaticSource)
    expect(Boolean(matchCompany("/company"))).toBe(false)
    expect(Boolean(matchCompany("/company/"))).toBe(false)
    expect(Boolean(matchCompany("/company/blog-home.webp"))).toBe(true)

    const brandMascotHeaders = bySource.get("/brand-mascot.:slug*.png")
    expect(brandMascotHeaders).toBeDefined()
    expect(brandMascotHeaders).toEqual(
      expect.arrayContaining([
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ])
    )

    for (const source of [
      "/pdf.worker.min.mjs",
      "/pdfjs/:path*",
      "/images/:path*",
      "/favicon.ico",
      "/apple-touch-icon.png",
      "/avatar.png",
    ]) {
      const headers = bySource.get(source)
      expect(headers, `expected Cache-Control headers for ${source}`).toBeDefined()
      expect(headers).toEqual(
        expect.arrayContaining([
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ])
      )
    }
  })
})
