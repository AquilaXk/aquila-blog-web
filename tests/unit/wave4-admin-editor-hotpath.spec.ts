import fs from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { CloudFile } from "../../src/apis/backend/cloud"
import {
  getCloudSummary,
  mergeCloudFiles,
  sortCloudFiles,
} from "../../src/routes/Admin/AdminCloudWorkspaceModel"
import {
  parseEditorMeta,
  resolveEditorBodyFallback,
} from "../../src/routes/Admin/editorStudioMetaModel"
import { computeCursorLineAndColumn } from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"
import {
  SLASH_FLAG_ATTACHMENT,
  SLASH_FLAG_IMAGE,
  SLASH_FLAG_MERMAID,
  filterSlashCommandSpecs,
  packSlashDisabledFeaturesMask,
} from "../../src/components/markdown-editor/useMarkdownEditorSlashMenu"
import { EditorState } from "@codemirror/state"
import {
  buildLogicalLines,
  getCachedNotionLineMeta,
  planToggleBlockLinePrefix,
  resolveSelectedLines,
} from "../../src/components/markdown-editor/markdownEditorNotionModel"
import {
  matchListMarkerLine,
  planToggleListCommand,
} from "../../src/components/markdown-editor/markdownEditorListCommandsModel"
import { cycleTaskCheckboxInLine } from "../../src/components/markdown-editor/markdownEditorKeyboardModel"
import { marketingDark, marketingLight } from "../../src/design-system/marketingPalette"

const repoRoot = path.resolve(__dirname, "../..")
const readRepoFile = (relPath: string): string =>
  fs.readFileSync(path.join(repoRoot, relPath), "utf8")

test.describe("Wave-4 Track B hot-path and responsive deslop invariants", () => {
  test("3-bit slash menu feature mask and filterSlashCommandSpecs cover all 8 flag states", () => {
    expect(SLASH_FLAG_MERMAID).toBe(1)
    expect(SLASH_FLAG_IMAGE).toBe(2)
    expect(SLASH_FLAG_ATTACHMENT).toBe(4)

    for (let mask = 0; mask < 8; mask += 1) {
      const disableMermaid = (mask & SLASH_FLAG_MERMAID) !== 0
      const disableImageUpload = (mask & SLASH_FLAG_IMAGE) !== 0
      const disableFileUpload = (mask & SLASH_FLAG_ATTACHMENT) !== 0

      expect(
        packSlashDisabledFeaturesMask({
          disableMermaid,
          disableImageUpload,
          disableFileUpload,
        }),
      ).toBe(mask)

      const specs = filterSlashCommandSpecs("", disableMermaid, {
        disableImageUpload,
        disableFileUpload,
      })
      const ids = new Set(specs.map((spec) => spec.id))

      expect(ids.has("mermaid")).toBe(!disableMermaid)
      expect(ids.has("image")).toBe(!disableImageUpload)
      expect(ids.has("attachment")).toBe(!disableFileUpload)
      expect(ids.has("heading-1")).toBe(true)
      expect(ids.has("task-list")).toBe(true)
    }

    expect(filterSlashCommandSpecs("todo", false).map((s) => s.id)).toContain(
      "task-list",
    )
    expect(filterSlashCommandSpecs("diagram", true).map((s) => s.id)).toEqual(
      [],
    )
    expect(
      filterSlashCommandSpecs("diagram", false).map((s) => s.id),
    ).toContain("mermaid")
  })

  test("single-pass buildLogicalLines, resolveSelectedLines, and getCachedNotionLineMeta preserve fence and line parity", () => {
    const doc = [
      "# Title",
      "Paragraph line",
      "```ts",
      "# Not a heading inside fence",
      "```",
      "- [x] Done task outside fence",
      "",
    ].join("\n")

    const lines = buildLogicalLines(doc)
    expect(lines).toHaveLength(7)
    expect(lines[0]?.text).toBe("# Title")
    expect(lines[0]?.intersectsFence).toBe(false)
    expect(lines[2]?.intersectsFence).toBe(true)
    expect(lines[3]?.intersectsFence).toBe(true)
    expect(lines[4]?.intersectsFence).toBe(true)
    expect(lines[5]?.intersectsFence).toBe(false)
    expect(lines[6]?.text).toBe("")

    const firstSelection = resolveSelectedLines(doc, 0, 5)
    expect(firstSelection).toHaveLength(1)
    expect(firstSelection?.[0]?.text).toBe("# Title")

    const fencedSelection = resolveSelectedLines(
      doc,
      lines[3]!.start,
      lines[3]!.end,
    )
    expect(fencedSelection).toBeNull()

    const trailingEmptySelection = resolveSelectedLines(
      doc,
      doc.length,
      doc.length,
    )
    expect(trailingEmptySelection).toHaveLength(1)
    expect(trailingEmptySelection?.[0]?.start).toBe(doc.length)

    const cmDoc = EditorState.create({ doc }).doc
    const meta = getCachedNotionLineMeta(cmDoc)
    expect(meta.checkedTaskLineStarts).toEqual([lines[5]!.start])
    expect(meta.fencedRanges).toEqual([
      { from: lines[2]!.start, to: lines[4]!.end + 1 },
    ])
    expect(getCachedNotionLineMeta(cmDoc)).toBe(meta)

    const toggled = planToggleBlockLinePrefix(doc, 0, 3, "## ")
    expect(toggled?.replacement).toBe("## Title")
  })

  test("matchListMarkerLine and cycleTaskCheckboxInLine fast-path plain lines and preserve list semantics", () => {
    expect(matchListMarkerLine("Plain text paragraph without markers")).toBeNull()
    expect(matchListMarkerLine("   Indented plain text")).toBeNull()
    expect(matchListMarkerLine("")).toBeNull()

    expect(matchListMarkerLine("  - Bullet item")).toEqual({
      indent: "  ",
      marker: "- ",
      content: "Bullet item",
      kind: "unordered",
    })
    expect(matchListMarkerLine("\t* [x] Completed task")).toEqual({
      indent: "\t",
      marker: "- [ ] ",
      content: "Completed task",
      kind: "task",
    })
    expect(matchListMarkerLine("    12. Numbered step")).toEqual({
      indent: "    ",
      marker: "12. ",
      content: "Numbered step",
      kind: "ordered",
      number: 12,
    })
    expect(matchListMarkerLine(" > Quoted line")).toEqual({
      indent: " ",
      marker: "> ",
      content: "Quoted line",
      kind: "quote",
    })

    expect(cycleTaskCheckboxInLine("  Plain item")).toEqual({
      replaced: true,
      lineText: "  - [ ] Plain item",
    })
    expect(cycleTaskCheckboxInLine("  - [ ] Unchecked item")).toEqual({
      replaced: true,
      lineText: "  - [x] Unchecked item",
    })
    expect(cycleTaskCheckboxInLine("  - [X] Checked item")).toEqual({
      replaced: true,
      lineText: "  - [ ] Checked item",
    })
    expect(cycleTaskCheckboxInLine("  1. Ordered item")).toEqual({
      replaced: true,
      lineText: "  - [ ] Ordered item",
    })

    const toggledOrdered = planToggleListCommand(
      "- First\n- Second",
      0,
      14,
      "ordered",
    )
    expect(toggledOrdered?.replacement).toBe("1. First\n2. Second")
  })

  test("computeCursorLineAndColumn, resolveEditorBodyFallback, and parseEditorMeta avoid redundant passes", () => {
    const markdown = "first line\nsecond 😊 line\nthird line"
    expect(computeCursorLineAndColumn(markdown, 0)).toEqual({
      line: 1,
      column: 1,
    })
    expect(computeCursorLineAndColumn(markdown, 11)).toEqual({
      line: 2,
      column: 1,
    })
    const afterEmojiOffset = "first line\nsecond 😊 ".length
    expect(computeCursorLineAndColumn(markdown, afterEmojiOffset)).toEqual({
      line: 2,
      column: 11,
    })

    expect(
      resolveEditorBodyFallback(
        "---\ncategory: dev\ntags: a, b\n---\nNon-empty body",
        "Non-empty body",
      ),
    ).toBe("Non-empty body")
    expect(
      resolveEditorBodyFallback("Plain content that looked like key: value", ""),
    ).toBe("Plain content that looked like key: value")
    expect(
      resolveEditorBodyFallback("---\ncategory: dev\ntags: a, b\n---\n", ""),
    ).toBe("")

    const parsed = parseEditorMeta(
      "categories: Backend\ntags: kotlin, spring\nthumbnail: /post/api/v1/images/posts/cover.png\n\n# Body heading",
    )
    expect(parsed.category).toBe("folder::Backend")
    expect(parsed.tags).toEqual(["kotlin", "spring"])
    expect(parsed.thumbnail).toBe("/post/api/v1/images/posts/cover.png")
    expect(parsed.body).toBe("# Body heading")
  })

  test("AdminCloudWorkspaceModel sortCloudFiles, mergeCloudFiles, and getCloudSummary preserve deterministic order and totals", () => {
    const sampleFiles: CloudFile[] = [
      {
        id: 2,
        ownerMemberId: 1,
        originalFilename: "beta.png",
        folderPath: "/",
        contentType: "image/png",
        mediaKind: "PHOTO",
        byteSize: 200,
        createdAt: "2026-03-02T10:00:00.000Z",
      },
      {
        id: 1,
        ownerMemberId: 1,
        originalFilename: "alpha.pdf",
        folderPath: "/",
        contentType: "application/pdf",
        mediaKind: "DOCUMENT",
        byteSize: 500,
        createdAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: 3,
        ownerMemberId: 1,
        originalFilename: "gamma.mp4",
        folderPath: "/",
        contentType: "video/mp4",
        mediaKind: "VIDEO",
        byteSize: 900,
        createdAt: "2026-03-03T10:00:00.000Z",
      },
    ]

    expect(sortCloudFiles(sampleFiles, "LATEST").map((f) => f.id)).toEqual([
      3,
      2,
      1,
    ])
    expect(sortCloudFiles(sampleFiles, "OLDEST").map((f) => f.id)).toEqual([
      1,
      2,
      3,
    ])
    expect(sortCloudFiles(sampleFiles, "NAME").map((f) => f.id)).toEqual([
      1,
      2,
      3,
    ])
    expect(sortCloudFiles(sampleFiles, "SIZE").map((f) => f.id)).toEqual([
      3,
      1,
      2,
    ])

    const merged = mergeCloudFiles(sampleFiles.slice(0, 2), [
      {
        ...sampleFiles[1]!,
        byteSize: 999,
      },
      sampleFiles[2]!,
    ])
    expect(merged.map((f) => f.id)).toEqual([2, 1, 3])
    expect(merged.find((f) => f.id === 1)?.byteSize).toBe(500)

    const summary = getCloudSummary(sampleFiles)
    expect(summary.totalCount).toBe(3)
    expect(summary.totalBytes).toBe(1600)
    expect(summary.documentCount).toBe(1)
    expect(summary.photoCount).toBe(1)
    expect(summary.videoCount).toBe(1)
  })

  test("Track B files remove shimmer/multi-layer shadow slop and enforce coarse-pointer 44px touch targets and focus rings", () => {
    expect(marketingLight.phoneShadow).toBe("0 16px 32px rgba(31, 35, 64, 0.08)")
    expect(marketingDark.phoneShadow).toBe("0 20px 40px rgba(0, 0, 0, 0.36)")

    const statePresenters = readRepoFile("src/design-system/StatePresenters.tsx")
    expect(statePresenters).not.toContain("linear-gradient(")
    expect(statePresenters).not.toContain("background-size: 200% 100%")

    const postsListStyles = readRepoFile(
      "src/routes/Admin/AdminPostsWorkspaceList.styles.ts",
    )
    expect(postsListStyles).not.toContain("linear-gradient(")
    expect(postsListStyles).toContain("@media (pointer: coarse)")

    const cloudStyles = readRepoFile(
      "src/routes/Admin/AdminCloudWorkspace.styles.ts",
    )
    expect(cloudStyles).not.toContain("linear-gradient(")
    expect(cloudStyles).toContain("@media (pointer: coarse)")

    const slashMenu = readRepoFile(
      "src/components/markdown-editor/MarkdownEditorSlashMenu.tsx",
    )
    expect(slashMenu).toContain("box-shadow: none;")
    expect(slashMenu).toContain("max-width: calc(100vw - 24px);")
    expect(slashMenu).toContain("@media (pointer: coarse)")

    const notionChrome = readRepoFile(
      "src/components/markdown-editor/MarkdownEditorNotionChrome.tsx",
    )
    expect(notionChrome).not.toContain("outline: none !important")
    expect(notionChrome).toContain("box-shadow: none;")
    expect(notionChrome).toContain("@media (pointer: coarse)")

    const toolsTokens = readRepoFile(
      "src/routes/Admin/AdminToolsWorkspace.styles.tokens.ts",
    )
    expect(toolsTokens).toContain("focusVisibleRing")
    expect(toolsTokens).toContain("(pointer: coarse)")

    const interactionPrimitives = readRepoFile(
      "src/design-system/interactionPrimitives.tsx",
    )
    expect(interactionPrimitives).toContain("(pointer: coarse)")

    const primitives = readRepoFile("src/design-system/primitives.tsx")
    expect(primitives).toContain("(pointer: coarse)")
  })
})
