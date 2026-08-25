import { expect, test } from "@playwright/test"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const pageRouteClasses = {
  "[slug].tsx": "public",
  "about.tsx": "public",
  "admin.tsx": "admin",
  "admin/cloud.tsx": "admin",
  "admin/dashboard.tsx": "admin",
  "admin/posts/index.tsx": "admin",
  "admin/posts/new.tsx": "admin",
  "admin/posts/write.tsx": "admin",
  "admin/profile.tsx": "admin",
  "admin/tools.tsx": "admin",
  "company/index.tsx": "public",
  "easysubway/index.tsx": "public",
  "editor/[id].tsx": "editor",
  "editor/new.tsx": "editor",
  "editor/preview/[id].tsx": "editor",
  "feed.tsx": "system",
  "login.tsx": "auth",
  "page/[pageId].tsx": "public",
  "signup.tsx": "auth",
  "signup/social/complete.tsx": "auth",
  "signup/verify.tsx": "auth",
  "sitemap.xml.tsx": "system",
} as const

test("every production GSSP export has one fixed SSR route class", () => {
  const pagesRoot = path.resolve(__dirname, "../../src/pages")
  const findGsspExports = (directory: string, relativeDirectory = ""): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const relativePath = path.join(relativeDirectory, entry.name)
      if (entry.isDirectory()) return entry.name === "_qa" ? [] : findGsspExports(path.join(directory, entry.name), relativePath)
      if (!/\.tsx?$/.test(entry.name)) return []
      const source = readFileSync(path.join(directory, entry.name), "utf8")
      return /export const getServerSideProps/.test(source) ? [relativePath] : []
    })
  const exportedGsspFiles = findGsspExports(pagesRoot).sort()

  for (const [relativePath, routeClass] of Object.entries(pageRouteClasses)) {
    const source = readFileSync(path.join(pagesRoot, relativePath), "utf8")
    expect(source).toMatch(new RegExp(`withSsrMetrics(?:<[^>]+>)?\\("${routeClass}"`))
  }
  expect(exportedGsspFiles).toEqual(Object.keys(pageRouteClasses).sort())
})
