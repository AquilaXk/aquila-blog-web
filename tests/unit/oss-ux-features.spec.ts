import { expect, test } from "@playwright/test"

if (typeof (globalThis as unknown as { HTMLElement?: unknown }).HTMLElement === "undefined") {
  // @ts-expect-error Node.js test environment polyfill
  globalThis.HTMLElement = class HTMLElement {}
}
if (typeof (globalThis as unknown as { HTMLAnchorElement?: unknown }).HTMLAnchorElement === "undefined") {
  // @ts-expect-error Node.js test environment polyfill
  globalThis.HTMLAnchorElement = class HTMLAnchorElement extends (globalThis as unknown as { HTMLElement: new () => object }).HTMLElement {}
}
import {
  buildRowIndexMap,
  computeShiftSelectionRange,
  toggleItemInSet,
  addItemsToSet,
  unwrapBulkActionResponse,
  BULK_ACTION_MAX_LIMIT,
} from "../../src/routes/Admin/adminPostsWorkspaceBulkModel"
import {
  parsePostsWorkspaceQueryParams,
  serializePostsWorkspaceQueryParams,
} from "../../src/routes/Admin/adminPostsWorkspaceUrlModel"
import { generatePaginationPages } from "../../src/routes/Admin/adminPostsWorkspacePaginationModel"
import {
  isOffsetInsideCodeOrMathContext,
  isAsciiWhitespace,
  hasWhitespaceOrSlash,
} from "../../src/components/markdown-editor/markdownEditorSlashContextScanner"
import {
  convertTsvToMarkdownTable,
  resolveSmartPasteText,
} from "../../src/components/markdown-editor/markdownEditorTsvTablePasteModel"
import { unwrapTempDraftRecoveryResponse } from "../../src/routes/Admin/useEditorStudioDraftLifecycleModel"
import { buildTempDraftSaveSummaryPayload } from "../../src/routes/Admin/useEditorStudioKeyboardShortcuts"
import {
  CodeLineBitset,
  extractCodeBlockTitle,
  extractWordHighlightPatterns,
  highlightWordsInHtml,
} from "../../src/libs/markdown/codeBlockMetaScanner"
import {
  extractSlashTriggerFromLine,
  computeSlashSpecMatchScore,
  SLASH_COMMAND_SPECS,
} from "../../src/components/markdown-editor/useMarkdownEditorSlashMenu"
import { parseAdminPostsFacetCounts } from "../../src/routes/Admin/AdminPostsWorkspaceModel"
import {
  handleAdminPostsListKeyDown,
  ADMIN_POSTS_ROW_ATTR,
  ADMIN_POSTS_ROW_PRIMARY_ATTR,
} from "../../src/routes/Admin/AdminPostsWorkspaceListKeyboard"
import { packTableUiState, unpackTableUiState } from "../../src/libs/markdown/MarkdownRendererTable"

test.describe("OSS UX & Perf Features Unit Tests", () => {
  test.describe("1. Admin Posts Bulk Selection Model", () => {
    const postIds = [101, 102, 103, 104, 105]

    test("toggles single item in Set", () => {
      let set = new Set<number>()
      expect(set.size).toBe(0)

      set = toggleItemInSet(set, 101)
      expect(set.has(101)).toBe(true)
      expect(set.size).toBe(1)

      set = toggleItemInSet(set, 101)
      expect(set.has(101)).toBe(false)
      expect(set.size).toBe(0)
    })

    test("computes range selection via Shift+Click with O(1) index map", () => {
      const indexMap = buildRowIndexMap(postIds)
      expect(indexMap.get(102)).toBe(1)
      expect(indexMap.get(104)).toBe(3)

      const fromIndex = indexMap.get(102)!
      const toIndex = indexMap.get(104)!
      const rangeIds = computeShiftSelectionRange(fromIndex, toIndex, postIds)

      expect(rangeIds).toEqual([102, 103, 104])

      const set = addItemsToSet(new Set([101]), rangeIds)
      expect(set.has(101)).toBe(true)
      expect(set.has(102)).toBe(true)
      expect(set.has(103)).toBe(true)
      expect(set.has(104)).toBe(true)
      expect(set.has(105)).toBe(false)
    })

    test("enforces bulk action upper limit constant and unwraps RsData envelope", () => {
      expect(BULK_ACTION_MAX_LIMIT).toBe(50)
      expect(
        unwrapBulkActionResponse({
          resultCode: "200-1",
          msg: "ok",
          data: { processedCount: 3, ids: [10, 20, 30] },
        })
      ).toEqual({
        processedCount: 3,
        ids: [10, 20, 30],
        failedCount: undefined,
      })
      expect(unwrapBulkActionResponse({ processedCount: 2 })).toEqual({ processedCount: 2 })
    })
  })

  test.describe("2. Admin Posts URL Query Synchronization", () => {
    test("parses query parameters with fallbacks", () => {
      const parsed = parsePostsWorkspaceQueryParams({
        status: "deleted",
        page: "3",
        pageSize: "20",
        kw: "typescript",
        sort: "HIT_COUNT",
      })

      expect(parsed.status).toBe("deleted")
      expect(parsed.page).toBe("3")
      expect(parsed.pageSize).toBe("20")
      expect(parsed.kw).toBe("typescript")
      expect(parsed.sort).toBe("HIT_COUNT")
      expect(parsed.scope).toBe("deleted")
    })

    test("falls back to default values for missing or invalid query parameters", () => {
      const parsed = parsePostsWorkspaceQueryParams({})
      expect(parsed.status).toBe("all")
      expect(parsed.page).toBe("1")
      expect(parsed.pageSize).toBe("20")
      expect(parsed.kw).toBe("")
      expect(parsed.sort).toBe("MODIFIED_AT")
      expect(parsed.scope).toBe("active")
    })

    test("serializes URL query cleanly omitting defaults", () => {
      const query = serializePostsWorkspaceQueryParams({
        status: "all",
        page: "1",
        pageSize: "20",
        kw: "",
        sort: "MODIFIED_AT",
        scope: "active",
      })
      expect(Object.keys(query).length).toBe(0)

      const activeQuery = serializePostsWorkspaceQueryParams({
        status: "published",
        page: "2",
        pageSize: "30",
        kw: "react",
        sort: "CREATED_AT",
        scope: "active",
      })
      expect(activeQuery.status).toBe("published")
      expect(activeQuery.page).toBe("2")
      expect(activeQuery.pageSize).toBe("30")
      expect(activeQuery.kw).toBe("react")
      expect(activeQuery.sort).toBe("CREATED_AT")
    })
  })

  test.describe("3. Sliding Pagination Model", () => {
    test("returns full sequence when total pages <= maxVisible", () => {
      expect(generatePaginationPages(1, 5)).toEqual([1, 2, 3, 4, 5])
      expect(generatePaginationPages(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    test("returns sliding window with ellipsis when total pages > 7", () => {
      const startPages = generatePaginationPages(1, 10)
      expect(startPages).toEqual([1, 2, "ellipsis", 10])

      const middlePages = generatePaginationPages(5, 10)
      expect(middlePages).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10])

      const endPages = generatePaginationPages(10, 10)
      expect(endPages).toEqual([1, "ellipsis", 9, 10])
    })
  })

  test.describe("4. Slash Menu Context Scanner & ASCII Bitmask", () => {
    test("classifies ASCII whitespace and slash via bitmask lookup", () => {
      expect(isAsciiWhitespace(32)).toBe(true) // space
      expect(isAsciiWhitespace(9)).toBe(true)  // \t
      expect(isAsciiWhitespace(10)).toBe(true) // \n
      expect(isAsciiWhitespace(65)).toBe(false) // 'A'

      expect(hasWhitespaceOrSlash("abc/def")).toBe(true)
      expect(hasWhitespaceOrSlash("hello world")).toBe(true)
      expect(hasWhitespaceOrSlash("command")).toBe(false)
    })

    test("detects when offset is inside fenced code block", () => {
      const doc = "Some intro\n```ts\nconst x = /;\n```\nOutside"
      const insideOffset = doc.indexOf("/;")
      const outsideOffset = doc.indexOf("Outside")

      expect(isOffsetInsideCodeOrMathContext(doc, insideOffset)).toBe(true)
      expect(isOffsetInsideCodeOrMathContext(doc, outsideOffset)).toBe(false)
    })

    test("detects when offset is inside inline code or math block", () => {
      const doc = "Here is `code / cmd` and $E = mc^2 / 2$ and outside /"
      const inlineCodeSlash = doc.indexOf("`code /") + 7
      const mathSlash = doc.indexOf("mc^2 /") + 5
      const outsideSlash = doc.lastIndexOf("/")

      expect(isOffsetInsideCodeOrMathContext(doc, inlineCodeSlash)).toBe(true)
      expect(isOffsetInsideCodeOrMathContext(doc, mathSlash)).toBe(true)
      expect(isOffsetInsideCodeOrMathContext(doc, outsideSlash)).toBe(false)
    })
  })

  test.describe("5. Spreadsheet TSV Table Smart Paste Model", () => {
    test("converts multi-line TSV data into GFM markdown table", () => {
      const tsv = "Name\tAge\tRole\nAlice\t30\tEngineer\nBob\t25\tDesigner\n"
      const table = convertTsvToMarkdownTable(tsv)

      expect(table).not.toBeNull()
      expect(table).toContain("| Name | Age | Role |")
      expect(table).toContain("| --- | --- | --- |")
      expect(table).toContain("| Alice | 30 | Engineer |")
      expect(table).toContain("| Bob | 25 | Designer |")
    })

    test("escapes pipe characters inside table cells", () => {
      const tsv = "Expr\tMeaning\nA | B\tLogical OR\n"
      const table = convertTsvToMarkdownTable(tsv)

      expect(table).not.toBeNull()
      expect(table).toContain("| A \\| B | Logical OR |")
    })

    test("rejects non-TSV text or single line input fail-closed", () => {
      expect(convertTsvToMarkdownTable("Just some plain text")).toBeNull()
      expect(convertTsvToMarkdownTable("Col1\tCol2")).toBeNull() // single line
      expect(convertTsvToMarkdownTable("Line 1\nLine 2 without tabs\n")).toBeNull()
    })

    test("skips table conversion when pasting inside code or math context", () => {
      const doc = "```ts\n\n```"
      const cursorOffset = 6 // inside code block
      const tsv = "Col1\tCol2\nVal1\tVal2\n"

      const resolved = resolveSmartPasteText(tsv, doc, cursorOffset)
      expect(resolved.isTable).toBe(false)
      expect(resolved.text).toBe(tsv)
    })
  })

  test.describe("6. Temp Draft Recovery & Autosave Payload Guards", () => {
    test("unwraps RsData envelope from GET /post/api/v1/posts/temp", () => {
      const wrapped = {
        resultCode: "200-1",
        msg: "기존 임시저장 글을 불러옵니다.",
        data: { id: 77, title: "초안", content: "내용" },
      }
      expect(unwrapTempDraftRecoveryResponse(wrapped)).toEqual({
        id: 77,
        title: "초안",
        content: "내용",
      })
      expect(
        unwrapTempDraftRecoveryResponse({
          resultCode: "200-2",
          msg: "임시저장 글이 없습니다.",
          data: null,
        })
      ).toBeNull()
      expect(unwrapTempDraftRecoveryResponse({ id: 88, title: "직접 응답" })).toEqual({
        id: 88,
        title: "직접 응답",
      })
    })

    test("omits summary text when summaryMode is AUTO to satisfy backend fail-closed contract", () => {
      expect(buildTempDraftSaveSummaryPayload("추출 요약", "EXTRACTED")).toEqual({
        summary: null,
        summaryMode: "AUTO",
      })
      expect(buildTempDraftSaveSummaryPayload("직접 작성한 요약", "MANUAL")).toEqual({
        summary: "직접 작성한 요약",
        summaryMode: "MANUAL",
      })
      expect(buildTempDraftSaveSummaryPayload("   ", "MANUAL")).toEqual({
        summary: null,
        summaryMode: "AUTO",
      })
    })
  })

  test.describe("7. Low-level CodeBlock Meta Scanner & Uint32Array Bitset", () => {
    test("parses line highlight syntax {1,3-5} into CodeLineBitset with exact parity", () => {
      const bitset = CodeLineBitset.parse("{1,3-5,8}")
      expect(bitset.hasLine(1)).toBe(true)
      expect(bitset.hasLine(2)).toBe(false)
      expect(bitset.hasLine(3)).toBe(true)
      expect(bitset.hasLine(4)).toBe(true)
      expect(bitset.hasLine(5)).toBe(true)
      expect(bitset.hasLine(6)).toBe(false)
      expect(bitset.hasLine(8)).toBe(true)
      expect(bitset.hasLine(0)).toBe(false)
      expect(bitset.size).toBe(5)
    })

    test("handles out-of-order and overlapping ranges fail-closed up to 16384 lines", () => {
      const bitset = CodeLineBitset.parse("{10-12, 11-14, 2}")
      expect(bitset.hasLine(2)).toBe(true)
      expect(bitset.hasLine(10)).toBe(true)
      expect(bitset.hasLine(11)).toBe(true)
      expect(bitset.hasLine(12)).toBe(true)
      expect(bitset.hasLine(13)).toBe(true)
      expect(bitset.hasLine(14)).toBe(true)
      expect(bitset.hasLine(15)).toBe(false)

      const overflowBitset = CodeLineBitset.parse("{20000}")
      expect(overflowBitset.hasLine(20000)).toBe(false)
    })

    test("extracts codeblock filename title in both [filename] and title='...' forms", () => {
      expect(extractCodeBlockTitle("ts [src/main.ts] {1-3}")).toBe("src/main.ts")
      expect(extractCodeBlockTitle("python title=\"app.py\" /word/")).toBe("app.py")
      expect(extractCodeBlockTitle("bash filename='deploy.sh'")).toBe("deploy.sh")
      expect(extractCodeBlockTitle("rust")).toBe("")
    })

    test("extracts /word/ highlight patterns up to 16 patterns and 128 chars without matching quoted paths", () => {
      const patterns = extractWordHighlightPatterns('ts title="src/api/post.ts" [src/sub/index.ts] {1-3} /hello/ /world/ /const/')
      expect(patterns).toEqual(["hello", "world", "const"])

      const emptyPatterns = extractWordHighlightPatterns('ts title="src/a/b/c.ts" {1-3}')
      expect(emptyPatterns).toEqual([])
    })

    test("highlights words in HTML text segments while preserving inner HTML tags and HTML entities", () => {
      const html = '<span class="token keyword">const</span> <span class="token string">"hello &amp; &lt;amp&gt; world"</span>'
      const highlighted = highlightWordsInHtml(html, ["hello", "amp", "lt"])
      expect(highlighted).toContain('<mark class="aq-code-word-mark">hello</mark>')
      expect(highlighted).toContain('&amp; &lt;<mark class="aq-code-word-mark">amp</mark>&gt;')
      // HTML 태그 속성값 및 HTML 엔티티(&amp;, &lt;, &gt;)는 절대 훼손되지 않아야 함
      expect(highlighted).toContain('class="token string"')
    })

    test("fills multi-word ranges via 32-bit word masks with exact popcount size", () => {
      const bitset = CodeLineBitset.parse("{1-130, 125-260, 511-514}")
      expect(bitset.size).toBe(260 + 4)
      expect(bitset.has(1)).toBe(true)
      expect(bitset.has(31)).toBe(true)
      expect(bitset.has(32)).toBe(true)
      expect(bitset.has(64)).toBe(true)
      expect(bitset.has(260)).toBe(true)
      expect(bitset.has(261)).toBe(false)
      expect(bitset.has(512)).toBe(true)
      expect(bitset.toSet().size).toBe(264)
    })
  })

  test.describe("8. Slash Menu In-line Trigger & Bit-packed Ranking", () => {
    test("triggers slash menu after inline space in regular text", () => {
      const trigger = extractSlashTriggerFromLine("Write a note /table")
      expect(trigger).not.toBeNull()
      expect(trigger?.query).toBe("table")
      expect(trigger?.slashIndex).toBe(13)
    })

    test("triggers slash menu at line start and quote/list prefix", () => {
      expect(extractSlashTriggerFromLine("/heading")?.query).toBe("heading")
      expect(extractSlashTriggerFromLine("> /quote")?.query).toBe("quote")
      expect(extractSlashTriggerFromLine("- /item")?.query).toBe("item")
      expect(extractSlashTriggerFromLine("1. /num")?.query).toBe("num")
    })

    test("rejects slash in URLs, HTML closing tags, and links fail-closed", () => {
      expect(extractSlashTriggerFromLine("Visit https://aquilax.net/post")).toBeNull()
      expect(extractSlashTriggerFromLine("See http://localhost/test")).toBeNull()
      expect(extractSlashTriggerFromLine("<div>/tag")).toBeNull()
      expect(extractSlashTriggerFromLine("[label](/path)")).toBeNull()
      expect(extractSlashTriggerFromLine("Text with /multi word query")).toBeNull()
    })

    test("ranks slash commands with bit-packed integer score (Tier 4 > Tier 3 > Tier 2 > Tier 1)", () => {
      const tableSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "table")!
      const codeSpec = SLASH_COMMAND_SPECS.find((s) => s.id === "code")!

      // 정확 일치 (Tier 4)
      const exactScore = computeSlashSpecMatchScore(tableSpec, 0, "table")
      // 접두사 일치 (Tier 3)
      const prefixScore = computeSlashSpecMatchScore(tableSpec, 0, "tab")
      // 키워드 일치 (Tier 2: grid/표)
      const keywordScore = computeSlashSpecMatchScore(tableSpec, 0, "grid")
      // 부분 문자열 일치 (Tier 1)
      const subScore = computeSlashSpecMatchScore(tableSpec, 0, "ble")

      expect(exactScore >>> 16).toBe(4)
      expect(prefixScore >>> 16).toBe(3)
      expect(keywordScore >>> 16).toBe(2)
      expect(subScore >>> 16).toBe(1)
      expect(exactScore).toBeGreaterThan(prefixScore)
      expect(prefixScore).toBeGreaterThan(keywordScore)
      expect(keywordScore).toBeGreaterThan(subScore)
    })
  })

  test.describe("9. Admin Posts Facet Counts & Table Keyboard Navigation", () => {
    test("parses admin posts facet counts safely from backend count response", () => {
      const counts = parseAdminPostsFacetCounts({
        all: 100,
        published: 80,
        draft: 15,
        privateCount: 5,
        deleted: 3,
        unlisted: 2,
      })
      expect(counts).not.toBeNull()
      expect(counts?.all).toBe(100)
      expect(counts?.published).toBe(80)
      expect(counts?.draft).toBe(15)
      expect(counts?.privateCount).toBe(5)
      expect(counts?.deleted).toBe(3)
    })

    test("handles undefined or missing facet fields gracefully", () => {
      const counts = parseAdminPostsFacetCounts(null)
      expect(counts).toBeNull()

      const emptyCounts = parseAdminPostsFacetCounts({})
      expect(emptyCounts).not.toBeNull()
      expect(emptyCounts?.all).toBeUndefined()
      expect(emptyCounts?.published).toBeUndefined()
    })

    test("handles j/k/x/e key navigation in admin posts list", () => {
      let toggled = false
      let opened = false

      const dummyRow = {
        closest: (sel: string) => (sel.includes(ADMIN_POSTS_ROW_ATTR) ? dummyRow : null),
        querySelector: (sel: string) => {
          if (sel.includes("checkbox")) return { click: () => { toggled = true } }
          return null
        },
      } as unknown as HTMLElement

      let defaultPrevented = false
      const mockEventX = {
        target: dummyRow,
        key: "x",
        preventDefault: () => { defaultPrevented = true },
      } as unknown as import("react").KeyboardEvent<HTMLElement>

      handleAdminPostsListKeyDown(mockEventX, {} as ParentNode, {
        onToggleCurrentRowSelect: () => { toggled = true },
        onOpenCurrentRowEditor: () => { opened = true },
      })

      expect(defaultPrevented).toBe(true)
      expect(toggled).toBe(true)

      let editPrevented = false
      const mockEventE = {
        target: dummyRow,
        key: "e",
        preventDefault: () => { editPrevented = true },
      } as unknown as import("react").KeyboardEvent<HTMLElement>

      handleAdminPostsListKeyDown(mockEventE, {} as ParentNode, {
        onToggleCurrentRowSelect: () => { toggled = true },
        onOpenCurrentRowEditor: () => { opened = true },
      })

      expect(editPrevented).toBe(true)
      expect(opened).toBe(true)
    })
  })

  test.describe("10. Table UI State Bitpack & Unpack", () => {
    test("packs and unpacks scroll flags and column count deterministically", () => {
      const mask = packTableUiState(true, true, 5)
      const unpacked = unpackTableUiState(mask)

      expect(unpacked.hasScrollLeft).toBe(true)
      expect(unpacked.showScrollHint).toBe(true)
      expect(unpacked.detectedColumnCount).toBe(5)

      const mask2 = packTableUiState(false, true, 12)
      const unpacked2 = unpackTableUiState(mask2)
      expect(unpacked2.hasScrollLeft).toBe(false)
      expect(unpacked2.showScrollHint).toBe(true)
      expect(unpacked2.detectedColumnCount).toBe(12)
    })
  })
})
