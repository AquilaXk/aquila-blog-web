import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import * as inlineColorModule from "../../src/libs/markdown/inlineColor"
import { applyInlineColors } from "../../src/libs/markdown/hooks/useInlineColorEffect"
import { findMarkdownHighlightSpans } from "../../src/libs/markdown/inlineHighlightModel"
import { normalizeLegacyInlineHtmlMarkdown } from "../../src/libs/markdown/inlineHtmlNormalization"
import {
  findDoubleBraceColorSpans,
  stripDoubleBraceColorTokensOnce,
} from "../../src/libs/markdown/inlineTokenScanners"
import { mountMermaidErrorStateDom } from "../../src/libs/markdown/mermaidRuntimeSanitize"
import {
  normalizeSafeMarkdownLinkHref,
  normalizeSafeMarkdownUrl,
  setSafeAnchorHref,
} from "../../src/libs/markdown/safeMarkdownUrl"
import { formatMarkdownHeadingLabel } from "../../src/libs/markdown/markdownDocumentInsights"
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
        nodeValue: "{{color:green|obj { a: { b: 1 } }}} and {{color:red|line1\nline2}}",
        textContent: "{{color:green|obj { a: { b: 1 } }}} and {{color:red|line1\nline2}}",
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
      expect(replacedNodes).toHaveLength(2)
      expect(replacedNodes[0]?.className).toBe("aq-inline-color")
      expect(replacedNodes[0]?.cssVar).toBe("#34d399")
      expect(replacedNodes[0]?.textContent).toBe("obj { a: { b: 1 } }")
      expect(replacedNodes[1]?.textContent).toBe(" and {{color:red|line1\nline2}}")
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
})
