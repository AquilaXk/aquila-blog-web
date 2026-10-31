import { expect, test } from "@playwright/test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { createTheme } from "../../src/styles/theme"
import { isTableEditActionDisabled } from "../../src/components/markdown-editor/MarkdownEditor"
import {
  convertSafeHtmlPasteToMarkdown,
  escapeMarkdownLinkDestination,
} from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
import { appendInlineMarkdownNodes } from "../../src/components/markdown-editor/markdownEditorInlineDom"
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
import { MarkdownTableWidget } from "../../src/components/markdown-editor/markdownEditorTableWidget"
import { normalizePostImageUrl } from "../../src/libs/markdown/postImageUrlPolicy"
import { parseStandaloneMarkdownImageLine } from "../../src/libs/markdown/rendering"
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
      expect(renderInline("**escaped \\** inner**")).toBe("<div><strong>escaped \\** inner</strong></div>")
      expect(renderInline("**foo \\***")).toBe("<div><strong>foo \\*</strong></div>")
      expect(renderInline("keep \\<br> literal")).toBe("<div>keep \\<br> literal</div>")
      expect(renderInline("**bold** keep \\<br> literal")).toBe("<div><strong>bold</strong> keep \\<br> literal</div>")
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
    expect(escapeMarkdownLinkDestination("https://example.com/a(1)\\b")).toBe("https://example.com/a%281%29%5Cb")
  })
})

