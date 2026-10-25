import fs from "node:fs"
import path from "node:path"
import React from "react"
import { expect, test } from "@playwright/test"
import { parseSvgViewBoxNumbers } from "../../src/libs/markdown/mermaidRuntimeOverlay"
import { normalizeSoftBreakChildren } from "../../src/libs/markdown/MarkdownRendererInline"
import { countHtmlTags } from "../../src/libs/markdown/renderingHtmlModel"
import { syncResponsiveTables } from "../../src/libs/markdown/hooks/useResponsiveTableEffect"
import { selectUniqueRelatedPosts } from "../../src/routes/Detail/PostDetail/PostDetailRelatedSection"
import {
  RAIL_UI_DETAILED_TOC,
  RAIL_UI_LEFT_ACTIVE,
  RAIL_UI_RIGHT_ACTIVE,
} from "../../src/routes/Detail/PostDetail"
import {
  TAG_EXPAND_CHIP,
  TAG_EXPAND_DESKTOP,
} from "../../src/routes/Feed/TagList"
import type { TPost } from "../../src/types"

const repoRoot = process.cwd()
const readRepoFile = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

const makePost = (id: string, slug = `post-${id}`): TPost => ({
  id,
  slug,
  title: `Title ${id}`,
  summary: `Summary ${id}`,
  date: { start_date: "2026-10-25" },
  status: ["Public"],
  type: ["Post"],
  tags: ["perf"],
  category: ["Tech"],
  author: [{ id: "1", name: "Author" }],
  createdTime: "2026-10-25T00:00:00.000Z",
  fullWidth: false,
})

test.describe("wave-5 public UX, responsive layout, and hot-path optimizations", () => {
  test("parseSvgViewBoxNumbers parses 4-number SVG viewBoxes in a single pass without regex splitting", () => {
    expect(parseSvgViewBoxNumbers("0 0 840 420")).toEqual([0, 0, 840, 420])
    expect(parseSvgViewBoxNumbers("  -12.5, 8.25 , 640.5 , 320.75  ")).toEqual([
      -12.5, 8.25, 640.5, 320.75,
    ])
    expect(parseSvgViewBoxNumbers("0\t0\n100\r200")).toEqual([0, 0, 100, 200])
    expect(parseSvgViewBoxNumbers("")).toBeNull()
    expect(parseSvgViewBoxNumbers("0 0 100")).toBeNull()
    expect(parseSvgViewBoxNumbers("0 0 100 200 300")).toBeNull()
    expect(parseSvgViewBoxNumbers("0 0 NaN 200")).toBeNull()
  })

  test("selectUniqueRelatedPosts deduplicates primary and fallback posts in a single pass with early exit", () => {
    const p1 = makePost("1")
    const p2 = makePost("2")
    const p3 = makePost("3")
    const p4 = makePost("4")
    const invalidPost = makePost("5", "")

    expect(
      selectUniqueRelatedPosts([p1, p2, p1, invalidPost], [p2, p3, p4], 3)
    ).toEqual([p1, p2, p3])
    expect(selectUniqueRelatedPosts([p1, p2, p3], [p4], 2)).toEqual([p1, p2])
    expect(selectUniqueRelatedPosts([], [p3, p4], 1)).toEqual([p3])
    expect(selectUniqueRelatedPosts([p1], [p2], 0)).toEqual([])
  })

  test("normalizeSoftBreakChildren preserves strings without newlines and splits newline strings via indexOf", () => {
    const singlePlain = "plain text without line break"
    expect(normalizeSoftBreakChildren(singlePlain)).toBe(singlePlain)

    const converted = normalizeSoftBreakChildren(["line one\nline two", "no break"]) as unknown[]
    expect(Array.isArray(converted)).toBe(true)
    expect(converted[0]).toBe("line one")
    expect((converted[1] as { type?: string })?.type).toBe("br")
    expect(converted[2]).toBe("line two")
    expect(converted[3]).toBe("no break")
  })

  test("countHtmlTags counts opening and closing container tags using precompiled regex cache", () => {
    const html = '<div class="outer"><section><div id="inner"><figure></figure></div></section>'
    expect(countHtmlTags(html, "div", false)).toBe(2)
    expect(countHtmlTags(html, "div", true)).toBe(1)
    expect(countHtmlTags(html, "section", false)).toBe(1)
    expect(countHtmlTags(html, "section", true)).toBe(1)
    expect(countHtmlTags(html, "figure", false)).toBe(1)
    expect(countHtmlTags(html, "figure", true)).toBe(1)
    expect(countHtmlTags("<article></article>", "article", false)).toBe(1)
    expect(countHtmlTags("<article></article>", "article", true)).toBe(1)
  })

  test("syncResponsiveTables short-circuits when root contains no table element", () => {
    let querySelectorAllCalls = 0
    const rootWithoutTable = {
      querySelector: () => null,
      querySelectorAll: () => {
        querySelectorAllCalls += 1
        return []
      },
    } as unknown as HTMLElement

    syncResponsiveTables(rootWithoutTable)
    expect(querySelectorAllCalls).toBe(0)
  })

  test("bitmask constants for PostDetail rail UI and TagList expand state are distinct powers of two", () => {
    expect(RAIL_UI_DETAILED_TOC).toBe(1)
    expect(RAIL_UI_LEFT_ACTIVE).toBe(2)
    expect(RAIL_UI_RIGHT_ACTIVE).toBe(4)
    expect(
      RAIL_UI_DETAILED_TOC & RAIL_UI_LEFT_ACTIVE & RAIL_UI_RIGHT_ACTIVE
    ).toBe(0)

    expect(TAG_EXPAND_DESKTOP).toBe(1)
    expect(TAG_EXPAND_CHIP).toBe(2)
    expect(TAG_EXPAND_DESKTOP & TAG_EXPAND_CHIP).toBe(0)
  })

  test("enforces Wave-5 public UX, responsive touch targets, hover guards, and hot-path contracts", () => {
    const postCard = readRepoFile("src/routes/Feed/PostList/PostCard.tsx")
    expect(postCard).not.toContain("&:last-of-type {\n    border-bottom: 0;\n  }")
    expect(postCard).not.toContain("999px")

    const postList = readRepoFile("src/routes/Feed/PostList/index.tsx")
    expect(postList).toContain(".deferredPostCardWrap:last-of-type > a")
    expect(postList).toContain("checkTriggerViewport")

    const codeStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts"
    )
    expect(codeStyles).toContain("touch-action: pan-x pan-y;")
    expect(codeStyles).toContain(".aq-code-copy.is-failed")

    const tableStyles = readRepoFile(
      "src/libs/markdown/components/MarkdownRendererRootTableToggleStyles.ts"
    )
    expect(tableStyles).toContain("touch-action: pan-x pan-y;")

    const postDetailIndex = readRepoFile("src/routes/Detail/PostDetail/index.tsx")
    expect(postDetailIndex).toContain("tocScrollLockRef")
    expect(postDetailIndex).toContain("railUiMask")

    const postDetailMobileToc = readRepoFile(
      "src/routes/Detail/PostDetail/PostDetailMobileToc.tsx"
    )
    expect(postDetailMobileToc).toContain("mobileTocDepthToggle")
    expect(postDetailMobileToc).toContain('querySelector<HTMLElement>("summary")?.focus()')

    const engagementActions = readRepoFile(
      "src/routes/Detail/PostDetail/usePostDetailEngagementActions.ts"
    )
    expect(engagementActions).toContain("if (promptResult !== null)")

    const mermaidRender = readRepoFile("src/libs/markdown/mermaidRuntimeRender.ts")
    expect(mermaidRender).toContain("mermaidRenderedWidth")
    expect(mermaidRender).toContain("clearBlockCache")

    const lightboxOverlay = readRepoFile("src/libs/markdown/imageLightboxOverlay.ts")
    expect(lightboxOverlay).toContain("image.draggable = false")
    expect(lightboxOverlay).toContain('zoomLevel > 1 ? "top left" : "center center"')

    const navBar = readRepoFile("src/layouts/RootLayout/Header/NavBar.tsx")
    expect(navBar).toContain("router.asPath.split(\"#\")[1]")
    expect(navBar).toContain("min-width: 44px;")

    const feedExplorer = readRepoFile("src/routes/Feed/FeedExplorer.tsx")
    expect(feedExplorer).toContain("data-selected={sortMode === option.value}")
    expect(feedExplorer).toContain("onBlur={(event) => {")

    const modalFocusTrap = readRepoFile("src/design-system/useModalFocusTrap.ts")
    expect(modalFocusTrap).toContain("!container.contains(activeElement)")

    const aboutPage = readRepoFile("src/pages/about.tsx")
    expect(aboutPage).toContain('adminProfile.aboutProjectSectionTitle?.trim() || "Projects"')

    const heroParticles = readRepoFile("src/routes/Company/CompanyHeroParticles.tsx")
    expect(heroParticles).toContain("const syncRect = () => {")
    expect(heroParticles).toContain('window.addEventListener("scroll", syncRect, { passive: true })')
  })
})
