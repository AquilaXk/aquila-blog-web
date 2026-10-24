import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { expect, test } from "@playwright/test"
import {
  isOffsetInsideFencedCodeBlock,
  planMarkdownEditorTableEnter,
} from "src/components/markdown-editor/markdownEditorKeyboardModel"
import { decorationField } from "src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  isBlockLinePrefixSnippet,
  planNotionBlockPrefixBackspace,
  planNotionSpaceInputRule,
  planStripBlockLinePrefix,
  planToggleBlockLinePrefix,
} from "src/components/markdown-editor/markdownEditorNotionModel"
import { parseNotionContainerBlocks } from "src/components/markdown-editor/markdownEditorNotionWidgets"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  getMarkdownEditorTableEditAvailability,
  parseMarkdownTableGrid,
  planMarkdownEditorTableEdit,
  serializeMarkdownTableGrid,
} from "src/components/markdown-editor/markdownEditorTableModel"
import { MarkdownTableWidget } from "src/components/markdown-editor/markdownEditorTableWidget"
import {
  filterSlashCommandSpecs,
  resolveSlashCommandMutation,
  SLASH_COMMAND_SPECS,
} from "src/components/markdown-editor/useMarkdownEditorSlashMenu"

test.describe("Notion-parity Markdown editor model", () => {
  test("recognizes block line prefix snippets and toggles headings and blockquotes at line start", () => {
    expect(isBlockLinePrefixSnippet("# ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("## ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("#### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("> ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("==", "==")).toBe(false)

    expect(planToggleBlockLinePrefix("Hello", 5, 5, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "## Hello",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("Hello", 0, 5, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "## Hello",
      selectionStart: 3,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("# Hello", 7, 7, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 7,
      replacement: "## Hello",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "## ")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "Hello",
      selectionStart: 5,
      selectionEnd: 5,
    })

    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "> ")).toEqual({
      rangeStart: 0,
      rangeEnd: 8,
      replacement: "> Hello",
      selectionStart: 7,
      selectionEnd: 7,
    })

    expect(planToggleBlockLinePrefix("> Hello", 7, 7, "> ")).toEqual({
      rangeStart: 0,
      rangeEnd: 7,
      replacement: "Hello",
      selectionStart: 5,
      selectionEnd: 5,
    })

    expect(planToggleBlockLinePrefix("```ts\nconst x = 1\n```", 6, 6, "## ")).toBeNull()

    const deepQuote = `${"> ".repeat(32)}plain`
    const startedAt = Date.now()
    expect(planToggleBlockLinePrefix(deepQuote, 0, deepQuote.length, "## ")?.replacement).toBe(
      `## ${"> ".repeat(31)}plain`
    )
    expect(Date.now() - startedAt).toBeLessThan(50)
  })

  test("strips heading, list, task, and quote prefixes back to plain paragraph via planStripBlockLinePrefix", () => {
    expect(planStripBlockLinePrefix("# Heading 1", 4, 4)).toEqual({
      rangeStart: 0,
      rangeEnd: 11,
      replacement: "Heading 1",
      selectionStart: 2,
      selectionEnd: 2,
    })

    expect(planStripBlockLinePrefix("## Heading 2", 0, 12)).toEqual({
      rangeStart: 0,
      rangeEnd: 12,
      replacement: "Heading 2",
      selectionStart: 0,
      selectionEnd: 9,
    })

    expect(planStripBlockLinePrefix("  - [ ] Task item", 10, 10)).toEqual({
      rangeStart: 0,
      rangeEnd: 17,
      replacement: "  Task item",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planStripBlockLinePrefix("- [x] Done item", 15, 15)).toEqual({
      rangeStart: 0,
      rangeEnd: 15,
      replacement: "Done item",
      selectionStart: 9,
      selectionEnd: 9,
    })

    expect(planStripBlockLinePrefix("- Bullet\n1. Ordered\n> Quote", 0, 27)).toEqual({
      rangeStart: 0,
      rangeEnd: 27,
      replacement: "Bullet\nOrdered\nQuote",
      selectionStart: 0,
      selectionEnd: 20,
    })

    expect(planStripBlockLinePrefix("Plain paragraph", 0, 5)).toBeNull()
    expect(planStripBlockLinePrefix("```ts\n# inside fence\n```", 7, 10)).toBeNull()
  })

  test("converts [], >>>, ---, and !!! + Space into task, toggle, divider, and callout blocks", () => {
    expect(planNotionSpaceInputRule("[]", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "- [ ] ",
      selectionStart: 6,
      selectionEnd: 6,
    })

    expect(planNotionSpaceInputRule("  [x]", 5, 5)).toEqual({
      rangeStart: 0,
      rangeEnd: 5,
      replacement: "  - [x] ",
      selectionStart: 8,
      selectionEnd: 8,
    })

    expect(planNotionSpaceInputRule(">>>", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: ":::toggle 토글 제목\n\n:::",
      selectionStart: 10,
      selectionEnd: 15,
    })

    expect(planNotionSpaceInputRule("---", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "---\n",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planNotionSpaceInputRule("***", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "---\n",
      selectionStart: 4,
      selectionEnd: 4,
    })

    expect(planNotionSpaceInputRule("!!!", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "> [!INFO]\n> ",
      selectionStart: 12,
      selectionEnd: 12,
    })

    expect(planNotionSpaceInputRule("```ts\n[]\n```", 8, 8)).toBeNull()
  })

  test("strips heading, list, and quote prefixes on single Backspace right after prefix", () => {
    expect(planNotionBlockPrefixBackspace("## Heading", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("  - [ ] Task", 8, 8)).toEqual({
      rangeStart: 2,
      rangeEnd: 8,
      replacement: "",
      selectionStart: 2,
      selectionEnd: 2,
    })

    expect(planNotionBlockPrefixBackspace("- Bullet", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("1. Ordered", 3, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("> Quote", 2, 2)).toEqual({
      rangeStart: 0,
      rangeEnd: 2,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    expect(planNotionBlockPrefixBackspace("## Heading", 4, 4)).toBeNull()
  })

  test("parses :::toggle and :::bookmark container blocks while ignoring fenced code blocks", () => {
    const doc = [
      ":::toggle 상세 설명",
      "숨겨진 첫째 줄",
      "숨겨진 둘째 줄",
      ":::",
      "",
      ":::bookmark https://example.com",
      "예시 사이트",
      "외부 링크 카드 설명",
      ":::",
      "",
      "```md",
      ":::toggle 코드 안의 토글",
      "무시되어야 함",
      ":::",
      "```",
    ].join("\n")

    const blocks = parseNotionContainerBlocks(doc)
    expect(blocks).toEqual([
      {
        kind: "toggle",
        from: 0,
        to: doc.indexOf("\n\n:::bookmark"),
        title: "상세 설명",
        body: "숨겨진 첫째 줄\n숨겨진 둘째 줄",
      },
      {
        kind: "bookmark",
        from: doc.indexOf(":::bookmark"),
        to: doc.indexOf("\n\n```md"),
        url: "https://example.com",
        title: "예시 사이트",
        description: "외부 링크 카드 설명",
      },
    ])
  })

  test("filters slash commands by Notion keyword aliases and includes list, image, and file commands", () => {
    const ids = SLASH_COMMAND_SPECS.map((spec) => spec.id)
    expect(ids).toContain("bullet-list")
    expect(ids).toContain("ordered-list")
    expect(ids).toContain("task-list")
    expect(ids).toContain("image")
    expect(ids).toContain("attachment")

    expect(filterSlashCommandSpecs("h1").map((s) => s.id)).toContain("heading-1")
    expect(filterSlashCommandSpecs("todo").map((s) => s.id)).toContain("task-list")
    expect(filterSlashCommandSpecs("ul").map((s) => s.id)).toContain("bullet-list")
    expect(filterSlashCommandSpecs("ol").map((s) => s.id)).toContain("ordered-list")
    expect(filterSlashCommandSpecs("quote").map((s) => s.id)).toContain("quote")
    expect(filterSlashCommandSpecs("table").map((s) => s.id)).toContain("table")
    expect(filterSlashCommandSpecs("hr").map((s) => s.id)).toContain("divider")
    expect(filterSlashCommandSpecs("image").map((s) => s.id)).toContain("image")
    expect(filterSlashCommandSpecs("이미지").map((s) => s.id)).toContain("image")
    expect(filterSlashCommandSpecs("file").map((s) => s.id)).toContain("attachment")
    expect(filterSlashCommandSpecs("파일").map((s) => s.id)).toContain("attachment")

    const bulletSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "bullet-list")!
    expect(resolveSlashCommandMutation(bulletSpec, 0, 3)).toEqual({
      rangeStart: 0,
      rangeEnd: 3,
      replacement: "- ",
      selectionStart: 2,
      selectionEnd: 2,
    })

    const imageSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "image")!
    expect(resolveSlashCommandMutation(imageSpec, 0, 6)).toEqual({
      rangeStart: 0,
      rangeEnd: 6,
      replacement: "",
      selectionStart: 0,
      selectionEnd: 0,
    })

    const enterTable = [
      "| Name | Role |",
      "| --- | --- |",
      "| Alice | Admin |",
      "| Bob | Editor |",
    ].join("\n")

    const headerRolePos = enterTable.indexOf("Role")
    const moveFromHeader = planMarkdownEditorTableEnter(enterTable, headerRolePos, headerRolePos)
    expect(moveFromHeader).not.toBeNull()
    expect(moveFromHeader?.replacement).toBe(enterTable)
    expect(enterTable.slice(moveFromHeader!.selectionStart).startsWith("Admin")).toBe(true)

    const aliceRolePos = enterTable.indexOf("Admin")
    const moveFromRow0 = planMarkdownEditorTableEnter(enterTable, aliceRolePos, aliceRolePos)
    expect(moveFromRow0).not.toBeNull()
    expect(enterTable.slice(moveFromRow0!.selectionStart).startsWith("Editor")).toBe(true)

    const bobRolePos = enterTable.indexOf("Editor")
    const appendAtBottom = planMarkdownEditorTableEnter(enterTable, bobRolePos, bobRolePos)
    expect(appendAtBottom).not.toBeNull()
    expect(appendAtBottom?.replacement).toBe(
      [
        "| Name | Role |",
        "| --- | --- |",
        "| Alice | Admin |",
        "| Bob | Editor |",
        "|  |  |",
      ].join("\n")
    )
    expect(appendAtBottom!.selectionStart).toBe(appendAtBottom!.replacement.lastIndexOf("| ") + 2)

    const table = [
      "| ColA | ColB | ColC |",
      "| --- | :---: | ---: |",
      "| A1 | B1 | C1 |",
      "| A2 | B2 | C2 |",
    ].join("\n")

    const b1Offset = table.indexOf("B1")
    const availability = getMarkdownEditorTableEditAvailability(table, b1Offset, b1Offset)
    expect(availability).toEqual({
      addRow: true,
      deleteRow: true,
      addColumn: true,
      deleteColumn: true,
      alignLeft: true,
      alignCenter: true,
      alignRight: true,
    })

    const moveRowDown = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, {
      kind: "move-row-down",
    })
    expect(moveRowDown?.replacement).toBe(
      [
        "| ColA | ColB | ColC |",
        "| --- | :---: | ---: |",
        "| A2 | B2 | C2 |",
        "| A1 | B1 | C1 |",
      ].join("\n")
    )

    const b2Offset = table.indexOf("B2")
    const moveRowUp = planMarkdownEditorTableEdit(table, b2Offset, b2Offset, {
      kind: "move-row-up",
    })
    expect(moveRowUp?.replacement).toBe(
      [
        "| ColA | ColB | ColC |",
        "| --- | :---: | ---: |",
        "| A2 | B2 | C2 |",
        "| A1 | B1 | C1 |",
      ].join("\n")
    )

    const duplicateRow = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, {
      kind: "duplicate-row",
    })
    expect(duplicateRow?.replacement).toBe(
      [
        "| ColA | ColB | ColC |",
        "| --- | :---: | ---: |",
        "| A1 | B1 | C1 |",
        "| A1 | B1 | C1 |",
        "| A2 | B2 | C2 |",
      ].join("\n")
    )

    const insertRowAbove = planMarkdownEditorTableEdit(table, b2Offset, b2Offset, {
      kind: "insert-row-above",
    })
    expect(insertRowAbove?.replacement).toBe(
      [
        "| ColA | ColB | ColC |",
        "| --- | :---: | ---: |",
        "| A1 | B1 | C1 |",
        "|  |  |  |",
        "| A2 | B2 | C2 |",
      ].join("\n")
    )

    const insertColLeft = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, {
      kind: "insert-column-left",
    })
    expect(insertColLeft?.replacement).toBe(
      [
        "| ColA |  | ColB | ColC |",
        "| --- | --- | :---: | ---: |",
        "| A1 |  | B1 | C1 |",
        "| A2 |  | B2 | C2 |",
      ].join("\n")
    )

    const moveColLeft = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, {
      kind: "move-column-left",
    })
    expect(moveColLeft?.replacement).toBe(
      [
        "| ColB | ColA | ColC |",
        "| :---: | --- | ---: |",
        "| B1 | A1 | C1 |",
        "| B2 | A2 | C2 |",
      ].join("\n")
    )

    const moveColRight = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, {
      kind: "move-column-right",
    })
    expect(moveColRight?.replacement).toBe(
      [
        "| ColA | ColC | ColB |",
        "| --- | ---: | :---: |",
        "| A1 | C1 | B1 |",
        "| A2 | C2 | B2 |",
      ].join("\n")
    )

    const grid = parseMarkdownTableGrid(table)
    expect(grid).toEqual({
      headers: ["ColA", "ColB", "ColC"],
      alignments: ["left", "center", "right"],
      rows: [
        ["A1", "B1", "C1"],
        ["A2", "B2", "C2"],
      ],
    })
    expect(serializeMarkdownTableGrid(grid!)).toBe(table)

    const editedCellMd = applyMarkdownTableGridCellEdit(table, 1, 1, "Updated | Pipe")
    expect(editedCellMd).toContain("Updated \\| Pipe")

    const actionResult = applyMarkdownTableGridAction(table, 1, 1, { kind: "add-row" })
    expect(actionResult).toEqual({
      markdown: [
        "| ColA | ColB | ColC |",
        "| --- | :---: | ---: |",
        "| A1 | B1 | C1 |",
        "|  |  |  |",
        "| A2 | B2 | C2 |",
      ].join("\n"),
      nextRow: 2,
      nextCol: 1,
    })

    const doc = [
      "# Title",
      "Paragraph outside",
      "```ts",
      "const inside1 = true",
      "```",
      "Middle paragraph",
      "~~~py",
      "inside2 = 42",
      "~~~",
      "Trailing paragraph",
      "```",
      "unclosed fence body",
    ].join("\n")

    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("Paragraph outside"))).toBe(false)
    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("const inside1"))).toBe(true)
    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("Middle paragraph"))).toBe(false)
    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("inside2 = 42"))).toBe(true)
    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("Trailing paragraph"))).toBe(false)
    expect(isOffsetInsideFencedCodeBlock(doc, doc.indexOf("unclosed fence body"))).toBe(true)
  })

  test("preserves decorationField reference on non-active cursor moves and supports Notion table visual toggles, column resizer, and boundary arrow navigation", () => {
    const sampleDoc = "# Heading\n\nPlain paragraph text with **bold** word."
    const state0 = EditorState.create({
      doc: sampleDoc,
      selection: { anchor: sampleDoc.indexOf("Plain") + 2 },
      extensions: [markdown({ base: markdownLanguage }), decorationField],
    })
    const state1 = state0.update({
      selection: { anchor: sampleDoc.indexOf("paragraph") + 3 },
    }).state
    expect(state1.field(decorationField)).toBe(state0.field(decorationField))

    const state2 = state1.update({
      selection: { anchor: sampleDoc.indexOf("bold") + 1 },
    }).state
    expect(state2.field(decorationField)).not.toBe(state1.field(decorationField))

    const windowListeners = new Map<string, Set<(event: any) => void>>()
    const createFakeElement = (tag: string): any => {
      const classes = new Set<string>()
      const attrs = new Map<string, string>()
      const listeners = new Map<string, Array<(event: any) => void>>()
      const children: any[] = []
      let textVal = ""
      let inputVal = ""
      const el: any = {
        tagName: tag.toUpperCase(),
        type: "",
        disabled: false,
        isConnected: true,
        selectionStart: 0,
        selectionEnd: 0,
        style: { width: "", textAlign: "" },
        children,
        get className() {
          return Array.from(classes).join(" ")
        },
        set className(val: string) {
          classes.clear()
          for (const token of val.split(/\s+/).filter(Boolean)) classes.add(token)
        },
        get textContent() {
          return textVal
        },
        set textContent(val: string) {
          textVal = val
          if (val === "") children.length = 0
        },
        get value() {
          return inputVal
        },
        set value(val: string) {
          inputVal = val
          el.selectionStart = val.length
          el.selectionEnd = val.length
        },
        classList: {
          add: (c: string) => classes.add(c),
          remove: (c: string) => classes.delete(c),
          contains: (c: string) => classes.has(c),
        },
        setAttribute: (k: string, v: string) => attrs.set(k, v),
        getAttribute: (k: string) => attrs.get(k) ?? null,
        removeAttribute: (k: string) => attrs.delete(k),
        hasAttribute: (k: string) => attrs.has(k),
        appendChild: (child: any) => {
          child.parentElement = el
          children.push(child)
          return child
        },
        addEventListener: (type: string, fn: (event: any) => void) => {
          const list = listeners.get(type) ?? []
          list.push(fn)
          listeners.set(type, list)
        },
        trigger: (type: string, eventInit: Record<string, any> = {}) => {
          const ev = {
            type,
            button: 0,
            target: el,
            preventDefault() {},
            stopPropagation() {},
            ...eventInit,
          }
          for (const fn of listeners.get(type) ?? []) fn(ev)
          return ev
        },
        focus: () => {},
        setSelectionRange: (start: number, end: number) => {
          el.selectionStart = start
          el.selectionEnd = end
        },
        getBoundingClientRect: () => ({ width: 120, height: 32 }),
        closest: (selector: string) => {
          let cur: any = el
          while (cur) {
            if (selector.startsWith(".") && cur.classList?.contains(selector.slice(1))) return cur
            if (cur.tagName === selector.toUpperCase()) return cur
            cur = cur.parentElement
          }
          return null
        },
        querySelectorAll: (selector: string): any[] => {
          const results: any[] = []
          const visit = (node: any) => {
            for (const child of node.children ?? []) {
              const matchesClass =
                selector.startsWith(".") && child.classList?.contains(selector.slice(1))
              const matchesTag = child.tagName === selector.toUpperCase()
              const matchesTestId =
                selector.startsWith('[data-testid="') &&
                child.getAttribute?.("data-testid") === selector.slice(14, -2)
              if (matchesClass || matchesTag || matchesTestId) results.push(child)
              visit(child)
            }
          }
          visit(el)
          return results
        },
        querySelector: (selector: string): any => el.querySelectorAll(selector)[0] ?? null,
      }
      return el
    }

    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const prevWin = Object.getOwnPropertyDescriptor(globalThis, "window")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        createElement: (tag: string) => createFakeElement(tag),
        createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        addEventListener: (type: string, fn: (event: any) => void) => {
          const set = windowListeners.get(type) ?? new Set()
          set.add(fn)
          windowListeners.set(type, set)
        },
        removeEventListener: (type: string, fn: (event: any) => void) => {
          windowListeners.get(type)?.delete(fn)
        },
      },
    })

    try {
      const tableMd = "| ColA | ColB |\n| --- | --- |\n| A1 | B1 |"
      const fakeView = {
        posAtDOM: () => 40,
        state: {
          doc: { length: tableMd.length + 80 },
          selection: { main: { from: 0, to: 0 } },
          facet: () => true,
        },
        focus: () => {},
        dispatch: () => {},
      } as unknown as EditorView

      const widget = new MarkdownTableWidget(tableMd, 40, 40 + tableMd.length)
      const dom: any = widget.toDOM(fakeView)

      const headerColBtn = dom.querySelector('[data-testid="cm-live-table-toggle-header-col"]')
      const fullWidthBtn = dom.querySelector('[data-testid="cm-live-table-toggle-full-width"]')
      expect(headerColBtn.getAttribute("aria-pressed")).toBe("false")
      expect(fullWidthBtn.getAttribute("aria-pressed")).toBe("false")

      headerColBtn.trigger("click")
      fullWidthBtn.trigger("click")
      expect(dom.getAttribute("data-header-col")).toBe("true")
      expect(dom.getAttribute("data-full-width")).toBe("true")
      expect(headerColBtn.getAttribute("aria-pressed")).toBe("true")
      expect(fullWidthBtn.getAttribute("aria-pressed")).toBe("true")

      const colEls = dom.querySelectorAll("col")
      const resizers = dom.querySelectorAll(".cm-live-table-col-resizer")
      expect(colEls).toHaveLength(2)
      expect(resizers).toHaveLength(2)

      resizers[0].trigger("mousedown", { clientX: 100 })
      for (const fn of windowListeners.get("mousemove") ?? []) fn({ clientX: 165 })
      for (const fn of windowListeners.get("mouseup") ?? []) fn({ clientX: 165 })
      expect(colEls[0].getAttribute("data-col-width")).toBe("185")
      expect(colEls[0].style.width).toBe("185px")

      const rerenderedDom: any = new MarkdownTableWidget(tableMd, 40, 40 + tableMd.length).toDOM(
        fakeView
      )
      expect(rerenderedDom.getAttribute("data-header-col")).toBe("true")
      expect(rerenderedDom.getAttribute("data-full-width")).toBe("true")
      expect(rerenderedDom.querySelectorAll("col")[0].getAttribute("data-col-width")).toBe("185")

      resizers[0].trigger("dblclick")
      expect(colEls[0].getAttribute("data-col-width")).toBeNull()
      expect(colEls[0].style.width).toBe("")

      const tds = dom.querySelectorAll("td")
      tds[0].trigger("click")
      let activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("A1")

      activeInput.setSelectionRange(activeInput.value.length, activeInput.value.length)
      activeInput.trigger("keydown", { key: "ArrowRight" })
      activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("B1")

      activeInput.setSelectionRange(0, 0)
      activeInput.trigger("keydown", { key: "ArrowLeft" })
      activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("A1")
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
      if (prevWin) Object.defineProperty(globalThis, "window", prevWin)
      else delete (globalThis as Record<string, unknown>).window
    }
  })
})

