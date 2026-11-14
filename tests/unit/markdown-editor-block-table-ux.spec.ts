import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { expect, test } from "@playwright/test"
import { decorationField } from "src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  applyMarkdownTableGridAction,
  applyMarkdownTableGridPaste,
  applyTableCellInlineFormat,
} from "src/components/markdown-editor/markdownEditorTableModel"
import { MarkdownTableWidget } from "src/components/markdown-editor/markdownEditorTableWidget"

type FakeListener = (event: Record<string, unknown>) => void
type FakeListenerMap = Map<string, Set<FakeListener>>

const toDataAttributeKey = (prop: string): string =>
  `data-${prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`

const createDatasetProxy = (attrs: Map<string, string>): Record<string, string | undefined> =>
  new Proxy({} as Record<string, string | undefined>, {
    get(_target, prop) {
      return typeof prop === "string" ? attrs.get(toDataAttributeKey(prop)) : undefined
    },
    set(_target, prop, value) {
      if (typeof prop !== "string") return true
      const attrKey = toDataAttributeKey(prop)
      if (value === undefined) attrs.delete(attrKey)
      else attrs.set(attrKey, String(value))
      return true
    },
    deleteProperty(_target, prop) {
      if (typeof prop === "string") attrs.delete(toDataAttributeKey(prop))
      return true
    },
  })

const matchesFakeElementSelector = (node: any, selector: string): boolean => {
  if (selector.startsWith(".")) return Boolean(node.classList?.contains(selector.slice(1)))
  if (selector.startsWith('[data-testid="')) {
    return node.getAttribute?.("data-testid") === selector.slice(14, -2)
  }
  return node.tagName === selector.toUpperCase()
}

const findClosestFakeElement = (start: any, selector: string): any => {
  for (let cur = start; cur; cur = cur.parentElement) {
    if (matchesFakeElementSelector(cur, selector)) return cur
  }
  return null
}

const queryAllFakeElements = (root: any, selector: string): any[] => {
  const results: any[] = []
  const stack: any[] = [...(root.children ?? [])].reverse()
  while (stack.length > 0) {
    const child = stack.pop()
    if (matchesFakeElementSelector(child, selector)) results.push(child)
    const grandChildren = child.children ?? []
    for (let i = grandChildren.length - 1; i >= 0; i -= 1) stack.push(grandChildren[i])
  }
  return results
}

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
    draggable: false,
    isConnected: true,
    selectionStart: 0,
    selectionEnd: 0,
    style: { width: "", textAlign: "" },
    dataset: createDatasetProxy(attrs),
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
    focusCount: 0,
    focus: () => {
      el.focusCount += 1
    },
    setSelectionRange: (start: number, end: number) => {
      el.selectionStart = start
      el.selectionEnd = end
    },
    getBoundingClientRect: () => ({ width: 120, height: 32 }),
    closest: (selector: string) => findClosestFakeElement(el, selector),
    querySelectorAll: (selector: string): any[] => queryAllFakeElements(el, selector),
    querySelector: (selector: string): any => queryAllFakeElements(el, selector)[0] ?? null,
  }
  return el
}

const registerGlobalListener = (map: FakeListenerMap, type: string, fn: FakeListener): void => {
  const set = map.get(type) ?? new Set<FakeListener>()
  set.add(fn)
  map.set(type, set)
}

const emitGlobalListeners = (
  map: FakeListenerMap,
  type: string,
  event: Record<string, unknown>
): void => {
  for (const fn of map.get(type) ?? []) fn(event)
}

const restoreGlobalProperty = (
  key: "document" | "window",
  descriptor: PropertyDescriptor | undefined
): void => {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor)
  else delete (globalThis as Record<string, unknown>)[key]
}

const installFakeDomGlobals = () => {
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
  const prevWin = Object.getOwnPropertyDescriptor(globalThis, "window")
  const windowListeners: FakeListenerMap = new Map()
  const documentListeners: FakeListenerMap = new Map()

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: {
      createElement: (tag: string) => createFakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      addEventListener: (type: string, fn: FakeListener) =>
        registerGlobalListener(documentListeners, type, fn),
      removeEventListener: (type: string, fn: FakeListener) => {
        documentListeners.get(type)?.delete(fn)
      },
    },
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      addEventListener: (type: string, fn: FakeListener) =>
        registerGlobalListener(windowListeners, type, fn),
      removeEventListener: (type: string, fn: FakeListener) => {
        windowListeners.get(type)?.delete(fn)
      },
    },
  })

  return {
    windowListeners,
    documentListeners,
    restore: () => {
      restoreGlobalProperty("document", prevDoc)
      restoreGlobalProperty("window", prevWin)
    },
  }
}

const createTrackedFakeEditorView = (initialMarkdown: string) => {
  let lastDispatchedInsert = initialMarkdown
  let deletedInsert: string | null = null
  let trackDeleted = false
  const fakeView = {
    posAtDOM: () => 40,
    state: {
      doc: { length: initialMarkdown.length + 260 },
      selection: { main: { from: 0, to: 0 } },
      facet: () => true,
    },
    focus: () => {},
    dispatch: (tr: { changes?: { insert?: unknown } } | null | undefined) => {
      const insert = tr?.changes?.insert
      if (trackDeleted && typeof insert === "string") {
        deletedInsert = insert
        return
      }
      if (typeof insert === "string" && insert.length > 0) {
        lastDispatchedInsert = insert
      }
    },
  } as unknown as EditorView

  return {
    fakeView,
    getLastInsert: () => lastDispatchedInsert,
    enableDeleteCapture: () => {
      trackDeleted = true
    },
    getDeletedInsert: () => deletedInsert,
  }
}

const createPlainTextClipboard = (plainText: string) => ({
  getData: (type: string) => (type === "text/plain" ? plainText : ""),
})

const createPopoverTarget = () => ({
  closest: (sel: string) => (sel === "[data-table-popover]" ? {} : null),
})

test.describe("Block-level Markdown editor table UX", () => {
  test("preserves decorationField reference on non-active cursor moves and supports block table visual toggles, column resizer, and boundary arrow navigation", async () => {
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

    const env = installFakeDomGlobals()
    try {
      const tableMd = "| ColA | ColB |\n| --- | --- |\n| A1 | B1 |\n| A2 | B2 |"
      const viewTracker = createTrackedFakeEditorView(tableMd)
      const { fakeView } = viewTracker

      const widget = new MarkdownTableWidget(tableMd, 40, 40 + tableMd.length)
      const dom: any = widget.toDOM(fakeView)

      expect(dom.getAttribute("data-active-mode")).toBeNull()
      expect(dom.querySelectorAll("th")[0].classList.contains("is-active-cell")).toBe(false)

      const headerRowBtn = dom.querySelector('[data-testid="cm-live-table-toggle-header-row"]')
      const headerColBtn = dom.querySelector('[data-testid="cm-live-table-toggle-header-col"]')
      const fullWidthBtn = dom.querySelector('[data-testid="cm-live-table-toggle-full-width"]')
      expect(dom.getAttribute("data-header-row")).toBe("true")
      expect(headerRowBtn.getAttribute("aria-pressed")).toBe("true")
      expect(headerColBtn.getAttribute("aria-pressed")).toBe("false")
      expect(fullWidthBtn.getAttribute("aria-pressed")).toBe("false")

      headerRowBtn.trigger("click")
      expect(dom.getAttribute("data-header-row")).toBeNull()
      expect(headerRowBtn.getAttribute("aria-pressed")).toBe("false")
      headerRowBtn.trigger("click")
      expect(dom.getAttribute("data-header-row")).toBe("true")
      expect(headerRowBtn.getAttribute("aria-pressed")).toBe("true")

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
      emitGlobalListeners(env.windowListeners, "mousemove", { clientX: 165 })
      emitGlobalListeners(env.windowListeners, "mouseup", { clientX: 165 })
      expect(colEls[0].getAttribute("data-col-width")).toBe("185")
      expect(colEls[0].style.width).toBe("185px")

      const rerenderedDom: any = new MarkdownTableWidget(tableMd, 40, 40 + tableMd.length).toDOM(
        fakeView
      )
      expect(rerenderedDom.getAttribute("data-header-row")).toBe("true")
      expect(rerenderedDom.getAttribute("data-header-col")).toBe("true")
      expect(rerenderedDom.getAttribute("data-full-width")).toBe("true")
      expect(rerenderedDom.querySelectorAll("col")[0].getAttribute("data-col-width")).toBe("185")

      resizers[0].trigger("dblclick")
      expect(colEls[0].getAttribute("data-col-width")).toBeNull()
      expect(colEls[0].style.width).toBe("")

      const colHandles = dom.querySelectorAll(".cm-live-table-col-handle")
      const rowHandles = dom.querySelectorAll(".cm-live-table-row-handle")
      expect(colHandles).toHaveLength(2)
      expect(rowHandles).toHaveLength(3)

      colHandles[1].trigger("click")
      expect(dom.querySelectorAll("th")[1].classList.contains("is-selected-col")).toBe(true)
      expect(dom.querySelectorAll("td")[1].classList.contains("is-selected-col")).toBe(true)

      rowHandles[2].trigger("click")
      expect(dom.querySelectorAll("td")[2].classList.contains("is-selected-row")).toBe(true)
      expect(dom.querySelectorAll("td")[3].classList.contains("is-selected-row")).toBe(true)

      resizers[0].trigger("mousedown", { clientX: 100 })
      emitGlobalListeners(env.windowListeners, "mousemove", { clientX: 180 })
      emitGlobalListeners(env.windowListeners, "mouseup", { clientX: 180 })
      expect(colEls[0].getAttribute("data-col-width")).toBe("200")

      colHandles[0].trigger("dragstart", { dataTransfer: { effectAllowed: "", setData() {} } })
      dom.querySelectorAll("th")[1].trigger("dragover")
      expect(dom.querySelectorAll("th")[1].classList.contains("is-drop-target-col")).toBe(true)
      dom.querySelectorAll("th")[1].trigger("drop")
      expect(viewTracker.getLastInsert()).toBe(
        '<!-- aq-table {"headerColumn":true,"fitWidth":true,"columnWidths":[null,200]} -->\n| ColB | ColA |\n| --- | --- |\n| B1 | A1 |\n| B2 | A2 |'
      )
      const reorderedInsert = viewTracker.getLastInsert()
      expect(
        new MarkdownTableWidget(reorderedInsert, 40, 40 + reorderedInsert.length).updateDOM(
          dom,
          fakeView
        )
      ).toBe(true)
      expect(dom.querySelectorAll("col")[0].getAttribute("data-col-width")).toBeNull()
      expect(dom.querySelectorAll("col")[1].getAttribute("data-col-width")).toBe("200")

      expect(
        new MarkdownTableWidget(reorderedInsert, 60, 60 + reorderedInsert.length).updateDOM(
          dom,
          fakeView
        )
      ).toBe(true)
      expect(dom.dataset.tableFrom).toBe("60")
      const shiftedDom: any = new MarkdownTableWidget(
        reorderedInsert,
        60,
        60 + reorderedInsert.length
      ).toDOM(fakeView)
      expect(shiftedDom.querySelectorAll("col")[1].getAttribute("data-col-width")).toBe("200")
      const secondTableDom: any = new MarkdownTableWidget(
        reorderedInsert,
        120,
        120 + reorderedInsert.length
      ).toDOM(fakeView)
      expect(
        new MarkdownTableWidget(reorderedInsert, 120, 120 + reorderedInsert.length).updateDOM(
          dom,
          fakeView
        )
      ).toBe(true)
      expect(
        new MarkdownTableWidget(reorderedInsert, 180, 180 + reorderedInsert.length).updateDOM(
          secondTableDom,
          fakeView
        )
      ).toBe(true)
      const remountedFirstDom: any = new MarkdownTableWidget(
        reorderedInsert,
        120,
        120 + reorderedInsert.length
      ).toDOM(fakeView)
      expect(remountedFirstDom.querySelectorAll("col")[1].getAttribute("data-col-width")).toBe("200")
      expect(
        new MarkdownTableWidget(reorderedInsert, 40, 40 + reorderedInsert.length).updateDOM(
          dom,
          fakeView
        )
      ).toBe(true)

      const updatedRowHandles = dom.querySelectorAll(".cm-live-table-row-handle")
      updatedRowHandles[1].trigger("dragstart", {
        dataTransfer: { effectAllowed: "", setData() {} },
      })
      dom.querySelectorAll("tr")[2].trigger("dragover")
      expect(dom.querySelectorAll("tr")[2].classList.contains("is-drop-target-row")).toBe(true)
      dom.querySelectorAll("tr")[2].trigger("drop")
      expect(viewTracker.getLastInsert()).toBe(
        '<!-- aq-table {"headerColumn":true,"fitWidth":true,"columnWidths":[null,200]} -->\n| ColB | ColA |\n| --- | --- |\n| B2 | A2 |\n| B1 | A1 |'
      )

      const sameShapeWidget = new MarkdownTableWidget(
        "| ColX | ColY |\n| --- | --- |\n| X1 | Y1 |\n| X2 | Y2 |",
        40,
        100
      )
      expect(sameShapeWidget.updateDOM(dom, fakeView)).toBe(true)
      expect(dom.querySelectorAll(".cm-live-table-col-handle")).toHaveLength(2)

      const structuralWidget = new MarkdownTableWidget(
        "| ColX | ColY | ColZ |\n| --- | --- | --- |\n| X1 | Y1 | Z1 |",
        40,
        110
      )
      expect(structuralWidget.updateDOM(dom, fakeView)).toBe(true)
      expect(dom.querySelectorAll("th")).toHaveLength(3)
      expect(dom.querySelector("tbody").querySelectorAll("tr")).toHaveLength(1)

      const tds = dom.querySelectorAll("td")
      tds[0].trigger("click")
      let activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("X1")

      activeInput.setSelectionRange(activeInput.value.length, activeInput.value.length)
      activeInput.trigger("keydown", { key: "ArrowRight" })
      activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("Y1")

      activeInput.setSelectionRange(0, 0)
      activeInput.trigger("keydown", { key: "ArrowLeft" })
      activeInput = dom.querySelector(".cm-live-table-cell-input")
      expect(activeInput.value).toBe("X1")

      activeInput.setSelectionRange(0, activeInput.value.length)
      activeInput.trigger("keydown", { key: "b", metaKey: true })
      expect(activeInput.value).toBe("**X1**")
      activeInput.trigger("keydown", { key: "b", metaKey: true })
      expect(activeInput.value).toBe("X1")

      activeInput.setSelectionRange(activeInput.value.length, activeInput.value.length)
      activeInput.trigger("keydown", { key: "Enter", shiftKey: true })
      expect(activeInput.value).toBe("X1<br>")

      let pastePrevented = false
      activeInput.trigger("paste", {
        clipboardData: createPlainTextClipboard("P1\tP2\nQ1\tQ2"),
        preventDefault: () => {
          pastePrevented = true
        },
      })
      expect(pastePrevented).toBe(true)
      expect(viewTracker.getLastInsert()).toBe(
        ["| ColX | ColY | ColZ |", "| --- | --- | --- |", "| P1 | P2 | Z1 |", "| Q1 | Q2 |  |"].join(
          "\n"
        )
      )

      const cornerBtn = dom.querySelector('[data-testid="cm-live-table-add-corner"]')
      expect(cornerBtn).not.toBeNull()
      cornerBtn.trigger("click")
      expect(viewTracker.getLastInsert()).toBe(
        [
          "| ColX | ColY | ColZ |  |",
          "| --- | --- | --- | --- |",
          "| P1 | P2 | Z1 |  |",
          "| Q1 | Q2 |  |  |",
          "|  |  |  |  |",
        ].join("\n")
      )

      const toolbarBtns = dom.querySelectorAll(".cm-live-table-toolbar-btn")
      const alignLeftBtn = toolbarBtns.find((b: any) => b.textContent === "≡좌")
      const alignCenterBtn = toolbarBtns.find((b: any) => b.textContent === "≡중")
      expect(alignLeftBtn.getAttribute("aria-pressed")).toBe("true")
      expect(alignCenterBtn.getAttribute("aria-pressed")).toBe("false")
      alignCenterBtn.trigger("click")
      const centeredInsert = viewTracker.getLastInsert()
      expect(
        new MarkdownTableWidget(centeredInsert, 40, 40 + centeredInsert.length).updateDOM(
          dom,
          fakeView
        )
      ).toBe(true)
      expect(alignCenterBtn.getAttribute("aria-pressed")).toBe("true")
      expect(alignLeftBtn.getAttribute("aria-pressed")).toBe("false")

      dom.querySelector(".cm-live-table-cell-input").trigger("keydown", { key: "Escape" })
      dom.trigger("keydown", { key: "ArrowUp" })
      dom.trigger("keydown", { key: "ArrowLeft" })
      dom.trigger("keydown", { key: "ArrowLeft" })
      expect(dom.querySelectorAll("td")[5].classList.contains("is-active-cell")).toBe(true)
      dom.trigger("keydown", { key: "Backspace" })
      expect(viewTracker.getLastInsert()).toContain("| Q1 |  |  |  |")
      expect(dom.getAttribute("data-active-mode")).toBe("cell")
      let printableStopped = false
      dom.trigger("keydown", {
        key: "x",
        stopPropagation: () => {
          printableStopped = true
        },
      })
      expect(printableStopped).toBe(true)
      dom.querySelector(".cm-live-table-cell-input").trigger("keydown", { key: "Escape" })
      dom.trigger("keydown", { key: "Escape" })
      expect(dom.getAttribute("data-active-mode")).toBeNull()
      expect(widget.ignoreEvent()).toBe(true)

      const tdsAfterNav = dom.querySelectorAll("td")
      tdsAfterNav[1].trigger("click")
      expect(dom.dataset.activeMode).toBe("cell")
      expect(dom.dataset.activeRow).toBe("1")
      expect(dom.dataset.activeCol).toBe("1")
      const dirtyInputBeforePopover = dom.querySelector(".cm-live-table-cell-input")
      dirtyInputBeforePopover.value = "SavedOnTablePopover"
      emitGlobalListeners(env.documentListeners, "mousedown", {
        type: "mousedown",
        target: createPopoverTarget(),
      })
      expect(viewTracker.getLastInsert()).toContain("| P1 | SavedOnTablePopover | Z1 |  |")
      expect(dom.dataset.activeMode).toBe("cell")
      expect(dom.dataset.activeRow).toBe("1")
      expect(dom.dataset.activeCol).toBe("1")

      emitGlobalListeners(env.documentListeners, "focusin", {
        type: "focusin",
        target: { closest: () => null },
      })
      expect(dom.dataset.activeMode).toBeUndefined()
      expect(dom.dataset.activeRow).toBeUndefined()
      expect(dom.dataset.activeCol).toBeUndefined()

      tdsAfterNav[1].trigger("click")
      const dirtyInputBeforeOutsideFocus = dom.querySelector(".cm-live-table-cell-input")
      dirtyInputBeforeOutsideFocus.value = "SavedOnOutsideFocus"
      await Promise.resolve()
      dom.focusCount = 0
      emitGlobalListeners(env.documentListeners, "focusin", {
        type: "focusin",
        target: { closest: () => null },
      })
      await Promise.resolve()
      expect(viewTracker.getLastInsert()).toContain("| P1 | SavedOnOutsideFocus | Z1 |  |")
      expect(dom.focusCount).toBe(0)
      expect(dom.dataset.activeMode).toBeUndefined()
      expect(dom.dataset.activeRow).toBeUndefined()
      expect(dom.dataset.activeCol).toBeUndefined()

      tdsAfterNav[1].trigger("click")
      const dirtyInputOnDirectBlur = dom.querySelector(".cm-live-table-cell-input")
      dirtyInputOnDirectBlur.value = "SavedOnDirectBlur"
      dom.focusCount = 0
      dirtyInputOnDirectBlur.trigger("blur")
      await Promise.resolve()
      expect(viewTracker.getLastInsert()).toContain("| P1 | SavedOnDirectBlur | Z1 |  |")
      expect(dom.focusCount).toBe(0)

      tdsAfterNav[1].trigger("click")
      const dirtyInputBeforePagehide = dom.querySelector(".cm-live-table-cell-input")
      dirtyInputBeforePagehide.value = "SavedOnPagehide"
      emitGlobalListeners(env.windowListeners, "pagehide", { type: "pagehide" })
      expect(viewTracker.getLastInsert()).toContain("| P1 | SavedOnPagehide | Z1 |  |")

      tdsAfterNav[0].trigger("click")
      const dirtyInputBeforeDestroy = dom.querySelector(".cm-live-table-cell-input")
      dirtyInputBeforeDestroy.value = "SavedOnDestroy"
      ;(widget as any).destroy(dom)
      expect(viewTracker.getLastInsert()).toContain("| SavedOnDestroy | SavedOnPagehide | Z1 |  |")

      const deleteTableBtn = dom.querySelector('[data-testid="cm-live-table-delete-table"]')
      expect(deleteTableBtn).not.toBeNull()
      viewTracker.enableDeleteCapture()
      deleteTableBtn.trigger("click")
      expect(viewTracker.getDeletedInsert()).toBe("")
    } finally {
      env.restore()
    }
  })

  test("supports TSV/CSV multi-cell paste, inline cell formatting helpers, and add-row-and-column action", () => {
    const baseTable = ["| H1 | H2 |", "| --- | --- |", "| R1C1 | R1C2 |"].join("\n")
    expect(applyMarkdownTableGridAction(baseTable, 1, 1, { kind: "add-row-and-column" })).toEqual({
      markdown: [
        "| H1 | H2 |  |",
        "| --- | --- | --- |",
        "| R1C1 | R1C2 |  |",
        "|  |  |  |",
      ].join("\n"),
      nextRow: 2,
      nextCol: 2,
    })

    expect(applyMarkdownTableGridPaste(baseTable, 1, 1, "SingleCell")).toBeNull()
    expect(applyMarkdownTableGridPaste(baseTable, 1, 1, "SingleCellWithTrailingNewline\r\n")).toBeNull()

    const pasted = applyMarkdownTableGridPaste(baseTable, 1, 1, "A|1\tB1\nA2\tB2\n")
    expect(pasted).toEqual({
      markdown: [
        "| H1 | H2 |  |",
        "| --- | --- | --- |",
        String.raw`| R1C1 | A\|1 | B1 |`,
        "|  | A2 | B2 |",
      ].join("\n"),
      nextRow: 2,
      nextCol: 2,
      pastedRows: 2,
      pastedCols: 2,
    })

    const csvPasted = applyMarkdownTableGridPaste(
      baseTable,
      1,
      0,
      '"Alpha, Inc.",120\n"Beta, LLC",240\n'
    )
    expect(csvPasted).toEqual({
      markdown: [
        "| H1 | H2 |",
        "| --- | --- |",
        "| Alpha, Inc. | 120 |",
        "| Beta, LLC | 240 |",
      ].join("\n"),
      nextRow: 2,
      nextCol: 1,
      pastedRows: 2,
      pastedCols: 2,
    })

    expect(applyTableCellInlineFormat("hello", 0, 5, "bold")).toEqual({
      value: "**hello**",
      selectionStart: 2,
      selectionEnd: 7,
    })
    expect(applyTableCellInlineFormat("**hello**", 2, 7, "bold")).toEqual({
      value: "hello",
      selectionStart: 0,
      selectionEnd: 5,
    })
    expect(applyTableCellInlineFormat("**hello**", 2, 7, "italic")).toEqual({
      value: "***hello***",
      selectionStart: 3,
      selectionEnd: 8,
    })
    expect(applyTableCellInlineFormat("***hello***", 3, 8, "italic")).toEqual({
      value: "**hello**",
      selectionStart: 2,
      selectionEnd: 7,
    })
    expect(applyTableCellInlineFormat("**hello**", 0, 9, "italic")).toEqual({
      value: "***hello***",
      selectionStart: 1,
      selectionEnd: 10,
    })
    expect(applyTableCellInlineFormat("hello", 0, 5, "italic")).toEqual({
      value: "*hello*",
      selectionStart: 1,
      selectionEnd: 6,
    })
    expect(applyTableCellInlineFormat("hello", 0, 5, "strikethrough")).toEqual({
      value: "~~hello~~",
      selectionStart: 2,
      selectionEnd: 7,
    })
    expect(applyTableCellInlineFormat("hello", 0, 5, "code")).toEqual({
      value: "`hello`",
      selectionStart: 1,
      selectionEnd: 6,
    })
    expect(applyTableCellInlineFormat("line1", 5, 5, "line-break")).toEqual({
      value: "line1<br>",
      selectionStart: 9,
      selectionEnd: 9,
    })
  })
})
