import { GFM } from "@lezer/markdown"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { type DecorationSet } from "@codemirror/view"
import { expect, test } from "@playwright/test"
import {
  isOffsetInsideFencedCodeBlock,
  planMarkdownEditorTableEnter,
} from "src/components/markdown-editor/markdownEditorKeyboardModel"
import { decorationField } from "src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  isBlockLinePrefixSnippet,
  planBlockPrefixBackspace,
  planBlockSpaceInputRule,
  planStripBlockLinePrefix,
  planToggleBlockLinePrefix,
} from "src/components/markdown-editor/markdownEditorBlockModel"
import {
  MarkdownCalloutBlockWidget,
  blockContainerBlockField,
  parseBlockContainerBlocks,
} from "src/components/markdown-editor/markdownEditorBlockWidgets"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  getMarkdownEditorTableEditAvailability,
  parseMarkdownTableGrid,
  planMarkdownEditorTableEdit,
  serializeMarkdownTableGrid,
} from "src/components/markdown-editor/markdownEditorTableModel"
import {
  appendInlineMarkdownNodes,
  MarkdownTaskWidget,
  resolveLiveCalloutTone,
} from "src/components/markdown-editor/markdownEditorWidgets"
import {
  filterSlashCommandSpecs,
  resolveSlashCommandMutation,
  SLASH_COMMAND_SPECS,
} from "src/components/markdown-editor/useMarkdownEditorSlashMenu"
import { resolveInlineColorValue } from "src/libs/markdown/inlineColor"
import { parseMarkdownSegments } from "src/libs/markdown/renderingSegmentModel"

const collectDecorationEntries = (decoSet: DecorationSet, docLength: number) => {
  const ranges: Array<{ from: number; to: number; widget: unknown; className: string }> = []
  decoSet.between(0, docLength, (from, to, value) => {
    const spec = (value as unknown as { spec?: { widget?: unknown; class?: string } }).spec ?? {}
    ranges.push({ from, to, widget: spec.widget ?? null, className: spec.class ?? "" })
  })
  return ranges
}

const makeFakeInlineNode = (tag: string): any => ({
  tagName: tag.toUpperCase(),
  className: "",
  textContent: "",
  href: "",
  target: "",
  rel: "",
  children: [] as any[],
  appendChild(child: any) {
    this.children.push(child)
    return child
  },
  setAttribute(key: string, val: string) {
    if (key === "href") this.href = val
  },
})

const installFakeInlineDocument = () => {
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: (tag: string) => makeFakeInlineNode(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
    },
  })
  return () => {
    if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
    else delete (globalThis as Record<string, unknown>).document
  }
}

test.describe("Block-level Markdown editor model", () => {
  test("recognizes block line prefix snippets and toggles headings and blockquotes at line start", () => {
    expect(isBlockLinePrefixSnippet("# ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("## ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("#### ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("> ", "")).toBe(true)
    expect(isBlockLinePrefixSnippet("==", "==")).toBe(false)

    expect(planToggleBlockLinePrefix("Hello", 5, 5, "## ")).toEqual({
      rangeStart: 0, rangeEnd: 5, replacement: "## Hello", selectionStart: 8, selectionEnd: 8,
    })
    expect(planToggleBlockLinePrefix("Hello", 0, 5, "## ")).toEqual({
      rangeStart: 0, rangeEnd: 5, replacement: "## Hello", selectionStart: 3, selectionEnd: 8,
    })
    expect(planToggleBlockLinePrefix("# Hello", 7, 7, "## ")).toEqual({
      rangeStart: 0, rangeEnd: 7, replacement: "## Hello", selectionStart: 8, selectionEnd: 8,
    })
    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "## ")).toEqual({
      rangeStart: 0, rangeEnd: 8, replacement: "Hello", selectionStart: 5, selectionEnd: 5,
    })
    expect(planToggleBlockLinePrefix("## Hello", 8, 8, "> ")).toEqual({
      rangeStart: 0, rangeEnd: 8, replacement: "> Hello", selectionStart: 7, selectionEnd: 7,
    })
    expect(planToggleBlockLinePrefix("> Hello", 7, 7, "> ")).toEqual({
      rangeStart: 0, rangeEnd: 7, replacement: "Hello", selectionStart: 5, selectionEnd: 5,
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
      rangeStart: 0, rangeEnd: 11, replacement: "Heading 1", selectionStart: 2, selectionEnd: 2,
    })
    expect(planStripBlockLinePrefix("## Heading 2", 0, 12)).toEqual({
      rangeStart: 0, rangeEnd: 12, replacement: "Heading 2", selectionStart: 0, selectionEnd: 9,
    })
    expect(planStripBlockLinePrefix("  - [ ] Task item", 10, 10)).toEqual({
      rangeStart: 0, rangeEnd: 17, replacement: "  Task item", selectionStart: 4, selectionEnd: 4,
    })
    expect(planStripBlockLinePrefix("- [x] Done item", 15, 15)).toEqual({
      rangeStart: 0, rangeEnd: 15, replacement: "Done item", selectionStart: 9, selectionEnd: 9,
    })
    expect(planStripBlockLinePrefix("- Bullet\n1. Ordered\n> Quote", 0, 27)).toEqual({
      rangeStart: 0, rangeEnd: 27, replacement: "Bullet\nOrdered\nQuote", selectionStart: 0, selectionEnd: 20,
    })
    expect(planStripBlockLinePrefix("Plain paragraph", 0, 5)).toBeNull()
    expect(planStripBlockLinePrefix("```ts\n# inside fence\n```", 7, 10)).toBeNull()
  })

  test("converts [], >>>, ---, and !!! + Space into task, toggle, divider, and callout blocks", () => {
    expect(planBlockSpaceInputRule("[]", 2, 2)).toEqual({
      rangeStart: 0, rangeEnd: 2, replacement: "- [ ] ", selectionStart: 6, selectionEnd: 6,
    })
    expect(planBlockSpaceInputRule("  [x]", 5, 5)).toEqual({
      rangeStart: 0, rangeEnd: 5, replacement: "  - [x] ", selectionStart: 8, selectionEnd: 8,
    })
    expect(planBlockSpaceInputRule(">>>", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: ":::toggle 토글 제목\n\n:::", selectionStart: 10, selectionEnd: 15,
    })
    expect(planBlockSpaceInputRule("---", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: "---\n", selectionStart: 4, selectionEnd: 4,
    })
    expect(planBlockSpaceInputRule("***", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: "---\n", selectionStart: 4, selectionEnd: 4,
    })
    expect(planBlockSpaceInputRule("!!!", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: "> [!INFO]\n> ", selectionStart: 12, selectionEnd: 12,
    })
    expect(planBlockSpaceInputRule("```ts\n[]\n```", 8, 8)).toBeNull()
  })

  test("strips heading, list, and quote prefixes on single Backspace right after prefix", () => {
    expect(planBlockPrefixBackspace("## Heading", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: "", selectionStart: 0, selectionEnd: 0,
    })
    expect(planBlockPrefixBackspace("  - [ ] Task", 8, 8)).toEqual({
      rangeStart: 2, rangeEnd: 8, replacement: "", selectionStart: 2, selectionEnd: 2,
    })
    expect(planBlockPrefixBackspace("- Bullet", 2, 2)).toEqual({
      rangeStart: 0, rangeEnd: 2, replacement: "", selectionStart: 0, selectionEnd: 0,
    })
    expect(planBlockPrefixBackspace("1. Ordered", 3, 3)).toEqual({
      rangeStart: 0, rangeEnd: 3, replacement: "", selectionStart: 0, selectionEnd: 0,
    })
    expect(planBlockPrefixBackspace("> Quote", 2, 2)).toEqual({
      rangeStart: 0, rangeEnd: 2, replacement: "", selectionStart: 0, selectionEnd: 0,
    })
    expect(planBlockPrefixBackspace("## Heading", 4, 4)).toBeNull()
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

    const blocks = parseBlockContainerBlocks(doc)
    expect(blocks).toEqual([
      {
        kind: "toggle",
        from: 0,
        to: doc.indexOf("\n\n:::bookmark"),
        title: "상세 설명",
        body: "숨겨진 첫째 줄\n숨겨진 둘째 줄",
        bodyOffset: ":::toggle 상세 설명\n".length,
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

  test("filters slash commands by block keyword aliases and includes list, image, and file commands", () => {
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
      rangeStart: 0, rangeEnd: 3, replacement: "- ", selectionStart: 2, selectionEnd: 2,
    })

    const imageSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "image")!
    expect(resolveSlashCommandMutation(imageSpec, 0, 6)).toEqual({
      rangeStart: 0, rangeEnd: 6, replacement: "", selectionStart: 0, selectionEnd: 0,
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
      ["| Name | Role |", "| --- | --- |", "| Alice | Admin |", "| Bob | Editor |", "|  |  |"].join("\n")
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
      addRow: true, deleteRow: true, addColumn: true, deleteColumn: true,
      alignLeft: true, alignCenter: true, alignRight: true,
    })

    const moveRowDown = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, { kind: "move-row-down" })
    expect(moveRowDown?.replacement).toBe(
      ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A2 | B2 | C2 |", "| A1 | B1 | C1 |"].join("\n")
    )

    const b2Offset = table.indexOf("B2")
    const moveRowUp = planMarkdownEditorTableEdit(table, b2Offset, b2Offset, { kind: "move-row-up" })
    expect(moveRowUp?.replacement).toBe(
      ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A2 | B2 | C2 |", "| A1 | B1 | C1 |"].join("\n")
    )

    const duplicateRow = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, { kind: "duplicate-row" })
    expect(duplicateRow?.replacement).toBe(
      ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A1 | B1 | C1 |", "| A1 | B1 | C1 |", "| A2 | B2 | C2 |"].join("\n")
    )

    const insertRowAbove = planMarkdownEditorTableEdit(table, b2Offset, b2Offset, { kind: "insert-row-above" })
    expect(insertRowAbove?.replacement).toBe(
      ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A1 | B1 | C1 |", "|  |  |  |", "| A2 | B2 | C2 |"].join("\n")
    )

    const insertColLeft = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, { kind: "insert-column-left" })
    expect(insertColLeft?.replacement).toBe(
      ["| ColA |  | ColB | ColC |", "| --- | --- | :---: | ---: |", "| A1 |  | B1 | C1 |", "| A2 |  | B2 | C2 |"].join("\n")
    )

    const moveColLeft = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, { kind: "move-column-left" })
    expect(moveColLeft?.replacement).toBe(
      ["| ColB | ColA | ColC |", "| :---: | --- | ---: |", "| B1 | A1 | C1 |", "| B2 | A2 | C2 |"].join("\n")
    )

    const moveColRight = planMarkdownEditorTableEdit(table, b1Offset, b1Offset, { kind: "move-column-right" })
    expect(moveColRight?.replacement).toBe(
      ["| ColA | ColC | ColB |", "| --- | ---: | :---: |", "| A1 | C1 | B1 |", "| A2 | C2 | B2 |"].join("\n")
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
    expect(editedCellMd).toContain(String.raw`Updated \| Pipe`)

    const actionResult = applyMarkdownTableGridAction(table, 1, 1, { kind: "add-row" })
    expect(actionResult).toEqual({
      markdown: ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A1 | B1 | C1 |", "|  |  |  |", "| A2 | B2 | C2 |"].join("\n"),
      nextRow: 2,
      nextCol: 1,
    })

    expect(applyMarkdownTableGridAction(table, 1, 1, { kind: "clear-row" })).toEqual({
      markdown: ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "|  |  |  |", "| A2 | B2 | C2 |"].join("\n"),
      nextRow: 1,
      nextCol: 1,
    })

    expect(applyMarkdownTableGridAction(table, 1, 1, { kind: "clear-column" })).toEqual({
      markdown: ["| ColA |  | ColC |", "| --- | :---: | ---: |", "| A1 |  | C1 |", "| A2 |  | C2 |"].join("\n"),
      nextRow: 1,
      nextCol: 1,
    })

    expect(applyMarkdownTableGridAction(table, 1, 1, { kind: "duplicate-column" })).toEqual({
      markdown: ["| ColA | ColB | ColB | ColC |", "| --- | :---: | :---: | ---: |", "| A1 | B1 | B1 | C1 |", "| A2 | B2 | B2 | C2 |"].join("\n"),
      nextRow: 1,
      nextCol: 2,
    })

    expect(applyMarkdownTableGridAction(table, 1, 0, { kind: "move-row-to", targetRow: 2 })).toEqual({
      markdown: ["| ColA | ColB | ColC |", "| --- | :---: | ---: |", "| A2 | B2 | C2 |", "| A1 | B1 | C1 |"].join("\n"),
      nextRow: 2,
      nextCol: 0,
    })

    expect(applyMarkdownTableGridAction(table, 0, 0, { kind: "move-column-to", targetCol: 2 })).toEqual({
      markdown: ["| ColB | ColC | ColA |", "| :---: | ---: | --- |", "| B1 | C1 | A1 |", "| B2 | C2 | A2 |"].join("\n"),
      nextRow: 0,
      nextCol: 2,
    })

    const unclosedBracketTable = [
      "| ColA | ColB | ColC |",
      "| --- | --- | --- |",
      "| [[unclosed | [[Guide|User Guide]] | {{color:emerald|완료}} |",
    ].join("\n")
    expect(parseMarkdownTableGrid(unclosedBracketTable)?.rows).toEqual([
      ["[[unclosed", "[[Guide|User Guide]]", "{{color:emerald|완료}}"],
    ])

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

  test("replaces only [x]/[ ] in task list items while hiding leading bullet and preserving task body text", () => {
    const doc = "# Title\n\n- [x] 완료된 **중요** 항목\n- [ ] 진행할 항목"
    const state = EditorState.create({
      doc,
      selection: { anchor: 0 },
      extensions: [markdown({ base: markdownLanguage, extensions: [GFM] }), decorationField],
    })
    const ranges = collectDecorationEntries(state.field(decorationField), doc.length)

    const taskWidgets = ranges.filter((r) => r.widget instanceof MarkdownTaskWidget)
    expect(taskWidgets).toHaveLength(2)
    expect(doc.slice(taskWidgets[0]!.from, taskWidgets[0]!.to)).toBe("[x]")
    expect(doc.slice(taskWidgets[1]!.from, taskWidgets[1]!.to)).toBe("[ ]")

    const line1Start = doc.indexOf("- [x]")
    const hiddenLeadBullet = ranges.find((r) => r.from === line1Start && r.to === line1Start + 2)
    expect(hiddenLeadBullet).toBeDefined()
    expect(hiddenLeadBullet?.widget).toBeNull()
    const taskSpaceRange = ranges.find(
      (r) => r.from === line1Start + 5 && r.to === line1Start + 6 && r.className === "cm-live-task-space"
    )
    expect(taskSpaceRange).toBeDefined()

    const strongRange = ranges.find((r) => r.className === "cm-live-strong")
    expect(strongRange).toBeDefined()
    expect(doc.slice(strongRange!.from, strongRange!.to)).toBe("**중요**")

    const stateInTaskBody = state.update({ selection: { anchor: line1Start + 8 } }).state
    const bodyRanges = collectDecorationEntries(stateInTaskBody.field(decorationField), doc.length)
    expect(bodyRanges.filter((r) => r.widget instanceof MarkdownTaskWidget)).toHaveLength(2)
    expect(bodyRanges.find((r) => r.from === line1Start && r.to === line1Start + 2)).toBeDefined()

    const stateOnTaskPrefix = stateInTaskBody.update({ selection: { anchor: line1Start + 3 } }).state
    const prefixRanges = collectDecorationEntries(stateOnTaskPrefix.field(decorationField), doc.length)
    expect(prefixRanges.filter((r) => r.widget instanceof MarkdownTaskWidget)).toHaveLength(1)
    expect(prefixRanges.find((r) => r.from === line1Start && r.to === line1Start + 2)).toBeUndefined()

    const stateReturnedToBody = stateOnTaskPrefix.update({ selection: { anchor: line1Start + 8 } }).state
    const returnedRanges = collectDecorationEntries(stateReturnedToBody.field(decorationField), doc.length)
    expect(returnedRanges.filter((r) => r.widget instanceof MarkdownTaskWidget)).toHaveLength(2)
    expect(returnedRanges.find((r) => r.from === line1Start && r.to === line1Start + 2)).toBeDefined()

    const mathTaskDoc = "- [x] 수식 포함 항목 $O(V)$ 완료\n\n다음 문단"
    const mathTaskState = EditorState.create({
      doc: mathTaskDoc,
      selection: { anchor: mathTaskDoc.length - 1 },
      extensions: [markdown({ extensions: [GFM] }), decorationField],
    })
    const mathTaskWidgets = collectDecorationEntries(
      mathTaskState.field(decorationField),
      mathTaskDoc.length
    ).filter((r) => r.widget instanceof MarkdownTaskWidget)
    expect(mathTaskWidgets).toHaveLength(1)
  })

  test("parses :::callout container blocks and switches between CalloutWidget and active container line classes", () => {
    const doc = [
      ":::callout [💡] 에디터 라이브 프리뷰 팁",
      "활성 줄을 벗어나면 깔끔한 카드 블록으로 전환됩니다.",
      ":::",
      "",
      ":::callout warning 주의사항 안내",
      "경고 본문입니다.",
      ":::",
    ].join("\n")

    const blocks = parseBlockContainerBlocks(doc)
    expect(blocks).toEqual([
      {
        kind: "callout",
        from: 0,
        to: doc.indexOf("\n\n:::callout warning"),
        tone: "tip",
        icon: "💡",
        title: "에디터 라이브 프리뷰 팁",
        body: "활성 줄을 벗어나면 깔끔한 카드 블록으로 전환됩니다.",
        bodyOffset: ":::callout [💡] 에디터 라이브 프리뷰 팁\n".length,
      },
      {
        kind: "callout",
        from: doc.indexOf(":::callout warning"),
        to: doc.length,
        tone: "warning",
        icon: "⚠️",
        title: "주의사항 안내",
        body: "경고 본문입니다.",
        bodyOffset: ":::callout warning 주의사항 안내\n".length,
      },
    ])

    const renderedSegments = parseMarkdownSegments(doc)
    expect(renderedSegments).toEqual([
      expect.objectContaining({ type: "callout", kind: "tip", title: "에디터 라이브 프리뷰 팁" }),
      expect.objectContaining({ type: "callout", kind: "warning", title: "주의사항 안내" }),
    ])

    const stateInactive = EditorState.create({
      doc: `${doc}\n\n바깥 문단`,
      selection: { anchor: doc.length + 3 },
      extensions: [blockContainerBlockField],
    })
    const inactiveSet = stateInactive.field(blockContainerBlockField)
    const inactiveWidgets = collectDecorationEntries(inactiveSet, stateInactive.doc.length)
      .map((entry) => entry.widget)
      .filter(Boolean)
    expect(inactiveWidgets).toHaveLength(2)
    expect(inactiveWidgets[0]).toBeInstanceOf(MarkdownCalloutBlockWidget)
    expect(resolveLiveCalloutTone("tip").icon).toBe("💡")

    const stateMovedOutside = stateInactive.update({ selection: { anchor: doc.length + 5 } }).state
    expect(stateMovedOutside.field(blockContainerBlockField)).toBe(inactiveSet)

    const fakeCalloutDom = {
      dataset: {
        from: "0",
        sig: ["tip", "💡", "에디터 라이브 프리뷰 팁", "활성 줄을 벗어나면 깔끔한 카드 블록으로 전환됩니다.", "25"].join("\0"),
      },
    } as unknown as HTMLElement
    const shiftedCalloutWidget = new MarkdownCalloutBlockWidget(
      "tip",
      "💡",
      "에디터 라이브 프리뷰 팁",
      "활성 줄을 벗어나면 깔끔한 카드 블록으로 전환됩니다.",
      32,
      120,
      25
    )
    expect(shiftedCalloutWidget.updateDOM(fakeCalloutDom)).toBe(true)
    expect(fakeCalloutDom.dataset.from).toBe("32")

    const stateActive = stateInactive.update({ selection: { anchor: 5 } }).state
    const activeSet = stateActive.field(blockContainerBlockField)
    const activeLineClasses = collectDecorationEntries(activeSet, doc.indexOf("\n\n:::callout warning"))
      .map((entry) => entry.className)
      .filter(Boolean)
    expect(activeLineClasses).toHaveLength(3)
    expect(activeLineClasses[0]).toContain("cm-live-container-active-callout")
    expect(activeLineClasses[0]).toContain("cm-live-container-tone-tip")
    expect(activeLineClasses[0]).toContain("cm-live-container-line-open")
    expect(activeLineClasses[2]).toContain("cm-live-container-line-close")
  })

  test("renders inline code, strikethrough, highlight, math, <br>, and links in appendInlineMarkdownNodes and resolves emerald/amber colors", () => {
    expect(resolveInlineColorValue("emerald")).toBe("#10b981")
    expect(resolveInlineColorValue("amber")).toBe("#f59e0b")

    const restoreDoc = installFakeInlineDocument()
    try {
      const container = makeFakeInlineNode("div")
      appendInlineMarkdownNodes(
        container,
        "속도 `decorationField` **굵게** *기울임* ~~취소~~ ==강조== $O(1)$ [링크](https://example.com) {{color:emerald|완료}} {{color:blue|파랑}} 줄1<br>줄2 [[문서]] [[Target|별칭]]"
      )
      const elementChildren = container.children.filter((c: any) => c.tagName)
      expect(elementChildren.map((c: any) => `${c.tagName}:${c.className}:${c.textContent}`)).toEqual([
        "CODE:cm-live-inline-code:decorationField",
        "STRONG::굵게",
        "EM::기울임",
        "DEL:cm-live-strikethrough:취소",
        "MARK:cm-live-highlight:강조",
        "SPAN:cm-live-math cm-live-math-inline:O(1)",
        "A:cm-live-link:링크",
        "SPAN:cm-live-color:완료",
        "SPAN:cm-live-color:파랑",
        "BR::",
        "SPAN:cm-live-wikilink:문서",
        "SPAN:cm-live-wikilink:별칭",
      ])

      const mathAndCurrency = makeFakeInlineNode("div")
      appendInlineMarkdownNodes(mathAndCurrency, "수식 $$x^2$$ 및 가격은 $10에서 $20입니다")
      const mathElements = mathAndCurrency.children.filter((c: any) => c.tagName)
      expect(mathElements.map((c: any) => `${c.tagName}:${c.className}:${c.textContent}`)).toEqual([
        "SPAN:cm-live-math cm-live-math-inline:x^2",
      ])
    } finally {
      restoreDoc()
    }
  })
})
