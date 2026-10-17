import { expect, test } from "@playwright/test"
import { EditorSelection, EditorState } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { createMermaidRuntimeController } from "../../src/libs/markdown/mermaidRuntimeRender"
import { shouldScheduleMermaidResize } from "../../src/libs/markdown/hooks/useMermaidEffect"
import { createPrismEffectRuntime } from "../../src/libs/markdown/prismEffectRuntime"
import {
  applyInlineColors,
  shouldScheduleFromInlineColorMutations,
} from "../../src/libs/markdown/hooks/useInlineColorEffect"
import { shouldScheduleFromTableMutations } from "../../src/libs/markdown/hooks/useResponsiveTableEffect"
import { resolveMarkdownRenderModel } from "../../src/libs/markdown/rendering"
import { createDocumentFootnoteModel } from "../../src/libs/markdown/renderingFootnoteModel"
import { createMarkdownComponentVariants } from "../../src/libs/markdown/MarkdownRenderer"
import PostHeader from "../../src/routes/Detail/PostDetail/PostHeader"
import PostDetailMobileToc from "../../src/routes/Detail/PostDetail/PostDetailMobileToc"
import {
  FloatingActionRail,
  MobileSummaryActions,
  RightTocRail,
} from "../../src/routes/Detail/PostDetail/PostDetailActionSections"
import { applyHybridRail } from "../../src/routes/Detail/PostDetail/PostDetailRailModel"
import {
  buildDecorations,
  compositionField,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
  setComposition,
  setDisableMermaid,
} from "../../src/components/markdown-editor/MarkdownEditorLiveSurface"
import { MarkdownMermaidWidget } from "../../src/components/markdown-editor/markdownEditorWidgets"
import {
  MAX_EDIT_COLUMNS,
  MAX_EDIT_ROWS,
  createMarkdownEditorTable,
  getMarkdownEditorTableEditAvailability,
  planMarkdownEditorTableEdit,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { resolveFormatShortcut } from "../../src/components/markdown-editor/markdownEditorKeyboardModel"
import {
  INLINE_CODE_SHORTCUT,
  VIEW_MODE_CYCLE_SHORTCUT,
  getMarkdownEditorCommand,
  validateMarkdownEditorCommands,
} from "../../src/components/markdown-editor/markdownEditorCommandRegistryModel"

test.describe("Issue #255 Track 1 + Track 2 verification", () => {
  test("AC1: Mermaid controller reuses queue/observer across runs, prevents duplicate in-flight renders, and batches layout reads before writes", async () => {
    const events: string[] = []
    const makeBlock = (id: string, initialSource: string) => {
      let currentSource = initialSource
      const code = {
        className: "language-mermaid",
        get textContent() {
          return currentSource
        },
        getAttribute: (name: string) => (name === "data-language" ? "mermaid" : null),
      } as unknown as HTMLElement
      let innerHTMLValue = `<code class="language-mermaid">${initialSource}</code>`
      const block = {
        isConnected: true,
        className: "aq-mermaid",
        dataset: { aqMermaid: "true", mermaidRendered: "pending" } as DOMStringMap,
        style: {
          minHeight: "",
          overflowX: "",
          setProperty: () => {},
        },
        get textContent() {
          return currentSource
        },
        getAttribute: (name: string) => (name === "data-mermaid-source" ? currentSource : null),
        setSource: (next: string) => {
          currentSource = next
        },
        closest: () => null,
        querySelector: () => code,
        querySelectorAll: () => [],
        appendChild: () => {
          events.push(`write:${id}`)
        },
        getBoundingClientRect: () => {
          events.push(`read:${id}`)
          return { width: 640, height: 180, left: 40, right: 680, top: 0, bottom: 180 } as DOMRect
        },
      } as unknown as HTMLElement & { setSource: (next: string) => void }
      Object.defineProperty(block, "innerHTML", {
        get: () => innerHTMLValue,
        set: (next: string) => {
          innerHTMLValue = next
        },
      })
      return block
    }

    const block1 = makeBlock("b1", "flowchart TD\nA1-->B1")
    const block2 = makeBlock("b2", "flowchart TD\nA2-->B2")
    const root = {
      querySelectorAll: (selector: string) => {
        if (selector.includes("code")) return []
        return [block1, block2]
      },
    } as unknown as HTMLElement

    const origWin = (globalThis as Record<string, unknown>).window
    const origDoc = (globalThis as Record<string, unknown>).document
    let renderCalls = 0
    try {
      ;(globalThis as Record<string, unknown>).window = {
        matchMedia: () => ({ matches: false }),
        innerHeight: 900,
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
      }
      ;(globalThis as Record<string, unknown>).document = {
        createElement: () => {
          const svg = {
            getAttribute: (attr: string) => (attr === "viewBox" ? "0 0 400 200" : null),
            setAttribute: () => {},
            removeAttribute: () => {},
            querySelectorAll: () => [],
            style: {},
          }
          return {
            className: "",
            style: { setProperty: () => {} },
            innerHTML: "",
            querySelector: (sel: string) => (sel === "svg" ? svg : null),
            addEventListener: () => {},
          }
        },
      }

      const controller = createMermaidRuntimeController({
        root,
        preset: { mode: "github", themeKey: "test-light-255", config: {} },
        allowDesktopWideLane: false,
        lazyViewport: false,
        shouldLogMermaidWarnings: false,
        getMermaid: async () => ({
          initialize: () => {},
          render: async (_id, src) => {
            renderCalls += 1
            await new Promise((r) => setTimeout(r, 15))
            return { svg: `<svg viewBox="0 0 400 200"><text>${src}</text></svg>` }
          },
        }),
        isDisposed: () => false,
        retryTimers: new Set(),
        readParseWarning: () => null,
        clearParseWarning: () => {},
      })

      await Promise.all([controller.renderMermaidBlocks(), controller.renderMermaidBlocks()])

      expect(renderCalls).toBe(2)
      const firstWriteIndex = events.findIndex((e) => e.startsWith("write:"))
      const readIndices = events
        .map((e, idx) => (e.startsWith("read:") ? idx : -1))
        .filter((idx) => idx !== -1)
      expect(readIndices.length).toBeGreaterThanOrEqual(2)
      for (const readIdx of readIndices) {
        expect(readIdx).toBeLessThan(firstWriteIndex)
      }

      // In-place data-mermaid-source update on an already-rendered block triggers re-render
      block1.setSource("flowchart TD\nA1-->C1")
      await controller.renderMermaidBlocks()
      expect(renderCalls).toBe(3)
      expect(block1.dataset.mermaidRenderedSource).toBe("flowchart TD\nA1-->C1")
    } finally {
      ;(globalThis as Record<string, unknown>).window = origWin
      ;(globalThis as Record<string, unknown>).document = origDoc
    }

    expect(shouldScheduleMermaidResize(720, 720)).toBe(false)
    expect(shouldScheduleMermaidResize(720, 721)).toBe(false)
    expect(shouldScheduleMermaidResize(720, 722)).toBe(true)
  })

  test("AC2: hasCodeBlockMissingLineWrappers ignores Mermaid code blocks", () => {
    const mermaidBlock = {
      classList: { contains: (cls: string) => cls === "language-mermaid" },
      getAttribute: () => "mermaid",
      closest: () => ({}),
      querySelector: () => null,
    } as unknown as HTMLElement

    const rootOnlyMermaid = {
      querySelectorAll: () => [mermaidBlock],
    } as unknown as HTMLElement

    const runtimeMermaidOnly = createPrismEffectRuntime({
      root: rootOnlyMermaid,
      isDisposed: () => false,
    })
    expect(runtimeMermaidOnly.hasCodeBlockMissingLineWrappers()).toBe(false)

    const tsBlock = {
      classList: { contains: () => false },
      getAttribute: () => "ts",
      closest: () => null,
      querySelector: () => null,
    } as unknown as HTMLElement
    const rootWithTs = {
      querySelectorAll: () => [mermaidBlock, tsBlock],
    } as unknown as HTMLElement
    const runtimeWithTs = createPrismEffectRuntime({
      root: rootWithTs,
      isDisposed: () => false,
    })
    expect(runtimeWithTs.hasCodeBlockMissingLineWrappers()).toBe(true)
  })

  test("AC3: Viewer DOM observer filtering, unused contentHtml skip, footnote parse dedup, and MarkdownRenderer memoization", () => {
    let walkerCalled = false
    const origDoc = (globalThis as Record<string, unknown>).document
    try {
      ;(globalThis as Record<string, unknown>).document = {
        createTreeWalker: () => {
          walkerCalled = true
          return { nextNode: () => false }
        },
      }
      applyInlineColors({ textContent: "일반 텍스트만 있는 본문" } as unknown as HTMLElement)
      expect(walkerCalled).toBe(false)
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }

    expect(
      shouldScheduleFromInlineColorMutations([
        {
          type: "childList",
          target: { textContent: "{{color:red|기존}}" } as unknown as Node,
          addedNodes: [{ textContent: "새 일반 문단" }] as unknown as NodeList,
        } as MutationRecord,
      ])
    ).toBe(false)
    expect(
      shouldScheduleFromInlineColorMutations([
        {
          type: "childList",
          target: {} as Node,
          addedNodes: [{ textContent: "강조 {{color:blue|파랑}}" }] as unknown as NodeList,
        } as MutationRecord,
      ])
    ).toBe(true)

    const nonTableNode = {
      nodeType: 1,
      matches: () => false,
      closest: () => null,
      querySelector: () => null,
    } as unknown as Element
    const tableNode = {
      nodeType: 1,
      matches: (sel: string) => sel.includes("table"),
      closest: () => null,
      querySelector: () => null,
    } as unknown as Element

    expect(
      shouldScheduleFromTableMutations([
        {
          type: "childList",
          target: nonTableNode,
          addedNodes: [nonTableNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        } as unknown as MutationRecord,
      ])
    ).toBe(false)
    expect(
      shouldScheduleFromTableMutations([
        {
          type: "childList",
          target: nonTableNode,
          addedNodes: [tableNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        } as unknown as MutationRecord,
      ])
    ).toBe(true)

    let htmlAccessed = false
    const model = resolveMarkdownRenderModel({
      content: "# 본문 제목\n\n내용",
      trustedContentHtml: {
        kind: "trusted-content-html",
        get html() {
          htmlAccessed = true
          return "<p>unused</p>"
        },
      },
    })
    expect(model.resolvedContentHtml).toBe("")
    expect(htmlAccessed).toBe(false)

    let nonFootnoteContentReads = 0
    const plainSegment = {
      type: "markdown" as const,
      get content() {
        nonFootnoteContentReads += 1
        return "일반 문단입니다."
      },
    }
    const fnModel = createDocumentFootnoteModel({
      source:
        "일반 문단입니다.\n\n[ext]: https://example.com/doc\n\n각주 참조[^1]\n\n[^1]: 각주 [설명][ext]",
      segments: [
        plainSegment,
        { type: "markdown", content: "[ext]: https://example.com/doc" },
        { type: "markdown", content: "각주 참조[^1]\n\n[^1]: 각주 [설명][ext]" },
      ],
    })
    expect(fnModel.footnotes).toHaveLength(1)
    expect(fnModel.footnotes[0]?.content).toContain("https://example.com/doc")
    expect(nonFootnoteContentReads).toBeLessThanOrEqual(3)

    const variants = createMarkdownComponentVariants({
      footnotes: [],
      footnoteMarker: "marker",
      tableLayouts: [],
      tableRenderIndexRef: { current: 0 },
      imageRenderOrderRef: { current: 0 },
    })
    expect(variants.getComponents(false, false)).toBe(variants.getComponents(false, false))
    expect(variants.getComponents(true, false)).toBe(variants.getComponents(true, false))
  })

  test("AC4: PostDetail subcomponents are wrapped in React.memo and applyHybridRail accepts cached topOffset", () => {
    const memoSymbol = Symbol.for("react.memo")
    expect((PostHeader as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol)
    expect((FloatingActionRail as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol)
    expect((MobileSummaryActions as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol)
    expect((PostDetailMobileToc as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol)
    expect((RightTocRail as unknown as { $$typeof?: symbol }).$$typeof).toBe(memoSymbol)

    const origWin = (globalThis as Record<string, unknown>).window
    let computedStyleCalls = 0
    try {
      ;(globalThis as Record<string, unknown>).window = {
        scrollY: 300,
        getComputedStyle: () => {
          computedStyleCalls += 1
          return { getPropertyValue: () => "65" }
        },
      }
      const dummyInner = {
        style: { position: "", top: "", left: "", width: "", bottom: "", transform: "" },
      } as unknown as HTMLElement
      applyHybridRail(
        dummyInner,
        {
          enabled: true,
          stickyBlocked: true,
          left: 24,
          width: 180,
          railTopDoc: 200,
          articleBottomDoc: 1600,
          innerHeight: 240,
        },
        85
      )
      expect(computedStyleCalls).toBe(0)
      expect(dummyInner.style.position).toBe("fixed")
      expect(dummyInner.style.top).toBe("85px")
    } finally {
      ;(globalThis as Record<string, unknown>).window = origWin
    }
  })

  test("AC5: Live Preview preserves non-overlapping decorations during IME composition and renders inactive Mermaid blocks via MarkdownMermaidWidget", async () => {
    const doc = [
      "# 문서 제목",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
      "",
      "한글 입력 중인 **강조** $x+1$ 문단입니다.",
    ].join("\n")

    const activeLinePos = doc.indexOf("한글 입력 중인") + 2
    let state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(activeLinePos),
      extensions: [
        markdown({ extensions: GFM }),
        compositionField,
        pointerSelectingField,
        editorModeField,
        disableMermaidField,
      ],
    })
    state = state.update({ effects: setComposition.of(true) }).state

    const decoSet = buildDecorations(state)
    const collected: Array<{ from: number; to: number; value: unknown }> = []
    decoSet.between(0, state.doc.length, (from, to, value) => {
      collected.push({ from, to, value })
    })

    // Non-overlapping lines (heading, table, mermaid) must retain decorations during IME composition
    expect(collected.length).toBeGreaterThan(0)
    const activeLine = state.doc.lineAt(activeLinePos)
    const overlappingActiveLine = collected.filter(
      (d) => d.from <= activeLine.to && d.to >= activeLine.from
    )
    expect(overlappingActiveLine).toHaveLength(0)

    const mermaidStart = doc.indexOf("```mermaid")
    const mermaidDeco = collected.find((d) => d.from === mermaidStart)
    expect(mermaidDeco).toBeDefined()
    const widget = (mermaidDeco?.value as { spec?: { widget?: unknown } })?.spec?.widget
    expect(widget).toBeInstanceOf(MarkdownMermaidWidget)

    // When disableMermaid is true, MarkdownMermaidWidget is not used
    const disabledMermaidState = state.update({ effects: setDisableMermaid.of(true) }).state
    const disabledDecoSet = buildDecorations(disabledMermaidState)
    let hasMermaidWidgetWhenDisabled = false
    disabledDecoSet.between(0, disabledMermaidState.doc.length, (_from, _to, value) => {
      if ((value as { spec?: { widget?: unknown } })?.spec?.widget instanceof MarkdownMermaidWidget) {
        hasMermaidWidgetWhenDisabled = true
      }
    })
    expect(hasMermaidWidgetWhenDisabled).toBe(false)

    // Verify MarkdownMermaidWidget.toDOM async SVG rendering and error fallback
    const origDoc = (globalThis as Record<string, unknown>).document
    try {
      const makeElem = (tag: string): Record<string, unknown> => {
        const children: Array<Record<string, unknown>> = []
        const dataset: Record<string, string> = {}
        let html = ""
        const elem: Record<string, unknown> = {
          tagName: tag.toUpperCase(),
          className: "",
          textContent: "",
          get innerHTML() {
            return html
          },
          set innerHTML(val: string) {
            html = val
            if (val === "") {
              children.length = 0
            }
          },
          dataset,
          children,
          appendChild: (child: Record<string, unknown>) => {
            children.push(child)
            return child
          },
          addEventListener: () => {},
        }
        return elem
      }
      ;(globalThis as Record<string, unknown>).document = {
        createElement: (tag: string) => makeElem(tag),
      }

      const validWidget = new MarkdownMermaidWidget(
        "flowchart TD\n  A --> B",
        0,
        async (_id, src) => ({ svg: `<svg data-test="ok">${src}</svg>` })
      )
      const validDom = validWidget.toDOM() as unknown as {
        dataset: Record<string, string>
        innerHTML: string
      }
      await new Promise((r) => setTimeout(r, 10))
      expect(validDom.dataset.mermaidState).toBe("rendered")
      expect(validDom.innerHTML).toContain('<svg data-test="ok">')

      const errorWidget = new MarkdownMermaidWidget(
        "invalid mermaid syntax",
        0,
        async () => {
          throw new Error("Syntax error in graph")
        }
      )
      const errorDom = errorWidget.toDOM() as unknown as {
        dataset: Record<string, string>
        children: Array<{ className: string; textContent: string }>
      }
      await new Promise((r) => setTimeout(r, 10))
      expect(errorDom.dataset.mermaidState).toBe("error")
      expect(errorDom.children[0]?.className).toBe("cm-live-mermaid-error")
      expect(errorDom.children[1]?.className).toBe("cm-live-mermaid-fallback")
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }
  })

  test("AC6: Table editing supports up to 200x32 while creation stays 6x6, single-lookup availability works, and inlineCode uses Mod+Shift+C", () => {
    expect(createMarkdownEditorTable(6, 6)).not.toBeNull()
    expect(createMarkdownEditorTable(7, 2)).toBeNull()
    expect(MAX_EDIT_ROWS).toBe(200)
    expect(MAX_EDIT_COLUMNS).toBe(32)

    const tenCols = Array.from({ length: 10 }, (_, i) => `C${i + 1}`)
    const header = `| ${tenCols.join(" | ")} |`
    const delim = `| ${tenCols.map(() => "---").join(" | ")} |`
    const bodyRows = Array.from(
      { length: 12 },
      (_, r) => `| ${tenCols.map((c) => `R${r + 1}${c}`).join(" | ")} |`
    )
    const largeTableDoc = ["# 서문", "", header, delim, ...bodyRows, "", "후문"].join("\n")
    const cursorInLargeTable = largeTableDoc.indexOf("R6C3") + 1

    const availability = getMarkdownEditorTableEditAvailability(
      largeTableDoc,
      cursorInLargeTable,
      cursorInLargeTable
    )
    expect(availability).toEqual({
      addRow: true,
      deleteRow: true,
      addColumn: true,
      deleteColumn: true,
      alignLeft: true,
      alignCenter: true,
      alignRight: true,
    })

    const editPlan = planMarkdownEditorTableEdit(
      largeTableDoc,
      cursorInLargeTable,
      cursorInLargeTable,
      { kind: "add-row" }
    )
    expect(editPlan).not.toBeNull()

    expect(INLINE_CODE_SHORTCUT).toBe("Mod+Shift+C")
    expect(VIEW_MODE_CYCLE_SHORTCUT).toBe("Mod+E")
    expect(
      resolveFormatShortcut({ key: "e", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })
    ).toBeNull()
    expect(
      resolveFormatShortcut({ key: "c", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })
    ).toBe("inlineCode")
    expect(() =>
      validateMarkdownEditorCommands([
        {
          ...getMarkdownEditorCommand("block.code")!,
          shortcut: "Mod+E" as unknown as "Mod+B",
        },
      ])
    ).toThrow(/reserved/i)
  })
})
