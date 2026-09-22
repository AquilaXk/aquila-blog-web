import { expect, test } from "@playwright/test"
import {
  HTML_PASTE_EMPTY_CONTENT_MESSAGE,
  createHtmlPasteEmptyResult,
  normalizeHtmlPasteText,
  resolveSafeHtmlPasteHref,
  resolveSafeHtmlPasteImportBoundary,
} from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"

test.describe("markdown editor safe HTML paste model", () => {
  test("keeps the null-html and empty-html result boundary explicit", () => {
    expect(resolveSafeHtmlPasteImportBoundary(null)).toEqual({ kind: "none" })
    expect(resolveSafeHtmlPasteImportBoundary(" \r\n ")).toEqual(createHtmlPasteEmptyResult())
    expect(createHtmlPasteEmptyResult()).toEqual({
      kind: "error",
      message: HTML_PASTE_EMPTY_CONTENT_MESSAGE,
    })
  })

  test("accepts only credential-free absolute http URLs", () => {
    expect(resolveSafeHtmlPasteHref("https://example.com/docs?q=1")).toBe("https://example.com/docs?q=1")
    expect(resolveSafeHtmlPasteHref("http://example.com")).toBe("http://example.com/")
    expect(resolveSafeHtmlPasteHref("/relative")).toBeNull()
    expect(resolveSafeHtmlPasteHref("https://user:pass@example.com")).toBeNull()
    expect(resolveSafeHtmlPasteHref("javascript:alert(1)")).toBeNull()
    expect(resolveSafeHtmlPasteHref("data:text/html,x")).toBeNull()
  })

  test("normalizes clipboard text without retaining control whitespace", () => {
    expect(normalizeHtmlPasteText("  alpha\r\n beta\u00a0 gamma  ")).toBe(" alpha\n beta gamma ")
    expect(normalizeHtmlPasteText("\u0000\t\n")).toBe("")
  })

  test("converts safe HTML table, image with src, and pre code blocks", () => {
    // Simple mock DOMParser for Node environment
    class MockNode {
      nodeType: number
      tagName: string
      textContent: string
      childNodes: MockNode[] = []
      children: MockNode[] = []
      attributes: Record<string, string> = {}
      className = ""

      constructor(nodeType: number, tagName = "", text = "") {
        this.nodeType = nodeType
        this.tagName = tagName.toUpperCase()
        this.textContent = text
      }

      getAttribute(name: string) {
        return this.attributes[name] || null
      }

      querySelectorAll(tag: string): MockNode[] {
        const results: MockNode[] = []
        const traverse = (n: MockNode) => {
          if (n.tagName.toLowerCase() === tag.toLowerCase()) results.push(n)
          for (const c of n.children) traverse(c)
        }
        for (const c of this.children) traverse(c)
        return results
      }
    }

    const originalDOMParser = globalThis.DOMParser
    const originalNode = globalThis.Node
    ;(globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 }

    // Test image conversion
    const docImg = {
      body: new MockNode(1, "BODY"),
    }
    const pNode = new MockNode(1, "P")
    const imgNode = new MockNode(1, "IMG")
    imgNode.attributes = { src: "https://example.com/pic.png", alt: "My Image" }
    pNode.children.push(imgNode)
    pNode.childNodes.push(imgNode)
    docImg.body.children.push(pNode)
    docImg.body.childNodes.push(pNode)

    ;(globalThis as any).DOMParser = class {
      parseFromString() {
        return docImg
      }
    }

    const { convertSafeHtmlPasteToMarkdown } = require("../../src/components/markdown-editor/markdownEditorHtmlPasteModel")
    const imgResult = convertSafeHtmlPasteToMarkdown("<p><img src='https://example.com/pic.png' alt='My Image'></p>")
    expect(imgResult).toEqual({
      kind: "markdown",
      markdown: "![My Image](https://example.com/pic.png)",
    })

    // Test table conversion
    const docTable = { body: new MockNode(1, "BODY") }
    const tableNode = new MockNode(1, "TABLE")
    const tr1 = new MockNode(1, "TR")
    const th1 = new MockNode(1, "TH")
    th1.childNodes.push(new MockNode(3, "", "Col A"))
    const th2 = new MockNode(1, "TH")
    th2.childNodes.push(new MockNode(3, "", "Col B"))
    tr1.children.push(th1, th2)
    tr1.childNodes.push(th1, th2)

    const tr2 = new MockNode(1, "TR")
    const td1 = new MockNode(1, "TD")
    td1.childNodes.push(new MockNode(3, "", "1"))
    const td2 = new MockNode(1, "TD")
    td2.childNodes.push(new MockNode(3, "", "2"))
    tr2.children.push(td1, td2)
    tr2.childNodes.push(td1, td2)

    tableNode.children.push(tr1, tr2)
    tableNode.childNodes.push(tr1, tr2)
    docTable.body.children.push(tableNode)
    docTable.body.childNodes.push(tableNode)

    ;(globalThis as any).DOMParser = class {
      parseFromString() {
        return docTable
      }
    }

    const tableResult = convertSafeHtmlPasteToMarkdown("<table>...</table>")
    expect(tableResult).toEqual({
      kind: "markdown",
      markdown: "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |",
    })

    // Test pre / code block conversion
    const docPre = { body: new MockNode(1, "BODY") }
    const preNode = new MockNode(1, "PRE")
    const codeNode = new MockNode(1, "CODE", "  const x = 1\n  const y = 2")
    codeNode.className = "language-typescript"
    preNode.children.push(codeNode)
    preNode.childNodes.push(codeNode)
    docPre.body.children.push(preNode)
    docPre.body.childNodes.push(preNode)

    ;(globalThis as any).DOMParser = class {
      parseFromString() {
        return docPre
      }
    }

    const preResult = convertSafeHtmlPasteToMarkdown("<pre><code>...</code></pre>")
    expect(preResult).toEqual({
      kind: "markdown",
      markdown: "```typescript\n  const x = 1\n  const y = 2\n```",
    })

    // Restore globals
    ;(globalThis as any).DOMParser = originalDOMParser
    ;(globalThis as any).Node = originalNode
  })
})
