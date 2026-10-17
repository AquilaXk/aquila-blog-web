import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { EditorSelection, EditorState } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { GFM } from "@lezer/markdown"
import {
  buildDecorations,
  compositionField,
  disableMermaidField,
  editorModeField,
  pointerSelectingField,
} from "../../src/components/markdown-editor/MarkdownEditorLiveSurface"
import {
  attachStageDragPan,
  handleZoomShortcutKey,
} from "../../src/libs/markdown/mermaidRuntimeOverlay"
import { openImageLightboxOverlay } from "../../src/libs/markdown/imageLightboxOverlay"
import { buildHeadingAnchorUrl } from "../../src/libs/markdown/MarkdownRenderer"
import {
  hasPotentialFenceCharacters,
  stepFenceNormalization,
} from "../../src/libs/markdown/mermaid"
import {
  isGfmTableAt,
  stepFencedCodeState,
} from "../../src/libs/markdown/tableMetadata"

test.describe("Issue #263 Wave 4 UX & Zero Boundary Warnings", () => {
  test("E-3: inactive multi-line fenced code block decorates open, body, and close lines with card classes", () => {
    const doc = [
      "# 제목",
      "",
      "```ts",
      "const a = 1",
      "const b = 2",
      "```",
      "",
      "커서가 있는 마지막 줄",
    ].join("\n")

    const cursorAtEnd = doc.length
    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursorAtEnd),
      extensions: [
        markdown({ extensions: GFM }),
        compositionField,
        pointerSelectingField,
        editorModeField,
        disableMermaidField,
      ],
    })

    const decoSet = buildDecorations(state)
    const lineClassesByLineNumber = new Map<number, string[]>()

    decoSet.between(0, state.doc.length, (from, to, value) => {
      const spec = (value as { spec?: { class?: string } }).spec
      if (from === to && spec?.class) {
        const lineNo = state.doc.lineAt(from).number
        const existing = lineClassesByLineNumber.get(lineNo) ?? []
        existing.push(spec.class)
        lineClassesByLineNumber.set(lineNo, existing)
      }
    })

    expect(lineClassesByLineNumber.get(3)?.join(" ")).toContain("cm-live-code-line")
    expect(lineClassesByLineNumber.get(3)?.join(" ")).toContain("cm-live-code-fence-open")
    expect(lineClassesByLineNumber.get(4)?.join(" ")).toContain("cm-live-code-line")
    expect(lineClassesByLineNumber.get(4)?.join(" ")).toContain("cm-live-code-body-line")
    expect(lineClassesByLineNumber.get(5)?.join(" ")).toContain("cm-live-code-line")
    expect(lineClassesByLineNumber.get(5)?.join(" ")).toContain("cm-live-code-body-line")
    expect(lineClassesByLineNumber.get(6)?.join(" ")).toContain("cm-live-code-line")
    expect(lineClassesByLineNumber.get(6)?.join(" ")).toContain("cm-live-code-fence-close")
  })

  test("R-4: useResponsiveTableEffect runs synchronously per renderKey without persistent MutationObserver", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../src/libs/markdown/hooks/useResponsiveTableEffect.ts"),
      "utf8"
    )
    expect(source).toContain("syncResponsiveTables(root)")
    expect(source).not.toContain("new MutationObserver")
  })

  test("R-5: Mermaid overlay keyboard zoom shortcuts (+, -, 0) and stage pointer drag-panning work", () => {
    const calls: string[] = []
    let prevented = 0
    const makeKeyEvent = (key: string, mods?: Partial<KeyboardEvent>): KeyboardEvent =>
      ({
        key,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        preventDefault: () => {
          prevented += 1
        },
        ...mods,
      }) as unknown as KeyboardEvent

    const handlers = {
      onZoomIn: () => calls.push("in"),
      onZoomOut: () => calls.push("out"),
      onZoomReset: () => calls.push("reset"),
    }

    expect(handleZoomShortcutKey(makeKeyEvent("+"), handlers)).toBe(true)
    expect(handleZoomShortcutKey(makeKeyEvent("="), handlers)).toBe(true)
    expect(handleZoomShortcutKey(makeKeyEvent("-"), handlers)).toBe(true)
    expect(handleZoomShortcutKey(makeKeyEvent("_"), handlers)).toBe(true)
    expect(handleZoomShortcutKey(makeKeyEvent("0"), handlers)).toBe(true)
    expect(handleZoomShortcutKey(makeKeyEvent("+", { metaKey: true }), handlers)).toBe(false)
    expect(calls).toEqual(["in", "in", "out", "out", "reset"])
    expect(prevented).toBe(5)

    const listeners = new Map<string, (event: PointerEvent) => void>()
    const stage = {
      scrollLeft: 50,
      scrollTop: 80,
      style: { cursor: "" },
      addEventListener: (type: string, fn: (event: PointerEvent) => void) => {
        listeners.set(type, fn)
      },
      removeEventListener: (type: string) => {
        listeners.delete(type)
      },
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    } as unknown as HTMLElement

    let currentZoom = 1.5
    const detach = attachStageDragPan(stage, () => currentZoom)
    listeners.get("pointerdown")?.({ button: 0, pointerId: 1, clientX: 100, clientY: 120 } as PointerEvent)
    expect(stage.style.cursor).toBe("grabbing")

    listeners.get("pointermove")?.({ pointerId: 1, clientX: 70, clientY: 95 } as PointerEvent)
    expect(stage.scrollLeft).toBe(80)
    expect(stage.scrollTop).toBe(105)

    listeners.get("pointerup")?.({ pointerId: 1 } as PointerEvent)
    expect(stage.style.cursor).toBe("grab")

    currentZoom = 1
    listeners.get("pointerdown")?.({ button: 0, pointerId: 2, clientX: 100, clientY: 120 } as PointerEvent)
    expect(stage.style.cursor).not.toBe("grabbing")

    detach()
    expect(listeners.size).toBe(0)
  })

  test("R-5: openImageLightboxOverlay creates accessible dialog with zoom controls and restores focus on close", () => {
    const origDoc = (globalThis as Record<string, unknown>).document
    const appended: unknown[] = []
    let docKeyDown: ((event: KeyboardEvent) => void) | null = null
    try {
      const makeElem = (tag: string): Record<string, unknown> => {
        const attrs = new Map<string, string>()
        const children: Array<Record<string, unknown>> = []
        const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
        const elem: Record<string, unknown> = {
          tagName: tag.toUpperCase(),
          className: "",
          textContent: "",
          dataset: {},
          style: {
            setProperty: () => {},
          },
          children,
          setAttribute: (k: string, v: string) => attrs.set(k, v),
          getAttribute: (k: string) => attrs.get(k) ?? null,
          hasAttribute: (k: string) => attrs.has(k),
          appendChild: (child: Record<string, unknown>) => {
            children.push(child)
            return child
          },
          addEventListener: (type: string, fn: (...args: unknown[]) => void) => {
            const list = listeners.get(type) ?? []
            list.push(fn)
            listeners.set(type, list)
          },
          removeEventListener: (type: string, fn: (...args: unknown[]) => void) => {
            const list = listeners.get(type) ?? []
            listeners.set(
              type,
              list.filter((item) => item !== fn)
            )
          },
          dispatchClick: (target?: unknown) => {
            for (const fn of listeners.get("click") ?? []) {
              fn({ target: target ?? elem })
            }
          },
          remove: () => {
            const idx = appended.indexOf(elem)
            if (idx >= 0) appended.splice(idx, 1)
          },
          focus: () => {},
          querySelectorAll: () => [],
        }
        return elem
      }

      let triggerFocused = false
      const trigger = {
        isConnected: true,
        focus: () => {
          triggerFocused = true
        },
      } as unknown as HTMLElement

      ;(globalThis as Record<string, unknown>).document = {
        activeElement: trigger,
        documentElement: { style: { overflow: "" } },
        body: {
          style: { overflow: "", paddingRight: "" },
          appendChild: (node: unknown) => {
            appended.push(node)
            return node
          },
        },
        createElement: (tag: string) => makeElem(tag),
        addEventListener: (type: string, fn: (event: KeyboardEvent) => void) => {
          if (type === "keydown") docKeyDown = fn
        },
        removeEventListener: (type: string, fn: (event: KeyboardEvent) => void) => {
          if (type === "keydown" && docKeyDown === fn) docKeyDown = null
        },
      }

      const close = openImageLightboxOverlay({
        src: "https://example.com/diagram.png",
        alt: "아키텍처 다이어그램",
        caption: "시스템 구조",
        trigger,
      })

      expect(appended).toHaveLength(1)
      const backdrop = appended[0] as {
        className: string
        dataset: Record<string, string>
        getAttribute: (k: string) => string | null
      }
      expect(backdrop.className).toContain("aq-image-lightbox-backdrop")
      expect(backdrop.dataset.aqImageLightbox).toBe("true")
      expect(backdrop.getAttribute("role")).toBe("dialog")
      expect(backdrop.getAttribute("aria-modal")).toBe("true")

      const invokeDocKeyDown = docKeyDown as ((event: KeyboardEvent) => void) | null
      invokeDocKeyDown?.({
        key: "Escape",
        preventDefault: () => {},
      } as unknown as KeyboardEvent)

      expect(appended).toHaveLength(0)
      expect(triggerFocused).toBe(true)
      close?.()
    } finally {
      ;(globalThis as Record<string, unknown>).document = origDoc
    }
  })

  test("R-6: buildHeadingAnchorUrl strips existing hash and appends heading id without mutating heading textContent", () => {
    expect(buildHeadingAnchorUrl("https://blog.example.com/posts/1", "overview")).toBe(
      "https://blog.example.com/posts/1#overview"
    )
    expect(buildHeadingAnchorUrl("https://blog.example.com/posts/1#old-section", "new-section")).toBe(
      "https://blog.example.com/posts/1#new-section"
    )
  })

  test("AC-3: mermaid.ts and tableMetadata.ts cognitive complexity helpers preserve exact behavior", () => {
    expect(hasPotentialFenceCharacters("plain text paragraph")).toBe(false)
    expect(hasPotentialFenceCharacters("```ts\nconst x = 1\n```")).toBe(true)

    const normalized: string[] = []
    const marker1 = stepFenceNormalization("```ts", null, normalized)
    expect(marker1).toBe("`")
    const marker2 = stepFenceNormalization("```4", marker1, normalized)
    expect(marker2).toBeNull()
    expect(normalized).toEqual(["```ts", "```", "4"])

    const fenceOpen = stepFencedCodeState("```markdown", null)
    expect(fenceOpen).toEqual({ marker: "`", length: 3 })
    const fenceInside = stepFencedCodeState("| a | b |", fenceOpen)
    expect(fenceInside).toEqual({ marker: "`", length: 3 })
    const fenceClosed = stepFencedCodeState("```", fenceInside)
    expect(fenceClosed).toBeNull()

    const tableLines = ["| 항목 | 값 |", "| --- | --- |", "| A | 1 |"]
    expect(isGfmTableAt(tableLines, 0)).toBe(true)
    expect(isGfmTableAt(tableLines, 1)).toBe(false)
  })

  test("AC-2: all 6 refactored production files and extracted modules stay at or below 600 lines", () => {
    const repoRoot = path.resolve(__dirname, "../..")
    const boundedFiles = [
      "src/layouts/RootLayout/Header/NavBar.tsx",
      "src/layouts/RootLayout/Header/NavBarSearchModel.tsx",
      "src/routes/Admin/AdminShell.tsx",
      "src/routes/Admin/AdminShellTopBar.styles.ts",
      "src/routes/Admin/AdminSurfacePrimitives.tsx",
      "src/routes/Admin/AdminSurfaceLayoutPrimitives.tsx",
      "src/routes/Admin/AdminCloudWorkspace.styles.ts",
      "src/routes/Admin/AdminCloudWorkspaceControls.styles.ts",
      "src/routes/Admin/AdminCloudWorkspaceDetail.styles.ts",
      "src/routes/Admin/AdminCloudWorkspacePage.tsx",
      "src/routes/Admin/AdminCloudPreviewDrawer.tsx",
      "src/routes/Admin/useAdminCloudWorkspaceActions.ts",
      "src/routes/Feed/FeedExplorer.tsx",
      "src/routes/Feed/useFeedExplorerSessionRestore.ts",
      "src/routes/Detail/PostDetail/PostHeader.tsx",
    ]

    for (const relativePath of boundedFiles) {
      const content = readFileSync(path.join(repoRoot, relativePath), "utf8")
      const lineCount = content.replace(/\n$/, "").split(/\r?\n/).length
      expect(lineCount, `${relativePath} exceeds 600 lines (${lineCount})`).toBeLessThanOrEqual(600)
    }
  })
})
