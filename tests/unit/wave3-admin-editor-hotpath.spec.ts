import { expect, test } from "@playwright/test"
import {
  getMarkdownEditorTableEditAvailability,
  isProtectedPipe,
  packTableEditAvailabilityMask,
  planMarkdownEditorTableEdit,
  unpackTableEditAvailabilityMask,
  type MarkdownEditorTableEditAvailability,
} from "../../src/components/markdown-editor/markdownEditorTableModel"
import { applyPlannedTextMutationToValue } from "../../src/components/markdown-editor/markdownEditorTextMutation"
import { normalizeProfileWorkspaceContent } from "../../src/libs/profileWorkspace"
import { computeProfileDirtyMask } from "../../src/routes/Admin/AdminProfileWorkspacePageModel"
import {
  analyzeMarkdownLinks,
  computeCursorLineAndColumn,
  countMarkdownLinkWarnings,
  countMarkdownTotalLinks,
} from "../../src/routes/Admin/EditorStudioDedicatedEditorSurface"

test.describe("wave3 admin & editor hot-path optimizations", () => {
  test("computes cursor line and column in a single zero-allocation pass across boundary offsets", () => {
    const markdown = "first line\nsecond line\n\nfourth line"

    expect(computeCursorLineAndColumn(markdown, null)).toEqual({ line: 1, column: 1 })
    expect(computeCursorLineAndColumn(markdown, -5)).toEqual({ line: 1, column: 1 })
    expect(computeCursorLineAndColumn(markdown, 0)).toEqual({ line: 1, column: 1 })
    expect(computeCursorLineAndColumn(markdown, 5)).toEqual({ line: 1, column: 6 })
    expect(computeCursorLineAndColumn(markdown, 10)).toEqual({ line: 1, column: 11 })
    expect(computeCursorLineAndColumn(markdown, 11)).toEqual({ line: 2, column: 1 })
    expect(computeCursorLineAndColumn(markdown, 22)).toEqual({ line: 2, column: 12 })
    expect(computeCursorLineAndColumn(markdown, 23)).toEqual({ line: 3, column: 1 })
    expect(computeCursorLineAndColumn(markdown, 24)).toEqual({ line: 4, column: 1 })
    expect(computeCursorLineAndColumn(markdown, 999)).toEqual({ line: 4, column: 12 })
  })

  test("analyzes markdown total links and warnings in a single pass with exact parity", () => {
    const sample = [
      "[valid https](https://example.com/docs)",
      "[relative](/posts/hello)",
      "[[wiki-note|Wiki Note]]",
      "[empty]()",
      "[http-only](http://)",
      "[https-only](https://)",
      "![image](https://example.com/img.png)",
      "[incomplete](http://",
    ].join("\n")

    const analyzed = analyzeMarkdownLinks(sample)
    expect(analyzed).toEqual({
      totalLinks: 7,
      linkWarnings: 4,
    })
    expect(countMarkdownTotalLinks(sample)).toBe(analyzed.totalLinks)
    expect(countMarkdownLinkWarnings(sample)).toBe(analyzed.linkWarnings)
  })

  test("packs and unpacks all 128 7-bit table edit availability states and null without loss", () => {
    expect(packTableEditAvailabilityMask(null)).toBe(-1)
    expect(unpackTableEditAvailabilityMask(-1)).toBeNull()

    for (let mask = 0; mask < 128; mask += 1) {
      const state: MarkdownEditorTableEditAvailability = {
        addRow: (mask & (1 << 0)) !== 0,
        deleteRow: (mask & (1 << 1)) !== 0,
        addColumn: (mask & (1 << 2)) !== 0,
        deleteColumn: (mask & (1 << 3)) !== 0,
        alignLeft: (mask & (1 << 4)) !== 0,
        alignCenter: (mask & (1 << 5)) !== 0,
        alignRight: (mask & (1 << 6)) !== 0,
      }
      const packed = packTableEditAvailabilityMask(state)
      expect(packed).toBe(mask)
      expect(unpackTableEditAvailabilityMask(packed)).toEqual(state)
    }

    const table = ["| Name | Notes |", "| :--- | ---: |", "| A | B |"].join("\n")
    const availability = getMarkdownEditorTableEditAvailability(table, 2, 2)
    expect(availability).not.toBeNull()
    expect(unpackTableEditAvailabilityMask(packTableEditAvailabilityMask(availability))).toEqual(availability)
  })

  test("fast-paths plain table rows while protecting pipes inside wiki links and inline directives", () => {
    const plainLine = "| alpha | beta \\| gamma |"
    expect(isProtectedPipe(plainLine, plainLine.indexOf("|"))).toBe(false)
    expect(isProtectedPipe(plainLine, plainLine.indexOf("\\|") + 1)).toBe(true)

    const richTable = [
      "| Doc | Status |",
      "| --- | --- |",
      "| [[architecture|Architecture Guide]] | {{color:sky|In Review}} |",
    ].join("\n")

    const wikiPipeIndex = richTable.indexOf("architecture|") + "architecture".length
    const directivePipeIndex = richTable.indexOf("color:sky|") + "color:sky".length
    expect(isProtectedPipe(richTable, wikiPipeIndex)).toBe(true)
    expect(isProtectedPipe(richTable, directivePipeIndex)).toBe(true)

    const plan = planMarkdownEditorTableEdit(richTable, 2, 2, {
      kind: "set-alignment",
      alignment: "center",
    })
    expect(plan).not.toBeNull()
    expect(applyPlannedTextMutationToValue(richTable, plan!).value).toBe(
      [
        "| Doc | Status |",
        "| :---: | --- |",
        "| [[architecture|Architecture Guide]] | {{color:sky|In Review}} |",
      ].join("\n")
    )
  })

  test("computes 4-bit profile dirty mask from pre-normalized workspace snapshots", () => {
    const base = normalizeProfileWorkspaceContent({
      profileImageUrl: "/avatar.png",
      profileRole: "Platform Engineer",
      profileBio: "Bio",
      aboutHeadline: "Headline",
      aboutRole: "Role",
      aboutBio: "About bio",
      aboutSections: [{ id: "s1", title: "Sec", items: ["Item"], dividerBefore: false }],
      aboutProjectSectionTitle: "Projects",
      aboutProjects: [],
      blogTitle: "Aquila Blog",
      homeIntroTitle: "Welcome",
      homeIntroDescription: "Intro",
      blogDesign: "legacy",
      legacyBlogScheme: "light",
      serviceLinks: [{ icon: "globe", label: "Site", href: "https://example.com" }],
      contactLinks: [{ icon: "mail", label: "Mail", href: "mailto:test@example.com" }],
    })

    expect(computeProfileDirtyMask(base, base)).toBe(0)

    const identityChanged = normalizeProfileWorkspaceContent({ ...base, profileRole: "Staff Engineer" })
    expect(computeProfileDirtyMask(identityChanged, base)).toBe(1 << 0)

    const aboutChanged = normalizeProfileWorkspaceContent({ ...base, aboutHeadline: "Updated Headline" })
    expect(computeProfileDirtyMask(aboutChanged, base)).toBe(1 << 1)

    const homeChanged = normalizeProfileWorkspaceContent({ ...base, blogTitle: "Updated Blog" })
    expect(computeProfileDirtyMask(homeChanged, base)).toBe(1 << 2)

    const linksChanged = normalizeProfileWorkspaceContent({
      ...base,
      serviceLinks: [{ icon: "globe", label: "Docs", href: "https://docs.example.com" }],
    })
    expect(computeProfileDirtyMask(linksChanged, base)).toBe(1 << 3)

    const allChanged = normalizeProfileWorkspaceContent({
      ...identityChanged,
      aboutHeadline: "Updated Headline",
      blogTitle: "Updated Blog",
      serviceLinks: [{ icon: "globe", label: "Docs", href: "https://docs.example.com" }],
    })
    expect(computeProfileDirtyMask(allChanged, base)).toBe(0b1111)
  })
})
