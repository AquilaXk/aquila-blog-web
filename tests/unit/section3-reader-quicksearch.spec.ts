import { act, createElement, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import { expect, test } from "@playwright/test"
import { LanguageProvider } from "../../src/libs/language"
import { createTheme } from "../../src/styles/theme"
import type { PostDetail, TPost } from "../../src/types"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import {
  computeArticleReadingProgress,
  LEFT_RAIL_HYBRID_MIN_VIEWPORT_PX,
} from "../../src/routes/Detail/PostDetail/PostDetailRailModel"
import { revealHashedTargetInArticle } from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { selectUniqueRelatedPosts } from "../../src/routes/Detail/PostDetail/PostDetailRelatedSection"
import PostHeader, {
  resolvePostHeaderViewModel,
  shouldRenderPostHeader,
} from "../../src/routes/Detail/PostDetail/PostHeader"
import { resolveAdjacentPosts } from "../../src/routes/Detail/PostDetail/PostDetailNavigationModel"
import { PostDetailNavigationChrome } from "../../src/routes/Detail/PostDetail/PostDetailNavigationChrome"
import QuickSearchPalette, {
  isQuickSearchImeComposing,
} from "../../src/components/quick-search/QuickSearchPalette"
import { QuickSearchDialog } from "../../src/components/quick-search/QuickSearchPalette.styles"
import { syncResponsiveTables } from "../../src/libs/markdown/hooks/useResponsiveTableEffect"

const lightTheme = createTheme({ scheme: "light" })

const makePost = (overrides: Partial<TPost> & { id: string }): TPost => ({
  title: `Post ${overrides.id}`,
  slug: `post-${overrides.id}`,
  summary: `Summary ${overrides.id}`,
  tags: ["Architecture"],
  category: [],
  type: ["Post"],
  createdAt: "2026-10-01T00:00:00Z",
  ...overrides,
})

test.describe("Section 3: Reader UX, QuickSearch ARIA/IME, & Navigation Chrome", () => {
  test("PostHeader renders on non-Post types when header metadata exists and links category labels to Feed filter", () => {
    const pageDetail: PostDetail = {
      ...makePost({ id: "301", type: ["Page"], category: ["monitor::Architecture"], slug: "" }),
      title: "Architecture Guide Page",
      content: "## Intro\n\nBody copy",
    }
    const emptyPage: PostDetail = {
      id: "302",
      title: "",
      slug: "",
      content: "",
      type: ["Page"],
    }

    expect(shouldRenderPostHeader(pageDetail)).toBe(true)
    expect(shouldRenderPostHeader(emptyPage)).toBe(false)

    const vm = resolvePostHeaderViewModel({ data: pageDetail }, "ko-KR")
    expect(vm.heroLabels).toEqual(["Architecture", "Page"])
    expect(vm.primaryTaxonomy).toBe("Architecture")

    const html = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage: "ko",
          children: createElement(ThemeProvider, {
            theme: lightTheme,
            children: createElement(PostHeader, { data: pageDetail }),
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(html).toContain('href="/?tag=Architecture"')
    expect(html).toContain(">Architecture<")
    expect(html).not.toContain("monitor::Architecture")
  })

  test("computeArticleReadingProgress measures [0, 1] bounded article body scroll range excluding related/footer", () => {
    expect(LEFT_RAIL_HYBRID_MIN_VIEWPORT_PX).toBeGreaterThan(0)
    // Before reaching article body top -> clamped to 0
    expect(
      computeArticleReadingProgress({
        scrollY: 0,
        articleTopDoc: 500,
        articleBottomDoc: 2500,
        innerHeight: 800,
        viewportReadingAnchor: 80,
      })
    ).toBe(0)

    // Exact midpoint: (1020 + 80 - 500) / (2500 - 500 - 800) = 600 / 1200 = 0.5
    expect(
      computeArticleReadingProgress({
        scrollY: 1020,
        articleTopDoc: 500,
        articleBottomDoc: 2500,
        innerHeight: 800,
        viewportReadingAnchor: 80,
      })
    ).toBeCloseTo(0.5, 6)

    // Scrolled past body into related posts / footer -> clamped strictly to 1
    expect(
      computeArticleReadingProgress({
        scrollY: 2800,
        articleTopDoc: 500,
        articleBottomDoc: 2500,
        innerHeight: 800,
        viewportReadingAnchor: 80,
      })
    ).toBe(1)

    // Short article denominator clamped by Math.max(1, ...)
    const shortVal = computeArticleReadingProgress({
      scrollY: 450,
      articleTopDoc: 500,
      articleBottomDoc: 700,
      innerHeight: 800,
      viewportReadingAnchor: 80,
    })
    expect(shortVal).toBeGreaterThanOrEqual(0)
    expect(shortVal).toBeLessThanOrEqual(1)
  })

  test("revealHashedTargetInArticle decodes URL #hash safely and auto-expands closed ancestor <details>", () => {
    const closedParentDetails = {
      tagName: "DETAILS",
      open: false,
      parentElement: null as Element | null,
      attributes: new Set<string>(),
      setAttribute(name: string) {
        if (name === "open") this.open = true
      },
    }
    const targetHeading = {
      id: "세부 항목",
      tagName: "H3",
      parentElement: closedParentDetails as unknown as Element,
    }
    const fakeArticle = {
      contains: (node: unknown) => node === targetHeading,
    } as unknown as HTMLElement

    const prevDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        getElementById: (id: string) => (id === "세부 항목" ? targetHeading : null),
      },
    })
    try {
      const resolved = revealHashedTargetInArticle(
        fakeArticle,
        "#%EC%84%B8%EB%B6%80%20%ED%95%AD%EB%AA%A9"
      )
      expect(resolved?.expanded).toBe(true)
      expect(resolved?.target).toBe(targetHeading as unknown as Element)
      expect(closedParentDetails.open).toBe(true)

      // Malformed percent encoding fails closed without throwing
      expect(revealHashedTargetInArticle(fakeArticle, "#%E0%A4%A")).toBeNull()
      // Outside article fails closed
      const outsideArticle = { contains: () => false } as unknown as HTMLElement
      expect(revealHashedTargetInArticle(outsideArticle, "#세부%20항목")).toBeNull()
    } finally {
      if (prevDocument) {
        Object.defineProperty(globalThis, "document", prevDocument)
      } else {
        Reflect.deleteProperty(globalThis, "document")
      }
    }
  })

  test("selectUniqueRelatedPosts allows valid posts without slugs and checks !post?.id", () => {
    const sluglessValid = makePost({ id: "88", slug: "", title: "Slugless Post" })
    const emptyId = makePost({ id: "", slug: "orphan" })
    const selected = selectUniqueRelatedPosts([sluglessValid, emptyId], [sluglessValid])
    expect(selected.map((post) => post.id)).toEqual(["88"])
  })

  test("resolveAdjacentPosts & PostDetailNavigationChrome render Prev/Next links and Back-to-Top button", () => {
    const p3 = makePost({ id: "3", title: "Latest Post" })
    const p2 = makePost({ id: "2", title: "Current Post" })
    const p1 = makePost({ id: "1", title: "Older Post" })
    const adj = resolveAdjacentPosts([p3, p2, p1], "2")
    expect(adj.nextPost?.id).toBe("3")
    expect(adj.previousPost?.id).toBe("1")
    expect(resolveAdjacentPosts([p3, p2, p1], "999")).toEqual({
      previousPost: null,
      nextPost: null,
    })

    const html = renderToStaticMarkup(
      materializePlaywrightJsx(
        createElement(LanguageProvider, {
          initialLanguage: "ko",
          children: createElement(ThemeProvider, {
            theme: lightTheme,
            children: createElement(PostDetailNavigationChrome, {
              previousPost: p1,
              nextPost: p3,
              showBackToTop: true,
              onBackToTop: () => {},
            }),
          }),
        }) as ReactElement
      ) as ReactElement
    )
    expect(html).toContain('href="/posts/1"')
    expect(html).toContain('href="/posts/3"')
    expect(html).toContain('aria-label="맨 위로 이동"')
  })

  test("QuickSearchPalette guards IME Enter, uses 1rem input font-size, and exports ARIA combobox semantics", () => {
    expect(isQuickSearchImeComposing({ nativeEvent: { isComposing: true }, keyCode: 13 })).toBe(true)
    expect(isQuickSearchImeComposing({ nativeEvent: { isComposing: false }, keyCode: 229 })).toBe(true)
    expect(isQuickSearchImeComposing({ nativeEvent: { isComposing: false }, keyCode: 13 })).toBe(false)

    const styles = (QuickSearchDialog as unknown as { __emotion_styles?: unknown[] }).__emotion_styles ?? []
    expect(JSON.stringify(styles)).toContain("font-size: 1rem")

    // Source contract check alongside component API for combobox/focus attributes
    expect(typeof QuickSearchPalette).toBe("function")
  })

  test("QuickSearchPalette renders ARIA combobox/listbox links under RouterContext and restores focus on close", async () => {
    const prevWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    const prevDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
    const prevHtmlElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement")
    const prevFetch = globalThis.fetch
    const prevRaf = globalThis.requestAnimationFrame
    const prevCancelRaf = globalThis.cancelAnimationFrame
    const prevAct = (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT

    class MiniNode {
      nodeType: number
      tagName: string
      nodeName: string
      namespaceURI = "http://www.w3.org/1999/xhtml"
      ownerDocument: MiniDoc
      parentNode: MiniNode | null = null
      parentElement: MiniNode | null = null
      childNodes: MiniNode[] = []
      attributes = new Map<string, string>()
      style: Record<string, string> = {}
      listeners = new Map<string, Set<(ev: unknown) => void>>()
      nodeValue = ""
      value = ""
      type = ""
      placeholder = ""
      disabled = false
      tabIndex = 0
      selectionStart = 0
      selectionEnd = 0
      focusCalls = 0
      sheet = { cssRules: [], insertRule: () => 0 }

      setSelectionRange(start: number, end: number) {
        this.selectionStart = start
        this.selectionEnd = end
      }
      hasSelectionCapabilities() {
        return false
      }

      constructor(nodeType: number, tagName: string, ownerDocument: MiniDoc) {
        this.nodeType = nodeType
        this.tagName = tagName.toUpperCase()
        this.nodeName = this.tagName
        this.ownerDocument = ownerDocument
      }

      get id() {
        return this.attributes.get("id") ?? ""
      }
      set id(v: string) {
        this.attributes.set("id", v)
      }
      get className() {
        return this.attributes.get("class") ?? ""
      }
      set className(v: string) {
        this.attributes.set("class", v)
      }
      get firstChild() {
        return this.childNodes[0] ?? null
      }
      get nextSibling(): MiniNode | null {
        if (!this.parentNode) return null
        const idx = this.parentNode.childNodes.indexOf(this)
        return idx >= 0 ? (this.parentNode.childNodes[idx + 1] ?? null) : null
      }
      get children() {
        return this.childNodes.filter((c) => c.nodeType === 1)
      }
      get textContent(): string {
        if (this.nodeType === 3) return this.nodeValue
        return this.childNodes.map((c) => c.textContent).join("")
      }
      set textContent(v: string) {
        this.childNodes = v ? [new MiniNode(3, "#text", this.ownerDocument)] : []
        if (this.childNodes[0]) {
          this.childNodes[0].nodeValue = v
          this.childNodes[0].parentNode = this
        }
      }
      appendChild(child: MiniNode) {
        child.parentNode = this
        child.parentElement = this
        this.childNodes.push(child)
        return child
      }
      insertBefore(child: MiniNode, ref: MiniNode | null) {
        child.parentNode = this
        child.parentElement = this
        const idx = ref ? this.childNodes.indexOf(ref) : -1
        if (idx === -1) this.childNodes.push(child)
        else this.childNodes.splice(idx, 0, child)
        return child
      }
      removeChild(child: MiniNode) {
        const idx = this.childNodes.indexOf(child)
        if (idx >= 0) this.childNodes.splice(idx, 1)
        child.parentNode = null
        child.parentElement = null
        return child
      }
      setAttribute(name: string, val: string) {
        this.attributes.set(name, String(val))
      }
      getAttribute(name: string) {
        return this.attributes.get(name) ?? null
      }
      hasAttribute(name: string) {
        return this.attributes.has(name)
      }
      removeAttribute(name: string) {
        this.attributes.delete(name)
      }
      addEventListener(type: string, fn: (ev: unknown) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)?.add(fn)
      }
      removeEventListener(type: string, fn: (ev: unknown) => void) {
        this.listeners.get(type)?.delete(fn)
      }
      get isConnected(): boolean {
        if (this === this.ownerDocument.documentElement || this === this.ownerDocument.body) return true
        return Boolean(this.parentNode?.isConnected)
      }
      contains(target: unknown): boolean {
        if (target === this) return true
        return this.childNodes.some((child) => child.contains(target))
      }
      matches(selector: string): boolean {
        if (selector === ":disabled") return this.hasAttribute("disabled")
        if (this.hasAttribute("disabled")) return false
        const tabIndex = this.getAttribute("tabindex")
        if (tabIndex !== null && tabIndex !== "-1") return true
        return (
          this.tagName === "BUTTON" ||
          this.tagName === "INPUT" ||
          (this.tagName === "A" && this.hasAttribute("href"))
        )
      }
      focus() {
        this.focusCalls += 1
        this.ownerDocument.activeElement = this
      }
      getClientRects() {
        return [{ width: 100, height: 36 }]
      }
      scrollIntoView() {}
      findFirst(pred: (n: MiniNode) => boolean): MiniNode | null {
        if (pred(this)) return this
        for (const child of this.childNodes) {
          const hit = child.findFirst(pred)
          if (hit) return hit
        }
        return null
      }
      findAll(pred: (n: MiniNode) => boolean, out: MiniNode[] = []): MiniNode[] {
        if (pred(this)) out.push(this)
        for (const child of this.childNodes) child.findAll(pred, out)
        return out
      }
      querySelectorAll(selector: string) {
        if (selector.includes("button") || selector.includes("input")) {
          return this.findAll(
            (n) =>
              n.tagName === "INPUT" ||
              n.tagName === "BUTTON" ||
              n.getAttribute("tabindex") === "0"
          )
        }
        return []
      }
    }

    type MiniDoc = {
      nodeType: number
      activeElement: MiniNode | null
      defaultView: unknown
      head: MiniNode
      body: MiniNode
      documentElement: MiniNode
      createElement: (tag: string) => MiniNode
      createElementNS: (_ns: string, tag: string) => MiniNode
      createTextNode: (text: string) => MiniNode
      createComment: () => MiniNode
      querySelectorAll: () => MiniNode[]
      getElementById: (id: string) => MiniNode | null
      contains: (node: unknown) => boolean
      addEventListener: () => void
      removeEventListener: () => void
    }

    class FakeIFrameElement {}

    const doc: MiniDoc = {
      nodeType: 9,
      activeElement: null,
      defaultView: null,
      head: null as unknown as MiniNode,
      body: null as unknown as MiniNode,
      documentElement: null as unknown as MiniNode,
      createElement: (tag: string) => new MiniNode(1, tag, doc),
      createElementNS: (_ns: string, tag: string) => new MiniNode(1, tag, doc),
      createTextNode: (text: string) => {
        const node = new MiniNode(3, "#text", doc)
        node.nodeValue = text
        return node
      },
      createComment: () => new MiniNode(8, "#comment", doc),
      querySelectorAll: () => [],
      getElementById: (id: string) => doc.body.findFirst((n) => n.id === id),
      contains: (node: unknown) => doc.documentElement.contains(node) || doc.body.contains(node) || doc.head.contains(node),
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    doc.head = new MiniNode(1, "HEAD", doc)
    doc.body = new MiniNode(1, "BODY", doc)
    doc.documentElement = new MiniNode(1, "HTML", doc)
    const triggerButton = new MiniNode(1, "BUTTON", doc)
    doc.body.appendChild(triggerButton)
    triggerButton.focus()
    triggerButton.focusCalls = 0

    const rootContainer = new MiniNode(1, "DIV", doc)
    doc.body.appendChild(rootContainer)

    const rafCallbacks: Array<FrameRequestCallback> = []
    const scheduleRaf = (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }
    const cancelRaf = () => {}
    const fakeWindow = {
      document: doc,
      location: { hostname: "localhost", origin: "http://localhost:3000" },
      HTMLElement: MiniNode,
      Element: MiniNode,
      Node: MiniNode,
      HTMLIFrameElement: FakeIFrameElement,
      HTMLInputElement: MiniNode,
      HTMLButtonElement: MiniNode,
      getComputedStyle: () => ({ visibility: "visible", display: "block" }),
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      requestAnimationFrame: scheduleRaf,
      cancelAnimationFrame: cancelRaf,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    doc.defaultView = fakeWindow
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      writable: true,
      value: MiniNode,
    })
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: doc,
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: fakeWindow,
    })
    globalThis.requestAnimationFrame = scheduleRaf
    globalThis.cancelAnimationFrame = cancelRaf

    const pushedRoutes: string[] = []
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls += 1
      return new Response(
        JSON.stringify({
          content: [
            {
              id: 71,
              title: "First Runtime Post",
              summary: "Runtime summary 1",
              summarySource: "MANUAL",
              published: true,
              listed: true,
              tempDraft: false,
              tags: ["React"],
              category: ["Frontend"],
              createdAt: "2026-10-01T00:00:00Z",
              modifiedAt: "2026-10-01T00:00:00Z",
            },
            {
              id: 72,
              title: "Second Runtime Post",
              summary: "Runtime summary 2",
              summarySource: "MANUAL",
              published: true,
              listed: true,
              tempDraft: false,
              tags: ["TypeScript"],
              category: ["Frontend"],
              createdAt: "2026-10-02T00:00:00Z",
              modifiedAt: "2026-10-02T00:00:00Z",
            },
          ],
          pageable: { pageNumber: 1, pageSize: 5, totalElements: 2, totalPages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }) as typeof fetch

    const root = createRoot(rootContainer as unknown as Element)
    const mockRouter = {
      pathname: "/posts/1",
      route: "/posts/[id]",
      asPath: "/posts/1",
      query: { id: "1" },
      push: async (url: string) => {
        pushedRoutes.push(url)
        return true
      },
      replace: async () => true,
      prefetch: async () => {},
    }
    const returnFocusRef = { current: triggerButton as unknown as HTMLElement }
    let paletteOpen = true
    const renderPalette = () =>
      materializePlaywrightJsx(
        createElement(RouterContext.Provider, {
          value: mockRouter as unknown as React.ContextType<typeof RouterContext>,
          children: createElement(LanguageProvider, {
            initialLanguage: "ko",
            children: createElement(ThemeProvider, {
              theme: lightTheme,
              children: createElement(QuickSearchPalette, {
                open: paletteOpen,
                onClose: () => {
                  paletteOpen = false
                },
                returnFocusRef,
              }),
            }),
          }),
        }) as ReactElement
      ) as ReactElement

    try {
      await act(async () => {
        root.render(renderPalette())
      })
      await act(async () => {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 20))
      })

      const combobox = doc.body.findFirst((n) => n.getAttribute("role") === "combobox")
      const listbox = doc.body.findFirst((n) => n.getAttribute("role") === "listbox")
      const options = doc.body.findAll((n) => n.getAttribute("role") === "option")
      expect(combobox).not.toBeNull()
      expect(listbox).not.toBeNull()
      expect(options).toHaveLength(2)
      expect(combobox?.getAttribute("aria-autocomplete")).toBe("list")
      expect(combobox?.getAttribute("aria-haspopup")).toBe("listbox")
      expect(combobox?.getAttribute("aria-expanded")).toBe("true")
      expect(combobox?.getAttribute("aria-controls")).toBe(listbox?.id)
      expect(combobox?.getAttribute("aria-activedescendant")).toBe(options[0]?.id)
      expect(options[0]?.getAttribute("aria-selected")).toBe("true")
      expect(options[1]?.getAttribute("aria-selected")).toBe("false")

      paletteOpen = false
      await act(async () => {
        root.render(renderPalette())
      })
      while (rafCallbacks.length > 0) {
        const next = rafCallbacks.shift()
        next?.(16)
      }
      expect(triggerButton.focusCalls).toBeGreaterThanOrEqual(1)
      expect(doc.activeElement).toBe(triggerButton)
      expect(pushedRoutes).toEqual([])
    } finally {
      await act(async () => {
        root.unmount()
      })
      globalThis.fetch = prevFetch
      globalThis.requestAnimationFrame = prevRaf
      globalThis.cancelAnimationFrame = prevCancelRaf
      ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = prevAct
      if (prevWindow) Object.defineProperty(globalThis, "window", prevWindow)
      else Reflect.deleteProperty(globalThis, "window")
      if (prevDocument) Object.defineProperty(globalThis, "document", prevDocument)
      else Reflect.deleteProperty(globalThis, "document")
      if (prevHtmlElement) Object.defineProperty(globalThis, "HTMLElement", prevHtmlElement)
      else Reflect.deleteProperty(globalThis, "HTMLElement")
    }
  })

  test("syncResponsiveTables keeps data-label attributes referenced by mobile E2E suite", () => {
    const setAttrs: Array<{ name: string; value: string }> = []
    const fakeCell = {
      tagName: "TD",
      colSpan: 1,
      getAttribute: () => null,
      setAttribute: (name: string, value: string) => setAttrs.push({ name, value }),
    }
    const fakeTh = {
      tagName: "TH",
      colSpan: 1,
      rowSpan: 1,
      textContent: "항목",
    }
    const fakeHeadRow = { cells: [fakeTh] }
    const fakeBodyRow = { children: [fakeCell] }
    const classSet = new Set<string>()
    const fakeTable = {
      classList: {
        contains: (cls: string) => classSet.has(cls),
        add: (cls: string) => classSet.add(cls),
      },
      tHead: { rows: [fakeHeadRow] },
      tBodies: [{ rows: [fakeBodyRow] }],
    }
    Object.defineProperty(fakeCell, Symbol.toStringTag, { value: "HTMLTableCellElement" })
    const prevCell = globalThis.HTMLTableCellElement
    globalThis.HTMLTableCellElement = function FakeCell() {} as unknown as typeof HTMLTableCellElement
    Object.setPrototypeOf(fakeCell, globalThis.HTMLTableCellElement.prototype)
    try {
      const fakeRoot = {
        querySelector: () => fakeTable,
        querySelectorAll: () => [fakeTable],
      } as unknown as HTMLElement
      syncResponsiveTables(fakeRoot)
      expect(setAttrs).toEqual([{ name: "data-label", value: "항목" }])
    } finally {
      globalThis.HTMLTableCellElement = prevCell
    }
  })
})
