import { expect, test } from "@playwright/test"
import {
  findMarkdownEditorMatches,
  planMarkdownEditorReplaceAll,
  planMarkdownEditorReplaceCurrent,
  selectMarkdownEditorMatch,
} from "../../src/components/markdown-editor/markdownEditorFindReplaceModel"
import { applyPlannedTextMutationToValue } from "../../src/components/markdown-editor/markdownEditorTextMutation"

test.describe("markdown editor find and replace model", () => {
  test("finds non-overlapping literal UTF-16 ranges and keeps case-insensitive offsets", () => {
    expect(findMarkdownEditorMatches("😀 AbA aba", "aba")).toEqual([
      { start: 3, end: 6 },
      { start: 7, end: 10 },
    ])
    expect(findMarkdownEditorMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ])
    expect(findMarkdownEditorMatches("Aba aba", "aba", { caseSensitive: true })).toEqual([{ start: 4, end: 7 }])
    expect(findMarkdownEditorMatches("text", "")).toEqual([])
  })

  test("case-insensitive literal matching handles Greek final sigma without folding accents", () => {
    expect(findMarkdownEditorMatches("ΟΣ", "οσ")).toEqual([{ start: 0, end: 2 }])
    expect(findMarkdownEditorMatches("ΟΣ", "οσ", { caseSensitive: true })).toEqual([])
    expect(findMarkdownEditorMatches("café", "cafe")).toEqual([])
  })

  test("clamps an optional captured scope and never searches outside it", () => {
    const value = "before hit hit after"
    expect(findMarkdownEditorMatches(value, "hit", { scope: { start: 7, end: 11 } })).toEqual([{ start: 7, end: 10 }])
    expect(findMarkdownEditorMatches(value, "hit", { scope: { start: 11, end: 7 } })).toEqual([])
    expect(findMarkdownEditorMatches(value, "hit", { scope: { start: -5, end: 999 } })).toEqual([
      { start: 7, end: 10 },
      { start: 11, end: 14 },
    ])
  })

  test("selects next and previous matches with wrapping relative to the selection anchor", () => {
    const value = "one two one"
    expect(selectMarkdownEditorMatch(value, "one", 0, 0, "next")).toEqual({ start: 0, end: 3 })
    expect(selectMarkdownEditorMatch(value, "one", 8, 11, "next")).toEqual({ start: 0, end: 3 })
    expect(selectMarkdownEditorMatch(value, "one", 8, 11, "previous")).toEqual({ start: 0, end: 3 })
    expect(selectMarkdownEditorMatch(value, "one", 0, 3, "previous")).toEqual({ start: 8, end: 11 })

    const adjacent = "oneone"
    expect(selectMarkdownEditorMatch(adjacent, "one", 0, 3, "next")).toEqual({ start: 3, end: 6 })
    expect(selectMarkdownEditorMatch(adjacent, "one", 0, 3, "previous")).toEqual({ start: 3, end: 6 })
    expect(selectMarkdownEditorMatch(adjacent, "one", 3, 3, "next")).toEqual({ start: 3, end: 6 })
    expect(selectMarkdownEditorMatch(adjacent, "one", 3, 3, "previous")).toEqual({ start: 0, end: 3 })
    expect(selectMarkdownEditorMatch(value, "missing", 0, 0, "next")).toBeNull()
  })

  test("replaces only an exact current match and adjusts a captured scope", () => {
    const value = "pre cat cat post"
    const result = planMarkdownEditorReplaceCurrent(value, "cat", "kitten", {
      match: { start: 4, end: 7 },
      scope: { start: 4, end: 11 },
    })

    expect(result).toEqual({
      mutation: {
        rangeStart: 4,
        rangeEnd: 7,
        replacement: "kitten",
        selectionStart: 4,
        selectionEnd: 10,
      },
      scope: { start: 4, end: 14 },
    })
    expect(applyPlannedTextMutationToValue(value, result!.mutation).value).toBe("pre kitten cat post")
    expect(planMarkdownEditorReplaceCurrent(value, "cat", "kitten", { match: { start: 5, end: 7 } })).toBeNull()
    expect(planMarkdownEditorReplaceCurrent(value, "missing", "kitten", { match: { start: 4, end: 7 } })).toBeNull()
  })

  test("replaces all literal matches in scope without expanding replacement tokens", () => {
    const value = "cat Cat cat"
    const result = planMarkdownEditorReplaceAll(value, "cat", "$&-$1-$$", { scope: { start: 0, end: 7 } })

    expect(result).toEqual({
      mutation: {
        rangeStart: 0,
        rangeEnd: 7,
        replacement: "$&-$1-$$ $&-$1-$$",
        selectionStart: 0,
        selectionEnd: 17,
      },
      count: 2,
      scope: { start: 0, end: 17 },
    })
    expect(applyPlannedTextMutationToValue(value, result!.mutation).value).toBe("$&-$1-$$ $&-$1-$$ cat")
    expect(planMarkdownEditorReplaceAll(value, "", "next")).toBeNull()
    expect(planMarkdownEditorReplaceAll(value, "missing", "next")).toBeNull()
  })
})
