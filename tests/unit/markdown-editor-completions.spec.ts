import { expect, test } from "@playwright/test"
import { EditorState } from "@codemirror/state"
import type { CompletionContext } from "@codemirror/autocomplete"
import {
  codeLanguageCompletionSource,
  wikilinkCompletionSource,
  registerInternalPostSuggestions,
  clearRegisteredPostSuggestions,
  CORE_CODE_LANGUAGES,
} from "../../src/components/markdown-editor/markdownEditorCompletions"

const createMockContext = (docText: string, pos: number): CompletionContext => {
  const state = EditorState.create({ doc: docText })
  return {
    state,
    pos,
    explicit: false,
    abort: () => false,
    matchBefore: () => null,
  } as unknown as CompletionContext
}

test.describe("markdown editor completions model", () => {
  test.beforeEach(() => {
    clearRegisteredPostSuggestions()
  })

  test("codeLanguageCompletionSource suggests core code languages after triple backticks", () => {
    const doc = "```"
    const context = createMockContext(doc, 3)
    const result = codeLanguageCompletionSource(context)

    expect(result).not.toBeNull()
    expect(result?.from).toBe(3)
    expect(result?.options.length).toBe(CORE_CODE_LANGUAGES.length)
    expect(result?.options).toContainEqual(
      expect.objectContaining({ label: "typescript" })
    )
    expect(result?.options).toContainEqual(
      expect.objectContaining({ label: "javascript" })
    )
  })

  test("codeLanguageCompletionSource filters with typed query prefix", () => {
    const doc = "```ts"
    const context = createMockContext(doc, 5)
    const result = codeLanguageCompletionSource(context)

    expect(result).not.toBeNull()
    expect(result?.from).toBe(3) // starts at the prefix
  })

  test("codeLanguageCompletionSource returns null when not on a fence line", () => {
    const doc = "const x = 1"
    const context = createMockContext(doc, 5)
    const result = codeLanguageCompletionSource(context)

    expect(result).toBeNull()
  })

  test("wikilinkCompletionSource returns headings and registered internal blog posts", () => {
    registerInternalPostSuggestions([
      { title: "First Blog Post", slug: "first-post" },
      { title: "React Architecture Guide", slug: "react-guide" },
    ])

    const doc = "# Getting Started\n\n## Deep Dive\n\nCheck this out: [["
    const pos = doc.length
    const context = createMockContext(doc, pos)
    const result = wikilinkCompletionSource(context)

    expect(result).not.toBeNull()
    expect(result?.from).toBe(pos)

    // Heading links
    expect(result?.options).toContainEqual(
      expect.objectContaining({
        label: "#Getting Started",
        apply: "#Getting Started]]",
        detail: "Heading link",
      })
    )
    expect(result?.options).toContainEqual(
      expect.objectContaining({
        label: "#Deep Dive",
        apply: "#Deep Dive]]",
        detail: "Heading link",
      })
    )

    // Internal blog posts
    expect(result?.options).toContainEqual(
      expect.objectContaining({
        label: "First Blog Post",
        apply: "First Blog Post]]",
        detail: expect.stringContaining("Blog post"),
      })
    )
    expect(result?.options).toContainEqual(
      expect.objectContaining({
        label: "React Architecture Guide",
        apply: "React Architecture Guide]]",
      })
    )
  })

  test("wikilinkCompletionSource returns null when not preceded by [[", () => {
    const doc = "Just some text without double brackets"
    const context = createMockContext(doc, 10)
    const result = wikilinkCompletionSource(context)

    expect(result).toBeNull()
  })
})
