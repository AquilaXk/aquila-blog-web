import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "@playwright/test"
import {
  ENTRY_FLAG_HAS_PRIMARY_HIDE,
  ENTRY_FLAG_HAS_SECONDARY_HIDE,
  ENTRY_FLAG_IN_TASK,
  ENTRY_KIND_MASK,
  buildMarkdownLivePreviewEntries,
  packLivePreviewEntryMeta,
  resolveMarkdownLivePreviewPlanFromEntries,
  unpackLivePreviewEntryMeta,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import { computeMinimalDocChange } from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  SLASH_COMMAND_SPECS,
  resolveSlashCommandMutation,
} from "../../src/components/markdown-editor/useMarkdownEditorSlashMenu"
import { buildLocalDraftFingerprint } from "../../src/routes/Admin/editorStudioMetaModel"
import { createPublicDesignTokens } from "../../src/styles/theme"

const repoRoot = resolve(__dirname, "../..")
const readRepoFile = (relPath: string) => readFileSync(resolve(repoRoot, relPath), "utf8")

test.describe("Issue #266: Obsidian UX, Bit-Level Optimizations & Slop Removal", () => {
  test("1. Reading Typography: light/dark inline code tokens and tightened PostHeader letter-spacing", () => {
    const lightTokens = createPublicDesignTokens("light")
    const darkTokens = createPublicDesignTokens("dark")
    expect(lightTokens.inlineCodeBg).toBe("rgba(15, 23, 36, 0.055)")
    expect(lightTokens.inlineCodeBorder).toBe("rgba(15, 23, 36, 0.12)")
    expect(darkTokens.inlineCodeBg).toBe("rgba(255, 255, 255, 0.075)")
    expect(darkTokens.inlineCodeBorder).toBe("rgba(255, 255, 255, 0.12)")

    const typographySrc = readRepoFile("src/libs/markdown/contentTypography.ts")
    expect(typographySrc).toContain("--aq-inline-code-bg")
    expect(typographySrc).toContain("--aq-inline-code-border")
    expect(typographySrc).not.toContain("background: rgba(255, 255, 255, 0.075);")

    const surfacePartsSrc = readRepoFile(
      "src/routes/Admin/EditorStudioDedicatedEditorSurfaceParts.tsx"
    )
    expect(surfacePartsSrc).toContain("letter-spacing: -0.03em;")
    expect(surfacePartsSrc).not.toContain("letter-spacing: -0.045em;")
  })

  test("2. Obsidian Slash Commands & Zen Mode keyboard shortcut / inline properties fold", () => {
    const ids = SLASH_COMMAND_SPECS.map((spec) => spec.id)
    expect(ids).toEqual(
      expect.arrayContaining(["callout-info", "toggle", "math", "mermaid", "bookmark"])
    )

    const mathSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "math")!
    const mathPlan = resolveSlashCommandMutation(mathSpec, 10, 15)
    expect(mathPlan.replacement).toBe("$$\n\n$$")
    expect(mathPlan.selectionStart).toBe(13)
    expect(mathPlan.selectionEnd).toBe(13)

    const mermaidSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "mermaid")!
    const mermaidPlan = resolveSlashCommandMutation(mermaidSpec, 4, 12)
    expect(mermaidPlan.replacement).toBe("```mermaid\ngraph TD\n  A --> B\n```")
    expect(mermaidPlan.selectionStart).toBe(15)

    const surfaceSrc = readRepoFile("src/routes/Admin/EditorStudioDedicatedEditorSurface.tsx")
    expect(surfaceSrc).toContain('event.key.toLowerCase() === "f"')
    expect(surfaceSrc).toContain("$visibleOnDesktop={isZenMode}")
    expect(surfaceSrc).toContain("$collapsedInZen={isZenMode && !isMobilePropertiesOpen}")
  })

  test("3. Bit-packed Live Preview metadata & O(log N) binary search for inline-color and wikilinks", () => {
    const packed = packLivePreviewEntryMeta(
      "heading",
      ENTRY_FLAG_IN_TASK | ENTRY_FLAG_HAS_PRIMARY_HIDE,
      3
    )
    const unpacked = unpackLivePreviewEntryMeta(packed)
    expect(unpacked.kindCode).toBe(packed & ENTRY_KIND_MASK)
    expect(unpacked.flags).toBe(ENTRY_FLAG_IN_TASK | ENTRY_FLAG_HAS_PRIMARY_HIDE)
    expect(unpacked.level).toBe(3)

    const md =
      "# Title\n- [x] **bold task** and [[Wiki|Alias]] plus {{color:sky|colored}} and `{{color:rose|literal}}`"
    const entries = buildMarkdownLivePreviewEntries(md)
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(typeof entry.packedMeta).toBe("number")
      const meta = unpackLivePreviewEntryMeta(entry.packedMeta)
      if (entry.hideWhenActiveRange) {
        expect(meta.flags & ENTRY_FLAG_HAS_PRIMARY_HIDE).toBe(ENTRY_FLAG_HAS_PRIMARY_HIDE)
      }
      if (entry.secondaryHideWhenActiveRange) {
        expect(meta.flags & ENTRY_FLAG_HAS_SECONDARY_HIDE).toBe(ENTRY_FLAG_HAS_SECONDARY_HIDE)
      }
    }

    const inactivePlan = resolveMarkdownLivePreviewPlanFromEntries(entries, [{ from: 0, to: 0 }])
    const colorDecos = inactivePlan.filter((d) => d.kind === "inline-color")
    expect(colorDecos).toHaveLength(1)
    expect(colorDecos[0]?.color).toBeTruthy()

    const livePreviewSrc = readRepoFile("src/components/markdown-editor/markdownEditorLivePreview.ts")
    expect(livePreviewSrc).not.toContain("new RegExp(INLINE_COLOR_TOKEN_REGEX)")
    expect(livePreviewSrc).not.toContain("wikilinkRanges.some(")
  })

  test("4. Bitwise UTF-16 surrogate pair boundary clamping in computeMinimalDocChange", () => {
    // "😀" = \uD83D\uDE00, "🫠" = \uD83E\uDE00 (differ on high surrogate, share trailing low surrogate \uDE00)
    const prev = "Hello \uD83D\uDE00 world"
    const next = "Hello \uD83E\uDE00 world"
    const diff = computeMinimalDocChange(prev, next)
    expect(diff).not.toBeNull()
    // Must not split inside the surrogate pair at index 7; must span [6, 8]
    expect(diff!.from).toBe(6)
    expect(diff!.to).toBe(8)
    expect(diff!.insert).toBe("\uD83E\uDE00")
    expect(prev.slice(0, diff!.from) + diff!.insert + prev.slice(diff!.to)).toBe(next)
  })

  test("5. FNV-1a draft fingerprint & removal of redundant syncRequire / orphaned files", () => {
    const largeBody = "x".repeat(10_000)
    const fp1 = buildLocalDraftFingerprint({
      title: "Title",
      content: largeBody,
      summary: "Summary",
      summarySource: "MANUAL",
      summaryIntent: { kind: "auto" },
      thumbnailUrl: "",
      thumbnailFocusX: 50,
      thumbnailFocusY: 50,
      thumbnailZoom: 1,
      tags: ["rust"],
      category: "Dev",
      visibility: "PUBLIC_LISTED",
    })
    const fp2 = buildLocalDraftFingerprint({
      title: "Title",
      content: largeBody + "y",
      summary: "Summary",
      summarySource: "MANUAL",
      summaryIntent: { kind: "auto" },
      thumbnailUrl: "",
      thumbnailFocusX: 50,
      thumbnailFocusY: 50,
      thumbnailZoom: 1,
      tags: ["rust"],
      category: "Dev",
      visibility: "PUBLIC_LISTED",
    })
    expect(fp1.length).toBeLessThan(300)
    expect(fp1).not.toBe(fp2)

    const prismSrc = readRepoFile("src/libs/markdown/prismRuntime.ts")
    expect(prismSrc).not.toContain("syncRequire")
    expect(prismSrc).not.toContain("prismImmediateLanguageLoaders")
    expect(prismSrc).toContain('md: ["markdown"]')
    expect(prismSrc).toContain('py: ["python"]')

    const nextConfigSrc = readRepoFile("next.config.js")
    expect(nextConfigSrc).not.toContain("ignoreWarnings")

    expect(
      existsSync(resolve(repoRoot, "src/routes/Admin/EditorStudioComposeMobileChrome.tsx"))
    ).toBe(false)
    expect(
      existsSync(resolve(repoRoot, "src/routes/Admin/EditorStudioMetadataAssistantPanel.tsx"))
    ).toBe(false)

    const rootViewSrc = readRepoFile("src/routes/Admin/EditorStudioWorkspaceControllerRootView.tsx")
    expect(rootViewSrc).not.toContain("Record<string, any>")
    expect(rootViewSrc).not.toContain("isDedicatedPostEditorRoute ?")

    const cloudStylesSrc = readRepoFile("src/routes/Admin/AdminCloudWorkspace.styles.ts")
    expect(cloudStylesSrc).not.toContain("StorageMeter")
  })
})
