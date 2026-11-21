import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@emotion/react"
import { expect, test } from "@playwright/test"
import { materializePlaywrightJsx } from "./helpers/materializePlaywrightJsx"
import { createTheme } from "../../src/styles/theme"
import { LanguageProvider } from "../../src/libs/language"
import MarkdownRenderer from "../../src/libs/markdown/MarkdownRenderer"
import {
  CODE_COLLAPSED_BIT,
  CODE_COPIED_BIT,
  CODE_SCROLLABLE_BIT,
  CODE_WRAPPED_BIT,
  isCodeShellHorizontallyScrollable,
  packCodeBlockUiState,
} from "../../src/libs/markdown/components/PrettyCodeBlock"
import { syncTrustedCodeBlockScrollableAttr } from "../../src/libs/markdown/useTrustedHtmlCodeBlocksEffect"
import {
  collectTocFromArticle,
  shouldSyncTocFromMutations,
} from "../../src/routes/Detail/PostDetail/PostDetailTocModel"
import { applyRenderedMermaidDom } from "../../src/libs/markdown/mermaidRuntimeGeometry"
import { openMermaidOverlay } from "../../src/libs/markdown/mermaidRuntimeOverlay"
import {
  attachInteractiveDiagramPanZoom,
  computeFocalPanZoom,
  installToolbarRovingFocus,
} from "../../src/libs/markdown/mermaidPanZoom"

const WORKTREE_ROOT = path.resolve(__dirname, "../..")

const renderMarkdownMarkup = (content: string, language: "ko" | "en" = "ko"): string => {
  const theme = createTheme({ scheme: "light" })
  const queryClient = new QueryClient()
  const tree = createElement(QueryClientProvider, {
    client: queryClient,
    children: createElement(ThemeProvider, {
      theme,
      children: createElement(LanguageProvider, {
        initialLanguage: language,
        children: createElement(MarkdownRenderer, {
          content,
          disableMermaid: true,
          forceScheme: "light",
        }),
      }),
    }),
  })
  return renderToStaticMarkup(materializePlaywrightJsx(tree) as ReactElement)
}

test.describe("Mermaid, CodeBlock, and Heading Anchor OSS UX regressions", () => {
  test("Heading anchor replaces raw # pseudo-element with SVG link icon, skips h1 button, and keeps TOC clean", () => {
    const markup = renderMarkdownMarkup(
      "# Body H1 Heading\n\n## Architecture Overview\n\n### Cache Invalidation"
    )

    expect(markup).toContain('<h1 id="body-h1-heading">Body H1 Heading</h1>')
    expect(markup).toContain('<h2 id="architecture-overview">Architecture Overview<button')
    expect(markup).toContain('class="aq-heading-anchor"')
    expect(markup).toContain('<svg aria-hidden="true"')

    const baseStyles = readFileSync(
      path.join(WORKTREE_ROOT, "src/libs/markdown/components/MarkdownRendererRootBaseStyles.ts"),
      "utf8"
    )
    expect(baseStyles).not.toContain('content: "#";')
    expect(baseStyles).not.toContain("opacity: 0.65;\n      min-width: 44px;\n      min-height: 44px;")
    expect(baseStyles).toContain("@media (hover: hover)")

    const anchorStatusSpan = {
      tagName: "SPAN",
      matches: (sel: string) => sel.includes(".aq-sr-only"),
      closest: (sel: string) =>
        sel.includes(".aq-heading-anchor") || sel.includes("h2") ? ({} as Element) : null,
      querySelector: () => null,
    } as unknown as Element

    expect(
      shouldSyncTocFromMutations([
        {
          type: "childList",
          target: anchorStatusSpan,
          addedNodes: [anchorStatusSpan] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        } as unknown as MutationRecord,
      ])
    ).toBe(false)

    const fakeHeading = {
      id: "architecture-overview",
      tagName: "H2",
      textContent: "Architecture Overview링크를 복사했습니다.",
      childNodes: [
        { nodeType: 3, textContent: "Architecture Overview" },
        {
          nodeType: 1,
          classList: { contains: (cls: string) => cls === "aq-heading-anchor" },
          matches: (sel: string) => sel.includes(".aq-heading-anchor"),
          textContent: "링크를 복사했습니다.",
        },
      ],
      closest: () => null,
    }
    const fakeArticle = {
      querySelectorAll: () => [fakeHeading],
    } as unknown as HTMLElement

    expect(collectTocFromArticle(fakeArticle)).toEqual([
      {
        id: "architecture-overview",
        text: "Architecture Overview",
        level: 2,
      },
    ])
  })

  test("CodeBlock uses Docusaurus overflow-gated word-wrap + SVG copy/check icons without raw 줄 바꿈 button text", () => {
    const markup = renderMarkdownMarkup('```ts title="cache.ts"\nconst ttl = 60\n```', "ko")

    expect(markup).toContain('data-scrollable="false"')
    expect(markup).toContain('class="aq-code-wrap"')
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).not.toContain(">줄 바꿈<")
    expect(markup).toContain('class="aq-code-copy-icons"')

    expect(CODE_SCROLLABLE_BIT).toBe(16)
    expect(packCodeBlockUiState(true, "copied", true, true)).toBe(
      CODE_COLLAPSED_BIT | CODE_COPIED_BIT | CODE_WRAPPED_BIT | CODE_SCROLLABLE_BIT
    )
    expect(isCodeShellHorizontallyScrollable({ scrollWidth: 420, clientWidth: 420 })).toBe(false)
    expect(isCodeShellHorizontallyScrollable({ scrollWidth: 680, clientWidth: 420 })).toBe(true)

    const mockShell = { scrollWidth: 700, clientWidth: 400 }
    const mockTrustedBlock = {
      dataset: { wrap: "false", scrollable: "false" } as Record<string, string>,
      querySelector: () => mockShell,
    } as unknown as HTMLElement
    syncTrustedCodeBlockScrollableAttr(mockTrustedBlock)
    expect(mockTrustedBlock.dataset.scrollable).toBe("true")
    mockShell.scrollWidth = 400
    syncTrustedCodeBlockScrollableAttr(mockTrustedBlock)
    expect(mockTrustedBlock.dataset.scrollable).toBe("false")
    mockTrustedBlock.dataset.wrap = "true"
    syncTrustedCodeBlockScrollableAttr(mockTrustedBlock)
    expect(mockTrustedBlock.dataset.scrollable).toBe("true")

    const codeStyles = readFileSync(
      path.join(WORKTREE_ROOT, "src/libs/markdown/components/MarkdownRendererRootCodeStyles.ts"),
      "utf8"
    )
    expect(codeStyles).toContain('.aq-code-block[data-scrollable="false"] .aq-code-wrap:not([aria-pressed="true"])')
    expect(codeStyles).toContain("touch-action: pan-y;")
    expect(codeStyles).toContain("touch-action: pan-x;")
  })

  test("Mermaid inline toolbar replaces 확대 보기 text pill with localized floating SVG icon toolbar and pan-zoom viewer", () => {
    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const makeMockEl = (tag: string): any => {
      const listeners = new Map<string, Array<(e: any) => void>>()
      const children: any[] = []
      const attrs: Record<string, string> = {}
      const dataset: Record<string, string> = {}
      const style: Record<string, any> = {
        setProperty(k: string, v: string) {
          this[k] = v
        },
      }
      const el: any = {
        tagName: tag.toUpperCase(),
        type: "",
        className: "",
        title: "",
        tabIndex: 0,
        textContent: "",
        innerHTML: "",
        dataset,
        style,
        children,
        hasAttribute(k: string) {
          return k in attrs
        },
        setAttribute(k: string, v: string) {
          attrs[k] = v
        },
        getAttribute(k: string) {
          return attrs[k] ?? null
        },
        removeAttribute(k: string) {
          delete attrs[k]
        },
        appendChild(child: any) {
          child.parentElement = el
          children.push(child)
          return child
        },
        remove() {
          if (!el.parentElement) return
          const idx = el.parentElement.children.indexOf(el)
          if (idx >= 0) el.parentElement.children.splice(idx, 1)
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 600, height: 400 }
        },
        querySelector(sel: string) {
          for (const child of children) {
            if (sel === "svg" && child.tagName === "SVG") return child
            if (sel.startsWith(".") && String(child.className).split(/\s+/).includes(sel.slice(1))) {
              return child
            }
            const nested = child.querySelector?.(sel)
            if (nested) return nested
          }
          return null
        },
        querySelectorAll(sel: string) {
          const matches: any[] = []
          const visit = (node: any) => {
            for (const child of node.children ?? []) {
              if (
                sel.startsWith(".") &&
                String(child.className).split(/\s+/).includes(sel.slice(1))
              ) {
                matches.push(child)
              }
              visit(child)
            }
          }
          visit(el)
          return matches
        },
        addEventListener(type: string, fn: (e: any) => void) {
          const list = listeners.get(type) ?? []
          list.push(fn)
          listeners.set(type, list)
        },
        removeEventListener(type: string, fn: (e: any) => void) {
          const list = listeners.get(type)
          if (!list) return
          const idx = list.indexOf(fn)
          if (idx >= 0) list.splice(idx, 1)
        },
        trigger(type: string, event: any = {}) {
          for (const fn of [...(listeners.get(type) ?? [])]) fn(event)
        },
        focus() {
          ;(globalThis.document as any).activeElement = el
        },
      }
      return el
    }

    const htmlEl = makeMockEl("html")
    htmlEl.lang = "en"
    const bodyEl = makeMockEl("body")
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        activeElement: null,
        body: bodyEl,
        documentElement: htmlEl,
        createElement: (tag: string) => makeMockEl(tag),
        addEventListener() {},
        removeEventListener() {},
      },
    })

    try {
      const block = makeMockEl("pre")
      const stage = makeMockEl("div")
      const svg = makeMockEl("svg")
      block.appendChild(stage)
      stage.appendChild(svg)

      let overlayOpened = 0
      applyRenderedMermaidDom({
        block,
        stage,
        svgElement: svg,
        geometry: {
          roundedWidth: 480,
          roundedHeight: 240,
          stageWidth: 480,
          usesDesktopWideLane: false,
          needsExpandAction: true,
          wideBleedLeft: 0,
          wideBleedRight: 0,
        },
        sourceText: "flowchart LR\n  A --> B",
        onTriggerOverlay: () => {
          overlayOpened += 1
        },
      })

      expect(stage.title).toBe("Click to expand diagram")
      const controls = block.querySelector(".aq-mermaid-controls")
      expect(controls).not.toBeNull()
      expect(controls.getAttribute("role")).toBe("toolbar")
      expect(controls.getAttribute("focusgroup")).toBe("toolbar wrap")

      const expandBtn = block.querySelector(".aq-mermaid-expand-btn")
      expect(expandBtn).not.toBeNull()
      expect(expandBtn.textContent).not.toContain("확대 보기")
      expect(expandBtn.getAttribute("aria-label")).toBe("Expand diagram")
      expect(expandBtn.innerHTML).toContain("<svg")

      const copyBtn = block.querySelector(".aq-mermaid-copy-btn")
      expect(copyBtn).not.toBeNull()
      expect(copyBtn.getAttribute("aria-label")).toBe("Copy Mermaid source code")

      // Roving tabindex arrow navigation
      copyBtn.focus()
      controls.trigger("keydown", { key: "ArrowRight", preventDefault() {} })
      expect((globalThis.document as any).activeElement).toBe(expandBtn)
      expect(expandBtn.tabIndex).toBe(0)
      expect(copyBtn.tabIndex).toBe(-1)

      expandBtn.trigger("click")
      expect(overlayOpened).toBe(1)

      // Pure focal pan-zoom + interactive drag/wheel/pinch/dblclick
      const zoomedFocal = computeFocalPanZoom({ scale: 1, panX: 0, panY: 0 }, 2, 100, -50)
      expect(zoomedFocal).toEqual({ scale: 2, panX: -100, panY: 50 })

      const panStage = makeMockEl("div")
      const panCanvas = makeMockEl("div")
      const controller = attachInteractiveDiagramPanZoom({ stage: panStage, canvas: panCanvas })
      panStage.trigger("pointerdown", { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
      panStage.trigger("pointermove", { pointerId: 1, clientX: 145, clientY: 120 })
      panStage.trigger("pointerup", { pointerId: 1 })
      expect(controller.getState()).toEqual({ scale: 1, panX: 45, panY: 20 })

      // 2-pointer pinch zoom
      controller.reset()
      panStage.trigger("pointerdown", { pointerId: 1, button: 0, clientX: 250, clientY: 200 })
      panStage.trigger("pointerdown", { pointerId: 2, button: 0, clientX: 350, clientY: 200 })
      panStage.trigger("pointermove", { pointerId: 2, clientX: 450, clientY: 200 })
      expect(controller.getState().scale).toBe(2)
      panStage.trigger("pointerup", { pointerId: 1 })
      panStage.trigger("pointerup", { pointerId: 2 })

      // Double-click resets when zoomed
      panStage.trigger("dblclick", { clientX: 300, clientY: 200 })
      expect(controller.getState()).toEqual({ scale: 1, panX: 0, panY: 0 })
      controller.destroy()

      const detachRoving = installToolbarRovingFocus(controls, expandBtn)
      detachRoving()

      const cleanup = openMermaidOverlay("<svg viewBox='0 0 400 200'></svg>", null, "flowchart LR\n  A --> B")
      expect(typeof cleanup).toBe("function")
      cleanup?.()
    } finally {
      if (prevDoc) {
        Object.defineProperty(globalThis, "document", prevDoc)
      } else {
        delete (globalThis as Record<string, unknown>).document
      }
    }
  })
})
