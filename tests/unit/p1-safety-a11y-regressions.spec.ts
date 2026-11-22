import { act, createElement, forwardRef, useRef, type ComponentType, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { ThemeProvider } from "@emotion/react"
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime"
import { expect, test } from "@playwright/test"
import { TextField as RawTextField, type TextFieldProps } from "../../src/design-system/primitives"
import { getPreferredScrollBehavior } from "../../src/design-system/motion"
import { useModalFocusTrap } from "../../src/design-system/useModalFocusTrap"
import { ErrorFallbackView as RawErrorFallbackView } from "../../src/components/error/ErrorFallbackView"
import RawProfileImage from "../../src/components/ProfileImage"
import { MarkdownEditorBlockMenuPopover as RawMarkdownEditorBlockMenuPopover } from "../../src/components/markdown-editor/MarkdownEditorBlockMenuPopover"
import {
  getBlockChromeLabels,
  getColorSwatchLabel,
} from "../../src/components/markdown-editor/markdownEditorBlockChromeLabels"
import { mergeSortedDirtyRegions } from "../../src/components/markdown-editor/markdownEditorLiveDecorationRegions"
import RawQuickSearchPalette from "../../src/components/quick-search/QuickSearchPalette"
import { QuickSearchDialog } from "../../src/components/quick-search/QuickSearchPalette.styles"
import { LanguageProvider as RawLanguageProvider, LANGUAGE_STORAGE_KEY } from "../../src/libs/language"
import { syncResponsiveTables } from "../../src/libs/markdown/hooks/useResponsiveTableEffect"
import { openMermaidOverlay } from "../../src/libs/markdown/mermaidRuntimeOverlay"
import { __resetBodyScrollLockForTests } from "../../src/libs/utils/bodyScrollLock"
import { YarlPortal } from "../../src/routes/Admin/AdminCloudMediaLightbox.styles"
import { SortSelect } from "../../src/routes/Admin/AdminCloudWorkspaceControls.styles"
import { PaletteScrim } from "../../src/routes/Admin/AdminCommandPalette.styles"
import { MobileDrawerScrim } from "../../src/routes/Admin/AdminShellSidebar.styles"
import { EditorInspector } from "../../src/routes/Admin/EditorStudioDedicatedPanelParts"
import { EditorMobileSheetContainer as RawEditorMobileSheetContainer } from "../../src/routes/Admin/EditorMobileSheetContainer"
import { EditorMobileSheetScrim } from "../../src/routes/Admin/EditorStudioEditorialStyles"
import { revalidateSavedPost } from "../../src/routes/Admin/editorPostSaveRefresh"
import { StyledWrapper as AboutStyledWrapper } from "../../src/routes/About/AboutPage.styles"
import {
  DownloadAnnouncementInner,
  StickyOsNavInner,
  VersionChip,
} from "../../src/routes/Company/CompanyDownload.styles"
import RawCompanyDownloadPageView from "../../src/routes/Company/CompanyDownloadPageView"
import { FooterGroup, HeaderAction, NavLink } from "../../src/routes/Company/CompanyPage.styles"
import { StyledWrapper as PostDetailStyledWrapper } from "../../src/routes/Detail/PostDetail/PostDetail.styles"
import { createTheme } from "../../src/styles/theme"
import { zIndexes } from "../../src/styles/zIndexes"
import { createMemoryStorage } from "./helpers/editorStudioTestHarness"
import {
  materializePlaywrightJsx,
  wrapPlaywrightJsxComponent,
} from "./helpers/materializePlaywrightJsx"
import { SimpleDomElement } from "./helpers/simpleMockDom"

const pw = <P extends object>(Comp: ComponentType<P>) =>
  wrapPlaywrightJsxComponent(Comp) as ComponentType<P>

const TextField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) =>
  materializePlaywrightJsx(
    (RawTextField as unknown as { render: (p: TextFieldProps, r: unknown) => unknown }).render(props, ref)
  ) as ReactElement
)
const ErrorFallbackView = pw(RawErrorFallbackView)
const ProfileImage = pw(RawProfileImage)
const MarkdownEditorBlockMenuPopover = pw(RawMarkdownEditorBlockMenuPopover)
const QuickSearchPalette = pw(RawQuickSearchPalette)
const LanguageProvider = pw(RawLanguageProvider)
const CompanyDownloadPageView = pw(RawCompanyDownloadPageView)
const EditorMobileSheetContainer = pw(RawEditorMobileSheetContainer)

const lightTheme = createTheme({ scheme: "light" })

class ReactDomNodeStub {
  nodeType: number
  nodeName: string
  tagName: string
  namespaceURI = "http://www.w3.org/1999/xhtml"
  ownerDocument: unknown
  parentNode: ReactDomNodeStub | null = null
  childNodes: ReactDomNodeStub[] = []
  attributes = new Map<string, string>()
  listeners = new Map<string, Set<(event: unknown) => void>>()
  style: Record<string, string> = {}
  value = ""
  type = ""
  tabIndex = 0
  disabled = false
  text = ""
  focused = false
  focusCount = 0

  constructor(nodeType: number, name: string, ownerDocument: unknown) {
    this.nodeType = nodeType
    this.nodeName = name
    this.tagName = name
    this.ownerDocument = ownerDocument
  }

  get firstChild(): ReactDomNodeStub | null {
    return this.childNodes[0] ?? null
  }

  get nextSibling(): ReactDomNodeStub | null {
    if (!this.parentNode) return null
    const idx = this.parentNode.childNodes.indexOf(this)
    return idx >= 0 ? (this.parentNode.childNodes[idx + 1] ?? null) : null
  }

  get textContent(): string {
    if (this.nodeType === 3) return this.text
    return this.childNodes.length > 0
      ? this.childNodes.map((child) => child.textContent).join("")
      : this.text
  }

  set textContent(val: string) {
    this.text = String(val ?? "")
    this.childNodes = []
  }

  appendChild(child: ReactDomNodeStub): ReactDomNodeStub {
    if (child.parentNode) child.parentNode.removeChild(child)
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }

  insertBefore(newChild: ReactDomNodeStub, refChild: ReactDomNodeStub | null): ReactDomNodeStub {
    if (!refChild) return this.appendChild(newChild)
    if (newChild.parentNode) newChild.parentNode.removeChild(newChild)
    const idx = this.childNodes.indexOf(refChild)
    newChild.parentNode = this
    if (idx === -1) this.childNodes.push(newChild)
    else this.childNodes.splice(idx, 0, newChild)
    return newChild
  }

  removeChild(child: ReactDomNodeStub): ReactDomNodeStub {
    const idx = this.childNodes.indexOf(child)
    if (idx >= 0) {
      this.childNodes.splice(idx, 1)
      child.parentNode = null
    }
    return child
  }

  setAttribute(name: string, val: string) {
    this.attributes.set(name, String(val))
    if (name === "tabindex") this.tabIndex = Number(val)
  }

  getAttribute(name: string): string | null {
    if (name === "tabindex" && this.attributes.has("tabindex")) {
      return this.attributes.get("tabindex") ?? null
    }
    return this.attributes.get(name) ?? null
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  hasAttribute(name: string) {
    return this.attributes.has(name)
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(handler)
  }

  removeEventListener(type: string, handler: (event: unknown) => void) {
    this.listeners.get(type)?.delete(handler)
  }

  contains(other: unknown): boolean {
    let cur = other as ReactDomNodeStub | null
    while (cur) {
      if (cur === this) return true
      cur = cur.parentNode
    }
    return false
  }

  focus() {
    this.focused = true
    this.focusCount += 1
    const doc = this.ownerDocument as { activeElement?: unknown } | null
    if (doc) doc.activeElement = this
  }

  matchesSelector(selector: string): boolean {
    if (selector === '[role="tab"]') return this.getAttribute("role") === "tab"
    if (selector === '[role="option"]') return this.getAttribute("role") === "option"
    if (selector === '[role="tablist"]') return this.getAttribute("role") === "tablist"
    if (selector.startsWith("#")) return this.getAttribute("id") === selector.slice(1)
    return this.tagName.toLowerCase() === selector.toLowerCase()
  }

  querySelectorAll(selector: string): ReactDomNodeStub[] {
    const out: ReactDomNodeStub[] = []
    for (const child of this.childNodes) {
      if (child.matchesSelector(selector)) out.push(child)
      out.push(...child.querySelectorAll(selector))
    }
    return out
  }

  querySelector(selector: string): ReactDomNodeStub | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  scrollIntoView() {}
}

class StubHtmlElement extends ReactDomNodeStub {}
class StubIframeElement extends ReactDomNodeStub {}

const withDomGlobals = async <T>(
  run: (env: {
    docObj: Record<string, unknown>
    winObj: Record<string, unknown>
    bodyEl: ReactDomNodeStub
    winListeners: Map<string, Set<(e: unknown) => void>>
    createContainer: () => ReactDomNodeStub
  }) => Promise<T> | T
) => {
  const prevWin = Object.getOwnPropertyDescriptor(globalThis, "window")
  const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
  const prevHtmlEl = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement")
  const prevNode = Object.getOwnPropertyDescriptor(globalThis, "Node")
  const prevElement = Object.getOwnPropertyDescriptor(globalThis, "Element")
  const prevIframe = Object.getOwnPropertyDescriptor(globalThis, "HTMLIFrameElement")
  const prevActEnv = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
  const prevMouseEvent = Object.getOwnPropertyDescriptor(globalThis, "MouseEvent")

  const winListeners = new Map<string, Set<(event: unknown) => void>>()
  const docListeners = new Map<string, Set<(event: unknown) => void>>()

  const docObj: Record<string, unknown> = {
    nodeType: 9,
    activeElement: null,
    createElement: (tag: string) => new StubHtmlElement(1, tag.toUpperCase(), docObj),
    createElementNS: (_ns: string, tag: string) => new StubHtmlElement(1, tag.toUpperCase(), docObj),
    createTextNode: (text: string) => {
      const node = new ReactDomNodeStub(3, "#text", docObj)
      node.text = text
      return node
    },
    createComment: (text: string) => {
      const node = new ReactDomNodeStub(8, "#comment", docObj)
      node.text = text
      return node
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      if (!docListeners.has(type)) docListeners.set(type, new Set())
      docListeners.get(type)?.add(handler)
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      docListeners.get(type)?.delete(handler)
    },
    dispatchEvent(event: { type: string }) {
      for (const listener of [...(docListeners.get(event.type) ?? [])]) listener(event)
    },
  }
  const headEl = new StubHtmlElement(1, "HEAD", docObj)
  const bodyEl = new StubHtmlElement(1, "BODY", docObj)
  bodyEl.style = { overflow: "" }
  const htmlEl = new StubHtmlElement(1, "HTML", docObj)
  htmlEl.setAttribute("lang", "ko")
  docObj.head = headEl
  docObj.body = bodyEl
  docObj.documentElement = htmlEl
  docObj.querySelector = (selector: string) => bodyEl.querySelector(selector)
  docObj.querySelectorAll = (selector: string) => bodyEl.querySelectorAll(selector)

  const winObj: Record<string, unknown> = {
    innerWidth: 1280,
    innerHeight: 840,
    location: {
      hostname: "localhost",
      origin: "http://localhost:3000",
      href: "http://localhost:3000/",
      pathname: "/",
      search: "",
      hash: "",
    },
    HTMLElement: StubHtmlElement,
    HTMLIFrameElement: StubIframeElement,
    Element: ReactDomNodeStub,
    Node: ReactDomNodeStub,
    document: docObj,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener(type: string, handler: (event: unknown) => void) {
      if (!winListeners.has(type)) winListeners.set(type, new Set())
      winListeners.get(type)?.add(handler)
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      winListeners.get(type)?.delete(handler)
    },
    dispatchEvent(event: { type: string }) {
      for (const listener of [...(winListeners.get(event.type) ?? [])]) listener(event)
    },
  }
  docObj.defaultView = winObj

  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true })
  Object.defineProperty(globalThis, "Node", { configurable: true, writable: true, value: ReactDomNodeStub })
  Object.defineProperty(globalThis, "Element", { configurable: true, writable: true, value: ReactDomNodeStub })
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, writable: true, value: StubHtmlElement })
  Object.defineProperty(globalThis, "HTMLIFrameElement", { configurable: true, writable: true, value: StubIframeElement })
  Object.defineProperty(globalThis, "MouseEvent", { configurable: true, writable: true, value: class {} })
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: winObj })
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: docObj })
  __resetBodyScrollLockForTests()

  const createContainer = () => {
    const rootEl = new StubHtmlElement(1, "DIV", docObj)
    bodyEl.appendChild(rootEl)
    return rootEl
  }

  try {
    return await run({ docObj, winObj, bodyEl, winListeners, createContainer })
  } finally {
    __resetBodyScrollLockForTests()
    const restore = (key: string, desc: PropertyDescriptor | undefined) => {
      if (desc) Object.defineProperty(globalThis, key, desc)
      else delete (globalThis as Record<string, unknown>)[key]
    }
    restore("window", prevWin)
    restore("document", prevDoc)
    restore("HTMLElement", prevHtmlEl)
    restore("Node", prevNode)
    restore("Element", prevElement)
    restore("HTMLIFrameElement", prevIframe)
    restore("IS_REACT_ACT_ENVIRONMENT", prevActEnv)
    restore("MouseEvent", prevMouseEvent)
  }
}

test.describe("P1 safety, accessibility, mobile touch, layer, motion, i18n & web API regressions", () => {
  test("useModalFocusTrap closes on popstate and always releases body scroll lock on cleanup even when paused", async () => {
    await withDomGlobals(async ({ bodyEl, winObj, winListeners, createContainer }) => {
      const container = createContainer()
      const root = createRoot(container as unknown as Element)

      let closeCount = 0
      const Probe = ({ open, paused }: { open: boolean; paused: boolean }) => {
        const ref = useRef<HTMLDivElement | null>(null)
        useModalFocusTrap({
          open,
          onClose: () => {
            closeCount += 1
          },
          containerRef: ref,
          paused,
          lockScroll: true,
        })
        return null
      }

      await act(async () => {
        root.render(createElement(Probe, { open: true, paused: false }))
      })
      expect(bodyEl.style.overflow).toBe("hidden")
      expect(winListeners.get("popstate")?.size).toBe(1)

      await act(async () => {
        ;(winObj.dispatchEvent as (e: { type: string }) => void)({ type: "popstate" })
      })
      expect(closeCount).toBe(1)
      expect(bodyEl.style.overflow).toBe("")

      await act(async () => {
        root.render(createElement(Probe, { open: false, paused: false }))
      })
      expect(winListeners.get("popstate")?.size ?? 0).toBe(0)

      await act(async () => {
        root.render(createElement(Probe, { open: true, paused: true }))
      })
      expect(bodyEl.style.overflow).toBe("hidden")

      await act(async () => {
        root.unmount()
      })
      expect(bodyEl.style.overflow).toBe("")
      expect(winListeners.get("popstate")?.size ?? 0).toBe(0)
    })
  })

  test("QuickSearchPalette renders option buttons directly inside li[role=none] and updates stylesheet selectors", async () => {
    const styleHtml = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(QuickSearchDialog, null, createElement("li", { role: "none" })),
      })
    )
    expect(styleHtml).toContain('li[role="none"]')
    expect(styleHtml).toContain('.qsItemButton[aria-selected="true"]')
    expect(styleHtml).not.toContain('li[role="option"]')

    const prevFetch = globalThis.fetch
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount += 1
      return new Response(
        JSON.stringify({
          content: [
            {
              id: 10,
              title: "Search Hit",
              slug: "search-hit",
              summary: "Summary",
              summarySource: "MANUAL",
              published: true,
              listed: true,
              tags: ["Test"],
              createdAt: "2026-10-01T00:00:00Z",
            },
          ],
          pageable: { pageNumber: 1, pageSize: 5, totalElements: 1, totalPages: 1 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }) as typeof fetch

    const mockRouter = {
      pathname: "/",
      route: "/",
      asPath: "/",
      query: {},
      push: async () => true,
      replace: async () => true,
      reload: () => {},
      back: () => {},
      forward: () => {},
      prefetch: async () => {},
      beforePopState: () => {},
      events: { on: () => {}, off: () => {}, emit: () => {} },
      isFallback: false,
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
    }

    try {
      await withDomGlobals(async ({ bodyEl, createContainer }) => {
        const container = createContainer()
        const root = createRoot(container as unknown as Element)
        await act(async () => {
          root.render(
            createElement(
              RouterContext.Provider,
              { value: mockRouter as never },
              createElement(ThemeProvider, {
                theme: lightTheme,
                children: createElement(LanguageProvider, {
                  initialLanguage: "ko",
                  children: createElement(QuickSearchPalette, { open: true, onClose: () => {} }),
                }),
              })
            )
          )
        })
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 60))
        })

        expect(fetchCount).toBe(1)
        const options = bodyEl.querySelectorAll('[role="option"]')
        expect(options.length).toBe(1)
        expect(options[0]?.tagName).toBe("BUTTON")
        expect(options[0]?.getAttribute("aria-selected")).toBe("true")
        expect(options[0]?.getAttribute("tabindex")).toBe("-1")
        expect(options[0]?.parentNode?.tagName).toBe("LI")
        expect(options[0]?.parentNode?.getAttribute("role")).toBe("none")

        await act(async () => {
          root.unmount()
        })
      })
    } finally {
      globalThis.fetch = prevFetch
    }
  })

  test("CompanyDownloadPageView connects roving tabindex tablist and Arrow/Home/End keys to #desktop-app", async () => {
    const html = renderToStaticMarkup(
      createElement(CompanyDownloadPageView, {
        initialOs: "windows",
        hasExplicitOsQuery: true,
        surfaceUrl: "/company/download",
        companyUrl: "/company",
      })
    )

    expect(html).toContain('id="os-tab-macos"')
    expect(html).toContain('id="os-tab-windows"')
    expect(html).toContain('id="os-tab-linux"')
    expect(html).toContain('role="tabpanel"')
    expect(html).toContain('aria-labelledby="os-tab-windows"')
    expect(html).not.toContain("aria-controls=")
    expect(html).toMatch(/id="os-tab-windows"[^>]*aria-selected="true"[^>]*tabindex="0"/)
    expect(html).toMatch(/id="os-tab-macos"[^>]*aria-selected="false"[^>]*tabindex="-1"/)

    const navHtml = renderToStaticMarkup(createElement(StickyOsNavInner, { role: "tablist" }))
    expect(navHtml).toContain("flex-wrap:nowrap")
    expect(navHtml).toContain("overflow-x:auto")

    await withDomGlobals(async ({ winObj, createContainer }) => {
      Object.assign(winObj, {
        location: { href: "https://blog.test/company/download?os=macos" },
        history: { replaceState: () => {} },
      })
      const container = createContainer()
      const root = createRoot(container as unknown as Element)
      await act(async () => {
        root.render(
          createElement(CompanyDownloadPageView, {
            initialOs: "macos",
            hasExplicitOsQuery: true,
            surfaceUrl: "/company/download",
            companyUrl: "/company",
          })
        )
      })

      const tablist = container.querySelector('[role="tablist"]')
      const panel = container.querySelector("#desktop-app")
      expect(tablist).not.toBeNull()
      expect(panel?.getAttribute("aria-labelledby")).toBe("os-tab-macos")

      const invokeReactKey = (key: string) => {
        const reactPropsKey = Object.keys(tablist!).find((k) => k.startsWith("__reactProps$"))
        const props = reactPropsKey ? (tablist as unknown as Record<string, { onKeyDown?: (e: unknown) => void }>)[reactPropsKey] : null
        props?.onKeyDown?.({
          key,
          currentTarget: tablist,
          preventDefault: () => {},
        })
      }

      await act(async () => {
        invokeReactKey("ArrowRight")
      })
      expect(panel?.getAttribute("aria-labelledby")).toBe("os-tab-windows")
      const windowsTab = container.querySelector("#os-tab-windows")
      expect(windowsTab?.getAttribute("tabindex")).toBe("0")
      expect(windowsTab?.focused).toBe(true)

      await act(async () => {
        invokeReactKey("End")
      })
      expect(panel?.getAttribute("aria-labelledby")).toBe("os-tab-linux")
      expect(container.querySelector("#os-tab-linux")?.focused).toBe(true)

      await act(async () => {
        invokeReactKey("Home")
      })
      expect(panel?.getAttribute("aria-labelledby")).toBe("os-tab-macos")

      await act(async () => {
        invokeReactKey("ArrowLeft")
      })
      expect(panel?.getAttribute("aria-labelledby")).toBe("os-tab-linux")

      await act(async () => {
        root.unmount()
      })
    })
  })

  test("Coarse pointer CSS ensures 16px inputs and 44px touch targets without violating PostDetail rules", () => {
    const cssHtml = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(
          "div",
          null,
          createElement(TextField, { fieldSize: "sm" }),
          createElement(SortSelect, null),
          createElement(EditorInspector, null),
          createElement(PostDetailStyledWrapper, null),
          createElement(AboutStyledWrapper, null),
          createElement(NavLink, null),
          createElement(HeaderAction, null),
          createElement(FooterGroup, null, createElement("a", { href: "/" }, "Link")),
          createElement(DownloadAnnouncementInner, null, createElement("a", { href: "/" }, "Note")),
          createElement(VersionChip, null)
        ),
      })
    )

    expect(cssHtml).toContain("font-size:1rem")
    expect(cssHtml).toContain("min-height:44px")
    expect(cssHtml).toContain("min-width:44px")
  })

  test("zIndexes enforce modal overlay hierarchy and lightbox/commandPalette/scrim tokens", () => {
    expect(zIndexes.mobileNavOverlay).toBe(100)
    expect(zIndexes.mobileNavOverlay).toBeGreaterThan(90)
    expect(zIndexes.lightbox).toBe(220)
    expect(zIndexes.lightbox).toBeGreaterThan(zIndexes.publishModal)
    expect(zIndexes.commandPalette).toBeGreaterThan(zIndexes.lightbox)
    expect(zIndexes.commandPalette).toBeLessThan(zIndexes.confirmDialog)

    const layerHtml = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(
          "div",
          null,
          createElement(YarlPortal, null),
          createElement(PaletteScrim, null),
          createElement(MobileDrawerScrim, null),
          createElement(EditorMobileSheetScrim, null)
        ),
      })
    )

    expect(layerHtml).toContain("z-index:220;")
    expect(layerHtml).toContain(`z-index:${zIndexes.commandPalette};`)
    expect(layerHtml).toContain("z-index:100;")
    expect(layerHtml).toContain("z-index:155;")
  })

  test("getPreferredScrollBehavior returns auto under reduced motion and smooth otherwise", () => {
    const prevWin = Object.getOwnPropertyDescriptor(globalThis, "window")
    delete (globalThis as Record<string, unknown>).window
    expect(getPreferredScrollBehavior()).toBe("smooth")

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        matchMedia: (query: string) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
        }),
      },
    })
    expect(getPreferredScrollBehavior()).toBe("auto")

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: { matchMedia: () => ({ matches: false }) },
    })
    expect(getPreferredScrollBehavior()).toBe("smooth")

    if (prevWin) Object.defineProperty(globalThis, "window", prevWin)
    else delete (globalThis as Record<string, unknown>).window
  })

  test("ErrorFallbackView only reads getClientStoredLanguage on global variant, not surface variant", () => {
    const prevWin = Object.getOwnPropertyDescriptor(globalThis, "window")
    const storage = createMemoryStorage()
    storage.setItem(LANGUAGE_STORAGE_KEY, "en")
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: { localStorage: storage },
    })

    try {
      const surfaceHtml = renderToStaticMarkup(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(LanguageProvider, {
            initialLanguage: "ko",
            children: createElement(ErrorFallbackView, { variant: "surface" }),
          }),
        })
      )
      expect(surfaceHtml).toContain("콘텐츠를 표시하지 못했습니다")

      const globalHtml = renderToStaticMarkup(
        createElement(ThemeProvider, {
          theme: lightTheme,
          children: createElement(ErrorFallbackView, { variant: "global" }),
        })
      )
      expect(globalHtml).toContain("Something went wrong")
    } finally {
      if (prevWin) Object.defineProperty(globalThis, "window", prevWin)
      else delete (globalThis as Record<string, unknown>).window
    }
  })

  test("ProfileImage localizes error fallback aria-label and emits React 19 fetchPriority", () => {
    const koHtml = renderToStaticMarkup(
      createElement(LanguageProvider, {
        initialLanguage: "ko",
        children: createElement(ProfileImage, { src: "", alt: "작성자" }),
      })
    )
    expect(koHtml).toContain('aria-label="작성자 이미지를 불러올 수 없습니다."')

    const enHtml = renderToStaticMarkup(
      createElement(LanguageProvider, {
        initialLanguage: "en",
        children: createElement(ProfileImage, { src: "", alt: "Author" }),
      })
    )
    expect(enHtml).toContain('aria-label="Failed to load Author image."')

    const imgHtml = renderToStaticMarkup(
      createElement(LanguageProvider, {
        initialLanguage: "en",
        children: createElement(ProfileImage, { src: "/avatar.png", alt: "Author", priority: true }),
      })
    )
    expect(imgHtml).toContain('fetchPriority="high"')
  })

  test("syncResponsiveTables uses Item N for English documents and 항목 N otherwise", () => {
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const prevCell = Object.getOwnPropertyDescriptor(globalThis, "HTMLTableCellElement")

    class StubTableCell {
      tagName: string
      colSpan = 1
      rowSpan = 1
      textContent = ""
      attrs = new Map<string, string>()
      constructor(tagName: "TH" | "TD", textContent = "") {
        this.tagName = tagName
        this.textContent = textContent
      }
      getAttribute(name: string) {
        return this.attrs.get(name) ?? null
      }
      setAttribute(name: string, val: string) {
        this.attrs.set(name, val)
      }
    }

    const runWithLang = (lang: string) => {
      const docEl = Object.assign(new SimpleDomElement("html"), { lang })
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: { documentElement: docEl },
      })
      Object.defineProperty(globalThis, "HTMLTableCellElement", {
        configurable: true,
        writable: true,
        value: StubTableCell,
      })
      const thCell = new StubTableCell("TH", "")
      const tdCell = new StubTableCell("TD", "Value")
      const headerRow = { cells: [thCell] }
      const bodyRow = { children: [tdCell] }
      const classSet = new Set<string>()
      const table = {
        classList: {
          contains: (c: string) => classSet.has(c),
          add: (c: string) => classSet.add(c),
        },
        tHead: { rows: [headerRow] },
        tBodies: [{ rows: [bodyRow] }],
      }
      const root = {
        querySelector: (sel: string) => (sel === "table" ? table : null),
        querySelectorAll: (sel: string) => (sel === "table" ? [table] : []),
      } as unknown as HTMLElement
      syncResponsiveTables(root)
      return tdCell.getAttribute("data-label")
    }

    try {
      expect(runWithLang("en-US")).toBe("Item 1")
      expect(runWithLang("ko")).toBe("항목 1")
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
      if (prevCell) Object.defineProperty(globalThis, "HTMLTableCellElement", prevCell)
      else delete (globalThis as Record<string, unknown>).HTMLTableCellElement
    }
  })

  test("MarkdownEditorBlockChrome labels keep exact Korean copy and translate cleanly to English", () => {
    const ko = getBlockChromeLabels("ko")
    expect(ko.selHighlight).toBe("선택 영역 하이라이트")
    expect(ko.selHeading2).toBe("선택 영역 제목 2")
    expect(ko.gutterPlus).toBe("현재 줄에 블록 삽입")
    expect(ko.blockMenuAria).toBe("블록 작업 메뉴")
    expect(ko.selLink).toBe("선택 영역 링크")
    expect(getColorSwatchLabel("ko", "default", "글자 기본색")).toBe("글자 기본색")
    expect(getColorSwatchLabel("ko", "default", "글자 기본색", true)).toBe("선택 영역 글자 기본색")

    const en = getBlockChromeLabels("en")
    expect(en.selHighlight).toBe("Highlight selection")
    expect(en.blockMenuAria).toBe("Block actions menu")
    expect(getColorSwatchLabel("en", "sky", "글자 파란색")).toBe("Blue text color")
    expect(getColorSwatchLabel("en", "sky", "글자 파란색", true)).toBe("Selection blue text color")

    const menuEnHtml = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme: lightTheme,
        children: createElement(LanguageProvider, {
          initialLanguage: "en",
          children: createElement(MarkdownEditorBlockMenuPopover, {
            blockMenuRef: { current: null },
            position: { top: 0, left: 0 },
            activeBlockKind: "paragraph",
            onKeyDown: () => {},
            onClose: () => {},
            onApplySnippet: () => {},
            onApplyListCommand: () => {},
            onStripBlockPrefix: () => {},
            onApplyLineCommand: () => {},
            onApplyColorSwatch: () => {},
          }),
        }),
      })
    )
    expect(menuEnHtml).toContain('aria-label="Block actions menu"')
    expect(menuEnHtml).toContain("Turn into paragraph")
  })

  test("openMermaidOverlay retains icon span alongside label span across initial render and setVisual updates", async () => {
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const prevNav = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    const bodyEl = new SimpleDomElement("body")
    const docEl = new SimpleDomElement("html")
    docEl.setAttribute("data-color-scheme", "light")

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        activeElement: null,
        body: bodyEl,
        documentElement: docEl,
        createElement: (tag: string) => new SimpleDomElement(tag),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: { clipboard: { writeText: async () => {} } },
    })

    try {
      const cleanup = openMermaidOverlay("<svg></svg>", null, "graph TD; A-->B;")
      const actionsBar = bodyEl.children[0].children[0].children[0]
      const copyBtn = actionsBar.children.find(
        (btn) => btn.getAttribute("aria-label") === "Mermaid 원본 코드 복사"
      )
      expect(copyBtn).toBeDefined()
      expect(copyBtn?.children.length).toBe(2)
      expect(copyBtn?.children[0]?.innerHTML).toContain("<svg")
      expect(copyBtn?.children[1]?.textContent).toBe("코드 복사")

      copyBtn?.dispatch("click")
      await Promise.resolve()
      expect(copyBtn?.children.length).toBe(2)
      expect(copyBtn?.children[0]?.innerHTML).toContain("<svg")
      expect(copyBtn?.children[1]?.textContent).toBe("복사됨")
      cleanup?.()
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
      if (prevNav) Object.defineProperty(globalThis, "navigator", prevNav)
      else delete (globalThis as Record<string, unknown>).navigator
    }
  })

  test("mergeSortedDirtyRegions does not mutate input order and revalidateSavedPost uses AbortSignal", async () => {
    const input = [
      { from: 20, to: 30 },
      { from: 0, to: 10 },
      { from: 8, to: 15 },
    ]
    const merged = mergeSortedDirtyRegions(input)
    expect(input[0]).toEqual({ from: 20, to: 30 })
    expect(merged).toEqual([
      { from: 0, to: 15 },
      { from: 20, to: 30 },
    ])

    const prevFetch = globalThis.fetch
    let seenSignal: AbortSignal | null | undefined
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seenSignal = init?.signal
      return new Response("{}", { status: 200 })
    }) as typeof fetch
    try {
      await revalidateSavedPost(123)
      expect(seenSignal).toBeInstanceOf(AbortSignal)
    } finally {
      globalThis.fetch = prevFetch
    }
  })

  test("EditorMobileSheetContainer applies dialog semantics and scroll lock only on <=820px mobile viewports", async () => {
    await withDomGlobals(async ({ bodyEl, winObj, createContainer }) => {
      winObj.innerWidth = 390
      winObj.matchMedia = (query: string) => ({
        matches: query.includes("820px"),
        addEventListener: () => {},
        removeEventListener: () => {},
      })
      const mobileRoot = createRoot(createContainer() as unknown as Element)
      let mobileCloseCalls = 0
      await act(async () => {
        mobileRoot.render(
          createElement(EditorMobileSheetContainer, {
            open: true,
            onClose: () => {
              mobileCloseCalls += 1
            },
            closeLabel: "닫기",
            children: ({ panelRef, panelProps }) =>
              createElement(
                "aside",
                { ref: panelRef, "data-testid": "sheet", ...panelProps },
                createElement("button", { type: "button" }, "Action")
              ),
          })
        )
      })
      const mobileAside = bodyEl.querySelector("aside")
      expect(mobileAside?.getAttribute("role")).toBe("dialog")
      expect(mobileAside?.getAttribute("aria-modal")).toBe("true")
      expect(bodyEl.style.overflow).toBe("hidden")

      await act(async () => {
        ;(winObj.dispatchEvent as (e: { type: string }) => void)({ type: "popstate" })
      })
      expect(mobileCloseCalls).toBe(1)
      expect(bodyEl.style.overflow).toBe("")
      await act(async () => {
        mobileRoot.unmount()
      })

      winObj.innerWidth = 1280
      winObj.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      })
      const desktopContainer = createContainer()
      const desktopRoot = createRoot(desktopContainer as unknown as Element)
      await act(async () => {
        desktopRoot.render(
          createElement(EditorMobileSheetContainer, {
            open: true,
            onClose: () => {},
            closeLabel: "닫기",
            children: ({ panelRef, panelProps }) =>
              createElement("aside", { ref: panelRef, ...panelProps }, "Desktop Sidebar"),
          })
        )
      })
      const desktopAside = desktopContainer.querySelector("aside")
      expect(desktopAside?.getAttribute("role")).toBeNull()
      expect(desktopAside?.getAttribute("aria-modal")).toBeNull()
      expect(bodyEl.style.overflow).toBe("")
      await act(async () => {
        desktopRoot.unmount()
      })
    })
  })
})
