import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { EditorSelection, EditorState } from "@codemirror/state"
import { Decoration, type DecorationSet } from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import { expect, test } from "@playwright/test"
import {
  calloutRegistry,
  type CalloutKind,
  resolveCalloutBlockquote,
  resolveCalloutLegacyEmoji,
} from "../../src/libs/markdown/calloutRegistry"
import {
  parseBlockContainerBlocks,
  type EditorCalloutTone,
} from "../../src/components/markdown-editor/markdownEditorBlockContainerModel"
import {
  blockContainerBlockField,
  getCachedBlockContainerBlocks,
  haveSameActiveContainerBlocks,
} from "../../src/components/markdown-editor/markdownEditorBlockWidgets"
import {
  buildDecorations,
  compositionField,
  disableMermaidField,
  editorModeField,
  getCachedDocBlocks,
  pointerSelectingField,
} from "../../src/components/markdown-editor/markdownEditorLiveSurfaceDecorations"
import {
  VIEWPORT_OVERSCAN_CHARS,
  blockDecorationField,
  buildInlineViewportDecorations,
  expandVisibleRangesToDocLines,
  liveInlineViewportPlugin,
  resolveInlineDecorationsInScope,
} from "../../src/components/markdown-editor/markdownEditorLiveViewportDecorations"
import { hasNewlineBetween } from "../../src/components/markdown-editor/markdownEditorMathModel"
import { resolveLiveCalloutTone } from "../../src/components/markdown-editor/markdownEditorWidgets"

const EXPECTED_LIVE_CALLOUT_BY_KIND: Record<CalloutKind, { kind: string; icon: string }> = {
  tip: { kind: "tip", icon: "💡" },
  info: { kind: "info", icon: "ℹ️" },
  warning: { kind: "warning", icon: "⚠️" },
  danger: { kind: "danger", icon: "🚨" },
  outline: { kind: "outline", icon: "💬" },
  example: { kind: "example", icon: "✨" },
  summary: { kind: "summary", icon: "📌" },
}

const EXPECTED_CONTAINER_TONE_BY_KIND: Record<CalloutKind, EditorCalloutTone> = {
  tip: "tip",
  info: "info",
  warning: "warning",
  danger: "danger",
  outline: "default",
  example: "tip",
  summary: "purple",
}

const EXPECTED_CONTAINER_TONE_BY_EMOJI: Record<string, EditorCalloutTone> = {
  "💡": "tip",
  "✨": "tip",
  "✅": "tip",
  "✔️": "tip",
  "☑️": "tip",
  "ℹ️": "info",
  "ℹ": "info",
  "⚠️": "warning",
  "⚠": "warning",
  "🚨": "danger",
  "❗": "danger",
  "⛔": "danger",
  "📌": "purple",
  "📚": "purple",
  "🧾": "purple",
  "📋": "default",
  "📝": "default",
  "🗒️": "default",
}

const collectDecos = (set: DecorationSet, docLen: number) => {
  const items: Array<{ from: number; to: number; deco: Decoration }> = []
  set.between(0, docLen, (from, to, deco) => {
    items.push({ from, to, deco })
  })
  return items
}

const isReplaceDecoration = (deco: Decoration): boolean => {
  const spec = deco.spec as { widget?: unknown; class?: string; attributes?: unknown; inclusive?: boolean; block?: boolean }
  // Line and mark decorations define class/attributes (and line has from === to with startSide < 0).
  // Decoration.replace either carries a widget or omits class/attributes.
  return spec.class === undefined && spec.attributes === undefined
}

const buildLargeMixedDocument = (sections: number): string => {
  const parts: string[] = []
  for (let i = 0; i < sections; i += 1) {
    parts.push(
      `## Section ${i}`,
      "",
      `Paragraph ${i} with **bold-${i}**, *italic-${i}*, ~~strike-${i}~~, \`code_${i}\`, ==mark-${i}==, {{color:blue|tag-${i}}}, [link-${i}](https://example.com/${i}), and [[Note ${i}|Alias ${i}]].`,
      `- [x] Completed task ${i}`,
      `- [ ] Open task ${i}`,
      `1. Ordered step ${i}`,
      `- Bullet entry ${i}`,
      `> Blockquote note ${i}`,
      "",
      "Inline math $x^2 + y^2 = z^2$ check.",
      ""
    )
    if (i % 40 === 0) {
      parts.push(
        "| Col A | Col B |",
        "| --- | --- |",
        `| Row ${i} | Val ${i} |`,
        "",
        "> [!TIP] Tip Heading",
        `> Tip body ${i}`,
        "",
        "```ts",
        `export const n${i} = ${i}`,
        "```",
        ""
      )
    }
  }
  return parts.join("\n")
}

test.describe("Stage 2 Stream B: Editor Callout Parity & Viewport Perf", () => {
  test("1. calloutRegistry aliases and legacy emojis match resolveLiveCalloutTone and parseBlockContainerBlocks", () => {
    for (const [rawKind, entry] of Object.entries(calloutRegistry) as Array<[CalloutKind, (typeof calloutRegistry)[CalloutKind]]>) {
      const tokens = [rawKind, ...entry.aliases]
      for (const token of tokens) {
        for (const variant of [token.toLowerCase(), token.toUpperCase()]) {
          expect(resolveCalloutBlockquote(variant)?.kind).toBe(rawKind)
          expect(resolveLiveCalloutTone(variant)).toEqual(EXPECTED_LIVE_CALLOUT_BY_KIND[rawKind])

          const parsed = parseBlockContainerBlocks(`:::callout ${variant}\n내용 ${variant}\n:::`)
          expect(parsed).toHaveLength(1)
          expect(parsed[0]?.kind).toBe("callout")
          if (parsed[0]?.kind === "callout") {
            expect(parsed[0].tone).toBe(EXPECTED_CONTAINER_TONE_BY_KIND[rawKind])
          }
        }
      }

      for (const emoji of entry.legacyEmoji) {
        expect(resolveCalloutLegacyEmoji(emoji)?.kind).toBe(rawKind)
        const headerParsed = parseBlockContainerBlocks(`:::callout ${emoji} 제목\n본문\n:::`)
        expect(headerParsed).toHaveLength(1)
        if (headerParsed[0]?.kind === "callout") {
          expect(headerParsed[0].tone).toBe(EXPECTED_CONTAINER_TONE_BY_EMOJI[emoji])
        }

        const bodyParsed = parseBlockContainerBlocks(`:::callout\n${emoji} 제목\n본문\n:::`)
        expect(bodyParsed).toHaveLength(1)
        if (bodyParsed[0]?.kind === "callout") {
          expect(bodyParsed[0].tone).toBe(EXPECTED_CONTAINER_TONE_BY_EMOJI[emoji])
        }
      }
    }

    // Preserve explicit legacy contracts for container tokens and live tones
    expect(resolveLiveCalloutTone("unknown-kind")).toEqual({ kind: "info", icon: "ℹ️" })
    const preserved = parseBlockContainerBlocks(
      [
        ":::callout tip\na\n:::",
        ":::callout warning\nb\n:::",
        ":::callout purple\nc\n:::",
        ":::callout default\nd\n:::",
        ":::callout success\ne\n:::",
      ].join("\n\n")
    )
    expect(preserved.map((b) => (b.kind === "callout" ? `${b.tone}:${b.icon}` : ""))).toEqual([
      "tip:💡",
      "warning:⚠️",
      "purple:📌",
      "default:💡",
      "tip:✅",
    ])
  })

  test("2. 2,000+ line liveInlineViewportPlugin + blockDecorationField enforces RangeError safety, viewport exclusion, equivalence, and real speedup", () => {
    const docText = buildLargeMixedDocument(210)
    const lineCount = docText.split("\n").length
    expect(lineCount).toBeGreaterThan(2000)

    const state = EditorState.create({
      doc: docText,
      extensions: [
        markdown({ base: markdownLanguage, extensions: GFM }),
        editorModeField,
        compositionField,
        disableMermaidField,
        pointerSelectingField,
        blockDecorationField,
      ],
    })

    // Viewport near the middle of the 2,200+ line document
    const midStartLine = Math.floor(lineCount / 2)
    const viewport = {
      from: state.doc.line(midStartLine).from,
      to: state.doc.line(midStartLine + 25).to,
    }
    const mergedVisibleRegions = expandVisibleRangesToDocLines(state.doc, [viewport], VIEWPORT_OVERSCAN_CHARS)
    expect(mergedVisibleRegions).toHaveLength(1)
    const visRegion = mergedVisibleRegions[0]!
    expect(visRegion.from).toBeLessThanOrEqual(Math.max(0, viewport.from - VIEWPORT_OVERSCAN_CHARS))
    expect(visRegion.to).toBeGreaterThanOrEqual(Math.min(state.doc.length, viewport.to + VIEWPORT_OVERSCAN_CHARS))
    expect(visRegion.from).toBe(state.doc.lineAt(visRegion.from).from)
    expect(visRegion.to).toBe(state.doc.lineAt(visRegion.to).to)

    const inlineViewportDecos = buildInlineViewportDecorations(state, [viewport])
    const blockDecos = state.field(blockDecorationField)
    const fullDecos = buildDecorations(state)

    const inlineItems = collectDecos(inlineViewportDecos, state.doc.length)
    const blockItems = collectDecos(blockDecos, state.doc.length)
    const fullItems = collectDecos(fullDecos, state.doc.length)

    // Non-visible exclusion check: no inline decoration lies completely outside mergedVisibleRegions
    const outsideInlineItems = inlineItems.filter(
      (item) => item.to <= visRegion.from || item.from >= visRegion.to
    )
    expect(outsideInlineItems).toHaveLength(0)
    expect(inlineItems.length).toBeGreaterThan(20)
    expect(fullItems.length).toBeGreaterThan(inlineItems.length * 4)

    // ViewPlugin RangeError invariant: ZERO block decorations and ZERO multi-line Decoration.replace in inline plugin output
    for (const item of inlineItems) {
      const spec = item.deco.spec as { block?: boolean }
      expect(spec.block).not.toBe(true)
      if (isReplaceDecoration(item.deco)) {
        expect(hasNewlineBetween(docText, item.from, item.to)).toBe(false)
        expect(state.doc.lineAt(item.from).number).toBe(state.doc.lineAt(item.to).number)
      }
    }

    // Even if a weird wikilink/replace candidate spans lines, resolveInlineDecorationsInScope guards it fail-closed
    const edgeCaseDoc = "[[alpha\nbeta]]\n\n- [x] ok\n1. step"
    const edgeState = EditorState.create({
      doc: edgeCaseDoc,
      extensions: [markdown({ base: markdownLanguage, extensions: GFM }), editorModeField],
    })
    const edgeInline = resolveInlineDecorationsInScope(edgeState, getCachedDocBlocks(edgeState), "live", [
      { from: 0, to: edgeCaseDoc.length },
    ])
    for (const r of edgeInline) {
      const spec = r.value.spec as { block?: boolean }
      expect(spec.block).not.toBe(true)
      if (isReplaceDecoration(r.value)) {
        expect(hasNewlineBetween(edgeCaseDoc, r.from, r.to)).toBe(false)
      }
    }

    // Equivalence check inside strict inner viewport window (well away from block boundary clipping)
    const toKey = (item: { from: number; to: number; deco: Decoration }) => {
      const spec = item.deco.spec as { class?: string; widget?: { constructor?: { name?: string } } }
      return `${item.from}:${item.to}:${spec.class ?? spec.widget?.constructor?.name ?? "replace"}`
    }
    const splitUnionInViewport = new Set(
      [...inlineItems, ...blockItems]
        .filter((i) => i.from >= viewport.from && i.to <= viewport.to)
        .map(toKey)
    )
    const fullInViewport = new Set(
      fullItems.filter((i) => i.from >= viewport.from && i.to <= viewport.to).map(toKey)
    )
    expect([...splitUnionInViewport].sort()).toEqual([...fullInViewport].sort())

    // Moving cursor onto inline **bold** far from any table/callout/image/math/mermaid keeps blockDecorationField reference identical
    const boldOffset = docText.indexOf("**bold-1**", 0)
    expect(boldOffset).toBeGreaterThan(-1)
    const afterInlineCursor = state.update({
      selection: EditorSelection.cursor(boldOffset + 3),
    }).state
    expect(afterInlineCursor.field(blockDecorationField)).toBe(blockDecos)

    // Incremental doc change far away from blocks keeps off-region block widgets accurate
    const afterProseEdit = afterInlineCursor.update({
      changes: { from: boldOffset, to: boldOffset, insert: "edited " },
    }).state
    const fullAfterEditBlocks = collectDecos(buildDecorations(afterProseEdit), afterProseEdit.doc.length).filter((item) => {
      const name = (item.deco.spec as { widget?: { constructor?: { name?: string } } }).widget?.constructor?.name
      return name === "MarkdownTableWidget" || name === "MarkdownCalloutWidget" || name === "MarkdownImageWidget" || name === "MarkdownMathWidget" || name === "MarkdownMermaidWidget"
    })
    const fieldAfterEditBlocks = collectDecos(afterProseEdit.field(blockDecorationField), afterProseEdit.doc.length)
    expect(fieldAfterEditBlocks.map(toKey)).toEqual(fullAfterEditBlocks.map(toKey))

    // Background prose doc without any block widgets keeps empty Decoration.none cleanly
    const plainState = EditorState.create({
      doc: "- [x] done\n- [X] cap\n- [ ] open\n-\t[x] tabbed\n1. first\n12. twelfth\n- bullet",
      extensions: [markdown({ base: markdownLanguage, extensions: GFM }), editorModeField, blockDecorationField],
    })
    expect(plainState.field(blockDecorationField).size).toBe(0)
    const plainInline = buildInlineViewportDecorations(plainState, [{ from: 0, to: plainState.doc.length }])
    expect(collectDecos(plainInline, plainState.doc.length).map(toKey)).toEqual(
      collectDecos(buildDecorations(plainState), plainState.doc.length).map(toKey)
    )

    // Check liveInlineViewportPlugin reference exists and exports valid CM6 ViewPlugin
    expect(liveInlineViewportPlugin).toBeDefined()

    // Real performance.now() speedup measurement (viewport build vs full build)
    for (let i = 0; i < 5; i += 1) {
      buildDecorations(state)
      buildInlineViewportDecorations(state, [viewport])
    }
    const iterations = 40
    const tFullStart = performance.now()
    for (let i = 0; i < iterations; i += 1) {
      buildDecorations(state)
    }
    const fullMs = performance.now() - tFullStart

    const tViewportStart = performance.now()
    for (let i = 0; i < iterations; i += 1) {
      buildInlineViewportDecorations(state, [viewport])
    }
    const viewportMs = performance.now() - tViewportStart

    console.info(`[stage2-perf] 2,200+ line 40x build: full=${fullMs.toFixed(2)}ms viewport=${viewportMs.toFixed(2)}ms`)
    expect(viewportMs).toBeLessThan(fullMs * 0.6)
  })

  test("3. markdownEditorBlockWidgets WeakMap doc cache eliminates thrashing and O(log B) haveSameActiveContainerBlocks matches brute-force", () => {
    const docTextA = Array.from({ length: 600 }, (_, i) => `:::callout tip\n### 제목 ${i}\n본문 ${i}\n:::`).join("\n\n")
    const docTextB = `:::callout warning\n경고\n:::\n`

    const stateA = EditorState.create({ doc: docTextA, extensions: [blockContainerBlockField, editorModeField] })
    const stateB = EditorState.create({ doc: docTextB, extensions: [blockContainerBlockField, editorModeField] })

    const blocksA1 = getCachedBlockContainerBlocks(stateA.doc)
    expect(blocksA1).toHaveLength(600)
    const blocksB = getCachedBlockContainerBlocks(stateB.doc)
    expect(blocksB).toHaveLength(1)
    // WeakMap retains stateA.doc even after accessing stateB.doc
    const blocksA2 = getCachedBlockContainerBlocks(stateA.doc)
    expect(blocksA2).toBe(blocksA1)

    const bruteForceSame = (
      blocks: typeof blocksA1,
      prev: readonly { from: number; to: number }[],
      next: readonly { from: number; to: number }[]
    ) => {
      const active = (b: { from: number; to: number }, sels: readonly { from: number; to: number }[]) =>
        sels.some((s) => (s.from === s.to ? s.from >= b.from && s.from <= b.to : s.from < b.to && s.to > b.from))
      return blocks.every((b) => active(b, prev) === active(b, next))
    }

    const samplePairs: Array<[Array<{ from: number; to: number }>, Array<{ from: number; to: number }>]> = [
      [[{ from: 0, to: 0 }], [{ from: 5, to: 5 }]],
      [[{ from: blocksA1[0]!.to, to: blocksA1[0]!.to }], [{ from: blocksA1[0]!.to + 1, to: blocksA1[0]!.to + 1 }]],
      [[{ from: blocksA1[250]!.to + 1, to: blocksA1[250]!.to + 1 }], [{ from: blocksA1[251]!.from, to: blocksA1[251]!.from }]],
      [[{ from: blocksA1[300]!.from + 4, to: blocksA1[301]!.to - 2 }], [{ from: blocksA1[300]!.from + 4, to: blocksA1[300]!.to }]],
      [[{ from: blocksA1[100]!.to + 1, to: blocksA1[101]!.from }], [{ from: blocksA1[400]!.to + 1, to: blocksA1[401]!.from }]],
      [[{ from: 2, to: 10 }, { from: blocksA1[500]!.from + 2, to: blocksA1[500]!.from + 6 }], [{ from: 2, to: 10 }, { from: blocksA1[501]!.from + 2, to: blocksA1[501]!.from + 6 }]],
    ]

    for (const [prev, next] of samplePairs) {
      expect(haveSameActiveContainerBlocks(blocksA1, prev, next)).toBe(bruteForceSame(blocksA1, prev, next))
    }

    // Measure O(log B) cursor move check across 1,200 blocks
    const bigBlocks = [
      ...blocksA1,
      ...blocksA1.map((b) => ({ ...b, from: b.from + docTextA.length + 10, to: b.to + docTextA.length + 10 })),
    ]
    const moves = 2000
    const t0 = performance.now()
    let unchanged = true
    for (let i = 0; i < moves; i += 1) {
      const b = bigBlocks[i % bigBlocks.length]!
      if (!haveSameActiveContainerBlocks(bigBlocks, [{ from: b.from + 1, to: b.from + 1 }], [{ from: b.from + 2, to: b.from + 2 }])) {
        unchanged = false
      }
    }
    const elapsedMs = performance.now() - t0
    expect(unchanged).toBe(true)
    expect(elapsedMs).toBeLessThan(100)
  })
})
