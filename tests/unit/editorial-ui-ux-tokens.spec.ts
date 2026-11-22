import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import { expect, test } from "@playwright/test"
import { EDITOR_COLOR_SWATCH_SPECS } from "../../src/components/markdown-editor/markdownEditorBlockChromeModel"
import { LanguageProvider as RawLanguageProvider } from "../../src/libs/language"
import {
  articleTypographyScale,
  markdownContentTypography,
} from "../../src/libs/markdown/contentTypography"
import {
  INLINE_TEXT_COLOR_OPTIONS,
  resolveInlineColorValue,
} from "../../src/libs/markdown/inlineColor"
import { PostDetailNavigationChrome as RawPostDetailNavigationChrome } from "../../src/routes/Detail/PostDetail/PostDetailNavigationChrome"
import {
  FEED_TAG_RAIL_CHIP_MAX_PX,
  FEED_TAG_RAIL_DESKTOP_MIN_PX,
} from "../../src/routes/Feed/feedUiTokens"
import { createTheme } from "../../src/styles/theme"
import { wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"

const pw = <P extends object>(Comp: ComponentType<P>) =>
  wrapPlaywrightJsxComponent(Comp) as ComponentType<P>

const LanguageProvider = pw(RawLanguageProvider)
const PostDetailNavigationChrome = pw(RawPostDetailNavigationChrome)
const CompatThemeProvider = ThemeProvider as unknown as ComponentType<Record<string, unknown>>

const relativeLuminance = (hex: string): number => {
  const clean = hex.replace(/^#/, "")
  const channels = [0, 2, 4].map((idx) => {
    const channel = Number.parseInt(clean.slice(idx, idx + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrastRatio = (foregroundHex: string, backgroundHex: string): number => {
  const l1 = relativeLuminance(foregroundHex)
  const l2 = relativeLuminance(backgroundHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

test.describe("Bundle 2 editorial UI/UX token & contrast regressions", () => {
  test("INLINE_TEXT_COLOR_OPTIONS and EDITOR_COLOR_SWATCH_SPECS satisfy WCAG AA >= 4.5:1 on light surfaces and stay aligned", () => {
    for (const option of INLINE_TEXT_COLOR_OPTIONS) {
      expect(contrastRatio(option.value, "#ffffff")).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(option.value, "#f7f7f5")).toBeGreaterThanOrEqual(4.5)
      expect(resolveInlineColorValue(option.token)).toBe(option.value)
    }

    for (const swatch of EDITOR_COLOR_SWATCH_SPECS) {
      expect(contrastRatio(swatch.hex, "#ffffff")).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(swatch.hex, "#f7f7f5")).toBeGreaterThanOrEqual(4.5)
      if (swatch.token !== "default") {
        expect(resolveInlineColorValue(swatch.token)).toBe(swatch.hex)
      }
    }
  })

  test("articleTypographyScale and markdownContentTypography enforce 1.74 line-height and word-break: keep-all", () => {
    expect(articleTypographyScale.bodyLineHeight).toBe("1.74")
    expect(articleTypographyScale.bodyLineHeightMobile).toBe("1.74")
    const cssText = markdownContentTypography(".aq-markdown", createTheme({ scheme: "light" })).styles
    expect(cssText).toContain("line-height: 1.74;")
    expect(cssText).toContain("word-break: keep-all;")
  })

  test("PostDetailNavigationChrome keeps AdjacentNav visible at bottom across desktop widths and localizes direction labels", () => {
    const mockRouter = {
      pathname: "/posts/991",
      asPath: "/posts/991",
      query: { id: "991" },
      push: async () => true,
      replace: async () => true,
      prefetch: async () => {},
      back: () => {},
      beforePopState: () => {},
      events: { on: () => {}, off: () => {}, emit: () => {} },
      isReady: true,
    } as never

    const html = renderToStaticMarkup(
      createElement(
        RouterContext.Provider,
        { value: mockRouter },
        createElement(
          CompatThemeProvider,
          { theme: createTheme({ scheme: "light" }) },
          createElement(
            LanguageProvider,
            null,
            createElement(PostDetailNavigationChrome, {
              previousPost: { id: 990, title: "이전 포스트 제목" } as never,
              nextPost: { id: 992, title: "다음 포스트 제목" } as never,
              showBackToTop: false,
              onBackToTop: () => {},
              tags: ["TypeScript"],
            })
          )
        )
      )
    )
    expect(html).toContain("이전 포스트 제목")
    expect(html).toContain("다음 포스트 제목")
    expect(html).toContain('class="mobileBackWrap"')

    const navSource = readFileSync(
      path.resolve(__dirname, "../../src/routes/Detail/PostDetail/PostDetailNavigationChrome.tsx"),
      "utf8"
    )
    expect(navSource).toContain(".mobileMetaTags,\n    .mobileBackWrap {\n      display: none;\n    }")
  })

  test("Feed rail tokens enforce 1200px chip / 1201px desktop breakpoint alignment", () => {
    expect(FEED_TAG_RAIL_CHIP_MAX_PX).toBe(1200)
    expect(FEED_TAG_RAIL_DESKTOP_MIN_PX).toBe(1201)
  })
})
