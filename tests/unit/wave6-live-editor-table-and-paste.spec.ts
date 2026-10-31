import { expect, test } from "@playwright/test"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { resolveActiveTableCellOffset } from "../../src/components/markdown-editor/MarkdownEditor"
import {
  buildDecorations,
  compositionField,
  decorationField,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import { activeEmptyLineField } from "../../src/components/markdown-editor/markdownEditorNotionModel"
import { notionContainerBlockField } from "../../src/components/markdown-editor/markdownEditorNotionWidgets"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  applyMarkdownTableGridPaste,
  parseMarkdownTableGrid,
  planMarkdownEditorTableEdit,
  resolveTableCellSelectionOffset,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { getTableGridLayoutMeta } from "../../src/components/markdown-editor/markdownEditorTableMetadataModel"
import { reconcileCellSpans } from "../../src/components/markdown-editor/markdownEditorTableSpanModel"
import { MarkdownTableWidget } from "../../src/components/markdown-editor/markdownEditorTableWidget"
import {
  isOffsetInsideInlineCodeSpan,
  shouldBypassHtmlPasteConversion,
  shouldReportEmptyHtmlPasteError,
} from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
import { shouldLinkifySelectionOnUrlPaste } from "../../src/components/markdown-editor/markdownEditorMediaTransferModel"
import { SimpleDomElement, withMockDom } from "./helpers/simpleMockDom"

const createDecorationEditorState = (
  doc: string,
  cursorPos: number,
  mode: "live" | "source" | "reading"
) =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(cursorPos, doc.length)),
    extensions: [
      markdown({ extensions: GFM }),
      compositionField,
      pointerSelectingField,
      editorModeField.init(() => mode),
      disableMermaidField.init(() => false),
      decorationField,
      notionContainerBlockField,
      activeEmptyLineField,
      EditorState.readOnly.of(mode === "reading"),
      EditorView.editable.of(mode !== "reading"),
    ],
  })

test.describe("Wave-6 Unit 2 live MarkdownEditor table, IME proxy, and HTML paste", () => {
  test("round-trips <!-- aq-table {...} --> layout metadata across edits and omits default comments", () => {
    const malformed = ["<!-- aq-table malformed", "| one |", "| --- |", "| two |"].join("\n")
    expect(parseMarkdownTableGrid(malformed)).toBeNull()
    expect(
      planMarkdownEditorTableEdit(malformed, malformed.indexOf("one"), malformed.indexOf("one"), {
        kind: "add-row",
      })
    ).toBeNull()

    const withMeta = [
      '<!-- aq-table {"headerRow":false,"headerColumn":true,"overflowMode":"wide","columnWidths":[null,220],"rowHeights":[52,60]} -->',
      "| Col A | Col B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n")

    const cellEdited = applyMarkdownTableGridCellEdit(withMeta, 1, 0, "updated")
    expect(cellEdited).not.toBeNull()
    expect(cellEdited).toContain("<!-- aq-table ")
    expect(cellEdited).toContain('"headerRow":false')
    expect(cellEdited).toContain('"headerColumn":true')
    expect(cellEdited).toContain('"overflowMode":"wide"')
    expect(cellEdited).toContain('"columnWidths":[null,220]')
    expect(cellEdited).toContain("| updated | 2 |")

    const colInserted = applyMarkdownTableGridAction(withMeta, 1, 0, { kind: "add-column" })
    expect(colInserted).not.toBeNull()
    expect(colInserted!.markdown).toContain('"columnWidths":[null,null,220]')

    const pasted = applyMarkdownTableGridPaste(withMeta, 1, 0, "alpha\tbeta")
    expect(pasted).not.toBeNull()
    expect(pasted!.markdown).toContain('"headerColumn":true')
    expect(pasted!.markdown).toContain("| alpha | beta |")

    const offset = resolveTableCellSelectionOffset(withMeta, 0, 1, 1)
    expect(offset).not.toBeNull()
    const plannedEdit = planMarkdownEditorTableEdit(withMeta, offset!, offset!, {
      kind: "set-alignment",
      alignment: "right",
    })
    expect(plannedEdit).not.toBeNull()
    expect(plannedEdit!.rangeStart).toBe(0)
    expect(plannedEdit!.replacement).toContain('"headerColumn":true')
    expect(plannedEdit!.replacement).toContain("| --- | ---: |")

    const stateWithMeta = createDecorationEditorState(withMeta, withMeta.length, "reading")
    const decos = buildDecorations(stateWithMeta)
    const tableRanges: Array<{ from: number; to: number }> = []
    decos.between(0, withMeta.length, (from, to, value) => {
      if (value.spec.widget instanceof MarkdownTableWidget) {
        tableRanges.push({ from, to })
      }
    })
    expect(tableRanges).toEqual([{ from: 0, to: withMeta.length }])

    const plainTable = ["| Col A | Col B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
    withMockDom((winListeners) => {
      let currentDoc = plainTable
      const mockView = {
        state: {
          get doc() {
            return {
              length: currentDoc.length,
              lineAt: () => ({ length: 1 }),
            }
          },
          selection: { main: { from: 0, to: 0 } },
          facet: () => true,
        },
        posAtDOM: () => 0,
        focus: () => {},
        dispatch: (spec: { changes?: { from: number; to: number; insert: string } }) => {
          if (spec.changes) {
            currentDoc =
              currentDoc.slice(0, spec.changes.from) +
              spec.changes.insert +
              currentDoc.slice(spec.changes.to)
          }
        },
      } as unknown as EditorView

      const widget = new MarkdownTableWidget(plainTable, 0, plainTable.length)
      const dom = widget.toDOM(mockView) as unknown as SimpleDomElement
      const headerColBtn = dom.querySelector('[data-testid="cm-live-table-toggle-header-col"]')!
      const fullWidthBtn = dom.querySelector('[data-testid="cm-live-table-toggle-full-width"]')!
      const resizers = dom.querySelectorAll('[data-testid="cm-live-table-col-resizer"]')

      headerColBtn.dispatch("click")
      expect(currentDoc).toContain('<!-- aq-table {"headerColumn":true} -->')

      const separatePostView = {
        state: {
          doc: { length: plainTable.length, lineAt: () => ({ length: 1 }) },
          selection: { main: { from: 0, to: 0 } },
          facet: () => true,
        },
        posAtDOM: () => 0,
        focus: () => {},
        dispatch: () => {},
      } as unknown as EditorView
      const isolatedDom = new MarkdownTableWidget(plainTable, 0, plainTable.length).toDOM(
        separatePostView
      ) as unknown as SimpleDomElement
      expect(isolatedDom.getAttribute("data-header-col")).toBeNull()

      fullWidthBtn.dispatch("click")
      expect(currentDoc).toContain('"fitWidth":true')
      expect(currentDoc).not.toContain('"overflowMode":"wide"')

      resizers[1]!.dispatch("pointerdown", { button: 0, clientX: 100 })
      for (const move of winListeners.get("pointermove") ?? []) move({ clientX: 180 })
      for (const up of winListeners.get("pointerup") ?? []) up({})
      expect(currentDoc).toContain('"columnWidths":[null,200]')

      resizers[1]!.dispatch("dblclick")
      headerColBtn.dispatch("click")
      fullWidthBtn.dispatch("click")
      expect(currentDoc).not.toContain("<!-- aq-table")
      expect(currentDoc).toBe(plainTable)

      const wideTable = [
        '<!-- aq-table {"overflowMode":"wide"} -->',
        "| Col A | Col B |",
        "| --- | --- |",
        "| 1 | 2 |",
      ].join("\n")
      let wideDoc = wideTable
      const wideView = {
        state: {
          get doc() {
            return { length: wideDoc.length, lineAt: () => ({ length: 1 }) }
          },
          selection: { main: { from: 0, to: 0 } },
          facet: () => true,
        },
        posAtDOM: () => 0,
        focus: () => {},
        dispatch: (spec: { changes?: { from: number; to: number; insert: string } }) => {
          if (spec.changes) {
            wideDoc =
              wideDoc.slice(0, spec.changes.from) +
              spec.changes.insert +
              wideDoc.slice(spec.changes.to)
          }
        },
      } as unknown as EditorView
      const wideDom = new MarkdownTableWidget(wideTable, 0, wideTable.length).toDOM(
        wideView
      ) as unknown as SimpleDomElement
      wideDom.querySelector('[data-testid="cm-live-table-toggle-full-width"]')!.dispatch("click")
      expect(wideDoc).toContain('"overflowMode":"wide"')
      expect(wideDoc).toContain('"fitWidth":true')
    })
  })

  test("bypasses HTML-to-Markdown conversion for IDE/fence/source pastes and guards code/URL paste boundaries", () => {
    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "source",
        markdown: "hello",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: "<p><strong>bold</strong></p>",
        plainText: "bold",
      })
    ).toBe(true)

    const fencedDoc = "```ts\nconst a = 1\n```"
    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: fencedDoc,
        selectionFrom: fencedDoc.indexOf("const"),
        clipboardTypes: ["text/html", "text/plain"],
        html: "<p><strong>bold</strong></p>",
        plainText: "bold",
      })
    ).toBe(true)

    const inlineCodeDoc = "Use `const x = 1` here"
    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: inlineCodeDoc,
        selectionFrom: inlineCodeDoc.indexOf("const"),
        clipboardTypes: ["text/html", "text/plain"],
        html: "<p><strong>bold</strong></p>",
        plainText: "bold",
      })
    ).toBe(true)

    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["vscode-editor-data", "text/html", "text/plain"],
        html: '<div style="font-family: Menlo; white-space: pre;"><span>const x = 1;</span></div>',
        plainText: "const x = 1;",
      })
    ).toBe(true)

    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: '<div style="font-family: monospace; white-space: pre;"><span>fn main() {}</span></div>',
        plainText: "fn main() {}",
      })
    ).toBe(true)

    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: '<pre style="font: 12px \'JetBrains Mono\', monospace; white-space: pre;"><b>fun</b> <a href="https://kotlinlang.org">main</a>() {}</pre>',
        plainText: "fun main() {}",
      })
    ).toBe(true)

    expect(
      shouldBypassHtmlPasteConversion({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: '<p>Hello <strong>world</strong> and <a href="https://example.com">docs</a></p>',
        plainText: "Hello world and docs",
      })
    ).toBe(false)

    expect(shouldReportEmptyHtmlPasteError("<div><span>   </span></div>", "plain fallback text")).toBe(false)
    expect(shouldReportEmptyHtmlPasteError("<script>window.__xss = 1</script>", "ignored")).toBe(true)
    expect(shouldReportEmptyHtmlPasteError("<div><span>   </span></div>", "")).toBe(true)

    expect(shouldLinkifySelectionOnUrlPaste("live", "Select word here", { from: 7, to: 11 })).toBe(true)
    expect(shouldLinkifySelectionOnUrlPaste("source", "Select word here", { from: 7, to: 11 })).toBe(false)
    expect(shouldLinkifySelectionOnUrlPaste("reading", "Select word here", { from: 7, to: 11 })).toBe(false)
    expect(
      shouldLinkifySelectionOnUrlPaste("live", "```ts\nconst url = 1\n```", { from: 12, to: 15 })
    ).toBe(false)
    expect(
      shouldLinkifySelectionOnUrlPaste("live", "Inline `codeTarget` span", { from: 8, to: 18 })
    ).toBe(false)

    const unmatchedBacktickDoc = "Unmatched ` backtick before target here"
    expect(
      isOffsetInsideInlineCodeSpan(unmatchedBacktickDoc, unmatchedBacktickDoc.indexOf("target"))
    ).toBe(false)
    const matchedBacktickDoc = "Matched `insideCode` span"
    expect(
      isOffsetInsideInlineCodeSpan(matchedBacktickDoc, matchedBacktickDoc.indexOf("insideCode"))
    ).toBe(true)
  })

  test("preserves merged table spans across row/column delete, insert, and duplicate operations", () => {
    const reconciled = reconcileCellSpans(
      [
        [{ rowspan: 3, colspan: 2 }, { hidden: true }],
        [{ hidden: true }, { hidden: true }],
      ],
      2,
      2
    )
    expect(reconciled).toEqual([
      [{ rowspan: 2, colspan: 2 }, { hidden: true }],
      [{ hidden: true }, { hidden: true }],
    ])

    const rowSpanTable = [
      '<!-- aq-table {"cells":[[{"colspan":2},{"hidden":true}],[{"rowspan":3,"align":"center"},null],[{"hidden":true},null],[{"hidden":true},null]]} -->',
      "| H1 | H2 |",
      "| --- | --- |",
      "| SpanTop | R1C2 |",
      "|  | R2C2 |",
      "|  | R3C2 |",
    ].join("\n")

    const deletedAnchorRow = applyMarkdownTableGridAction(rowSpanTable, 1, 0, { kind: "delete-row" })!
    expect(deletedAnchorRow.markdown).toContain("| SpanTop | R2C2 |")
    const deletedAnchorGrid = parseMarkdownTableGrid(deletedAnchorRow.markdown)!
    expect(getTableGridLayoutMeta(deletedAnchorGrid)?.cells?.[1]?.[0]).toEqual({
      rowspan: 2,
      align: "center",
    })
    expect(getTableGridLayoutMeta(deletedAnchorGrid)?.cells?.[2]?.[0]).toEqual({ hidden: true })

    const insertedInsideRowSpan = applyMarkdownTableGridAction(rowSpanTable, 1, 0, { kind: "add-row" })!
    const insertedRowGrid = parseMarkdownTableGrid(insertedInsideRowSpan.markdown)!
    expect(getTableGridLayoutMeta(insertedRowGrid)?.cells?.[1]?.[0]).toEqual({
      rowspan: 4,
      align: "center",
    })
    expect(getTableGridLayoutMeta(insertedRowGrid)?.cells?.[2]?.[0]).toEqual({ hidden: true })

    const duplicatedSpanRow = applyMarkdownTableGridAction(rowSpanTable, 1, 0, { kind: "duplicate-row" })!
    const duplicatedRowGrid = parseMarkdownTableGrid(duplicatedSpanRow.markdown)!
    expect(getTableGridLayoutMeta(duplicatedRowGrid)?.cells?.[1]?.[0]).toEqual({
      rowspan: 3,
      align: "center",
    })
    expect(getTableGridLayoutMeta(duplicatedRowGrid)?.cells?.[4]).toEqual([{ align: "center" }])

    const duplicatedCoveredSpanRow = applyMarkdownTableGridAction(rowSpanTable, 2, 0, { kind: "duplicate-row" })!
    const duplicatedCoveredGrid = parseMarkdownTableGrid(duplicatedCoveredSpanRow.markdown)!
    expect(getTableGridLayoutMeta(duplicatedCoveredGrid)?.cells?.[1]?.[0]).toEqual({
      rowspan: 3,
      align: "center",
    })
    expect(duplicatedCoveredGrid.rows).toHaveLength(4)

    const colSpanTable = [
      '<!-- aq-table {"cells":[[{"colspan":3,"align":"right"},{"hidden":true},{"hidden":true}]]} -->',
      "| MergedHeader |  |  |",
      "| --- | --- | --- |",
      "| A | B | C |",
    ].join("\n")
    const deletedAnchorCol = applyMarkdownTableGridAction(colSpanTable, 0, 0, { kind: "delete-column" })!
    expect(deletedAnchorCol.markdown).toContain("| MergedHeader |  |")
    const deletedColGrid = parseMarkdownTableGrid(deletedAnchorCol.markdown)!
    expect(getTableGridLayoutMeta(deletedColGrid)?.cells?.[0]?.[0]).toEqual({
      colspan: 2,
      align: "right",
    })
    expect(getTableGridLayoutMeta(deletedColGrid)?.cells?.[0]?.[1]).toEqual({ hidden: true })

    const insertedInsideColSpan = applyMarkdownTableGridAction(colSpanTable, 0, 0, { kind: "add-column" })!
    const insertedColGrid = parseMarkdownTableGrid(insertedInsideColSpan.markdown)!
    expect(getTableGridLayoutMeta(insertedColGrid)?.cells?.[0]?.[0]).toEqual({
      colspan: 4,
      align: "right",
    })
    expect(getTableGridLayoutMeta(insertedColGrid)?.cells?.[0]?.[1]).toEqual({ hidden: true })

    const duplicatedSpanCol = applyMarkdownTableGridAction(colSpanTable, 0, 0, {
      kind: "duplicate-column",
    })!
    const duplicatedColGrid = parseMarkdownTableGrid(duplicatedSpanCol.markdown)!
    expect(getTableGridLayoutMeta(duplicatedColGrid)?.cells?.[0]?.[0]).toEqual({
      colspan: 3,
      align: "right",
    })
    expect(duplicatedColGrid.headers).toEqual(["MergedHeader", "", "", "MergedHeader"])
  })

  test("handles Korean IME proxy compositionend Tab navigation, cell-switch cancellation, and Cmd+S blur flush", async () => {
    await withMockDom(async () => {
      const baseDoc = "| A | B |\n| --- | --- |\n| 작성자<br> | 2 |"
      let currentDoc = baseDoc
      const createMockView = () =>
        ({
          state: {
            get doc() {
              return { length: currentDoc.length, lineAt: () => ({ length: 1 }) }
            },
            selection: { main: { from: 0, to: 0 } },
            facet: () => true,
          },
          posAtDOM: () => 0,
          focus: () => {},
          dispatch: (spec: { changes?: { from: number; to: number; insert: string } }) => {
            if (spec.changes) {
              currentDoc =
                currentDoc.slice(0, spec.changes.from) +
                spec.changes.insert +
                currentDoc.slice(spec.changes.to)
            }
          },
        }) as unknown as EditorView

      const dom = new MarkdownTableWidget(currentDoc, 0, currentDoc.length).toDOM(
        createMockView()
      ) as unknown as SimpleDomElement
      dom.querySelectorAll('[data-testid="cm-live-table-col-handle"]')[0]!.dispatch("click")
      const imeProxy = dom.querySelector('[data-testid="cm-live-table-ime-proxy"]')!
      imeProxy.focus()
      imeProxy.dispatch("compositionstart", { data: "ㅎ" })
      imeProxy.value = "한"
      imeProxy.dispatch("compositionupdate", { data: "한" })
      imeProxy.dispatch("compositionend", { data: "한" })

      const tabEvent = imeProxy.dispatch("keydown", { key: "Tab", shiftKey: false, isComposing: false })
      expect(tabEvent.defaultPrevented).toBe(true)
      expect(currentDoc).toContain("| A한 | B |")
      expect(dom.dataset.activeRow).toBe("0")
      expect(dom.dataset.activeCol).toBe("1")
      const nextCellInput = dom.querySelector('[data-testid="cm-live-table-cell-input"]')!
      expect(nextCellInput.value).toBe("B")

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(
        nextCellInput
      )
      expect(nextCellInput.value).toBe("B")

      currentDoc = baseDoc
      const switchDom = new MarkdownTableWidget(currentDoc, 0, currentDoc.length).toDOM(
        createMockView()
      ) as unknown as SimpleDomElement
      switchDom.querySelectorAll('[data-testid="cm-live-table-col-handle"]')[0]!.dispatch("click")
      const switchProxy = switchDom.querySelector('[data-testid="cm-live-table-ime-proxy"]')!
      switchProxy.focus()
      switchProxy.dispatch("compositionstart", { data: "ㅎ" })
      switchProxy.value = "한"
      switchProxy.dispatch("compositionend", { data: "한" })

      const secondHeaderCell = switchDom.querySelectorAll("th")[1]!
      secondHeaderCell.dispatch("mousedown", { button: 0, target: secondHeaderCell })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const switchedInput = switchDom.querySelector('[data-testid="cm-live-table-cell-input"]')!
      expect(switchedInput.value).toBe("B")
      expect((globalThis.document as unknown as { activeElement: unknown }).activeElement).toBe(
        switchedInput
      )

      currentDoc = baseDoc
      const saveDom = new MarkdownTableWidget(currentDoc, 0, currentDoc.length).toDOM(
        createMockView()
      ) as unknown as SimpleDomElement
      saveDom.querySelectorAll('[data-testid="cm-live-table-row-handle"]')[1]!.dispatch("click")
      const saveProxy = saveDom.querySelector('[data-testid="cm-live-table-ime-proxy"]')!
      saveProxy.focus()
      saveProxy.dispatch("compositionstart", { data: "ㅎ" })
      saveProxy.value = "한글"
      saveProxy.dispatch("compositionupdate", { data: "한글" })
      saveProxy.dispatch("compositionend", { data: "한글" })

      const hostRoot = new SimpleDomElement("div")
      hostRoot.appendChild(saveDom)
      const resolvedOffset = resolveActiveTableCellOffset(
        hostRoot as unknown as HTMLElement,
        () => currentDoc
      )
      expect(resolvedOffset).not.toBeNull()
      expect(currentDoc).toContain("| 작성자<br>한글 | 2 |")
    })
  })
})
