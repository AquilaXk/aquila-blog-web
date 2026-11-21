import { expect, test } from "@playwright/test"
import { extractMarkdownTableLayouts } from "../../src/libs/markdown/tableMetadata"

test("keeps metadata-like code content inside a longer fenced block away from a following table", () => {
  const markdown = [
    "````markdown",
    "```",
    '<!-- aq-table {"overflowMode":"wide"} -->',
    "````",
    "| Actual | Table |",
    "| --- | --- |",
    "| value | value |",
  ].join("\n")

  expect(extractMarkdownTableLayouts(markdown)).toEqual({
    cleanedMarkdown: markdown,
    layouts: [null],
  })
})

test("does not treat indented fence-like code as an opening fence before table metadata", () => {
  for (const codeLine of ["    ```markdown", "\t~~~markdown"]) {
    const markdown = [
      codeLine,
      "const example = true",
      '<!-- aq-table {"overflowMode":"wide"} -->',
      "| Actual | Table |",
      "| --- | --- |",
      "| value | value |",
    ].join("\n")

    expect(extractMarkdownTableLayouts(markdown)).toEqual({
      cleanedMarkdown: [
        codeLine,
        "const example = true",
        "| Actual | Table |",
        "| --- | --- |",
        "| value | value |",
      ].join("\n"),
      layouts: [{ overflowMode: "wide" }],
    })
  }
})
