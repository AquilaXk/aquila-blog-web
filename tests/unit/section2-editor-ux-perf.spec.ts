import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { expect, test } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"
import { createMarkdownDocumentInsights } from "../../src/libs/markdown/markdownDocumentInsights"
import {
  analyzeMarkdownLinks,
  computeCursorLineAndColumn,
  resolveActiveOutlineItemIndex,
} from "../../src/routes/Admin/editorStudioDedicatedSurfaceModel"
import {
  isOffsetInsideFencedCodeBlock,
  planListEnterContinuation,
} from "../../src/components/markdown-editor/markdownEditorKeyboardModel"
import { handleFenceEnter } from "../../src/components/markdown-editor/markdownEditorLiveSurfaceCommands"
import { parseBlockContainerBlocks } from "../../src/components/markdown-editor/markdownEditorBlockContainerModel"
import { resolveLiveCalloutTone } from "../../src/components/markdown-editor/markdownEditorWidgets"
import {
  bookmarkBlockSnippet,
  embedBlockSnippet,
  planCodeBlockToolbarInsertion,
} from "../../src/components/markdown-editor/markdownEditorBlockSnippets"
import { SLASH_COMMAND_SPECS } from "../../src/components/markdown-editor/MarkdownEditorSlashMenu"
import {
  convertSafeHtmlPasteToMarkdown,
  resolveSafeHtmlPasteHref,
} from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
import { applyPlannedTextMutationToValue } from "../../src/components/markdown-editor/markdownEditorTextMutation"

test.describe("section 2 editor UX, bug fixes, and low-level optimizations", () => {
  test("keeps CRLF offsets aligned with normalized coordinates and counts words/chars without trim copy drift", () => {
    const crlf = "  \r\n# First\r\n## Second\r\n\r\n   "
    const normalized = crlf.replace(/\r\n/g, "\n")
    const insights = createMarkdownDocumentInsights(crlf)
    expect(insights.headings).toEqual([
      { level: 1, label: "First", offset: 3, range: { start: 3, end: 10 }, slug: "first" },
      { level: 2, label: "Second", offset: 11, range: { start: 11, end: 20 }, slug: "second" },
    ])
    expect(insights.headings.map((h) => normalized.slice(h.range.start, h.range.end))).toEqual([
      "# First",
      "## Second",
    ])
    expect(insights.wordCount).toBe(4)
  })

  test("ignores fenced and inline code spans in analyzeMarkdownLinks", () => {
    const sample = [
      "Valid [link](https://example.com) and broken [bad](https://)",
      "Inline code `[ignored-empty]()` and ``[ignored-http](http://)``",
      "```ts",
      "const a = '[fenced-empty]()'",
      "const b = '[[fenced-wiki]]'",
      "```",
      "~~~md",
      "[tilde-broken](http://",
      "~~~",
    ].join("\n")

    expect(analyzeMarkdownLinks(sample)).toEqual({
      totalLinks: 2,
      linkWarnings: 1,
    })
  })

  test("uses O(log N) binary search accurately for cursor line/col and active outline", () => {
    const doc = "alpha\nbeta\n\ngamma"
    expect(computeCursorLineAndColumn(doc, 0)).toEqual({ line: 1, column: 1 })
    expect(computeCursorLineAndColumn(doc, 6)).toEqual({ line: 2, column: 1 })
    expect(computeCursorLineAndColumn(doc, 11)).toEqual({ line: 3, column: 1 })
    expect(computeCursorLineAndColumn(doc, 12)).toEqual({ line: 4, column: 1 })

    const outlineItems = [
      { range: null },
      { range: { start: 10, end: 20 } },
      { range: { start: 30, end: 40 } },
      { range: { start: 60, end: 75 } },
    ]
    expect(resolveActiveOutlineItemIndex(outlineItems, 5)).toBe(0)
    expect(resolveActiveOutlineItemIndex(outlineItems, 10)).toBe(1)
    expect(resolveActiveOutlineItemIndex(outlineItems, 45)).toBe(2)
    expect(resolveActiveOutlineItemIndex(outlineItems, 60)).toBe(3)
  })

  test("handles col 0 Enter on list items and nested blockquote continuation/exit", () => {
    const col0Bullet = planListEnterContinuation("- item", 0, 0)
    expect(col0Bullet).not.toBeNull()
    expect(applyPlannedTextMutationToValue("- item", col0Bullet!)).toEqual({
      value: "\n- item",
      selectionStart: 1,
      selectionEnd: 1,
    })

    const col0Ordered = planListEnterContinuation("1. first\n2. second", 0, 0)
    expect(col0Ordered).not.toBeNull()
    expect(applyPlannedTextMutationToValue("1. first\n2. second", col0Ordered!).value).toBe(
      "\n1. first\n2. second"
    )

    expect(planListEnterContinuation(">> nested", 9, 9)?.replacement).toBe("\n>> ")
    expect(planListEnterContinuation("> > spaced", 10, 10)?.replacement).toBe("\n> > ")
    expect(planListEnterContinuation("> ", 2, 2)?.replacement).toBe("")
    expect(planListEnterContinuation(">", 1, 1)?.replacement).toBe("")
    expect(planListEnterContinuation("> > ", 4, 4)).toEqual({
      rangeStart: 0,
      rangeEnd: 4,
      replacement: "> ",
      selectionStart: 2,
      selectionEnd: 2,
    })
  })

  test("handles fence metadata with Lezer syntaxTree in extracted fence commands", () => {
    const docOpen = '```ts title="app.ts" {1,3-5}'
    const stateOpen = EditorState.create({
      doc: docOpen,
      selection: EditorSelection.cursor(docOpen.length),
      extensions: [markdown({ extensions: GFM })],
    })
    let dispatchedInsert = ""
    const handledOpen = handleFenceEnter.run?.({
      state: stateOpen,
      composing: false,
      dispatch: (tr: { changes?: { insert?: string } }) => {
        dispatchedInsert = tr.changes?.insert ?? ""
      },
    } as unknown as EditorView)
    expect(handledOpen).toBe(true)
    expect(dispatchedInsert).toBe("\n\n```")

    const docClosed = '```ts title="app.ts" {1,3-5}\nconst x = 1\n```'
    const stateClosed = EditorState.create({
      doc: docClosed,
      selection: EditorSelection.cursor(docClosed.indexOf("\n")),
      extensions: [markdown({ extensions: GFM })],
    })
    const handledClosed = handleFenceEnter.run?.({
      state: stateClosed,
      composing: false,
      dispatch: () => {},
    } as unknown as EditorView)
    expect(handledClosed).toBe(false)

    const backtickInfoInline = "```foo```"
    expect(isOffsetInsideFencedCodeBlock(backtickInfoInline, 5)).toBe(false)
  })

  test("unifies outline callout icon, supports foldable callouts, embed/bookmark snippets, and mid-line toolbar code insertion", () => {
    expect(resolveLiveCalloutTone("outline").icon).toBe("📋")

    const parsedContainers = parseBlockContainerBlocks(
      [
        ":::callout [!INFO]+ Expanded Title",
        "details",
        ":::",
        "",
        ":::callout [!TIP]- Collapsed Title",
        "hidden",
        ":::",
      ].join("\n")
    )
    expect(parsedContainers[0]).toMatchObject({
      kind: "callout",
      tone: "info",
      title: "Expanded Title",
      foldable: true,
      defaultCollapsed: false,
    })
    expect(parsedContainers[1]).toMatchObject({
      kind: "callout",
      tone: "tip",
      title: "Collapsed Title",
      foldable: true,
      defaultCollapsed: true,
    })

    expect(embedBlockSnippet.snippet).toContain(":::embed https://")
    expect(bookmarkBlockSnippet.snippet).toContain(":::bookmark https://")
    expect(SLASH_COMMAND_SPECS.some((spec) => spec.id === "embed")).toBe(true)
    expect(SLASH_COMMAND_SPECS.some((spec) => spec.id === "bookmark")).toBe(true)

    const midLinePlan = planCodeBlockToolbarInsertion("alphaomega", 5, 5)
    expect(applyPlannedTextMutationToValue("alphaomega", midLinePlan).value).toBe(
      "alpha\n```ts\n\n```\nomega"
    )
  })

  test("converts blockquote, hr, mark, and checkbox task items on safe HTML paste while rejecting relative URLs", () => {
    expect(resolveSafeHtmlPasteHref("/relative")).toBeNull()

    class MiniNode {
      nodeType: number
      tagName: string
      textContent: string
      childNodes: MiniNode[] = []
      children: MiniNode[] = []
      attributes: Record<string, string> = {}
      className = ""
      checked?: boolean
      type?: string

      constructor(nodeType: number, tagName = "", text = "") {
        this.nodeType = nodeType
        this.tagName = tagName.toUpperCase()
        this.textContent = text
      }
      getAttribute(name: string) {
        return name in this.attributes ? this.attributes[name]! : null
      }
      querySelectorAll(tag: string): MiniNode[] {
        const out: MiniNode[] = []
        const walk = (n: MiniNode) => {
          if (n.tagName.toLowerCase() === tag.toLowerCase()) out.push(n)
          for (const c of n.children) walk(c)
        }
        for (const c of this.children) walk(c)
        return out
      }
    }
    const el = (tag: string, children: MiniNode[] = [], attrs: Record<string, string> = {}) => {
      const node = new MiniNode(1, tag)
      node.attributes = attrs
      node.childNodes = children
      node.children = children.filter((c) => c.nodeType === 1)
      return node
    }
    const txt = (text: string) => new MiniNode(3, "", text)

    const body = el("body", [
      el("blockquote", [el("p", [txt("Quoted "), el("mark", [txt("highlight")])])]),
      el("hr"),
      el("ul", [
        el("li", [el("input", [], { type: "checkbox", checked: "" }), txt(" Done task")]),
        el("li", [el("input", [], { type: "checkbox" }), txt(" Open task")]),
      ]),
    ])

    const origDOMParser = globalThis.DOMParser
    const origNode = globalThis.Node
    ;(globalThis as Record<string, unknown>).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 }
    ;(globalThis as Record<string, unknown>).DOMParser = class {
      parseFromString() {
        return { body }
      }
    }
    try {
      expect(convertSafeHtmlPasteToMarkdown("<blockquote>...</blockquote><hr><ul>...</ul>")).toEqual({
        kind: "markdown",
        markdown: "> Quoted ==highlight==\n\n---\n\n- [x] Done task\n- [ ] Open task",
      })
    } finally {
      ;(globalThis as Record<string, unknown>).DOMParser = origDOMParser
      ;(globalThis as Record<string, unknown>).Node = origNode
    }
  })

  test("batches BlockChrome DOM measurements inside CM6 requestMeasure", () => {
    const chromeSrc = readFileSync(
      path.resolve(process.cwd(), "src/components/markdown-editor/MarkdownEditorBlockChrome.tsx"),
      "utf8"
    )
    expect(chromeSrc).toContain("requestMeasure")
  })
})
