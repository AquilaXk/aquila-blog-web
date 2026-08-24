import { expect, test } from "@playwright/test"
import {
  calloutKinds,
  defaultCalloutBlockquoteToken,
  getCallout,
  resolveCalloutBlockquote,
  resolveCalloutLegacyEmoji,
} from "../../src/libs/markdown/calloutRegistry"
import { parseMarkdownSegments } from "../../src/libs/markdown/renderingSegmentModel"

test("parses all canonical callout tokens from the typed registry", () => {
  const canonical = [
    ["TIP", "tip", "T"],
    ["INFO", "info", "i"],
    ["WARNING", "warning", "!"],
    ["OUTLINE", "outline", "≡"],
    ["EXAMPLE", "example", "✓"],
    ["SUMMARY", "summary", "§"],
  ] as const

  expect(calloutKinds).toEqual(canonical.map(([, kind]) => kind))
  for (const [token, kind, marker] of canonical) {
    expect(resolveCalloutBlockquote(token)).toEqual({ kind, callout: getCallout(kind) })
    expect(parseMarkdownSegments(`> [!${token}] 제목\n> body`)).toEqual([
      expect.objectContaining({ type: "callout", kind, title: "제목", emoji: marker, content: "body" }),
    ])
    const legacyEmoji = getCallout(kind).legacyEmoji[0]
    expect(parseMarkdownSegments(`> ${legacyEmoji} 제목\n> body`)).toEqual([
      expect.objectContaining({ type: "callout", kind, title: "제목", emoji: marker, content: "body" }),
    ])
  }
})

test("resolves aliases, legacy emoji, and the default TIP token from the registry", () => {
  for (const [alias, kind] of [["NOTE", "info"], ["CAUTION", "warning"], ["IMPORTANT", "summary"]] as const) {
    expect(resolveCalloutBlockquote(alias)).toEqual({ kind, callout: getCallout(kind) })
    expect(parseMarkdownSegments(`> [!${alias}] 제목\n> body`)).toEqual([
      expect.objectContaining({ type: "callout", kind, title: "제목", emoji: getCallout(kind).marker, content: "body" }),
    ])
  }
  expect(resolveCalloutLegacyEmoji("💡 제목")).toEqual(expect.objectContaining({ kind: "tip", emoji: "💡" }))
  expect(defaultCalloutBlockquoteToken).toBe("TIP")
})

test("preserves unknown and malformed blockquotes as original markdown while keeping known callouts", () => {
  expect(parseMarkdownSegments("> [!CUSTOM]\n> body")).toEqual([
    { type: "markdown", content: "> [!CUSTOM]\n> body" },
  ])
  expect(parseMarkdownSegments("> [!]\n> body")).toEqual([
    { type: "markdown", content: "> [!]\n> body" },
  ])
  expect(parseMarkdownSegments("<aside>\n[!CUSTOM] 기존 제목\n기존 본문\n</aside>")).toEqual([
    expect.objectContaining({ type: "callout", kind: "info", title: "기존 제목", emoji: "i", content: "기존 본문" }),
  ])
})
