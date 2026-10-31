import { expect, test } from "@playwright/test"
import { readFileSync } from "fs"
import path from "path"
import React, { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import { createTheme } from "../../src/styles/theme"
import { ApiError, ApiTimeoutError } from "../../src/apis/backend/client"
import { resetSharedMermaidRuntimeForTests } from "../../src/libs/markdown/mermaidRuntimeConfig"
import { MarkdownEditorToolbar } from "../../src/components/markdown-editor/MarkdownEditorToolbar"
import { projectMarkdownEditorToolbarCommands } from "../../src/components/markdown-editor/markdownEditorCommandRegistryModel"
import { buildMarkdownLivePreviewDecorationSpecs } from "../../src/components/markdown-editor/markdownEditorLivePreview"
import {
  buildDecorations,
  collectMathReplacementSpecs,
  compositionField,
  decorationField,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
  setComposition,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import { activeEmptyLineField } from "../../src/components/markdown-editor/markdownEditorNotionModel"
import {
  MarkdownBookmarkBlockWidget,
  notionContainerBlockField,
  parseNotionContainerBlocks,
} from "../../src/components/markdown-editor/markdownEditorNotionWidgets"
import {
  handleFenceEnter,
  handleFenceShiftEnter,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceCommands"
import { MarkdownTableWidget } from "../../src/components/markdown-editor/markdownEditorTableWidget"
import {
  MarkdownImageWidget,
  MarkdownMermaidWidget,
  MarkdownTaskWidget,
} from "../../src/components/markdown-editor/markdownEditorWidgets"
import { matchSlashCommandTrigger } from "../../src/components/markdown-editor/useMarkdownEditorSlashMenu"
import {
  MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
  MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
  resolveMarkdownAttachmentLink,
  resolveMarkdownImageEmbed,
} from "../../src/components/markdown-editor/markdownEditorUploadModel"
import {
  appendInlineMarkdownNodes,
  isSafeInlineHref,
} from "../../src/components/markdown-editor/markdownEditorInlineDom"
import { resolveMarkdownEditorUploadErrorMessage } from "../../src/components/markdown-editor/markdownEditorMediaTransferModel"
import {
  hasAlphaTransparency,
  resolveTransferOutputMimeTypes,
} from "../../src/libs/profileImageUpload"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import { SimpleDomElement, withMockDom } from "./helpers/simpleMockDom"

const lightTheme = createTheme({ scheme: "light" })
const srcFile = (...parts: string[]) => readFileSync(path.resolve(__dirname, "../../src", ...parts), "utf8")

const renderToolbarHtml = (viewMode: "live" | "source" | "reading", disabled = false) =>
  renderToStaticMarkup(
    materializePlaywrightJsx(
      React.createElement(ThemeProvider, {
        theme: lightTheme,
        children: React.createElement(MarkdownEditorToolbar, {
          disabled, disableMermaid: false, viewMode, tableRows: 2, tableColumns: 2,
          commandContext: {
            disabled: disabled || viewMode === "reading",
            selectionStart: 0, selectionEnd: 0, isTableSelection: false,
          },
          toolbarCommands: projectMarkdownEditorToolbarCommands(),
          imageInputRef: createRef<HTMLInputElement>(),
          fileInputRef: createRef<HTMLInputElement>(),
          hasUploadImage: true, hasUploadFile: true,
          onTableRowsChange: () => {}, onTableColumnsChange: () => {},
          onRememberSelection: () => {}, onApplyCommand: () => {},
          onApplySnippet: () => {}, onApplyFormatShortcut: () => {},
          onApplyListCommand: () => {}, onApplyLineCommand: () => {},
          onApplyBlockSnippet: () => {}, onInsertTable: () => {},
          onApplyTableEdit: () => {}, isTableEditDisabled: () => true,
          onOpenFindReplace: () => {}, onImageFileSelect: () => {},
          onAttachmentFileSelect: () => {}, onViewModeChange: () => {},
        }),
      })
    ) as React.ReactElement
  )

const createDecorationEditorState = (doc: string, cursorPos: number, mode: "live" | "source" | "reading") =>
  EditorState.create({
    doc,
    selection: EditorSelection.cursor(Math.min(cursorPos, doc.length)),
    extensions: [
      markdown({ extensions: GFM }), compositionField, pointerSelectingField,
      editorModeField.init(() => mode), disableMermaidField.init(() => false),
      decorationField, notionContainerBlockField, activeEmptyLineField,
      EditorState.readOnly.of(mode === "reading"), EditorView.editable.of(mode !== "reading"),
    ],
  })

test.describe("Wave-6 Unit 2 live MarkdownEditor surface", () => {
  test("reading mode disables formatting toolbar actions while keeping mode toggles enabled and suppresses active-line raw syntax", () => {
    const readingToolbar = renderToolbarHtml("reading", false)
    expect(readingToolbar).toMatch(/aria-label="굵게[^"]*"[^>]*disabled=""/)
    expect(readingToolbar).toMatch(/aria-label="링크[^"]*"[^>]*disabled=""/)
    expect(readingToolbar).toMatch(/aria-label="제목 메뉴"[^>]*disabled=""/)
    expect(readingToolbar).toMatch(/aria-label="삽입 메뉴"[^>]*disabled=""/)
    expect(readingToolbar).toMatch(/aria-label="더보기 메뉴"[^>]*disabled=""/)
    expect(readingToolbar).not.toMatch(/aria-label="라이브 프리뷰"[^>]*disabled=""/)
    expect(readingToolbar).not.toMatch(/aria-label="소스 모드"[^>]*disabled=""/)
    expect(readingToolbar).not.toMatch(/aria-label="읽기 뷰"[^>]*disabled=""/)

    const doc = [
      "# Heading Title", "", "**Bold** and [Link](https://example.com) and $O(1)$ and [[Note|Alias]]",
      "", "- [x] Done item", "", "| A | B |", "| --- | --- |", "| 1 | 2 |",
    ].join("\n")

    const liveSpecsAtHeading = buildMarkdownLivePreviewDecorationSpecs(doc, [{ from: 2, to: 2 }], false, "live")
    const readingSpecsAtHeading = buildMarkdownLivePreviewDecorationSpecs(doc, [{ from: 2, to: 2 }], false, "reading")
    expect(liveSpecsAtHeading.some((d) => d.kind === "hide-mark" && d.from === 0)).toBe(false)
    expect(readingSpecsAtHeading.some((d) => d.kind === "hide-mark" && d.from === 0)).toBe(true)

    const tableCursor = doc.indexOf("| 1 |") + 2
    const readingState = createDecorationEditorState(doc, tableCursor, "reading")
    const readingDecos = buildDecorations(readingState)
    let hasTableWidgetAtCursorInReading = false
    readingDecos.between(0, doc.length, (_from, _to, value) => {
      if (value.spec.widget instanceof MarkdownTableWidget) hasTableWidgetAtCursorInReading = true
    })
    expect(hasTableWidgetAtCursorInReading).toBe(true)

    const emptyLineOffset = doc.indexOf("\n\n") + 1
    const readingEmptyState = createDecorationEditorState(doc, emptyLineOffset, "reading")
    const emptyFieldSet = readingEmptyState.field(activeEmptyLineField)
    let hasEmptySlashPlaceholder = false
    let hasCheckedTaskLine = false
    emptyFieldSet.between(0, doc.length, (_from, _to, value) => {
      const cls = String((value.spec as { class?: string }).class ?? "")
      if (cls.includes("cm-live-empty-line")) hasEmptySlashPlaceholder = true
      if (cls.includes("cm-live-task-checked-line")) hasCheckedTaskLine = true
    })
    expect(hasEmptySlashPlaceholder).toBe(false)
    expect(hasCheckedTaskLine).toBe(true)

    withMockDom(() => {
      let dispatched = false
      const mockView = {
        state: readingState,
        dispatch: () => { dispatched = true },
        posAtDOM: () => doc.indexOf("[x]"),
      } as unknown as EditorView
      const checkbox = new MarkdownTaskWidget(true, 0, 3).toDOM(mockView) as unknown as SimpleDomElement
      checkbox.dispatch("mousedown")
      expect(dispatched).toBe(false)

      const readingTableDom = new MarkdownTableWidget(
        "| A | B |\n| --- | --- |\n| 1 | 2 |", 0, 29
      ).toDOM(mockView) as unknown as SimpleDomElement
      readingTableDom.querySelector('[data-testid="cm-live-table-toggle-header-col"]')!.dispatch("click")
      expect(readingTableDom.getAttribute("data-header-col")).toBeNull()
      expect(dispatched).toBe(false)
    })
  })

  test("enforces Pandoc tex_math_dollars rules, nested inline wrappers, and literalRanges exclusion in collectMathReplacementSpecs", () => {
    const proseCurrency = "Prices are $10 and $20 or $10~20 and ($10) to ($20)."
    expect(collectMathReplacementSpecs(proseCurrency, -1, -1, false, [])).toEqual([])

    const shellAndUrl = 'Run echo "$HOME $PATH" and visit https://a.com/$x/$y now.'
    expect(
      collectMathReplacementSpecs(shellAndUrl, -1, -1, false, [
        { from: shellAndUrl.indexOf("echo"), to: shellAndUrl.indexOf(" and") },
      ])
    ).toEqual([])

    expect(collectMathReplacementSpecs("Escaped \\$x + y\\$ stays literal", -1, -1, false, [])).toEqual([])
    expect(collectMathReplacementSpecs("Wait $$ here\n\nAnd $$ there", -1, -1, false, [])).toEqual([])
    expect(collectMathReplacementSpecs("Triple $$$x$$$ dollars", -1, -1, false, [])).toEqual([])

    const validMath =
      "Inline time=$O(1)$, ($x^2$), the $n$th item, 한글 $a + b$이다, and\n$$\n\\sum_{i=1}^n i\n$$"
    const matches = collectMathReplacementSpecs(validMath, -1, -1, false, [])
    expect(matches.map((m) => ({ math: m.math.trim(), displayMode: m.displayMode }))).toEqual([
      { math: "O(1)", displayMode: false },
      { math: "x^2", displayMode: false },
      { math: "n", displayMode: false },
      { math: "a + b", displayMode: false },
      { math: "\\sum_{i=1}^n i", displayMode: true },
    ])

    expect(collectMathReplacementSpecs("$a \\\\$", -1, -1, false, []).map((m) => m.math)).toEqual(["a \\\\"])
    expect(collectMathReplacementSpecs("{{color:blue|$x^{2}$}}", -1, -1, false, []).map((m) => m.math)).toEqual(["x^{2}"])
    expect(collectMathReplacementSpecs("==$x^{2}$==", -1, -1, false, []).map((m) => m.math)).toEqual(["x^{2}"])
    const linkCurrency = "[label $5](https://example.com?q=$10)"
    expect(
      collectMathReplacementSpecs(linkCurrency, -1, -1, false, [
        { from: linkCurrency.indexOf("https://"), to: linkCurrency.length - 1 },
      ])
    ).toEqual([])
  })

  test("guards Korean IME 229, restricts slash trigger to line/block prefix, clamps visualViewport, and keeps Shift+Enter literal inside FencedCode", () => {
    expect(matchSlashCommandTrigger("/head", { from: 5, to: 5 })).toEqual({ query: "head", slashFrom: 0 })
    expect(matchSlashCommandTrigger("  > - [ ] /todo", { from: 15, to: 15 })).toEqual({ query: "todo", slashFrom: 10 })
    expect(matchSlashCommandTrigger("요청 / 응답", { from: 4, to: 4 })).toBeNull()
    expect(matchSlashCommandTrigger("https://example.com/docs", { from: 24, to: 24 })).toBeNull()

    const slashMenuSource = srcFile("components", "markdown-editor", "MarkdownEditorSlashMenu.tsx")
    expect(slashMenuSource).toMatch(/isComposing[\s\S]*229/)
    expect(slashMenuSource + srcFile("components", "markdown-editor", "useMarkdownEditorSlashMenu.ts")).toContain("visualViewport")

    const fencedDoc = "```ts\nconst a = 1\n```"
    const fenceState = EditorState.create({
      doc: fencedDoc,
      selection: EditorSelection.cursor(fencedDoc.indexOf("1") + 1),
      extensions: [markdown({ extensions: GFM }), compositionField],
    })
    const composingState = fenceState.update({ effects: setComposition.of(true) }).state
    let fenceDispatched = false
    const mockFenceView = {
      state: composingState, composing: true, dispatch: () => { fenceDispatched = true },
    } as unknown as EditorView
    expect(handleFenceEnter.run?.(mockFenceView)).toBe(false)
    expect(fenceDispatched).toBe(false)

    const multiLineComposeDoc = ["# Heading", "", "Paragraph", "", "- [x] Done"].join("\n")
    const paragraphPos = multiLineComposeDoc.indexOf("Paragraph")
    const composeSurfaceState = createDecorationEditorState(
      multiLineComposeDoc, paragraphPos, "live"
    ).update({ effects: setComposition.of(true) }).state
    const composeSurfaceDecos = buildDecorations(composeSurfaceState)
    let hidesInactiveHeadingMark = false
    let decoratesComposingLine = false
    composeSurfaceDecos.between(0, multiLineComposeDoc.length, (from, to) => {
      if (from === 0 && to === 2) hidesInactiveHeadingMark = true
      if (from >= paragraphPos && to <= paragraphPos + "Paragraph".length) decoratesComposingLine = true
    })
    expect(hidesInactiveHeadingMark).toBe(true)
    expect(decoratesComposingLine).toBe(false)

    let shiftEnterInsert = ""
    const mockShiftEnterView = {
      state: fenceState, composing: false,
      dispatch: (spec: { changes?: { insert?: string } }) => { shiftEnterInsert = spec.changes?.insert ?? "" },
    } as unknown as EditorView
    expect(handleFenceShiftEnter.run?.(mockShiftEnterView)).toBe(true)
    expect(shiftEnterInsert).toBe("\n")

    expect(srcFile("components", "markdown-editor", "useMarkdownEditorTextareaKeyboard.ts")).toContain("isOffsetInsideFencedCodeBlock")

    withMockDom(() => {
      const tableDoc = "| A | B |\n| --- | --- |\n| 1 | 2 |"
      const mockView = {
        state: { doc: { length: tableDoc.length, lineAt: () => ({ length: 1 }) }, selection: { main: { from: 0, to: 0 } }, facet: () => true },
        posAtDOM: () => 0, focus: () => {}, dispatch: () => {},
      } as unknown as EditorView
      const dom = new MarkdownTableWidget(tableDoc, 0, tableDoc.length).toDOM(mockView) as unknown as SimpleDomElement
      dom.querySelector('[data-testid="cm-live-table-col-handle"]')!.dispatch("click")
      expect(dom.querySelector('[data-testid="cm-live-table-cell-input"]')).toBeNull()
      dom.dispatch("compositionstart")
      expect(dom.querySelector('[data-testid="cm-live-table-cell-input"]')).not.toBeNull()
    })
  })

  test("hardens media transfers, widget sanitization, scheme-aware serialized Mermaid runtime, and Notion bookmark URLs", async () => {
    expect(
      resolveMarkdownImageEmbed(
        { url: "https://blog.aquilaxk.site/post/api/v1/images/posts/chart.png", alt: "Diagram [v1]" },
        "chart[1].png",
        { publicApiOrigin: "https://blog.aquilaxk.site" }
      )
    ).toEqual({
      markdown: "\n\n![Diagram \\[v1\\]](https://blog.aquilaxk.site/post/api/v1/images/posts/chart.png)\n",
    })
    expect(
      resolveMarkdownAttachmentLink(
        { url: "https://cdn.example.test/files/spec.pdf", name: "Spec [Draft].pdf" },
        "spec.pdf"
      )
    ).toEqual({
      markdown: "\n\n[Spec \\[Draft\\].pdf](https://cdn.example.test/files/spec.pdf)\n",
    })

    expect(
      resolveMarkdownEditorUploadErrorMessage(
        new ApiError(413, "/post/api/v1/posts/images", JSON.stringify({ msg: "이미지 용량이 8MB를 초과했습니다." })),
        { kind: "image", fileName: "big.png", fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE }
      )
    ).toContain("용량")
    expect(
      resolveMarkdownEditorUploadErrorMessage(new ApiTimeoutError("/post/api/v1/posts/files", 12000), {
        kind: "file", fileName: "doc.pdf", fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
      })
    ).toContain("지연")
    expect(
      resolveMarkdownEditorUploadErrorMessage(new Error("지원하지 않는 이미지 형식입니다."), {
        kind: "image", fileName: "bad.bmp", fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
      })
    ).toContain("지원하지 않는 이미지 형식입니다.")
    expect(
      resolveMarkdownEditorUploadErrorMessage(new ApiError(500, "/post/api/v1/posts/files", "failed"), {
        kind: "file", fileName: "failed.txt", fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
      })
    ).toBe(MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE)

    expect(hasAlphaTransparency(new Uint8ClampedArray([255, 255, 255, 255, 10, 20, 30, 255]))).toBe(false)
    expect(hasAlphaTransparency(new Uint8ClampedArray([255, 255, 255, 255, 10, 20, 30, 128]))).toBe(true)
    expect(
      resolveTransferOutputMimeTypes(["image/webp", "image/jpeg", "image/png"], {
        sourceMimeType: "image/png", hasTransparency: true,
      })
    ).toEqual(["image/webp", "image/png"])
    expect(
      resolveTransferOutputMimeTypes(["image/webp", "image/jpeg"], {
        sourceMimeType: "image/png", hasTransparency: true,
      })
    ).toEqual(["image/webp", "image/png"])
    expect(
      resolveTransferOutputMimeTypes(["image/webp", "image/jpeg", "image/png"], {
        sourceMimeType: "image/png", hasTransparency: false,
      })
    ).toEqual(["image/webp", "image/jpeg", "image/png"])

    expect(parseNotionContainerBlocks(":::bookmark https://user:pass@example.com\n:::")).toEqual([])
    expect(parseNotionContainerBlocks(":::bookmark https://exa\u0007mple.com\n:::")).toEqual([])
    const validBookmarkBlocks = parseNotionContainerBlocks(":::bookmark https://example.com/docs Docs\nGuide\n:::")
    expect(validBookmarkBlocks).toHaveLength(1)
    expect(validBookmarkBlocks[0]).toMatchObject({ kind: "bookmark", url: "https://example.com/docs", title: "Docs" })

    resetSharedMermaidRuntimeForTests()
    await withMockDom(async (_winListeners, docElement) => {
      const unsafeImgDom = new MarkdownImageWidget("javascript:alert(1)", "bad").toDOM() as unknown as SimpleDomElement
      expect(unsafeImgDom.querySelector("img")?.src ?? "").toBe("")

      const safeImgDom = new MarkdownImageWidget("/post/api/v1/images/posts/ok.png", "ok").toDOM() as unknown as SimpleDomElement
      expect(safeImgDom.querySelector("img")?.src).toBe("/post/api/v1/images/posts/ok.png")

      const safeBookmarkDom = new MarkdownBookmarkBlockWidget("https://example.com/docs", "Docs", "Desc", 0, 24).toDOM() as unknown as SimpleDomElement
      expect(safeBookmarkDom.querySelector("a")?.getAttribute("href")).toBe("https://example.com/docs")
      const unsafeBookmarkDom = new MarkdownBookmarkBlockWidget("https://user:pass@example.com/docs", "Bad", "", 0, 24).toDOM() as unknown as SimpleDomElement
      expect(unsafeBookmarkDom.querySelector("a")).toBeNull()

      let renderedMermaidText = ""
      const mermaidWidget = new MarkdownMermaidWidget(
        "%%{init: {'themeCSS': 'body { display:none }'}}%%\nflowchart TD\n  A --> B\n  classDef bad fill:#000",
        0,
        async (_id, text) => {
          renderedMermaidText = text
          return { svg: "<svg></svg>" }
        }
      )
      mermaidWidget.toDOM()
      await Promise.resolve()
      expect(renderedMermaidText).not.toContain("themeCSS")
      expect(renderedMermaidText).not.toContain("classDef")
      expect(renderedMermaidText).toContain("flowchart TD")

      const initializedDarkFlags: boolean[] = []
      let parseErrHandler: ((err: unknown) => void) | undefined
      const runtimeLoader = async () => ({
        get default() {
          return {
            initialize(cfg: Record<string, unknown>) { initializedDarkFlags.push(Boolean(cfg.darkMode)) },
            set parseError(fn: ((err: unknown) => void) | undefined) { parseErrHandler = fn },
            get parseError() { return parseErrHandler },
            async render(_id: string, text: string) {
              if (text.includes("TriggerParseWarn")) {
                parseErrHandler?.("Lexical error on line 2")
                return { svg: "<svg><text>corrupt</text></svg>" }
              }
              if (text.includes("TriggerHang")) return await new Promise<{ svg: string }>(() => {})
              return { svg: `<svg data-dark="${initializedDarkFlags.at(-1)}"></svg>` }
            },
          }
        },
      })

      docElement.dataset.theme = "light"
      const lightWidget = new MarkdownMermaidWidget("flowchart TD\n  SchemeCheck --> B", 0, undefined, { runtimeLoader })
      const lightDom = lightWidget.toDOM() as unknown as SimpleDomElement
      docElement.dataset.theme = "dark"
      const darkWidget = new MarkdownMermaidWidget("flowchart TD\n  SchemeCheck --> B", 0, undefined, { runtimeLoader })
      expect(lightWidget.eq(darkWidget)).toBe(false)
      const darkDom = darkWidget.toDOM() as unknown as SimpleDomElement

      const warnDom = new MarkdownMermaidWidget("flowchart TD\n  TriggerParseWarn --> B", 0, undefined, { runtimeLoader }).toDOM() as unknown as SimpleDomElement
      const timeoutDom = new MarkdownMermaidWidget("flowchart TD\n  TriggerHang --> B", 0, undefined, { runtimeLoader, timeoutMs: 15 }).toDOM() as unknown as SimpleDomElement

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(lightDom.dataset.mermaidState).toBe("rendered")
      expect(lightDom.innerHTML).toContain('data-dark="false"')
      expect(darkDom.dataset.mermaidState).toBe("rendered")
      expect(darkDom.innerHTML).toContain('data-dark="true"')
      expect(warnDom.dataset.mermaidState).toBe("error")
      expect(timeoutDom.dataset.mermaidState).toBe("error")
    })

    const liveSurfaceSource = srcFile("components", "markdown-editor", "MarkdownEditorLiveSurface.tsx")
    expect(liveSurfaceSource).toContain("dragend")
    expect(liveSurfaceSource).toContain("blur")

    const notionChromeSource = srcFile("components", "markdown-editor", "MarkdownEditorNotionChrome.tsx")
    expect(notionChromeSource).not.toMatch(/useMemo\(\(\)\s*=>\s*\{[\s\S]*?computeBubbleToolbarPosition/)
    expect(notionChromeSource).not.toMatch(/useMemo\(\(\)\s*=>\s*\{[\s\S]*?computeGutterTopPosition/)

    const stylesCombined = srcFile("components", "markdown-editor", "MarkdownEditor.styles.ts") + notionChromeSource
    expect(stylesCombined).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?overflow-x:\s*auto/)
    expect(notionChromeSource).toMatch(/@media\s*\(pointer:\s*coarse\)\s*\{\s*display:\s*none;\s*\}/)
  })

  test("aligns inline DOM scanners, safe anchor href assignment, and nested live-preview highlight/color decorations", () => {
    expect(isSafeInlineHref("/\t/evil.example/phish")).toBe(false)
    expect(isSafeInlineHref("/\x7f/evil.example/phish")).toBe(false)
    expect(isSafeInlineHref("//evil.example/phish")).toBe(false)
    expect(isSafeInlineHref("https://example.com/docs")).toBe(true)
    expect(isSafeInlineHref("#section-1")).toBe(true)

    const serializeSimpleDom = (el: SimpleDomElement): string => {
      if (el.tagName === "#TEXT") return el.textContent
      if (el.tagName === "BR") return "<br/>"
      const tag = el.tagName.toLowerCase()
      const cls = el.className ? ` class="${el.className}"` : ""
      const inner = el.children.length > 0 ? el.children.map(serializeSimpleDom).join("") : el.textContent
      return `<${tag}${cls}>${inner}</${tag}>`
    }

    withMockDom(() => {
      const renderInlineHost = (source: string) => {
        const host = new SimpleDomElement("div")
        appendInlineMarkdownNodes(host as unknown as HTMLElement, source)
        return host
      }
      const renderInlineSnippet = (source: string) => serializeSimpleDom(renderInlineHost(source))

      expect(renderInlineSnippet("Check ==x = 1== and =={{color:blue|note}}==.")).toContain(
        '<mark class="cm-live-highlight">x = 1</mark>'
      )
      expect(renderInlineSnippet("Check ==x = 1== and =={{color:blue|note}}==.")).toContain(
        '<mark class="cm-live-highlight"><span class="cm-live-color">note</span></mark>'
      )
      expect(renderInlineSnippet("Keep === and a == 1 || b == 2 literal.")).toBe(
        "<div>Keep === and a == 1 || b == 2 literal.</div>"
      )
      expect(renderInlineSnippet("Prices are $10 and $25 today.")).toBe(
        "<div>Prices are $10 and $25 today.</div>"
      )
      expect(renderInlineSnippet("Multi ``code`` span")).toBe(
        '<div>Multi <code class="cm-live-inline-code">code</code> span</div>'
      )
      expect(renderInlineSnippet("Escaped $a \\\\$ math")).toContain('class="cm-live-math cm-live-math-inline"')

      const linkHost = renderInlineHost("[link $1](https://example.com?x=$2)")
      const anchor = linkHost.querySelector("a")
      expect(anchor).not.toBeNull()
      expect(anchor?.getAttribute("href")).toBe("https://example.com/?x=$2")
      expect(anchor?.textContent).toBe("link $1")
      expect(linkHost.querySelector(".cm-live-math-inline")).toBeNull()

      expect(renderInlineSnippet("{{color:blue|$x^{2}$}}")).toContain('class="cm-live-math cm-live-math-inline"')
      expect(renderInlineSnippet("{{color:blue|`{a}`}}")).toBe(
        '<div><span class="cm-live-color"><code class="cm-live-inline-code">{a}</code></span></div>'
      )

      const unsafeHost = renderInlineHost("[evil](javascript:alert(1)) and [phish](//evil.example)")
      expect(unsafeHost.querySelector("a")).toBeNull()
      expect(serializeSimpleDom(unsafeHost)).toBe(
        "<div><span>evil</span> and <span>phish</span></div>"
      )
    })

    const nestedPreviewDoc = [
      "==run `yarn test`==",
      "==see [docs](https://example.com)==",
      "==[[Note]]==",
      "{{color:blue|a `b}}c` d}}",
      "{{color:blue|`code` and [link](https://example.com)}}",
    ].join("\n\n")
    const specs = buildMarkdownLivePreviewDecorationSpecs(
      nestedPreviewDoc,
      [{ from: nestedPreviewDoc.length, to: nestedPreviewDoc.length }],
      false,
      "reading"
    )
    const highlightMarks = specs.filter((s) => s.kind === "highlight")
    expect(highlightMarks).toHaveLength(3)
    const colorMarks = specs.filter((s) => s.kind === "inline-color")
    expect(colorMarks).toHaveLength(2)
    expect(nestedPreviewDoc.slice(colorMarks[0]!.from, colorMarks[0]!.to)).toBe("a `b}}c` d")
    expect(nestedPreviewDoc.slice(colorMarks[1]!.from, colorMarks[1]!.to)).toBe(
      "`code` and [link](https://example.com)"
    )
  })
})
