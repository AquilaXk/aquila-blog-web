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
import {
  buildMarkdownLivePreviewDecorationSpecs,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import {
  buildDecorations,
  collectMathReplacementSpecs,
  compositionField,
  decorationField,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
  setComposition,
  setEditorMode,
  setPointerSelecting,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import { activeEmptyLineField } from "../../src/components/markdown-editor/markdownEditorNotionModel"
import { notionContainerBlockField } from "../../src/components/markdown-editor/markdownEditorNotionWidgets"
import {
  handleFenceEnter,
  handleFenceShiftEnter,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceCommands"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridCellEdit,
  applyMarkdownTableGridPaste,
  parseMarkdownTableGrid,
  planMarkdownEditorTableEdit,
  resolveTableCellSelectionOffset,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
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
import * as htmlPasteModel from "../../src/components/markdown-editor/markdownEditorHtmlPasteModel"
import * as profileImageUpload from "../../src/libs/profileImageUpload"

const lightTheme = createTheme({ scheme: "light" })
const srcFile = (...parts: string[]) =>
  readFileSync(path.resolve(__dirname, "../../src", ...parts), "utf8")

class SimpleDomElement {
  tagName: string
  className = ""
  textContent = ""
  value = ""
  type = ""
  src = ""
  alt = ""
  href = ""
  target = ""
  rel = ""
  loading = ""
  tabIndex = 0
  disabled = false
  scrollLeft = 0
  selectionStart: number | null = 0
  selectionEnd: number | null = 0
  isConnected = true
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  attributes = new Map<string, string>()
  children: SimpleDomElement[] = []
  parentElement: SimpleDomElement | null = null
  listeners = new Map<string, Array<(event: any) => void>>()
  private innerHtmlValue = ""
  classList = {
    add: (...tokens: string[]) => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean))
      for (const token of tokens) set.add(token)
      this.className = [...set].join(" ")
    },
    remove: (...tokens: string[]) => {
      const removeSet = new Set(tokens)
      this.className = this.className
        .split(/\s+/)
        .filter((token) => Boolean(token) && !removeSet.has(token))
        .join(" ")
    },
    contains: (token: string) => this.className.split(/\s+/).includes(token),
    toggle: (token: string, force?: boolean) => {
      const has = this.className.split(/\s+/).includes(token)
      const next = force ?? !has
      if (next) this.classList.add(token)
      else this.classList.remove(token)
      return next
    },
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  get innerHTML() {
    return this.innerHtmlValue
  }

  set innerHTML(val: string) {
    this.innerHtmlValue = val
    if (val === "") {
      this.children = []
      this.textContent = ""
    }
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, val)
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
      this.dataset[camel] = val
    }
  }

  getAttribute(name: string) {
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
      if (camel in this.dataset) return this.dataset[camel] ?? null
    }
    return this.attributes.get(name) ?? null
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
    if (name.startsWith("data-")) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
      delete this.dataset[camel]
    }
  }

  appendChild<T extends SimpleDomElement>(child: T): T {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  append(...nodes: SimpleDomElement[]) {
    for (const node of nodes) this.appendChild(node)
  }

  contains(other: unknown): boolean {
    let cur = other as SimpleDomElement | null
    while (cur) {
      if (cur === this) return true
      cur = cur.parentElement
    }
    return false
  }

  closest(selector: string): SimpleDomElement | null {
    let cur: SimpleDomElement | null = this
    while (cur) {
      if (cur.matchesSelector(selector)) return cur
      cur = cur.parentElement
    }
    return null
  }

  private matchesSelector(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1))
    }
    if (selector.startsWith("[data-testid=\"") && selector.endsWith("\"]")) {
      const expected = selector.slice(14, -2)
      return this.getAttribute("data-testid") === expected
    }
    if (selector === "[data-table-popover]") {
      return this.attributes.has("data-table-popover")
    }
    return this.tagName.toLowerCase() === selector.toLowerCase()
  }

  querySelector(selector: string): SimpleDomElement | null {
    for (const child of this.children) {
      if (child.matchesSelector(selector)) return child
      const nested = child.querySelector(selector)
      if (nested) return nested
    }
    return null
  }

  querySelectorAll(selector: string): SimpleDomElement[] {
    const out: SimpleDomElement[] = []
    for (const child of this.children) {
      if (child.matchesSelector(selector)) out.push(child)
      out.push(...child.querySelectorAll(selector))
    }
    return out
  }

  addEventListener(type: string, fn: (event: any) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, fn: (event: any) => void) {
    const list = this.listeners.get(type)
    if (!list) return
    this.listeners.set(
      type,
      list.filter((entry) => entry !== fn)
    )
  }

  dispatch(type: string, init: Record<string, any> = {}) {
    let defaultPrevented = false
    let propagationStopped = false
    const event = {
      type,
      target: init.target ?? this,
      currentTarget: this,
      button: 0,
      preventDefault() {
        defaultPrevented = true
      },
      stopPropagation() {
        propagationStopped = true
      },
      get defaultPrevented() {
        return defaultPrevented
      },
      ...init,
    }
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event)
      if (propagationStopped) break
    }
    return event
  }

  focus() {}

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start
    this.selectionEnd = end
  }

  getBoundingClientRect() {
    return { width: 120, height: 32, top: 0, left: 0, right: 120, bottom: 32 }
  }
}

const withMockDom = <T>(fn: (winListeners: Map<string, Array<(e: any) => void>>) => T): T => {
  const prevDoc = (globalThis as any).document
  const prevWin = (globalThis as any).window
  const winListeners = new Map<string, Array<(e: any) => void>>()
  ;(globalThis as any).document = {
    createElement: (tag: string) => new SimpleDomElement(tag),
    createTextNode: (text: string) => {
      const node = new SimpleDomElement("#text")
      node.textContent = text
      return node
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    activeElement: null,
  }
  ;(globalThis as any).window = {
    innerWidth: 1280,
    innerHeight: 840,
    addEventListener: (type: string, cb: (e: any) => void) => {
      const list = winListeners.get(type) ?? []
      list.push(cb)
      winListeners.set(type, list)
    },
    removeEventListener: (type: string, cb: (e: any) => void) => {
      const list = winListeners.get(type)
      if (!list) return
      winListeners.set(
        type,
        list.filter((entry) => entry !== cb)
      )
    },
  }
  try {
    return fn(winListeners)
  } finally {
    ;(globalThis as any).document = prevDoc
    ;(globalThis as any).window = prevWin
  }
}

const pwComponentCache = new WeakMap<object, unknown>()

function wrapPwComponent(type: unknown): unknown {
  if (!type || (typeof type !== "function" && typeof type !== "object")) return type
  if (typeof type === "function") {
    if (
      "__emotion_real" in type ||
      Boolean((type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent)
    ) {
      return type
    }
    const cached = pwComponentCache.get(type)
    if (cached) return cached
    const fn = type as (props: Record<string, unknown>) => unknown
    const Wrapped = (props: Record<string, unknown>) => toReactElement(fn(props))
    pwComponentCache.set(type, Wrapped)
    return Wrapped
  }
  const cachedObj = pwComponentCache.get(type)
  if (cachedObj) return cachedObj
  const obj = type as { $$typeof?: symbol; type?: unknown; compare?: unknown }
  if (obj.$$typeof === Symbol.for("react.memo") && obj.type) {
    const WrappedMemo = React.memo(wrapPwComponent(obj.type) as never, obj.compare as never)
    pwComponentCache.set(type, WrappedMemo)
    return WrappedMemo
  }
  return type
}

function toReactElement(node: unknown, index?: number): unknown {
  if (!node || typeof node !== "object") return node
  if (Array.isArray(node)) return node.map((child, idx) => toReactElement(child, idx))
  const record = node as {
    __pw_type?: string
    type?: unknown
    props?: Record<string, unknown>
    key?: string | number | null
  }
  if (record.__pw_type === "jsx") {
    const nextProps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(record.props ?? {})) {
      nextProps[k] = toReactElement(v)
    }
    const resolvedKey =
      record.key !== undefined && record.key !== null
        ? record.key
        : index !== undefined
          ? `pw-${index}`
          : undefined
    if (resolvedKey !== undefined) nextProps.key = resolvedKey
    const resolvedType =
      record.type === undefined ||
      (typeof record.type === "object" && record.type !== null && !("$$typeof" in record.type))
        ? React.Fragment
        : wrapPwComponent(record.type)
    return React.createElement(resolvedType as never, nextProps)
  }
  if (React.isValidElement(node) && record.props) {
    const nextType = wrapPwComponent(record.type)
    let changed = nextType !== record.type
    const nextProps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(record.props)) {
      const converted = toReactElement(v)
      if (converted !== v) changed = true
      nextProps[k] = converted
    }
    if (!changed) return node
    if (record.key !== undefined && record.key !== null) nextProps.key = record.key
    return React.createElement(nextType as never, nextProps)
  }
  return node
}

const renderToolbarHtml = (viewMode: "live" | "source" | "reading", disabled = false) =>
  renderToStaticMarkup(
    toReactElement(
      React.createElement(ThemeProvider, {
        theme: lightTheme,
        children: React.createElement(MarkdownEditorToolbar, {
          disabled,
          disableMermaid: false,
          viewMode,
          tableRows: 2,
          tableColumns: 2,
          commandContext: {
            disabled: disabled || viewMode === "reading",
            selectionStart: 0,
            selectionEnd: 0,
            isTableSelection: false,
          },
          toolbarCommands: projectMarkdownEditorToolbarCommands(),
          imageInputRef: createRef<HTMLInputElement>(),
          fileInputRef: createRef<HTMLInputElement>(),
          hasUploadImage: true,
          hasUploadFile: true,
          onTableRowsChange: () => {},
          onTableColumnsChange: () => {},
          onRememberSelection: () => {},
          onApplyCommand: () => {},
          onApplySnippet: () => {},
          onApplyFormatShortcut: () => {},
          onApplyListCommand: () => {},
          onApplyLineCommand: () => {},
          onApplyBlockSnippet: () => {},
          onInsertTable: () => {},
          onApplyTableEdit: () => {},
          isTableEditDisabled: () => true,
          onOpenFindReplace: () => {},
          onImageFileSelect: () => {},
          onAttachmentFileSelect: () => {},
          onViewModeChange: () => {},
        }),
      })
    ) as React.ReactElement
  )

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
      "# Heading Title",
      "",
      "**Bold** and [Link](https://example.com) and $O(1)$ and [[Note|Alias]]",
      "",
      "- [x] Done item",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n")

    const liveSpecsAtHeading = buildMarkdownLivePreviewDecorationSpecs(
      doc,
      [{ from: 2, to: 2 }],
      false,
      "live" as never
    )
    const readingSpecsAtHeading = (buildMarkdownLivePreviewDecorationSpecs as any)(
      doc,
      [{ from: 2, to: 2 }],
      false,
      "reading"
    )
    expect(liveSpecsAtHeading.some((d: any) => d.kind === "hide-mark" && d.from === 0)).toBe(false)
    expect(readingSpecsAtHeading.some((d: any) => d.kind === "hide-mark" && d.from === 0)).toBe(true)

    const tableCursor = doc.indexOf("| 1 |") + 2
    const readingState = createDecorationEditorState(doc, tableCursor, "reading")
    const readingDecos = buildDecorations(readingState)
    let hasTableWidgetAtCursorInReading = false
    readingDecos.between(0, doc.length, (_from, _to, value) => {
      if (value.spec.widget instanceof MarkdownTableWidget) {
        hasTableWidgetAtCursorInReading = true
      }
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
        dispatch: () => {
          dispatched = true
        },
        posAtDOM: () => doc.indexOf("[x]"),
      } as unknown as EditorView
      const checkbox = new MarkdownTaskWidget(true, 0, 3).toDOM(mockView) as unknown as SimpleDomElement
      checkbox.dispatch("mousedown")
      expect(dispatched).toBe(false)

      const readingTableDom = new MarkdownTableWidget(
        "| A | B |\n| --- | --- |\n| 1 | 2 |",
        0,
        29
      ).toDOM(mockView) as unknown as SimpleDomElement
      const readingHeaderColBtn = readingTableDom.querySelector(
        '[data-testid="cm-live-table-toggle-header-col"]'
      )!
      readingHeaderColBtn.dispatch("click")
      expect(readingTableDom.getAttribute("data-header-col")).toBeNull()
      expect(dispatched).toBe(false)
    })
  })

  test("round-trips <!-- aq-table {...} --> layout metadata across edits and omits default comments", () => {
    const malformed = ["<!-- aq-table malformed", "| one |", "| --- |", "| two |"].join("\n")
    expect(parseMarkdownTableGrid(malformed)).toBeNull()
    expect(planMarkdownEditorTableEdit(malformed, malformed.indexOf("one"), malformed.indexOf("one"), { kind: "add-row" })).toBeNull()

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
      expect(currentDoc).toContain('"overflowMode":"wide"')

      resizers[1]!.dispatch("pointerdown", { button: 0, clientX: 100 })
      for (const move of winListeners.get("pointermove") ?? []) move({ clientX: 180 })
      for (const up of winListeners.get("pointerup") ?? []) up({})
      expect(currentDoc).toContain('"columnWidths":[null,200]')

      resizers[1]!.dispatch("dblclick")
      headerColBtn.dispatch("click")
      fullWidthBtn.dispatch("click")
      expect(currentDoc).not.toContain("<!-- aq-table")
      expect(currentDoc).toBe(plainTable)
    })
  })

  test("bypasses HTML-to-Markdown conversion for IDE/fence/source pastes and falls back to plain text on benign empty HTML", () => {
    const shouldBypass = (htmlPasteModel as Record<string, any>).shouldBypassHtmlPasteConversion
    const shouldBlockEmpty = (htmlPasteModel as Record<string, any>).shouldReportEmptyHtmlPasteError
    expect(typeof shouldBypass).toBe("function")
    expect(typeof shouldBlockEmpty).toBe("function")

    expect(
      shouldBypass({
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
      shouldBypass({
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
      shouldBypass({
        viewMode: "live",
        markdown: inlineCodeDoc,
        selectionFrom: inlineCodeDoc.indexOf("const"),
        clipboardTypes: ["text/html", "text/plain"],
        html: "<p><strong>bold</strong></p>",
        plainText: "bold",
      })
    ).toBe(true)

    expect(
      shouldBypass({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["vscode-editor-data", "text/html", "text/plain"],
        html: '<div style="font-family: Menlo; white-space: pre;"><span>const x = 1;</span></div>',
        plainText: "const x = 1;",
      })
    ).toBe(true)

    expect(
      shouldBypass({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: '<div style="font-family: monospace; white-space: pre;"><span>fn main() {}</span></div>',
        plainText: "fn main() {}",
      })
    ).toBe(true)

    expect(
      shouldBypass({
        viewMode: "live",
        markdown: "",
        selectionFrom: 0,
        clipboardTypes: ["text/html", "text/plain"],
        html: "<p>Hello <strong>world</strong> and <a href=\"https://example.com\">docs</a></p>",
        plainText: "Hello world and docs",
      })
    ).toBe(false)

    expect(shouldBlockEmpty("<div><span>   </span></div>", "plain fallback text")).toBe(false)
    expect(shouldBlockEmpty("<script>window.__xss = 1</script>", "ignored")).toBe(true)
    expect(shouldBlockEmpty("<div><span>   </span></div>", "")).toBe(true)
  })

  test("enforces Pandoc tex_math_dollars rules and literalRanges exclusion in collectMathReplacementSpecs", () => {
    const proseCurrency = "Prices are $10 and $20 or $10~20 and ($10) to ($20)."
    expect(collectMathReplacementSpecs(proseCurrency, -1, -1, false, [])).toEqual([])

    const shellAndUrl = 'Run echo "$HOME $PATH" and visit https://a.com/$x/$y now.'
    const codeLiteralStart = shellAndUrl.indexOf("echo")
    const codeLiteralEnd = shellAndUrl.indexOf(" and")
    expect(
      collectMathReplacementSpecs(shellAndUrl, -1, -1, false, [
        { from: codeLiteralStart, to: codeLiteralEnd },
      ])
    ).toEqual([])

    expect(collectMathReplacementSpecs("Escaped \\$x + y\\$ stays literal", -1, -1, false, [])).toEqual([])

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
  })

  test("guards Korean IME 229, restricts slash trigger to line/block prefix, clamps visualViewport, and keeps Shift+Enter literal inside FencedCode", () => {
    expect(matchSlashCommandTrigger("/head", { from: 5, to: 5 })).toEqual({
      query: "head",
      slashFrom: 0,
    })
    expect(matchSlashCommandTrigger("  > - [ ] /todo", { from: 15, to: 15 })).toEqual({
      query: "todo",
      slashFrom: 10,
    })
    expect(matchSlashCommandTrigger("요청 / 응답", { from: 4, to: 4 })).toBeNull()
    expect(matchSlashCommandTrigger("https://example.com/docs", { from: 24, to: 24 })).toBeNull()

    const slashMenuSource = srcFile("components", "markdown-editor", "MarkdownEditorSlashMenu.tsx")
    expect(slashMenuSource).toMatch(/isComposing[\s\S]*229/)
    expect(
      slashMenuSource + srcFile("components", "markdown-editor", "useMarkdownEditorSlashMenu.ts")
    ).toContain("visualViewport")

    const fencedDoc = "```ts\nconst a = 1\n```"
    const insideFencePos = fencedDoc.indexOf("1") + 1
    const fenceState = EditorState.create({
      doc: fencedDoc,
      selection: EditorSelection.cursor(insideFencePos),
      extensions: [markdown({ extensions: GFM }), compositionField],
    })
    const composingState = fenceState.update({ effects: setComposition.of(true) }).state
    let fenceDispatched = false
    const mockFenceView = {
      state: composingState,
      composing: true,
      dispatch: () => {
        fenceDispatched = true
      },
    } as unknown as EditorView
    expect(handleFenceEnter.run?.(mockFenceView)).toBe(false)
    expect(fenceDispatched).toBe(false)

    const multiLineComposeDoc = ["# Heading", "", "Paragraph", "", "- [x] Done"].join("\n")
    const paragraphPos = multiLineComposeDoc.indexOf("Paragraph")
    const composeSurfaceState = createDecorationEditorState(
      multiLineComposeDoc,
      paragraphPos,
      "live"
    ).update({ effects: setComposition.of(true) }).state
    const composeSurfaceDecos = buildDecorations(composeSurfaceState)
    let hidesInactiveHeadingMark = false
    let decoratesComposingLine = false
    composeSurfaceDecos.between(0, multiLineComposeDoc.length, (from, to) => {
      if (from === 0 && to === 2) hidesInactiveHeadingMark = true
      if (from >= paragraphPos && to <= paragraphPos + "Paragraph".length) {
        decoratesComposingLine = true
      }
    })
    expect(hidesInactiveHeadingMark).toBe(true)
    expect(decoratesComposingLine).toBe(false)

    let shiftEnterInsert = ""
    const mockShiftEnterView = {
      state: fenceState,
      composing: false,
      dispatch: (spec: { changes?: { insert?: string } }) => {
        shiftEnterInsert = spec.changes?.insert ?? ""
      },
    } as unknown as EditorView
    expect(handleFenceShiftEnter.run?.(mockShiftEnterView)).toBe(true)
    expect(shiftEnterInsert).toBe("\n")

    const textareaKeyboardSource = srcFile(
      "components",
      "markdown-editor",
      "useMarkdownEditorTextareaKeyboard.ts"
    )
    expect(textareaKeyboardSource).toContain("isOffsetInsideFencedCodeBlock")

    withMockDom(() => {
      const tableDoc = "| A | B |\n| --- | --- |\n| 1 | 2 |"
      const mockView = {
        state: {
          doc: { length: tableDoc.length, lineAt: () => ({ length: 1 }) },
          selection: { main: { from: 0, to: 0 } },
          facet: () => true,
        },
        posAtDOM: () => 0,
        focus: () => {},
        dispatch: () => {},
      } as unknown as EditorView
      const widget = new MarkdownTableWidget(tableDoc, 0, tableDoc.length)
      const dom = widget.toDOM(mockView) as unknown as SimpleDomElement
      const colHandle = dom.querySelector('[data-testid="cm-live-table-col-handle"]')!
      colHandle.dispatch("click")
      expect(dom.querySelector('[data-testid="cm-live-table-cell-input"]')).toBeNull()
      dom.dispatch("compositionstart")
      expect(dom.querySelector('[data-testid="cm-live-table-cell-input"]')).not.toBeNull()
    })
  })

  test("hardens media transfers, widget sanitization, alpha transparency preservation, Notion chrome effects, and compact/coarse styles", async () => {
    expect(
      resolveMarkdownImageEmbed(
        {
          url: "https://blog.aquilaxk.site/post/api/v1/images/posts/chart.png",
          alt: "Diagram [v1]",
        },
        "chart[1].png",
        { publicApiOrigin: "https://blog.aquilaxk.site" }
      )
    ).toEqual({
      markdown: "\n\n![Diagram \\[v1\\]](https://blog.aquilaxk.site/post/api/v1/images/posts/chart.png)\n",
    })
    expect(
      resolveMarkdownAttachmentLink(
        {
          url: "https://cdn.example.test/files/spec.pdf",
          name: "Spec [Draft].pdf",
        },
        "spec.pdf"
      )
    ).toEqual({
      markdown: "\n\n[Spec \\[Draft\\].pdf](https://cdn.example.test/files/spec.pdf)\n",
    })

    const mediaTransfersModule = await import(
      "../../src/components/markdown-editor/useMarkdownEditorMediaTransfers"
    )
    const resolveUploadError = (mediaTransfersModule as Record<string, any>)
      .resolveMarkdownEditorUploadErrorMessage
    expect(typeof resolveUploadError).toBe("function")
    expect(
      resolveUploadError(
        new ApiError(413, "/post/api/v1/posts/images", JSON.stringify({ msg: "이미지 용량이 8MB를 초과했습니다." })),
        { kind: "image", fileName: "big.png", fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE }
      )
    ).toContain("용량")
    expect(
      resolveUploadError(new ApiTimeoutError("/post/api/v1/posts/files", 12000), {
        kind: "file",
        fileName: "doc.pdf",
        fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
      })
    ).toContain("지연")
    expect(
      resolveUploadError(new Error("지원하지 않는 이미지 형식입니다."), {
        kind: "image",
        fileName: "bad.bmp",
        fallbackMessage: MARKDOWN_IMAGE_UPLOAD_FAILED_MESSAGE,
      })
    ).toContain("지원하지 않는 이미지 형식입니다.")
    expect(
      resolveUploadError(new ApiError(500, "/post/api/v1/posts/files", "failed"), {
        kind: "file",
        fileName: "failed.txt",
        fallbackMessage: MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE,
      })
    ).toBe(MARKDOWN_ATTACHMENT_UPLOAD_FAILED_MESSAGE)

    const hasAlpha = (profileImageUpload as Record<string, any>).hasAlphaTransparency
    const resolveMimeTypes = (profileImageUpload as Record<string, any>).resolveTransferOutputMimeTypes
    expect(typeof hasAlpha).toBe("function")
    expect(typeof resolveMimeTypes).toBe("function")
    expect(hasAlpha(new Uint8ClampedArray([255, 255, 255, 255, 10, 20, 30, 255]))).toBe(false)
    expect(hasAlpha(new Uint8ClampedArray([255, 255, 255, 255, 10, 20, 30, 128]))).toBe(true)
    expect(
      resolveMimeTypes(["image/webp", "image/jpeg", "image/png"], {
        sourceMimeType: "image/png",
        hasTransparency: true,
      })
    ).toEqual(["image/webp", "image/png"])
    expect(
      resolveMimeTypes(["image/webp", "image/jpeg"], {
        sourceMimeType: "image/png",
        hasTransparency: true,
      })
    ).toEqual(["image/webp", "image/png"])
    expect(
      resolveMimeTypes(["image/webp", "image/jpeg", "image/png"], {
        sourceMimeType: "image/png",
        hasTransparency: false,
      })
    ).toEqual(["image/webp", "image/jpeg", "image/png"])

    resetSharedMermaidRuntimeForTests()
    await withMockDom(async () => {
      const unsafeImgDom = new MarkdownImageWidget("javascript:alert(1)", "bad").toDOM() as unknown as SimpleDomElement
      expect(unsafeImgDom.querySelector("img")?.src ?? "").toBe("")

      const safeImgDom = new MarkdownImageWidget(
        "/post/api/v1/images/posts/ok.png",
        "ok"
      ).toDOM() as unknown as SimpleDomElement
      expect(safeImgDom.querySelector("img")?.src).toBe(
        "/post/api/v1/images/posts/ok.png"
      )

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
    })

    const liveSurfaceSource = srcFile("components", "markdown-editor", "MarkdownEditorLiveSurface.tsx")
    expect(liveSurfaceSource).toContain("dragend")
    expect(liveSurfaceSource).toContain("blur")

    const notionChromeSource = srcFile("components", "markdown-editor", "MarkdownEditorNotionChrome.tsx")
    expect(notionChromeSource).not.toMatch(/useMemo\(\(\)\s*=>\s*\{[\s\S]*?computeBubbleToolbarPosition/)
    expect(notionChromeSource).not.toMatch(/useMemo\(\(\)\s*=>\s*\{[\s\S]*?computeGutterTopPosition/)

    const stylesCombined =
      srcFile("components", "markdown-editor", "MarkdownEditor.styles.ts") +
      notionChromeSource
    expect(stylesCombined).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?overflow-x:\s*auto/)
    expect(notionChromeSource).toMatch(/@media\s*\(pointer:\s*coarse\)\s*\{\s*display:\s*none;\s*\}/)
  })
})
