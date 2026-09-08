import { expect, test } from "@playwright/test"
import { composeEditorContent, parseEditorMeta, resolveEditorMetaSnapshot } from "../../src/routes/Admin/editorStudioMetaModel"

test.describe("editor metadata body preservation", () => {
  for (const body of ["", "Intro\n\n```ts\n\n```", "~~~ts title=example.ts\n\n~~~"]) {
    test(`snapshot preserves canonical body with metadata: ${body || "empty"}`, () => {
      const saved = composeEditorContent(body, ["typescript"])
      const snapshot = resolveEditorMetaSnapshot(saved)
      expect(snapshot.body).toBe(body)
      expect(snapshot.tags).toEqual(["typescript"])
      expect(parseEditorMeta(composeEditorContent(snapshot.body, snapshot.tags)).body).toBe(body)
    })
  }
  for (const [name, content] of [
    ["ordinary prose between thematic breaks", "---\nThis paragraph is the manuscript.\n---\n\nLast paragraph"],
    ["unknown metadata-like text", "---\nauthor: A writer\n---\n\nLast paragraph"],
    ["mixed supported and unknown lines", "---\ntags: [\"kotlin\"]\nKeep this paragraph.\n---\n\nLast paragraph"],
    ["empty metadata value", "---\nthumbnail:\n---\n\nLast paragraph"],
  ]) {
    test(`preserves ${name} through load and save`, () => {
      const parsed = parseEditorMeta(content)
      expect(parsed.body).toBe(content)
      expect(parsed.tags).toEqual([])
      const saved = composeEditorContent(parsed.body, parsed.tags, parsed)
      expect(saved).toBe(content)
      expect(parseEditorMeta(saved).body).toBe(content)

      const withTags = composeEditorContent(parsed.body, ["typescript"])
      const reloaded = parseEditorMeta(withTags)
      expect(reloaded.body).toBe(content)
      expect(reloaded.tags).toEqual(["typescript"])
    })
  }

  test("retains supported metadata and the complete body", () => {
    const body = "Intro\n\n---\n\n```ts\nconst value = 1\n```"
    const thumbnail = "/post/api/v1/images/posts/example.png"
    const saved = composeEditorContent(body, ["typescript"], { category: "Engineering", thumbnail })
    const parsed = parseEditorMeta(saved)
    expect(parsed.body).toBe(body)
    expect(parsed.tags).toEqual(["typescript"])
    expect(parsed.category).toBe("folder::Engineering")
    expect(parsed.thumbnail).toBe(thumbnail)
    expect(composeEditorContent(parsed.body, parsed.tags, parsed)).toBe(saved)
  })
})
