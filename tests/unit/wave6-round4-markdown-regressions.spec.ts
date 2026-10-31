import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { appendInlineMarkdownNodes } from "../../src/components/markdown-editor/markdownEditorInlineDom"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import * as inlineColorModule from "../../src/libs/markdown/inlineColor"
import { applyInlineColors } from "../../src/libs/markdown/hooks/useInlineColorEffect"
import { findMarkdownHighlightSpans } from "../../src/libs/markdown/inlineHighlightModel"
import { normalizeLegacyInlineHtmlMarkdown } from "../../src/libs/markdown/inlineHtmlNormalization"
import * as inlineMathGuardModule from "../../src/libs/markdown/inlineMathGuardModel"
import {
  protectEscapedInlineSyntax,
  remarkRestoreProtectedInlineTokens,
} from "../../src/libs/markdown/inlineMathGuardModel"
import {
  findDoubleBraceColorSpans,
  stripDoubleBraceColorTokensOnce,
} from "../../src/libs/markdown/inlineTokenScanners"
import { skipInlineLiteralConstructAt } from "../../src/libs/markdown/pandocMathScanner"
import { mountMermaidErrorStateDom } from "../../src/libs/markdown/mermaidRuntimeSanitize"
import {
  normalizeSafeMarkdownLinkHref,
  normalizeSafeMarkdownUrl,
  setSafeAnchorHref,
} from "../../src/libs/markdown/safeMarkdownUrl"
import {
  createMarkdownDocumentInsights,
  formatMarkdownHeadingLabel,
} from "../../src/libs/markdown/markdownDocumentInsights"
import { createTheme } from "../../src/styles/theme"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import { SimpleDomElement, withMockDom } from "./helpers/simpleMockDom"

const lightTheme = createTheme({ scheme: "light" })

const renderMarkdownHtml = (content: string): string => {
  const queryClient = new QueryClient()
  const themeProps = {
    theme: lightTheme,
    children: createElement(MarkdownRenderer, { content, disableMermaid: true }),
  }
  const tree = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ThemeProvider, themeProps)
  )
  return renderToStaticMarkup(materializePlaywrightJsx(tree) as ReactElement).replace(
    /<style[^>]*>[\s\S]*?<\/style>/g,
    ""
  )
}

test.describe("wave6 round4 public markdown regressions", () => {
  test("double-brace color scanner handles nested braces, escapes, code, math, and unclosed outer headers", () => {
    const nested = findDoubleBraceColorSpans("{{color:sky|fn() { return { a: 1 } }}}", {
      trimTrailingContentWhitespace: true,
      allowEmptyContent: false,
      singleLine: true,
    })
    expect(nested.map((s) => s.content)).toEqual(["fn() { return { a: 1 } }"])

    const escapedAndCode = findDoubleBraceColorSpans(
      "{{color:green|keep \\}\\} and `x}}y`}} {{color:amber|$\\frac{1}{{2}}$}} {{color:rose|$$\\text{a}}b$$}}",
      { trimTrailingContentWhitespace: true, allowEmptyContent: false, singleLine: true }
    )
    expect(escapedAndCode.map((s) => [s.colorToken, s.content])).toEqual([
      ["green", "keep \\}\\} and `x}}y`"],
      ["amber", "$\\frac{1}{{2}}$"],
      ["rose", "$$\\text{a}}b$$"],
    ])

    const recovered = findDoubleBraceColorSpans("{{color:red|unclosed {{color:blue|inner}}", {
      trimTrailingContentWhitespace: true,
      allowEmptyContent: false,
      singleLine: true,
    })
    expect(recovered.map((s) => [s.colorToken, s.content])).toEqual([["blue", "inner"]])

    expect(stripDoubleBraceColorTokensOnce("{{color:red|unclosed\nnext}} and {{color:sky|ok}}")).toBe(
      "{{color:red|unclosed\nnext}} and ok"
    )
  })

  test("applyInlineColors uses brace-aware single-line scanner and INLINE_COLOR_TOKEN_REGEX is removed", () => {
    expect("INLINE_COLOR_TOKEN_REGEX" in inlineColorModule).toBe(false)

    withMockDom(() => {
      type MockOutNode = {
        className: string
        textContent: string
        cssVar?: string
      }
      const replacedNodes: MockOutNode[] = []
      const parentNode = {
        closest: () => null,
        replaceChild: (fragment: { childNodes: MockOutNode[] }) => {
          replacedNodes.push(...fragment.childNodes)
        },
      }
      const textNode = {
        nodeValue: "{{color:green|C:\\}} and {{color:green|obj { a: { b: 1 } }}} and {{color:red|line1\nline2}}",
        textContent: "{{color:green|C:\\}} and {{color:green|obj { a: { b: 1 } }}} and {{color:red|line1\nline2}}",
        parentElement: parentNode,
        parentNode,
      }
      const doc = globalThis.document as unknown as Record<string, unknown>
      doc.createDocumentFragment = () => {
        const childNodes: MockOutNode[] = []
        return {
          childNodes,
          appendChild: (node: MockOutNode) => {
            childNodes.push(node)
            return node
          },
        }
      }
      doc.createTreeWalker = () => {
        let consumed = false
        return {
          currentNode: textNode,
          nextNode: () => {
            if (consumed) return null
            consumed = true
            return textNode
          },
        }
      }
      doc.createElement = (): MockOutNode & { style: { setProperty: (k: string, v: string) => void } } => {
        const el: MockOutNode & { style: { setProperty: (k: string, v: string) => void } } = {
          className: "",
          textContent: "",
          style: {
            setProperty: (_k: string, val: string) => {
              el.cssVar = val
            },
          },
        }
        return el
      }
      doc.createTextNode = (val: string): MockOutNode => ({ className: "", textContent: val })

      applyInlineColors({ textContent: textNode.nodeValue } as unknown as HTMLElement)
      expect(replacedNodes).toHaveLength(4)
      expect(replacedNodes[0]?.className).toBe("aq-inline-color")
      expect(replacedNodes[0]?.cssVar).toBe("#34d399")
      expect(replacedNodes[0]?.textContent).toBe("C:\\")
      expect(replacedNodes[2]?.className).toBe("aq-inline-color")
      expect(replacedNodes[2]?.cssVar).toBe("#34d399")
      expect(replacedNodes[2]?.textContent).toBe("obj { a: { b: 1 } }")
      expect(replacedNodes[3]?.textContent).toBe(" and {{color:red|line1\nline2}}")
    })
  })

  test("escaped and code-wrapped highlight delimiters do not produce false mark elements", () => {
    expect(findMarkdownHighlightSpans("\\==escaped==")).toEqual([])
    expect(findMarkdownHighlightSpans("`==code==` and ==`a == b`==")).toHaveLength(1)
    expect(findMarkdownHighlightSpans("==keep \\== literal==")).toHaveLength(1)

    const html = renderMarkdownHtml(
      [
        "\\==plain== and ==keep \\== inside== and \\\\==real==",
        "",
        "`\\==code==` and $x \\== y$",
      ].join("\n")
    )
    expect(html).toContain(
      "<p>==plain== and <mark class=\"aq-highlight\">keep == inside</mark> and \\<mark class=\"aq-highlight\">real</mark></p>"
    )
    expect(html).not.toContain("\uE000")
    expect(html).toContain("<code class=\"aq-inline-code\">\\==code==</code>")
    expect(renderMarkdownHtml("[\uE000aqwl0\uE001 [[literal]]](/posts/test)")).toContain(
      "\uE000aqwl0\uE001 [[literal]]</a>"
    )
  })

  test("legacy inline HTML normalizer recovers past unclosed tags, preserves entities inside raw tags, and respects escaped backticks", () => {
    expect(normalizeLegacyInlineHtmlMarkdown("<b>unclosed and <b>bold</b> and <i>em</i>")).toBe(
      "<b>unclosed and **bold** and *em*"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("\\`<b>bold</b>\\` and ``a ` <b>code</b>``")).toBe(
      "\\`**bold**\\` and ``a ` <b>code</b>``"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("<b>&lt;br&gt;</b>")).toBe("**&#60;br&#62;**")

    const html = renderMarkdownHtml(
      "<b>&lt;i&gt;x&lt;/i&gt; &amp; &#60;del&#62;y&#60;/del&#62; &lt;br&gt; &quot;q&quot;</b> and &lt;em&gt;ok&lt;/em&gt; and <code>&lt;div&gt;</code>"
    )
    expect(html).toContain(
      "<strong>&lt;i&gt;x&lt;/i&gt; &amp; &lt;del&gt;y&lt;/del&gt; &lt;br&gt; &quot;q&quot;</strong>"
    )
    expect(html).not.toContain("<strong><br/></strong>")
    expect(html).not.toContain("<em>x</em>")
    expect(html).not.toContain("<del>y</del>")
    expect(html).toContain("<em>ok</em>")
    expect(html).toContain("<code class=\"aq-inline-code\">&lt;div&gt;</code>")
  })

  test("safeMarkdownUrl preserves raw hash fragments, enforces bounded dot-relative paths, and locks anchor href prefixes", () => {
    expect(normalizeSafeMarkdownLinkHref("#")).toBe("#")
    expect(normalizeSafeMarkdownLinkHref("#한글-제목")).toBe("#한글-제목")
    expect(normalizeSafeMarkdownUrl("./files/spec.pdf")).toBe("./files/spec.pdf")
    expect(normalizeSafeMarkdownUrl("../guide/intro.md")).toBe("../guide/intro.md")
    expect(normalizeSafeMarkdownUrl("../../admin")).toBe("")
    expect(normalizeSafeMarkdownUrl("./a/../b")).toBe("")
    expect(normalizeSafeMarkdownUrl("./%2e%2e/admin")).toBe("")
    expect(normalizeSafeMarkdownUrl("../")).toBe("")

    for (const valid of ["#", "#한글-제목", "/", "/posts/1", "./files/spec.pdf", "../guide", "https://example.com/a", "http://example.com/a", "mailto:hi@example.com"]) {
      const anchor = new SimpleDomElement("a")
      expect(setSafeAnchorHref(anchor as unknown as HTMLAnchorElement, valid)).toBe(valid)
      expect(anchor.getAttribute("href")).toBe(valid)
    }

    for (const blocked of ["javascript:alert(1)", "//evil.com/path", "../../admin", "./a\\b"]) {
      const anchor = new SimpleDomElement("a")
      expect(setSafeAnchorHref(anchor as unknown as HTMLAnchorElement, blocked)).toBe("")
      expect(anchor.getAttribute("href")).toBeNull()
    }

    withMockDom(() => {
      const host = new SimpleDomElement("div")
      host.appendChild(new SimpleDomElement("span"))
      mountMermaidErrorStateDom(host as unknown as HTMLElement, { source: "graph TD", error: new Error("parse error") })
      expect(host.children).toHaveLength(1)
    })
  })

  test("legacy inline HTML normalizer shields emitted code spans from formatting and br passes", () => {
    expect(normalizeLegacyInlineHtmlMarkdown("<code>&lt;b&gt;x&lt;/b&gt;</code>")).toBe("`<b>x</b>`")
    expect(normalizeLegacyInlineHtmlMarkdown("<code>&lt;br&gt;</code>")).toBe("`<br>`")
    expect(normalizeLegacyInlineHtmlMarkdown("<b><code>&lt;/b&gt;</code> bold</b>")).toBe(
      "**`</b>` bold**"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("<b><code>&lt;b&gt;</code></b>")).toBe("**`<b>`**")
    expect(normalizeLegacyInlineHtmlMarkdown("<b><code>a &amp;lt; b</code></b>")).toBe(
      "**`a &lt; b`**"
    )
    expect(
      normalizeLegacyInlineHtmlMarkdown("&lt;code&gt;&amp;lt;b&amp;gt;x&amp;lt;/b&amp;gt;&lt;/code&gt;")
    ).toBe("`&lt;b&gt;x&lt;/b&gt;`")
    expect(
      normalizeLegacyInlineHtmlMarkdown("\uE000AQCODE0_0\uE001 <code>&lt;b&gt;x&lt;/b&gt;</code>")
    ).toBe("\uE000AQCODE0_0\uE001 `<b>x</b>`")
  })

  test("protected inline sentinels restore cleanly across h5/h6, indented code, images, definitions, collisions, single-char escapes, and colors", () => {
    const h5Html = renderMarkdownHtml("##### Check \\== 1")
    expect(h5Html).toContain("<h5>Check == 1</h5>")
    expect(h5Html).not.toContain("<mark")
    expect(h5Html).not.toContain("\uE000")

    const h6Html = renderMarkdownHtml("###### \\<br>")
    expect(h6Html).toContain("<h6>&lt;br&gt;</h6>")
    expect(h6Html).not.toContain("<br")
    expect(h6Html).not.toContain("\uE000")

    const indentedCodeHtml = renderMarkdownHtml(
      "intro\n\n    if (a \\== b || x \\< y || &lt;br>)"
    )
    expect(indentedCodeHtml).not.toContain("\uE000")
    expect(indentedCodeHtml).toContain(
      "data-raw-code=\"if (a \\== b || x \\&lt; y || &amp;lt;br&gt;)\""
    )
    expect(indentedCodeHtml).toContain("\\==")
    expect(indentedCodeHtml).toContain("\\&lt;")
    expect(indentedCodeHtml).toContain("&amp;lt;br&gt;")

    const inlineImgHtml = renderMarkdownHtml("See ![a \\== b](/post/api/v1/images/x.png)")
    expect(inlineImgHtml).not.toContain("\uE000")
    expect(inlineImgHtml).toContain("alt=\"a == b\"")

    const blockedImgHtml = renderMarkdownHtml("See ![a \\== b](https://evil.invalid/x.png)")
    expect(blockedImgHtml).not.toContain("\uE000")
    expect(blockedImgHtml).toContain("aria-label=\"a == b\"")
    expect(blockedImgHtml).toContain(">a == b</span>")

    const refLinkHtml = renderMarkdownHtml("[x][id]\n\n[id]: /posts/1 \"Title \\==\"")
    expect(refLinkHtml).not.toContain("\uE000")
    expect(refLinkHtml).toContain("href=\"/posts/1\"")
    expect(refLinkHtml).toContain("title=\"Title ==\"")

    const collisionHtml = renderMarkdownHtml("\uE000aqp0_eq\uE001 and \\==plain==")
    expect(collisionHtml).toContain("\uE000aqp0_eq\uE001 and ==plain==")
    expect(collisionHtml).not.toContain("<mark")

    const singleCharEscapesHtml = renderMarkdownHtml(
      "=\\=plain== and \\=\\=plain== and ==highlight\\==="
    )
    expect(singleCharEscapesHtml).toContain(
      "<p>==plain== and ==plain== and <mark class=\"aq-highlight\">highlight=</mark></p>"
    )
    expect(singleCharEscapesHtml).not.toContain("\uE000")

    const colorRenderedHtml = renderMarkdownHtml("{{color:green|keep \\}\\} and `x}}y`}}")
    expect(colorRenderedHtml).toContain(
      "<span class=\"aq-inline-color\" style=\"--aq-inline-color:#34d399\">keep }} and <code class=\"aq-inline-code\">x}}y</code></span>"
    )
    expect(colorRenderedHtml).not.toContain("\uE000")

    const escapedColorHtml = renderMarkdownHtml("\\{{color:red|x}}")
    expect(escapedColorHtml).toContain("<p>{{color:red|x}}</p>")
    expect(escapedColorHtml).not.toContain("aq-inline-color")
    expect(escapedColorHtml).not.toContain("\uE000")

    const postCommonMarkColorHtml = renderMarkdownHtml(
      "\\\\{{color:red|path C:\\\\}} and {{color:blue|\\`a}} and \\`b}} and \\&lt;br&gt;"
    )
    expect(postCommonMarkColorHtml).toContain(
      "\\<span class=\"aq-inline-color\" style=\"--aq-inline-color:#eb5757\">path C:\\</span> and <span class=\"aq-inline-color\" style=\"--aq-inline-color:#2383e2\">`a</span> and `b}} and &amp;lt;br&gt;"
    )
    expect(postCommonMarkColorHtml).not.toContain("<br")
  })

  test("double-brace color scanner enforces singleLine across code and display math, skips unclosed multi-backtick runs, and skips escaped openers", () => {
    expect(
      findDoubleBraceColorSpans("{{color:red|`a\nb`}}", {
        trimTrailingContentWhitespace: true,
        allowEmptyContent: false,
        singleLine: true,
      })
    ).toEqual([])
    expect(
      findDoubleBraceColorSpans("{{color:red|$$a\nb$$}}", {
        trimTrailingContentWhitespace: true,
        allowEmptyContent: false,
        singleLine: true,
      })
    ).toEqual([])
    expect(stripDoubleBraceColorTokensOnce("{{color:red|`a\nb`}} and {{color:red|$$a\nb$$}}")).toBe(
      "{{color:red|`a\nb`}} and {{color:red|$$a\nb$$}}"
    )
    expect(
      findDoubleBraceColorSpans("`` a `{{color:red|x}}` b", {
        trimTrailingContentWhitespace: true,
        allowEmptyContent: false,
        singleLine: true,
      })
    ).toEqual([])
    expect(
      findDoubleBraceColorSpans("\\{{color:red|x}}", {
        trimTrailingContentWhitespace: true,
        allowEmptyContent: false,
        singleLine: true,
      })
    ).toEqual([])
    expect(stripDoubleBraceColorTokensOnce("\\{{color:red|x}}")).toBe("\\{{color:red|x}}")
  })

  test("highlight scanner and heading label formatter skip single-line Pandoc math spans", () => {
    expect(findMarkdownHighlightSpans("==$a==b$==")).toEqual([
      { from: 0, to: 10, contentFrom: 2, contentTo: 8 },
    ])
    expect(findMarkdownHighlightSpans("==$$a==b$$==")).toEqual([
      { from: 0, to: 12, contentFrom: 2, contentTo: 10 },
    ])
    expect(findMarkdownHighlightSpans("$a==b$ and $c==d$")).toEqual([])
    expect(formatMarkdownHeadingLabel("==$a==b$==")).toBe("$a==b$")
    expect(formatMarkdownHeadingLabel("==$$a==b$$==")).toBe("$$a==b$$")
    expect(formatMarkdownHeadingLabel("$a==b$ and $c==d$")).toBe("$a==b$ and $c==d$")
  })

  test("safeMarkdownUrl allows // in dot-relative query strings and percent-encodes HTML metacharacters in setSafeAnchorHref", () => {
    expect(normalizeSafeMarkdownUrl("./post?ref=https://example.com")).toBe(
      "./post?ref=https://example.com"
    )
    const metaAnchor = new SimpleDomElement("a")
    expect(setSafeAnchorHref(metaAnchor as unknown as HTMLAnchorElement, "#a\"b<c>'d")).toBe(
      "#a%22b%3Cc%3E%27d"
    )
    expect(metaAnchor.getAttribute("href")).toBe("#a%22b%3Cc%3E%27d")

    const koreanAnchor = new SimpleDomElement("a")
    expect(setSafeAnchorHref(koreanAnchor as unknown as HTMLAnchorElement, "#한글-제목")).toBe(
      "#한글-제목"
    )
    expect(koreanAnchor.getAttribute("href")).toBe("#한글-제목")
  })

  test("round 6: trailing backslashes in <code>, numeric entity PUA collisions, indented code blocks, and inline triple-backtick spans", () => {
    expect(normalizeLegacyInlineHtmlMarkdown("<code>C:\\</code>")).toBe("`C:\\`")
    expect(normalizeLegacyInlineHtmlMarkdown("<code>\\</code>")).toBe("`\\`")
    expect(normalizeLegacyInlineHtmlMarkdown("<code>C:\\</code> and <code>D:\\</code>")).toBe(
      "`C:\\` and `D:\\`"
    )
    expect(
      normalizeLegacyInlineHtmlMarkdown("&lt;code&gt;C:\\&lt;/code&gt; and &lt;code&gt;\\&lt;/code&gt;")
    ).toBe("`C:\\` and `\\`")
    expect(normalizeLegacyInlineHtmlMarkdown("\\<code>C:\\</code>")).toBe("\\<code>C:\\</code>")

    expect(
      normalizeLegacyInlineHtmlMarkdown("<b>&#xE000;AQCODE0_0&#xE001;</b> <code>real</code>")
    ).toBe("**\uE000AQCODE0_0\uE001** `real`")
    const codeCollisionHtml = renderMarkdownHtml("<b>&#xE000;AQCODE0_0&#xE001;</b> <code>real</code>")
    expect(codeCollisionHtml).toContain("<strong>\uE000AQCODE0_0\uE001</strong>")
    expect(codeCollisionHtml).toContain("<code class=\"aq-inline-code\">real</code>")

    expect(
      normalizeLegacyInlineHtmlMarkdown("```inline``` and <b>bold</b>\n<b>next</b>")
    ).toBe("```inline``` and **bold**\n**next**")

    const indentedBlock = "intro\n\n    if (a <br> b || &lt;br&gt; || <b>x</b>)"
    expect(normalizeLegacyInlineHtmlMarkdown(indentedBlock)).toBe(indentedBlock)
    const indentedHtml = renderMarkdownHtml(indentedBlock)
    expect(indentedHtml).toContain(
      "data-raw-code=\"if (a &lt;br&gt; b || &amp;lt;br&amp;gt; || &lt;b&gt;x&lt;/b&gt;)\""
    )
    expect(indentedHtml).not.toContain("<strong>x</strong>")

    expect(normalizeLegacyInlineHtmlMarkdown("\tif (a <br> b || <b>x</b>)")).toBe(
      "\tif (a <br> b || <b>x</b>)"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("> intro\n>\n>     if (a <br> b || <b>x</b>)")).toBe(
      "> intro\n>\n>     if (a <br> b || <b>x</b>)"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("intro\n    <b>bold</b>")).toBe("intro\n    **bold**")
    expect(normalizeLegacyInlineHtmlMarkdown("- item\n\n    <b>bold</b>")).toBe(
      "- item\n\n    **bold**"
    )
    expect(normalizeLegacyInlineHtmlMarkdown(">   - item\n\n    if (a <b> b)")).toBe(
      ">   - item\n\n    if (a <b> b)"
    )
    expect(normalizeLegacyInlineHtmlMarkdown("# Heading <b>title</b>\n    if (a <b> b)")).toBe(
      "# Heading **title**\n    if (a <b> b)"
    )
  })

  test("round 6: Pandoc math inside color scanner/headings, unified < entities, sentinel collisions, fence meta, and imageReferences", () => {
    expect("protectEscapedHighlightDelimiters" in inlineMathGuardModule).toBe(false)
    expect(skipInlineLiteralConstructAt("\\x", 0, { honorEscapes: false })).toBe(-1)
    expect(skipInlineLiteralConstructAt("```unclosed", 0, { codeScanLimit: 5 })).toBe(3)
    expect(skipInlineLiteralConstructAt("$$a\nb$$", 0, { singleLineDisplayMath: true })).toBe(2)
    expect(skipInlineLiteralConstructAt("$$$x$$$", 0)).toBe(3)
    expect(skipInlineLiteralConstructAt("plain", 0)).toBe(-1)

    expect(formatMarkdownHeadingLabel("## Formula ${{color:red|x}}$")).toBe(
      "## Formula ${{color:red|x}}$"
    )
    expect(formatMarkdownHeadingLabel("# Formula $\\text{{color:red|x}}$")).toBe(
      "# Formula $\\text{{color:red|x}}$"
    )
    expect(
      createMarkdownDocumentInsights("# Formula $\\text{{color:red|x}}$\n## Formula ${{color:red|x}}$")
        .headings.map((h) => h.label)
    ).toEqual(["Formula $\\text{{color:red|x}}$", "Formula ${{color:red|x}}$"])
    expect(
      stripDoubleBraceColorTokensOnce("Formula $\\text{{color:red|x}}$ and $$y + {{color:blue|z}}$$")
    ).toBe("Formula $\\text{{color:red|x}}$ and $$y + {{color:blue|z}}$$")

    const aqpEntityCollisionHtml = renderMarkdownHtml("&#xE000;aqp0_eq&#xE001; and \\==plain==")
    expect(aqpEntityCollisionHtml).toContain("\uE000aqp0_eq\uE001 and ==plain==")
    expect(aqpEntityCollisionHtml).not.toContain("<mark")

    const ltEntitiesHtml = renderMarkdownHtml("&lt;br&#47;> and &lt;&#32;br> and &lt;b&#114;>")
    expect(ltEntitiesHtml).not.toContain("<br")
    expect(ltEntitiesHtml).toContain("&lt;br/&gt; and &lt; br&gt; and &lt;br&gt;")

    const nestedFenceHtml = renderMarkdownHtml(
      ["- outer", "  - inner", "    ```ts title=\"a\\=b\"", "    const x = 1", "    ```"].join("\n")
    )
    expect(nestedFenceHtml).not.toContain("\uE000")
    expect(nestedFenceHtml).toContain("a=b")

    const unresolvedImgRefHtml = renderMarkdownHtml("![a \\==b==][missing]")
    expect(unresolvedImgRefHtml).not.toContain("\uE000")
    expect(unresolvedImgRefHtml).not.toContain("<mark")
    expect(unresolvedImgRefHtml).toContain("![a ==b==][missing]")

    const definedImgRefHtml = renderMarkdownHtml(
      "![a \\==b==][def]\n\n[def]: /post/api/v1/images/x.png"
    )
    expect(definedImgRefHtml).not.toContain("\uE000")
    expect(definedImgRefHtml).not.toContain("<mark")
    expect(definedImgRefHtml).toContain("alt=\"a ==b==\"")

    const protectedSample = protectEscapedInlineSyntax("a \\==b==")
    const astSample = {
      type: "root",
      children: [
        { type: "definition", identifier: "def", url: "/post/api/v1/images/x.png" },
        {
          type: "code",
          lang: `ts${protectedSample.sentinels.eq}`,
          meta: `title="a${protectedSample.sentinels.eq}b"`,
          value: protectedSample.markdown,
        },
        {
          type: "paragraph",
          children: [
            { type: "imageReference", identifier: "DEF", alt: protectedSample.markdown },
            { type: "imageReference", identifier: "missing", alt: protectedSample.markdown },
          ],
        },
      ],
    }
    remarkRestoreProtectedInlineTokens(protectedSample)(astSample)
    const codeNode = astSample.children[1] as { lang: string; meta: string; value: string }
    const paraChildren = (astSample.children[2] as { children: Array<{ alt: string }> }).children
    expect(codeNode.lang).toBe("ts=")
    expect(codeNode.meta).toBe("title=\"a=b\"")
    expect(codeNode.value).toBe("a \\==b==")
    expect(paraChildren[0]?.alt).toBe("a ==b==")
    expect(paraChildren[1]?.alt).toBe(protectedSample.markdown)

    withMockDom(() => {
      const container = new SimpleDomElement("div")
      appendInlineMarkdownNodes(
        container as unknown as HTMLElement,
        "**keep `a**b` and $x**y$** *em `c*d`* [lbl `e]f`](/posts/1) `code` $x+1$ <br> [[Note|Alias]] {{color:red|hi}} ==mark=="
      )
      const elementTags = container.children
        .map((c) => c.tagName.toLowerCase())
        .filter((tag) => tag !== "#text")
      expect(elementTags).toEqual([
        "strong",
        "em",
        "a",
        "code",
        "span",
        "br",
        "span",
        "span",
        "mark",
      ])
    })
  })
})
