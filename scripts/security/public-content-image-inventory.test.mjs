import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { InventoryError, runInventory } from "./public-content-image-inventory.mjs"

const baseUrl = "https://blog.aquilaxk.site"
const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const feed = (content, pageNumber, totalElements) => ({
  content,
  pageable: {
    pageNumber,
    pageSize: 30,
    totalElements,
    totalPages: Math.ceil(totalElements / 30),
    numberOfElements: content.length,
  },
})

test("aggregates public sources across pages and fetches each post detail once", async () => {
  const requested = []
  const firstPagePosts = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    ...(index === 0 ? { thumbnail: "/post/api/v1/images/feed" } : {}),
    ...(index === 1 ? { thumbnail: "https://outside.invalid/feed" } : {}),
  }))
  const fetchImpl = async (url) => {
    requested.push(url)
    if (url.includes("page=1")) return response(200, feed(firstPagePosts, 1, 31))
    if (url.includes("page=2")) return response(200, feed([{ id: 31, thumbnail: "data:image/png;base64,AA" }], 2, 31))
    if (url.endsWith("/1")) return response(200, { id: 1, thumbnail: "https://blog.aquilaxk.site/post/api/v1/images/one", content: "![a](/post/api/v1/images/body)", contentHtml: '<img src="blob:blocked">' })
    if (url.endsWith("/2")) return response(200, {
      id: 2,
      content: [
        "```md",
        "![ignored](https://code.invalid/image)",
        "```",
        "````md",
        "```",
        "![still ignored](https://code.invalid/short-close)",
        "````",
        "    ![also ignored](https://code.invalid/indented)",
        "\\![odd direct](https://outside.invalid/odd-direct)",
        "\\\\![even direct](https://outside.invalid/even-direct)",
        "\\![odd full][odd-full]",
        "\\\\![even full][even-full]",
        "\\![odd collapsed][]",
        "\\\\![even collapsed][]",
        "\\![odd-short]",
        "\\\\![even-short]",
        "[odd-full]: https://outside.invalid/odd-full",
        "[even-full]: https://outside.invalid/even-full",
        "[odd collapsed]: https://outside.invalid/odd-collapsed",
        "[even collapsed]: https://outside.invalid/even-collapsed",
        "[odd-short]: https://outside.invalid/odd-short",
        "[even-short]: https://outside.invalid/even-short",
        "![x][outside]",
        "[outside]: https://outside.invalid/body",
        "[outside]: /post/api/v1/images/duplicate",
        "> ![quoted][quoted-outside]",
        "> [quoted-outside]: https://outside.invalid/quoted",
        '<!-- aq-bookmark {"thumbnailUrl":"https://outside.invalid/card"} -->',
        ":::bookmark /posts/1",
        "외부 카드",
        ":::",
        '<!-- aq-embed {"thumbnailUrl":"javascript:alert(1)"} -->',
        ":::embed /posts/2",
        "제거되는 카드",
        ":::",
      ].join("\n"),
      contentHtml: '<img data-src="/post/api/v1/images/decoy" alt="src=\'/post/api/v1/images/alt-decoy\'" src="https://outside.invalid/html">',
    })
    if (url.endsWith("/31")) return response(200, { id: 31, content: "![x](not-a-url)", contentHtml: "" })
    const detailId = Number(url.split("/").at(-1))
    if (Number.isSafeInteger(detailId)) return response(200, { id: detailId, content: "", contentHtml: null })
    throw new Error("unexpected request")
  }

  const result = await runInventory({ baseUrl, fetchImpl, maxPages: 3, maxPosts: 40 })

  assert.deepEqual(result, {
    scannedPosts: 31,
    scannedPages: 2,
    canonicalAbsolute: 1,
    canonicalRelative: 2,
    external: 9,
    protocolRelative: 0,
    data: 1,
    blob: 1,
    malformed: 1,
    truncated: false,
  })
  assert.equal(requested.filter((url) => url.endsWith("/2")).length, 1)
})

test("fails closed without raw response data for HTTP, shape, and bound failures", async () => {
  const sentinel = "https://private.example/should-not-leak"
  const sanitizedErrorMessages = new Set([
    "public API returned a non-success status",
    "feed response shape is invalid",
    "inventory page bound reached",
    "feed pagination is inconsistent",
    "feed post shape is invalid",
    "post response shape is invalid",
  ])
  const non200 = () => runInventory({ baseUrl, fetchImpl: async () => response(503, { sentinel }) })
  const badShape = () => runInventory({ baseUrl, fetchImpl: async () => response(200, { content: sentinel }) })
  const bound = () => runInventory({
    baseUrl,
    maxPages: 1,
    fetchImpl: async () => response(200, feed(Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })), 1, 31)),
  })
  const duplicateShift = () => runInventory({
    baseUrl,
    fetchImpl: async (url) => {
      if (url.includes("page=1")) return response(200, feed(Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })), 1, 31))
      return response(200, feed([{ id: 30 }], 2, 31))
    },
  })
  const badFeedThumbnail = () => runInventory({
    baseUrl,
    fetchImpl: async () => response(200, feed([{ id: 1, thumbnail: { sentinel } }], 1, 1)),
  })
  const badDetailThumbnail = () => runInventory({
    baseUrl,
    fetchImpl: async (url) => url.includes("/feed")
      ? response(200, feed([{ id: 1 }], 1, 1))
      : response(200, { id: 1, thumbnail: { sentinel }, content: "", contentHtml: null }),
  })

  for (const operation of [non200, badShape, bound, duplicateShift, badFeedThumbnail, badDetailThumbnail]) {
    await assert.rejects(operation, (error) => {
      assert.ok(error instanceof InventoryError)
      assert.equal(sanitizedErrorMessages.has(error.message), true)
      return true
    })
  }
})

test("accepts an empty terminal feed without inventing detail requests", async () => {
  const result = await runInventory({
    baseUrl,
    fetchImpl: async () => response(200, feed([], 1, 0)),
  })

  assert.deepEqual(result, {
    scannedPosts: 0,
    scannedPages: 1,
    canonicalAbsolute: 0,
    canonicalRelative: 0,
    external: 0,
    protocolRelative: 0,
    data: 0,
    blob: 0,
    malformed: 0,
    truncated: false,
  })
})

test("runs as a CLI from a checkout path containing spaces and non-ASCII characters", async () => {
  const directory = await mkdtemp(join(tmpdir(), "image inventory 한글 "))
  const scriptPath = join(directory, "inventory script.mjs")
  try {
    await copyFile(new URL("./public-content-image-inventory.mjs", import.meta.url), scriptPath)
    const result = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, "")
    assert.equal(result.stderr, "Inventory failed: base URL is required\n")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
