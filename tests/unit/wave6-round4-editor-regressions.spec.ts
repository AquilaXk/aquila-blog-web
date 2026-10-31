import { expect, test } from "@playwright/test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import { createTheme } from "../../src/styles/theme"
import { isTableEditActionDisabled } from "../../src/components/markdown-editor/MarkdownEditor"
import { escapeMarkdownLinkDestination } from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
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
    })
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

  test("clamps oversized rowspan and colspan metadata on duplicate-row and duplicate-column", () => {
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
    const dupRowHtml = renderMarkdownHtml(dupRow!.markdown)
    expect(dupRowHtml).toContain('rowSpan="2"')

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
  })

  test("aligns columnWidths splice index on duplicate-column across colspan: 2 in helper and widget", () => {
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
      const mockView = {
        state: {
          get doc() {
            return {
              length: currentDoc.length,
              sliceString: (from: number, to?: number) => currentDoc.slice(from, to),
            }
          },
          selection: { main: { from: currentDoc.length, to: currentDoc.length } },
          facet: () => true,
        },
        dispatch: (tr: { changes?: { from: number; to: number; insert: string } }) => {
          if (tr.changes) {
            currentDoc = currentDoc.slice(0, tr.changes.from) + tr.changes.insert + currentDoc.slice(tr.changes.to)
          }
        },
      }
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
  })

  test("evaluates table edit action availability and escapes markdown link destinations", () => {
    const oneColTable = ["| Solo |", "| --- |", "| Cell |"].join("\n")
    const availability = getMarkdownEditorTableEditAvailability(oneColTable, 2, 2)
    expect(availability).not.toBeNull()
    expect(isTableEditActionDisabled({ kind: "add-row" }, null)).toBe(true)
    expect(isTableEditActionDisabled({ kind: "add-row" }, availability)).toBe(false)
    expect(isTableEditActionDisabled({ kind: "delete-column" }, availability)).toBe(true)
    expect(isTableEditActionDisabled({ kind: "clear-row" }, availability)).toBe(false)
    expect(escapeMarkdownLinkDestination("https://example.com/a(1)\\b")).toBe("https://example.com/a\\(1\\)\\\\b")
  })
})
