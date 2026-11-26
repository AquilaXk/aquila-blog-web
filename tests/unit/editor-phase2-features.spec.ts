import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { LanguageDescription } from "@codemirror/language"
import { EditorState, type Extension } from "@codemirror/state"
import { expect, test } from "@playwright/test"
import { createTheme } from "../../src/styles/theme"
import { getApiBaseUrl } from "../../src/apis/backend/client"
import { LanguageProvider } from "../../src/libs/language"
import {
  formatUnfurlDirectiveBlock,
  inferDirectiveKindForPastedUrl,
} from "../../src/libs/unfurl/fetchEditorUnfurl"
import { findBareUrlDirectiveAtOffset } from "../../src/components/markdown-editor/markdownEditorBareDirectiveUnfurl"
import {
  codeLanguages,
  jsonStreamLanguage,
} from "../../src/components/markdown-editor/markdownEditorCodeLanguages"
import { applyImageWidthCommitToMarkdown } from "../../src/components/markdown-editor/markdownEditorImageControls"
import {
  clampBoxToVisualViewport,
  findMarkdownLinkAtOffset,
} from "../../src/components/markdown-editor/markdownEditorLinkUtils"
import {
  filterSlashCommandSpecs,
  resolveSlashCommandMutation,
  SLASH_COMMAND_SPECS,
} from "../../src/components/markdown-editor/useMarkdownEditorSlashMenu"
import { computeCursorLineAndColumn } from "../../src/routes/Admin/editorStudioDedicatedSurfaceModel"
import { detectPublishPlaceholderIssue } from "../../src/routes/Admin/editorStudioMetaModel"
import { EditorStudioPublishReadinessCard } from "../../src/routes/Admin/EditorStudioPublishReadinessCard"
import { scanMarkdownPrePublishWarnings } from "../../src/routes/Admin/editorStudioPublishWarnings"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })

const renderThemed = (node: unknown, initialLanguage: "ko" | "en" = "ko"): string =>
  renderToStaticMarkup(
    createElement(ThemeProvider, {
      theme: lightTheme,
      children: materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage,
          children: node as ReactElement,
        })
      ) as ReactElement,
    })
  )

test.describe("Editor Phase 2 features & edge cases", () => {
  test("unfurl formatter omits non-canonical external thumbnails from persisted comments while keeping canonical ones", () => {
    const externalMetaBlock = formatUnfurlDirectiveBlock("bookmark", "https://example.com/post", {
      url: "https://example.com/post",
      title: "Example Post",
      description: "Deep technical writeup",
      siteName: "Example",
      provider: "Example",
      thumbnailUrl: "https://cdn.example.com/og.png",
    })
    expect(externalMetaBlock).toContain(":::bookmark https://example.com/post")
    expect(externalMetaBlock).toContain("Example Post")
    expect(externalMetaBlock).not.toContain("cdn.example.com/og.png")
    expect(detectPublishPlaceholderIssue(externalMetaBlock)).toBeNull()

    const canonicalImageUrl = new URL("/post/api/v1/images/posts/thumb.webp", getApiBaseUrl()).toString()
    const canonicalBlock = formatUnfurlDirectiveBlock("embed", "https://youtu.be/abc12345", {
      url: "https://youtu.be/abc12345",
      title: "Architecture Talk",
      description: "",
      siteName: "YouTube",
      provider: "YouTube",
      thumbnailUrl: canonicalImageUrl,
      embedUrl: "https://www.youtube-nocookie.com/embed/abc12345",
    })
    expect(canonicalBlock).toContain(canonicalImageUrl)
    expect(canonicalBlock).toContain("youtube-nocookie.com/embed/abc12345")
    expect(inferDirectiveKindForPastedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("embed")
    expect(inferDirectiveKindForPastedUrl("https://docs.example.org/guide")).toBe("bookmark")
  })

  test("bare directive detector matches closed empty bookmark/embed blocks and ignores enriched or code blocks", () => {
    const doc = [
      "Intro paragraph",
      ":::bookmark https://example.org/guide",
      "",
      ":::",
      '<!-- aq-bookmark {"title":"Already enriched"} -->',
      ":::bookmark https://enriched.example.org",
      ":::",
    ].join("\n")

    const insideBare = doc.indexOf("https://example.org/guide") + 4
    const hit = findBareUrlDirectiveAtOffset(doc, insideBare)
    expect(hit).not.toBeNull()
    expect(hit?.kind).toBe("bookmark")
    expect(hit?.url).toBe("https://example.org/guide")

    const outsideBare = findBareUrlDirectiveAtOffset(doc, 2)
    expect(outsideBare).toBeNull()

    const insideEnriched = doc.indexOf("https://enriched.example.org") + 4
    expect(findBareUrlDirectiveAtOffset(doc, insideEnriched)).toBeNull()
  })

  test("image width commit skips fenced code blocks and updates matching standalone image line cleanly", () => {
    const markdown = [
      "```md",
      "![ignored](/post/api/v1/images/posts/demo.png)",
      "```",
      "",
      "![first](/post/api/v1/images/posts/first.png) {align=center}",
      "![second](/post/api/v1/images/posts/demo.png \"Demo caption\") {height=300}",
    ].join("\n")

    const plan = applyImageWidthCommitToMarkdown(markdown, {
      src: "/post/api/v1/images/posts/demo.png",
      alt: "second",
      index: 1,
      widthPx: 640,
    })
    expect(plan).not.toBeNull()
    expect(plan?.replacement).toBe('![second](/post/api/v1/images/posts/demo.png "Demo caption") {width=640 height=300}')
    expect(markdown.slice(0, plan!.rangeStart)).not.toContain("height=300")
    expect(markdown.slice(plan!.rangeStart, plan!.rangeEnd)).toContain("second")
  })

  test("lazy codeLanguages provide sync JSON tokens and async Prism StreamLanguage loaders", async () => {
    const jsonDesc = LanguageDescription.matchLanguageName(codeLanguages, "json", true)
    expect(jsonDesc?.support).toBeDefined()

    const doc = '{"title": "hello", "count": 42, "published": true, "meta": null}'
    const state = EditorState.create({ doc, extensions: [jsonStreamLanguage as Extension] })
    const tree = jsonStreamLanguage.parser.parse(doc)
    const tokenNames: string[] = []
    tree.iterate({
      enter: (node) => {
        tokenNames.push(node.name)
      },
    })
    expect(state.doc.toString()).toBe(doc)
    expect(tokenNames).toContain("propertyName")
    expect(tokenNames).toContain("string")
    expect(tokenNames).toContain("number")
    expect(tokenNames).toContain("bool")
    expect(tokenNames).toContain("atom")

    for (const lang of ["kotlin", "python", "sql", "go", "rust", "yaml", "bash", "diff"]) {
      const desc = LanguageDescription.matchLanguageName(codeLanguages, lang, true)
      expect(desc, `missing LanguageDescription for ${lang}`).not.toBeNull()
      const support = await desc!.load()
      expect(support.language).toBeDefined()
    }
  })

  test("findMarkdownLinkAtOffset detects inline links accurately and ignores images, escaped links, and code", () => {
    const md = [
      "Visit [Docs (v2)](https://example.com/a_(b)) and `https://[code](https://no.test)` or ![img](/post/api/v1/images/a.png).",
      "",
      "```ts",
      "const s = '[in-fence](https://fence.test)'",
      "```",
    ].join("\n")

    const linkStart = md.indexOf("[Docs")
    const insideLink = linkStart + 3
    const hit = findMarkdownLinkAtOffset(md, insideLink)
    expect(hit).toEqual({
      from: linkStart,
      to: md.indexOf("))") + 2,
      label: "Docs (v2)",
      url: "https://example.com/a_(b)",
    })

    const insideCodeSpan = md.indexOf("in-fence")
    expect(findMarkdownLinkAtOffset(md, insideCodeSpan)).toBeNull()
    expect(findMarkdownLinkAtOffset(md, md.indexOf("![img]") + 2)).toBeNull()

    const inlineSpanPos = md.indexOf("[code]") + 2
    expect(findMarkdownLinkAtOffset(md, inlineSpanPos)).toBeNull()

    const clamped = clampBoxToVisualViewport(9000, -100, 320, 90)
    expect(clamped.left).toBeGreaterThanOrEqual(12)
    expect(clamped.top).toBeLessThanOrEqual(800)
  })

  test("slash specs include /wikilink, /footnote, /cloud and localize /toggle in English mode", () => {
    const ids = SLASH_COMMAND_SPECS.map((s) => s.id)
    expect(ids).toContain("wikilink")
    expect(ids).toContain("footnote")
    expect(ids).toContain("cloud")

    const withoutCloud = filterSlashCommandSpecs("cloud", false, { disableCloudAsset: true })
    expect(withoutCloud.some((s) => s.id === "cloud")).toBe(false)

    const toggleSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "toggle")!
    const enToggle = resolveSlashCommandMutation(toggleSpec, 0, 7, "en")
    expect(enToggle.replacement).toBe(":::toggle Toggle title\n\n:::")
    expect(detectPublishPlaceholderIssue(enToggle.replacement)).toContain("토글 제목")

    const koToggle = resolveSlashCommandMutation(toggleSpec, 0, 7, "ko")
    expect(koToggle.replacement).toBe(":::toggle 토글 제목\n\n:::")

    const wikilinkSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "wikilink")!
    const wikiPlan = resolveSlashCommandMutation(wikilinkSpec, 4, 13, "en")
    expect(wikiPlan.replacement).toBe("[[]]")
    expect(wikiPlan.selectionStart).toBe(6)
  })

  test("CRLF cursor calculation normalizes line breaks and pre-publish scanner flags unclosed blocks, TK/TODO, and body H1", () => {
    const crlfDoc = "Line one\r\nLine two\r\n# Heading"
    const cm6LfDoc = crlfDoc.replace(/\r\n?/g, "\n")
    expect(computeCursorLineAndColumn(crlfDoc, cm6LfDoc.indexOf("Line two") + 4)).toEqual({
      line: 2,
      column: 5,
    })

    const messyDoc = [
      "# Duplicate H1",
      "",
      "Check `TODO` inline is ignored.",
      "Need final paragraph TK here.",
      ":::callout info \"Open\"",
      "Body line",
      "```ts",
      "const todo = 'inside fence'",
    ].join("\n")

    const warnings = scanMarkdownPrePublishWarnings(messyDoc)
    expect(warnings).toEqual([
      { kind: "unclosed-fence", line: 7 },
      { kind: "unclosed-directive", line: 5 },
      { kind: "placeholder-marker", line: 4, token: "TK" },
      { kind: "body-h1", count: 1, firstLine: 1 },
    ])

    const html = renderThemed(
      createElement(EditorStudioPublishReadinessCard, {
        hasTitle: true,
        wordCount: 40,
        hasBody: true,
        hasManualSummary: true,
        tagCount: 2,
        linkWarningCount: 0,
        totalLinkCount: 0,
        prePublishWarnings: warnings,
      }),
      "ko"
    )
    expect(html).toContain("5/5")
    expect(html).toContain('data-testid="editor-publish-warnings"')
    expect(html).toContain("닫히지 않은 코드 블록")
    expect(html).toContain("본문 H1 제목")
  })
})
