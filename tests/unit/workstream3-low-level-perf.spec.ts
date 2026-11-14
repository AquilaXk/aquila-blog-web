import { expect, test } from "@playwright/test"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { GFM } from "@lezer/markdown"
import type { ComponentType } from "react"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { materializePlaywrightJsx, wrapPlaywrightJsxComponent } from "./helpers/materializePlaywrightJsx"
import {
  ASCII_ALPHA_BIT,
  ASCII_CHAR_FLAGS,
  ASCII_DIGIT_BIT,
  ASCII_PREFIX_BIT,
  ASCII_SPACE_BIT,
  isAsciiAlphaNumericCode,
  isAsciiDigitCode,
  isAsciiMathPrefixCode,
  isAsciiSpaceCode,
  matchLowerAsciiPrefixAt,
} from "../../src/libs/markdown/asciiScannerTable"
import {
  parseCommonMarkBlockRanges,
  collectCommonMarkCodeBlockRanges,
} from "../../src/libs/markdown/commonMarkCodeBlockRanges"
import {
  createProtectedInlineSentinels,
  DEFAULT_PROTECTED_INLINE_SENTINELS,
  hasValidMarkdownMath,
} from "../../src/libs/markdown/inlineMathGuardModel"
import { MarkdownFootnoteReferenceLink } from "../../src/libs/markdown/MarkdownRendererFootnotes"
import { normalizeMarkdownInlineChildren } from "../../src/libs/markdown/MarkdownRendererInline"
import { scanPandocInlineMathAt } from "../../src/libs/markdown/pandocMathScanner"
import type { MarkdownFootnote } from "../../src/libs/markdown/renderingFootnoteModel"
import { LanguageProvider } from "../../src/libs/language"
import {
  ENTRY_FLAG_MULTILINE,
  buildMarkdownLivePreviewEntries,
  isTokenActive,
  unpackLivePreviewEntryMeta,
} from "../../src/components/markdown-editor/markdownEditorLivePreview"
import {
  buildDecorations,
  decorationField,
  editorModeField,
  haveSameActiveWatchHits,
  setEditorMode,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  maskMathSpanPreservingOffsets,
  maskMultipleMathSpansPreservingOffsets,
} from "../../src/components/markdown-editor/markdownEditorMathModel"
import {
  computeFrameTrigRates,
  createParticleSeeds,
  createParticleSoABuffers,
  evaluateParticleWavesFromSoA,
} from "../../src/routes/Company/CompanyHeroParticles"

const collectDecoSnapshot = (decoSet: ReturnType<typeof buildDecorations>, docLen: number): string[] => {
  const entries: string[] = []
  decoSet.between(0, docLen, (from, to, value) => {
    const spec = value.spec as {
      class?: string
      attributes?: Record<string, string>
      widget?: { constructor?: { name?: string } }
    }
    const cls = spec.class ?? ""
    const widgetName = spec.widget?.constructor?.name ?? ""
    const attrs = spec.attributes ? JSON.stringify(spec.attributes) : ""
    entries.push(`${from}:${to}:${cls}:${widgetName}:${attrs}`)
  })
  return entries
}

test.describe("Workstream 3 — Low-level bitmask, AST, CM6, and SoA particle optimizations", () => {
  test("1. 32-bit usedMask selects lowest unset nonce cleanly including >=32 overflow and angle/entity traps", () => {
    expect(createProtectedInlineSentinels("Plain text without prefix")).toBe(
      DEFAULT_PROTECTED_INLINE_SENTINELS
    )

    const partial = "text aqp0z aqp1z aqp2z aqp4z"
    const s1 = createProtectedInlineSentinels(partial)
    expect(s1.prefix).toBe("\uE000aqp3z")

    // Saturate lower 32 nonces (0..31) plus overflow nonce 32; expect selection of 33.
    const collisions: string[] = []
    for (let n = 0; n <= 32; n += 1) collisions.push(`aqp${n}z`)
    // Also place colliding entity `&#97;qp33z` (`&#97;` == 'a') so 33 must be skipped too.
    collisions.push("&#97;qp33z")
    const sOverflow = createProtectedInlineSentinels(collisions.join(" "))
    expect(sOverflow.prefix).toBe("\uE000aqp34z")

    // Escaped/angle-split edge cases must still avoid collision
    expect(createProtectedInlineSentinels("<tag aqp0z> aqp1z").prefix).toBe("\uE000aqp2z")
  })

  test("2. 128-byte ASCII_CHAR_FLAGS bitmask and allocation-free (ch | 0x20) URL matcher reject non-letter folds", () => {
    expect(ASCII_CHAR_FLAGS).toBeInstanceOf(Uint8Array)
    expect(ASCII_CHAR_FLAGS).toHaveLength(128)
    expect(ASCII_CHAR_FLAGS[48]! & ASCII_DIGIT_BIT).toBe(ASCII_DIGIT_BIT)
    expect(ASCII_CHAR_FLAGS[65]! & ASCII_ALPHA_BIT).toBe(ASCII_ALPHA_BIT)
    expect(ASCII_CHAR_FLAGS[32]! & ASCII_SPACE_BIT).toBe(ASCII_SPACE_BIT)
    expect(ASCII_CHAR_FLAGS[40]! & ASCII_PREFIX_BIT).toBe(ASCII_PREFIX_BIT)
    expect(isAsciiDigitCode(57)).toBe(true)
    expect(isAsciiDigitCode(0x138)).toBe(false)
    expect(isAsciiAlphaNumericCode(90)).toBe(true)
    expect(isAsciiSpaceCode(9)).toBe(true)
    expect(isAsciiMathPrefixCode(124)).toBe(true)

    expect(matchLowerAsciiPrefixAt("  hTtPs://example.com", 2, "https://")).toBe(true)
    // Punctuation 0x40 ('@') or 0x60 ('`') must NOT fold into space or letters.
    expect(matchLowerAsciiPrefixAt("http`://example.com", 0, "https://")).toBe(false)
    expect(matchLowerAsciiPrefixAt("http@://example.com", 0, "https://")).toBe(false)

    // Scanner skips inline math lookalike inside autolink (<HTTPS>, <FTP>) & uppercase HTTP/HTTPS bare URLs.
    const doc = "<HTTPS://example.com/$1> and HTTPS://files.example/$x+y$ vs real $x+y$."
    expect(hasValidMarkdownMath(doc)).toBe(true)
    expect(scanPandocInlineMathAt(doc, doc.lastIndexOf("$", doc.length - 5))).toMatchObject({
      math: "x+y",
    })
    expect(hasValidMarkdownMath("<HTTPS://example.com/$x$> and <FTP://host/$y$> and HTTP://a.b/$z$")).toBe(false)
  })

  test("3. Single-pass Uint8Array line bitmask handles B=120 custom blocks rapidly and preserves nesting", () => {
    const blocks: string[] = []
    for (let i = 0; i < 120; i += 1) {
      if (i % 3 === 0) {
        blocks.push(`::::callout info Block ${i}\n:::tip Inner ${i}\nbody\n:::\n::::`)
      } else if (i % 3 === 1) {
        blocks.push(`<aside>\nAside block ${i}\n</aside>`)
      } else {
        blocks.push(`\`\`\`ts\nconst block_${i} = "$$ignored$$"\n\`\`\``)
      }
    }
    const largeDoc = blocks.join("\n\n")
    const startedAt = performance.now()
    const parsed = parseCommonMarkBlockRanges(largeDoc)
    const elapsedMs = performance.now() - startedAt

    expect(parsed.asideRanges).toHaveLength(40)
    expect(parsed.codeBlockRanges).toHaveLength(40)
    expect(parsed.containerCloseRanges.length).toBeGreaterThanOrEqual(40)
    expect(elapsedMs).toBeLessThan(250)
    expect(collectCommonMarkCodeBlockRanges("```js\nconst a = 1\n```")).toHaveLength(1)
  })

  test("4. 8-bit inline syntax mask and O(1) Map footnote index handle 1,200 footnotes accurately", () => {
    expect(normalizeMarkdownInlineChildren("plain text without syntax triggers")).toBe(
      "plain text without syntax triggers"
    )
    const complex = normalizeMarkdownInlineChildren(
      "See [[Note|Alias]] {{color:blue|hi}} ==mark== and \"**bold**\""
    )
    expect(Array.isArray(complex) || React.isValidElement(complex) || typeof complex === "string").toBe(true)

    const footnotes: MarkdownFootnote[] = Array.from({ length: 1200 }, (_, i) => ({
      identifier: `fn-${i + 1}`,
      number: i + 1,
      targetId: `user-content-fn-${i + 1}`,
      referenceIds: [`user-content-fnref-${i + 1}`],
      content: `Footnote content **#${i + 1}**`,
    }))

    const WrappedLanguageProvider = wrapPlaywrightJsxComponent(LanguageProvider) as ComponentType<{
      initialLanguage?: "ko" | "en"
      children: React.ReactNode
    }>
    const WrappedRefLink = wrapPlaywrightJsxComponent(MarkdownFootnoteReferenceLink) as ComponentType<
      React.ComponentPropsWithoutRef<typeof MarkdownFootnoteReferenceLink>
    >

    const startedAt = performance.now()
    let lastMarkup = ""
    for (const idx of [0, 599, 1199]) {
      const n = idx + 1
      const linkElement = materializePlaywrightJsx(
        React.createElement(
          WrappedRefLink,
          {
            href: `#user-content-fn-${n}`,
            title: `fn:${`user-content-fnref-${n}`}`,
            footnotes,
            marker: "fn",
          },
          `[${n}]`
        )
      ) as React.ReactElement
      lastMarkup = renderToStaticMarkup(
        React.createElement(WrappedLanguageProvider, {
          initialLanguage: "en",
          children: linkElement,
        })
      )
    }
    const elapsedMs = performance.now() - startedAt
    expect(lastMarkup).toContain("Footnote content")
    expect(lastMarkup).toContain("#user-content-fn-1200")
    expect(elapsedMs).toBeLessThan(150)
  })

  test("5. Chunked math masking preserves CRLF/LF offsets and ENTRY_FLAG_MULTILINE bit", () => {
    const source = "pre $$a\r\nb\nc$$ mid $x+y$ end"
    const first = { from: 4, to: 14 }
    const second = { from: 19, to: 24 }
    const multi = maskMultipleMathSpansPreservingOffsets(source, [first, second])
    const seq = maskMathSpanPreservingOffsets(maskMathSpanPreservingOffsets(source, first), second)
    expect(multi).toBe(seq)
    expect(multi.length).toBe(source.length)
    expect(multi.indexOf("\r\n")).toBe(source.indexOf("\r\n"))

    const entries = buildMarkdownLivePreviewEntries("$$\nx + y\n$$\n\n```\ncode\n```")
    const fencedEntry = entries.find((e) => e.kind === "fenced-code")
    expect(fencedEntry).toBeDefined()
    expect(unpackLivePreviewEntryMeta(fencedEntry!.packedMeta).flags & ENTRY_FLAG_MULTILINE).toBe(
      ENTRY_FLAG_MULTILINE
    )
  })

  test("6. Binary-search watchHits matches brute-force scan across nested intervals at O(log W)", () => {
    const ranges = [{ from: 0, to: 100_000 }]
    for (let i = 1; i < 4000; i += 1) {
      const from = i * 24
      ranges.push({ from, to: from + 10 })
    }
    ranges.sort((a, b) => a.from - b.from || a.to - b.to)

    const bruteForceSame = (prev: { from: number; to: number }[], next: { from: number; to: number }[]) =>
      ranges.every((r) => isTokenActive(r.from, r.to, prev) === isTokenActive(r.from, r.to, next))

    for (let step = 0; step < 300; step += 1) {
      const p = (step * 97) % 96000
      const q = ((step + 1) * 97) % 96000
      const prev = [{ from: p, to: step % 5 === 0 ? p + 6 : p }]
      const next = [{ from: q, to: step % 4 === 0 ? q + 8 : q }]
      expect(haveSameActiveWatchHits(ranges, prev, next)).toBe(bruteForceSame(prev, next))
    }

    // 500 queries across W=4,000 ranges including a 100K-wide enclosing container; keep Playwright expect outside loop.
    const cursorA = [{ from: 38, to: 38 }]
    const cursorB = [{ from: 86, to: 86 }]
    let allMatched = true
    const startMs = performance.now()
    for (let k = 0; k < 500; k += 1) {
      allMatched = allMatched && haveSameActiveWatchHits(ranges, cursorA, cursorB)
    }
    const elapsedMs = performance.now() - startMs
    expect(allMatched).toBe(true)
    expect(elapsedMs).toBeLessThan(40)
  })

  test("7. SilverBullet DirtyRegion incremental decorationField matches full buildDecorations across edits and modes", () => {
    const paragraphs: string[] = []
    for (let i = 0; i < 60; i += 1) {
      if (i === 5) {
        paragraphs.push('<!-- aq-table {"overflowMode":"fit"} -->\n| Key | Val |\n| --- | --- |\n| a | 1 |')
      } else if (i === 12) {
        paragraphs.push(">[!tip] Hint\n> Callout body **bold** `$x$`")
      } else if (i === 20) {
        paragraphs.push("- [x] **Task** [[WikiLink|Alias]] {{color:blue|tag}} ==hi==")
      } else if (i === 30) {
        paragraphs.push("```ts\nconst x = 1\n```")
      } else {
        paragraphs.push(`## Heading ${i}\nParagraph ${i} with **bold**, *em*, and \`code\`.`)
      }
    }
    const initialDoc = paragraphs.join("\n\n")
    let state = EditorState.create({
      doc: initialDoc,
      extensions: [markdown({ base: markdownLanguage, extensions: GFM }), decorationField, editorModeField],
    })

    const assertMatchesFull = (targetState: EditorState) => {
      const actual = collectDecoSnapshot(targetState.field(decorationField), targetState.doc.length)
      const expected = collectDecoSnapshot(buildDecorations(targetState), targetState.doc.length)
      expect(actual).toEqual(expected)
    }
    assertMatchesFull(state)

    // Cursor move inside inactive space should preserve or match identically
    const p40Start = state.doc.toString().indexOf("Paragraph 40")
    state = state.update({ selection: { anchor: p40Start } }).state
    assertMatchesFull(state)

    // Jump cursor into **bold** in paragraph 40, then into table comment at aq-table, then into task prefix
    const p40Bold = state.doc.toString().indexOf("**bold**", p40Start) + 3
    state = state.update({ selection: { anchor: p40Bold } }).state
    assertMatchesFull(state)

    const aqPos = state.doc.toString().indexOf("aq-table") + 2
    state = state.update({ selection: { anchor: aqPos } }).state
    assertMatchesFull(state)

    const taskPos = state.doc.toString().indexOf("- [x]") + 2
    state = state.update({ selection: { anchor: taskPos } }).state
    assertMatchesFull(state)

    // Edit text locally in paragraph 40 (< 50% dirty => partial DecorationSet.update path)
    state = state.update({
      changes: { from: p40Start, to: p40Start + 12, insert: "Updated Para 40 **new**" },
      selection: { anchor: p40Start + 5 },
    }).state
    assertMatchesFull(state)

    // Structural math ripple test: insert and delete unclosed $$ near top of document
    state = state.update({
      changes: { from: 0, to: 0, insert: "$$\n" },
    }).state
    assertMatchesFull(state)
    state = state.update({
      changes: { from: 0, to: 3, insert: "" },
    }).state
    assertMatchesFull(state)

    // Visible range filtering builds only overlapping decorations in O(V log N)
    const p20Start = state.doc.toString().indexOf("- [x] **Task**")
    const p20End = p20Start + 65
    const visibleSnapshot = collectDecoSnapshot(
      buildDecorations(state, [{ from: p20Start, to: p20End }]),
      state.doc.length
    )
    expect(visibleSnapshot.length).toBeGreaterThan(0)
    expect(visibleSnapshot.length).toBeLessThan(
      collectDecoSnapshot(buildDecorations(state), state.doc.length).length
    )

    // Mode toggles live -> reading -> source -> live
    state = state.update({ effects: setEditorMode.of("reading") }).state
    assertMatchesFull(state)
    state = state.update({ effects: setEditorMode.of("source") }).state
    assertMatchesFull(state)
    state = state.update({ effects: setEditorMode.of("live") }).state
    assertMatchesFull(state)
  })

  test("8. CompanyHeroParticles SoA bucket layout & trig-addition identities match direct trig within 1e-5", () => {
    const seeds = createParticleSeeds(22, 12, 5)
    const soa = createParticleSoABuffers(22, 12, 5)
    expect(soa.count).toBe(264)
    expect(soa.bucketCount).toBe(5)

    const expectedCounts = [0, 0, 0, 0, 0]
    for (const s of seeds) expectedCounts[s.colorIndex]! += 1
    for (let b = 0; b < 5; b += 1) {
      const start = soa.bucketStarts[b]!
      const end = soa.bucketEnds[b]!
      expect(end - start).toBe(expectedCounts[b])
      for (let i = start; i < end; i += 1) {
        expect(soa.colorIndices[i]).toBe(b)
      }
    }

    for (const time of [0, 1.37, 42.8]) {
      const frame = computeFrameTrigRates(time)
      for (let i = 0; i < soa.count; i += 1) {
        const rx = soa.refX[i]!
        const ry = soa.refY[i]!
        const sa = soa.seedA[i]!
        const sb = soa.seedB[i]!
        const fast = evaluateParticleWavesFromSoA(soa.trigBases, i, frame)

        expect(Math.abs(fast.noiseSin - Math.sin(rx * 6.5 + ry * 5.2 + time * 1.4))).toBeLessThan(1e-5)
        expect(Math.abs(fast.ambientSin - Math.sin(rx * 3.4 + sa * 4.2 + time))).toBeLessThan(1e-5)
        expect(Math.abs(fast.ambientCos - Math.cos(ry * 3.1 + sb * 4.2 + time * 0.85))).toBeLessThan(1e-5)
        expect(Math.abs(fast.dispXSin - Math.sin(rx * 12 + time * 2.8))).toBeLessThan(1e-5)
        expect(Math.abs(fast.dispXCos - Math.cos(sa * 6.28 + time))).toBeLessThan(1e-5)
        expect(Math.abs(fast.dispYCos - Math.cos(ry * 12 + time * 2.2))).toBeLessThan(1e-5)
        expect(Math.abs(fast.dispYSin - Math.sin(sb * 6.28 + time))).toBeLessThan(1e-5)
        expect(Math.abs(fast.angleJitterSin - Math.sin(sa * 6.28 + time * 0.9))).toBeLessThan(1e-5)
      }
    }
  })
})
