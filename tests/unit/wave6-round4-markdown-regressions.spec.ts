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
})
