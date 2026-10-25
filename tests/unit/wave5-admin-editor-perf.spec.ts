import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"
import {
  extractPostIdFromSlug,
  mapPostDetail,
  normalizeStringArray,
  parsePostMeta,
} from "../../src/apis/backend/posts/PostApiMappers"
import {
  planIndentLines,
  planOutdentLines,
} from "../../src/components/markdown-editor/markdownEditorTextMutation"
import {
  getMarkdownEditorTableEditAvailability,
  planMarkdownEditorTableEdit,
  resolveTableCellSelectionOffset,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { resolveActiveTableCellOffset } from "../../src/components/markdown-editor/MarkdownEditor"
import { sortCloudFiles } from "../../src/routes/Admin/AdminCloudWorkspaceModel"
import {
  parseEditorMeta,
  splitFrontmatterBlock,
  stripLeadingEditorMetadataLines,
} from "../../src/routes/Admin/editorStudioMetaModel"
import { dedupeStrings } from "../../src/routes/Admin/editorStudioMetaModelHelpers"

test.describe("wave5 admin, editor, and mapper optimizations", () => {
  test("mapPostDetail preserves post.thumbnail and parses frontmatter in a single pass", async () => {
    const detail = await mapPostDetail(
      {
        id: 42,
        createdAt: "2026-10-20T09:00:00.000Z",
        modifiedAt: "2026-10-21T10:30:00.000Z",
        authorId: 1,
        authorName: "Aquila",
        title: "Wave 5 Post",
        summary: "Deep dive into single-pass parsing",
        summarySource: "MANUAL",
        content: [
          "---",
          "category: Engineering",
          "tags: [kotlin, nextjs, kotlin]",
          "---",
          "# Heading",
          "Body paragraph",
        ].join("\n"),
        published: true,
        listed: true,
        tempDraft: false,
        hitCount: 12,
        likesCount: 3,
        thumbnail: "https://cdn.aquila.dev/thumb-42.webp",
      },
      { allowTrustedContentHtml: false }
    )

    expect(detail.thumbnail).toBe("https://cdn.aquila.dev/thumb-42.webp")
    expect(detail.category).toEqual(["folder::Engineering"])
    expect(detail.tags).toEqual(["kotlin", "nextjs"])
    expect(detail.summary).toBe("Deep dive into single-pass parsing")
    expect(detail.content).toBe("# Heading\nBody paragraph")
  })

  test("extractPostIdFromSlug and normalizeStringArray avoid redundant allocations", () => {
    expect(extractPostIdFromSlug("42")).toBe(42)
    expect(extractPostIdFromSlug("wave-5-optimization-99")).toBe(99)
    expect(extractPostIdFromSlug("invalid-slug-abc")).toBeNull()
    expect(extractPostIdFromSlug("trailing-dash-0")).toBeNull()

    expect(normalizeStringArray([" alpha ", "beta", "alpha", "", "  "])).toEqual(["alpha", "beta"])
    expect(
      parsePostMeta("---\r\ncategory: Backend\r\ntags: [api, cache]\r\n---\r\nHello world")
    ).toEqual({
      content: "Hello world",
      category: ["folder::Backend"],
      tags: ["api", "cache"],
    })
    expect(parsePostMeta("category: Infra\ntags: [docker, caddy]\n\nLeading meta body")).toEqual({
      content: "Leading meta body",
      category: ["folder::Infra"],
      tags: ["docker", "caddy"],
    })
  })

  test("editorStudioMetaModel parses frontmatter and leading metadata without split allocations", () => {
    const raw = [
      "---",
      "category: Architecture",
      "tags: [editor, perf, editor]",
      "thumbnail: https://cdn.aquila.dev/cover.png",
      "---",
      "Line 1",
      "Line 2",
    ].join("\r\n")

    const split = splitFrontmatterBlock(raw)
    expect(split.metadataLines).toEqual([
      "category: Architecture",
      "tags: [editor, perf, editor]",
      "thumbnail: https://cdn.aquila.dev/cover.png",
    ])
    expect(split.body).toBe("Line 1\nLine 2")

    const parsed = parseEditorMeta(raw)
    expect(parsed).toEqual({
      body: "Line 1\nLine 2",
      category: "folder::Architecture",
      tags: ["editor", "perf"],
      thumbnail: "https://cdn.aquila.dev/cover.png",
      customFrontmatterLines: undefined,
    })

    const stripped = stripLeadingEditorMetadataLines(
      "category: Architecture\ntags: [a, b]\n\nActual body\ncategory: keep-me"
    )
    expect(stripped.body).toBe("Actual body\ncategory: keep-me")
    expect(dedupeStrings([" tag1 ", "tag2", "tag1", ""])).toEqual(["tag1", "tag2"])
  })

  test("planIndentLines and planOutdentLines scan lines via charCodeAt in a single pass", () => {
    const doc = "first\n  second\n\tthird\n fourth"
    const indented = planIndentLines(doc, 0, doc.length)
    expect(indented.replacement).toBe("  first\n    second\n  \tthird\n   fourth")

    const outdented = planOutdentLines(doc, 0, doc.length)
    expect(outdented?.replacement).toBe("first\nsecond\nthird\nfourth")
  })

  test("sortCloudFiles orders LATEST and OLDEST by modifiedAt fallback to createdAt", () => {
    const files = [
      {
        id: 1,
        ownerMemberId: 1,
        originalFilename: "older-created-recently-modified.png",
        contentType: "image/png",
        mediaKind: "PHOTO" as const,
        byteSize: 100,
        folderPath: "",
        createdAt: "2026-10-01T00:00:00.000Z",
        modifiedAt: "2026-10-25T00:00:00.000Z",
      },
      {
        id: 2,
        ownerMemberId: 1,
        originalFilename: "newer-created-never-modified.png",
        contentType: "image/png",
        mediaKind: "PHOTO" as const,
        byteSize: 200,
        folderPath: "",
        createdAt: "2026-10-10T00:00:00.000Z",
        modifiedAt: "2026-10-10T00:00:00.000Z",
      },
    ]

    expect(sortCloudFiles(files, "LATEST").map((f) => f.id)).toEqual([1, 2])
    expect(sortCloudFiles(files, "OLDEST").map((f) => f.id)).toEqual([2, 1])
  })

  test("publish modal drawer styles preserve safe-area top padding and single-column preview grid", () => {
    const shellStyles = readFileSync(
      resolve(__dirname, "../../src/routes/Admin/EditorStudioPublishModalShellStyles.tsx"),
      "utf8"
    )
    const modalStyles = readFileSync(
      resolve(__dirname, "../../src/routes/Admin/EditorStudioPublishModalStyles.tsx"),
      "utf8"
    )

    expect(shellStyles).toContain(
      '&[data-variant="drawer"] {\n      padding-top: max(0.82rem, env(safe-area-inset-top, 0px));\n    }'
    )
    expect(modalStyles).toContain('[data-variant="drawer"] & {\n    grid-template-columns: minmax(0, 1fr);\n  }')
  })

  test("resolveTableCellSelectionOffset maps live table widget coordinates to active cell offsets for toolbar edits", () => {
    const doc = [
      "Intro paragraph",
      "",
      "| ColA | ColB |",
      "| --- | --- |",
      "| R1A | R1B |",
      "| R2A | R2B |",
    ].join("\n")
    const tableFrom = doc.indexOf("| ColA |")

    const headerOffset = resolveTableCellSelectionOffset(doc, tableFrom, 0, 0)
    expect(headerOffset).not.toBeNull()
    expect(getMarkdownEditorTableEditAvailability(doc, headerOffset!, headerOffset!)).toEqual({
      addRow: true,
      deleteRow: false,
      addColumn: true,
      deleteColumn: true,
      alignLeft: true,
      alignCenter: true,
      alignRight: true,
    })

    const bodyRow2Col2Offset = resolveTableCellSelectionOffset(doc, tableFrom, 2, 1)
    expect(bodyRow2Col2Offset).not.toBeNull()
    expect(getMarkdownEditorTableEditAvailability(doc, bodyRow2Col2Offset!, bodyRow2Col2Offset!)).toEqual({
      addRow: true,
      deleteRow: true,
      addColumn: true,
      deleteColumn: true,
      alignLeft: true,
      alignCenter: true,
      alignRight: true,
    })
    const deleteRowPlan = planMarkdownEditorTableEdit(doc, bodyRow2Col2Offset!, bodyRow2Col2Offset!, {
      kind: "delete-row",
    })
    expect(deleteRowPlan?.replacement).toBe(
      ["| ColA | ColB |", "| --- | --- |", "| R1A | R1B |"].join("\n")
    )

    const prevDoc = Object.getOwnPropertyDescriptor(globalThis, "document")
    const prevElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement")
    class FakeElement {
      dataset: Record<string, string | undefined> = {}
      private classes = new Set<string>()
      parent: FakeElement | null = null
      blurred = false
      constructor(classNames: string[] = []) {
        for (const c of classNames) this.classes.add(c)
      }
      classList = {
        contains: (cls: string) => this.classes.has(cls),
      }
      closest(selector: string): FakeElement | null {
        let cur: FakeElement | null = this
        while (cur) {
          if (selector === ".cm-live-table-wrap" && cur.classes.has("cm-live-table-wrap")) return cur
          if (selector === ".cm-content" && cur.classes.has("cm-content")) return cur
          cur = cur.parent
        }
        return null
      }
      querySelector(selector: string): FakeElement | null {
        if (selector === ".cm-live-table-wrap[data-active-mode]" && wrapEl.dataset.activeMode) {
          return wrapEl
        }
        return null
      }
      blur() {
        this.blurred = true
        onBlurFlush?.()
      }
    }

    const rootEl = new FakeElement()
    const cmContentEl = new FakeElement(["cm-content"])
    cmContentEl.parent = rootEl
    const wrapEl = new FakeElement(["cm-live-table-wrap"])
    wrapEl.parent = cmContentEl
    wrapEl.dataset.tableFrom = String(tableFrom)
    wrapEl.dataset.activeMode = "cell"
    wrapEl.dataset.activeRow = "2"
    wrapEl.dataset.activeCol = "1"
    const cellInputEl = new FakeElement(["cm-live-table-cell-input"])
    cellInputEl.parent = wrapEl

    let currentMarkdown = [
      "Intro paragraph",
      "",
      "| ColA | ColB |",
      "| --- | --- |",
      "| VeryLongCellTextBeforeFlush | R1B |",
      "| R2A | R2B |",
    ].join("\n")
    let onBlurFlush: (() => void) | null = () => {
      currentMarkdown = doc
    }

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      writable: true,
      value: FakeElement,
    })
    try {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: { activeElement: cellInputEl },
      })
      const flushedOffset = resolveActiveTableCellOffset(
        rootEl as unknown as HTMLElement,
        () => currentMarkdown
      )
      expect(cellInputEl.blurred).toBe(true)
      expect(flushedOffset).toBe(bodyRow2Col2Offset)

      const popoverButtonEl = new FakeElement()
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: { activeElement: popoverButtonEl },
      })
      expect(
        resolveActiveTableCellOffset(rootEl as unknown as HTMLElement, () => currentMarkdown)
      ).toBe(bodyRow2Col2Offset)

      Object.defineProperty(globalThis, "document", {
        configurable: true,
        writable: true,
        value: { activeElement: cmContentEl },
      })
      expect(
        resolveActiveTableCellOffset(rootEl as unknown as HTMLElement, () => currentMarkdown)
      ).toBeNull()
    } finally {
      if (prevDoc) Object.defineProperty(globalThis, "document", prevDoc)
      else delete (globalThis as Record<string, unknown>).document
      if (prevElement) Object.defineProperty(globalThis, "HTMLElement", prevElement)
      else delete (globalThis as Record<string, unknown>).HTMLElement
    }
  })

  test("mobile blog writing surface collapses sidebars by default, preserves full-height grid canvas, and exposes line commands in more menu", () => {
    const surfaceSource = readFileSync(
      resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx"),
      "utf8"
    )
    const surfacePartsSource = readFileSync(
      resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx"),
      "utf8"
    )
    const panelPartsSource = readFileSync(
      resolve(__dirname, "../../src/routes/Admin/EditorStudioDedicatedPanelParts.tsx"),
      "utf8"
    )
    const editorStylesSource = readFileSync(
      resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditor.styles.ts"),
      "utf8"
    )
    const toolbarSource = readFileSync(
      resolve(__dirname, "../../src/components/markdown-editor/MarkdownEditorToolbar.tsx"),
      "utf8"
    )

    expect(surfaceSource).toContain('window.matchMedia("(max-width: 820px)")')
    expect(surfaceSource).toContain("syncViewportPanels")
    expect(surfacePartsSource).toContain("grid-template-columns: minmax(0, 1fr);")
    expect(surfacePartsSource).toContain("grid-template-rows: minmax(0, 1fr);")
    expect(panelPartsSource).toContain("max-height: min(72dvh, 520px);")
    expect(panelPartsSource).toContain("max-height: min(78dvh, 580px);")
    expect(editorStylesSource).toContain("@media (max-width: 820px) { font-size: 16px; line-height: 1.7; }")
    expect(editorStylesSource).toContain("&[data-mobile-hidden=\"true\"]")
    expect(toolbarSource).toContain('id: "line.move-up"')
    expect(toolbarSource).toContain('id: "line.move-down"')
    expect(toolbarSource).toContain('id: "line.duplicate"')
    expect(toolbarSource).toContain('id: "line.delete"')
  })
})
