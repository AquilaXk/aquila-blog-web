import { expect, test } from "@playwright/test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { createTheme } from "../../src/styles/theme"
import { isTableEditActionDisabled } from "../../src/components/markdown-editor/MarkdownEditor"
import { convertSafeHtmlPasteToMarkdown } from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
import { GFM, parser } from "@lezer/markdown"
import { appendInlineMarkdownNodes } from "../../src/components/markdown-editor/markdownEditorInlineDom"
import {
  buildMarkdownLivePreviewDecorationSpecs,
  buildMarkdownLivePreviewEntries,
  getMarkdownLivePreviewBundle,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { buildDecorations, decorationField } from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import { isNodeShadowedByMath } from "../../src/components/markdown-editor/markdownEditorMathModel"
import { planLinkifySelectionWithUrl } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  applyMarkdownTableGridPaste,
  getMarkdownEditorTableEditAvailability,
  parseMarkdownTableGrid,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { getTableGridLayoutMeta } from "../../src/components/markdown-editor/markdownEditorTableMetadataModel"
import {
  applyTableColumnWidthsAction,
  getOrCreateTableVisualOptions,
} from "../../src/components/markdown-editor/markdownEditorTableResizeDom"
import {
  applyColInsertOrDuplicateLayout,
  applyRowInsertOrDuplicateLayout,
} from "../../src/components/markdown-editor/markdownEditorTableSpanModel"
import { MarkdownTableWidget } from "../../src/components/markdown-editor/markdownEditorTableWidget"
import {
  escapeMarkdownLinkDestination,
  resolveMarkdownAttachmentLink,
  resolveMarkdownImageEmbed,
} from "../../src/components/markdown-editor/markdownEditorUploadModel"
import { normalizePostImageUrl } from "../../src/libs/markdown/postImageUrlPolicy"
import { parseStandaloneMarkdownImageLine } from "../../src/libs/markdown/rendering"
import type { MarkdownTableLayout } from "../../src/libs/markdown/tableMetadata"
import { SimpleDomElement, withMockDom } from "./helpers/simpleMockDom"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"

const lightTheme = createTheme({ scheme: "light" })
const ThemeWrapper = ThemeProvider as ComponentType<{ theme: typeof lightTheme; children?: ReactNode }>

const renderMarkdownHtml = (content: string): string => {
  const queryClient = new QueryClient()
  const tree = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ThemeWrapper, { theme: lightTheme }, createElement(MarkdownRenderer, { content, disableMermaid: true }))
  )
  return renderToStaticMarkup(materializePlaywrightJsx(tree) as ReactElement)
}

const serializeSimpleDom = (el: SimpleDomElement): string => {
  if (el.tagName === "#TEXT") return el.textContent
  if (el.tagName === "BR") return "<br/>"
  const tag = el.tagName.toLowerCase()
  const cls = el.className ? ` class="${el.className}"` : ""
  const href = el.getAttribute("href") ? ` href="${el.getAttribute("href")}"` : ""
  const texAnnotation = el.innerHTML ? /<annotation[^>]*>([\s\S]*?)<\/annotation>/.exec(el.innerHTML)?.[1] ?? el.innerHTML : ""
  const inner = el.children.length > 0 ? el.children.map(serializeSimpleDom).join("") : el.textContent || texAnnotation
  return `<${tag}${cls}${href}>${inner}</${tag}>`
}

type MockPasteDomNode = {
  nodeType: number
  tagName: string
  textContent: string
  childNodes: MockPasteDomNode[]
  children: MockPasteDomNode[]
  getAttribute: (name: string) => string | null
}

const createMockElementNode = (
  tagName: string,
  attrs: Record<string, string>,
  children: MockPasteDomNode[]
): MockPasteDomNode => ({
  nodeType: 1,
  tagName: tagName.toUpperCase(),
  textContent: children.map((child) => child.textContent).join(""),
  childNodes: children,
  children: children.filter((child) => child.nodeType === 1),
  getAttribute: (name: string) => attrs[name] ?? null,
})

const createMockTextNode = (textContent: string): MockPasteDomNode => ({
  nodeType: 3,
  tagName: "#TEXT",
  textContent,
  childNodes: [],
  children: [],
  getAttribute: () => null,
})

const parseMockHtmlFragment = (html: string): MockPasteDomNode => {
  const linkMatch = /<a\s+href="([^"]+)">([^<]*)<\/a>/i.exec(html)
  if (linkMatch) {
    const anchor = createMockElementNode("a", { href: linkMatch[1] ?? "" }, [createMockTextNode(linkMatch[2] ?? "")])
    return createMockElementNode("body", {}, [anchor])
  }
  const imgMatch = /<img\s+src="([^"]+)"\s+alt="([^"]*)"\s*\/?>/i.exec(html)
  if (imgMatch) {
    const img = createMockElementNode("img", { src: imgMatch[1] ?? "", alt: imgMatch[2] ?? "" }, [])
    return createMockElementNode("body", {}, [img])
  }
  return createMockElementNode("body", {}, [])
}

const withMockHtmlParser = <T>(fn: () => T): T => {
  const globalRecord = globalThis as Record<string, unknown>
  const prevParser = globalRecord.DOMParser
  const prevNode = globalRecord.Node
  globalRecord.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 }
  globalRecord.DOMParser = class {
    parseFromString(html: string) {
      return { body: parseMockHtmlFragment(html) }
    }
  }
  try {
    return fn()
  } finally {
    globalRecord.DOMParser = prevParser
    globalRecord.Node = prevNode
  }
}

const createMockTableEditorView = (getDoc: () => string, setDoc: (next: string) => void) => ({
  state: {
    get doc() {
      const doc = getDoc()
      return {
        length: doc.length,
        sliceString: (from: number, to?: number) => doc.slice(from, to),
      }
    },
    get selection() {
      const len = getDoc().length
      return { main: { from: len, to: len } }
    },
    facet: () => true,
  },
  dispatch: (tr: { changes?: { from: number; to: number; insert: string } }) => {
    if (tr.changes) {
      const doc = getDoc()
      setDoc(doc.slice(0, tr.changes.from) + tr.changes.insert + doc.slice(tr.changes.to))
    }
  },
})

test.describe("Wave-6 Round 4 live editor regressions", () => {
  test("skips inline code, math, and backslash escapes inside inactive-line inline DOM delimiters", () => {
    withMockDom(() => {
      const renderInline = (source: string): string => {
        const host = document.createElement("div")
        appendInlineMarkdownNodes(host, source)
        return serializeSimpleDom(host as unknown as SimpleDomElement)
      }

      expect(renderInline("[`arr[0]`](https://example.com)")).toBe(
        '<div><a class="cm-live-link" href="https://example.com/"><code class="cm-live-inline-code">arr[0]</code></a></div>'
      )
      expect(renderInline("**bold `a**b` end**")).toBe(
        '<div><strong>bold <code class="cm-live-inline-code">a**b</code> end</strong></div>'
      )
      expect(renderInline("==run `x==1` here==")).toBe(
        '<div><mark class="cm-live-highlight">run <code class="cm-live-inline-code">x==1</code> here</mark></div>'
      )
      expect(renderInline("*italic $a*b$ end*")).toBe(
        '<div><em>italic <span class="cm-live-math cm-live-math-inline">a*b</span> end</em></div>'
      )
      expect(renderInline("~~strike $x~~y$ end~~")).toBe(
        '<div><del class="cm-live-strikethrough">strike <span class="cm-live-math cm-live-math-inline">x~~y</span> end</del></div>'
      )
      expect(renderInline(String.raw`**escaped \** inner**`)).toBe(
        String.raw`<div><strong>escaped \** inner</strong></div>`
      )
      expect(renderInline(String.raw`**foo \***`)).toBe(String.raw`<div><strong>foo \*</strong></div>`)
      expect(renderInline(String.raw`keep \<br> literal`)).toBe(String.raw`<div>keep \<br> literal</div>`)
      expect(renderInline(String.raw`**bold** keep \<br> literal`)).toBe(
        String.raw`<div><strong>bold</strong> keep \<br> literal</div>`
      )
      expect(renderInline("line1<br>line2")).toBe("<div>line1<br/>line2</div>")
    })
  })

  test("percent-encodes parenthesized HTML paste URLs so live links and standalone images survive round-trip", () => {
    withMockDom(() =>
      withMockHtmlParser(() => {
        const pastedLink = convertSafeHtmlPasteToMarkdown('<a href="https://en.wikipedia.org/wiki/Foo_(bar)">Foo</a>')
        expect(pastedLink).toEqual({
          kind: "markdown",
          markdown: "[Foo](https://en.wikipedia.org/wiki/Foo_%28bar%29)",
        })
        if (pastedLink.kind === "markdown") {
          expect(pastedLink.markdown).not.toContain("\\")
          const host = document.createElement("div")
          appendInlineMarkdownNodes(host, pastedLink.markdown)
          expect(serializeSimpleDom(host as unknown as SimpleDomElement)).toBe(
            '<div><a class="cm-live-link" href="https://en.wikipedia.org/wiki/Foo_%28bar%29">Foo</a></div>'
          )
        }

        const pastedImg = convertSafeHtmlPasteToMarkdown(
          '<img src="https://api.example.com/post/api/v1/images/diagram_(1).png" alt="pic">'
        )
        expect(pastedImg).toEqual({
          kind: "markdown",
          markdown: "![pic](https://api.example.com/post/api/v1/images/diagram_%281%29.png)",
        })
        if (pastedImg.kind === "markdown") {
          const standalone = parseStandaloneMarkdownImageLine(pastedImg.markdown)
          expect(standalone?.src).toBe("https://api.example.com/post/api/v1/images/diagram_%281%29.png")
          const normalizedImgUrl = normalizePostImageUrl(standalone!.src, { publicApiOrigin: "https://api.example.com" })
          expect(normalizedImgUrl).toContain("diagram_%281%29.png")
          expect(normalizedImgUrl).not.toContain("diagram_/(1/)")
        }
      })
    )
  })

  test("unmerges hidden aq-table cells on non-empty paste and cell edit so MarkdownRenderer renders new text", () => {
    const mergedTable = [
      '<!-- aq-table {"cells":[[null,null],[{"colspan":2,"align":"center"},{"hidden":true}]]} -->',
      "| H1 | H2 |",
      "| --- | --- |",
      "| MergedA |  |",
    ].join("\n")

    const beforeHtml = renderMarkdownHtml(mergedTable)
    expect(beforeHtml).toContain('colSpan="2"')

    const pasted = applyMarkdownTableGridPaste(mergedTable, 1, 0, "LeftCell\tRightPasted")
    expect(pasted).not.toBeNull()
    const pastedHtml = renderMarkdownHtml(pasted!.markdown)
    expect(pastedHtml).toContain("LeftCell")
    expect(pastedHtml).toContain("RightPasted")
    expect(pastedHtml).not.toContain('colSpan="2"')
    const pastedGrid = parseMarkdownTableGrid(pasted!.markdown)!
    expect(getTableGridLayoutMeta(pastedGrid)?.cells?.[1]?.[0]).toEqual({ align: "center" })

    const editedHidden = applyMarkdownTableGridCellEdit(mergedTable, 1, 1, "EditedRight")
    expect(editedHidden).not.toBeNull()
    const editedHtml = renderMarkdownHtml(editedHidden!)
    expect(editedHtml).toContain("MergedA")
    expect(editedHtml).toContain("EditedRight")
    expect(editedHtml).not.toContain('colSpan="2"')

    const editedAnchor = applyMarkdownTableGridCellEdit(mergedTable, 1, 0, "UpdatedAnchor")
    expect(editedAnchor).not.toBeNull()
    expect(renderMarkdownHtml(editedAnchor!)).toContain('colSpan="2"')

    const clearedHidden = applyMarkdownTableGridCellEdit(mergedTable, 1, 1, "   ")
    expect(clearedHidden).not.toBeNull()
    expect(renderMarkdownHtml(clearedHidden!)).toContain('colSpan="2"')
  })

  test("clamps oversized spans and reconciles covered duplicate anchors, out-of-bounds rows, and paste expansion", () => {
    const oversizedRowSpan = [
      '<!-- aq-table {"cells":[[null,null],[{"rowspan":99,"align":"center"},null],[{"hidden":true},null]]} -->',
      "| H1 | H2 |",
      "| --- | --- |",
      "| SpanBody | R1 |",
      "|  | R2 |",
    ].join("\n")

    const dupRow = applyMarkdownTableGridAction(oversizedRowSpan, 1, 0, { kind: "duplicate-row" })
    expect(dupRow).not.toBeNull()
    const dupRowGrid = parseMarkdownTableGrid(dupRow!.markdown)!
    expect(dupRowGrid.rows).toHaveLength(3)
    expect(getTableGridLayoutMeta(dupRowGrid)?.cells?.[1]?.[0]).toEqual({ rowspan: 2, align: "center" })
    expect(getTableGridLayoutMeta(dupRowGrid)?.cells?.[3]).toEqual([{ align: "center" }])
    expect(renderMarkdownHtml(dupRow!.markdown)).toContain('rowSpan="2"')

    const oversizedColSpan = [
      '<!-- aq-table {"cells":[[{"colspan":99,"align":"right"},{"hidden":true}],[null,null]]} -->',
      "| SpanHead |  |",
      "| --- | --- |",
      "| A | B |",
    ].join("\n")

    const dupCol = applyMarkdownTableGridAction(oversizedColSpan, 0, 0, { kind: "duplicate-column" })
    expect(dupCol).not.toBeNull()
    const dupColGrid = parseMarkdownTableGrid(dupCol!.markdown)!
    expect(dupColGrid.headers).toEqual(["SpanHead", "", "SpanHead"])
    expect(getTableGridLayoutMeta(dupColGrid)?.cells?.[0]?.[0]).toEqual({ colspan: 2, align: "right" })
    expect(getTableGridLayoutMeta(dupColGrid)?.cells?.[0]?.[2]).toEqual({ align: "right" })
    expect(renderMarkdownHtml(dupCol!.markdown)).toContain('colSpan="2"')

    const pastedExpanded = applyMarkdownTableGridPaste(oversizedColSpan, 1, 1, "B1\tC1")
    expect(pastedExpanded).not.toBeNull()
    const expandedGrid = parseMarkdownTableGrid(pastedExpanded!.markdown)!
    expect(expandedGrid.headers).toEqual(["SpanHead", "", ""])
    expect(expandedGrid.rows[0]).toEqual(["A", "B1", "C1"])
    expect(getTableGridLayoutMeta(expandedGrid)?.cells?.[0]).toEqual([
      { colspan: 2, align: "right" },
      { hidden: true },
    ])
    const expandedHtml = renderMarkdownHtml(pastedExpanded!.markdown)
    expect(expandedHtml).toContain('colSpan="2"')
    expect(expandedHtml).not.toContain('colSpan="3"')

    const coveredDupAnchor = [
      '<!-- aq-table {"columnWidths":[120,160,200],"cells":[[{"colspan":2},{"colspan":2},null]]} -->',
      "| H1 |  | H3 |",
      "| --- | --- | --- |",
      "| A | B | C |",
    ].join("\n")
    const coveredDupOutcome = applyMarkdownTableGridAction(coveredDupAnchor, 0, 1, { kind: "duplicate-column" })
    expect(coveredDupOutcome).not.toBeNull()
    expect(coveredDupOutcome!.nextCol).toBe(2)
    const coveredDupGrid = parseMarkdownTableGrid(coveredDupOutcome!.markdown)!
    expect(coveredDupGrid.headers).toEqual(["H1", "", "", "H3"])
    expect(getTableGridLayoutMeta(coveredDupGrid)?.columnWidths).toEqual([120, 160, 160, 200])

    const outOfBoundsRowSpan = [
      '<!-- aq-table {"columnWidths":[120,180],"cells":[[null,null],[null,null],[{"colspan":2},{"hidden":true}]]} -->',
      "| H1 | H2 |",
      "| --- | --- |",
      "| A | B |",
    ].join("\n")
    const oobDupOutcome = applyMarkdownTableGridAction(outOfBoundsRowSpan, 0, 0, { kind: "duplicate-column" })
    expect(oobDupOutcome).not.toBeNull()
    expect(oobDupOutcome!.nextCol).toBe(1)
    const oobDupGrid = parseMarkdownTableGrid(oobDupOutcome!.markdown)!
    expect(oobDupGrid.headers).toEqual(["H1", "H1", "H2"])
    expect(getTableGridLayoutMeta(oobDupGrid)?.columnWidths).toEqual([120, 120, 180])
  })

  test("aligns columnWidths splice index on duplicate-column across colspan: 2 and clears stale spans on widget update", () => {
    const widths = [140, 220, 180]
    applyTableColumnWidthsAction(widths, 3, 0, { kind: "duplicate-column" }, 2)
    expect(widths).toEqual([140, 220, 140, 180])

    const spannedMarkdown = [
      '<!-- aq-table {"columnWidths":[140,220,180],"cells":[[{"colspan":2},{"hidden":true},null]]} -->',
      "| SpanHead |  | Tail |",
      "| --- | --- | --- |",
      "| A | B | C |",
    ].join("\n")

    withMockDom(() => {
      let currentDoc = spannedMarkdown
      const mockView = createMockTableEditorView(
        () => currentDoc,
        (next) => {
          currentDoc = next
        }
      )
      const typedView = mockView as unknown as NonNullable<Parameters<MarkdownTableWidget["toDOM"]>[0]>
      const widget = new MarkdownTableWidget(spannedMarkdown, 0, spannedMarkdown.length)
      const domEl = widget.toDOM(typedView)
      const visualOpts = getOrCreateTableVisualOptions(0, 3, mockView)
      const dom = domEl as unknown as SimpleDomElement
      const dupColBtn = dom.querySelectorAll("button").find((btn) => btn.getAttribute("aria-label") === "표 열 복제")
      expect(dupColBtn).toBeDefined()
      dupColBtn!.dispatch("click")
      expect(visualOpts.columnWidths).toEqual([140, 220, 140, 180])
      const cols = dom.querySelectorAll("col")
      expect(cols.map((col) => col.dataset.colWidth ?? "")).toEqual(["140", "220", "140", "180"])
    })

    const mergedWithoutWidths = [
      '<!-- aq-table {"cells":[[{"colspan":2},{"hidden":true},null]]} -->',
      "| SpanHead |  | Tail |",
      "| --- | --- | --- |",
      "| A | B | C |",
    ].join("\n")

    withMockDom(() => {
      let currentDoc = mergedWithoutWidths
      const mockView = createMockTableEditorView(
        () => currentDoc,
        (next) => {
          currentDoc = next
        }
      )
      const typedView = mockView as unknown as NonNullable<Parameters<MarkdownTableWidget["toDOM"]>[0]>
      const mountedWidget = new MarkdownTableWidget(mergedWithoutWidths, 0, mergedWithoutWidths.length)
      const domEl = mountedWidget.toDOM(typedView)
      const visualOpts = getOrCreateTableVisualOptions(0, 3, mockView)
      visualOpts.columnWidths = [140, 220, 180]

      const unmergedDoc = applyMarkdownTableGridCellEdit(mergedWithoutWidths, 0, 1, "Unmerged")!
      expect(unmergedDoc).not.toContain("aq-table")
      currentDoc = unmergedDoc
      const updatedInPlace = new MarkdownTableWidget(unmergedDoc, 0, unmergedDoc.length).updateDOM(domEl, typedView)
      expect(updatedInPlace).toBe(true)
      visualOpts.columnWidths = [140, 220, 180]

      const dom = domEl as unknown as SimpleDomElement
      const dupColBtn = dom.querySelectorAll("button").find((btn) => btn.getAttribute("aria-label") === "표 열 복제")
      expect(dupColBtn).toBeDefined()
      dupColBtn!.dispatch("click")
      expect(visualOpts.columnWidths).toEqual([140, 140, 220, 180])
    })
  })

  test("evaluates table edit action availability and escapes markdown link destinations", () => {
    const oneColTable = ["| Solo |", "| --- |", "| Cell |"].join("\n")
    const availability = getMarkdownEditorTableEditAvailability(oneColTable, 2, 2)
    expect(availability).not.toBeNull()
    expect(isTableEditActionDisabled({ kind: "add-row" }, null)).toBe(true)
    expect(isTableEditActionDisabled({ kind: "add-row" }, availability)).toBe(false)
    expect(isTableEditActionDisabled({ kind: "delete-column" }, availability)).toBe(true)
    expect(isTableEditActionDisabled({ kind: "clear-row" }, availability)).toBe(false)
    expect(escapeMarkdownLinkDestination(String.raw`https://example.com/a(1)\b`)).toBe("https://example.com/a%281%29%5Cb")
  })

  test("percent-encodes linkified and uploaded URLs with parentheses, spaces, and angle brackets so live inline DOM renders clickable links", () => {
    withMockDom(() => {
      const linkified = planLinkifySelectionWithUrl(0, 3, "Foo", "https://en.wikipedia.org/wiki/Foo_(bar)")
      expect(linkified.replacement).toBe("[Foo](https://en.wikipedia.org/wiki/Foo_%28bar%29)")
      const host = document.createElement("div")
      appendInlineMarkdownNodes(host, linkified.replacement)
      expect(serializeSimpleDom(host as unknown as SimpleDomElement)).toBe(
        '<div><a class="cm-live-link" href="https://en.wikipedia.org/wiki/Foo_%28bar%29">Foo</a></div>'
      )
    })

    expect(
      resolveMarkdownAttachmentLink(
        { url: "https://cdn.example.test/files/spec_(v2).pdf", name: "spec (v2).pdf" },
        "spec.pdf"
      )
    ).toEqual({
      markdown: "\n\n[spec (v2).pdf](https://cdn.example.test/files/spec_%28v2%29.pdf)\n",
    })

    expect(
      resolveMarkdownAttachmentLink(
        { url: "https://cdn.example.test/files/my file <1>.pdf", name: "my file <1>.pdf" },
        "file.pdf"
      )
    ).toEqual({
      markdown: "\n\n[my file <1>.pdf](https://cdn.example.test/files/my%20file%20%3C1%3E.pdf)\n",
    })

    expect(
      resolveMarkdownImageEmbed(
        { url: "https://blog.aquilaxk.site/post/api/v1/images/posts/diagram_(1).png", width: 800, height: 600 },
        "diagram.png",
        { publicApiOrigin: "https://blog.aquilaxk.site" }
      )
    ).toEqual({
      markdown: "\n\n![diagram.png](https://blog.aquilaxk.site/post/api/v1/images/posts/diagram_%281%29.png?w=800&h=600)\n",
    })

    const spacedImageEmbed = resolveMarkdownImageEmbed(
      { url: "https://blog.aquilaxk.site/post/api/v1/images/posts/my photo <1>.png", width: 800, height: 600 },
      "photo.png",
      { publicApiOrigin: "https://blog.aquilaxk.site" }
    )
    expect(spacedImageEmbed).toEqual({
      markdown: "\n\n![photo.png](https://blog.aquilaxk.site/post/api/v1/images/posts/my%20photo%20%3C1%3E.png?w=800&h=600)\n",
    })
    if ("markdown" in spacedImageEmbed) {
      expect(parseStandaloneMarkdownImageLine(spacedImageEmbed.markdown.trim())?.src).toBe(
        "https://blog.aquilaxk.site/post/api/v1/images/posts/my%20photo%20%3C1%3E.png?w=800&h=600"
      )
    }
  })

  test("excludes Pandoc inline and display math ranges from live preview Lezer syntax and custom token decorations", () => {
    const displayMath = [
      "$$",
      "f(x) = {{color:red|x}}",
      "g(x) = a == b == c",
      "k(x) = a ==b== c",
      "h(x) = [[Note]]",
      "$$",
    ].join("\n")

    const activeFirstLineSpecs = buildMarkdownLivePreviewDecorationSpecs(displayMath, [{ from: 0, to: 0 }])
    expect(
      activeFirstLineSpecs.filter(
        (spec) => spec.kind === "inline-color" || spec.kind === "highlight" || spec.kind === "wikilink"
      )
    ).toEqual([])

    const inlineMathAndProse =
      "Intro $f(x) = {{color:red|x}}$ mid $a == b == c$ plus $a ==b== c$ tail $[[MathWiki]]$ and {{color:blue|live}} ==mark== [[RealPage]]"
    const inlineSpecs = buildMarkdownLivePreviewDecorationSpecs(inlineMathAndProse, [{ from: 6, to: 6 }])
    expect(inlineSpecs.filter((spec) => spec.kind === "inline-color")).toHaveLength(1)
    expect(inlineSpecs.filter((spec) => spec.kind === "highlight")).toHaveLength(1)
    expect(inlineSpecs.filter((spec) => spec.kind === "wikilink").map((spec) => spec.target)).toEqual(["RealPage"])

    const crossMathAsterisk = "$x*y$ and a*b"
    const readingCrossMathSpecs = buildMarkdownLivePreviewDecorationSpecs(crossMathAsterisk, [], false, "reading")
    const inactiveLiveCrossMathSpecs = buildMarkdownLivePreviewDecorationSpecs(
      crossMathAsterisk,
      [{ from: crossMathAsterisk.length, to: crossMathAsterisk.length }],
      false,
      "live"
    )
    expect(readingCrossMathSpecs.filter((spec) => spec.kind === "hide-mark" || spec.kind === "emphasis")).toEqual([])
    expect(inactiveLiveCrossMathSpecs.filter((spec) => spec.kind === "hide-mark" || spec.kind === "emphasis")).toEqual([])

    const unfoldedDisplayBlock = "$$\n2*a*b + g[i](j)\n- term\n> quote\n---\n$$"
    const unfoldedSpecs = buildMarkdownLivePreviewDecorationSpecs(unfoldedDisplayBlock, [{ from: 0, to: 0 }])
    expect(
      unfoldedSpecs.filter((spec) =>
        ["hide-mark", "emphasis", "link", "list-marker", "quote-mark", "horizontal-rule"].includes(spec.kind)
      )
    ).toEqual([])

    const displayWithCommentHeading = "$$\n# comment\n$$"
    expect(buildMarkdownLivePreviewDecorationSpecs(displayWithCommentHeading, [{ from: 0, to: 0 }])).toEqual([])

    const headingWithMathAndBold = "# Heading $a*b$ **bold**"
    const headingSpecs = buildMarkdownLivePreviewDecorationSpecs(headingWithMathAndBold, [], false, "reading")
    expect(headingSpecs.some((spec) => spec.kind === "heading" && spec.level === 1)).toBe(true)
    expect(headingSpecs.some((spec) => spec.kind === "strong")).toBe(true)
    const mathStarOffset = headingWithMathAndBold.indexOf("*")
    expect(headingSpecs.some((spec) => spec.from <= mathStarOffset && spec.to > mathStarOffset && spec.kind !== "heading")).toBe(false)

    const topNode = parser.configure(GFM).parse(headingWithMathAndBold).topNode
    const cachedEntries = buildMarkdownLivePreviewEntries(headingWithMathAndBold, topNode)
    const bundle = getMarkdownLivePreviewBundle(headingWithMathAndBold, topNode)
    expect(bundle.entries).toBe(cachedEntries)
    expect(bundle.mathSpecs).toEqual([{ from: 10, to: 15, math: "a*b", displayMode: false }])

    const angleMathDoc = 'Type $T<U>$ and <span data-a="$1" data-b="$2">raw</span> and $5 <span data-x="$10">'
    const angleBundle = getMarkdownLivePreviewBundle(angleMathDoc)
    expect(angleBundle.mathSpecs).toEqual([{ from: 5, to: 11, math: "T<U>", displayMode: false }])

    const unfoldedMathWithImageAndCallout = [
      "$$",
      "![diagram](/post/api/v1/images/x.png)",
      "$$",
      "",
      "$$",
      "> [!NOTE]",
      "$$",
      "> outside",
    ].join("\n")
    const mathEditorState = EditorState.create({
      doc: unfoldedMathWithImageAndCallout,
      selection: { anchor: 0 },
      extensions: [markdown(), decorationField],
    })
    const activeDecos = buildDecorations(mathEditorState)
    const widgetNames: string[] = []
    const iter = activeDecos.iter()
    while (iter.value) {
      const widget = (iter.value.spec as { widget?: { constructor?: { name?: string } } }).widget
      if (widget?.constructor?.name) widgetNames.push(widget.constructor.name)
      iter.next()
    }
    expect(widgetNames).not.toContain("MarkdownImageWidget")
    expect(widgetNames).not.toContain("MarkdownCalloutWidget")

    expect(isNodeShadowedByMath([{ from: 0, to: 3 }], 0, 23)).toBe(false)
    expect(isNodeShadowedByMath([{ from: 0, to: 15 }], 3, 28)).toBe(true)
  })

  test("trims stale out-of-bounds aq-table layout arrays and honors cross-axis bounds during span duplication", () => {
    const staleTwoCol = [
      '<!-- aq-table {"columnWidths":[140,220,310],"columnAlignments":["left","center","right"],"rowHeights":[44,52,68]} -->',
      "| H1 | H2 |",
      "| --- | --- |",
      "| A | B |",
    ].join("\n")

    const initialGrid = parseMarkdownTableGrid(staleTwoCol)!
    expect(getTableGridLayoutMeta(initialGrid)).toEqual({
      columnWidths: [140, 220],
      columnAlignments: ["left", "center"],
      rowHeights: [44, 52],
    })

    const addedCol = applyMarkdownTableGridAction(staleTwoCol, 0, 1, { kind: "add-column" })
    expect(addedCol).not.toBeNull()
    const expandedGrid = parseMarkdownTableGrid(addedCol!.markdown)!
    expect(expandedGrid.headers).toEqual(["H1", "H2", ""])
    expect(getTableGridLayoutMeta(expandedGrid)).toEqual({
      columnWidths: [140, 220],
      columnAlignments: ["left", "center"],
      rowHeights: [44, 52],
    })

    const crossColRowLayout: MarkdownTableLayout = {
      rowHeights: [40, 50, 60],
      cells: [
        [null, null],
        [null, null, { rowspan: 2 }],
        [null, null, { hidden: true }],
      ],
    }
    applyRowInsertOrDuplicateLayout(crossColRowLayout, 1, true, false, 2, 2)
    expect(crossColRowLayout.rowHeights).toEqual([40, 50, 50, 60])
    expect(crossColRowLayout.cells).toEqual([
      [null, null],
      [null, null, { rowspan: 2 }],
      [null, null],
      [null, null, { hidden: true }],
    ])

    const crossRowColLayout: MarkdownTableLayout = {
      columnWidths: [120, 180],
      cells: [
        [null, null],
        [null, null],
        [{ colspan: 2 }, { hidden: true }],
      ],
    }
    applyColInsertOrDuplicateLayout(crossRowColLayout, 0, true, false, 2, 1)
    expect(crossRowColLayout.columnWidths).toEqual([120, 120, 180])
    expect(crossRowColLayout.cells).toEqual([
      [null, null, null],
      [null, null, null],
      [{ colspan: 2 }, { hidden: true }],
    ])
  })

  test("truncates absorbed trailing math from tables and callouts, guards right-edge overlaps, preserves heading marks, and aligns TeX delimiter scanning", () => {
    const collectDecoSnapshot = (doc: string, anchor = doc.length) => {
      const state = EditorState.create({
        doc,
        selection: { anchor },
        extensions: [markdown({ extensions: GFM }), decorationField],
      })
      const decos = buildDecorations(state)
      const classes: Array<{ cls: string; from: number; to: number }> = []
      const widgets: Array<{ name: string; from: number; to: number; widget: unknown }> = []
      const iter = decos.iter()
      while (iter.value) {
        const spec = iter.value.spec as { class?: string; widget?: { constructor?: { name?: string } } }
        if (spec.class) classes.push({ cls: spec.class, from: iter.from, to: iter.to })
        if (spec.widget?.constructor?.name) {
          widgets.push({ name: spec.widget.constructor.name, from: iter.from, to: iter.to, widget: spec.widget })
        }
        iter.next()
      }
      return { classes, widgets }
    }

    const tableLines = ["| H1 | H2 |", "| --- | --- |", "| A | B |"].join("\n")
    const tableThenMath = `${tableLines}\n$$\nx + y = z\n$$\n\ncursor`
    const tableSnap = collectDecoSnapshot(tableThenMath)
    expect(tableSnap.widgets.map(({ name, from, to }) => ({ name, from, to }))).toEqual([
      { name: "MarkdownTableWidget", from: 0, to: tableLines.length },
      { name: "MarkdownMathWidget", from: tableLines.length + 1, to: tableLines.length + 16 },
    ])
    withMockDom(() => {
      let currentDoc = tableThenMath
      const mockView = createMockTableEditorView(
        () => currentDoc,
        (next) => {
          currentDoc = next
        }
      )
      const typedView = mockView as unknown as NonNullable<Parameters<MarkdownTableWidget["toDOM"]>[0]>
      const tableWidget = tableSnap.widgets[0]!.widget as MarkdownTableWidget
      const dom = tableWidget.toDOM(typedView) as unknown as SimpleDomElement
      const dupColBtn = dom.querySelectorAll("button").find((btn) => btn.getAttribute("aria-label") === "표 열 복제")
      expect(dupColBtn).toBeDefined()
      dupColBtn!.dispatch("click")
      expect(currentDoc).toContain("| H1 | H1 | H2 |")
      expect(currentDoc).toContain("$$\nx + y = z\n$$")
    })

    const midCellMultiLineMath = "| a | $$\nx = 1\n$$\n\ncursor"
    expect(collectDecoSnapshot(midCellMultiLineMath).widgets.map((w) => w.name)).not.toContain("MarkdownTableWidget")

    const tableWithInlineMath = "| $a$ | $b$ |\n| --- | --- |\n| 1 | 2 |\n\ncursor"
    expect(collectDecoSnapshot(tableWithInlineMath).widgets.map((w) => w.name)).toEqual(["MarkdownTableWidget"])

    const calloutLines = "> [!NOTE]\n> body"
    const calloutThenMath = `${calloutLines}\n$$\nx = 1\n$$\n\ncursor`
    const calloutSnap = collectDecoSnapshot(calloutThenMath)
    expect(calloutSnap.widgets.map(({ name, from, to }) => ({ name, from, to }))).toEqual([
      { name: "MarkdownCalloutWidget", from: 0, to: calloutLines.length },
      { name: "MarkdownMathWidget", from: calloutLines.length + 1, to: calloutLines.length + 12 },
    ])

    const rightEdgeOverlapImage = "![alt $$](/post/api/v1/images/test.png) x$$\n\ncursor"
    const imageSnap = collectDecoSnapshot(rightEdgeOverlapImage)
    expect(imageSnap.widgets.map((w) => w.name)).toEqual(["MarkdownMathWidget"])

    const htmlAttrBackticks = '<span data-x="`"> $a$</span> and <span data-y="`">end</span>'
    expect(getMarkdownLivePreviewBundle(htmlAttrBackticks).mathSpecs).toEqual([
      { from: 18, to: 21, math: "a", displayMode: false },
    ])

    const crossFenceBacktickDoc = "$$\n`a'\n$$\nText `code`"
    const crossFenceBundle = getMarkdownLivePreviewBundle(crossFenceBacktickDoc)
    expect(crossFenceBundle.mathSpecs).toEqual([{ from: 0, to: 9, math: "\n`a'\n", displayMode: true }])
    const crossFenceSpecs = buildMarkdownLivePreviewDecorationSpecs(crossFenceBacktickDoc, [], false, "reading")
    expect(crossFenceSpecs.filter((s) => s.kind === "inline-code").map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 15, to: 21 },
    ])
    const separatedParagraphSpecs = buildMarkdownLivePreviewDecorationSpecs("$$\n`a'\n$$\n\nText `code`", [], false, "reading")
    expect(separatedParagraphSpecs.filter((s) => s.kind === "inline-code").map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 16, to: 22 },
    ])

    const commentInsideDisplay = "$$\n<!--\n$$\n-->\nx = 1\n$$"
    expect(getMarkdownLivePreviewBundle(commentInsideDisplay).mathSpecs).toEqual([
      { from: 0, to: 10, math: "\n<!--\n", displayMode: true },
    ])
    expect(renderMarkdownHtml(commentInsideDisplay)).toContain("katex-display")

    const backticksInsideSingleLineDisplay = "$$a `b` $$ and $$c = 1$$"
    expect(getMarkdownLivePreviewBundle(backticksInsideSingleLineDisplay).mathSpecs).toEqual([
      { from: 0, to: 10, math: "a `b` ", displayMode: true },
      { from: 15, to: 24, math: "c = 1", displayMode: true },
    ])
    const unclosedBacktickDisplay = "$$a `$$` b$$ and $$c = 1$$"
    expect(getMarkdownLivePreviewBundle(unclosedBacktickDisplay).mathSpecs).toEqual([
      { from: 10, to: 19, math: " and ", displayMode: true },
    ])
    expect(getMarkdownLivePreviewBundle("```tex\n$$\nx = 1\n$$\n```").mathSpecs).toEqual([])
    expect(getMarkdownLivePreviewBundle("$$\n\n    a = b\n$$").mathSpecs).toEqual([
      { from: 0, to: 16, math: "\n\n    a = b\n", displayMode: true },
    ])

    const headingWithDisplayMath = "# Theorem **1** $$E = mc^2$$\n\ncursor"
    const headingSnap = collectDecoSnapshot(headingWithDisplayMath)
    expect(headingSnap.classes.some((c) => c.cls.includes("cm-live-heading-line-1"))).toBe(true)
    expect(headingSnap.classes.some((c) => c.cls.includes("cm-live-heading-1") && c.from === 0 && c.to === 28)).toBe(true)
    expect(headingSnap.classes.some((c) => c.cls === "cm-live-strong" && c.from === 10 && c.to === 15)).toBe(true)
    expect(headingSnap.widgets.map(({ name, from, to }) => ({ name, from, to }))).toEqual([
      { name: "MarkdownMathWidget", from: 16, to: 28 },
    ])

    const astralPoisonedDoc = ["$$", "`𝕏'", "$$", "Text `code`"].join("\n")
    const astralSpecs = buildMarkdownLivePreviewDecorationSpecs(astralPoisonedDoc, [], false, "reading")
    expect(astralSpecs.filter((s) => s.kind === "inline-code").map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 16, to: 22 },
    ])

        const selectiveReparseDoc = ["$a `b$ and $c` d$", "", "**bold** and $z + 1$"].join("\n")
    const selectiveBundle = getMarkdownLivePreviewBundle(selectiveReparseDoc)
    expect(selectiveBundle.mathSpecs.map((m) => m.math)).toEqual(["z + 1"])
    expect(selectiveBundle.entries.some((e) => e.kind === "strong")).toBe(true)

    const highlightMathSnap = collectDecoSnapshot("==$x + 1$==\n\n> quote start\n> $$\n> y = 2\n> $$\n> quote end\n\ncursor")
    expect(highlightMathSnap.classes.some((c) => c.cls.includes("cm-live-highlight"))).toBe(true)
    expect(highlightMathSnap.classes.filter((c) => c.cls.includes("cm-live-quote")).length).toBeGreaterThanOrEqual(2)
  })
})


