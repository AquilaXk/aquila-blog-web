import { EditorState } from "@codemirror/state"
import { syntaxTree } from "@codemirror/language"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { expect, test } from "@playwright/test"
import {
  hasLikelyMarkdownMath,
  resolvePreBlockMermaidSource,
} from "../../src/libs/markdown/MarkdownRenderer"
import {
  isMermaidCodeBlock,
  shouldRescanPrismOnRemovedNodes,
} from "../../src/libs/markdown/prismEffectRuntime"
import { createDocumentFootnoteModel } from "../../src/libs/markdown/renderingFootnoteModel"
import { createMermaidRuntimeController } from "../../src/libs/markdown/mermaidRuntimeRender"
import { shouldSyncTocFromMutations } from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import {
  hasStickyBlockingAncestor,
  invalidateStickyBlockingAncestorCache,
} from "../../src/routes/Detail/PostDetail/PostDetailRailModel"
import {
  countCodePoints,
  countWords,
  createMarkdownDocumentInsights,
} from "../../src/libs/markdown/markdownDocumentInsights"
import {
  MarkdownCalloutWidget,
  MarkdownMermaidWidget,
  MarkdownTableWidget,
  MarkdownTaskWidget,
  MarkdownWikilinkWidget,
} from "../../src/components/markdown-editor/markdownEditorWidgets"
import {
  buildMarkdownLivePreviewEntries,
  buildMarkdownLivePreviewPlan,
  computeMarkdownFoldRange,
  resolveMarkdownLivePreviewPlanFromEntries,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import {
  matchSlashCommandTrigger,
  resolveSlashCommandMutation,
} from "../../src/components/markdown-editor/MarkdownEditor"
import { planMarkdownEditorTableCellNavigation } from "../../src/components/markdown-editor/markdownEditorTableModel"
import { planLinkifySelectionWithUrl } from "../../src/components/markdown-editor/markdownEditorPasteDropModel"
import { resolveActiveOutlineItemIndex } from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import {
  getLocalDraftDocumentId,
  localDraftStorageKeyForDocument,
  persistLocalDraft,
} from "../../src/routes/Admin/editorStudioStorageModel"

test.describe("Issue #258 Track A — Viewer lag & rendering optimizations", () => {
  test("AC-1: prismEffectRuntime ignores Mermaid code blocks and Mermaid DOM removals", () => {
    const mermaidWrapper = {
      classList: { contains: (cls: string) => cls === "aq-mermaid" },
      closest: (selector: string) => (selector.includes("aq-mermaid") ? {} : null),
      querySelector: () => null,
    } as unknown as HTMLElement

    const regularCode = {
      classList: { contains: (cls: string) => cls === "language-ts" },
      closest: () => null,
      querySelector: () => null,
    } as unknown as HTMLElement

    expect(isMermaidCodeBlock(mermaidWrapper)).toBe(true)
    expect(isMermaidCodeBlock(regularCode)).toBe(false)

    const mermaidRemovalRecord = {
      type: "childList",
      target: mermaidWrapper,
      addedNodes: [],
      removedNodes: [mermaidWrapper],
    } as unknown as MutationRecord

    const codeRemovalRecord = {
      type: "childList",
      target: regularCode,
      addedNodes: [],
      removedNodes: [
        {
          classList: { contains: () => false },
          closest: () => null,
          matches: (sel: string) => sel === "pre, code",
          querySelector: () => null,
        },
      ],
    } as unknown as MutationRecord

    if (typeof Element !== "undefined") {
      Object.setPrototypeOf(mermaidWrapper, Element.prototype)
      Object.setPrototypeOf(regularCode, Element.prototype)
      Object.setPrototypeOf(codeRemovalRecord.removedNodes[0], Element.prototype)
      expect(shouldRescanPrismOnRemovedNodes(mermaidRemovalRecord.removedNodes)).toBe(false)
      expect(shouldRescanPrismOnRemovedNodes(codeRemovalRecord.removedNodes)).toBe(true)
    }
  })

  test("AC-2: resolvePreBlockMermaidSource skips Mermaid regex detection on tagged non-mermaid blocks", () => {
    expect(resolvePreBlockMermaidSource("typescript", "graph TD\n  A --> B")).toBe("")
    expect(resolvePreBlockMermaidSource("mermaid", "graph TD\n  A --> B")).toBe("graph TD\n  A --> B")
    expect(resolvePreBlockMermaidSource("", "flowchart LR\n  Start --> Stop")).toBe(
      "flowchart LR\n  Start --> Stop"
    )
    expect(resolvePreBlockMermaidSource("", "const x = 42;")).toBe("")
  })

  test("AC-2: hasLikelyMarkdownMath distinguishes real inline/block math from currency signs", () => {
    expect(hasLikelyMarkdownMath("No math in this document")).toBe(false)
    expect(hasLikelyMarkdownMath("Single price $100 on line 1\nAnd $200 on line 2")).toBe(false)
    expect(hasLikelyMarkdownMath("Escaped \\$100 and \\$200 on same line")).toBe(false)
    expect(hasLikelyMarkdownMath("Inline formula $E = mc^2$ in text")).toBe(true)
    expect(hasLikelyMarkdownMath("Block formula:\n$$\n\\int_0^1 x dx\n$$")).toBe(true)
  })

  test("AC-2: createDocumentFootnoteModel fast-paths when no footnote definition exists", () => {
    const sourceWithoutDefs =
      "Paragraph with bracket [^1] but no definition anywhere in the post."
    const withoutDefinitions = createDocumentFootnoteModel({
      source: sourceWithoutDefs,
      segments: [{ type: "markdown", content: sourceWithoutDefs }],
    })
    expect(withoutDefinitions.footnotes).toHaveLength(0)

    const sourceWithDefs = "Claim[^1] in body.\n\n[^1]: Footnote explanation"
    const withDefinitions = createDocumentFootnoteModel({
      source: sourceWithDefs,
      segments: [{ type: "markdown", content: sourceWithDefs }],
    })
    expect(withDefinitions.footnotes).toHaveLength(1)
    expect(withDefinitions.footnotes[0]?.content).toBe("Footnote explanation")
  })

  test("AC-2: createMermaidRuntimeController tracks active render queue and guards resetLayoutCache", async () => {
    const runScenario = async (forceResetDuringRender: boolean) => {
      let releaseMermaid: () => void = () => {}
      let rectReads = 0

      const fakeBlock = {
        isConnected: true,
        className: "aq-mermaid",
        dataset: { mermaidSource: "graph TD\nA-->B" } as Record<string, string>,
        getAttribute: (attr: string) => (attr === "data-mermaid-source" ? "graph TD\nA-->B" : null),
        querySelector: () => null,
        closest: () => null,
        getBoundingClientRect: () => {
          rectReads += 1
          return { width: 640, height: 180, left: 0, right: 640 } as DOMRect
        },
      } as unknown as HTMLElement

      const root = {
        querySelectorAll: (selector: string) =>
          selector.includes("pre.aq-mermaid") ? [fakeBlock] : [],
      } as unknown as HTMLElement

      const controller = createMermaidRuntimeController({
        root,
        preset: {
          themeKey: "light",
          mode: "light",
        } as any,
        allowDesktopWideLane: false,
        lazyViewport: false,
        shouldLogMermaidWarnings: false,
        getMermaid: () =>
          new Promise((resolve) => {
            releaseMermaid = () =>
              resolve({
                render: async () => ({ svg: "<svg viewBox='0 0 100 50'></svg>" }),
              } as any)
          }),
        isDisposed: () => Boolean(fakeBlock.dataset.mermaidComplexity),
        retryTimers: new Set(),
        readParseWarning: () => null,
        clearParseWarning: () => {},
      })

      const renderPromise = controller.renderMermaidBlocks()
      expect(controller.isRendering()).toBe(true)
      expect(rectReads).toBe(1)

      controller.resetLayoutCache(forceResetDuringRender)
      await Promise.resolve()
      releaseMermaid()
      await renderPromise
      expect(controller.isRendering()).toBe(false)
      return rectReads
    }

    // Non-forced reset while rendering preserves premeasured rect (1 read total)
    expect(await runScenario(false)).toBe(1)
    // Forced reset while rendering clears premeasured rect, triggering re-measure (2 reads total)
    expect(await runScenario(true)).toBe(2)
  })

  test("AC-3: shouldSyncTocFromMutations ignores non-heading mutations and detects heading changes", () => {
    const codeSpan = {
      tagName: "SPAN",
      closest: () => null,
      querySelector: () => null,
    }
    const headingNode = {
      tagName: "H2",
      closest: (sel: string) => (sel === "h2, h3, h4" ? headingNode : null),
      querySelector: () => null,
    }
    if (typeof Element !== "undefined") {
      Object.setPrototypeOf(codeSpan, Element.prototype)
      Object.setPrototypeOf(headingNode, Element.prototype)

      const nonHeadingMutation = {
        type: "childList",
        target: codeSpan,
        addedNodes: [codeSpan],
        removedNodes: [],
      } as unknown as MutationRecord

      const headingMutation = {
        type: "childList",
        target: headingNode,
        addedNodes: [],
        removedNodes: [],
      } as unknown as MutationRecord

      expect(shouldSyncTocFromMutations([nonHeadingMutation])).toBe(false)
      expect(shouldSyncTocFromMutations([headingMutation])).toBe(true)
    }
  })

  test("AC-3: hasStickyBlockingAncestor caches computed style traversal until invalidated", () => {
    let getComputedStyleCalls = 0
    const body = {} as HTMLElement
    const documentElement = {} as HTMLElement
    const parent = { parentElement: body } as unknown as HTMLElement
    const child = { parentElement: parent } as unknown as HTMLElement
    let overflowValue = "visible"

    const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { body, documentElement },
      writable: true,
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        getComputedStyle: () => {
          getComputedStyleCalls += 1
          return {
            overflowX: overflowValue,
            overflowY: overflowValue,
            overflow: overflowValue,
          }
        },
      },
      writable: true,
    })

    try {
      invalidateStickyBlockingAncestorCache()
      expect(hasStickyBlockingAncestor(child)).toBe(false)
      expect(getComputedStyleCalls).toBe(1)

      // Second call uses WeakMap cache without calling getComputedStyle again
      overflowValue = "hidden"
      expect(hasStickyBlockingAncestor(child)).toBe(false)
      expect(getComputedStyleCalls).toBe(1)

      // After invalidating cache, recomputes with updated style
      invalidateStickyBlockingAncestorCache()
      expect(hasStickyBlockingAncestor(child)).toBe(true)
      expect(getComputedStyleCalls).toBe(2)
    } finally {
      if (prevWindow) Object.defineProperty(globalThis, "window", prevWindow)
      else delete (globalThis as Record<string, unknown>).window
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
    }
  })
})

test.describe("Issue #258 Track B — Obsidian Live Editor bug fixes & performance", () => {
  test("AC-4: Widget eq() ignores document offset shifts for Task, Wikilink, and Mermaid widgets", () => {
    const taskA = new MarkdownTaskWidget(false, 10, 16)
    const taskB = new MarkdownTaskWidget(false, 42, 48)
    const taskChecked = new MarkdownTaskWidget(true, 42, 48)
    expect(taskA.eq(taskB)).toBe(true)
    expect(taskA.eq(taskChecked)).toBe(false)

    const wikiA = new MarkdownWikilinkWidget("TargetNote", "Alias", 5, 25)
    const wikiB = new MarkdownWikilinkWidget("TargetNote", "Alias", 105, 125)
    const wikiDiff = new MarkdownWikilinkWidget("OtherNote", "Alias", 105, 125)
    expect(wikiA.eq(wikiB)).toBe(true)
    expect(wikiA.eq(wikiDiff)).toBe(false)

    const mermaidA = new MarkdownMermaidWidget("graph TD\nA-->B", 0)
    const mermaidB = new MarkdownMermaidWidget("graph TD\nA-->B", 50)
    const mermaidDiff = new MarkdownMermaidWidget("graph LR\nA-->B", 50)
    expect(mermaidA.eq(mermaidB)).toBe(true)
    expect(mermaidA.eq(mermaidDiff)).toBe(false)
  })

  test("AC-4 & AC-6: Callout and Table widgets strip '>' prefixes and render inline markdown safely", () => {
    const fakeDocument = () => {
      const createNode = (tag: string): any => {
        const node: any = {
          tagName: tag.toUpperCase(),
          className: "",
          textContent: "",
          attributes: {} as Record<string, string>,
          children: [] as any[],
          appendChild(child: any) {
            this.children.push(child)
            return child
          },
          setAttribute(k: string, v: string) {
            this.attributes[k] = v
          },
          addEventListener() {},
        }
        return node
      }
      return {
        createElement: (tag: string) => createNode(tag),
        createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      }
    }

    const collectText = (node: any): string => {
      if (node.nodeType === 3) return node.textContent ?? ""
      if (node.children && node.children.length > 0) {
        return node.children.map(collectText).join("")
      }
      return node.textContent ?? ""
    }

    const collectTags = (node: any): string[] => {
      const tags: string[] = []
      if (node.tagName) tags.push(node.tagName)
      for (const child of node.children ?? []) {
        tags.push(...collectTags(child))
      }
      return tags
    }

    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: fakeDocument(),
      writable: true,
    })

    try {
      const callout = new MarkdownCalloutWidget(
        "TIP",
        "Custom **Title**",
        "> First line with **bold** and `code`\n> Second line with [link](https://example.com)"
      )
      const calloutDom = callout.toDOM()
      const calloutText = collectText(calloutDom)
      expect(calloutText).not.toContain("> First")
      expect(calloutText).toContain("First line with bold and code")
      expect(calloutText).toContain("Second line with link")
      expect(collectTags(calloutDom)).toEqual(expect.arrayContaining(["STRONG", "CODE", "A"]))

      const table = new MarkdownTableWidget(
        "| Name | Description |\n| --- | --- |\n| **Alpha** | `beta` |"
      )
      const tableDom = table.toDOM()
      const tableText = collectText(tableDom)
      expect(tableText).not.toContain("**Alpha**")
      expect(tableText).toContain("Alpha")
      expect(collectTags(tableDom)).toEqual(expect.arrayContaining(["STRONG", "CODE"]))
    } finally {
      if (prevDoc) {
        Object.defineProperty(globalThis, "document", prevDoc)
      } else {
        delete (globalThis as Record<string, unknown>).document
      }
    }
  })

  test("AC-4: buildMarkdownLivePreviewEntries caches AST/regex entries across cursor movements", () => {
    const doc = [
      "# Heading 1",
      "",
      "Paragraph with **bold** and [[WikiNote|Alias]].",
      "",
      "- [x] Done task",
    ].join("\n")

    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    })
    const topNode = syntaxTree(state).topNode

    const entries = buildMarkdownLivePreviewEntries(doc, topNode)
    const selectionsAtEnd = [{ from: doc.length, to: doc.length }]

    const planFromCachedEntries = resolveMarkdownLivePreviewPlanFromEntries(
      entries,
      selectionsAtEnd,
      false
    )
    const planFromFullRebuild = buildMarkdownLivePreviewPlan(
      doc,
      topNode,
      selectionsAtEnd,
      false
    )

    expect(planFromCachedEntries).toEqual(planFromFullRebuild)
  })

  test("AC-5: persistLocalDraft skips scanning other localStorage keys when target slot already exists", () => {
    const store = new Map<string, string>()
    let keyScanCount = 0
    const storage: Storage = {
      get length() {
        return store.size
      },
      clear() {
        store.clear()
      },
      getItem(k: string) {
        return store.get(k) ?? null
      },
      key(index: number) {
        keyScanCount += 1
        return Array.from(store.keys())[index] ?? null
      },
      removeItem(k: string) {
        store.delete(k)
      },
      setItem(k: string, v: string) {
        store.set(k, v)
      },
    }

    const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage },
      writable: true,
    })

    try {
      const source = { kind: "create" as const }
      const docId = getLocalDraftDocumentId()
      const slotKey = localDraftStorageKeyForDocument(source, docId)
      store.set(slotKey, '{"existing":true}')

      keyScanCount = 0
      persistLocalDraft({
        title: "Fast path",
        content: "Body",
        summary: "",
        summarySource: "NONE",
        summaryIntent: { kind: "auto" },
        thumbnailUrl: "",
        thumbnailFocusX: 50,
        thumbnailFocusY: 50,
        thumbnailZoom: 1,
        tags: [],
        category: "",
        visibility: "PUBLIC_LISTED",
        savedAt: new Date().toISOString(),
        source,
        postVersion: null,
      })

      expect(keyScanCount).toBe(0)
    } finally {
      if (prevWindow) {
        Object.defineProperty(globalThis, "window", prevWindow)
      } else {
        delete (globalThis as Record<string, unknown>).window
      }
    }
  })

  test("AC-5: countCodePoints, countWords, H1-H4 insights, and resolveActiveOutlineItemIndex", () => {
    const sample = "한글 😀 text\n\twith   multiple\nspaces"
    expect(countCodePoints(sample)).toBe(Array.from(sample).length)
    expect(countWords(sample)).toBe(sample.trim().split(/\s+/u).length)
    expect(countWords("   \n\t  ")).toBe(0)

    const insights = createMarkdownDocumentInsights("# H1 Heading\n## H2 Heading\n### H3 Heading")
    expect(insights.headings.map((h) => ({ level: h.level, label: h.label }))).toEqual([
      { level: 1, label: "H1 Heading" },
      { level: 2, label: "H2 Heading" },
      { level: 3, label: "H3 Heading" },
    ])

    const outlineItems = [
      { id: "title", range: null },
      ...insights.headings.map((h) => ({ id: h.slug, range: h.range })),
    ]
    expect(resolveActiveOutlineItemIndex(outlineItems, null)).toBe(0)
    expect(resolveActiveOutlineItemIndex(outlineItems, 2)).toBe(1)
    expect(resolveActiveOutlineItemIndex(outlineItems, 15)).toBe(2)
    expect(resolveActiveOutlineItemIndex(outlineItems, 30)).toBe(3)
  })

  test("AC-5 & AC-6: matchSlashCommandTrigger and resolveSlashCommandMutation fix /table and /code-block", () => {
    expect(matchSlashCommandTrigger("/tab", { from: 4, to: 4 })).toEqual({
      query: "tab",
      slashFrom: 0,
    })
    expect(matchSlashCommandTrigger("https://example.com/path", { from: 24, to: 24 })).toBeNull()
    expect(
      matchSlashCommandTrigger("```ts\n/table\n```", { from: 12, to: 12 })
    ).toBeNull()

    const tableMutation = resolveSlashCommandMutation(
      { id: "table", snippet: "__TABLE__" },
      0,
      6
    )
    expect(tableMutation.replacement).not.toContain("[object Object]")
    expect(tableMutation.replacement).toContain("|  |  |")
    expect(tableMutation.selectionStart).toBe(3)
    expect(tableMutation.selectionEnd).toBe(3)

    const codeMutation = resolveSlashCommandMutation(
      { id: "code-block", snippet: "```ts\n\n```" },
      10,
      15
    )
    expect(codeMutation.selectionStart).toBe(16)
    expect(codeMutation.selectionEnd).toBe(16)
  })

  test("AC-6: planMarkdownEditorTableCellNavigation supports next/prev and adds a row at table end", () => {
    const table = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")
    const firstCellOffset = table.indexOf("A")
    const secondCellOffset = table.indexOf("B")
    const lastCellOffset = table.indexOf("2")

    const toSecond = planMarkdownEditorTableCellNavigation(
      table,
      firstCellOffset,
      firstCellOffset,
      "next"
    )
    expect(toSecond?.selectionStart).toBe(secondCellOffset)

    const backToFirst = planMarkdownEditorTableCellNavigation(
      table,
      secondCellOffset,
      secondCellOffset,
      "prev"
    )
    expect(backToFirst?.selectionStart).toBe(firstCellOffset)

    const addRowAtEnd = planMarkdownEditorTableCellNavigation(
      table,
      lastCellOffset,
      lastCellOffset,
      "next"
    )
    expect(addRowAtEnd?.replacement.split("\n")).toHaveLength(4)
  })

  test("AC-6: computeMarkdownFoldRange folds ATX headings and fenced code blocks", () => {
    const doc = [
      "# Section 1",
      "Body 1",
      "## Subsection 1.1",
      "Sub body",
      "# Section 2",
      "```ts",
      "const a = 1;",
      "const b = 2;",
      "```",
    ].join("\n")

    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage })],
    })

    const line1 = state.doc.line(1)
    const foldSection1 = computeMarkdownFoldRange(state, line1.from, line1.to)
    expect(foldSection1).toEqual({
      from: line1.to,
      to: state.doc.line(4).to,
    })

    const fenceLine = state.doc.line(6)
    const foldFence = computeMarkdownFoldRange(state, fenceLine.from, fenceLine.to)
    expect(foldFence).toEqual({
      from: fenceLine.to,
      to: state.doc.line(9).to,
    })
  })

  test("AC-6: planLinkifySelectionWithUrl replaces URL on existing markdown links without double-wrapping", () => {
    const existingLink = "[Aquila Docs](https://old.example.com/docs)"
    const mutation = planLinkifySelectionWithUrl(
      0,
      existingLink.length,
      existingLink,
      "https://new.example.com/guide"
    )
    expect(mutation.replacement).toBe("[Aquila Docs](https://new.example.com/guide)")
  })
})
