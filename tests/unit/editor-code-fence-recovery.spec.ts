import { expect, test } from "@playwright/test"
import { restoreEmptyFencedCodeBlocks } from "../../src/routes/Admin/editorCodeFenceRecovery"

test("active code-block helper preserves filled blocks and surrounding prose", () => {
  const source = "Intro\n\n```ts\ncurrent()\n```\n\nOutro"
  const candidate = "Other\n\n```ts\nstale()\n```"
  expect(restoreEmptyFencedCodeBlocks(source, candidate)).toBe(source)
})

test("active code-block helper replaces only the empty matching position", () => {
  const source = "Intro\n\n```ts\n\n```\n\n```js\nkeep()\n```\n\nOutro"
  const candidate = "```ts\nrestore()\n```\n\n```js\nother()\n```"
  expect(restoreEmptyFencedCodeBlocks(source, candidate))
    .toBe(source.replace("```ts\n\n", "```ts\nrestore()\n"))
})
